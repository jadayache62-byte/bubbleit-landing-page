"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  getCustomerNotificationPreferences,
  listCustomerNotifications,
  markCustomerNotificationRead,
  resolveCustomerNotification,
} from "@/lib/api/client";
import type { CustomerNotification, CustomerNotificationPreference } from "@/lib/api/types";
import {
  browserPushCapability,
  disableCustomerPush,
  enableCustomerPush,
  type BrowserPushCapability,
} from "@/lib/notifications/browser";
import { useI18n } from "@/lib/i18n";

export function CustomerNotifications() {
  const { lang, t } = useI18n();
  const [items, setItems] = useState<CustomerNotification[] | null>(null);
  const [preferences, setPreferences] = useState<CustomerNotificationPreference | null>(null);
  const [capability, setCapability] = useState<BrowserPushCapability>("unsupported");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [notifications, nextPreferences, nextCapability] = await Promise.all([
      listCustomerNotifications(),
      getCustomerNotificationPreferences(),
      browserPushCapability(),
    ]);
    setItems(notifications);
    setPreferences(nextPreferences);
    setCapability(nextCapability);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      refresh().catch((caught) => {
        setItems([]);
        setError(caught instanceof ApiError ? caught.message : t("Could not load notifications."));
      });
    });
  }, [refresh, t]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "bubbleit:notification") refresh().catch(() => undefined);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [refresh]);

  async function togglePush() {
    setBusy(true);
    setError(null);
    try {
      if (preferences?.push_enabled && capability === "enabled") {
        await disableCustomerPush(lang);
      } else {
        await enableCustomerPush(lang);
      }
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("Could not update notification settings."));
    } finally {
      setBusy(false);
    }
  }

  async function openNotification(notification: CustomerNotification) {
    setError(null);
    try {
      if (!notification.is_read) {
        await markCustomerNotificationRead(notification.id);
        setItems((current) => current?.map((item) => item.id === notification.id ? { ...item, is_read: true } : item) ?? []);
      }
      const { path } = await resolveCustomerNotification(notification.id);
      window.location.assign(path);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t("This notification is no longer available."));
    }
  }

  const pushEnabled = preferences?.push_enabled && capability === "enabled";

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("Notifications")}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
            {t("Booking, payment, cancellation, refund, and appointment reminders appear here.")}
          </p>
        </div>
        <button
          type="button"
          className={pushEnabled ? "secondary-button" : "primary-button"}
          disabled={busy || capability === "unsupported" || capability === "blocked"}
          onClick={togglePush}
        >
          {busy ? t("Updating…") : pushEnabled ? t("Turn off browser notifications") : t("Enable browser notifications")}
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-slate-700">
        <p className="font-bold text-[color:var(--navy)]">{t("How delivery works")}</p>
        <p className="mt-1">
          {capability === "blocked"
            ? t("Browser notifications are blocked. Change your browser permission to enable them.")
            : capability === "unsupported"
              ? t("This browser does not support push notifications.")
              : t("Browser push is optional. Important transactional WhatsApp or SMS remains the fallback when push cannot be delivered.")}
        </p>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5 space-y-3" aria-live="polite">
        {items === null ? (
          <div className="commerce-card h-40 animate-pulse bg-slate-100" role="status" aria-label={t("Loading notifications…")} />
        ) : items.length === 0 ? (
          <div className="commerce-card p-6">
            <h3 className="font-bold text-[color:var(--navy)]">{t("No notifications yet")}</h3>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{t("Your transactional updates will appear here.")}</p>
          </div>
        ) : items.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className="commerce-card flex w-full items-start gap-4 p-5 text-start transition hover:border-[color:var(--blue)]"
            onClick={() => openNotification(notification)}
          >
            <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${notification.is_read ? "bg-slate-300" : "bg-[color:var(--blue)]"}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-[color:var(--navy)]">{notification.title}</span>
              <span className="mt-1 block text-sm leading-6 text-[color:var(--muted-foreground)]">{notification.body}</span>
              {notification.created_at && <time className="mt-2 block text-xs text-slate-500" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString(lang)}</time>}
            </span>
            <span className="text-sm font-bold text-[color:var(--blue)]">{t("Open")}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
