# Verification report

Verified locally on 22 October 2026 with Node.js 24, MongoDB 8.3 (isolated replica set on port 27018), and headless Microsoft Edge.

- **18 backend integration tests passed** against real MongoDB, including transactional conflicts and Stripe SDK signature verification.
- **4 browser tests passed**: customer-to-staff booking journey, responsive/mobile behavior, and administrator creation/edit/publish/cancel workflow.
- **Frontend lint and production build passed.**

The browser workflow exercised registration, seat selection, reservation countdown, sandbox payment, QR ticket generation, ticket PNG download, booking-history tabs, event-specific staff verification, rejection of repeat entry, and admin access. Mobile tests checked discovery, search empty states, seat-map scrolling, and login at a 390px viewport.

Backend cases cover unauthenticated access, role enforcement, CSRF, invalid input, wrong passwords, duplicate registrations, forbidden origins, private ticket ownership, simultaneous seat holds, all-or-nothing multi-seat booking, expired holds, late payment after seat reassignment, refunds, failed/cancelled/pending payments, invalid QR signatures, wrong-event tickets, concurrent scans, cancellation, and verified revenue totals. Stripe webhook tests use the actual Stripe SDK with locally generated test signatures: they verify raw payload handling, signature rejection, unpaid status, session/amount/currency matching, and idempotent ticket creation.

Issues found and fixed during verification:

- Multiple ticket documents in a Mongoose transaction required ordered creation.
- The seat panel needed a constrained minimum width to keep mobile overflow inside the scrollable seat map.
- Data-loading state needed to be scoped to each endpoint so switching between tickets and booking history did not briefly render the wrong response shape.
- The staff event selector needed an explicit accessible label.
- Seat selection now explains the eight-seat limit and allows recovery after a reservation conflict.
- Admin lists now support server-side search, status filtering, stable sorting, and filtered pagination. Booking/payment searches include customer and concert details.
- Artist/venue deletion and concert creation now contend on the same directory document inside transactions, preventing dangling references under concurrent requests.
- Seat labels use category names rather than category positions, preserving VIP/Lower Box/Upper Box prefixes when categories are reordered or omitted.

Additional regression tests cover literal search escaping, invalid filters, filtered counts, concurrent directory deletion versus concert creation, session revocation after role/disabled changes, disabled-account login rejection, and logout. Browser administration tests also exercise search, status, sorting, empty results, and reset.

The existing standalone MongoDB service on port 27017 and existing Vite server were not replaced. Test database names begin with `concert_booking_test`; these disposable databases are reset by the integration suite. Browser tests intentionally leave clearly named QA records and sandbox purchases in the local development database.

**Not verified:** actual Stripe-hosted checkout with account credentials, external Stripe refund processing, deployment, real money, camera scanning, production scale, backup recovery, or penetration testing. The local sandbox is a payment emulator, not a real payment network. Configure Stripe test credentials and complete a provider test checkout before enabling live payments.

See [README.md](README.md#testing) for exact commands and limitations. Browser screenshots are stored in ignored `backend/.local/screenshots/`.


## Midnight Neon redesign verification

The final design pass passed frontend ESLint, the Vite production build, all 18 backend integration tests, and all four Edge browser tests. Screenshots were inspected for desktop discovery, administration, and mobile seat selection. Tests additionally cover profile persistence and validation, denial of role escalation, mobile menu navigation, customer denial of admin/staff routes, CSV report download, payment audit access, literal scan-history search, confirmation-dialog dismissal with Escape, and overflow at 360/390, 768 and 1440px widths.

The first browser run encountered an API connection failure: the configured database on port 27017 did not provide the expected replica set. Verification used the existing isolated replica set on port 27018 with a process-local URI override. No `.env` or port 27017 service changes were made. Subsequent complete runs passed. Existing development records remain API-backed; browser tests add clearly named QA users/events and sandbox transactions.

Limitations: this is workflow and responsive regression coverage, not exhaustive testing of every possible record, device, assistive technology, or control combination. Physical QR readers, camera scanning and live Stripe checkout were not tested. The staff interface retains keyboard QR reader/pasted-code support and its existing all-published-events access policy. Audit screens expose payment-provider events and door scans; a general administrative change ledger and per-staff event assignment are not provided by the existing backend. The supplied reference was the written design brief; no moodboard image was attached.

A final targeted profile recheck hit a transient 502 during an API watch restart. The task-owned watchers were replaced with a non-watching API process for the recheck; production payment and database settings were not changed.
