# Changelog

---

## [2026-07-10] — Booking reliability

### Fixed
- **Booking times now stay on the selected Qatar wall-clock hour** — shared datetime formatting recognizes the timezone-naive timestamps returned by the local mock as Qatar wall-clock values, so confirmations and account cards no longer shift them by the viewer's timezone. Booking and membership payloads now use one shared serializer for the customer API's `YYYY-MM-DDTHH:mm:ss` contract.
- **Saved cars are reused when booking** — selecting a saved-car chip now retains its vehicle ID and sends that existing vehicle in the booking payload instead of creating a duplicate saved car. Editing a vehicle field switches the draft back to a new vehicle safely.
- **Slot availability stays current** — late availability responses from a previously selected day are ignored, and a capacity-conflict retry now reloads availability with the selected services so duration-aware slots remain accurate.
- **Availability now reflects the complete wash cart** — selected add-ons are included when finding a slot, so the times shown match the duration the booking service will reserve.
- **Store payment failures are recoverable** — a created store order and cart are retained when payment setup fails, letting the customer retry payment without creating a duplicate order.

---

## [2026-07-09] — Saved cars: chips in booking, My Cars tab, 6-digit plates

### Added
- **Saved-car chips in the booking wizard** — logged-in customers see their saved cars (filtered to the card's vehicle kind) as selectable chips above the plate field; tapping one fills the plate, type, make, model, and color, so repeat bookings need no typing.
- **My Cars tab on `/account`** — the account page now has Bookings / My Cars tabs; the cars tab lists each saved car by plate (with make/model/color and type badge) and allows removal (cars attached to an active booking are protected by the backend). New EN/AR strings.
- **`deleteVehicle()`** in the API client.

### Changed
- **Plate inputs accept at most 6 digits** — the wizard's car plate field and the membership add-vehicle field are numeric-only, max 6 (Qatar plates); jet ski / caravan registration fields keep free text.

### Notes
- Backend companion (bubbleit-backend): `POST /customer/vehicles` now returns the existing vehicle when the same plate is re-submitted (plates are the car's identity), so wizard-created vehicles no longer duplicate per booking.

## [2026-07-09] — Booking 409s show the real reason

### Fixed
- **Duplicate-booking rejection masqueraded as "no buses available"** — the booking wizard replaced every 409 from booking creation with "That slot was just taken." The backend guard is now vehicle-keyed (same customer CAN book a second car at the same time; the same car cannot be double-booked), and the wizard shows a dedicated message for that case ("One of your cars already has a booking at this time…", EN/AR) while keeping the slot-taken message for genuine capacity 409s.

## [2026-07-08] — Booking times always shown in Qatar time

### Added
- **`lib/datetime.ts`** — shared Qatar wall-clock helpers: `formatQatarDateTime` (renders backend `scheduled_at` verbatim instead of converting to the browser time zone), `qatarSlotMs` (epoch of a Qatar slot for past-slot checks), and `nextQatarDays` (day picker list anchored to Qatar's today).

### Fixed
- **Booking confirmation showed the wrong hour outside Qatar** — the backend returns `scheduled_at` as Qatar wall-clock labeled `+00:00`; the success panel (`BookingWizard`) and My Bookings (`/account`) converted it to the viewer's time zone, so an 11 AM booking displayed as 1 PM on a UTC+2 browser. Both now render Qatar wall-clock for every viewer.
- **Past-slot graying used the browser time zone** — today's slots in the booking wizard and membership redemption flow are now compared against Qatar time (`+03:00`), so slots no longer disable an offset-dependent number of hours too early or too late for viewers outside Qatar.
- **Day picker anchored to the browser's today** — the 7-day date strips in both booking flows now start from Qatar's current date, so viewers in time zones behind Qatar no longer see (and book) yesterday's Qatar date around midnight.

## [2026-07-08] — Bus-aware website slot messaging

### Added
- **Dispatch-aware slot metadata support** — customer availability slot types now accept optional `available_bus_count` and `has_recommendation` fields from the backend.

### Changed
- **Booking wizard schedule step** — after slot selection, the booking flow can show simple fleet-availability messaging such as how many buses are currently available for that time.
- **Customer dispatch messaging** — the website now communicates that final bus assignment is confirmed by the Bubble It team, without exposing bus identity or adding a customer-facing bus selection step.

### Fixed
- **No contract drift in booking submit flow** — the website still sends the same booking creation payload and only renders the new dispatch-aware feedback when the backend includes it.
