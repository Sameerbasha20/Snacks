import { useEffect, useState } from 'react';
import { api, fmtDay } from './api';

const STEP = 15 * 60_000;

const atTime = (base, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Valid 15-minute pickup slots for today and the next two days, grouped by day. */
export function buildSlots(settings, now = Date.now()) {
  const earliest = Math.ceil((now + settings.min_lead_minutes * 60_000) / STEP) * STEP;
  const days = [];
  for (let offset = 0; offset < 3; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const open = atTime(day, settings.open_time).getTime();
    const close = atTime(day, settings.close_time).getTime();
    const slots = [];
    for (let t = Math.max(open, earliest); t <= close; t += STEP) slots.push(new Date(t).toISOString());
    if (slots.length) days.push({ label: fmtDay(slots[0]), slots });
  }
  return days;
}

let cache;
/** Shop settings (opening hours, lead time). Cached for the session. */
export function useSettings() {
  const [s, setS] = useState(cache);
  useEffect(() => {
    if (cache) return;
    api('/settings')
      .then((d) => {
        cache = d;
        setS(d);
      })
      .catch(() => {});
  }, []);
  return s;
}

/** The earliest slot a customer could pick right now; refreshes every 30 s. */
export function useEarliestPickup() {
  const settings = useSettings();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!settings) return { settings, slot: null };
  const days = buildSlots(settings, now);
  return { settings, slot: days[0]?.slots[0] ?? null };
}
