import { Artist, Concert, Seat, Venue } from '../src/models/index.js';
import { seatLayout } from '../src/controllers/admin.js';
import { transaction } from '../src/utils/core.js';

export const lineup = [
  ['IV OF SPADES', 'band'],
  ['BEN & BEN', 'band'],
  ['THE RIDLEYS', 'band'],
  ['OVER OCTOBER', 'band'],
  ['CUP OF JOE', 'band'],
  ['LETTERS FOR JUNE', 'band'],
  ['FITTERKARMA', 'band'],
  ['DECEMBER AVENUE', 'band'],
  ['ZACK TABUDLO', 'solo'],
  ['LUMI', 'solo'],
  ['ZILD', 'solo'],
];

const lineupImages = {
  'IV OF SPADES': '/IV%20OF%20SPADES.jpg',
  'BEN & BEN': '/ben-and-ben.jpg',
  'THE RIDLEYS': '/The%20Ridleys.jpg',
};

// Hide only the original demo lineup. Keep IDs, seats and booked ticket history intact.
const legacyNames = ['The Afterhours', 'Luna & The Wild', 'The Sunday Club', 'Northbound', 'Maya Rivers', 'The Fifth Avenue'];
export async function syncLineup() {
  await transaction(async (session) => {
    const legacyArtists = await Artist.find({
      name: { $in: legacyNames },
      bio: 'A fictional artist for development and end-to-end testing.',
    }).session(session);
    await Concert.updateMany({
      artist: { $in: legacyArtists.map((artist) => artist._id) },
      description: /^Development demo concert\./,
    }, { $set: { listed: false } }, { session });

    // Reuse the demo venue so existing concerts keep their venue and seat references.
    let venue = await Venue.findOne({ name: { $in: ['MOA Arena', 'The Greenroom'] }, city: { $in: ['Manila', 'Singapore'] } }).session(session);
    if (venue) {
      venue.name = 'MOA Arena';
      venue.city = 'Manila';
      venue.timezone = 'Asia/Manila';
      await venue.save({ session });
    }
    if (!venue) [venue] = await Venue.create([{
      name: 'MOA Arena', city: 'Manila',
      address: 'Development demo venue — replace before publication', timezone: 'Asia/Manila',
    }], { session });

    for (const [index, [name, type]] of lineup.entries()) {
      const artist = await Artist.findOneAndUpdate({ name }, {
        $set: { type },
        $setOnInsert: { genre: 'OPM', bio: `${type === 'band' ? 'Band' : 'Solo artist'} in the demo concert lineup. Event dates are for booking demonstrations only.` },
      }, { upsert: true, new: true, session });
      const title = `${name} Live in Concert`;
      const existing = await Concert.findOne({ artist: artist._id, title }).session(session);
      if (existing) {
        existing.venue = venue._id;
        if (lineupImages[name]) existing.image = lineupImages[name];
        await existing.save({ session });
        continue;
      }
      const startsAt = new Date(Date.now() + (30 + index * 7) * 86400000);
      startsAt.setUTCHours(12, 0, 0, 0); // 8 PM in the venue's timezone.
      const [concert] = await Concert.create([{
        title, artist: artist._id, venue: venue._id, genre: 'OPM', image: lineupImages[name],
        description: `Demo concert featuring ${name}. This is a sample booking experience, not an announced event. Dates, venue and prices are illustrative; checkout uses the development payment sandbox.`,
        startsAt, currency: 'sgd', serviceFee: 300, status: 'published',
        categories: [
          { name: 'VIP', price: 15000, rows: 3, seatsPerRow: 10 },
          { name: 'Lower Box', price: 9000, rows: 4, seatsPerRow: 10 },
          { name: 'Upper Box', price: 5000, rows: 4, seatsPerRow: 10 },
        ],
      }], { session });
      await Seat.insertMany(seatLayout(concert), { session });
    }
  });
}
