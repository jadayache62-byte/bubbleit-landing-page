# Booking and membership flow

## Overview

The adaptive booking wizard, owner membership choices, optional products, and loyalty.

Paths in code and commands are relative to the repository root. These rules also apply to callers outside this directory.

## Booking Flow Notes

- The customer booking experience is one adaptive four-step wizard. Ordinary bookings are
  **Services → Location → Schedule → Pay & Confirm**. A redeemable membership changes the same
  wizard to **Vehicle → Location → Schedule → Pay & Confirm**. Do not create a separate route or
  ask a membership customer to choose the plan-owned service.
- Customers do **not** select a bus.
- Availability slots are quarter-hour starts grouped into hour pills. Each hour pill opens the connected `HourSlotPicker` popover for `:00`, `:15`, `:30`, and `:45`; keep disabled/past choices visible but unselectable.
- Display customer-facing booking times in localized 12-hour format with AM/PM while preserving backend slot values and booking payloads as 24-hour `HH:MM` strings.
- Schedule reloads authoritative availability when a visible tab returns, when the browser restores
  the page from history, or when the customer clicks the already selected date. Return events are
  coalesced into one request, without fixed polling. A selection older than 15 minutes still clears
  and returns to Location. Reloading clears the old selection and keeps request ordering guards.
- A missing hour group is distinct from an occupied returned slot. Backend working windows require
  the full service plus buffer to fit. With 00:00 to 03:00 and 15:00 to 24:00 windows and a 30 minute
  buffer, a 60 minute service ends its start grid at 01:30 and 22:30. Do not invent 02:00 or 23:00
  choices in the browser. Cancelled bookings no longer consume backend capacity, but an open page
  must request fresh availability before displaying that change.
- The backend keeps fleet capacity occupied for the configured post-booking buffer after `scheduled_end_at`. The website should continue to display the actual service end only.
- The local mock API must mirror production slot generation and buffer-aware conflict behavior so booking demos cannot overbook a bus/driver pair.
- Keep dispatch metadata operational: do not show bus availability or assignment cards in customer booking flows.
- Do not expose bus numbers, plate numbers, or driver names to customers in the website flow.
- Do not change the booking creation payload shape just to support manager-side dispatch assistance.
- Physical products selected in the booking confirmation step use `product_lines` and belong to the booking's single payment. They are distinct from service add-ons and from standalone `/store` orders, which retain their own checkout.
- Standard booking actions stay visible in a viewport-fixed, safe-area-aware footer. Active forms must reserve enough bottom space that fields, errors, and time popovers are never hidden behind it. Page-transition wrappers must not retain transforms, because transformed ancestors break viewport-fixed positioning.
- The location step requires a pinned coordinate plus a Qatar address card. Building number is mandatory; zone and street numbers are optional. Resolve authoritative service/dispatch coverage before advancing to Schedule. An unsupported location stays on Location and uses the fixed informational snackbar rather than an inline panel or red error, so the guidance remains visible at any scroll position; a covered location with no available slots advances normally so another day can be chosen. If a selected slot becomes stale after the page is restored or revisited, clear the slot and return the customer to Location before they can pick a fresh time.
- Service selection is mobile-first: two compact service cards per row, SUV / 4-Wheel first, and a reduced-motion-aware guided scroll to the vehicle/add-ons section. Selecting a service focuses and selects its plate/registration input.
- Preserve space for server-backed booking content with responsive skeletons; do not replace service, product, membership, or availability regions with blank space or unstructured loading text.
- Keep optional physical booking products behind the explicit “Add products to your booking” confirmation-step trigger so notes and the summary remain visible. The picker opens once when Pay & Confirm is first reached. It must be a centered document-level modal portal—not a bottom drawer or a fixed element nested inside the glass wizard—and must freeze background scroll while quantities change.
- Make the confirmation-step product trigger visually distinct and easy to notice, but keep attention animation finite and disable it through the global reduced-motion rule; never use a continuous decorative animation at checkout.
- Customer totals must include service add-ons and selected booking products. A selected quarter-hour must remain visible on its hour pill.

## Membership Rules

- Membership redemption stays inside `/book`; `/book/membership` remains only a legacy redirect.
  After authentication, load owner-scoped memberships and switch any customer with a redeemable
  plan to the membership-first variant. Surface an early sign-in prompt so returning members do not
  waste time selecting a normal service before the website can identify them.
- Do not restore a membership opt-out toggle, service selector, add-ons, quote, promo, or a separate
  redemption wizard. The purchased plan derives the service. The customer selects one vehicle;
  sedan plans show only sedans and SUV plans show only SUVs. New vehicles must be saved before
  requesting membership slots so the backend can authorize the exact vehicle.
- New membership vehicles ask only for the plate number; the membership supplies the eligible
  sedan/SUV type. Keep an internal vehicle-create idempotency key stable for an identical retry and
  rotate it when the plate or type changes. An explicit “Add a different vehicle” choice must
  suspend automatic saved-vehicle selection until the customer chooses a saved vehicle again.
- Membership availability comes exclusively from
  `GET /memberships/{membership}/booking-options?date=YYYY-MM-DD&vehicle_id={id}`. Public
  availability must not expose the midnight grid. Plans with the private window may show only
  backend-returned quarter-hour slots from 00:00 through 04:45.
- Membership Pay & Confirm uses the same optional-product modal as an ordinary booking and opens it
  once when the step is first reached. Do not add a separate yes/no product question. Closing the
  modal with no selection allows immediate confirmation only when the selected zone has no charge.
  Selected products are sent in `product_lines`; checkout and the displayed amount due cover products
  plus the separate immutable service-zone charge, while the wash remains reserved until verified payment.
- Final booking copy follows the payable state: **Confirm booking** when fully covered, **Pay for
  products** when only products are due, and **Confirm & Pay** whenever an ordinary balance or
  service-zone charge remains payable.
- Selecting a membership plan must open a review dialog before any purchase request. Show wash scope, vehicle type, wash count, validity, per-wash price, and total; only the explicit confirmation action may continue to authentication/payment.
- Membership plan grids reserve their final layout with accessible skeleton cards while plan data loads.

## Backend snapshots and loyalty

- Use the selected vehicle type's backend sedan/SUV duration. Availability, price, duration, coverage, and payment outcome are server facts, not browser calculations.
- Coordinates and opaque `dispatch_zone.version` survive availability, quote, and booking commit. Recover stale configuration through Location. National service eligibility and active dispatch coverage remain distinct; use the shared service area contract.
- Resolved zone pricing is immutable and shown at Location and Pay & Confirm. A configured minimum-spend rule uses backend values, compares gross selected services before discounts, and adds a separate below-threshold charge only when applicable. Require explicit confirmation and send the acknowledgement before booking. Membership booking-options currently report minimum-spend pricing as disabled; do not infer or recreate the surcharge client-side. Flat zone rates remain payable under membership, and loyalty/promo/manual discounts never reduce applicable zone charges. Stale quotes return to review before payment.
- Loyalty marketing reads public active status. Account progress and matched per line rewards are authoritative; keep reward IDs inside signed quotes, disable promo while selected, and show base wash coverage separately from payable addons/products. Paused balances remain visible but cannot be claimed.
- The shared bilingual loyalty modal may prompt once per session after homepage Services engagement. Booking/account entry points are voluntary. Progress, choices, prices, history, and paused state stay inline; do not replace them with a promotional modal.
- Preserve request ordering guards, selected quarter hour visibility, no customer bus/driver/plate data, and no cross zone fallback. A covered zone with no time offers another day; uncovered location stays at Location.

## Key files and checks

Use `components/booking`, `components/loyalty`, `app/book`, and `lib/booking`. Unit/contract tests and `tests/e2e` cover adaptive membership routing, product modal, stale versions, hour choices, and payment recovery. Auth steps follow the app guide, not a separate booking auth policy.

## Related context

- [Service area, duration, and Qatar time](../../lib/AGENTS.md)
- [Auth and payment returns](../../app/AGENTS.md)
- [Portals, fixed controls, and accessibility](../AGENTS.md)
- [Separate store checkout](../store/AGENTS.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
