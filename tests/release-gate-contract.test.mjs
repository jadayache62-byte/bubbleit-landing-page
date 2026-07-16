import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8",
);

test("landing release CI keeps security, contract, build, and browser gates blocking", () => {
  for (const gate of [
    "npm audit --audit-level=moderate",
    "npm run lint",
    "npm test",
    "npm run build",
    "npm run test:e2e",
  ]) {
    assert.match(workflow, new RegExp(gate.replaceAll(" ", "\\s+")));
  }
  assert.match(workflow, /CUSTOMER_API_BASE: http:\/\/127\.0\.0\.1:8000\/api\/v1\/customer/);
});
