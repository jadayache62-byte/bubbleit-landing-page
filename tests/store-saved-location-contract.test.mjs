import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkout = readFileSync(
  new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url),
  "utf8",
);

test("authenticated store checkout loads and defaults to a saved location", () => {
  assert.match(checkout, /listAddresses\(\)/);
  assert.match(checkout, /!pendingCheckoutRef\.current/);
  assert.match(checkout, /!locationTouchedRef\.current/);
  assert.match(checkout, /applySavedAddress\(preferred\)/);
});

test("saved location applies the complete Blue Plate and coordinate snapshot", () => {
  for (const setter of [
    "setArea",
    "setBuildingNumber",
    "setZoneNumber",
    "setStreetNumber",
    "setAddressDetails",
    "setGeo",
  ]) {
    assert.match(checkout, new RegExp(`${setter}\\(`));
  }
  assert.match(checkout, /setSelectedAddressId\(address\.id\)/);
  assert.match(checkout, /aria-pressed=\{active\}/);
});

test("manual location changes detach the saved-address selection", () => {
  assert.match(checkout, /locationTouchedRef\.current = true/);
  assert.match(checkout, /setSelectedAddressId\(null\)/);
  assert.match(checkout, /markLocationManual\(\);\s*setBuildingNumber/);
  assert.match(checkout, /markLocationManual\(\);\s*setArea/);
});
