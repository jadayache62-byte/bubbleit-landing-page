import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync(
  new URL("../components/booking/BookingWizard.tsx", import.meta.url),
  "utf8",
);
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");

test("quote timeout or 500 exposes retry and cannot submit without an authoritative quote", () => {
  assert.match(wizard, /setQuoteError\(/);
  assert.match(wizard, /Retry quote/);
  assert.match(wizard, /disabled=\{submitting \|\| !authed \|\| quoteLoading \|\| !quote\?\.duration\.version\}/);
  assert.match(wizard, /We couldn't verify the current price and coverage/);
});

test("booking creation and payment initialization remain separate UI states", () => {
  assert.match(wizard, /createBooking\(/);
  assert.match(wizard, /initializeBookingPayment\(/);
  assert.match(wizard, /Booking saved — payment pending/);
  assert.match(wizard, /Booking confirmed — membership covered/);
  assert.match(wizard, /Booking confirmed — payment received/);
  assert.match(wizard, /Payment under review/);
});

test("client accepts a nullable checkout contract and validates it before redirect", () => {
  assert.match(client, /checkout_url: string \| null/);
  assert.match(wizard, /usableCheckoutUrl\(payment\.checkout_url\)/);
  assert.doesNotMatch(wizard, /window\.location\.assign\(payment\.checkout_url\)/);
});
