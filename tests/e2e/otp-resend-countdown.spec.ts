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

test("forgot password verifies the OTP before accepting a confirmed new password", async ({ page }) => {
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

    const data = path.endsWith("/auth/check-phone")
      ? { continuation: "choose_auth_method" }
      : path.endsWith("/auth/forgot-password/verify-otp")
        ? { reset_token: "a".repeat(64), expires_at: "2026-08-05T12:10:00Z" }
        : null;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, message: "", data, errors: null }),
    });
  });

  await page.goto("/account");
  await page.getByPlaceholder("5555 5555").fill("55555555");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Reset my password" }).click();

  await page.getByRole("textbox", { name: "Verification code" }).fill("123456");
  await page.getByRole("button", { name: "Verify phone" }).click();

  await expect(page.getByText("Phone verified. Choose a new password.")).toBeVisible();
  await page.getByPlaceholder("New password", { exact: true }).fill("newpass123");
  await page.getByPlaceholder("Confirm new password").fill("newpass123");
  await page.getByRole("button", { name: "Reset password" }).click();

  await expect(page.getByText("Your password was reset. Sign in again on this device.")).toBeVisible();
  await expect(page.getByText("Enter your account password.")).toBeVisible();
});
