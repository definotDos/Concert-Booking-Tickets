import { Icon } from './Icon';
import { useEffect, useId, useRef, useState } from 'react';
export function GlassCard({ as: Tag = 'div', className = '', children, ...props }) {
  return (
    <Tag className={`panel ${className}`} {...props}>
      {children}
    </Tag>
  );
}
export function StatCard({ label, value }) {
  return (
    <GlassCard className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </GlassCard>
  );
}
export function ConfirmDialog({ message, onCancel, onConfirm }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" aria-labelledby={titleId} onCancel={onCancel}>
      <h2 id={titleId}>Confirm action</h2>
      <p>{message}</p>
      <div className="button-row">
        <button className="secondary" autoFocus onClick={onCancel}>
          Keep unchanged
        </button>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    </dialog>
  );
}
export function Notice({ error, children }) {
  return error || children ? (
    <div role={error ? 'alert' : 'status'} className={`notice ${error ? 'error' : ''}`}>
      <Icon name={error ? 'alert' : 'info'} size={18} /><div>{error || children}</div>
    </div>
  ) : null;
}
export function Loading() {
  return (
    <div role="status" className="empty" aria-label="Loading content">
      <div className="loading-skeletons" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
      <span className="spinner" /> Loading…
    </div>
  );
}
export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
export function Pager({ page, pages, onChange }) {
  return (
    pages > 1 && (
      <div className="pager">
        <button className="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <Icon name="arrowLeft" size={16} /> Previous
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button className="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <Icon name="arrow" size={16} />
        </button>
      </div>
    )
  );
}
export function Badge({ children }) {
  return <span className={`badge ${children}`}>{String(children).replaceAll('_', ' ')}</span>;
}
export function Action({
  children,
  run,
  onDone,
  confirm,
  className = 'secondary',
  disabled = false,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  async function click() {
    setConfirming(false);
    setBusy(true);
    setError('');
    try {
      const data = await run();
      onDone?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="action">
      <button
        className={className}
        onClick={() => (confirm ? setConfirming(true) : click())}
        disabled={busy || disabled}
      >
        {busy ? 'Working…' : children}
      </button>
      {confirming && (
        <ConfirmDialog message={confirm} onCancel={() => setConfirming(false)} onConfirm={click} />
      )}
      {error && (
        <small role="alert" className="text-error">
          {error}
        </small>
      )}
    </span>
  );
}
