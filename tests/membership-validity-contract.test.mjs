import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mock = readFileSync(new URL("../lib/mock/store.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../app/memberships/page.tsx", import.meta.url), "utf8");

test("all mock plan families map 24 and 48 washes to approved validity", () => {
  assert.match(mock, /washes_count === 24 \? 180 : washes_count === 48 \? 365 : 30/);
  assert.match(mock, /full_wash/);
  assert.match(mock, /exterior/);
  assert.match(mock, /midnight_exterior/);
});

test("catalog cards and purchase review render plan validity", () => {
  assert.match(page, /Valid for \$\{plan\.validity_days\} days/);
  assert.match(page, /buyingPlan\.validity_days/);
  assert.doesNotMatch(page, /Valid 30 days/);
});
