import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(new URL("../app/api/customer/[...path]/route.ts", import.meta.url), "utf8");
const hook = readFileSync(new URL("../components/account/useCustomerBookingTracking.ts", import.meta.url), "utf8");
const socket = readFileSync(new URL("../lib/tracking/reverb.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../components/account/BookingTrackingPanel.tsx", import.meta.url), "utf8");

test("tracking BFF requires an owned session and exact same-origin live authorization", () => {
  assert.match(route, /tracking && !token/);
  assert.match(route, /isCrossSiteMutation\(request, tracking === "authorize"\)/);
  assert.match(route, /requestBody\.byteLength > 1024/);
  assert.match(route, /!\["socket_id", "grant_id", "purpose"\]\.includes\(key\)/);
  assert.match(route, /sanitizeTrackingBody/);
});

test("the browser uses an ephemeral private grant and never persists coordinates or credentials", () => {
  for (const source of [hook, socket, panel]) {
    assert.doesNotMatch(source, /localStorage/);
  }
  assert.match(socket, /channel\.name !== stream\.channel/);
  assert.match(socket, /authorizeBookingLive/);
  assert.match(hook, /visibilitychange/);
  assert.match(hook, /navigator\.onLine/);
});

test("assignment presentation is gated by the authoritative assigned state", () => {
  assert.match(panel, /if \(!assigned\) return/);
  assert.match(panel, /window\.sessionStorage\.setItem\(key, "done"\)/);
});
