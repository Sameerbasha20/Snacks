import { Router } from 'express';
import { getOrder, getSettings, listOrders, nowIso, one, q, tx } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';
import { notifyReady } from '../push.js';
import { startOfShopDay } from '../time.js';
import { HttpError, KITCHEN_TRANSITIONS, USER_CANCELLABLE, parseDate, priceItems, replaceOrderItems, validatePickup } from '../orderRules.js';

const router = Router();
router.use(requireAuth);

const isStaff = (u) => u.role === 'kitchen' || u.role === 'admin';

// Place an order
router.post(
  '/',
  ah(async (req, res) => {
    const settings = await getSettings();
    const pickup = parseDate(req.body.pickup_time, 'pickup time');
    validatePickup(pickup, settings);
    const note = String(req.body.note || '').trim().slice(0, 300);
    const cancelDeadline = new Date(pickup.getTime() - settings.default_cancel_before_minutes * 60_000);

    const id = await tx(async (client) => {
      const { lines, total } = await priceItems(req.body.items, { client });
      const now = nowIso();
      const row = await one(
        `INSERT INTO orders (user_id, pickup_time, total, note, cancel_deadline, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING id`,
        [req.user.id, pickup.toISOString(), total, note, cancelDeadline.toISOString(), now],
        client
      );
      await replaceOrderItems(client, row.id, lines);
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

// Customer cancels before the deadline
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
    const now = nowIso();
    await q("UPDATE orders SET status = 'cancelled', cancelled_at = $1, cancelled_by = 'customer', updated_at = $1 WHERE id = $2", [now, order.id]);
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
    await q(`UPDATE orders SET status = $1, updated_at = $2${extra} WHERE id = $3`, [target, now, order.id]);
    const updated = await getOrder(order.id);
    if (target === 'ready') await notifyReady(updated);
    res.json(updated);
  })
);

export default router;
