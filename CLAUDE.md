# Bubble It Landing Page — CLAUDE.md

Repository notes for agents working on the Bubble It marketing site and customer booking flow.

---

## Production-Readiness Program (Highest Priority — July 2026)

This section is the durable handoff for the production-readiness program. It overrides older statements in this file when they conflict with the audit, current Linear issue acceptance criteria, or the implementation-order document. Historical labels such as "complete" are not production evidence, and old assumptions about guest checkout, customer API scope, phone-number discovery, time serialization, or payment behavior must not be extended without checking the current issue and product decision.

### Program sources of truth

- Linear project: [Bubble It](https://linear.app/vynetic/project/bubble-it-2e56778c0ec9)
- Linear execution document: [BubbleIt Production Readiness — Implementation Order](https://linear.app/vynetic/document/bubbleit-production-readiness-implementation-order-bfdf7897a7e4)
- Evidence report: `/Users/mohamadsafar/.codex/visualizations/2026/07/13/019f5ce8-9458-74c2-b181-04b63d98f7cf/bubbleit-production-readiness-audit.md`
- Backend/API: `/Users/mohamadsafar/Documents/Bubbleit/bubbleit-backend`
- Flutter operations app: `/Users/mohamadsafar/Documents/Bubbleit/bubbleit-mobile`
- Customer/landing web app: `/Users/mohamadsafar/Documents/Github/bubbleit-landing-page`

The audit verdict was **Unsafe to release**. Never infer readiness from an issue being implemented locally: its acceptance criteria, tests, dependency gates, and cross-repository contract must all be verified.

### Required agent startup protocol

1. Read the applicable `AGENTS.md` and `CLAUDE.md` files, then read the Linear execution document and assigned issue.
2. Fetch the current issue status, relations, comments, and acceptance criteria. Linear is live state: do not redo verified work or start an issue whose blocker is unresolved.
3. State the issue ID and repositories in scope. Work on one independently releasable issue at a time unless it explicitly requires an atomic cross-repository contract change.
4. Trace the complete workflow across UI/state, API contract, middleware/authorization/validation, service/transaction, database constraints, jobs/providers, response parsing, and user-visible recovery.
5. Do not touch production data, credentials, Firebase/APNs, SkipCash, deployments, or live callbacks. Use disposable PostgreSQL/Redis and deterministic provider fakes.
6. Implement the issue's acceptance criteria and tests. Race-sensitive behavior requires PostgreSQL constraints/transaction tests; SQLite-only evidence is insufficient.
7. Run the smallest relevant checks first, then required repository and cross-contract suites. Record exact verification evidence in Linear.
8. Mark Done only when acceptance criteria and dependencies are proven. If a product rule, credential, provider contract, or environment is missing, leave it blocked and document the dependency.
9. Preserve unrelated working-tree changes. Do not deploy, publish, migrate shared databases, or call external providers without explicit authorization.
10. Before starting a listed issue, verify it remains open; later work may already have completed portions of an audit finding.

### Mandatory implementation order

Resolve **MAD-67** before any affected policy: membership application/restoration, cancellation/refund rules, guest checkout, reservation expiry, service-area limits, cutoffs, notification timing, or late-payment handling.

#### PR-0 — Access and data integrity

1. **MAD-35** customer IDOR/data isolation and **MAD-37** inventory authorization/validation may run in parallel.
2. **MAD-50**, **MAD-51**, **MAD-55**, and **MAD-56** harden token deletion, suspended users, CORS, and account-enumeration behavior.
3. **MAD-54** follows MAD-35 and secures upload ownership/access.
4. **MAD-44** and **MAD-45** follow MAD-37 and establish authoritative inventory reservation/deduction/release and concurrency protection.

#### PR-1 — Booking and scheduling reliability

1. **MAD-46** establishes Asia/Qatar time; **MAD-47** enforces the versioned Qatar national land boundary with every addressable location in Qatar in area; **MAD-68** establishes one server-owned, versioned duration contract. They may run in parallel.
2. **MAD-43** atomic slot revalidation/idempotent creation follows MAD-46/MAD-47/MAD-68.
3. **MAD-57** operations-calendar semantics follows MAD-43/MAD-46.
4. Pre-audit **MAD-29** follows MAD-47.
5. Pre-audit **MAD-30** follows MAD-43/MAD-46; **MAD-34** is its duplicate and should be merged/closed.
6. **MAD-32** is an acceptance umbrella for MAD-46/MAD-53/MAD-57/MAD-62, not a competing implementation.

#### PR-2 — Financial correctness using simulation

1. **MAD-36** creates the canonical payment-attempt/event ledger and state model.
2. After MAD-36: **MAD-39** initiation integrity, **MAD-38** authenticated/idempotent callbacks, **MAD-40** return/polling state, and **MAD-53** reconciliation/observability.
3. **MAD-41** fixes membership entitlement/deduction concurrency; **MAD-42** restoration follows MAD-41.
4. **MAD-48** and **MAD-49** complete store checkout/payment integrity after inventory foundations.
5. Pre-audit **MAD-33** follows MAD-67 and aligns with MAD-41/MAD-42.
6. Split pre-audit **MAD-23**: pre-pilot reconciliation follows MAD-36/MAD-38/MAD-40/MAD-37/MAD-44/MAD-45; full accounting waits until after pilot.

#### PR-3 — Client quality and release readiness

1. **MAD-62** defines/version-controls the API contract; **MAD-63** repairs the shared client contract after it.
2. Then **MAD-58** notifications, **MAD-59** Arabic/RTL, **MAD-60** accessibility, **MAD-61** landing legal/SEO/privacy, and **MAD-64** mobile release hardening.
3. **MAD-52** client/store failure recovery follows MAD-63.
4. Pre-audit **MAD-17** follows MAD-35/MAD-54.
5. Pre-audit **MAD-31** waits for PR-1; its alerting aligns with MAD-58.
6. Pre-audit **MAD-14** aligns with MAD-31/MAD-58.

#### PR-4 — Live provider validation and controlled pilot

1. **MAD-65** is deliberately last and provider-blocked until real SkipCash sandbox credentials, API URL, callback authentication requirements, and refund capability exist.
2. **MAD-66** controlled pilot follows MAD-65 and every release gate.
3. Post-pilot: implement **MAD-22** HR. Convert broad legacy **MAD-15** into an umbrella or close it once child outcomes are tracked.

Completed issues remain historical evidence; do not reopen them merely because the audit found a regression. Track regressions through audit issues: MAD-16 → MAD-43/MAD-46/MAD-57; MAD-20/MAD-27 → MAD-37/MAD-44/MAD-45; MAD-21 → MAD-36/MAD-38/MAD-39/MAD-40/MAD-65; MAD-24 → MAD-42/MAD-44; MAD-26 → MAD-58.

### SkipCash strategy while credentials are unavailable

Complete PR-2 using a deterministic `PaymentGateway` fake/simulator that:

- uses server-calculated QAR integer minor units and never trusts client totals;
- persists payment attempts and immutable callback/event records;
- supports stable merchant references and idempotency keys;
- simulates success, failure, cancellation, timeout, duplicates, replay, out-of-order events, amount/currency mismatch, late success, and refund success/failure;
- proves only a verified server-side event can make a booking/order paid;
- proves membership usage and stock changes happen exactly once and reverse only under MAD-67 rules;
- exposes reconciliation and preserves redacted fixtures for later sandbox comparison.

Keep SkipCash mapping behind an adapter. Do not invent provider field names, signatures, or URLs in domain logic. MAD-65 is the final adapter/conformance gate: with explicit authorization and sandbox access, verify the real URL, auth/signature, callback retries, reference reuse, amount/currency, refunds, and reconciliation. Never use real customer charges for validation.

### Release gates

- Ownership/policy tests cover every protected resource and cross-customer negative case.
- PostgreSQL concurrency tests cover booking conflicts, membership last-use, callback replay, and final-unit inventory.
- Backend, Flutter, and web agree on enums, nullability, money, timestamps, pagination, and errors.
- Qatar scheduling passes tests across device timezones while business time stays Asia/Qatar.
- No secret, staging endpoint, debug flag, insecure-storage fallback, or provider bypass reaches release.
- Arabic/RTL, accessibility, offline/timeout/retry, and payment interruption have regression evidence.
- Pilot approval requires monitoring, reconciliation, support/rollback procedures, and stop conditions.


## Overview

- Framework: Next.js app router
- Scope: landing pages, customer booking web flow, memberships pages, account pages, and the local mock customer API
- Backend integration target: `https://bubbleit-backend.on-forge.com/api/v1/customer`
- **Production builds require `NEXT_PUBLIC_API_BASE`** (the real customer API base). `next.config.mjs` throws when it is missing so a deploy never silently serves the dev-only mock API at `/api/mock/v1/customer`.

## Booking Flow Notes

- The customer booking experience is one four-step wizard: **Services → Location → Schedule → Pay & Confirm**. Do not introduce a second customer booking flow for memberships.
- Customers do **not** select a bus.
- Availability slots are quarter-hour starts grouped into hour pills. Each hour pill opens the connected `HourSlotPicker` popover for `:00`, `:15`, `:30`, and `:45`; keep disabled/past choices visible but unselectable.
- The backend keeps fleet capacity occupied for the configured post-booking buffer after `scheduled_end_at`. The website should continue to display the actual service end only.
- The local mock API must mirror production slot generation and buffer-aware conflict behavior so booking demos cannot overbook a bus/driver pair.
- Keep dispatch metadata operational: do not show bus availability or assignment cards in customer booking flows.
- Do not expose bus numbers, plate numbers, or driver names to customers in the website flow.
- Do not change the booking creation payload shape just to support manager-side dispatch assistance.
- Physical products selected in the booking confirmation step use `product_lines` and belong to the booking's single payment. They are distinct from service add-ons and from standalone `/store` orders, which retain their own checkout.
- Standard booking actions stay visible in a viewport-fixed, safe-area-aware footer. Active forms must reserve enough bottom space that fields, errors, and time popovers are never hidden behind it. Page-transition wrappers must not retain transforms, because transformed ancestors break viewport-fixed positioning.
- The location step requires a pinned coordinate plus a Qatar address card. Building number is mandatory; zone and street numbers are optional. If a selected slot becomes stale after the page is restored or revisited, clear the slot and return the customer to Location before they can pick a fresh time.
- Service selection is mobile-first: two compact service cards per row, SUV / 4-Wheel first, and a reduced-motion-aware guided scroll to the vehicle/add-ons section. Selecting a service focuses and selects its plate/registration input.
- Preserve space for server-backed booking content with responsive skeletons; do not replace service, product, membership, or availability regions with blank space or unstructured loading text.
- Keep optional physical booking products behind the explicit “Add products to your booking” confirmation-step trigger so notes and the summary remain visible. The picker opens once when Pay & Confirm is first reached. It must be a centered document-level modal portal—not a bottom drawer or a fixed element nested inside the glass wizard—and must freeze background scroll while quantities change.
- Make the confirmation-step product trigger visually distinct and easy to notice, but keep attention animation finite and disable it through the global reduced-motion rule; never use a continuous decorative animation at checkout.
- Customer totals must include service add-ons and selected booking products. A selected quarter-hour must remain visible on its hour pill.
- Customer phone lookup must distinguish `registered` from `has_password`: registered customers sign in, while only an explicit `has_password: false` enters the legacy/manager-created account-claim flow. Keep the local mock response aligned with this contract.

## Membership Rules

- Membership redemption is automatic inside the standard `/book` wizard after authentication and server-backed quote retrieval. Customer-facing membership actions link to `/book`; `/book/membership` exists only as a legacy redirect.
- Do not restore a membership opt-out toggle or a separate redemption wizard. If the selected wash is eligible, show the membership name, covered amount, remaining washes, and no-payment state dynamically in the standard summary.
- Physical products remain selectable when a membership covers the wash. The membership covers only the eligible service; product lines remain payable and must still be sent in `product_lines`.
- Final booking copy follows the payable state: **Confirm booking** when fully covered, **Pay for products** when only products are due, and **Confirm & Pay** for an ordinary paid booking.
- Selecting a membership plan must open a review dialog before any purchase request. Show wash scope, vehicle type, wash count, validity, per-wash price, and total; only the explicit confirmation action may continue to authentication/payment.
- Membership plan grids reserve their final layout with accessible skeleton cards while plan data loads.

## Store and Checkout Rules

- Customer-facing store surfaces may show **Available** or **Out of stock**, but must not expose exact inventory quantities. Continue enforcing inventory limits internally.

- `/store` uses a professional mobile-first grid with aligned card content zones, search, category filters, inline quantity controls, and a fixed two-action footer once the cart has items.
- **View cart** opens the mini-cart modal; **Checkout** navigates directly to `/store/checkout`. Hidden cart backdrops must use opacity, visibility, pointer-events, `aria-hidden`, and `inert` safeguards so no tint or invisible click layer remains.
- Store checkout is a focused three-step flow: **Location → Contact → Review**. Do not collapse it back into one long page.
- Store checkout uses the same Qatar address card as booking: map pin/current location, mandatory building number, optional zone/street, optional area and extra details.
- Guest checkout is the default and does not require an account. Require a name and valid eight-digit Qatar phone number, normalize it to `+974`, and preserve the contact step as the future OTP insertion point.
- A created/pending order must be retained when payment initialization fails so Retry payment does not create a duplicate order.

## Navigation, Account, and Accessibility

- Global navigation is organized around **Services, Memberships, Store, Account**, with one dominant **Book a Wash** CTA. The closed mobile menu must remain `aria-hidden` and `inert` so its links cannot receive focus.
- The account page owns Overview, Bookings, Memberships, and Vehicles. It must expose booking/rebooking/cancellation, membership redemption/renewal, vehicle booking/removal, quick actions, loading states, and clear empty states.
- Account section controls follow the ARIA tabs pattern, including a single tab stop, `aria-selected`, linked tabpanels, Arrow Left/Right, Home, and End behavior. Avoid horizontally clipped mobile tabs.
- Keep normal text contrast at WCAG AA, interactive targets at least 44×44px on mobile, visible `:focus-visible` outlines, contextual accessible names for repeated actions, and one page-level `<h1>` per rendered account state.
- Respect `prefers-reduced-motion`. Use compositor-friendly opacity/transform motion for modal entrances, and avoid long scripted page-scroll animations between wizard steps.
- Customer auth stores the token in a SameSite=Lax cookie and local storage fallback, sends same-origin credentials with API calls, and clears both stores on logout. Phone login/signup inputs accept exactly eight local Qatar digits and use a numeric keypad.

## Timezone Convention

- All booking times are **Qatar wall-clock** (UTC+3, no DST). The client operates only in Doha.
- The backend stores `scheduled_at` as Qatar wall-clock and serializes it with a `+00:00` offset — treat the digits as Qatar time, never convert to the viewer's browser time zone.
- Use the helpers in `lib/datetime.ts` for anything time-related: `formatQatarDateTime` for display, `qatarSlotMs` for past-slot checks, `nextQatarDays` for day pickers. Do not call `new Date(...).toLocaleString()` on API datetimes directly.
- Booking creation continues to send a naive `YYYY-MM-DDTHH:MM:00` string, which the backend interprets as Qatar wall-clock.

## Change Log Requirement

- Keep `CHANGELOG.md` updated for each implementation session that changes user-visible site behavior or booking-flow behavior.
- Before committing an implementation task, update this `CLAUDE.md` too when it introduces durable behavior, workflow, or operational knowledge future agents need. Then commit, push the feature branch, merge into `main` after verification passes, and push `main`.
