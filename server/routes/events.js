import { Router } from 'express';
import { listOrders, one } from '../db.js';
import { ah, requireAuth } from '../middleware/auth.js';

/**
 * Change feed that replaces websockets on serverless hosting.
 * Clients poll with the `now` from their previous response and get every order changed since then:
 * customers see their own orders, kitchen and admin see all.
 *
 * `active` tells the client how often to poll. On the free plans every poll is a counted request and keeps the
 * database awake, so clients poll quickly only while there is something to watch (see client/src/lib/socket.js).
 */
const router = Router();
const MAX_GAP_MS = 30 * 60_000; // staff poll every 10 min when quiet; keep a margin so no change is skipped

router.get(
  '/',
  requireAuth,
  ah(async (req, res) => {
    // Small overlap guards against writes that commit while we query; clients de-duplicate.
    const now = new Date();
    const oldest = new Date(now.getTime() - MAX_GAP_MS);
    let since = new Date(String(req.query.since || ''));
    if (Number.isNaN(since.getTime()) || since < oldest) since = oldest;
    const from = new Date(since.getTime() - 3000).toISOString();

    const staff = req.user.role === 'kitchen' || req.user.role === 'admin';
    const recent = new Date(now.getTime() - 3 * 3600_000).toISOString();
    const [orders, active] = await Promise.all([
      staff
        ? listOrders('o.updated_at > $1', [from], 'o.updated_at ASC')
        : listOrders('o.user_id = $1 AND o.updated_at > $2', [req.user.id, from], 'o.updated_at ASC'),
      staff
        ? // Something for the kitchen to act on (orders long past pickup don't count, so a forgotten one can't keep it busy).
          one("SELECT EXISTS (SELECT 1 FROM orders WHERE status IN ('placed','accepted','preparing','ready') AND pickup_time > $1) AS a", [recent])
        : one("SELECT EXISTS (SELECT 1 FROM orders WHERE user_id = $1 AND status NOT IN ('collected','cancelled') AND pickup_time > $2) AS a", [
            req.user.id,
            recent,
          ]),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ now: now.toISOString(), orders, active: active.a });
  })
);

export default router;
