import { motion } from 'motion/react';

/** Order status badge. Animates when the status changes. */
export function StatusBadge({ meta }) {
  return (
    <motion.span
      key={meta.short}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`inline-flex h-7 items-center rounded-md px-2.5 text-[0.8rem] font-bold whitespace-nowrap ${meta.color}`}
    >
      {meta.short}
    </motion.span>
  );
}
