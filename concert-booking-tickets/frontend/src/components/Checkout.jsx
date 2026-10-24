import { useEffect, useState } from 'react';
import { post, money } from '../services/api';
import { Action, Notice } from './UI';
export function Checkout({ booking, onDone }) {
  const [provider, setProvider] = useState('');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.ceil((new Date(booking.expiresAt).getTime() - now) / 1000));
  function result(data) {
    setMessage(`Payment status: ${(data.status || 'processed').replaceAll('_', ' ')}.`);
    if (data.status !== 'pending') onDone?.(data);
  }
  return (
    <div className="checkout">
      <h3>{seconds ? 'Your seats are on hold' : 'Reservation expired'}</h3>
      <p className="countdown" aria-live="off">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} remaining
      </p>
      <p>
        {booking.seats.map((s) => s.label).join(', ')} · {money(booking.total, booking.currency)}
      </p>
      <Notice>{message}</Notice>
      {seconds > 0 && (
        <>
          {!provider && (
            <Action
              className="primary"
              run={() => post(`/bookings/${booking._id}/checkout`)}
              onDone={(data) => {
                if (data.provider === 'stripe') window.location.assign(data.url);
                else setProvider(data.provider);
              }}
            >
              Continue to payment ↗
            </Action>
          )}
          {provider === 'sandbox' && (
            <div className="sandbox">
              <strong>Development payment sandbox</strong>
              <p>No real money is charged. Choose a test outcome.</p>
              <div className="button-row">
                {['success', 'failed', 'cancelled', 'pending'].map((outcome) => (
                  <Action
                    key={outcome}
                    run={() => post(`/bookings/${booking._id}/sandbox`, { outcome })}
                    onDone={result}
                  >
                    {outcome}
                  </Action>
                ))}
              </div>
            </div>
          )}
          <Action
            run={() => post(`/bookings/${booking._id}/cancel`)}
            confirm="Release these reserved seats?"
            onDone={onDone}
          >
            Cancel reservation
          </Action>
        </>
      )}
      {!seconds && (
        <button className="secondary" onClick={onDone}>
          Choose seats again
        </button>
      )}
    </div>
  );
}
