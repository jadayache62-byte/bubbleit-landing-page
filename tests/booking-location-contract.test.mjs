import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const types = readFileSync(new URL("../lib/api/types.ts", import.meta.url), "utf8");
const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("booking contract carries Blue Plate, address context, and note together", () => {
  for (const field of ["address_label", "address_street", "building_number", "zone_number", "street_number"]) {
    assert.match(types, new RegExp(`${field}\\?: string \\| null`));
  }
  assert.match(types, /notes: string/);
});

test("customer booking card renders a structured plate and a separate note", () => {
  assert.match(account, /aria-label=\{t\("Blue Plate"\)\}/);
  assert.match(account, /booking\.building_number/);
  assert.match(account, /booking\.zone_number/);
  assert.match(account, /booking\.street_number/);
  assert.match(account, /Address details \/ note/);
  assert.match(account, /booking\.notes/);
});

test("development mock preserves saved location context on the booking snapshot", () => {
  assert.match(mock, /address_label: bookingAddress\?\.label/);
  assert.match(mock, /address_street: bookingAddress\?\.details/);
  assert.match(mock, /building_number: bookingAddress\?\.building_number/);
});
