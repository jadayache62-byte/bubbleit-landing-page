"use client";

import type {
  Address,
  Availability,
  Booking,
  CreateBookingPayload,
  Customer,
  CustomerMembership,
  Envelope,
  MembershipPlan,
  Paginated,
  Service,
  Vehicle,
  VerifyOtpResult,
} from "@/lib/api/types";

// Swap to the real Laravel backend by setting NEXT_PUBLIC_API_BASE, e.g.
// NEXT_PUBLIC_API_BASE=https://bubbleit-backend.on-forge.com/api/v1/customer
const BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "/api/mock/v1/customer";

const TOKEN_KEY = "bubbleit.customer_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
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

export function getAvailability(date: string, window: "standard" | "midnight" = "standard") {
  return request<Availability>(`/availability?date=${date}&window=${window}`, { auth: false });
}

export function getMembershipPlans() {
  return request<Paginated<MembershipPlan>>("/membership-plans", { auth: false }).then((r) => r.data);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export function checkPhone(phone: string) {
  return request<{ registered: boolean }>("/auth/check-phone", {
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

export function createAddress(payload: Omit<Address, "id"> | Omit<Address, "id" | "latitude" | "longitude">) {
  return request<Address>("/addresses", { method: "POST", body: payload });
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

export function createBooking(payload: CreateBookingPayload) {
  return request<Booking>("/bookings", { method: "POST", body: payload });
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
