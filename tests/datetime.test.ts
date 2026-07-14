import assert from "node:assert/strict";
import test from "node:test";

import {
  formatQatarDateTime,
  qatarSlotMs,
  qatarServiceDate,
  serializeQatarBookingDateTime,
} from "../lib/datetime.ts";

test("serializes a Qatar wall-clock selection with an explicit offset", () => {
  assert.equal(
    serializeQatarBookingDateTime("2026-07-20", "10:15"),
    "2026-07-20T10:15:00+03:00",
  );
});

test("renders a UTC instant on the correct Qatar service date", () => {
  assert.equal(
    formatQatarDateTime("2026-07-19T21:30:00Z", "en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }),
    "00:30",
  );
});

test("equivalent UTC and Qatar-offset instants render identically", () => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  assert.equal(
    formatQatarDateTime("2026-07-19T21:30:00Z", "en-GB", options),
    formatQatarDateTime("2026-07-20T00:30:00+03:00", "en-GB", options),
  );
});

test("slot epoch is independent of the browser timezone", () => {
  assert.equal(
    qatarSlotMs("2026-07-20", "00:30"),
    Date.parse("2026-07-19T21:30:00Z"),
  );
});

test("derives the Qatar service date across the UTC midnight boundary", () => {
  assert.equal(qatarServiceDate("2026-07-19T21:30:00Z"), "2026-07-20");
});
