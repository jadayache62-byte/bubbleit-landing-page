import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const invitation = "2cbac6f4-a8e7-4c79-8ba5-84047a28b910";

test("customer submits a direct accessible star review without mobile overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  let submitted = false;
  await page.route(`**/api/customer/review-invitations/${invitation}`, async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as { rating: number; comment: string | null };
      expect(payload).toEqual({ rating: 5, comment: "Fast and careful." });
      submitted = true;
    }
    await route.fulfill({
      status: submitted ? (request.method() === "POST" ? 201 : 200) : 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: submitted ? "Review submitted for approval." : "",
        errors: null,
        data: {
          id: invitation,
          state: submitted ? "submitted" : "available",
          expires_at: "2026-08-09T12:00:00Z",
          booking_reference: "BK-20260719-0071",
          service: { name_en: "Standard Bubble", name_ar: "ستاندرد بابل" },
          review: submitted ? { rating: 5, comment: "Fast and careful.", status: "pending" } : null,
        },
      }),
    });
  });

  await page.goto(`/review/${invitation}`);
  await expect(page.getByRole("heading", { name: "How was your wash?" })).toBeVisible();
  await page.getByRole("radio", { name: "5 stars" }).locator("..").click();
  await expect(page.getByRole("radio", { name: "5 stars" })).toBeChecked();
  await page.getByLabel("Notes (optional)").fill("Fast and careful.");

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your feedback" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("awaiting moderation");

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});
