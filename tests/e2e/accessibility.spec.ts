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
