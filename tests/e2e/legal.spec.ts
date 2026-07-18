import { expect, test } from "@playwright/test";

test("footer exposes canonical legal and deletion links", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
  await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
  await expect(page.locator('footer a[href="/account-deletion"]')).toBeVisible();
});

for (const [path, heading] of [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms & Conditions"],
  ["/account-deletion", "Account data and deletion"],
] as const) {
  test(`${path} is public and identifies the approved policy version`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    await expect(page.getByText(/2026-07-18-v1/).first()).toBeVisible();
  });
}

test("Arabic and English policy content use one page and one version", async ({ page }) => {
  await page.context().addCookies([{
    name: "bubbleit.lang",
    value: "ar",
    domain: "127.0.0.1",
    path: "/",
  }]);
  await page.goto("/privacy");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "سياسة الخصوصية", exact: true })).toBeVisible();
  await expect(page.getByText(/2026-07-18-v1/).first()).toBeVisible();
});
