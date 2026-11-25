import { Router } from 'express';
import { one, q } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const CATEGORIES = ['snacks', 'drinks', 'food'];

router.get(
  '/',
  ah(async (req, res) => {
    const all = req.query.all === '1';
    res.json(await q(`SELECT * FROM menu_items ${all ? '' : 'WHERE is_available'} ORDER BY category, id`));
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
    prep_minutes: Math.max(1, Math.floor(Number(body.prep_minutes ?? existing.prep_minutes ?? 15))),
  };
  if (!item.name) throw new Error('Name is required');
  if (!CATEGORIES.includes(item.category)) throw new Error('Section must be snacks, meals or drinks');
  if (!Number.isFinite(item.price) || item.price < 0) throw new Error('Price must be a positive number');
  return item;
}

const FIELDS = ['name', 'category', 'price', 'emoji', 'image_url', 'description', 'is_available', 'prep_minutes'];

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
