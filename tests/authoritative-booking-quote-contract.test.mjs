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
  assert.match(wizard, /const dueTotal = quote\?\.total_price/);
});

test("membership selection is explicit per car and products are quoted server-side", () => {
  assert.match(wizard, /membershipChoices/);
  assert.match(wizard, /membership_id: explicitChoices\[index\] \?\? null/);
  assert.match(wizard, /Eligible washes are preselected/);
  assert.match(wizard, /product_lines: Object\.entries\(productQuantities\)/);
  assert.match(mock, /bookingQuotes\.set\(quoteId/);
  assert.match(mock, /pricing_schema: "booking-cart-pricing:v1"/);
});
