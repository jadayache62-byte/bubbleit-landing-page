import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("customer reschedule consumes versioned server availability and an idempotency key", () => {
  assert.match(client, /reschedule-options/);
  assert.match(client, /slot_version: string/);
  assert.match(client, /"Idempotency-Key": idempotencyKey/);
  assert.match(account, /duration_version: reschedule\.options\.duration\.version/);
  assert.match(account, /service_area_version: reschedule\.options\.service_area\.version/);
  assert.match(account, /slot_version: selected\.slot_version/);
});

test("development contract revalidates cutoff, versions, and fleet capacity", () => {
  assert.match(mock, /RESCHEDULE_CUTOFF_PASSED/);
  assert.match(mock, /SLOT_VERSION_STALE/);
  assert.match(mock, /hasFleetCapacity\(scheduledAt, duration\.total_minutes, booking\.id\)/);
  assert.match(mock, /booking\.status === "assigned"/);
});
