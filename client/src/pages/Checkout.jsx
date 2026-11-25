import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { api, fmtClock, fmtDay, fmtTime, money } from '../lib/api';
import { useCart } from '../lib/cart';
import { buildSlots, useSettings } from '../lib/slots';
import { QtyStepper } from '../components/CartDrawer';
import FoodImage from '../components/FoodImage';
import { Spinner } from '../components/AuthShell';

export default function Checkout() {
  const { items, total, setQty, clear } = useCart();
  const navigate = useNavigate();
  const settings = useSettings();
  const [dayIdx, setDayIdx] = useState(0);
  const [slot, setSlot] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const days = useMemo(() => (settings ? buildSlots(settings) : []), [settings]);
  const day = days[dayIdx];

  if (items.length === 0 && !busy) {
    return (
      <div className="mx-auto max-w-md px-4 py-24">
        <h1 className="text-4xl">Your cart is empty</h1>
        <p className="mt-3 text-ink/70">Add something from the menu, then come back here to choose a pickup time.</p>
        <Link to="/menu" className="btn btn-dark mt-8">
          Go to the menu
        </Link>
      </div>
    );
  }

  const place = async () => {
    if (!slot) return toast.error('Choose a pickup time first.');
    setBusy(true);
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: { pickup_time: slot, note, items: items.map((i) => ({ menu_item_id: i.id, qty: i.qty })) },
      });
      clear();
      navigate(`/orders/${order.id}`, { state: { justPlaced: true } });
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 pt-8 pb-32 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">
        <Link to="/menu" className="btn btn-quiet -ml-1 text-sm text-ink/70">
          Back to menu
        </Link>
        <h1 className="mt-2 text-4xl sm:text-5xl">When will you collect it?</h1>
        <p className="mt-3 max-w-lg text-ink/70">
          Times start {settings?.min_lead_minutes ?? 60} minutes from now so the kitchen can cook it fresh. You can cancel for free up to{' '}
          {settings?.default_cancel_before_minutes ?? 30} minutes before your pickup time.
        </p>

        {!settings ? (
          <div className="shimmer mt-8 h-56 rounded-xl" />
        ) : days.length === 0 ? (
          <p className="panel mt-8 p-6">There are no pickup times left. We open again at {fmtClock(settings.open_time)}.</p>
        ) : (
          <div className="mt-8">
            <div role="tablist" className="flex gap-6 border-b border-line">
              {days.map((d, i) => (
                <button
                  key={d.label}
                  role="tab"
                  aria-selected={dayIdx === i}
                  onClick={() => {
                    setDayIdx(i);
                    setSlot(null);
                  }}
                  className="relative pb-3 font-semibold whitespace-nowrap"
                >
                  <span className={dayIdx === i ? 'text-ink' : 'text-muted hover:text-ink'}>{d.label}</span>
                  {dayIdx === i && <motion.span layoutId="day-line" className="absolute inset-x-0 -bottom-px h-0.5 bg-ink" />}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={dayIdx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                role="radiogroup"
                aria-label="Pickup time"
                className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6"
              >
                {day?.slots.map((s) => {
                  const on = slot === s;
                  return (
                    <button
                      key={s}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSlot(s)}
                      className={`num h-11 rounded-lg border-[1.5px] text-[0.95rem] font-semibold transition-colors ${
                        on ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink'
                      }`}
                    >
                      {fmtTime(s)}
                    </button>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        <label className="mt-10 block max-w-lg">
          <span className="label">Notes for the kitchen (optional)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={3} className="input resize-none" placeholder="For example: less spicy, no onion" />
        </label>
      </section>

      <aside className="lg:pt-16">
        <div className="panel p-5 lg:sticky lg:top-24">
          <h2 className="text-xl">Your order</h2>
          <ul className="mt-2 divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-3">
                <FoodImage src={i.image_url} alt={i.name} className="h-11 w-11 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="num text-sm text-muted">{money(i.price * i.qty)}</p>
                </div>
                <QtyStepper qty={i.qty} onChange={(q) => setQty(i.id, q)} />
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-ink pt-4">
            <span className="font-semibold">Total</span>
            <span className="num text-2xl font-extrabold">{money(total)}</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between rounded-lg bg-paper px-3 py-2.5 text-sm">
            <span className="text-ink/70">Pickup</span>
            <span className="num font-semibold">{slot ? `${fmtDay(slot)} at ${fmtTime(slot)}` : 'Not chosen yet'}</span>
          </div>
          <button disabled={busy || !slot} onClick={place} className="btn btn-primary mt-4 w-full text-base">
            {busy ? <Spinner /> : `Place order, ${money(total)}`}
          </button>
          <p className="mt-2 text-center text-sm text-muted">You pay at the counter when you collect.</p>
        </div>
      </aside>
    </div>
  );
}
