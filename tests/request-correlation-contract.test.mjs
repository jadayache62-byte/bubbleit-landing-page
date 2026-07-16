import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bff = readFileSync(
  new URL("../app/api/customer/[...path]/route.ts", import.meta.url),
  "utf8",
);
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");

test("the BFF forwards one safe request ID and returns the authoritative upstream ID", () => {
  assert.match(bff, /SAFE_REQUEST_ID/);
  assert.match(bff, /crypto\.randomUUID\(\)/);
  assert.match(bff, /headers\.set\("X-Request-ID", correlationId\)/);
  assert.match(bff, /upstream\.headers\.get\("x-request-id"\) \?\? correlationId/);
  assert.match(bff, /status: 503/);
  assert.match(bff, /"X-Request-ID": correlationId/);
});

test("customer-visible API failures retain an actionable request reference", () => {
  assert.match(client, /requestId: string \| null/);
  assert.match(client, /Reference: \$\{requestId\}/);
  assert.match(client, /res\.headers\.get\("x-request-id"\)/);
});
