"use client";

// Password-first sign-in: OTP messages cost money, so codes are only sent for
// first-time registration and forgot-password. Returning customers sign in
// with phone + password.

import { useState } from "react";
import clsx from "clsx";
import {
  ApiError,
  checkPhone,
  loginWithPassword,
  register,
  requestOtp,
  updateProfile,
  verifyOtp,
} from "@/lib/api/client";
import type { Customer } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";

type Stage = "phone" | "password" | "claim" | "register" | "register_code" | "forgot";

function normalizeQatarPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("974") && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 8) {
    return `+974${digits}`;
  }
  return value.trim().replace(/\s+/g, "");
}

export function AuthPanel({
  title,
  inline = false,
  onAuthed,
  onClose,
}: {
  title?: string;
  /** Render without the outer glass panel (embedded in the wizard). */
  inline?: boolean;
  onAuthed: (customer: Customer) => void;
  onClose?: () => void;
}) {
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
  }

  async function submitPhone() {
    setBusy(true);
    setError(null);
    try {
      const normalizedPhone = normalizeQatarPhone(phone);
      setPhone(normalizedPhone);
      const { registered, has_password: hasPassword } = await checkPhone(normalizedPhone);
      // Older customer APIs returned only `registered`. Treat a missing
      // has_password flag as a normal returning account; only an explicit
      // false means this is a manager-created account that still needs claiming.
      setStage(registered ? (hasPassword === false ? "claim" : "password") : "register");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin() {
    setBusy(true);
    setError(null);
    try {
      const result = await loginWithPassword(normalizeQatarPhone(phone), password);
      onAuthed(result.customer);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function sendRegisterCode() {
    setBusy(true);
    setError(null);
    try {
      await requestOtp(normalizeQatarPhone(phone));
      setStage("register_code");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister() {
    setBusy(true);
    setError(null);
    try {
      const result = await register({
        phone: normalizeQatarPhone(phone),
        name: name.trim(),
        password,
        code: code.trim(),
      });
      onAuthed(result.customer);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function startForgot() {
    setBusy(true);
    setError(null);
    try {
      await requestOtp(normalizeQatarPhone(phone));
      setCode("");
      setStage("forgot");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot() {
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp(normalizeQatarPhone(phone), code.trim());
      if (newPassword.length >= 6) {
        await updateProfile({ name: result.customer.name || "-", password: newPassword });
      }
      onAuthed(result.customer);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const phoneChip = (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700" dir="ltr">
        ✓ {phone}
      </span>
      <button
        type="button"
        className="cursor-pointer border-none bg-transparent p-0 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)] hover:underline"
        onClick={() => {
          setStage("phone");
          setPassword("");
          setCode("");
          setError(null);
        }}
      >
        {t("Change phone number")}
      </button>
    </div>
  );

  const body = (
    <>
      {!inline && (
        <>
          <span className="section-kicker">{t("My Account")}</span>
          <h1 className="mt-4 text-2xl font-bold">{title ?? t("Sign in with your phone")}</h1>
        </>
      )}
      {inline && title && <h3 className="text-lg font-bold">{title}</h3>}

      <div className={clsx("flex flex-col gap-4", inline ? "mt-3" : "mt-6")}>
        {stage === "phone" && (
          <>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("Enter your phone number to sign in or create your account.")}
            </p>
            <input
              className="wizard-input"
              placeholder="+974 5555 5555"
              inputMode="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+\s]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && phone.replace(/\D/g, "").length >= 7 && submitPhone()}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || phone.replace(/\D/g, "").length < 7}
              onClick={submitPhone}
            >
              {busy ? "…" : t("Continue")}
            </button>
          </>
        )}

        {stage === "password" && (
          <>
            {phoneChip}
            <p className="text-sm font-semibold text-emerald-700">{t("Welcome back!")}</p>
            <input
              className="wizard-input"
              type="password"
              placeholder={t("Password")}
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && password && submitLogin()}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || !password}
              onClick={submitLogin}
            >
              {busy ? t("Verifying…") : t("Sign in")}
            </button>
            <button
              type="button"
              className="cursor-pointer self-start border-none bg-transparent p-0 text-xs font-semibold text-[color:var(--blue)] hover:underline"
              onClick={startForgot}
            >
              {t("Forgot password?")}
            </button>
          </>
        )}

        {(stage === "register" || stage === "claim") && (
          <>
            {phoneChip}
            <p className="text-sm font-semibold text-[color:var(--blue)]">
              {stage === "claim"
                ? "Existing booking account — add a password to continue."
                : t("New number — let's set up your account.")}
            </p>
            <input
              className="wizard-input"
              placeholder={t("Your name")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="wizard-input"
              type="password"
              placeholder={t("Add a password for your account")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || !name.trim() || password.length < 6}
              onClick={sendRegisterCode}
            >
              {busy ? t("Sending…") : t("Verify on WhatsApp")}
            </button>
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-[color:var(--muted-foreground)]">
                {t("Password must be at least 6 characters.")}
              </p>
            )}
          </>
        )}

        {stage === "register_code" && (
          <>
            {phoneChip}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("We sent a 6-digit code to your WhatsApp — enter it to finish.")}
            </p>
            <input
              className="wizard-input tracking-[0.4em]"
              placeholder="••••••"
              inputMode="numeric"
              dir="ltr"
              maxLength={6}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || code.length !== 6}
              onClick={submitRegister}
            >
              {busy ? t("Verifying…") : t("Create account")}
            </button>
            <button
              type="button"
              className="cursor-pointer self-start border-none bg-transparent p-0 text-xs font-semibold text-[color:var(--blue)] hover:underline"
              onClick={sendRegisterCode}
            >
              {t("Resend code")}
            </button>
          </>
        )}

        {stage === "forgot" && (
          <>
            {phoneChip}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("We sent a 6-digit code to your WhatsApp. Enter it and choose a new password.")}
            </p>
            <input
              className="wizard-input tracking-[0.4em]"
              placeholder="••••••"
              inputMode="numeric"
              dir="ltr"
              maxLength={6}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <input
              className="wizard-input"
              type="password"
              placeholder={t("New password")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || code.length !== 6 || newPassword.length < 6}
              onClick={submitForgot}
            >
              {busy ? t("Verifying…") : t("Sign in")}
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </>
  );

  if (inline) return <div className="rounded-3xl border border-[color:var(--border)] bg-white/70 p-5">{body}</div>;

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
      {body}
    </div>
  );
}
