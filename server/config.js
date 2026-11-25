import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import webpush from 'web-push';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
const envPath = path.join(ROOT, '.env');
const onVercel = !!process.env.VERCEL;

// Locally: .env.local (from `vercel env pull`) holds DATABASE_URL; .env holds our own secrets.
if (!onVercel) dotenv.config({ path: [path.join(ROOT, '.env.local'), envPath], quiet: true });

const REQUIRED = ['JWT_SECRET', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];

if (onVercel) {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing environment variables on Vercel: ${missing.join(', ')}`);
} else {
  // First local run: generate secrets once and keep them in .env.
  const additions = {};
  if (!process.env.JWT_SECRET) additions.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    const keys = webpush.generateVAPIDKeys();
    additions.VAPID_PUBLIC_KEY = keys.publicKey;
    additions.VAPID_PRIVATE_KEY = keys.privateKey;
  }
  if (Object.keys(additions).length) {
    const lines = Object.entries(additions).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.appendFileSync(envPath, (fs.existsSync(envPath) ? '\n' : '') + lines + '\n');
    Object.assign(process.env, additions);
  }
}

/** Best guess at the address phones on the same Wi-Fi can reach (skips VM/WSL/VPN adapters). */
export function lanIp() {
  const virtual = /vethernet|wsl|hyper-v|vmware|virtualbox|vbox|docker|loopback|tailscale|zerotier|vpn|tap|tun/i;
  const candidates = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal || i.address.startsWith('169.254')) continue;
      const score = virtual.test(name) ? 0 : /wi-?fi|wlan|wireless/i.test(name) ? 3 : /ethernet|^en|^eth/i.test(name) ? 2 : 1;
      candidates.push({ address: i.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address || 'localhost';
}

export const PORT = Number(process.env.PORT || 4000);

function defaultPublicUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return `http://${lanIp()}:${PORT}`;
}

export const config = {
  port: PORT,
  jwtSecret: process.env.JWT_SECRET,
  vapidPublic: process.env.VAPID_PUBLIC_KEY,
  vapidPrivate: process.env.VAPID_PRIVATE_KEY,
  vapidSubject: process.env.VAPID_SUBJECT || 'mailto:admin@snackshop.local',
  publicUrl: defaultPublicUrl(),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@snackshop.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  kitchenEmail: process.env.KITCHEN_EMAIL || 'kitchen@snackshop.local',
  kitchenPassword: process.env.KITCHEN_PASSWORD || 'kitchen123',
};
