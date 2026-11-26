import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import toast from 'react-hot-toast';
import { api, fmtDay, fmtTime, money, PAYMENT_PENDING, relative } from '../../lib/api';
import { useSocketEvent, wakeSocket } from '../../lib/socket';
import { chime } from '../../lib/notify';
import { useNow } from '../../components/CancelCountdown';
import { useSettings } from '../../lib/slots';

// The kitchen screen is dark: it runs on a tablet in a bright kitchen and must read at a glance.
const COLUMNS = [
  { id: 'new', title: 'New', statuses: ['placed', 'accepted'], empty: 'No new orders.' },
  { id: 'cooking', title: 'Cooking', statuses: ['preparing'], empty: 'Nothing on the stove.' },
  { id: 'cooked', title: 'Waiting for delivery pickup', statuses: ['cooked'], empty: 'Nothing waiting to be picked up.' },
];

const ACTIONS = {
  placed: [
    { to: 'accepted', label: 'Accept', cls: 'border-[1.5px] border-paper/40 text-paper hover:border-paper' },
    { to: 'preparing', label: 'Start cooking', cls: 'bg-paper text-ink hover:bg-white' },
  ],
  accepted: [{ to: 'preparing', label: 'Start cooking', cls: 'bg-paper text-ink hover:bg-white' }],
  preparing: [{ to: 'cooked', label: 'Cooked, ready for pickup', cls: 'bg-saffron text-ink hover:bg-saffron-deep' }],
};

function OrderCard({ order, now, onMove, onPayment, fresh, sla }) {
  const unpaid = order.status !== 'cancelled' && PAYMENT_PENDING.includes(order.payment_status);
  const cooked = order.status === 'cooked';
  // Food must reach reception by the customer's time, so it has to be cooked early enough for pickup and the trip.
  const cookBy = new Date(new Date(order.pickup_time).getTime() - (sla.pickup + sla.delivery) * 60000).toISOString();
  const minsLeft = (new Date(cookBy).getTime() - now) / 60000;
  const waitingMins = cooked && order.cooked_at ? Math.floor((now - new Date(order.cooked_at).getTime()) / 60000) : 0;
  const late = cooked ? waitingMins > sla.pickup : minsLeft < 0;
  const soon = !cooked && !late && minsLeft < 20;

  let timing = cooked ? `Cooked ${waitingMins} min ago` : `Cook by ${fmtTime(cookBy)}, ${relative(cookBy, now)}`;
  if (late && !cooked) timing = `Cook by ${fmtTime(cookBy)}, late by ${relative(cookBy, now).replace(' ago', '')}`;
  if (late && cooked) timing = `Waiting ${waitingMins} min, pickup target is ${sla.pickup}`;

  return (
    <motion.article
      layout
      layoutId={`order-${order.id}`}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      className={`relative rounded-lg bg-[#2a2723] p-4 ${late ? 'ring-2 ring-saffron' : ''}`}
    >
      {fresh && <motion.span className="absolute inset-0 rounded-lg bg-saffron/25" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 3 }} />}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="num text-3xl font-extrabold">#{order.id}</p>
            <p className="font-semibold text-paper/85">{order.customer_name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-paper/55">At reception by</p>
            <p className="num text-2xl leading-tight font-extrabold">{fmtTime(order.pickup_time)}</p>
            <p className={`text-sm font-semibold ${late ? 'text-saffron' : soon ? 'text-paper' : 'text-paper/55'}`}>
              {fmtDay(order.pickup_time) === 'Today' ? timing : fmtDay(order.pickup_time)}
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-lg">
          {order.items.map((i) => (
            <li key={i.id} className="flex gap-3">
              <span className="num w-8 shrink-0 font-bold">{i.qty}×</span>
              <span>
                {i.name}
                {i.detail && <span className="block text-base text-paper/60">{i.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
        {order.note && <p className="mt-3 rounded-md bg-paper/10 px-3 py-2 text-sm">Note: {order.note}</p>}
        {order.payment_method === 'demo' && order.payment_status === 'paid' && (
          <p className="mt-3 rounded-md border border-paper/30 px-3 py-2 text-sm font-semibold">DEMO payment: no money was received for this order.</p>
        )}

        {unpaid ? (
          <div className="mt-4 rounded-md border border-saffron/60 p-3">
            {order.payment_status === 'verifying' ? (
              <p>
                Customer paid <span className="num font-bold">{money(order.total)}</span>, UTR{' '}
                <span className="num font-bold tracking-wide">{order.payment_ref?.replace(/(\d{4})(?=\d)/g, '$1 ')}</span>. Check your UPI app.
              </p>
            ) : (
              <p>
                Waiting for UPI payment of <span className="num font-bold">{money(order.total)}</span>.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => onPayment(order, 'confirm')} className="btn min-h-12 flex-[2_1_8rem] bg-paper text-base text-ink hover:bg-white">
                Payment received
              </button>
              <button onClick={() => onPayment(order, 'reject')} className="btn min-h-12 flex-[1_1_7rem] border-[1.5px] border-paper/40 text-base text-paper hover:border-paper">
                Not received
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          {!unpaid && ACTIONS[order.status]?.map((a) => (
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
  const settings = useSettings();
  const sla = { pickup: settings?.sla_pickup_minutes ?? 10, delivery: settings?.sla_delivery_minutes ?? 15 };

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
    const before = orders?.find((p) => p.id === o.id);
    upsert(o);
    if (o.status === 'cancelled' && before?.status !== 'cancelled') toast(`Order ${o.id} was cancelled`);
    if (o.payment_status === 'verifying' && before?.payment_status !== 'verifying') {
      chime('new');
      toast(`Order ${o.id}: customer says they paid. Check the UTR.`);
    }
  });

  const payment = async (order, action) => {
    if (
      action === 'reject' &&
      !window.confirm(`Cancel order ${order.id}? Only do this if ${money(order.total)} hasn't arrived in your UPI app. The customer will be told.`)
    ) {
      return;
    }
    try {
      upsert(await api(`/orders/${order.id}/payment`, { method: 'POST', body: { action } }));
      toast.success(action === 'confirm' ? `Order ${order.id} is paid. You can start cooking.` : `Order ${order.id} cancelled`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const move = async (order, to) => {
    upsert({ ...order, status: to }); // optimistic, so the card moves immediately
    try {
      upsert(await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: to } }));
      if (to === 'cooked') toast.success(`Order ${order.id} is waiting for the delivery partner`);
    } catch (e) {
      upsert(order);
      toast.error(e.message);
    }
  };

  const sorted = useMemo(() => [...(orders || [])].sort((a, b) => new Date(a.pickup_time) - new Date(b.pickup_time)), [orders]);
  // Everything that has left the kitchen (or was cancelled) goes in the finished list.
  const done = sorted.filter((o) => ['on_the_way', 'ready', 'collected', 'cancelled'].includes(o.status));

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-28 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl">Kitchen</h1>
          <div className="flex items-baseline gap-3 text-sm text-paper/55">
            <p className="hidden sm:block">Sorted by pickup time. Checks every 10 seconds while busy, every 10 minutes when quiet.</p>
            <button onClick={() => wakeSocket()} className="btn min-h-9 shrink-0 border-[1.5px] border-paper/30 px-3 text-sm text-paper hover:border-paper">
              Check now
            </button>
          </div>
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
                          <OrderCard key={o.id} order={o} now={now} sla={sla} onMove={move} onPayment={payment} fresh={fresh.has(o.id)} />
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
