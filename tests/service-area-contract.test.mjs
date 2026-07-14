import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const wizard = readFileSync(new URL("../components/booking/BookingWizard.tsx", import.meta.url), "utf8");
const storeCheckout = readFileSync(new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("availability sends coordinates and returns the versioned service-area contract", () => {
  assert.match(client, /latitude: String\(coordinates\.latitude\)/);
  assert.match(client, /longitude: String\(coordinates\.longitude\)/);
  assert.match(wizard, /setServiceAreaVersion\(a\.service_area\.version\)/);
});

test("quote and booking carry one authoritative service-area version", () => {
  assert.match(wizard, /service_area_version: serviceAreaVersion/g);
  assert.match(wizard, /\["SERVICE_AREA_STALE", "SERVICE_AREA_OUTSIDE_QATAR"\]\.includes/);
});

test("store validates coordinates before creating an order", () => {
  assert.match(storeCheckout, /await validateServiceArea\(geo\.lat, geo\.lng\)/);
  assert.match(storeCheckout, /service_area_version: serviceArea\.version/);
});

test("development mock exposes the same version and structured errors", () => {
  assert.match(mock, /qatar-cgis-land-2026-07-14-v1/);
  assert.match(mock, /SERVICE_AREA_OUTSIDE_QATAR/);
  assert.match(mock, /SERVICE_AREA_STALE/);
});
