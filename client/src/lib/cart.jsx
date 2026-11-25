import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartCtx = createContext(null);
const KEY = 'snack_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => localStorage.setItem(KEY, JSON.stringify(items)), [items]);

  const add = useCallback((item) => {
    setItems((prev) => {
      const ex = prev.find((p) => p.id === item.id);
      if (ex) return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { id: item.id, name: item.name, price: item.price, image_url: item.image_url, emoji: item.emoji, qty: 1 }];
    });
  }, []);

  const setQty = useCallback((id, qty) => {
    setItems((prev) => (qty <= 0 ? prev.filter((p) => p.id !== id) : prev.map((p) => (p.id === id ? { ...p, qty } : p))));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const total = items.reduce((s, i) => s + i.qty * i.price, 0);
    const qtyOf = (id) => items.find((i) => i.id === id)?.qty || 0;
    return { items, count, total, qtyOf, add, setQty, clear, open, setOpen };
  }, [items, add, setQty, clear, open]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
