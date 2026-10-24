import crypto from 'node:crypto';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Booking, Concert, Payment, PaymentEvent, Seat, Ticket } from '../models/index.js';
import { assert, reference, transaction } from '../utils/core.js';
export const stripe = env.PAYMENT_PROVIDER === 'stripe' ? new Stripe(env.STRIPE_SECRET_KEY) : null;
export const sandboxSignature = (raw) =>
  crypto.createHmac('sha256', env.SANDBOX_SECRET).update(raw).digest('hex');
export function verifySandbox(raw, signature) {
  const actual = Buffer.from(signature || '');
  const expected = Buffer.from(sandboxSignature(raw));
  assert(
    actual.length === expected.length && crypto.timingSafeEqual(actual, expected),
    400,
    'Invalid sandbox signature.',
  );
  return JSON.parse(raw.toString());
}
export async function checkout(bookingId, userId) {
  const result = await transaction(async (session) => {
    const booking = await Booking.findOne({ _id: bookingId, user: userId }).session(session);
    assert(booking, 404, 'Booking not found.');
    assert(
      ['held', 'pending'].includes(booking.status) && booking.expiresAt > new Date(),
      409,
      'The reservation has expired or is no longer payable.',
    );
    let payment = await Payment.findOne({ booking: bookingId }).session(session);
    if (!payment)
      [payment] = await Payment.create(
        [
          {
            booking: bookingId,
            provider: env.PAYMENT_PROVIDER,
            amount: booking.total,
            currency: booking.currency,
          },
        ],
        { session },
      );
    booking.status = 'pending';
    await booking.save({ session });
    return { booking, payment };
  });
  if (env.PAYMENT_PROVIDER === 'sandbox')
    return { provider: 'sandbox', booking: result.booking, paymentId: result.payment.id };
  let payment = result.payment;
  if (!payment.providerSession) {
    // Provider idempotency protects retries after a network/process failure.
    const stripeSession = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        client_reference_id: bookingId,
        metadata: { bookingId },
        line_items: [
          {
            price_data: {
              currency: payment.currency,
              unit_amount: payment.amount,
              product_data: { name: `Concert tickets · ${result.booking.reference}` },
            },
            quantity: 1,
          },
        ],
        success_url: `${env.FRONTEND_URL}/tickets?payment=success`,
        cancel_url: `${env.FRONTEND_URL}/tickets?payment=cancelled`,
      },
      { idempotencyKey: `checkout-${bookingId}` },
    );
    payment = await Payment.findByIdAndUpdate(
      payment.id,
      { $set: { providerSession: stripeSession.id, checkoutUrl: stripeSession.url } },
      { new: true },
    );
  }
  return { provider: 'stripe', url: payment.checkoutUrl };
}
// Only verified provider notifications enter this function. Never trust a redirect or client amount.
export async function processPayment(event) {
  return transaction(async (session) => {
    if (await PaymentEvent.exists({ eventId: event.id }).session(session))
      return { duplicate: true };
    const payment = await Payment.findOne({
      booking: event.bookingId,
      provider: event.provider,
    }).session(session);
    assert(payment, 404, 'Payment not found.');
    assert(
      event.amount === payment.amount && event.currency === payment.currency,
      400,
      'Payment amount or currency mismatch.',
    );
    if (event.provider === 'stripe')
      assert(event.sessionId === payment.providerSession, 400, 'Checkout session mismatch.');
    const booking = await Booking.findById(event.bookingId).session(session);
    await PaymentEvent.create(
      [
        {
          eventId: event.id,
          provider: event.provider,
          booking: booking._id,
          outcome: event.outcome,
        },
      ],
      { session },
    );
    if (payment.verifiedAt || payment.status === 'refunded') return { duplicate: true };
    if (event.outcome === 'pending') return { status: booking.status };
    if (event.outcome !== 'success') {
      if (['held', 'pending'].includes(booking.status)) {
        booking.status = event.outcome === 'cancelled' ? 'cancelled' : 'failed';
        await booking.save({ session });
        await Seat.updateMany(
          { booking: booking._id, status: 'held' },
          { $set: { status: 'available' }, $unset: { booking: 1, holdUntil: 1 } },
          { session },
        );
      }
      payment.status = event.outcome === 'cancelled' ? 'cancelled' : 'failed';
      await payment.save({ session });
      return { status: booking.status };
    }
    const concert = await Concert.findOneAndUpdate(
      { _id: booking.concert, status: 'published', startsAt: { $gt: new Date() } },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    const heldCount = await Seat.countDocuments({ booking: booking._id, status: 'held' }).session(
      session,
    );
    const valid =
      concert &&
      ['held', 'pending'].includes(booking.status) &&
      booking.expiresAt > new Date() &&
      heldCount === booking.seats.length;
    payment.verifiedAt = new Date();
    payment.status = valid ? 'succeeded' : 'refund_required';
    booking.status = valid ? 'paid' : 'refund_required';
    await payment.save({ session });
    await booking.save({ session });
    if (!valid) {
      await Seat.updateMany(
        { booking: booking._id, status: 'held' },
        { $set: { status: 'available' }, $unset: { booking: 1, holdUntil: 1 } },
        { session },
      );
      return { status: 'refund_required' };
    }
    await Seat.updateMany(
      { booking: booking._id, status: 'held' },
      { $set: { status: 'sold' }, $unset: { holdUntil: 1 } },
      { session },
    );
    await Ticket.create(
      booking.seats.map((s) => ({
        reference: reference('TKT'),
        booking: booking._id,
        user: booking.user,
        concert: booking.concert,
        seat: s.seat,
        label: s.label,
        category: s.category,
      })),
      { session, ordered: true },
    );
    return { status: 'paid' };
  });
}
export async function refundPayment(bookingId) {
  const payment = await Payment.findOne({ booking: bookingId });
  assert(
    payment && payment.status === 'refund_required',
    409,
    'No refund is required for this booking.',
  );
  let refundReference = `sandbox-refund-${payment.id}`;
  if (payment.provider === 'stripe') {
    const checkoutSession = await stripe.checkout.sessions.retrieve(payment.providerSession);
    const refund = await stripe.refunds.create(
      { payment_intent: checkoutSession.payment_intent },
      { idempotencyKey: `refund-${payment.id}` },
    );
    assert(
      refund.status === 'succeeded',
      409,
      `Refund is ${refund.status}. Retry to reconcile its final status.`,
    );
    refundReference = refund.id;
  }
  return transaction(async (session) => {
    await Payment.updateOne(
      { _id: payment._id },
      { $set: { status: 'refunded', refundReference } },
      { session },
    );
    await Booking.updateOne({ _id: bookingId }, { $set: { status: 'refunded' } }, { session });
    await Ticket.updateMany({ booking: bookingId }, { $set: { status: 'void' } }, { session });
    return { status: 'refunded', refundReference };
  });
}
