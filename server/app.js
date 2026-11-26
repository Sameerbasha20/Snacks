import express from 'express';
import { ensureDb, getSettings } from './db.js';
import { ah } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import orderRoutes from './routes/orders.js';
import adminRoutes from './routes/admin.js';
import pushRoutes from './routes/push.js';
import eventRoutes from './routes/events.js';
import meRoutes from './routes/me.js';
import { SECURITY_HEADERS } from './security.js';

/** The API, shared by local `node server/index.js` and the Vercel function in api/index.js. */
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set(SECURITY_HEADERS);
  next();
});
app.use(express.json({ limit: '200kb' }));

// Make sure tables exist before any query (runs once per server instance).
app.use('/api', ah(async (req, res, next) => {
  await ensureDb();
  next();
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/settings', ah(async (req, res) => res.json(await getSettings())));
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/me', meRoutes);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Body parser errors carry parser internals in their message; replace them with plain words.
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request was not valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'The request was too large.' });
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : err.message });
});

export default app;
