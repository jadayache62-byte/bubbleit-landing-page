# Bubble It Landing + Booking Site

Next.js customer-facing site for `https://bubbleit.qa`.

## Local Development

```bash
npm install
npm run dev
```

If `CUSTOMER_API_BASE` is not set in development, the server-side BFF falls back to the local mock API under `/api/mock/v1/customer`.

To run against the real backend:

```bash
cp .env.example .env.local
```

## Production

Set this env var on Forge:

```bash
CUSTOMER_API_BASE=https://bubbleit-backend.on-forge.com/api/v1/customer
```

Use a real Next.js production process:

```bash
npm install
npm run build
npm run start
```

Do not deploy production with the mock API fallback.

## Payment Behavior

- Membership purchases use the backend SkipCash hosted checkout.
- Regular customer bookings should be created with pay-later/pay-on-site behavior until a separate booking PSP is added.
- Managers can mark regular bookings as paid from the ERP admin app before assignment when needed.
