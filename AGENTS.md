# Bubble It Customer Web — Agent Instructions

Read `CLAUDE.md` before changing customer behavior; it contains the detailed booking, store,
membership, authentication, localization, security, and accessibility contracts.

## Current architecture

- Next.js 16 App Router customer website with React 19 and TypeScript.
- Scope: marketing pages, the four-step booking wizard, memberships, store, authenticated account,
  legal/release pages, and a development-only mock API.
- Browser requests go to the same-origin `/api/customer` BFF. Only the BFF may hold the backend bearer
  token, in an HttpOnly, Secure-in-production, SameSite=Lax cookie.
- Production requires the server-only `CUSTOMER_API_BASE`. Never add a browser API base, direct
  browser authorization header, localStorage token, or script-readable auth cookie.
- Customer contracts expose customer-relevant payment/refund/fulfillment state only. Never expose
  journal, revenue-recognition, accounting, reconciliation, provider, or internal fingerprint data.

## Current customer behavior

- Booking remains one adaptive flow. Ordinary customers use Services → Location → Schedule → Pay &
  Confirm. An authenticated customer with a redeemable membership uses Vehicle → Location →
  Schedule → Pay & Confirm; the plan owns the service and the browser never asks them to choose
  or price it.
- Availability, duration, price, membership coverage, inventory, service-area version, and payment
  outcome are backend-owned. Do not calculate operational or financial truth in the browser.
- Regular and membership availability require the selected latitude/longitude and return an opaque
  dispatch-zone version that must survive quote/confirmation. A location outside configured coverage
  is blocked on Location with calm, actionable map guidance; a covered zone with no available time
  advances to Schedule so the customer can choose another day. Never expose internal zone names,
  buses, drivers, candidate counts, or automatic-assignment details to customers.
- Membership vehicle and slot choices come only from the owner-scoped booking-options endpoint.
  Sedan plans accept only sedans, SUV plans accept only SUVs, and 00:00–05:00 slots remain private
  to eligible midnight memberships. Membership Pay & Confirm opens the same optional-product modal
  as an ordinary booking; dismissing it confirms the prepaid wash without products, while selected
  products are the only payable amount.
- Adding a membership vehicle asks only for its plate number. Keep the internally generated
  vehicle-create idempotency key stable for an identical retry and rotate it when plate/type changes.
  Do not let automatic saved-vehicle selection override “Add a different vehicle.”
- Display the selected vehicle type's sedan/SUV duration. Customers never choose a bus or see bus,
  plate, driver, or dispatch details.
- Booking history is booking-reference-first, newest first, with search and lifecycle filters.
  Cancellation must remain duplicate-safe and update the matching card immediately.
- Store checkout is Location → Contact → Review for unauthenticated customers and Location → Review
  for authenticated customers. Contact is an authentication/OTP gate; guest order creation is not
  supported. Preserve the cart through authentication and bind pending orders to their server owner.
- A provider return is not proof of payment. Reconcile through the backend and preserve processing,
  failed, cancelled, review, refund, and payment-recovery states.
- Use the shared accessible, dismissible top snackbar for customer action errors.

## Quality and safety

- English/Arabic, server-rendered `lang`/`dir`, RTL, 320 px reflow, increased text, keyboard access,
  visible focus, focus restoration, reduced motion, and axe WCAG A/AA coverage are release gates.
- Every app-owned string—including dynamic option labels, generated defaults, validation/runtime
  errors, accessible names, legal-page chrome, and page metadata—belongs in the shared English/Arabic
  catalog. Keep customer-authored names and backend-authored catalogue content verbatim.
- Keep `docs/contracts/public-contract-v1.schema.json` and
  `docs/contracts/duration-v1.json` byte-identical with the backend and Flutter consumers.
- The local mock must follow production contracts but must never become a production fallback.
- The local mock must preserve zone-specific capacity and stale-version behavior; a bus serving one
  zone must never contribute a customer slot in another zone.
- Tests must not contact real payment, messaging, production, or shared services.
- Use the declared Nx targets through `npm exec nx -- <target> bubbleit-landing-page`; do not bypass
  Nx for routine lint, test, build, or end-to-end work and do not guess flags.
- Before release, run the relevant focused tests followed by lint, unit/contract tests, Playwright
  release gates, session/security verification, and the production build.
- Keep `CHANGELOG.md`, `CLAUDE.md`, and this file synchronized whenever durable behavior,
  architecture, contracts, release state, or operational knowledge changes.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->
