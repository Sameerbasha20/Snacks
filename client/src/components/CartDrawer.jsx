import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useCart } from '../lib/cart';
import { money } from '../lib/api';
import Icon from './Icon';
import FoodImage from './FoodImage';

export function QtyStepper({ qty, onChange, dark = false }) {
  const tone = dark ? 'bg-ink text-paper' : 'border-[1.5px] border-ink text-ink';
  return (
    <div className={`inline-flex h-10 items-center rounded-lg ${tone}`}>
      <button onClick={() => onChange(qty - 1)} className="grid h-10 w-9 place-items-center" aria-label="Remove one">
        <Icon name="minus" size={15} strokeWidth={2.5} />
      </button>
      <span className="num w-6 text-center font-bold" aria-live="polite">
        {qty}
      </span>
      <button onClick={() => onChange(qty + 1)} className="grid h-10 w-9 place-items-center" aria-label="Add one">
        <Icon name="plus" size={15} strokeWidth={2.5} />
      </button>
    </div>
  );
}

/** Cart contents + total + checkout. Used in the desktop sidebar and the mobile drawer. */
export function CartPanel({ onCheckout }) {
  const { items, total, setQty } = useCart();

  if (items.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted">Add something from the menu to get started.</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {items.map((i) => (
            <motion.li
              key={i.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 py-3">
                <FoodImage src={i.image_url} alt={i.name} className="h-12 w-12 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{i.name}</p>
                  <p className="num text-sm text-muted">{money(i.price * i.qty)}</p>
                </div>
                <QtyStepper qty={i.qty} onChange={(q) => setQty(i.id, q)} />
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t border-ink pt-4">
        <span className="font-semibold">Total</span>
        <span className="num text-2xl font-extrabold">{money(total)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">You pay online when you place the order.</p>
      <button onClick={onCheckout} className="btn btn-primary mt-5 w-full">
        Choose pickup time
      </button>
    </div>
  );
}

export default function CartDrawer() {
  const { open, setOpen } = useCart();
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-ink/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.aside
            role="dialog"
            aria-label="Your cart"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-paper px-5 pt-3 pb-8 shadow-2xl sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:px-6 sm:pt-6"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-2xl">Your cart</h2>
              <button onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-line/50" aria-label="Close cart">
                <Icon name="x" size={20} />
              </button>
            </div>
            <CartPanel
              onCheckout={() => {
                setOpen(false);
                navigate('/checkout');
              }}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
