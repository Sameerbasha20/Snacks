import { q } from './db.js';
import { shopMinutesOfDay } from './time.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

export function parseDate(value, label = 'time') {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new HttpError(400, `Invalid ${label}`);
  return d;
}

/** Pickup must be at least `min_lead_minutes` away and within opening hours (shop timezone). */
export function validatePickup(pickup, settings, now = new Date()) {
  const minTime = new Date(now.getTime() + settings.min_lead_minutes * 60_000);
  if (pickup < minTime) {
    throw new HttpError(400, `Please order at least ${settings.min_lead_minutes} minutes before pickup so the kitchen has time to prepare.`);
  }
  const maxTime = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  if (pickup > maxTime) throw new HttpError(400, 'Pickup can be at most 7 days ahead.');
  const mins = shopMinutesOfDay(pickup);
  if (mins < toMinutes(settings.open_time) || mins > toMinutes(settings.close_time)) {
    throw new HttpError(400, `Pickup must be between ${settings.open_time} and ${settings.close_time}.`);
  }
}

/** Resolve requested items against the live menu; returns priced lines and total. */
export async function priceItems(items, { allowUnavailable = false, client } = {}) {
  if (!Array.isArray(items) || items.length === 0) throw new HttpError(400, 'Your cart is empty');
  const merged = new Map();
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    const id = Number(it.menu_item_id);
    if (!id || !qty || qty < 1 || qty > 50) throw new HttpError(400, 'Invalid item quantity');
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const rows = await q('SELECT * FROM menu_items WHERE id = ANY($1::int[])', [[...merged.keys()]], client);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lines = [];
  for (const [id, qty] of merged) {
    const m = byId.get(id);
    if (!m) throw new HttpError(400, 'An item in your cart is no longer on the menu');
    if (!m.is_available && !allowUnavailable) throw new HttpError(400, `${m.name} is sold out right now`);
    lines.push({ menu_item_id: m.id, name: m.name, emoji: m.emoji, price: m.price, qty });
  }
  const total = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  return { lines, total };
}

export async function replaceOrderItems(client, orderId, lines) {
  await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  for (const l of lines) {
    await client.query(
      'INSERT INTO order_items (order_id, menu_item_id, name_snapshot, emoji_snapshot, price_snapshot, qty) VALUES ($1, $2, $3, $4, $5, $6)',
      [orderId, l.menu_item_id, l.name, l.emoji, l.price, l.qty]
    );
  }
}

// Kitchen workflow: allowed next statuses from each status.
export const KITCHEN_TRANSITIONS = {
  placed: ['accepted', 'preparing'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['collected'],
  collected: [],
  cancelled: [],
};

export const USER_CANCELLABLE = ['placed', 'accepted'];
