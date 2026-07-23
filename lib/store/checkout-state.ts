export const STORE_CART_KEY = "bubbleit.store.cart";
export const STORE_PENDING_CHECKOUT_KEY = "bubbleit.store.pending-checkout";
export const STORE_CHECKOUT_ATTEMPT_KEY = "bubbleit.store.checkout-attempt";

function pendingOrderId(): number | null {
  try {
    const raw = window.localStorage.getItem(STORE_PENDING_CHECKOUT_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as { order?: { id?: unknown } };
    return typeof pending.order?.id === "number" ? pending.order.id : null;
  } catch {
    return null;
  }
}

export function clearCompletedStoreCheckout(orderId: number) {
  if (typeof window === "undefined" || pendingOrderId() !== orderId) return;
  window.localStorage.removeItem(STORE_CART_KEY);
  window.localStorage.removeItem(STORE_PENDING_CHECKOUT_KEY);
  window.localStorage.removeItem(STORE_CHECKOUT_ATTEMPT_KEY);
}

export function releasePendingStoreCheckout(orderId: number) {
  if (typeof window === "undefined" || pendingOrderId() !== orderId) return;
  // Keep the products in the cart. Only the expired/cancelled server
  // reservation and its idempotency keys are released.
  window.localStorage.removeItem(STORE_PENDING_CHECKOUT_KEY);
  window.localStorage.removeItem(STORE_CHECKOUT_ATTEMPT_KEY);
}
