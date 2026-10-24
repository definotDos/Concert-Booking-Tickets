# ConcertBooking workspace

The application is inside **concert-booking-tickets/**. This workspace's `package.json` provides shortcuts so you can run commands directly from `C:\Users\HP\OneDrive\Desktop\ConcertBooking`.

Start the local database in one terminal:

```powershell
npm run db:local
```

Start the frontend and backend together in a second terminal:

```powershell
npm run dev
```

Open http://localhost:5173. Keep both terminals open. `npm run dev` checks both services first, reuses an already-running Concert API or this checkout's frontend, and starts only missing services. Running it again will not create duplicate servers. Ctrl+C stops services started by that terminal; reused services remain in their original terminals.

If a different application occupies the configured port, startup prints a clear message. Stop that application from its original terminal and retry. An older frontend started before this fix may also need one restart so it can identify itself. To start services separately, use `npm run dev:frontend` and `npm run dev:backend` in separate terminals; these direct commands do not perform the reuse checks.

Local settings are in `concert-booking-tickets/backend/.env`. Use `MONGODB_URI=mongodb://127.0.0.1:27018/concert_booking?replicaSet=rs0` for the local database helper. The frontend reads `FRONTEND_URL` for its address and `PORT` for its API proxy, keeping the ports and allowed browser origin aligned.

For a fresh installation, run `npm run install:all`, then `npm run setup`. After starting the database, run `npm run seed` to prepare the demo events and administrator.

**Fix for ENOENT:** `npm run dev --prefix frontend` works only from the inner `concert-booking-tickets` folder. From this outer workspace, use the shortcuts above or the full relative prefix `concert-booking-tickets/frontend`. The corresponding backend prefix is `concert-booking-tickets/backend`.

See [the application README](concert-booking-tickets/README.md) for configuration, administrator credentials, payments, testing, and deployment.
