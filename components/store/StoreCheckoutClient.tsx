"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AuthPanel } from "@/components/booking/AuthPanel";
import {
  ApiError,
  createStoreOrder,
  getToken,
  listStoreProducts,
  me,
  payStoreOrder,
} from "@/lib/api/client";
import type {
  Customer,
  StoreOrder,
  StoreProductInventory,
} from "@/lib/api/types";
import { STORE_PRODUCTS, formatStorePrice } from "@/lib/store/products";

const LocationMap = dynamic(() => import("@/components/booking/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[260px] w-full place-items-center rounded-2xl bg-slate-100 text-sm text-slate-400">
      Loading map...
    </div>
  ),
});

const CART_KEY = "bubbleit.store.cart";
const PENDING_CHECKOUT_KEY = "bubbleit.store.pending-checkout";

type Cart = Record<string, number>;
type PendingCheckout = {
  order: StoreOrder;
  cart: Cart;
};

const COMPLETED_ORDER_STATUSES = new Set<StoreOrder["status"]>([
  // Some supported order APIs return a completed order instead of a payment URL.
  "received",
  "paid",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
  "fulfilled",
]);

function fallbackProducts(): StoreProductInventory[] {
  return STORE_PRODUCTS.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    price: product.price,
    imageSrc: product.imageSrc,
    imageAlt: product.imageAlt,
    stock_quantity: product.initialStock,
    sold_quantity: 0,
    reserved_quantity: 0,
    available_quantity: product.initialStock,
    accounting_code: product.accountingCode,
    is_available: product.initialStock > 0,
  }));
}

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
    if (
      !pending ||
      typeof pending !== "object" ||
      !pending.order ||
      typeof pending.order.id !== "number" ||
      typeof pending.order.reference !== "string" ||
      !pending.cart ||
      typeof pending.cart !== "object"
    ) {
      return null;
    }

    return pending as PendingCheckout;
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

function isCompletedOrder(order: StoreOrder) {
  return COMPLETED_ORDER_STATUSES.has(order.status);
}

function normalizeQatarPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("974")) digits = digits.slice(3);
  return digits.length === 8 ? `+974${digits}` : value.trim();
}

function isValidQatarPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 || (digits.length === 11 && digits.startsWith("974"));
}

export function StoreCheckoutClient() {
  const topRef = useRef<HTMLDivElement | null>(null);
  const checkoutInFlightRef = useRef(false);
  // Keep the server and first browser render identical. Browser storage is
  // restored after hydration below so saved carts do not cause a mismatch.
  const [cart, setCart] = useState<Cart>({});
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckout | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [area, setArea] = useState("");
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
  const [completedOrder, setCompletedOrder] = useState<StoreOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [products, setProducts] = useState<StoreProductInventory[]>(() =>
    fallbackProducts(),
  );
  const [step, setStep] = useState<"location" | "contact" | "review">("location");
  const [contactMode, setContactMode] = useState<"guest" | "signin">("guest");
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

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

      setPendingCheckout(pending);
      setCart(pending.cart);
      setArea(pending.order.delivery_area);
      setAddressDetails(pending.order.delivery_details);
      setGuestName(pending.order.customer_name);
      setGuestPhone(pending.order.customer_phone);
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
        if (!cancelled) setProducts(items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!getToken()) {
      queueMicrotask(() => {
        if (!cancelled) setAuthChecked(true);
      });

      return () => {
        cancelled = true;
      };
    }

    me()
      .then((current) => {
        if (!cancelled) {
          setCustomer(current);
          setGuestName(current.name ?? "");
          setGuestPhone(current.phone);
        }
      })
      .catch(() => {
        if (!cancelled) setCustomer(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0,
      ),
    [items],
  );

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
        { headers: { Accept: "application/json" } },
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

  function savePendingCheckout(order: StoreOrder) {
    const next = { order, cart };
    setPendingCheckout(next);
    writePendingCheckout(next);
    return next;
  }

  function clearCheckoutCart() {
    try {
      window.localStorage.removeItem(CART_KEY);
      window.localStorage.removeItem(PENDING_CHECKOUT_KEY);
    } catch {
      // Navigation can still continue when browser storage is unavailable.
    }
    setCart({});
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
      const payment = await payStoreOrder(checkout.order.id);
      if (payment.checkout_url) {
        setSubmitPhase("redirecting");
        window.location.href = payment.checkout_url;
        clearCheckoutCart();
        return;
      }

      setPaymentNotice(
        "Payment could not start because no checkout link was returned. Please retry payment.",
      );
    } catch (caught) {
      setPaymentNotice(
        caught instanceof ApiError
          ? `Payment could not start: ${caught.message}`
          : "Payment could not start. Your order is saved; please retry payment.",
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
    const contactName = customer?.name?.trim() || guestName.trim();
    const contactPhone = customer?.phone || normalizeQatarPhone(guestPhone);
    if (!contactName || !isValidQatarPhone(contactPhone)) {
      setError("Enter a valid name and Qatar phone number before checkout.");
      setStep("contact");
      return;
    }

    checkoutInFlightRef.current = true;
    setSubmitting(true);
    setSubmitPhase("creating");
    setError(null);
    setPaymentNotice(null);
    try {
      const order = await createStoreOrder({
        customer_name: contactName,
        customer_phone: contactPhone,
        delivery_area: area,
        delivery_details: addressDetails,
        latitude: geo?.lat ?? null,
        longitude: geo?.lng ?? null,
        lines: items.map(({ product, quantity }) => ({
          product_id: product.id,
          inventory_item_id:
            typeof product.id === "number" ? product.id : undefined,
          quantity,
        })),
      });
      const checkout = savePendingCheckout(order);

      if (isCompletedOrder(order)) {
        completeOrder(order);
        return;
      }

      await initializePayment(checkout);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not place the order. Please try again.",
      );
    } finally {
      setSubmitting(false);
      setSubmitPhase("idle");
      checkoutInFlightRef.current = false;
    }
  }

  const submitLabel =
    submitPhase === "creating"
      ? "Creating order..."
      : submitPhase === "initializing_payment"
        ? "Starting payment..."
        : submitPhase === "redirecting"
          ? "Redirecting..."
          : pendingCheckout
            ? "Retry payment"
            : "Place order";
  const checkoutLocked = Boolean(pendingCheckout);

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
          <h1 className="section-title mt-5">Store order received</h1>
          <p className="section-copy mx-auto mt-4">
            Your Bubbleit store order has been captured. The team will contact
            you to confirm delivery and payment details.
          </p>
          {completedOrder && (
            <p className="mt-4 text-sm font-bold text-[color:var(--blue)]">
              Reference {completedOrder.reference}
            </p>
          )}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/store" className="secondary-button">
              Continue shopping
            </Link>
            <Link href="/" className="primary-button">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const locationValid = geo !== null && area.trim().length > 1 && addressDetails.trim().length > 3;
  const contactValid = customer
    ? Boolean(customer.phone)
    : guestName.trim().length > 1 && isValidQatarPhone(guestPhone);
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
          <h1 className="text-2xl font-bold text-[color:var(--navy)]">Your cart is empty</h1>
          <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Choose your products before starting checkout.</p>
          <Link href="/store" className="primary-button mt-6">Shop products</Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex items-center justify-between">
            <Link href="/store" className="inline-flex min-h-11 items-center text-sm font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)]">
              <span className="me-2" aria-hidden="true">←</span> Back to cart
            </Link>
            <span className="text-sm font-bold text-[color:var(--navy)]">{formatStorePrice(subtotal)}</span>
          </div>

          <nav className="mb-7 grid grid-cols-3 gap-2" aria-label="Checkout progress">
            {steps.map((item, index) => (
              <div key={item.id} className="min-w-0">
                <div className={index <= currentStep ? "h-1 rounded-full bg-[color:var(--blue)] transition-colors duration-300" : "h-1 rounded-full bg-slate-200 transition-colors duration-300"} />
                <span className={index === currentStep ? "mt-2 block text-xs font-bold text-[color:var(--navy)]" : "mt-2 block text-xs font-semibold text-[color:var(--muted-foreground)]"}>
                  {index + 1}. {item.label}
                </span>
              </div>
            ))}
          </nav>

          <div key={step} className="checkout-step">
            {step === "location" && (
              <section className="commerce-card overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">Step 1 of 3</span>
                  <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">Where should we deliver?</h1>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Pin the exact location, then add the building details.</p>
                </div>
                <div className="space-y-4 p-4 sm:p-7">
                  <div className="overflow-hidden rounded-2xl">
                    <LocationMap value={geo} onChange={handlePinChange} />
                  </div>
                  <button type="button" className="secondary-button w-full gap-2" disabled={geoState === "locating" || checkoutLocked} onClick={requestLocation}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none"><path d="M12 20s5.25-5.13 5.25-9a5.25 5.25 0 1 0-10.5 0c0 3.87 5.25 9 5.25 9Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="11" r="1.9" fill="currentColor"/></svg>
                    {geoState === "locating" ? "Finding your location…" : geo ? "Update precise location" : "Use my precise location"}
                  </button>
                  {geo && <p className="text-center text-xs font-semibold text-emerald-700">Location pinned successfully</p>}
                  {geoState === "error" && <p role="alert" className="text-center text-xs font-medium text-red-600">Location access failed. Tap the map to place the pin manually.</p>}
                  <label className="block text-sm font-semibold text-[color:var(--navy)]">Delivery area
                    <input className="wizard-input mt-2 min-h-12" placeholder="e.g. West Bay, The Pearl" value={area} disabled={checkoutLocked} onChange={(event) => setArea(event.target.value)} />
                  </label>
                  <label className="block text-sm font-semibold text-[color:var(--navy)]">Building and delivery notes
                    <textarea className="wizard-input mt-2 min-h-20 resize-none" placeholder="Building, street, villa number or parking notes" value={addressDetails} disabled={checkoutLocked} onChange={(event) => setAddressDetails(event.target.value)} />
                  </label>
                </div>
              </section>
            )}

            {step === "contact" && (
              <section className="commerce-card p-5 sm:p-7">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">Step 2 of 3</span>
                <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">How can we reach you?</h1>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">No account required. We only need a valid phone number for this delivery.</p>

                {!authChecked ? (
                  <div className="mt-6 h-28 animate-pulse rounded-2xl bg-slate-100" />
                ) : customer ? (
                  <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Using signed-in account</p>
                    <p className="mt-2 text-lg font-bold">{customer.name || "Bubbleit customer"}</p>
                    <p className="mt-1 text-sm font-semibold" dir="ltr">{customer.phone}</p>
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid grid-cols-2 rounded-full bg-slate-100 p-1">
                      <button type="button" className={contactMode === "guest" ? "min-h-11 rounded-full bg-white px-3 text-sm font-bold text-[color:var(--navy)] shadow-sm" : "min-h-11 rounded-full px-3 text-sm font-semibold text-[color:var(--muted-foreground)]"} onClick={() => setContactMode("guest")}>Guest checkout</button>
                      <button type="button" className={contactMode === "signin" ? "min-h-11 rounded-full bg-white px-3 text-sm font-bold text-[color:var(--navy)] shadow-sm" : "min-h-11 rounded-full px-3 text-sm font-semibold text-[color:var(--muted-foreground)]"} onClick={() => setContactMode("signin")}>Sign in</button>
                    </div>
                    {contactMode === "guest" ? (
                      <div className="mt-5 space-y-4">
                        <label className="block text-sm font-semibold">Full name
                          <input className="wizard-input mt-2 min-h-12" autoComplete="name" value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Your full name" />
                        </label>
                        <label className="block text-sm font-semibold">Qatar phone number
                          <div className="mt-2 flex min-h-12 overflow-hidden rounded-xl border border-[color:var(--border)] bg-white focus-within:border-[color:var(--blue)] focus-within:ring-2 focus-within:ring-[color:var(--cyan)]/30">
                            <span className="grid place-items-center border-e border-slate-200 px-3 text-sm font-bold" dir="ltr">+974</span>
                            <input className="min-w-0 flex-1 px-3 text-sm outline-none" inputMode="tel" autoComplete="tel" dir="ltr" maxLength={8} value={guestPhone.replace(/\D/g, "").replace(/^974/, "").slice(0, 8)} onChange={(event) => setGuestPhone(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="5555 5555" />
                          </div>
                        </label>
                        {guestPhone.length > 0 && !isValidQatarPhone(guestPhone) && <p className="text-xs font-medium text-red-600">Enter all 8 digits of your Qatar phone number.</p>}
                        <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs leading-5 text-[color:var(--muted-foreground)]">Phone verification by OTP will be added here later. You can continue as a guest for now.</p>
                      </div>
                    ) : (
                      <div className="mt-5"><AuthPanel inline title="Sign in to use your saved details" onAuthed={(current) => { setCustomer(current); setGuestName(current.name ?? ""); setGuestPhone(current.phone); }} /></div>
                    )}
                  </>
                )}
              </section>
            )}

            {step === "review" && (
              <form className="space-y-4" onSubmit={submitOrder}>
                <section className="commerce-card p-5 sm:p-7">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">Step 3 of 3</span>
                  <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">Review your order</h1>
                  <div className="mt-5 divide-y divide-slate-100">
                    {items.map(({ product, quantity }) => (
                      <div key={product.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0"><p className="truncate text-sm font-bold">{product.name}</p><p className="text-xs text-[color:var(--muted-foreground)]">Qty {quantity} × {formatStorePrice(product.price)}</p></div>
                        <span className="shrink-0 text-sm font-bold">{formatStorePrice(product.price * quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-semibold">Total</span><span className="text-2xl font-extrabold text-[color:var(--navy)]">{formatStorePrice(subtotal)}</span></div>
                </section>

                <section className="commerce-card divide-y divide-slate-100 px-5 sm:px-7">
                  <div className="flex items-start justify-between gap-4 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Deliver to</p><p className="mt-1 text-sm font-semibold">{area} · {addressDetails}</p></div><button type="button" className="min-h-11 text-sm font-bold text-[color:var(--blue)]" onClick={() => setStep("location")}>Edit</button></div>
                  <div className="flex items-start justify-between gap-4 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">Contact</p><p className="mt-1 text-sm font-semibold">{customer?.name || guestName} · <span dir="ltr">{customer?.phone || normalizeQatarPhone(guestPhone)}</span></p></div><button type="button" className="min-h-11 text-sm font-bold text-[color:var(--blue)]" onClick={() => setStep("contact")}>Edit</button></div>
                </section>

                {pendingCheckout && <p role={paymentNotice ? "alert" : "status"} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">Order {pendingCheckout.order.reference} is saved. {paymentNotice ?? "Retry payment to continue."}</p>}
                {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                <button type="submit" className="primary-button min-h-14 w-full text-base disabled:opacity-50" disabled={submitting}>{submitLabel}</button>
                <p className="text-center text-xs text-[color:var(--muted-foreground)]">By placing your order, you confirm the delivery and contact details above.</p>
              </form>
            )}
          </div>

          {step !== "review" && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/96 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(38,34,98,0.1)]">
              <div className="mx-auto flex max-w-3xl gap-2">
                {step === "contact" && <button type="button" className="secondary-button min-h-14 px-5" onClick={() => setStep("location")}>Back</button>}
                <button type="button" className="primary-button min-h-14 flex-1 text-base disabled:opacity-40" disabled={step === "location" ? !locationValid : !contactValid} onClick={() => { setError(null); setStep(step === "location" ? "contact" : "review"); }}>
                  {step === "location" ? "Continue to contact" : "Review order"} <span className="ms-2" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
