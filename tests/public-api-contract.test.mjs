import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = JSON.parse(
  readFileSync(new URL("../docs/contracts/public-contract-v1.schema.json", import.meta.url), "utf8"),
);
const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const mockStore = readFileSync(new URL("../lib/mock/store.ts", import.meta.url), "utf8");
const mockRoute = readFileSync(
  new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url),
  "utf8",
);
const staticProducts = readFileSync(new URL("../lib/store/products.ts", import.meta.url), "utf8");
const catalogue = readFileSync(new URL("../components/store/StoreClient.tsx", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url), "utf8");

function quotedValues(source) {
  return [...source.matchAll(/"([a-z][a-z0-9_]*)"/g)].map((match) => match[1]);
}

function typeBlock(name) {
  const match = types.match(new RegExp(`export type ${name} =([\\s\\S]*?);`));
  assert.ok(match, `missing ${name} type`);
  return match[1];
}

test("the checked-in public contract publishes envelope, error, null, and pagination shapes", () => {
  assert.equal(schema["x-contract-version"], "public-contract-v1");
  assert.deepEqual(schema.required, ["success", "message", "data", "errors"]);
  assert.deepEqual(schema.$defs.PaginationMeta.required, [
    "current_page",
    "last_page",
    "per_page",
    "total",
  ]);
  assert.deepEqual(schema.$defs.StoreProduct.properties.description.type, ["string", "null"]);
  assert.deepEqual(schema.$defs.Booking.properties.scheduled_end_at.type, ["string", "null"]);
});

test("customer booking and vehicle enums are identical to the backend-owned schema", () => {
  assert.deepEqual(quotedValues(typeBlock("BookingStatus")), schema.$defs.BookingStatus.enum);
  assert.deepEqual(quotedValues(typeBlock("VehicleType")), schema.$defs.VehicleType.enum);
  for (const status of schema.$defs.BookingStatus.enum) {
    assert.match(mockStore, new RegExp(`\\b${status}:`), `development mock is missing ${status}`);
  }
});

test("store client accepts only numeric server product IDs and published order states", () => {
  assert.match(types, /export type StoreProductInventory = \{\s+id: number;/);
  assert.doesNotMatch(types, /product_id: string \| number/);
  assert.doesNotMatch(staticProducts, /id:\s*"/);

  const statusBlock = types.match(/export type StoreOrder = \{[\s\S]*?status:([\s\S]*?);\s+payment_status\?/);
  assert.ok(statusBlock);
  assert.deepEqual(quotedValues(statusBlock[1]), schema.$defs.StoreOrderStatus.enum);
});

test("forced catalogue outage renders retry UI and cannot expose synthetic products", () => {
  for (const source of [catalogue, checkout]) {
    assert.doesNotMatch(source, /function fallbackProducts/);
    assert.match(source, /useState<StoreProductInventory\[\]>\(\[\]\)/);
    assert.match(source, /setProducts\(\[\]\)/);
    assert.match(source, /setCatalogState\("error"\)/);
    assert.match(source, /setCatalogAttempt\(\(attempt\) => attempt \+ 1\)/);
  }
  assert.match(catalogue, /No offline products have been added to your cart\./);
  assert.match(checkout, /has not been submitted or replaced with offline products\./);
  assert.match(mockRoute, /process\.env\.NODE_ENV === "production"/);
  assert.match(mockRoute, /Development API is unavailable in production\./);
});
