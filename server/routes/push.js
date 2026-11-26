import { Router } from 'express';
import { config } from '../config.js';
import { q } from '../db.js';
import { ah, requireAuth } from '../middleware/auth.js';
import { isPushEndpoint } from '../security.js';

const router = Router();

router.get('/key', (req, res) => res.json({ publicKey: config.vapidPublic }));

router.post(
  '/subscribe',
  requireAuth,
  ah(async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!isPushEndpoint(endpoint) || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    // A few devices per person is plenty; drop the oldest beyond that.
    await q('DELETE FROM push_subscriptions WHERE user_id = $1 AND id NOT IN (SELECT id FROM push_subscriptions WHERE user_id = $1 ORDER BY id DESC LIMIT 4)', [req.user.id]);
    await q(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_json) VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys_json = EXCLUDED.keys_json`,
      [req.user.id, endpoint, JSON.stringify({ p256dh: keys.p256dh, auth: keys.auth })]
    );
    res.json({ ok: true });
  })
);

export default router;
