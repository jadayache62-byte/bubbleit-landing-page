import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(
  new URL("../app/account/page.tsx", import.meta.url),
  "utf8",
);

test("non-danger account status messages auto-dismiss after ten seconds", () => {
  assert.match(account, /paymentNotice\.tone === "danger"/);
  assert.match(account, /window\.setTimeout\([\s\S]*10_000/);
  assert.match(account, /setPaymentNotice\(\(current\) => current === notice \? null : current\)/);
  assert.match(account, /window\.clearTimeout\(timeout\)/);
});

test("status and error banners expose accessible manual dismissal", () => {
  assert.match(account, /aria-label=\{t\("Dismiss message"\)\}/);
  assert.match(account, /onClick=\{\(\) => setPaymentNotice\(null\)\}/);
  assert.match(account, /onClick=\{\(\) => setError\(null\)\}/);
  assert.match(account, /<span aria-hidden="true">×<\/span>/);
});
