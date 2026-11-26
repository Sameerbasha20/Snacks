import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import toast from 'react-hot-toast';
import { homeFor, useAuth } from '../lib/auth';
import { api, fmtClock, fmtDay, fmtTime, money } from '../lib/api';
import { useCart } from '../lib/cart';
import { useEarliestPickup } from '../lib/slots';
import FoodImage from '../components/FoodImage';
import Icon from '../components/Icon';
import { DietFilter, matchesDiet, useDiet, DishMark } from '../components/Diet';

const EASE = [0.22, 1, 0.36, 1];

/**
 * Where an "Order now" button goes. Signed-out visitors go to login and then land on the menu
 * (or the part of it they picked). Customers go straight to the menu; staff to their own board.
 */
function useOrderLink() {
  const { user } = useAuth();
  return (hash = '') => {
    const target = '/menu' + (hash ? '#' + hash : '');
    if (!user) return { to: '/login', state: { from: target } };
    if (user.role === 'user') return { to: target };
    return { to: homeFor(user) };
  };
}

/* ───────────────────────── Hero ───────────────────────── */

const HERO_DISHES = [
  { src: '/images/biryani-plate.jpg', name: 'Mutton Dum Biryani', cat: 'biryani', alt: 'A plate of dum biryani with fried onions, mint and cucumber' },
  { src: '/images/chicken-burger.jpg', name: 'Crispy Chicken Burger', cat: 'burgers', alt: 'A crispy chicken burger with slaw' },
  { src: '/images/meals-thali.jpg', name: 'South Indian Meals', cat: 'homemade', alt: 'A full meals thali with rice, sambar, rasam and sides' },
  { src: '/images/samosa.jpg', name: 'Samosa (2 pcs)', label: 'Samosa', cat: 'snacks', alt: 'Freshly fried samosas with green chilli' },
  { src: '/images/pizza.jpg', name: 'Margherita Pizza (7")', label: 'Margherita Pizza', cat: 'burgers', alt: 'A margherita pizza with basil' },
];
const REEL_MS = 4500;

/** The hero photo. Rotates through signature dishes; tap a name, swipe, or hover to hold it. */
function DishReel({ priceOf, orderLink }) {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (n) => setI((n + HERO_DISHES.length) % HERO_DISHES.length);

  useEffect(() => {
    HERO_DISHES.forEach((d) => (new Image().src = d.src));
  }, []);
  useEffect(() => {
    if (reduce || paused) return;
    const t = setTimeout(() => go(i + 1), REEL_MS);
    return () => clearTimeout(t);
  }, [i, paused, reduce]);

  const dish = HERO_DISHES[i];
  const price = priceOf(dish.name);

  return (
    <motion.div
      initial={reduce ? false : { clipPath: 'inset(0 0 0 100%)' }}
      animate={{ clipPath: 'inset(0 0 0 0%)' }}
      transition={{ duration: 1.1, ease: [0.76, 0, 0.24, 1] }}
      onHoverStart={() => setPaused(true)}
      onHoverEnd={() => setPaused(false)}
      onPanEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 50) go(i + (info.offset.x < 0 ? 1 : -1));
      }}
      style={{ touchAction: 'pan-y' }}
      className="relative -mx-4 aspect-[4/3] touch-pan-y overflow-hidden bg-ink select-none sm:-mx-6 lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:aspect-auto lg:w-[48vw]"
      aria-roledescription="carousel"
      aria-label="Dishes we cook"
    >
      <AnimatePresence initial={false}>
        <motion.img
          key={dish.src}
          src={dish.src}
          alt={dish.alt}
          draggable={false}
          initial={reduce ? false : { opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.8 }, scale: { duration: 6, ease: 'linear' } }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/80 to-transparent" />

      <div className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-6">
        <div className="flex items-end justify-between gap-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={dish.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-paper"
              aria-live="polite"
            >
              <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">{dish.label ?? dish.name}</p>
              {price != null && <p className="num text-paper/80">{money(price)}</p>}
            </motion.div>
          </AnimatePresence>
          <Link {...orderLink(dish.cat)} className="btn btn-primary shrink-0">
            Order this
          </Link>
        </div>

        <div className="mt-4 flex gap-1.5" role="tablist" aria-label="Choose a dish">
          {HERO_DISHES.map((d, n) => (
            <button
              key={d.src}
              role="tab"
              aria-selected={n === i}
              aria-label={d.label ?? d.name}
              onClick={() => go(n)}
              className="group relative h-6 flex-1"
            >
              <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-paper/30 transition-colors group-hover:bg-paper/50">
                {n < i && <span className="absolute inset-0 bg-paper" />}
                {n === i && (
                  <motion.span
                    key={`${i}-${paused}`}
                    className="absolute inset-y-0 left-0 bg-paper"
                    initial={{ width: reduce || paused ? '100%' : '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: reduce || paused ? 0 : REEL_MS / 1000, ease: 'linear' }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

const HEADLINE = ['Biryani,', 'burgers', 'and', 'food', 'like', 'home.'];

function Hero({ priceOf, orderLink }) {
  const reduce = useReducedMotion();
  const { slot, settings } = useEarliestPickup();
  const closed = settings && !slot;

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 pb-14 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-12 lg:items-center lg:gap-0 lg:py-12">
        <div className="relative z-10 lg:col-span-6 lg:pr-12">
          <h1 className="text-[clamp(2.6rem,5.2vw,4.6rem)] leading-[0.95]">
            {HEADLINE.map((w, n) => (
              <span key={n} className="inline-block overflow-hidden pb-1 align-bottom">
                <motion.span
                  className="inline-block"
                  initial={reduce ? false : { y: '105%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 + n * 0.07, duration: 0.7, ease: EASE }}
                >
                  {w}
                </motion.span>
                {n < HEADLINE.length - 1 && ' '}
              </span>
            ))}
          </h1>
          <motion.p
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="mt-6 max-w-md text-lg text-ink/75"
          >
            Plus pizzas, sandwiches, samosas and puffs. Order on your phone an hour ahead and it's waiting at reception, hot, when you come down.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6, ease: EASE }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <OrderNowButton to={orderLink()} big />
            <a href="#explore" className="btn btn-outline min-h-12 px-6 text-base">
              See the menu
            </a>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6 }}
            className="mt-8 flex max-w-md items-center gap-4 border-t border-line pt-5"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper">
              <Icon name="clock" size={20} />
            </span>
            {closed ? (
              <p className="text-ink/75">
                Not taking orders right now. <span className="font-bold text-ink">Back at {fmtClock(settings.open_time)}.</span>
              </p>
            ) : (
              <p className="text-ink/75">
                Order now, collect from{' '}
                <AnimatePresence mode="wait">
                  <motion.span key={slot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="num text-xl font-extrabold text-ink">
                    {slot ? fmtTime(slot) : '··:··'}
                  </motion.span>
                </AnimatePresence>{' '}
                {slot && <span className="font-semibold text-ink">{fmtDay(slot).toLowerCase()}</span>}
              </p>
            )}
          </motion.div>
        </div>
        <DishReel priceOf={priceOf} orderLink={orderLink} />
      </div>
    </section>
  );
}

/** The main call to action. A soft saffron ring pulses behind it to draw the eye once the page settles. */
function OrderNowButton({ to, big = false, label = 'Order now', className = '' }) {
  const reduce = useReducedMotion();
  return (
    <span className={`relative inline-flex ${className}`}>
      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-lg bg-saffron"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.45, 0], scale: [1, 1.12, 1.22] }}
          transition={{ delay: 1.6, duration: 1.8, repeat: Infinity, repeatDelay: 2.2, ease: 'easeOut' }}
        />
      )}
      <Link {...to} className={`btn btn-primary relative w-full gap-2 ${big ? 'min-h-12 px-7 text-base' : ''}`}>
        {label}
        <Icon name="arrow" size={18} />
      </Link>
    </span>
  );
}

/* ─────────────────────── Menu explorer ─────────────────────── */

const CRAVINGS = [
  { id: 'biryani', title: 'Biryani', img: '/images/biryani-plate.jpg', veg: '/images/veg-biryani.jpg', text: 'Dum-cooked in sealed pots so the rice takes in every spice. Served with raita and salan.' },
  { id: 'burgers', title: 'Burgers & pizza', img: '/images/pizza.jpg', nonveg: '/images/chicken-burger.jpg', text: 'Burgers fried when you order, sandwiches grilled crisp, thin-crust pizza from the oven.' },
  { id: 'homemade', title: 'Home-made', img: '/images/home-thali.jpg', nonveg: '/images/chicken-curry.jpg', text: 'Thalis, dal rice and curries cooked the way they are at home, not restaurant-rich.' },
  { id: 'snacks', title: 'Snacks & puffs', img: '/images/egg-puff.jpg', veg: '/images/samosa.jpg', text: 'Samosas, bakery puffs and vada pav for the evening chai break.' },
  { id: 'combos', title: 'Combos', img: '/images/veg-burger.jpg', nonveg: '/images/chicken-burger.jpg', text: 'A main, a side and a drink for less than buying them apart.' },
  { id: 'drinks', title: 'Drinks', img: '/images/mango-lassi.jpg', text: 'Chai, cold coffee, lassi and fresh lime soda.' },
];

/** Customers add straight to the cart from here; everyone else is sent to log in first. */
function DishCard({ item, orderLink, canAdd }) {
  const { qtyOf, add } = useCart();
  const qty = qtyOf(item.id);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.35, ease: EASE }}
      className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-ink/40"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
        <FoodImage src={item.image_url} alt={item.name} className="h-full w-full transition-transform duration-500 group-hover:scale-110" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2 font-bold leading-snug">
          <DishMark item={item} size={13} className="relative top-0.5" />
          {item.name}
        </p>
        <p className="num mt-0.5 text-ink/70">{money(item.price)}</p>
      </div>
      {canAdd ? (
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            add(item);
            toast.success(`${item.name} added`, { id: 'add-' + item.id });
          }}
          className="btn btn-dark min-h-10 shrink-0 px-3.5 text-sm"
          aria-label={`Add ${item.name} to cart`}
        >
          <Icon name="plus" size={16} />
          {qty > 0 ? <span className="num">{qty}</span> : 'Add'}
        </motion.button>
      ) : (
        <Link {...orderLink(item.category)} className="btn btn-outline min-h-10 shrink-0 px-3.5 text-sm" aria-label={`Order ${item.name}`}>
          Order
        </Link>
      )}
    </motion.li>
  );
}

function MenuExplorer({ menu, orderLink }) {
  const { user } = useAuth();
  const canAdd = user?.role === 'user';
  const [diet, setDiet] = useDiet();
  const tabs = useMemo(
    () => (menu ? CRAVINGS.filter((c) => menu.some((m) => m.category === c.id && matchesDiet(diet, m))) : CRAVINGS.slice(0, 4)),
    [menu, diet]
  );
  const [active, setActive] = useState('biryani');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  const dishes = (menu ?? []).filter((m) => m.category === current?.id && matchesDiet(diet, m));
  const shown = dishes.slice(0, 5);
  // The photo follows the filter, so Veg never shows a mutton biryani.
  const photo = current?.[diet] ?? current?.img;

  if (!current) return null;
  return (
    <section id="explore" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-4xl sm:text-5xl">What are you craving?</h2>
          <p className="max-w-sm text-ink/70">Everything is made in our kitchen after you order. Nothing is reheated.</p>
        </div>

        <DietFilter diet={diet} onChange={setDiet} id="home-diet" className="mt-8" />

        <div className="-mx-4 mt-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0" role="tablist" aria-label="Menu sections">
          <div className="flex w-max gap-1 rounded-full bg-line/50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={t.id === current.id}
                onClick={() => setActive(t.id)}
                className={`relative rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors sm:px-5 sm:text-base ${
                  t.id === current.id ? 'text-paper' : 'text-ink/70 hover:text-ink'
                }`}
              >
                {t.id === current.id && (
                  <motion.span layoutId="craving-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
                )}
                <span className="relative">{t.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink">
              <AnimatePresence initial={false}>
                <motion.img
                  key={photo}
                  src={photo}
                  alt=""
                  initial={{ opacity: 0, scale: 1.06 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                <h3 className="mt-6 text-3xl">{current.title}</h3>
                <p className="mt-2 max-w-md text-ink/70">{current.text}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="lg:col-span-6">
            <ul className="space-y-3" aria-live="polite">
              {!menu ? (
                [0, 1, 2, 3].map((x) => <li key={x} className="shimmer h-[6.5rem] rounded-xl" />)
              ) : (
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((d) => (
                    <DishCard key={d.id} item={d} orderLink={orderLink} canAdd={canAdd} />
                  ))}
                </AnimatePresence>
              )}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <OrderNowButton to={orderLink(current.id)} label={dishes.length > shown.length ? `Order now, see all ${dishes.length}` : 'Order now'} />
              {!user && <p className="text-sm text-ink/60">Log in or sign up to order. It takes a minute.</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── How it works ─────────────────────── */

const STEPS = [
  ['Choose your food', 'Browse the menu and add what you want to your cart.', 'menu'],
  ['Pick a pickup time', 'Any slot at least an hour from now, so we can cook it fresh.', 'clock'],
  ['Pay by UPI', 'Tap pay and your UPI app opens with the amount filled in.', 'phone'],
  ['Collect at reception', "We'll alert you the moment it arrives. Come down and pick it up.", 'bell'],
];

function useWide() {
  const q = '(min-width: 640px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

/** A line draws across the steps as you scroll, lighting each one when it reaches it. */
function HowItWorks({ orderLink }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const wide = useWide();
  const [reached, setReached] = useState(reduce ? STEPS.length : 0);
  useEffect(() => {
    if (reduce) return;
    return progress.on('change', (v) => setReached(Math.min(STEPS.length, Math.floor(v * STEPS.length + 0.35))));
  }, [progress, reduce]);

  return (
    <section ref={ref} className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-3xl sm:text-4xl">From your phone to reception</h2>
          <OrderNowButton to={orderLink()} />
        </div>
        <div className="relative mt-12">
          {/* track: vertical on phones, horizontal on wider screens */}
          <div className="absolute top-5 bottom-5 left-5 w-0.5 bg-line sm:top-5 sm:right-[12.5%] sm:bottom-auto sm:left-[12.5%] sm:h-0.5 sm:w-auto" aria-hidden="true">
            <motion.div
              className="h-full w-full origin-top bg-saffron sm:origin-left"
              style={reduce ? undefined : wide ? { scaleX: progress } : { scaleY: progress }}
            />
          </div>
          <ol className="relative grid gap-10 sm:grid-cols-4 sm:gap-6">
            {STEPS.map(([title, text, icon], i) => {
              const on = i < reached;
              return (
                <li key={title} className="flex gap-5 sm:flex-col sm:items-center sm:text-center">
                  <motion.span
                    animate={{ scale: on ? 1 : 0.9 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ${
                      on ? 'border-saffron bg-saffron text-ink' : 'border-line bg-surface text-ink/50'
                    }`}
                  >
                    <Icon name={icon} size={18} />
                  </motion.span>
                  <div className={`transition-opacity duration-300 sm:mt-4 ${on ? 'opacity-100' : 'opacity-55'}`}>
                    <h3 className="text-xl">{title}</h3>
                    <p className="mt-1.5 max-w-xs text-ink/70">{text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────── Cooked to order ─────────────────────── */

function CookedToOrder({ settings }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-8%', '8%']);

  return (
    <section ref={ref} className="bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-24">
        <div className="aspect-[5/4] overflow-hidden rounded-xl">
          <motion.img
            src="/images/kitchen.jpg"
            alt="Fritters frying in a large wok"
            loading="lazy"
            style={reduce ? undefined : { y, scale: 1.18 }}
            className="h-full w-full object-cover"
          />
        </div>
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

/* ─────────────────────── Closing call ─────────────────────── */

const STRIP = ['/images/chicken-biryani.jpg', '/images/corn-sandwich.jpg', '/images/samosa.jpg', '/images/meals-thali.jpg', '/images/pizza.jpg', '/images/egg-puff.jpg', '/images/paneer-masala.jpg', '/images/vada-pav.jpg'];

function FinalCall({ orderLink, innerRef }) {
  const reduce = useReducedMotion();
  const { slot } = useEarliestPickup();
  return (
    <section ref={innerRef} className="overflow-hidden py-16 lg:py-24">
      {/* a slow strip of dishes; it stops for reduced motion */}
      <div className="relative" aria-hidden="true">
        <motion.div
          className="flex w-max gap-4"
          animate={reduce ? undefined : { x: ['0%', '-50%'] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        >
          {[...STRIP, ...STRIP].map((src, n) => (
            <img key={n} src={src} alt="" loading="lazy" className="h-40 w-56 rounded-xl object-cover sm:h-52 sm:w-72" />
          ))}
        </motion.div>
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-start gap-6 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-4xl sm:text-6xl">Hungry already?</h2>
          <p className="mt-3 max-w-md text-lg text-ink/70">
            {slot ? (
              <>
                Order in the next few minutes and it's ready at <span className="num font-bold whitespace-nowrap text-ink">{fmtTime(slot)}</span>.
              </>
            ) : (
              'Place your order ahead and pick it up hot from reception.'
            )}
          </p>
        </div>
        <OrderNowButton to={orderLink()} big />
      </div>
    </section>
  );
}

/** On phones, keeps an Order now button in reach once the hero has scrolled away. */
function StickyOrderBar({ show, orderLink }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: '110%' }}
          animate={{ y: 0 }}
          exit={{ y: '110%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden"
        >
          <Link {...orderLink()} className="btn btn-primary w-full gap-2 text-base">
            Order now <Icon name="arrow" size={18} />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const { settings } = useEarliestPickup();
  const orderLink = useOrderLink();
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    api('/menu')
      .then(setMenu)
      .catch(() => setMenu([]));
  }, []);
  const priceOf = (name) => menu?.find((m) => m.name === name)?.price;

  const heroRef = useRef(null);
  const endRef = useRef(null);
  const heroVisible = useInView(heroRef, { margin: '0px 0px -40% 0px' });
  const endVisible = useInView(endRef);
  // Customers already have the tab bar at the bottom, so the sticky button is for visitors.
  const showSticky = !user && !heroVisible && !endVisible;

  return (
    <div className={user ? '' : 'pb-20 md:pb-0'}>
      <div ref={heroRef}>
        <Hero priceOf={priceOf} orderLink={orderLink} />
      </div>
      <MenuExplorer menu={menu} orderLink={orderLink} />
      <HowItWorks orderLink={orderLink} />
      <CookedToOrder settings={settings} />
      <FinalCall orderLink={orderLink} innerRef={endRef} />
      <footer className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-line px-4 py-10 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} Snack Shack</p>
        <p>Scan the QR code at reception to order from your phone.</p>
      </footer>
      <StickyOrderBar show={showSticky} orderLink={orderLink} />
    </div>
  );
}
