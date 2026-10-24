# Concert Booking Tickets frontend

React/Vite frontend for Concert Booking Tickets. See [the project README](../README.md) for complete installation, database, authentication, payment, testing, and deployment instructions.

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The backend must be running on port 4000; Vite proxies `/api` to it. Do not add backend secrets to Vite environment variables.

```powershell
npm run lint
npm run build
```

The build output is `dist/`. Production hosting needs SPA fallback and a same-origin `/api` reverse proxy. All concert, ticket, booking, and administration data comes from the backend.
