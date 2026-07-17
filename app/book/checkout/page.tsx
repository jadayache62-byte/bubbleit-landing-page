"use client";

// Mock checkout page — stands in for the real payment gateway's hosted page.
// It simulates a successful payment by calling the mock webhook-equivalent
// endpoint, which transitions the booking pending_payment -> paid.

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { completeMockBookingPayment, getBooking } from "@/lib/api/client";
import type { Booking } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { formatQar } from "@/lib/money";

function CheckoutInner() {
  const { lang, t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const bookingId = Number(params.get("booking"));
  const [booking, setBooking] = useState<Booking | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "paying" | "error">("loading");

  useEffect(() => {
    if (!bookingId) {
      queueMicrotask(() => setState("error"));
      return;
    }
    getBooking(bookingId)
      .then((b) => {
        setBooking(b);
        setState(b.status === "pending_payment" ? "ready" : "error");
      })
      .catch(() => setState("error"));
  }, [bookingId]);

  async function pay() {
    setState("paying");
    try {
      await completeMockBookingPayment(bookingId);
      router.push("/account?paid=1");
    } catch {
      setState("error");
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="glass-panel w-full max-w-md rounded-[var(--radius-card)] p-8 text-center">
        <span className="section-kicker">{t("Secure Checkout (Demo)")}</span>
        {state === "loading" && <p className="mt-6 text-sm text-[color:var(--muted-foreground)]">{t("Loading…")}</p>}

        {state === "error" && (
          <>
            <h1 className="mt-6 text-xl font-bold">{t("Nothing to pay here")}</h1>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              {t("This booking isn't awaiting payment, or your session expired.")}
            </p>
            <Link href="/account" className="primary-button mt-6">
              {t("Go to my bookings")}
            </Link>
          </>
        )}

        {(state === "ready" || state === "paying") && booking && (
          <>
            <h1 className="mt-6 text-2xl font-bold" dir="ltr">{formatQar(booking.total, lang)}</h1>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              {t("Booking")} {booking.reference}
            </p>
            <p className="mt-4 rounded-2xl bg-[color:var(--background)] px-4 py-3 text-xs text-[color:var(--muted-foreground)]">
              {t("This is a demo checkout. In production this page is the payment gateway's hosted card form.")}
            </p>
            <button
              type="button"
              className="primary-button mt-6 w-full disabled:opacity-50"
              disabled={state === "paying"}
              onClick={pay}
            >
              {state === "paying" ? t("Processing…") : t("Pay now")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutInner />
    </Suspense>
  );
}
