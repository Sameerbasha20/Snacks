import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import toast from 'react-hot-toast';
import { api, fmtDay, fmtTime, relative } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { chime } from '../../lib/notify';
import { useNow } from '../../components/CancelCountdown';

// The kitchen screen is dark: it runs on a tablet in a bright kitchen and must read at a glance.
const COLUMNS = [
  { id: 'new', title: 'New', statuses: ['placed', 'accepted'], empty: 'No new orders.' },
  { id: 'cooking', title: 'Cooking', statuses: ['preparing'], empty: 'Nothing on the stove.' },
  { id: 'ready', title: 'Ready for pickup', statuses: ['ready'], empty: 'Nothing waiting at the counter.' },
];

const ACTIONS = {
  placed: [
    { to: 'accepted', label: 'Accept', cls: 'border-[1.5px] border-paper/40 text-paper hover:border-paper' },
    { to: 'preparing', label: 'Start cooking', cls: 'bg-paper text-ink hover:bg-white' },
  ],
  accepted: [{ to: 'preparing', label: 'Start cooking', cls: 'bg-paper text-ink hover:bg-white' }],
  preparing: [{ to: 'ready', label: 'Mark ready', cls: 'bg-saffron text-ink hover:bg-saffron-deep' }],
  ready: [{ to: 'collected', label: 'Collected', cls: 'border-[1.5px] border-paper/40 text-paper hover:border-paper' }],
};

function OrderCard({ order, now, onMove, fresh }) {
  const minsLeft = (new Date(order.pickup_time).getTime() - now) / 60000;
  const waiting = order.status !== 'ready';
  const late = waiting && minsLeft < 0;
  const soon = waiting && !late && minsLeft < 20;

  let timing = relative(order.pickup_time, now);
  if (late) timing = `Late by ${relative(order.pickup_time, now).replace(' ago', '')}`;

  return (
    <motion.article
      layout
      layoutId={`order-${order.id}`}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      className={`relative rounded-lg bg-[#2a2723] p-4 ${order.status === 'ready' ? 'ring-2 ring-saffron' : ''} ${late ? 'ring-2 ring-paper' : ''}`}
    >
      {fresh && <motion.span className="absolute inset-0 rounded-lg bg-saffron/25" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 3 }} />}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="num text-3xl font-extrabold">#{order.id}</p>
            <p className="font-semibold text-paper/85">{order.customer_name}</p>
          </div>
          <div className="text-right">
            <p className="num text-2xl font-extrabold">{fmtTime(order.pickup_time)}</p>
            <p className={`text-sm font-semibold ${late ? 'text-saffron' : soon ? 'text-paper' : 'text-paper/55'}`}>
              {fmtDay(order.pickup_time) === 'Today' ? timing : fmtDay(order.pickup_time)}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-lg">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-3">
              <span className="num w-8 shrink-0 font-bold">{i.qty}×</span>
              <span>{i.name}</span>
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-3 rounded-md bg-paper/10 px-3 py-2 text-sm">Note: {order.note}</p>}

        <div className="mt-4 flex gap-2">
          {ACTIONS[order.status]?.map((a) => (
            <button key={a.to} onClick={() => onMove(order, a.to)} className={`btn min-h-12 flex-1 text-base ${a.cls}`}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </motion.article>
  );
}

export default function KitchenBoard() {
  const [orders, setOrders] = useState(null);
  const [fresh, setFresh] = useState(new Set());
  const now = useNow(15000);

  useEffect(() => {
    api('/orders/kitchen')
      .then(setOrders)
      .catch((e) => toast.error(e.message));
  }, []);

  const upsert = (o) =>
    setOrders((prev) => {
      if (!prev) return prev;
      return prev.some((p) => p.id === o.id) ? prev.map((p) => (p.id === o.id ? o : p)) : [...prev, o];
    });

  useSocketEvent('order:new', (o) => {
    upsert(o);
    chime('new');
    setFresh((s) => new Set(s).add(o.id));
    setTimeout(
      () =>
        setFresh((s) => {
          const n = new Set(s);
          n.delete(o.id);
          return n;
        }),
      3000
    );
    toast(`New order ${o.id} from ${o.customer_name}`);
  });
  useSocketEvent('order:updated', (o) => {
    upsert(o);
    if (o.status === 'cancelled') toast(`Order ${o.id} was cancelled`);
  });

  const move = async (order, to) => {
    upsert({ ...order, status: to }); // optimistic, so the card moves immediately
    try {
      upsert(await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: to } }));
      if (to === 'ready') toast.success(`Customer alerted: order ${order.id} is ready`);
    } catch (e) {
      upsert(order);
      toast.error(e.message);
    }
  };

  const sorted = useMemo(() => [...(orders || [])].sort((a, b) => new Date(a.pickup_time) - new Date(b.pickup_time)), [orders]);
  const done = sorted.filter((o) => ['collected', 'cancelled'].includes(o.status));

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl">Kitchen</h1>
          <p className="text-sm text-paper/55">Sorted by pickup time. Updates live.</p>
        </div>

        {!orders ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 rounded-lg bg-white/5" />
            ))}
          </div>
        ) : (
          <LayoutGroup>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {COLUMNS.map((col) => {
                const list = sorted.filter((o) => col.statuses.includes(o.status));
                return (
                  <section key={col.id} aria-label={col.title}>
                    <header className="mb-3 flex items-center justify-between border-b border-white/15 pb-2">
                      <h2 className={`text-lg ${col.id === 'ready' ? 'text-saffron' : ''}`}>{col.title}</h2>
                      <span className="num text-lg font-bold text-paper/70">{list.length}</span>
                    </header>
                    <div className="space-y-3">
                      <AnimatePresence mode="popLayout">
                        {list.map((o) => (
                          <OrderCard key={o.id} order={o} now={now} onMove={move} fresh={fresh.has(o.id)} />
                        ))}
                      </AnimatePresence>
                      {list.length === 0 && <p className="py-8 text-center text-sm text-paper/40">{col.empty}</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </LayoutGroup>
        )}

        {done.length > 0 && (
          <details className="mt-10 text-sm">
            <summary className="cursor-pointer text-paper/60">Finished today ({done.length})</summary>
            <ul className="mt-3 flex flex-wrap gap-2">
              {done.map((o) => (
                <li key={o.id}>
                  <Link to={`/orders/${o.id}`} className={`inline-block rounded-md bg-white/5 px-3 py-1.5 ${o.status === 'cancelled' ? 'text-paper/45 line-through' : ''}`}>
                    {o.id} {o.customer_name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
