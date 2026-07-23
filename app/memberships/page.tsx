"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AuthPanel } from "@/components/booking/AuthPanel";
import {
  ApiError,
  buyMembership,
  getMembershipPlans,
  initializeMembershipPayment,
  listMemberships,
  me,
} from "@/lib/api/client";
import type { CustomerMembership, MembershipPlan } from "@/lib/api/types";
import { localized, useI18n } from "@/lib/i18n";
import { formatQar } from "@/lib/money";

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

const MEMBERSHIP_ATTEMPT_KEY = "bubbleit.membership.payment-attempt";

type MembershipAttempt = {
  planId: number;
  membershipId?: number;
  purchaseKey: string;
  paymentKey: string;
};

function randomAttemptKey(prefix: string) {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${id}`;
}

function membershipAttempt(planId: number): MembershipAttempt {
  try {
    const saved = JSON.parse(window.localStorage.getItem(MEMBERSHIP_ATTEMPT_KEY) ?? "null") as MembershipAttempt | null;
    if (saved?.planId === planId && saved.purchaseKey && saved.paymentKey) return saved;
  } catch {
    // Generate a fresh attempt below.
  }
  const attempt = {
    planId,
    purchaseKey: randomAttemptKey("membership:create"),
    paymentKey: randomAttemptKey("membership:payment"),
  };
  window.localStorage.setItem(MEMBERSHIP_ATTEMPT_KEY, JSON.stringify(attempt));
  return attempt;
}

function saveMembershipAttempt(attempt: MembershipAttempt) {
  window.localStorage.setItem(MEMBERSHIP_ATTEMPT_KEY, JSON.stringify(attempt));
}

export default function MembershipsPage() {
  const { lang, t } = useI18n();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [mine, setMine] = useState<CustomerMembership[] | null>(null);
  const [authed, setAuthed] = useState(false);
  const [scope, setScope] = useState<(typeof SCOPES)[number]["key"]>("full_wash");
  const [vtype, setVtype] = useState<"sedan" | "suv">("sedan");
  const [buyingPlan, setBuyingPlan] = useState<MembershipPlan | null>(null);
  const [confirmingPlan, setConfirmingPlan] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bought, setBought] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMine = useCallback(() => {
    listMemberships().then((memberships) => {
      setMine(memberships);
      try {
        const attempt = JSON.parse(window.localStorage.getItem(MEMBERSHIP_ATTEMPT_KEY) ?? "null") as MembershipAttempt | null;
        if (attempt?.membershipId && memberships.some((item) => item.id === attempt.membershipId && item.status !== "pending_payment")) {
          window.localStorage.removeItem(MEMBERSHIP_ATTEMPT_KEY);
        }
      } catch {
        // A malformed local retry record should not block the membership list.
      }
    }).catch(() => setMine([]));
  }, []);

  useEffect(() => {
    getMembershipPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));
    me()
      .then(() => {
        setAuthed(true);
        refreshMine();
      })
      .catch(() => setAuthed(false));
  }, [refreshMine]);

  useEffect(() => {
    if (!confirmingPlan) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setConfirmingPlan(false);
      setBuyingPlan(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [confirmingPlan]);

  const visiblePlans = useMemo(
    () =>
      plans.filter(
        (p) =>
          p.scope === scope &&
          (p.vehicle_type === null || p.vehicle_type === vtype),
      ),
    [plans, scope, vtype],
  );
  const baselinePerWash = visiblePlans.length ? Math.max(...visiblePlans.map((plan) => plan.price / plan.washes_count)) : 0;

  async function purchase(plan: MembershipPlan) {
    setError(null);
    setBusy(true);
    try {
      const attempt = membershipAttempt(plan.id);
      const result = await buyMembership(plan.id, attempt.purchaseKey);
      const linkedAttempt = { ...attempt, membershipId: result.id };
      saveMembershipAttempt(linkedAttempt);
      const payment = await initializeMembershipPayment(result.id, linkedAttempt.paymentKey);
      if (payment.checkout_url) {
        window.location.assign(payment.checkout_url);
      } else {
        refreshMine();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function retryMembershipPayment(membership: CustomerMembership) {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const saved = membershipAttempt(membership.plan.id);
      const attempt = saved.membershipId === membership.id
        ? saved
        : { ...saved, membershipId: membership.id, paymentKey: randomAttemptKey("membership:payment") };
      saveMembershipAttempt(attempt);
      const payment = await initializeMembershipPayment(membership.id, attempt.paymentKey);
      if (payment.checkout_url) {
        window.location.assign(payment.checkout_url);
      } else {
        refreshMine();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
      setBusy(false);
    }
  }

  function selectPlan(plan: MembershipPlan) {
    setError(null);
    setBuyingPlan(plan);
    setConfirmingPlan(true);
  }

  async function confirmPlan() {
    if (!buyingPlan || busy) return;
    setConfirmingPlan(false);
    if (!authed) {
      setNeedsAuth(true);
      return;
    }
    await purchase(buyingPlan);
  }

  return (
    <>
      <Navbar />
      <main className="section-shell py-10 sm:py-14">
        <div className="mb-8 text-center">
          <span className="section-kicker">{t("Memberships")}</span>
          <h1 className="section-title mt-4">{t("Wash Memberships")}</h1>
          <p className="section-copy mx-auto mt-3">
            {t("Prepaid wash bundles — better prices, one tap to book.")}
          </p>
          <div className="mx-auto mt-5 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-[color:var(--muted-foreground)]"><span>✓ {t("Valid for 30 days")}</span><span>✓ {t("Book in one tap")}</span><span>✓ {t("Secure payment")}</span></div>
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
                  {m.payment?.status === "reconciliation_required" && (
                    <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                      {t("Payment received after this membership closed. It was not reactivated, and our team is arranging the required refund.")}
                    </p>
                  )}
                  {m.status === "active" && m.washes_remaining > 0 && (
                    <Link href="/book" className="primary-button mt-auto">
                      {t("Book a Wash")}
                    </Link>
                  )}
                  {m.status === "pending_payment" && m.payment?.status !== "reconciliation_required" && (
                    <button type="button" className="primary-button mt-auto" disabled={busy} onClick={() => retryMembershipPayment(m)}>
                      {t("Continue Payment")}
                    </button>
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
                    ? "border-[color:var(--navy)] bg-[color:var(--navy)] text-white"
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
        <div role="list" className="card-grid md:grid-cols-2 xl:grid-cols-4" aria-busy={plansLoading} aria-label={plansLoading ? t("Loading membership plans…") : t("Membership plans")}>
          {plansLoading ? Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="commerce-card flex min-h-[19rem] flex-col items-center p-6" aria-hidden="true">
              <span className="mt-2 block h-12 w-16 animate-pulse rounded-xl bg-slate-200" />
              <span className="mt-3 block h-4 w-20 animate-pulse rounded-md bg-slate-200" />
              <span className="mt-7 block h-8 w-28 animate-pulse rounded-lg bg-slate-200" />
              <span className="mt-3 block h-4 w-24 animate-pulse rounded-md bg-slate-200" />
              <span className="mt-3 block h-3 w-20 animate-pulse rounded-md bg-slate-200" />
              <span className="mt-auto block h-12 w-full animate-pulse rounded-full bg-slate-200" />
            </div>
          )) : visiblePlans.map((plan) => (
            <article
              role="listitem"
              key={plan.id}
              className={clsx("commerce-card relative flex flex-col items-center gap-2 p-6 text-center", plan.washes_count === 8 && "border-[color:var(--blue)] ring-2 ring-blue-100")}
            >
              {plan.washes_count === 8 && <span className="absolute -top-3 rounded-full bg-[color:var(--navy)] px-3 py-1 text-xs font-bold text-white">{t("Most popular")}</span>}
              <span className="text-4xl font-bold text-[color:var(--navy)]">
                {plan.washes_count}
              </span>
              <span className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                {t("washes")}
              </span>
              <span className="mt-2 text-2xl font-bold text-[color:var(--blue)]" dir="ltr">
                {formatQar(plan.price, lang)}
              </span>
              <span className="text-sm font-semibold text-[color:var(--navy)]"><bdi dir="ltr">{formatQar(plan.price / plan.washes_count, lang, 0)}</bdi> / {t("wash")}</span>
              {baselinePerWash > plan.price / plan.washes_count && <span className="text-xs font-semibold text-emerald-700">{t("Save")} {Math.round((1 - (plan.price / plan.washes_count) / baselinePerWash) * 100)}%</span>}
              <span className="text-xs text-[color:var(--muted-foreground)]">
                {lang === "ar" ? `صالح لمدة ${plan.validity_days} يومًا` : `Valid for ${plan.validity_days} days`}
              </span>
              {(lang === "ar" ? plan.description_ar ?? plan.description : plan.description) && (
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">
                  {lang === "ar" ? plan.description_ar ?? plan.description : plan.description}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => selectPlan(plan)}
                className="primary-button mt-4 w-full disabled:opacity-40"
              >
                {busy && buyingPlan?.id === plan.id ? t("Buying…") : t("Choose this plan")}
              </button>
            </article>
          ))}
        </div>
      </main>
      <Footer />

      {/* Plan review — no request is created until the customer confirms. */}
      {confirmingPlan && buyingPlan && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmingPlan(false);
              setBuyingPlan(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-membership-title"
            className="booking-products-dialog w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
          >
            <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--blue)]">{t("Review your selection")}</p>
              <h2 id="confirm-membership-title" className="mt-2 text-2xl font-bold text-[color:var(--navy)]">{t("Confirm membership")}</h2>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{t("Check the details before continuing. No request has been sent yet.")}</p>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-[color:var(--navy)]">{localized(lang, buyingPlan.name, buyingPlan.name_ar)}</p>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-[color:var(--muted-foreground)]">{t("Wash type")}</dt><dd className="mt-0.5 font-bold">{t(SCOPES.find((item) => item.key === buyingPlan.scope)?.label ?? "Membership")}</dd></div>
                  <div><dt className="text-[color:var(--muted-foreground)]">{t("Vehicle")}</dt><dd className="mt-0.5 font-bold">{buyingPlan.vehicle_type === "suv" ? t("SUV / 4-Wheel") : buyingPlan.vehicle_type === "sedan" ? t("Salon / Sedan") : t("Any vehicle")}</dd></div>
                  <div><dt className="text-[color:var(--muted-foreground)]">{t("Included")}</dt><dd className="mt-0.5 font-bold">{buyingPlan.washes_count} {t("washes")}</dd></div>
                  <div><dt className="text-[color:var(--muted-foreground)]">{t("Validity")}</dt><dd className="mt-0.5 font-bold">{buyingPlan.validity_days} {t("days")}</dd></div>
                </dl>
              </div>
              <div className="flex items-end justify-between border-t border-slate-200 pt-4"><div><p className="text-sm font-semibold text-[color:var(--muted-foreground)]">{t("Total")}</p><p className="mt-1 text-xs text-[color:var(--muted-foreground)]"><bdi dir="ltr">{formatQar(buyingPlan.price / buyingPlan.washes_count, lang, 0)}</bdi> / {t("wash")}</p></div><p className="text-3xl font-extrabold text-[color:var(--navy)]" dir="ltr">{formatQar(buyingPlan.price, lang)}</p></div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">
              <button type="button" className="secondary-button min-h-14" onClick={() => { setConfirmingPlan(false); setBuyingPlan(null); }}>{t("Go back")}</button>
              <button type="button" className="primary-button min-h-14 px-4 disabled:opacity-50" disabled={busy} onClick={confirmPlan}>{busy ? t("Processing…") : t("Confirm and continue")}</button>
            </div>
          </section>
        </div>
      )}

      {/* Auth modal for guest purchase */}
      {needsAuth && buyingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <AuthPanel
              title={t("Sign in to buy a membership.")}
              onClose={() => {
                setNeedsAuth(false);
                setBuyingPlan(null);
              }}
              onAuthed={async () => {
                setNeedsAuth(false);
                setAuthed(true);
                refreshMine();
                await purchase(buyingPlan);
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
