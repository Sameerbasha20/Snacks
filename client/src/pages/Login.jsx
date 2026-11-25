import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { Field, FormError, Spinner } from '../components/AuthShell';
import { homeFor, useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registeredEmail = location.state?.registeredEmail;
  const [form, setForm] = useState({ email: registeredEmail || '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  // Also runs the moment login succeeds, so it must honour where the customer was heading.
  const from = location.state?.from;
  if (user) return <Navigate to={user.role === 'user' && from ? from : homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.email, form.password);
      navigate(u.role === 'user' && from ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Log in" subtitle="Log in to order and track your food." shakeKey={shake}>
      {registeredEmail && (
        <p role="status" className="mb-6 border-l-2 border-saffron bg-saffron/10 px-4 py-3 text-ink">
          Account created. Log in with your password to start ordering.
        </p>
      )}
      <form onSubmit={submit} className="space-y-5">
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <FormError>{error}</FormError>
        <button disabled={busy} className="btn btn-dark w-full">
          {busy ? <Spinner /> : 'Log in'}
        </button>
      </form>
      <p className="mt-8 text-ink/70">
        First time here?{' '}
        <Link to="/register" state={location.state} className="font-semibold text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
