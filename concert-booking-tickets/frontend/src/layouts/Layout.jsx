import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Action } from '../components/UI';
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuth = useLocation().pathname === '/login';
  if (isAuth) return (
    <div className="auth-page">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="auth-header">
        <Link className="brand" to="/"><Brand /></Link>
        <Link className="auth-back" to="/">Back to concerts <Icon name="arrowUpRight" size={16} /></Link>
      </header>
      <main id="main-content" className="auth-main" tabIndex={-1}><Outlet /></main>
    </div>
  );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className={`site-header ${menuOpen ? 'menu-open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}>
        <Link className="brand" to="/">
          <Brand />
        </Link>
        <button
          className="secondary menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={18} /> Menu
        </button>
        <nav
          id="main-nav"
          className={menuOpen ? 'is-open' : ''}
          aria-label="Main navigation"
          onClick={() => setMenuOpen(false)}
        >
          <NavLink to="/" end>
            <Icon name="compass" size={18} /> Discover
          </NavLink>
          {!user && <a href="/#how-it-works"><Icon name="info" size={18} /> How it works</a>}
          {user && <NavLink to="/tickets"><Icon name="ticket" size={18} /> My tickets</NavLink>}
          {user && <NavLink to="/profile"><Icon name="user" size={18} /> Profile</NavLink>}
          {['staff', 'admin'].includes(user?.role) && <NavLink to="/staff"><Icon name="scan" size={18} /> Check-in</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin"><Icon name="settings" size={18} /> Manage</NavLink>}
        </nav>
        <div className="account">
          {user ? (
            <>
              <span className="user-name">{user.name}</span>
              <Action run={logout} onDone={() => navigate('/')}>
                <Icon name="logout" size={16} /> Sign out
              </Action>
            </>
          ) : (
            <>
              <Link className="button signup-link" to="/login?mode=register">
                Sign up
              </Link>
              <Link className="button secondary signin-link" to="/login">
                Sign in <Icon name="arrowUpRight" size={16} />
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <Link className="brand" to="/">
          <Brand />
        </Link>
        <span>Good music. Great memories.</span>
        <span>Concert Booking Tickets</span>
      </footer>
    </>
  );
}
