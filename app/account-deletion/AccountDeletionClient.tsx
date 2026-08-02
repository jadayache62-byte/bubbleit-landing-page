"use client";

import { useEffect, useState } from "react";
import { AppToast } from "@/components/AppToast";
import { AuthPanel } from "@/components/booking/AuthPanel";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import {
  ApiError,
  createCustomerDataExport,
  deleteCustomerAccount,
  downloadCustomerDataExport,
  me,
  requestOtp,
} from "@/lib/api/client";
import type { Customer, CustomerDeletionResult } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { LEGAL_POLICY_VERSION } from "@/lib/legal/policies";

export function AccountDeletionClient() {
  const { t } = useI18n();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [checked, setChecked] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"otp" | "export" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<CustomerDeletionResult | null>(null);

  useEffect(() => {
    me().then(setCustomer).catch(() => setCustomer(null)).finally(() => setChecked(true));
  }, []);

  async function exportData() {
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const request = await createCustomerDataExport();
      const data = await downloadCustomerDataExport(request.request_id, request.token);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bubbleit-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage(t("Your data export was downloaded."));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("The request could not be completed."));
    } finally {
      setBusy(null);
    }
  }

  async function sendDeletionCode() {
    if (!customer) return;
    setBusy("otp");
    setError(null);
    setMessage(null);
    try {
      await requestOtp(customer.phone, "authentication");
      setOtpSent(true);
      setMessage(t("A fresh verification code was sent to your registered phone."));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("The request could not be completed."));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    setBusy("delete");
    setError(null);
    setMessage(null);
    try {
      const result = await deleteCustomerAccount(code);
      setDeleted(result);
      setCustomer(null);
      setCode("");
      setConfirmed(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("The request could not be completed."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Navbar />
      {error ? (
        <AppToast
          message={error}
          dismissLabel={t("Dismiss message")}
          onDismiss={() => setError(null)}
        />
      ) : message ? (
        <AppToast
          message={message}
          tone="success"
          dismissLabel={t("Dismiss message")}
          onDismiss={() => setMessage(null)}
        />
      ) : null}
      <main id="main-content" className="section-shell min-h-[60dvh] py-10 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <header>
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[color:var(--cyan-dark)]">{t("Policy version")} {LEGAL_POLICY_VERSION}</p>
            <h1 className="mt-3 text-3xl font-extrabold text-[color:var(--navy)] sm:text-5xl">{t("Account data and deletion")}</h1>
            <p className="mt-4 text-base leading-7 text-[color:var(--muted-foreground)] sm:text-lg">{t("Download your BubbleIt data or permanently delete your account. Deletion cannot be undone.")}</p>
          </header>

          {!checked ? (
            <div className="commerce-card mt-8 h-56 animate-pulse bg-slate-100" role="status" />
          ) : deleted ? (
            <section className="commerce-card mt-8 border-emerald-200 bg-emerald-50 p-6 sm:p-8" role="status">
              <h2 className="text-2xl font-extrabold text-emerald-900">{t("Your account has been deleted")}</h2>
              <p className="mt-3 leading-7 text-emerald-800">{t("All sessions were revoked. Non-retained personal data was erased or anonymized under the approved retention policy.")}</p>
              <p className="mt-4 text-sm font-semibold text-emerald-900">{t("Policy version")}: {deleted.policy_version}</p>
            </section>
          ) : !customer ? (
            <div className="mt-8"><AuthPanel title={t("Sign in to manage your account data")} onAuthed={setCustomer} /></div>
          ) : (
            <div className="mt-8 space-y-6">
              <section className="commerce-card p-5 sm:p-8">
                <h2 className="text-xl font-extrabold text-[color:var(--navy)]">{t("Download my data")}</h2>
                <p className="mt-3 leading-7 text-[color:var(--muted-foreground)]">{t("Creates a portable JSON file. The download credential works once and expires after 15 minutes.")}</p>
                <button type="button" onClick={exportData} disabled={busy !== null} className="mt-5 min-h-12 rounded-full bg-[color:var(--navy)] px-6 font-bold text-white disabled:opacity-50">
                  {busy === "export" ? t("Preparing export…") : t("Create and download export")}
                </button>
              </section>

              <section className="commerce-card border-red-200 p-5 sm:p-8">
                <h2 className="text-xl font-extrabold text-red-800">{t("Permanently delete my account")}</h2>
                <p className="mt-3 leading-7 text-[color:var(--muted-foreground)]">{t("We immediately revoke every session and notification device, disable the account, and anonymize non-retained personal data. Pseudonymous booking records are retained for 5 years and financial, order, refund, invoice, and membership ledgers for 10 years.")}</p>
                {!otpSent ? (
                  <button type="button" onClick={sendDeletionCode} disabled={busy !== null} className="mt-5 min-h-12 rounded-full border-2 border-red-700 px-6 font-bold text-red-800 disabled:opacity-50">
                    {busy === "otp" ? t("Sending code…") : t("Send fresh verification code")}
                  </button>
                ) : (
                  <div className="mt-6 space-y-5">
                    <label className="block font-semibold text-[color:var(--navy)]">
                      {t("6-digit verification code")}
                      <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4" aria-describedby="deletion-warning" />
                    </label>
                    <label className="flex min-h-12 items-start gap-3 text-sm font-semibold text-slate-800">
                      <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
                      <span id="deletion-warning">{t("I understand that deleting my account is permanent and cannot be reversed.")}</span>
                    </label>
                    <button type="button" onClick={deleteAccount} disabled={busy !== null || code.length !== 6 || !confirmed} className="min-h-12 rounded-full bg-red-700 px-6 font-bold text-white disabled:opacity-50">
                      {busy === "delete" ? t("Deleting account…") : t("Delete my account permanently")}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
