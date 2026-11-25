import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nowIso, one } from '../db.js';
import { ah, requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  ah(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your name' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (!/^[0-9+\-\s]{7,15}$/.test(phone)) return res.status(400).json({ error: 'Please enter a valid phone number' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await one('SELECT 1 FROM users WHERE email = $1', [email])) {
      return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
    }
    const row = await one(
      "INSERT INTO users (name, email, phone, password_hash, role, created_at) VALUES ($1, $2, $3, $4, 'user', $5) RETURNING id",
      [name, email, phone, bcrypt.hashSync(password, 10), nowIso()]
    );
    const user = { id: row.id, name, email, phone, role: 'user' };
    res.status(201).json({ token: signToken(user), user });
  })
);

router.post(
  '/login',
  ah(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const row = await one('SELECT * FROM users WHERE email = $1', [email]);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    const user = { id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role };
    res.json({ token: signToken(user), user });
  })
);

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
