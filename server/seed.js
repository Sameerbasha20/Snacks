// Creates tables, the first admin/kitchen accounts and the sample menu (only if empty).
import { config } from './config.js';
import { ensureDb, pool } from './db.js';

await ensureDb();
await pool.end();

console.log('Database ready.');
console.log(`  Admin login:   ${config.adminEmail}`);
console.log(`  Kitchen login: ${config.kitchenEmail}`);
console.log('  Passwords come from ADMIN_PASSWORD / KITCHEN_PASSWORD (defaults are only for local testing).');
