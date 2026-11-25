import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { api, CATEGORY_LABEL, fmtDay, fmtTime, money } from '../lib/api';
import { useCart } from '../lib/cart';
import { useSocketEvent } from '../lib/socket';
import { useEarliestPickup } from '../lib/slots';
import { CartPanel, QtyStepper } from '../components/CartDrawer';
import FoodImage from '../components/FoodImage';
import Icon from '../components/Icon';

const ORDER = ['snacks', 'food', 'drinks'];

function MenuRow({ item }) {
  const { qtyOf, add, setQty } = useCart();
  const qty = qtyOf(item.id);

  return (
    <li className="flex gap-4 py-5">
      <FoodImage src={item.image_url} alt={item.name} className="h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight">{item.name}</h3>
          <span className="num shrink-0 font-semibold">{money(item.price)}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[0.95rem] text-ink/65">{item.description}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-sm text-muted">Ready in about {item.prep_minutes} min</span>
          <div className="h-10">
            <AnimatePresence mode="popLayout" initial={false}>
              {qty === 0 ? (
                <motion.button
                  key="add"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => add(item)}
                  className="btn btn-outline min-h-10 px-4"
                  aria-label={`Add ${item.name}`}
                >
                  Add
                </motion.button>
              ) : (
                <motion.div key="qty" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.15 }}>
                  <QtyStepper qty={qty} onChange={(q) => setQty(item.id, q)} dark />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function Menu() {
  const navigate = useNavigate();
  const { count, total, setOpen } = useCart();
  const { slot } = useEarliestPickup();
  const [menu, setMenu] = useState(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState('snacks');
  const sectionRefs = useRef({});

  const load = () => api('/menu').then(setMenu).catch(() => setMenu([]));
  useEffect(() => {
    load();
  }, []);
  useSocketEvent('menu:changed', load);

  const groups = useMemo(() => {
    if (!menu) return [];
    const needle = q.trim().toLowerCase();
    return ORDER.map((c) => ({
      id: c,
      items: menu.filter((m) => m.category === c && (!needle || `${m.name} ${m.description}`.toLowerCase().includes(needle))),
    })).filter((g) => g.items.length);
  }, [menu, q]);

  // Highlight the category currently in view
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.dataset.cat);
      },
      { rootMargin: '-120px 0px -60% 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [groups]);

  const jump = (id) => {
    const el = sectionRefs.current[id];
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 128, behavior: 'smooth' });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-40 sm:px-6 lg:pb-16">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-4xl sm:text-5xl">Menu</h1>
        {slot && (
          <p className="text-ink/70">
            Earliest pickup <span className="num font-semibold text-ink">{fmtTime(slot)}</span> {fmtDay(slot).toLowerCase()}
          </p>
        )}
      </div>

      <div className="sticky top-16 z-20 -mx-4 mt-6 border-b border-line bg-paper/95 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-6">
          <nav className="flex gap-6" aria-label="Menu sections">
            {ORDER.map((c) => (
              <button key={c} onClick={() => jump(c)} className="relative py-3.5 font-semibold">
                <span className={active === c ? 'text-ink' : 'text-muted hover:text-ink'}>{CATEGORY_LABEL[c]}</span>
                {active === c && <motion.span layoutId="cat-line" className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" />}
              </button>
            ))}
          </nav>
          <label className="relative ml-auto hidden w-64 sm:block">
            <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input min-h-10 py-2 pl-9" aria-label="Search the menu" />
          </label>
        </div>
      </div>

      <div className="mt-2 grid gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <label className="relative mt-4 block sm:hidden">
            <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the menu" className="input pl-9" />
          </label>

          {!menu &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-5">
                <div className="shimmer h-24 w-24 rounded-lg sm:h-28 sm:w-28" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="shimmer h-5 w-1/2 rounded" />
                  <div className="shimmer h-4 w-3/4 rounded" />
                </div>
              </div>
            ))}

          {groups.map((g) => (
            <section key={g.id} data-cat={g.id} ref={(el) => (sectionRefs.current[g.id] = el)} className="pt-8">
              <h2 className="text-2xl">{CATEGORY_LABEL[g.id]}</h2>
              <ul className="divide-y divide-line">
                {g.items.map((item) => (
                  <MenuRow key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ))}
          {menu && groups.length === 0 && <p className="py-16 text-ink/70">Nothing matches “{q}”. Try a different word.</p>}
        </div>

        <aside className="hidden lg:block">
          <div className="panel sticky top-36 p-5">
            <h2 className="text-xl">Your order</h2>
            <CartPanel onCheckout={() => navigate('/checkout')} />
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {count > 0 && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={() => setOpen(true)}
            className="fixed inset-x-3 bottom-[4.25rem] z-30 flex items-center justify-between rounded-xl bg-ink px-5 py-4 text-paper shadow-xl lg:hidden"
          >
            <span className="num font-semibold">
              {count} {count === 1 ? 'item' : 'items'}, {money(total)}
            </span>
            <span className="font-bold text-saffron">View cart</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
