import { expect, test } from "@playwright/test";

const arabicCookie = {
  name: "bubbleit.lang",
  value: "ar",
  domain: "127.0.0.1",
  path: "/",
};

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(expect.objectContaining({ content: expect.any(Number) }));

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([arabicCookie]);
});

test("Arabic is server-rendered in RTL before release-critical content", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const response = await page.goto("/store");

  expect(response?.ok()).toBeTruthy();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: "المتجر غير متاح مؤقتاً" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "إعادة تحميل المتجر" })).toBeVisible();
  await expect(page.getByRole("button", { name: "فتح قائمة التنقل" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("Arabic booking and home layouts preserve semantic order and localized numerals", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/book");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { name: "غسلتك على جدولك" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/#services");
  await expect(page.getByRole("heading", { name: "خدمات غسيل السيارات حتى باب منزلك" })).toBeVisible();
  const firstService = page.locator("#services article").first();
  await expect(firstService).toContainText(/[٠-٩]/);
  await expect(firstService.getByRole("link")).toHaveAttribute("href", "/book");
  await expectNoHorizontalOverflow(page);
});

test("locale control persists English and updates document direction", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("bubbleit.lang")))
    .toBe("en");
  await expect
    .poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === "bubbleit.lang")?.value)
    .toBe("en");
});
