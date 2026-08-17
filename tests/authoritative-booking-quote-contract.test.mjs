import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync(new URL("../components/booking/BookingWizard.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("quote and commit carry one versioned authoritative cart snapshot", () => {
  assert.match(types, /quote_id: string/);
  assert.match(types, /quote_version: string/);
  assert.match(types, /product_total: number/);
  assert.match(client, /product_lines\?: \{ product_id: number; quantity: number \}\[\]/);
  assert.match(wizard, /quote_id: quote\.quote_id/);
  assert.match(wizard, /quote_version: quote\.quote_version/);
  assert.match(wizard, /quote\?\.total_price/);
});

test("membership booking skips service quote and submits only plan, vehicle, slot, location, and products", () => {
  assert.match(client, /getMembershipBookingOptions/);
  assert.match(wizard, /membership_id: selectedMembership\.id/);
  assert.match(wizard, /vehicle_id: cars\[0\]\.vehicleId/);
  assert.match(wizard, /duration_version: availabilityDuration\.version/);
  assert.match(wizard, /product_lines: productLines/);
  assert.match(wizard, /autoOpen=\{!productPromptSeen\}/);
  assert.doesNotMatch(wizard, /membershipProductChoice|Would you like any store products/);
  assert.match(wizard, /The service is included with your plan/);
  assert.match(mock, /membershipBookingOptionsMatch/);
  assert.match(mock, /Midnight availability requires an eligible membership/);
  assert.match(mock, /required === "sedan"\) return vehicleType === "sedan"/);
  assert.match(mock, /required === "suv"\) return vehicleType === "suv"/);
});

test("ordinary bookings retain the authoritative quote contract", () => {
  assert.match(mock, /bookingQuotes\.set\(quoteId/);
  assert.match(mock, /pricing_schema: "booking-cart-pricing:v2"/);
  assert.match(wizard, /quote_id: quote\.quote_id/);
  assert.match(wizard, /quote_version: quote\.quote_version/);
});
