# Saffra — Restaurant Operating System

**Every table, in tune.** Tables, kitchen and payments — in one flow.

Saffra is a complete restaurant POS: table management, an order workspace built
for a sub-60-second waiter workflow, a server-side billing engine, a kitchen
display system, a Razorpay/Demo payment provider abstraction, receipts,
staff/menu management, manager-facing reports, a guided first-run onboarding
wizard, and an interactive product tour.

It's **local-first by design**: install it on one computer in the restaurant
and it runs its own server and database right there — no cloud account, no
monthly bill, no internet connection required to take an order. Every other
device (a waiter's phone, a tablet, the billing counter) just opens a browser
to that computer's address on the same Wi-Fi.

- 🖥️ **Desktop app**: [`apps/desktop`](apps/desktop) — Electron wrapper,
  packaged as a Windows installer via GitHub Actions.
- 🌐 **Marketing site + download page**: [`apps/website`](apps/website) —
  a plain static site, deployed on Vercel with the project's Root Directory
  set to `apps/website`.
- 📱 **Mobile app (Expo Go)**: [`mobile`](mobile) — a React Native demo of the
  whole product with all data stored locally on the phone. Run
  `npm run mobile:install && npm run mobile`, then scan the QR code with Expo
  Go. See [`mobile/README.md`](mobile/README.md). It is deliberately *not* an
  npm workspace, so it doesn't affect the desktop build or CI.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, Recharts, Socket.IO client |
| Backend | Node.js, Express, TypeScript, Zod, Socket.IO, JWT (access + refresh rotation) |
| Database | **SQLite**, embedded, via Prisma ORM — one file per install, no separate DB server |
| Desktop shell | Electron + electron-builder (NSIS installer for Windows) |
| Payments | Provider abstraction — `DemoPaymentProvider` (works instantly, no keys) and `RazorpayPaymentProvider` (real Razorpay Orders API + signature verification), switched purely by environment variables |
| Monorepo | npm workspaces — `apps/web`, `apps/api`, `apps/desktop`, `apps/website`, `packages/types`, `packages/config`, `packages/ui` |

## Project layout

```
/apps
  /web       React frontend (Vite) — served statically by the API in production
  /api       Express backend (REST + Socket.IO), embedded SQLite via Prisma
  /desktop   Electron main process + electron-builder packaging config
  /website   Static marketing site + download page (deployed on Vercel)
/packages
  /types     Shared enums & DTOs (single source of truth for status unions)
  /config    Shared brand tokens & constants
  /ui        Shared design-system components (Button, Card, DataTable, Modal, Toaster, ...)
.github/workflows
  build-desktop.yml    Builds, tests, and releases the Windows installer
.env.example
```

## How it's served

The API (`apps/api`) binds to `0.0.0.0` and serves **both** the REST/Socket.IO
API and the built frontend (`apps/web/dist`) from a single port. That's what
makes the LAN story work: a waiter's phone opens
`http://<host-computer's-LAN-IP>:4000` and gets the whole app — no separate
web server, no CORS to configure, no second thing to install. Settings shows
that address (and Wi-Fi QR-style copy button) once the app is running.

In the packaged desktop app, `apps/desktop`'s Electron main process forks the
built API server as a child process, pointing `DATABASE_URL` at a SQLite file
in the OS's per-user app-data folder and `WEB_DIST_PATH` at the bundled
frontend, then opens a window loading `http://localhost:4000`. Closing the
window keeps the app running in the system tray — other devices on the Wi-Fi
may still be using it.

## Quick start (development)

```bash
npm install
npm run db:generate --workspace apps/api
npm run db:migrate --workspace apps/api   # creates apps/api/prisma/dev.db
npm run db:seed --workspace apps/api      # optional demo data + logins
npm run dev
```

`npm run dev` runs the API (`:4000`) and the Vite dev server (`:5173`)
together — Vite's dev server proxies `/api` and `/socket.io` to the API dev
server (see `apps/web/vite.config.ts`), so the frontend's own code never
needs to know it's talking to a different port in dev vs. a single port in
production.

On a **brand-new** database (no seed data), the app shows the first-run
onboarding wizard (`/onboarding`) instead of the login screen — restaurant
details, tax rates, your admin login, table count, and an optional starter
menu. `npm run db:seed` is a shortcut for local development that skips the
wizard and drops you straight into a fully-populated demo restaurant.

### Building the desktop installer locally

```bash
cd apps/api && npm run build && cd ../web && npm run build && cd ../desktop
npm run prepare:resources   # stages a self-contained resources-staging/api/
npm run dist:win            # -> apps/desktop/release/Saffra-Setup.exe
```

`prepare:resources` builds a standalone `node_modules` for the API's runtime
dependencies (separate from this monorepo's hoisted workspace
`node_modules`) plus the Prisma schema/migrations and the generated Prisma
client (including its native query engine binary) — everything
electron-builder needs to copy into the packaged app's `resources/api/`
folder as one self-contained unit. See `apps/desktop/scripts/prepare-resources.mjs`.

## Demo credentials

(Only present after `npm run db:seed` — a real install starts from the
onboarding wizard instead.)

| Role | Employee ID | Password |
|---|---|---|
| Waiter | `WTR001` | `password123` |
| Cashier | `CSH001` | `password123` |
| Manager | `MGR001` | `password123` |
| Admin | `ADM001` | `password123` |

## The golden path

```
First run  → Onboarding wizard → Restaurant, tax, admin login, tables, menu
           → Live! Wi-Fi address shown → connect other devices

Every day  → Login → Select Table → Browse Menu → Add Items → Adjust Quantity
           → Add Notes → Review Bill → Confirm → Send to Kitchen
           → Kitchen prepares → Served → Proceed to Payment
           → Demo/Razorpay Checkout → Payment Verified → Receipt
           → Order Completed
```

Every step above is a real, working screen — there are no placeholder pages.

## Payments: Demo vs. Razorpay

The backend picks a payment provider purely from environment variables
(`apps/api/src/modules/payments/providers/index.ts`):

- **No `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` set** → `DemoPaymentProvider`.
  The frontend renders an in-app "Demo Payment Environment" checkout
  (UPI/Card/Net Banking/Wallet/QR simulation, with explicit Simulate
  Success/Failure/Pending controls) and never loads Razorpay's `checkout.js`.
- **Both are set** → `RazorpayPaymentProvider`. The exact same
  `POST /api/payments/create` → `POST /api/payments/verify` contract is used,
  but the frontend now dynamically loads the real `checkout.js` and opens
  Razorpay's Standard Checkout. Signature verification (`crypto.createHmac`)
  happens server-side only — the frontend never sees the key secret, and a
  payment is only marked `PAID` after that verification succeeds.

No frontend code changes or redeploys are needed to switch — see
`apps/web/src/lib/razorpayLoader.ts`.

## Customer identification & self-serve payment links

Seating a table at an `AVAILABLE`/`RESERVED` table first opens a customer
lookup (`CustomerLookupModal`): enter a phone number and the app either
recognizes a returning customer (name + visit count + their last order, for
context) or asks for a name once to remember them next time. This is
optional — "Skip — seat as walk-in" bypasses it entirely.

From the Payments queue, staff can generate a public, unauthenticated
**payment link** (`POST /api/orders/:id/payment-link`) for any order that's
ready to be paid. That link (`/pay/:token` on the frontend) opens a
customer-facing page — no login, just the itemized bill and the same real
Demo/Razorpay checkout UI — so the customer can pay from their own phone
(while on the restaurant's Wi-Fi). Every `/api/pay/:token/*` route resolves
and validates the token itself (never trusts a JWT) and double-checks that
any `paymentId` passed in actually belongs to that token's order, so one
customer's link can never be used to touch another order's payment (see
`tests/publicPay.test.ts`).

Actually delivering that link over WhatsApp/SMS isn't wired to a real
provider — the "Send Payment Link" flow simulates it with a convincing
phone/WhatsApp mockup (`WhatsAppSendModal`), while a real "Copy Link" action
lets staff actually share it any way they like today.

## Kitchen Display

Beyond the four-column NEW → ACCEPTED → PREPARING → READY board: a header
strip shows live Active/Avg-wait/Urgent counts, each ticket surfaces the
customer's name when known, a short Web Audio chime plays when a new ticket
arrives (no external asset — synthesized in-browser), and every ticket past
the first column gets a **Recall** (undo) button. Each order line tracks its
own `kitchenStatus` (`PENDING` → `FIRED` → `SERVED`), so nothing reaches the
kitchen just from being added to a cart — a waiter explicitly sends it — and
a repeat order (customer wants another round) only ever shows the kitchen
what's actually new, never re-firing food that's already been delivered.

## Onboarding wizard & product tour

- `GET /api/setup/status` / `POST /api/setup/complete` — a brand-new install
  has no restaurant/admin account yet, so every route redirects to
  `/onboarding` until this completes (see
  `apps/web/src/components/onboarding/OnboardingGate.tsx`). Completing it
  creates the restaurant, tax config, the first admin login, the table
  layout, an optional starter menu, and logs that admin straight in.
- A live, spotlighted product tour (`apps/web/src/components/tour/ProductTour.tsx`)
  auto-shows the first time any staff account signs in — it actually
  navigates through Dashboard, Tables, Kitchen, Payments, Reports, etc. and
  highlights the real, live content on each page, filtered to whatever that
  person's role can see. Tracked server-side (`User.tourCompletedAt`), so it
  follows a person across devices and only shows once. Replayable any time
  from Settings.

## Testing

```bash
npm run test --workspace apps/api
```

39 Vitest tests covering: the billing engine (subtotal/GST/service
charge/discount/round-off math), JWT sign/verify + refresh rotation, RBAC
middleware, the Demo payment provider's success/failure/pending flows,
Razorpay HMAC signature verification (accepts a valid signature, rejects a
tampered one), receipt HTML/PDF rendering, customer phone normalization, the
public payment-link token flow (including the cross-order security check —
a token can never be used to touch a different order's payment), and a full
order-lifecycle integration test (draft → confirmed → kitchen → preparing →
ready → served → payment pending → paid → completed, including the
kitchen-status-aware repeat-order behavior) run against an in-memory fake
Prisma client (`tests/helpers/fakePrisma.ts`) — no live database required.

## Environment variables

See `.env.example` for the full list. Key ones:

- `DATABASE_URL` — SQLite file path, e.g. `file:./dev.db` (Prisma). The
  packaged desktop app sets this automatically to a file in the OS's
  per-user app-data folder.
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — sign the access/refresh JWTs.
  The packaged desktop app generates and persists its own random secrets per
  install on first run (`apps/desktop/src/main.ts`) rather than shipping a
  shared secret baked into the binary.
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` —
  leave blank to stay in Demo Payment Mode.
- `PORT` / `WEB_DIST_PATH` — the single port Saffra serves everything on, and
  where the built frontend lives. Not needed for local `npm run dev`.

## CI/CD

- **Desktop app — GitHub Actions** (`.github/workflows/build-desktop.yml`):
  on a `v*` tag push, builds the API, web, and Electron app, runs the
  backend test suite, and publishes `Saffra-Setup.exe` as a GitHub Release
  asset (a fixed filename, so the website's download link always points at
  the latest build without needing to be updated). A manual
  `workflow_dispatch` run builds and uploads a workflow artifact instead,
  without cutting a release.
- **Website — Vercel**: import the GitHub repo into Vercel once, then in
  **Project Settings → General → Root Directory**, set it to `apps/website`
  and save. It's a plain static site (no framework, no build step) — Vercel
  detects that automatically and just serves the files. `apps/website/vercel.json`
  only sets clean URLs. It redeploys automatically on every push to `main`.

## Security notes

JWT auth with refresh-token rotation and revocation, bcrypt password
hashing, RBAC middleware per route, Zod validation on every mutating
endpoint, Helmet + rate limiting, all billing math computed server-side
only, idempotent payment verification (a captured payment can be
re-verified safely, e.g. a duplicate webhook, without double-charging or
re-generating a receipt), a per-install random JWT secret (never a value
shared across every copy of the app), and an audit log covering
order/payment/discount/staff/onboarding actions.
