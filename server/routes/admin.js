import { Router } from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { config } from '../config.js';
import { getOrder, getSettings, listOrders, nowIso, one, q, setSettings, tx } from '../db.js';
import { ah, requireAuth, requireRole } from '../middleware/auth.js';
import { notifyReady } from '../push.js';
import { startOfShopDay } from '../time.js';
import { HttpError, parseDate, priceItems, replaceOrderItems } from '../orderRules.js';
import { refundOnCancel, rewardReferrer } from '../rewards.js';
import { buildReport, reportWorkbook } from '../reports.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

const STATUSES = ['placed', 'accepted', 'preparing', 'ready', 'collected', 'cancelled'];
const EDITABLE = ['pickup_time', 'cancel_deadline', 'note', 'status', 'cancelled_at', 'cancelled_by', 'ready_at', 'collected_at', 'total', 'subtotal', 'payment_status', 'updated_at'];

router.get(
  '/orders',
  ah(async (req, res) => {
    const where = [];
    const params = [];
    if (req.query.status && STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      where.push(`o.status = $${params.length}`);
    }
    if (req.query.q) {
      const term = String(req.query.q);
      params.push(`%${term}%`);
      const like = `$${params.length}`;
      params.push(term.replace('#', ''));
      where.push(`(u.name ILIKE ${like} OR u.phone ILIKE ${like} OR o.id::text = $${params.length})`);
    }
    res.json(await listOrders(where.join(' AND ') || 'TRUE', params, 'o.pickup_time DESC'));
  })
);

// Edit any part of an order, including the customer's cancel deadline.
router.put(
  '/orders/:id',
  ah(async (req, res) => {
    const order = await getOrder(req.params.id);
    if (!order) throw new HttpError(404, 'Order not found');
    const b = req.body;
    const now = nowIso();
    const fields = { updated_at: now };

    if (b.pickup_time !== undefined) fields.pickup_time = parseDate(b.pickup_time, 'pickup time').toISOString();
    if (b.cancel_deadline !== undefined) {
      fields.cancel_deadline = parseDate(b.cancel_deadline, 'cancel deadline').toISOString();
    } else if (b.cancel_before_minutes !== undefined) {
      const mins = Number(b.cancel_before_minutes);
      if (!Number.isFinite(mins) || mins < 0) throw new HttpError(400, 'Invalid cancel minutes');
      const pickup = new Date(fields.pickup_time || order.pickup_time);
      fields.cancel_deadline = new Date(pickup.getTime() - mins * 60_000).toISOString();
    }
    if (b.note !== undefined) fields.note = String(b.note).slice(0, 300);
    // Staff sent a cancelled order's UPI money back from their own app.
    if (b.refund_sent) {
      if (order.payment_status !== 'refund_due') throw new HttpError(400, 'This order has no refund waiting.');
      fields.payment_status = 'refunded';
    }
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Invalid status');
      fields.status = b.status;
      if (b.status === 'cancelled' && order.status !== 'cancelled') {
        fields.cancelled_at = now;
        fields.cancelled_by = 'admin';
      }
      if (b.status === 'ready' && order.status !== 'ready') fields.ready_at = now;
      if (b.status === 'collected' && order.status !== 'collected') fields.collected_at = now;
    }

    await tx(async (client) => {
      if (b.items !== undefined) {
        const { lines, total } = await priceItems(b.items, { allowUnavailable: true, client });
        await replaceOrderItems(client, order.id, lines);
        // Credit already applied stays applied; any difference from what was paid is settled at the counter.
        fields.subtotal = total;
        fields.total = Math.max(0, Math.round((total - (order.discount || 0)) * 100) / 100);
      }
      if (fields.status === 'cancelled' && order.status !== 'cancelled') Object.assign(fields, await refundOnCancel(client, order));
      if (fields.status === 'collected' && order.status !== 'collected') await rewardReferrer(client, order);
      const keys = Object.keys(fields).filter((k) => EDITABLE.includes(k));
      await client.query(`UPDATE orders SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE id = $${keys.length + 1}`, [
        ...keys.map((k) => fields[k]),
        order.id,
      ]);
    });

    const updated = await getOrder(order.id);
    if (fields.status === 'ready' && order.status !== 'ready') await notifyReady(updated);
    res.json(updated);
  })
);

router.get(
  '/stats',
  ah(async (req, res) => {
    const since = startOfShopDay().toISOString();
    const [today, revenue, active, ready, customers, topItems] = await Promise.all([
      one('SELECT COUNT(*)::int AS c FROM orders WHERE created_at >= $1', [since]),
      one("SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE created_at >= $1 AND status != 'cancelled'", [since]),
      one("SELECT COUNT(*)::int AS c FROM orders WHERE status IN ('placed','accepted','preparing')"),
      one("SELECT COUNT(*)::int AS c FROM orders WHERE status = 'ready'"),
      one("SELECT COUNT(*)::int AS c FROM users WHERE role = 'user'"),
      q(`SELECT oi.name_snapshot AS name, SUM(oi.qty)::int AS qty FROM order_items oi
         JOIN orders o ON o.id = oi.order_id WHERE o.status != 'cancelled'
         GROUP BY oi.name_snapshot ORDER BY qty DESC LIMIT 5`),
    ]);
    res.json({
      todayOrders: today.c,
      todayRevenue: revenue.s,
      active: active.c,
      ready: ready.c,
      customers: customers.c,
      topItems,
    });
  })
);

router.get('/settings', ah(async (req, res) => res.json(await getSettings())));
router.put(
  '/settings',
  ah(async (req, res) => {
    const b = req.body;
    const t = /^\d{2}:\d{2}$/;
    if (b.open_time && !t.test(b.open_time)) return res.status(400).json({ error: 'Invalid opening time' });
    if (b.close_time && !t.test(b.close_time)) return res.status(400).json({ error: 'Invalid closing time' });
    for (const k of ['min_lead_minutes', 'default_cancel_before_minutes', 'referral_amount']) {
      if (b[k] !== undefined && (!Number.isFinite(Number(b[k])) || Number(b[k]) < 0)) {
        return res.status(400).json({ error: `Invalid ${k.replaceAll('_', ' ')}` });
      }
    }
    if (b.upi_id !== undefined) {
      b.upi_id = String(b.upi_id).trim();
      if (!/^[\w.-]{2,256}@[a-zA-Z][\w.-]{1,64}$/.test(b.upi_id)) {
        return res.status(400).json({ error: 'That UPI ID looks wrong. It should look like name@bank, for example 98xxxxxx@ibl.' });
      }
    }
    if (b.upi_name !== undefined) b.upi_name = String(b.upi_name).trim().slice(0, 50);
    res.json(await setSettings(b));
  })
);

// Staff accounts
router.get(
  '/users',
  ah(async (req, res) => {
    const role = ['user', 'kitchen', 'admin'].includes(req.query.role) ? req.query.role : null;
    res.json(
      await q(`SELECT id, name, email, phone, role, created_at FROM users ${role ? 'WHERE role = $1' : ''} ORDER BY role, name`, role ? [role] : [])
    );
  })
);

router.post(
  '/users',
  ah(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    const role = req.body.role;
    if (!['kitchen', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be kitchen or admin' });
    if (!name || !email.includes('@') || password.length < 6) {
      return res.status(400).json({ error: 'Name, a valid email and a password of 6+ characters are required' });
    }
    if (await one('SELECT 1 FROM users WHERE email = $1', [email])) return res.status(409).json({ error: 'That email is already in use' });
    const row = await one('INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
      name,
      email,
      phone,
      bcrypt.hashSync(password, 10),
      role,
      nowIso(),
    ]);
    res.status(201).json({ id: row.id, name, email, phone, role });
  })
);

router.delete(
  '/users/:id',
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: "You can't remove your own account" });
    const u = await one('SELECT role FROM users WHERE id = $1', [id]);
    if (!u) return res.status(404).json({ error: 'User not found' });
    if (u.role === 'user') return res.status(400).json({ error: 'Only staff accounts can be removed here' });
    await q('DELETE FROM users WHERE id = $1', [id]);
    res.json({ ok: true });
  })
);

// Sales reports for a range of shop dates (YYYY-MM-DD, inclusive), by pickup time.
const reportRange = (req) => {
  const d = /^\d{4}-\d{2}-\d{2}$/;
  if (!d.test(req.query.from || '') || !d.test(req.query.to || '')) throw new HttpError(400, 'Choose a start and end date');
  if (req.query.from > req.query.to) throw new HttpError(400, 'The start date is after the end date');
  return [req.query.from, req.query.to];
};

router.get(
  '/reports',
  ah(async (req, res) => {
    res.json(await buildReport(...reportRange(req)));
  })
);

router.get(
  '/reports.xlsx',
  ah(async (req, res) => {
    const [from, to] = reportRange(req);
    const wb = await reportWorkbook(await buildReport(from, to, { withOrders: true }));
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="snack-shack-sales-${from}-to-${to}.xlsx"`);
    res.send(Buffer.from(await wb.xlsx.writeBuffer()));
  })
);

router.get(
  '/qr',
  ah(async (req, res) => {
    const url = String(req.query.url || config.publicUrl);
    const dataUrl = await QRCode.toDataURL(url, { width: 600, margin: 1, color: { dark: '#1C1A17', light: '#FFFFFF' }, errorCorrectionLevel: 'H' });
    res.json({ url, dataUrl, shop_name: (await getSettings()).shop_name });
  })
);

export default router;
