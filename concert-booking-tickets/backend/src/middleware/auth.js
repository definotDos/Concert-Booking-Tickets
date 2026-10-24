import { Session } from '../models/index.js';
import { assert, hash } from '../utils/core.js';
import { env } from '../config/env.js';
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
};
export async function authenticate(req, res, next) {
  const token = req.cookies.session;
  assert(token, 401, 'Please sign in to continue.');
  const session = await Session.findOne({
    tokenHash: hash(token),
    expiresAt: { $gt: new Date() },
  }).populate('user');
  assert(session?.user && !session.user.disabled, 401, 'Your session has expired. Please sign in.');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
    assert(
      req.get('X-CSRF-Token') === session.csrf,
      403,
      'Invalid security token. Refresh and try again.',
    );
  req.user = session.user;
  req.session = session;
  next();
}
export const roles =
  (...allowed) =>
  (req, res, next) => {
    assert(allowed.includes(req.user.role), 403, 'You do not have permission for this action.');
    next();
  };
export function originGuard(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    assert(!origin || origin === env.FRONTEND_URL, 403, 'Origin is not allowed.');
    assert(req.is('application/json'), 415, 'Send JSON content.');
  }
  next();
}
