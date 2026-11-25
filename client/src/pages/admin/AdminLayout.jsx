import { NavLink, Outlet } from 'react-router-dom';
import { motion } from 'motion/react';

const LINKS = [
  ['/admin', 'Today'],
  ['/admin/orders', 'Orders'],
  ['/admin/reports', 'Sales reports'],
  ['/admin/menu', 'Menu'],
  ['/admin/settings', 'Opening hours & rules'],
  ['/admin/staff', 'Staff'],
  ['/admin/qr', 'QR code'],
];

export default function AdminLayout() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-8 pb-32 sm:px-6 md:flex-row md:gap-12">
      <aside className="md:w-52 md:shrink-0">
        <nav className="-mx-4 flex gap-5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] md:sticky md:top-24 md:mx-0 md:flex-col md:gap-1 md:border-0 md:px-0">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/admin'} className="relative shrink-0 py-3 md:py-2">
              {({ isActive }) => (
                <>
                  <span className={`font-semibold whitespace-nowrap ${isActive ? 'text-ink' : 'text-muted hover:text-ink'}`}>{label}</span>
                  {isActive && (
                    <motion.span layoutId="admin-mark" className="absolute inset-x-0 bottom-0 h-0.5 bg-ink md:inset-x-auto md:top-2 md:bottom-2 md:-left-3 md:h-auto md:w-0.5" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
