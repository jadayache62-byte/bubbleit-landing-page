import assert from "node:assert/strict";
import test from "node:test";

import { contentSecurityPolicy } from "../lib/security/csp.ts";

test("report-only CSP omits directives browsers ignore in report-only mode", () => {
  const policy = contentSecurityPolicy("reportnonce", false, "report-only");

  assert.doesNotMatch(policy, /upgrade-insecure-requests/);
  assert.match(policy, /report-uri \/api\/csp-report/);
});

test("enforced CSP upgrades insecure subresource requests", () => {
  const policy = contentSecurityPolicy("enforcenonce", false, "enforce");

  assert.match(policy, /upgrade-insecure-requests/);
});
