import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/concert_booking_test_lineup?replicaSet=rs0';
process.env.TICKET_SECRET = 'test-ticket-secret-that-is-long-enough-123';
process.env.SANDBOX_SECRET = 'test-sandbox-secret-that-is-long-enough-123';
process.env.PAYMENT_PROVIDER = 'sandbox';
const { app } = await import('../src/app.js');
const { Artist, Concert, Seat, Venue } = await import('../src/models/index.js');
const { syncLineup } = await import('../scripts/lineup.js');

test('lineup sync preserves legacy seats, is repeatable, and filters before pagination', async () => {
  assert.ok(new URL(process.env.MONGODB_URI).pathname.slice(1).startsWith('concert_booking_test'));
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await mongoose.connection.dropDatabase();
    await Promise.all([Artist, Concert, Seat, Venue].map((model) => model.init()));
    const artist = await Artist.create({ name: 'The Afterhours', bio: 'A fictional artist for development and end-to-end testing.' });
    const venue = await Venue.create({ name: 'Legacy venue' });
    const legacy = await Concert.create({ title: 'Midnight Frequencies', artist: artist.id, venue: venue.id, startsAt: new Date(Date.now() + 86400000), status: 'published', description: 'Development demo concert. Original.' });
    const seat = await Seat.create({ concert: legacy.id, label: 'V1-01', status: 'sold' });
    await syncLineup();
    await syncLineup();
    assert.equal(await Concert.countDocuments(), 12);
    assert.equal((await Seat.findById(seat.id)).status, 'sold');
    const all = await request(app).get('/api/concerts?limit=50');
    assert.equal(all.body.total, 11);
    for (const show of all.body.items) assert.equal(await Seat.countDocuments({ concert: show._id }), 110);
    const bands = await request(app).get('/api/concerts?artistType=band&limit=3&page=2');
    assert.equal(bands.body.total, 8);
    assert.equal(bands.body.items.length, 3);
    assert.ok(bands.body.items.every((show) => show.artist.type === 'band'));
    const solos = await request(app).get('/api/concerts?artistType=solo');
    assert.deepEqual(solos.body.items.map((show) => show.artist.name).sort(), ['LUMI', 'ZACK TABUDLO', 'ZILD']);
    const search = await request(app).get('/api/concerts?artistType=solo&q=ZILD&genre=OPM&city=Manila');
    assert.equal(search.body.total, 1);
    assert.equal((await request(app).get('/api/concerts?artistType=band&q=ZILD')).body.total, 0);
    assert.equal((await request(app).get('/api/concerts?artistType=invalid')).status, 400);
    assert.equal((await request(app).get(`/api/concerts/${legacy.id}`)).status, 200);
  } finally {
    await mongoose.disconnect();
  }
});
