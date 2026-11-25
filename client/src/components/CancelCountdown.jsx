import { useEffect, useState } from 'react';

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}

/** "28 min left" style countdown text. */
export function timeLeft(deadline, now) {
  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const mins = Math.ceil(ms / 60_000);
  if (mins >= 60) return `${Math.floor(mins / 60)} h ${mins % 60} min left`;
  return `${mins} min left`;
}
