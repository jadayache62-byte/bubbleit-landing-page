import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const csp = readFileSync(new URL("../lib/security/csp.ts", import.meta.url), "utf8");
const bff = readFileSync(new URL("../app/api/customer/[...path]/route.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");

test("security headers include transport, permission, isolation, and MIME defenses", () => {
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /max-age=63072000; includeSubDomains/);
  assert.match(nextConfig, /Permissions-Policy/);
  assert.match(nextConfig, /geolocation=\(self\)/);
  assert.doesNotMatch(nextConfig, /browsing-topics/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /poweredByHeader: false/);
});

test("CSP supports report-only rollout and explicit enforcement", () => {
  assert.match(proxy, /const mode = cspMode\(\)/);
  assert.match(proxy, /cspResponseHeader\(mode\)/);
  assert.match(csp, /Content-Security-Policy-Report-Only/);
  assert.match(csp, /Content-Security-Policy/);
  assert.match(csp, /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /https:\/\/tile\.openstreetmap\.org/);
  assert.match(csp, /https:\/\/nominatim\.openstreetmap\.org/);
  assert.match(csp, /mode === "enforce" \? \["upgrade-insecure-requests"\] : \[\]/);
});

test("the browser token boundary stays same-origin and HttpOnly", () => {
  assert.match(bff, /httpOnly: true/);
  assert.match(bff, /sameSite: "lax"/);
  assert.match(bff, /60 \* 60 \* 24 \* 21/);
  assert.match(bff, /isCrossSiteMutation/);
  assert.match(client, /const BASE = "\/api\/customer"/);
  assert.doesNotMatch(client, /localStorage\.setItem\([^\n]*token/i);
  assert.doesNotMatch(client, /Authorization.*Bearer/);
});
