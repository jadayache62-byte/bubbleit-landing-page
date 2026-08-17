"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AppToast } from "@/components/AppToast";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { ServiceZoneChargeNotice } from "@/components/ServiceZoneChargeNotice";
import {
  ApiError,
  createStoreOrder,
  getPaymentOptions,
  listAddresses,
  listStoreProducts,
  me,
  payStoreOrder,
  reconcileStoreOrderPayment,
  validateServiceArea,
} from "@/lib/api/client";
import type {
  CreateStoreOrderPayload,
  Address,
  Customer,
  StoreOrder,
  StorePricingConfirmation,
  StoreProductInventory,
  PaymentChannel,
  PaymentOptions,
} from "@/lib/api/types";
import { PaymentMethodSelector } from "@/components/payments/PaymentMethodSelector";
import { usableCheckoutUrl } from "@/lib/booking/payment-flow";
import { localized, useI18n } from "@/lib/i18n";
import { formatStorePrice } from "@/lib/store/products";
import {
  clearCompletedStoreCheckout,
  releasePendingStoreCheckout,
  STORE_CART_KEY,
  STORE_CHECKOUT_ATTEMPT_KEY,
  STORE_PENDING_CHECKOUT_KEY,
} from "@/lib/store/checkout-state";

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

type Cart = Record<string, number>;
type PendingCheckout = {
  order: StoreOrder;
  cart: Cart;
  customerId: number;
  orderKey: string;
  paymentKey: string;
};

type CheckoutAttempt = Pick<PendingCheckout, "orderKey" | "paymentKey"> & { fingerprint: string };
type PaymentInitializationOutcome = "completed" | "redirecting" | "retryable";
type CheckoutStep = "location" | "contact" | "review";

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
    const raw = window.localStorage.getItem(STORE_CART_KEY);
    return raw ? (JSON.parse(raw) as Cart) : {};
  } catch {
    return {};
  }
}

function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_PENDING_CHECKOUT_KEY);
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
    window.localStorage.setItem(STORE_PENDING_CHECKOUT_KEY, JSON.stringify(pending));
  } catch {
    // The in-memory checkout state still prevents a duplicate order this visit.
  }
}

function clearPendingCheckoutStorage() {
  try {
    window.localStorage.removeItem(STORE_PENDING_CHECKOUT_KEY);
    window.localStorage.removeItem(STORE_CHECKOUT_ATTEMPT_KEY);
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
    const saved = JSON.parse(window.localStorage.getItem(STORE_CHECKOUT_ATTEMPT_KEY) ?? "null") as Partial<CheckoutAttempt> | null;
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
    window.localStorage.setItem(STORE_CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt));
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
    !["store-cart-pricing:v1", "store-cart-pricing:v2"].includes(candidate.schema ?? "") ||
    candidate.currency !== "QAR" ||
    typeof candidate.version !== "string" ||
    !Array.isArray(candidate.lines) ||
    !Number.isInteger(candidate.subtotal_minor) ||
    !Number.isInteger(candidate.delivery_fee_minor) ||
    !Number.isInteger(candidate.total_minor)
  ) return null;
  if (
    candidate.schema === "store-cart-pricing:v2" &&
    (
      !Number.isInteger(candidate.product_subtotal_minor) ||
      !Number.isInteger(candidate.base_delivery_fee_minor) ||
      !Number.isInteger(candidate.service_zone_rate_minor) ||
      !Number.isInteger(candidate.combined_delivery_minor) ||
      !Number.isInteger(candidate.dispatch_zone_id) ||
      !Number.isInteger(candidate.dispatch_zone_version) ||
      typeof candidate.dispatch_zone_token !== "string"
    )
  ) return null;

  return candidate as StorePricingConfirmation;
}

export function StoreCheckoutClient() {
  const { lang, t } = useI18n();
  const topRef = useRef<HTMLDivElement | null>(null);
  const checkoutInFlightRef = useRef(false);
  const pendingCheckoutRef = useRef<PendingCheckout | null>(null);
  const locationTouchedRef = useRef(false);
  const savedLocationAppliedRef = useRef(false);
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
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
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
  const [serviceZoneRate, setServiceZoneRate] = useState<number | null>(null);
  const [completedOrder, setCompletedOrder] = useState<StoreOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [products, setProducts] = useState<StoreProductInventory[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [step, setStep] = useState<CheckoutStep>("location");
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions | null>(null);
  const [paymentChannel, setPaymentChannel] = useState<PaymentChannel>("skipcash_hosted");

  const applySavedAddress = useCallback((address: Address) => {
    setSelectedAddressId(address.id);
    setArea(address.area ?? "");
    setBuildingNumber(address.building_number ?? "");
    setZoneNumber(address.zone_number ?? "");
    setStreetNumber(address.street_number ?? "");
    setAddressDetails(address.details ?? "");
    setGeo(
      typeof address.latitude === "number" && typeof address.longitude === "number"
        ? { lat: address.latitude, lng: address.longitude }
        : null,
    );
    setPricingReview(null);
    setServiceZoneRate(null);
    setGeoState("idle");
    savedLocationAppliedRef.current = true;
  }, []);

  const markLocationManual = useCallback(() => {
    locationTouchedRef.current = true;
    setSelectedAddressId(null);
  }, []);

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
      setPricingReview(null);
      setServiceZoneRate(null);
      setSavedAddresses([]);
      setSelectedAddressId(null);
      locationTouchedRef.current = false;
      savedLocationAppliedRef.current = false;
      setPaymentNotice(null);
      setStep("location");
      return;
    }

    // Authentication is a gate, not a destination. Once the customer is
    // known, continue directly to review instead of showing a redundant
    // signed-in-account confirmation screen.
    setStep((current) => current === "contact" ? "review" : current);
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
      savedLocationAppliedRef.current = true;
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
      setServiceZoneRate(pending.order.service_zone_rate ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!geo) return;
    if (step !== "location" || pendingCheckout) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      validateServiceArea(geo.lat, geo.lng)
        .then((snapshot) => {
          if (!cancelled) {
            setServiceZoneRate(
              snapshot.dispatch_zone.rate_applied
                ? snapshot.dispatch_zone.service_rate
                : 0,
            );
          }
        })
        .catch(() => {
          if (!cancelled) setServiceZoneRate(null);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [geo, pendingCheckout, step]);

  useEffect(() => {
    let cancelled = false;
    getPaymentOptions()
      .then((options) => {
        if (!cancelled) {
          setPaymentOptions(options);
          if (options.mode === "online" && options.methods[0]) {
            setPaymentChannel(options.methods[0].channel);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPaymentOptions({
            mode: "online",
            methods: [
              { channel: "skipcash_hosted", label: "Card or Apple Pay" },
              { channel: "skipcash_qpay", label: "Direct Debit Card (QPAY)" },
            ],
          });
        }
      });
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
    if (!customer) return;

    let cancelled = false;
    listAddresses()
      .then((addresses) => {
        if (cancelled) return;
        setSavedAddresses(addresses);

        if (
          addresses.length > 0 &&
          !pendingCheckoutRef.current &&
          !locationTouchedRef.current &&
          !savedLocationAppliedRef.current
        ) {
          const preferred = addresses.find(
            (address) =>
              typeof address.latitude === "number" &&
              typeof address.longitude === "number",
          ) ?? addresses[0];
          applySavedAddress(preferred);
        }
      })
      .catch(() => {
        if (!cancelled) setSavedAddresses([]);
      });

    return () => {
      cancelled = true;
    };
  }, [applySavedAddress, customer]);

  const pendingOrderId = pendingCheckout?.order.id ?? null;
  useEffect(() => {
    if (!customer || pendingOrderId === null) return;
    let cancelled = false;

    reconcileStoreOrderPayment(pendingOrderId)
      .then((order) => {
        if (cancelled) return;
        if (isCompletedOrder(order)) {
          clearCompletedStoreCheckout(order.id);
          setCart({});
          pendingCheckoutRef.current = null;
          setPendingCheckout(null);
          setCompletedOrder(order);
          setPaymentNotice(null);
          setSubmitted(true);
          return;
        }
        if (order.status === "cancelled" || order.status === "refunded") {
          releasePendingStoreCheckout(order.id);
          pendingCheckoutRef.current = null;
          setPendingCheckout(null);
          setPaymentNotice(t("The unpaid order reservation ended. Your products are still in the cart so you can check out again."));
          return;
        }

        const current = pendingCheckoutRef.current;
        if (current?.order.id === order.id) {
          const terminalAttempt = ["failed", "retryable", "cancelled", "timed_out"].includes(
            order.payment?.status ?? (order.payment_status === "failed" ? "failed" : "pending"),
          );
          const refreshed = {
            ...current,
            order,
            paymentKey: terminalAttempt
              ? randomAttemptKey(`store-order:${order.id}:payment`)
              : current.paymentKey,
          };
          pendingCheckoutRef.current = refreshed;
          setPendingCheckout(refreshed);
          writePendingCheckout(refreshed);
          if (terminalAttempt) {
            setPaymentNotice(t("Payment failed. Your purchase is saved and you can try again."));
          }
        }
      })
      .catch(() => {
        // Keep the local recovery record. The customer can retry explicitly.
      });

    return () => {
      cancelled = true;
    };
  }, [customer, pendingOrderId, t]);

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

  useEffect(() => {
    const restoreAfterProviderNavigation = (event: PageTransitionEvent) => {
      if (!event.persisted) return;

      checkoutInFlightRef.current = false;
      setSubmitting(false);
      setSubmitPhase("idle");
    };

    window.addEventListener("pageshow", restoreAfterProviderNavigation);
    return () => window.removeEventListener("pageshow", restoreAfterProviderNavigation);
  }, []);

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
  const previewZoneRateMinor = minorUnits(serviceZoneRate ?? 0);
  const displayedZoneRateMinor = pricingReview?.service_zone_rate_minor
    ?? previewZoneRateMinor;
  const displayedBaseDeliveryMinor = pricingReview?.base_delivery_fee_minor
    ?? catalogPricing.delivery_fee_minor;
  const displayedTotalMinor = pricingReview?.total_minor
    ?? catalogPricing.total_minor + previewZoneRateMinor;

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

    markLocationManual();
    setPricingReview(null);
    setServiceZoneRate(null);
    setGeo(value);
    setGeoState("idle");
    reverseGeocode(value.lat, value.lng);
  }

  function requestLocation() {
    if (pendingCheckout) return;

    markLocationManual();
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
        setPricingReview(null);
        setServiceZoneRate(null);
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
      window.localStorage.removeItem(STORE_CART_KEY);
      window.localStorage.removeItem(STORE_PENDING_CHECKOUT_KEY);
      window.localStorage.removeItem(STORE_CHECKOUT_ATTEMPT_KEY);
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

  async function initializePayment(checkout: PendingCheckout): Promise<PaymentInitializationOutcome> {
    if (isCompletedOrder(checkout.order)) {
      completeOrder(checkout.order);
      return "completed";
    }

    setSubmitPhase("initializing_payment");
    setError(null);
    setPaymentNotice(null);

    try {
      const payment = await payStoreOrder(
        checkout.order.id,
        checkout.paymentKey,
        paymentOptions?.mode === "online" ? paymentChannel : undefined,
      );
      if (payment.status === "cash_due") {
        const order = await reconcileStoreOrderPayment(checkout.order.id);
        completeOrder(order);
        return "completed";
      }
      if (payment.status === "paid") {
        const order = await reconcileStoreOrderPayment(checkout.order.id);
        if (isCompletedOrder(order)) {
          completeOrder(order);
          return "completed";
        }
      }
      const checkoutUrl = usableCheckoutUrl(payment.checkout_url);
      if (checkoutUrl) {
        setSubmitPhase("redirecting");
        window.location.assign(checkoutUrl);
        return "redirecting";
      }

      setPaymentNotice(
        t("Payment could not start because no checkout link was returned. Please retry payment."),
      );
      return "retryable";
    } catch (caught) {
      setPaymentNotice(
        `${t("Payment could not start. Your order is saved; please retry payment.")}${caught instanceof ApiError && caught.requestId ? ` ${t("Reference")}: ${caught.requestId}.` : ""}`,
      );
      return "retryable";
    }
  }

  async function retryPayment() {
    if (checkoutInFlightRef.current || !pendingCheckout) return;

    checkoutInFlightRef.current = true;
    setSubmitting(true);
    let redirecting = false;
    try {
      redirecting = await initializePayment(pendingCheckout) === "redirecting";
    } finally {
      if (!redirecting) {
        setSubmitting(false);
        setSubmitPhase("idle");
        checkoutInFlightRef.current = false;
      }
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
    let redirecting = false;
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
        dispatch_zone_version: serviceArea.dispatch_zone.version,
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
        throw new Error(t("The created order does not match the price you confirmed."));
      }
      const checkout = savePendingCheckout(order, attempt, customer.id);

      if (isCompletedOrder(order)) {
        completeOrder(order);
        return;
      }

      redirecting = await initializePayment(checkout) === "redirecting";
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "STORE_PRICING_CHANGED") {
        const updatedPricing = pricingFromConflict(caught.data);
        if (updatedPricing) {
          setPricingReview(updatedPricing);
          setServiceZoneRate((updatedPricing.service_zone_rate_minor ?? 0) / 100);
          setError(t("The store total changed. Review the updated prices and confirm again to continue to payment."));
          setStep("review");
          return;
        }
      }
      setError(
        `${t("Could not place the order. Please try again.")}${caught instanceof ApiError && caught.requestId ? ` ${t("Reference")}: ${caught.requestId}.` : ""}`,
      );
    } finally {
      if (!redirecting) {
        setSubmitting(false);
        setSubmitPhase("idle");
        checkoutInFlightRef.current = false;
      }
    }
  }

  const submitLabel =
    submitPhase === "creating"
      ? t("Creating order…")
      : submitPhase === "initializing_payment"
        ? t("Starting payment…")
        : submitPhase === "redirecting"
          ? t("Redirecting to secure payment…")
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
            {completedOrder?.payment_method === "cash"
              ? t("Your order is confirmed for delivery. Pay the full amount in cash when the team arrives.")
              : t("Your Bubbleit store order has been captured. The team will contact you to confirm delivery and payment details.")}
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
  const steps: ReadonlyArray<{ id: CheckoutStep; label: string }> = customer
    ? [
        { id: "location", label: "Location" },
        { id: "review", label: "Review" },
      ]
    : [
        { id: "location", label: "Location" },
        { id: "contact", label: "Contact" },
        { id: "review", label: "Review" },
      ];
  const currentStep = Math.max(0, steps.findIndex((item) => item.id === step));
  let stepProgressLabel: string;
  if (steps.length === 2) {
    stepProgressLabel = step === "location" ? t("Step 1 of 2") : t("Step 2 of 2");
  } else if (step === "location") {
    stepProgressLabel = t("Step 1 of 3");
  } else {
    stepProgressLabel = step === "contact" ? t("Step 2 of 3") : t("Step 3 of 3");
  }

  function advanceCheckoutStep() {
    setError(null);
    if (step === "location") {
      setStep(customer ? "review" : "contact");
      return;
    }

    setStep("review");
  }

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
            <span className="text-sm font-bold text-[color:var(--navy)]">{formatStorePrice(displayedTotalMinor / 100, lang)}</span>
          </div>

          <nav className={customer ? "mb-7 grid grid-cols-2 gap-2" : "mb-7 grid grid-cols-3 gap-2"} aria-label={t("Checkout progress")}>
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
            {step !== "review" && (
              <section
                className="commerce-card mb-4 p-5 sm:p-7"
                aria-labelledby="checkout-order-summary-title"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2
                    id="checkout-order-summary-title"
                    className="text-lg font-bold text-[color:var(--navy)]"
                  >
                    {t("Order summary")}
                  </h2>
                  <span className="shrink-0 text-lg font-extrabold text-[color:var(--navy)]">
                    {formatStorePrice(displayedTotalMinor / 100, lang)}
                  </span>
                </div>
                <div className="mt-3 divide-y divide-slate-100">
                  {reviewedPricing.lines.map((line) => {
                    const product = products.find((candidate) => candidate.id === line.product_id);
                    const lineName = product
                      ? localized(lang, product.name, product.name_ar)
                      : line.name ?? t("Store product");
                    const lineTotal = line.line_total_minor ?? line.unit_price_minor * line.quantity;

                    return (
                      <div
                        key={String(line.product_id)}
                        className="flex items-center justify-between gap-4 py-2 text-sm"
                      >
                        <p className="min-w-0 truncate font-semibold">
                          {lineName} <span className="text-[color:var(--muted-foreground)]">× {line.quantity}</span>
                        </p>
                        <span className="shrink-0 font-bold">
                          {formatStorePrice(lineTotal / 100, lang)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {step === "location" && (
              <section className="commerce-card overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{stepProgressLabel}</span>
                  <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Where should we deliver?")}</h1>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Pin the exact location, then add the building details.")}</p>
                </div>
                <div className="space-y-4 p-4 sm:p-7">
                  {savedAddresses.length > 0 && (
                    <section
                      aria-labelledby="store-saved-location-title"
                      className="rounded-2xl border border-[color:var(--border)] bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h2 id="store-saved-location-title" className="text-sm font-bold text-[color:var(--navy)]">
                            {t("Use a saved location")}
                          </h2>
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {t("Pick one and continue without entering the Blue plate again.")}
                          </p>
                        </div>
                        <Link
                          href="/account/locations"
                          className="min-h-11 shrink-0 rounded-full px-3 py-3 text-xs font-bold text-[color:var(--blue)]"
                        >
                          {t("Manage")}
                        </Link>
                      </div>
                      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                        {savedAddresses.map((address) => {
                          const active = selectedAddressId === address.id;
                          return (
                            <button
                              key={address.id}
                              type="button"
                              disabled={checkoutLocked}
                              aria-pressed={active}
                              onClick={() => {
                                locationTouchedRef.current = true;
                                applySavedAddress(address);
                              }}
                              className={`min-w-[14rem] rounded-2xl border p-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] focus-visible:ring-offset-2 disabled:opacity-60 ${
                                active
                                  ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                                  : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]"
                              }`}
                            >
                              <span className="block text-sm font-extrabold">
                                {address.label || t("Saved location")}
                              </span>
                              <span className={`mt-1 block text-xs font-semibold ${active ? "text-white/75" : "text-[color:var(--muted-foreground)]"}`}>
                                {t("Building")} {address.building_number || "—"}
                                {address.zone_number ? ` · ${t("Zone")} ${address.zone_number}` : ""}
                                {address.street_number ? ` · ${t("Street")} ${address.street_number}` : ""}
                              </span>
                              <span className={`mt-1 block truncate text-xs ${active ? "text-white/70" : "text-[color:var(--muted-foreground)]"}`}>
                                {address.area}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  <div className="overflow-hidden rounded-2xl">
                    <LocationMap value={geo} onChange={handlePinChange} />
                  </div>
                  <ServiceZoneChargeNotice rate={serviceZoneRate} />
                  <button type="button" className="secondary-button w-full gap-2" disabled={geoState === "locating" || checkoutLocked} onClick={requestLocation}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none"><path d="M12 20s5.25-5.13 5.25-9a5.25 5.25 0 1 0-10.5 0c0 3.87 5.25 9 5.25 9Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="11" r="1.9" fill="currentColor"/></svg>
                    {geoState === "locating" ? t("Finding your location…") : geo ? t("Update precise location") : t("Use my precise location")}
                  </button>
                  {geo && <p className="text-center text-xs font-semibold text-emerald-700">{t("Location pinned successfully")}</p>}
                  {geoState === "error" && (
                    <AppToast
                      message={t("Location access failed. Tap the map to place the pin manually.")}
                      dismissLabel={t("Dismiss message")}
                      onDismiss={() => setGeoState("idle")}
                    />
                  )}
                  <div className="rounded-3xl border border-[color:var(--border)] bg-white p-3 shadow-sm sm:p-4">
                    <p className="mb-3 text-sm font-bold text-[color:var(--navy)]">{t("Blue plate")}</p>
                    <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-center text-white">
                      <span className="block text-sm font-bold">{t("Building No.")} <span aria-hidden="true">*</span></span>
                      <input className="mt-1 w-full bg-transparent text-center text-4xl font-bold outline-none placeholder:text-white/45 disabled:opacity-60" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={buildingNumber} disabled={checkoutLocked} onChange={(event) => { markLocationManual(); setBuildingNumber(event.target.value.replace(/\D/g, "").slice(0, 6)); }} required />
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-white">
                        <span className="block text-sm font-bold">{t("Zone No.")}</span>
                        <input className="mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-white/35 disabled:opacity-60" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={zoneNumber} disabled={checkoutLocked} onChange={(event) => { markLocationManual(); setZoneNumber(event.target.value.replace(/\D/g, "").slice(0, 3)); }} />
                      </label>
                      <label className="block rounded-2xl bg-[color:var(--navy)] px-4 py-4 text-white">
                        <span className="block text-sm font-bold">{t("Street No.")}</span>
                        <input className="mt-1 w-full bg-transparent text-3xl font-bold outline-none placeholder:text-white/35 disabled:opacity-60" inputMode="numeric" pattern="[0-9]*" placeholder="000" value={streetNumber} disabled={checkoutLocked} onChange={(event) => { markLocationManual(); setStreetNumber(event.target.value.replace(/\D/g, "").slice(0, 4)); }} />
                      </label>
                    </div>
                  </div>
                  <label className="block text-sm font-semibold text-[color:var(--navy)]">{t("Area / neighborhood")}
                    <input className="wizard-input mt-2 min-h-12" placeholder={t("e.g. West Bay, The Pearl")} value={area} disabled={checkoutLocked} onChange={(event) => { markLocationManual(); setArea(event.target.value); }} />
                  </label>
                  <label className="block text-sm font-semibold text-[color:var(--navy)]">{t("Extra details")}
                    <textarea className="wizard-input mt-2 min-h-20 resize-none" placeholder={t("Flat, floor, gate, parking level")} value={addressDetails} disabled={checkoutLocked} onChange={(event) => { markLocationManual(); setAddressDetails(event.target.value); }} />
                  </label>
                </div>
              </section>
            )}

            {step === "contact" && !customer && (
              <section className="commerce-card p-5 sm:p-7">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{stepProgressLabel}</span>
                <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Verify your account")}</h1>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Store checkout requires a signed-in customer account. Your cart stays here while you sign in or verify a new account by OTP.")}</p>

                {!authChecked ? (
                  <div className="mt-6 h-28 animate-pulse rounded-2xl bg-slate-100" />
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
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{stepProgressLabel}</span>
                  <h1 className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Review your order")}</h1>
                  <div className="mt-5 divide-y divide-slate-100">
                    {reviewedPricing.lines.map((line) => (
                      <div key={String(line.product_id)} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0"><p className="truncate text-sm font-bold">{(() => { const product = products.find((candidate) => candidate.id === line.product_id); return product ? localized(lang, product.name, product.name_ar) : line.name ?? t("Store product"); })()}</p><p className="text-xs text-[color:var(--muted-foreground)]">{t("Qty")} {line.quantity} × {formatStorePrice(line.unit_price_minor / 100, lang)}</p></div>
                        <span className="shrink-0 text-sm font-bold">{formatStorePrice((line.line_total_minor ?? line.unit_price_minor * line.quantity) / 100, lang)}</span>
                      </div>
                    ))}
                  </div>
                  {displayedBaseDeliveryMinor > 0 && <div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm"><span>{t("Delivery fee")}</span><span className="font-bold">{formatStorePrice(displayedBaseDeliveryMinor / 100, lang)}</span></div>}
                  {displayedZoneRateMinor > 0 && <div className="flex items-center justify-between border-t border-slate-100 py-3 text-sm"><span>{t("Additional service-zone charge")}</span><span className="font-bold">{formatStorePrice(displayedZoneRateMinor / 100, lang)}</span></div>}
                  <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-semibold">{t("Total")}</span><span className="text-2xl font-extrabold text-[color:var(--navy)]">{formatStorePrice(displayedTotalMinor / 100, lang)}</span></div>
                  <div className="mt-4">
                    <ServiceZoneChargeNotice rate={displayedZoneRateMinor / 100} compact />
                  </div>
                  {pricingReview && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{t("Pricing changed since your first review. This updated QAR total must be confirmed before payment starts.")}</p>}
                </section>

                <section className="commerce-card divide-y divide-slate-100 px-5 sm:px-7">
                  <div className="flex items-start justify-between gap-4 py-4"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{t("Deliver to")}</p><p className="mt-1 text-sm font-semibold">{t("Building")} <bdi>{buildingNumber}</bdi>{zoneNumber ? ` · ${t("Zone")} ${zoneNumber}` : ""}{streetNumber ? ` · ${t("Street")} ${streetNumber}` : ""}{area ? ` · ${area}` : ""}</p></div><button type="button" className="min-h-11 text-sm font-bold text-[color:var(--blue)]" onClick={() => setStep("location")}>{t("Edit")}</button></div>
                  <div className="py-4"><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{t("Account owner")}</p><p className="mt-1 text-sm font-semibold">{customer?.name || t("Bubbleit customer")} · <span dir="ltr">{customer?.phone}</span></p></div>
                </section>

                <section className="commerce-card p-5 sm:p-7">
                  <PaymentMethodSelector
                    options={paymentOptions}
                    value={paymentChannel}
                    onChange={setPaymentChannel}
                  />
                </section>

                {pendingCheckout && submitPhase === "redirecting" ? (
                  <p role="status" aria-live="polite" className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">
                    <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-[color:var(--blue)] motion-reduce:animate-none" aria-hidden="true" />
                    {t("Redirecting to secure payment…")}
                  </p>
                ) : pendingCheckout ? (
                  <p role={paymentNotice ? "alert" : "status"} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{t("Order")} {pendingCheckout.order.reference} {t("is saved.")} {paymentNotice ?? t("Retry payment to continue.")}</p>
                ) : null}
                {error && <AppToast message={error} dismissLabel={t("Dismiss message")} onDismiss={() => setError(null)} />}
                <button type="submit" className="primary-button min-h-14 w-full text-base disabled:opacity-50" disabled={submitting}>{submitLabel}</button>
                <p className="text-center text-xs text-[color:var(--muted-foreground)]">{t("By placing your order, you confirm the delivery and contact details above.")}</p>
              </form>
            )}
          </div>

          {step !== "review" && (
            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/96 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(38,34,98,0.1)]">
              <div className="mx-auto flex max-w-3xl gap-2">
                {step === "contact" && <button type="button" className="secondary-button min-h-14 px-5" onClick={() => setStep("location")}>{t("Back")}</button>}
                <button type="button" className="primary-button min-h-14 flex-1 text-base disabled:opacity-40" disabled={step === "location" ? !locationValid || !authChecked : !contactValid} onClick={advanceCheckoutStep}>
                  {step === "location" && !customer ? t("Continue to contact") : t("Review order")} <span className="ms-2 rtl:rotate-180" aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
