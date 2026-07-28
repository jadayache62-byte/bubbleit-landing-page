import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync(
  new URL("../components/booking/BookingWizard.tsx", import.meta.url),
  "utf8",
);
const types = readFileSync(
  new URL("../lib/api/types.ts", import.meta.url),
  "utf8",
);

test("service cards use the selected vehicle type for duration", () => {
  assert.match(types, /duration_suv: number/);
  assert.match(wizard, /function durationFor\(service: Service, vtype: VehicleType\)/);
  assert.match(wizard, /vtype === "suv" \? service\.duration_suv : service\.duration_minutes/);
  assert.match(wizard, /durationFor\(service, car\.vtype\)/);
});
