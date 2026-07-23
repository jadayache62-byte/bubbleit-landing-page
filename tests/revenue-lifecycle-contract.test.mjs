import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const schema = JSON.parse(readFileSync(new URL("../docs/contracts/public-contract-v1.schema.json", import.meta.url), "utf8"));

test("customer account does not render internal financial lifecycle information", () => {
  assert.doesNotMatch(account, /financial_lifecycle/);
  assert.doesNotMatch(account, /membership\.financials/);
  assert.doesNotMatch(account, /Revenue recognition/);
  assert.doesNotMatch(account, /deferred balance/i);
  assert.doesNotMatch(account, /accounting_status/);
  assert.doesNotMatch(account, /accounting_code/);
});

test("customer types and public schemas exclude accounting internals", () => {
  assert.doesNotMatch(types, /FinancialLifecycle/);
  assert.doesNotMatch(types, /MembershipFinancials/);

  const booking = schema.$defs.Booking;
  const storeProduct = schema.$defs.StoreProduct;
  const storeOrder = schema.$defs.StoreOrder;
  for (const field of ["financial_lifecycle", "financials", "accounting_status", "accounting_code"]) {
    assert.equal(booking.properties[field], undefined);
    assert.equal(storeOrder.properties[field], undefined);
    assert.equal(booking.required.includes(field), false);
    assert.equal(storeOrder.required.includes(field), false);
  }
  assert.equal(schema.$defs.BookingFinancialLifecycle, undefined);
  assert.equal(schema.$defs.StoreFinancialLifecycle, undefined);
  assert.equal(storeProduct.properties.accounting_code, undefined);
  assert.equal(storeProduct.required.includes("accounting_code"), false);
  assert.deepEqual(storeProduct.properties.category.enum, ["car_care", "tools", "accessories"]);
});
