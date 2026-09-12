import Pusher from "pusher-js";

import { authorizeBookingLive } from "@/lib/api/client";
import type { CustomerTrackingEvent, CustomerTrackingSnapshot } from "@/lib/api/types";
import { isCustomerTrackingEvent } from "@/lib/tracking/customer-tracking";

type SubscriptionCallbacks = {
  onConnected: () => void;
  onUnavailable: () => void;
  onEvent: (event: CustomerTrackingEvent) => void;
  onError: (error: Error) => void;
};

export function liveConnectionConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_REVERB_APP_KEY
    && process.env.NEXT_PUBLIC_REVERB_HOST,
  );
}

export function subscribeCustomerTracking(
  bookingId: number,
  stream: Pick<NonNullable<CustomerTrackingSnapshot["stream"]>, "grant_id" | "purpose" | "channel">,
  callbacks: SubscriptionCallbacks,
) {
  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  const host = process.env.NEXT_PUBLIC_REVERB_HOST;
  if (!key || !host) return null;

  const configuredPort = Number.parseInt(process.env.NEXT_PUBLIC_REVERB_PORT ?? "443", 10);
  const port = Number.isSafeInteger(configuredPort) ? configuredPort : 443;
  const forceTLS = (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "https") === "https";
  let renewal: number | null = null;
  let disposed = false;

  const scheduleRenewal = (expiresAt: string) => {
    if (renewal) window.clearTimeout(renewal);
    const delay = Math.max(5_000, Date.parse(expiresAt) - Date.now() - 60_000);
    renewal = window.setTimeout(async () => {
      const socketId = pusher.connection.socket_id;
      if (!socketId || disposed) return;
      try {
        const renewed = await authorizeBookingLive(bookingId, {
          socket_id: socketId,
          grant_id: stream.grant_id,
          purpose: stream.purpose,
        });
        scheduleRenewal(renewed.expires_at);
      } catch (caught) {
        callbacks.onError(caught instanceof Error ? caught : new Error("Live authorization failed."));
        callbacks.onUnavailable();
      }
    }, delay);
  };

  const pusher = new Pusher(key, {
    cluster: "mt1",
    wsHost: host,
    wsPort: port,
    wssPort: port,
    forceTLS,
    enabledTransports: forceTLS ? ["wss"] : ["ws", "wss"],
    disableStats: true,
    authorizer: (channel) => ({
      authorize: async (socketId, callback) => {
        if (channel.name !== stream.channel) {
          callback(new Error("Unexpected live channel."), null);
          return;
        }
        try {
          const authorization = await authorizeBookingLive(bookingId, {
            socket_id: socketId,
            grant_id: stream.grant_id,
            purpose: stream.purpose,
          });
          if (authorization.channel !== channel.name) {
            callback(new Error("Live channel changed."), null);
            return;
          }
          scheduleRenewal(authorization.expires_at);
          callback(null, { auth: authorization.auth });
        } catch (caught) {
          callback(caught instanceof Error ? caught : new Error("Live authorization failed."), null);
        }
      },
    }),
  });

  const channel = pusher.subscribe(stream.channel);
  channel.bind("fleet.customer", (value: unknown) => {
    if (isCustomerTrackingEvent(value)) callbacks.onEvent(value);
  });
  pusher.connection.bind("connected", callbacks.onConnected);
  pusher.connection.bind("unavailable", () => {
    pusher.disconnect();
    callbacks.onUnavailable();
  });
  pusher.connection.bind("error", (value: unknown) => {
    const message = value && typeof value === "object" && "error" in value
      ? String((value as { error?: { data?: { message?: unknown } } }).error?.data?.message ?? "Live connection error.")
      : "Live connection error.";
    callbacks.onError(new Error(message));
  });

  return () => {
    disposed = true;
    if (renewal) window.clearTimeout(renewal);
    channel.unbind_all();
    pusher.unsubscribe(stream.channel);
    pusher.disconnect();
  };
}
