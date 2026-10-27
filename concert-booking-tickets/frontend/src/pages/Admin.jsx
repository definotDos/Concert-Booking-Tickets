import { Icon } from '../components/Icon';
import { AdminReports, PaymentAudit } from '../components/AdminReports';
import { RevenueChart } from '../components/RevenueChart';
import { StatCard } from '../components/UI';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource';
import { api, post, date, money } from '../services/api';
import { Action, Badge, Empty, Loading, Notice, Pager } from '../components/UI';
import { ConcertForm } from '../components/ConcertForm';
import { AdminFilters } from '../components/AdminFilters';
function DirectoryForm({ resource, item, onDone, onClose }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError('');
    try {
      await api(`/admin/${resource}${item ? `/${item._id}` : ''}`, {
        method: item ? 'PUT' : 'POST',
        body,
      });
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel admin-form" onSubmit={submit}>
      <div className="section-title">
        <h2>
          {item ? 'Edit' : 'Add'} {resource === 'artists' ? 'artist' : 'venue'}
        </h2>
        <button type="button" className="secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <Notice error={error} />
      <label>
        Name
        <input name="name" defaultValue={item?.name} required minLength={2} />
      </label>
      {resource === 'artists' ? (
        <>
          <label>
            Artist type
            <select name="type" defaultValue={item?.type || 'band'}>
              <option value="band">Band</option>
              <option value="solo">Solo artist</option>
            </select>
          </label>
          <label>
            Genre
            <input name="genre" defaultValue={item?.genre} />
          </label>
          <label>
            Biography
            <textarea name="bio" defaultValue={item?.bio} />
          </label>
          <label>
            Image URL (HTTPS)
            <input type="url" name="image" defaultValue={item?.image} />
          </label>
        </>
      ) : (
        <>
          <label>
            City
            <input name="city" defaultValue={item?.city} required />
          </label>
          <label>
            Address
            <input name="address" defaultValue={item?.address} required />
          </label>
          <label>
            IANA timezone
            <input name="timezone" defaultValue={item?.timezone || 'Asia/Manila'} required />
          </label>
        </>
      )}
      <button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
function UserControls({ item, refresh }) {
  const [role, setRole] = useState(item.role);
  if (item.role === 'admin') return <small className="muted">Administrator access is managed by the system operator.</small>;
  return (
    <div className="button-row">
      <select
        aria-label={`Role for ${item.name}`}
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        {['user', 'staff', 'admin'].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>
      <Action
        disabled={role === item.role}
        confirm={`Change ${item.name}'s role to ${role}? Their sessions will end.`}
        run={() => api(`/admin/users/${item._id}`, { method: 'PATCH', body: { role } })}
        onDone={refresh}
      >
        Save role
      </Action>
      <Action
        confirm={`${item.disabled ? 'Enable' : 'Disable'} ${item.name}'s account?`}
        run={() =>
          api(`/admin/users/${item._id}`, { method: 'PATCH', body: { disabled: !item.disabled } })
        }
        onDone={refresh}
      >
        {item.disabled ? 'Enable' : 'Disable'}
      </Action>
    </div>
  );
}
export function Admin() {
  const [params, setParams] = useSearchParams();
  const sections = ['overview', 'concerts', 'artists', 'venues', 'bookings', 'users', 'payments', 'reports', 'audit'];
  const tab = sections.includes(params.get('section')) ? params.get('section') : 'overview';
  const status = params.get('status') || '';
  return <AdminWorkspace key={`${tab}-${status}`} tab={tab} initialStatus={status} setTab={(section) => setParams({ section })} />;
}
function AdminWorkspace({ tab, initialStatus, setTab }) {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [filters, setFilters] = useState({ q: '', status: initialStatus, sort: 'newest' });
  const [auditVersion, setAuditVersion] = useState(0);
  const stats = useResource('/admin/stats');
  const list = useResource(
    `/admin/${['overview', 'reports', 'audit'].includes(tab) ? 'concerts' : tab}?${new URLSearchParams({ ...filters, page, limit: 12 })}`,
  );
  const artists = useResource('/admin/artists?limit=50', 0, true);
  const venues = useResource('/admin/venues?limit=50', 0, true);
  function refresh() {
    setAuditVersion((version) => version + 1);
    list.refresh();
    stats.refresh();
    artists.refresh();
    venues.refresh();
  }
  function saved() {
    setEditing(null);
    setMessage('Changes saved.');
    refresh();
  }
  const descriptions = {
    overview: ['Dashboard overview', 'Your events, ticket sales, and operations at a glance.'],
    concerts: ['Concert management', 'Create events, configure seating, and manage publication.'],
    artists: ['Artist directory', 'Manage the performers behind your events.'],
    venues: ['Venue directory', 'Keep event locations and timezones up to date.'],
    bookings: ['Booking management', 'Find reservations, inspect tickets, and process required refunds.'],
    users: ['People & access', 'Manage customer and staff accounts.'],
    payments: ['Payment transactions', 'Review payment status and verification for each booking.'],
    reports: ['Reports & insights', 'Review verified revenue and export your current totals.'],
    audit: ['Payment audit', 'Trace recorded payment-provider events.'],
  };
  return (
    <section className="admin-shell">
      <div className="eyebrow">BACKSTAGE / ADMINISTRATION</div>
      <div className="section-title">
        <div><h1>Make the night happen.</h1><p className="muted">Your backstage workspace. Every event, all in one place.</p></div>
        <Link className="button secondary" to="/staff">
          <Icon name="scan" size={18} /> Open check-in <Icon name="arrowUpRight" size={16} />
        </Link>
      </div>
      <div className="tabs admin-sidebar" aria-label="Administration sections">
        <span className="admin-nav-label">WORKSPACE</span>
        {[
          'overview',
          'concerts',
          'artists',
          'venues',
          'bookings',
          'users',
          'payments',
          'reports',
          'audit',
        ].map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            className={tab === t ? 'selected' : 'secondary'}
            onClick={() => {
              setTab(t);
              setPage(1);
              setEditing(null);
              setMessage('');
              setFilters({ q: '', status: '', sort: 'newest' });
            }}
          >
            <Icon name={{ overview: 'grid', concerts: 'calendar', artists: 'music', venues: 'pin', bookings: 'ticket', users: 'user', payments: 'payment', reports: 'chart', audit: 'list' }[t]} size={18} />{t}
          </button>
        ))}
      </div>
      <div className="admin-content">
        <div className="section-title admin-section-heading">
          <div><div className="eyebrow">ADMIN / {tab.toUpperCase()}</div><h2>{descriptions[tab][0]}</h2><p className="muted">{descriptions[tab][1]}</p></div>
          <button className="secondary" onClick={refresh}>Refresh data</button>
        </div>
        <Notice error={stats.error || list.error || artists.error || venues.error} />
        <Notice>{message}</Notice>
        {!['overview', 'reports', 'audit'].includes(tab) && (
          <>
            <AdminFilters
              key={tab}
              filters={filters}
              statuses={list.data?.statuses || (filters.status ? [filters.status] : [])}
              onChange={(value) => {
                setFilters(value);
                setPage(1);
              }}
            />
            <p className="result-count">
              {list.data ? `${list.data.total} matching records` : 'Loading records…'}
            </p>
          </>
        )}
        {tab === 'audit' ? (
          <PaymentAudit key={auditVersion} />
        ) : tab === 'reports' ? (
          stats.data ? (
            <AdminReports stats={stats.data} />
          ) : (
            <Loading />
          )
        ) : tab === 'overview' ? (
          stats.loading ? (
            <Loading />
          ) : (
            stats.data && (
              <>
                <div className="admin-quick-actions">
                  <Link className="button" to="/admin?section=concerts"><Icon name="calendar" size={18} /> Manage concerts</Link>
                  <Link className="button secondary" to="/admin?section=bookings">View bookings</Link>
                  <Link className="button secondary" to="/admin?section=reports">Export reports <Icon name="arrowUpRight" size={16} /></Link>
                </div>
                <div className="stats-grid">
                  {[
                    ['Bookings', stats.data.bookings],
                    ['Valid / used tickets', stats.data.tickets],
                    ['Upcoming concerts', stats.data.upcoming],
                    ['Available seats', stats.data.available],
                    ['Held seats', stats.data.held],
                    ['Sold seats', stats.data.sold],
                  ].map(([label, value]) => (
                    <StatCard key={label} label={label} value={value} />
                  ))}
                </div>
                <div className="admin-attention-grid">
                  <Link className="panel admin-attention" to="/admin?section=concerts&status=draft"><Icon name="calendar" /><div><strong>{stats.data.drafts || 0} draft concerts</strong><p>Review events before publishing</p></div><Icon name="arrow" /></Link>
                  <Link className="panel admin-attention" to="/admin?section=bookings&status=refund_required"><Icon name="payment" /><div><strong>{stats.data.refunds || 0} refunds required</strong><p>Review bookings awaiting a refund</p></div><Icon name="arrow" /></Link>
                </div>
                <div className="panel revenue">
                  <div className="eyebrow">VERIFIED PAYMENT REVENUE</div>
                  <h2>
                    {stats.data.revenue.length
                      ? stats.data.revenue.map((r) => money(r.amount, r._id)).join(' / ')
                      : 'No verified revenue yet'}
                  </h2>
                  <p>Excludes refunds and payments awaiting refund.</p>
                </div>
                <RevenueChart rows={stats.data.revenueHistory} />
                <div className="panel admin-upcoming">
                  <div className="section-title"><h2>Coming up next</h2><Link to="/admin?section=concerts">All concerts →</Link></div>
                  {stats.data.nextConcerts?.length ? stats.data.nextConcerts.map((concert) => (
                    <Link className="admin-event-row" to={`/concerts/${concert._id}`} key={concert._id}>
                      <div className="admin-event-icon"><Icon name="music" /></div>
                      <div><strong>{concert.title}</strong><p>{concert.artist?.name} · {concert.venue?.name}</p><small>{date(concert.startsAt, concert.venue?.timezone)}</small></div>
                      <Icon name="arrowUpRight" size={18} />
                    </Link>
                  )) : <Empty>No upcoming published concerts. Create and publish an event to get started.</Empty>}
                </div>
                <div className="section-title"><h2>Recent transactions</h2><Link to="/admin?section=payments">All payments →</Link></div>
                {!stats.data.recent.length ? <Empty>No payments yet. Transactions will appear after customers check out.</Empty> :
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.data.recent.map((p) => (
                        <tr key={p._id}>
                          <td>{p.booking?.user?.name || 'Unknown'}</td>
                          <td>{money(p.amount, p.currency)}</td>
                          <td>
                            <Badge>{p.status}</Badge>
                          </td>
                          <td>{date(p.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
              </>
            )
          )
        ) : (
          <>
            {['concerts', 'artists', 'venues'].includes(tab) && !editing && (
              <button onClick={() => setEditing({})}>
                + Add {tab === 'concerts' ? 'concert' : tab === 'artists' ? 'artist' : 'venue'}
              </button>
            )}
            {editing &&
              (tab === 'concerts' ? (
                <ConcertForm
                  key={editing._id || 'new-concert'}
                  item={editing._id ? editing : null}
                  artists={artists.data?.items || []}
                  venues={venues.data?.items || []}
                  onSaved={saved}
                  onClose={() => setEditing(null)}
                />
              ) : (
                <DirectoryForm
                  key={`${tab}-${editing._id || 'new'}`}
                  resource={tab}
                  item={editing._id ? editing : null}
                  onDone={saved}
                  onClose={() => setEditing(null)}
                />
              ))}
            {list.loading ? (
              <Loading />
            ) : !list.data?.items.length ? (
              <Empty>No records yet.</Empty>
            ) : (
              <div className="admin-list">
                {list.data.items.map((item) => (
                  <article className="panel admin-record" key={item._id}>
                    <div>
                      <h3>{item.title || item.name || item.reference || item.booking?.reference || item.providerSession || 'Payment'}</h3>
                      {tab === 'concerts' && (
                        <>
                          <p>
                            {item.artist?.name} · {item.venue?.name}
                          </p>
                          <p>{date(item.startsAt, item.venue?.timezone)}</p>
                          <Badge>{item.status}</Badge>
                        </>
                      )}
                      {tab === 'artists' && (
                        <p>
                          {item.type === 'solo' ? 'Solo artist' : 'Band'} ·{' '}
                          {item.genre} · {item.bio}
                        </p>
                      )}
                      {tab === 'venues' && (
                        <p>
                          {item.city} · {item.address}
                        </p>
                      )}
                      {tab === 'users' && (
                        <>
                          <p>{item.email}</p>
                          <Badge>{item.disabled ? 'disabled' : item.role}</Badge>
                        </>
                      )}
                      {tab === 'bookings' && (
                        <>
                          <p>
                            {item.user?.name} · {item.concert?.title}
                          </p>
                          <p>
                            {item.seats.map((s) => s.label).join(', ')} ·{' '}
                            {money(item.total, item.currency)}
                          </p>
                          <Badge>{item.status}</Badge>
                        </>
                      )}
                      {tab === 'payments' && (
                        <>
                          <p>{item.booking?.user?.name || 'Customer unavailable'} · {item.booking?.concert?.title || 'Concert unavailable'}</p>
                          <p>
                            {money(item.amount, item.currency)} · {item.provider}
                          </p>
                          <Badge>{item.status}</Badge>
                          <p>
                            {item.verifiedAt ? `Verified ${date(item.verifiedAt)}` : 'Not verified'}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="button-row">
                      {['concerts', 'artists', 'venues'].includes(tab) && item.status !== 'cancelled' && (
                        <button className="secondary" onClick={() => setEditing(item)}>
                          Edit
                        </button>
                      )}
                      {tab === 'concerts' && (
                        <>
                          {item.status === 'draft' && (
                            <Action
                              run={() => post(`/admin/concerts/${item._id}/publish`)}
                              onDone={refresh}
                            >
                              Publish
                            </Action>
                          )}
                          {item.status !== 'cancelled' && (
                            <Action
                              confirm="Cancel this concert? Tickets will be voided and verified payments will require refunds."
                              run={() => post(`/admin/concerts/${item._id}/cancel`)}
                              onDone={refresh}
                            >
                              Cancel event
                            </Action>
                          )}
                        </>
                      )}
                      {['artists', 'venues'].includes(tab) && (
                        <Action
                          confirm="Delete this unused record?"
                          run={() =>
                            api(`/admin/${tab}/${item._id}`, { method: 'DELETE', body: {} })
                          }
                          onDone={refresh}
                        >
                          Delete
                        </Action>
                      )}
                      {tab === 'users' && <UserControls key={`${item._id}-${item.role}`} item={item} refresh={refresh} />}
                      {tab === 'bookings' && item.status === 'refund_required' && (
                        <Action
                          confirm="Process the full refund through the payment provider?"
                          run={() => post(`/admin/bookings/${item._id}/refund`)}
                          onDone={refresh}
                        >
                          Process refund
                        </Action>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <Pager page={page} pages={list.data?.pages} onChange={setPage} />
          </>
        )}
      </div>
    </section>
  );
}
