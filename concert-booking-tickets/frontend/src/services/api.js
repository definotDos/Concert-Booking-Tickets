let csrf = '';
export function setCsrf(value) {
  csrf = value || '';
}
export async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}
export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const money = (amount, currency = 'sgd') =>
  new Intl.NumberFormat('en-SG', { style: 'currency', currency: currency.toUpperCase() }).format(
    amount / 100,
  );
export const date = (value, timezone = 'Asia/Manila') =>
  new Intl.DateTimeFormat('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
