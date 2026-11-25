import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { homeFor, useAuth } from '../lib/auth';
import { api, fmtClock, fmtDay, fmtTime, money } from '../lib/api';
import { useEarliestPickup } from '../lib/slots';
import FoodImage from '../components/FoodImage';

const EASE = [0.22, 1, 0.36, 1];

const STEPS = [
  ['Choose your food', 'Browse the menu and add what you want to your cart.'],
  ['Pick a pickup time', 'Any slot at least an hour from now, so we can cook it fresh.'],
  ['Collect it hot', "We'll send you an alert the moment it's ready at the counter."],
];

/** The hero's focal point: the real earliest pickup time, worked out from opening hours and lead time. */
function PickupTicket({ ctaTo }) {
  const { slot, settings } = useEarliestPickup();
  const day = slot ? fmtDay(slot).toLowerCase() : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55, duration: 0.6, ease: EASE }}
      className="rounded-xl bg-ink p-6 text-paper shadow-[0_24px_50px_-24px_rgba(28,26,23,.7)] sm:p-7"
    >
      {settings && !slot ? (
        <>
          <p className="text-paper/70">We're not taking orders right now.</p>
          <p className="mt-2 text-3xl font-extrabold">Back at {fmtClock(settings.open_time)}</p>
        </>
      ) : (
        <>
          <p className="text-paper/70">Order now and collect from</p>
          <div className="mt-1 flex items-baseline gap-3">
            <AnimatePresence mode="wait">
              <motion.span
                key={slot}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-[clamp(3rem,7vw,4.5rem)] leading-none font-extrabold tracking-tight"
              >
                {slot ? fmtTime(slot) : '··:··'}
              </motion.span>
            </AnimatePresence>
            <span className="text-xl font-semibold text-paper/80">{day}</span>
          </div>
        </>
      )}
      <Link to={ctaTo} className="btn btn-primary mt-6 w-full text-base sm:w-auto sm:px-7">
        Start your order
      </Link>
    </motion.div>
  );
}

function Hero({ ctaTo }) {
  const reduce = useReducedMotion();
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-12 lg:items-center lg:gap-0 lg:py-0">
        <div className="relative z-10 lg:col-span-6 lg:pr-12">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-[clamp(2.75rem,7.2vw,5.75rem)] leading-[0.95]"
          >
            Order before you get here.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-6 max-w-md text-lg text-ink/75"
          >
            Samosas, chai, rolls and meals from our counter, cooked when you order and ready at the time you pick.
          </motion.p>
          <div className="mt-8 max-w-md">
            <PickupTicket ctaTo={ctaTo} />
          </div>
        </div>

        <motion.div
          initial={reduce ? false : { clipPath: 'inset(0 0 0 100%)' }}
          animate={{ clipPath: 'inset(0 0 0 0%)' }}
          transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1] }}
          className="relative -mx-4 aspect-[4/3] sm:-mx-6 lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:aspect-auto lg:w-[48vw]"
        >
          <motion.img
            src="/images/samosa.jpg"
            alt="Freshly fried samosas with green chilli"
            initial={reduce ? false : { scale: 1.12 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.6, ease: EASE }}
            className="h-full w-full object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl sm:text-4xl">How it works</h2>
        <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="flex gap-4 sm:block">
              <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-ink font-bold">{i + 1}</span>
              <div className="sm:mt-5">
                <h3 className="text-xl">{title}</h3>
                <p className="mt-2 max-w-xs text-ink/70">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function MenuStrip({ ctaTo }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api('/menu')
      .then((m) => {
        // Alternate snacks, meals and drinks so the strip shows the range
        const by = ['snacks', 'food', 'drinks'].map((c) => m.filter((x) => x.category === c && x.image_url));
        const mixed = [];
        for (let i = 0; mixed.length < 8 && i < 10; i++) by.forEach((list) => list[i] && mixed.push(list[i]));
        setItems(mixed.slice(0, 8));
      })
      .catch(() => setItems([]));
  }, []);
  if (items && items.length === 0) return null;

  return (
    <section className="py-16">
      <div className="mx-auto flex max-w-6xl items-end justify-between gap-4 px-4 sm:px-6">
        <h2 className="text-3xl sm:text-4xl">On the menu</h2>
        <Link to={ctaTo} className="btn btn-quiet font-semibold">
          See everything
        </Link>
      </div>
      <div className="mt-8 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:scroll-px-6 lg:snap-none [scrollbar-width:thin] sm:px-6 lg:px-[max(1.5rem,calc((100vw_-_72rem)/2_+_1.5rem))]">
        {(items ?? Array.from({ length: 5 })).map((it, i) =>
          it ? (
            <Link key={it.id} to={ctaTo} className="group w-56 shrink-0 snap-start sm:w-64">
              <div className="overflow-hidden rounded-xl">
                <FoodImage src={it.image_url} alt={it.name} className="aspect-[4/5] w-full transition-transform duration-500 group-hover:scale-[1.03]" />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <p className="font-semibold">{it.name}</p>
                <p className="num shrink-0 text-ink/70">{money(it.price)}</p>
              </div>
            </Link>
          ) : (
            <div key={i} className="shimmer aspect-[4/5] w-56 shrink-0 rounded-xl sm:w-64" />
          )
        )}
      </div>
    </section>
  );
}

function CookedToOrder({ settings }) {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
        <img src="/images/kitchen.jpg" alt="Fritters frying in a large wok" loading="lazy" className="aspect-[5/4] w-full rounded-xl object-cover" />
        <div>
          <h2 className="text-3xl sm:text-5xl">Nothing sits under a heat lamp.</h2>
          <p className="mt-5 max-w-md text-lg text-paper/75">
            We start cooking your order shortly before your pickup time. That's why we ask for an hour's notice, and why it's still hot when you
            arrive.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-2 gap-y-6 border-t border-white/15 pt-6">
            <dt className="text-paper/60">Open</dt>
            <dd className="num font-semibold">{settings ? `${fmtClock(settings.open_time)} to ${fmtClock(settings.close_time)}` : '…'}</dd>
            <dt className="text-paper/60">Order ahead</dt>
            <dd className="font-semibold">{settings?.min_lead_minutes ?? 60} minutes or more</dd>
            <dt className="text-paper/60">Free cancellation</dt>
            <dd className="font-semibold">Up to {settings?.default_cancel_before_minutes ?? 30} min before pickup</dd>
            <dt className="text-paper/60">Payment</dt>
            <dd className="font-semibold">At the counter</dd>
          </dl>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { settings } = useEarliestPickup();
  const ctaTo = user ? homeFor(user) : '/login';

  return (
    <div>
      <Hero ctaTo={ctaTo} />
      <HowItWorks />
      <MenuStrip ctaTo={ctaTo} />
      <CookedToOrder settings={settings} />
      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Snack Shack</p>
        <p>Scan the QR code at the counter to order from your phone.</p>
      </footer>
    </div>
  );
}
