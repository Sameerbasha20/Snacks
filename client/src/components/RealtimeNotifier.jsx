import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth';
import { useSocketEvent } from '../lib/socket';
import { STATUS_META } from '../lib/api';
import { chime, showLocalNotification } from '../lib/notify';

/** App-wide listener that tells customers when their order changes. */
export default function RealtimeNotifier() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isCustomer = user?.role === 'user';

  useSocketEvent('order:ready', (order) => {
    if (!isCustomer || order.user_id !== user.id) return;
    chime('ready');
    toast(
      (t) => (
        <button
          className="text-left"
          onClick={() => {
            toast.dismiss(t.id);
            navigate(`/orders/${order.id}`);
          }}
        >
          <b>Order {order.id} is ready</b>
          <br />
          <span className="text-sm">Collect it from the counter.</span>
        </button>
      ),
      { duration: 12000, style: { background: '#E8772E', color: '#1C1A17' } }
    );
    if (document.hidden) {
      showLocalNotification(`Order ${order.id} is ready`, 'Collect it from the counter.', `/orders/${order.id}`, `order-${order.id}`);
    }
  });

  useSocketEvent('order:updated', (order) => {
    if (!isCustomer || order.user_id !== user.id || order.status === 'ready') return;
    toast(`Order ${order.id}: ${STATUS_META[order.status].label.toLowerCase()}`);
  });

  return null;
}
