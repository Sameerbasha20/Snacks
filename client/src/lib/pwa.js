import { useEffect, useState } from 'react';

/*
  "Add to home screen" support.
  Chrome/Edge/Android fire `beforeinstallprompt` once, early, so we catch it at load and keep it.
  iPhone Safari has no prompt: we show the Share → Add to Home Screen steps instead.
*/
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    localStorage.setItem('snack_installed', '1');
    notify();
  });
}

const DISMISS_KEY = 'snack_install_dismissed';
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export function useInstall() {
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState(() => Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now());
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const installed = isStandalone() || localStorage.getItem('snack_installed') === '1';
  const mode = installed ? null : deferred ? 'prompt' : isIos() ? 'ios' : null;

  return {
    mode: dismissed ? null : mode,
    async install() {
      if (!deferred) return false;
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
    // "Not now" hides it for two weeks.
    dismiss() {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 14 * 86_400_000));
      setDismissed(true);
    },
  };
}

export function registerAppWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
