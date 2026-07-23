import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkout = readFileSync(
  new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url),
  "utf8",
);
const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const mock = readFileSync(
  new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url),
  "utf8",
);

test("checkout submits the exact QAR minor-unit pricing the customer reviewed", () => {
  assert.match(types, /StorePricingConfirmation/);
  assert.match(types, /pricing_confirmation: StorePricingConfirmation/);
  assert.match(checkout, /pricing_confirmation: reviewedPricing/);
  assert.match(checkout, /Math\.round\(amount \* 100\)/);
  assert.match(checkout, /order\.pricing\.total_minor !== reviewedPricing\.total_minor/);
});

test("changed pricing stops before payment and requires another confirmation", () => {
  assert.match(checkout, /caught\.code === "STORE_PRICING_CHANGED"/);
  assert.match(checkout, /setPricingReview\(updatedPricing\)/);
  assert.match(checkout, /Review the updated prices and confirm again/);
  assert.match(checkout, /Confirm updated total and pay/);

  const conflict = checkout.indexOf("caught.code === \"STORE_PRICING_CHANGED\"");
  const payment = checkout.indexOf("await initializePayment(checkout)");
  assert.ok(conflict > payment, "the create response must be handled before the payment call can be reached");
});

test("development simulator checks pricing before reserving inventory", () => {
  assert.match(mock, /STORE_PRICING_CHANGED/);
  assert.match(mock, /storePricingMatches\(body\.pricing_confirmation, pricing\)/);
  assert.match(mock, /pricing,\n\s+delivery_area:/);
  assert.doesNotMatch(mock, /const order: StoreOrder = \{[\s\S]*customer_name:/);

  const pricingCheck = mock.indexOf("if (!storePricingMatches");
  const reservation = mock.indexOf("product.reserved_quantity += line.quantity", pricingCheck);
  const orderCreation = mock.indexOf("const order: StoreOrder", pricingCheck);
  assert.ok(pricingCheck >= 0 && pricingCheck < reservation && reservation < orderCreation);
});
