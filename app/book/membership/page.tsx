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
import { localized, useI18n } from "@/lib/i18n";

function next7Days() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      label: d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }),
    });
  }
  return days;
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
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [plate, setPlate] = useState("");
  const [vtype, setVtype] = useState<"sedan" | "suv">("sedan");

  const days = useMemo(() => next7Days(), []);
  const [date, setDate] = useState(days[0].date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [area, setArea] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  const isMidnight = membership?.plan.window_start != null;

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
          make: make.trim(),
          model: model.trim(),
          year: null,
          color: "",
          plate_number: plate.trim(),
          type: vtype,
        });
        vid = vehicle.id;
      }
      const booking = await createBooking({
        scheduled_at: `${date}T${slot}:00`,
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
    return (
      <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">
        {authed === null ? "…" : t("We couldn't load our services")}
      </p>
    );
  }

  return (
    <div className="glass-panel mx-auto max-w-2xl rounded-[var(--radius-card)] p-6 sm:p-10">
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
          {vehicles.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVehicleId(v.id)}
              className={clsx(
                "flex items-center justify-between rounded-2xl border px-4 py-3 text-start text-sm transition",
                vehicleId === v.id
                  ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                  : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
              )}
            >
              <span className="font-semibold">
                {v.make} {v.model} · {v.plate_number}
              </span>
              <span className={clsx("text-xs", vehicleId === v.id ? "text-white/70" : "text-[color:var(--muted-foreground)]")}>
                {v.type === "suv" ? t("SUV / 4-Wheel") : t("Salon / Sedan")}
              </span>
            </button>
          ))}
          <button
            type="button"
            className="secondary-button mt-1 self-start"
            onClick={() => setAddVehicle(true)}
          >
            + {t("Add a vehicle")}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-4">
          <input className="wizard-input" placeholder={t("Make")} value={make} onChange={(e) => setMake(e.target.value)} />
          <input className="wizard-input" placeholder={t("Model")} value={model} onChange={(e) => setModel(e.target.value)} />
          <input className="wizard-input" placeholder={t("Plate no.")} value={plate} onChange={(e) => setPlate(e.target.value)} />
          <select
            className="wizard-input"
            value={vtype}
            onChange={(e) => setVtype(e.target.value as "sedan" | "suv")}
          >
            <option value="sedan">{t("Salon / Sedan")}</option>
            <option value="suv">{t("SUV / 4-Wheel")}</option>
          </select>
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
        <p className="py-6 text-center text-sm text-[color:var(--muted-foreground)]">{t("Checking availability…")}</p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots.map((s) => (
            <button
              key={s.start}
              type="button"
              disabled={!s.available}
              onClick={() => setSlot(s.start)}
              className={clsx(
                "rounded-xl border px-2 py-2.5 text-sm font-semibold transition",
                slot === s.start
                  ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                  : s.available
                    ? "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]"
                    : "cursor-not-allowed border-transparent bg-[color:var(--background)] text-[color:var(--muted-foreground)]/50 line-through",
              )}
            >
              {s.start}
            </button>
          ))}
        </div>
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

      <button
        type="button"
        className="primary-button mt-8 w-full disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canSubmit}
        onClick={submit}
      >
        {busy ? t("Confirming…") : `${t("Confirm Booking")} — ${t("Free with membership")}`}
      </button>
    </div>
  );
}

export default function MembershipBookingPage() {
  const { t } = useI18n();
  return (
    <>
      <Navbar />
      <main className="section-shell py-10 sm:py-14">
        <div className="mb-8 text-center">
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
