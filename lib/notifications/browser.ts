"use client";

import {
  registerCustomerNotificationDevice,
  removeCustomerNotificationDevice,
  updateCustomerNotificationPreferences,
} from "@/lib/api/client";

const DEVICE_ID_KEY = "bubbleit.notification_device_id";
const SERVICE_WORKER_PATH = "/customer-notifications-sw.js";

export type BrowserPushCapability = "unsupported" | "blocked" | "available" | "enabled";

export async function browserPushCapability(): Promise<BrowserPushCapability> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "enabled" : "available";
}

export async function enableCustomerPush(locale: "en" | "ar"): Promise<void> {
  const capability = await browserPushCapability();
  if (capability === "unsupported") throw new Error("Push notifications are not supported by this browser.");
  if (capability === "blocked") throw new Error("Notifications are blocked in your browser settings.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  if (!publicKey) {
    throw new Error("Push delivery is not configured yet. Transactional messages remain enabled.");
  }

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: "/" });
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodePublicKey(publicKey),
    }));
  const device = await registerCustomerNotificationDevice({
    token: JSON.stringify(subscription.toJSON()),
    locale,
    name: browserDeviceName(),
  });
  window.localStorage.setItem(DEVICE_ID_KEY, String(device.id));
  await updateCustomerNotificationPreferences({ locale, push_enabled: true });
}

export async function disableCustomerPush(locale: "en" | "ar"): Promise<void> {
  await detachCurrentPushDevice();
  await updateCustomerNotificationPreferences({ locale, push_enabled: false });
}

export async function detachCurrentPushDevice(): Promise<void> {
  if (typeof window === "undefined") return;
  const storedId = Number.parseInt(window.localStorage.getItem(DEVICE_ID_KEY) ?? "", 10);
  try {
    if (Number.isSafeInteger(storedId) && storedId > 0) {
      await removeCustomerNotificationDevice(storedId);
    }
  } finally {
    window.localStorage.removeItem(DEVICE_ID_KEY);
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
    }
  }
}

function decodePublicKey(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = window.atob(padded);
  const result = new Uint8Array(new ArrayBuffer(bytes.length));
  for (let index = 0; index < bytes.length; index += 1) result[index] = bytes.charCodeAt(index);
  return result;
}

function browserDeviceName(): string {
  const platform = navigator.platform.trim();
  return platform ? `BubbleIt web on ${platform}` : "BubbleIt customer web";
}
