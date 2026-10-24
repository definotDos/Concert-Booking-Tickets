import { BookingProgress } from '../components/BookingProgress';
import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useResource } from '../hooks/useResource';
import { date, money, post } from '../services/api';
import { Loading, Notice } from '../components/UI';
import { Checkout } from '../components/Checkout';
export function Concert() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useResource(`/concerts/${id}`, 10000);
  const [selected, setSelected] = useState([]);
  const [booking, setBooking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  if (loading) return <Loading />;
  if (!data) return <Notice error={error} />;
  const { concert: c, seats } = data;
  const chosen = seats.filter((s) => selected.includes(s._id));
  const subtotal = chosen.reduce((sum, s) => sum + s.price, 0);
  const unavailable = c.status !== 'published' || new Date(c.startsAt) <= new Date();
  function toggle(s) {
    if (!selected.includes(s._id) && selected.length >= 8) {
      setProblem('You can reserve up to 8 seats per booking.');
      return;
    }
    setProblem('');
    setSelected((prev) =>
      prev.includes(s._id)
        ? prev.filter((v) => v !== s._id)
        : prev.length < 8
          ? [...prev, s._id]
          : prev,
    );
  }
  async function reserve() {
    if (!user) return navigate('/login', { state: { from: `/concerts/${id}` } });
    setBusy(true);
    setProblem('');
    try {
      setBooking(await post('/bookings', { concertId: id, seatIds: selected }));
      refresh();
    } catch (e) {
      setProblem(e.message);
      setSelected([]);
      refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail">
      <Link className="back-link" to="/">
        <Icon name="arrowLeft" size={16} /> All concerts
      </Link>
      <div className="detail-heading">
        <div>
          <div className="eyebrow">{c.genre} / LIVE IN CONCERT</div>
          <h1>{c.title}</h1>
          <p>
            {c.artist?.name} · {c.venue?.name}, {c.venue?.city}
          </p>
          <p>
            {date(c.startsAt, c.venue?.timezone)} ({c.venue?.timezone})
          </p>
        </div>
        {c.image && <img className="detail-image" src={c.image} alt={c.title} />}
      </div>
      <p className="description">{c.description}</p>
      <details className="artist-info">
        <summary>About the artist & venue</summary>
        <p>{c.artist?.bio || 'Artist biography coming soon.'}</p>
        <p>{c.venue?.address}</p>
      </details>
      <Notice error={error || problem} />
      {unavailable && (
        <Notice>
          This concert is {c.status === 'cancelled' ? 'cancelled' : 'closed for booking'}.
        </Notice>
      )}
      <BookingProgress active={booking ? 2 : 1} />
      <div className="booking-grid">
        <div className="panel seat-panel">
          <div className="eyebrow">MAKE IT YOUR NIGHT</div>
          <h2>Pick your perspective.</h2>
          <p>Select up to 8 seats. Availability refreshes every 10 seconds.</p>
          <div className="legend">
            <span>
              <i className="available" />
              Available
            </span>
            <span>
              <i className="selected" />
              Selected
            </span>
            <span>
              <i className="held" />
              Reserved
            </span>
            <span>
              <i className="sold" />
              Sold
            </span>
          </div>
          <div className="seat-map">
            <div className="stage">S T A G E</div>
            {c.categories.map((category) => (
              <div className="seat-category" key={category.name}>
                <div className="category-heading">
                  <strong>{category.name}</strong>
                  <span>{money(category.price, c.currency)}</span>
                </div>
                {[
                  ...new Set(seats.filter((s) => s.category === category.name).map((s) => s.row)),
                ].map((row) => (
                  <div className="seat-row" key={row}>
                    <span className="row-label">{row}</span>
                    {seats
                      .filter((s) => s.row === row)
                      .map((s) => (
                        <button
                          key={s._id}
                          className={`seat ${s.status} ${selected.includes(s._id) ? 'selected' : ''}`}
                          title={`${s.label} · ${s.category} · ${money(s.price, c.currency)} · ${s.status}`}
                          aria-label={`${s.label}, ${s.category}, ${money(s.price, c.currency)}, ${s.status}`}
                          aria-pressed={selected.includes(s._id)}
                          disabled={
                            (!selected.includes(s._id) && s.status !== 'available') ||
                            !!booking ||
                            unavailable
                          }
                          onClick={() => toggle(s)}
                        >
                          {s.number}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <aside className="panel booking-summary">
          <div className="eyebrow">YOUR NIGHT, PLANNED</div>
          <h2>Booking summary</h2>
          <h3>{c.title}</h3>
          <p>{c.venue?.name}</p>
          <hr />
          {booking ? (
            <Checkout
              booking={booking}
              onDone={(result) => {
                if (result?.status === 'paid') navigate('/tickets');
                else {
                  setBooking(null);
                  setSelected([]);
                  refresh();
                }
              }}
            />
          ) : (
            <>
              {chosen.length ? (
                chosen.map((s) => (
                  <div className="summary-line" key={s._id}>
                    <span>
                      {s.category} · {s.label}
                    </span>
                    <strong>{money(s.price, c.currency)}</strong>
                  </div>
                ))
              ) : (
                <p className="muted">Select seats on the map to get started.</p>
              )}
              <hr />
              <div className="summary-line">
                <span>Tickets ({chosen.length})</span>
                <span>{money(subtotal, c.currency)}</span>
              </div>
              <div className="summary-line">
                <span>Booking fee</span>
                <span>{money(chosen.length ? c.serviceFee : 0, c.currency)}</span>
              </div>
              <div className="summary-line total">
                <span>Total</span>
                <strong>{money(subtotal + (chosen.length ? c.serviceFee : 0), c.currency)}</strong>
              </div>
              <button
                className="full-width"
                disabled={!chosen.length || busy || unavailable}
                onClick={reserve}
              >
                {busy ? 'Reserving…' : user ? 'Reserve seats ↗' : 'Sign in to reserve ↗'}
              </button>
              <small>
                Seats are reserved only after the server confirms your hold. The countdown begins
                then.
              </small>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
