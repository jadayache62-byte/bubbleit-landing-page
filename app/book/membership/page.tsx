"use client";

// Book a wash using a prepaid membership: pick vehicle → slot → location.
// The service and price (QR 0) come from the membership plan server-side.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { HourSlotPicker } from "@/components/booking/HourSlotPicker";
import {
  ApiError,
  createBooking,
  createVehicle,
  getAvailability,
  getToken,
  listMemberships,
  listVehicles,
} from "@/lib/api/client";
import type { Booking, CustomerMembership, Slot, Vehicle } from "@/lib/api/types";
import {
  nextQatarDays,
  serializeQatarBookingDateTime,
} from "@/lib/datetime";
import { localized, useI18n } from "@/lib/i18n";

function next7Days() {
  return nextQatarDays(7).map((d) => ({
    date: d.date,
    label: `${d.weekday}, ${d.monthDay}`,
  }));
}

function RedeemInner() {
  const { lang, t } = useI18n();
  const params = useSearchParams();
  const membershipId = Number(params.get("m"));

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [membership, setMembership] = useState<CustomerMembership | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const [addVehicle, setAddVehicle] = useState(false);
  const [plate, setPlate] = useState("");
  const [vtype, setVtype] = useState<"sedan" | "suv">("suv");

  const days = useMemo(() => next7Days(), []);
  const [date, setDate] = useState(days[0].date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  // Reference "now" captured when slots load, used to hide today's past slots.
  const [nowMs, setNowMs] = useState(0);
  const [area, setArea] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  const isMidnight = membership?.plan.window_start != null;

  // A membership only covers its plan's vehicle type (Salon or SUV; null = any).
  // Non-matching existing vehicles are disabled in the list, so a selection can
  // never be non-matching; the add-vehicle type is forced to the plan below.
  const planVtype = membership?.plan.vehicle_type ?? null;
  const vehicleAllowed = (type: string) => planVtype === null || type === planVtype;
  const effectiveVtype = planVtype ?? vtype;

  const load = useCallback(() => {
    Promise.all([listMemberships(), listVehicles()])
      .then(([ms, vs]) => {
        setMembership(ms.find((m) => m.id === membershipId) ?? null);
        setVehicles(vs);
        setAuthed(true);
      })
      .catch(() => setAuthed(false));
  }, [membershipId]);

  useEffect(() => {
    if (getToken()) load();
    else queueMicrotask(() => setAuthed(false));
  }, [load]);

  useEffect(() => {
    if (!membership) return;
    queueMicrotask(() => {
      setSlots(null);
      setSlot(null);
      setNowMs(Date.now());
    });
    getAvailability(date, isMidnight ? "midnight" : "standard")
      .then((a) => setSlots(a.slots))
      .catch(() => setSlots([]));
  }, [date, membership, isMidnight]);

  async function submit() {
    if (!membership || !slot) return;
    setBusy(true);
    setError(null);
    try {
      let vid = vehicleId;
      if (addVehicle || vid === null) {
        const vehicle = await createVehicle({
          make: "",
          model: "",
          year: null,
          color: "",
          plate_number: plate.trim(),
          type: effectiveVtype,
        });
        vid = vehicle.id;
      }
      const booking = await createBooking({
        scheduled_at: serializeQatarBookingDateTime(date, slot),
        membership_id: membership.id,
        vehicle_id: vid,
        address_area: `${area.trim()}${details.trim() ? ` — ${details.trim()}` : ""}`,
      });
      setConfirmed(booking);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const vehicleOk = addVehicle || vehicles.length === 0
    ? plate.trim().length > 0
    : vehicleId !== null;
  const canSubmit = vehicleOk && slot !== null && area.trim().length > 1 && !busy;

  if (authed === false) {
    return (
      <div className="mx-auto max-w-md">
        <AuthPanel onAuthed={() => load()} />
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="glass-panel mx-auto max-w-lg rounded-[var(--radius-card)] p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h2 className="mt-6 text-2xl font-bold">{t("Booking confirmed!")}</h2>
        <p className="mt-2 text-[color:var(--muted-foreground)]">
          {t("Reference")} <span className="font-bold text-[color:var(--navy)]">{confirmed.reference}</span>
          <span className="block mt-2 text-sm">{t("Free with membership")}</span>
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/account" className="primary-button">{t("View my bookings")}</Link>
          <Link href="/memberships" className="secondary-button">{t("Memberships")}</Link>
        </div>
      </div>
    );
  }

  if (!membership) {
    if (authed === null) {
      return (
        <div aria-label={t("Loading membership…")} className="glass-panel mx-auto max-w-2xl space-y-5 rounded-[var(--radius-card)] p-4 sm:p-10">
          <span aria-hidden="true" className="block h-20 animate-pulse rounded-2xl bg-slate-200/80" />
          <span aria-hidden="true" className="block h-6 w-44 animate-pulse rounded-lg bg-slate-200/80" />
          <span aria-hidden="true" className="block h-14 animate-pulse rounded-2xl bg-slate-200/80" />
          <span aria-hidden="true" className="block h-6 w-36 animate-pulse rounded-lg bg-slate-200/80" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} aria-hidden="true" className="block h-11 animate-pulse rounded-xl bg-slate-200/80" />
            ))}
          </div>
        </div>
      );
    }
    return (
      <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
        {t("We couldn't load our services")}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
    <div className="glass-panel rounded-[var(--radius-card)] p-4 sm:p-10">
      <div className="mb-6 rounded-2xl bg-[color:var(--background)] p-4 text-sm">
        <span className="font-bold">{localized(lang, membership.plan.name, membership.plan.name_ar)}</span>
        <span className="block text-[color:var(--muted-foreground)]">
          {membership.washes_remaining} {t("washes left")}
          {isMidnight && ` · ${t("Exterior wash only, between 12am and 5am.")}`}
        </span>
      </div>

      {/* Vehicle */}
      <h2 className="mb-3 text-lg font-bold">{t("Pick your vehicle")}</h2>
      {vehicles.length > 0 && !addVehicle ? (
        <div className="flex flex-col gap-2">
          {vehicles.map((v) => {
            const allowed = vehicleAllowed(v.type);
            return (
            <button
              key={v.id}
              type="button"
              disabled={!allowed}
              onClick={() => setVehicleId(v.id)}
              className={clsx(
                "flex min-h-12 cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-start text-sm transition duration-200",
                !allowed
                  ? "cursor-not-allowed border-[color:var(--border)] bg-[color:var(--background)] opacity-40"
                  : vehicleId === v.id
                    ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                    : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
              )}
            >
              <span className="font-semibold">
                {[v.make, v.model].filter(Boolean).join(" ")}
                {[v.make, v.model].filter(Boolean).length > 0 && " · "}
                {v.plate_number}
              </span>
              <span className={clsx("text-xs", vehicleId === v.id ? "text-white/70" : "text-[color:var(--muted-foreground)]")}>
                {v.type === "suv" ? t("SUV / 4-Wheel") : t("Salon / Sedan")}
                {!allowed && ` · ${t("not covered")}`}
              </span>
            </button>
            );
          })}
          <button
            type="button"
            className="secondary-button mt-1 self-start"
            onClick={() => setAddVehicle(true)}
          >
            + {t("Add a vehicle")}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm font-semibold">{t("Plate no.")}</span>
            <input
              className="wizard-input"
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              value={plate}
              onChange={(e) => setPlate(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          {planVtype ? (
            // Locked to the membership's vehicle type.
            <div className="wizard-input flex items-center justify-between text-[color:var(--muted-foreground)]">
              {planVtype === "suv" ? t("SUV / 4-Wheel") : t("Salon / Sedan")}
              <span className="text-xs">🔒</span>
            </div>
          ) : (
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-semibold">{t("Vehicle type")}</span>
              <select
                className="wizard-input"
                value={vtype}
                onChange={(e) => setVtype(e.target.value as "sedan" | "suv")}
              >
                <option value="suv">{t("SUV / 4-Wheel")}</option>
                <option value="sedan">{t("Salon / Sedan")}</option>
              </select>
            </label>
          )}
        </div>
      )}

      {/* Schedule */}
      <h2 className="mb-3 mt-8 text-lg font-bold">{t("Pick your time")}</h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => setDate(d.date)}
            className={clsx(
              "whitespace-nowrap rounded-2xl border px-3 py-2 text-sm font-semibold transition",
              date === d.date
                ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>
      {slots === null ? (
        <div aria-label={t("Checking availability…")} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} aria-hidden="true" className="block h-11 animate-pulse rounded-xl bg-slate-200/80" />
          ))}
        </div>
      ) : (
        <HourSlotPicker
          date={date}
          slots={slots}
          selectedSlot={slot}
          nowMs={nowMs}
          onSelect={setSlot}
        />
      )}

      {/* Location */}
      <h2 className="mb-3 mt-8 text-lg font-bold">{t("Where should we come?")}</h2>
      <div className="flex flex-col gap-3">
        <input
          className="wizard-input"
          placeholder={t("e.g. West Bay, The Pearl…")}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <input
          className="wizard-input"
          placeholder={t("Tower name, gate number, parking level…")}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl">
          <button
            type="button"
            className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canSubmit}
            onClick={submit}
          >
            {busy ? t("Confirming…") : `${t("Confirm Booking")} — ${t("Free with membership")}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MembershipBookingPage() {
  const { t } = useI18n();
  return (
    <>
      <Navbar />
      <main className="section-shell py-6 sm:py-14">
        <div className="mb-5 text-center sm:mb-8">
          <span className="section-kicker">{t("Memberships")}</span>
          <h1 className="section-title mt-4">{t("Book with membership")}</h1>
        </div>
        <Suspense>
          <RedeemInner />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
