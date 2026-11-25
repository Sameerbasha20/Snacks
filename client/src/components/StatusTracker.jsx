import { motion } from 'motion/react';
import Icon from './Icon';

const STEPS = [
  { id: 'placed', label: 'Received', hint: 'The kitchen has your order.' },
  { id: 'accepted', label: 'Accepted', hint: 'Confirmed and scheduled for your pickup time.' },
  { id: 'preparing', label: 'Cooking', hint: 'Being made fresh right now.' },
  { id: 'ready', label: 'Ready to collect', hint: 'Waiting for you at the counter.' },
];
const ORDER = ['placed', 'accepted', 'preparing', 'ready', 'collected'];

/** Vertical timeline of the order's progress. */
export default function StatusTracker({ status }) {
  const idx = Math.min(ORDER.indexOf(status), 3);

  return (
    <ol className="relative">
      {STEPS.map((s, i) => {
        const done = i < idx || status === 'collected';
        const current = i === idx && status !== 'collected';
        const last = i === STEPS.length - 1;
        return (
          <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span className="absolute top-7 bottom-0 left-[0.8125rem] w-0.5 bg-line">
                <motion.span className="block w-full bg-ink" initial={false} animate={{ height: done ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
              </span>
            )}
            <motion.span
              initial={false}
              animate={{ scale: current ? [1, 1.15, 1] : 1 }}
              transition={{ duration: 0.4 }}
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                done ? 'bg-ink text-paper' : current ? (s.id === 'ready' ? 'bg-saffron text-ink' : 'border-2 border-ink bg-paper') : 'border-2 border-line bg-paper'
              }`}
            >
              {done && <Icon name="check" size={14} strokeWidth={3} />}
              {current && s.id !== 'ready' && <span className="h-2 w-2 rounded-full bg-ink" />}
              {current && s.id === 'ready' && <Icon name="check" size={14} strokeWidth={3} />}
            </motion.span>
            <div className="-mt-0.5">
              <p className={`font-semibold ${done || current ? 'text-ink' : 'text-muted'}`}>{s.label}</p>
              {current && <p className="text-sm text-ink/65">{s.hint}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
