import { useState } from 'react';
import { motion } from 'motion/react';
import Icon from './Icon';

/** Two-column auth layout: form on the left, a food photo on wide screens. */
export default function AuthShell({ title, subtitle, children, shakeKey }) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] lg:grid-cols-2">
      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <motion.div
          key={shakeKey}
          initial={shakeKey ? false : { opacity: 0, y: 12 }}
          animate={shakeKey ? { x: [0, -8, 8, -5, 5, 0] } : { opacity: 1, y: 0 }}
          transition={{ duration: shakeKey ? 0.35 : 0.4 }}
          className="w-full max-w-sm"
        >
          <h1 className="text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-3 text-ink/70">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </motion.div>
      </div>
      <div className="relative hidden lg:block">
        <img src="/images/chai.jpg" alt="Masala chai with rusks" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  );
}

export function Field({ label, hint, ...props }) {
  if (props.type === 'password') return <PasswordField label={label} hint={hint} {...props} />;
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...props} />
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

/** Password input with an eye button to show what was typed (handy on phones and when pasting). */
export function PasswordField({ label, hint, className = 'input', ...props }) {
  const [show, setShow] = useState(false);
  const input = (
    <span className="relative block">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-12`} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink/55 hover:text-ink"
      >
        <Icon name={show ? 'eye-off' : 'eye'} size={20} />
      </button>
    </span>
  );
  if (!label) return input;
  return (
    <label className="block">
      <span className="label">{label}</span>
      {input}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <motion.p role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="border-l-2 border-saffron pl-3 text-sm font-semibold">
      {children}
    </motion.p>
  );
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-label="Loading" />;
}
