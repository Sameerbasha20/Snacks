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
  if (items.length > 50) throw new HttpError(400, 'Too many different items in one order (50 at most).');
  const merged = new Map();
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    const id = Number(it.menu_item_id);
    if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw new HttpError(400, 'An item in your cart is not on the menu');
    if (!qty || qty < 1 || qty > 50) throw new HttpError(400, 'Invalid item quantity');
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const rows = await q('SELECT * FROM menu_items WHERE id = ANY($1::int[])', [[...merged.keys()]], client);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const parts = await comboParts(rows, client);
  const lines = [];
  for (const [id, qty] of merged) {
    const m = byId.get(id);
    if (!m) throw new HttpError(400, 'An item in your cart is no longer on the menu');
    const combo = parts.get(m.id);
    const soldOut = !m.is_available || combo?.some((p) => !p.is_available);
    if (soldOut && !allowUnavailable) throw new HttpError(400, `${m.name} is sold out right now`);
    const detail = combo ? combo.map((p) => `${p.qty}× ${p.name}`).join(', ') : null;
    lines.push({ menu_item_id: m.id, name: m.name, detail, emoji: m.emoji, price: m.price, qty });
  }
  const total = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
  return { lines, total };
}

/** For combo rows, look up their component items. Returns Map(comboId -> [{menu_item_id, name, price, qty, is_available}]). */
export async function comboParts(rows, client) {
  const combos = rows.filter((r) => r.category === 'combos' && r.combo_items);
  const out = new Map();
  if (!combos.length) return out;
  const specs = new Map(combos.map((c) => [c.id, safeParse(c.combo_items)]));
  const ids = [...new Set([...specs.values()].flat().map((p) => Number(p.menu_item_id)))];
  const items = new Map((await q('SELECT id, name, price, is_available, is_veg FROM menu_items WHERE id = ANY($1::int[])', [ids], client)).map((r) => [r.id, r]));
  for (const [comboId, spec] of specs) {
    out.set(
      comboId,
      spec.map((p) => {
        const it = items.get(Number(p.menu_item_id));
        // A deleted component makes the combo unorderable.
        return { menu_item_id: Number(p.menu_item_id), qty: p.qty, name: it?.name ?? 'Removed item', price: it?.price ?? 0, is_available: !!it?.is_available, is_veg: it?.is_veg !== false };
      })
    );
  }
  return out;
}

function safeParse(json) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function replaceOrderItems(client, orderId, lines) {
  await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  for (const l of lines) {
    await client.query(
      'INSERT INTO order_items (order_id, menu_item_id, name_snapshot, detail_snapshot, emoji_snapshot, price_snapshot, qty) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [orderId, l.menu_item_id, l.name, l.detail ?? null, l.emoji, l.price, l.qty]
    );
  }
}

/*
 * Order journey. The kitchen is away from the office, so:
 *   kitchen:  placed -> accepted -> preparing -> cooked (waiting at the kitchen)
 *   delivery: cooked -> on_the_way (picked up) -> ready (at reception) -> collected (handed to the customer)
 * "ready" keeps meaning "the customer can collect it now"; that's when the customer is alerted.
 */
export const KITCHEN_TRANSITIONS = {
  placed: ['accepted', 'preparing'],
  accepted: ['preparing'],
  preparing: ['cooked'],
};
export const DELIVERY_TRANSITIONS = {
  cooked: ['on_the_way'],
  on_the_way: ['ready'],
  ready: ['collected'],
};

/** Next statuses this role may set from `status`. Admin can do both jobs. */
export function allowedNext(role, status) {
  const k = KITCHEN_TRANSITIONS[status] || [];
  const d = DELIVERY_TRANSITIONS[status] || [];
  if (role === 'kitchen') return k;
  if (role === 'delivery') return d;
  if (role === 'admin') return [...k, ...d];
  return [];
}

/** Timestamp (and who did it) recorded when an order enters each status. */
export const STATUS_STAMPS = {
  cooked: { at: 'cooked_at' },
  on_the_way: { at: 'picked_up_at', by: 'picked_up_by' },
  ready: { at: 'ready_at', by: 'delivered_by' },
  collected: { at: 'collected_at' },
};

export const USER_CANCELLABLE = ['placed', 'accepted'];
