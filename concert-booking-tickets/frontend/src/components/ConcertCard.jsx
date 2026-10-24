import { Icon } from './Icon';
import { Link } from 'react-router-dom';
import { date, money } from '../services/api';
export function ConcertCard({ concert: c, index: i = 0 }) {
  const startsAt = new Date(c.startsAt);
  const dateOptions = { timeZone: c.venue?.timezone || 'Asia/Manila' };
  const image = c.image === '/BEN%20%26%20BEN.jpg' || c.image === '/BEN & BEN.jpg'
    ? '/ben-and-ben.jpg'
    : c.image;
  const posterPosition = c.artist?.name === 'IV OF SPADES' ? 'center 23%' : 'center';
  return (
    <Link className="concert-card" to={`/concerts/${c._id}`}>
      <div className={`concert-cover tone-${i % 4}`}>
        {image ? (
          <img src={image} alt={c.title} loading="lazy" style={{ objectPosition: posterPosition }} />
        ) : (
          <span className="poster-type">
            {c.artist?.name}
            <small>LIVE IN CONCERT</small>
          </span>
        )}
        <span className="cover-tag">{c.artist?.type === 'solo' ? 'Solo artist' : 'Band'} · {c.genre}</span>
        <span className="concert-date" aria-hidden="true">
          <span>{startsAt.toLocaleDateString('en-SG', { ...dateOptions, month: 'short' })}</span>
          <strong>{startsAt.toLocaleDateString('en-SG', { ...dateOptions, day: '2-digit' })}</strong>
        </span>
      </div>
      <div className="card-info">
        <div className="eyebrow icon-label"><Icon name="calendar" size={14} />{date(c.startsAt, c.venue?.timezone)}</div>
        <h3>{c.title}</h3>
        {c.artist?.name && <div className="card-artist">{c.artist.name}</div>}
        <p className="icon-label"><Icon name="pin" size={15} />
          {c.venue?.name} · {c.venue?.city}
        </p>
        <div className="card-bottom">
          <span>
            From <strong>{money(Math.min(...c.categories.map((x) => x.price)), c.currency)}</strong>
          </span>
          <span>Get tickets <Icon name="arrowUpRight" size={16} /></span>
        </div>
      </div>
    </Link>
  );
}
