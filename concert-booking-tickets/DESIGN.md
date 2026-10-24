# Midnight Neon design system

Implementation plan: preserve the React routes and Express/MongoDB workflows; establish shared tokens and global styles; extract reusable presentation components; refine guest discovery and customer booking; adapt administration and staff screens; validate with lint, production build, integration tests and browser workflows.

The supplied written brief is the visual reference (no moodboard image was attached). Tokens live in `frontend/src/styles/tokens.css`. Midnight Navy anchors the page, Deep Indigo anchors glass surfaces, Electric Purple identifies primary actions, Cyan identifies focus, and Pink adds concert accents. Green, amber and red indicate availability and status, always accompanied by text. Glass surfaces use 20px blur, low-opacity borders and restrained shadows. Typography uses DM Sans and Space Grotesk with system fallbacks.

Keep imagery on discovery and event headers; use calm surfaces for transactions. Reuse the shared UI components and semantic native form controls. Never put fabricated analytics or placeholder actions into operational screens. At narrow widths, navigation and tables remain keyboard accessible, seat maps scroll inside their panel, and booking summaries stack below selection. Honor reduced motion.

All concert, ticket, booking, revenue and verification data remains API-backed. Existing payment-provider and scanner capabilities are preserved.

Landing photograph: Yvette de Wit on Unsplash, https://unsplash.com/photos/group-of-people-attending-a-performance-8XLapfNMW04 (locally stored, used as atmosphere rather than event-specific imagery).

Shared React components include glass cards, statistic cards, concert cards, ticket previews, revenue charts, notices, badges, pagers, and native modal confirmation dialogs. Native inputs, selects, buttons and tables share the global token-based styles. Featured discovery cards show the next three API-listed concerts, followed by remaining upcoming events; filters search the full API catalog.

New API additions: authenticated name-only profile updates (`PATCH /auth/profile`), literal scan-reason filtering (`GET /staff/scans?q=...`), administrator-only payment event audit (`GET /admin/audit`), and 30-day verified revenue series on the existing statistics response. No payment, reservation, session or ticket-verification rules were replaced. Reports download the current statistics snapshot as CSV.
