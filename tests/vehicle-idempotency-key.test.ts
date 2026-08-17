import assert from "node:assert/strict";
import test from "node:test";

import {
  vehicleIdempotencyKey,
  type VehicleIdempotencyEntry,
} from "../lib/booking/vehicle-idempotency.ts";

test("vehicle retries keep their key until the plate or type changes", () => {
  const entries = new Map<string, VehicleIdempotencyEntry>();
  let sequence = 0;
  const generate = () => `generated-${++sequence}`;

  const first = vehicleIdempotencyKey(
    entries,
    "membership",
    { plate_number: "123456", type: "suv" },
    generate,
  );
  const retry = vehicleIdempotencyKey(
    entries,
    "membership",
    { plate_number: "123456", type: "suv" },
    generate,
  );
  const changedPlate = vehicleIdempotencyKey(
    entries,
    "membership",
    { plate_number: "654321", type: "suv" },
    generate,
  );
  const changedType = vehicleIdempotencyKey(
    entries,
    "membership",
    { plate_number: "654321", type: "sedan" },
    generate,
  );

  assert.equal(first, retry);
  assert.notEqual(first, changedPlate);
  assert.notEqual(changedPlate, changedType);
  assert.doesNotMatch(first, /123456/);
});

test("separate vehicle commands never share a key", () => {
  const entries = new Map<string, VehicleIdempotencyEntry>();
  let sequence = 0;
  const generate = () => `generated-${++sequence}`;
  const payload = { plate_number: "123456", type: "suv" } as const;

  const membership = vehicleIdempotencyKey(entries, "membership", payload, generate);
  const regularBooking = vehicleIdempotencyKey(entries, "booking:1", payload, generate);

  assert.notEqual(membership, regularBooking);
});
