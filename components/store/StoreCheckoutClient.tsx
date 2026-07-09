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
import type { Customer, StoreProductInventory } from "@/lib/api/types";
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

type Cart = Record<string, number>;

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

function availableFor(product: StoreProductInventory) {
  return Math.max(
    0,
    product.available_quantity ??
      product.stock_quantity - product.reserved_quantity,
  );
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

function writeCart(cart: Cart) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function StoreCheckoutClient() {
  const topRef = useRef<HTMLDivElement | null>(null);
  const [cart, setCart] = useState<Cart>(() => readCart());
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
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authChecked, setAuthChecked] = useState(() => !getToken());
  const [products, setProducts] = useState<StoreProductInventory[]>(() =>
    fallbackProducts(),
  );

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
    if (!getToken()) {
      return;
    }
    let cancelled = false;
    me()
      .then((current) => {
        if (!cancelled) setCustomer(current);
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

  function updateQuantity(id: string, quantity: number) {
    const product = products.find((item) => String(item.id) === id);
    const max = product ? availableFor(product) : quantity;
    const next = { ...cart };
    if (quantity <= 0) {
      delete next[id];
    } else {
      next[id] = Math.min(quantity, max);
    }
    setCart(next);
    writeCart(next);
  }

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
    setGeo(value);
    setGeoState("idle");
    reverseGeocode(value.lat, value.lng);
  }

  function requestLocation() {
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

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer) {
      setError("Sign in before placing your store order.");
      return;
    }
    setSubmitting(true);
    setSubmitPhase("creating");
    setError(null);
    setPaymentNotice(null);
    try {
      const order = await createStoreOrder({
        customer_name: customer.name,
        customer_phone: customer.phone,
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
      setOrderReference(order.reference);

      try {
        setSubmitPhase("initializing_payment");
        const payment = await payStoreOrder(order.id);
        window.localStorage.removeItem(CART_KEY);
        setCart({});

        if (payment.checkout_url) {
          setSubmitPhase("redirecting");
          window.location.href = payment.checkout_url;
          return;
        }

        setSubmitted(true);
      } catch (paymentError) {
        window.localStorage.removeItem(CART_KEY);
        setCart({});
        setPaymentNotice(
          paymentError instanceof ApiError
            ? `Payment could not start: ${paymentError.message}`
            : "Payment could not start. The team will follow up with your order reference.",
        );
        setSubmitted(true);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not place the order. Please try again.",
      );
    } finally {
      setSubmitting(false);
      setSubmitPhase("idle");
    }
  }

  const submitLabel =
    submitPhase === "creating"
      ? "Creating order..."
      : submitPhase === "initializing_payment"
        ? "Starting payment..."
        : submitPhase === "redirecting"
          ? "Redirecting..."
          : "Place order";

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
          {orderReference && (
            <p className="mt-4 text-sm font-bold text-[color:var(--blue)]">
              Reference {orderReference}
            </p>
          )}
          {paymentNotice && (
            <p className="mx-auto mt-4 max-w-md rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              {paymentNotice}
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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mb-8">
        <span className="section-kicker">Store Checkout</span>
        <h1 className="section-title mt-4">Complete your product order</h1>
      </div>

      {items.length === 0 ? (
        <div className="glass-panel rounded-[var(--radius-card)] p-8 text-center">
          <h2 className="text-2xl font-bold text-[color:var(--navy)]">
            Your cart is empty
          </h2>
          <p className="section-copy mx-auto mt-3">
            Add products from the Bubbleit store before checking out.
          </p>
          <Link href="/store" className="primary-button mt-6">
            Shop products
          </Link>
        </div>
      ) : (
        <form className="grid gap-8 lg:grid-cols-[1fr_24rem]" onSubmit={submitOrder}>
          <section className="glass-panel rounded-[var(--radius-card)] p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-[color:var(--navy)]">
              Delivery details
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                {!authChecked ? (
                  <div className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-5 text-sm font-semibold text-[color:var(--muted-foreground)]">
                    Checking your account...
                  </div>
                ) : customer ? (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      Signed in account
                    </p>
                    <p className="mt-2 text-lg font-bold text-[color:var(--navy)]">
                      {customer.name || "Bubbleit customer"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--muted-foreground)]" dir="ltr">
                      {customer.phone}
                    </p>
                  </div>
                ) : (
                  <AuthPanel
                    inline
                    title="Sign in to continue checkout."
                    onAuthed={setCustomer}
                  />
                )}
              </div>
              <div className="space-y-3 sm:col-span-2">
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
                  {geoState === "locating" ? "Locating..." : "Use precise location"}
                </button>
                {geo && (
                  <span className="ms-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:ms-3">
                    Location pinned ({geo.lat.toFixed(4)}, {geo.lng.toFixed(4)})
                  </span>
                )}
                {geoState === "error" && (
                  <p className="text-xs font-medium text-red-600">
                    Could not get your location. Check browser permissions or
                    set the pin manually.
                  </p>
                )}
                <div className="space-y-1.5">
                  <LocationMap value={geo} onChange={handlePinChange} />
                  <p className="text-xs text-slate-500">
                    Tap the map or drag the pin to set the exact delivery spot.
                  </p>
                </div>
              </div>
              <label className="text-sm font-semibold text-[color:var(--navy)] sm:col-span-2">
                Delivery area
                <input
                  required
                  className="wizard-input mt-2"
                  placeholder="e.g. West Bay, The Pearl"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                />
              </label>
              <label className="text-sm font-semibold text-[color:var(--navy)] sm:col-span-2">
                Address details
                <textarea
                  required
                  className="wizard-input mt-2 min-h-24 resize-y"
                  placeholder="Building, street, parking or delivery notes"
                  value={addressDetails}
                  onChange={(event) => setAddressDetails(event.target.value)}
                />
              </label>
            </div>
          </section>

          <aside className="glass-panel h-fit rounded-[var(--radius-card)] p-6">
            <h2 className="text-xl font-bold text-[color:var(--navy)]">
              Order summary
            </h2>
            <div className="mt-5 space-y-4">
              {items.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-white/75 p-4"
                >
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[color:var(--navy)]">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                        {formatStorePrice(product.price)}
                      </p>
                    </div>
                    <p className="font-bold text-[color:var(--blue)]">
                      {formatStorePrice(product.price * quantity)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)] text-lg font-bold text-[color:var(--navy)]"
                      onClick={() => updateQuantity(String(product.id), quantity - 1)}
                      aria-label={`Decrease ${product.name} quantity`}
                    >
                      -
                    </button>
                    <span className="min-w-8 text-center text-sm font-bold">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--border)] text-lg font-bold text-[color:var(--navy)]"
                      disabled={quantity >= availableFor(product)}
                      onClick={() => updateQuantity(String(product.id), quantity + 1)}
                      aria-label={`Increase ${product.name} quantity`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-[color:var(--border)] pt-5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[color:var(--muted-foreground)]">
                  Total
                </span>
                <span className="text-2xl font-bold text-[color:var(--navy)]">
                  {formatStorePrice(subtotal)}
                </span>
              </div>
              <button
                type="submit"
                className="primary-button mt-6 w-full disabled:cursor-not-allowed disabled:opacity-50"
                disabled={submitting || !customer}
              >
                {submitting ? submitLabel : "Place order"}
              </button>
              {error && (
                <p role="alert" className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
              <Link href="/store" className="secondary-button mt-3 w-full">
                Back to store
              </Link>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
