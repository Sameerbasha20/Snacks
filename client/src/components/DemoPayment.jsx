import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Modal from './Modal';
import Icon from './Icon';
import { Spinner } from './AuthShell';
import { money } from '../lib/api';

/*
  DEMO payment sheet. It behaves like a UPI checkout but no money moves.
  To go live, swap this for the Razorpay or Cashfree checkout and verify the payment on the server.
*/
const UPI_ID = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;

export default function DemoPayment({ open, amount, onClose, onPaid }) {
  const [method, setMethod] = useState('upi_app');
  const [upiId, setUpiId] = useState('');
  const [step, setStep] = useState('choose'); // choose | processing | success | failed
  const [failNext, setFailNext] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('choose');
      setFailNext(false);
    }
  }, [open]);

  const pay = (e, fail = failNext) => {
    e?.preventDefault();
    setStep('processing');
    setTimeout(() => {
      if (fail) return setStep('failed');
      setStep('success');
      setTimeout(() => onPaid({ method, status: 'success', amount, upi_id: method === 'upi_id' ? upiId : undefined }), 700);
    }, 1600);
  };

  const busy = step === 'processing' || step === 'success';
  const validId = method === 'upi_app' || UPI_ID.test(upiId.trim());

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={step === 'failed' ? 'Payment failed' : `Pay ${money(amount)}`}>
      {step === 'choose' && (
        <form onSubmit={pay}>
          <fieldset className="space-y-2">
            <legend className="sr-only">How do you want to pay?</legend>
            {[
              ['upi_app', 'UPI app on this phone', 'Approve the payment in your UPI app.'],
              ['upi_id', 'UPI ID', 'We send a payment request to your UPI ID.'],
            ].map(([id, label, hint]) => (
              <label key={id} className={`flex cursor-pointer gap-3 rounded-lg border-[1.5px] p-4 ${method === id ? 'border-ink' : 'border-line'}`}>
                <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="mt-1 accent-[#1c1a17]" />
                <span>
                  <span className="block font-semibold">{label}</span>
                  <span className="block text-sm text-ink/65">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {method === 'upi_id' && (
            <label className="mt-4 block">
              <span className="label">Your UPI ID</span>
              <input className="input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" autoComplete="off" autoFocus />
            </label>
          )}
          <p className="mt-4 rounded-lg bg-saffron/15 px-3 py-2.5 text-sm text-ink">Demo mode: no real money is taken.</p>
          <button disabled={!validId} className="btn btn-primary mt-4 w-full text-base">
            Pay {money(amount)}
          </button>
          <button type="button" onClick={(e) => pay(e, true)} className="btn btn-quiet mt-1 w-full text-sm text-muted">
            Try a failed payment
          </button>
        </form>
      )}

      {busy && (
        <div className="grid place-items-center py-10 text-center" role="status">
          {step === 'processing' ? (
            <>
              <Spinner />
              <p className="mt-4 font-semibold">{method === 'upi_app' ? 'Waiting for you to approve in your UPI app' : `Request sent to ${upiId}`}</p>
              <p className="mt-1 text-sm text-ink/65">Keep this page open.</p>
            </>
          ) : (
            <>
              <motion.span
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                className="grid h-16 w-16 place-items-center rounded-full bg-ink text-saffron"
              >
                <Icon name="check" size={30} strokeWidth={3} />
              </motion.span>
              <p className="mt-4 text-lg font-bold">Payment received</p>
              <p className="mt-1 text-sm text-ink/65">Placing your order…</p>
            </>
          )}
        </div>
      )}

      {step === 'failed' && (
        <div>
          <p className="text-ink/75">The payment didn't go through and no money was taken. Your order hasn't been placed yet.</p>
          <div className="mt-6 flex gap-3">
            <button onClick={onClose} className="btn btn-outline flex-1">
              Back to checkout
            </button>
            <button onClick={() => setStep('choose')} className="btn btn-dark flex-1">
              Try again
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
