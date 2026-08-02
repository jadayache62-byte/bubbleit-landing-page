# Bubble It Landing Page — CLAUDE.md

## Current product and repository state (2026-08-01)

- This is the Next.js 16 customer website for marketing, booking, memberships, store checkout,
  authenticated account management, legal pages, and the development-only mock customer API.
- It is an Nx workspace. Use the declared Nx targets for lint, unit/contract tests, Playwright,
  security checks, and production builds.
- Store checkout requires an authenticated or OTP-verified customer before review and order creation.
  Preserve the browser cart across authentication and keep any server-created pending order bound to
  its authenticated owner. Guest order creation is not supported.
- Customer booking history sorts newest booking reference first and supports search plus lifecycle
  filtering. Keep duplicate-safe cancellation progress and immediate card updates.
- Service-card duration must use the selected vehicle type's backend-owned sedan or SUV duration;
  never display the sedan value for every vehicle.
- Authenticated customers with a redeemable membership use a membership-first booking path that
  omits service, add-on, quote, and promo selection. They choose one exactly covered vehicle,
  location, a server-returned slot, and optional store products.
- Regular and membership availability are geofenced by the selected coordinates. Preserve the opaque
  `dispatch_zone.version` returned with availability through quote and booking commit, and recover a
  stale version by returning to Location and reloading slots. The browser never resolves polygons,
  combines capacity across zones, or performs a cross-zone fallback.
- Keep customer dispatch messaging intentionally narrow: distinguish a location outside configured
  coverage from a covered zone with no available time, but never reveal internal zone names, bus or
  driver data, candidate counts, or assignment explanations. The development mock must preserve the
  same zone isolation and opaque-version contract.
- Customer action failures use accessible, dismissible top snackbars across booking, authentication,
  memberships, store checkout, saved locations, notifications, reviews, and account deletion.
- Browser code uses only the same-origin `/api/customer` BFF. The bearer token remains in the
  server-owned HttpOnly cookie, and production builds fail when `CUSTOMER_API_BASE` is absent.
- Never expose internal accounting, ledger, reconciliation, provider, or revenue-recognition details
  in customer contracts or screens.
- Do not deploy or run provider-facing browser tests against live payment, messaging, production, or
  shared customer data.

## Customer financial privacy and payment returns

- Customer responses and screens show only customer-relevant payment, refund, fulfillment, and delivery outcomes. Never expose revenue recognition, deferred revenue, accounting status/codes, journal data, posting policies, internal fingerprints, or reconciliation internals.
- SkipCash checkout requests use a purchase-specific `ReturnUrl` back to the matching account section and purchase ID. The provider dashboard URL is a fallback only.
- A browser return is not proof of payment. The account page must fetch and briefly poll the server-authoritative payment state, then show a localized success, failure, cancellation, timeout, processing, refund, or review result.
- The authenticated account owns Bookings, Memberships, and Store Orders. Store order list/detail responses must remain owner-scoped and use the customer-safe resource contract.
- Customer cancellation may submit an internal refund request, but the customer UI must never imply
  that approval or provider reimbursement is automatic. Show the backend-owned refund status.
- Keep docs/contracts/public-contract-v1.schema.json byte-identical with backend and mobile.

## Durable booking-duration rule

The customer app never calculates operational scheduling duration. It must use
the backend `duration-v1` snapshot from availability, echo its version to quote,
echo the accepted quote version to booking commit, and recover
`DURATION_VERSION_STALE` by reloading availability. Keep
`docs/contracts/duration-v1.json` byte-identical with backend and mobile.

`docs/contracts/public-contract-v1.schema.json` is the byte-identical consumer copy of the backend-owned public JSON Schema. Type unions, nullable fields, error/pagination parsing, and development mock fixtures must stay aligned with it. Store products always use integer backend IDs; an API outage must render unavailable/retry UI and must never hydrate a production cart from `STORE_PRODUCTS`.

The same-origin customer BFF owns `X-Request-ID` forwarding and must return the authoritative backend ID. API recovery text retains that reference. `.github/workflows/ci.yml` must keep lint, contract/regression tests, production build, and local Playwright fault injection blocking; browser tests must never call real providers.

The customer web security policy is request-nonced in `proxy.ts`. `CSP_MODE` defaults to `report-only`; release-like browser tests set it to `enforce`, and hosting may switch to enforcement only after report-only evidence is reviewed. Report-only policy must omit `upgrade-insecure-requests`, which browsers ignore outside enforcement, and Permissions-Policy must contain only broadly recognized directives. Keep OpenStreetMap tiles and Nominatim as the only current third-party runtime sources. CSP reports must remain bounded and redact query strings. Enforced CSP `frame-ancestors 'none'` is the authoritative framing defense; nginx owns the compatibility `X-Frame-Options` header, so the application must not emit a conflicting duplicate. HSTS, Permissions-Policy, MIME/referrer/isolation headers, the HttpOnly BFF session, and same-origin mutation checks are release gates. The fallback BFF session lifetime is 21 days; an authoritative shorter backend expiry still wins.

Customer notification push is optional and session/device scoped. Never ask for permission before an explicit customer action. A push payload may carry only a numeric notification ID and `/account?notification={id}`; the service worker must reconstruct that internal entry point and the authenticated backend resolve endpoint must reauthorize the notification and target before navigation. `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` and a live backend adapter remain external release inputs. Important transactional WhatsApp/SMS remains the server-owned fallback.

Post-service reviews open only from the backend-resolved opaque `/review/{invitation}` path. The page must remain `noindex`, fetch and submit through the same-origin authenticated BFF, show the star selector before optional notes, and preserve loading, sign-in, expiry, error, submitting, and submitted states. Never place customer IDs or numeric booking IDs in review URLs, and never bypass backend ownership, completion, expiry, one-use, or pending-moderation checks.

## Arabic localization and RTL (MAD-59)

- Derive the initial document language and direction on the server from the locale cookie, and persist explicit language changes immediately. Arabic pages must render with `lang="ar"` and `dir="rtl"` before hydration.
- App-owned navigation, actions, validation, status, policy, accessibility, and recovery copy belongs in the shared localization layer. Customer names and user-created service or product names may remain exactly as authored in English or any other entered language; do not machine-translate them.
- This includes dynamic object labels, generated defaults such as saved-location names, client-side
  runtime errors, legal-page chrome, and server-rendered metadata. Do not hide English prose in a
  conditional, constant, error constructor, state setter, or static `metadata` export. Add paired
  catalog entries and keep the localization contract scanner green.
- Format QAR and locale-sensitive values through the shared money/date helpers. Use CSS logical properties and directional semantics rather than hardcoded left/right assumptions.
- Keep the RTL/localization contract test and Arabic browser journey as release gates, including compact layouts and increased text size. MAD-59 received owner acceptance on 2026-07-19; preserve its verified copy and authored-content policy.

Repository notes for agents working on the Bubble It marketing site and customer booking flow.

---

## Overview

- Framework: Next.js app router
- Scope: landing pages, customer booking web flow, memberships pages, account pages, and the local mock customer API
- Backend integration target: `https://bubbleit-backend.on-forge.com/api/v1/customer`
- **Production builds require server-only `CUSTOMER_API_BASE`** (the real customer API base). Browser code calls `/api/customer`; that BFF alone holds the backend bearer token in an HttpOnly, Secure, SameSite=Lax cookie. Never restore script-readable auth cookies, localStorage bearer tokens, or direct browser-to-backend authorization headers. `next.config.mjs` throws when the upstream is missing so a deploy never silently serves the dev-only mock API at `/api/mock/v1/customer`.

## Booking Flow Notes

- The customer booking experience is one adaptive four-step wizard. Ordinary bookings are
  **Services → Location → Schedule → Pay & Confirm**. A redeemable membership changes the same
  wizard to **Vehicle → Location → Schedule → Products & confirm**. Do not create a separate route or
  ask a membership customer to choose the plan-owned service.
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
- Customer phone discovery must never return or branch on `registered` or `has_password`. Every valid
  phone receives `continuation=choose_auth_method`; the customer explicitly chooses password sign-in,
  registration/account claim, or recovery. Keep the local mock response and no-store behavior aligned.
- OTP requests must include `purpose=registration` for signup/account claim and
  `purpose=authentication` for credential recovery. The local mock must reject cross-purpose reuse.
- Returning customers may sign in directly with a code from the configured OTP transport. That flow requests
  `purpose=authentication`, calls `verify-otp`, and must not require or change a password.
  Registration/account claim remains isolated under `purpose=registration`.
- After any successful registration, sign-in, or password-recovery OTP request, show a 30-second localized countdown and keep the resend action disabled. When it expires, explicitly tell the customer that a new code can be requested and enable the action.

## Membership Rules

- Membership redemption stays inside `/book`; `/book/membership` remains only a legacy redirect.
  After authentication, load owner-scoped memberships and switch any customer with a redeemable
  plan to the membership-first variant. Surface an early sign-in prompt so returning members do not
  waste time selecting a normal service before the website can identify them.
- Do not restore a membership opt-out toggle, service selector, add-ons, quote, promo, or a separate
  redemption wizard. The purchased plan derives the service. The customer selects one vehicle;
  sedan plans show only sedans and SUV plans show only SUVs. New vehicles must be saved before
  requesting membership slots so the backend can authorize the exact vehicle.
- Membership availability comes exclusively from
  `GET /memberships/{membership}/booking-options?date=YYYY-MM-DD&vehicle_id={id}`. Public
  availability must not expose the midnight grid. Plans with the private window may show only
  backend-returned quarter-hour slots from 00:00 through 04:45.
- Ask explicitly whether store products are wanted. No products creates and confirms the prepaid
  membership booking immediately. Selected products are sent in `product_lines`; checkout and the
  displayed amount due cover products only, while the wash remains reserved until verified payment.
- Final booking copy follows the payable state: **Confirm booking** when fully covered, **Pay for
  products** when only products are due, and **Confirm & Pay** for an ordinary paid booking.
- Selecting a membership plan must open a review dialog before any purchase request. Show wash scope, vehicle type, wash count, validity, per-wash price, and total; only the explicit confirmation action may continue to authentication/payment.
- Membership plan grids reserve their final layout with accessible skeleton cards while plan data loads.

## Store and Checkout Rules

- Customer-facing store surfaces may show **Available** or **Out of stock**, but must not expose exact inventory quantities. Continue enforcing inventory limits internally.

- `/store` uses a professional mobile-first grid with aligned card content zones, search, category filters, inline quantity controls, and a fixed two-action footer once the cart has items.
- **View cart** opens the mini-cart modal; **Checkout** navigates directly to `/store/checkout`. Hidden cart backdrops must use opacity, visibility, pointer-events, `aria-hidden`, and `inert` safeguards so no tint or invisible click layer remains.
- Store checkout is a focused three-step flow: **Location → Contact → Review**. Do not collapse it back into one long page.
- Store checkout uses the same Qatar address card as booking: map pin/current location, mandatory building number, optional zone/street, optional area and extra details.
- Store checkout requires sign-in or OTP-backed account verification before review and order
  creation. For an unauthenticated customer, the Contact step is the authentication gate; once the
  customer is verified, continue directly to Review. Accept exactly eight local Qatar phone digits
  and normalize them to `+974`.
- Creating a pending order reserves the checkout but does not complete it. Preserve the cart and
  pending order when hosted checkout is abandoned or payment initialization fails; clear the cart
  only after the backend confirms capture.
- While a validated hosted checkout URL is actively navigating, keep checkout locked and show only
  the secure-payment redirect state. Do not reset to or render saved-order/retry messaging until
  initialization fails, no usable URL is returned, or the browser actually returns from the provider.
  A back/forward-cache restore must release the redirect lock so payment recovery remains available.
- Pending bookings, memberships, and store orders expose **Complete payment** from their matching
  account section. Retry must first reconcile any existing SkipCash attempt and must not create a
  duplicate purchase or checkout URL after payment is already authoritative.
- Customer cancellation is available only for backend-eligible store orders. A paid cancellation
  shows the submitted refund request separately; it does not claim provider reimbursement.

## Service Area Contract

- Service eligibility is Qatar-wide land territory, not a city, municipality,
  label, or custom-zone allowlist. The Laravel backend's versioned official
  CGIS polygon is authoritative; client-side copy and the development mock are
  never production eligibility evidence.
- Availability validates the pinned coordinates and returns a
  `service_area.version`. Quote, booking creation, and store order creation must
  carry that exact version. Handle `SERVICE_AREA_STALE` by returning the
  customer to Location for confirmation; display `SERVICE_AREA_OUTSIDE_QATAR`
  as a recoverable location error.
- Saved addresses without current eligibility evidence must be edited and
  revalidated. Never infer eligibility from an address containing “Qatar”.

## Navigation, Account, and Accessibility

- `/privacy`, `/terms`, and `/account-deletion` are canonical public release surfaces. Their English/Arabic content comes from `lib/legal/policies.ts`, where both languages are paired under the single version `2026-07-18-v1`; never fork language-specific policy files or versions. Keep legal identity, domains, schema version, retention text, store declarations, sitemap, and footer links synchronized.
- The account-deletion page must preserve the same-origin HttpOnly token boundary. Data export is authenticated, one-use, and downloaded immediately; deletion requires a fresh authentication OTP plus explicit irreversible confirmation, and successful deletion expires the BFF session cookie.
- Global navigation is organized around **Services, Memberships, Store, Account**, with one dominant **Book a Wash** CTA. The closed mobile menu must remain `aria-hidden` and `inert` so its links cannot receive focus.
- The account page owns Overview, Bookings, Memberships, Store Orders, Vehicles, and Notifications.
  It must expose booking/rebooking/cancellation and payment recovery, membership
  redemption/renewal, store-order payment/cancellation/refund tracking, vehicle booking/removal,
  localized notification recovery, quick actions, loading states, and clear empty states.
- Booking history sorts by booking reference descending and provides search plus lifecycle filters.
  Cancellation is duplicate-safe, exposes in-progress state, and updates the matching card from the
  authoritative response without waiting for an unrelated full-page reload.
- Account section controls follow the ARIA tabs pattern, including a single tab stop, `aria-selected`, linked tabpanels, Arrow Left/Right, Home, and End behavior. Avoid horizontally clipped mobile tabs.
- Keep normal text contrast at WCAG AA, interactive targets at least 44×44px on mobile, visible `:focus-visible` outlines, contextual accessible names for repeated actions, and one page-level `<h1>` per rendered account state.
- Respect `prefers-reduced-motion`. Use compositor-friendly opacity/transform motion for modal entrances, and avoid long scripted page-scroll animations between wizard steps.
- Customer action failures use the shared accessible top snackbar with a dismiss action. Do not
  reintroduce inconsistent inline-only error banners for comparable actions.
- Render hour-slot option popovers through a document-level portal and clamp their measured box to the current visual viewport. Reposition on scroll and resize, open upward when the bottom edge is constrained, and keep outside-click/focus restoration working across the portal; grid-column alignment alone is not safe for right-edge mobile pills or large text.
- Map selection must include the localized coordinate form in `LocationMap`; pointer dragging and geolocation permission cannot be the only input paths. Time pickers and modal dialogs must restore the invoking control's focus after selection or dismissal and trap focus while open.
- `tests/e2e/accessibility.spec.ts` is a blocking axe WCAG A/AA gate for customer release surfaces. Do not suppress violations without a documented false-positive proof; fix the rendered semantics or contrast instead.
- Customer auth stores its bearer token only in the server-owned HttpOnly, Secure-in-production, SameSite=Lax cookie. Browser code sends same-origin credentials but cannot read the token; never add a localStorage or script-readable cookie fallback. Phone login/signup inputs accept exactly eight local Qatar digits and use a numeric keypad.

## Timezone Convention

- All booking times are **Qatar wall-clock** (UTC+3, no DST). The client operates only in Doha.
- The backend stores `scheduled_at` as Qatar wall-clock and serializes it with a `+00:00` offset — treat the digits as Qatar time, never convert to the viewer's browser time zone.
- Use the helpers in `lib/datetime.ts` for anything time-related: `formatQatarDateTime` for display, `qatarSlotMs` for past-slot checks, `nextQatarDays` for day pickers. Do not call `new Date(...).toLocaleString()` on API datetimes directly.
- Booking creation continues to send a naive `YYYY-MM-DDTHH:MM:00` string, which the backend interprets as Qatar wall-clock.

## Change Log Requirement

- Keep `CHANGELOG.md` updated for each implementation session that changes user-visible site behavior or booking-flow behavior.
- Before committing an implementation task, update this `CLAUDE.md` too when it introduces durable behavior, workflow, or operational knowledge future agents need. Then commit, push the feature branch, merge into `main` after verification passes, and push `main`.
