"use client";

import clsx from "clsx";
import type { PaymentChannel, PaymentOptions } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

export function PaymentMethodSelector({
  options,
  value,
  onChange,
}: {
  options: PaymentOptions | null;
  value: PaymentChannel;
  onChange: (channel: PaymentChannel) => void;
}) {
  const { t } = useI18n();

  if (!options) {
    return <div className="h-20 animate-pulse rounded-2xl bg-slate-100" aria-label={t("Loading payment methods…")} />;
  }

  if (options.mode === "cash") {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status">
        <p className="font-bold text-amber-950">{t("Cash payment")}</p>
        <p className="mt-1 text-sm leading-6 text-amber-900">
          {t("Online payment is temporarily unavailable. Pay the full amount to the assigned driver or team member when your service or delivery arrives. Membership benefits activate only after cash is recorded.")}
        </p>
      </section>
    );
  }

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-bold text-[color:var(--navy)]">{t("Payment method")}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.methods.map((method) => (
          <label
            key={method.channel}
            className={clsx(
              "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition",
              value === method.channel
                ? "border-[color:var(--blue)] bg-blue-50 ring-2 ring-blue-100"
                : "border-[color:var(--border)] bg-white hover:border-[color:var(--blue)]",
            )}
          >
            <input
              type="radio"
              name="payment-channel"
              value={method.channel}
              checked={value === method.channel}
              onChange={() => onChange(method.channel)}
              className="h-5 w-5 accent-[color:var(--blue)]"
            />
            <span>
              <span className="block text-sm font-bold text-[color:var(--navy)]">{t(method.label)}</span>
              <span className="mt-0.5 block text-xs text-[color:var(--muted-foreground)]">
                {method.channel === "skipcash_qpay"
                  ? t("Continue directly to QPAY debit-card checkout.")
                  : t("Secure SkipCash checkout with cards and Apple Pay when available.")}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
