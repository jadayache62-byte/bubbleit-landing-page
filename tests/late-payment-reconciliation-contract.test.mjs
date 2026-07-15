import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const memberships = readFileSync(new URL("../app/memberships/page.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");

test("customer contract distinguishes a captured payment requiring reconciliation", () => {
  assert.match(types, /"reconciliation_required"/);
  assert.match(types, /captured: boolean/);
  assert.match(types, /reconciliation_reason: string \| null/);
});

test("closed membership never offers another payment while refund reconciliation is required", () => {
  assert.match(memberships, /m\.payment\?\.status === "reconciliation_required"/);
  assert.match(memberships, /m\.payment\?\.status !== "reconciliation_required"/);
  assert.match(memberships, /It was not reactivated/);
});

test("account explains late booking and membership capture without implying reinstatement", () => {
  assert.match(account, /booking\.payment\?\.status === "reconciliation_required"/);
  assert.match(account, /It was not reinstated/);
  assert.match(account, /Payment under review/);
});
