import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, fmtWhen, money, STATUS_META, toLocalInput, paymentText } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';
import Modal from '../../components/Modal';
import { QtyStepper } from '../../components/CartDrawer';
import { StatusBadge } from '../../components/Brand';
import Icon from '../../components/Icon';

const FILTERS = ['all', 'placed', 'accepted', 'preparing', 'ready', 'collected', 'cancelled'];

function EditOrder({ order, onClose, onSaved }) {
  const [menu, setMenu] = useState([]);
  const [items, setItems] = useState(order.items.map((i) => ({ menu_item_id: i.menu_item_id, name: i.name, price: i.price, qty: i.qty })));
  const [pickup, setPickup] = useState(toLocalInput(order.pickup_time));
  const [deadline, setDeadline] = useState(toLocalInput(order.cancel_deadline));
  const [status, setStatus] = useState(order.status);
  const [note, setNote] = useState(order.note || '');
  const [addId, setAddId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/menu?all=1').then(setMenu).catch(() => {});
  }, []);

  const setBefore = (mins) => setDeadline(toLocalInput(new Date(new Date(pickup).getTime() - mins * 60000).toISOString()));

  const addItem = () => {
    const m = menu.find((x) => String(x.id) === addId);
    if (!m) return;
    setItems((prev) =>
      prev.some((p) => p.menu_item_id === m.id)
        ? prev.map((p) => (p.menu_item_id === m.id ? { ...p, qty: p.qty + 1 } : p))
        : [...prev, { menu_item_id: m.id, name: m.name, price: m.price, qty: 1 }]
    );
    setAddId('');
  };

  const save = async () => {
    const valid = items.filter((i) => i.menu_item_id);
    if (valid.length === 0) return toast.error('An order needs at least one item.');
    setBusy(true);
    try {
      const updated = await api(`/admin/orders/${order.id}`, {
        method: 'PUT',
        body: {
          items: valid.map((i) => ({ menu_item_id: i.menu_item_id, qty: i.qty })),
          pickup_time: new Date(pickup).toISOString(),
          cancel_deadline: new Date(deadline).toISOString(),
          status,
          note,
        },
      });
      toast.success(`Order ${order.id} saved. The customer sees the change now.`);
      onSaved(updated);
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <div className="space-y-6">
      <p className="text-ink/70">
        {order.customer_name}, {order.customer_phone || 'no phone'}, {order.customer_email}
      </p>

      <section>
        <h3 className="label">Items</h3>
        <ul className="divide-y divide-line border-y border-line">
          {items.map((i, idx) => (
            <li key={i.menu_item_id ?? `x${idx}`} className="flex items-center gap-3 py-2.5">
              <span className="flex-1">
                {i.name} {!i.menu_item_id && <em className="text-muted">(no longer on the menu)</em>}
              </span>
              <span className="num text-sm text-ink/65">{money(i.price * i.qty)}</span>
              <QtyStepper
                qty={i.qty}
                onChange={(q) => setItems((prev) => (q <= 0 ? prev.filter((_, k) => k !== idx) : prev.map((p, k) => (k === idx ? { ...p, qty: q } : p))))}
              />
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <select value={addId} onChange={(e) => setAddId(e.target.value)} className="input" aria-label="Add an item">
            <option value="">Add an item…</option>
            {menu.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}, {money(m.price)}
              </option>
            ))}
          </select>
          <button onClick={addItem} disabled={!addId} className="btn btn-outline">
            Add
          </button>
        </div>
        {(() => {
          const newTotal = Math.max(0, total - (order.discount || 0));
          const diff = order.payment_status === 'paid' ? newTotal - order.amount_paid : 0;
          return (
            <div className="num mt-3 text-right">
              {order.discount > 0 && <p className="text-sm text-ink/65">Customer credit applied: −{money(order.discount)}</p>}
              <p className="font-semibold">New total {money(newTotal)}</p>
              <p className="text-sm text-ink/65">
                {paymentText(order)}
                {diff > 0 && <>. Collect {money(diff)} more at the counter.</>}
                {diff < 0 && <>. Give back {money(-diff)} at the counter.</>}
              </p>
            </div>
          );
        })()}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Pickup time</span>
          <input type="datetime-local" className="input" value={pickup} onChange={(e) => setPickup(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.short}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="rounded-lg border border-line p-4">
        <label className="block">
          <span className="label">Customer can cancel until</span>
          <input type="datetime-local" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="self-center text-ink/65">Set to</span>
          {[
            [15, '15 min before pickup'],
            [30, '30 min before'],
            [60, '1 hour before'],
          ].map(([m, l]) => (
            <button key={m} onClick={() => setBefore(m)} className="rounded-md border border-line bg-surface px-2.5 py-1.5 font-semibold hover:border-ink">
              {l}
            </button>
          ))}
          <button onClick={() => setDeadline(toLocalInput(new Date().toISOString()))} className="rounded-md border border-line bg-surface px-2.5 py-1.5 font-semibold hover:border-ink">
            Now (no more cancelling)
          </button>
        </div>
      </section>

      <label className="block">
        <span className="label">Kitchen note</span>
        <textarea className="input resize-none" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <div className="flex gap-3">
        <button onClick={onClose} className="btn btn-outline flex-1">
          Discard
        </button>
        <button disabled={busy} onClick={save} className="btn btn-dark flex-1">
          Save changes
        </button>
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter !== 'all') params.set('status', filter);
    if (q) params.set('q', q);
    api(`/admin/orders?${params}`).then(setOrders).catch(() => setOrders([]));
  }, [filter, q]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useSocketEvent('order:new', load);
  useSocketEvent('order:updated', (o) => setOrders((prev) => prev?.map((p) => (p.id === o.id ? o : p))));

  return (
    <div>
      <h1 className="text-4xl">Orders</h1>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input sm:w-48" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f === 'all' ? 'All statuses' : STATUS_META[f].short}
            </option>
          ))}
        </select>
        <label className="relative sm:ml-auto sm:w-72">
          <Icon name="search" size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input className="input pl-9" placeholder="Name, phone or order number" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {!orders && <div className="shimmer mt-6 h-64 rounded-lg" />}
      {orders?.length === 0 && <p className="mt-10 text-ink/65">No orders match.</p>}

      {orders?.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left">
            <thead className="border-b border-ink text-sm text-ink/65">
              <tr>
                <th className="py-2 pr-4 font-semibold">Order</th>
                <th className="py-2 pr-4 font-semibold">Customer</th>
                <th className="py-2 pr-4 font-semibold">Pickup</th>
                <th className="py-2 pr-4 font-semibold">Total</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="num py-3.5 pr-4 font-bold">{o.id}</td>
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold">{o.customer_name}</p>
                    <p className="max-w-56 truncate text-sm text-ink/60">{o.items.map((it) => `${it.qty}× ${it.name}`).join(', ')}</p>
                  </td>
                  <td className="py-3.5 pr-4 text-sm">
                    <p className="num">{fmtWhen(o.pickup_time)}</p>
                    <p className="num text-ink/60">Cancel by {fmtWhen(o.cancel_deadline).split(' at ')[1]}</p>
                  </td>
                  <td className="num py-3.5 pr-4">
                    {money(o.total)}
                    <p className="text-sm whitespace-nowrap text-ink/60">{o.payment_status === 'paid' ? 'Paid online' : o.payment_status === 'refunded' ? 'Refunded' : 'At counter'}</p>
                  </td>
                  <td className="py-3.5 pr-4">
                    <StatusBadge meta={STATUS_META[o.status]} />
                  </td>
                  <td className="py-2.5 text-right">
                    <button onClick={() => setEditing(o)} className="btn btn-outline min-h-9 px-3 text-sm">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Edit order ${editing.id}` : ''} wide>
        {editing && (
          <EditOrder key={editing.id} order={editing} onClose={() => setEditing(null)} onSaved={(u) => setOrders((prev) => prev.map((p) => (p.id === u.id ? u : p)))} />
        )}
      </Modal>
    </div>
  );
}
