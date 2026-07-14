# Bubble It Landing Page — CLAUDE.md

Repository notes for agents working on the Bubble It marketing site and customer booking flow.

---

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
- Customer phone discovery must never return or branch on `registered` or `has_password`. Every valid
  phone receives `continuation=choose_auth_method`; the customer explicitly chooses password sign-in,
  registration/account claim, or recovery. Keep the local mock response and no-store behavior aligned.
- OTP requests must include `purpose=registration` for signup/account claim and
  `purpose=authentication` for credential recovery. The local mock must reject cross-purpose reuse.

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
