# Bubble It Landing Page — Agent Instructions

Read this file and `CLAUDE.md` before making changes in this repository. Repository-specific implementation notes remain in `CLAUDE.md`; the program rules below have higher priority where older notes conflict.

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

