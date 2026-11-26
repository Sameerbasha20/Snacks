import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import Modal from '../../components/Modal';
import { PasswordField } from '../../components/AuthShell';

const EMPTY = { name: '', email: '', phone: '', password: '', role: 'kitchen' };
const ROLE_LABEL = { kitchen: 'Kitchen', delivery: 'Delivery', admin: 'Admin' };

export default function Staff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);

  const load = async () => {
    const all = await api('/admin/users');
    setStaff(all.filter((u) => u.role !== 'user'));
    setCustomers(all.filter((u) => u.role === 'user'));
  };
  useEffect(() => {
    load().catch(() => {});
  }, []);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/admin/users', { method: 'POST', body: form });
      toast.success(`${ROLE_LABEL[form.role]} account created for ${form.name}`);
      setForm(EMPTY);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      await api(`/admin/users/${removing.id}`, { method: 'DELETE' });
      toast(`${removing.name}'s account removed`);
      setRemoving(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <h1 className="text-4xl">Staff</h1>
      <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <h2 className="text-xl">Team</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {staff?.map((u) => (
              <li key={u.id} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {u.name} {u.id === user.id && <span className="font-normal text-muted">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-ink/60">{u.email}</p>
                </div>
                <span className="text-sm font-semibold">{ROLE_LABEL[u.role]}</span>
                {u.id !== user.id && (
                  <button onClick={() => setRemoving(u)} className="btn btn-quiet text-sm text-muted">
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>

          <h2 className="mt-12 text-xl">Customers ({customers.length})</h2>
          {customers.length === 0 ? (
            <p className="mt-3 text-ink/65">Customers appear here after they sign up.</p>
          ) : (
            <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto border-y border-line">
              {customers.map((c) => (
                <li key={c.id} className="flex justify-between gap-4 py-2.5">
                  <span>{c.name}</span>
                  <span className="num text-ink/60">{c.phone}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={add} className="panel h-fit space-y-4 p-5">
          <h2 className="text-xl">Add a team member</h2>
          <fieldset>
            <legend className="label">Role</legend>
            <div className="grid grid-cols-3 gap-2">
              {['kitchen', 'delivery', 'admin'].map((r) => (
                <label key={r} className={`cursor-pointer rounded-lg border-[1.5px] p-3 ${form.role === r ? 'border-ink' : 'border-line'}`}>
                  <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} className="sr-only" />
                  <span className="block font-semibold">{ROLE_LABEL[r]}</span>
                  <span className="block text-xs text-ink/60">{{ kitchen: 'Kitchen screen only', delivery: 'Delivery screen only', admin: 'Everything' }[r]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="label">Name</span>
            <input className="input" required value={form.name} onChange={set('name')} />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" required value={form.email} onChange={set('email')} />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <PasswordField type="password" autoComplete="new-password" minLength={6} required value={form.password} onChange={set('password')} />
          </label>
          <button disabled={busy} className="btn btn-dark w-full">
            Create account
          </button>
        </form>
      </div>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Remove ${removing?.name ?? ''}?`}>
        <p className="text-ink/75">They won't be able to log in any more.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setRemoving(null)} className="btn btn-outline flex-1">
            Keep
          </button>
          <button onClick={remove} className="btn btn-dark flex-1">
            Remove account
          </button>
        </div>
      </Modal>
    </div>
  );
}
