"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { OtpSignIn } from "@/components/booking/OtpSignIn";
import {
  ApiError,
  buyMembership,
  getMembershipPlans,
  getToken,
  listMemberships,
  me,
} from "@/lib/api/client";
import type { CustomerMembership, MembershipPlan } from "@/lib/api/types";
import { localized, useI18n } from "@/lib/i18n";

const SCOPES = [
  { key: "full_wash", label: "Full Wash" },
  { key: "exterior", label: "Exterior Only" },
  { key: "midnight_exterior", label: "Midnight (12am–5am)" },
] as const;

const STATUS_LABELS: Record<CustomerMembership["status"], string> = {
  pending_payment: "Awaiting activation",
  active: "Active",
  exhausted: "Used up",
  expired: "Expired",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<CustomerMembership["status"], string> = {
  pending_payment: "bg-amber-100 text-amber-700",
  active: "bg-emerald-100 text-emerald-700",
  exhausted: "bg-gray-200 text-gray-600",
  expired: "bg-red-100 text-red-600",
  cancelled: "bg-red-100 text-red-600",
};

export default function MembershipsPage() {
  const { lang, t } = useI18n();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [mine, setMine] = useState<CustomerMembership[] | null>(null);
  const [authed, setAuthed] = useState(false);
  const [scope, setScope] = useState<(typeof SCOPES)[number]["key"]>("full_wash");
  const [vtype, setVtype] = useState<"sedan" | "suv">("sedan");
  const [buyingPlan, setBuyingPlan] = useState<MembershipPlan | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bought, setBought] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMine = useCallback(() => {
    listMemberships().then(setMine).catch(() => setMine([]));
  }, []);

  useEffect(() => {
    getMembershipPlans().then(setPlans).catch(() => setPlans([]));
    if (getToken()) {
      me()
        .then(() => {
          setAuthed(true);
          refreshMine();
        })
        .catch(() => setAuthed(false));
    }
  }, [refreshMine]);

  const visiblePlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          p.scope === scope &&
          (p.vehicle_type === null || p.vehicle_type === vtype),
      ),
    [plans, scope, vtype],
  );

  async function buy(plan: MembershipPlan) {
    setError(null);
    if (!authed) {
      setBuyingPlan(plan);
      setNeedsAuth(true);
      return;
    }
    setBusy(true);
    try {
      await buyMembership(plan.id);
      setBought(true);
      refreshMine();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="section-shell py-10 sm:py-14">
        <div className="mb-10 text-center">
          <span className="section-kicker">{t("Memberships")}</span>
          <h1 className="section-title mt-4">{t("Wash Memberships")}</h1>
          <p className="section-copy mx-auto mt-3">
            {t("Prepaid wash bundles — better prices, one tap to book.")}
          </p>
        </div>

        {/* My memberships */}
        {authed && mine && mine.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xl font-bold">{t("My Memberships")}</h2>
            <div className="card-grid md:grid-cols-2 xl:grid-cols-3">
              {mine.map((m) => (
                <article key={m.id} className="glass-panel flex flex-col gap-3 rounded-[var(--radius-card)] p-6">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold">{localized(lang, m.plan.name, m.plan.name_ar)}</span>
                    <span className={clsx("rounded-full px-3 py-1 text-xs font-semibold", STATUS_STYLES[m.status])}>
                      {t(STATUS_LABELS[m.status])}
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--muted-foreground)]">
                    <span className="text-2xl font-bold text-[color:var(--navy)]">
                      {m.washes_remaining}
                    </span>{" "}
                    {t("washes left")}
                    {m.expires_at && (
                      <span className="block">
                        {t("Expires")}{" "}
                        {new Date(m.expires_at).toLocaleDateString(lang === "ar" ? "ar" : "en", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </p>
                  {m.status === "active" && m.washes_remaining > 0 && (
                    <Link href={`/book/membership?m=${m.id}`} className="primary-button mt-auto">
                      {t("Book with membership")}
                    </Link>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Scope tabs */}
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setScope(s.key)}
              className={clsx(
                "rounded-full border px-5 py-2.5 text-sm font-semibold transition",
                scope === s.key
                  ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
                  : "border-[color:var(--border)] bg-white text-[color:var(--foreground)] hover:border-[color:var(--blue)]",
              )}
            >
              {t(s.label)}
            </button>
          ))}
        </div>

        {/* Vehicle type toggle (not relevant for midnight) */}
        {scope !== "midnight_exterior" ? (
          <div className="mb-8 flex justify-center gap-2">
            {(
              [
                { value: "sedan", label: "Salon / Sedan" },
                { value: "suv", label: "SUV / 4-Wheel" },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setVtype(o.value)}
                className={clsx(
                  "rounded-full border px-5 py-2 text-sm font-semibold transition",
                  vtype === o.value
                    ? "border-[color:var(--blue)] bg-[color:var(--blue)] text-white"
                    : "border-[color:var(--border)] bg-white text-[color:var(--muted-foreground)] hover:border-[color:var(--blue)]",
                )}
              >
                {t(o.label)}
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-8 text-center text-sm text-[color:var(--muted-foreground)]">
            {t("Exterior wash only, between 12am and 5am.")}
          </p>
        )}

        {error && (
          <p role="alert" className="mx-auto mb-6 max-w-lg rounded-2xl bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {/* Plans */}
        <div className="card-grid md:grid-cols-2 xl:grid-cols-4">
          {visiblePlans.map((plan) => (
            <article
              key={plan.id}
              className="glass-panel flex flex-col items-center gap-2 rounded-[var(--radius-card)] p-8 text-center transition hover:-translate-y-1"
            >
              <span className="text-4xl font-bold text-[color:var(--navy)]">
                {plan.washes_count}
              </span>
              <span className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                {t("washes")}
              </span>
              <span className="mt-2 text-2xl font-bold text-[color:var(--blue)]">
                QR {plan.price}
              </span>
              <span className="text-xs text-[color:var(--muted-foreground)]">{t("Valid 30 days")}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => buy(plan)}
                className="primary-button mt-4 w-full disabled:opacity-40"
              >
                {busy ? t("Buying…") : t("Buy")}
              </button>
            </article>
          ))}
        </div>
      </main>
      <Footer />

      {/* Auth modal for guest purchase */}
      {needsAuth && buyingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <OtpSignIn
              title={t("Sign in to buy a membership.")}
              onClose={() => setNeedsAuth(false)}
              onAuthed={async () => {
                setNeedsAuth(false);
                setAuthed(true);
                refreshMine();
                await buyMembership(buyingPlan.id)
                  .then(() => {
                    setBought(true);
                    refreshMine();
                  })
                  .catch((e) =>
                    setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again.")),
                  );
              }}
            />
          </div>
        </div>
      )}

      {/* Purchase success */}
      {bought && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-[var(--radius-card)] p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h2 className="mt-4 text-xl font-bold">{t("Membership requested!")}</h2>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              {t("We'll activate it as soon as payment is confirmed — our team will contact you.")}
            </p>
            <button type="button" className="primary-button mt-6 w-full" onClick={() => setBought(false)}>
              OK
            </button>
          </div>
        </div>
      )}
    </>
  );
}
