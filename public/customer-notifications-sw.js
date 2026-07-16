/* BubbleIt customer notification service worker. Payload links are never trusted. */
"use strict";

function safePayload(value) {
  const id = Number(value && value.notification_id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    notification_id: id,
    title: typeof value.title === "string" && value.title ? value.title : "BubbleIt update",
    body: typeof value.body === "string" ? value.body : "Open your account for details.",
    path: `/account?notification=${id}`,
  };
}

self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = safePayload(event.data && event.data.json());
  } catch {
    payload = null;
  }
  if (!payload) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      windows.forEach((client) => client.postMessage({ type: "bubbleit:notification", payload }));
      if (windows.some((client) => client.visibilityState === "visible")) return undefined;
      return self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: `bubbleit-notification-${payload.notification_id}`,
        data: { notification_id: payload.notification_id },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const payload = safePayload(event.notification.data);
  if (!payload) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const existing = windows[0];
      if (existing) {
        await existing.navigate(payload.path);
        return existing.focus();
      }
      return self.clients.openWindow(payload.path);
    }),
  );
});
