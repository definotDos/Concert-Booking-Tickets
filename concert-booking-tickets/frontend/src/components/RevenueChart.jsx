import { money } from '../services/api';
import { Empty, GlassCard } from './UI';
export function RevenueChart({ rows = [] }) {
  const currencies = [...new Set(rows.map((r) => r._id.currency))];
  return (
    <GlassCard className="revenue">
      <div className="eyebrow">LAST 30 DAYS · PHILIPPINE TIME</div>
      <h2>Verified revenue</h2>
      <p>Daily totals, excluding refunds. Each currency has its own scale.</p>
      {!rows.length && <Empty>No verified payments in the last 30 days.</Empty>}
      {currencies.map((currency) => {
        const values = rows.filter((r) => r._id.currency === currency);
        const max = Math.max(...values.map((r) => r.amount), 1);
        return (
          <div key={currency} aria-label={`Revenue in ${currency.toUpperCase()}`}>
            <h3>{currency.toUpperCase()}</h3>
            {values.map((r) => (
              <div className="chart-row" key={r._id.day}>
                <span>{r._id.day}</span>
                <div className="chart-track" aria-hidden="true">
                  <div className="chart-fill" style={{ width: `${(r.amount / max) * 100}%` }} />
                </div>
                <strong>{money(r.amount, currency)}</strong>
              </div>
            ))}
          </div>
        );
      })}
    </GlassCard>
  );
}
