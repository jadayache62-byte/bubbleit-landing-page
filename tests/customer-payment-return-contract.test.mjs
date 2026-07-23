import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");
const demoCheckout = readFileSync(new URL("../app/book/checkout/page.tsx", import.meta.url), "utf8");

test("account owns authenticated store order history", () => {
  assert.match(api, /export function listStoreOrders\(\)/);
  assert.match(api, /export function getStoreOrder\(orderId: number\)/);
  assert.match(account, /\["overview", "bookings", "orders", "memberships", "vehicles", "notifications"\]/);
  assert.match(account, /tab === "orders"/);
  assert.match(account, /<StoreOrderCard/);
  assert.match(mock, /method === "GET" && path === "store\/orders"/);
  assert.match(mock, /method === "GET" && storeOrderMatch/);
  assert.match(mock, /\.filter\(\(order\) => order\.customer_id === linkedCustomer\.id\)/);
});

test("payment return verifies authoritative state before showing an outcome", () => {
  assert.match(account, /if \(!parameters\.has\("payment"\)\) return/);
  assert.match(account, /await getBooking\(bookingId\)/);
  assert.match(account, /await getStoreOrder\(orderId\)/);
  assert.match(account, /await listMemberships\(\)/);
  assert.match(account, /attempt < 8/);
  assert.match(account, /Payment successful\. Your purchase is confirmed\./);
  assert.match(account, /Payment failed\. Your purchase is saved and you can try again\./);
  assert.match(mock, /checkout_url: `\/account\?tab=orders&payment=review&order=\$\{order\.id\}`/);
  assert.match(mock, /`\/book\/checkout\?booking=\$\{id\}`/);
  assert.match(demoCheckout, /\/account\?tab=bookings&payment=success&booking=\$\{bookingId\}/);
});

test("mock customer order responses strip ownership internals", () => {
  assert.match(mock, /\.map\(\(\{ customer_id: _customerId, \.\.\.order \}\) => order\)/);
  assert.match(mock, /const \{ customer_id: _customerId, \.\.\.customerOrder \} = order/);
});
