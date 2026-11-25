import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtWhen, money, STATUS_META } from '../lib/api';
import { useSocketEvent } from '../lib/socket';
import { StatusBadge } from '../components/Brand';
import Icon from '../components/Icon';

function OrderRow({ o }) {
  const summary = o.items.map((i) => `${i.qty}× ${i.name}`).join(', ');
  return (
    <li>
      <Link to={`/orders/${o.id}`} className="group flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold">Order {o.id}</span>
            <StatusBadge meta={STATUS_META[o.status]} />
          </div>
          <p className="mt-1 truncate text-sm text-ink/65">{summary}</p>
          <p className="mt-0.5 text-sm text-ink/65">Pickup {fmtWhen(o.pickup_time).toLowerCase()}</p>
        </div>
        <span className="num font-semibold">{money(o.total)}</span>
        <Icon name="arrow" size={18} className="text-muted transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState(null);

  useEffect(() => {
    api('/orders/mine').then(setOrders).catch(() => setOrders([]));
  }, []);

  const upsert = (o) => setOrders((prev) => prev?.map((p) => (p.id === o.id ? o : p)) ?? prev);
  useSocketEvent('order:updated', upsert);
  useSocketEvent('order:ready', upsert);

  const active = orders?.filter((o) => ['placed', 'accepted', 'preparing', 'ready'].includes(o.status)) ?? [];
  const past = orders?.filter((o) => !active.includes(o)) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-32 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">My orders</h1>
      {!orders && <div className="shimmer mt-8 h-40 rounded-xl" />}
      {orders?.length === 0 && (
        <div className="mt-10">
          <p className="text-ink/70">You haven't ordered anything yet.</p>
          <Link to="/menu" className="btn btn-dark mt-5">
            Go to the menu
          </Link>
        </div>
      )}
      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl">In progress</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {active.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl">Earlier</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {past.map((o) => (
              <OrderRow key={o.id} o={o} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
