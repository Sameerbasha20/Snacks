import { Router } from 'express';
import { config } from '../config.js';
import { q } from '../db.js';
import { ah, requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/key', (req, res) => res.json({ publicKey: config.vapidPublic }));

router.post(
  '/subscribe',
  requireAuth,
  ah(async (req, res) => {
    const { endpoint, keys } = req.body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Invalid subscription' });
    await q(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_json) VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, keys_json = EXCLUDED.keys_json`,
      [req.user.id, endpoint, JSON.stringify(keys)]
    );
    res.json({ ok: true });
  })
);

export default router;
