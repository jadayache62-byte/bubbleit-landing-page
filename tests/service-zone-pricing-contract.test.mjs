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
  assert.match(booking, /<ServiceZoneChargeNotice[\s\S]*rate=\{serviceZoneRate\}/);
  assert.match(booking, /serviceZoneRate=\{checkoutZoneRate\}/);
  assert.match(booking, /Additional service-zone charge/);
  assert.match(notice, /This location is subject to an additional service charge of \{amount\}/);
  assert.match(storeCheckout, /<ServiceZoneChargeNotice rate=\{serviceZoneRate\}/);
  assert.match(storeCheckout, /displayedZoneRateMinor/);
});

test("memberships and loyalty cannot remove the location charge", () => {
  assert.match(booking, /productTotal \+ checkoutZoneRate \+ checkoutMinimumSpendSurcharge/);
  assert.match(booking, /The service-zone charge remains payable/);
  assert.match(types, /"membership_with_balance"/);
  assert.match(mock, /membership_with_balance/);
  assert.match(mock, /serviceTotal - membershipDiscount - promoDiscount \+ productTotal\)[\s\S]*\+ serviceZoneRate/);
});

test("minimum-spend pricing is dynamic, separately displayed, and explicitly confirmed", () => {
  assert.match(notice, /A minimum order of \{minimum\} applies to this area/);
  assert.match(booking, /setMinimumSpendEnabled\(snapshot\.dispatch_zone\.minimum_spend_enabled/);
  assert.match(booking, /setMinimumSpend\(snapshot\.dispatch_zone\.minimum_spend/);
  assert.match(booking, /setMinimumSpendSurcharge\(snapshot\.dispatch_zone\.minimum_spend_surcharge/);
  assert.match(booking, /minimumSpendSurcharge=\{checkoutMinimumSpendSurcharge\}/);
  assert.match(booking, /Below-minimum service-area charge/);
  assert.match(booking, /checked=\{minimumSpendConfirmed\}/);
  assert.match(booking, /minimum_spend_surcharge_confirmed: checkoutMinimumSpendSurcharge > 0/);
  assert.match(booking, /!membershipMode \|\| minimumSpendSurchargeApplied > 0/);
  assert.match(types, /pricing_schema: "booking-cart-pricing:v3"/);
  assert.match(types, /minimum_spend_surcharge_applied/);
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
