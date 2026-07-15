import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const membership = readFileSync(new URL("../app/memberships/page.tsx", import.meta.url), "utf8");
const store = readFileSync(new URL("../components/store/StoreCheckoutClient.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("membership purchase and payment are separate idempotent commands", () => {
  assert.match(client, /buyMembership\(planId: number, idempotencyKey: string\)/);
  assert.match(client, /initializeMembershipPayment\(membershipId: number, idempotencyKey: string\)/);
  assert.match(membership, /MEMBERSHIP_ATTEMPT_KEY/);
  assert.match(membership, /purchaseKey/);
  assert.match(membership, /paymentKey/);
  assert.match(membership, /Continue Payment/);
});

test("store order creation and payment preserve independently stable retry keys", () => {
  assert.match(client, /createStoreOrder\(payload: CreateStoreOrderPayload, idempotencyKey: string\)/);
  assert.match(client, /payStoreOrder\(orderId: number, idempotencyKey: string\)/);
  assert.match(store, /CHECKOUT_ATTEMPT_KEY/);
  assert.match(store, /orderKey/);
  assert.match(store, /paymentKey/);
  assert.match(store, /writePendingCheckout/);
});

test("development simulator returns one stable attempt per domain purchase", () => {
  assert.match(mock, /paymentAttempts = new Map/);
  assert.match(mock, /paymentAttempts\.get\(key\) \?\?/);
  assert.match(mock, /mockPayment\("BKG"/);
  assert.match(mock, /mockPayment\("MEM"/);
  assert.match(mock, /mockPayment\("STO"/);
  assert.doesNotMatch(mock, /auto-activate after 5s/);
});
