"use client";

import type {
  Address,
  Availability,
  Booking,
  BookingQuote,
  CreateStoreOrderPayload,
  CreateBookingPayload,
  Customer,
  CustomerMembership,
  Envelope,
  MembershipPlan,
  Paginated,
  PromoValidation,
  QuoteCar,
  Service,
  StoreOrder,
  StoreOrderPayment,
  StoreProductInventory,
  Vehicle,
  VerifyOtpResult,
} from "@/lib/api/types";

// Swap to the real Laravel backend by setting NEXT_PUBLIC_API_BASE, e.g.
// NEXT_PUBLIC_API_BASE=https://bubbleit-backend.on-forge.com/api/v1/customer
const BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "/api/mock/v1/customer";

const TOKEN_KEY = "bubbleit.customer_token";
const TOKEN_COOKIE = "bubbleit_customer_token";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const token = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${TOKEN_COOKIE}=`))
    ?.split("=")[1];
  return token ? decodeURIComponent(token) : null;
}

function writeTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = token
    ? `${TOKEN_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${TOKEN_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
    : `${TOKEN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return readTokenCookie() ?? window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  writeTokenCookie(token);
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]> | null;

  constructor(status: number, message: string, errors: Record<string, string[]> | null = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

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
    throw new ApiError(res.status, "Unexpected server response.");
  }

  if (!res.ok || !envelope.success) {
    throw new ApiError(res.status, envelope.message || "Request failed.", envelope.errors);
  }
  return envelope.data;
}

// ── Public catalog ───────────────────────────────────────────────────────────

export function getServices() {
  return request<Paginated<Service>>("/services", { auth: false }).then((r) => r.data);
}

export type AvailabilityCar = {
  service_id: number;
  add_on_ids?: number[];
};

export function getAvailability(
  date: string,
  window: "standard" | "midnight" = "standard",
  cartOrServiceIds: AvailabilityCar[] | number[] = [],
) {
  const params = new URLSearchParams({ date, window });
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

  return request<Availability>(`/availability?${params.toString()}`, { auth: false });
}

export function getMembershipPlans() {
  return request<Paginated<MembershipPlan>>("/membership-plans", { auth: false }).then((r) => r.data);
}

export function listStoreProducts() {
  return request<Paginated<StoreProductInventory>>("/store/products", { auth: false }).then((r) =>
    r.data.map((product) => ({
      ...product,
      imageAlt: product.imageAlt ?? product.name,
    })),
  );
}

export function createStoreOrder(payload: CreateStoreOrderPayload) {
  return request<StoreOrder>("/store/orders", {
    method: "POST",
    body: payload,
  });
}

export function payStoreOrder(orderId: number) {
  return request<StoreOrderPayment>(`/store/orders/${orderId}/pay`, {
    method: "POST",
  });
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function checkPhone(phone: string) {
  return request<{ registered: boolean; has_password?: boolean }>("/auth/check-phone", {
    method: "POST",
    body: { phone },
    auth: false,
  });
}

export async function loginWithPassword(phone: string, password: string) {
  const result = await request<VerifyOtpResult>("/auth/login", {
    method: "POST",
    body: { phone, password },
    auth: false,
  });
  setToken(result.token);
  return result;
}

export async function register(payload: {
  phone: string;
  name: string;
  password: string;
  code: string;
}) {
  const result = await request<VerifyOtpResult>("/auth/register", {
    method: "POST",
    body: payload,
    auth: false,
  });
  setToken(result.token);
  return result;
}

export function requestOtp(phone: string) {
  return request<null>("/auth/request-otp", {
    method: "POST",
    body: { phone },
    auth: false,
  });
}

export async function verifyOtp(phone: string, code: string) {
  const result = await request<VerifyOtpResult>("/auth/verify-otp", {
    method: "POST",
    body: { phone, code },
    auth: false,
  });
  setToken(result.token);
  return result;
}

export function me() {
  return request<Customer>("/auth/me");
}

export async function logout() {
  try {
    await request<null>("/auth/logout", { method: "POST" });
  } finally {
    setToken(null);
  }
}

export function updateProfile(payload: { name: string; email?: string; password?: string }) {
  return request<Customer>("/profile", { method: "PUT", body: payload });
}

// ── Vehicles & addresses ─────────────────────────────────────────────────────

export function listVehicles() {
  return request<Paginated<Vehicle>>("/vehicles").then((r) => r.data);
}

export function createVehicle(payload: Omit<Vehicle, "id">) {
  return request<Vehicle>("/vehicles", { method: "POST", body: payload });
}

export function deleteVehicle(id: number) {
  return request<null>(`/vehicles/${id}`, { method: "DELETE" });
}

export function createAddress(payload: Omit<Address, "id"> | Omit<Address, "id" | "latitude" | "longitude">) {
  return request<Address>("/addresses", { method: "POST", body: payload });
}

export function listAddresses() {
  return request<Paginated<Address>>("/addresses").then((r) => r.data);
}

export function updateAddress(id: number, payload: Omit<Address, "id">) {
  return request<Address>(`/addresses/${id}`, { method: "PUT", body: payload });
}

export function deleteAddress(id: number) {
  return request<null>(`/addresses/${id}`, { method: "DELETE" });
}

// ── Memberships ──────────────────────────────────────────────────────────────

export function listMemberships() {
  return request<Paginated<CustomerMembership>>("/memberships").then((r) => r.data);
}

export function buyMembership(planId: number) {
  return request<CustomerMembership & { pay_url: string | null }>("/memberships", {
    method: "POST",
    body: { plan_id: planId },
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

export function createBooking(payload: CreateBookingPayload) {
  return request<Booking>("/bookings", { method: "POST", body: payload });
}

// Server-side price preview: applies the customer's eligible memberships to the
// cart and returns the authoritative total. Requires auth.
export function getQuote(payload: {
  scheduled_at: string;
  cars: QuoteCar[];
  use_membership?: boolean;
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
