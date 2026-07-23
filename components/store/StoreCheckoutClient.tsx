"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AuthPanel } from "@/components/booking/AuthPanel";
import {
  ApiError,
  createStoreOrder,
  listStoreProducts,
  me,
  payStoreOrder,
  validateServiceArea,
} from "@/lib/api/client";
import type {
  CreateStoreOrderPayload,
  Customer,
  StoreOrder,
  StorePricingConfirmation,
  StoreProductInventory,
} from "@/lib/api/types";
import { localized, useI18n } from "@/lib/i18n";
import { formatStorePrice } from "@/lib/store/products";

function MapLoading() {
  const { t } = useI18n();

  return (
    <div className="grid h-[260px] w-full place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      {t("Loading map…")}
    </div>
  );
}

const LocationMap = dynamic(() => import("@/components/booking/LocationMap"), {
  ssr: false,
  loading: () => <MapLoading />,
});

const CART_KEY = "bubbleit.store.cart";
const PENDING_CHECKOUT_KEY = "bubbleit.store.pending-checkout";
const CHECKOUT_ATTEMPT_KEY = "bubbleit.store.checkout-attempt";

type Cart = Record<string, number>;
type PendingCheckout = {
  order: StoreOrder;
  cart: Cart;
  customerId: number;
  orderKey: string;
  paymentKey: string;
};

type CheckoutAttempt = Pick<PendingCheckout, "orderKey" | "paymentKey"> & { fingerprint: string };

const COMPLETED_ORDER_STATUSES = new Set<StoreOrder["status"]>([
  "paid",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
]);

function readCart(): Cart {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as Cart) : {};
  } catch {
    return {};
  }
}

function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_CHECKOUT_KEY);
    if (!raw) return null;

    const pending = JSON.parse(raw) as Partial<PendingCheckout>;
    const legacyOrder = pending.order as (Partial<StoreOrder> & { customer_id?: number }) | undefined;
    const customerId = pending.customerId ?? legacyOrder?.customer_id;
    if (
      !pending ||
      typeof pending !== "object" ||
      !pending.order ||
      typeof pending.order.id !== "number" ||
      typeof pending.order.reference !== "string" ||
      typeof customerId !== "number" ||
      !pending.cart ||
      typeof pending.cart !== "object"
    ) {
      return null;
    }

    return {
      ...pending,
      customerId,
      orderKey: typeof pending.orderKey === "string"
        ? pending.orderKey
        : `store-order:${pending.order.id}:legacy-create`,
      paymentKey: typeof pending.paymentKey === "string"
        ? pending.paymentKey
        : `store-order:${pending.order.id}:legacy-payment`,
    } as PendingCheckout;
  } catch {
    return null;
  }
}

function writePendingCheckout(pending: PendingCheckout) {
  try {
    window.localStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
  } catch {
    // The in-memory checkout state still prevents a duplicate order this visit.
  }
}

function clearPendingCheckoutStorage() {
  try {
    window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
    window.localStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
  } catch {
    // The cart itself remains available for a new authenticated checkout.
  }
}

function randomAttemptKey(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${id}`;
}

function checkoutAttempt(payload: CreateStoreOrderPayload): CheckoutAttempt {
  const fingerprint = JSON.stringify(payload);
  try {
    const saved = JSON.parse(window.localStorage.getItem(CHECKOUT_ATTEMPT_KEY) ?? "null") as Partial<CheckoutAttempt> | null;
    if (saved?.fingerprint === fingerprint && saved.orderKey && saved.paymentKey) {
      return saved as CheckoutAttempt;
    }
  } catch {
    // Generate a fresh in-memory attempt below.
  }
  const attempt = {
    fingerprint,
    orderKey: randomAttemptKey("store-order:create"),
    paymentKey: randomAttemptKey("store-order:payment"),
  };
  try {
    window.localStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    // The current submit still carries stable keys in memory.
  }
  return attempt;
}

function isCompletedOrder(order: StoreOrder) {
  return COMPLETED_ORDER_STATUSES.has(order.status);
}

function minorUnits(amount: number) {
  return Math.round(amount * 100);
}

function pricingFromConflict(data: unknown): StorePricingConfirmation | null {
  if (!data || typeof data !== "object") return null;
  const pricing = (data as { pricing?: unknown }).pricing;
  if (!pricing || typeof pricing !== "object") return null;
  const candidate = pricing as Partial<StorePricingConfirmation>;
  if (
    candidate.schema !== "store-cart-pricing:v1" ||
    candidate.currency !== "QAR" ||
    typeof candidate.version !== "string" ||
    !Array.isArray(candidate.lines) ||
    !Number.isInteger(candidate.subtotal_minor) ||
    !Number.isInteger(candidate.delivery_fee_minor) ||
    !Number.isInteger(candidate.total_minor)
  ) return null;

  return candidate as StorePricingConfirmation;
}

export function StoreCheckoutClient() {
  const { lang, t } = useI18n();
  const topRef = useRef<HTMLDivElement | null>(null);
  const checkoutInFlightRef = useRef(false);
  const pendingCheckoutRef = useRef<PendingCheckout | null>(null);
  // Keep the server and first browser render identical. Browser storage is
  // restored after hydration below so saved carts do not cause a mismatch.
  const [cart, setCart] = useState<Cart>({});
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckout | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [area, setArea] = useState("");
  const [buildingNumber, setBuildingNumber] = useState("");
  const [zoneNumber, setZoneNumber] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [addressDetails, setAddressDetails] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "locating" | "error">(
    "idle",
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<
    "idle" | "creating" | "initializing_payment" | "redirecting"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  const [pricingReview, setPricingReview] = useState<StorePricingConfirmation | null>(null);
  const [completedOrder, setCompletedOrder] = useState<StoreOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [products, setProducts] = useState<StoreProductInventory[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [step, setStep] = useState<"location" | "contact" | "review">("location");

  const acceptAuthenticatedCustomer = useCallback((current: Customer) => {
    setCustomer(current);
    const pending = pendingCheckoutRef.current;
    if (pending && pending.customerId !== current.id) {
      // A browser cart may survive account changes, but a server-created
      // pending order is private to the customer who created it.
      clearPendingCheckoutStorage();
      pendingCheckoutRef.current = null;
      setPendingCheckout(null);
      setArea("");
      setBuildingNumber("");
      setZoneNumber("");
      setStreetNumber("");
      setAddressDetails("");
      setGeo(null);
      setPaymentNotice(null);
      setStep("location");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Storage is available only after hydration. Deferring the restore also
    // keeps the server and first client render in sync.
    queueMicrotask(() => {
      if (cancelled) return;

      const pending = readPendingCheckout();
      if (!pending) {
        setCart(readCart());
        return;
      }

      pendingCheckoutRef.current = pending;
      setPendingCheckout(pending);
      setCart(pending.cart);
      setArea(pending.order.delivery_area);
      setBuildingNumber(pending.order.building_number ?? "");
      setZoneNumber(pending.order.zone_number ?? "");
      setStreetNumber(pending.order.street_number ?? "");
      setAddressDetails(pending.order.delivery_details ?? "");
      setStep("review");
      if (
        typeof pending.order.latitude === "number" &&
        typeof pending.order.longitude === "number"
      ) {
        setGeo({ lat: pending.order.latitude, lng: pending.order.longitude });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listStoreProducts()
      .then((items) => {
        if (!cancelled) {
          setProducts(items);
          setCatalogState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProducts([]);
          setCatalogState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [catalogAttempt]);

  useEffect(() => {
    let cancelled = false;

    me()
      .then((current) => {
        if (!cancelled) {
          acceptAuthenticatedCustomer(current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCustomer(null);
          if (pendingCheckoutRef.current) setStep("contact");
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [acceptAuthenticatedCustomer]);

  useEffect(() => {
    if (!submitted) return;

    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }, [submitted]);

  useEffect(() => {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "auto", block: "start" }));
  }, [step]);

  const items = useMemo(
    () =>
      products.map((product) => ({
        product,
        quantity: cart[String(product.id)] ?? 0,
      })).filter((item) => item.quantity > 0),
    [cart, products],
  );

  const catalogPricing = useMemo<StorePricingConfirmation>(() => {
    const lines = items.map(({ product, quantity }) => {
      const unitPriceMinor = minorUnits(product.price);
      return {
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unit_price_minor: unitPriceMinor,
        line_total_minor: unitPriceMinor * quantity,
      };
    });
    const subtotalMinor = lines.reduce((sum, line) => sum + line.line_total_minor, 0);

    return {
      schema: "store-cart-pricing:v1",
      version: null,
      currency: "QAR",
      lines,
      subtotal_minor: subtotalMinor,
      delivery_fee_minor: 0,
      total_minor: subtotalMinor,
    };
  }, [items]);
  const reviewedPricing = pricingReview ?? catalogPricing;

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json", "Accept-Language": lang } },
      );
      const json = await res.json();
      const address = json.address ?? {};
      const areaGuess =
        address.suburb ||
        address.neighbourhood ||
        address.quarter ||
        address.city_district ||
        address.city ||
        address.town ||
        "";
      if (areaGuess) setArea(areaGuess);
      setAddressDetails((current) =>
        address.road && !current.trim() ? address.road : current,
      );
    } catch {
      // Coordinates are still captured; the customer can fill the address.
    }
  }

  function handlePinChange(value: { lat: number; lng: number }) {
    if (pendingCheckout) return;

    setGeo(value);
    setGeoState("idle");
    reverseGeocode(value.lat, value.lng);
  }

  function requestLocation() {
    if (pendingCheckout) return;

    if (!("geolocation" in navigator)) {
      setGeoState("error");
      return;
    }
    setGeoState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const value = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setGeo(value);
        setGeoState("idle");
        reverseGeocode(value.lat, value.lng);
      },
      () => setGeoState("error"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  function savePendingCheckout(order: StoreOrder, attempt: CheckoutAttempt, customerId: number) {
    const next = {
      order,
      cart,
      customerId,
      orderKey: attempt.orderKey,
      paymentKey: attempt.paymentKey,
    };
    pendingCheckoutRef.current = next;
    setPendingCheckout(next);
    writePendingCheckout(next);
    return next;
  }

  function clearCheckoutCart() {
    try {
      window.localStorage.removeItem(CART_KEY);
      window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
      window.localStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
    } catch {
      // Navigation can still continue when browser storage is unavailable.
    }
    setCart({});
    pendingCheckoutRef.current = null;
    setPendingCheckout(null);
  }

  function completeOrder(order: StoreOrder) {
    clearCheckoutCart();
    setCompletedOrder(order);
    setPaymentNotice(null);
    setSubmitted(true);
  }

  async function initializePayment(checkout: PendingCheckout) {
    if (isCompletedOrder(checkout.order)) {
      completeOrder(checkout.order);
      return;
    }

    setSubmitPhase("initializing_payment");
    setError(null);
    setPaymentNotice(null);

    try {
      const payment = await payStoreOrder(checkout.order.id, checkout.paymentKey);
      if (payment.checkout_url) {
        setSubmitPhase("redirecting");
        window.location.href = payment.checkout_url;
        clearCheckoutCart();
        return;
      }

      setPaymentNotice(
        t("Payment could not start because no checkout link was returned. Please retry payment."),
      );
    } catch (caught) {
      setPaymentNotice(
        `${t("Payment could not start. Your order is saved; please retry payment.")}${caught instanceof ApiError && caught.requestId ? ` ${t("Reference")}: ${caught.requestId}.` : ""}`,
      );
    }
  }

  async function retryPayment() {
    if (checkoutInFlightRef.current || !pendingCheckout) return;

    checkoutInFlightRef.current = true;
    setSubmitting(true);
    try {
      await initializePayment(pendingCheckout);
    } finally {
      setSubmitting(false);
      setSubmitPhase("idle");
      checkoutInFlightRef.current = false;
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingCheckout) {
      await retryPayment();
      return;
    }
    if (checkoutInFlightRef.current) return;
    if (!customer) {
      setError(t("Sign in or create your verified account before checkout."));
      setStep("contact");
      return;
    }

    checkoutInFlightRef.current = true;
    setSubmitting(true);
    setSubmitPhase("creating");
    setError(null);
    setPaymentNotice(null);
    try {
      if (!geo) {
        setError(t("Confirm the delivery pin before checkout."));
        setStep("location");
        return;
      }
      const serviceArea = await validateServiceArea(geo.lat, geo.lng);
      const payload = {
        delivery_area: area.trim() || "Qatar",
        delivery_details: [
          `Building ${buildingNumber.trim()}`,
          zoneNumber.trim() ? `Zone ${zoneNumber.trim()}` : "",
          streetNumber.trim() ? `Street ${streetNumber.trim()}` : "",
          addressDetails.trim(),
        ].filter(Boolean).join(" · "),
        building_number: buildingNumber.trim(),
        zone_number: zoneNumber.trim(),
        street_number: streetNumber.trim(),
        latitude: geo.lat,
        longitude: geo.lng,
        service_area_version: serviceArea.version,
        pricing_confirmation: reviewedPricing,
        lines: items.map(({ product, quantity }) => ({
          product_id: product.id,
          inventory_item_id: product.id,
          quantity,
        })),
      } satisfies CreateStoreOrderPayload;
      const attempt = checkoutAttempt(payload);
      const order = await createStoreOrder(payload, attempt.orderKey);
      if (
        order.pricing.total_minor !== reviewedPricing.total_minor ||
        order.pricing.currency !== reviewedPricing.currency ||
        (reviewedPricing.version !== null && order.pricing.version !== reviewedPricing.version)
      ) {
        throw new Error("The created order does not match the price you confirmed.");
      }
      const checkout = savePendingCheckout(order, attempt, customer.id);

      if (isCompletedOrder(order)) {
        completeOrder(order);
        return;
      }

      await initializePayment(checkout);
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "STORE_PRICING_CHANGED") {
        const updatedPricing = pricingFromConflict(caught.data);
        if (updatedPricing) {
          setPricingReview(updatedPricing);
          setError(t("The store total changed. Review the updated prices and confirm again to continue to payment."));
          setStep("review");
          return;
        }
      }
      setError(
        `${t("Could not place the order. Please try again.")}${caught instanceof ApiError && caught.requestId ? ` ${t("Reference")}: ${caught.requestId}.` : ""}`,
      );
    } finally {
      setSubmitting(false);
      setSubmitPhase("idle");
      checkoutInFlightRef.current = false;
    }
  }

  const submitLabel =
    submitPhase === "creating"
      ? t("Creating order…")
      : submitPhase === "initializing_payment"
        ? t("Starting payment…")
        : submitPhase === "redirecting"
          ? t("Redirecting…")
          : pendingCheckout
            ? t("Retry payment")
            : pricingReview
              ? t("Confirm updated total and pay")
              : t("Place order");
  const checkoutLocked = Boolean(pendingCheckout);

  if (catalogState !== "ready") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <section className="commerce-card p-8" role="status" aria-live="polite">
          <h1 className="text-2xl font-bold text-[color:var(--navy)]">
            {catalogState === "loading" ? t("Checking your cart…") : t("Checkout is temporarily unavailable")}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[color:var(--muted-foreground)]">
            {catalogState === "loading"
              ? t("We’re verifying every product, price, and stock level with Bubbleit.")
              : t("We couldn’t verify the live catalogue. Your saved cart has not been submitted or replaced with offline products.")}
          </p>
          {catalogState === "error" && (
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setCatalogState("loading");
                  setCatalogAttempt((attempt) => attempt + 1);
                }}
              >
                {t("Retry checkout")}
              </button>
              <Link href="/store" className="secondary-button">{t("Back to store")}</Link>
            </div>
          )}
        </section>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        ref={topRef}
        className="mx-auto max-w-2xl scroll-mt-28 px-4 py-16 text-center sm:px-6"
      >
        <div className="glass-panel rounded-[var(--radius-card)] p-8 sm:p-12">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-2xl font-bold text-emerald-600">
            ✓
          </span>
          <h1 className="section-title mt-5">{t("Store order received")}</h1>
          <p className="section-copy mx-auto mt-4">
            {t("Your Bubbleit store order has been captured. The team will contact you to confirm delivery and payment details.")}
          </p>
          {completedOrder && (
            <p className="mt-4 text-sm font-bold text-[color:var(--blue)]">
              {t("Reference")} {completedOrder.reference}
            </p>
          )}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/store" className="secondary-button">
              {t("Continue shopping")}
            </Link>
            <Link href="/" className="primary-button">
              {t("Back to home")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const locationValid = geo !== null && buildingNumber.trim().length > 0;
  const contactValid = Boolean(customer?.phone);
  const steps = [
    { id: "location", label: "Location" },
    { id: "contact", label: "Contact" },
    { id: "review", label: "Review" },
  ] as const;
  const currentStep = steps.findIndex((item) => item.id === step);

  return (
    <div ref={topRef} className="mx-auto w-full max-w-3xl scroll-mt-24 px-4 py-6 pb-32 sm:px-6 sm:py-10">
      {items.length === 0 ? (
        <div className="commerce-card p-8 text-center">
          <h1 className="text-2xl font-bold text-[color:var(--navy)]">{t("Your cart is empty")}</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{t("Choose your products before starting checkout.")}</p>
          <Link href="/store" className="primary-button mt-6">{t("Shop products")}</Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <Link href="/store" className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)]">
              <span className="me-2 rtl:rotate-180" aria-hidden="true">←</span> {t("Back to cart")}
            </Link>
            <span className="text-sm font-bold text-[color:var(--navy)]">{formatStorePrice(reviewedPricing.total_minor / 100, lang)}</span>
          </div>

          <nav className="mb-7 grid grid-cols-3 gap-2" aria-label={t("Checkout progress")}>
            {steps.map((item, index) => (
              <div key={item.id} className="min-w-0">
                <div className={index <= currentStep ? "h-1 rounded-full bg-[color:var(--blue)] transition-colors duration-300" : "h-1 rounded-full bg-slate-200 transition-colors duration-300"} />
                <span className={index === currentStep ? "mt-2 block text-xs font-bold text-[color:var(--navy)]" : "mt-2 block text-xs font-semibold text-[color:var(--muted-foreground)]"}>
                  {index + 1}. {t(item.label)}
                </span>
              </div>
            ))}
          </nav>

          <div key={step} className="checkout-step">
            {step === "location" && (
              <section className="commerce-card overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{t("Step 1 of 3")}</span>
                  <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Where should we deliver?")}</h1>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Pin the exact location, then add the building details.")}</p>
                </div>
                <div className="space-y-4 p-4 sm:p-7">
                  <div className="overflow-hidden rounded-2xl">
                    <LocationMap value={geo} onChange={handlePinChange} />
                  </div>
                  <button type="button" className="secondary-button w-full gap-2" disabled={geoState === "locating" || checkoutLocked} onClick={requestLocation}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none"><path d="M12 20s5.25-5.13 5.25-9a5.25 5.25 0 1 0-10.5 0c0 3.87 5.25 9 5.25 9Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="11" r="1.9" fill="currentColor"/></svg>
                    {geoState === "locating" ? t("Finding your location…") : geo ? t("Update precise location") : t("Use my precise location")}
                  </button>
                  {geo && <p className="text-center text-xs font-semibold text-emerald-700">{t("Location pinned successfully")}</p>}
                  {geoState === "error" && <p role="alert" className="text-center text-xs font-medium text-red-600">{t("Location access failed. Tap the map to place the pin manually.")}</p>}
                  <div className="rounded-3xl border border-[color:var(--border)] bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-3 text-sm font-bold text-[color:var(--navy)]">{t("Blue plate")}</p>
                    <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-center text-white">
                      <span className="block text-sm font-bold">{t("Building No.")} <span aria-hidden="true">*</span></span>
                      <input className="mt-1 w-full bg-transparent text-center text-4xl font-bold outline-none placeholder:text-white/45 disabled:opacity-60" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={buildingNumber} disabled={checkoutLocked} onChange={(event) => setBuildingNumber(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-white">
                        <span className="block text-sm font-bold">{t("Zone No.")}</span>
                        <input className="mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-white/35 disabled:opacity-60" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={zoneNumber} disabled={checkoutLocked} onChange={(event) => setZoneNumber(event.target.value.replace(/\D/g, "").slice(0, 3))} />
                      </label>
                      <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-white">
                        <span className="block text-sm font-bold">{t("Street No.")}</span>
                        <input className="mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-white/35 disabled:opacity-60" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={streetNumber} disabled={checkoutLocked} onChange={(event) => setStreetNumber(event.target.value.replace(/\D/g, "").slice(0, 4))} />
                      </label>
                    </div>
                  </div>
                  <label className="block text-sm font-semibold text-[color:var(--navy)]">{t("Area / neighborhood")}
                    <input className="wizard-input mt-2 min-h-12" placeholder={t("e.g. West Bay, The Pearl")} value={area} disabled={checkoutLocked} onChange={(event) => setArea(event.target.value)} />
                  </label>
                  <label className="block text-sm font-semibold text-[color:var(--navy)]">{t("Extra details")}
                    <textarea className="wizard-input mt-2 min-h-20 resize-none" placeholder={t("Flat, floor, gate, parking level")} value={addressDetails} disabled={checkoutLocked} onChange={(event) => setAddressDetails(event.target.value)} />
                  </label>
                </div>
              </section>
            )}

            {step === "contact" && (
              <section className="commerce-card p-5 sm:p-7">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{t("Step 2 of 3")}</span>
                <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Verify your account")}</h1>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Store checkout requires a signed-in customer account. Your cart stays here while you sign in or verify a new account by OTP.")}</p>

                {!authChecked ? (
                  <div className="mt-6 h-28 animate-pulse rounded-2xl bg-slate-100" />
                ) : customer ? (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{t("Using signed-in account")}</p>
                    <p className="mt-2 text-lg font-bold">{customer.name || t("Bubbleit customer")}</p>
                    <p className="mt-1 text-sm font-semibold" dir="ltr">{customer.phone}</p>
                  </div>
                ) : (
                  <div className="mt-6">
                    <AuthPanel
                      inline
                      title={t("Sign in or verify your account to continue")}
                      onAuthed={acceptAuthenticatedCustomer}
                    />
                  </div>
                )}
              </section>
            )}

            {step === "review" && (
              <form className="space-y-4" onSubmit={submitOrder}>
                <section className="commerce-card p-5 sm:p-7">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{t("Step 3 of 3")}</span>
                  <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Review your order")}</h1>
                  <div className="mt-5 divide-y divide-slate-100">
                    {reviewedPricing.lines.map((line) => (
                      <div key={String(line.product_id)} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0"><p className="truncate text-sm font-bold">{(() => { const product = products.find((candidate) => candidate.id === line.product_id); return product ? localized(lang, product.name, product.name_ar) : line.name ?? t("Store product"); })()}</p><p className="text-xs text-[color:var(--muted-foreground)]">{t("Qty")} {line.quantity} × {formatStorePrice(line.unit_price_minor / 100, lang)}</p></div>
                        <span className="shrink-0 text-sm font-bold">{formatStorePrice((line.line_total_minor ?? line.unit_price_minor * line.quantity) / 100, lang)}</span>
                      </div>
                    ))}
                  </div>
                  {reviewedPricing.delivery_fee_minor > 0 && <div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm"><span>{t("Delivery fee")}</span><span className="font-bold">{formatStorePrice(reviewedPricing.delivery_fee_minor / 100, lang)}</span></div>}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-semibold">{t("Total")}</span><span className="text-2xl font-extrabold text-[color:var(--navy)]">{formatStorePrice(reviewedPricing.total_minor / 100, lang)}</span></div>
                  {pricingReview && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{t("Pricing changed since your first review. This updated QAR total must be confirmed before payment starts.")}</p>}
                </section>

                <section className="commerce-card divide-y divide-slate-100 px-5 sm:px-7">
                  <div className="flex items-start justify-between gap-4 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{t("Deliver to")}</p><p className="mt-1 text-sm font-semibold">{t("Building")} <bdi>{buildingNumber}</bdi>{zoneNumber ? ` · ${t("Zone")} ${zoneNumber}` : ""}{streetNumber ? ` · ${t("Street")} ${streetNumber}` : ""}{area ? ` · ${area}` : ""}</p></div><button type="button" className="min-h-11 text-sm font-bold text-[color:var(--blue)]" onClick={() => setStep("location")}>{t("Edit")}</button></div>
                  <div className="flex items-start justify-between gap-4 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{t("Account owner")}</p><p className="mt-1 text-sm font-semibold">{customer?.name || t("Bubbleit customer")} · <span dir="ltr">{customer?.phone}</span></p></div><button type="button" className="min-h-11 text-sm font-bold text-[color:var(--blue)]" onClick={() => setStep("contact")}>{t("View")}</button></div>
                </section>

                {pendingCheckout && <p role={paymentNotice ? "alert" : "status"} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{t("Order")} {pendingCheckout.order.reference} {t("is saved.")} {paymentNotice ?? t("Retry payment to continue.")}</p>}
                {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                <button type="submit" className="primary-button min-h-14 w-full text-base disabled:opacity-50" disabled={submitting}>{submitLabel}</button>
                <p className="text-center text-xs text-[color:var(--muted-foreground)]">{t("By placing your order, you confirm the delivery and contact details above.")}</p>
              </form>
            )}
          </div>

          {step !== "review" && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/96 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(38,34,98,0.1)]">
              <div className="mx-auto flex max-w-3xl gap-2">
                {step === "contact" && <button type="button" className="secondary-button min-h-14 px-5" onClick={() => setStep("location")}>{t("Back")}</button>}
                <button type="button" className="primary-button min-h-14 flex-1 text-base disabled:opacity-40" disabled={step === "location" ? !locationValid : !contactValid} onClick={() => { setError(null); setStep(step === "location" ? "contact" : "review"); }}>
                  {step === "location" ? t("Continue to contact") : t("Review order")} <span className="ms-2 rtl:rotate-180" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
