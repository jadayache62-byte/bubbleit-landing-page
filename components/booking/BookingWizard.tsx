"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { AuthPanel } from "@/components/booking/AuthPanel";
import {
  ApiError,
  createAddress,
  createBooking,
  createVehicle,
  getAvailability,
  getServices,
  getToken,
  me,
  validatePromo,
} from "@/lib/api/client";
import type { Booking, Service, Slot, VehicleType, WashTarget } from "@/lib/api/types";
import { localized, useI18n } from "@/lib/i18n";

const CURRENCY = "QR";

type CarDraft = {
  key: number;
  vtype: VehicleType;
  serviceId: number | null;
  addOnIds: number[];
  make: string;
  model: string;
  color: string;
  plate: string;
};

const emptyCar = (key: number): CarDraft => ({
  key,
  vtype: "sedan",
  serviceId: null,
  addOnIds: [],
  make: "",
  model: "",
  color: "",
  plate: "",
});

function priceFor(service: Service, vtype: VehicleType) {
  return vtype === "suv" ? service.price_suv : service.price;
}

const STEPS = ["Services", "Location", "Schedule", "Payment", "Confirm"] as const;

const TARGETS: { value: WashTarget; label: string; icon: string; categories: string[]; vtype: VehicleType | null }[] = [
  { value: "car", label: "Car", icon: "🚗", categories: ["wash", "detailing"], vtype: null },
  { value: "caravan", label: "Caravan", icon: "🚐", categories: ["caravan", "caravan_single"], vtype: "caravan" },
  { value: "jet_ski", label: "Jet Ski", icon: "🌊", categories: ["jet_ski"], vtype: "jet_ski" },
  { value: "jet_boat", label: "Jet Boat", icon: "🚤", categories: ["jet_boat"], vtype: "jet_boat" },
];

function fmt(amount: number) {
  return `${CURRENCY} ${amount}`;
}

function next7Days(): { date: string; label: string; weekday: string }[] {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({
      date: iso,
      label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en", { month: "short", day: "numeric" }),
      weekday: d.toLocaleDateString("en", { weekday: "short" }),
    });
  }
  return days;
}

export function BookingWizard() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<WashTarget>("car");
  const [services, setServices] = useState<Service[]>([]);
  const [loadError, setLoadError] = useState(false);

  // Step 1 — cars & services
  const [cars, setCars] = useState<CarDraft[]>([emptyCar(1)]);

  // Step 2 — location
  const [area, setArea] = useState("");
  const [details, setDetails] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">("idle");

  // Step 3 — schedule
  const days = useMemo(() => next7Days(), []);
  const [date, setDate] = useState(days[0].date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  // Step 4 — payment
  const [notes, setNotes] = useState("");

  // Step 5 — identity + confirm
  const [authed, setAuthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch(() => setLoadError(true));
    if (getToken()) {
      me()
        .then(() => setAuthed(true))
        .catch(() => setAuthed(false));
    }
  }, []);

  const loadSlots = useCallback((d: string) => {
    setSlots(null);
    setSlot(null);
    getAvailability(d)
      .then((a) => setSlots(a.slots))
      .catch(() => setSlots([]));
  }, []);

  useEffect(() => {
    if (step === 2) queueMicrotask(() => loadSlots(date));
  }, [step, date, loadSlots]);

  const total = useMemo(
    () =>
      cars.reduce((sum, car) => {
        const service = services.find((s) => s.id === car.serviceId);
        if (!service) return sum;
        const addOns = service.add_ons.filter((a) => car.addOnIds.includes(a.id));
        return sum + priceFor(service, car.vtype) + addOns.reduce((s, a) => s + a.price, 0);
      }, 0),
    [cars, services],
  );

  // Promo code — validated server-side against the cart subtotal + services.
  const [promoInput, setPromoInput] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number; subtotal: number } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // A discount is only honoured while the cart still matches what was validated.
  const promoActive = applied !== null && applied.subtotal === total;
  const discount = promoActive ? applied.discount : 0;
  const netTotal = Math.max(0, total - discount);

  const serviceIds = useMemo(
    () => cars.map((c) => c.serviceId).filter((id): id is number => id !== null),
    [cars],
  );

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code || total <= 0) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await validatePromo(code, total, serviceIds);
      if (res.valid) {
        setApplied({ code: res.code || code, discount: res.discount_amount, subtotal: total });
        setPromoError(null);
      } else {
        setApplied(null);
        setPromoError(res.message ?? t("This code can't be applied."));
      }
    } catch (e) {
      setApplied(null);
      setPromoError(e instanceof ApiError ? e.message : t("Couldn't check that code."));
    } finally {
      setPromoBusy(false);
    }
  }, [promoInput, total, serviceIds, t]);

  function clearPromo() {
    setApplied(null);
    setPromoInput("");
    setPromoError(null);
  }

  const carsValid = cars.every(
    (c) => c.serviceId !== null && c.plate.trim(),
  );

  const canContinue =
    (step === 0 && carsValid) ||
    (step === 1 && area.trim().length > 1) ||
    (step === 2 && slot !== null) ||
    step === 3;

  function updateCar(key: number, patch: Partial<CarDraft>) {
    setCars((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function switchTarget(next: WashTarget) {
    setTarget(next);
    const meta = TARGETS.find((x) => x.value === next)!;
    setCars([{ ...emptyCar(1), vtype: meta.vtype ?? "sedan" }]);
  }

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeo({ lat: latitude, lng: longitude });
        setGeoState("idle");
        // Best-effort reverse geocode to prefill the area (OpenStreetMap Nominatim).
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: "application/json" } },
          );
          const json = await res.json();
          const a = json.address ?? {};
          const guess =
            a.suburb || a.neighbourhood || a.quarter || a.city_district || a.city || a.town || "";
          if (guess) setArea(guess);
          if (a.road && !details.trim()) setDetails(a.road);
        } catch {
          // Coordinates are captured either way; the user can type the area.
        }
      },
      () => setGeoState("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const address = await createAddress({
        label: "Home",
        area: area.trim(),
        details: details.trim(),
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
      });

      const carPayloads = [];
      for (const car of cars) {
        const vehicle = await createVehicle({
          make: car.make.trim(),
          model: car.model.trim(),
          year: null,
          color: car.color.trim(),
          plate_number: car.plate.trim(),
          type: car.vtype,
        });
        carPayloads.push({
          vehicle_id: vehicle.id,
          service_id: car.serviceId as number,
          add_on_ids: car.addOnIds,
        });
      }

      const booking = await createBooking({
        scheduled_at: `${date}T${slot}:00`,
        cars: carPayloads,
        address_id: address.id,
        payment_method: "pay_on_site",
        notes: notes.trim() || undefined,
        promo_code: promoActive ? applied.code : undefined,
      });

      setConfirmed(booking);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError(t("That slot was just taken. Please pick another time."));
        setStep(2);
        loadSlots(date);
      } else {
        setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="glass-panel mx-auto max-w-lg rounded-[var(--radius-card)] p-10 text-center">
        <h2 className="text-xl font-bold">{t("We couldn't load our services")}</h2>
        <p className="mt-3 text-[color:var(--muted-foreground)]">{t("Please refresh the page or try again shortly.")}</p>
      </div>
    );
  }

  if (confirmed) {
    return <SuccessPanel booking={confirmed} />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Progress */}
      <ol className="mb-8 flex items-center justify-between gap-1 sm:gap-2" aria-label="Booking progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            <span
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                i < step && "bg-[color:var(--blue)] text-white",
                i === step && "bg-[color:var(--navy)] text-white",
                i > step && "border border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)]",
              )}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={clsx(
                "hidden text-xs font-medium sm:block",
                i === step ? "text-[color:var(--navy)]" : "text-[color:var(--muted-foreground)]",
              )}
            >
              {t(label)}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 hidden h-px flex-1 bg-[color:var(--border)] sm:block" />
            )}
          </li>
        ))}
      </ol>

      <div className="glass-panel rounded-[var(--radius-card)] p-6 sm:p-10">
        {step === 0 && (
          <StepServices
            services={services}
            cars={cars}
            target={target}
            onTarget={switchTarget}
            onUpdate={updateCar}
            onAdd={() =>
              setCars((prev) => [
                ...prev,
                {
                  ...emptyCar(Math.max(...prev.map((c) => c.key)) + 1),
                  vtype: TARGETS.find((x) => x.value === target)!.vtype ?? "sedan",
                },
              ])
            }
            onRemove={(key) => setCars((prev) => prev.filter((c) => c.key !== key))}
          />
        )}

        {step === 1 && (
          <StepPanel title={t("Where should we come?")} subtitle={t("Our wash bus comes to you — home, office, anywhere.")}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="secondary-button gap-2"
                disabled={geoState === "locating"}
                onClick={requestLocation}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
                  <path
                    d="M12 20s5.25-5.13 5.25-9a5.25 5.25 0 1 0-10.5 0c0 3.87 5.25 9 5.25 9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="11" r="1.9" fill="currentColor" />
                </svg>
                {geoState === "locating" ? t("Locating…") : t("Use my exact location")}
              </button>
              {geo && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  ✓ {t("Location pinned")} ({geo.lat.toFixed(4)}, {geo.lng.toFixed(4)})
                </span>
              )}
              {geoState === "error" && (
                <span className="text-xs font-medium text-red-600">
                  {t("Couldn't get your location — check browser permissions, or type the area below.")}
                </span>
              )}
            </div>
            <Field label={t("Area / neighborhood")} required>
              <input
                className="wizard-input"
                placeholder={t("e.g. West Bay, The Pearl…")}
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </Field>
            <Field label={t("Building, street, parking details")}>
              <textarea
                className="wizard-input min-h-24 resize-y"
                placeholder={t("Tower name, gate number, parking level…")}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </Field>
          </StepPanel>
        )}

        {step === 2 && (
          <StepPanel title={t("Pick your time")} subtitle={t("Choose a day and an available slot.")}>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setDate(d.date)}
                  className={clsx(
                    "flex min-w-[4.5rem] flex-col items-center rounded-2xl border px-3 py-2.5 text-sm transition",
                    date === d.date
                      ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                      : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
                  )}
                >
                  <span className="text-xs opacity-75">{d.weekday}</span>
                  <span className="font-semibold">{t(d.label)}</span>
                </button>
              ))}
            </div>

            {slots === null ? (
              <p className="py-8 text-center text-sm text-[color:var(--muted-foreground)]">{t("Checking availability…")}</p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                          ? "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)] hover:text-[color:var(--blue)]"
                          : "cursor-not-allowed border-transparent bg-[color:var(--background)] text-[color:var(--muted-foreground)]/50 line-through",
                    )}
                  >
                    {s.start}
                  </button>
                ))}
              </div>
            )}
          </StepPanel>
        )}

        {step === 3 && (
          <StepPanel title={t("How would you like to pay?")} subtitle={t("Pay securely online, or in person when we arrive.")}>
            <PayOption
              active
              onClick={() => {}}
              title={t("Pay on site")}
              description={t("Cash or card when the team arrives.")}
            />
            <Field label={t("Notes for the team (optional)")}>
              <textarea
                className="wizard-input min-h-20 resize-y"
                placeholder={t("Gate code, preferred parking spot…")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </StepPanel>
        )}

        {step === 4 && (
          <StepPanel
            title={t("Review & confirm")}
            subtitle={t("Everything look right?")}
          >
            {!authed && (
              <AuthPanel
                inline
                title={t("Sign in to confirm your booking.")}
                onAuthed={() => setAuthed(true)}
              />
            )}

            {authed && total > 0 && (
              <PromoField
                applied={promoActive ? applied : null}
                value={promoInput}
                busy={promoBusy}
                error={promoError}
                onChange={setPromoInput}
                onApply={applyPromo}
                onClear={clearPromo}
              />
            )}

            <Summary
              cars={cars}
              services={services}
              area={area}
              details={details}
              date={date}
              slot={slot}
              total={total}
              discount={discount}
              netTotal={netTotal}
              promoCode={promoActive ? applied.code : null}
            />
          </StepPanel>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {/* Footer nav */}
        <div className="mt-8 flex flex-col gap-4 border-t border-[color:var(--border)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[color:var(--muted-foreground)]">
            {total > 0 && (
              <>
                {t("Total")} <span className="text-lg font-bold text-[color:var(--navy)]">{fmt(netTotal)}</span>
                {discount > 0 && (
                  <span className="ms-2 text-xs font-medium text-emerald-600">
                    ({t("saved")} {fmt(discount)})
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {step > 0 && (
              <button
                type="button"
                className="secondary-button w-full sm:w-auto"
                onClick={() => setStep(step - 1)}
              >
                {t("Back")}
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                disabled={!canContinue}
                onClick={() => setStep(step + 1)}
              >
                {t("Continue")}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button w-full disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                disabled={submitting || !authed}
                onClick={submit}
              >
                {submitting ? t("Confirming…") : t("Confirm Booking")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StepPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-2xl font-bold text-[color:var(--foreground)]">{title}</h2>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-[color:var(--foreground)]">
        {label}
        {required && <span className="text-[color:var(--blue)]"> *</span>}
      </span>
      {children}
    </label>
  );
}

function StepServices({
  services,
  cars,
  target,
  onTarget,
  onUpdate,
  onAdd,
  onRemove,
}: {
  services: Service[];
  cars: CarDraft[];
  target: WashTarget;
  onTarget: (target: WashTarget) => void;
  onUpdate: (key: number, patch: Partial<CarDraft>) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
}) {
  const { lang, t } = useI18n();
  const meta = TARGETS.find((x) => x.value === target)!;
  const visibleServices = services.filter((s) => meta.categories.includes(s.category));
  const isCar = target === "car";

  return (
    <StepPanel
      title={t("What are we washing?")}
      subtitle={isCar ? t("Pick a service for each car — add as many cars as you like.") : t("Pick a service.")}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TARGETS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onTarget(option.value)}
            className={clsx(
              "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-sm font-semibold transition",
              target === option.value
                ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
            )}
          >
            <span className="text-xl">{option.icon}</span>
            {t(option.label)}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-6">
        {cars.map((car, index) => {
          const selected = services.find((s) => s.id === car.serviceId);
          return (
            <div key={car.key} className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                  {t(TARGETS.find((x) => x.value === target)!.label)} {index + 1}
                </h3>
                {cars.length > 1 && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                    onClick={() => onRemove(car.key)}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className={clsx("mb-4", !isCar && "hidden")}>
                <p className="mb-2 text-sm font-semibold">{t("Vehicle type")}</p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "sedan", label: "Salon / Sedan" },
                      { value: "suv", label: "SUV / 4-Wheel" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onUpdate(car.key, { vtype: option.value })}
                      className={clsx(
                        "flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold transition sm:flex-none sm:px-6",
                        car.vtype === option.value
                          ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                          : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
                      )}
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {visibleServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => onUpdate(car.key, { serviceId: service.id, addOnIds: [] })}
                    className={clsx(
                      "flex flex-col items-start rounded-2xl border p-4 text-left transition",
                      car.serviceId === service.id
                        ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                        : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
                    )}
                  >
                    <span className="font-bold">{localized(lang, service.name, service.name_ar)}</span>
                    <span
                      className={clsx(
                        "mt-1 text-xs leading-5",
                        car.serviceId === service.id ? "text-white/75" : "text-[color:var(--muted-foreground)]",
                      )}
                    >
                      {localized(lang, service.description, service.description_ar)}
                    </span>
                    <span
                      className={clsx(
                        "mt-2 text-sm font-bold",
                        car.serviceId === service.id ? "text-[color:var(--cyan)]" : "text-[color:var(--blue)]",
                      )}
                    >
                      {fmt(priceFor(service, car.vtype))}
                    </span>
                  </button>
                ))}
              </div>

              {selected && selected.add_ons.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">{t("Add-ons")}</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.add_ons.map((addOn) => {
                      const active = car.addOnIds.includes(addOn.id);
                      return (
                        <button
                          key={addOn.id}
                          type="button"
                          onClick={() =>
                            onUpdate(car.key, {
                              addOnIds: active
                                ? car.addOnIds.filter((id) => id !== addOn.id)
                                : [...car.addOnIds, addOn.id],
                            })
                          }
                          className={clsx(
                            "rounded-full border px-4 py-2 text-xs font-semibold transition",
                            active
                              ? "border-[color:var(--blue)] bg-[color:var(--blue)] text-white"
                              : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
                          )}
                        >
                          {addOn.name} · {fmt(addOn.price)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Field label={t("Make")}>
                  <input
                    className="wizard-input"
                    placeholder="Toyota"
                    value={car.make}
                    onChange={(e) => onUpdate(car.key, { make: e.target.value })}
                  />
                </Field>
                <Field label={t("Model")}>
                  <input
                    className="wizard-input"
                    placeholder="Land Cruiser"
                    value={car.model}
                    onChange={(e) => onUpdate(car.key, { model: e.target.value })}
                  />
                </Field>
                <Field label={t("Color")}>
                  <input
                    className="wizard-input"
                    placeholder="White"
                    value={car.color}
                    onChange={(e) => onUpdate(car.key, { color: e.target.value })}
                  />
                </Field>
                <Field label={isCar ? t("Plate no.") : t("ID / Registration")} required>
                  <input
                    className="wizard-input"
                    placeholder="123456"
                    value={car.plate}
                    onChange={(e) => onUpdate(car.key, { plate: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="secondary-button self-start"
        onClick={onAdd}
      >
        {t("+ Add another car")}
      </button>
    </StepPanel>
  );
}

function PayOption({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "flex flex-col items-start rounded-2xl border p-5 text-left transition",
        active
          ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
          : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
      )}
    >
      <span className="font-bold">{title}</span>
      <span className={clsx("mt-1 text-sm", active ? "text-white/75" : "text-[color:var(--muted-foreground)]")}>
        {description}
      </span>
    </button>
  );
}

function Summary({
  cars,
  services,
  area,
  details,
  date,
  slot,
  total,
  discount,
  netTotal,
  promoCode,
}: {
  cars: CarDraft[];
  services: Service[];
  area: string;
  details: string;
  date: string;
  slot: string | null;
  total: number;
  discount: number;
  netTotal: number;
  promoCode: string | null;
}) {
  const { lang, t } = useI18n();
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(lang === "ar" ? "ar" : "en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {t("Booking summary")}
      </h3>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {cars.map((car) => {
          const service = services.find((s) => s.id === car.serviceId);
          if (!service) return null;
          const addOns = service.add_ons.filter((a) => car.addOnIds.includes(a.id));
          const subtotal = priceFor(service, car.vtype) + addOns.reduce((s, a) => s + a.price, 0);
          return (
            <li key={car.key} className="flex items-start justify-between gap-4">
              <span>
                <span className="font-semibold">{localized(lang, service.name, service.name_ar)}</span>
                {addOns.length > 0 && (
                  <span className="text-[color:var(--muted-foreground)]"> + {addOns.map((a) => a.name).join(", ")}</span>
                )}
                <span className="block text-xs text-[color:var(--muted-foreground)]">
                  {[
                    [car.make, car.model].filter(Boolean).join(" "),
                    car.plate,
                    car.vtype === "suv" ? "SUV" : "Salon",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="font-semibold">{fmt(subtotal)}</span>
            </li>
          );
        })}
        <li className="flex justify-between border-t border-[color:var(--border)] pt-2">
          <span className="text-[color:var(--muted-foreground)]">{t("Location")}</span>
          <span className="max-w-[60%] text-right font-medium">
            {area}
            {details && <span className="block text-xs text-[color:var(--muted-foreground)]">{details}</span>}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-[color:var(--muted-foreground)]">{t("When")}</span>
          <span className="font-medium">
            {dateLabel} · {slot}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-[color:var(--muted-foreground)]">{t("Payment")}</span>
          <span className="font-medium">{t("Pay on site")}</span>
        </li>
        {discount > 0 && (
          <>
            <li className="flex justify-between border-t border-[color:var(--border)] pt-2">
              <span className="text-[color:var(--muted-foreground)]">{t("Subtotal")}</span>
              <span className="font-medium">{fmt(total)}</span>
            </li>
            <li className="flex justify-between text-emerald-600">
              <span>
                {t("Discount")}
                {promoCode && <span className="font-semibold"> ({promoCode})</span>}
              </span>
              <span className="font-semibold">− {fmt(discount)}</span>
            </li>
          </>
        )}
        <li className="flex justify-between border-t border-[color:var(--border)] pt-2 text-base font-bold">
          <span>{t("Total")}</span>
          <span>{fmt(netTotal)}</span>
        </li>
      </ul>
    </div>
  );
}

function PromoField({
  applied,
  value,
  busy,
  error,
  onChange,
  onApply,
  onClear,
}: {
  applied: { code: string; discount: number } | null;
  value: string;
  busy: boolean;
  error: string | null;
  onChange: (v: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  if (applied) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="text-sm font-semibold text-emerald-700">
          ✓ {t("Code")} {applied.code} {t("applied")} — {t("you save")} {fmt(applied.discount)}
        </span>
        <button
          type="button"
          className="text-xs font-semibold text-red-600 hover:underline"
          onClick={onClear}
        >
          {t("Remove")}
        </button>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-[color:var(--muted-foreground)]">
        {t("Promo code")}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={t("e.g. SUMMER20")}
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm uppercase outline-none focus:border-[color:var(--blue)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onApply();
            }
          }}
        />
        <button
          type="button"
          className="secondary-button shrink-0 disabled:opacity-50"
          disabled={busy || value.trim().length === 0}
          onClick={onApply}
        >
          {busy ? t("Checking…") : t("Apply")}
        </button>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function SuccessPanel({ booking }: { booking: Booking }) {
  const { lang, t } = useI18n();
  const when = new Date(booking.scheduled_at).toLocaleString(lang === "ar" ? "ar" : "en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="glass-panel mx-auto max-w-lg rounded-[var(--radius-card)] p-8 text-center sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        ✓
      </div>
      <h2 className="mt-6 text-2xl font-bold">{t("Booking confirmed!")}</h2>
      <p className="mt-2 text-[color:var(--muted-foreground)]">
        {t("Reference")} <span className="font-bold text-[color:var(--navy)]">{booking.reference}</span>
      </p>
      <p className="mt-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
        {when}
        <br />
        {booking.address_area}
        <br />
        {booking.payment_method === "pay_on_site"
          ? `Pay ${fmt(booking.total)} when the team arrives.`
          : `Paid ${fmt(booking.total)} online.`}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/account" className="primary-button">
          {t("View my bookings")}
        </Link>
        <Link href="/" className="secondary-button">
          {t("Back to home")}
        </Link>
      </div>
    </div>
  );
}
