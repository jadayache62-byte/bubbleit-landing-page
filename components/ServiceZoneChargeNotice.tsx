"use client";

import { useI18n } from "@/lib/i18n";
import { formatQar } from "@/lib/money";

export function ServiceZoneChargeNotice({
  rate,
  compact = false,
}: {
  rate: number | null | undefined;
  compact?: boolean;
}) {
  const { lang, t } = useI18n();

  if (!(typeof rate === "number" && rate > 0)) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 ${compact ? "px-4 py-3" : "p-4"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-800"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="M12 21s6-5.35 6-11a6 6 0 1 0-12 0c0 5.65 6 11 6 11Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-bold">{t("Additional service-zone charge")}</p>
          <p className="mt-1 text-sm leading-6 text-amber-900">
            {t("This location is subject to an additional service charge of {amount}. It is included in the total shown at checkout.").replace(
              "{amount}",
              formatQar(rate, lang),
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
