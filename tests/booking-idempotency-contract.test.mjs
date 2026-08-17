import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../components/booking/BookingWizard.tsx", import.meta.url), "utf8");
const vehicleKeys = readFileSync(new URL("../lib/booking/vehicle-idempotency.ts", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("booking commands keep one persisted attempt while vehicle payloads have scoped keys", () => {
  assert.match(wizard, /BOOKING_ATTEMPT_KEY/);
  assert.match(wizard, /attemptKey}:address/);
  assert.match(wizard, /vehicleCommandKey\(`booking:\$\{car\.key\}`/);
  assert.match(wizard, /vehicleCommandKey\("membership"/);
  assert.match(wizard, /attemptKey}:booking/);
  assert.match(wizard, /attemptKey}:payment/);
  assert.match(vehicleKeys, /existing\?\.payload === signature/);
  assert.match(vehicleKeys, /const key = `vehicle\.\$\{generate\(\)\}`/);
});

test("booking persistence and payment initialization are separate API commands", () => {
  assert.match(client, /initializeBookingPayment/);
  assert.match(client, /bookings\/\$\{bookingId\}\/pay/);
  assert.match(wizard, /canRetryBookingPayment\(bookingPaymentUiState\(booking\.payment\?\.status\)\)/);
  assert.match(wizard, /Booking saved — payment pending/);
});

test("all mutating client commands carry the standard idempotency header", () => {
  assert.ok((client.match(/"Idempotency-Key"/g) ?? []).length >= 4);
});

test("development mock replays scoped successful responses and rejects mismatches", () => {
  assert.match(mock, /idempotencyResponses/);
  assert.match(mock, /IDEMPOTENCY_KEY_REUSED/);
  assert.match(mock, /authCustomer\(req\)\?\.id/);
});
