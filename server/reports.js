import ExcelJS from 'exceljs';
import { getSettings, listOrders, q } from './db.js';
import { HttpError } from './orderRules.js';
import { nextDateKey, shopDateKey, shopDayStartFromKey, shopHour, SHOP_TZ } from './time.js';

const round = (n) => Math.round(n * 100) / 100;

/**
 * Sales between two shop-local dates (inclusive), grouped by pickup time,
 * because that is when the food is cooked and handed over. Cancelled orders are counted separately, not as sales.
 */
export async function buildReport(from, to, { withOrders = false } = {}) {
  const start = shopDayStartFromKey(from);
  const end = shopDayStartFromKey(nextDateKey(to));
  if (end - start > 366 * 86_400_000) throw new HttpError(400, 'Choose a range of one year or less');

  const [orders, settings] = await Promise.all([
    listOrders('o.pickup_time >= $1 AND o.pickup_time < $2', [start.toISOString(), end.toISOString()], 'o.pickup_time ASC'),
    getSettings(),
  ]);

  const days = new Map();
  for (let k = from; k <= to; k = nextDateKey(k)) days.set(k, { date: k, orders: 0, revenue: 0, items: 0, cancelled: 0 });
  const hours = new Map();
  const dishes = new Map();
  const totals = { orders: 0, revenue: 0, items: 0, cancelled: 0, credit_used: 0, customers: new Set(), demo_orders: 0, demo_value: 0 };

  for (const o of orders) {
    const day = days.get(shopDateKey(new Date(o.pickup_time)));
    if (!day) continue;
    if (o.status === 'cancelled') {
      day.cancelled++;
      totals.cancelled++;
      continue;
    }
    // Demo payments brought in no money: keep them out of sales, count them separately.
    if (o.payment_method === 'demo') {
      totals.demo_orders++;
      totals.demo_value += o.total;
      continue;
    }
    const qty = o.items.reduce((s, i) => s + i.qty, 0);
    day.orders++;
    day.revenue += o.total;
    day.items += qty;
    totals.orders++;
    totals.revenue += o.total;
    totals.items += qty;
    totals.credit_used += o.discount || 0;
    totals.customers.add(o.user_id);

    const h = shopHour(new Date(o.pickup_time));
    const hour = hours.get(h) || { hour: h, orders: 0, revenue: 0 };
    hour.orders++;
    hour.revenue += o.total;
    hours.set(h, hour);

    for (const i of o.items) {
      const key = i.menu_item_id ?? `name:${i.name}`;
      const d = dishes.get(key) || { menu_item_id: i.menu_item_id, name: i.name, qty: 0, revenue: 0, ratingSum: 0, ratings: 0 };
      d.qty += i.qty;
      d.revenue += i.price * i.qty;
      if (i.rating) {
        d.ratingSum += i.rating;
        d.ratings++;
      }
      dishes.set(key, d);
    }
  }

  // Every opening hour appears, so quiet hours show as zero rather than vanishing.
  const openH = Number(settings.open_time.split(':')[0]);
  const closeH = Number(settings.close_time.split(':')[0]);
  for (let h = openH; h <= closeH; h++) if (!hours.has(h)) hours.set(h, { hour: h, orders: 0, revenue: 0 });

  const report = {
    from,
    to,
    timezone: SHOP_TZ,
    totals: {
      orders: totals.orders,
      revenue: round(totals.revenue),
      items: totals.items,
      cancelled: totals.cancelled,
      credit_used: round(totals.credit_used),
      customers: totals.customers.size,
      avg_order: totals.orders ? round(totals.revenue / totals.orders) : 0,
      demo_orders: totals.demo_orders,
      demo_value: round(totals.demo_value),
    },
    days: [...days.values()].map((d) => ({ ...d, revenue: round(d.revenue) })),
    hours: [...hours.values()].sort((a, b) => a.hour - b.hour).map((h) => ({ ...h, revenue: round(h.revenue) })),
    best_sellers: [...dishes.values()]
      .map(({ ratingSum, ...d }) => ({ ...d, revenue: round(d.revenue), avg_rating: d.ratings ? round(ratingSum / d.ratings) : null }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue),
  };
  report.sla = await deliverySla(orders, settings);
  if (withOrders) report.orders = orders;
  return report;
}

const mins = (a, b) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
const avg = (list) => (list.length ? round(list.reduce((a, b) => a + b, 0) / list.length) : null);

/**
 * Delivery SLA for orders that went kitchen -> delivery partner -> reception.
 *   pickup:   partner collects within sla_pickup_minutes of the kitchen marking it cooked
 *   delivery: at reception within sla_delivery_minutes of being picked up
 *   promise:  at reception by the customer's chosen pickup time
 */
async function deliverySla(orders, settings) {
  const target = { pickup: settings.sla_pickup_minutes, delivery: settings.sla_delivery_minutes };
  const names = new Map((await q("SELECT id, name FROM users WHERE role IN ('delivery','admin')")).map((u) => [u.id, u.name]));
  const done = orders.filter((o) => o.status !== 'cancelled' && o.cooked_at && o.picked_up_at && o.ready_at);
  const people = new Map();
  const late = [];
  let pickupOk = 0;
  let deliveryOk = 0;
  let promiseOk = 0;
  const pickups = [];
  const drives = [];
  for (const o of done) {
    const p = mins(o.cooked_at, o.picked_up_at);
    const d = mins(o.picked_up_at, o.ready_at);
    const onTime = new Date(o.ready_at) <= new Date(o.pickup_time);
    pickups.push(p);
    drives.push(d);
    if (p <= target.pickup) pickupOk++;
    if (d <= target.delivery) deliveryOk++;
    if (onTime) promiseOk++;
    const who = o.picked_up_by ?? o.delivered_by;
    const row = people.get(who) || { name: names.get(who) || 'Unknown', deliveries: 0, pickups: [], drives: [], onTime: 0 };
    row.deliveries++;
    row.pickups.push(p);
    row.drives.push(d);
    if (onTime) row.onTime++;
    people.set(who, row);
    if (p > target.pickup || d > target.delivery || !onTime) {
      late.push({
        id: o.id,
        pickup_time: o.pickup_time,
        ready_at: o.ready_at,
        pickup_minutes: round(p),
        delivery_minutes: round(d),
        minutes_late: onTime ? 0 : round(mins(o.pickup_time, o.ready_at)),
        partner: row.name,
      });
    }
  }
  return {
    targets: target,
    delivered: done.length,
    pickup_within_target_pct: pct(pickupOk, done.length),
    delivery_within_target_pct: pct(deliveryOk, done.length),
    at_reception_on_time_pct: pct(promiseOk, done.length),
    avg_pickup_minutes: avg(pickups),
    avg_delivery_minutes: avg(drives),
    partners: [...people.values()]
      .map((r) => ({ name: r.name, deliveries: r.deliveries, avg_pickup_minutes: avg(r.pickups), avg_delivery_minutes: avg(r.drives), on_time_pct: pct(r.onTime, r.deliveries) }))
      .sort((a, b) => b.deliveries - a.deliveries),
    late: late.sort((a, b) => b.minutes_late - a.minutes_late || b.delivery_minutes - a.delivery_minutes).slice(0, 50),
  };
}

const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
const RUPEES = '"₹"#,##0.00';

function sheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(([header, key, width, numFmt]) => ({ header, key, width, style: numFmt ? { numFmt } : {} }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F1EA' } };
  ws.addRows(rows);
  return ws;
}

export async function reportWorkbook(r) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Snack Shack';
  wb.created = new Date();

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 18 }];
  summary.addRows([
    ['Snack Shack sales report'],
    ['From', r.from],
    ['To', r.to],
    ['Grouped by', `Pickup time (${r.timezone})`],
    [],
    ['Orders', r.totals.orders],
    ['Revenue', r.totals.revenue],
    ['Average order', r.totals.avg_order],
    ['Items sold', r.totals.items],
    ['Customers', r.totals.customers],
    ['Cancelled orders', r.totals.cancelled],
    ['Referral credit used', r.totals.credit_used],
    ['Demo-payment orders (not in revenue)', r.totals.demo_orders],
  ]);
  summary.getRow(1).font = { bold: true, size: 14 };
  for (const n of [7, 8, 12]) summary.getCell(`B${n}`).numFmt = RUPEES;

  sheet(wb, 'Daily', [['Date', 'date', 14], ['Orders', 'orders', 10], ['Items', 'items', 10], ['Revenue', 'revenue', 14, RUPEES], ['Cancelled', 'cancelled', 12]], r.days);
  sheet(
    wb,
    'Best sellers',
    [['Dish', 'name', 30], ['Qty sold', 'qty', 10], ['Revenue', 'revenue', 14, RUPEES], ['Avg rating', 'avg_rating', 12], ['Ratings', 'ratings', 10]],
    r.best_sellers
  );
  sheet(
    wb,
    'Peak hours',
    [['Hour', 'label', 10], ['Orders', 'orders', 10], ['Revenue', 'revenue', 14, RUPEES]],
    r.hours.map((h) => ({ ...h, label: hourLabel(h.hour) }))
  );
  if (r.sla) {
    const t = r.sla.targets;
    const ws = wb.addWorksheet('Delivery SLA');
    ws.columns = [{ width: 44 }, { width: 16 }];
    ws.addRows([
      ['Delivery SLA'],
      [`Pickup target: within ${t.pickup} min of cooking`],
      [`Delivery target: at reception within ${t.delivery} min of pickup`],
      [],
      ['Orders delivered to reception', r.sla.delivered],
      ['Picked up within target (%)', r.sla.pickup_within_target_pct],
      ['Delivered within target (%)', r.sla.delivery_within_target_pct],
      ["At reception by the customer's time (%)", r.sla.at_reception_on_time_pct],
      ['Average minutes to pick up', r.sla.avg_pickup_minutes],
      ['Average minutes kitchen to reception', r.sla.avg_delivery_minutes],
    ]);
    ws.getRow(1).font = { bold: true, size: 14 };
    sheet(
      wb,
      'SLA by partner',
      [['Delivery partner', 'name', 24], ['Deliveries', 'deliveries', 12], ['Avg pickup (min)', 'avg_pickup_minutes', 16], ['Avg delivery (min)', 'avg_delivery_minutes', 18], ['On time (%)', 'on_time_pct', 12]],
      r.sla.partners
    );
    sheet(
      wb,
      'Late deliveries',
      [['Order', 'id', 8], ['Customer time', 'due', 20], ['At reception', 'arrived', 20], ['Pickup (min)', 'pickup_minutes', 12], ['Delivery (min)', 'delivery_minutes', 14], ['Minutes late', 'minutes_late', 13], ['Partner', 'partner', 20]],
      r.sla.late.map((l) => ({
        ...l,
        due: new Date(l.pickup_time).toLocaleString('en-IN', { timeZone: r.timezone, dateStyle: 'medium', timeStyle: 'short' }),
        arrived: new Date(l.ready_at).toLocaleString('en-IN', { timeZone: r.timezone, dateStyle: 'medium', timeStyle: 'short' }),
      }))
    );
  }
  if (r.orders) {
    sheet(
      wb,
      'Orders',
      [
        ['Order', 'id', 8],
        ['Pickup', 'pickup', 20],
        ['Customer', 'customer_name', 20],
        ['Phone', 'customer_phone', 14],
        ['Items', 'items', 50],
        ['Status', 'status', 12],
        ['Payment', 'payment_status', 12],
        ['Subtotal', 'subtotal', 12, RUPEES],
        ['Credit', 'discount', 10, RUPEES],
        ['Total', 'total', 12, RUPEES],
      ],
      r.orders.map((o) => ({
        ...o,
        pickup: new Date(o.pickup_time).toLocaleString('en-IN', { timeZone: r.timezone, dateStyle: 'medium', timeStyle: 'short' }),
        items: o.items.map((i) => `${i.qty}× ${i.name}`).join(', '),
        subtotal: o.subtotal ?? o.total,
      }))
    );
  }
  return wb;
}
