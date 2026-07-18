import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const policies = fs.readFileSync("lib/legal/policies.ts", "utf8");
const footer = fs.readFileSync("components/Footer.tsx", "utf8");
const deletion = fs.readFileSync("app/account-deletion/AccountDeletionClient.tsx", "utf8");
const robots = fs.readFileSync("app/robots.ts", "utf8");
const sitemap = fs.readFileSync("app/sitemap.ts", "utf8");

test("one shared policy version owns both English and Arabic legal content", () => {
  assert.match(policies, /LEGAL_POLICY_VERSION = "2026-07-18-v1"/);
  assert.match(policies, /LEGAL_POLICY_EFFECTIVE_DATE = "2026-07-18"/);
  assert.match(policies, /Bubble It Cars Washing LLC/);
  assert.match(policies, /commercialRegistration: "182268"/);
  assert.match(policies, /Building No\. 24, Zone 60, Street 950, Qatar/);
  assert.doesNotMatch(policies, /versionAr|arabicVersion|effectiveDateAr/);

  const ids = [...policies.matchAll(/\n\s+id: "([a-z-]+)",/g)].map((match) => match[1]);
  assert.ok(ids.length >= 25, "privacy and terms sections must remain comprehensive");
  assert.equal(new Set(ids).size, ids.length, "legal section IDs must be globally unique");

  const localizedBlocks = [...policies.matchAll(/\{ en: "([^"]+)", ar: "([^"]+)" \}/g)];
  assert.ok(localizedBlocks.length >= 35, "legal copy must carry paired English and Arabic text");
  for (const [, en, ar] of localizedBlocks) {
    assert.ok(en.trim().length > 0);
    assert.ok(ar.trim().length > 0);
  }
});

test("legal, deletion, robots, and sitemap surfaces are linked and canonical", () => {
  for (const route of ["/privacy", "/terms", "/account-deletion"]) {
    assert.match(footer, new RegExp(`href="${route}"`));
    assert.match(sitemap, new RegExp(route));
  }
  assert.match(robots, /https:\/\/bubbleit\.qa\/sitemap\.xml/);
  assert.match(sitemap, /https:\/\/bubbleit\.qa/);
});

test("account deletion requires OTP, explicit confirmation, and supports export", () => {
  assert.match(deletion, /requestOtp\(customer\.phone, "authentication"\)/);
  assert.match(deletion, /deleteCustomerAccount\(code\)/);
  assert.match(deletion, /createCustomerDataExport\(\)/);
  assert.match(deletion, /downloadCustomerDataExport/);
  assert.match(deletion, /checked=\{confirmed\}/);
  assert.match(deletion, /code\.length !== 6 \|\| !confirmed/);
});
