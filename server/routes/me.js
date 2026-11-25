import { Router } from 'express';
import { getSettings, makeReferralCode, nowIso, one, q } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';
import { creditBalance } from '../rewards.js';

/** The signed-in customer's own things: referral code and credit, favourite dishes. */
const router = Router();
router.use(requireAuth, requireRole('user'));

router.get(
  '/rewards',
  ah(async (req, res) => {
    let { referral_code: code } = await one('SELECT referral_code FROM users WHERE id = $1', [req.user.id]);
    if (!code) {
      code = await makeReferralCode(req.user.name);
      await q('UPDATE users SET referral_code = $1 WHERE id = $2', [code, req.user.id]);
    }
    const [balance, settings, friends, history] = await Promise.all([
      creditBalance(req.user.id),
      getSettings(),
      q('SELECT name, referral_rewarded, created_at FROM users WHERE referred_by = $1 ORDER BY created_at DESC', [req.user.id]),
      q('SELECT amount, reason, order_id, created_at FROM credit_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 30', [req.user.id]),
    ]);
    res.json({
      code,
      balance,
      amount: settings.referral_amount,
      // Only first names of friends: enough to recognise them, nothing more.
      friends: friends.map((f) => ({ name: f.name.split(' ')[0], rewarded: f.referral_rewarded, joined_at: f.created_at })),
      history,
    });
  })
);

router.get(
  '/favorites',
  ah(async (req, res) => {
    res.json((await q('SELECT menu_item_id FROM favorites WHERE user_id = $1', [req.user.id])).map((r) => r.menu_item_id));
  })
);

router.put(
  '/favorites/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id) || 0;
    if (!(await one('SELECT 1 FROM menu_items WHERE id = $1', [id]))) return res.status(404).json({ error: 'Item not found' });
    await q('INSERT INTO favorites (user_id, menu_item_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [req.user.id, id, nowIso()]);
    res.json({ ok: true });
  })
);

router.delete(
  '/favorites/:id',
  ah(async (req, res) => {
    await q('DELETE FROM favorites WHERE user_id = $1 AND menu_item_id = $2', [req.user.id, Number(req.params.id) || 0]);
    res.json({ ok: true });
  })
);

export default router;
