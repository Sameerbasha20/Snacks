import { getSettings, nowIso, one } from './db.js';

/** Store credit is a ledger: + for referral rewards and refunds, - when spent on an order. */
export async function creditBalance(userId, client) {
  const r = await one('SELECT COALESCE(SUM(amount), 0) AS b FROM credit_ledger WHERE user_id = $1', [userId], client);
  return Math.max(0, Math.round(r.b * 100) / 100);
}

export async function addCredit(client, userId, amount, reason, orderId = null) {
  if (!amount) return;
  await client.query('INSERT INTO credit_ledger (user_id, amount, reason, order_id, created_at) VALUES ($1, $2, $3, $4, $5)', [
    userId,
    amount,
    reason,
    orderId,
    nowIso(),
  ]);
}

/**
 * Cancelling an order refunds it: the (demo) payment is marked refunded and any credit used goes back.
 * Returns the columns to set on the order.
 */
export async function refundOnCancel(client, order) {
  if (order.discount > 0) await addCredit(client, order.user_id, order.discount, `Credit returned from cancelled order ${order.id}`, order.id);
  return order.payment_status === 'paid' ? { payment_status: 'refunded' } : {};
}

/** The person who referred this customer earns credit when the customer collects their first order. */
export async function rewardReferrer(client, order) {
  const u = await one('SELECT name, referred_by, referral_rewarded FROM users WHERE id = $1 FOR UPDATE', [order.user_id], client);
  if (!u?.referred_by || u.referral_rewarded) return;
  const { referral_amount } = await getSettings();
  await addCredit(client, u.referred_by, referral_amount, `${u.name.split(' ')[0]} collected their first order`, order.id);
  await client.query('UPDATE users SET referral_rewarded = TRUE WHERE id = $1', [order.user_id]);
}
