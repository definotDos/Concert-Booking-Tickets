import { Icon } from '../components/Icon';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GlassCard, Notice } from '../components/UI';
export function Profile() {
  const { user, updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(e) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get('name');
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateProfile(name);
      setMessage('Your profile has been saved.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="eyebrow">YOUR ACCOUNT</div>
      <h1>Profile settings.</h1>
      <p>Keep your name up to date for your next night out.</p>
      <GlassCard as="form" className="auth-form" onSubmit={save}>
        <label>
          Full name
          <input
            name="name"
            defaultValue={user.name}
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
        </label>
        <label>
          Email address
          <input value={user.email} readOnly type="email" />
        </label>
        <p className="muted">Account access: {user.role === 'user' ? 'Customer' : user.role}</p>
        <Notice error={error} />
        <Notice>{message}</Notice>
        <button disabled={busy}><Icon name="check" size={18} />{busy ? 'Saving…' : 'Save profile'}</button>
      </GlassCard>
    </section>
  );
}
