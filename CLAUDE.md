# Bubble It Landing Page — CLAUDE.md

Repository notes for agents working on the Bubble It marketing site and customer booking flow.

---

## Overview

- Framework: Next.js app router
- Scope: landing pages, customer booking web flow, memberships pages, account pages, and the local mock customer API
- Backend integration target: `https://bubbleit-backend.on-forge.com/api/v1/customer`

## Booking Flow Notes

- The customer booking experience stays **time-first**.
- Customers do **not** select a bus.
- Availability slots are quarter-hour starts grouped into hour pills. Each hour pill opens the connected `HourSlotPicker` popover for `:00`, `:15`, `:30`, and `:45`; keep disabled/past choices visible but unselectable.
- The backend keeps fleet capacity occupied for the configured post-booking buffer after `scheduled_end_at`. The website should continue to display the actual service end only.
- The local mock API must mirror production slot generation and buffer-aware conflict behavior so booking demos cannot overbook a bus/driver pair.
- Keep dispatch metadata operational: do not show bus availability or assignment cards in customer booking flows.
- Do not expose bus numbers, plate numbers, or driver names to customers in the website flow.
- Do not change the booking creation payload shape just to support manager-side dispatch assistance.
- Physical products selected in the booking confirmation step use `product_lines` and belong to the booking's single payment. They are distinct from service add-ons and from standalone `/store` orders, which retain their own checkout.
- Standard and membership booking actions stay visible in a fixed, safe-area-aware footer. Active forms must reserve enough bottom space that fields, errors, and time popovers are never hidden behind it.
- Service selection is mobile-first: two compact service cards per row, SUV / 4-Wheel first, and a reduced-motion-aware guided scroll to the vehicle/add-ons section.
- Preserve space for server-backed booking content with responsive skeletons; do not replace service, product, membership, or availability regions with blank space or unstructured loading text.
- Keep optional physical booking products behind the compact confirmation-step trigger so notes and the summary remain visible. The product picker must be a centered document-level modal portal—not a bottom drawer or a fixed element nested inside the glass wizard—and must freeze the background scroll while quantities change.
- Make the confirmation-step product trigger visually distinct and easy to notice, but keep attention animation finite and disable it through the global reduced-motion rule; never use a continuous decorative animation at checkout.
- Customer totals must include service add-ons and selected booking products. A selected quarter-hour must remain visible on its hour pill.
- Customer phone lookup must distinguish `registered` from `has_password`: registered customers sign in, while only an explicit `has_password: false` enters the legacy/manager-created account-claim flow. Keep the local mock response aligned with this contract.

## Timezone Convention

- All booking times are **Qatar wall-clock** (UTC+3, no DST). The client operates only in Doha.
- The backend stores `scheduled_at` as Qatar wall-clock and serializes it with a `+00:00` offset — treat the digits as Qatar time, never convert to the viewer's browser time zone.
- Use the helpers in `lib/datetime.ts` for anything time-related: `formatQatarDateTime` for display, `qatarSlotMs` for past-slot checks, `nextQatarDays` for day pickers. Do not call `new Date(...).toLocaleString()` on API datetimes directly.
- Booking creation continues to send a naive `YYYY-MM-DDTHH:MM:00` string, which the backend interprets as Qatar wall-clock.

## Change Log Requirement

- Keep `CHANGELOG.md` updated for each implementation session that changes user-visible site behavior or booking-flow behavior.
- Before committing an implementation task, update this `CLAUDE.md` too when it introduces durable behavior, workflow, or operational knowledge future agents need. Then commit, push the feature branch, merge into `main` after verification passes, and push `main`.
