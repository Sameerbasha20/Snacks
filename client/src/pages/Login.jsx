import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { Field, FormError, Spinner } from '../components/AuthShell';
import { homeFor, useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await login(form.email, form.password);
      const from = location.state?.from;
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
