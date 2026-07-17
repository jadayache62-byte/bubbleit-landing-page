import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(
  new URL("../public/customer-notifications-sw.js", import.meta.url),
  "utf8",
);
const browserSource = readFileSync(
  new URL("../lib/notifications/browser.ts", import.meta.url),
  "utf8",
);
const apiSource = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");

function workerHarness(windows = []) {
  const listeners = new Map();
  const notifications = [];
  const opened = [];
  const self = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    clients: {
      matchAll: async () => windows,
      openWindow: async (path) => {
        opened.push(path);
        return { path };
      },
    },
    registration: {
      showNotification: async (title, options) => notifications.push({ title, options }),
    },
  };
  vm.runInNewContext(source, { self, Number, Promise }, { filename: "customer-notifications-sw.js" });

  return { listeners, notifications, opened };
}

function pushEvent(payload) {
  let work;
  return {
    data: { json: () => payload },
    waitUntil(promise) {
      work = promise;
    },
    done: () => work,
  };
}

test("foreground push posts an internal notification message without a duplicate system alert", async () => {
  const messages = [];
  const windowClient = {
    visibilityState: "visible",
    postMessage: (message) => messages.push(message),
  };
  const harness = workerHarness([windowClient]);
  const event = pushEvent({
    notification_id: 41,
    title: "Payment confirmed",
    body: "Booking paid.",
    deep_link: "https://attacker.invalid/steal",
  });

  harness.listeners.get("push")(event);
  await event.done();

  assert.equal(harness.notifications.length, 0);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].payload.path, "/account?notification=41");
});

test("background push displays one localized system notification", async () => {
  const harness = workerHarness([{ visibilityState: "hidden", postMessage() {} }]);
  const event = pushEvent({ notification_id: 42, title: "موعد غسيلك غداً", body: "تفاصيل الموعد" });

  harness.listeners.get("push")(event);
  await event.done();

  assert.equal(harness.notifications.length, 1);
  assert.equal(harness.notifications[0].title, "موعد غسيلك غداً");
  assert.equal(harness.notifications[0].options.data.notification_id, 42);
});

test("terminated notification tap opens only the owner-reauthorized account entry point", async () => {
  const harness = workerHarness([]);
  let closed = false;
  let work;
  const event = {
    notification: {
      data: { notification_id: 43, path: "https://attacker.invalid/steal" },
      close: () => { closed = true; },
    },
    waitUntil(promise) { work = promise; },
  };

  harness.listeners.get("notificationclick")(event);
  await work;

  assert.equal(closed, true);
  assert.deepEqual(harness.opened, ["/account?notification=43"]);
  assert.match(apiSource, /\/notifications\/\$\{notificationId\}\/resolve/);
});

test("malformed push payloads are discarded and lifecycle registration is session scoped", () => {
  const harness = workerHarness([]);
  const event = pushEvent({ notification_id: "not-an-id", deep_link: "/account" });
  harness.listeners.get("push")(event);
  assert.equal(event.done(), undefined);
  assert.equal(harness.notifications.length, 0);

  assert.match(browserSource, /registerCustomerNotificationDevice/);
  assert.match(browserSource, /removeCustomerNotificationDevice/);
  assert.match(browserSource, /subscription\?\.unsubscribe\(\)/);
  assert.match(browserSource, /NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY/);
});
