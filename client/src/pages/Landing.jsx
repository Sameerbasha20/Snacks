import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { homeFor, useAuth } from '../lib/auth';
import { api, fmtClock, fmtDay, fmtTime, money } from '../lib/api';
import { useEarliestPickup } from '../lib/slots';

const EASE = [0.22, 1, 0.36, 1];

const STEPS = [
  ['Choose your food', 'Browse the menu and add what you want to your cart.'],
  ['Pick a pickup time', 'Any slot at least an hour from now, so we can cook it fresh.'],
  ['Collect it from reception', "We'll send you an alert the moment it arrives at reception."],
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

const HERO_DISHES = [
  { src: '/images/biryani-plate.jpg', name: 'Mutton Dum Biryani', alt: 'A plate of dum biryani with fried onions, mint and cucumber' },
  { src: '/images/chicken-burger.jpg', name: 'Crispy Chicken Burger', alt: 'A crispy chicken burger with slaw' },
  { src: '/images/meals-thali.jpg', name: 'South Indian Meals', alt: 'A full meals thali with rice, sambar, rasam and sides' },
  { src: '/images/samosa.jpg', name: 'Samosa', alt: 'Freshly fried samosas with green chilli' },
  { src: '/images/pizza.jpg', name: 'Margherita Pizza', alt: 'A margherita pizza with basil' },
];

/** The hero photo: one dish at a time, so the range shows without a collage. Holds still for reduced motion. */
function DishReel() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    HERO_DISHES.forEach((d) => (new Image().src = d.src));
    const t = setInterval(() => setI((n) => (n + 1) % HERO_DISHES.length), 4200);
    return () => clearInterval(t);
  }, [reduce]);
  const dish = HERO_DISHES[i % HERO_DISHES.length];

  return (
    <motion.div
      initial={reduce ? false : { clipPath: 'inset(0 0 0 100%)' }}
      animate={{ clipPath: 'inset(0 0 0 0%)' }}
      transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1] }}
      className="relative -mx-4 aspect-[4/3] overflow-hidden bg-ink sm:-mx-6 lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:aspect-auto lg:w-[48vw]"
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={dish.src}
          src={dish.src}
          alt={dish.alt}
          initial={reduce ? false : { opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.9 }, scale: { duration: 5, ease: 'linear' } }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute bottom-4 left-4 flex items-center gap-3 sm:bottom-6 sm:left-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={dish.name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="rounded-md bg-paper px-3 py-1.5 text-sm font-bold text-ink"
          >
            {dish.name}
          </motion.p>
        </AnimatePresence>
        <div className="flex gap-1.5" aria-hidden="true">
          {HERO_DISHES.map((d, n) => (
            <span key={d.src} className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? 'w-5 bg-paper' : 'w-1.5 bg-paper/50'}`} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function Hero({ ctaTo }) {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-12 lg:items-center lg:gap-0 lg:py-12">
        <div className="relative z-10 lg:col-span-6 lg:pr-12">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="text-[clamp(2.6rem,5.2vw,4.6rem)] leading-[0.95]"
          >
            Biryani, burgers and food like home.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="mt-6 max-w-md text-lg text-ink/75"
          >
            Plus pizzas, sandwiches, samosas and puffs. Order on your phone an hour ahead and it's waiting at reception, hot, when you come down.
          </motion.p>
          <div className="mt-8 max-w-md">
            <PickupTicket ctaTo={ctaTo} />
          </div>
        </div>
        <DishReel />
      </div>
    </section>
  );
}

const SPECIALITIES = [
  {
    id: 'biryani',
    title: 'Biryani',
    text: 'Dum-cooked in sealed pots, so the rice takes in every spice. Chicken, mutton, egg and veg, each with raita and salan.',
    img: '/images/biryani-plate.jpg',
    alt: 'Dum biryani with fried onions and mint',
  },
  {
    id: 'homemade',
    title: 'Home-made meals',
    text: 'Thalis, dal rice and curries cooked the way they are at home, not restaurant-rich. The veg thali changes every day.',
    img: '/images/home-thali.jpg',
    alt: 'A steel thali with rotis, sabzi and paneer',
  },
  {
    id: 'burgers',
    title: 'Burgers, sandwiches & pizza',
    text: 'Burgers fried when you order, sandwiches grilled until crisp, and thin-crust pizzas straight from the oven.',
    img: '/images/corn-sandwich.jpg',
    alt: 'A grilled corn cheese sandwich with dips',
    first: ['Crispy Chicken Burger', 'Corn Cheese Sandwich', 'Margherita Pizza (7")', 'Veg Burger'],
  },
  {
    id: 'snacks',
    title: 'Snacks & puffs',
    text: 'Samosas, bakery puffs and vada pav for the evening chai break.',
    img: '/images/vada-pav.jpg',
    alt: 'Vada pav with chutney',
    first: ['Samosa (2 pcs)', 'Egg Puff', 'Veg Puff', 'Chicken Puff'],
  },
];

/** What the shop is known for, each with real dishes and prices from the live menu. */
function WhatWeCook({ menu, linkFor }) {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-4xl sm:text-5xl">What we cook</h2>
        <p className="max-w-sm text-ink/70">Everything is made in our kitchen after you order. Nothing is reheated.</p>
      </div>

      <div className="mt-12 grid gap-x-10 gap-y-16 lg:grid-cols-12">
        {SPECIALITIES.map((k, n) => {
          const rank = (m) => (k.first?.includes(m.name) ? k.first.indexOf(m.name) : 99);
          const dishes = (menu ?? []).filter((m) => m.category === k.id).sort((a, b) => rank(a) - rank(b));
          const wide = n === 0 || n === 3;
          if (menu && dishes.length === 0) return null;
          return (
            <motion.article
              key={k.id}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6, ease: EASE }}
              className={wide ? 'lg:col-span-7' : 'lg:col-span-5 lg:pt-28'}
            >
              <Link {...linkFor(k.id)} className="group block overflow-hidden rounded-xl" tabIndex={-1} aria-hidden="true">
                <img
                  src={k.img}
                  alt=""
                  loading="lazy"
                  className={`w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] ${wide ? 'aspect-[4/3]' : 'aspect-[5/4]'}`}
                />
              </Link>
              <h3 className="mt-6 text-3xl">
                <Link {...linkFor(k.id)} className="underline-offset-4 hover:underline">
                  {k.title}
                </Link>
              </h3>
              <p className="mt-2 max-w-md text-ink/70">{k.text}</p>

              <ul className="mt-5 border-t border-line">
                {menu
                  ? dishes.slice(0, 4).map((d) => (
                      <li key={d.id} className="flex items-baseline gap-3 border-b border-line py-2.5">
                        <span className="font-semibold">{d.name}</span>
                        <span className="flex-1 border-b border-dotted border-ink/25" aria-hidden="true" />
                        <span className="num shrink-0">{money(d.price)}</span>
                      </li>
                    ))
                  : [0, 1, 2].map((x) => <li key={x} className="shimmer my-2 h-6 rounded" />)}
              </ul>
              {dishes.length > 4 && (
                <Link {...linkFor(k.id)} className="mt-3 inline-block font-semibold underline underline-offset-4">
                  See all {dishes.length}
                </Link>
              )}
            </motion.article>
          );
        })}
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

function CookedToOrder({ settings }) {
  return (
    <section className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
        <img src="/images/kitchen.jpg" alt="Fritters frying in a large wok" loading="lazy" className="aspect-[5/4] w-full rounded-xl object-cover" />
        <div>
          <h2 className="text-3xl sm:text-5xl">Nothing sits under a heat lamp.</h2>
          <p className="mt-5 max-w-md text-lg text-paper/75">
            The biryani goes on dum, burgers hit the fryer and the thali is plated shortly before your pickup time. That's why we ask for an hour's
            notice, and why it's still hot when you arrive.
          </p>
          <dl className="mt-10 grid max-w-md grid-cols-2 gap-y-6 border-t border-white/15 pt-6">
            <dt className="text-paper/60">Open</dt>
            <dd className="num font-semibold">{settings ? `${fmtClock(settings.open_time)} to ${fmtClock(settings.close_time)}` : '…'}</dd>
            <dt className="text-paper/60">Order ahead</dt>
            <dd className="font-semibold">{settings?.min_lead_minutes ?? 60} minutes or more</dd>
            <dt className="text-paper/60">Free cancellation</dt>
            <dd className="font-semibold">Up to {settings?.default_cancel_before_minutes ?? 30} min before pickup</dd>
            <dt className="text-paper/60">Payment</dt>
            <dd className="font-semibold">UPI when you order. Cancel in time and we send it back.</dd>
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
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    api('/menu')
      .then(setMenu)
      .catch(() => setMenu([]));
  }, []);
  // Each speciality opens its part of the menu, going through login first if needed.
  const linkFor = (id) => {
    if (user?.role === 'user') return { to: '/menu#' + id };
    if (user) return { to: ctaTo };
    return { to: '/login', state: { from: '/menu#' + id } };
  };

  return (
    <div>
      <Hero ctaTo={ctaTo} />
      <WhatWeCook menu={menu} linkFor={linkFor} />
      <HowItWorks />
      <CookedToOrder settings={settings} />
      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-10 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Snack Shack</p>
        <p>Scan the QR code at reception to order from your phone.</p>
      </footer>
    </div>
  );
}
