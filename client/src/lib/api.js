const TOKEN_KEY = 'snack_token';

// Logins last only for this browser session: closing the browser logs you out.
// Older versions kept the token in localStorage, so clear any left there.
localStorage.removeItem(TOKEN_KEY);
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

export function fmtDay(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

/** '08:00' -> '8 am', '22:30' -> '10:30 pm' */
export function fmtClock(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

export const fmtWhen = (iso) => `${fmtDay(iso)} at ${fmtTime(iso)}`;

/** ISO -> value for <input type="datetime-local"> in local time */
export function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relative(iso, now = Date.now()) {
  const diff = Math.round((new Date(iso).getTime() - now) / 60000);
  const abs = Math.abs(diff);
  const txt = abs < 60 ? `${abs}m` : `${Math.floor(abs / 60)}h ${abs % 60}m`;
  return diff >= 0 ? `in ${txt}` : `${txt} ago`;
}

/** Status labels and badge styles. Saffron only for "ready" — the one state that needs the customer. */
export const STATUS_META = {
  placed: { label: 'Received by the kitchen', short: 'Received', color: 'border border-ink/25 text-ink' },
  accepted: { label: 'Accepted by the kitchen', short: 'Accepted', color: 'border border-ink/25 text-ink' },
  preparing: { label: 'Being cooked', short: 'Cooking', color: 'bg-ink text-paper' },
  ready: { label: 'Ready to collect', short: 'Ready', color: 'bg-saffron text-ink' },
  collected: { label: 'Collected', short: 'Collected', color: 'text-muted' },
  cancelled: { label: 'Cancelled', short: 'Cancelled', color: 'text-muted line-through' },
};

export const CATEGORY_LABEL = { snacks: 'Snacks', food: 'Meals', drinks: 'Drinks' };
