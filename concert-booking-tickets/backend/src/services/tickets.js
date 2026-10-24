import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { Concert, Ticket, Scan } from '../models/index.js';
import { hash, transaction } from '../utils/core.js';
const sign = (value) =>
  crypto.createHmac('sha256', env.TICKET_SECRET).update(value).digest('base64url');
export function ticketToken(ticket) {
  const body = `v1.${ticket.reference}.${ticket.concert._id || ticket.concert}`;
  return `${body}.${sign(body)}`;
}
export function decodeToken(token) {
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const signature = Buffer.from(parts[3]);
  const expected = Buffer.from(sign(parts.slice(0, 3).join('.')));
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected))
    return null;
  return { reference: parts[1], concert: parts[2] };
}
export const withQR = async (ticket) => ({
  ...ticket.toObject(),
  token: ticketToken(ticket),
  qr: await QRCode.toDataURL(ticketToken(ticket), { width: 320, margin: 2 }),
});
export async function verifyTicket(token, concertId, staffId) {
  const decoded = decodeToken(token);
  return transaction(async (session) => {
    let reason = 'Invalid QR signature';
    let ticket = null;
    let accepted = false;
    if (decoded) {
      if (decoded.concert !== concertId) reason = 'Ticket belongs to another event';
      else {
        const concert = await Concert.findOneAndUpdate(
          { _id: concertId, status: 'published' },
          { $inc: { revision: 1 } },
          { session, new: true },
        );
        if (!concert) reason = 'Event is not active';
        else {
          ticket = await Ticket.findOneAndUpdate(
            { reference: decoded.reference, concert: concertId, status: 'valid' },
            { $set: { status: 'used', usedAt: new Date(), usedBy: staffId } },
            { session, new: true },
          );
          if (ticket) {
            accepted = true;
            reason = 'Entry accepted';
          } else {
            ticket = await Ticket.findOne({ reference: decoded.reference }).session(session);
            reason =
              ticket?.status === 'used'
                ? 'Ticket has already been used'
                : 'Ticket is invalid or void';
          }
        }
      }
    }
    await Scan.create(
      [
        {
          staff: staffId,
          concert: concertId,
          ticket: ticket?._id,
          accepted,
          reason,
          tokenHash: hash(token),
        },
      ],
      { session },
    );
    return {
      accepted,
      reason,
      ticket: ticket
        ? {
            reference: ticket.reference,
            label: ticket.label,
            category: ticket.category,
            usedAt: ticket.usedAt,
          }
        : null,
    };
  });
}
