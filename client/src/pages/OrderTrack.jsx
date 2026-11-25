import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { api, fmtTime, fmtWhen, money, PAYMENT_PENDING, paymentText, relative, STATUS_META } from '../lib/api';
import PayByUpi from '../components/PayByUpi';
import { useCart } from '../lib/cart';
import { reorder } from '../lib/customer';
import { StarInput } from '../components/Stars';
import Icon from '../components/Icon';
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

/** After pickup: one star row per dish. Saved ratings stay editable. */
function RateOrder({ order, onSaved }) {
  const dishes = order.items.filter((i) => i.menu_item_id);
  const [stars, setStars] = useState(() => Object.fromEntries(dishes.map((i) => [i.menu_item_id, i.rating || 0])));
  const [busy, setBusy] = useState(false);
  const rated = dishes.some((i) => i.rating);
  const changed = dishes.some((i) => (stars[i.menu_item_id] || 0) !== (i.rating || 0));
  if (!dishes.length) return null;

  const save = async () => {
    setBusy(true);
    try {
      const ratings = Object.entries(stars)
        .filter(([, n]) => n > 0)
        .map(([menu_item_id, n]) => ({ menu_item_id: Number(menu_item_id), stars: n }));
      onSaved(await api(`/orders/${order.id}/ratings`, { method: 'POST', body: { ratings } }));
      toast.success('Thanks for rating your food.');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel p-6">
      <h2 className="text-xl">{rated ? 'Your ratings' : 'How was your food?'}</h2>
      <p className="mt-1 text-sm text-ink/65">Your stars help the kitchen know what to keep and what to fix.</p>
      <ul className="mt-4 space-y-3">
        {dishes.map((i) => (
          <li key={i.menu_item_id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">{i.name}</span>
            <StarInput label={`Rate ${i.name}`} value={stars[i.menu_item_id] || 0} onChange={(n) => setStars({ ...stars, [i.menu_item_id]: n })} />
          </li>
        ))}
      </ul>
      {changed && (
        <button disabled={busy || !Object.values(stars).some(Boolean)} onClick={save} className="btn btn-dark mt-5">
          {rated ? 'Update ratings' : 'Send ratings'}
        </button>
      )}
    </section>
  );
}

function OrderAgainButton({ order }) {
  const cart = useCart();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          reorder(order, await api('/menu'), cart);
        } catch (e) {
          toast.error(e.message);
        } finally {
          setBusy(false);
        }
      }}
      className="btn btn-dark mt-5"
    >
      <Icon name="refresh" size={16} /> Order again
    </button>
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
    if (String(o.id) !== String(id)) return;
    if (o.payment_status === 'paid' && order && PAYMENT_PENDING.includes(order.payment_status)) {
      toast.success('Payment confirmed. The kitchen has your order.');
    }
    setOrder(o);
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
          {PAYMENT_PENDING.includes(order.payment_status)
            ? 'Order saved. Pay below and the kitchen will start on it.'
            : 'Order placed. The kitchen has it, and this page updates on its own.'}
        </motion.p>
      )}

      <div className="mt-8 space-y-6">
        <AnimatePresence>{order.status === 'ready' && <ReadyPanel order={order} />}</AnimatePresence>

        {isOwner && order.status !== 'cancelled' && PAYMENT_PENDING.includes(order.payment_status) && <PayByUpi order={order} onUpdated={setOrder} />}

        {order.status === 'cancelled' ? (
          <div className="panel p-6">
            <p className="text-xl font-bold">This order was cancelled</p>
            <p className="mt-1 text-ink/70">
              {order.payment_status === 'failed'
                ? "The shop couldn't find your UPI payment, so the order was cancelled. If money did leave your account, show the UTR at the counter."
                : order.cancelled_by === 'customer'
                  ? 'You cancelled it.'
                  : 'The shop cancelled it.'}{' '}
              {order.payment_status === 'refund_due' ? `The shop will send ${money(order.amount_paid || order.total)} back to the UPI account you paid from.` : ''}
              {order.payment_status === 'refunded' ? `The shop has sent ${money(order.amount_paid || order.total)} back to your UPI account.` : ''}
              {order.discount > 0 ? ` The ${money(order.discount)} credit you used is back in your account.` : ''}
            </p>
            {isOwner && <OrderAgainButton order={order} />}
          </div>
        ) : order.status === 'collected' ? (
          <div className="panel p-6">
            <p className="text-xl font-bold">Collected at {fmtTime(order.collected_at)}</p>
            <p className="mt-1 text-ink/70">Thanks for ordering. Enjoy your food.</p>
            {isOwner && <OrderAgainButton order={order} />}
          </div>
        ) : (
          <div className="panel grid gap-8 p-6 sm:grid-cols-[1fr_auto]">
            {PAYMENT_PENDING.includes(order.payment_status) ? (
              <div>
                <p className="font-semibold">{order.payment_status === 'verifying' ? 'Payment being checked' : 'Waiting for payment'}</p>
                <p className="mt-1 text-ink/70">The kitchen sees your order and starts cooking once your payment is confirmed.</p>
              </div>
            ) : (
              <StatusTracker status={order.status} />
            )}
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

        {isOwner && order.status === 'collected' && <RateOrder order={order} onSaved={setOrder} />}

        {canCancel && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-4">
            <p className="text-ink/75">
              Free cancellation with a full refund until <span className="num font-semibold text-ink">{fmtTime(order.cancel_deadline)}</span> ({timeLeft(order.cancel_deadline, now)})
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
                <span className="flex-1">
                  {i.name}
                  {i.detail && <span className="block text-sm text-ink/60">{i.detail}</span>}
                </span>
                <span className="num text-ink/70">{money(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>
          {order.note && <p className="mt-3 text-sm text-ink/70">Note: {order.note}</p>}
          {order.discount > 0 && (
            <div className="mt-3 flex items-baseline justify-between text-ink/70">
              <span>Credit used</span>
              <span className="num">−{money(order.discount)}</span>
            </div>
          )}
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="num text-2xl font-extrabold">{money(order.total)}</span>
          </div>
          <p className="mt-1 text-right text-sm text-ink/65">
            {paymentText(order)}
            {order.payment_ref && order.payment_status !== 'unpaid' && <span className="num">, ref {order.payment_ref}</span>}
          </p>
          {order.payment_status === 'paid' && order.total > order.amount_paid && (
            <p className="mt-1 text-right text-sm font-semibold">Pay the remaining {money(order.total - order.amount_paid)} at the counter.</p>
          )}
          {order.payment_status === 'paid' && order.total < order.amount_paid && (
            <p className="mt-1 text-right text-sm font-semibold">The shop changed your order. Collect {money(order.amount_paid - order.total)} back at the counter.</p>
          )}
        </section>
      </div>

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Cancel this order?">
        <p className="text-ink/75">
          The kitchen will be told straight away
          {(order.payment_status === 'paid' && order.payment_method === 'upi') || order.payment_status === 'verifying'
            ? `, and the shop will send the ${money(order.amount_paid || order.total)} you paid back to your UPI account`
            : ''}
          .
          {order.discount > 0 ? ` Your ${money(order.discount)} credit comes back too.` : ''}
        </p>
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
