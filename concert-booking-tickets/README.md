# Concert Booking Tickets

A local MERN application with a React/Vite frontend, Express API, MongoDB transactions, server-side sessions, seat holds, verified payments, QR tickets, staff admission, and role-protected administration.

The supplied workspace contained the Vite starter and an empty `Backend` directory, with no existing concert interface or application logic. The implementation lives entirely inside this folder. The unrelated empty parent `Backend` directory is untouched.

## Quick start (Windows / PowerShell)

Prerequisites: Node.js 22.12+ (tested with Node 24), npm, and MongoDB Community Server with `mongod` on PATH, or MongoDB Atlas. Transactions **require a replica set**. A standalone MongoDB service is insufficient.

```powershell
cd C:\Users\HP\OneDrive\Desktop\ConcertBooking\concert-booking-tickets
npm install
npm run install:all
cd backend
npm run setup
npm run db:local
```

Leave the database terminal open. The helper starts a separate replica set on **127.0.0.1:27018**, with its own files in `backend/.local/mongodb-27018`. It does not modify an existing service on 27017. Do not start two copies. Set `MONGO_PORT` and update `MONGODB_URI` if using another port. Local database access is bound to loopback and has no database authentication; use an authenticated Atlas/replica-set deployment in production.

In a second terminal:

```powershell
cd C:\Users\HP\OneDrive\Desktop\ConcertBooking\concert-booking-tickets\backend
npm run seed
cd ..
npm run dev
```

Open **http://localhost:5173**. The API runs at **http://localhost:4000/api**. Vite proxies `/api` so browser sessions work on one origin. `npm run dev` checks the configured ports, reuses a healthy Concert API and this checkout's identified frontend, and starts only missing services. Repeating it does not start duplicates. If an unrelated server occupies a port, stop that server in its original terminal and retry. A frontend started before this startup fix needs one restart to identify itself. Ctrl+C only stops services started in the current terminal.

`backend/.env` is the shared local configuration: `FRONTEND_URL` sets the Vite address and allowed API origin, and `PORT` sets the API port and Vite proxy target. Restart services after changing these values. Ports stay fixed so authentication and payment return URLs remain consistent. The local database helper uses port **27018**, so set `MONGODB_URI=mongodb://127.0.0.1:27018/concert_booking?replicaSet=rs0`.

To start services separately (without reuse checks):

```powershell
# Backend terminal
cd C:\Users\HP\OneDrive\Desktop\ConcertBooking\concert-booking-tickets\backend
npm run dev

# Frontend terminal (only if not already running)
cd C:\Users\HP\OneDrive\Desktop\ConcertBooking\concert-booking-tickets\frontend
npm run dev
```

`npm run setup` creates an ignored `.env` with randomly generated secrets and a random administrator password. Read `ADMIN_EMAIL` and `ADMIN_PASSWORD` in **backend/.env** to sign in after seeding. Setup never overwrites an existing `.env`. Seed never changes an existing account password. Registration creates ordinary users only; the administrator can grant staff access from Manage → Users. Keep `.env` private.

Seed synchronizes **11 development concerts**: eight bands (IV OF SPADES, BEN & BEN, THE RIDLEYS, OVER OCTOBER, CUP OF JOE, LETTERS FOR JUNE, FITTERKARMA, DECEMBER AVENUE) and three solo artists (ZACK TABUDLO, LUMI, ZILD). Re-running it does not duplicate concerts or reset seats. The original six demo events are hidden from discovery, while their existing ticket links and bookings remain accessible. All new dates, venue details and prices are illustrative, not announced events. Records are persisted in MongoDB; discovery supports artist-type filters alongside search, genre, city and sorting. Artist type can be edited in Manage, and concert artist choices are grouped into bands and solo artists. Create actual artists, venues, and draft concerts in Manage, then publish them. Image fields accept HTTPS URLs; event images are optional and use typographic artwork when absent.

## Project organization

```text
concert-booking-tickets/
  frontend/
    src/
      assets/          Original starter assets retained
      components/      Shared UI, checkout, concert editor
      context/         Session context
      hooks/           Authentication and API loading hooks
      layouts/         Shared navigation and footer
      pages/           Discover, concert, auth, tickets, staff, admin
      services/        API client, money/date formatting, ticket export
      App.css          Responsive application styles
      index.css        Typography and base controls
  backend/
    src/
      config/          Validated environment
      controllers/     Auth, public catalog, administration
      middleware/      Sessions, CSRF, roles, validation
      models/          Mongoose models and indexes
      routes/          /api endpoints
      services/        Transactional bookings, payments, tickets
      utils/           Errors, transactions, identifiers, pagination
      app.js           Express app and verified Stripe webhook
      server.js        Database startup, cleanup, graceful shutdown
    scripts/           Local environment, replica set, demo seed
    test/              Real MongoDB integration and browser tests
  .gitignore
  README.md
```

## Environment

Only the backend reads private environment variables. Frontend requests use relative `/api` URLs; no payment secret or database credential is shipped to the browser.

| Variable                        | Purpose                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                   | Required replica-set/Atlas connection string; local default `mongodb://127.0.0.1:27018/concert_booking?replicaSet=rs0` |
| `FRONTEND_URL`                  | Exact allowed origin and Stripe return URL; default `http://localhost:5173`                                            |
| `PORT`                          | API port, default `4000`                                                                                               |
| `NODE_ENV`                      | `development`, `test`, or `production`                                                                                 |
| `SESSION_DAYS`                  | Session duration, 1–30; default 7                                                                                      |
| `HOLD_MINUTES`                  | Seat reservation duration, 1–30; default 10                                                                            |
| `TICKET_SECRET`                 | Required random secret, minimum 32 characters; signs QR codes                                                          |
| `SANDBOX_SECRET`                | Required independent random secret, minimum 32 characters; signs development gateway events                            |
| `PAYMENT_PROVIDER`              | `sandbox` or `stripe`                                                                                                  |
| `STRIPE_SECRET_KEY`             | Required in Stripe mode; start with a test key                                                                         |
| `STRIPE_WEBHOOK_SECRET`         | Required in Stripe mode; signing secret for the configured endpoint                                                    |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seed-only administrator credentials; not a public registration backdoor                                                |
| `TEST_MONGODB_URI`              | Optional integration-test connection string; database name must start with `concert_booking_test`                      |

Keep the ticket signing secret stable: changing it invalidates existing QR signatures. Session cookies contain opaque random tokens; only token hashes are stored in MongoDB. Logout revokes the session, expiry is checked on every request, and user access changes revoke existing sessions.

## Booking and payment behavior

1. Browse upcoming published events, search artist/title, filter genre/city, sort, and paginate.
2. Choose up to eight available seats. Prices, fees, and totals are computed from database records on the server, in integer currency minor units.
3. A transaction creates the booking and holds all selected seats. Conflicting multi-seat requests roll back entirely. A concert revision write serializes holds, payment confirmation, ticket scans, edits, and cancellation.
4. Holds expire after the configured duration. Cleanup runs every 15 seconds and before booking/availability requests. A late payment is never allowed to claim expired/reassigned seats.
5. Checkout creates a persistent payment record. The browser cannot set an amount, claim a provider payment succeeded, or directly issue a ticket.
6. A verified successful provider event atomically marks the booking paid, sells seats, and creates one unique signed QR ticket per seat. Event identifiers, provider idempotency keys, and unique ticket indexes protect retries.
7. Tickets appear under My Tickets, refresh automatically, and download as PNG images containing the event, venue, time, category, seat, ticket/booking references, and QR.
8. Staff select the event and scan using a keyboard QR reader, or paste the ticket scanner code. HMAC validation and an atomic status change allow exactly one successful admission. Accepted and rejected attempts are recorded. Camera scanning is not implemented.

The development sandbox is an explicitly labeled provider emulator: it charges no money and lets the booking owner exercise success, pending, failure, and cancellation. It signs a server-generated notification and verifies it before processing. It is not evidence of a real payment. Production refuses to start in sandbox mode.

### Stripe test mode

Set `PAYMENT_PROVIDER=stripe`, a test `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.env`. Restart the API. Using the Stripe CLI in a separate terminal:

```powershell
stripe listen --forward-to localhost:4000/api/payments/stripe/webhook
```

Copy the webhook signing secret emitted by Stripe into the backend `.env`, then restart the API. Checkout redirects to Stripe's hosted card form. Use a test card from [Stripe's testing documentation](https://docs.stripe.com/testing). Card details never pass through this server.

The endpoint verifies the signature against the **raw request body** and checks provider session, exact amount, currency, booking state, seat ownership, hold expiry, and event status. It processes `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Success events require `payment_status=paid`; the success redirect itself grants nothing. The integration currently offers card payments only.

Stripe's checkout session can remain open beyond the shorter local seat hold. If payment completes too late, the booking enters `refund_required`, no ticket is issued, and any unfulfilled hold is released. The admin must process its refund under Manage → Bookings. This is intentionally visible rather than silently fulfilling a stale reservation. Cancellation of an event voids tickets and also queues its verified payments for administrator-initiated refunds. Refunds use provider idempotency keys and are marked refunded only after the provider reports success; a pending refund can be reconciled by retrying the action.

Provider references: [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment), [Stripe webhooks](https://docs.stripe.com/webhooks), [MongoDB atomicity and transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/).

## API

JSON requests and responses. Successful registration/login sets an HttpOnly `session` cookie and returns a `csrf` token. Authenticated mutations must include `X-CSRF-Token`. Use `/auth/me` to recover it after reloading. Production cookies are Secure and SameSite=Lax. Passwords are bcrypt-hashed with cost 12; registration requires 12 characters and at most 72 UTF-8 bytes. Authentication and API endpoints are rate-limited. All private API responses are non-cacheable.

| Method            | `/api` path                                                 | Access / function                                                                           |
| ----------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| GET               | `/health`                                                   | API readiness / selected provider                                                           |
| POST              | `/auth/register`, `/auth/login`                             | Create account / sign in                                                                    |
| GET               | `/auth/me`                                                  | Session user and CSRF token                                                                 |
| POST              | `/auth/logout`                                              | Revoke session                                                                              |
| GET               | `/concerts`                                                 | `q`, `city`, `genre`, `sort`, `page`, `limit`                                               |
| GET               | `/concerts/:id`                                             | Event and sanitized seat availability                                                       |
| POST              | `/bookings`                                                 | `{ concertId, seatIds }`, authenticated                                                     |
| GET               | `/bookings`                                                 | Own paginated booking history                                                               |
| POST              | `/bookings/:id/cancel`                                      | Release own active reservation                                                              |
| POST              | `/bookings/:id/checkout`                                    | Start/resume checkout                                                                       |
| POST              | `/bookings/:id/sandbox`                                     | Development only: `{ outcome }`                                                             |
| POST              | `/payments/stripe/webhook`                                  | Stripe signature required, no browser session                                               |
| GET               | `/tickets`, `/tickets/:id`                                  | Own tickets with QR and scanner token                                                       |
| GET               | `/staff/events`, `/staff/scans`                             | Staff/admin event and scan history                                                          |
| POST              | `/staff/verify`                                             | Staff/admin: `{ concertId, token }`                                                         |
| GET               | `/admin/stats`                                              | Booking, ticket, inventory, per-currency verified revenue, recent payments                  |
| GET               | `/admin/:resource`                                          | Concerts/artists/venues/bookings/users/payments with `q`, `status`, `sort`, `page`, `limit` |
| POST, PUT         | `/admin/concerts`, `/admin/concerts/:id`                    | Create draft / edit event and layout                                                        |
| POST              | `/admin/concerts/:id/publish`, `/admin/concerts/:id/cancel` | Lifecycle actions                                                                           |
| POST              | `/admin/bookings/:id/refund`                                | Process required refund                                                                     |
| POST, PUT, DELETE | `/admin/artists[/:id]`, `/admin/venues[/:id]`               | Directory management; referenced records cannot be deleted                                  |
| PATCH             | `/admin/users/:id`                                          | `{ role?, disabled? }`; revoke sessions                                                     |

Event details and layout are locked after any booking exists to preserve ticket consistency. Cancel and create a replacement event when a booked event needs substantive changes. Users cannot change their own access; existing administrator accounts require operator management. This prevents accidentally disabling the only administrator.

Admin list search treats text literally, including characters such as `.` and `*`. Booking/payment searches also match customer name/email and concert title. Sort values are `newest`, `oldest`, and `name` (name/title/reference/provider depending on the resource). Status values are validated per resource; user filters support active/disabled and user/staff/admin roles. Responses include the available `statuses`, matching `total`, and filtered `pages`. Referenced artist/venue deletion is transactionally serialized against concert creation to preserve relationships even when administrators act simultaneously.

## Testing

With the local replica set running:

```powershell
cd backend
npm test
```

Integration tests use actual MongoDB transactions and a **separate disposable database** named `concert_booking_test`. The suite drops only the test database and refuses names outside that prefix. It covers auth/CSRF/access, validation, browsing, full payment/ticket workflow, competing holds, atomic multi-seat failures, expired reservations, late payment after seat reassignment, duplicate notifications, failed/cancelled/pending outcomes, forged signatures/amount mismatch, wrong-event/invalid/repeated/concurrent scans, event cancellation, and refunds.

For browser tests, run the seeded development API and frontend first, with `PAYMENT_PROVIDER=sandbox` and seed administrator credentials in `.env`:

```powershell
cd backend
npm run test:browser
```

Playwright uses installed Microsoft Edge (`channel: msedge`). Change the channel in `playwright.config.js` for another installed browser, or install Playwright Chromium and remove the channel setting. Tests create a unique development customer and a paid **sandbox** booking in the development database; they do not erase existing events. They cover registration, selection, checkout, QR ticket download, staff admission/repeated scan, admin access, search empty state, and 390px mobile overflow checks. Screenshots are written to ignored `backend/.local/screenshots/`.

```powershell
# From project root
npm run lint
npm run build
```

## Deployment and operational limits

Build `frontend/dist` and serve it via HTTPS with SPA fallback to `index.html`. Reverse-proxy `/api` to the Node backend on the **same origin**. Do not expose the Vite development server in production. Run `npm start` in backend, configure the actual public `FRONTEND_URL`, set `NODE_ENV=production`, use Stripe credentials and authenticated MongoDB Atlas/replica-set credentials, and register the HTTPS webhook endpoint in Stripe. Startup validates required variables and replica-set support. Set proxy trust deliberately for the actual ingress topology before deploying behind an IP-forwarding reverse proxy; do not blindly trust all forwarding headers.

The production build, local replica-set workflow, and sandbox flow can be tested without provider credentials. Live Stripe processing, real refunds, HTTPS hosting, backup/restore, email delivery, and production load/penetration testing require your own infrastructure and operational validation. There is no email/password reset, email ticket delivery, camera QR decoder, image upload/storage, or automatic refund worker. Refunds are explicit admin actions. In-process rate limiting is suitable for a single API instance; use a shared limiter and monitoring when scaling. This is a functional local application, not a claim of production certification.
