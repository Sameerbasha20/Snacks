import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from './api';

/**
 * Put a past order's dishes back in the cart at today's prices.
 * Items that are sold out or gone from the menu are skipped, and the customer is told.
 */
export function reorder(order, menu, cart) {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const skipped = [];
  let added = 0;
  for (const line of order.items) {
    const item = byId.get(line.menu_item_id);
    if (!item) {
      skipped.push(line.name);
      continue;
    }
    cart.setQty(item.id, cart.qtyOf(item.id) + line.qty, item);
    added += line.qty;
  }
  if (skipped.length) toast(`${skipped.join(', ')} ${skipped.length === 1 ? "isn't" : "aren't"} available right now, so we left ${skipped.length === 1 ? 'it' : 'them'} out.`);
  if (added) cart.setOpen(true);
  else toast.error('None of those dishes are available right now.');
  return added;
}

/** The customer's favourite dish ids, with optimistic toggling. */
export function useFavorites() {
  const [ids, setIds] = useState(() => new Set());
  useEffect(() => {
    api('/me/favorites')
      .then((list) => setIds(new Set(list)))
      .catch(() => {});
  }, []);
  const toggle = useCallback(
    async (item) => {
      const on = !ids.has(item.id);
      setIds((prev) => {
        const next = new Set(prev);
        on ? next.add(item.id) : next.delete(item.id);
        return next;
      });
      try {
        await api(`/me/favorites/${item.id}`, { method: on ? 'PUT' : 'DELETE' });
      } catch {
        toast.error("Couldn't save that. Try again.");
        setIds((prev) => {
          const next = new Set(prev);
          on ? next.delete(item.id) : next.add(item.id);
          return next;
        });
      }
    },
    [ids]
  );
  return { ids, toggle };
}
