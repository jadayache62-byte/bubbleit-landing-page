import type { CreateVehiclePayload } from "@/lib/api/types";

export type VehicleIdempotencyEntry = {
  payload: string;
  key: string;
};

/**
 * Reuse a key only while the same vehicle command is being retried. Editing
 * any part of the payload creates a new command and therefore a new key.
 */
export function vehicleIdempotencyKey(
  entries: Map<string, VehicleIdempotencyEntry>,
  scope: string,
  payload: CreateVehiclePayload,
  generate: () => string,
): string {
  const signature = JSON.stringify(
    Object.entries(payload).sort(([left], [right]) => left.localeCompare(right)),
  );
  const existing = entries.get(scope);

  if (existing?.payload === signature) return existing.key;

  const key = `vehicle.${generate()}`;
  entries.set(scope, { payload: signature, key });
  return key;
}
