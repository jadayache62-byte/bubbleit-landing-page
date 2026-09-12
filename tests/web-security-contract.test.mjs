import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const nextConfig = readFileSync(new URL("../next.config.mjs", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const csp = readFileSync(new URL("../lib/security/csp.ts", import.meta.url), "utf8");
const bff = readFileSync(new URL("../app/api/customer/[...path]/route.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");

test("Sentry demo routes are absent and local build uploads can be disabled", () => {
  assert.equal(existsSync(new URL("../app/sentry-example-page/page.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../app/api/sentry-example-api/route.ts", import.meta.url)), false);
  assert.match(nextConfig, /process\.env\.SENTRY_BUILD_UPLOADS === "false"/);
  assert.match(nextConfig, /sourcemaps: \{ disable: disableSentryBuildUploads \}/);
  assert.match(nextConfig, /telemetry: false, release: \{ create: false, finalize: false \}/);
  for (const filename of ["sentry.server.config.ts", "sentry.edge.config.ts", "instrumentation-client.ts"]) {
    const config = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    assert.match(config, /enabled: process\.env\.NEXT_PUBLIC_SENTRY_ENABLED !== "false"/);
  }
});

test("security headers include transport, permission, isolation, and MIME defenses", () => {
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /max-age=63072000; includeSubDomains/);
  assert.match(nextConfig, /Permissions-Policy/);
  assert.match(nextConfig, /geolocation=\(self\)/);
  assert.doesNotMatch(nextConfig, /browsing-topics/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.doesNotMatch(nextConfig, /X-Frame-Options/);
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
