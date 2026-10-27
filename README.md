# Concert Booking

From this folder, run:

```powershell
npm run dev
```

Open http://localhost:5173. Keep the development terminal open.
The backend automatically starts the default local MongoDB replica set on port
27018 when it is unavailable, and reuses it when it is already running.
MongoDB Community Server must be installed with `mongod` on PATH.
The same database startup is included when running `npm run dev` in the backend folder.

For a fresh checkout:

```powershell
npm run install:all
npm run setup
npm run dev
```

To populate the demo concerts and administrator, run `npm run seed` in a second
terminal after the database is ready. Administrator credentials are in
`concert-booking-tickets/backend/.env`; keep that file private.

Custom database addresses and production databases must be managed separately.
`npm start` in the backend folder starts only the API and requires a running
MongoDB replica set (or Atlas). A connection-refused error for port 27018 means
the local database is stopped; use the development command above or run
`npm run db:local` in a separate terminal.

Validation commands, with MongoDB running:

```powershell
npm test
npm run lint
npm run build
```

With the app running and demo data available, browser tests can also be run:

```powershell
npm --prefix concert-booking-tickets/backend run test:browser
```

Local payments use the development sandbox and do not charge real money.
