import { expect, test } from "@playwright/test";

const service = {
  id: 1,
  name: "Standard Bubble",
  name_ar: "ستاندرد بابل",
  description: "Exterior wash and interior cleaning.",
  description_ar: "غسيل خارجي وداخلي.",
  price: 60,
  price_suv: 70,
  duration_minutes: 30,
  duration_label: "30 min",
  category: "wash",
  add_ons: [],
};

test.beforeEach(async ({ page }) => {
  await page.route("https://**", (route) => route.abort());
  await page.route("**/api/customer/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api\/customer/, "");
    const data = path === "/payment-options"
      ? { mode: "online", methods: [{ channel: "skipcash_hosted", label: "Card" }] }
      : path === "/store/products"
        ? { data: [], meta: { current_page: 1, last_page: 1, total: 0, per_page: 50 } }
        : path === "/loyalty-program"
          ? { active: false }
          : path === "/service-area/validate"
            ? { version: "qatar-test", eligible: true, dispatch_zone: { eligible: true, version: "zone-test" } }
            : null;
    return route.fulfill({
      status: data === null ? 401 : 200,
      json: { success: data !== null, message: "", data, errors: null },
    });
  });
});

test("right-edge hour options remain inside the mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route("**/api/customer/services", (route) => route.fulfill({
    json: {
      success: true,
      message: "",
      data: { data: [service], meta: { current_page: 1, last_page: 1, total: 1, per_page: 50 } },
      errors: null,
    },
  }));
  await page.route("**/api/customer/availability?**", (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    return route.fulfill({
      json: {
        success: true,
        message: "",
        data: {
          date,
          duration_minutes: 30,
          duration: {
            schema: "duration-v1",
            version: "mobile-overflow-test",
            total_minutes: 30,
            contributions: [],
          },
          slots: ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"].map((start) => ({
            start,
            end: start,
            available: true,
          })),
          service_area: { version: "qatar-test", eligible: true },
          dispatch_zone: {
            enabled: true,
            eligible: true,
            version: "dz-mobile-overflow-test",
          },
        },
        errors: null,
      },
    });
  });
  await page.route("https://nominatim.openstreetmap.org/**", (route) => route.fulfill({
    json: { display_name: "Doha, Qatar", address: { city: "Doha" } },
  }));

  await page.goto("/book");
  await page.getByRole("button", { name: /Standard Bubble/ }).click();
  await page.getByLabel("Plate no.").fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText("Enter coordinates without using the map").click();
  await page.getByLabel("Latitude").fill("25.2854");
  await page.getByLabel("Longitude").fill("51.5310");
  await page.getByRole("button", { name: "Apply coordinates" }).click();
  await page.getByLabel(/Building No/).fill("24");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Tomorrow/ }).click();

  const triggers = page.locator('button[aria-haspopup="listbox"]:not(:disabled)');
  await expect(triggers).toHaveCount(6);
  const boxes = await triggers.evaluateAll((elements) => elements.map((element, index) => ({
    index,
    left: element.getBoundingClientRect().left,
  })));
  const rightmost = boxes.reduce((current, candidate) => candidate.left > current.left ? candidate : current);
  await triggers.nth(rightmost.index).click();

  const popover = page.getByRole("listbox");
  await expect(popover).toBeVisible();
  const bounds = await popover.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(16);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(304);

  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
});

for (const restore of ["tab return", "same date"] as const) {
  test(`${restore} refreshes a slot released by a cancelled booking`, async ({ page }) => {
    let occupied = true;
    let requests = 0;
    await page.route("**/api/customer/services", (route) => route.fulfill({
      json: {
        success: true, message: "", errors: null,
        data: { data: [service], meta: { current_page: 1, last_page: 1, total: 1, per_page: 50 } },
      },
    }));
    await page.route("**/api/customer/availability?**", (route) => {
      requests += 1;
      return route.fulfill({
        json: {
          success: true, message: "", errors: null,
          data: {
            date: new URL(route.request().url()).searchParams.get("date"),
            duration_minutes: 30,
            duration: { schema: "duration-v1", version: "availability-refresh-test", total_minutes: 30, contributions: [] },
            slots: [{ start: "01:00", end: "01:30", available: !occupied }],
            service_area: { version: "qatar-test", eligible: true },
            dispatch_zone: { enabled: true, eligible: true, version: "zone-test" },
          },
        },
      });
    });

    await page.goto("/book");
    await page.getByRole("button", { name: /Standard Bubble/ }).click();
    await page.getByLabel("Plate no.").fill("123456");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByText("Enter coordinates without using the map").click();
    await page.getByLabel("Latitude").fill("25.2854");
    await page.getByLabel("Longitude").fill("51.5310");
    await page.getByRole("button", { name: "Apply coordinates" }).click();
    await page.getByLabel(/Building No/).fill("24");
    await page.getByRole("button", { name: "Continue" }).click();
    const tomorrow = page.getByRole("button", { name: /Tomorrow/ });
    await tomorrow.click();
    const hour = page.getByRole("button", { name: "01:00", exact: true });
    await expect(hour).toBeDisabled();
    const before = requests;

    occupied = false;
    if (restore === "tab return") {
      await page.evaluate(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      });
    } else {
      await tomorrow.click();
    }

    await expect(hour).toBeEnabled();
    expect(requests).toBe(before + 1);
    await hour.click();
    await page.getByRole("option", { name: "01:00", exact: true }).click();
    await expect(hour).toHaveClass(/bg-\[color:var\(--navy\)\]/);
    await expect(page.getByRole("heading", { name: "Pick your time" })).toBeVisible();

    if (restore === "tab return") {
      await page.evaluate(() => {
        const expired = Date.now() + 16 * 60 * 1000;
        Date.now = () => expired;
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.getByRole("heading", { name: "Where should we come?" })).toBeVisible();
      expect(requests).toBe(before + 1);
    }
  });
}
