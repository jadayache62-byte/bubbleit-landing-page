"use client";

import clsx from "clsx";

export type AppToastTone = "danger" | "success" | "warning" | "info";

const TONE_STYLES: Record<AppToastTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

export function AppToast({
  title,
  message,
  tone = "danger",
  dismissLabel,
  onDismiss,
}: {
  title?: string;
  message: string;
  tone?: AppToastTone;
  dismissLabel: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[100] flex justify-center sm:inset-x-6 sm:top-5">
      <div
        role={tone === "danger" ? "alert" : "status"}
        aria-live={tone === "danger" ? "assertive" : "polite"}
        className={clsx(
          "pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_16px_45px_rgba(15,23,42,0.2)]",
          TONE_STYLES[tone],
        )}
      >
        <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0" fill="none" aria-hidden="true">
          {tone === "success" ? (
            <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
              <path d="M12 7.5v5M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </>
          )}
        </svg>
        <span className="min-w-0 flex-1 leading-6">
          {title && <span className="block font-extrabold">{title}</span>}
          <span className={clsx("block", title && "mt-0.5 font-medium")}>{message}</span>
        </span>
        {onDismiss && (
          <button
            type="button"
            aria-label={dismissLabel}
            className="-m-2 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-xl leading-none hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
            onClick={onDismiss}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
    </div>
  );
}
