import { expect, test } from "@playwright/test";

const paginated = <T,>(data: T[]) => ({
  data,
  meta: {
    current_page: 1,
    last_page: 1,
    total: data.length,
    per_page: 50,
  },
});

const envelope = <T,>(data: T) => ({
  success: true,
  message: "",
  data,
  errors: null,
});

test("a midnight member books the covered vehicle without choosing a service", async ({ page }) => {
  let bookingOptionsUrl: URL | null = null;
  let bookingPayload: Record<string, unknown> | null = null;
  let publicAvailabilityRequests = 0;
  let paymentInitializationRequests = 0;

  await page.route("**/api/customer/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/customer/, "");

    if (path === "/auth/me") {
      return route.fulfill({ json: envelope({
        id: 1,
        name: "Midnight Member",
        phone: "+97450000000",
        email: null,
      }) });
    }

    if (path === "/services") {
      return route.fulfill({ json: envelope(paginated([{
        id: 31,
        name: "Standard Bubble",
        name_ar: "ستاندرد بابل",
        description: "A regular paid service.",
        description_ar: "خدمة عادية مدفوعة.",
        price: 60,
        price_suv: 70,
        duration_minutes: 30,
        duration_suv: 40,
        duration_label: "30–40 min",
        category: "wash",
        add_ons: [],
      }])) });
    }

    if (path === "/payment-options") {
      return route.fulfill({ json: envelope({
        mode: "online",
        methods: [{ channel: "skipcash_hosted", label: "Card or Apple Pay" }],
      }) });
    }

    if (path === "/store/products") {
      return route.fulfill({ json: envelope(paginated([{
        id: 91,
        sku: "MICROFIBER-1",
        name: "Microfiber cloth",
        name_ar: "قطعة مايكروفايبر",
        description: "Optional car-care product.",
        description_ar: "منتج اختياري للعناية بالسيارة.",
        price: 15,
        imageSrc: null,
        stock_quantity: 20,
        sold_quantity: 0,
        reserved_quantity: 0,
        available_quantity: 20,
        category: "car_care",
        is_available: true,
      }])) });
    }

    if (path === "/memberships") {
      return route.fulfill({ json: envelope(paginated([{
        id: 7,
        status: "active",
        washes_used: 2,
        washes_remaining: 6,
        price_paid: 400,
        activated_at: "2026-07-01T00:00:00+03:00",
        expires_at: "2027-07-01T00:00:00+03:00",
        plan: {
          id: 4,
          name: "Midnight SUV",
          name_ar: "اشتراك منتصف الليل للدفع الرباعي",
          description: "Private midnight exterior washes.",
          description_ar: "غسيل خارجي خاص بعد منتصف الليل.",
          scope: "midnight_exterior",
          vehicle_type: "suv",
          washes_count: 8,
          price: 400,
          validity_days: 365,
          window_start: "00:00",
          window_end: "05:00",
        },
      }])) });
    }

    if (path === "/vehicles") {
      return route.fulfill({ json: envelope(paginated([
        {
          id: 11,
          make: "Toyota",
          model: "Land Cruiser",
          year: 2025,
          color: "White",
          plate_number: "555555",
          type: "suv",
        },
        {
          id: 12,
          make: "Toyota",
          model: "Camry",
          year: 2024,
          color: "Black",
          plate_number: "222222",
          type: "sedan",
        },
      ])) });
    }

    if (path === "/addresses") {
      return route.fulfill({ json: envelope(paginated([{
        id: 21,
        label: "Home",
        area: "West Bay",
        details: "Tower entrance",
        building_number: "24",
        zone_number: "66",
        street_number: "810",
        latitude: 25.329,
        longitude: 51.531,
        service_area: { version: "qatar-area-v1", eligible: true, stale: false },
      }])) });
    }

    if (path === "/service-area/validate") {
      return route.fulfill({ json: envelope({ version: "qatar-area-v1", eligible: true }) });
    }

    if (/^\/memberships\/7\/booking-options$/.test(path)) {
      bookingOptionsUrl = url;
      const date = url.searchParams.get("date");
      return route.fulfill({ json: envelope({
        membership_id: 7,
        selected_vehicle_id: 11,
        plan: {
          name: "Midnight SUV",
          name_ar: "اشتراك منتصف الليل للدفع الرباعي",
          vehicle_type: "suv",
          service_name: "Exterior wash",
          window: "midnight",
          window_start: "00:00",
          window_end: "05:00",
        },
        date,
        duration_minutes: 45,
        duration: {
          schema: "duration-v1",
          version: "membership-duration-test-v1",
          total_minutes: 45,
          contributions: [],
        },
        eligible_vehicles: [{
          id: 11,
          plate_number: "555555",
          make: "Toyota",
          model: "Land Cruiser",
          type: "suv",
        }],
        slots: [
          { start: "00:00", end: "00:45", available: true },
          { start: "00:15", end: "01:00", available: true },
        ],
        dispatch_zone: {
          enabled: true,
          eligible: true,
          version: "dz_membership_fixture_opaque_v1",
        },
      }) });
    }

    if (path === "/bookings" && request.method() === "POST") {
      bookingPayload = request.postDataJSON() as Record<string, unknown>;
      const scheduledAt = String(bookingPayload.scheduled_at);
      return route.fulfill({ json: envelope({
        id: 501,
        reference: "BK-000501",
        status: "paid",
        status_label: "Confirmed",
        scheduled_at: scheduledAt,
        scheduled_end_at: scheduledAt,
        service_date: scheduledAt.slice(0, 10),
        timezone: "Asia/Qatar",
        duration_minutes: 45,
        duration_label: "45 min",
        membership_applied: true,
        payment_method: "membership",
        payment_purchase_id: null,
        total: 0,
        product_total: 0,
        products: [],
        address_label: "Home",
        address_area: "West Bay",
        address_street: "Tower entrance",
        building_number: "24",
        zone_number: "66",
        street_number: "810",
        notes: "",
        cars: [],
        created_at: "2026-08-01T12:00:00+03:00",
        payment: {
          status: "not_required",
          captured: false,
          channel: "membership",
          reconciliation_reason: null,
          checkout_url: null,
        },
        refund: null,
      }) });
    }

    if (path === "/bookings/501/pay") {
      paymentInitializationRequests += 1;
    }

    if (path === "/availability") {
      publicAvailabilityRequests += 1;
    }

    return route.fulfill({
      status: 404,
      json: {
        success: false,
        message: `Unexpected customer API request: ${request.method()} ${path}`,
        data: null,
        errors: null,
      },
    });
  });

  await page.goto("/book");

  await expect(page.getByRole("heading", { name: "Choose your membership vehicle" })).toBeVisible();
  await expect(page.getByText("Service selected automatically")).toBeVisible();
  await expect(page.getByRole("button", { name: /555555/ })).toBeVisible();
  await expect(page.getByText("222222")).toHaveCount(0);
  await expect(page.getByText("Standard Bubble")).toHaveCount(0);

  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Home/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: /Tomorrow/ }).click();
  await expect(page.getByText("Midnight membership access")).toBeVisible();
  await expect.poll(() => bookingOptionsUrl?.searchParams.get("vehicle_id")).toBe("11");
  expect(bookingOptionsUrl?.searchParams.get("latitude")).toBe("25.329");
  expect(bookingOptionsUrl?.searchParams.get("longitude")).toBe("51.531");
  expect(publicAvailabilityRequests).toBe(0);

  await page.getByRole("button", { name: "00:00", exact: true }).click();
  await page.getByRole("option", { name: "00:00", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Would you like any store products?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "No, confirm my wash" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, browse products" })).toBeVisible();
  await expect(page.getByText("Service selected automatically")).toHaveCount(0);

  await page.getByRole("button", { name: "No, confirm my wash" }).click();
  await expect(page.getByText("No store products")).toBeVisible();
  await page.getByRole("button", { name: "Confirm booking" }).click();

  await expect(page.getByRole("heading", { name: "Booking confirmed — membership covered" })).toBeVisible();
  await expect(page.getByText("BK-000501")).toBeVisible();
  expect(bookingPayload).toMatchObject({
    membership_id: 7,
    dispatch_zone_version: "dz_membership_fixture_opaque_v1",
    vehicle_id: 11,
    duration_version: "membership-duration-test-v1",
    address_id: 21,
    service_area_version: "qatar-area-v1",
    product_lines: [],
  });
  expect(bookingPayload).not.toHaveProperty("service_id");
  expect(bookingPayload).not.toHaveProperty("cars");
  expect(bookingPayload).not.toHaveProperty("quote_id");
  expect(paymentInitializationRequests).toBe(0);
});

test("changing a new membership vehicle uses a new internal key and plate-only payload", async ({ page }) => {
  const vehicleRequests: Array<{
    body: Record<string, unknown>;
    idempotencyKey: string | null;
  }> = [];

  await page.route("**/api/customer/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/customer/, "");

    if (path === "/auth/me") {
      return route.fulfill({ json: envelope({
        id: 1,
        name: "Membership Customer",
        phone: "+97450000000",
        email: null,
      }) });
    }

    if (path === "/services" || path === "/store/products") {
      return route.fulfill({ json: envelope(paginated([])) });
    }

    if (path === "/payment-options") {
      return route.fulfill({ json: envelope({
        mode: "online",
        methods: [{ channel: "skipcash_hosted", label: "Card or Apple Pay" }],
      }) });
    }

    if (path === "/memberships") {
      return route.fulfill({ json: envelope(paginated([{
        id: 7,
        status: "active",
        washes_used: 0,
        washes_remaining: 8,
        price_paid: 400,
        activated_at: "2026-07-01T00:00:00+03:00",
        expires_at: "2027-07-01T00:00:00+03:00",
        plan: {
          id: 4,
          name: "SUV Membership",
          name_ar: "اشتراك الدفع الرباعي",
          description: "SUV washes.",
          description_ar: "غسيل الدفع الرباعي.",
          scope: "standard",
          vehicle_type: "suv",
          washes_count: 8,
          price: 400,
          validity_days: 365,
          window_start: null,
          window_end: null,
        },
      }])) });
    }

    if (path === "/vehicles" && request.method() === "GET") {
      return route.fulfill({ json: envelope(paginated([])) });
    }

    if (path === "/vehicles" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      vehicleRequests.push({
        body,
        idempotencyKey: await request.headerValue("idempotency-key"),
      });
      return route.fulfill({
        status: 201,
        json: envelope({
          id: 100 + vehicleRequests.length,
          make: "",
          model: "",
          year: null,
          color: "",
          plate_number: body.plate_number,
          type: body.type,
        }),
      });
    }

    if (path === "/addresses") {
      return route.fulfill({ json: envelope(paginated([])) });
    }

    return route.fulfill({
      status: 404,
      json: {
        success: false,
        message: `Unexpected customer API request: ${request.method()} ${path}`,
        data: null,
        errors: null,
      },
    });
  });

  await page.goto("/book");

  await expect(page.getByRole("heading", { name: "Add a covered vehicle" })).toBeVisible();
  await expect(page.getByLabel("Make", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Model", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Color", { exact: true })).toHaveCount(0);

  await page.getByRole("textbox", { name: /Plate no\./ }).fill("123456");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where should we come?" })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Add a different vehicle" }).click();
  await page.getByRole("textbox", { name: /Plate no\./ }).fill("654321");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where should we come?" })).toBeVisible();

  expect(vehicleRequests).toHaveLength(2);
  expect(vehicleRequests[0].body).toEqual({ plate_number: "123456", type: "suv" });
  expect(vehicleRequests[1].body).toEqual({ plate_number: "654321", type: "suv" });
  expect(vehicleRequests[0].idempotencyKey).toBeTruthy();
  expect(vehicleRequests[1].idempotencyKey).toBeTruthy();
  expect(vehicleRequests[1].idempotencyKey).not.toBe(vehicleRequests[0].idempotencyKey);
});
