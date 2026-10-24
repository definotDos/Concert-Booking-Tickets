import { Booking, Concert, Seat, Payment, Ticket } from '../models/index.js';
import { assert, reference, transaction } from '../utils/core.js';
import { env } from '../config/env.js';
export async function expireHolds() {
  const expired = await Booking.find({
    status: { $in: ['held', 'pending'] },
    expiresAt: { $lte: new Date() },
  })
    .select('_id')
    .limit(500);
  for (const b of expired)
    await transaction(async (session) => {
      const booking = await Booking.findOneAndUpdate(
        { _id: b.id, status: { $in: ['held', 'pending'] }, expiresAt: { $lte: new Date() } },
        { $set: { status: 'expired' } },
        { session, new: true },
      );
      if (booking)
        await Seat.updateMany(
          { booking: booking._id, status: 'held' },
          { $set: { status: 'available' }, $unset: { booking: 1, holdUntil: 1 } },
          { session },
        );
    });
}
export async function holdSeats(user, concertId, seatIds) {
  await expireHolds();
  return transaction(async (session) => {
    // All concert lifecycle operations touch this document, serializing cancellation and booking.
    const concert = await Concert.findOneAndUpdate(
      { _id: concertId, status: 'published', startsAt: { $gt: new Date() } },
      { $inc: { revision: 1 } },
      { session, new: true },
    );
    assert(concert, 409, 'This concert is no longer available for booking.');
    const outstanding = await Booking.countDocuments({
      user: user._id,
      status: { $in: ['held', 'pending'] },
    }).session(session);
    assert(outstanding < 3, 409, 'Complete or cancel your existing reservations first.');
    const seats = await Seat.find({
      _id: { $in: seatIds },
      concert: concertId,
      status: 'available',
    }).session(session);
    assert(
      seats.length === seatIds.length,
      409,
      'One or more seats are no longer available. Please choose again.',
    );
    const subtotal = seats.reduce((sum, s) => sum + s.price, 0);
    const expiresAt = new Date(Date.now() + env.HOLD_MINUTES * 60000);
    const [booking] = await Booking.create(
      [
        {
          user: user._id,
          concert: concertId,
          reference: reference('BK'),
          seats: seats.map((s) => ({
            seat: s._id,
            label: s.label,
            category: s.category,
            price: s.price,
          })),
          subtotal,
          fee: concert.serviceFee,
          total: subtotal + concert.serviceFee,
          currency: concert.currency,
          expiresAt,
        },
      ],
      { session },
    );
    const result = await Seat.updateMany(
      { _id: { $in: seatIds }, status: 'available' },
      { $set: { status: 'held', booking: booking._id, holdUntil: expiresAt } },
      { session },
    );
    assert(
      result.modifiedCount === seatIds.length,
      409,
      'Seats were just reserved by someone else.',
    );
    return booking;
  });
}
export async function cancelBooking(bookingId, userId) {
  return transaction(async (session) => {
    const booking = await Booking.findOne({ _id: bookingId, user: userId }).session(session);
    assert(booking, 404, 'Booking not found.');
    assert(
      ['held', 'pending'].includes(booking.status),
      409,
      'This booking can no longer be cancelled here.',
    );
    booking.status = 'cancelled';
    await booking.save({ session });
    await Seat.updateMany(
      { booking: booking._id, status: 'held' },
      { $set: { status: 'available' }, $unset: { booking: 1, holdUntil: 1 } },
      { session },
    );
    await Payment.updateOne(
      { booking: booking._id, status: 'pending' },
      { $set: { status: 'cancelled' } },
      { session },
    );
    return booking;
  });
}
export async function cancelConcert(id) {
  return transaction(async (session) => {
    const concert = await Concert.findByIdAndUpdate(
      id,
      { $set: { status: 'cancelled' }, $inc: { revision: 1 } },
      { session, new: true },
    );
    assert(concert, 404, 'Concert not found.');
    const paid = await Booking.find({ concert: id, status: 'paid' }).session(session).select('_id');
    await Booking.updateMany(
      { concert: id, status: 'paid' },
      { $set: { status: 'refund_required' } },
      { session },
    );
    await Payment.updateMany(
      { booking: { $in: paid.map((b) => b._id) }, status: 'succeeded' },
      { $set: { status: 'refund_required' } },
      { session },
    );
    await Booking.updateMany(
      { concert: id, status: { $in: ['held', 'pending'] } },
      { $set: { status: 'cancelled' } },
      { session },
    );
    await Seat.updateMany(
      { concert: id, status: 'held' },
      { $set: { status: 'available' }, $unset: { booking: 1, holdUntil: 1 } },
      { session },
    );
    await Ticket.updateMany({ concert: id }, { $set: { status: 'void' } }, { session });
    return concert;
  });
}
