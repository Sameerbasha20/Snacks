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
const VISIBLE_MS = 4000;
const HIDDEN_MS = 15000;

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
  try {
    const res = await fetch(`/api/events?since=${encodeURIComponent(since)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const { now, orders } = await res.json();
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
  if (running) timer = setTimeout(tick, document.hidden ? HIDDEN_MS : VISIBLE_MS);
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
  document.addEventListener('visibilitychange', onVisible);
  timer = setTimeout(tick, VISIBLE_MS);
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
