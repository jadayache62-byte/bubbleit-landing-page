"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { HourSlotPicker } from "@/components/booking/HourSlotPicker";

// Leaflet touches `window` at import time, so load the map client-side only.
const LocationMap = dynamic(() => import("@/components/booking/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[260px] w-full place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});
import {
  ApiError,
  createAddress,
  createBooking,
  createVehicle,
  getAvailability,
  listVehicles,
  getQuote,
  getServices,
  getToken,
  listStoreProducts,
  me,
  validatePromo,
} from "@/lib/api/client";
import type {
  Booking,
  BookingQuote,
  Service,
  Slot,
  StoreProductInventory,
  Vehicle,
  VehicleType,
} from "@/lib/api/types";
import {
  formatQatarDateTime,
  nextQatarDays,
  serializeQatarBookingDateTime,
} from "@/lib/datetime";
import { localized, useI18n } from "@/lib/i18n";

const CURRENCY = "QR";

// The three vehicle cards. Jet ski & jet boat share one "Jet" card with a
// sub-toggle; each vehicle in a booking can independently be any kind.
type WashKind = "car" | "caravan" | "jet";

type CarDraft = {
  key: number;
  kind: WashKind;
  vtype: VehicleType;
  vehicleId: number | null;
  serviceId: number | null;
  addOnIds: number[];
  make: string;
  model: string;
  color: string;
  plate: string;
};

function defaultVtype(kind: WashKind): VehicleType {
  switch (kind) {
    case "car":
      return "suv"; // SUV / 4-Wheel is the most common — default to it
    case "caravan":
      return "caravan";
    case "jet":
      return "jet_ski";
  }
}

const emptyCar = (key: number, kind: WashKind = "car"): CarDraft => ({
  key,
  kind,
  vtype: defaultVtype(kind),
  vehicleId: null,
  serviceId: null,
  addOnIds: [],
  make: "",
  model: "",
  color: "",
  plate: "",
});

// Saved-vehicle types that can be picked on a card of this kind.
function typesForKind(kind: WashKind): VehicleType[] {
  switch (kind) {
    case "car":
      return ["sedan", "suv"];
    case "caravan":
      return ["caravan"];
    case "jet":
      return ["jet_ski", "jet_boat"];
  }
}

function priceFor(service: Service, vtype: VehicleType) {
  return vtype === "suv" ? service.price_suv : service.price;
}

const STEPS = [
  "Services",
  "Location",
  "Schedule",
  "Pay & Confirm",
] as const;

const KINDS: { value: WashKind; label: string; icon: string }[] = [
  { value: "car", label: "Car", icon: "🚗" },
  { value: "caravan", label: "Caravan", icon: "🚐" },
  { value: "jet", label: "Jet", icon: "🚤" },
];

// Sub-type toggle options per kind (empty = no toggle, e.g. caravan).
function subTypesFor(kind: WashKind): { value: VehicleType; label: string }[] {
  switch (kind) {
    case "car":
      return [
        { value: "suv", label: "SUV / 4-Wheel" },
        { value: "sedan", label: "Salon / Sedan" },
      ];
    case "jet":
      return [
        { value: "jet_ski", label: "Jet Ski" },
        { value: "jet_boat", label: "Jet Boat" },
      ];
    case "caravan":
      return [];
  }
}

// Catalog categories that make up the service list for a kind + sub-type.
function categoriesFor(kind: WashKind, vtype: VehicleType): string[] {
  switch (kind) {
    case "car":
      return ["wash", "detailing"];
    case "caravan":
      return ["caravan", "caravan_single"];
    case "jet":
      return vtype === "jet_boat" ? ["jet_boat"] : ["jet_ski"];
  }
}

function kindLabel(kind: WashKind): string {
  return KINDS.find((k) => k.value === kind)!.label;
}

function vtypeLabel(vtype: VehicleType): string {
  switch (vtype) {
    case "suv":
      return "SUV";
    case "sedan":
      return "Salon";
    case "caravan":
      return "Caravan";
    case "jet_ski":
      return "Jet Ski";
    case "jet_boat":
      return "Jet Boat";
  }
}

function fmt(amount: number) {
  return `${CURRENCY} ${amount}`;
}

let activeScrollFrame: number | null = null;

function scrollWindowTo(
  getTargetY: number | (() => number),
  reducedMotion: boolean,
  duration = 700,
  onComplete?: () => void,
) {
  if (activeScrollFrame !== null) {
    cancelAnimationFrame(activeScrollFrame);
    activeScrollFrame = null;
  }
  const resolveTarget = () =>
    typeof getTargetY === "function" ? getTargetY() : getTargetY;
  if (reducedMotion) {
    window.scrollTo({ top: resolveTarget(), behavior: "auto" });
    onComplete?.();
    return;
  }
  const startY = window.scrollY;
  const startedAt = performance.now();
  // Ease out immediately follows the customer's tap, then settles gently at
  // the destination instead of pausing first and accelerating late.
  const easeInOut = (progress: number) => 1 - (1 - progress) * (1 - progress);
  const frame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const distance = resolveTarget() - startY;
    window.scrollTo(0, startY + distance * easeInOut(progress));
    if (progress < 1) {
      activeScrollFrame = requestAnimationFrame(frame);
    } else {
      activeScrollFrame = null;
      onComplete?.();
    }
  };
  activeScrollFrame = requestAnimationFrame(frame);
}

function Skeleton({ className }: { className: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

function next7Days(): { date: string; label: string; weekday: string }[] {
  return nextQatarDays(7);
}

export function BookingWizard() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // On every step change, bring the top of the wizard into view (mobile
  // otherwise lands at the bottom of the freshly rendered step).
  useEffect(() => {
    if (!topRef.current) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollWindowTo(window.scrollY + topRef.current.getBoundingClientRect().top - 96, reduceMotion);
  }, [step]);

  // Step 1 — cars & services
  const [cars, setCars] = useState<CarDraft[]>([emptyCar(1)]);
  const serviceIds = useMemo(
    () =>
      cars.map((c) => c.serviceId).filter((id): id is number => id !== null),
    [cars],
  );
  const availabilityCars = useMemo(
    () =>
      cars.flatMap((car) =>
        car.serviceId === null
          ? []
          : [{ service_id: car.serviceId, add_on_ids: car.addOnIds }],
      ),
    [cars],
  );

  // Step 2 — location
  const [area, setArea] = useState("");
  const [details, setDetails] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">(
    "idle",
  );

  // Step 3 — schedule
  const days = useMemo(() => next7Days(), []);
  const [date, setDate] = useState(days[0].date);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  // Step 4 — payment
  const [notes, setNotes] = useState("");
  const [bookingProducts, setBookingProducts] = useState<StoreProductInventory[]>([]);
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});

  // Step 5 — identity + confirm
  const [authed, setAuthed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Booking | null>(null);

  useEffect(() => {
    if (!confirmed) return;

    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [confirmed]);

  useEffect(() => {
    getServices()
      .then(setServices)
      .catch(() => setLoadError(true))
      .finally(() => setServicesLoading(false));
    listStoreProducts()
      .then(setBookingProducts)
      .catch(() => {})
      .finally(() => setProductsLoading(false));
    if (getToken()) {
      me()
        .then(() => setAuthed(true))
        .catch(() => setAuthed(false));
    }
  }, []);

  // Saved cars power the plate chips; refresh whenever auth flips on.
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    listVehicles()
      .then((vs) => {
        if (!cancelled) setMyVehicles(vs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authed]);

  // Reference "now" captured when slots load, used to hide today's past slots.
  const [nowMs, setNowMs] = useState(0);
  const slotRequestRef = useRef(0);

  const loadSlots = useCallback((
    d: string,
    cart: { service_id: number; add_on_ids: number[] }[] = [],
    requestId = ++slotRequestRef.current,
  ) => {
    setSlots(null);
    setSlot(null);
    setNowMs(Date.now());
    getAvailability(d, "standard", cart)
      .then((a) => {
        if (slotRequestRef.current === requestId) setSlots(a.slots);
      })
      .catch(() => {
        if (slotRequestRef.current === requestId) setSlots([]);
      });
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    // Pass the selected cart so slots reflect its full service and add-on duration.
    const requestId = ++slotRequestRef.current;
    queueMicrotask(() => {
      if (slotRequestRef.current === requestId) {
        loadSlots(date, availabilityCars, requestId);
      }
    });
    return () => {
      if (slotRequestRef.current === requestId) slotRequestRef.current += 1;
    };
  }, [step, date, availabilityCars, loadSlots]);

  const total = useMemo(
    () =>
      cars.reduce((sum, car) => {
        const service = services.find((s) => s.id === car.serviceId);
        if (!service) return sum;
        const addOns = service.add_ons.filter((a) =>
          car.addOnIds.includes(a.id),
        );
        return (
          sum +
          priceFor(service, car.vtype) +
          addOns.reduce((s, a) => s + a.price, 0)
        );
      }, 0),
    [cars, services],
  );
  const productTotal = useMemo(
    () => bookingProducts.reduce(
      (sum, product) => sum + product.price * (productQuantities[String(product.id)] ?? 0),
      0,
    ),
    [bookingProducts, productQuantities],
  );

  // Promo code — validated server-side against the cart subtotal + services.
  const [promoInput, setPromoInput] = useState("");
  const [applied, setApplied] = useState<{
    code: string;
    discount: number;
    subtotal: number;
  } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // A discount is only honoured while the cart still matches what was validated.
  const promoActive = applied !== null && applied.subtotal === total;
  const discount = promoActive ? applied.discount : 0;
  const netTotal = Math.max(0, total - discount);

  const applyPromo = useCallback(async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code || total <= 0) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const res = await validatePromo(code, total, serviceIds);
      if (res.valid) {
        setApplied({
          code: res.code || code,
          discount: res.discount_amount,
          subtotal: total,
        });
        setPromoError(null);
      } else {
        setApplied(null);
        setPromoError(res.message ?? t("This code can't be applied."));
      }
    } catch (e) {
      setApplied(null);
      setPromoError(
        e instanceof ApiError ? e.message : t("Couldn't check that code."),
      );
    } finally {
      setPromoBusy(false);
    }
  }, [promoInput, total, serviceIds, t]);

  function clearPromo() {
    setApplied(null);
    setPromoInput("");
    setPromoError(null);
  }

  // Membership pricing — the server is the source of truth. On the confirm
  // step we ask the backend to price the cart with the customer's eligible
  // memberships applied; the toggle lets them pay instead and keep the wash.
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [useMembership, setUseMembership] = useState(true);

  useEffect(() => {
    if (step !== 3 || !authed || !slot) return;
    const quoteCars = cars
      .filter((c) => c.serviceId !== null)
      .map((c) => ({
        vehicle_type: c.vtype,
        service_id: c.serviceId as number,
        add_on_ids: c.addOnIds,
      }));
    if (quoteCars.length === 0) return;

    let cancelled = false;
    // Always price with memberships applied so we can detect eligibility even
    // when the customer has toggled it off; the toggle only decides display.
    getQuote({
      scheduled_at: serializeQatarBookingDateTime(date, slot),
      cars: quoteCars,
      use_membership: true,
    })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {
        if (!cancelled) setQuote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [step, authed, slot, date, cars]);

  const membershipEligible = quote?.membership_eligible ?? false;
  const applyMembership = membershipEligible && useMembership;
  const membershipDiscount = applyMembership
    ? (quote?.membership_discount ?? 0)
    : 0;
  // Total the customer actually pays: membership-adjusted, or the promo net.
  const activeProductTotal = applyMembership ? 0 : productTotal;
  const dueTotal = (applyMembership ? (quote?.total_price ?? 0) : netTotal) + activeProductTotal;
  const paidByMembership = applyMembership && dueTotal <= 0;
  const washesLeftAfter = applyMembership
    ? quote?.memberships.reduce(
        (min, m) => Math.min(min, m.remaining_after),
        Infinity,
      )
    : undefined;
  const showPromo = authed && !applyMembership && total > 0;

  const carsValid = cars.every((c) => c.serviceId !== null && c.plate.trim());

  const canContinue =
    (step === 0 && carsValid) ||
    (step === 1 && area.trim().length > 1) ||
    (step === 2 && slot !== null);

  function updateCar(key: number, patch: Partial<CarDraft>) {
    const editsVehicle =
      patch.vehicleId === undefined &&
      (patch.make !== undefined ||
        patch.model !== undefined ||
        patch.color !== undefined ||
        patch.plate !== undefined ||
        patch.vtype !== undefined);
    setCars((prev) =>
      prev.map((c) =>
        c.key === key
          ? { ...c, ...patch, ...(editsVehicle ? { vehicleId: null } : {}) }
          : c,
      ),
    );
  }

  // Best-effort reverse geocode to prefill the area (OpenStreetMap Nominatim).
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json" } },
      );
      const json = await res.json();
      const a = json.address ?? {};
      const guess =
        a.suburb ||
        a.neighbourhood ||
        a.quarter ||
        a.city_district ||
        a.city ||
        a.town ||
        "";
      if (guess) setArea(guess);
      setDetails((prev) => (a.road && !prev.trim() ? a.road : prev));
    } catch {
      // Coordinates are captured either way; the user can type the area.
    }
  }, []);

  // Fired when the user drags/clicks the pin on the map.
  const handlePinChange = useCallback(
    (v: { lat: number; lng: number }) => {
      setGeo(v);
      setGeoState("idle");
      reverseGeocode(v.lat, v.lng);
    },
    [reverseGeocode],
  );

  function requestLocation() {
    if (!("geolocation" in navigator)) {
      setGeoState("error");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGeo({ lat: latitude, lng: longitude });
        setGeoState("idle");
        reverseGeocode(latitude, longitude);
      },
      () => setGeoState("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function submit() {
    if (!slot) return;
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
        let vehicleId = car.vehicleId;
        if (vehicleId === null) {
          const vehicle = await createVehicle({
            make: car.make.trim(),
            model: car.model.trim(),
            year: null,
            color: car.color.trim(),
            plate_number: car.plate.trim(),
            type: car.vtype,
          });
          vehicleId = vehicle.id;
        }
        carPayloads.push({
          vehicle_id: vehicleId,
          service_id: car.serviceId as number,
          add_on_ids: car.addOnIds,
        });
      }

      const booking = await createBooking({
        scheduled_at: serializeQatarBookingDateTime(date, slot),
        cars: carPayloads,
        address_id: address.id,
        payment_method: "online",
        // Server re-prices and applies memberships; false lets the customer
        // pay and keep the wash. Promo only applies when paying.
        use_membership: useMembership,
        notes: notes.trim() || undefined,
        promo_code: !applyMembership && promoActive ? applied.code : undefined,
        product_lines: (!applyMembership ? Object.entries(productQuantities) : [])
          .filter(([, quantity]) => quantity > 0)
          .map(([product_id, quantity]) => ({ product_id, quantity })),
      });

      // Online-only: hand off to the SkipCash hosted checkout.
      if (booking.payment?.checkout_url) {
        window.location.assign(booking.payment.checkout_url);
        return;
      }
      setConfirmed(booking);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // The backend sends distinct 409 reasons — a car that is already
        // booked must not be presented as a fleet-capacity problem.
        setError(
          e.message.includes("already has a booking")
            ? t(
                "One of your cars already has a booking at this time. Pick a different time for it.",
              )
            : t("That slot was just taken. Please pick another time."),
        );
        setStep(2);
        loadSlots(date, availabilityCars);
      } else {
        setError(
          e instanceof ApiError
            ? e.message
            : t("Something went wrong. Please try again."),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <div className="glass-panel mx-auto max-w-lg rounded-[var(--radius-card)] p-10 text-center">
        <h2 className="text-xl font-bold">
          {t("We couldn't load our services")}
        </h2>
        <p className="mt-3 text-[color:var(--muted-foreground)]">
          {t("Please refresh the page or try again shortly.")}
        </p>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div ref={topRef} className="mx-auto w-full max-w-3xl scroll-mt-24">
        <SuccessPanel booking={confirmed} />
      </div>
    );
  }

  return (
    <div
      ref={topRef}
      className="mx-auto w-full max-w-3xl scroll-mt-24 pb-[calc(13rem+env(safe-area-inset-bottom))]"
    >
      {/* Progress */}
      <ol
        className="mb-8 flex items-center justify-between gap-1 sm:gap-2"
        aria-label="Booking progress"
      >
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-1 sm:gap-2">
            <span
              className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                i < step && "bg-[color:var(--blue)] text-white",
                i === step && "bg-[color:var(--navy)] text-white",
                i > step &&
                  "border border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)]",
              )}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={clsx(
                "hidden text-xs font-medium sm:block",
                i === step
                  ? "text-[color:var(--navy)]"
                  : "text-[color:var(--muted-foreground)]",
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

      <div className="glass-panel rounded-[var(--radius-card)] p-4 sm:p-10">
        {step === 0 && (
          <StepServices
            services={services}
            loading={servicesLoading}
            cars={cars}
            savedVehicles={myVehicles}
            onUpdate={updateCar}
            onAdd={() =>
              setCars((prev) => [
                ...prev,
                emptyCar(Math.max(...prev.map((c) => c.key)) + 1),
              ])
            }
            onRemove={(key) =>
              setCars((prev) => prev.filter((c) => c.key !== key))
            }
          />
        )}

        {step === 1 && (
          <StepPanel
            title={t("Where should we come?")}
            subtitle={t("Our wash bus comes to you — home, office, anywhere.")}
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="secondary-button gap-2"
                disabled={geoState === "locating"}
                onClick={requestLocation}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                  fill="none"
                >
                  <path
                    d="M12 20s5.25-5.13 5.25-9a5.25 5.25 0 1 0-10.5 0c0 3.87 5.25 9 5.25 9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="11" r="1.9" fill="currentColor" />
                </svg>
                {geoState === "locating"
                  ? t("Locating…")
                  : t("Use my exact location")}
              </button>
              {geo && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  ✓ {t("Location pinned")} ({geo.lat.toFixed(4)},{" "}
                  {geo.lng.toFixed(4)})
                </span>
              )}
              {geoState === "error" && (
                <span className="text-xs font-medium text-red-600">
                  {t(
                    "Couldn't get your location — check browser permissions, or type the area below.",
                  )}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <LocationMap value={geo} onChange={handlePinChange} />
              <p className="text-xs text-slate-500">
                {t(
                  "Tap the map or drag the pin to set your exact spot — the driver navigates straight to it.",
                )}
              </p>
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
          <StepPanel
            title={t("Pick your time")}
            subtitle={t("Choose a day and an available slot.")}
          >
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
              <div aria-label={t("Checking availability…")} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 12 }, (_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
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
          </StepPanel>
        )}

        {step === 3 && (
          <StepPanel
            title={t("Pay & Confirm")}
            subtitle={t(
              "Pay online and confirm your booking in one final step.",
            )}
          >
            {!authed && (
              <AuthPanel
                inline
                title={t("Sign in to confirm your booking.")}
                onAuthed={() => setAuthed(true)}
              />
            )}

            <PayOption
              active
              onClick={() => {}}
              title={t("Pay online (SkipCash)")}
            />

            {membershipEligible && (
              <MembershipToggle
                on={useMembership}
                onToggle={() => setUseMembership((v) => !v)}
                name={quote?.memberships[0]?.name ?? t("your membership")}
                remainingAfter={washesLeftAfter}
              />
            )}

            {showPromo && (
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

            {!applyMembership && (
              <BookingProductPicker
                products={bookingProducts}
                loading={productsLoading}
                quantities={productQuantities}
                onChange={(id, quantity) => setProductQuantities((current) => ({
                  ...current,
                  [id]: quantity,
                }))}
              />
            )}

            <Field label={t("Notes for the team (optional)")}>
              <textarea
                className="wizard-input min-h-20 resize-y"
                placeholder={t("Gate code, preferred parking spot…")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <Summary
              cars={cars}
              services={services}
              area={area}
              details={details}
              date={date}
              slot={slot}
              total={total}
              discount={discount}
              promoCode={promoActive ? applied.code : null}
              membershipApplied={applyMembership}
              membershipDiscount={membershipDiscount}
              dueTotal={dueTotal}
              paidByMembership={paidByMembership}
              washesLeftAfter={washesLeftAfter}
              timeRangeLabel={quote?.time_range_label ?? null}
              durationLabel={quote?.duration_label ?? null}
              products={applyMembership ? [] : bookingProducts}
              productQuantities={productQuantities}
              productTotal={activeProductTotal}
            />
          </StepPanel>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {error}
          </p>
        )}
      </div>

        {/* Persistent booking actions */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border)] bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-[color:var(--muted-foreground)] sm:text-sm">
            {step === 3 ? (
              <>
                {t("Total")}{" "}
                <span className="block truncate text-base font-bold text-[color:var(--navy)] sm:inline sm:text-lg">
                  {fmt(dueTotal)}
                </span>
                {paidByMembership ? (
                  <span className="ms-2 text-xs font-semibold text-emerald-600">
                    ({t("covered by membership")})
                  </span>
                ) : (
                  discount > 0 && (
                    <span className="ms-2 text-xs font-medium text-emerald-600">
                      ({t("saved")} {fmt(discount)})
                    </span>
                  )
                )}
              </>
            ) : (
              total > 0 && (
                <>
                  {t("Total")}{" "}
                  <span className="block truncate text-base font-bold text-[color:var(--navy)] sm:inline sm:text-lg">
                    {fmt(netTotal)}
                  </span>
                </>
              )
            )}
          </div>
          <div className="flex min-w-0 flex-[1.35] items-center justify-end gap-2 sm:flex-none">
            {step > 0 && (
              <button
                type="button"
                className="secondary-button min-w-0 shrink px-4 sm:w-auto"
                onClick={() => setStep(step - 1)}
              >
                {t("Back")}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                className="primary-button min-w-0 flex-1 px-5 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                disabled={!canContinue}
                onClick={() => setStep(step + 1)}
              >
                {t("Continue")}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button min-w-0 flex-1 px-5 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                disabled={submitting || !authed}
                onClick={submit}
              >
                {submitting ? t("Confirming…") : t("Confirm & Pay")}
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
        <h2 className="text-2xl font-bold text-[color:var(--foreground)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          {subtitle}
        </p>
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
  loading,
  cars,
  savedVehicles,
  onUpdate,
  onAdd,
  onRemove,
}: {
  services: Service[];
  loading: boolean;
  cars: CarDraft[];
  savedVehicles: Vehicle[];
  onUpdate: (key: number, patch: Partial<CarDraft>) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
}) {
  const { lang, t } = useI18n();
  const contextRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const guideSequence = useRef(0);
  const [attentionKey, setAttentionKey] = useState<number | null>(null);

  function guideToVehicle(key: number, needsVehicle: boolean) {
    setAttentionKey(needsVehicle ? key : null);
    const sequence = ++guideSequence.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Wait for React to commit the selected service and any add-ons before
    // measuring. Two frames avoids animating toward stale card geometry.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (sequence !== guideSequence.current) return;
      const target = contextRefs.current[key];
      if (!target) return;
      if (activeScrollFrame !== null) {
        cancelAnimationFrame(activeScrollFrame);
        activeScrollFrame = null;
      }
      target.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "end",
      });
    }));
  }

  return (
    <StepPanel
      title={t("What are we washing?")}
      subtitle={t("Pick a service for each vehicle — add as many as you like.")}
    >
      <div className="flex flex-col gap-6">
        {cars.map((car, index) => {
          const subTypes = subTypesFor(car.kind);
          const cats = categoriesFor(car.kind, car.vtype);
          const visibleServices = services.filter((s) =>
            cats.includes(s.category),
          );
          const selected = services.find((s) => s.id === car.serviceId);
          const isCar = car.kind === "car";
          const saved = savedVehicles.filter((v) =>
            typesForKind(car.kind).includes(v.type),
          );
          return (
            <div
              key={car.key}
              className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-3.5 sm:p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                  {t(kindLabel(car.kind))} {index + 1}
                </h3>
                {cars.length > 1 && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-500 hover:text-red-600"
                    onClick={() => onRemove(car.key)}
                  >
                    {t("Remove")}
                  </button>
                )}
              </div>

              {/* Kind: Car / Caravan / Jet — each vehicle picks its own */}
              <div className="mb-4 grid grid-cols-3 gap-2">
                {KINDS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      onUpdate(car.key, {
                        kind: option.value,
                        vtype: defaultVtype(option.value),
                        vehicleId: null,
                        serviceId: null,
                        addOnIds: [],
                      })
                    }
                    className={clsx(
                      "flex flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-sm font-semibold transition",
                      car.kind === option.value
                        ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                        : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
                    )}
                  >
                    <span className="text-xl">{option.icon}</span>
                    {t(option.label)}
                  </button>
                ))}
              </div>

              {subTypes.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-semibold">
                    {t("Vehicle type")}
                  </p>
                  <div className="flex gap-2">
                    {subTypes.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          onUpdate(car.key, {
                            vtype: option.value,
                            vehicleId: null,
                            serviceId: null,
                            addOnIds: [],
                          })
                        }
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
              )}

              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
                {loading && Array.from({ length: 6 }, (_, index) => (
                  <div key={index} className="flex min-h-40 flex-col rounded-2xl border border-[color:var(--border)] bg-white p-3 sm:p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="mt-3 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-5/6" />
                    <Skeleton className="mt-auto h-5 w-2/3" />
                  </div>
                ))}
                {!loading && visibleServices.map((service) => {
                  const isPopular = service.name === "Deep Bubble";
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        onUpdate(car.key, {
                          serviceId: service.id,
                          addOnIds: [],
                        });
                        guideToVehicle(car.key, !car.plate.trim());
                      }}
                      className={clsx(
                        "relative flex min-h-40 cursor-pointer flex-col items-start rounded-2xl border p-3 text-start transition duration-200 sm:min-h-44 sm:p-4",
                        car.serviceId === service.id
                          ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                          : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
                      )}
                    >
                      {isPopular && (
                        <span className="absolute end-2 top-2 rounded-full bg-[color:var(--cyan)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--navy)]">
                          {t("Popular")}
                        </span>
                      )}
                      <span className={clsx("text-sm font-bold leading-5 sm:text-base", isPopular && "pe-12")}>
                        {localized(lang, service.name, service.name_ar)}
                      </span>
                      <span
                        className={clsx(
                          "mt-1 line-clamp-3 text-xs leading-4 sm:leading-5",
                          car.serviceId === service.id
                            ? "text-white/75"
                            : "text-[color:var(--muted-foreground)]",
                        )}
                      >
                        {localized(
                          lang,
                          service.description,
                          service.description_ar,
                        )}
                      </span>
                      <span
                        className={clsx(
                          "mt-auto flex items-center gap-2 pt-2 text-sm font-bold",
                          car.serviceId === service.id
                            ? "text-[color:var(--cyan)]"
                            : "text-[color:var(--blue)]",
                        )}
                      >
                        {fmt(priceFor(service, car.vtype))}
                        {service.duration_label && (
                          <span
                            className={clsx(
                              "font-medium",
                              car.serviceId === service.id
                                ? "text-white/70"
                                : "text-[color:var(--muted-foreground)]",
                            )}
                          >
                            · {service.duration_label}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                ref={(node) => {
                  contextRefs.current[car.key] = node;
                }}
                className="scroll-mt-28 scroll-mb-32"
              >
              {selected && selected.add_ons.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold">{t("Add-ons")}</p>
                  <div className="grid grid-cols-2 gap-2">
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
                            "min-h-11 min-w-0 cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold leading-4 transition duration-200",
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

              <div
                className={clsx(
                  "mt-4 rounded-2xl border border-transparent p-2 transition-colors duration-300",
                  attentionKey === car.key &&
                    "border-sky-300 bg-sky-50/80 ring-2 ring-sky-200/70",
                )}
              >
                {attentionKey === car.key && (
                  <p className="mb-2 text-xs font-semibold text-[color:var(--blue)]" role="status">
                    {saved.length > 0
                      ? t("Next: select a saved car or enter the plate number.")
                      : t("Next: enter the plate number.")}
                  </p>
                )}
                {saved.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-2 text-sm font-semibold">
                        {t("Your saved cars")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {saved.map((v) => {
                          const active = car.vehicleId === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setAttentionKey(null);
                                onUpdate(car.key, {
                                  vehicleId: v.id,
                                  plate: v.plate_number,
                                  vtype: v.type,
                                  make: v.make ?? "",
                                  model: v.model ?? "",
                                  color: v.color ?? "",
                                });
                              }}
                              className={clsx(
                                "rounded-full border px-4 py-2 text-xs font-semibold transition",
                                active
                                  ? "border-[color:var(--blue)] bg-[color:var(--blue)] text-white"
                                  : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
                              )}
                            >
                              {v.plate_number}
                              {(v.make || v.model) &&
                                ` · ${[v.make, v.model].filter(Boolean).join(" ")}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                )}
                <Field
                  label={isCar ? t("Plate no.") : t("ID / Registration")}
                  required
                >
                  <input
                    className="wizard-input"
                    placeholder="123456"
                    inputMode={isCar ? "numeric" : undefined}
                    maxLength={isCar ? 6 : undefined}
                    value={car.plate}
                    onChange={(e) => {
                      setAttentionKey(null);
                      onUpdate(car.key, {
                        // Qatar plates: digits only, at most 6.
                        plate: isCar
                          ? e.target.value.replace(/\D/g, "").slice(0, 6)
                          : e.target.value,
                      });
                    }}
                  />
                </Field>
              </div>
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
        {t("+ Add another vehicle")}
      </button>
    </StepPanel>
  );
}

function PayOption({
  active,
  onClick,
  title,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
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
    </button>
  );
}

function BookingProductPicker({
  products,
  loading,
  quantities,
  onChange,
}: {
  products: StoreProductInventory[];
  loading: boolean;
  quantities: Record<string, number>;
  onChange: (id: string, quantity: number) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const availableFor = (product: StoreProductInventory) => Math.max(
    0,
    product.available_quantity ?? product.stock_quantity - product.reserved_quantity,
  );

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const trigger = triggerRef.current;
    const scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };
    // Freeze the page behind the portal. Keeping its exact scroll offset avoids
    // the modal moving when a quantity update rerenders the booking wizard.
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = [...modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo({ top: scrollY, behavior: "auto" });
      document.removeEventListener("keydown", closeOnEscape);
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-white/70 p-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>
    );
  }

  if (products.length === 0) return null;

  const selectedCount = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0);
  const selectedTotal = products.reduce(
    (sum, product) => sum + product.price * (quantities[String(product.id)] ?? 0),
    0,
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          "group relative flex min-h-20 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-4 py-3 text-start shadow-sm transition-colors duration-200 hover:border-[color:var(--blue)] focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] focus-visible:ring-offset-2 sm:gap-4 sm:px-5",
          selectedCount === 0 && "booking-products-nudge",
        )}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[color:var(--navy)] text-white shadow-md shadow-sky-200/80" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none"><path d="M6.5 8.5h11l1 11h-13l1-11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-bold text-[color:var(--navy)]">{t("Enhance your booking")}</span>
            {selectedCount === 0 && (
              <span className="rounded-full bg-[color:var(--cyan)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--navy)]">
                {t("Recommended")}
              </span>
            )}
          </span>
          <span className="block text-xs leading-4 text-[color:var(--muted-foreground)] sm:text-sm">
            {selectedCount > 0
              ? `${selectedCount} ${t("selected")} · ${fmt(selectedTotal)}`
              : t("Add car-care essentials and we’ll bring them with your wash.")}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1 text-xs font-bold text-[color:var(--blue)] sm:flex">
          {t("View products")}
          <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" aria-hidden="true"><path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-products-title"
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section ref={modalRef} className="flex h-[min(88dvh,52rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_32px_100px_rgba(15,23,42,0.32)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[color:var(--border)] bg-white px-4 py-4 sm:px-7 sm:py-6">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--blue)]">{t("Optional add-ons")}</span>
                <h3 id="booking-products-title" className="text-xl font-bold text-[color:var(--navy)] sm:text-2xl">{t("Complete your wash")}</h3>
                <p className="mt-1 max-w-xl text-sm text-[color:var(--muted-foreground)]">
                  {t("We’ll bring these with your service and include them in this payment.")}
                </p>
              </div>
              <button ref={closeButtonRef} type="button" aria-label={t("Close")} onClick={() => setOpen(false)} className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-[color:var(--border)] text-[color:var(--navy)] transition-colors hover:border-[color:var(--navy)] hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[color:var(--blue)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-3 overflow-y-auto overscroll-contain bg-slate-50/80 p-4 sm:grid-cols-2 sm:p-6 lg:gap-4 lg:p-7">
        {products.map((product) => {
          const id = String(product.id);
          const quantity = quantities[id] ?? 0;
          const available = availableFor(product);
          return (
            <div
              key={id}
              className={clsx(
                "flex min-h-28 min-w-0 items-center gap-3 rounded-2xl border bg-white p-3 shadow-sm transition-colors duration-200 sm:gap-4 sm:p-4",
                quantity > 0 ? "border-sky-300 ring-1 ring-sky-200" : "border-[color:var(--border)] hover:border-slate-300",
                available === 0 && "opacity-60",
              )}
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[color:var(--background)] sm:h-24 sm:w-24">
                <Image
                  src={product.imageSrc ?? "/assets/store/product-5.jpg"}
                  alt={product.imageAlt ?? product.name}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--navy)]">{product.name}</p>
                <p className="mt-1 text-sm font-bold text-[color:var(--blue)]">{fmt(product.price)}</p>
                {available === 0 && <p className="mt-1 text-xs font-semibold text-red-600">{t("Out of stock")}</p>}
              </div>
              <div className="ms-auto flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--border)] bg-slate-50 p-1">
                <button type="button" aria-label={t("Remove one")} disabled={quantity === 0}
                  onClick={() => onChange(id, Math.max(0, quantity - 1))}
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-white text-lg font-semibold shadow-sm transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] disabled:cursor-not-allowed disabled:opacity-35">−</button>
                <span className="w-6 text-center text-sm font-bold" aria-live="polite">{quantity}</span>
                <button type="button" aria-label={t("Add one")} disabled={quantity >= available}
                  onClick={() => onChange(id, quantity + 1)}
                  className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-[color:var(--navy)] text-lg font-semibold text-white transition-colors hover:bg-[color:var(--blue)] focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-35">+</button>
              </div>
            </div>
          );
        })}
            </div>
            <div className="flex shrink-0 items-center gap-3 border-t border-[color:var(--border)] bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7 sm:py-5">
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-[color:var(--muted-foreground)]">
                  {selectedCount > 0 ? `${selectedCount} ${t("selected")}` : t("No products selected")}
                </span>
                <span className="block text-lg font-bold text-[color:var(--navy)]">{fmt(selectedTotal)}</span>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="primary-button min-w-36 px-6 sm:min-w-48">
                {t("Add to booking")}
              </button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
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
  promoCode,
  membershipApplied,
  membershipDiscount,
  dueTotal,
  paidByMembership,
  washesLeftAfter,
  timeRangeLabel,
  durationLabel,
  products,
  productQuantities,
  productTotal,
}: {
  cars: CarDraft[];
  services: Service[];
  area: string;
  details: string;
  date: string;
  slot: string | null;
  total: number;
  discount: number;
  promoCode: string | null;
  membershipApplied: boolean;
  membershipDiscount: number;
  dueTotal: number;
  paidByMembership: boolean;
  washesLeftAfter?: number;
  timeRangeLabel: string | null;
  durationLabel: string | null;
  products: StoreProductInventory[];
  productQuantities: Record<string, number>;
  productTotal: number;
}) {
  const { lang, t } = useI18n();
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(
    lang === "ar" ? "ar" : "en",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    },
  );
  return (
    <div className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {t("Booking summary")}
      </h3>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {cars.map((car) => {
          const service = services.find((s) => s.id === car.serviceId);
          if (!service) return null;
          const addOns = service.add_ons.filter((a) =>
            car.addOnIds.includes(a.id),
          );
          const subtotal =
            priceFor(service, car.vtype) +
            addOns.reduce((s, a) => s + a.price, 0);
          return (
            <li
              key={car.key}
              className="flex items-start justify-between gap-4"
            >
              <span>
                <span className="font-semibold">
                  {localized(lang, service.name, service.name_ar)}
                </span>
                {addOns.length > 0 && (
                  <span className="text-[color:var(--muted-foreground)]">
                    {" "}
                    + {addOns.map((a) => a.name).join(", ")}
                  </span>
                )}
                <span className="block text-xs text-[color:var(--muted-foreground)]">
                  {[
                    [car.make, car.model].filter(Boolean).join(" "),
                    car.plate,
                    t(vtypeLabel(car.vtype)),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <span className="font-semibold">{fmt(subtotal)}</span>
            </li>
          );
        })}
        {products.map((product) => {
          const quantity = productQuantities[String(product.id)] ?? 0;
          if (quantity === 0) return null;
          return (
            <li key={product.id} className="flex items-start justify-between gap-4">
              <span>
                <span className="font-semibold">{product.name}</span>
                <span className="block text-xs text-[color:var(--muted-foreground)]">{quantity} × {fmt(product.price)}</span>
              </span>
              <span className="font-semibold">{fmt(product.price * quantity)}</span>
            </li>
          );
        })}
        <li className="flex justify-between border-t border-[color:var(--border)] pt-2">
          <span className="text-[color:var(--muted-foreground)]">
            {t("Location")}
          </span>
          <span className="max-w-[60%] text-right font-medium">
            {area}
            {details && (
              <span className="block text-xs text-[color:var(--muted-foreground)]">
                {details}
              </span>
            )}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-[color:var(--muted-foreground)]">
            {t("When")}
          </span>
          <span className="text-right font-medium">
            {dateLabel}
            <span className="block text-xs text-[color:var(--muted-foreground)]">
              {timeRangeLabel ?? slot}
              {durationLabel && ` · ${durationLabel}`}
            </span>
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-[color:var(--muted-foreground)]">
            {t("Payment")}
          </span>
          <span className="font-medium">
            {paidByMembership ? t("Membership") : t("Pay online (SkipCash)")}
          </span>
        </li>
        {membershipApplied && membershipDiscount > 0 && (
          <>
            <li className="flex justify-between border-t border-[color:var(--border)] pt-2">
              <span className="text-[color:var(--muted-foreground)]">
                {t("Subtotal")}
              </span>
              <span className="font-medium">{fmt(total)}</span>
            </li>
            <li className="flex justify-between text-emerald-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                  {t("Covered by membership")}
                </span>
              </span>
              <span className="font-semibold">− {fmt(membershipDiscount)}</span>
            </li>
          </>
        )}
        {!membershipApplied && discount > 0 && (
          <>
            <li className="flex justify-between border-t border-[color:var(--border)] pt-2">
              <span className="text-[color:var(--muted-foreground)]">
                {t("Subtotal")}
              </span>
              <span className="font-medium">{fmt(total)}</span>
            </li>
            <li className="flex justify-between text-emerald-600">
              <span>
                {t("Discount")}
                {promoCode && (
                  <span className="font-semibold"> ({promoCode})</span>
                )}
              </span>
              <span className="font-semibold">− {fmt(discount)}</span>
            </li>
          </>
        )}
        {productTotal > 0 && (
          <li className="flex justify-between border-t border-[color:var(--border)] pt-2">
            <span className="text-[color:var(--muted-foreground)]">{t("Booking products")}</span>
            <span className="font-medium">{fmt(productTotal)}</span>
          </li>
        )}
        <li className="flex justify-between border-t border-[color:var(--border)] pt-2 text-base font-bold">
          <span>{t("Total")}</span>
              <span>{fmt(dueTotal)}</span>
        </li>
        {paidByMembership &&
          washesLeftAfter !== undefined &&
          Number.isFinite(washesLeftAfter) && (
            <li className="flex justify-end text-xs text-[color:var(--muted-foreground)]">
              {t("Washes left after booking")}: {washesLeftAfter}
            </li>
          )}
      </ul>
    </div>
  );
}

function MembershipToggle({
  on,
  onToggle,
  name,
  remainingAfter,
}: {
  on: boolean;
  onToggle: () => void;
  name: string;
  remainingAfter?: number;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="text-sm">
        <span className="font-semibold text-emerald-800">
          {t("Use membership")}
        </span>
        <span className="block text-xs text-emerald-700">
          {name}
          {on && remainingAfter !== undefined && Number.isFinite(remainingAfter)
            ? ` · ${t("Washes left after booking")}: ${remainingAfter}`
            : ""}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        className={clsx(
          "relative h-6 w-11 shrink-0 rounded-full transition",
          on ? "bg-emerald-600" : "bg-slate-300",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
            on ? "start-[1.375rem]" : "start-0.5",
          )}
        />
      </button>
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
          ✓ {t("Code")} {applied.code} {t("applied")} — {t("you save")}{" "}
          {fmt(applied.discount)}
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
      {error && (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}

function SuccessPanel({ booking }: { booking: Booking }) {
  const { lang, t } = useI18n();
  const when = formatQatarDateTime(
    booking.scheduled_at,
    lang === "ar" ? "ar" : "en",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
  return (
    <div className="glass-panel mx-auto max-w-lg rounded-[var(--radius-card)] p-8 text-center sm:p-12">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
        ✓
      </div>
      <h2 className="mt-6 text-2xl font-bold">{t("Booking confirmed!")}</h2>
      <p className="mt-2 text-[color:var(--muted-foreground)]">
        {t("Reference")}{" "}
        <span className="font-bold text-[color:var(--navy)]">
          {booking.reference}
        </span>
      </p>
      <p className="mt-4 text-sm leading-7 text-[color:var(--muted-foreground)]">
        {when}
        <br />
        {booking.address_area}
        <br />
        {booking.total <= 0
          ? "Covered by your membership."
          : booking.status === "paid"
            ? `Paid ${fmt(booking.total)} online.`
            : `A secure payment link for ${fmt(booking.total)} will follow to confirm your booking.`}
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
