import {
  Artist,
  Booking,
  Concert,
  Payment,
  Seat,
  Session,
  Ticket,
  User,
  Venue,
} from '../models/index.js';
import { assert, escaped, pagination, publicUser, transaction } from '../utils/core.js';
import { z } from 'zod';
export function seatLayout(concert) {
  const prefixes = { VIP: 'V', 'Lower Box': 'L', 'Upper Box': 'U' };
  return concert.categories.flatMap((c) =>
    Array.from({ length: c.rows }, (_, row) =>
      Array.from({ length: c.seatsPerRow }, (_, n) => ({
        concert: concert._id,
        label: `${prefixes[c.name]}${row + 1}-${String(n + 1).padStart(2, '0')}`,
        category: c.name,
        row: `${prefixes[c.name]}${row + 1}`,
        number: n + 1,
        price: c.price,
      })),
    ).flat(),
  );
}
export async function saveConcert(req, res) {
  assert(new Date(req.body.startsAt) > new Date(), 400, 'Choose a future event date.');
  const concert = await transaction(async (session) => {
    // Write the referenced records so deletion and concert creation cannot both win.
    const artist = await Artist.findByIdAndUpdate(
      req.body.artist,
      { $inc: { revision: 1 } },
      { session },
    );
    assert(artist, 400, 'Artist not found.');
    const venue = await Venue.findByIdAndUpdate(
      req.body.venue,
      { $inc: { revision: 1 } },
      { session },
    );
    assert(venue, 400, 'Venue not found.');
    if (!req.params.id) {
      const [created] = await Concert.create([req.body], { session });
      await Seat.insertMany(seatLayout(created), { session });
      return created;
    }
    const existing = await Concert.findById(req.params.id).session(session);
    assert(existing, 404, 'Concert not found.');
    assert(existing.status !== 'cancelled', 409, 'Cancelled concerts cannot be edited.');
    const hasBookings = await Booking.exists({ concert: existing._id }).session(session);
    assert(
      !hasBookings,
      409,
      'This event has bookings. Its details and seating are locked to preserve purchased tickets. Cancel it if necessary.',
    );
    Object.assign(existing, req.body);
    existing.revision += 1;
    await existing.save({ session });
    await Seat.deleteMany({ concert: existing._id }, { session });
    await Seat.insertMany(seatLayout(existing), { session });
    return existing;
  });
  res.status(req.params.id ? 200 : 201).json(concert);
}
export async function stats(req, res) {
  const [bookings, tickets, upcoming, available, held, sold, revenue, recent, revenueHistory] =
    await Promise.all([
      Booking.countDocuments(),
      Ticket.countDocuments({ status: { $ne: 'void' } }),
      Concert.countDocuments({ status: 'published', startsAt: { $gt: new Date() } }),
      Seat.countDocuments({ status: 'available' }),
      Seat.countDocuments({ status: 'held' }),
      Seat.countDocuments({ status: 'sold' }),
      Payment.aggregate([
        { $match: { status: 'succeeded', verifiedAt: { $ne: null } } },
        { $group: { _id: '$currency', amount: { $sum: '$amount' } } },
      ]),
      Payment.find()
        .populate({ path: 'booking', populate: { path: 'user', select: 'name email' } })
        .sort({ createdAt: -1 })
        .limit(10),
      Payment.aggregate([
        {
          $match: {
            status: 'succeeded',
            verifiedAt: { $gte: new Date(Date.now() - 30 * 86400000) },
          },
        },
        {
          $group: {
            _id: {
              day: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: '$verifiedAt',
                  timezone: 'Asia/Manila',
                },
              },
              currency: '$currency',
            },
            amount: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.day': 1 } },
      ]),
    ]);
  res.json({ bookings, tickets, upcoming, available, held, sold, revenue, recent, revenueHistory });
}
export async function listAdmin(req, res) {
  const models = {
    concerts: Concert,
    artists: Artist,
    venues: Venue,
    bookings: Booking,
    users: User,
    payments: Payment,
  };
  const model = models[req.params.resource];
  assert(model, 404, 'Resource not found.');
  const options = z
    .object({
      q: z.string().max(100).default(''),
      status: z.string().max(30).default(''),
      sort: z.enum(['newest', 'oldest', 'name']).default('newest'),
    })
    .parse(req.query);
  const filter = {};
  const statuses =
    model === User
      ? ['active', 'disabled', 'user', 'staff', 'admin']
      : model.schema.path('status')?.enumValues || [];
  if (options.status) {
    assert(statuses.includes(options.status), 400, 'Invalid status filter.');
    if (model === User) {
      if (['active', 'disabled'].includes(options.status))
        filter.disabled = options.status === 'disabled';
      else filter.role = options.status;
    } else filter.status = options.status;
  }
  if (options.q.trim()) {
    const regex = new RegExp(escaped(options.q.trim()), 'i');
    const fields =
      model === User
        ? ['name', 'email']
        : model === Artist
          ? ['name', 'genre']
          : model === Venue
            ? ['name', 'city', 'address']
            : model === Concert
              ? ['title', 'genre']
              : model === Booking
                ? ['reference', 'seats.label']
                : ['provider', 'providerSession', 'refundReference'];
    filter.$or = fields.map((field) => ({ [field]: regex }));
    if (model === Booking || model === Payment) {
      const users = await User.find({ $or: [{ name: regex }, { email: regex }] }).select('_id');
      const concerts = await Concert.find({ title: regex }).select('_id');
      const related = [
        { user: { $in: users.map((u) => u._id) } },
        { concert: { $in: concerts.map((c) => c._id) } },
      ];
      if (model === Booking) filter.$or.push(...related);
      else {
        const bookings = await Booking.find({ $or: [{ reference: regex }, ...related] }).select(
          '_id',
        );
        filter.$or.push({ booking: { $in: bookings.map((b) => b._id) } });
      }
    }
  }
  const { page, limit } = pagination(req.query);
  const nameField =
    model === Concert
      ? 'title'
      : model === Booking
        ? 'reference'
        : model === Payment
          ? 'provider'
          : 'name';
  const sort =
    options.sort === 'name'
      ? { [nameField]: 1, _id: 1 }
      : { createdAt: options.sort === 'oldest' ? 1 : -1, _id: options.sort === 'oldest' ? 1 : -1 };
  let query = model.find(filter);
  if (model === Concert) query = query.populate('artist venue');
  if (model === Booking) query = query.populate('user concert');
  const [items, total] = await Promise.all([
    query
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    model.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit), statuses });
}
export async function deleteDirectory(Model, resource, recordId) {
  return transaction(async (session) => {
    const item = await Model.findByIdAndUpdate(recordId, { $inc: { revision: 1 } }, { session });
    assert(item, 404, 'Record not found.');
    const used = await Concert.exists({
      [resource === 'artists' ? 'artist' : 'venue']: recordId,
    }).session(session);
    assert(!used, 409, 'This record is used by a concert and cannot be deleted.');
    await Model.deleteOne({ _id: recordId }, { session });
    return { message: 'Deleted.' };
  });
}
export async function updateUser(req, res) {
  assert(req.params.id !== req.user.id, 400, 'You cannot change your own access.');
  const user = await User.findById(req.params.id);
  assert(user, 404, 'User not found.');
  assert(
    user.role !== 'admin',
    403,
    'Existing administrators must be managed directly by the system operator.',
  );
  Object.assign(user, req.body);
  await user.save();
  await Session.deleteMany({ user: user._id });
  res.json(publicUser(user));
}
