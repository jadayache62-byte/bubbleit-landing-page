import { expect, test } from "@playwright/test";

test("OTP sign-in enables a clearly explained resend after 30 seconds", async ({ page }) => {
  await page.clock.install();
  await page.route("**/api/customer/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path.endsWith("/auth/me")) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Unauthenticated.",
          data: null,
          errors: null,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "",
        data: path.endsWith("/auth/check-phone")
          ? { continuation: "choose_auth_method" }
          : null,
        errors: null,
      }),
    });
  });

  await page.goto("/account");
  await page.getByPlaceholder("5555 5555").fill("55555555");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Sign in with verification code" }).click();

  const resend = page.getByRole("button", { name: "Request a new code" });
  await expect(page.getByText("You can request a new code in 30 seconds.")).toBeVisible();
  await expect(resend).toBeDisabled();

  await page.clock.fastForward(30_000);

  await expect(page.getByText("You can request a new code now.")).toBeVisible();
  await expect(resend).toBeEnabled();
});
