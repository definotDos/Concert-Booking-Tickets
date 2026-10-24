const paths = {
  // Navigation and actions share a 24px grid and rounded strokes.
  music: <><path d="M9 18V5l12-2v13M9 9l12-2" /><ellipse cx="6" cy="18" rx="3" ry="3" /><ellipse cx="18" cy="16" rx="3" ry="3" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-3 5-5 3 3-5Z" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--surface)" /><circle cx="15" cy="17" r="3" fill="var(--surface)" /></>,
  scan: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 12h18M8 8v1m8-1v1M8 15v1m8-1v1" /></>,
  logout: <><path d="M9 4H4v16h5m5-13 5 5-5 5M9 12h11" /></>,
  arrowUpRight: <path d="M6 18 18 6M6 6h12v12" />,
  arrowLeft: <path d="M19 12H5m6-6-6 6 6 6" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18M7 15h2m6 0h2M7 18h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chart: <path d="M4 3v18h17M8 16v-5m5 5V7m5 9v-7" />,
  payment: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  circle: <circle cx="12" cy="12" r="9" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  alert: <><path d="m12 3 10 18H2Z M12 9v5m0 3h.01" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.9M6.3 6.3A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.7-1.7" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  ticket: <><path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z" /><path d="M15 5v3m0 3v2m0 3v3" /></>,
};
// Icons are decorative: put the accessible name on their button or link.
export function Icon({ name, size = 20, className = '' }) {
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name] || paths.info}</svg>;
}
