"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { ApiError, getCustomerReviewInvitation, submitCustomerReview } from "@/lib/api/client";
import type { CustomerReviewInvitation } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

export function ReviewPageClient({ invitation }: { invitation: string }) {
  const { lang, t } = useI18n();
  const [entry, setEntry] = useState<CustomerReviewInvitation | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getCustomerReviewInvitation(invitation);
      setEntry(next);
      setRating(next.review?.rating ?? 0);
      setComment(next.review?.comment ?? "");
      setAuthRequired(false);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setAuthRequired(true);
      } else {
        setError(caught instanceof ApiError ? caught.message : t("We couldn't load this review request."));
      }
    } finally {
      setLoading(false);
    }
  }, [invitation, t]);

  useEffect(() => {
    queueMicrotask(() => load().catch(() => undefined));
  }, [load]);

  async function submit() {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      setEntry(await submitCustomerReview(invitation, rating, comment));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("We couldn't submit your review."));
    } finally {
      setSubmitting(false);
    }
  }

  const serviceName = entry ? (lang === "ar" ? entry.service.name_ar || entry.service.name_en : entry.service.name_en) : "";

  return (
    <>
      <Navbar />
      <main id="main-content" className="section-shell flex min-h-[70dvh] items-center py-8 sm:py-14">
        <section className="mx-auto w-full max-w-xl" aria-labelledby="review-title">
          {loading ? (
            <div className="commerce-card space-y-5 p-6 sm:p-8" role="status" aria-label={t("Loading your review…")}>
              <div className="h-5 w-32 animate-pulse rounded-full bg-slate-200" />
              <div className="h-10 w-4/5 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : authRequired ? (
            <div className="commerce-card p-5 sm:p-8">
              <p className="mb-5 text-center text-sm leading-6 text-[color:var(--muted-foreground)]">
                {t("Sign in with the phone number used for this booking to leave your review.")}
              </p>
              <AuthPanel title={t("Sign in to review your wash")} onAuthed={() => load()} />
            </div>
          ) : error && !entry ? (
            <div className="commerce-card p-6 text-center sm:p-8">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-2xl" aria-hidden="true">!</div>
              <h1 id="review-title" className="mt-5 text-2xl font-bold text-[color:var(--navy)]">{t("Review unavailable")}</h1>
              <p role="alert" className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">{error}</p>
              <button type="button" className="primary-button mt-6" onClick={() => load()}>{t("Try again")}</button>
            </div>
          ) : entry?.state === "expired" ? (
            <div className="commerce-card p-6 text-center sm:p-8">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-2xl" aria-hidden="true">⌛</div>
              <h1 id="review-title" className="mt-5 text-2xl font-bold text-[color:var(--navy)]">{t("This review request has expired")}</h1>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">{t("Thank you for choosing Bubbleit. This review can no longer be changed.")}</p>
              <Link href="/account?tab=bookings" className="primary-button mt-6">{t("View my bookings")}</Link>
            </div>
          ) : entry?.state === "submitted" ? (
            <div className="commerce-card p-6 text-center sm:p-8" role="status" aria-live="polite">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-2xl text-emerald-700" aria-hidden="true">✓</div>
              <h1 id="review-title" className="mt-5 text-2xl font-bold text-[color:var(--navy)]">{t("Thank you for your feedback")}</h1>
              <p className="mt-2 text-sm font-semibold text-[color:var(--blue)]">{serviceName}</p>
              <p className="mt-4 text-sm leading-6 text-[color:var(--muted-foreground)]">{t("Your review was submitted and is awaiting moderation.")}</p>
              <div className="mt-5 flex justify-center gap-1 text-2xl text-amber-400" aria-label={`${entry.review?.rating ?? rating} ${t("out of 5 stars")}`}>
                {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= (entry.review?.rating ?? rating) ? "text-amber-400" : "text-slate-200"} aria-hidden="true">★</span>)}
              </div>
              <Link href="/account?tab=bookings" className="primary-button mt-7">{t("View my bookings")}</Link>
            </div>
          ) : entry ? (
            <div className="commerce-card overflow-hidden">
              <header className="bg-[color:var(--navy)] px-6 py-7 text-center text-white sm:px-8">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/65">{t("Completed service")}</p>
                <h1 id="review-title" className="mt-2 text-2xl font-bold sm:text-3xl">{t("How was your wash?")}</h1>
                <p className="mt-2 text-sm text-white/75">{serviceName} · <bdi dir="ltr">{entry.booking_reference}</bdi></p>
              </header>
              <div className="p-6 sm:p-8">
                <fieldset>
                  <legend className="w-full text-center text-base font-bold text-[color:var(--navy)]">{t("Choose a star rating")}</legend>
                  <div className="mt-4 flex justify-center gap-1 sm:gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <label key={star} className="grid min-h-12 min-w-12 cursor-pointer place-items-center rounded-xl transition hover:bg-amber-50 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-[color:var(--blue)]">
                        <input
                          type="radio"
                          name="rating"
                          value={star}
                          checked={rating === star}
                          onChange={() => setRating(star)}
                          className="sr-only"
                          aria-label={`${star} ${star === 1 ? t("star") : t("stars")}`}
                        />
                        <span className={`text-4xl leading-none ${star <= rating ? "text-amber-400" : "text-slate-200"}`} aria-hidden="true">★</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <label htmlFor="review-comment" className="mt-7 block text-sm font-bold text-[color:var(--navy)]">
                  {t("Notes (optional)")}
                </label>
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder={t("Tell us what went well or what we can improve…")}
                  className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[color:var(--navy)] placeholder:text-slate-400"
                />
                <div className="mt-1 text-end text-xs text-slate-500"><span aria-hidden="true">{comment.length}/2000</span><span className="sr-only">{t("characters used")}</span></div>

                {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
                <button
                  type="button"
                  className="primary-button mt-5 w-full text-base disabled:opacity-50"
                  disabled={rating === 0 || submitting}
                  onClick={submit}
                >
                  {submitting ? t("Submitting…") : t("Submit review")}
                </button>
                {rating === 0 && <p className="mt-3 text-center text-xs text-[color:var(--muted-foreground)]">{t("Select a rating to continue.")}</p>}
              </div>
            </div>
          ) : null}
        </section>
      </main>
      <Footer />
    </>
  );
}
