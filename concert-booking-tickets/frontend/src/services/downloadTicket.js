import { date } from './api';
export async function downloadTicket(ticket) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 1050;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#080B1A';
  ctx.fillRect(0, 0, 1000, 1050);
  ctx.fillStyle = '#171B35';
  ctx.fillRect(0, 0, 1000, 140);
  ctx.fillStyle = '#22D3EE';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('Concert Booking Tickets / Digital Ticket', 50, 90, 900);
  ctx.fillStyle = '#F8FAFC';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(ticket.concert.title, 50, 210, 900);
  ctx.font = '24px sans-serif';
  const lines = [
    ticket.concert.venue.name,
    date(ticket.concert.startsAt, ticket.concert.venue.timezone),
    `${ticket.category} · Seat ${ticket.label}`,
    `Status: ${ticket.status}`,
    ticket.reference,
    `Booking: ${ticket.booking.reference}`,
  ];
  lines.forEach((line, i) => ctx.fillText(line, 50, 260 + i * 45, 900));
  const image = new Image();
  image.src = ticket.qr;
  await image.decode();
  ctx.drawImage(image, 320, 550, 360, 360);
  ctx.font = '20px sans-serif';
  ctx.fillText('Keep this QR code private. Valid for one admission only.', 50, 980);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `${ticket.reference}.png`;
  a.click();
}
