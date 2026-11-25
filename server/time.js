// Servers (e.g. Vercel) run in UTC; the shop's opening hours and "today" are in the shop's own timezone.
export const SHOP_TZ = process.env.SHOP_TZ || 'Asia/Kolkata';

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SHOP_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function parts(date) {
  const o = {};
  for (const p of fmt.formatToParts(date)) o[p.type] = Number(p.value);
  return o;
}

/** Minutes since midnight in the shop's timezone. */
export function shopMinutesOfDay(date) {
  const p = parts(date);
  return p.hour * 60 + p.minute;
}

/** The instant the current shop-local day began. */
export function startOfShopDay(date = new Date()) {
  const p = parts(date);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const offsetMs = wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
  return new Date(Date.UTC(p.year, p.month - 1, p.day) - offsetMs);
}
