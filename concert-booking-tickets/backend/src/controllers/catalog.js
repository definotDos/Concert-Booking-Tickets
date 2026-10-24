import { Artist, Concert, Seat, Venue } from '../models/index.js';
import { assert, escaped, pagination } from '../utils/core.js';
import { expireHolds } from '../services/bookings.js';
export async function listConcerts(req, res) {
  const { page, limit } = pagination(req.query);
  const publicFilter = { status: 'published', listed: { $ne: false }, startsAt: { $gt: new Date() } };
  const filter = { ...publicFilter };
  if (req.query.artistType) {
    assert(['band', 'solo'].includes(req.query.artistType), 400, 'Invalid artist type.');
    const artists = await Artist.find({ type: req.query.artistType }).select('_id');
    filter.artist = { $in: artists.map((artist) => artist._id) };
  }
  if (req.query.genre) filter.genre = String(req.query.genre);
  if (req.query.city) {
    const venues = await Venue.find({ city: new RegExp(escaped(req.query.city), 'i') }).select(
      '_id',
    );
    filter.venue = { $in: venues.map((v) => v._id) };
  }
  if (req.query.q) {
    const regex = new RegExp(escaped(req.query.q), 'i');
    const artists = await Artist.find({ name: regex }).select('_id');
    filter.$or = [{ title: regex }, { artist: { $in: artists.map((a) => a._id) } }];
  }
  const sort =
    req.query.sort === 'latest'
      ? { startsAt: -1 }
      : req.query.sort === 'title'
        ? { title: 1 }
        : { startsAt: 1 };
  const [items, total, genres] = await Promise.all([
    Concert.find(filter)
      .populate('artist venue')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit),
    Concert.countDocuments(filter),
    Concert.distinct('genre', publicFilter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit), genres });
}
export async function concertDetails(req, res) {
  await expireHolds();
  const concert = await Concert.findOne({
    _id: req.params.id,
    status: { $in: ['published', 'cancelled'] },
  }).populate('artist venue');
  assert(concert, 404, 'Concert not found.');
  const seats = await Seat.find({ concert: concert._id })
    .select('label category row number price status holdUntil')
    .sort({ category: 1, row: 1, number: 1 });
  res.json({ concert, seats, serverTime: new Date() });
}
