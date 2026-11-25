import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthShell, { Field, FormError, Spinner } from '../components/AuthShell';
import { homeFor, useAuth } from '../lib/auth';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await register(form);
      navigate('/login', { replace: true, state: { from: location.state?.from, registeredEmail: u.email } });
    } catch (err) {
      setError(err.message);
      setShake((s) => s + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create an account" subtitle="It takes a minute. You'll use it to order and get pickup alerts." shakeKey={shake}>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name" autoComplete="name" required value={form.name} onChange={set('name')} />
        <Field label="Phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set('phone')} hint="Only used if we need to reach you about an order." />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field label="Password" type="password" autoComplete="new-password" required minLength={6} value={form.password} onChange={set('password')} hint="At least 6 characters." />
        <FormError>{error}</FormError>
        <button disabled={busy} className="btn btn-dark w-full">
          {busy ? <Spinner /> : 'Create account'}
        </button>
      </form>
      <p className="mt-8 text-ink/70">
        Already have an account?{' '}
        <Link to="/login" state={location.state} className="font-semibold text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
