import { Router } from 'express';
import { one, q } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';
import { comboParts } from '../orderRules.js';

const router = Router();
const CATEGORIES = ['combos', 'snacks', 'burgers', 'biryani', 'homemade', 'food', 'drinks'];

router.get(
  '/',
  ah(async (req, res) => {
    const all = req.query.all === '1';
    const rows = await q(
      `SELECT m.*, r.avg_rating, COALESCE(r.rating_count, 0) AS rating_count
       FROM menu_items m
       LEFT JOIN (SELECT menu_item_id, ROUND(AVG(stars)::numeric, 1)::float AS avg_rating, COUNT(*) AS rating_count
                  FROM ratings GROUP BY menu_item_id) r ON r.menu_item_id = m.id
       ${all ? '' : 'WHERE m.is_available'} ORDER BY m.category, m.id`
    );
    const parts = await comboParts(rows);
    const out = [];
    for (const row of rows) {
      const combo = parts.get(row.id);
      if (combo) {
        row.combo = combo.map(({ menu_item_id, name, qty }) => ({ menu_item_id, name, qty }));
        row.regular_price = combo.reduce((s, p) => s + p.price * p.qty, 0);
        row.components_available = combo.every((p) => p.is_available);
        // A combo is veg only if everything in it is.
        row.is_veg = combo.every((p) => p.is_veg);
        // Customers don't see a combo while one of its parts is sold out.
        if (!all && !row.components_available) continue;
      }
      out.push(row);
    }
    res.json(out);
  })
);

function readItem(body, existing = {}) {
  const item = {
    name: String(body.name ?? existing.name ?? '').trim(),
    category: String(body.category ?? existing.category ?? ''),
    price: Number(body.price ?? existing.price),
    emoji: String(body.emoji ?? existing.emoji ?? '').trim() || null,
    image_url: String(body.image_url ?? existing.image_url ?? '').trim() || null,
    description: String(body.description ?? existing.description ?? '').trim(),
    is_available: Boolean(body.is_available ?? existing.is_available ?? true),
    is_veg: Boolean(body.is_veg ?? existing.is_veg ?? true),
    prep_minutes: Math.max(1, Math.floor(Number(body.prep_minutes ?? existing.prep_minutes ?? 15))),
    combo_items: null,
  };
  if (item.category === 'combos') {
    const raw = body.combo_items ?? body.combo ?? existing.combo_items;
    const list = (typeof raw === 'string' ? JSON.parse(raw || '[]') : raw || [])
      .map((p) => ({ menu_item_id: Math.floor(Number(p.menu_item_id)), qty: Math.floor(Number(p.qty)) || 1 }))
      .filter((p) => p.menu_item_id > 0 && p.qty > 0 && p.qty <= 20);
    if (list.length < 2 && list.reduce((s, p) => s + p.qty, 0) < 2) throw new Error('A combo needs at least two items');
    if (existing.id && list.some((p) => p.menu_item_id === existing.id)) throw new Error("A combo can't include itself");
    item.combo_items = JSON.stringify(list);
  }
  if (!item.name) throw new Error('Name is required');
  if (!CATEGORIES.includes(item.category)) throw new Error('Pick a menu section for this dish');
  if (!Number.isFinite(item.price) || item.price < 0) throw new Error('Price must be a positive number');
  return item;
}

const FIELDS = ['name', 'category', 'price', 'emoji', 'image_url', 'description', 'is_available', 'is_veg', 'prep_minutes', 'combo_items'];

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  ah(async (req, res) => {
    let item;
    try {
      item = readItem(req.body);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const row = await one(
      `INSERT INTO menu_items (${FIELDS.join(', ')}) VALUES (${FIELDS.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      FIELDS.map((f) => item[f])
    );
    res.status(201).json(row);
  })
);

router.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  ah(async (req, res) => {
    const existing = await one('SELECT * FROM menu_items WHERE id = $1', [Number(req.params.id) || 0]);
    if (!existing) return res.status(404).json({ error: 'Item not found' });
    let item;
    try {
      item = readItem(req.body, existing);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const row = await one(
      `UPDATE menu_items SET ${FIELDS.map((f, i) => `${f} = $${i + 1}`).join(', ')} WHERE id = $${FIELDS.length + 1} RETURNING *`,
      [...FIELDS.map((f) => item[f]), existing.id]
    );
    res.json(row);
  })
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  ah(async (req, res) => {
    await q('DELETE FROM menu_items WHERE id = $1', [Number(req.params.id) || 0]);
    res.json({ ok: true });
  })
);

export default router;
