import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27018/concert_booking_test_webhook?replicaSet=rs0';
process.env.PAYMENT_PROVIDER = 'stripe';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_signature_tests_only';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_signature_tests_only';
process.env.TICKET_SECRET = 'test-ticket-signing-secret-at-least-32-chars';
process.env.SANDBOX_SECRET = 'test-sandbox-signing-secret-at-least-32-chars';
const { app } = await import('../src/app.js');
const { stripe } = await import('../src/services/payments.js');
const models = await import('../src/models/index.js');
const { User, Artist, Venue, Concert, Seat, Booking, Payment, Ticket } = models;
let booking;
before(async () => {
  assert.ok(new URL(process.env.MONGODB_URI).pathname.slice(1).startsWith('concert_booking_test'));
  await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((m) => m.init()));
  const user = await User.create({
    name: 'Webhook fixture',
    email: 'webhook@example.test',
    passwordHash: 'unused-not-a-login-account',
  });
  const artist = await Artist.create({ name: 'Webhook Artist' });
  const venue = await Venue.create({ name: 'Webhook Venue' });
  const concert = await Concert.create({
    title: 'Webhook Concert',
    artist: artist.id,
    venue: venue.id,
    startsAt: new Date(Date.now() + 86400000),
    status: 'published',
  });
  const seat = await Seat.create({
    concert: concert.id,
    label: 'V1-01',
    category: 'VIP',
    price: 10000,
  });
  booking = await Booking.create({
    user: user.id,
    concert: concert.id,
    reference: 'WEBHOOK-TEST-BOOKING',
    seats: [{ seat: seat.id, label: seat.label, category: 'VIP', price: 10000 }],
    subtotal: 10000,
    fee: 0,
    total: 10000,
    currency: 'sgd',
    status: 'pending',
    expiresAt: new Date(Date.now() + 600000),
  });
  await Seat.updateOne(
    { _id: seat.id },
    { $set: { status: 'held', booking: booking.id, holdUntil: booking.expiresAt } },
  );
  await Payment.create({
    booking: booking.id,
    provider: 'stripe',
    providerSession: 'cs_test_fixture',
    amount: 10000,
    currency: 'sgd',
  });
});
after(async () => mongoose.disconnect());
function event(id, overrides = {}) {
  return {
    id,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_fixture',
        metadata: { bookingId: booking.id },
        amount_total: 10000,
        currency: 'sgd',
        payment_status: 'paid',
        ...overrides,
      },
    },
  };
}
function send(event, tamper = false) {
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return request(app)
    .post('/api/payments/stripe/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', tamper ? 'invalid' : signature)
    .send(payload);
}
test('Stripe raw webhook rejects invalid signature and unpaid events issue nothing', async () => {
  assert.equal((await send(event('evt_forged'), true)).status, 400);
  assert.equal((await send(event('evt_pending', { payment_status: 'unpaid' }))).status, 200);
  assert.equal(await Ticket.countDocuments(), 0);
});
test('Stripe signed events must match session, amount, and currency', async () => {
  for (const [index, override] of [
    { id: 'cs_other' },
    { amount_total: 1 },
    { currency: 'usd' },
  ].entries())
    assert.equal((await send(event(`evt_mismatch_${index}`, override))).status, 400);
  assert.equal((await Booking.findById(booking.id)).status, 'pending');
});
test('valid signed Stripe event creates one ticket and retries remain idempotent', async () => {
  assert.equal((await send(event('evt_success'))).status, 200);
  assert.equal((await Booking.findById(booking.id)).status, 'paid');
  assert.equal((await send(event('evt_success'))).status, 200);
  assert.equal((await send(event('evt_second_delivery'))).status, 200);
  assert.equal(await Ticket.countDocuments(), 1);
  assert.equal((await Payment.findOne({ booking: booking.id })).status, 'succeeded');
});
