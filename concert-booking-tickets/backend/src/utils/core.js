import crypto from 'node:crypto';
import mongoose from 'mongoose';
export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, status, message) => {
  if (!condition) throw new AppError(status, message);
};
export const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const random = () => crypto.randomBytes(32).toString('hex');
export const reference = (prefix) => `${prefix}-${crypto.randomUUID().toUpperCase()}`;
export const transaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};
export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
export const pagination = (query) => ({
  page: Math.max(1, Math.min(100000, Math.floor(Number(query.page)) || 1)),
  limit: Math.max(1, Math.min(50, Math.floor(Number(query.limit)) || 12)),
});
export const escaped = (value) =>
  String(value || '')
    .slice(0, 100)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
