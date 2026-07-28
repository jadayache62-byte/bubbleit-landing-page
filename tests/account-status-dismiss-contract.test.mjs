import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(
  new URL("../app/account/page.tsx", import.meta.url),
  "utf8",
);
const toast = readFileSync(
  new URL("../components/AppToast.tsx", import.meta.url),
  "utf8",
);

test("non-danger account status messages auto-dismiss after ten seconds", () => {
  assert.match(account, /paymentNotice\.tone === "danger"/);
  assert.match(account, /window\.setTimeout\([\s\S]*10_000/);
  assert.match(account, /setPaymentNotice\(\(current\) => current === notice \? null : current\)/);
  assert.match(account, /window\.clearTimeout\(timeout\)/);
});

test("status and error banners expose accessible manual dismissal", () => {
  assert.match(account, /<AppToast[\s\S]*dismissLabel=\{t\("Dismiss message"\)\}/);
  assert.match(account, /onDismiss=\{\(\) => setPaymentNotice\(null\)\}/);
  assert.match(account, /onDismiss=\{\(\) => setError\(null\)\}/);
  assert.match(toast, /aria-label=\{dismissLabel\}/);
  assert.match(toast, /<span aria-hidden="true">×<\/span>/);
});

test("account feedback uses the fixed top snackbar instead of inline page banners", () => {
  assert.match(toast, /fixed inset-x-3 top-\[calc\(env\(safe-area-inset-top\)\+0\.75rem\)\]/);
  assert.match(toast, /z-\[100\]/);
  assert.doesNotMatch(account, /className="mt-5 flex items-start justify-between gap-3 rounded-2xl bg-red-50/);
});
