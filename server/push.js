import webpush from 'web-push';
import { config } from './config.js';
import { q } from './db.js';

webpush.setVapidDetails(config.vapidSubject, config.vapidPublic, config.vapidPrivate);

async function sendPush(userId, payload) {
  const subs = await q('SELECT id, endpoint, keys_json FROM push_subscriptions WHERE user_id = $1', [userId]);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys_json) }, JSON.stringify(payload), { TTL: 3600 });
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) await q('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
        else console.error('push failed', e.statusCode, e.message);
      }
    })
  );
}

/**
 * Phone/browser notification when food is ready.
 * Awaited by the caller: on serverless hosts work after the response may never run.
 */
export async function notifyReady(order) {
  try {
    await sendPush(order.user_id, {
      title: `Order ${order.id} is ready`,
      body: 'Collect it from reception.',
      url: `/orders/${order.id}`,
      tag: `order-${order.id}`,
    });
  } catch (e) {
    console.error('notifyReady failed', e.message);
  }
}
