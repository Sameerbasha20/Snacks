import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { useCart } from '../lib/cart';
import { money } from '../lib/api';
import { enableNotifications, notificationState } from '../lib/notify';
import Icon from './Icon';

function linksFor(role) {
  if (role === 'user') return [['/menu', 'Menu'], ['/orders', 'My orders']];
  if (role === 'kitchen') return [['/kitchen', 'Kitchen']];
  if (role === 'admin') return [['/admin', 'Admin'], ['/kitchen', 'Kitchen']];
  return [];
}

function CartButton() {
  const { count, total, setOpen } = useCart();
  return (
    <button onClick={() => setOpen(true)} className="btn btn-dark gap-2.5 px-3.5" aria-label={`Cart, ${count} items`}>
      <Icon name="cart" size={18} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={count} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="num">
          {count > 0 ? money(total) : 'Cart'}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function NotifyButton() {
  const [state, setState] = useState(notificationState());
  if (state === 'unsupported' || state === 'granted') return null;
  return (
    <button
      onClick={async () => {
        const res = await enableNotifications();
        setState(res);
        if (res === 'granted') toast.success("Notifications on. We'll tell you when your food is ready.");
        else toast('Notifications are off. Keep the order page open to see updates.');
      }}
      className="btn btn-quiet hidden text-sm sm:inline-flex"
    >
      <Icon name="bell" size={16} /> Turn on alerts
    </button>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const links = linksFor(user?.role);
  const isKitchen = pathname.startsWith('/kitchen');

  return (
    <>
    <header className={`sticky top-0 z-40 border-b ${isKitchen ? 'border-white/10 bg-ink text-paper' : 'border-line bg-paper/95 backdrop-blur'}`}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="text-[1.2rem] font-extrabold tracking-tight">
          Snack Shack
        </Link>

        <div className="hidden gap-5 md:flex">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className="relative py-1 text-[0.95rem] font-semibold">
              {({ isActive }) => (
                <>
                  <span className={isActive ? '' : 'opacity-60 hover:opacity-100'}>{label}</span>
                  {isActive && <motion.span layoutId="nav-underline" className="absolute inset-x-0 -bottom-[1.3rem] h-0.5 bg-saffron" />}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {user?.role === 'user' && <NotifyButton />}
          {user?.role === 'user' && <CartButton />}
          {user ? (
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className={`btn btn-quiet text-sm ${isKitchen ? '!text-paper/70' : ''}`}
            >
              Log out
            </button>
          ) : (
            !['/login', '/register'].includes(pathname) && (
              <Link to="/login" className="btn btn-outline min-h-10">
                Log in
              </Link>
            )
          )}
        </div>
      </nav>

    </header>

      {/* Mobile tab bar lives outside the header: the header's backdrop-filter would trap position:fixed */}
      {links.length > 1 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className="relative flex-1 py-3.5 text-center text-sm font-semibold">
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-ink' : 'text-muted'}>{label}</span>
                  {isActive && <motion.span layoutId="tab-line" className="absolute inset-x-8 top-0 h-0.5 bg-saffron" />}
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}
