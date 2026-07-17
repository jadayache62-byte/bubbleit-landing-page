import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const locationMap = readFileSync(new URL("../components/booking/LocationMap.tsx", import.meta.url), "utf8");
const hourPicker = readFileSync(new URL("../components/booking/HourSlotPicker.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");

test("map has a localized keyboard and screen-reader coordinate alternative", () => {
  assert.match(locationMap, /Enter coordinates without using the map/);
  assert.match(locationMap, /<form[\s\S]*onSubmit=\{applyCoordinates\}/);
  assert.match(locationMap, /Latitude/);
  assert.match(locationMap, /Longitude/);
  assert.match(locationMap, /role="region"/);
  assert.doesNotMatch(locationMap, /role="application"/);
});

test("time picker restores keyboard focus after selection or Escape", () => {
  assert.match(hourPicker, /triggerRefs\.current\.get\(hour\)\?\.focus\(\)/);
  assert.match(hourPicker, /aria-controls=\{`time-options-\$\{hour\}`\}/);
  assert.match(hourPicker, /id=\{`time-options-\$\{hour\}`\}/);
});

test("account reschedule dialog traps focus, supports Escape, and restores focus", () => {
  assert.match(account, /aria-labelledby="reschedule-booking-title"/);
  assert.match(account, /event\.key === "Escape"/);
  assert.match(account, /event\.key !== "Tab"/);
  assert.match(account, /previousFocus\?\.focus/);
  assert.match(account, /document\.body\.style\.overflow = "hidden"/);
});
