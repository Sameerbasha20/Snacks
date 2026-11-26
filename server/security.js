import { one, pool } from './db.js';
import { HttpError } from './orderRules.js';

/**
 * Rate limits kept in the database, because on Vercel every request may land on a different server instance,
 * so in-memory counters would reset constantly.
 */
let ready;
function ensureTable() {
  ready ||= pool
    .query(
      `CREATE TABLE IF NOT EXISTS rate_events (id BIGSERIAL PRIMARY KEY, key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
       CREATE INDEX IF NOT EXISTS rate_events_key_time ON rate_events (key, created_at);`
    )
    .catch((e) => {
      ready = null;
      throw e;
    });
  return ready;
}

/** The caller's IP. On Vercel the platform sets x-real-ip; locally we only trust the socket. */
export function clientIp(req) {
  if (process.env.VERCEL) return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  return req.socket?.remoteAddress || 'unknown';
}

/** How many times `key` happened in the last `minutes`. */
export async function countRecent(key, minutes) {
  await ensureTable();
  const r = await one('SELECT COUNT(*)::int AS n FROM rate_events WHERE key = $1 AND created_at > now() - make_interval(mins => $2)', [key, minutes]);
  return r.n;
}

export async function record(key) {
  await ensureTable();
  await pool.query('INSERT INTO rate_events (key) VALUES ($1)', [key]);
  // Keep the table small: drop anything older than a day, now and then.
  if (Math.random() < 0.02) await pool.query("DELETE FROM rate_events WHERE created_at < now() - interval '1 day'");
}

export async function clear(key) {
  await ensureTable();
  await pool.query('DELETE FROM rate_events WHERE key = $1', [key]);
}

/** Throw 429 if `key` already happened `limit` times in `minutes`. */
export async function limit(key, max, minutes, message) {
  if ((await countRecent(key, minutes)) >= max) throw new HttpError(429, message);
}

// Web push services browsers actually use. Anything else could be used to make our server call arbitrary URLs.
const PUSH_HOSTS = ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];
export function isPushEndpoint(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && PUSH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Browser-side protections, sent on every response (Vercel also sets them for the static pages). */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
};
