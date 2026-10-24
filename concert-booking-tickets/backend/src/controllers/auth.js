import bcrypt from 'bcryptjs';
import { Session, User } from '../models/index.js';
import { env } from '../config/env.js';
import { assert, hash, random, publicUser } from '../utils/core.js';
import { cookieOptions } from '../middleware/auth.js';
const dummyHash = await bcrypt.hash('invalid-account-timing-placeholder', 12);
async function signIn(res, user) {
  const token = random();
  const csrf = random();
  await Session.create({
    tokenHash: hash(token),
    csrf,
    user: user._id,
    expiresAt: new Date(Date.now() + env.SESSION_DAYS * 86400000),
  });
  res
    .cookie('session', token, { ...cookieOptions, maxAge: env.SESSION_DAYS * 86400000 })
    .json({ user: publicUser(user), csrf });
}
export async function register(req, res) {
  const { name, email, password } = req.body;
  assert(
    Buffer.byteLength(password, 'utf8') <= 72,
    400,
    'Password must not exceed 72 UTF-8 bytes.',
  );
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  await signIn(res.status(201), user);
}
export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const valid = await bcrypt.compare(req.body.password, user?.passwordHash || dummyHash);
  assert(user && valid && !user.disabled, 401, 'Email or password is incorrect.');
  await signIn(res, user);
}
export async function logout(req, res) {
  await Session.deleteOne({ _id: req.session._id });
  res.clearCookie('session', cookieOptions).json({ message: 'Signed out.' });
}
