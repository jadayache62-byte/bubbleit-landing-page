"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";

import { LiveBusMap } from "@/components/account/LiveBusMap";
import { useCustomerBookingTracking } from "@/components/account/useCustomerBookingTracking";
import { formatQatarDateTime } from "@/lib/datetime";
import { useI18n } from "@/lib/i18n";

const REASONS: Record<string, string> = {
  feature_disabled: "Live bus tracking is not enabled for this booking.",
  not_assigned: "We are finding the right bus for your booking.",
  before_window: "You will be notified when live tracking becomes available.",
  prior_service_active: "The team is finishing an earlier service before heading to you.",
  location_stale: "Location temporarily unavailable. The last position is shown.",
  location_disconnected: "The live location is reconnecting.",
  route_unavailable: "The bus location is live. Arrival time is temporarily unavailable.",
  service_started: "Your service has started, so live travel tracking has ended.",
  trip_interrupted: "The trip changed. Our team is confirming the latest assignment.",
  booking_terminal: "Live tracking has ended for this booking.",
};

const PRESENTATION = ["Looking for your bus", "Bus found", "Assigning your bus", "Bus assigned"];

export function BookingTrackingPanel({ bookingId, onClose }: { bookingId: number; onClose: () => void }) {
  const { lang, t } = useI18n();
  const { snapshot, error, connection, health, retry } = useCustomerBookingTracking(bookingId);
  const [mapFailed, setMapFailed] = useState(false);
  const [presentation, setPresentation] = useState({ bookingId, phase: 0, done: false });
  const mapFailure = useCallback(() => setMapFailed(true), []);
  const assigned = Boolean(snapshot && !["looking_for_bus", "closed"].includes(snapshot.dispatch_state));
  const phase = presentation.bookingId === bookingId ? presentation.phase : 0;
  const presentationDone = presentation.bookingId === bookingId && presentation.done;

  useEffect(() => {
    const key = `bubbleit.dispatch-presentation.${bookingId}`;
    if (window.sessionStorage.getItem(key) === "done") {
      queueMicrotask(() => setPresentation({ bookingId, phase: 3, done: true }));
      return;
    }
    if (snapshot?.dispatch_state === "closed") {
      queueMicrotask(() => setPresentation({ bookingId, phase: 3, done: true }));
      return;
    }
    if (!assigned) return;
    const timer = window.setInterval(() => {
      setPresentation((current) => {
        const currentPhase = current.bookingId === bookingId ? current.phase : 0;
        if (currentPhase >= 3) {
          window.clearInterval(timer);
          window.sessionStorage.setItem(key, "done");
          return { bookingId, phase: 3, done: true };
        }
        return { bookingId, phase: currentPhase + 1, done: false };
      });
    }, 700);
    return () => window.clearInterval(timer);
  }, [assigned, bookingId, snapshot?.dispatch_state]);

  const stage = (() => {
    if (!presentationDone) {
      return PRESENTATION[phase];
    }
    return snapshot ? ({
      looking_for_bus: "Looking for your bus",
      assigned: "Bus assigned",
      en_route: "Your bus is on the way",
      arrived: "Your bus has arrived",
      service_started: "Service in progress",
      closed: "Trip complete",
    }[snapshot.dispatch_state]) : "Looking for your bus";
  })();

  const lastUpdate = snapshot?.health.last_valid_at
    ? formatQatarDateTime(snapshot.health.last_valid_at, lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;
  const reason = snapshot ? REASONS[snapshot.reason] : "Loading your latest booking status.";
  const connectionLabel = connection === "connected"
    ? "Live"
    : connection === "paused"
      ? "Paused while this page is hidden"
      : connection === "connecting"
        ? "Connecting"
        : "Reconnecting";

  return (
    <section className="commerce-card mb-6 overflow-hidden" aria-labelledby="booking-tracking-title">
      <div className="border-b border-[color:var(--border)] bg-[color:var(--navy)] px-5 py-5 text-white sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--cyan)]">{t("Live booking journey")}</p>
            <h2 id="booking-tracking-title" className="mt-1 text-2xl font-bold">{t(stage)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75" aria-live="polite">{t(reason)}</p>
          </div>
          <button type="button" onClick={onClose} className="secondary-button border-white/25 bg-white/10 px-4 text-white hover:bg-white hover:text-[color:var(--navy)]">
            {t("Back to bookings")}
          </button>
        </div>

        {!presentationDone && (
          <ol className="mt-5 grid grid-cols-4 gap-2" aria-label={t("Assignment progress")}>
            {PRESENTATION.map((item, index) => (
              <li key={item} className="min-w-0">
                <span className={clsx("block h-1.5 rounded-full transition-colors", index <= phase ? "bg-[color:var(--cyan)]" : "bg-white/20")} />
                <span className="mt-2 hidden truncate text-[11px] font-semibold text-white/70 sm:block">{t(item)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)] bg-slate-50" data-sentry-block>
          {snapshot?.position && !mapFailed ? (
            <LiveBusMap
              position={snapshot.position}
              destination={snapshot.destination}
              label={t("Live position of your assigned bus")}
              destinationLabel={t("Destination")}
              onFailure={mapFailure}
            />
          ) : (
            <div className="grid min-h-72 place-items-center p-8 text-center sm:min-h-96">
              <div className="max-w-sm">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sky-100 text-[color:var(--blue)]" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none"><path d="M5 16V7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5V16M4 16h16v3H4v-3Zm3 3v2m10-2v2M7 9h10M8 13h.01M16 13h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <h3 className="mt-4 text-lg font-bold text-[color:var(--navy)]">{t(mapFailed ? "Map temporarily unavailable" : "Tracking will appear here")}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{t(reason)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4" data-sentry-block>
          <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{t("Connection")}</span>
              <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", connection === "connected" && health === "healthy" ? "bg-emerald-100 text-emerald-700" : health === "stale" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700")}>{t(connectionLabel)}</span>
            </div>
            {lastUpdate && <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">{t("Last location update")}: <span dir="ltr" className="font-semibold text-[color:var(--navy)]">{lastUpdate}</span></p>}
          </div>

          {snapshot?.bus && (
            <div className="rounded-2xl border border-[color:var(--border)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{t("Assigned bus")}</p>
              <p className="mt-2 text-xl font-extrabold text-[color:var(--navy)]">{snapshot.bus.bus_number}</p>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{snapshot.bus.plate_number}</p>
            </div>
          )}

          <div className="rounded-2xl border border-[color:var(--border)] bg-sky-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--blue)]">{t("Arrival time")}</p>
            <p className="mt-2 font-bold text-[color:var(--navy)]">{snapshot?.eta ? formatQatarDateTime(snapshot.eta.arrival_at, lang, { hour: "2-digit", minute: "2-digit" }) : t("Temporarily unavailable")}</p>
            {snapshot?.delay && <p className="mt-2 text-sm text-amber-800">{Math.ceil(snapshot.delay.late_seconds / 60)} {t("minutes late")}</p>}
          </div>

          {error && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{error}</p>
              <button type="button" className="secondary-button mt-3 px-4" onClick={() => void retry()}>{t("Try again")}</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
