import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { api, fmtTime } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useSocketEvent, wakeSocket } from '../../lib/socket';
import { chime } from '../../lib/notify';
import { useSettings } from '../../lib/slots';
import { useNow } from '../../components/CancelCountdown';

/*
  Delivery partner's screen (used on a phone). The kitchen is away from the office:
  cooked -> "Picked up" -> on the way -> "Delivered to reception" -> ready -> "Handed to customer" -> collected.
  Each card shows its SLA: pick up within N minutes of cooking, reach reception within M minutes of pickup.
*/

const minsSince = (iso, now) => (iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : 0);

/** "6 min left" / "3 min over" against an SLA target, coloured when it's late. */
function SlaClock({ startedAt, target, now, verb }) {
  const used = minsSince(startedAt, now);
  const left = target - used;
  const over = left < 0;
  return (
    <p className={`text-sm font-semibold ${over ? 'text-saffron-deep' : 'text-ink/70'}`}>
      {verb} {used} min ago. {over ? `${-left} min over the ${target}-min target` : `${left} min left of ${target}`}
    </p>
  );
}

function Card({ order, children, highlight }) {
  const count = order.items.reduce((s, i) => s + i.qty, 0);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      className={`rounded-xl border-[1.5px] bg-surface p-4 ${highlight ? 'border-saffron' : 'border-line'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-3xl leading-none font-extrabold">#{order.id}</p>
          <p className="mt-1 font-semibold">{order.customer_name}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-ink/60">Customer comes at</p>
          <p className="num text-xl font-extrabold">{fmtTime(order.pickup_time)}</p>
        </div>
      </div>
      <p className="mt-2 text-sm text-ink/70">
        {count} {count === 1 ? 'item' : 'items'}: {order.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
      </p>
      {order.note && <p className="mt-1 text-sm text-ink/70">Note: {order.note}</p>}
      {children}
    </motion.li>
  );
}

function Section({ title, hint, list, empty, children }) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-2">
        <h2 className="text-xl">{title}</h2>
        <span className="num font-bold">{list.length}</span>
      </div>
      {hint && <p className="mt-2 text-sm text-ink/60">{hint}</p>}
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          <AnimatePresence initial={false}>{list.map(children)}</AnimatePresence>
        </ul>
      )}
    </section>
  );
}

export default function DeliveryBoard() {
  const { user } = useAuth();
  const settings = useSettings();
  const now = useNow(15_000);
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(null);
  const sla = { pickup: settings?.sla_pickup_minutes ?? 10, delivery: settings?.sla_delivery_minutes ?? 15 };

  const load = () =>
    api('/orders/delivery')
      .then(setOrders)
      .catch((e) => toast.error(e.message));
  useEffect(() => {
    load();
  }, []);

  const upsert = (o) =>
    setOrders((prev) => {
      if (!prev) return prev;
      return prev.some((p) => p.id === o.id) ? prev.map((p) => (p.id === o.id ? o : p)) : [...prev, o];
    });

  useSocketEvent('order:updated', (o) => {
    const before = orders?.find((p) => p.id === o.id);
    upsert(o);
    if (o.status === 'cooked' && before?.status !== 'cooked') {
      chime('new');
      toast(`Order ${o.id} is cooked. Pick it up from the kitchen.`);
    }
  });

  const move = async (order, to, done) => {
    setBusy(order.id);
    try {
      upsert(await api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: to } }));
      toast.success(done);
    } catch (e) {
      toast.error(e.message);
      load();
    } finally {
      setBusy(null);
    }
  };

  const by = useMemo(() => {
    const g = { preparing: [], cooked: [], on_the_way: [], ready: [], collected: [] };
    for (const o of [...(orders || [])].sort((a, b) => new Date(a.pickup_time) - new Date(b.pickup_time))) g[o.status]?.push(o);
    return g;
  }, [orders]);

  // Today's score: share of handovers that met both targets and reached reception by the customer's time.
  const today = useMemo(() => {
    const delivered = [...by.ready, ...by.collected].filter((o) => o.cooked_at && o.picked_up_at && o.ready_at);
    const ok = delivered.filter(
      (o) =>
        minsSince(o.cooked_at, new Date(o.picked_up_at).getTime()) <= sla.pickup &&
        minsSince(o.picked_up_at, new Date(o.ready_at).getTime()) <= sla.delivery &&
        new Date(o.ready_at) <= new Date(o.pickup_time)
    );
    return { delivered: delivered.length, ok: ok.length };
  }, [by, sla.pickup, sla.delivery]);

  const btn = 'btn mt-4 min-h-12 w-full text-base';

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-28">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl">Deliveries</h1>
          <p className="mt-1 text-sm text-ink/65">
            Pick up within {sla.pickup} min of cooking. Reach reception within {sla.delivery} min of pickup.
          </p>
        </div>
        <button onClick={() => wakeSocket()} className="btn btn-outline min-h-10 shrink-0 px-3 text-sm">
          Check now
        </button>
      </div>

      {orders && (
        <p className="mt-4 rounded-lg bg-surface px-4 py-3 text-sm">
          Today: <span className="num font-bold">{today.delivered}</span> delivered to reception
          {today.delivered > 0 && (
            <>
              , <span className="num font-bold">{Math.round((today.ok / today.delivered) * 100)}%</span> within target
            </>
          )}
          .
        </p>
      )}

      {!orders ? (
        <div className="mt-8 space-y-3">
          <div className="shimmer h-32 rounded-xl" />
          <div className="shimmer h-32 rounded-xl" />
        </div>
      ) : (
        <>
          <Section title="Pick up from the kitchen" list={by.cooked} empty="Nothing cooked and waiting.">
            {(o) => (
              <Card key={o.id} order={o} highlight={minsSince(o.cooked_at, now) > sla.pickup}>
                <SlaClock startedAt={o.cooked_at} target={sla.pickup} now={now} verb="Cooked" />
                <button disabled={busy === o.id} onClick={() => move(o, 'on_the_way', `Order ${o.id} picked up`)} className={`${btn} btn-primary`}>
                  Picked up
                </button>
              </Card>
            )}
          </Section>

          <Section title="On the way to reception" list={by.on_the_way} empty="Nothing on the way.">
            {(o) => (
              <Card key={o.id} order={o} highlight={minsSince(o.picked_up_at, now) > sla.delivery}>
                <SlaClock startedAt={o.picked_up_at} target={sla.delivery} now={now} verb={o.picked_up_by === user?.id ? 'You picked it up' : 'Picked up'} />
                <button disabled={busy === o.id} onClick={() => move(o, 'ready', `Order ${o.id} is at reception. The customer has been told.`)} className={`${btn} btn-dark`}>
                  Delivered to reception
                </button>
              </Card>
            )}
          </Section>

          <Section title="At reception" hint="Waiting for the customer. Hand it over when they show their order number." list={by.ready} empty="Nothing waiting at reception.">
            {(o) => (
              <Card key={o.id} order={o}>
                <p className="text-sm text-ink/70">
                  Arrived {minsSince(o.ready_at, now)} min ago
                  {o.customer_phone && (
                    <>
                      .{' '}
                      <a href={`tel:${o.customer_phone}`} className="font-semibold text-ink underline underline-offset-4">
                        Call {o.customer_name.split(' ')[0]}
                      </a>
                    </>
                  )}
                </p>
                <button disabled={busy === o.id} onClick={() => move(o, 'collected', `Order ${o.id} handed over`)} className={`${btn} btn-outline`}>
                  Handed to customer
                </button>
              </Card>
            )}
          </Section>

          <Section title="Cooking now" hint="Coming up next. You'll get a sound and a message when one is cooked." list={by.preparing} empty="Nothing on the stove.">
            {(o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm">
                <span className="min-w-0 truncate">
                  <span className="num font-bold">#{o.id}</span> {o.customer_name}
                </span>
                <span className="shrink-0 text-right text-ink/65">
                  Leave kitchen by <span className="num font-semibold text-ink">{fmtTime(new Date(new Date(o.pickup_time).getTime() - sla.delivery * 60000).toISOString())}</span>
                </span>
              </li>
            )}
          </Section>

          {by.collected.length > 0 && (
            <details className="mt-8 text-sm">
              <summary className="cursor-pointer text-ink/60">Handed over today ({by.collected.length})</summary>
              <ul className="mt-3 flex flex-wrap gap-2">
                {by.collected.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`} className="inline-block rounded-md bg-surface px-3 py-1.5">
                      {o.id} {o.customer_name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
