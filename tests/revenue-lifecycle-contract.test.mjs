import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const translations = readFileSync(new URL("../lib/i18n.tsx", import.meta.url), "utf8");

test("customer account keeps fulfillment and refund accounting truths separate", () => {
  assert.match(types, /financial_lifecycle\?: FinancialLifecycle/);
  assert.match(account, /financial_lifecycle\.recognition\.recognized_minor/);
  assert.match(account, /financial_lifecycle\.refund\.cash_refunded_minor/);
  assert.match(account, /financial_lifecycle\.refund\.recognized_revenue_reversed_minor/);
});

test("membership released and deferred values are backend-owned and bilingual", () => {
  assert.match(types, /released_revenue_minor: number/);
  assert.match(types, /remaining_deferred_minor: number/);
  assert.match(account, /membership\.financials\.released_revenue_minor/);
  assert.match(account, /membership\.financials\.remaining_deferred_minor/);
  assert.match(account, /t\("Released membership revenue"\)/);
  assert.match(translations, /"Released membership revenue": "إيراد الاشتراك المحرر"/);
});
