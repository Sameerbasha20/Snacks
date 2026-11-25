import ExcelJS from 'exceljs';
import { getSettings, listOrders } from './db.js';
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
  const totals = { orders: 0, revenue: 0, items: 0, cancelled: 0, credit_used: 0, customers: new Set() };

  for (const o of orders) {
    const day = days.get(shopDateKey(new Date(o.pickup_time)));
    if (!day) continue;
    if (o.status === 'cancelled') {
      day.cancelled++;
      totals.cancelled++;
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
    },
    days: [...days.values()].map((d) => ({ ...d, revenue: round(d.revenue) })),
    hours: [...hours.values()].sort((a, b) => a.hour - b.hour).map((h) => ({ ...h, revenue: round(h.revenue) })),
    best_sellers: [...dishes.values()]
      .map(({ ratingSum, ...d }) => ({ ...d, revenue: round(d.revenue), avg_rating: d.ratings ? round(ratingSum / d.ratings) : null }))
      .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue),
  };
  if (withOrders) report.orders = orders;
  return report;
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
