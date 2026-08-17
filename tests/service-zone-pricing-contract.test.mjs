import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const booking = read("../components/booking/BookingWizard.tsx");
const notice = read("../components/ServiceZoneChargeNotice.tsx");
const storeCheckout = read("../components/store/StoreCheckoutClient.tsx");
const mock = read("../app/api/mock/v1/customer/[...path]/route.ts");
const types = read("../lib/api/types.ts");

test("booking location and every checkout show the backend-owned service-zone charge", () => {
  assert.match(booking, /<ServiceZoneChargeNotice rate=\{serviceZoneRate\}/);
  assert.match(booking, /serviceZoneRate=\{checkoutZoneRate\}/);
  assert.match(booking, /Additional service-zone charge/);
  assert.match(notice, /This location is subject to an additional service charge of \{amount\}/);
  assert.match(storeCheckout, /<ServiceZoneChargeNotice rate=\{serviceZoneRate\}/);
  assert.match(storeCheckout, /displayedZoneRateMinor/);
});

test("memberships and loyalty cannot remove the location charge", () => {
  assert.match(booking, /productTotal \+ checkoutZoneRate/);
  assert.match(booking, /The service-zone charge remains payable/);
  assert.match(types, /"membership_with_balance"/);
  assert.match(mock, /membership_with_balance/);
  assert.match(mock, /serviceTotal - membershipDiscount - promoDiscount \+ productTotal\)[\s\S]*\+ serviceZoneRate/);
});

test("store pricing v2 snapshots separate base delivery and service-zone amounts", () => {
  for (const field of [
    "product_subtotal_minor",
    "base_delivery_fee_minor",
    "service_zone_rate_minor",
    "combined_delivery_minor",
    "dispatch_zone_token",
  ]) {
    assert.match(types, new RegExp(field));
    assert.match(mock, new RegExp(field));
  }
  assert.match(storeCheckout, /dispatch_zone_version: serviceArea\.dispatch_zone\.version/);
  assert.match(storeCheckout, /STORE_PRICING_CHANGED/);
});
