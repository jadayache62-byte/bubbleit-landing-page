"use client";

import type {
  Address,
  Availability,
  Booking,
  BookingQuote,
  BookingRescheduleOptions,
  CreateStoreOrderPayload,
  CreateBookingPayload,
  Customer,
  CustomerDataExportRequest,
  CustomerDeletionResult,
  CustomerMembership,
  CustomerNotification,
  CustomerNotificationDevice,
  CustomerNotificationPreference,
  CustomerReviewInvitation,
  Envelope,
  MembershipPlan,
  Paginated,
  PromoValidation,
  QuoteCar,
  Service,
  ServiceAreaSnapshot,
  StoreOrder,
  StoreOrderPayment,
  StoreProductInventory,
  Vehicle,
  VerifyOtpResult,
} from "@/lib/api/types";

// The browser only calls this same-origin BFF. The BFF owns the backend bearer
// token in an HttpOnly cookie, so application JavaScript can never read it.
const BASE = "/api/customer";

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;
  retryAfterSeconds: number | null;
  code: string | null;
  data: unknown;
  requestId: string | null;

  constructor(
    status: number,
    message: string,
    errors: Record<string, string[]> | null = null,
    retryAfterSeconds: number | null = null,
    code: string | null = null,
    data: unknown = null,
    requestId: string | null = null,
  ) {
    super(
      `${retryAfterSeconds !== null && retryAfterSeconds > 0
        ? `${message} Try again in ${retryAfterSeconds} seconds.`
        : message}${requestId ? ` Reference: ${requestId}.` : ""}`,
    );
    this.status = status;
    this.errors = errors;
    this.retryAfterSeconds = retryAfterSeconds;
    this.code = code;
    this.data = data;
    this.requestId = requestId;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  Object.assign(headers, options.headers);

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "same-origin",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let envelope: Envelope<T>;
  try {
    envelope = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(
      res.status,
      "Unexpected server response.",
      null,
      null,
      null,
      null,
      res.headers.get("x-request-id"),
    );
  }

  if (
    res.status === 401 &&
    res.headers.get("x-session-ended") === "true" &&
    typeof window !== "undefined"
  ) {
    window.sessionStorage.setItem(
      "bubbleit.auth.return_to",
      `${window.location.pathname}${window.location.search}`,
    );
    window.dispatchEvent(
      new CustomEvent("bubbleit:session-ended", {
        detail: { message: envelope.message || "Your session has ended. Please sign in again." },
      }),
    );
  }

  if (!res.ok || !envelope.success) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfter = retryAfterHeader === null ? null : Number.parseInt(retryAfterHeader, 10);
    throw new ApiError(
      res.status,
      envelope.message || "Request failed.",
      envelope.errors,
      Number.isFinite(retryAfter) ? retryAfter : null,
      envelope.code ?? null,
      envelope.data,
      res.headers.get("x-request-id"),
    );
  }
  return envelope.data;
}

// ── Public catalog ───────────────────────────────────────────────────────────

export function getServices() {
  return request<Paginated<Service>>("/services").then((r) => r.data);
}

export type AvailabilityCar = {
  service_id: number;
  add_on_ids?: number[];
};

export function getAvailability(
  date: string,
  window: "standard" | "midnight",
  coordinates: { latitude: number; longitude: number },
  cartOrServiceIds: AvailabilityCar[] | number[] = [],
) {
  const params = new URLSearchParams({
    date,
    window,
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
  });
  if (cartOrServiceIds.every((value) => typeof value === "number")) {
    (cartOrServiceIds as number[]).forEach((serviceId) => {
      params.append("service_ids[]", String(serviceId));
    });
  } else {
    (cartOrServiceIds as AvailabilityCar[]).forEach((car, index) => {
      params.append(`cars[${index}][service_id]`, String(car.service_id));
      car.add_on_ids?.forEach((addOnId) => {
        params.append(`cars[${index}][add_on_ids][]`, String(addOnId));
      });
    });
  }

  return request<Availability>(`/availability?${params.toString()}`);
}

export function validateServiceArea(latitude: number, longitude: number) {
  return request<ServiceAreaSnapshot>("/service-area/validate", {
    method: "POST",
    body: { latitude, longitude },
  });
}

export function getMembershipPlans() {
  return request<Paginated<MembershipPlan>>("/membership-plans").then((r) => r.data);
}

export function listStoreProducts() {
  return request<Paginated<StoreProductInventory>>("/store/products").then((r) =>
    r.data.map((product) => ({
      ...product,
      imageAlt: product.imageAlt ?? product.name,
    })),
  );
}

export function createStoreOrder(payload: CreateStoreOrderPayload, idempotencyKey: string) {
  return request<StoreOrder>("/store/orders", {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function listStoreOrders() {
  return request<Paginated<StoreOrder>>("/store/orders").then((result) => result.data);
}

export function getStoreOrder(orderId: number) {
  return request<StoreOrder>(`/store/orders/${orderId}`);
}

export function payStoreOrder(orderId: number, idempotencyKey: string) {
  return request<StoreOrderPayment>(`/store/orders/${orderId}/pay`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function checkPhone(phone: string) {
  return request<{ continuation: "choose_auth_method" }>("/auth/check-phone", {
    method: "POST",
    body: { phone },
  });
}

function customerDeviceLabel() {
  const platform = typeof navigator === "undefined" ? "" : navigator.platform.trim();
  return platform ? `BubbleIt customer web on ${platform}` : "BubbleIt customer web";
}

export function loginWithPassword(phone: string, password: string) {
  return request<VerifyOtpResult>("/auth/login", {
    method: "POST",
    body: { phone, password, device_name: customerDeviceLabel() },
  });
}

export async function register(payload: {
  phone: string;
  name: string;
  password: string;
  code: string;
}) {
  return request<VerifyOtpResult>("/auth/register", {
    method: "POST",
    body: { ...payload, device_name: customerDeviceLabel() },
  });
}

export type OtpPurpose = "authentication" | "registration";

export function requestOtp(phone: string, purpose: OtpPurpose) {
  return request<null>("/auth/request-otp", {
    method: "POST",
    body: { phone, purpose },
  });
}

export function verifyOtp(phone: string, code: string) {
  return request<VerifyOtpResult>("/auth/verify-otp", {
    method: "POST",
    body: { phone, code, device_name: customerDeviceLabel() },
  });
}

export function me() {
  return request<Customer>("/auth/me");
}

export async function logout() {
  await request<null>("/auth/logout", { method: "POST" });
}

// ── Customer notifications ─────────────────────────────────────────────────

export function listCustomerNotifications() {
  return request<Paginated<CustomerNotification>>("/notifications").then((result) => result.data);
}

export function markCustomerNotificationRead(notificationId: number) {
  return request<CustomerNotification>(`/notifications/${notificationId}/read`, { method: "POST" });
}

export function resolveCustomerNotification(notificationId: number) {
  return request<{ path: string }>(`/notifications/${notificationId}/resolve`, { method: "POST" });
}

export function getCustomerNotificationPreferences() {
  return request<CustomerNotificationPreference>("/notification-preferences");
}

export function updateCustomerNotificationPreferences(payload: {
  locale: "en" | "ar";
  push_enabled: boolean;
}) {
  return request<CustomerNotificationPreference>("/notification-preferences", {
    method: "PUT",
    body: payload,
  });
}

export function registerCustomerNotificationDevice(payload: {
  token: string;
  locale: "en" | "ar";
  name?: string;
}) {
  return request<CustomerNotificationDevice>("/notification-devices", {
    method: "POST",
    body: { ...payload, platform: "web" },
  });
}

export function removeCustomerNotificationDevice(deviceId: number) {
  return request<null>(`/notification-devices/${deviceId}`, { method: "DELETE" });
}

export function getCustomerReviewInvitation(publicId: string) {
  return request<CustomerReviewInvitation>(`/review-invitations/${encodeURIComponent(publicId)}`);
}

export function submitCustomerReview(publicId: string, rating: number, comment?: string) {
  return request<CustomerReviewInvitation>(`/review-invitations/${encodeURIComponent(publicId)}`, {
    method: "POST",
    body: { rating, comment: comment?.trim() || null },
  });
}

export function updateProfile(payload: { name: string; email?: string; password?: string }) {
  return request<Customer>("/profile", { method: "PUT", body: payload });
}

export function createCustomerDataExport() {
  return request<CustomerDataExportRequest>("/privacy/export", { method: "POST" });
}

export function downloadCustomerDataExport(requestId: number, token: string) {
  return request<Record<string, unknown>>(`/privacy/export/${requestId}/download`, {
    method: "POST",
    body: { token },
  });
}

export function deleteCustomerAccount(code: string) {
  return request<CustomerDeletionResult>("/privacy/delete-account", {
    method: "POST",
    body: { code, confirmation: "DELETE" },
  });
}

// ── Vehicles & addresses ─────────────────────────────────────────────────────

export function listVehicles() {
  return request<Paginated<Vehicle>>("/vehicles").then((r) => r.data);
}

export function createVehicle(payload: Omit<Vehicle, "id">, idempotencyKey?: string) {
  return request<Vehicle>("/vehicles", {
    method: "POST",
    body: payload,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function deleteVehicle(id: number) {
  return request<null>(`/vehicles/${id}`, { method: "DELETE" });
}

export type AddressPayload = Omit<Address, "id" | "service_area" | "latitude" | "longitude"> & {
  latitude: number;
  longitude: number;
};

export function createAddress(payload: AddressPayload, idempotencyKey?: string) {
  return request<Address>("/addresses", {
    method: "POST",
    body: payload,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function listAddresses() {
  return request<Paginated<Address>>("/addresses").then((r) => r.data);
}

export function updateAddress(id: number, payload: AddressPayload) {
  return request<Address>(`/addresses/${id}`, { method: "PUT", body: payload });
}

export function deleteAddress(id: number) {
  return request<null>(`/addresses/${id}`, { method: "DELETE" });
}

// ── Memberships ──────────────────────────────────────────────────────────────

export function listMemberships() {
  return request<Paginated<CustomerMembership>>("/memberships").then((r) => r.data);
}

export function buyMembership(planId: number, idempotencyKey: string) {
  return request<CustomerMembership>("/memberships", {
    method: "POST",
    body: { plan_id: planId },
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

export function initializeMembershipPayment(membershipId: number, idempotencyKey: string) {
  return request<StoreOrderPayment>(`/memberships/${membershipId}/pay`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

// ── Bookings ─────────────────────────────────────────────────────────────────

// Validates a promo code against the current cart. Requires auth so the
// backend can enforce per-customer usage limits. Same contract the admin app
// uses; the customer namespace scopes it to the signed-in customer.
export function validatePromo(code: string, subtotal: number, serviceIds: number[]) {
  return request<PromoValidation>("/promo-codes/validate", {
    method: "POST",
    body: { code, subtotal, service_ids: serviceIds },
  });
}

export function createBooking(payload: CreateBookingPayload, idempotencyKey?: string) {
  return request<Booking>("/bookings", {
    method: "POST",
    body: payload,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function initializeBookingPayment(bookingId: number, idempotencyKey: string) {
  return request<{ checkout_url: string | null; status: "ready" }>(`/bookings/${bookingId}/pay`, {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

// Server-side price preview: applies the customer's eligible memberships to the
// cart and returns the authoritative total. Requires auth.
export function getQuote(payload: {
  scheduled_at: string;
  cars: QuoteCar[];
  duration_version: string;
  use_membership?: boolean;
  preselect_memberships?: boolean;
  product_lines?: { product_id: number; quantity: number }[];
  promo_code?: string;
  address_id?: number;
  latitude?: number;
  longitude?: number;
  service_area_version: string;
}) {
  return request<BookingQuote>("/bookings/quote", { method: "POST", body: payload });
}

export function listBookings() {
  return request<Paginated<Booking>>("/bookings").then((r) => r.data);
}

export function getBooking(id: number) {
  return request<Booking>(`/bookings/${id}`);
}

export function cancelBooking(id: number) {
  return request<Booking>(`/bookings/${id}/cancel`, { method: "POST" });
}

export function completeMockBookingPayment(id: number) {
  return request<null>(`/bookings/${id}/mock-complete-payment`, { method: "POST" });
}

export function getBookingRescheduleOptions(id: number, date: string) {
  return request<BookingRescheduleOptions>(`/bookings/${id}/reschedule-options?date=${encodeURIComponent(date)}`);
}

export function rescheduleBooking(
  id: number,
  payload: {
    scheduled_at: string;
    duration_version: string;
    service_area_version: string;
    slot_version: string;
  },
  idempotencyKey: string,
) {
  return request<Booking>(`/bookings/${id}/reschedule`, {
    method: "POST",
    body: payload,
    headers: { "Idempotency-Key": idempotencyKey },
  });
}
