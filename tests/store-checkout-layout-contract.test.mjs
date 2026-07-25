import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkout = readFileSync(
  new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url),
  "utf8",
);

test("store checkout places the order summary before delivery details", () => {
  const summary = checkout.indexOf('aria-labelledby="checkout-order-summary-title"');
  const delivery = checkout.indexOf('{step === "location" && (', summary);

  assert.notEqual(summary, -1);
  assert.notEqual(delivery, -1);
  assert.ok(summary < delivery);
});

test("the compact pre-review order summary is hidden on the final review step", () => {
  assert.match(
    checkout,
    /step !== "review" && \(\s*<section[\s\S]*?aria-labelledby="checkout-order-summary-title"/,
  );
});
