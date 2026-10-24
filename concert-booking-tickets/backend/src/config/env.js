import 'dotenv/config';
import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1),
  FRONTEND_URL: z.url().default('http://localhost:5173'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  HOLD_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  PAYMENT_PROVIDER: z.enum(['sandbox', 'stripe']).default('sandbox'),
  TICKET_SECRET: z.string().min(32),
  SANDBOX_SECRET: z.string().min(32),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});
export const env = schema.parse(process.env);
if (
  env.NODE_ENV === 'production' &&
  (env.PAYMENT_PROVIDER !== 'stripe' ||
    !env.FRONTEND_URL.startsWith('https://') ||
    /replace-with/.test(env.TICKET_SECRET + env.SANDBOX_SECRET))
)
  throw new Error('Production requires Stripe, HTTPS, and unique secrets.');
if (env.PAYMENT_PROVIDER === 'stripe' && (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET))
  throw new Error('Stripe keys are required.');
