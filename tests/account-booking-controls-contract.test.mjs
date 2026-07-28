import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(
  new URL("../app/account/page.tsx", import.meta.url),
  "utf8",
);

test("booking cancellation exposes a duplicate-safe loading state and updates the returned booking", () => {
  assert.match(account, /const action = `cancel-booking:\$\{id\}`/);
  assert.match(account, /if \(paymentAction \|\| !window\.confirm/);
  assert.match(account, /setPaymentAction\(action\)/);
  assert.match(account, /const cancelled = await cancelBooking\(id\)/);
  assert.match(account, /item\.id === cancelled\.id \? cancelled : item/);
  assert.match(account, /cancelling=\{paymentAction === `cancel-booking:\$\{booking\.id\}`\}/);
  assert.match(account, /disabled=\{busy\}[\s\S]*t\("Cancelling…"\)/);
});

test("booking history defaults to descending booking number and supports search and status filters", () => {
  assert.match(account, /compareBookingReferencesDescending/);
  assert.match(account, /b\.reference\.localeCompare\(a\.reference/);
  assert.match(account, /numeric: true/);
  assert.match(account, /useState<BookingFilter>\("all"\)/);
  assert.match(account, /type="search"/);
  assert.match(account, /value=\{bookingFilter\}/);
  assert.match(account, /visibleBookings\.map\(\(booking\)/);
});
