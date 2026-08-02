import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync(new URL("../components/booking/BookingWizard.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("regular and membership availability carry coordinates and an opaque zone version", () => {
  assert.match(client, /latitude: String\(coordinates\.latitude\)/);
  assert.match(client, /longitude: String\(coordinates\.longitude\)/);
  assert.match(wizard, /dispatchZoneVersion: options\.dispatch_zone\.version/);
  assert.match(wizard, /dispatchZoneVersion: availability\.dispatch_zone\.version/);
  assert.match(wizard, /dispatch_zone_version: dispatchZoneVersion/);
});

test("the development mock isolates fleet capacity by dispatch zone", () => {
  assert.match(mock, /bookingDispatchZones\.get\(booking\.id\) !== dispatchZoneId/);
  assert.match(mock, /hasFleetCapacity\([\s\S]*bookingDispatchZones\.get\(booking\.id\)/);
  assert.doesNotMatch(mock, /dispatch-zone:\$\{id\}/);
});

test("customers see different messages for uncovered areas and a covered day without slots", () => {
  assert.match(wizard, /DISPATCH_ZONE_UNCOVERED/);
  assert.match(wizard, /We serve this location, but no times are available on this day/);
});
