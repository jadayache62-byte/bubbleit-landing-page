import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const footer = readFileSync(
  new URL("../components/Footer.tsx", import.meta.url),
  "utf8",
);

test("footer renders visual Instagram and TikTok logos instead of link text", () => {
  assert.match(footer, /href="https:\/\/instagram\.com\/bubbleitqa"[\s\S]*?<svg/);
  assert.match(footer, /href="https:\/\/tiktok\.com\/@bubbleitqa"[\s\S]*?<svg/);
  assert.doesNotMatch(footer, />\s*Instagram @bubbleitqa\s*</);
  assert.doesNotMatch(footer, />\s*TikTok @bubbleitqa\s*</);
});

test("social logo links keep localized non-visual labels and safe new-tab behavior", () => {
  assert.match(footer, /aria-label=\{`\$\{t\("Instagram"\)\} @bubbleitqa`\}/);
  assert.match(footer, /aria-label=\{`\$\{t\("TikTok"\)\} @bubbleitqa`\}/);
  assert.equal((footer.match(/rel="noopener noreferrer"/g) ?? []).length >= 3, true);
  assert.equal((footer.match(/aria-hidden="true"/g) ?? []).length >= 2, true);
});
