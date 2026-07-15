# Changelog

---

## [2026-07-15] — Authenticated store checkout contract (MAD-48)

### Fixed
- Removed the broken guest checkout claim and now require sign-in or OTP-backed account verification before order review and creation.
- Preserved the browser cart across mid-checkout authentication while binding saved pending orders to their server-issued customer owner.
- Discarded cross-customer pending checkout details without clearing the cart, and mirrored the 15-minute reservation expiry in the development simulator.

## [2026-07-15] — Versioned booking cart confirmation (MAD-42)

### Fixed
- The final booking summary now renders server-quoted service, add-on, product, promo, and membership totals and submits the exact quote ID/version instead of combining server and browser calculations.
- Eligible membership washes are preselected but explicitly controllable per car; add-ons, products, and uncovered cars remain visibly payable.
- Expired or contested quotes return the customer to a fresh authoritative price instead of creating or paying a mismatched booking.

### Added
- Added the versioned quote contract to the customer client and development simulator, with deterministic contract tests for per-line membership choice and product-inclusive totals.

## [2026-07-15] — Authoritative booking and payment UI states (MAD-53)

### Fixed
- Quote timeout or server failure now blocks the final summary and submission with an explicit quote retry instead of falling back to client-calculated confirmation data.
- A saved payable booking is presented as payment pending until the server reports `paid`; membership-covered, paid, retryable, and reconciliation states now use distinct truthful headings, copy, and actions.
- Missing, blank, insecure, or protocol-relative checkout URLs fail closed and preserve the same saved booking for payment retry.

### Added
- Added deterministic state-contract tests for quote failure, provider unavailability, null checkout URL, membership coverage, paid success, and reconciliation behavior.

## [2026-07-14] — HttpOnly customer sessions and recovery (MAD-54)

### Security
- Customer API traffic now passes through a same-origin BFF that keeps the backend bearer token in an HttpOnly, Secure-in-production, SameSite=Lax cookie; bearer tokens are no longer exposed to JavaScript, localStorage, or direct browser requests.
- Cross-site mutations are rejected, upstream 401 responses clear the server-owned session, and password recovery revokes the temporary and all other sessions before requiring a fresh sign-in.

### Fixed
- Session loss preserves the intended path, renders a clear sign-in state, and never automatically replays an interrupted mutation.

---

## [2026-07-14] — Non-enumerating customer auth continuation (MAD-56)

### Security
- Phone discovery no longer branches on registration or password state. Every valid phone receives the same method chooser for password sign-in, account creation/claim, or OTP recovery.
- The development mock mirrors the generic, non-cacheable continuation and does not read customer state.

---

## [2026-07-14] — Purpose-bound customer OTPs (MAD-55)

### Security
- Registration and password-recovery requests now send an explicit OTP purpose, and the development mock enforces the same single-purpose consumption contract as the backend.
- API errors preserve `Retry-After` so throttled customers see the remaining wait instead of an indefinite retry message.

---

 ## [2026-07-14] — Qatar-wide service-area enforcement

### Changed
- Booking availability now validates the selected map pin against the backend's versioned Qatar land boundary; quote and booking creation carry the same boundary version.
- Store checkout validates the delivery pin before reserving stock, and saved locations require a confirmed coordinate.

### Fixed
- Spoofed Qatar address labels, offshore pins, stale saved-address eligibility, and replayed boundary versions now produce recoverable location errors instead of proceeding to capacity, stock, or payment.

---

## [2026-07-14] — Authoritative booking duration contract (MAD-68)

- Availability now supplies a versioned `duration-v1` snapshot; the booking wizard carries that version through quote and commit and will not confirm without an authoritative quote.
- Stale timing is handled separately from fleet-capacity conflicts: the wizard reloads availability and asks the customer to review the updated time.
 - Confirmation displays the backend’s total duration and each service/add-on timing contribution, including add-ons that add no operational time.
 - The development mock implements the same deterministic version, stale response, accepted snapshot, and contribution rules as Laravel.
 - Added the byte-identical cross-repository contract vector at `docs/contracts/duration-v1.json`.

---

## [2026-07-13] — Production audit hardening (build guard + security headers)

### Fixed
- Production builds now fail fast when `NEXT_PUBLIC_API_BASE` is unset, so a deploy can no longer silently fall back to the in-repo mock API and take fake bookings/payments. The mock stays a development-only fallback.

### Added
- Baseline security headers via `next.config.mjs`: `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## [2026-07-12] — Unified customer journeys and mobile commerce polish

### Added
- **Store discovery and mini-cart** — the store now includes search, category filters, aligned responsive product cards, inline quantity controls, a fixed View cart / Checkout footer, and a smooth accessible mini-cart with line totals and subtotal.
- **Three-step guest checkout** — store purchases now use Location → Contact → Review, support guest checkout without account creation, validate Qatar phone numbers, and preserve a clear future OTP verification point.
- **Account dashboard** — `/account` now provides an overview, upcoming booking, active membership, saved vehicles, quick actions, rebooking, cancellation, membership redemption/renewal, and vehicle removal.
- **Membership purchase confirmation** — choosing a membership opens a review dialog with scope, vehicle, washes, validity, per-wash price, and total before any request is sent.
- **Membership skeletons** — membership plan cards reserve their final responsive layout while pricing loads.

### Changed
- **Qatar address capture** — booking and store checkout location steps now support current location, manual map pinning, and a Qatar address card with mandatory building number plus optional zone, street, area, and extra details.
- **Historical customer-session baseline (superseded by MAD-54)** — customer auth previously mirrored bearer tokens into a script-readable SameSite cookie; MAD-54 replaced this with the server-owned HttpOnly BFF session above.
- **Phone input constraints** — login, signup, and guest checkout phone fields now accept only eight local Qatar digits and open a numeric keypad on mobile.
- **Stale booking timing reset** — restored booking pages clear old selected slots and return customers to the location step before they reselect availability.
- **Single booking flow** — all standard and membership actions now enter `/book`; legacy `/book/membership` URLs redirect to the standard wizard.
- **Automatic membership coverage** — the Pay & Confirm step detects eligible memberships through the server quote, applies coverage automatically, shows remaining washes, and removes the confusing opt-out path.
- **Products with covered washes** — customers can add physical products even when a membership covers the wash; only those products remain payable.
- **Dynamic final action** — the booking CTA now reads Confirm booking, Pay for products, or Confirm & Pay according to the server-backed payable state.
- **Booking progress and motion** — booking uses the same segmented progress treatment as store checkout, focuses the plate field after service selection, keeps its action footer viewport-fixed, and jumps immediately to the next step without a long scripted scroll.
- **Product upsell clarity** — the confirmation-step trigger now says Add products to your booking, opens the picker once, and uses a slower eased modal entrance.
- **Navigation architecture** — desktop and mobile navigation now center Services, Memberships, Store, Account, and one primary Book a Wash action.
- **Accessible account navigation** — account tabs use full ARIA tab semantics and keyboard navigation without horizontal clipping.

### Fixed
- **Cart hydration and overlay state** — saved cart restoration no longer causes hydration mismatch, and closed cart backdrops cannot leave a dark tint or intercept clicks.
- **Header CTA visibility** — the account Book a Wash action now has explicit high-contrast colors instead of rendering blank on white.
- **Fixed booking actions** — page-enter transforms no longer change the containing block for the fixed booking footer.
- **Account accessibility** — removed duplicate page headings, added contextual control names, consistent focus rings, inert hidden navigation, accessible loading states, and 44px touch targets.
- **Local development origin** — `127.0.0.1` is allowed in Next.js development so interactive pages and API-backed content load correctly.

### Removed
- **Customer-facing inventory counts** — product cards and checkout errors now communicate availability without exposing exact stock quantities.
- **Parallel membership redemption wizard** — customer-facing membership booking links no longer create a separate journey.

## [2026-07-11] — Booking flow loading and clarity

### Changed
- **Layout-preserving loading** — services, availability slots, booking products, and membership booking data now use responsive skeleton states instead of blank areas or loading text.
- **Calmer vehicle guidance** — service selection uses a slower eased scroll that finishes with the plate and saved-car controls clear of the fixed action bar.
- **Clear next action** — after service selection, the saved-car and plate area receives a subtle highlight and contextual hint that clears as soon as the customer selects or enters a vehicle.
- **Clearer service cards** — descriptions can use three lines and price/duration stay aligned to the bottom of every card.
- **Professional product modal** — optional booking products now open in a centered, responsive e-commerce modal with a stable internal product grid, larger imagery, clear quantity controls, a persistent selection total, focus trapping, and reliable page scroll locking.
- **Visible product opportunity** — the confirmation step now presents booking products as a polished “Enhance your booking” card with a shopping icon, recommendation badge, stronger commerce copy, and a short two-cycle attention pulse that respects reduced-motion preferences.

### Fixed
- **Returning customer login** — existing customers now go directly to password sign-in instead of being asked to claim/register the same account again. The mock API now returns both `registered` and `has_password`, while the client safely treats older responses without `has_password` as returning accounts.
- **Selected time feedback** — an hour pill now displays the selected quarter-hour rather than reverting visually to `:00`.
- **Complete booking total** — the summary total includes physical booking products as well as services, add-ons, discounts, and membership pricing.
- **Stable product selection** — changing a product quantity no longer moves the modal or scrolls the booking page, because the dialog now renders through a document-level portal.
- **Vehicle wording** — the multi-vehicle action now says “Add another vehicle.”

---

## [2026-07-11] — Mobile-first booking flow

### Changed
- **Compact service selection** — mobile booking now shows two service cards per row, keeps SUV / 4-Wheel first, and guides customers to saved-car or plate selection after choosing a service.
- **Persistent actions** — standard and membership bookings now use fixed, safe-area-aware action bars so Continue and Confirm remain reachable without scrolling.
- **Responsive extras** — service add-ons and physical booking products use compact layouts, accessible 44px controls, thumbnails, and overflow-safe mobile behavior.

### Removed
- **Customer bus availability card** — dispatch capacity remains enforced by the backend without exposing operational bus counts in the booking flow.

---

## [2026-07-11] — Booking product add-ons

### Added
- **Products in the booking checkout** — customers can add in-stock physical products on the booking confirmation step. Selected products are delivered with the service and included in the booking's single SkipCash payment.
- **Mock parity** — the local customer API reserves selected booking products, releases them on cancellation, and deducts them on mock payment completion.

### Documentation
- `CLAUDE.md` now requires implementation tasks to refresh durable documentation before commit, then verify, push, merge into `main`, and push the target branch.

---

## [2026-07-11] — Quarter-hour picker fallback

### Fixed
- **Hour popover always shows all quarter choices** — each opened hour now renders `:00`, `:15`, `:30`, and `:45` even if an API response omits some quarter rows; missing or unavailable choices remain disabled.

## [2026-07-10] — Quarter-hour booking picker and fleet buffer

### Added
- **Connected hour picker** — customer and membership booking flows group availability by hour and open an anchored picker for `:00`, `:15`, `:30`, and `:45` starts.

### Changed
- **Buffer-aware slots** — availability now keeps the fleet unavailable for the configured post-booking buffer while continuing to show customers the actual service end time.
- **Agent notes** — `CLAUDE.md` now documents the quarter-hour picker and the requirement for the local mock API to mirror production buffer conflicts.

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
