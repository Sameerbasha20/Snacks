import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api, download, money } from '../../lib/api';
import { RatingBadge } from '../../components/Stars';
import Icon from '../../components/Icon';
import { Spinner } from '../../components/AuthShell';

const BAR = '#C9601D'; // saffron-deep: passes 3:1 against the panel surface (validated)
const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtDate = (k, opts = { day: 'numeric', month: 'short' }) => new Date(`${k}T12:00:00`).toLocaleDateString('en-IN', opts);
const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;

const PRESETS = [
  ['Today', () => [new Date(), new Date()]],
  ['Last 7 days', () => [addDays(new Date(), -6), new Date()]],
  ['Last 30 days', () => [addDays(new Date(), -29), new Date()]],
  ['This month', () => [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()]],
];

/** Round a max value up to a tidy axis top (1, 2, 2.5, 5 × 10^n). */
function niceMax(v, integer = false) {
  if (v <= 0) return integer ? 2 : 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= v);
  // Counts: keep the halfway tick a whole number.
  return integer ? Math.max(2, Math.ceil(m / 2) * 2) : m;
}

/**
 * Single-series vertical bars with a hover/focus tooltip, recessive grid, and the peak labelled directly.
 * Every bar is a button so the tooltip also works from the keyboard.
 */
function BarChart({ data, value, xLabel, tip, format, labelEvery = 1, title, integer = false }) {
  const [active, setActive] = useState(null);
  const max = niceMax(Math.max(...data.map(value), 0), integer);
  const peak = data.reduce((best, d, i) => (value(d) > value(data[best] ?? d) ? i : best), 0);
  const ticks = [max, max / 2, 0];
  return (
    <figure className="mt-4">
      <div className="relative flex h-52 gap-3" onMouseLeave={() => setActive(null)}>
        <div className="num flex w-12 shrink-0 flex-col justify-between pb-6 text-right text-xs text-muted" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 last:translate-y-1/2">
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between" aria-hidden="true">
            <span className="border-t border-line" />
            <span className="border-t border-dashed border-line" />
            <span className="border-t border-ink/40" />
          </div>
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const v = value(d);
              const h = (v / max) * 100;
              return (
                <button
                  key={i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={tip(d).join(', ')}
                  className="group relative flex h-full min-w-0 flex-1 items-end focus:outline-none"
                >
                  {i === peak && v > 0 && (
                    <span className="num absolute left-1/2 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-ink" style={{ bottom: `calc(${h}% + 4px)` }}>
                      {format(v)}
                    </span>
                  )}
                  <span
                    className={`block w-full rounded-t-[4px] transition-opacity ${active !== null && active !== i ? 'opacity-45' : ''} group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink`}
                    style={{ height: v > 0 ? `max(${h}%, 2px)` : 0, background: BAR }}
                  />
                </button>
              );
            })}
          </div>
          {/* x labels */}
          <div className="absolute inset-x-0 bottom-0 flex h-5 gap-[2px]" aria-hidden="true">
            {data.map((d, i) => (
              <span key={i} className="num min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap text-muted">
                {i % labelEvery === 0 ? xLabel(d) : ''}
              </span>
            ))}
          </div>
          {active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 rounded-lg bg-ink px-3 py-2 text-sm whitespace-nowrap text-paper shadow-lg"
              style={(() => {
                // Keep the tooltip inside the chart near either edge.
                const x = (active + 0.5) / data.length;
                return { left: `${x * 100}%`, transform: `translateX(${x < 0.15 ? '-10%' : x > 0.85 ? '-90%' : '-50%'})` };
              })()}
            >
              {tip(data[active]).map((line, j) => (
                <p key={j} className={j === 0 ? 'font-semibold' : 'num text-paper/80'}>
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
      <figcaption className="sr-only">{title}</figcaption>
    </figure>
  );
}

function DataTable({ head, rows }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-ink/65 hover:text-ink">Show as a table</summary>
      <table className="num mt-2 w-full text-left">
        <thead className="border-b border-ink text-ink/65">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`py-1.5 font-semibold ${i ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`py-1.5 ${j ? 'text-right' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export default function Reports() {
  const [range, setRange] = useState(() => PRESETS[1][1]().map(key));
  const [preset, setPreset] = useState('Last 7 days');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [from, to] = range;

  useEffect(() => {
    setError('');
    api(`/admin/reports?from=${from}&to=${to}`)
      .then(setReport)
      .catch((e) => setError(e.message));
  }, [from, to]);

  const t = report?.totals;
  const days = report?.days ?? [];
  const activeHours = useMemo(() => report?.hours ?? [], [report]);
  const topQty = report?.best_sellers[0]?.qty || 1;

  const exportExcel = async () => {
    setDownloading(true);
    try {
      await download(`/admin/reports.xlsx?from=${from}&to=${to}`, `snack-shack-sales-${from}-to-${to}.xlsx`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Sales reports</h1>
          <p className="mt-1 text-ink/65">Counted by pickup time. Cancelled orders are left out of sales.</p>
        </div>
        <button onClick={exportExcel} disabled={downloading || !report} className="btn btn-dark">
          {downloading ? <Spinner /> : <Icon name="download" size={16} />} Download Excel
        </button>
      </div>

      {/* Filters: one row above everything they affect */}
      <div className="mt-6 flex flex-wrap items-end gap-x-5 gap-y-3 border-y border-line py-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Date range">
          {PRESETS.map(([label, fn]) => (
            <button
              key={label}
              onClick={() => {
                setPreset(label);
                setRange(fn().map(key));
              }}
              aria-pressed={preset === label}
              className={`btn min-h-9 px-3 text-sm ${preset === label ? 'bg-ink text-paper' : 'btn-quiet text-ink/70'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 text-sm">
          <label>
            <span className="sr-only">From</span>
            <input
              type="date"
              className="input min-h-9 py-1.5 text-sm"
              value={from}
              max={to}
              onChange={(e) => {
                setPreset('');
                setRange([e.target.value, to]);
              }}
            />
          </label>
          <span className="pb-2 text-muted">to</span>
          <label>
            <span className="sr-only">To</span>
            <input
              type="date"
              className="input min-h-9 py-1.5 text-sm"
              value={to}
              min={from}
              onChange={(e) => {
                setPreset('');
                setRange([from, e.target.value]);
              }}
            />
          </label>
        </div>
      </div>

      {error && <p className="mt-6 text-ink/75">{error}</p>}
      {!report && !error && <div className="shimmer mt-6 h-72 rounded-lg" />}

      {report && (
        <>
          <dl className="mt-6 grid grid-cols-2 border-t border-l border-line sm:grid-cols-3 lg:grid-cols-5">
            {[
              ['Revenue', money(t.revenue)],
              ['Orders', t.orders],
              ['Average order', money(t.avg_order)],
              ['Items sold', t.items],
              ['Cancelled', t.cancelled],
            ].map(([label, v]) => (
              <div key={label} className="border-r border-b border-line p-4">
                <dt className="text-sm text-ink/65">{label}</dt>
                <dd className="num mt-1 text-2xl font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
          {t.credit_used > 0 && <p className="mt-2 text-sm text-ink/65">Includes {money(t.credit_used)} paid with referral credit.</p>}

          {t.orders === 0 ? (
            <p className="mt-10 text-ink/70">No sales in these dates yet. Try a longer range.</p>
          ) : (
            <>
              <section className="mt-10">
                <h2 className="text-xl">Revenue by day</h2>
                {days.length === 1 ? (
                  <p className="mt-2 text-ink/70">
                    {fmtDate(days[0].date, { weekday: 'long', day: 'numeric', month: 'long' })}: {money(days[0].revenue)} from {days[0].orders} orders.
                  </p>
                ) : (
                  <BarChart
                    title="Revenue by day"
                    data={days}
                    value={(d) => d.revenue}
                    format={money}
                    xLabel={(d) => fmtDate(d.date)}
                    labelEvery={Math.ceil(days.length / 7)}
                    tip={(d) => [fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), `${money(d.revenue)}`, `${d.orders} orders, ${d.items} items`]}
                  />
                )}
                <DataTable head={['Date', 'Orders', 'Items', 'Revenue', 'Cancelled']} rows={days.map((d) => [fmtDate(d.date), d.orders, d.items, money(d.revenue), d.cancelled])} />
              </section>

              <section className="mt-10">
                <h2 className="text-xl">Busiest pickup hours</h2>
                <p className="mt-1 text-sm text-ink/65">Orders collected in each hour. Plan staff and prep for the tall bars.</p>
                <BarChart
                  title="Orders by pickup hour"
                  integer
                  data={activeHours}
                  value={(h) => h.orders}
                  format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}
                  xLabel={(h) => hourLabel(h.hour)}
                  labelEvery={activeHours.length > 10 ? 2 : 1}
                  tip={(h) => [`${hourLabel(h.hour)} to ${hourLabel((h.hour + 1) % 24)}`, `${h.orders} orders`, money(h.revenue)]}
                />
                <DataTable head={['Hour', 'Orders', 'Revenue']} rows={activeHours.map((h) => [hourLabel(h.hour), h.orders, money(h.revenue)])} />
              </section>

              <section className="mt-10">
                <h2 className="text-xl">Best sellers</h2>
                <table className="mt-3 w-full text-left">
                  <thead className="border-b border-ink text-sm text-ink/65">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Dish</th>
                      <th className="w-2/5 py-2 pr-3 font-semibold">Sold</th>
                      <th className="py-2 pr-3 text-right font-semibold">Revenue</th>
                      <th className="hidden py-2 text-right font-semibold sm:table-cell">Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {report.best_sellers.map((d) => (
                      <tr key={d.name}>
                        <td className="py-3 pr-3 font-semibold">{d.name}</td>
                        <td className="py-3 pr-3">
                          <span className="flex items-center gap-2">
                            <span className="h-2 rounded-r-[4px]" style={{ width: `${Math.max(4, (d.qty / topQty) * 100)}%`, background: BAR }} />
                            <span className="num text-sm">{d.qty}</span>
                          </span>
                        </td>
                        <td className="num py-3 pr-3 text-right">{money(d.revenue)}</td>
                        <td className="hidden py-3 text-right sm:table-cell">
                          {d.ratings ? <RatingBadge avg={d.avg_rating} count={d.ratings} /> : <span className="text-sm text-muted">No ratings</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
