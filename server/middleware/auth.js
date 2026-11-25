import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, config.jwtSecret, { expiresIn: '30d' });
}

export async function verifyToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  const user = await one('SELECT id, name, email, phone, role FROM users WHERE id = $1', [payload.id]);
  if (!user) throw new Error('User not found');
  return user;
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    req.user = await verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
  next();
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Not allowed' });
  next();
};

/** Wrap async route handlers so rejected promises reach Express's error handler. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
