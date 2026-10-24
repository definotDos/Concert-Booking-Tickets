import { Icon } from './Icon';
import { date } from '../services/api';
import { downloadTicket } from '../services/downloadTicket';
import { Action, Badge } from './UI';
export function TicketPreview({ ticket: item }) {
  return (
    <article className="ticket-card">
      <div className="ticket-top">
        <span>Concert Booking Tickets / Admit One</span>
        <Badge>{item.status}</Badge>
      </div>
      <div className="ticket-body">
        <div className="eyebrow">{item.concert.artist?.name}</div>
        <h2>{item.concert.title}</h2>
        <p>{item.concert.venue?.name}</p>
        <p>{date(item.concert.startsAt, item.concert.venue?.timezone)}</p>
        <div className="ticket-seat">
          <div>
            <small>CATEGORY</small>
            <strong>{item.category}</strong>
          </div>
          <div>
            <small>SEAT</small>
            <strong>{item.label}</strong>
          </div>
        </div>
        <img className="qr" src={item.qr} alt={`Entry QR code for seat ${item.label}`} />
        <small className="ticket-reference">{item.reference}</small>
        <p className="muted">Keep your QR private. One admission only.</p>
        <Action run={() => downloadTicket(item)}><Icon name="download" size={18} /> Download ticket</Action>
        <details>
          <summary>Ticket scanner code</summary>
          <code className="token">{item.token}</code>
        </details>
      </div>
    </article>
  );
}
