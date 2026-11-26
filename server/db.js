import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { config } from './config.js';
import { ADMIN_SEED, COMBO_SEED_V2, MENU_SEED, MENU_SEED_V2, MOVE_TO_BURGERS } from './seedData.js';

// COUNT(*) etc. come back as bigint strings; our numbers are small, so parse them.
pg.types.setTypeParser(20, (v) => Number(v));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Run `vercel env pull .env.local` or add it to .env.');
}

// Small pool: on Vercel each function instance holds its own connections.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10_000,
});

export const nowIso = () => new Date().toISOString();

export async function q(sql, params = [], client = pool) {
  const { rows } = await client.query(sql, params);
  return rows;
}

export async function one(sql, params = [], client = pool) {
  const rows = await q(sql, params, client);
  return rows[0] ?? null;
}

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Timestamps are ISO-8601 UTC strings set by the app, so they sort and compare as text.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','kitchen','admin','delivery')),
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS menu_items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  emoji TEXT,
  image_url TEXT,
  description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  prep_minutes INTEGER NOT NULL DEFAULT 15
);
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  pickup_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed'
    CHECK (status IN ('placed','accepted','preparing','cooked','on_the_way','ready','collected','cancelled')),
  total DOUBLE PRECISION NOT NULL,
  note TEXT,
  cancel_deadline TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  ready_at TEXT,
  collected_at TEXT,
  cancelled_at TEXT,
  cancelled_by TEXT
);
CREATE INDEX IF NOT EXISTS orders_updated_idx ON orders (updated_at);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id);
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  emoji_snapshot TEXT,
  price_snapshot DOUBLE PRECISION NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys_json TEXT NOT NULL
);
`;

// Additions after the first release. Every statement is safe to re-run.
const MIGRATIONS = `
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS combo_items TEXT;
ALTER TABLE menu_items DROP CONSTRAINT IF EXISTS menu_items_category_check;
ALTER TABLE menu_items ADD CONSTRAINT menu_items_category_check CHECK (category IN ('combos','snacks','burgers','biryani','homemade','drinks','food'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
-- Kitchen is away from the office: a delivery partner carries cooked food to reception.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','kitchen','admin','delivery'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('placed','accepted','preparing','cooked','on_the_way','ready','collected','cancelled'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cooked_at TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_by INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_by INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS detail_snapshot TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_rewarded BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, menu_item_id)
);
CREATE TABLE IF NOT EXISTS ratings (
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at TEXT NOT NULL,
  PRIMARY KEY (order_id, menu_item_id)
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DOUBLE PRECISION NOT NULL,
  reason TEXT NOT NULL,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS credit_ledger_user_idx ON credit_ledger (user_id);
`;

const DEFAULT_SETTINGS = {
  shop_name: 'Snack Shack',
  min_lead_minutes: '60',
  default_cancel_before_minutes: '30',
  open_time: '08:00',
  close_time: '22:00',
  referral_amount: '20',
  // Where customers send UPI payments. Staff confirm each payment by hand (no gateway yet).
  upi_id: '9642388892-3@ibl',
  upi_name: '', // empty: use the shop name
  // Delivery SLA: minutes from 'cooked' to picked up, and from picked up to reception.
  sla_pickup_minutes: '10',
  sla_delivery_minutes: '15',
  // Demo payments: customers can mark an order paid without paying (for trials). '0' turns it off.
  demo_payments: '1',
};

/** Short, readable code like SAMEE7K2. Unique across users. */
export async function makeReferralCode(name, client = pool) {
  const base = String(name || 'SNACK').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'SNACK';
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 20; i++) {
    let tail = '';
    for (let j = 0; j < 3; j++) tail += alphabet[randomInt(alphabet.length)];
    const code = base + tail;
    if (!(await one('SELECT 1 FROM users WHERE referral_code = $1', [code], client))) return code;
  }
  throw new Error('Could not create a referral code');
}

/** Create tables and first-run data. Safe to call repeatedly; runs once per process. */
let ready;
export function ensureDb() {
  ready ||= (async () => {
    await pool.query(SCHEMA);
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [k, v]);
    }
    const { n } = await one('SELECT COUNT(*)::int AS n FROM users');
    if (n === 0) {
      for (const u of ADMIN_SEED(config)) {
        await pool.query(
          'INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (email) DO NOTHING',
          [u.name, u.email.toLowerCase(), '', bcrypt.hashSync(u.password, 10), u.role, nowIso()]
        );
      }
    }
    const { m } = await one('SELECT COUNT(*)::int AS m FROM menu_items');
    if (m === 0) {
      for (const [name, category, price, emoji, description, prep, image] of MENU_SEED) {
        await pool.query(
          'INSERT INTO menu_items (name, category, price, emoji, description, prep_minutes, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [name, category, price, emoji, description, prep, image]
        );
      }
    }
    await pool.query(MIGRATIONS);
    for (const u of await q("SELECT id, name FROM users WHERE role = 'user' AND referral_code IS NULL")) {
      await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [await makeReferralCode(u.name), u.id]);
    }
    await seedCombos();
    await seedMenuV2();
  })().catch((e) => {
    ready = null; // let the next request retry
    throw e;
  });
  return ready;
}

/** Sample combos, added once. Skipped if the admin has removed the items they use. */
async function seedCombos() {
  if (await one("SELECT 1 FROM settings WHERE key = 'seeded_combos'")) return;
  const ids = Object.fromEntries((await q('SELECT id, name FROM menu_items')).map((r) => [r.name, r.id]));
  for (const [name, price, description, image, parts] of COMBO_SEED) {
    if (!parts.every(([n]) => ids[n])) continue;
    const combo = JSON.stringify(parts.map(([n, qty]) => ({ menu_item_id: ids[n], qty })));
    await pool.query(
      "INSERT INTO menu_items (name, category, price, description, prep_minutes, image_url, combo_items) VALUES ($1, 'combos', $2, $3, 15, $4, $5)",
      [name, price, description, image, combo]
    );
  }
  await pool.query("INSERT INTO settings (key, value) VALUES ('seeded_combos', '1') ON CONFLICT (key) DO NOTHING");
}

/**
 * Biryani, home-made meals, sandwiches and puffs, added once.
 * Moves burgers and pizza into their own section, and skips any dish name that already exists.
 */
async function seedMenuV2() {
  if (await one("SELECT 1 FROM settings WHERE key = 'seeded_menu_v2'")) return;
  await pool.query("UPDATE menu_items SET category = 'burgers' WHERE category = 'food' AND name = ANY($1)", [MOVE_TO_BURGERS]);
  const have = new Set((await q('SELECT name FROM menu_items')).map((r) => r.name));
  for (const [name, category, price, emoji, description, prep, image] of MENU_SEED_V2) {
    if (have.has(name)) continue;
    await pool.query(
      'INSERT INTO menu_items (name, category, price, emoji, description, prep_minutes, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [name, category, price, emoji, description, prep, image]
    );
  }
  const ids = Object.fromEntries((await q('SELECT id, name FROM menu_items')).map((r) => [r.name, r.id]));
  for (const [name, price, description, image, parts] of COMBO_SEED_V2) {
    if (ids[name] || !parts.every(([n]) => ids[n])) continue;
    const combo = JSON.stringify(parts.map(([n, qty]) => ({ menu_item_id: ids[n], qty })));
    await pool.query(
      "INSERT INTO menu_items (name, category, price, description, prep_minutes, image_url, combo_items) VALUES ($1, 'combos', $2, $3, 20, $4, $5)",
      [name, price, description, image, combo]
    );
  }
  await pool.query("INSERT INTO settings (key, value) VALUES ('seeded_menu_v2', '1') ON CONFLICT (key) DO NOTHING");
}

const COMBO_SEED = [
  ['Samosa + Chai', 45, 'The classic break: two samosas and a hot masala chai.', '/images/samosa.jpg', [['Samosa (2 pcs)', 1], ['Masala Chai', 1]]],
  ['Chicken Burger Meal', 279, 'Crispy chicken burger, masala fries and a cold coffee.', '/images/chicken-burger.jpg', [['Crispy Chicken Burger', 1], ['Masala Fries', 1], ['Cold Coffee', 1]]],
  ['Veg Burger Meal', 209, 'Veg burger, masala fries and a fresh lime soda.', '/images/veg-burger.jpg', [['Veg Burger', 1], ['Masala Fries', 1], ['Fresh Lime Soda', 1]]],
];

export async function getSettings() {
  const rows = await q('SELECT key, value FROM settings');
  const s = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return {
    shop_name: s.shop_name,
    min_lead_minutes: Number(s.min_lead_minutes),
    default_cancel_before_minutes: Number(s.default_cancel_before_minutes),
    open_time: s.open_time,
    close_time: s.close_time,
    referral_amount: Number(s.referral_amount),
    upi_id: s.upi_id,
    upi_name: s.upi_name || s.shop_name,
    sla_pickup_minutes: Number(s.sla_pickup_minutes),
    sla_delivery_minutes: Number(s.sla_delivery_minutes),
    demo_payments: s.demo_payments === '1',
  };
}

export async function setSettings(patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (k in DEFAULT_SETTINGS && v !== undefined && v !== null && v !== '') {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, String(v)]);
    }
  }
  return getSettings();
}

const ORDER_SQL = `
  SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email
  FROM orders o JOIN users u ON u.id = o.user_id`;

async function attachItems(orders, client = pool) {
  if (!orders.length) return orders;
  const items = await q(
    `SELECT oi.id, oi.order_id, oi.menu_item_id, oi.name_snapshot AS name, oi.detail_snapshot AS detail,
            oi.emoji_snapshot AS emoji, oi.price_snapshot AS price, oi.qty, r.stars AS rating
     FROM order_items oi
     LEFT JOIN ratings r ON r.order_id = oi.order_id AND r.menu_item_id = oi.menu_item_id
     WHERE oi.order_id = ANY($1::int[]) ORDER BY oi.id`,
    [orders.map((o) => o.id)],
    client
  );
  const byOrder = new Map(orders.map((o) => [o.id, []]));
  for (const it of items) byOrder.get(it.order_id)?.push(it);
  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) }));
}

export async function getOrder(id, client = pool) {
  const o = await one(`${ORDER_SQL} WHERE o.id = $1`, [Number(id) || 0], client);
  if (!o) return null;
  return (await attachItems([o], client))[0];
}

/** `where` uses $1..$n placeholders matching `params`. `order` is a fixed, trusted SQL fragment. */
export async function listOrders(where = 'TRUE', params = [], order = 'o.pickup_time ASC') {
  return attachItems(await q(`${ORDER_SQL} WHERE ${where} ORDER BY ${order}`, params));
}
