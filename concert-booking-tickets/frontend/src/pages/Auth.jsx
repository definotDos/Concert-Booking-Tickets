import { Icon } from '../components/Icon';
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Notice } from '../components/UI';

export function Auth() {
  const [params, setParams] = useSearchParams();
  const mode = params.get('mode') === 'register' ? 'register' : 'login';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const { authenticate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registering = mode === 'register';
  const hasMinimum = password.length >= 10;
  const withinLimit = new TextEncoder().encode(password).length <= 72;

  function switchMode(next) {
    setParams(next === 'register' ? { mode: next } : {}, { replace: true, state: location.state });
    setError('');
    setShowPassword(false);
    setPassword('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (registering && body.password.length < 10) {
      setError('Password must contain at least 10 characters.');
      return;
    }
    if (registering && new TextEncoder().encode(body.password).length > 72) {
      setError('Password is too long. Use fewer characters (maximum 72 bytes).');
      return;
    }
    setBusy(true);
    try {
      await authenticate(mode, body);
      navigate(location.state?.from || '/', { replace: true });
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-shell" aria-label={registering ? 'Create an account' : 'Sign in'}>
      <div className="auth-story">
        <div className="eyebrow">LIVE FOR THE MOMENT</div>
        <h1>More music.<br /><em>More memories.</em></h1>
        <p>Your next unforgettable night starts here.</p>
        <ol className="auth-perks">
          <li><b aria-hidden="true">01</b> Discover your next favorite show</li>
          <li><b aria-hidden="true">02</b> Choose your spot in the crowd</li>
          <li><b aria-hidden="true">03</b> Keep every ticket in one place</li>
        </ol>
        <span className="auth-story-note">GOOD MUSIC. GREAT MEMORIES.</span>
      </div>
      <div className="auth-card">
        <div className="auth-mode" role="group" aria-label="Account access">
          <button className="secondary" type="button" aria-pressed={!registering} disabled={busy} onClick={() => switchMode('login')}>Sign in</button>
          <button className="secondary" type="button" aria-pressed={registering} disabled={busy} onClick={() => switchMode('register')}>Sign up</button>
        </div>
        <div className="auth-heading">
          <h2>{registering ? 'Join the crowd.' : 'Welcome back.'}</h2>
          <p>{registering ? 'Create your account. Find your next great night.' : 'Sign in to pick up where you left off.'}</p>
        </div>
        <form key={mode} className="auth-form" onSubmit={submit} aria-busy={busy}>
          <Notice error={error} />
          {registering && (
            <label htmlFor="auth-name">Full name
              <input id="auth-name" name="name" placeholder="Your full name" required minLength={2} maxLength={80} autoComplete="name" disabled={busy} />
            </label>
          )}
          <label htmlFor="auth-email">Email address
            <input id="auth-email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" autoCapitalize="none" spellCheck={false} disabled={busy} />
          </label>
          <div className="auth-password-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password">
              <input id="auth-password" name="password" type={showPassword ? 'text' : 'password'} placeholder={registering ? 'At least 10 characters' : 'Enter your password'} required minLength={registering ? 10 : 1} maxLength={72} value={password} onChange={event => setPassword(event.target.value)} autoComplete={registering ? 'new-password' : 'current-password'} aria-describedby={registering ? 'password-hint' : undefined} aria-invalid={registering && password.length > 0 && !withinLimit ? true : undefined} disabled={busy} />
              <button
                className="secondary auth-eye"
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-controls="auth-password"
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
                disabled={busy}
                onMouseDown={event => event.preventDefault()}
                onClick={() => setShowPassword(visible => !visible)}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} />
              </button>
            </div>
            {registering && (
              <div id="password-hint" className="auth-password-checks" aria-live="polite" aria-atomic="true">
                <span className={hasMinimum ? 'is-met' : ''}>
                  <Icon name={hasMinimum ? 'check' : 'circle'} size={14} />
                  {hasMinimum ? '10-character minimum met' : 'Use at least 10 characters'}
                </span>
                {password.length > 0 && (
                  <span className={withinLimit ? 'is-met' : 'is-invalid'}>
                    <Icon name={withinLimit ? 'check' : 'alert'} size={14} />
                    {withinLimit ? 'Within password size limit' : 'Too long: maximum 72 UTF-8 bytes'}
                  </span>
                )}
              </div>
            )}
          </div>
          <button className="secondary auth-submit" disabled={busy} type="submit">
            {busy && <span className="auth-spinner" aria-hidden="true" />}
            <span>{busy ? (registering ? 'Creating account…' : 'Signing in…') : registering ? 'Create account' : 'Sign in'}</span>
            {!busy && (
              <Icon name="arrow" />
            )}
          </button>
        </form>
        <p className="auth-switch">
          {registering ? 'Already have an account?' : 'New to Concert Booking Tickets?'}{' '}
          <button className="secondary" type="button" disabled={busy} onClick={() => switchMode(registering ? 'login' : 'register')}>{registering ? 'Sign in' : 'Create an account'}</button>
        </p>
      </div>
    </section>
  );
}

