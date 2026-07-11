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
- If the backend returns dispatch-aware slot metadata, the UI may show lightweight operational feedback only:
  - available bus count for the selected time
  - a note that final bus assignment is confirmed by the Bubble It team
- Do not expose bus numbers, plate numbers, or driver names to customers in the website flow.
- Do not change the booking creation payload shape just to support manager-side dispatch assistance.
- Physical products selected in the booking confirmation step use `product_lines` and belong to the booking's single payment. They are distinct from service add-ons and from standalone `/store` orders, which retain their own checkout.

## Timezone Convention

- All booking times are **Qatar wall-clock** (UTC+3, no DST). The client operates only in Doha.
- The backend stores `scheduled_at` as Qatar wall-clock and serializes it with a `+00:00` offset — treat the digits as Qatar time, never convert to the viewer's browser time zone.
- Use the helpers in `lib/datetime.ts` for anything time-related: `formatQatarDateTime` for display, `qatarSlotMs` for past-slot checks, `nextQatarDays` for day pickers. Do not call `new Date(...).toLocaleString()` on API datetimes directly.
- Booking creation continues to send a naive `YYYY-MM-DDTHH:MM:00` string, which the backend interprets as Qatar wall-clock.

## Change Log Requirement

- Keep `CHANGELOG.md` updated for each implementation session that changes user-visible site behavior or booking-flow behavior.
