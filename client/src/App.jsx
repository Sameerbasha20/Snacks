import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import Navbar from './components/Navbar';
import CartDrawer from './components/CartDrawer';
import Protected from './components/Protected';
import RealtimeNotifier from './components/RealtimeNotifier';
import Page from './components/Page';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Menu from './pages/Menu';
import Checkout from './pages/Checkout';
import MyOrders from './pages/MyOrders';
import OrderTrack from './pages/OrderTrack';
import KitchenBoard from './pages/kitchen/KitchenBoard';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import AdminOrders from './pages/admin/AdminOrders';
import MenuManager from './pages/admin/MenuManager';
import Settings from './pages/admin/Settings';
import Staff from './pages/admin/Staff';
import QrCode from './pages/admin/QrCode';

export default function App() {
  const location = useLocation();
  // Admin sub-pages animate inside their own layout, so key the top level by section.
  const section = location.pathname.startsWith('/admin') ? '/admin' : location.pathname;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <>
      <Navbar />
      <RealtimeNotifier />
      <CartDrawer />
      <AnimatePresence mode="wait">
        <Routes location={location} key={section}>
          <Route path="/" element={<Page><Landing /></Page>} />
          <Route path="/login" element={<Page><Login /></Page>} />
          <Route path="/register" element={<Page><Register /></Page>} />
          <Route path="/menu" element={<Protected roles={['user']}><Page><Menu /></Page></Protected>} />
          <Route path="/checkout" element={<Protected roles={['user']}><Page><Checkout /></Page></Protected>} />
          <Route path="/orders" element={<Protected roles={['user']}><Page><MyOrders /></Page></Protected>} />
          <Route path="/orders/:id" element={<Protected><Page><OrderTrack /></Page></Protected>} />
          <Route path="/kitchen" element={<Protected roles={['kitchen', 'admin']}><Page><KitchenBoard /></Page></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><Page><AdminLayout /></Page></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="menu" element={<MenuManager />} />
            <Route path="settings" element={<Settings />} />
            <Route path="staff" element={<Staff />} />
            <Route path="qr" element={<QrCode />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}
