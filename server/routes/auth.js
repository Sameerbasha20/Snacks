import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getSettings, makeReferralCode, nowIso, one, tx } from '../db.js';
import { addCredit } from '../rewards.js';
import { ah, requireAuth, signToken } from '../middleware/auth.js';
import { clear, clientIp, limit, record } from '../security.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post(
  '/register',
  ah(async (req, res) => {
    const ip = clientIp(req);
    // Generous enough for a queue of customers on the shop's Wi-Fi, low enough to stop scripted sign-ups.
    await limit(`register:${ip}`, 20, 60, 'Too many new accounts from this network. Please try again in an hour.');
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Please enter your name (up to 60 characters)' });
    if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (!/^[0-9+\-\s]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Please enter a valid phone number' });
    if (password.length < 6 || password.length > 72) return res.status(400).json({ error: 'Password must be 6 to 72 characters' });
    if (await one('SELECT 1 FROM users WHERE email = $1', [email])) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
    }
    // One account per phone number: stops opening many accounts to collect referral credit.
    const digits = phone.replace(/\D/g, '').slice(-10);
    if (await one("SELECT 1 FROM users WHERE role = 'user' AND right(regexp_replace(phone, '\\D', '', 'g'), 10) = $1", [digits])) {
      return res.status(409).json({ error: 'An account with this phone number already exists. Try logging in.' });
    }
    await record(`register:${ip}`);
    const passwordHash = await bcrypt.hash(password, 10);
    // Optional referral code from a friend: the new customer gets welcome credit straight away.
    const refCode = String(req.body.referral_code || '').trim().toUpperCase();
    let referrer = null;
    if (refCode) {
      referrer = await one("SELECT id, name FROM users WHERE referral_code = $1 AND role = 'user'", [refCode]);
      if (!referrer) return res.status(400).json({ error: "That referral code doesn't exist. Check it or leave it empty." });
    }
    const { referral_amount } = await getSettings();
    const row = await tx(async (client) => {
      const r = await one(
        "INSERT INTO users (name, email, phone, password_hash, role, created_at, referral_code, referred_by) VALUES ($1, $2, $3, $4, 'user', $5, $6, $7) RETURNING id",
        [name, email, phone, passwordHash, nowIso(), await makeReferralCode(name, client), referrer?.id ?? null],
        client
      );
      if (referrer) await addCredit(client, r.id, referral_amount, `Welcome credit from ${referrer.name.split(' ')[0]}'s referral`);
      return r;
    });
    // No token here: new customers log in themselves after creating an account.
    res.status(201).json({ user: { id: row.id, name, email, phone, role: 'user' } });
  })
);

router.post(
  '/login',
  ah(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 254);
    const password = String(req.body.password || '').slice(0, 200);
    const ip = clientIp(req);
    // Password guessing: 8 wrong tries per account, or 50 per network, then a 15-minute pause.
    await limit(`login-fail:${email}`, 8, 15, 'Too many wrong passwords. Wait 15 minutes and try again.');
    await limit(`login-fail-ip:${ip}`, 50, 15, 'Too many failed logins from this network. Wait 15 minutes and try again.');
    const row = await one('SELECT * FROM users WHERE email = $1', [email]);
    // Always run bcrypt, so an unknown email takes as long as a wrong password (no account discovery by timing).
    const ok = await bcrypt.compare(password, row?.password_hash || DUMMY_HASH);
    if (!row || !ok) {
      await Promise.all([record(`login-fail:${email}`), record(`login-fail-ip:${ip}`)]);
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    await clear(`login-fail:${email}`);
    const user = { id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role };
    res.json({ token: signToken(user), user });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
