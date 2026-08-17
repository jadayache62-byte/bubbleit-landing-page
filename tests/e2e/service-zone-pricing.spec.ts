import { expect, test } from "@playwright/test";

const envelope = <T,>(data: T) => ({
  success: true,
  message: "",
  data,
  errors: null,
});

const paginated = <T,>(data: T[]) => ({
  data,
  meta: {
    current_page: 1,
    last_page: 1,
    total: data.length,
    per_page: 50,
  },
});

test("a priced service zone is disclosed at store location and checkout", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("bubbleit.store.cart", JSON.stringify({ 1: 1 }));
  });

  await page.route("**/api/customer/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/customer/, "");

    if (path === "/auth/me") {
      return route.fulfill({
        json: envelope({
          id: 1,
          name: "Zone Customer",
          phone: "+97450000000",
          email: null,
        }),
      });
    }

    if (path === "/payment-options") {
      return route.fulfill({
        json: envelope({
          mode: "online",
          methods: [{ channel: "skipcash_hosted", label: "Card or Apple Pay" }],
        }),
      });
    }

    if (path === "/store/products") {
      return route.fulfill({
        json: envelope(paginated([{
          id: 1,
          sku: "BT-DRY-MF-1400",
          name: "Drying microfiber",
          name_ar: "منشفة تجفيف",
          description: "Car-care product",
          description_ar: "منتج للعناية بالسيارة",
          price: 95,
          imageSrc: null,
          stock_quantity: 10,
          sold_quantity: 0,
          reserved_quantity: 0,
          available_quantity: 10,
          category: "car_care",
          is_available: true,
        }])),
      });
    }

    if (path === "/addresses") {
      return route.fulfill({
        json: envelope(paginated([{
          id: 21,
          label: "Home",
          area: "The Pearl",
          details: "Tower entrance",
          building_number: "24",
          zone_number: "66",
          street_number: "810",
          latitude: 25.37,
          longitude: 51.55,
          service_area: { version: "qatar-area-v1", eligible: true, stale: false },
        }])),
      });
    }

    if (path === "/service-area/validate") {
      return route.fulfill({
        json: envelope({
          version: "qatar-area-v1",
          eligible: true,
          dispatch_zone: {
            id: 3,
            name_en: "Service zone 3",
            name_ar: "منطقة الخدمة 3",
            version: "dz_service_zone_3_v4",
            service_rate: 15,
            rate_applied: true,
          },
        }),
      });
    }

    return route.fulfill({
      status: 404,
      json: {
        success: false,
        message: `Unexpected customer API request: ${route.request().method()} ${path}`,
        data: null,
        errors: null,
      },
    });
  });

  await page.goto("/store/checkout");

  const locationNotice = page.getByRole("status").filter({
    hasText: "This location is subject to an additional service charge",
  });
  await expect(locationNotice).toBeVisible();
  await expect(locationNotice).toContainText("QAR 15");
  await expect(locationNotice).toContainText("included in the total shown at checkout");
  await expect(page.getByRole("heading", { name: "Where should we deliver?" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Order summary" })).toContainText("QAR 110");

  await page.getByRole("button", { name: "Review order" }).click();

  const reviewCard = page.getByRole("heading", { name: "Review your order" }).locator("..");
  await expect(reviewCard).toBeVisible();
  const zoneLine = reviewCard.locator("div.border-t").filter({
    hasText: "Additional service-zone charge",
  });
  await expect(zoneLine).toBeVisible();
  await expect(zoneLine).toContainText("QAR 15");
  await expect(reviewCard).toContainText("QAR 110");
  await expect(locationNotice).toBeVisible();
  await expect(page.getByText("Service zone 3")).toHaveCount(0);
});
