"use client";

import { useState } from "react";
import { ApiError, requestOtp, verifyOtp } from "@/lib/api/client";
import type { Customer } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

export function OtpSignIn({
  title,
  onAuthed,
  onClose,
}: {
  title?: string;
  onAuthed: (customer: Customer) => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await requestOtp(phone.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp(phone.trim(), otp.trim());
      onAuthed(result.customer);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-panel relative rounded-[var(--radius-card)] p-8 sm:p-10">
      {onClose && (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute end-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-none bg-[color:var(--background)] text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)]"
        >
          ✕
        </button>
      )}
      <span className="section-kicker">{t("My Account")}</span>
      <h1 className="mt-4 text-2xl font-bold">{title ?? t("Sign in with your phone")}</h1>
      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
        {t("We'll text you a 6-digit code — no passwords needed.")}
      </p>

      <div className="mt-6 flex flex-col gap-4">
        <input
          className="wizard-input"
          placeholder="+974 5555 5555"
          inputMode="tel"
          dir="ltr"
          value={phone}
          disabled={sent}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s]/g, ""))}
        />
        {sent && (
          <>
            <input
              className="wizard-input tracking-[0.4em]"
              placeholder="••••••"
              inputMode="numeric"
              dir="ltr"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <span className="flex items-center gap-4">
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[color:var(--blue)] hover:underline"
                onClick={send}
              >
                {t("Resend code")}
              </button>
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)] hover:underline"
                onClick={() => {
                  setSent(false);
                  setOtp("");
                  setError(null);
                }}
              >
                {t("Change phone number")}
              </button>
            </span>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {!sent ? (
          <button
            type="button"
            className="primary-button disabled:opacity-40"
            disabled={busy || phone.replace(/\D/g, "").length < 7}
            onClick={send}
          >
            {busy ? t("Sending…") : t("Send code")}
          </button>
        ) : (
          <button
            type="button"
            className="primary-button disabled:opacity-40"
            disabled={busy || otp.length !== 6}
            onClick={verify}
          >
            {busy ? t("Verifying…") : t("Sign in")}
          </button>
        )}
      </div>
    </div>
  );
}
