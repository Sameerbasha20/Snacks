import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';

function Row({ label, hint, children }) {
  return (
    <div className="grid gap-3 py-5 sm:grid-cols-[1fr_200px] sm:items-center sm:gap-8">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-0.5 text-sm text-ink/65">{hint}</p>
      </div>
      {children}
    </div>
  );
}

export default function Settings() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/settings').then(setS).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      setS(await api('/admin/settings', { method: 'PUT', body: s }));
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!s) return <div className="shimmer h-80 rounded-lg" />;
  const set = (k) => (e) => setS({ ...s, [k]: e.target.value });

  return (
    <div>
      <h1 className="text-4xl">Opening hours & rules</h1>
      <form onSubmit={save} className="mt-6 max-w-2xl divide-y divide-line border-y border-line">
        <Row label="Shop name" hint="Printed on the QR code poster.">
          <input className="input" value={s.shop_name} onChange={set('shop_name')} />
        </Row>
        <Row label="First pickup" hint="The earliest time customers can collect.">
          <input className="input" type="time" value={s.open_time} onChange={set('open_time')} />
        </Row>
        <Row label="Last pickup" hint="The latest time customers can collect.">
          <input className="input" type="time" value={s.close_time} onChange={set('close_time')} />
        </Row>
        <Row label="Order ahead by" hint="Minutes between ordering and the earliest pickup. Gives the kitchen time to cook.">
          <input className="input" type="number" min="0" value={s.min_lead_minutes} onChange={set('min_lead_minutes')} />
        </Row>
        <Row label="Free cancellation until" hint="Minutes before pickup. You can change it for a single order from Orders.">
          <input className="input" type="number" min="0" value={s.default_cancel_before_minutes} onChange={set('default_cancel_before_minutes')} />
        </Row>
        <div className="py-5">
          <button disabled={busy} className="btn btn-dark">
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
