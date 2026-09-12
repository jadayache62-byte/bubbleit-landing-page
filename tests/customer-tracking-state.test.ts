import assert from "node:assert/strict";
import test from "node:test";

import type { CustomerTrackingEvent, CustomerTrackingSnapshot } from "../lib/api/types.ts";
import {
  applyCustomerTrackingEvent,
  displayHealth,
  isCustomerTrackingEvent,
  reconnectDelay,
} from "../lib/tracking/customer-tracking.ts";

function snapshot(): CustomerTrackingSnapshot {
  return {
    schema_version: "customer-tracking-v1",
    server_time: "2026-09-04T06:45:00.000Z",
    policy_revision: 4,
    booking_id: 42,
    dispatch_state: "en_route",
    assignment_version: 3,
    tracking_available: true,
    reason: "route_unavailable",
    trip: {
      id: "8b1968b4-bd6a-4d2f-b4d9-c94bd1215378",
      status: "en_route",
      plan_revision: 2,
      window_starts_at: "2026-09-04T06:45:00.000Z",
      arrived_at: null,
    },
    bus: { bus_number: "B12", plate_number: "123456" },
    position: {
      latitude: 25.2854,
      longitude: 51.531,
      heading: 90,
      accuracy_m: 8,
      captured_at: "2026-09-04T06:45:00.000Z",
    },
    destination: { latitude: 25.3, longitude: 51.54 },
    route: null,
    eta: null,
    delay: null,
    health: {
      status: "healthy",
      last_valid_at: "2026-09-04T06:45:00.000Z",
      last_received_at: "2026-09-04T06:45:00.000Z",
    },
    stream: {
      purpose: "tracking",
      epoch: "4a05ca8f-d7eb-4400-9955-d4e8148cbfe4",
      revision: 5,
      grant_id: "f59c9431-d31c-492d-929f-3074d135ac88",
      channel: "private-fleet.customer.tracking.f59c9431-d31c-492d-929f-3074d135ac88",
      expires_at: "2026-09-04T07:00:00.000Z",
    },
  };
}

function event(overrides: Partial<CustomerTrackingEvent> = {}): CustomerTrackingEvent {
  return {
    schema_version: "customer-tracking-event-v1",
    event_id: "49ef7745-25b7-45bb-b9cd-ea9607b63943",
    type: "position_updated",
    stream_epoch: "4a05ca8f-d7eb-4400-9955-d4e8148cbfe4",
    revision: 6,
    occurred_at: "2026-09-04T06:45:05.000Z",
    policy_revision: 4,
    assignment_version: 3,
    trip_plan_revision: 2,
    booking_id: 42,
    trip_id: "8b1968b4-bd6a-4d2f-b4d9-c94bd1215378",
    payload: {
      position: {
        latitude: 25.286,
        longitude: 51.532,
        heading: 100,
        accuracy_m: 7,
        captured_at: "2026-09-04T06:45:05.000Z",
      },
    },
    ...overrides,
  };
}

test("ordered live events update one snapshot and duplicate events are ignored", () => {
  const current = snapshot();
  const updated = applyCustomerTrackingEvent(current, event());

  assert.equal(updated.recover, false);
  assert.equal(updated.snapshot.position?.latitude, 25.286);
  assert.equal(updated.snapshot.stream?.revision, 6);

  const duplicate = applyCustomerTrackingEvent(updated.snapshot, event());
  assert.equal(duplicate.recover, false);
  assert.equal(duplicate.snapshot, updated.snapshot);
});

test("revision gaps and changed authorization context require a fresh snapshot", () => {
  assert.equal(applyCustomerTrackingEvent(snapshot(), event({ revision: 8 })).recover, true);
  assert.equal(applyCustomerTrackingEvent(snapshot(), event({ assignment_version: 4 })).recover, true);
  assert.equal(applyCustomerTrackingEvent(snapshot(), event({ policy_revision: 5 })).recover, true);
});

test("dispatch availability changes trigger one authoritative snapshot refresh", () => {
  const current = snapshot();
  current.tracking_available = false;
  current.position = null;
  current.stream = { ...current.stream!, purpose: "dispatch" };

  assert.equal(applyCustomerTrackingEvent(current, event({ type: "tracking_available" })).recover, true);
});

test("terminal events remove all precise customer tracking state", () => {
  const result = applyCustomerTrackingEvent(snapshot(), event({ type: "revoked" }));

  assert.equal(result.recover, false);
  assert.equal(result.snapshot.tracking_available, false);
  assert.equal(result.snapshot.position, null);
  assert.equal(result.snapshot.destination, null);
  assert.equal(result.snapshot.stream, null);
});

test("client health and reconnect thresholds match the live fleet contract", () => {
  const current = snapshot();
  const captured = Date.parse(current.health.last_valid_at!);

  assert.equal(displayHealth(current, captured + 44_999), "healthy");
  assert.equal(displayHealth(current, captured + 45_000), "stale");
  assert.equal(displayHealth(current, captured + 120_000), "disconnected");
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((attempt) => reconnectDelay(attempt, () => 0.5)), [
    1_000, 2_000, 4_000, 8_000, 16_000, 30_000,
  ]);
});

test("malformed socket payloads are rejected before they reach the reducer", () => {
  assert.equal(isCustomerTrackingEvent({ ...event(), revision: "6" }), false);
  assert.equal(isCustomerTrackingEvent({ ...event(), schema_version: "other" }), false);
});
