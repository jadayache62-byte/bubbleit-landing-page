import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const checkout = readFileSync(
  new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url),
  "utf8",
);
const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const mock = readFileSync(
  new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url),
  "utf8",
);

test("store checkout offers authenticated account checkout only", () => {
  assert.match(checkout, /Store checkout requires a signed-in customer account/);
  assert.match(checkout, /<AuthPanel/);
  assert.match(checkout, /if \(!customer\) \{/);
  assert.match(checkout, /const contactValid = Boolean\(customer\?\.phone\)/);
  assert.doesNotMatch(checkout, /Guest checkout|No account required|continue as a guest/);
  assert.doesNotMatch(checkout, /customer_name: contactName|customer_phone: contactPhone/);
});

test("login can happen mid-cart without clearing browser cart state", () => {
  assert.match(checkout, /onAuthed=\{acceptAuthenticatedCustomer\}/);
  assert.match(checkout, /Your cart stays here while you sign in/);

  const abandon = checkout.slice(
    checkout.indexOf("function clearPendingCheckoutStorage"),
    checkout.indexOf("function randomAttemptKey"),
  );
  assert.match(abandon, /removeItem\(PENDING_CHECKOUT_KEY\)/);
  assert.match(abandon, /removeItem\(CHECKOUT_ATTEMPT_KEY\)/);
  assert.doesNotMatch(abandon, /removeItem\(CART_KEY\)/);
});

test("saved pending checkout is bound to its server owner", () => {
  assert.match(checkout, /customerId: number/);
  assert.match(checkout, /pending\.customerId !== current\.id/);
  assert.match(checkout, /const acceptAuthenticatedCustomer = useCallback/);
  assert.match(checkout, /clearPendingCheckoutStorage\(\)/);
  assert.match(checkout, /customerId: order\.customer_id/);
  assert.match(types, /customer_id: number;/);
  assert.match(types, /expires_at: string;/);
});

test("development simulator mirrors authenticated ownership and expiry", () => {
  assert.match(mock, /if \(!linkedCustomer\) return fail\(401, "Unauthenticated\."\)/);
  assert.match(mock, /const customerName = String\(linkedCustomer\.name/);
  assert.match(mock, /order\.customer_id !== linkedCustomer\.id/);
  assert.match(mock, /expires_at: new Date\(Date\.now\(\) \+ 15 \* 60 \* 1000\)/);
});
