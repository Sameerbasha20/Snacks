import { Router } from 'express';
import { listOrders } from '../db.js';
import { ah, requireAuth } from '../middleware/auth.js';

/**
 * Change feed that replaces websockets on serverless hosting.
 * Clients poll with the `now` from their previous response and get every order changed since then:
 * customers see their own orders, kitchen and admin see all.
 */
const router = Router();

router.get(
  '/',
  requireAuth,
  ah(async (req, res) => {
    // Small overlap guards against writes that commit while we query; clients de-duplicate.
    const now = new Date();
    const fallback = new Date(now.getTime() - 60_000);
    let since = new Date(String(req.query.since || ''));
    if (Number.isNaN(since.getTime()) || since < new Date(now.getTime() - 10 * 60_000)) since = fallback;
    const from = new Date(since.getTime() - 3000).toISOString();

    const staff = req.user.role === 'kitchen' || req.user.role === 'admin';
    const orders = staff
      ? await listOrders('o.updated_at > $1', [from], 'o.updated_at ASC')
      : await listOrders('o.user_id = $1 AND o.updated_at > $2', [req.user.id, from], 'o.updated_at ASC');

    res.set('Cache-Control', 'no-store');
    res.json({ now: now.toISOString(), orders });
  })
);

export default router;
