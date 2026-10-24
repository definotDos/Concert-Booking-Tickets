import { z } from 'zod';
export const id = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
export const validate = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};
export const safeImage = z
  .union([z.literal(''), z.url().refine((v) => v.startsWith('https://'), 'Use an HTTPS image URL')])
  .default('');
export const concertSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(5000).default(''),
  artist: id,
  venue: id,
  startsAt: z.iso.datetime({ offset: true }),
  image: safeImage,
  genre: z.string().trim().max(60).default('Live'),
  currency: z.enum(['sgd', 'usd', 'php']).default('sgd'),
  serviceFee: z.number().int().min(0).max(100000).default(0),
  categories: z
    .array(
      z.object({
        name: z.enum(['VIP', 'Lower Box', 'Upper Box']),
        price: z.number().int().min(1).max(10000000),
        rows: z.number().int().min(1).max(20),
        seatsPerRow: z.number().int().min(1).max(30),
      }),
    )
    .min(1)
    .max(3)
    .refine(
      (c) => new Set(c.map((x) => x.name)).size === c.length,
      'Category names must be unique',
    ),
});
