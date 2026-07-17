import { expect, test } from "@playwright/test";

test("release pages enforce the reviewed security-header policy", async ({ page }) => {
  const response = await page.goto("/");
  expect(response).not.toBeNull();
  const headers = response!.headers();

  expect(headers["content-security-policy"]).toContain("script-src 'self' 'nonce-");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
  expect(headers["permissions-policy"]).toContain("geolocation=(self)");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("untrusted input is not reflected as script and CSP blocks external images", async ({ page }) => {
  const receivedResponses: string[] = [];
  page.on("response", (response) => {
    if (response.url().startsWith("https://attacker.invalid")) receivedResponses.push(response.url());
  });
  const payload = "<script>window.__bubbleitInjected=true</script>";
  await page.goto(`/?q=${encodeURIComponent(payload)}`);

  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__bubbleitInjected")))
    .toBeUndefined();
  await expect(page.locator("script", { hasText: "__bubbleitInjected" })).toHaveCount(0);

  await page.evaluate(() => {
    const image = document.createElement("img");
    image.id = "unapproved-csp-image";
    image.src = "https://attacker.invalid/tracker.png";
    image.alt = "";
    document.body.append(image);
  });

  await expect(page.locator("#unapproved-csp-image")).toHaveJSProperty("naturalWidth", 0);
  expect(receivedResponses).toEqual([]);
});

test("the customer BFF rejects cross-site mutation without CORS opt-in", async ({ request }) => {
  const response = await request.post("/api/customer/auth/check-phone", {
    headers: { Origin: "https://attacker.invalid", "Content-Type": "application/json" },
    data: { phone: "+97455559999" },
  });

  expect(response.status()).toBe(403);
  expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
});

test("CSP reports are accepted without reflecting supplied URLs", async ({ request }) => {
  const response = await request.post("/api/csp-report", {
    headers: { "Content-Type": "application/csp-report" },
    data: {
      "csp-report": {
        "effective-directive": "script-src-elem",
        "violated-directive": "script-src-elem",
        "document-uri": "https://bubbleit.qa/book?secret=redacted",
        "blocked-uri": "https://attacker.invalid/payload.js?token=redacted",
      },
    },
  });

  expect(response.status()).toBe(204);
  expect(await response.text()).toBe("");
  expect(response.headers()["cache-control"]).toContain("no-store");
});
