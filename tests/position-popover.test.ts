import assert from "node:assert/strict";
import test from "node:test";

import { positionPopoverInViewport } from "../lib/ui/position-popover.ts";

const mobileViewport = { width: 320, height: 640 };

test("right-edge time trigger keeps the popover within a narrow viewport", () => {
  const result = positionPopoverInViewport(
    { left: 250, top: 200, bottom: 244 },
    mobileViewport,
    104,
  );

  assert.equal(result.left, 96);
  assert.equal(result.left + result.width, 304);
});

test("left-edge time trigger preserves the viewport gutter", () => {
  const result = positionPopoverInViewport(
    { left: 4, top: 200, bottom: 244 },
    mobileViewport,
    104,
  );

  assert.equal(result.left, 16);
});

test("bottom-edge time trigger opens upward", () => {
  const result = positionPopoverInViewport(
    { left: 100, top: 570, bottom: 614 },
    mobileViewport,
    104,
  );

  assert.equal(result.top, 458);
});

test("large-text popover stays clamped when neither side fully fits", () => {
  const result = positionPopoverInViewport(
    { left: 100, top: 250, bottom: 294 },
    { width: 320, height: 360 },
    330,
  );

  assert.equal(result.top, 16);
});
