import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("loyalty marketing uses the shared active-only modal instead of a standalone section", async () => {
  const [home, services, modal] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("components/Services.tsx", root), "utf8"),
    readFile(new URL("components/loyalty/LoyaltyModal.tsx", root), "utf8"),
  ]);

  assert.doesNotMatch(home, /LoyaltySection/);
  assert.match(services, /<LoyaltyModal placement="services" autoPrompt/);
  assert.match(modal, /if \(!program\?\.enabled\) return null/);
  assert.match(modal, /IntersectionObserver/);
  assert.match(modal, /sessionStorage\.setItem\(AUTO_PROMPT_KEY/);
});

test("loyalty modal is accessible and booking remains voluntary", async () => {
  const [booking, account, modal] = await Promise.all([
    readFile(new URL("components/booking/BookingWizard.tsx", root), "utf8"),
    readFile(new URL("app/account/page.tsx", root), "utf8"),
    readFile(new URL("components/loyalty/LoyaltyModal.tsx", root), "utf8"),
  ]);

  assert.match(booking, /<LoyaltyModal placement="booking"/);
  assert.match(account, /<LoyaltyModal placement="account" program=\{loyalty\.program\}/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key !== "Tab"/);
  assert.match(modal, /trigger\?\.focus/);
  assert.match(modal, /placement === "booking"/);
});
