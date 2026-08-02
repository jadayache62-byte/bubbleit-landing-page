import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(new URL("../app/review/[invitation]/ReviewPageClient.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");
const metadata = readFileSync(new URL("../app/review/[invitation]/page.tsx", import.meta.url), "utf8");
const metadataCatalog = readFileSync(new URL("../lib/localized-metadata.ts", import.meta.url), "utf8");
const toast = readFileSync(new URL("../components/AppToast.tsx", import.meta.url), "utf8");

test("review entry is opaque, authenticated, rating-first, optional-notes, and one-shot", () => {
  assert.match(api, /review-invitations\/\$\{encodeURIComponent\(publicId\)\}/);
  assert.match(page, /type="radio"/);
  assert.match(page, /maxLength=\{2000\}/);
  assert.match(page, /entry\?\.state === "submitted"/);
  assert.match(page, /entry\?\.state === "expired"/);
  assert.match(page, /<AuthPanel/);
  assert.doesNotMatch(page, /customer_id|booking_id/);
});

test("review links stay out of search indexes and expose accessible loading and errors", () => {
  assert.match(metadata, /localizedMetadata\("review"\)/);
  assert.match(metadataCatalog, /review: \{ robots: \{ index: false, follow: false, nocache: true \} \}/);
  assert.match(page, /role="status"/);
  assert.match(page, /<AppToast/);
  assert.match(toast, /role=\{tone === "danger" \? "alert" : "status"\}/);
  assert.match(page, /aria-label/);
});
