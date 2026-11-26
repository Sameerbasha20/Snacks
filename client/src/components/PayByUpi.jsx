import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, money } from '../lib/api';
import { Spinner } from './AuthShell';
import Icon from './Icon';
import DemoPayment from './DemoPayment';

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
const IS_IOS = /iPhone|iPad|iPod/i.test(ua);
const IS_PHONE = IS_IOS || /Android/i.test(ua);

// iPhones don't show an app chooser for upi:// links, so offer the common apps by name there.
const IOS_APPS = [
  ['Google Pay', 'gpay://upi/pay?'],
  ['PhonePe', 'phonepe://pay?'],
  ['Paytm', 'paytmmp://pay?'],
];

/**
 * Pay the shop's UPI ID for one order, then tell us the UTR so staff can match it.
 * On a phone the button opens the installed UPI apps with the amount filled in; on a computer it shows a QR to scan.
 */
export default function PayByUpi({ order, onUpdated }) {
  const [upi, setUpi] = useState(null);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showQr, setShowQr] = useState(!IS_PHONE);
  const [editing, setEditing] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  // Demo payment (when switched on in Settings): no money moves, the order is marked paid at once.
  const demoPay = async () => {
    try {
      // The order page announces the confirmed payment itself.
      onUpdated(await api(`/orders/${order.id}/demo-pay`, { method: 'POST' }));
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDemoOpen(false);
    }
  };
  const verifying = order.payment_status === 'verifying';

  useEffect(() => {
    api(`/orders/${order.id}/upi`)
      .then(setUpi)
      .catch((e) => setError(e.message));
  }, [order.id, order.total]);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onUpdated(await api(`/orders/${order.id}/payment-sent`, { method: 'POST', body: { utr } }));
      setEditing(false);
      toast.success('Thanks. The shop will check your payment.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Copy failed. Press and hold to copy it.');
    }
  };

  if (verifying && !editing) {
    return (
      <section className="rounded-xl border-2 border-ink p-6" role="status">
        <p className="text-xl font-bold">Checking your payment</p>
        <p className="mt-1 text-ink/75">
          You sent {money(order.total)} with UTR <span className="num font-semibold text-ink">{order.payment_ref}</span>. The shop checks it in their UPI app,
          usually within a few minutes, and the kitchen starts cooking as soon as it's confirmed. This page updates on its own.
        </p>
        <button onClick={() => setEditing(true)} className="btn btn-quiet mt-3 -ml-1 text-sm font-semibold underline underline-offset-4">
          Entered the wrong UTR? Change it
        </button>
      </section>
    );
  }

  const query = upi?.link.split('?')[1];
  const utrForm = (
    <form onSubmit={send} className="mt-2">
      <label htmlFor="utr" className="font-semibold">
        {verifying ? 'Correct UTR' : '2. After paying, enter the UTR'}
      </label>
      <p className="text-sm text-ink/65">The 12-digit number in your UPI app's payment details. It may be called UPI Ref No. or Transaction ID.</p>
      <div className="mt-2 flex gap-2">
        <input
          id="utr"
          className="input num min-w-0 flex-1 tracking-wider"
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          placeholder="e.g. 412345678901"
          value={utr}
          onChange={(e) => setUtr(e.target.value.replace(/[^\d\s]/g, ''))}
        />
        <button disabled={busy || utr.replace(/\s/g, '').length !== 12} className="btn btn-dark shrink-0">
          {busy ? <Spinner /> : "I've paid"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-semibold text-saffron-deep">{error}</p>}
    </form>
  );

  if (verifying) {
    return (
      <section className="rounded-xl border-2 border-ink p-6">
        {utrForm}
        <button onClick={() => setEditing(false)} className="btn btn-quiet mt-2 -ml-1 text-sm">
          Keep {order.payment_ref}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border-2 border-saffron p-6">
      <p className="text-xl font-bold">Pay {money(order.total)} to confirm your order</p>
      <p className="mt-1 text-ink/70">The kitchen starts cooking once your payment is confirmed.</p>

      {!upi ? (
        error ? <p className="mt-4 font-semibold text-saffron-deep">{error}</p> : <div className="shimmer mt-4 h-24 rounded-lg" />
      ) : (
        <div className="mt-5 space-y-6">
          <div>
            <p className="font-semibold">1. Pay with any UPI app</p>
            {IS_PHONE && (
              <>
                <a href={upi.link} className="btn btn-primary mt-2 w-full text-base">
                  Pay {money(upi.amount)} with a UPI app
                </a>
                {IS_IOS && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {IOS_APPS.map(([name, prefix]) => (
                      <a key={name} href={prefix + query} className="btn btn-outline min-h-10 px-2 text-sm">
                        {name}
                      </a>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowQr((v) => !v)} className="btn btn-quiet mt-1 -ml-1 text-sm">
                  {showQr ? 'Hide QR code' : 'Paying from another phone? Show QR code'}
                </button>
              </>
            )}
            {showQr && (
              <div className="mt-2 flex flex-col items-start gap-2">
                <img src={upi.qr} alt={`UPI QR code to pay ${money(upi.amount)} to ${upi.upi_name}`} className="w-52 rounded-lg border border-line bg-white p-2" />
                <p className="text-sm text-ink/65">Scan with GPay, PhonePe, Paytm or any UPI app. The amount is filled in.</p>
              </div>
            )}
            <div className="mt-3 rounded-lg bg-surface px-4 py-3 text-sm">
              <p className="text-ink/70">App didn't open, or it won't let you pay? Send {money(upi.amount)} to this UPI ID yourself:</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="num font-semibold break-all text-ink">{upi.upi_id}</span>
                <button type="button" onClick={() => copy(upi.upi_id, 'UPI ID')} className="btn btn-quiet min-h-9 shrink-0 px-2">
                  <Icon name="copy" size={15} /> Copy
                </button>
              </div>
              <p className="text-ink/60">Paying to {upi.upi_name}</p>
            </div>
          </div>
          {utrForm}
          {upi.demo && (
            <div className="border-t border-line pt-5">
              <p className="font-semibold">Just trying it out?</p>
              <p className="text-sm text-ink/65">Use a demo payment instead. No money is taken and your order goes straight to the kitchen.</p>
              <button type="button" onClick={() => setDemoOpen(true)} className="btn btn-outline mt-3 w-full">
                Use demo payment
              </button>
              <DemoPayment open={demoOpen} amount={upi.amount} onClose={() => setDemoOpen(false)} onPaid={demoPay} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
