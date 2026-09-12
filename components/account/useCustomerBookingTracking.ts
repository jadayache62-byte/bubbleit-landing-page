"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError, getBookingTracking } from "@/lib/api/client";
import type { CustomerTrackingEvent, CustomerTrackingSnapshot } from "@/lib/api/types";
import {
  applyCustomerTrackingEvent,
  displayHealth,
  reconnectDelay,
} from "@/lib/tracking/customer-tracking";
import {
  liveConnectionConfigured,
  subscribeCustomerTracking,
} from "@/lib/tracking/reverb";

export type CustomerTrackingConnection = "idle" | "connecting" | "connected" | "paused" | "unavailable";

export function useCustomerBookingTracking(bookingId: number) {
  const [snapshot, setSnapshot] = useState<CustomerTrackingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<CustomerTrackingConnection>("connecting");
  const [active, setActive] = useState(() => (
    typeof document === "undefined" || document.visibilityState === "visible"
  ) && (typeof navigator === "undefined" || navigator.onLine));
  const [clock, setClock] = useState(() => Date.now());
  const [generation, setGeneration] = useState(0);
  const inFlight = useRef<{
    bookingId: number;
    controller: AbortController;
    promise: Promise<CustomerTrackingSnapshot | null>;
  } | null>(null);
  const retryTimer = useRef<number | null>(null);
  const retryAttempt = useRef(0);
  const mounted = useRef(true);
  const activeRef = useRef(active);
  const recoveryRef = useRef<() => void>(() => undefined);

  const refresh = useCallback(() => {
    if (inFlight.current?.bookingId === bookingId) return inFlight.current.promise;
    inFlight.current?.controller.abort();
    const controller = new AbortController();
    const request = getBookingTracking(bookingId, controller.signal)
      .then((next) => {
        if (!mounted.current) return null;
        setSnapshot(next);
        setError(null);
        if (!next.stream) setConnection("idle");
        return next;
      })
      .catch((caught: unknown) => {
        if (!mounted.current || (caught instanceof DOMException && caught.name === "AbortError")) return null;
        const terminal = caught instanceof ApiError && [401, 403].includes(caught.status);
        setError(caught instanceof Error ? caught.message : "Live tracking is unavailable.");
        if (terminal) {
          setConnection("idle");
          return null;
        }
        throw caught;
      })
      .finally(() => {
        if (inFlight.current?.promise === request) inFlight.current = null;
      });
    inFlight.current = { bookingId, controller, promise: request };
    return request;
  }, [bookingId]);

  const scheduleRecovery = useCallback(() => {
    if (!activeRef.current || retryTimer.current) return;
    setConnection("unavailable");
    const delay = reconnectDelay(retryAttempt.current++);
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      refresh()
        .then((next) => {
          if (next?.stream) {
            setGeneration((value) => value + 1);
          }
        })
        .catch(() => recoveryRef.current());
    }, delay);
  }, [refresh]);

  useEffect(() => {
    recoveryRef.current = scheduleRecovery;
  }, [scheduleRecovery]);

  useEffect(() => {
    mounted.current = true;
    refresh().catch(() => scheduleRecovery());
    return () => {
      mounted.current = false;
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (inFlight.current?.bookingId === bookingId) {
        inFlight.current.controller.abort();
        inFlight.current = null;
      }
    };
  }, [bookingId, refresh, scheduleRecovery]);

  useEffect(() => {
    const update = () => {
      const ready = document.visibilityState === "visible" && navigator.onLine;
      activeRef.current = ready;
      setActive(ready);
      if (ready) {
        retryAttempt.current = 0;
        setConnection("connecting");
        refresh().then(() => setGeneration((value) => value + 1)).catch(() => scheduleRecovery());
      } else {
        setConnection("paused");
      }
    };
    document.addEventListener("visibilitychange", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [refresh, scheduleRecovery]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setClock(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, [active]);

  const onEvent = useCallback((event: CustomerTrackingEvent) => {
    setSnapshot((current) => {
      if (!current) return current;
      const result = applyCustomerTrackingEvent(current, event);
      if (result.recover) queueMicrotask(() => refresh().catch(() => scheduleRecovery()));
      return result.snapshot;
    });
  }, [refresh, scheduleRecovery]);

  const streamGrantId = snapshot?.stream?.grant_id;
  const streamPurpose = snapshot?.stream?.purpose;
  const streamChannel = snapshot?.stream?.channel;

  useEffect(() => {
    if (!active || !streamGrantId || !streamPurpose || !streamChannel || !liveConnectionConfigured()) return;
    return subscribeCustomerTracking(bookingId, {
      grant_id: streamGrantId,
      purpose: streamPurpose,
      channel: streamChannel,
    }, {
      onConnected: () => {
        retryAttempt.current = 0;
        setConnection("connected");
      },
      onUnavailable: scheduleRecovery,
      onEvent,
      onError: (caught) => setError(caught.message),
    }) ?? undefined;
  }, [active, bookingId, generation, onEvent, scheduleRecovery, streamChannel, streamGrantId, streamPurpose]);

  const displayedConnection = !active
    ? "paused"
    : streamGrantId && !liveConnectionConfigured()
      ? "unavailable"
      : connection;

  return {
    snapshot,
    error,
    connection: displayedConnection,
    health: snapshot ? displayHealth(snapshot, clock) : "disconnected",
    retry: () => {
      retryAttempt.current = 0;
      setConnection("connecting");
      return refresh().then(() => setGeneration((value) => value + 1));
    },
  };
}
