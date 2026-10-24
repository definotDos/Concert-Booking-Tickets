import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { api } from './routes/api.js';
import { originGuard } from './middleware/auth.js';
import { assert } from './utils/core.js';
import { processPayment, stripe } from './services/payments.js';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json', limit: '256kb' }),
  async (req, res) => {
    assert(stripe, 404, 'Stripe is not configured.');
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.get('stripe-signature'),
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      return res.status(400).json({ error: 'Invalid webhook signature.' });
    }
    const outcomes = {
      'checkout.session.completed': 'success',
      'checkout.session.async_payment_succeeded': 'success',
      'checkout.session.async_payment_failed': 'failed',
      'checkout.session.expired': 'cancelled',
    };
    if (!outcomes[event.type]) return res.json({ received: true });
    const data = event.data.object;
    if (outcomes[event.type] === 'success' && data.payment_status !== 'paid')
      return res.json({ received: true, pending: true });
    await processPayment({
      id: event.id,
      provider: 'stripe',
      bookingId: data.metadata?.bookingId,
      sessionId: data.id,
      amount: data.amount_total,
      currency: data.currency,
      outcome: outcomes[event.type],
    });
    res.json({ received: true });
  },
);
app.use(express.json({ limit: '64kb' }), cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again shortly.' },
  }),
  originGuard,
);
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', paymentProvider: env.PAYMENT_PROVIDER }),
);
app.use('/api', api);
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError)
    return res
      .status(400)
      .json({ error: error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  if (error.code === 11000)
    return res
      .status(409)
      .json({ error: 'This record already exists or was just processed. Refresh and try again.' });
  if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid identifier.' });
  if (error.status) return res.status(error.status).json({ error: error.message });
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred. Please try again.' });
});
