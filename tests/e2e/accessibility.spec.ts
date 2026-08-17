import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const path of [
  "/",
  "/store",
  "/book",
  "/memberships",
  "/privacy",
  "/terms",
  "/account-deletion",
]) {
  test(`${path} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

for (const path of ["/", "/store", "/book", "/memberships"]) {
  test(`${path} reflows at 320px and respects reduced motion`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: "reduce" });

    const response = await page.goto(path);
    expect(response?.ok()).toBeTruthy();

    const overflow = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);

    const reducedMotion = await page.evaluate(() =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    expect(reducedMotion).toBe(true);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("loyalty modal is accessible, dismissible, and mobile-safe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.sessionStorage.setItem("bubbleit.loyalty.spotlight.seen.v1", "1");
  });
  await page.route("**/api/customer/loyalty-program", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      success: true,
      message: "",
      data: {
        enabled: true,
        policy_version: "loyalty-5-plus-1-v1",
        qualifying_washes: 5,
        reward_washes: 1,
        first_activated_at: "2026-08-05T09:00:00Z",
        last_activated_at: "2026-08-05T09:00:00Z",
        paused_at: null,
        reward_expires: false,
      },
      errors: null,
    }),
  }));

  await page.goto("/#services");
  const trigger = page.getByRole("button", { name: /Your 6th wash is on us/i });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: /Five matching washes/i });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: /Close rewards details/i })).toBeFocused();

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 1);

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
