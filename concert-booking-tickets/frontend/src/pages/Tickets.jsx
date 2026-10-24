import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { date, money } from '../services/api';
import { TicketPreview } from '../components/TicketPreview';
import { Badge, Empty, Loading, Notice, Pager } from '../components/UI';
import { Checkout } from '../components/Checkout';
export function Tickets() {
  const [tab, setTab] = useState('tickets');
  const [page, setPage] = useState(1);
  const [params] = useSearchParams();
  const { data, loading, error, refresh } = useResource(`/${tab}?page=${page}&limit=12`, 10000);
  return (
    <section>
      <div className="section-heading">
        <div className="eyebrow">THE NIGHTS YOU WILL REMEMBER</div>
        <h1>Your next encore.</h1>
        <p>Your tickets and reservations, together in one place.</p>
      </div>
      {params.get('payment') === 'success' && (
        <Notice>
          Checking payment confirmation. Tickets appear after the payment provider confirms payment;
          this page refreshes automatically.
        </Notice>
      )}
      {params.get('payment') === 'cancelled' && (
        <Notice>
          Checkout was cancelled. You can retry an active reservation below, or release it.
        </Notice>
      )}
      <div className="tabs">
        {['tickets', 'bookings'].map((t) => (
          <button
            className={tab === t ? 'selected' : 'secondary'}
            key={t}
            aria-pressed={tab === t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
          >
            <Icon name={t === 'tickets' ? 'ticket' : 'clock'} size={18} />{t === 'tickets' ? 'Digital tickets' : 'Booking history'}
          </button>
        ))}
      </div>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : !data?.items.length ? (
        <Empty>
          No {tab} yet. <Link to="/">Find your next concert <Icon name="arrowUpRight" size={16} /></Link>
        </Empty>
      ) : (
        <>
          <div className={tab === 'tickets' ? 'ticket-grid' : 'booking-list'}>
            {data.items.map((item) =>
              tab === 'tickets' ? (
                <TicketPreview ticket={item} key={item._id} />
              ) : (
                <article className="panel booking-history" key={item._id}>
                  <div>
                    <Badge>{item.status}</Badge>
                    <h3>{item.concert?.title}</h3>
                    <p>{item.seats.map((s) => `${s.category} ${s.label}`).join(', ')}</p>
                    <p>
                      {money(item.total, item.currency)} · {date(item.createdAt)}
                    </p>
                    <small>{item.reference}</small>
                    {item.status === 'refund_required' && (
                      <Notice>
                        Payment was received, but this booking cannot be fulfilled. An administrator
                        must process your refund.
                      </Notice>
                    )}
                  </div>
                  {['held', 'pending'].includes(item.status) && (
                    <Checkout booking={item} onDone={refresh} />
                  )}
                </article>
              ),
            )}
          </div>
          <Pager page={page} pages={data.pages} onChange={setPage} />
        </>
      )}
    </section>
  );
}
