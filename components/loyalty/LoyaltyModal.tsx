"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import clsx from "clsx";
import { getLoyaltyProgram } from "@/lib/api/client";
import type { LoyaltyProgram } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

const AUTO_PROMPT_KEY = "bubbleit.loyalty.spotlight.seen.v1";
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type LoyaltyModalProps = {
  placement: "services" | "booking" | "account";
  autoPrompt?: boolean;
  program?: LoyaltyProgram | null;
  className?: string;
};

export function LoyaltyModal({
  placement,
  autoPrompt = false,
  program: suppliedProgram,
  className,
}: LoyaltyModalProps) {
  const { t } = useI18n();
  const [fetchedProgram, setFetchedProgram] = useState<LoyaltyProgram | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const promptTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const program = suppliedProgram === undefined ? fetchedProgram : suppliedProgram;

  useEffect(() => {
    if (suppliedProgram !== undefined) return;
    let active = true;
    getLoyaltyProgram()
      .then((value) => active && setFetchedProgram(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [suppliedProgram]);

  useEffect(() => {
    if (!autoPrompt || !program?.enabled || !triggerRef.current) return;
    if (window.sessionStorage.getItem(AUTO_PROMPT_KEY)) return;

    const trigger = triggerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
          if (promptTimerRef.current !== null) window.clearTimeout(promptTimerRef.current);
          promptTimerRef.current = null;
          return;
        }
        if (promptTimerRef.current !== null) return;
        promptTimerRef.current = window.setTimeout(() => {
          window.sessionStorage.setItem(AUTO_PROMPT_KEY, "1");
          setOpen(true);
          observer.disconnect();
        }, 1200);
      },
      { threshold: [0.6] },
    );
    observer.observe(trigger);

    return () => {
      observer.disconnect();
      if (promptTimerRef.current !== null) window.clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    };
  }, [autoPrompt, program?.enabled]);

  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const trigger = triggerRef.current;
    const scrollY = window.scrollY;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      window.scrollTo({ top: scrollY, behavior: "auto" });
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!program?.enabled) return null;

  const openModal = () => {
    window.sessionStorage.setItem(AUTO_PROMPT_KEY, "1");
    setOpen(true);
  };

  const trigger = placement === "services" ? (
    <button
      ref={triggerRef}
      type="button"
      onClick={openModal}
      aria-haspopup="dialog"
      className={clsx(
        "group inline-flex min-h-12 cursor-pointer items-center gap-3 rounded-full border border-sky-200 bg-white px-3 py-2 text-start shadow-[0_12px_34px_rgba(20,137,222,0.14)] transition-[border-color,box-shadow,background-color] duration-200 hover:border-[color:var(--blue)] hover:bg-sky-50 hover:shadow-[0_16px_38px_rgba(20,137,222,0.2)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[color:var(--blue)] sm:px-4",
        className,
      )}
    >
      <RewardIcon className="h-9 w-9 shrink-0 rounded-full bg-[color:var(--navy)] p-2 text-[color:var(--cyan)]" />
      <span>
        <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-[color:var(--blue)]">{t("Bubbleit Rewards")}</span>
        <span className="block text-sm font-extrabold text-[color:var(--navy)] sm:text-base">{t("Your 6th wash is on us")}</span>
      </span>
      <span className="ms-1 hidden items-center gap-1 text-xs font-bold text-[color:var(--blue)] sm:inline-flex">
        {t("See how it works")}
        <ArrowIcon />
      </span>
    </button>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      onClick={openModal}
      aria-haspopup="dialog"
      className={clsx(
        "group inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-[color:var(--navy)] transition-colors duration-200 hover:border-[color:var(--blue)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]",
        className,
      )}
    >
      <RewardIcon className="h-5 w-5 text-[color:var(--blue)]" />
      {placement === "booking" ? t("Unlock every 6th matching wash") : t("How rewards work")}
      <ArrowIcon />
    </button>
  );

  return (
    <>
      {trigger}
      {open && typeof document !== "undefined" && createPortal(
        <div
          className="loyalty-modal-backdrop fixed inset-0 z-[110] grid items-end bg-slate-950/60 p-0 backdrop-blur-[2px] sm:place-items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="loyalty-modal-dialog max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[2rem] bg-white shadow-[0_32px_100px_rgba(15,23,42,0.38)] sm:max-w-2xl sm:rounded-[2rem]"
          >
            <div className="relative overflow-hidden bg-[color:var(--navy)] px-5 pb-7 pt-5 text-white sm:px-8 sm:pb-9 sm:pt-7">
              <div className="pointer-events-none absolute -end-16 -top-24 h-56 w-56 rounded-full bg-[color:var(--cyan)]/20 blur-3xl" />
              <div className="relative flex items-start justify-between gap-4">
                <span className="inline-flex min-h-8 items-center rounded-full border border-white/20 bg-white/10 px-3 text-xs font-extrabold uppercase tracking-[0.16em] text-[color:var(--cyan)]">
                  {t("Bubbleit Rewards")}
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={t("Close rewards details")}
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-colors duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              <div className="relative mt-5">
                <h2 id={titleId} className="max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  {t("Five matching washes. The next one’s on us.")}
                </h2>
                <p id={descriptionId} className="mt-3 max-w-xl text-sm leading-6 text-white/80 sm:text-base sm:leading-7">
                  {t("Book the same service for the same vehicle class five times. We’ll automatically unlock the matching base wash as your reward.")}
                </p>
              </div>

              <div className="relative mt-6 grid grid-cols-6 items-center gap-2" role="img" aria-label={t("Five paid washes unlock one free wash")}>
                {Array.from({ length: 5 }, (_, index) => (
                  <span key={index} className="grid aspect-square place-items-center rounded-full border border-white/20 bg-white text-xs font-extrabold text-[color:var(--navy)] shadow-sm sm:text-sm" aria-hidden="true">
                    {index + 1}
                  </span>
                ))}
                <span className="grid aspect-square place-items-center rounded-full bg-[color:var(--cyan)] text-[color:var(--navy)] shadow-[0_0_0_5px_rgba(0,204,255,0.14)]" aria-hidden="true">
                  <RewardIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
              </div>
            </div>

            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <div className="grid gap-3 sm:grid-cols-3">
                <BenefitStep number="1" title={t("Book as usual")} copy={t("Each completed eligible wash adds one stamp automatically.")} />
                <BenefitStep number="2" title={t("Keep it matching")} copy={t("Use the same service and vehicle class to build that reward.")} />
                <BenefitStep number="3" title={t("Enjoy wash six")} copy={t("Your matching base wash is free; extras stay optional and payable.")} />
              </div>

              <div className="mt-5 flex flex-wrap gap-2" aria-label={t("Reward benefits")}>
                <BenefitChip icon="check" label={t("Tracked automatically")} />
                <BenefitChip icon="clock" label={t("Progress never expires")} />
                <BenefitChip icon="spark" label={t("No promo code needed")} />
              </div>

              <p className="mt-5 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {t("Eligible paid washes earn progress. Membership-covered and reward-covered washes do not. Rewards cover the base wash only.")}
              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button type="button" onClick={() => setOpen(false)} className="min-h-11 cursor-pointer px-4 text-sm font-bold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--navy)]">
                  {t("Maybe later")}
                </button>
                {placement === "booking" ? (
                  <button type="button" onClick={() => setOpen(false)} className="primary-button min-h-12 px-7">
                    {t("Choose my wash")}
                  </button>
                ) : (
                  <Link href="/book" className="primary-button min-h-12 px-7" onClick={() => setOpen(false)}>
                    {placement === "account" ? t("Book toward my reward") : t("Start earning my free wash")}
                  </Link>
                )}
              </div>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

function BenefitStep({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--navy)] text-xs font-extrabold text-white">{number}</span>
      <h3 className="mt-3 text-sm font-extrabold text-[color:var(--navy)]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{copy}</p>
    </div>
  );
}

function BenefitChip({ icon, label }: { icon: "check" | "clock" | "spark"; label: string }) {
  const path = icon === "check"
    ? <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    : icon === "clock"
      ? <><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>
      : <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Zm5 10 .8 2.2L20 16l-2.2.8L17 19l-.8-2.2L14 16l2.2-.8L17 13Z" fill="currentColor" />;
  return (
    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-sky-50 px-3 text-xs font-bold text-[color:var(--navy)]">
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-[color:var(--blue)]" fill="none" aria-hidden="true">{path}</svg>
      {label}
    </span>
  );
}

function RewardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path d="M4 9h16v11H4V9Zm-1-4h18v4H3V5Zm9 0v15M8.5 5C6.4 5 5 4 5 2.8 5 1.8 5.8 1 6.8 1 9 1 12 5 12 5m3.5 0C17.6 5 19 4 19 2.8 19 1.8 18.2 1 17.2 1 15 1 12 5 12 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" fill="none" aria-hidden="true">
      <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
