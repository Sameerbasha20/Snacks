import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { api, fmtTime, fmtWhen, money, relative, STATUS_META } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useSocketEvent } from '../lib/socket';
import StatusTracker from '../components/StatusTracker';
import { timeLeft, useNow } from '../components/CancelCountdown';
import { StatusBadge } from '../components/Brand';
import Modal from '../components/Modal';

function ReadyPanel({ order }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 220 }}
      className="rounded-xl bg-saffron p-6 sm:p-8"
      role="status"
    >
      <p className="text-2xl font-extrabold sm:text-3xl">Your food is ready.</p>
      <p className="mt-1 text-ink/80">Show this number at the counter.</p>
      <p className="num mt-6 text-[5.5rem] leading-none font-extrabold tracking-tight sm:text-[7rem]">{order.id}</p>
    </motion.div>
  );
}

export default function OrderTrack() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const now = useNow(15_000);

  useEffect(() => {
    api(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  const onUpdate = (o) => {
    if (String(o.id) === String(id)) setOrder(o);
  };
  useSocketEvent('order:updated', onUpdate);
  useSocketEvent('order:ready', onUpdate);

  if (error) return <p className="mx-auto max-w-2xl px-4 py-24 text-ink/70">{error}</p>;
  if (!order)
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-10">
        <div className="shimmer h-12 w-1/2 rounded" />
        <div className="shimmer h-64 rounded-xl" />
      </div>
    );

  const isOwner = user?.id === order.user_id;
  const canCancel = isOwner && ['placed', 'accepted'].includes(order.status) && now < new Date(order.cancel_deadline).getTime();
  const active = ['placed', 'accepted', 'preparing'].includes(order.status);

  const cancel = async () => {
    setBusy(true);
    try {
      setOrder(await api(`/orders/${order.id}/cancel`, { method: 'POST' }));
      setConfirming(false);
      toast('Order cancelled');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pt-8 pb-32 sm:px-6">
      <Link to={user?.role === 'user' ? '/orders' : '/kitchen'} className="btn btn-quiet -ml-1 text-sm text-ink/70">
        {user?.role === 'user' ? 'All my orders' : 'Back to kitchen'}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-4xl sm:text-5xl">Order {order.id}</h1>
        <StatusBadge meta={STATUS_META[order.status]} />
      </div>
      {state?.justPlaced && order.status === 'placed' && (
        <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-ink/75">
          Order placed. The kitchen has it, and this page updates on its own.
        </motion.p>
      )}

      <div className="mt-8 space-y-6">
        <AnimatePresence>{order.status === 'ready' && <ReadyPanel order={order} />}</AnimatePresence>

        {order.status === 'cancelled' ? (
          <div className="panel p-6">
            <p className="text-xl font-bold">This order was cancelled</p>
            <p className="mt-1 text-ink/70">
              {order.cancelled_by === 'admin' ? 'The shop cancelled it. Please ask at the counter if you have questions.' : 'You cancelled it. Nothing to pay.'}
            </p>
            <Link to="/menu" className="btn btn-dark mt-5">
              Order again
            </Link>
          </div>
        ) : order.status === 'collected' ? (
          <div className="panel p-6">
            <p className="text-xl font-bold">Collected at {fmtTime(order.collected_at)}</p>
            <p className="mt-1 text-ink/70">Thanks for ordering. Enjoy your food.</p>
          </div>
        ) : (
          <div className="panel grid gap-8 p-6 sm:grid-cols-[1fr_auto]">
            <StatusTracker status={order.status} />
            <div className="sm:border-l sm:border-line sm:pl-8">
              <p className="text-sm text-ink/65">Pickup</p>
              <p className="num text-2xl font-extrabold">{fmtTime(order.pickup_time)}</p>
              <p className="text-sm text-ink/65">
                {fmtWhen(order.pickup_time).split(' at ')[0]}
                {active && <>, {relative(order.pickup_time, now)}</>}
              </p>
            </div>
          </div>
        )}

        {canCancel && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
            <p className="text-ink/75">
              Free cancellation until <span className="num font-semibold text-ink">{fmtTime(order.cancel_deadline)}</span> ({timeLeft(order.cancel_deadline, now)})
            </p>
            <button onClick={() => setConfirming(true)} className="btn btn-outline min-h-10">
              Cancel order
            </button>
          </div>
        )}
        {isOwner && !canCancel && ['placed', 'accepted'].includes(order.status) && (
          <p className="text-sm text-ink/65">Free cancellation closed at {fmtTime(order.cancel_deadline)}. Please speak to the counter if your plans change.</p>
        )}

        <section>
          <h2 className="text-xl">Items</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-baseline gap-3 py-3">
                <span className="num w-8 shrink-0 font-semibold">{i.qty}×</span>
                <span className="flex-1">{i.name}</span>
                <span className="num text-ink/70">{money(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          {order.note && <p className="mt-3 text-sm text-ink/70">Note: {order.note}</p>}
          <div className="mt-4 flex items-baseline justify-between">
            <span className="font-semibold">Total, pay at the counter</span>
            <span className="num text-2xl font-extrabold">{money(order.total)}</span>
          </div>
        </section>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Cancel this order?">
        <p className="text-ink/75">The kitchen will be told straight away. You can place a new order any time.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setConfirming(false)} className="btn btn-outline flex-1">
            Keep order
          </button>
          <button disabled={busy} onClick={cancel} className="btn btn-dark flex-1">
            Cancel order
          </button>
        </div>
      </Modal>
    </div>
  );
}
