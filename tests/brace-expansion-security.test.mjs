import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import {
  expand,
  EXPANSION_MAX_LENGTH,
} from "brace-expansion";

const require = createRequire(import.meta.url);
const legacyMinimatch = require("minimatch");

test("patched minimatch preserves its legacy callable interface", () => {
  assert.equal(typeof legacyMinimatch, "function");
  assert.equal(legacyMinimatch("file.ts", "*.{js,ts}"), true);
  assert.equal(legacyMinimatch("file.css", "*.{js,ts}"), false);
});

test("patched brace expansion preserves legitimate expansion behavior", () => {
  assert.deepEqual(expand("file.{js,ts}"), ["file.js", "file.ts"]);
});

test("patched brace expansion bounds accumulated output length", () => {
  const maxLength = 1_000;
  const expanded = expand("{a,b}".repeat(20), { maxLength });
  const totalLength = expanded.reduce((total, value) => total + value.length, 0);

  assert.equal(EXPANSION_MAX_LENGTH, 4_000_000);
  assert.ok(totalLength <= maxLength);
});
