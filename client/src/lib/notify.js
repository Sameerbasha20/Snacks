import { api } from './api';

const supported = () => 'serviceWorker' in navigator && 'Notification' in window;

export const notificationState = () => (supported() ? Notification.permission : 'unsupported');

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerSW() {
  if (!supported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/** Ask permission and subscribe this browser to web-push for the logged-in user. */
export async function enableNotifications() {
  if (!supported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm;
  await subscribePush();
  return perm;
}

export async function subscribePush() {
  if (!supported() || Notification.permission !== 'granted' || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await api('/push/key');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    await api('/push/subscribe', { method: 'POST', body: sub.toJSON() });
  } catch (e) {
    // Push needs HTTPS (or localhost); in-app notifications still work without it.
    console.info('Push subscription unavailable:', e.message);
  }
}

/** Show a system notification right now (used when the page is open but maybe in background). */
export async function showLocalNotification(title, body, url, tag) {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, { body, tag, renotify: true, icon: '/icon.svg', badge: '/icon.svg', data: { url }, vibrate: [200, 100, 200] });
  } catch {
    new Notification(title, { body, tag });
  }
}

let audioCtx;
/** Pleasant two-tone chime synthesised with WebAudio — no sound files needed. */
export function chime(kind = 'ready') {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'ready' ? [659.25, 783.99, 1046.5] : [880, 1174.66];
    notes.forEach((freq, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* audio blocked until user interacts — ignore */
  }
}
