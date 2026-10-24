import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import * as auth from '../controllers/auth.js';
import * as catalog from '../controllers/catalog.js';
import * as admin from '../controllers/admin.js';
import { authenticate, roles } from '../middleware/auth.js';
import { validate, id, concertSchema, safeImage } from '../middleware/validate.js';
import {
  Artist,
  Booking,
  Concert,
  Payment,
  PaymentEvent,
  Scan,
  Ticket,
  Venue,
} from '../models/index.js';
import { assert, escaped, pagination, publicUser } from '../utils/core.js';
import { cancelBooking, cancelConcert, expireHolds, holdSeats } from '../services/bookings.js';
import {
  checkout,
  processPayment,
  refundPayment,
  sandboxSignature,
  verifySandbox,
} from '../services/payments.js';
import { verifyTicket, withQR } from '../services/tickets.js';
import { env } from '../config/env.js';
export const api = Router();
api.param('id', (req, res, next, value) => {
  id.parse(value);
  next();
});
const authLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});
const email = z.email().trim().toLowerCase().max(254);
api.post(
  '/auth/register',
  authLimit,
  validate(
    z.object({
      name: z.string().trim().min(2).max(80),
      email,
      password: z.string().min(10, 'Password must contain at least 10 characters.').max(72),
    }),
  ),
  auth.register,
);
api.post(
  '/auth/login',
  authLimit,
  validate(z.object({ email, password: z.string().min(1).max(100) })),
  auth.login,
);
api.get('/auth/me', authenticate, (req, res) =>
  res.json({ user: publicUser(req.user), csrf: req.session.csrf }),
);
api.post('/auth/logout', authenticate, auth.logout);
api.patch(
  '/auth/profile',
  authenticate,
  validate(z.object({ name: z.string().trim().min(2).max(80) })),
  async (req, res) => {
    req.user.name = req.body.name;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  },
);
api.get('/concerts', catalog.listConcerts);
api.get('/concerts/:id', catalog.concertDetails);
api.post(
  '/bookings',
  authenticate,
  validate(
    z.object({
      concertId: id,
      seatIds: z
        .array(id)
        .min(1)
        .max(8)
        .refine((v) => new Set(v).size === v.length, 'Select each seat only once'),
    }),
  ),
  async (req, res) =>
    res.status(201).json(await holdSeats(req.user, req.body.concertId, req.body.seatIds)),
);
api.get('/bookings', authenticate, async (req, res) => {
  await expireHolds();
  const { page, limit } = pagination(req.query);
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate({ path: 'concert', populate: 'venue artist' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
api.post('/bookings/:id/cancel', authenticate, async (req, res) =>
  res.json(await cancelBooking(req.params.id, req.user._id)),
);
api.post('/bookings/:id/checkout', authenticate, async (req, res) =>
  res.json(await checkout(req.params.id, req.user._id)),
);
api.post(
  '/bookings/:id/sandbox',
  authenticate,
  validate(z.object({ outcome: z.enum(['success', 'failed', 'cancelled', 'pending']) })),
  async (req, res) => {
    assert(
      env.NODE_ENV !== 'production' && env.PAYMENT_PROVIDER === 'sandbox',
      404,
      'Sandbox is disabled.',
    );
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    assert(booking, 404, 'Booking not found.');
    const payment = await Payment.findOne({ booking: booking._id, provider: 'sandbox' });
    assert(payment, 409, 'Start checkout before testing a payment.');
    // Development-only provider emulator signs a server-generated amount and event.
    const raw = Buffer.from(
      JSON.stringify({
        id: `sandbox-${payment.id}-${req.body.outcome}`,
        provider: 'sandbox',
        bookingId: booking.id,
        amount: payment.amount,
        currency: payment.currency,
        outcome: req.body.outcome,
      }),
    );
    res.json(await processPayment(verifySandbox(raw, sandboxSignature(raw))));
  },
);
api.get('/tickets', authenticate, async (req, res) => {
  const { page, limit } = pagination(req.query);
  const filter = { user: req.user._id };
  const [tickets, total] = await Promise.all([
    Ticket.find(filter)
      .populate({ path: 'concert', populate: 'venue artist' })
      .populate('booking', 'reference')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Ticket.countDocuments(filter),
  ]);
  res.json({
    items: await Promise.all(tickets.map(withQR)),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});
api.get('/tickets/:id', authenticate, async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, user: req.user._id })
    .populate({ path: 'concert', populate: 'venue artist' })
    .populate('booking', 'reference');
  assert(ticket, 404, 'Ticket not found.');
  res.json(await withQR(ticket));
});
api.get('/staff/events', authenticate, roles('staff', 'admin'), async (req, res) =>
  res.json(
    await Concert.find({ status: 'published' })
      .select('title startsAt')
      .sort({ startsAt: -1 })
      .limit(200),
  ),
);
api.post(
  '/staff/verify',
  authenticate,
  roles('staff', 'admin'),
  validate(z.object({ token: z.string().min(1).max(1000), concertId: id })),
  async (req, res) =>
    res.json(await verifyTicket(req.body.token, req.body.concertId, req.user._id)),
);
api.get('/staff/scans', authenticate, roles('staff', 'admin'), async (req, res) => {
  const { page, limit } = pagination(req.query);
  const filter = req.query.concertId ? { concert: id.parse(req.query.concertId) } : {};
  const q = z.string().max(100).default('').parse(req.query.q).trim();
  if (q) filter.reason = { $regex: escaped(q), $options: 'i' };
  const [items, total] = await Promise.all([
    Scan.find(filter)
      .populate('staff', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Scan.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
api.use('/admin', authenticate, roles('admin'));
api.get('/admin/audit', async (req, res) => {
  const { page, limit } = pagination(req.query);
  const [items, total] = await Promise.all([
    PaymentEvent.find()
      .populate('booking', 'reference')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PaymentEvent.countDocuments(),
  ]);
  res.json({ items, total, pages: Math.ceil(total / limit) });
});
api.get(
  '/admin/stats',
  async (req, res, next) => {
    await expireHolds();
    next();
  },
  admin.stats,
);
api.post('/admin/concerts', validate(concertSchema), admin.saveConcert);
api.put('/admin/concerts/:id', validate(concertSchema), admin.saveConcert);
api.post('/admin/concerts/:id/publish', async (req, res) => {
  const concert = await Concert.findOneAndUpdate(
    { _id: req.params.id, status: 'draft', startsAt: { $gt: new Date() } },
    { $set: { status: 'published' }, $inc: { revision: 1 } },
    { new: true },
  );
  assert(concert, 409, 'Only future draft concerts can be published.');
  res.json(concert);
});
api.post('/admin/concerts/:id/cancel', async (req, res) =>
  res.json(await cancelConcert(req.params.id)),
);
api.post('/admin/bookings/:id/refund', async (req, res) =>
  res.json(await refundPayment(req.params.id)),
);
api.patch(
  '/admin/users/:id',
  validate(
    z
      .object({
        role: z.enum(['user', 'staff', 'admin']).optional(),
        disabled: z.boolean().optional(),
      })
      .refine((v) => Object.keys(v).length > 0),
  ),
  admin.updateUser,
);
for (const [resource, Model, schema] of [
  [
    'artists',
    Artist,
    z.object({
      name: z.string().trim().min(2).max(120),
      bio: z.string().max(5000).default(''),
      type: z.enum(['band', 'solo']).default('band'),
      genre: z.string().max(60).default(''),
      image: safeImage,
    }),
  ],
  [
    'venues',
    Venue,
    z.object({
      name: z.string().trim().min(2).max(120),
      city: z.string().trim().min(2).max(100),
      address: z.string().trim().min(3).max(500),
      timezone: z.string().refine((v) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, 'Invalid timezone'),
    }),
  ],
]) {
  api.post(`/admin/${resource}`, validate(schema), async (req, res) =>
    res.status(201).json(await Model.create(req.body)),
  );
  api.put(`/admin/${resource}/:id`, validate(schema), async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    assert(item, 404, 'Record not found.');
    res.json(item);
  });
  api.delete(`/admin/${resource}/:id`, async (req, res) => {
    res.json(await admin.deleteDirectory(Model, resource, req.params.id));
  });
}
api.get('/admin/:resource', admin.listAdmin);
