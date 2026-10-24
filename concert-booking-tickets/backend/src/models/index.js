import mongoose from 'mongoose';
const { Schema } = mongoose;
const ref = (model, required = true) => ({ type: Schema.Types.ObjectId, ref: model, required });
const make = (name, fields, indexes = []) => {
  const schema = new Schema(fields, { timestamps: true });
  indexes.forEach(([keys, options]) => schema.index(keys, options));
  return mongoose.model(name, schema);
};
export const User = make('User', {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'staff', 'admin'], default: 'user' },
  disabled: { type: Boolean, default: false },
});
export const Session = make(
  'Session',
  { tokenHash: { type: String, unique: true }, csrf: String, user: ref('User'), expiresAt: Date },
  [[{ expiresAt: 1 }, { expireAfterSeconds: 0 }]],
);
export const Artist = make('Artist', {
  type: { type: String, enum: ['band', 'solo'], default: 'band' },
  revision: { type: Number, default: 0 },
  name: { type: String, required: true },
  bio: String,
  genre: String,
  image: String,
});
export const Venue = make('Venue', {
  revision: { type: Number, default: 0 },
  name: { type: String, required: true },
  city: String,
  address: String,
  timezone: { type: String, default: 'Asia/Manila' },
});
const category = new Schema(
  {
    name: { type: String, enum: ['VIP', 'Lower Box', 'Upper Box'], required: true },
    price: { type: Number, min: 1, required: true },
    rows: Number,
    seatsPerRow: Number,
  },
  { _id: false },
);
export const Concert = make(
  'Concert',
  {
    title: { type: String, required: true },
    listed: { type: Boolean, default: true },
    description: String,
    artist: ref('Artist'),
    venue: ref('Venue'),
    startsAt: { type: Date, required: true },
    image: String,
    genre: String,
    currency: { type: String, default: 'sgd' },
    serviceFee: { type: Number, default: 0 },
    categories: [category],
    status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'draft' },
    revision: { type: Number, default: 0 },
  },
  [[{ status: 1, startsAt: 1 }, {}]],
);
export const Seat = make(
  'Seat',
  {
    concert: ref('Concert'),
    label: String,
    category: String,
    row: String,
    number: Number,
    price: Number,
    status: { type: String, enum: ['available', 'held', 'sold'], default: 'available' },
    booking: ref('Booking', false),
    holdUntil: Date,
  },
  [
    [{ concert: 1, label: 1 }, { unique: true }],
    [{ status: 1, holdUntil: 1 }, {}],
  ],
);
export const Booking = make(
  'Booking',
  {
    user: ref('User'),
    concert: ref('Concert'),
    reference: { type: String, unique: true },
    seats: [{ seat: ref('Seat'), label: String, category: String, price: Number }],
    subtotal: Number,
    fee: Number,
    total: Number,
    currency: String,
    expiresAt: Date,
    status: {
      type: String,
      enum: [
        'held',
        'pending',
        'paid',
        'expired',
        'cancelled',
        'failed',
        'refund_required',
        'refunded',
      ],
      default: 'held',
    },
  },
  [
    [{ user: 1, createdAt: -1 }, {}],
    [{ status: 1, expiresAt: 1 }, {}],
  ],
);
export const Payment = make('Payment', {
  booking: { ...ref('Booking'), unique: true },
  provider: String,
  providerSession: { type: String },
  checkoutUrl: String,
  amount: Number,
  currency: String,
  status: {
    type: String,
    enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refund_required', 'refunded'],
    default: 'pending',
  },
  verifiedAt: Date,
  refundReference: String,
});
export const PaymentEvent = make('PaymentEvent', {
  eventId: { type: String, unique: true },
  provider: String,
  booking: ref('Booking'),
  outcome: String,
});
export const Ticket = make(
  'Ticket',
  {
    reference: { type: String, unique: true },
    booking: ref('Booking'),
    user: ref('User'),
    concert: ref('Concert'),
    seat: ref('Seat'),
    label: String,
    category: String,
    status: { type: String, enum: ['valid', 'used', 'void'], default: 'valid' },
    usedAt: Date,
    usedBy: ref('User', false),
  },
  [[{ booking: 1, seat: 1 }, { unique: true }]],
);
export const Scan = make(
  'Scan',
  {
    staff: ref('User'),
    concert: ref('Concert'),
    ticket: ref('Ticket', false),
    accepted: Boolean,
    reason: String,
    tokenHash: String,
  },
  [[{ concert: 1, createdAt: -1 }, {}]],
);
