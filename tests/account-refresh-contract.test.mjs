import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const account = readFileSync(
  new URL("../app/account/page.tsx", import.meta.url),
  "utf8",
);

test("account refresh reloads every authoritative customer collection", () => {
  assert.match(account, /await Promise\.all\(\[/);
  for (const request of [
    "listBookings()",
    "listVehicles()",
    "listAddresses()",
    "listMemberships()",
    "listStoreOrders()",
  ]) {
    assert.ok(account.includes(request));
  }
});

test("account exposes an accessible busy-aware manual refresh control", () => {
  assert.match(account, /onClick=\{\(\) => void refresh\(\)\}/);
  assert.match(account, /disabled=\{refreshing\}/);
  assert.match(account, /t\("Refreshing account…"\) : t\("Refresh account"\)/);
});
