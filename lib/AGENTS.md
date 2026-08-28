# Customer shared contracts and helpers

## Overview

API types, duration, service eligibility, localization, Qatar time, and safe development mocks.

Paths in code and commands are relative to the repository root. These rules also apply to callers outside this directory.

## Contracts and shared code

- Backend source `docs/api/public-contract-v1.schema.json` is copied byte identically to `docs/contracts/public-contract-v1.schema.json` here and in mobile. `docs/contracts/duration-v1.json` is byte identical in all three repos. Coordinate schema changes with provider/consumer tests.
- Keep type unions, nullable fields, error/pagination parsing, integer product IDs, and mock fixtures aligned. A catalogue outage means unavailable/retry, never production cart hydration from `STORE_PRODUCTS`.
- Use `@/` imports, `lib/api/client.ts`, `lib/api/types.ts`, `lib/money.ts`, `lib/datetime.ts`, and `lib/i18n.tsx`. Browser calls remain behind the BFF.
- Use backend `duration-v1` from availability, echo its version to quote, then the accepted quote version to commit. Recover `DURATION_VERSION_STALE` by reloading availability; do not calculate scheduling duration from the catalogue.
- `lib/mock` and `/api/mock/v1/customer` are development only. Match production buffer/zone capacity, stale versions, no-store phone discovery, and purpose bound OTP behavior. A bus in one zone cannot supply capacity in another, and mock responses never prove production eligibility.

## Service Area Contract

* Service eligibility uses the backend versioned union of CGIS Qatar land territory and the
  Qatar only 12 NM territorial sea polygon. It is separate from active dispatch coverage.
  Dispatch zone authoring accepts valid world coordinate polygons, while customer eligibility
  still uses the backend boundary. Browser copy and development mocks are never production
  evidence of eligibility; preserve the returned service area version.
- Availability validates the pinned coordinates and returns a
  `service_area.version`. Quote, booking creation, and store order creation must
  carry that exact version. Handle `SERVICE_AREA_STALE` by returning the
  customer to Location for confirmation. Handle `SERVICE_AREA_OUTSIDE_QATAR`
  and `DISPATCH_ZONE_UNCOVERED` on Location with a localized, fixed, non-danger
  snackbar that tells the customer to move the pin or choose another saved location.
- Saved addresses without current eligibility evidence must be edited and
  revalidated. Never infer eligibility from an address containing “Qatar”.

## Arabic localization and RTL (MAD-59)

- Derive the initial document language and direction on the server from the locale cookie, and persist explicit language changes immediately. Arabic pages must render with `lang="ar"` and `dir="rtl"` before hydration.
- App-owned navigation, actions, validation, status, policy, accessibility, and recovery copy belongs in the shared localization layer. Customer names and user-created service or product names may remain exactly as authored in English or any other entered language; do not machine-translate them.
- This includes dynamic object labels, generated defaults such as saved-location names, client-side
  runtime errors, legal-page chrome, and server-rendered metadata. Do not hide English prose in a
  conditional, constant, error constructor, state setter, or static `metadata` export. Add paired
  catalog entries and keep the localization contract scanner green.
- Format QAR and locale-sensitive values through the shared money/date helpers. Use CSS logical properties and directional semantics rather than hardcoded left/right assumptions.
- Keep the RTL/localization contract test and Arabic browser journey as release gates, including compact layouts and increased text size. MAD-59 received owner acceptance on 2026-07-19; preserve its verified copy and authored-content policy.

## Timezone Convention

- All booking times are **Qatar wall-clock** (UTC+3, no DST). The client operates only in Doha.
- The backend stores `scheduled_at` as Qatar wall-clock and serializes it with a `+00:00` offset — treat the digits as Qatar time, never convert to the viewer's browser time zone.
- Use the helpers in `lib/datetime.ts` for anything time-related: `formatQatarDateTime` for display, `qatarSlotMs` for past-slot checks, `nextQatarDays` for day pickers. Do not call `new Date(...).toLocaleString()` on API datetimes directly.
- Booking creation continues to send a naive `YYYY-MM-DDTHH:MM:00` string, which the backend interprets as Qatar wall-clock.

## Checks

CI retains lint, unit/contract regression, production build, and local Playwright fault injection as blocking. Keep the RTL scanner and Arabic browser journey. No test contacts real payment, messaging, production, or shared services.

## Related context

- [BFF and CSP security](../app/AGENTS.md)
- [Booking snapshots](../components/booking/AGENTS.md)
- [Store pricing and order ownership](../components/store/AGENTS.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
