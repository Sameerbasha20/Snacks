import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { getOrder, getSettings, listOrders, nowIso, one, q, tx } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';
import { notifyReady } from '../push.js';
import { startOfShopDay } from '../time.js';
import { HttpError, KITCHEN_TRANSITIONS, USER_CANCELLABLE, parseDate, priceItems, replaceOrderItems, validatePickup } from '../orderRules.js';
import { addCredit, creditBalance, refundOnCancel, rewardReferrer } from '../rewards.js';

const router = Router();
router.use(requireAuth);

const isStaff = (u) => u.role === 'kitchen' || u.role === 'admin';
const round = (n) => Math.round(n * 100) / 100;

// DEMO payment gateway: the payment sheet in the browser simulates UPI and tells us the outcome.
// To go live, replace this with a Razorpay/Cashfree order + signature check before saving the order.
const PAYMENT_METHODS = ['upi_app', 'upi_id'];

// Place an order. The customer has already (demo-)paid the amount shown at checkout.
router.post(
  '/',
  ah(async (req, res) => {
    const settings = await getSettings();
    const pickup = parseDate(req.body.pickup_time, 'pickup time');
    validatePickup(pickup, settings);
    const note = String(req.body.note || '').trim().slice(0, 300);
    const cancelDeadline = new Date(pickup.getTime() - settings.default_cancel_before_minutes * 60_000);
    const payment = req.body.payment || {};

    const id = await tx(async (client) => {
      const { lines, total: subtotal } = await priceItems(req.body.items, { client });
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]); // one checkout at a time per customer
      const balance = req.body.use_credit ? await creditBalance(req.user.id, client) : 0;
      const discount = round(Math.min(balance, subtotal));
      const total = round(subtotal - discount);

      if (total > 0) {
        if (!PAYMENT_METHODS.includes(payment.method) || payment.status !== 'success') {
          throw new HttpError(402, 'Payment was not completed. Nothing was charged.');
        }
        if (round(Number(payment.amount)) !== total) {
          throw new HttpError(409, 'Prices changed while you were paying. Please check your order and pay again.');
        }
      }
      const now = nowIso();
      const row = await one(
        `INSERT INTO orders (user_id, pickup_time, subtotal, discount, total, note, cancel_deadline, created_at, updated_at,
                             payment_status, payment_method, payment_ref, amount_paid, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 'paid', $9, $10, $5, $8) RETURNING id`,
        [
          req.user.id,
          pickup.toISOString(),
          subtotal,
          discount,
          total,
          note,
          cancelDeadline.toISOString(),
          now,
          total > 0 ? payment.method : 'credit',
          `DEMO-${randomBytes(4).toString('hex').toUpperCase()}`,
        ],
        client
      );
      await replaceOrderItems(client, row.id, lines);
      if (discount > 0) await addCredit(client, req.user.id, -discount, `Used on order ${row.id}`, row.id);
      return row.id;
    });
    res.status(201).json(await getOrder(id));
  })
);

router.get(
  '/mine',
  ah(async (req, res) => {
    res.json(await listOrders('o.user_id = $1', [req.user.id], 'o.created_at DESC'));
  })
);

// Kitchen view: everything still active, plus today's finished orders.
router.get(
  '/kitchen',
  requireRole('kitchen', 'admin'),
  ah(async (req, res) => {
    res.json(await listOrders("o.status NOT IN ('collected','cancelled') OR o.updated_at >= $1", [startOfShopDay().toISOString()], 'o.pickup_time ASC'));
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order || (order.user_id !== req.user.id && !isStaff(req.user))) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  })
);

// Customer cancels before the deadline: full refund.
router.post(
  '/:id/cancel',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found' });
    if (!USER_CANCELLABLE.includes(order.status)) {
      return res.status(403).json({ error: 'This order is already being cooked and can no longer be cancelled.' });
    }
    if (new Date() >= new Date(order.cancel_deadline)) {
      return res.status(403).json({ error: 'The free cancellation window for this order has closed.' });
    }
    await tx(async (client) => {
      const now = nowIso();
      // Guard against a double cancel racing: only the request that flips the status refunds.
      const flipped = await one(
        "UPDATE orders SET status = 'cancelled', cancelled_at = $1, cancelled_by = 'customer', updated_at = $1 WHERE id = $2 AND status = ANY($3::text[]) RETURNING id",
        [now, order.id, USER_CANCELLABLE],
        client
      );
      if (!flipped) throw new HttpError(409, 'This order has already changed. Refresh to see its status.');
      const extra = await refundOnCancel(client, order);
      if (extra.payment_status) await client.query('UPDATE orders SET payment_status = $1 WHERE id = $2', [extra.payment_status, order.id]);
    });
    res.json(await getOrder(order.id));
  })
);

// Customer rates the dishes of a collected order (1-5 stars each).
router.post(
  '/:id/ratings',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'collected') return res.status(400).json({ error: 'You can rate an order once you have collected it.' });
    const allowed = new Set(order.items.map((i) => i.menu_item_id).filter(Boolean));
    const ratings = (Array.isArray(req.body.ratings) ? req.body.ratings : []).filter(
      (r) => allowed.has(Number(r.menu_item_id)) && Number.isInteger(Number(r.stars)) && r.stars >= 1 && r.stars <= 5
    );
    if (!ratings.length) return res.status(400).json({ error: 'Choose 1 to 5 stars for at least one dish.' });
    const now = nowIso();
    for (const r of ratings) {
      await q(
        `INSERT INTO ratings (order_id, menu_item_id, user_id, stars, created_at) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (order_id, menu_item_id) DO UPDATE SET stars = EXCLUDED.stars, created_at = EXCLUDED.created_at`,
        [order.id, Number(r.menu_item_id), req.user.id, Number(r.stars), now]
      );
    }
    res.json(await getOrder(order.id));
  })
);

// Kitchen moves an order through the workflow
router.patch(
  '/:id/status',
  requireRole('kitchen', 'admin'),
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order) throw new HttpError(404, 'Order not found');
    const target = String(req.body.status || '');
    if (!KITCHEN_TRANSITIONS[order.status]?.includes(target)) {
      throw new HttpError(400, `Cannot move order from ${order.status} to ${target}`);
    }
    const now = nowIso();
    let extra = '';
    if (target === 'ready') extra = ', ready_at = $2';
    if (target === 'collected') extra = ', collected_at = $2';
    await tx(async (client) => {
      await client.query(`UPDATE orders SET status = $1, updated_at = $2${extra} WHERE id = $3`, [target, now, order.id]);
      if (target === 'collected') await rewardReferrer(client, order);
    });
    const updated = await getOrder(order.id);
    if (target === 'ready') await notifyReady(updated);
    res.json(updated);
  })
);

export default router;
