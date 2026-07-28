import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const paths = [
  "../app/account/page.tsx",
  "../app/account/locations/page.tsx",
  "../app/account-deletion/AccountDeletionClient.tsx",
  "../app/memberships/page.tsx",
  "../app/review/[invitation]/ReviewPageClient.tsx",
  "../components/account/CustomerNotifications.tsx",
  "../components/booking/AuthPanel.tsx",
  "../components/booking/BookingWizard.tsx",
  "../components/booking/LocationMap.tsx",
  "../components/store/StoreCheckoutClient.tsx",
];

test("customer action-error surfaces use the shared top snackbar", () => {
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(source, /AppToast/, `${path} must use AppToast`);
  }
});

test("the shared snackbar has accessible urgency, safe-area positioning, and dismissal", () => {
  const toast = readFileSync(new URL("../components/AppToast.tsx", import.meta.url), "utf8");
  assert.match(toast, /role=\{tone === "danger" \? "alert" : "status"\}/);
  assert.match(toast, /aria-live=\{tone === "danger" \? "assertive" : "polite"\}/);
  assert.match(toast, /safe-area-inset-top/);
  assert.match(toast, /min-h-11 min-w-11/);
});
