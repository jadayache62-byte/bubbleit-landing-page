"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { useI18n } from "@/lib/i18n";
import {
  ApiError,
  cancelBooking,
  deleteVehicle,
  getToken,
  getBookingRescheduleOptions,
  listAddresses,
  listBookings,
  listMemberships,
  listVehicles,
  logout,
  me,
  rescheduleBooking,
} from "@/lib/api/client";
import type {
  Booking,
  BookingStatus,
  BookingRescheduleOptions,
  Address,
  Customer,
  CustomerMembership,
  Vehicle,
  VehicleType,
} from "@/lib/api/types";
import { formatQatarDateTime, qatarServiceDate, qatarToday, serializeQatarBookingDateTime } from "@/lib/datetime";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  assigned: "bg-sky-100 text-sky-700",
  in_progress: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled_by_customer: "bg-red-100 text-red-600",
  cancelled_by_admin: "bg-red-100 text-red-600",
  no_show: "bg-gray-200 text-gray-600",
};

const CANCELLABLE: BookingStatus[] = ["pending_payment", "paid", "assigned"];
const ACCOUNT_TABS = ["overview", "bookings", "memberships", "vehicles"] as const;

const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  sedan: "Salon / Sedan",
  suv: "SUV / 4-Wheel",
  caravan: "Caravan",
  jet_ski: "Jet Ski",
  jet_boat: "Jet Boat",
};

export default function AccountPage() {
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checked, setChecked] = useState(false);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [memberships, setMemberships] = useState<CustomerMembership[] | null>(null);
  const [tab, setTab] = useState<"overview" | "bookings" | "memberships" | "vehicles">("overview");
  const [error, setError] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{
    booking: Booking;
    date: string;
    options: BookingRescheduleOptions | null;
    slot: string | null;
    key: string;
    busy: boolean;
    error: string | null;
  } | null>(null);

  const refresh = useCallback(() => {
    listBookings().then(setBookings).catch(() => setBookings([]));
    listVehicles().then(setVehicles).catch(() => setVehicles([]));
    listAddresses().then(setAddresses).catch(() => setAddresses([]));
    listMemberships().then(setMemberships).catch(() => setMemberships([]));
  }, []);

  useEffect(() => {
    const check = getToken() ? me() : Promise.reject();
    check
      .then((c) => {
        setCustomer(c);
        refresh();
      })
      .catch(() => setCustomer(null))
      .finally(() => setChecked(true));
  }, [refresh]);

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

  async function loadRescheduleOptions(booking: Booking, date: string, key = window.crypto.randomUUID()) {
    setError(null);
    setReschedule({ booking, date, options: null, slot: null, key, busy: true, error: null });
    try {
      const options = await getBookingRescheduleOptions(booking.id, date);
      setReschedule({ booking, date, options, slot: null, key, busy: false, error: null });
    } catch (caught) {
      setReschedule({
        booking,
        date,
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
    await logout();
    setCustomer(null);
    setBookings(null);
    setVehicles(null);
    setAddresses(null);
    setMemberships(null);
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
            <AuthPanel
              title={t("Welcome back")}
              onAuthed={(c) => {
                setCustomer(c);
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

            {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

            <div className="mt-7 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-1 sm:grid-cols-4" role="tablist" aria-label={t("Account sections")}>
              {([["overview", t("Overview")], ["bookings", t("Bookings")], ["memberships", t("Memberships")], ["vehicles", t("Vehicles")]] as const).map(([value, label]) => <button key={value} id={`account-tab-${value}`} type="button" role="tab" tabIndex={tab === value ? 0 : -1} aria-selected={tab === value} aria-controls={`account-panel-${value}`} onKeyDown={(event) => handleTabKeyDown(event, value)} onClick={() => setTab(value)} className={clsx("min-h-11 rounded-xl px-3 text-sm font-semibold transition", tab === value ? "bg-[color:var(--navy)] text-white" : "text-[color:var(--muted-foreground)] hover:bg-slate-50 hover:text-[color:var(--navy)]")}>{label}</button>)}
            </div>

            <div key={tab} id={`account-panel-${tab}`} role="tabpanel" aria-labelledby={`account-tab-${tab}`} tabIndex={0} className="checkout-step mt-6 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--blue)] focus-visible:ring-offset-4">
              {tab === "overview" && <div className="grid gap-5 lg:grid-cols-2">
                <section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--blue)]">{t("Next up")}</p><h2 className="mt-1 text-xl font-bold">{t("Upcoming booking")}</h2></div><button type="button" aria-label={t("View all bookings")} onClick={() => setTab("bookings")} className="min-h-11 text-sm font-bold text-[color:var(--blue)]">{t("View all")}</button></div>{bookings === null ? <div className="commerce-card h-44 animate-pulse bg-slate-100" /> : activeBookings.length > 0 ? <BookingCard booking={activeBookings[0]} onCancel={() => handleCancel(activeBookings[0].id)} onReschedule={() => loadRescheduleOptions(activeBookings[0], qatarServiceDate(activeBookings[0].scheduled_at))} /> : <EmptyState title={t("No upcoming wash")} copy={t("Choose a service and we’ll come to you.")} action={t("Book a Wash")} href="/book" />}</section>
                <section><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--blue)]">{t("Savings")}</p><h2 className="mt-1 text-xl font-bold">{t("Membership")}</h2></div><button type="button" aria-label={t("View all memberships")} onClick={() => setTab("memberships")} className="min-h-11 text-sm font-bold text-[color:var(--blue)]">{t("View all")}</button></div>{memberships === null ? <div className="commerce-card h-44 animate-pulse bg-slate-100" /> : activeMemberships.length > 0 ? <MembershipCard membership={activeMemberships[0]} /> : <EmptyState title={t("Wash more, pay less")} copy={t("Prepaid wash bundles make every booking faster.")} action={t("See memberships")} href="/memberships" />}</section>
              </div>}

              {tab === "bookings" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My bookings")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Review upcoming and previous wash appointments.")}</p></div><Link href="/book" className="primary-button shrink-0 px-4">{t("New booking")}</Link></div>{bookings === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-48 animate-pulse bg-slate-100" />)}</div> : bookings.length === 0 ? <EmptyState title={t("No bookings yet")} copy={t("Your first sparkling-clean car is a few taps away.")} action={t("Book your first wash")} href="/book" /> : <div className="grid gap-4 md:grid-cols-2">{bookings.map((booking) => <BookingCard key={booking.id} booking={booking} onCancel={() => handleCancel(booking.id)} onReschedule={() => loadRescheduleOptions(booking, qatarServiceDate(booking.scheduled_at))} />)}</div>}</section>}

              {tab === "memberships" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My memberships")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("See remaining washes, validity, and book with a plan.")}</p></div><Link href="/memberships" className="primary-button shrink-0 px-4">{t("Browse plans")}</Link></div>{memberships === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-44 animate-pulse bg-slate-100" />)}</div> : memberships.length === 0 ? <EmptyState title={t("No memberships yet")} copy={t("Save more when you wash regularly.")} action={t("See memberships")} href="/memberships" /> : <div className="grid gap-4 md:grid-cols-2">{memberships.map((membership) => <MembershipCard key={membership.id} membership={membership} />)}</div>}</section>}

              {tab === "vehicles" && <section><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("My vehicles")}</h2><p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Vehicles saved during booking appear here.")}</p></div><Link href="/book" className="primary-button shrink-0 px-4">{t("Add through booking")}</Link></div>{vehicles === null ? <div className="grid gap-4 md:grid-cols-2">{[0,1].map((item) => <div key={item} className="commerce-card h-36 animate-pulse bg-slate-100" />)}</div> : vehicles.length === 0 ? <EmptyState title={t("No vehicles saved")} copy={t("Your vehicle is saved automatically when you book.")} action={t("Book a Wash")} href="/book" /> : <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{vehicles.map((vehicle) => <article key={vehicle.id} className="commerce-card flex min-h-40 flex-col p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{t(VEHICLE_TYPE_LABELS[vehicle.type])}</p><p className="mt-1 text-2xl font-extrabold tracking-wider text-[color:var(--navy)]">{vehicle.plate_number}</p></div><svg viewBox="0 0 24 24" className="h-6 w-6 text-[color:var(--blue)]" fill="none" aria-hidden="true"><path d="m5 16 1-5h12l1 5M7 11l2-4h6l2 4M4 16h16v3H4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>{(vehicle.make || vehicle.model || vehicle.color) && <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{[vehicle.make, vehicle.model, vehicle.color].filter(Boolean).join(" · ")}</p>}<div className="mt-auto flex items-center justify-between pt-4"><Link href="/book" className="min-h-11 py-3 text-sm font-bold text-[color:var(--blue)]">{t("Book a wash")}</Link><button type="button" className="min-h-11 px-2 text-sm font-semibold text-red-600 hover:underline" onClick={() => handleRemoveVehicle(vehicle.id)}>{t("Remove")}</button></div></article>)}</div>}</section>}
            </div>
          </>
        )}
      </main>
      {reschedule && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={t("Reschedule booking")}>
          <section className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-bold">{t("Choose a new time")}</h2><button type="button" className="secondary-button" onClick={() => setReschedule(null)}>{t("Close")}</button></div>
            <label className="mt-5 block text-sm font-semibold">{t("Date")}<input type="date" min={qatarToday()} value={reschedule.date} className="mt-2 w-full rounded-xl border p-3" onChange={(event) => loadRescheduleOptions(reschedule.booking, event.target.value, reschedule.key)} /></label>
            {reschedule.busy && !reschedule.options ? <p className="mt-5 text-sm">{t("Loading available times…")}</p> : (
              <div className="mt-5 grid grid-cols-3 gap-2">{reschedule.options?.slots.filter((slot) => slot.available).map((slot) => <button key={slot.start} type="button" className={clsx("rounded-xl border p-3 text-sm font-bold", reschedule.slot === slot.start && "border-[color:var(--blue)] bg-sky-50")} onClick={() => setReschedule({ ...reschedule, slot: slot.start })}>{slot.start}</button>)}</div>
            )}
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

function MembershipCard({ membership }: { membership: CustomerMembership }) {
  const { t } = useI18n();
  const active = membership.status === "active" && membership.washes_remaining > 0;
  const expiry = membership.expires_at
    ? new Date(membership.expires_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <article className="commerce-card flex min-h-44 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">{t("Membership")}</p><h3 className="mt-1 font-bold text-[color:var(--navy)]">{membership.plan.name}</h3></div>
        <span className={clsx("rounded-full px-3 py-1 text-xs font-bold", active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>{t(active ? "Active" : membership.status.replaceAll("_", " "))}</span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-4"><p><span className="text-3xl font-extrabold text-[color:var(--navy)]">{membership.washes_remaining}</span><span className="ms-2 text-sm font-semibold text-[color:var(--muted-foreground)]">{t("washes left")}</span></p>{expiry && <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{t("Expires")} {expiry}</p>}</div>
      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
        {active && <Link href="/book" className="primary-button flex-1 px-4">{t("Book a Wash")}</Link>}
        <Link href="/memberships" className="secondary-button flex-1 px-4">{t(active ? "View plans" : "Renew plan")}</Link>
      </div>
    </article>
  );
}

function BookingCard({
  booking,
  onCancel,
  onReschedule,
}: {
  booking: Booking;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const when = formatQatarDateTime(booking.scheduled_at, "en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const { t } = useI18n();
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
        <span className="font-bold">QR {booking.total}</span>
        <div className="flex flex-wrap gap-2">
          <Link href="/book" className="secondary-button min-h-9 px-4 py-2 text-xs">
            {t("Book again")}
          </Link>
          {CANCELLABLE.includes(booking.status) && (
            <button type="button" className="secondary-button min-h-9 px-4 py-2 text-xs" onClick={onReschedule}>{t("Reschedule")}</button>
          )}
          {CANCELLABLE.includes(booking.status) && (
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
