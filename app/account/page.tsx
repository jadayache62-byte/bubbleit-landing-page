"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { HourSlotPicker } from "@/components/booking/HourSlotPicker";
import { CustomerNotifications } from "@/components/account/CustomerNotifications";
import { useI18n } from "@/lib/i18n";
import { formatQar } from "@/lib/money";
import {
  ApiError,
  cancelBooking,
  cancelCashMembership,
  cancelStoreOrder,
  deleteVehicle,
  getBookingRescheduleOptions,
  initializeBookingPayment,
  listAddresses,
  listBookings,
  listMemberships,
  listStoreOrders,
  listVehicles,
  logout,
  me,
  payStoreOrder,
  reconcileBookingPayment,
  reconcileMembershipPayment,
  reconcileStoreOrderPayment,
  rescheduleBooking,
  resolveCustomerNotification,
} from "@/lib/api/client";
import { detachCurrentPushDevice } from "@/lib/notifications/browser";
import type {
  Booking,
  BookingStatus,
  BookingRescheduleOptions,
  Address,
  Customer,
  CustomerMembership,
  PaymentState,
  StoreOrder,
  Vehicle,
  VehicleType,
} from "@/lib/api/types";
import { formatQatarDateTime, nextQatarDays, qatarServiceDate, serializeQatarBookingDateTime } from "@/lib/datetime";
import { usableCheckoutUrl } from "@/lib/booking/payment-flow";
import { clearCompletedStoreCheckout, releasePendingStoreCheckout } from "@/lib/store/checkout-state";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  assigned: "bg-sky-100 text-sky-700",
  driver_accepted: "bg-sky-100 text-sky-700",
  phone_confirmed: "bg-sky-100 text-sky-700",
  in_progress: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  refund_requested: "bg-amber-100 text-amber-700",
  cancelled_by_customer: "bg-red-100 text-red-600",
  cancelled_by_admin: "bg-red-100 text-red-600",
  no_show: "bg-gray-200 text-gray-600",
};

const CANCELLABLE: BookingStatus[] = ["pending_payment", "paid", "assigned"];
const ACCOUNT_TABS = ["overview", "bookings", "orders", "memberships", "vehicles", "notifications"] as const;

type PaymentFeedback = {
  tone: "success" | "warning" | "danger" | "info";
  message: string;
};

const TERMINAL_PAYMENT_STATES = new Set<PaymentState["status"]>([
  "cash_due",
  "paid",
  "partially_refunded",
  "refunded",
  "reconciliation_required",
  "failed",
  "retryable",
  "cancelled",
  "timed_out",
]);

function paymentFeedback(status: PaymentState["status"], t: (key: string) => string): PaymentFeedback {
  if (status === "cash_due") {
    return { tone: "warning", message: t("Cash is due. Your purchase can proceed and will update after an authorized team member records the full payment.") };
  }
  if (status === "paid") {
    return { tone: "success", message: t("Payment successful. Your purchase is confirmed.") };
  }
  if (status === "failed" || status === "retryable") {
    return { tone: "danger", message: t("Payment failed. Your purchase is saved and you can try again.") };
  }
  if (status === "cancelled") {
    return { tone: "warning", message: t("Payment was cancelled. Your purchase has not been charged.") };
  }
  if (status === "timed_out") {
    return { tone: "warning", message: t("Payment timed out. Check the status below before trying again.") };
  }
  if (status === "reconciliation_required") {
    return { tone: "warning", message: t("Payment is under review. We will update this purchase once it is confirmed.") };
  }
  if (status === "partially_refunded") {
    return { tone: "info", message: t("This payment was partially refunded.") };
  }
  if (status === "refunded") {
    return { tone: "info", message: t("This payment was refunded.") };
  }
  return { tone: "info", message: t("Payment is processing. This page will update when confirmation arrives.") };
}

function waitForPaymentUpdate(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  sedan: "Salon / Sedan",
  suv: "SUV / 4-Wheel",
  caravan: "Caravan",
  jet_ski: "Jet Ski",
  jet_boat: "Jet Boat",
  truck: "Truck",
  van: "Van",
  other: "Other",
};

export default function AccountPage() {
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checked, setChecked] = useState(false);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [memberships, setMemberships] = useState<CustomerMembership[] | null>(null);
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [tab, setTab] = useState<(typeof ACCOUNT_TABS)[number]>("overview");
  const [error, setError] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<PaymentFeedback | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [paymentAction, setPaymentAction] = useState<string | null>(null);
  const rescheduleDialogRef = useRef<HTMLElement>(null);
  const rescheduleCloseRef = useRef<HTMLButtonElement>(null);
  const [reschedule, setReschedule] = useState<{
    booking: Booking;
    date: string;
    days: ReturnType<typeof nextQatarDays>;
    options: BookingRescheduleOptions | null;
    slot: string | null;
    key: string;
    busy: boolean;
    error: string | null;
  } | null>(null);
  const rescheduleOpen = Boolean(reschedule);
  // Reference "now" captured when reschedule slots load, used to hide today's past slots.
  const [rescheduleNowMs, setRescheduleNowMs] = useState(0);

  useEffect(() => {
    if (!rescheduleOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        // An open hour popover consumes Escape first (HourSlotPicker closes it).
        if (rescheduleDialogRef.current?.querySelector('[role="listbox"]')) return;
        event.preventDefault();
        setReschedule(null);
        return;
      }
      if (event.key !== "Tab" || !rescheduleDialogRef.current) return;
      const controls = [...rescheduleDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )];
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => rescheduleCloseRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [rescheduleOpen]);

  const refresh = useCallback(() => {
    listBookings().then(setBookings).catch(() => setBookings([]));
    listVehicles().then(setVehicles).catch(() => setVehicles([]));
    listAddresses().then(setAddresses).catch(() => setAddresses([]));
    listMemberships().then(setMemberships).catch(() => setMemberships([]));
    listStoreOrders().then(setOrders).catch(() => setOrders([]));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setSessionEnded(new URLSearchParams(window.location.search).get("session") === "expired");
    });
    me()
      .then((c) => {
        setCustomer(c);
        refresh();
      })
      .catch(() => setCustomer(null))
      .finally(() => setChecked(true));
  }, [refresh]);

  useEffect(() => {
    for (const order of orders ?? []) {
      if (order.payment?.captured || order.payment_status === "paid") {
        clearCompletedStoreCheckout(order.id);
      } else if (order.status === "cancelled" || order.status === "refunded") {
        releasePendingStoreCheckout(order.id);
      }
    }
  }, [orders]);

  useEffect(() => {
    function handleSessionEnded() {
      setCustomer(null);
      setBookings(null);
      setVehicles(null);
      setAddresses(null);
      setMemberships(null);
      setOrders(null);
      setPaymentNotice(null);
      setSessionEnded(true);
    }

    window.addEventListener("bubbleit:session-ended", handleSessionEnded);
    return () => window.removeEventListener("bubbleit:session-ended", handleSessionEnded);
  }, []);

  useEffect(() => {
    if (!customer) return;
    const parameters = new URLSearchParams(window.location.search);
    const notificationId = Number.parseInt(parameters.get("notification") ?? "", 10);
    if (Number.isSafeInteger(notificationId) && notificationId > 0) {
      resolveCustomerNotification(notificationId)
        .then(({ path }) => window.location.replace(path))
        .catch((caught) => setError(caught instanceof ApiError ? caught.message : t("This notification is no longer available.")));
      return;
    }
    const requestedTab = parameters.get("tab");
    if (ACCOUNT_TABS.includes(requestedTab as (typeof ACCOUNT_TABS)[number])) {
      queueMicrotask(() => setTab(requestedTab as (typeof ACCOUNT_TABS)[number]));
    }
  }, [customer, t]);

  useEffect(() => {
    if (!customer) return;
    const parameters = new URLSearchParams(window.location.search);
    if (!parameters.has("payment")) return;

    const bookingId = Number.parseInt(parameters.get("booking") ?? "", 10);
    const orderId = Number.parseInt(parameters.get("order") ?? "", 10);
    const membershipId = Number.parseInt(parameters.get("membership") ?? "", 10);
    const hasBooking = Number.isSafeInteger(bookingId) && bookingId > 0;
    const hasOrder = Number.isSafeInteger(orderId) && orderId > 0;
    const hasMembership = Number.isSafeInteger(membershipId) && membershipId > 0;
    if (!hasBooking && !hasOrder && !hasMembership) return;

    let active = true;
    queueMicrotask(() => {
      if (active) setPaymentNotice(paymentFeedback("pending", t));
    });

    async function checkPayment() {
      try {
        for (let attempt = 0; active && attempt < 8; attempt += 1) {
          let state: PaymentState["status"] = "pending";

          if (hasBooking) {
            const booking = await reconcileBookingPayment(bookingId);
            if (!active) return;
            setBookings((current) => current?.map((item) => item.id === booking.id ? booking : item) ?? [booking]);
            state = booking.payment?.captured || booking.status === "paid"
              ? "paid"
              : (booking.payment?.status ?? "pending");
          } else if (hasOrder) {
            const order = await reconcileStoreOrderPayment(orderId);
            if (!active) return;
            setOrders((current) => current?.map((item) => item.id === order.id ? order : item) ?? [order]);
            state = order.payment?.captured || order.payment_status === "paid"
              ? "paid"
              : (order.payment?.status ?? (order.payment_status === "failed" ? "failed" : "pending"));
            if (state === "paid") clearCompletedStoreCheckout(order.id);
          } else {
            const membership = await reconcileMembershipPayment(membershipId);
            if (!active) return;
            setMemberships((current) => current?.map((item) => item.id === membership.id ? membership : item) ?? [membership]);
            state = membership?.status === "active"
              ? "paid"
              : (membership?.payment?.captured ? "paid" : (membership?.payment?.status ?? "pending"));
          }

          setPaymentNotice(paymentFeedback(state, t));
          if (TERMINAL_PAYMENT_STATES.has(state)) {
            parameters.delete("payment");
            window.history.replaceState(null, "", `${window.location.pathname}?${parameters.toString()}`);
            return;
          }
          if (attempt < 7) await waitForPaymentUpdate(1500);
        }
      } catch (caught) {
        if (!active) return;
        setPaymentNotice({
          tone: "danger",
          message: caught instanceof ApiError
            ? caught.message
            : t("We could not verify the payment yet. Check the purchase status below before trying again."),
        });
      }
    }

    void checkPayment();
    return () => {
      active = false;
    };
  }, [customer, t]);

  async function handleCancel(id: number) {
    if (!window.confirm(t("Cancel this booking?"))) return;
    setError(null);
    try {
      await cancelBooking(id);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not cancel the booking.");
    }
  }

  async function handleCompleteBookingPayment(booking: Booking) {
    const action = `booking:${booking.id}`;
    if (paymentAction) return;
    setPaymentAction(action);
    setError(null);
    try {
      const payment = await initializeBookingPayment(booking.id, `account-booking:${booking.id}:${window.crypto.randomUUID()}`);
      const checkoutUrl = usableCheckoutUrl(payment.checkout_url);
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      const refreshed = await reconcileBookingPayment(booking.id);
      setBookings((current) => current?.map((item) => item.id === refreshed.id ? refreshed : item) ?? [refreshed]);
      setPaymentNotice(paymentFeedback(refreshed.payment?.status ?? (refreshed.status === "paid" ? "paid" : "pending"), t));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("Payment is still unavailable. Your booking remains saved."));
    } finally {
      setPaymentAction(null);
    }
  }

  async function handleCompleteStorePayment(order: StoreOrder) {
    const action = `order:${order.id}`;
    if (paymentAction) return;
    setPaymentAction(action);
    setError(null);
    try {
      const payment = await payStoreOrder(order.id, `account-store:${order.id}:${window.crypto.randomUUID()}`);
      const checkoutUrl = usableCheckoutUrl(payment.checkout_url);
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      const refreshed = await reconcileStoreOrderPayment(order.id);
      setOrders((current) => current?.map((item) => item.id === refreshed.id ? refreshed : item) ?? [refreshed]);
      const status = refreshed.payment?.status ?? (refreshed.payment_status === "paid" ? "paid" : "pending");
      if (status === "paid") clearCompletedStoreCheckout(refreshed.id);
      setPaymentNotice(paymentFeedback(status, t));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("Payment could not start. Your order is saved; please retry payment."));
    } finally {
      setPaymentAction(null);
    }
  }

  async function handleCancelStoreOrder(order: StoreOrder) {
    const action = `cancel-order:${order.id}`;
    if (paymentAction || !window.confirm(t("Cancel this store order?"))) return;
    setPaymentAction(action);
    setError(null);
    try {
      const cancelled = await cancelStoreOrder(order.id);
      setOrders((current) => current?.map((item) => item.id === cancelled.id ? cancelled : item) ?? [cancelled]);
      releasePendingStoreCheckout(cancelled.id);
      setPaymentNotice({
        tone: cancelled.refund ? "info" : "warning",
        message: cancelled.refund
          ? t("Order cancelled. Your full refund request was sent to our team.")
          : t("Order cancelled. You were not charged."),
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("Could not cancel the store order."));
    } finally {
      setPaymentAction(null);
    }
  }

  async function handleCancelCashMembership(membership: CustomerMembership) {
    const action = `cancel-membership:${membership.id}`;
    if (paymentAction || !window.confirm(t("Cancel this unpaid cash membership?"))) return;
    setPaymentAction(action);
    setError(null);
    try {
      const cancelled = await cancelCashMembership(membership.id);
      setMemberships((current) => current?.map((item) => item.id === cancelled.id ? cancelled : item) ?? [cancelled]);
      setPaymentNotice({ tone: "warning", message: t("Membership cancelled. You were not charged.") });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("Could not cancel the membership."));
    } finally {
      setPaymentAction(null);
    }
  }

  async function loadRescheduleOptions(booking: Booking, requestedDate: string, key = window.crypto.randomUUID()) {
    const days = nextQatarDays(7);
    const date = days.some((day) => day.date === requestedDate) ? requestedDate : days[0].date;
    setError(null);
    setReschedule({ booking, date, days, options: null, slot: null, key, busy: true, error: null });
    try {
      const options = await getBookingRescheduleOptions(booking.id, date);
      setRescheduleNowMs(Date.now());
      setReschedule({ booking, date, days, options, slot: null, key, busy: false, error: null });
    } catch (caught) {
      setReschedule({
        booking,
        date,
        days,
        options: null,
        slot: null,
        key,
        busy: false,
        error: caught instanceof ApiError ? caught.message : t("Could not load reschedule options."),
      });
    }
  }

  async function commitReschedule() {
    if (!reschedule?.options || !reschedule.slot) return;
    const selected = reschedule.options.slots.find((slot) => slot.start === reschedule.slot);
    if (!selected) return;
    setReschedule({ ...reschedule, busy: true });
    try {
      await rescheduleBooking(reschedule.booking.id, {
        scheduled_at: serializeQatarBookingDateTime(reschedule.date, selected.start),
        duration_version: reschedule.options.duration.version,
        service_area_version: reschedule.options.service_area.version,
        slot_version: selected.slot_version,
      }, reschedule.key);
      setReschedule(null);
      refresh();
    } catch (caught) {
      setReschedule({
        ...reschedule,
        busy: false,
        error: caught instanceof ApiError ? caught.message : t("Could not reschedule the booking."),
      });
    }
  }

  async function handleRemoveVehicle(id: number) {
    if (!window.confirm(t("Remove this car?"))) return;
    setError(null);
    try {
      await deleteVehicle(id);
      refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove the car.");
    }
  }

  async function handleLogout() {
    await detachCurrentPushDevice().catch(() => undefined);
    await logout();
    setCustomer(null);
    setBookings(null);
    setVehicles(null);
    setAddresses(null);
    setMemberships(null);
    setOrders(null);
    setPaymentNotice(null);
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    current: (typeof ACCOUNT_TABS)[number],
  ) {
    const index = ACCOUNT_TABS.indexOf(current);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % ACCOUNT_TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + ACCOUNT_TABS.length) % ACCOUNT_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ACCOUNT_TABS.length - 1;
    else return;
    event.preventDefault();
    const value = ACCOUNT_TABS[next];
    setTab(value);
    requestAnimationFrame(() => document.getElementById(`account-tab-${value}`)?.focus());
  }

  const activeBookings = (bookings ?? [])
    .filter((booking) => !["completed", "cancelled_by_customer", "cancelled_by_admin", "no_show"].includes(booking.status))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const activeMemberships = (memberships ?? []).filter((membership) => membership.status === "active" && membership.washes_remaining > 0);

  return (
    <>
      <Navbar />
      <main id="main-content" className="section-shell min-h-[60dvh] py-7 sm:py-14">
        {!checked ? (
          <div className="mx-auto max-w-3xl space-y-4" role="status" aria-live="polite" aria-label={t("Loading account…")}>
            <div className="commerce-card h-48 animate-pulse bg-slate-100" />
            <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((item) => <div key={item} className="commerce-card h-24 animate-pulse bg-slate-100" />)}</div>
          </div>
        ) : !customer ? (
          <div className="mx-auto max-w-md">
            {sessionEnded && (
              <p role="alert" className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {t("Your session has ended. Sign in again to continue.")}
              </p>
            )}
            <AuthPanel
              title={t("Welcome back")}
              onAuthed={(c) => {
                const destination = window.sessionStorage.getItem("bubbleit.auth.return_to");
                window.sessionStorage.removeItem("bubbleit.auth.return_to");
                if (destination && !destination.startsWith("/account")) {
                  window.location.assign(destination);
                  return;
                }
                setCustomer(c);
                setSessionEnded(false);
                refresh();
              }}
            />
          </div>
        ) : (
          <>
            <section className="commerce-card overflow-hidden">
              <div className="flex flex-col gap-5 bg-[color:var(--navy)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div className="flex items-center gap-4">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/12 text-xl font-extrabold" aria-hidden="true">{(customer.name?.trim()?.[0] ?? "B").toUpperCase()}</span>
                  <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">{t("My Account")}</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{customer.name ? t("Hi,") + " " + customer.name.split(" ")[0] : t("Welcome back")}</h1><p className="mt-1 text-sm font-medium text-white/70" dir="ltr">{customer.phone}</p></div>
                </div>
                <div className="flex gap-2"><Link href="/book" aria-label={t("Book a new wash")} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-[color:var(--cyan)] px-5 text-sm font-extrabold transition hover:bg-white sm:flex-none" style={{ color: "#262262" }}>{t("Book a Wash")}</Link><button type="button" className="min-h-12 rounded-full border border-white/40 px-4 text-sm font-semibold text-white transition hover:bg-white/10" onClick={handleLogout}>{t("Log out")}</button></div>
              </div>
              <div className="grid grid-cols-4 divide-x divide-slate-200 bg-white">
                <button type="button" aria-label={`${activeBookings.length} ${t("upcoming bookings")}`} onClick={() => setTab("bookings")} className="min-h-20 px-2 py-3 text-center transition hover:bg-slate-50"><span className="block text-xl font-extrabold text-[color:var(--navy)]">{activeBookings.length}</span><span className="mt-1 block text-[11px] font-semibold text-[color:var(--muted-foreground)] sm:text-xs">{t("Upcoming")}</span></button>
                <button type="button" aria-label={`${activeMemberships.length} ${t("active membership plans")}`} onClick={() => setTab("memberships")} className="min-h-20 px-2 py-3 text-center transition hover:bg-slate-50"><span className="block text-xl font-extrabold text-[color:var(--navy)]">{activeMemberships.length}</span><span className="mt-1 block text-[11px] font-semibold text-[color:var(--muted-foreground)] sm:text-xs">{t("Active plans")}</span></button>
                <button type="button" aria-label={`${vehicles?.length ?? 0} ${t("saved vehicles")}`} onClick={() => setTab("vehicles")} className="min-h-20 px-2 py-3 text-center transition hover:bg-slate-50"><span className="block text-xl font-extrabold text-[color:var(--navy)]">{vehicles?.length ?? 0}</span><span className="mt-1 block text-[11px] font-semibold text-[color:var(--muted-foreground)] sm:text-xs">{t("Vehicles")}</span></button>
                <Link href="/account/locations" aria-label={`${addresses?.length ?? 0} ${t("saved locations")}`} className="min-h-20 px-2 py-3 text-center transition hover:bg-slate-50"><span className="block text-xl font-extrabold text-[color:var(--navy)]">{addresses?.length ?? 0}</span><span className="mt-1 block text-[11px] font-semibold text-[color:var(--muted-foreground)] sm:text-xs">{t("Locations")}</span></Link>
              </div>
            </section>

            <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("Quick actions")}>
              <Link href="/book" className="commerce-card flex min-h-24 flex-col justify-between p-3 transition hover:border-[color:var(--blue)] sm:p-4"><svg viewBox="0 0 24 24" className="h-5 w-5 text-[color:var(--blue)]" fill="none" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg><span className="mt-3 text-xs font-bold text-[color:var(--navy)] sm:text-sm">{t("Book a wash")}</span></Link>
              <Link href="/memberships" className="commerce-card flex min-h-24 flex-col justify-between p-3 transition hover:border-[color:var(--blue)] sm:p-4"><svg viewBox="0 0 24 24" className="h-5 w-5 text-[color:var(--blue)]" fill="none" aria-hidden="true"><path d="M4 7h16v12H4zM7 4v6M17 4v6M8 14h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="mt-3 text-xs font-bold text-[color:var(--navy)] sm:text-sm">{t("Get a membership")}</span></Link>
              <Link href="/store" className="commerce-card flex min-h-24 flex-col justify-between p-3 transition hover:border-[color:var(--blue)] sm:p-4"><svg viewBox="0 0 24 24" className="h-5 w-5 text-[color:var(--blue)]" fill="none" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8ZM9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg><span className="mt-3 text-xs font-bold text-[color:var(--navy)] sm:text-sm">{t("Shop products")}</span></Link>
              <Link href="/account/locations" className="commerce-card flex min-h-24 flex-col justify-between p-3 transition hover:border-[color:var(--blue)] sm:p-4"><svg viewBox="0 0 24 24" className="h-5 w-5 text-[color:var(--blue)]" fill="none" aria-hidden="true"><path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="10" r="2" fill="currentColor"/></svg><span className="mt-3 text-xs font-bold text-[color:var(--navy)] sm:text-sm">{t("Manage locations")}</span></Link>
            </section>

            {paymentNotice && (
              <p
                role={paymentNotice.tone === "danger" ? "alert" : "status"}
                aria-live="polite"
                className={clsx(
                  "mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold",
                  paymentNotice.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                  paymentNotice.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900",
                  paymentNotice.tone === "danger" && "border-red-200 bg-red-50 text-red-700",
                  paymentNotice.tone === "info" && "border-sky-200 bg-sky-50 text-sky-900",
                )}
              >
                {paymentNotice.message}
              </p>
            )}
            {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            <div className="mt-7 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 sm:grid-cols-3 lg:grid-cols-6" role="tablist" aria-label={t("Account sections")}>
              {([["overview", t("Overview")], ["bookings", t("Bookings")], ["orders", t("Orders")], ["memberships", t("Memberships")], ["vehicles", t("Vehicles")], ["notifications", t("Notifications")]] as const).map(([value, label]) => <button key={value} id={`account-tab-${value}`} type="button" role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} aria-controls={`account-panel-${value}`} onKeyDown={(event) => handleTabKeyDown(event, value)} onClick={() => setTab(value)} className={clsx("min-h-11 rounded-xl px-3 text-sm font-semibold transition", tab === value ? "bg-[color:var(--navy)] text-white" : "text-[color:var(--muted-foreground)] hover:bg-slate-50 hover:text-[color:var(--navy)]")}>{label}</button>)}
            </div>

            <div key={tab} id={`account-panel-${tab}`} role="tabpanel" aria-labelledby={`account-tab-${tab}`} tabIndex={0} className="checkout-step mt-6 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] focus-visible:ring-offset-4">
              {tab === "overview" && <div className="grid gap-5 lg:grid-cols-2">
                <section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--blue)]">{t("Next up")}</p><h2 className="mt-1 text-xl font-bold">{t("Upcoming booking")}</h2></div><button type="button" aria-label={t("View all bookings")} onClick={() => setTab("bookings")} className="min-h-11 text-sm font-bold text-[color:var(--blue)]">{t("View all")}</button></div>{bookings === null ? <div className="commerce-card h-44 animate-pulse bg-slate-100" /> : activeBookings.length > 0 ? <BookingCard booking={activeBookings[0]} busy={paymentAction === `booking:${activeBookings[0].id}`} onPay={() => handleCompleteBookingPayment(activeBookings[0])} onCancel={() => handleCancel(activeBookings[0].id)} onReschedule={() => loadRescheduleOptions(activeBookings[0], qatarServiceDate(activeBookings[0].scheduled_at))} /> : <EmptyState title={t("No upcoming wash")} copy={t("Choose a service and we’ll come to you.")} action={t("Book a Wash")} href="/book" />}</section>
                <section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--blue)]">{t("Savings")}</p><h2 className="mt-1 text-xl font-bold">{t("Membership")}</h2></div><button type="button" aria-label={t("View all memberships")} onClick={() => setTab("memberships")} className="min-h-11 text-sm font-bold text-[color:var(--blue)]">{t("View all")}</button></div>{memberships === null ? <div className="commerce-card h-44 animate-pulse bg-slate-100" /> : activeMemberships.length > 0 ? <MembershipCard membership={activeMemberships[0]} busy={paymentAction === `cancel-membership:${activeMemberships[0].id}`} onCancel={() => handleCancelCashMembership(activeMemberships[0])} /> : <EmptyState title={t("Wash more, pay less")} copy={t("Prepaid wash bundles make every booking faster.")} action={t("See memberships")} href="/memberships" />}</section>
              </div>}

              {tab === "bookings" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My bookings")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Review upcoming and previous wash appointments.")}</p></div><Link href="/book" className="primary-button shrink-0 px-4">{t("New booking")}</Link></div>{bookings === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-48 animate-pulse bg-slate-100" />)}</div> : bookings.length === 0 ? <EmptyState title={t("No bookings yet")} copy={t("Your first sparkling-clean car is a few taps away.")} action={t("Book your first wash")} href="/book" /> : <div className="grid gap-4 md:grid-cols-2">{bookings.map((booking) => <BookingCard key={booking.id} booking={booking} busy={paymentAction === `booking:${booking.id}`} onPay={() => handleCompleteBookingPayment(booking)} onCancel={() => handleCancel(booking.id)} onReschedule={() => loadRescheduleOptions(booking, qatarServiceDate(booking.scheduled_at))} />)}</div>}</section>}

              {tab === "orders" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My store orders")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Track product purchases, delivery, and payment status.")}</p></div><Link href="/store" className="primary-button shrink-0 px-4">{t("Shop products")}</Link></div>{orders === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-48 animate-pulse bg-slate-100" />)}</div> : orders.length === 0 ? <EmptyState title={t("No store orders yet")} copy={t("Products you purchase from the Bubbleit store will appear here.")} action={t("Browse the store")} href="/store" /> : <div className="grid gap-4 md:grid-cols-2">{orders.map((order) => <StoreOrderCard key={order.id} order={order} busy={paymentAction === `order:${order.id}` || paymentAction === `cancel-order:${order.id}`} onPay={() => handleCompleteStorePayment(order)} onCancel={() => handleCancelStoreOrder(order)} />)}</div>}</section>}

              {tab === "memberships" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My memberships")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("See remaining washes, validity, and book with a plan.")}</p></div><Link href="/memberships" className="primary-button shrink-0 px-4">{t("Browse plans")}</Link></div>{memberships === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-44 animate-pulse bg-slate-100" />)}</div> : memberships.length === 0 ? <EmptyState title={t("No memberships yet")} copy={t("Save more when you wash regularly.")} action={t("See memberships")} href="/memberships" /> : <div className="grid gap-4 md:grid-cols-2">{memberships.map((membership) => <MembershipCard key={membership.id} membership={membership} busy={paymentAction === `cancel-membership:${membership.id}`} onCancel={() => handleCancelCashMembership(membership)} />)}</div>}</section>}

              {tab === "vehicles" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My vehicles")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Vehicles saved during booking appear here.")}</p></div><Link href="/book" className="primary-button shrink-0 px-4">{t("Add through booking")}</Link></div>{vehicles === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-36 animate-pulse bg-slate-100" />)}</div> : vehicles.length === 0 ? <EmptyState title={t("No vehicles saved")} copy={t("Your vehicle is saved automatically when you book.")} action={t("Book a Wash")} href="/book" /> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{vehicles.map((vehicle) => <article key={vehicle.id} className="commerce-card flex min-h-40 flex-col p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{t(VEHICLE_TYPE_LABELS[vehicle.type])}</p><p className="mt-1 text-2xl font-extrabold tracking-wider text-[color:var(--navy)]">{vehicle.plate_number}</p></div><svg viewBox="0 0 24 24" className="h-6 w-6 text-[color:var(--blue)]" fill="none" aria-hidden="true"><path d="m5 16 1-5h12l1 5M7 11l2-4h6l2 4M4 16h16v3H4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>{(vehicle.make || vehicle.model || vehicle.color) && <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(" · ")}</p>}<div className="mt-auto flex items-center justify-between pt-4"><Link href="/book" className="min-h-11 py-3 text-sm font-bold text-[color:var(--blue)]">{t("Book a wash")}</Link><button type="button" className="min-h-11 px-2 text-sm font-semibold text-red-600 hover:underline" onClick={() => handleRemoveVehicle(vehicle.id)}>{t("Remove")}</button></div></article>)}</div>}</section>}

              {tab === "notifications" && <CustomerNotifications />}
            </div>
          </>
        )}
      </main>
      {reschedule && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
          <section ref={rescheduleDialogRef} role="dialog" aria-modal="true" aria-labelledby="reschedule-booking-title" tabIndex={-1} className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 id="reschedule-booking-title" className="text-xl font-bold">{t("Choose a new time")}</h2><button ref={rescheduleCloseRef} type="button" className="secondary-button" onClick={() => setReschedule(null)}>{t("Close")}</button></div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
              {reschedule.days.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => loadRescheduleOptions(reschedule.booking, day.date, reschedule.key)}
                  className={clsx(
                    "flex min-w-[4.5rem] flex-col items-center rounded-2xl border px-3 py-2.5 text-sm transition",
                    reschedule.date === day.date
                      ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                      : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
                  )}
                >
                  <span className="text-xs opacity-75">{day.weekday}</span>
                  <span className="font-semibold">{t(day.label)}</span>
                </button>
              ))}
            </div>
            {reschedule.busy && !reschedule.options ? (
              <div aria-label={t("Checking availability…")} className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 12 }, (_, index) => (
                  <span key={index} aria-hidden="true" className="block h-11 w-full animate-pulse rounded-xl bg-slate-200/80" />
                ))}
              </div>
            ) : reschedule.options ? (
              <HourSlotPicker
                date={reschedule.date}
                slots={reschedule.options.slots}
                selectedSlot={reschedule.slot}
                nowMs={rescheduleNowMs}
                onSelect={(start) => setReschedule((current) => (current ? { ...current, slot: start } : current))}
              />
            ) : null}
            {reschedule.error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{reschedule.error}</p>}
            <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">{t("Your payment, membership wash, products, and total stay attached to this booking.")}</p>
            <button type="button" className="primary-button mt-5 w-full" disabled={!reschedule.slot || reschedule.busy} onClick={commitReschedule}>{reschedule.busy ? t("Rescheduling…") : t("Confirm new time")}</button>
          </section>
        </div>
      )}
      <Footer />
    </>
  );
}

function EmptyState({
  title,
  copy,
  action,
  href,
}: {
  title: string;
  copy: string;
  action: string;
  href: string;
}) {
  return (
    <div className="commerce-card flex min-h-44 flex-col items-start justify-center p-6">
      <h3 className="text-lg font-bold text-[color:var(--navy)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{copy}</p>
      <Link href={href} className="primary-button mt-5">{action}</Link>
    </div>
  );
}

function StoreOrderCard({
  order,
  busy,
  onPay,
  onCancel,
}: {
  order: StoreOrder;
  busy: boolean;
  onPay: () => void;
  onCancel: () => void;
}) {
  const { lang, t } = useI18n();
  const paymentStatus = order.payment?.captured ? "paid" : (order.payment?.status ?? order.payment_status ?? "pending");
  const paymentLabel = paymentStatus === "paid"
    ? t("Paid")
    : paymentStatus === "cash_due"
      ? t("Cash due")
    : paymentStatus === "failed" || paymentStatus === "retryable"
      ? t("Payment failed")
      : paymentStatus === "cancelled"
        ? t("Payment cancelled")
        : paymentStatus === "timed_out"
          ? t("Payment timed out")
          : paymentStatus === "refunded"
            ? t("Refunded")
            : paymentStatus === "partially_refunded"
              ? t("Partially refunded")
              : paymentStatus === "reconciliation_required"
                ? t("Payment under review")
                : t(order.payment_status_label ?? "Payment pending");
  const paid = paymentStatus === "paid";
  const failed = ["failed", "retryable", "cancelled", "timed_out"].includes(paymentStatus);
  const reconciliationRequired = paymentStatus === "reconciliation_required";
  const cashDue = paymentStatus === "cash_due";
  const canPay = order.status === "pending_payment" && !paid && !cashDue && !reconciliationRequired;
  const canCancel = ["pending_payment", "paid", "confirmed"].includes(order.status) && !reconciliationRequired;

  return (
    <article id={`store-order-${order.id}`} className="commerce-card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{t("Store order")}</p>
          <h3 className="mt-1 font-bold text-[color:var(--navy)]">{order.reference}</h3>
        </div>
        <span className={clsx(
          "rounded-full px-3 py-1 text-xs font-bold",
          ["delivered", "confirmed", "paid"].includes(order.status)
            ? "bg-emerald-100 text-emerald-700"
            : order.status === "cancelled"
              ? "bg-red-100 text-red-700"
              : "bg-sky-100 text-sky-700",
        )}>
          {t(order.status_label)}
        </span>
      </div>

      <ul className="grid gap-2 text-sm">
        {order.lines.map((line) => (
          <li key={`${line.product_id}-${line.sku}`} className="flex items-start justify-between gap-4">
            <span className="text-[color:var(--navy)]">{line.name}</span>
            <span className="shrink-0 font-semibold text-[color:var(--muted-foreground)]">× {line.quantity}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[color:var(--muted-foreground)]">{t("Delivery")}</span>
          <span className="text-end font-semibold text-[color:var(--navy)]">{order.delivery_area || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[color:var(--muted-foreground)]">{t("Payment")}</span>
          <span className={clsx("font-bold", paid ? "text-emerald-700" : failed ? "text-red-700" : "text-amber-800")}>
            {paymentLabel}
          </span>
        </div>
      </div>
      {order.refund && (
        <p className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-900">
          {t("Refund")}: {t(order.refund.status_label)}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
        <span className="font-bold" dir="ltr">{formatQar(order.total, lang)}</span>
        <div className="flex flex-wrap gap-2">
          {canPay && <button type="button" className="primary-button min-h-9 px-4 py-2 text-xs" disabled={busy} onClick={onPay}>{busy ? t("Checking payment…") : t("Complete payment")}</button>}
          {canCancel && <button type="button" className="secondary-button min-h-9 px-4 py-2 text-xs text-red-600 hover:border-red-400 hover:text-red-600" disabled={busy} onClick={onCancel}>{t("Cancel order")}</button>}
          <Link href="/store" className="secondary-button min-h-9 px-4 py-2 text-xs">{t("Shop again")}</Link>
        </div>
      </div>
    </article>
  );
}

function MembershipCard({
  membership,
  busy,
  onCancel,
}: {
  membership: CustomerMembership;
  busy: boolean;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const active = membership.status === "active" && membership.washes_remaining > 0;
  const reconciliationRequired = membership.payment?.status === "reconciliation_required";
  const cashDue = membership.payment?.status === "cash_due";
  const expiry = membership.expires_at
    ? new Date(membership.expires_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <article className="commerce-card flex min-h-44 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{t("Membership")}</p><h3 className="mt-1 font-bold text-[color:var(--navy)]">{membership.plan.name}</h3></div>
        <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", reconciliationRequired || cashDue ? "bg-amber-100 text-amber-800" : active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{t(reconciliationRequired ? "Payment under review" : cashDue ? "Cash due" : active ? "Active" : membership.status.replaceAll("_", " "))}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4"><p><span className="text-3xl font-extrabold text-[color:var(--navy)]">{membership.washes_remaining}</span><span className="ms-2 text-sm font-semibold text-[color:var(--muted-foreground)]">{t("washes left")}</span></p>{expiry && <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{t("Expires")} {expiry}</p>}</div>
      {reconciliationRequired && <p role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{t("Payment received after this membership closed. It was not reactivated, and our team is arranging the required refund.")}</p>}
      {cashDue && <p role="status" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">{t("Cash due. This membership remains inactive until an authorized team member records the full payment.")}</p>}
      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
        {active && <Link href="/book" className="primary-button flex-1 px-4">{t("Book a Wash")}</Link>}
        {cashDue && <button type="button" disabled={busy} onClick={onCancel} className="secondary-button flex-1 px-4 text-red-600 hover:border-red-400 hover:text-red-600">{t("Cancel membership")}</button>}
        <Link href="/memberships" className="secondary-button flex-1 px-4">{t(active ? "View plans" : "Renew plan")}</Link>
      </div>
    </article>
  );
}

function BookingCard({
  booking,
  busy,
  onPay,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  busy: boolean;
  onPay: () => void;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const { lang, t } = useI18n();
  const when = formatQatarDateTime(booking.scheduled_at, lang, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const reconciliationRequired = booking.payment?.status === "reconciliation_required";
  const cashDue = booking.payment?.status === "cash_due";
  const paymentRequired = booking.status === "pending_payment"
    && !booking.payment?.captured
    && !cashDue
    && !reconciliationRequired;
  const hasBluePlate = Boolean(
    booking.building_number || booking.zone_number || booking.street_number,
  );
  const addressDetails = [
    booking.address_label,
    booking.address_street,
    booking.address_area,
  ].filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);

  return (
    <article className="commerce-card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-[color:var(--navy)]">{booking.reference}</span>
        <span
          className={clsx(
            "rounded-full px-3 py-1 text-xs font-semibold",
            STATUS_STYLES[booking.status] ?? "bg-gray-100 text-gray-600",
          )}
        >
          {booking.status_label}
        </span>
      </div>

      <div className="flex flex-col gap-1 text-sm text-[color:var(--muted-foreground)]">
        <span><span className="font-semibold text-[color:var(--navy)]">{t("Date")}: </span>{when}</span>
        <span><span className="font-semibold text-[color:var(--navy)]">{t("Location")}: </span>{addressDetails.join(" · ") || "—"}</span>
        <span><span className="font-semibold text-[color:var(--navy)]">{t("Service")}: </span>
          {booking.cars
            .map((c) => `${c.service.name} — ${[c.vehicle.make, c.vehicle.model].filter(Boolean).join(" ") || c.vehicle.plate_number}`)
            .join(" · ")}
        </span>
      </div>

      {hasBluePlate && (
        <section aria-label={t("Blue Plate")} className="overflow-hidden rounded-2xl bg-[color:var(--navy)] text-white">
          <p className="px-4 pt-3 text-xs font-bold uppercase tracking-[0.12em] text-white/65">{t("Blue Plate")}</p>
          <div className="mt-2 grid grid-cols-3 divide-x divide-white/15">
            {([
              [t("Building"), booking.building_number],
              [t("Zone"), booking.zone_number],
              [t("Street"), booking.street_number],
            ] as const).map(([label, value]) => (
              <div key={label} className="px-3 pb-4 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-white/55">{label}</span>
                <span className="mt-1 block text-xl font-extrabold">{value || "—"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {booking.notes.trim() && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--blue)]">{t("Address details / note")}</p>
          <p className="mt-1 text-sm text-[color:var(--navy)]">{booking.notes}</p>
        </div>
      )}

      {reconciliationRequired && (
        <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {t("Payment received after this booking closed. It was not reinstated, and our team is arranging the required refund.")}
        </p>
      )}
      {cashDue && (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {t("Cash due. Your booking can proceed and this status will update after the full payment is recorded.")}
        </p>
      )}
      {booking.refund && (
        <p className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-900">
          {t("Refund")}: {t(booking.refund.status_label)}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
        <span className="font-bold" dir="ltr">{formatQar(booking.total, lang)}</span>
        <div className="flex flex-wrap gap-2">
          {paymentRequired && (
            <button type="button" className="primary-button min-h-9 px-4 py-2 text-xs" disabled={busy} onClick={onPay}>
              {busy ? t("Checking payment…") : t("Complete payment")}
            </button>
          )}
          <Link href="/book" className="secondary-button min-h-9 px-4 py-2 text-xs">
            {t("Book again")}
          </Link>
          {!reconciliationRequired && CANCELLABLE.includes(booking.status) && (
            <button type="button" className="secondary-button min-h-9 px-4 py-2 text-xs" onClick={onReschedule}>{t("Reschedule")}</button>
          )}
          {!reconciliationRequired && CANCELLABLE.includes(booking.status) && (
            <button
              type="button"
              className="secondary-button min-h-9 px-4 py-2 text-xs text-red-600 hover:border-red-400 hover:text-red-600"
              onClick={onCancel}
            >
              {t("Cancel")}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
