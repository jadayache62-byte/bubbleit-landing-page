"use client";

// Generic auth-method continuation: the anonymous phone boundary never reveals
// whether an account or password exists. The customer chooses password sign-in,
// registration/account claim, or OTP-backed recovery.

import { useEffect, useState, type MouseEventHandler } from "react";
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

type Stage = "phone" | "method" | "password" | "otp_login" | "register" | "register_code" | "forgot";

const OTP_RESEND_DELAY_SECONDS = 30;

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

function localQatarDigits(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("974")) digits = digits.slice(3);
  return digits.slice(0, 8);
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
  const { lang, t } = useI18n();
  const [stage, setStage] = useState<Stage>("phone");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendAvailableAt === null) return;

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
      setResendSeconds(remaining);
      if (remaining === 0) setResendAvailableAt(null);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 250);

    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  function beginResendCooldown() {
    setResendSeconds(OTP_RESEND_DELAY_SECONDS);
    setResendAvailableAt(Date.now() + OTP_RESEND_DELAY_SECONDS * 1000);
  }

  function resetResendCooldown() {
    setResendAvailableAt(null);
    setResendSeconds(0);
  }

  function fail(e: unknown) {
    setError(e instanceof ApiError ? e.message : t("Something went wrong. Please try again."));
  }

  async function submitPhone() {
    setBusy(true);
    setError(null);
    try {
      const normalizedPhone = normalizeQatarPhone(phone);
      setPhone(normalizedPhone);
      await checkPhone(normalizedPhone);
      setStage("method");
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
      await requestOtp(normalizeQatarPhone(phone), "registration");
      beginResendCooldown();
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
      await requestOtp(normalizeQatarPhone(phone), "authentication");
      beginResendCooldown();
      setCode("");
      setStage("forgot");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function startOtpLogin() {
    setBusy(true);
    setError(null);
    try {
      await requestOtp(normalizeQatarPhone(phone), "authentication");
      beginResendCooldown();
      setCode("");
      setStage("otp_login");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitOtpLogin() {
    setBusy(true);
    setError(null);
    try {
      const result = await verifyOtp(normalizeQatarPhone(phone), code.trim());
      setCode("");
      onAuthed(result.customer);
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
      setPassword("");
      setNewPassword("");
      setCode("");
      setNotice(t("Your password was reset. Sign in again on this device."));
      setStage("password");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  function resendControl(onResend: MouseEventHandler<HTMLButtonElement>) {
    const waiting = resendSeconds > 0;
    const formattedSeconds = new Intl.NumberFormat(lang === "ar" ? "ar-QA" : "en-QA").format(
      resendSeconds,
    );

    return (
      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3">
        <p
          {...(!waiting ? { role: "status" as const } : {})}
          className="text-xs font-medium text-[color:var(--muted-foreground)]"
        >
          {waiting
            ? t("You can request a new code in {seconds} seconds.").replace(
                "{seconds}",
                formattedSeconds,
              )
            : t("You can request a new code now.")}
        </p>
        <button
          type="button"
          className="mt-2 min-h-11 cursor-pointer rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-[color:var(--blue)] transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || waiting}
          onClick={onResend}
        >
          {busy ? t("Sending…") : t("Request a new code")}
        </button>
      </div>
    );
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
          setPhone(localQatarDigits(phone));
          setPassword("");
          setCode("");
          setError(null);
          resetResendCooldown();
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
              placeholder="5555 5555"
              inputMode="numeric"
              autoComplete="tel-national"
              dir="ltr"
              maxLength={8}
              pattern="[0-9]*"
              value={phone}
              onChange={(e) => setPhone(localQatarDigits(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && phone.replace(/\D/g, "").length === 8 && submitPhone()}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || phone.replace(/\D/g, "").length !== 8}
              onClick={submitPhone}
            >
              {busy ? "…" : t("Continue")}
            </button>
          </>
        )}

        {stage === "password" && (
          <>
            {phoneChip}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("Enter your account password.")}
            </p>
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
              className="secondary-button"
              disabled={busy}
              onClick={startOtpLogin}
            >
              {busy ? t("Sending…") : t("Sign in with verification code")}
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

        {stage === "method" && (
          <>
            {phoneChip}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("Choose how you would like to continue.")}
            </p>
            <button type="button" className="primary-button" onClick={() => setStage("password")}>
              {t("Sign in with password")}
            </button>
            <button type="button" className="secondary-button" disabled={busy} onClick={startOtpLogin}>
              {busy ? t("Sending…") : t("Sign in with verification code")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setStage("register")}>
              {t("Create or claim an account")}
            </button>
            <button
              type="button"
              className="cursor-pointer self-center border-none bg-transparent p-2 text-sm font-semibold text-[color:var(--blue)] hover:underline"
              disabled={busy}
              onClick={startForgot}
            >
              {busy ? t("Sending…") : t("Reset my password")}
            </button>
          </>
        )}

        {stage === "register" && (
          <>
            {phoneChip}
            <p className="text-sm font-semibold text-[color:var(--blue)]">
              {t("Create or claim your account after phone verification.")}
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
              {busy ? t("Sending…") : t("Verify your phone")}
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
              {t("We sent a 6-digit verification code to your phone. Enter it to finish.")}
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
            {resendControl(sendRegisterCode)}
          </>
        )}

        {stage === "otp_login" && (
          <>
            {phoneChip}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("We sent a 6-digit verification code to your phone. Enter it to sign in.")}
            </p>
            <input
              className="wizard-input tracking-[0.4em]"
              aria-label={t("Verification code")}
              placeholder="••••••"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              autoFocus
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && code.length === 6 && submitOtpLogin()}
            />
            <button
              type="button"
              className="primary-button disabled:opacity-40"
              disabled={busy || code.length !== 6}
              onClick={submitOtpLogin}
            >
              {busy ? t("Verifying…") : t("Sign in")}
            </button>
            {resendControl(startOtpLogin)}
          </>
        )}

        {stage === "forgot" && (
          <>
            {phoneChip}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {t("We sent a 6-digit verification code to your phone. Enter it and choose a new password.")}
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
            {resendControl(startForgot)}
          </>
        )}

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {notice}
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
          aria-label={t("Close")}
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
