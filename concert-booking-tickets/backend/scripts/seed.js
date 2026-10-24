import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { Artist, Concert, Seat, User, Venue } from '../src/models/index.js';
import { syncLineup } from './lineup.js';
if (env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production.');
await mongoose.connect(env.MONGODB_URI);
await Promise.all([Artist, Concert, Seat, User, Venue].map((m) => m.init()));
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  if (process.env.ADMIN_PASSWORD.length < 12 || Buffer.byteLength(process.env.ADMIN_PASSWORD) > 72)
    throw new Error('ADMIN_PASSWORD must be 12–72 UTF-8 bytes.');
  await User.updateOne(
    { email: process.env.ADMIN_EMAIL.toLowerCase() },
    {
      $setOnInsert: {
        name: 'Local Administrator',
        role: 'admin',
        passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
      },
    },
    { upsert: true },
  );
  console.log(
    'Administrator exists. Credentials are read from backend/.env; existing passwords are never overwritten.',
  );
}
try {
  await syncLineup();
  console.log('Lineup ready: 8 bands and 3 solo artists. Existing bookings and seats preserved.');
} finally {
  await mongoose.disconnect();
}
