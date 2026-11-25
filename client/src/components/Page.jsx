import { motion } from 'motion/react';

/** Quick cross-fade between routes. */
export default function Page({ children }) {
  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="min-h-[calc(100dvh-4rem)]">
      {children}
    </motion.main>
  );
}
