import type {
  CustomerTrackingEvent,
  CustomerTrackingSnapshot,
} from "@/lib/api/types";

export type TrackingEventResult = {
  snapshot: CustomerTrackingSnapshot;
  recover: boolean;
};

const EVENT_TYPES = new Set([
  "tracking_available",
  "position_updated",
  "revoked",
  "closed",
  "feature_disabled",
]);

export function isCustomerTrackingEvent(value: unknown): value is CustomerTrackingEvent {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<CustomerTrackingEvent>;
  return event.schema_version === "customer-tracking-event-v1"
    && typeof event.event_id === "string"
    && typeof event.type === "string"
    && EVENT_TYPES.has(event.type)
    && typeof event.stream_epoch === "string"
    && Number.isSafeInteger(event.revision)
    && typeof event.occurred_at === "string"
    && Number.isSafeInteger(event.policy_revision)
    && Number.isSafeInteger(event.assignment_version)
    && (event.trip_plan_revision === null || Number.isSafeInteger(event.trip_plan_revision))
    && Number.isSafeInteger(event.booking_id)
    && (event.trip_id === null || typeof event.trip_id === "string")
    && event.payload !== null
    && typeof event.payload === "object"
    && !Array.isArray(event.payload);
}

const TERMINAL_EVENTS = new Set(["revoked", "closed", "feature_disabled"]);

export function applyCustomerTrackingEvent(
  snapshot: CustomerTrackingSnapshot,
  event: CustomerTrackingEvent,
): TrackingEventResult {
  if (!snapshot.stream || event.booking_id !== snapshot.booking_id) {
    return { snapshot, recover: true };
  }
  if (
    event.stream_epoch !== snapshot.stream.epoch ||
    event.assignment_version !== snapshot.assignment_version ||
    event.trip_plan_revision !== (snapshot.trip?.plan_revision ?? null) ||
    event.policy_revision !== snapshot.policy_revision
  ) {
    return { snapshot, recover: true };
  }
  if (event.revision <= snapshot.stream.revision) {
    return { snapshot, recover: false };
  }
  if (event.revision !== snapshot.stream.revision + 1) {
    return { snapshot, recover: true };
  }
  if (TERMINAL_EVENTS.has(event.type)) {
    return {
      recover: false,
      snapshot: {
        ...snapshot,
        tracking_available: false,
        reason: event.type === "feature_disabled" ? "feature_disabled" : "booking_terminal",
        position: null,
        destination: null,
        route: null,
        eta: null,
        delay: null,
        stream: null,
      },
    };
  }
  if (event.type === "tracking_available" && snapshot.stream.purpose === "dispatch") {
    return { snapshot, recover: true };
  }

  return {
    recover: false,
    snapshot: {
      ...snapshot,
      ...event.payload,
      stream: { ...snapshot.stream, revision: event.revision },
    },
  };
}

export function displayHealth(
  snapshot: CustomerTrackingSnapshot,
  nowMs = Date.now(),
): "healthy" | "stale" | "disconnected" {
  const reference = snapshot.health.last_valid_at ?? snapshot.position?.captured_at;
  if (!reference) return "disconnected";
  const ageSeconds = Math.max(0, (nowMs - Date.parse(reference)) / 1000);
  if (ageSeconds >= 120) return "disconnected";
  if (ageSeconds >= 45) return "stale";
  return snapshot.health.status;
}

export function reconnectDelay(attempt: number, random = Math.random) {
  const base = [1000, 2000, 4000, 8000, 16000][attempt] ?? 30000;
  return Math.round(base * (0.85 + random() * 0.3));
}
