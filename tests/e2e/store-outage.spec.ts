import { expect, test } from "@playwright/test";

test("catalogue outage fails closed without synthetic products", async ({ page }) => {
  await page.goto("/store");

  await expect(page.getByRole("heading", { name: "The store is temporarily unavailable" })).toBeVisible();
  await expect(page.getByText("No offline products have been added to your cart.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry store" })).toBeVisible();
  await expect(page.locator('a[href="/store/checkout"]')).toHaveCount(0);
});

test("checkout outage preserves the saved cart and blocks submission", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("bubbleit.store.cart", JSON.stringify({ 1: 1 }));
  });
  await page.goto("/store/checkout");

  await expect(page.getByRole("heading", { name: "Checkout is temporarily unavailable" })).toBeVisible();
  await expect(page.getByText(/has not been submitted or replaced with offline products/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry checkout" })).toBeVisible();
  await expect(page.getByRole("button", { name: /place order/i })).toHaveCount(0);
});
