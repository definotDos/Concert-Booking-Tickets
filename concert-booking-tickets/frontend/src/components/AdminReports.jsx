import { useState } from 'react';
import { useResource } from '../hooks/useResource';
import { date } from '../services/api';
import { Badge, Empty, Loading, Notice, Pager } from './UI';
import { RevenueChart } from './RevenueChart';
export function AdminReports({ stats }) {
  function download() {
    const rows = [
      ['metric', 'value', 'currency'],
      ...['bookings', 'tickets', 'upcoming', 'available', 'held', 'sold'].map((key) => [
        key,
        stats[key],
        '',
      ]),
      ...stats.revenue.map((r) => ['verified revenue (minor units)', r.amount, r._id]),
    ];
    const csv = rows
      .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'encore-report.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <h2>Booking & revenue report</h2>
      <p>
        Export the current overview totals. Revenue is separated by currency and excludes refunds.
      </p>
      <button onClick={download}>Download report CSV</button>
      <RevenueChart rows={stats.revenueHistory} />
    </>
  );
}
export function PaymentAudit() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useResource(`/admin/audit?page=${page}`);
  return (
    <>
      <h2>Payment event audit log</h2>
      <p>
        Recorded payment-provider events. Door-entry audit records are available in Check-in → Scan
        activity.
      </p>
      <Notice error={error} />
      {loading ? (
        <Loading />
      ) : data?.items.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Recorded</th>
                  <th>Provider</th>
                  <th>Booking</th>
                  <th>Outcome</th>
                  <th>Event ID</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item._id}>
                    <td>{date(item.createdAt)}</td>
                    <td>{item.provider}</td>
                    <td>{item.booking?.reference || 'Unavailable'}</td>
                    <td>
                      <Badge>{item.outcome}</Badge>
                    </td>
                    <td>{item.eventId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={data.pages} onChange={setPage} />
        </>
      ) : (
        !error && <Empty>No payment events recorded.</Empty>
      )}
    </>
  );
}
