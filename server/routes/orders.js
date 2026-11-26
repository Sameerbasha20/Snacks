import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { getOrder, getSettings, listOrders, nowIso, one, q, tx } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';
import { notifyReady } from '../push.js';
import { startOfShopDay } from '../time.js';
import { HttpError, STATUS_STAMPS, USER_CANCELLABLE, allowedNext, parseDate, priceItems, replaceOrderItems, validatePickup } from '../orderRules.js';
import { addCredit, creditBalance, refundOnCancel, rewardReferrer } from '../rewards.js';

const router = Router();
router.use(requireAuth);

const isStaff = (u) => ['kitchen', 'admin', 'delivery'].includes(u.role);
const round = (n) => Math.round(n * 100) / 100;

/*
 * Payment is direct UPI to the shop's own UPI ID, confirmed by staff (no gateway, so nothing tells us automatically):
 *   awaiting  -> customer has not paid yet (order saved, kitchen waits)
 *   verifying -> customer says they paid and gave the UTR; staff check their UPI app
 *   paid      -> staff confirmed, kitchen can cook
 *   refund_due / refunded -> cancelled after paying; staff send the money back by hand
 *   failed    -> staff found no payment and cancelled the order
 *   void      -> cancelled before paying
 * Older orders may be 'unpaid' (pay at the counter).
 */
export const PAYABLE = ['awaiting', 'verifying'];
const UTR = /^\d{12}$/;

/** upi://pay link: on a phone this opens the list of installed UPI apps with the amount filled in. */
function upiLink(settings, order) {
  const p = new URLSearchParams({
    pa: settings.upi_id,
    pn: settings.upi_name || settings.shop_name,
    am: Number(order.total).toFixed(2),
    cu: 'INR',
    tn: `${settings.shop_name} order ${order.id}`,
  });
  // Spaces as %20 and a literal @: some UPI apps don't decode + or %40 in these links.
  return `upi://pay?${p.toString().replaceAll('+', '%20').replaceAll('%40', '@')}`;
}

// Place an order. It waits for UPI payment unless store credit covers all of it.
router.post(
  '/',
  ah(async (req, res) => {
    const settings = await getSettings();
    const pickup = parseDate(req.body.pickup_time, 'pickup time');
    validatePickup(pickup, settings);
    const note = String(req.body.note || '').trim().slice(0, 300);
    const cancelDeadline = new Date(pickup.getTime() - settings.default_cancel_before_minutes * 60_000);

    const id = await tx(async (client) => {
      const { lines, total: subtotal } = await priceItems(req.body.items, { client });
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]); // one checkout at a time per customer
      // Unpaid orders sit on the kitchen screen, so cap how many one customer can leave waiting.
      const pending = await one("SELECT COUNT(*)::int AS n FROM orders WHERE user_id = $1 AND status <> 'cancelled' AND payment_status = ANY($2::text[])", [req.user.id, PAYABLE], client);
      if (pending.n >= 3) throw new HttpError(429, 'You have 3 orders waiting for payment. Pay for or cancel one of them first.');
      const balance = req.body.use_credit ? await creditBalance(req.user.id, client) : 0;
      const discount = round(Math.min(balance, subtotal));
      const total = round(subtotal - discount);

      if (req.body.expected_total !== undefined && round(Number(req.body.expected_total)) !== total) {
        throw new HttpError(409, 'Prices changed while you were ordering. Please check your order total and try again.');
      }
      const now = nowIso();
      const paidNow = total === 0;
      const row = await one(
        `INSERT INTO orders (user_id, pickup_time, subtotal, discount, total, note, cancel_deadline, created_at, updated_at,
                             payment_status, payment_method, payment_ref, amount_paid, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, $10, NULL, 0, $11) RETURNING id`,
        [
          req.user.id,
          pickup.toISOString(),
          subtotal,
          discount,
          total,
          note,
          cancelDeadline.toISOString(),
          now,
          paidNow ? 'paid' : 'awaiting',
          paidNow ? 'credit' : 'upi',
          paidNow ? now : null,
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

// Delivery partner's view: what's cooking next, what's waiting at the kitchen, on the way, at reception; plus today's handovers.
router.get(
  '/delivery',
  requireRole('delivery', 'admin'),
  ah(async (req, res) => {
    const orders = await listOrders(
      "o.status IN ('preparing','cooked','on_the_way','ready') OR (o.status = 'collected' AND o.updated_at >= $1)",
      [startOfShopDay().toISOString()],
      'o.pickup_time ASC'
    );
    // Delivery only needs a name and phone to hand food over at reception.
    res.json(orders.map(({ customer_email, ...o }) => o));
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

// What the customer needs to pay: the UPI link and a QR of it for paying from another device.
router.get(
  '/:id/upi',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found' });
    if (!PAYABLE.includes(order.payment_status) || order.status === 'cancelled') {
      return res.status(400).json({ error: 'This order does not need paying.' });
    }
    const settings = await getSettings();
    const link = upiLink(settings, order);
    const qr = await QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#1C1A17', light: '#FFFFFF' } });
    res.json({ link, qr, upi_id: settings.upi_id, upi_name: settings.upi_name || settings.shop_name, amount: order.total, demo: settings.demo_payments });
  })
);

// Customer says they've paid and gives the 12-digit UTR from their UPI app, so staff can find it.
router.post(
  '/:id/payment-sent',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found' });
    if (!PAYABLE.includes(order.payment_status) || order.status === 'cancelled') {
      return res.status(400).json({ error: 'This order does not need paying.' });
    }
    const utr = String(req.body.utr || '').replace(/\s/g, '');
    if (!UTR.test(utr)) {
      return res.status(400).json({ error: 'Enter the 12-digit UTR (also called UPI reference or transaction ID) from your UPI app.' });
    }
    if (await one('SELECT 1 FROM orders WHERE payment_ref = $1 AND id <> $2', [utr, order.id])) {
      return res.status(409).json({ error: 'That UTR is already used on another order. Check you copied the one for this payment.' });
    }
    const flipped = await one(
      "UPDATE orders SET payment_status = 'verifying', payment_ref = $1, updated_at = $2 WHERE id = $3 AND payment_status = ANY($4::text[]) AND status <> 'cancelled' RETURNING id",
      [utr, nowIso(), order.id, PAYABLE]
    );
    if (!flipped) throw new HttpError(409, 'This order has already changed. Refresh to see its status.');
    res.json(await getOrder(order.id));
  })
);

// Demo payment (only while switched on in Settings): marks the order paid with no money taken.
// Recorded as payment_method 'demo' so staff screens and reports can tell it apart from real UPI.
router.post(
  '/:id/demo-pay',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found' });
    if (!(await getSettings()).demo_payments) return res.status(403).json({ error: 'Demo payments are switched off. Please pay by UPI.' });
    if (!PAYABLE.includes(order.payment_status) || order.status === 'cancelled') {
      return res.status(400).json({ error: 'This order does not need paying.' });
    }
    const now = nowIso();
    const ok = await one(
      "UPDATE orders SET payment_status = 'paid', payment_method = 'demo', payment_ref = $1, amount_paid = total, paid_at = $2, updated_at = $2 WHERE id = $3 AND payment_status = ANY($4::text[]) AND status <> 'cancelled' RETURNING id",
      [`DEMO-${randomBytes(4).toString('hex').toUpperCase()}`, now, order.id, PAYABLE]
    );
    if (!ok) throw new HttpError(409, 'This order has already changed. Refresh to see its status.');
    res.json(await getOrder(order.id));
  })
);

// Staff check their UPI app: confirm the money arrived, or cancel the order if it never came.
router.post(
  '/:id/payment',
  requireRole('kitchen', 'admin'),
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order) throw new HttpError(404, 'Order not found');
    const action = req.body.action;
    if (!['confirm', 'reject'].includes(action)) throw new HttpError(400, 'Action must be confirm or reject');
    const gone = 'This payment has already been dealt with. Refresh to see the order.';
    if (!PAYABLE.includes(order.payment_status) || order.status === 'cancelled') throw new HttpError(409, gone);
    const now = nowIso();
    await tx(async (client) => {
      if (action === 'confirm') {
        const ok = await one(
          "UPDATE orders SET payment_status = 'paid', amount_paid = total, paid_at = $1, updated_at = $1 WHERE id = $2 AND payment_status = ANY($3::text[]) AND status <> 'cancelled' RETURNING id",
          [now, order.id, PAYABLE],
          client
        );
        if (!ok) throw new HttpError(409, gone);
      } else {
        const ok = await one(
          "UPDATE orders SET status = 'cancelled', cancelled_at = $1, cancelled_by = $2, payment_status = 'failed', updated_at = $1 WHERE id = $3 AND payment_status = ANY($4::text[]) AND status <> 'cancelled' RETURNING id",
          [now, req.user.role, order.id, PAYABLE],
          client
        );
        if (!ok) throw new HttpError(409, gone);
        if (order.discount > 0) {
          await addCredit(client, order.user_id, order.discount, `Credit returned from cancelled order ${order.id}`, order.id);
        }
      }
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

// Kitchen and delivery move an order through the workflow (each role only its own steps).
router.patch(
  '/:id/status',
  requireRole('kitchen', 'admin', 'delivery'),
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order) throw new HttpError(404, 'Order not found');
    const target = String(req.body.status || '');
    if (!allowedNext(req.user.role, order.status).includes(target)) {
      throw new HttpError(400, `Cannot move order from ${order.status} to ${target}`);
    }
    if (order.status === 'placed' && PAYABLE.includes(order.payment_status)) {
      throw new HttpError(409, 'Confirm the UPI payment before you start cooking this order.');
    }
    const now = nowIso();
    const stamp = STATUS_STAMPS[target];
    const sets = ['status = $1', 'updated_at = $2'];
    const params = [target, now, order.id, order.status];
    if (stamp?.at) sets.push(`${stamp.at} = $2`);
    if (stamp?.by) {
      params.push(req.user.id);
      sets.push(`${stamp.by} = $${params.length}`);
    }
    await tx(async (client) => {
      // Only moves if nobody else moved it first (two partners tapping "Picked up" at once).
      const moved = await one(`UPDATE orders SET ${sets.join(', ')} WHERE id = $3 AND status = $4 RETURNING id`, params, client);
      if (!moved) throw new HttpError(409, 'Someone else just updated this order. Refresh to see where it is.');
      if (target === 'collected') await rewardReferrer(client, order);
    });
    const updated = await getOrder(order.id);
    if (target === 'ready') await notifyReady(updated);
    res.json(updated);
  })
);

export default router;
