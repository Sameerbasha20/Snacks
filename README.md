# Snack Shack: pre-order website

Customers scan a QR code at the counter, register, and order snacks, drinks and meals at least an hour ahead.
Orders appear on the kitchen screen; when the kitchen marks one ready, the customer is alerted to collect it.

## Roles
| Role | What they can do |
|---|---|
| **Customer** | Registers, orders with a pickup time at least an hour ahead, follows the order live, cancels before the cancel deadline |
| **Kitchen** | Kitchen screen: Accept, Start cooking, Mark ready (alerts the customer), Collected |
| **Admin** | Everything the kitchen can do, plus editing any order (items, pickup time, status, **cancel deadline**), the menu, opening hours and rules, staff accounts, and the QR code poster |

## Hosting (Vercel + Neon)
- The website and API run on Vercel. `api/index.js` serves every `/api/*` request; the React app is built from `client/`.
- Data lives in **Neon Postgres**, connected through the Vercel Marketplace (sets `DATABASE_URL`).
- Tables, the first admin/kitchen accounts and the sample menu are created automatically on the first request.
- Live updates: pages check `/api/events` every few seconds (every 15 s when the tab is in the background).
- "Food is ready" phone notifications use Web Push and work on HTTPS (Vercel provides it).

Production environment variables (Vercel → Project → Settings → Environment Variables):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Added by the Neon integration |
| `JWT_SECRET` | Signs login sessions |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Web Push notification keys |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First admin account (default email `admin@snackshop.local`) |
| `KITCHEN_EMAIL`, `KITCHEN_PASSWORD` | First kitchen account (default email `kitchen@snackshop.local`) |
| `SHOP_TZ` | Shop timezone for opening hours, default `Asia/Kolkata` |
| `PUBLIC_URL` | Optional: address printed in the QR code (defaults to the Vercel production URL) |

Deploy a new version: `vercel --prod` from this folder.

## Run locally
Requires Node.js 20+ and the Neon `DATABASE_URL`:

```bash
npm run setup                # install everything
vercel env pull .env.local   # fetch DATABASE_URL (or put it in .env)
npm run build && npm start   # http://localhost:4000
```

`npm run dev` gives hot reload (website on :5173, API on :4000). Local secrets are generated into `.env` on first run.

## Rules
- Lead time (default 60 min), opening hours and the default cancel window (30 min before pickup) are in Admin → Opening hours & rules.
- The server enforces every rule, so the one-hour rule and cancel deadline can't be bypassed.
- Prices always come from the menu on the server. Payment is at the counter.

## Photos
Sample menu photos are free Unsplash images in `client/public/images/` (credits in `CREDITS.md` there).
Replace them from Admin → Menu by pasting a link into **Photo link**.
