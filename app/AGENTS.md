# Customer routes, sessions, and account security

## Overview

The customer BFF, session cookies, authentication, account pages, and security policy.

Paths in code and commands are relative to the repository root. These rules also apply to callers outside this directory.

## BFF and authentication

- Browser requests use only `/api/customer` through `lib/api/client.ts`. `app/api/customer/[...path]/route.ts` alone holds the backend bearer token, in an HttpOnly, Secure in production, SameSite=Lax cookie. Never add browser Authorization headers, localStorage tokens, or script readable auth cookies.
- New configuration uses server only `CUSTOMER_API_BASE`, targeting the real customer API (recorded upstream `https://bubbleit-backend.on-forge.com/api/v1/customer`). The BFF and `next.config.mjs` retain `NEXT_PUBLIC_API_BASE` only as a deployment compatibility fallback. A production build without a valid configured upstream fails; `/api/mock/v1/customer` is never the production fallback.
- The BFF forwards safe `X-Request-ID` and returns the authoritative backend response ID for recovery. The fallback session lifetime is 21 days; a shorter authoritative backend expiry wins.
- Customer phone input accepts exactly eight local Qatar digits with a numeric keypad. `check-phone` always returns `continuation=choose_auth_method`, not `registered`/`has_password`; keep no-store and never infer account existence in UI or mocks.
- Signup/account claim requests `purpose=registration`. Returning code login requests `purpose=authentication` and calls `verify-otp` without requiring or changing a password. Cross purpose OTP reuse fails.
- Recovery uses its dedicated verify endpoint, then holds the one use reset grant only in component memory before submitting the new password. It never creates a customer session or auth cookie, persists a grant, or puts it in a URL. Successful reset revokes old sessions and returns to normal password sign in.
- Each successful registration, sign in, or recovery OTP request starts a localized 30 second resend countdown; after expiry, show that a new code may be requested.

## Account, privacy, and payment returns

- Customer resources expose payment/refund/fulfillment/delivery outcomes only. Never expose journal, recognition, deferred revenue, account codes, posting policy, provider internals, reconciliation, or fingerprints.
- `/account` owns Overview, Bookings, Memberships, Store Orders, Vehicles, and Notifications. Keep owner scoped booking/rebooking/cancellation/payment recovery, membership redemption/renewal, order tracking, vehicle booking/removal, notification recovery, quick actions, loading and empty states.
- `/account?tab=bookings&booking={id}` owns the customer live bus journey. Its same origin BFF snapshot
  and authorization paths require the HttpOnly customer session; live authorization also requires an
  exact Origin and an allowlisted body. Responses are no store and allowlisted before reaching UI.
  Private grants, bearer tokens and coordinates never enter URLs, localStorage, analytics or Sentry.
- Booking history is reference first, newest reference first, with search and lifecycle filters. Cancellation is duplicate safe and updates the affected card from the server response with visible progress.
- Provider ReturnUrl is purchase specific and returns to the matching account section/purchase ID; dashboard return URL is only a fallback. A return is not payment proof. Use the existing bounded backend state reconciliation/polling for localized success, failure, cancellation, timeout, processing, refund, or review. Do not turn this into general list polling.
- Pending purchases offer Complete payment from their own account section. Reconcile the current attempt before retry so a verified purchase cannot create another checkout. Approval or cancellation never promises automatic reimbursement.
- `/privacy`, `/terms`, and `/account-deletion` use `lib/legal/policies.ts` with English/Arabic paired under `2026-07-18-v1`. Keep legal identity, domains, retention, store declarations, schema version, sitemap, and footer synchronized.
- Export is authenticated, one use, and downloaded immediately. Deletion requires a fresh authentication OTP and explicit irreversible confirmation; success expires the BFF cookie. Keep backend ownership and retention boundaries.
- Optional customer push requests permission only after an explicit action. It is session/device scoped; payloads contain only a numeric notification ID and `/account?notification={id}`. The service worker reconstructs that path, and authenticated resolution reauthorizes both record and target. `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` and the live adapter remain external release inputs; transactional SMS/WhatsApp fallback is server owned.
- `/review/{invitation}` is opaque, backend resolved, authenticated, and noindex. Show stars before optional notes and preserve loading/sign in/expiry/error/submitting/submitted states. No numeric customer/booking IDs or bypass of completion, ownership, expiry, one use, or pending moderation.

## Security policy and checks

- Local build verification sets `SENTRY_BUILD_UPLOADS=false` to prevent source map uploads, release creation, and build plugin telemetry. Clearing a token alone is insufficient because the SDK can load its separate ignored environment file. Runtime error reporting stays configured. Sentry sample error routes are not part of the customer site.
- Isolated browser verification also sets `NEXT_PUBLIC_SENTRY_ENABLED=false` for client, server and edge reporting. The Playwright test server includes both guards. Normal runtime reporting stays on by default.

- `proxy.ts` uses a request nonce. `CSP_MODE` defaults to `report-only`; release browser tests use `enforce`. Hosting enforcement requires reviewed report only evidence first. Report only CSP omits `upgrade-insecure-requests`; Permissions-Policy uses broadly recognized directives.
- OpenStreetMap tiles and Nominatim remain booking location sources. The account tracking map may load
  Google Maps only when its public browser key is configured; CSP adds only the documented Google
  sources in that configuration. Restrict the key to exact website referrers. Reverb WebSocket CSP is
  derived from a validated public host, numeric port and ws/wss scheme. Keep CSP reports bounded and
  redact query strings. Enforced `frame-ancestors 'none'` is authoritative; nginx owns compatibility
  X-Frame-Options, so do not emit a conflicting application duplicate.
- HSTS, MIME/referrer/isolation headers, permissions policy, HttpOnly sessions, and same origin mutation checks are release gates.
- Run the declared `test:session` and `test:security` Nx targets for this boundary. Playwright uses `http://127.0.0.1:3100`, unreachable loopback upstream port 9, and CSP enforce. Reuse a local server only with that same isolated configuration; never test against live payments or shared customer data.

## Related context

- [Shared navigation and accessibility](../components/AGENTS.md)
- [Booking and memberships](../components/booking/AGENTS.md)
- [Store payment recovery](../components/store/AGENTS.md)
- [Contract and locale helpers](../lib/AGENTS.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
