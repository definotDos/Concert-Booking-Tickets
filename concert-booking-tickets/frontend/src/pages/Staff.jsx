import { Icon } from '../components/Icon';
import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { date, post } from '../services/api';
import { Badge, Loading, Notice, Pager } from '../components/UI';
export function Staff() {
  const events = useResource('/staff/events');
  const [event, setEvent] = useState('');
  const [token, setToken] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const scans = useResource(
    `/staff/scans?page=${page}&q=${encodeURIComponent(q)}${event ? `&concertId=${event}` : ''}`,
  );
  async function verify(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(await post('/staff/verify', { concertId: event, token: token.trim() }));
      setToken('');
      scans.refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="eyebrow">EVENT OPERATIONS</div>
      <h1>At the door.</h1>
      <p>
        Scan with a keyboard QR reader, or paste the ticket scanner code. Each ticket admits one
        person, once.
      </p>
      <form className="panel staff-form" onSubmit={verify}>
        <label>
          Event
          <select
            aria-label="Event"
            required
            value={event}
            onChange={(e) => {
              setEvent(e.target.value);
              setPage(1);
              setResult(null);
            }}
          >
            <option value="">Select an event</option>
            {events.data?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title} — {date(c.startsAt)}
              </option>
            ))}
          </select>
        </label>
        <label>
          QR scanner code
          <input
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Scan or paste a ticket code"
            autoComplete="off"
            maxLength={1000}
          />
        </label>
        <button disabled={!event || busy}><Icon name="scan" size={18} />{busy ? 'Verifying…' : 'Verify & admit'}</button>
        <Notice error={error || events.error} />
        {result && (
          <div role="status" className={`scan-result ${result.accepted ? 'accepted' : 'rejected'}`}>
            <strong>
              <Icon name={result.accepted ? 'check' : 'close'} /> {result.reason}
            </strong>
            {result.ticket && (
              <p>
                {result.ticket.category} · {result.ticket.label}
              </p>
            )}
          </div>
        )}
      </form>
      <h2>Scan activity</h2>
      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(search);
          setPage(1);
        }}
      >
        <label>
          Search scan reasons
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Entry accepted, already used?"
            maxLength={100}
          />
        </label>
        <button><Icon name="search" size={18} /> Search scans</button>
      </form>
      {scans.loading && <Loading />}
      <Notice error={scans.error} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Result</th>
              <th>Reason</th>
              <th>Staff</th>
            </tr>
          </thead>
          <tbody>
            {scans.data?.items.map((s) => (
              <tr key={s._id}>
                <td>{date(s.createdAt)}</td>
                <td>
                  <Badge>{s.accepted ? 'accepted' : 'rejected'}</Badge>
                </td>
                <td>{s.reason}</td>
                <td>{s.staff?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!scans.loading && !scans.error && !scans.data?.items.length && (
          <p className="empty">No scans yet.</p>
        )}
      </div>
      <Pager page={page} pages={scans.data?.pages} onChange={setPage} />
    </section>
  );
}
