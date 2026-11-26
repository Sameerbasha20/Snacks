import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime, money, STATUS_META } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import { StatusBadge } from '../../components/Brand';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [upcoming, setUpcoming] = useState([]);

  const load = () => {
    api('/admin/stats').then(setStats).catch(() => {});
    api('/orders/kitchen')
      .then((o) => setUpcoming(o.filter((x) => ['placed', 'accepted', 'preparing', 'cooked', 'on_the_way', 'ready'].includes(x.status)).slice(0, 6)))
      .catch(() => {});
  };
  useEffect(load, []);
  useSocketEvent('order:new', load);
  useSocketEvent('order:updated', load);

  const figures = stats
    ? [
        ['Orders today', stats.todayOrders],
        ['Takings today', money(stats.todayRevenue)],
        ['In the kitchen', stats.active],
        ['Waiting at reception', stats.ready],
      ]
    : [];

  return (
    <div>
      <h1 className="text-4xl">Today</h1>

      {/* Hairline grid: the 1px gaps show the line colour behind the cells */}
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        {!stats && <div className="shimmer col-span-full h-24" />}
        {figures.map(([label, value]) => (
          <div key={label} className="bg-paper p-5">
            <dt className="text-sm text-ink/65">{label}</dt>
            <dd className="num mt-1 text-3xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <div className="flex h-8 items-center justify-between">
            <h2 className="text-xl">Coming up</h2>
            <Link to="/kitchen" className="btn btn-quiet text-sm">
              Open kitchen screen
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-4 text-ink/65">No open orders right now.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line border-y border-line">
              {upcoming.map((o) => (
                <li key={o.id} className="flex items-center gap-4 py-3">
                  <span className="num w-20 font-bold">{fmtTime(o.pickup_time)}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="num text-muted">#{o.id}</span> {o.customer_name}
                  </span>
                  <StatusBadge meta={STATUS_META[o.status]} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="flex h-8 items-center text-xl">Best sellers</h2>
          {stats?.topItems.length === 0 && <p className="mt-4 text-ink/65">These appear once orders come in.</p>}
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {stats?.topItems.map((t, i) => (
              <li key={t.name} className="flex items-center gap-4 py-3">
                <span className="num w-5 text-muted">{i + 1}</span>
                <span className="flex-1">{t.name}</span>
                <span className="num font-semibold">{t.qty} sold</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-ink/65">{stats?.customers === 1 ? '1 customer has' : `${stats?.customers ?? 0} customers have`} signed up.</p>
        </section>
      </div>
    </div>
  );
}
