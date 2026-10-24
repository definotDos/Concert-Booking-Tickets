import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI =
  process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27018/concert_booking_test?replicaSet=rs0';
process.env.TICKET_SECRET = 'test-ticket-secret-that-is-long-enough-123';
process.env.SANDBOX_SECRET = 'test-sandbox-secret-that-is-long-enough-123';
process.env.PAYMENT_PROVIDER = 'sandbox';
const { app } = await import('../src/app.js');
const models = await import('../src/models/index.js');
const { User, Artist, Venue, Concert, Seat, Booking, Ticket, Payment, Scan } = models;
const { expireHolds } = await import('../src/services/bookings.js');
const { processPayment, verifySandbox } = await import('../src/services/payments.js');
const clients = {};
let concert, otherConcert, seats;
async function mutate(client, path, body = {}, method = 'post') {
  return client.agent[method](path).set('X-CSRF-Token', client.csrf).send(body);
}
async function hold(client, chosen) {
  return mutate(client, '/api/bookings', {
    concertId: concert.id,
    seatIds: chosen.map((s) => s.id),
  });
}
async function startPayment(client, b) {
  return mutate(client, `/api/bookings/${b._id}/checkout`);
}
async function pay(client, b, outcome = 'success') {
  return mutate(client, `/api/bookings/${b._id}/sandbox`, { outcome });
}
before(async () => {
  const uri = process.env.MONGODB_URI;
  if (!new URL(uri).pathname.slice(1).startsWith('concert_booking_test'))
    throw new Error('Tests require a database name starting concert_booking_test.');
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(models).map((m) => m.init()));
  for (const role of ['user', 'other', 'staff', 'admin']) {
    const agent = request.agent(app);
    const response = await agent.post('/api/auth/register').send({
      name: `Test ${role}`,
      email: `${role}@example.test`,
      password: 'A-long-test-password-123',
    });
    assert.equal(response.status, 201, JSON.stringify(response.body));
    clients[role] = { agent, csrf: response.body.csrf, id: response.body.user.id };
    if (['staff', 'admin'].includes(role))
      await User.updateOne({ _id: response.body.user.id }, { $set: { role } });
  }
  const artist = await Artist.create({ name: 'Test Artist' });
  const venue = await Venue.create({
    name: 'Test Venue',
    city: 'Manila',
    address: 'Test address',
  });
  const payload = {
    title: 'Test Concert',
    artist: artist.id,
    venue: venue.id,
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    currency: 'sgd',
    serviceFee: 300,
    categories: [
      { name: 'VIP', price: 10000, rows: 5, seatsPerRow: 10 },
      { name: 'Lower Box', price: 5000, rows: 1, seatsPerRow: 10 },
      { name: 'Upper Box', price: 3000, rows: 1, seatsPerRow: 10 },
    ],
  };
  const created = await mutate(clients.admin, '/api/admin/concerts', payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  concert = await Concert.findById(created.body._id);
  const published = await mutate(clients.admin, `/api/admin/concerts/${concert.id}/publish`);
  assert.equal(published.status, 200);
  otherConcert = await Concert.create({ ...payload, title: 'Other concert', status: 'published' });
  seats = await Seat.find({ concert: concert.id }).sort({ label: 1 });
});
after(async () => {
  await mongoose.disconnect();
});

test('category seat prefixes remain stable when categories are omitted or reordered', async () => {
  const { seatLayout } = await import('../src/controllers/admin.js');
  const layout = seatLayout({
    _id: concert._id,
    categories: [
      { name: 'Upper Box', rows: 1, seatsPerRow: 2, price: 3000 },
      { name: 'VIP', rows: 1, seatsPerRow: 1, price: 10000 },
    ],
  });
  assert.deepEqual(
    layout.map((s) => s.label),
    ['U1-01', 'U1-02', 'V1-01'],
  );
});
test('register, session recovery, login, validation, access control and CSRF', async () => {
  assert.equal((await request(app).get('/api/bookings')).status, 401);
  assert.equal((await clients.user.agent.get('/api/admin/stats')).status, 403);
  assert.equal((await clients.user.agent.post('/api/bookings').send({})).status, 403);
  assert.equal((await mutate(clients.user, '/api/bookings', {})).status, 400);
  assert.equal((await clients.user.agent.get('/api/auth/me')).body.user.email, 'user@example.test');
  assert.equal(
    (
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.test', password: 'wrong' })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.test', password: 'A-long-test-password-123' })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(app).post('/api/auth/register').send({
        name: 'Duplicate',
        email: 'user@example.test',
        password: 'A-long-test-password-123',
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await request(app)
        .post('/api/auth/login')
        .set('Origin', 'https://attacker.test')
        .send({ email: 'user@example.test', password: 'x' })
    ).status,
    403,
  );
});
test('registration requires 10 characters and supports login with the new minimum', async () => {
  const details = { name: 'Password Check', email: 'password-check@example.test' };
  const register = (password) => request(app).post('/api/auth/register').send({ ...details, password });
  assert.equal((await register('Abcdef12!')).status, 400);
  assert.equal((await register('é'.repeat(37))).status, 400);
  const created = await register('Abcdef123!');
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const login = await request(app).post('/api/auth/login').send({ email: details.email, password: 'Abcdef123!' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
});

test('browse/search/details expose seat states but no reservation ownership', async () => {
  const list = await request(app).get('/api/concerts?q=Test&city=Manila');
  assert.equal(list.status, 200);
  assert.ok(list.body.total >= 1);
  const details = await request(app).get(`/api/concerts/${concert.id}`);
  assert.equal(details.status, 200);
  assert.equal(details.body.seats.length, 70);
  assert.equal(details.body.seats[0].booking, undefined);
  assert.equal((await request(app).get('/api/concerts/invalid')).status, 400);
});
test('complete booking, verified sandbox payment, downloadable QR data, one-time concurrent admission', async () => {
  const held = await hold(clients.user, seats.slice(0, 2));
  assert.equal(held.status, 201);
  const b = held.body;
  assert.equal(b.total, b.seats.reduce((s, v) => s + v.price, 0) + 300);
  assert.equal((await startPayment(clients.other, b)).status, 404);
  assert.equal((await startPayment(clients.user, b)).status, 200);
  assert.equal((await pay(clients.user, b, 'pending')).body.status, 'pending');
  assert.equal(await Ticket.countDocuments({ booking: b._id }), 0);
  assert.equal((await pay(clients.user, b)).body.status, 'paid');
  assert.equal((await pay(clients.user, b)).body.duplicate, true);
  assert.equal(await Ticket.countDocuments({ booking: b._id }), 2);
  assert.equal(await Seat.countDocuments({ booking: b._id, status: 'sold' }), 2);
  const tickets = (await clients.user.agent.get('/api/tickets')).body.items;
  const t = tickets.find((t) => t.booking._id === b._id);
  assert.ok(t.qr.startsWith('data:image/png;base64,'));
  assert.ok(t.token.startsWith('v1.'));
  assert.equal((await clients.other.agent.get(`/api/tickets/${t._id}`)).status, 404);
  assert.equal(
    (await mutate(clients.user, '/api/staff/verify', { token: t.token, concertId: concert.id }))
      .status,
    403,
  );
  const wrong = await mutate(clients.staff, '/api/staff/verify', {
    token: t.token,
    concertId: otherConcert.id,
  });
  assert.equal(wrong.body.accepted, false);
  const invalid = await mutate(clients.staff, '/api/staff/verify', {
    token: 'fake-code',
    concertId: concert.id,
  });
  assert.equal(invalid.body.accepted, false);
  const scans = await Promise.all(
    [1, 2].map(() =>
      mutate(clients.staff, '/api/staff/verify', { token: t.token, concertId: concert.id }),
    ),
  );
  assert.equal(scans.filter((s) => s.body.accepted).length, 1);
  assert.equal(scans.filter((s) => s.body.reason === 'Ticket has already been used').length, 1);
  assert.equal(await Scan.countDocuments(), 4);
});
test('simultaneous requests for the same seat have exactly one winner', async () => {
  const responses = await Promise.all([
    hold(clients.user, [seats[3]]),
    hold(clients.other, [seats[3]]),
  ]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const winner = responses[0].status === 201 ? clients.user : clients.other;
  const b = responses.find((r) => r.status === 201).body;
  assert.equal((await mutate(winner, `/api/bookings/${b._id}/cancel`)).status, 200);
  assert.equal((await Seat.findById(seats[3].id)).status, 'available');
});
test('multi-seat reservations are atomic and duplicate seat ids are rejected', async () => {
  const result = await hold(clients.user, [seats[0], seats[4]]);
  assert.equal(result.status, 409);
  assert.equal((await Seat.findById(seats[4].id)).status, 'available');
  assert.equal((await hold(clients.user, [seats[4], seats[4]])).status, 400);
});
test('expired holds release seats; late verified payment cannot steal another booking', async () => {
  const b = (await hold(clients.user, [seats[5]])).body;
  await startPayment(clients.user, b);
  await Booking.updateOne({ _id: b._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await expireHolds();
  assert.equal((await Booking.findById(b._id)).status, 'expired');
  assert.equal((await Seat.findById(seats[5].id)).status, 'available');
  const other = await hold(clients.other, [seats[5]]);
  assert.equal(other.status, 201);
  assert.equal((await pay(clients.user, b)).body.status, 'refund_required');
  assert.equal(await Ticket.countDocuments({ booking: b._id }), 0);
  assert.equal(String((await Seat.findById(seats[5].id)).booking), other.body._id);
  assert.equal(
    (await mutate(clients.admin, `/api/admin/bookings/${b._id}/refund`)).body.status,
    'refunded',
  );
  await mutate(clients.other, `/api/bookings/${other.body._id}/cancel`);
});
test('failed and cancelled payment attempts release holds and issue no tickets', async () => {
  for (const [i, outcome] of ['failed', 'cancelled'].entries()) {
    const b = (await hold(clients.user, [seats[6 + i]])).body;
    await startPayment(clients.user, b);
    assert.equal((await pay(clients.user, b, outcome)).body.status, outcome);
    assert.equal(await Ticket.countDocuments({ booking: b._id }), 0);
    assert.equal((await Seat.findById(seats[6 + i].id)).status, 'available');
  }
});
test('forged payment confirmation and amount mismatch are rejected', async () => {
  assert.throws(() => verifySandbox(Buffer.from('{}'), 'forged'), /Invalid sandbox signature/);
  const b = (await hold(clients.user, [seats[8]])).body;
  await startPayment(clients.user, b);
  await assert.rejects(
    processPayment({
      id: 'bad-amount',
      provider: 'sandbox',
      bookingId: b._id,
      amount: 1,
      currency: 'sgd',
      outcome: 'success',
    }),
    /amount or currency/,
  );
  assert.equal((await Payment.findOne({ booking: b._id })).status, 'pending');
  await mutate(clients.user, `/api/bookings/${b._id}/cancel`);
});
test('admin statistics count only verified revenue; cancellation voids tickets and supports refunds', async () => {
  const stats = await clients.admin.agent.get('/api/admin/stats');
  assert.equal(stats.status, 200);
  assert.equal(stats.body.sold, 2);
  assert.equal(stats.body.revenue.length, 1);
  const cancel = await mutate(clients.admin, `/api/admin/concerts/${concert.id}/cancel`);
  assert.equal(cancel.status, 200);
  assert.equal(await Ticket.countDocuments({ concert: concert.id, status: 'valid' }), 0);
  assert.equal((await hold(clients.user, [seats[9]])).status, 409);
  const refunds = await Booking.find({ concert: concert.id, status: 'refund_required' });
  assert.equal(refunds.length, 1);
  assert.equal(
    (await mutate(clients.admin, `/api/admin/bookings/${refunds[0].id}/refund`)).status,
    200,
  );
  assert.equal((await clients.admin.agent.get('/api/admin/stats')).body.revenue.length, 0);
});

test('admin search, statuses, sorting and pagination filter real records safely', async () => {
  const users = await clients.admin.agent.get(
    '/api/admin/users?q=other%40example.test&status=user',
  );
  assert.equal(users.status, 200);
  assert.equal(users.body.total, 1);
  assert.equal(users.body.items[0].email, 'other@example.test');
  const concerts = await clients.admin.agent.get('/api/admin/concerts?status=cancelled&q=Test');
  assert.equal(concerts.status, 200);
  assert.equal(concerts.body.total, 1);
  assert.equal(concerts.body.items[0]._id, concert.id);
  const bookings = await clients.admin.agent.get(
    '/api/admin/bookings?q=user%40example.test&status=refunded&limit=1',
  );
  assert.equal(bookings.status, 200);
  assert.ok(bookings.body.total >= 1);
  assert.equal(bookings.body.items.length, 1);
  const payments = await clients.admin.agent.get(
    `/api/admin/payments?q=${encodeURIComponent(bookings.body.items[0].reference)}&status=refunded`,
  );
  assert.equal(payments.status, 200);
  assert.equal(payments.body.total, 1);
  const sorted = await clients.admin.agent.get('/api/admin/users?sort=name&limit=2&page=2');
  assert.equal(sorted.body.items.length, 2);
  assert.equal(sorted.body.page, 2);
  assert.equal((await clients.admin.agent.get('/api/admin/users?q=.*')).body.total, 0);
  assert.equal((await clients.admin.agent.get('/api/admin/users?sort=untrusted')).status, 400);
  assert.equal((await clients.admin.agent.get('/api/admin/users?status=paid')).status, 400);
});

test('concurrent directory deletion and event creation never leave dangling references', async () => {
  for (const resource of ['artists', 'venues']) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const artist = await Artist.create({ name: `Race artist ${resource} ${attempt}` });
      const venue = await Venue.create({ name: `Race venue ${resource} ${attempt}` });
      const payload = {
        title: `Directory race ${resource} ${attempt}`,
        artist: artist.id,
        venue: venue.id,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        categories: [{ name: 'Upper Box', price: 3000, rows: 1, seatsPerRow: 2 }],
      };
      const target = resource === 'artists' ? artist : venue;
      const [created, deleted] = await Promise.all([
        mutate(clients.admin, '/api/admin/concerts', payload),
        mutate(clients.admin, `/api/admin/${resource}/${target.id}`, {}, 'delete'),
      ]);
      if (created.status === 201) {
        assert.equal(deleted.status, 409);
        assert.ok(await Artist.exists({ _id: artist.id }));
        assert.ok(await Venue.exists({ _id: venue.id }));
        assert.equal(await Seat.countDocuments({ concert: created.body._id }), 2);
      } else {
        assert.equal(created.status, 400, JSON.stringify(created.body));
        assert.equal(deleted.status, 200);
        assert.equal(await Concert.countDocuments({ title: payload.title }), 0);
      }
    }
  }
});

test('reporting and audit data remain admin-only; scan search uses literal text', async () => {
  assert.equal((await clients.user.agent.get('/api/admin/audit')).status, 403);
  const audit = await clients.admin.agent.get('/api/admin/audit');
  assert.equal(audit.status, 200);
  assert.ok(audit.body.items.length > 0);
  assert.ok(audit.body.items.every((item) => item.eventId && !item.token));
  const report = await clients.admin.agent.get('/api/admin/stats');
  assert.ok(Array.isArray(report.body.revenueHistory));
  const scans = await clients.admin.agent.get('/api/staff/scans?q=%5Bno-match%5D');
  assert.equal(scans.status, 200);
  assert.equal(scans.body.total, 0);
  assert.equal((await clients.user.agent.get('/api/staff/scans')).status, 403);
});

test('profile updates are scoped to the authenticated user and cannot change access', async () => {
  assert.equal(
    (await request(app).patch('/api/auth/profile').send({ name: 'New name' })).status,
    401,
  );
  assert.equal(
    (await clients.user.agent.patch('/api/auth/profile').send({ name: 'New name' })).status,
    403,
  );
  assert.equal(
    (await mutate(clients.user, '/api/auth/profile', { name: ' ' }, 'patch')).status,
    400,
  );
  const response = await mutate(
    clients.user,
    '/api/auth/profile',
    { name: 'Updated listener', role: 'admin' },
    'patch',
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.user.name, 'Updated listener');
  assert.equal(response.body.user.role, 'user');
  assert.equal((await clients.user.agent.get('/api/auth/me')).body.user.name, 'Updated listener');
});

test('user access changes revoke sessions; disabled accounts and self-demotion are blocked', async () => {
  assert.equal(
    (await mutate(clients.admin, `/api/admin/users/${clients.admin.id}`, { role: 'user' }, 'patch'))
      .status,
    400,
  );
  assert.equal(
    (
      await mutate(
        clients.admin,
        `/api/admin/users/${clients.other.id}`,
        { role: 'staff' },
        'patch',
      )
    ).status,
    200,
  );
  assert.equal((await clients.other.agent.get('/api/auth/me')).status, 401);
  const login = await clients.other.agent
    .post('/api/auth/login')
    .send({ email: 'other@example.test', password: 'A-long-test-password-123' });
  assert.equal(login.body.user.role, 'staff');
  clients.other.csrf = login.body.csrf;
  assert.equal(
    (
      await mutate(
        clients.admin,
        `/api/admin/users/${clients.other.id}`,
        { disabled: true },
        'patch',
      )
    ).status,
    200,
  );
  assert.equal((await clients.other.agent.get('/api/auth/me')).status, 401);
  assert.equal(
    (
      await clients.other.agent
        .post('/api/auth/login')
        .send({ email: 'other@example.test', password: 'A-long-test-password-123' })
    ).status,
    401,
  );
  assert.equal((await mutate(clients.user, '/api/auth/logout')).status, 200);
  assert.equal((await clients.user.agent.get('/api/auth/me')).status, 401);
});
