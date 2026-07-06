"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { OtpSignIn } from "@/components/booking/OtpSignIn";
import { useI18n } from "@/lib/i18n";
import {
  ApiError,
  cancelBooking,
  getToken,
  listBookings,
  logout,
  me,
  payBooking,
} from "@/lib/api/client";
import type { Booking, BookingStatus, Customer } from "@/lib/api/types";

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

export default function AccountPage() {
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checked, setChecked] = useState(false);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    listBookings().then(setBookings).catch(() => setBookings([]));
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

  async function handlePay(id: number) {
    try {
      const { checkout_url } = await payBooking(id);
      window.location.assign(checkout_url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not start the payment.");
    }
  }

  async function handleLogout() {
    await logout();
    setCustomer(null);
    setBookings(null);
  }

  return (
    <>
      <Navbar />
      <main className="section-shell min-h-[60dvh] py-10 sm:py-14">
        {!checked ? null : !customer ? (
          <div className="mx-auto max-w-md">
            <OtpSignIn
              onAuthed={(c) => {
                setCustomer(c);
                refresh();
              }}
            />
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="section-kicker">{t("My Account")}</span>
                <h1 className="section-title mt-4">
                  {customer.name ? `${t("Hi,")} ${customer.name.split(" ")[0]}` : t("My Bookings")}
                </h1>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{customer.phone}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/book" className="primary-button">
                  {t("Book a Wash")}
                </Link>
                <Link href="/memberships" className="secondary-button">
                  {t("My Memberships")}
                </Link>
                <button type="button" className="secondary-button" onClick={handleLogout}>
                  {t("Log out")}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            {bookings === null ? (
              <p className="py-16 text-center text-sm text-[color:var(--muted-foreground)]">{t("Loading your bookings…")}</p>
            ) : bookings.length === 0 ? (
              <div className="glass-panel rounded-[var(--radius-card)] p-12 text-center">
                <h2 className="text-xl font-bold">{t("No bookings yet")}</h2>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {t("Your first sparkling-clean car is a few taps away.")}
                </p>
                <Link href="/book" className="primary-button mt-6">
                  {t("Book your first wash")}
                </Link>
              </div>
            ) : (
              <div className="card-grid md:grid-cols-2">
                {bookings.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    onCancel={() => handleCancel(booking.id)}
                    onPay={() => handlePay(booking.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}

function BookingCard({
  booking,
  onCancel,
  onPay,
}: {
  booking: Booking;
  onCancel: () => void;
  onPay: () => void;
}) {
  const { t } = useI18n();
  const when = new Date(booking.scheduled_at).toLocaleString("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const awaitingOnlinePayment =
    booking.status === "pending_payment" && booking.payment_method === "online";

  return (
    <article className="glass-panel flex flex-col gap-4 rounded-[var(--radius-card)] p-6">
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
        <span>🗓 {when}</span>
        <span>📍 {booking.address_area || "—"}</span>
        <span>
          🚗{" "}
          {booking.cars
            .map((c) => `${c.service.name} — ${c.vehicle.make} ${c.vehicle.model}`)
            .join(" · ")}
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--border)] pt-4">
        <span className="font-bold">QR {booking.total}</span>
        <div className="flex gap-2">
          {awaitingOnlinePayment && (
            <button type="button" className="primary-button min-h-9 px-4 py-2 text-xs" onClick={onPay}>
              {t("Pay now")}
            </button>
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
