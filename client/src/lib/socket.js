import { useEffect, useRef } from 'react';
import { getToken } from './api';

/*
  Live updates by polling /api/events (serverless hosts can't keep websockets open).
  It emits the same events the pages already listen for:
    order:new      a new order (kitchen and admin)
    order:updated  any change to an order
    order:ready    an order just became ready (customer)
*/
const bus = new EventTarget();
/*
  Built to stay inside free hosting quotas: every poll is a counted request, and any poll within 5 minutes keeps
  the free database awake (it has a monthly limit of awake hours). So:
  - Customers poll only while they have an order on the go. Browsing the menu costs nothing.
  - Kitchen/admin poll every 10 s while there are orders to handle, and every 10 min when it's quiet, which lets
    the database sleep. Orders need an hour's notice, so a few minutes' delay in a quiet spell is harmless.
  The server says which case applies (`active` in /api/events). A page coming back into view always checks at once.
*/
const QUIET = null; // stop polling
const INTERVALS = {
  user: { active: { visible: 6000, hidden: 120_000 }, idle: { visible: QUIET, hidden: QUIET } },
  staff: { active: { visible: 10_000, hidden: 30_000 }, idle: { visible: 600_000, hidden: 600_000 } },
};
let active = true; // until the server tells us otherwise
let wakes = 0; // bumped by wakeSocket, so an answer to an older request can't switch polling back off
const interval = () => INTERVALS[role === 'user' ? 'user' : 'staff'][active ? 'active' : 'idle'][document.hidden ? 'hidden' : 'visible'];

let timer = null;
let since = null;
let running = false;
const seen = new Map(); // order id -> last updated_at we emitted
let role = null;

function emit(event, payload) {
  bus.dispatchEvent(new CustomEvent(event, { detail: payload }));
}

async function tick() {
  const token = getToken();
  if (!token || !running) return;
  const gen = wakes;
  try {
    const res = await fetch(`/api/events?since=${encodeURIComponent(since)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const { now, orders, active: busy } = await res.json();
      if (gen === wakes) active = busy !== false;
      for (const o of orders) {
        const prev = seen.get(o.id);
        if (prev === o.updated_at) continue; // overlap window: already handled
        seen.set(o.id, o.updated_at);
        const isNew = o.created_at === o.updated_at && o.status === 'placed';
        if (isNew && role !== 'user') emit('order:new', o);
        else emit('order:updated', o);
        if (o.status === 'ready' && o.ready_at === o.updated_at) emit('order:ready', o);
      }
      since = now;
    }
  } catch {
    /* offline for a moment; try again next tick */
  }
  schedule();
}

function schedule() {
  clearTimeout(timer);
  const ms = interval();
  if (running && ms) timer = setTimeout(tick, ms);
}

/** Something just happened that needs watching (e.g. the customer placed an order): poll now and at full speed. */
export function wakeSocket() {
  if (!running) return;
  wakes++;
  active = true;
  clearTimeout(timer);
  tick();
}

function onVisible() {
  if (!document.hidden && running) {
    clearTimeout(timer);
    tick();
  }
}

export function connectSocket(userRole) {
  disconnectSocket();
  if (!getToken()) return;
  role = userRole;
  running = true;
  since = new Date().toISOString();
  seen.clear();
  active = true;
  document.addEventListener('visibilitychange', onVisible);
  tick(); // one check up front to learn whether there's anything to watch
}

export function disconnectSocket() {
  running = false;
  clearTimeout(timer);
  document.removeEventListener('visibilitychange', onVisible);
}

/** Subscribe to an update event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const fn = (e) => ref.current(e.detail);
    bus.addEventListener(event, fn);
    return () => bus.removeEventListener(event, fn);
  }, [event]);
}
