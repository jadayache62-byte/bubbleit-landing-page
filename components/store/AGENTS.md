# Store and checkout

## Overview

Product catalog, cart, authenticated checkout, and pending order recovery.

Paths in code and commands are relative to the repository root. These rules also apply to callers outside this directory.

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

## Pricing and recovery

- Authenticated checkout is Location > Review; unauthenticated checkout includes Contact as its auth/OTP gate. Guest order creation is unsupported. Preserve cart through auth and bind pending orders to the server owner.
- Store pricing v2 is immutable. Show product subtotal, base delivery, and the exact zone charge separately; promotions or membership/loyalty do not remove the zone charge. Reconfirm changed pricing before payment.
- Preserve `service_area.version` at order creation and resolve stale/outside coverage through Location. The backend owns national boundary, dispatch coverage, and inventory; never infer them from address text or catalogue mocks.
- A provider return is not payment proof. Preserve processing, failure, cancellation, review, refund, and retry states; the app guide owns the bounded authoritative payment recovery procedure.
- Use `components/store`, `app/store`, `lib/store`, and shared `lib/booking/payment-flow.ts`. Check unit/contract and `tests/e2e` cases for cart retention, duplicate prevention, redirect lock restoration, owner scope, and stale pricing.

## Related context

- [BFF, auth gate, and payment state](../../app/AGENTS.md)
- [Shared contracts and eligibility](../../lib/AGENTS.md)
- [Accessible modal and fixed controls](../AGENTS.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
