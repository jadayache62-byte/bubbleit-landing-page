# BubbleIt privacy and store-declaration inventory

Policy version: `2026-07-18-v1`  
Effective date: `2026-07-18`

This repository-owned inventory must match the Apple App Privacy and Google Play Data Safety
declarations. It is implementation evidence, not evidence that a store form was submitted.

## Controller and approved domains

- Controller: Bubble It Cars Washing LLC
- Commercial Registration: 182268
- Address: Building No. 24, Zone 60, Street 950, Qatar
- Privacy contact: privacy@bubbleit.qa
- Customer/legal site: https://bubbleit.qa
- Customer API: https://bubbleit-backend.on-forge.com/api/v1/customer
- Operations API: https://bubbleit-backend.on-forge.com/api/v1
- Operations web app: https://bubbleit-admin.web.app

## Public legal and deletion URLs

- Privacy: https://bubbleit.qa/privacy
- Terms: https://bubbleit.qa/terms
- External account deletion: https://bubbleit.qa/account-deletion

## Data categories

| Category | Collected | Shared with processors | Purpose |
|---|---:|---:|---|
| Name, phone, optional email | Yes | Only as needed | Account, service, support, transactional communication |
| Precise service location and address | Yes | Mapping/hosting as needed | Eligibility, dispatch, fulfilment |
| Vehicle information | Yes | Only as needed | Booking and fulfilment |
| Bookings, orders, memberships | Yes | Hosting and operational processors | Core service and accounting |
| Payment/refund references and amounts | Yes | Payment processor | Payment, refund, reconciliation, fraud prevention |
| Full card number/CVV | No | Payment processor hosts its own card form | Not stored by BubbleIt |
| Device notification token | Optional | Notification provider | User-enabled push delivery |
| Reviews and support communication | Optional | Hosting/support processors | Customer support and moderation |
| IP, request ID, session/security events | Yes | Hosting/security processors | Authentication, security, incident response |
| Advertising identifier | No | No | Not used |
| Cross-app tracking data | No | No | Not used |

## Security and deletion answers

- Data is encrypted in transit.
- Customer sessions are held in an HttpOnly, Secure, SameSite cookie on the customer web app.
- Account deletion is available through an authenticated flow and an external public URL.
- Deletion requires a fresh OTP and explicit irreversible confirmation.
- All sessions and notification devices are revoked immediately.
- Non-retained personal data is erased or irreversibly anonymized immediately by the current workflow.
- Pseudonymous booking/service records are retained for five years.
- Pseudonymous payment/refund/invoice/order/membership records are retained for ten years.
- OTP and notification-delivery logs are retained for 90 days; security/access logs for 12 months;
  support records for two years; legal holds until final resolution.
- A portable JSON export uses a 15-minute, single-use, authenticated download credential.

## Provider completion gate

Before store submission, replace generic processor categories in the published privacy notice with
the confirmed production provider identities. Do not declare SkipCash, WhatsApp/SMS, web push, or
other optional providers active until their production integration is actually enabled.
