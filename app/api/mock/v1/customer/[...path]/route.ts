// Mock implementation of customer-contract-v1 (bubbleit-mobile/docs/api-contract/).
// Response envelope, paginator shape, and status semantics match the contract so
// the server-side BFF swaps to the real Laravel backend via CUSTOMER_API_BASE.

import { NextRequest, NextResponse } from "next/server";
import type {
  Booking,
  BookingStatus,
  DurationSnapshot,
  PaymentMethod,
  StoreOrder,
  StoreOrderLine,
  StorePricingConfirmation,
  Vehicle,
} from "@/lib/api/types";
import { formatQatarDateTime, qatarServiceDate } from "@/lib/datetime";
import {
  MEMBERSHIP_PLANS,
  MIDNIGHT_SLOT_GRID,
  MOCK_OTP,
  SERVICES,
  SLOT_GRID,
  STATUS_LABELS,
  db,
  evaluatePromo,
  formatDuration,
  makeReference,
} from "@/lib/mock/store";

function envelope(
  data: unknown,
  init: {
    status?: number;
    message?: string;
    errors?: Record<string, string[]> | null;
    code?: string;
  } = {},
) {
  const status = init.status ?? 200;
  return NextResponse.json(
    {
      success: status < 400,
      message: init.message ?? "",
      data,
      errors: init.errors ?? null,
      ...(init.code ? { code: init.code } : {}),
    },
    { status },
  );
}

function paginated<T>(items: T[]) {
  return {
    data: items,
    meta: { current_page: 1, last_page: 1, total: items.length, per_page: 50 },
  };
}

function fail(
  status: number,
  message: string,
  errors: Record<string, string[]> | null = null,
  data: unknown = null,
  code?: string,
) {
  return envelope(data, { status, message, errors, code });
}

function authCustomer(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const customerId = db().tokens.get(token);
  if (!customerId) return null;
  return db().customers.find((c) => c.id === customerId) ?? null;
}

// Mock fleet capacity: 2 buses → a slot is unavailable once 2 active bookings hold it.
const FLEET_CAPACITY = 2;
const POST_BOOKING_BUFFER_MINUTES = 30;
const SERVICE_AREA_VERSION = "qatar-cgis-land-2026-07-14-v1";
const STORE_DELIVERY_FEE_MINOR = 0;
const idempotencyResponses = new Map<string, { request: string; status: number; body: unknown }>();
const paymentAttempts = new Map<string, {
  purchase_id: number;
  attempt_id: number;
  merchant_reference: string;
  payment_reference: string;
  checkout_url: string;
  status: "ready";
}>();
const bookingQuotes = new Map<string, {
  customerId: number;
  version: string;
  expiresAt: string;
  cars: { index: number; membership_id: number | null }[];
}>();
const privacyExports = new Map<number, {
  customerId: number;
  token: string;
  expiresAt: number;
  used: boolean;
}>();

function mockPayment(subject: "BKG" | "MEM" | "STO", id: number) {
  const key = `${subject}:${id}`;
  const sequence = paymentAttempts.size + 1;
  const merchantReference = `${subject}-${id}-A1`;
  const payment = paymentAttempts.get(key) ?? {
    purchase_id: id,
    attempt_id: sequence,
    merchant_reference: merchantReference,
    payment_reference: `sim_${subject.toLowerCase()}_${id}`,
    checkout_url: subject === "BKG"
      ? `/book/checkout?booking=${id}`
      : `/account?tab=${subject === "MEM" ? "memberships" : "orders"}&payment=review&${subject === "MEM" ? "membership" : "order"}=${id}`,
    status: "ready" as const,
  };
  paymentAttempts.set(key, payment);
  return payment;
}

async function storePricing(lines: StoreOrderLine[]): Promise<StorePricingConfirmation> {
  const pricedLines = lines.map((line) => ({
    product_id: line.product_id,
    sku: line.sku,
    name: line.name,
    quantity: line.quantity,
    unit_price_minor: Math.round(line.unit_price * 100),
    line_total_minor: Math.round(line.unit_price * 100) * line.quantity,
  }));
  const subtotalMinor = pricedLines.reduce((sum, line) => sum + line.line_total_minor, 0);
  const snapshot = {
    schema: "store-cart-pricing:v1" as const,
    currency: "QAR" as const,
    lines: pricedLines,
    subtotal_minor: subtotalMinor,
    delivery_fee_minor: STORE_DELIVERY_FEE_MINOR,
    total_minor: subtotalMinor + STORE_DELIVERY_FEE_MINOR,
  };
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(snapshot)),
  );
  const version = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

  return { version, ...snapshot };
}

function storePricingMatches(confirmation: unknown, pricing: StorePricingConfirmation) {
  if (!confirmation || typeof confirmation !== "object") return false;
  const candidate = confirmation as Partial<StorePricingConfirmation>;
  const normalizedLines = Array.isArray(candidate.lines)
    ? candidate.lines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity,
        unit_price_minor: line.unit_price_minor,
      }))
    : [];
  const authoritativeLines = pricing.lines.map((line) => ({
    product_id: line.product_id,
    quantity: line.quantity,
    unit_price_minor: line.unit_price_minor,
  }));

  return candidate.schema === pricing.schema
    && candidate.currency === pricing.currency
    && candidate.subtotal_minor === pricing.subtotal_minor
    && candidate.delivery_fee_minor === pricing.delivery_fee_minor
    && candidate.total_minor === pricing.total_minor
    && JSON.stringify(normalizedLines) === JSON.stringify(authoritativeLines)
    && (candidate.version == null || candidate.version === pricing.version);
}

// Development-only approximation. Production eligibility is always decided
// by the Laravel API's versioned official CGIS polygon snapshot.
function mockQatarLand(latitude: unknown, longitude: unknown) {
  return typeof latitude === "number" && typeof longitude === "number"
    && latitude >= 24.471111 && latitude <= 26.15875
    && longitude >= 50.750034 && longitude <= 51.660696;
}

function serviceAreaFailure(code: "SERVICE_AREA_OUTSIDE_QATAR" | "SERVICE_AREA_STALE", message: string, status = 422) {
  return NextResponse.json({
    success: false,
    message,
    data: { service_area: { version: SERVICE_AREA_VERSION, eligible: false } },
    errors: null,
    code,
  }, { status });
}

type DurationCartCar = { service_id: number; add_on_ids?: number[] };

async function durationSnapshot(cars: DurationCartCar[]) {
  const contributions = cars.length === 0
    ? [{
        line_index: 0,
        kind: "fallback" as const,
        service_id: null,
        add_on_id: null,
        name: "Default booking duration",
        configured_minutes: 60,
        contributes: true,
        minutes: 60,
      }]
    : cars.flatMap((car, lineIndex) => {
        const service = SERVICES.find((candidate) => candidate.id === Number(car.service_id));
        if (!service) return [];
        const selectedIds = [...new Set((car.add_on_ids ?? []).map(Number))].sort((a, b) => a - b);
        const addOns = service.add_ons
          .filter((addOn) => selectedIds.includes(addOn.id))
          .sort((a, b) => a.id - b.id);

        return [{
          line_index: lineIndex,
          kind: "service" as const,
          service_id: service.id,
          add_on_id: null,
          name: service.name,
          configured_minutes: service.duration_minutes,
          contributes: true,
          minutes: service.duration_minutes,
        }, ...addOns.map((addOn) => ({
          line_index: lineIndex,
          kind: "add_on" as const,
          service_id: service.id,
          add_on_id: addOn.id,
          name: addOn.name,
          configured_minutes: addOn.duration_minutes ?? 0,
          contributes: addOn.extends_duration,
          minutes: addOn.extends_duration ? (addOn.duration_minutes ?? 0) : 0,
        }))];
      });
  const schema = "duration-v1";
  const canonical = JSON.stringify({ schema, contributions });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

  return {
    schema,
    version: `${schema}:${hash.slice(0, 24)}`,
    total_minutes: Math.max(1, contributions.reduce((sum, contribution) => sum + contribution.minutes, 0)),
    contributions,
  };
}

function staleDuration(current: DurationSnapshot) {
  return fail(
    409,
    "Service timing changed. Please refresh availability and review the updated duration.",
    null,
    { duration: current },
    "DURATION_VERSION_STALE",
  );
}

function otpKey(phone: string, purpose: "authentication" | "registration") {
  return `${phone}|${purpose}`;
}

function toMinutes(hm: string) {
  return Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
}

function qatarMinutes(iso: string) {
  return toMinutes(formatQatarDateTime(iso, "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }));
}

function hasFleetCapacity(dateTime: string, durationMinutes: number, ignoredBookingId?: number) {
  const date = qatarServiceDate(dateTime);
  const start = new Date(dateTime).getTime();
  const end = start + (durationMinutes + POST_BOOKING_BUFFER_MINUTES) * 60_000;
  const overlaps = db().bookings.filter((booking) => {
    if (booking.id === ignoredBookingId) return false;
    if (booking.service_date !== date) return false;
    if (["cancelled_by_customer", "cancelled_by_admin"].includes(booking.status)) return false;
    const bookingStart = new Date(booking.scheduled_at).getTime();
    const bookingEnd = bookingStart + ((booking.duration_minutes ?? 60) + POST_BOOKING_BUFFER_MINUTES) * 60_000;
    return bookingStart < end && bookingEnd > start;
  }).length;
  return overlaps < FLEET_CAPACITY;
}

function mockRescheduleSlotVersion(booking: Booking, date: string, start: string) {
  return `reschedule-v1:${booking.id}:${date}:${start}:${booking.duration?.version ?? booking.duration_minutes ?? 60}:${SERVICE_AREA_VERSION}`;
}

// Which services each membership scope redeems (mirrors the backend's
// plan.service_id link). Only Standard Bubble (id 1) is seeded as a full wash.
const SCOPE_SERVICES: Record<string, number[]> = {
  full_wash: [1],
  exterior: [],
  midnight_exterior: [],
};

type MockMembership = ReturnType<typeof db>["memberships"][number];

function membershipCoversCar(
  m: MockMembership,
  serviceId: number,
  vehicleType: string,
  scheduledAt: string,
): boolean {
  if (m.status !== "active" || m.washes_remaining <= 0) return false;
  if (m.expires_at && new Date(m.expires_at) < new Date()) return false;

  const vt = m.plan.vehicle_type;
  const vehicleOk =
    vt === null ||
    (vt === "sedan" && ["sedan", "other"].includes(vehicleType)) ||
    (vt === "suv" && ["suv", "truck", "van"].includes(vehicleType));
  if (!vehicleOk) return false;

  if (!(SCOPE_SERVICES[m.plan.scope] ?? []).includes(serviceId)) return false;

  if (m.plan.window_start && m.plan.window_end) {
    const t = scheduledAt.slice(11, 16);
    if (!(t >= m.plan.window_start && t < m.plan.window_end)) return false;
  }
  return true;
}

// Greedily assign each car to the best eligible membership, spending the most
// perishable credit first. `cars` carry a `type` + `service_id`. Returns a map
// of [carIndex => membership]. Read-only unless the caller mutates.
function allocateMemberships(
  memberships: MockMembership[],
  cars: { service_id: number; type: string }[],
  scheduledAt: string,
): Record<number, MockMembership> {
  const budget = new Map(memberships.map((m) => [m.id, m.washes_remaining]));
  const alloc: Record<number, MockMembership> = {};
  cars.forEach((car, i) => {
    const candidates = memberships.filter(
      (m) => (budget.get(m.id) ?? 0) > 0 && membershipCoversCar(m, car.service_id, car.type, scheduledAt),
    );
    if (candidates.length === 0) return;
    candidates.sort((a, b) => {
      const ae = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
      const be = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
      return ae !== be ? ae - be : (budget.get(a.id) ?? 0) - (budget.get(b.id) ?? 0);
    });
    const best = candidates[0];
    alloc[i] = best;
    budget.set(best.id, (budget.get(best.id) ?? 0) - 1);
  });
  return alloc;
}

async function handle(req: NextRequest, segments: string[]) {
  if (process.env.NODE_ENV === "production") {
    return fail(404, "Development API is unavailable in production.");
  }

  const store = db();
  const path = segments.join("/");
  const method = req.method;
  const body =
    method === "POST" || method === "PUT"
      ? await req.json().catch(() => ({}))
      : {};

  // ── Public catalog ──
  if (method === "GET" && path === "services") {
    return envelope(paginated(SERVICES));
  }
  if (method === "GET" && path === "membership-plans") {
    return envelope(paginated(MEMBERSHIP_PLANS));
  }
  if (method === "GET" && path === "service-categories") {
    return envelope(paginated([...new Set(SERVICES.map((s) => s.category))].map((name, i) => ({ id: i + 1, name }))));
  }
  if (method === "POST" && path === "service-area/validate") {
    if (!mockQatarLand(body.latitude, body.longitude)) {
      return serviceAreaFailure("SERVICE_AREA_OUTSIDE_QATAR", "This location is outside Bubble It’s Qatar service area.");
    }
    return envelope({ version: SERVICE_AREA_VERSION, eligible: true });
  }

  // ── Store inventory ──
  if (method === "GET" && path === "store/products") {
    return envelope(paginated(store.storeProducts));
  }

  if (method === "GET" && path === "store/orders") {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");
    return envelope(paginated(
      store.storeOrders
        .filter((order) => order.customer_id === linkedCustomer.id)
        .map(({ customer_id: _customerId, ...order }) => order),
    ));
  }

  const storeOrderMatch = path.match(/^store\/orders\/(\d+)$/);
  if (method === "GET" && storeOrderMatch) {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");
    const order = store.storeOrders.find(
      (item) => item.id === Number(storeOrderMatch[1]) && item.customer_id === linkedCustomer.id,
    );
    if (!order) return fail(404, "Store order not found.");
    const { customer_id: _customerId, ...customerOrder } = order;
    return envelope(customerOrder);
  }

  if (method === "POST" && path === "store/orders") {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");
    const linesInput = Array.isArray(body.lines) ? body.lines : [];
    const customerName = String(linkedCustomer.name ?? "").trim();
    const customerPhone = String(linkedCustomer.phone ?? "").trim();
    const deliveryArea = String(body.delivery_area ?? "").trim();
    const deliveryDetails = String(body.delivery_details ?? "").trim();
    const buildingNumber = String(body.building_number ?? "").trim();
    const zoneNumber = String(body.zone_number ?? "").trim();
    const streetNumber = String(body.street_number ?? "").trim();

    if (body.service_area_version !== SERVICE_AREA_VERSION) {
      return serviceAreaFailure("SERVICE_AREA_STALE", "The service-area map changed. Please confirm the location again.", 409);
    }
    if (!mockQatarLand(body.latitude, body.longitude)) {
      return serviceAreaFailure("SERVICE_AREA_OUTSIDE_QATAR", "This location is outside Bubble It’s Qatar service area.");
    }

    if (!customerName || !customerPhone || !deliveryArea || !buildingNumber || linesInput.length === 0) {
      return fail(422, "Validation failed.", {
        ...(customerName ? {} : { customer_name: ["The customer name field is required."] }),
        ...(customerPhone ? {} : { customer_phone: ["The customer phone field is required."] }),
        ...(deliveryArea ? {} : { delivery_area: ["The delivery area field is required."] }),
        ...(buildingNumber ? {} : { building_number: ["The building number field is required."] }),
        ...(linesInput.length ? {} : { lines: ["At least one product is required."] }),
      });
    }

    const orderLines: StoreOrderLine[] = [];
    for (const input of linesInput) {
      const product = store.storeProducts.find((item) => item.id === Number(input.product_id));
      const quantity = Number(input.quantity ?? 0);
      if (!product || product.is_available === false || !Number.isInteger(quantity) || quantity < 1) {
        return fail(422, "Validation failed.", { lines: ["Invalid product or quantity."] });
      }
      if (product.stock_quantity - product.reserved_quantity < quantity) {
        return fail(409, `${product.name} does not have enough stock for that quantity.`);
      }
      orderLines.push({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unit_price: product.price,
        line_total: product.price * quantity,
      });
    }

    const pricing = await storePricing(orderLines);
    if (!storePricingMatches(body.pricing_confirmation, pricing)) {
      return fail(
        409,
        "Store pricing changed. Review and confirm the updated total.",
        null,
        { pricing },
        "STORE_PRICING_CHANGED",
      );
    }

    for (const line of orderLines) {
      const product = store.storeProducts.find((item) => item.id === line.product_id);
      if (!product) continue;
      product.reserved_quantity += line.quantity;
    }

    const id = store.nextId++;
    const subtotal = pricing.subtotal_minor / 100;
    const order: StoreOrder = {
      id,
      reference: `SO-${String(id).padStart(5, "0")}`,
      status: "pending_payment",
      status_label: "Pending payment",
      payment_status: "unpaid",
      payment_status_label: "Unpaid",
      payment_method: "online",
      pricing,
      delivery_area: deliveryArea,
      delivery_details: deliveryDetails,
      building_number: buildingNumber,
      zone_number: zoneNumber || null,
      street_number: streetNumber || null,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      service_area: { version: SERVICE_AREA_VERSION, eligible: true },
      subtotal,
      delivery_fee: pricing.delivery_fee_minor / 100,
      discount_total: 0,
      total: pricing.total_minor / 100,
      notes: String(body.notes ?? "").trim() || null,
      lines: orderLines,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    } satisfies StoreOrder;
    store.storeOrders.push({ ...order, customer_id: linkedCustomer.id } as StoreOrder & { customer_id: number });

    return envelope(order, { status: 201, message: "Store order received." });
  }

  const storePayMatch = path.match(/^store\/orders\/(\d+)\/pay$/);
  if (method === "POST" && storePayMatch) {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");

    const order = store.storeOrders.find((item) => item.id === Number(storePayMatch[1])) as
      | (StoreOrder & { customer_id: number })
      | undefined;
    if (!order || order.customer_id !== linkedCustomer.id) {
      return fail(404, "Store order not found.");
    }

    if (order.status === "cancelled") {
      return fail(422, "This store order cannot be paid.");
    }

    if (order.payment_status === "paid") {
      return envelope({
        ...mockPayment("STO", order.id),
        checkout_url: null,
        status: "paid",
      });
    }

    order.payment_status = "paid";
    order.payment_status_label = "Paid";
    order.status = "confirmed";
    order.status_label = "Confirmed";
    for (const line of order.lines) {
      const product = store.storeProducts.find((item) => item.id === line.product_id);
      if (!product) continue;
      product.reserved_quantity = Math.max(0, product.reserved_quantity - line.quantity);
      product.stock_quantity -= line.quantity;
      product.sold_quantity += line.quantity;
    }
    return envelope({
      ...mockPayment("STO", order.id),
      checkout_url: `/account?tab=orders&payment=review&order=${order.id}`,
    });
  }

  const storePaymentStatusMatch = path.match(/^store\/orders\/(\d+)\/payment-status$/);
  if (method === "POST" && storePaymentStatusMatch) {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");
    const order = store.storeOrders.find(
      (item) => item.id === Number(storePaymentStatusMatch[1]) && item.customer_id === linkedCustomer.id,
    );
    if (!order) return fail(404, "Store order not found.");
    const { customer_id: _customerId, ...customerOrder } = order;
    return envelope(customerOrder);
  }

  const storeCancelMatch = path.match(/^store\/orders\/(\d+)\/cancel$/);
  if (method === "POST" && storeCancelMatch) {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");
    const order = store.storeOrders.find(
      (item) => item.id === Number(storeCancelMatch[1]) && item.customer_id === linkedCustomer.id,
    );
    if (!order) return fail(404, "Store order not found.");
    if (!["pending_payment", "paid", "confirmed"].includes(order.status)) {
      return fail(422, "This store order can no longer be cancelled.");
    }

    const captured = order.payment_status === "paid";
    if (!captured) {
      for (const line of order.lines) {
        const product = store.storeProducts.find((item) => item.id === line.product_id);
        if (product) {
          product.reserved_quantity = Math.max(0, product.reserved_quantity - line.quantity);
        }
      }
      order.payment_status = "failed";
      order.payment_status_label = "Not paid";
    } else {
      order.refund = {
        id: store.nextId++,
        status: "submitted",
        status_label: "Submitted",
      };
    }
    order.status = "cancelled";
    order.status_label = "Cancelled";
    const { customer_id: _customerId, ...customerOrder } = order;
    return envelope(customerOrder, {
      message: captured
        ? "Order cancelled. Your refund request was submitted."
        : "Order cancelled.",
    });
  }

  // ── Availability ──
  if (method === "GET" && path === "availability") {
    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail(422, "Validation failed.", { date: ["A valid date is required."] });
    }
    const latitude = Number(req.nextUrl.searchParams.get("latitude"));
    const longitude = Number(req.nextUrl.searchParams.get("longitude"));
    if (!mockQatarLand(latitude, longitude)) {
      return serviceAreaFailure("SERVICE_AREA_OUTSIDE_QATAR", "This location is outside Bubble It’s Qatar service area.");
    }
    const now = new Date();
    const todayStr = qatarServiceDate(now.toISOString());
    const qatarNowMinutes = qatarMinutes(now.toISOString());
    const grid = req.nextUrl.searchParams.get("window") === "midnight" ? MIDNIGHT_SLOT_GRID : SLOT_GRID;
    // Match the live endpoint's structured cart query. Keep service_ids[] as
    // a legacy fallback for membership and older clients.
    const cartCars = Array.from(req.nextUrl.searchParams.entries()).flatMap(([key, value]) => {
      const match = key.match(/^cars\[(\d+)\]\[service_id\]$/);
      if (!match) return [];

      return [{
        serviceId: Number(value),
        addOnIds: req.nextUrl.searchParams
          .getAll(`cars[${match[1]}][add_on_ids][]`)
          .map(Number),
      }];
    });
    const serviceIds = req.nextUrl.searchParams.getAll("service_ids[]").map(Number);
    const durationContract = await durationSnapshot(cartCars.length
      ? cartCars.map((car) => ({ service_id: car.serviceId, add_on_ids: car.addOnIds }))
      : serviceIds.map((serviceId) => ({ service_id: serviceId, add_on_ids: [] })));
    const duration = durationContract.total_minutes;
    const closing = toMinutes(grid[grid.length - 1]) + 15;
    const existing = store.bookings
      .filter((b) => b.service_date === date && !["cancelled_by_customer", "cancelled_by_admin"].includes(b.status))
      .map((b) => {
        const s = qatarMinutes(b.scheduled_at);
        return [s, s + (b.duration_minutes ?? 60) + POST_BOOKING_BUFFER_MINUTES] as const;
      });
    const slots = grid.map((start) => {
      const s = toMinutes(start);
      const serviceEnd = s + duration;
      const occupancyEnd = serviceEnd + POST_BOOKING_BUFFER_MINUTES;
      const endHm = `${String(Math.floor(serviceEnd / 60)).padStart(2, "0")}:${String(serviceEnd % 60).padStart(2, "0")}`;
      const isPast = date < todayStr || (date === todayStr && s <= qatarNowMinutes);
      const overlaps = existing.filter(([es, ee]) => es < occupancyEnd && ee > s).length;
      const available = !isPast && occupancyEnd <= closing && overlaps < FLEET_CAPACITY;
      return { start, end: endHm, available };
    });
    return envelope({
      date,
      duration_minutes: duration,
      duration: durationContract,
      slots,
      service_area: { version: SERVICE_AREA_VERSION, eligible: true },
    });
  }

  // ── Auth ──
  if (method === "POST" && path === "auth/check-phone") {
    const phone = String(body.phone ?? "").trim();
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return fail(422, "Validation failed.", { phone: ["A valid phone number is required."] });
    }
    const response = envelope({ continuation: "choose_auth_method" });
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }

  if (method === "POST" && path === "auth/login") {
    const existing = store.customers.find((c) => c.phone === String(body.phone ?? "").trim());
    if (!existing || !existing.password || existing.password !== String(body.password ?? "")) {
      return fail(422, "Invalid phone number or password.");
    }
    const token = `mock_${crypto.randomUUID()}`;
    store.tokens.set(token, existing.id);
    const { vehicles: _v, addresses: _a, password: _p, ...publicCustomer } = existing;
    return envelope({ token, customer: publicCustomer, is_new: false });
  }

  if (method === "POST" && path === "auth/register") {
    const phone = String(body.phone ?? "").trim();
    const key = otpKey(phone, "registration");
    if (store.otps.get(key) !== String(body.code ?? "").trim()) {
      return fail(422, "The verification code is invalid or has expired.");
    }
    store.otps.delete(key);
    let existing = store.customers.find((c) => c.phone === phone);
    if (existing && existing.password) {
      return fail(422, "This phone number is already registered. Please sign in.");
    }
    if (!existing) {
      existing = {
        id: store.nextId++,
        name: String(body.name ?? "").trim(),
        phone,
        email: null,
        password: String(body.password ?? ""),
        vehicles: [],
        addresses: [],
      };
      store.customers.push(existing);
    } else {
      existing.password = String(body.password ?? "");
      if (!existing.name) existing.name = String(body.name ?? "").trim();
    }
    const token = `mock_${crypto.randomUUID()}`;
    store.tokens.set(token, existing.id);
    const { vehicles: _v, addresses: _a, password: _p, ...publicCustomer } = existing;
    return envelope({ token, customer: publicCustomer, is_new: true }, { status: 201 });
  }

  if (method === "POST" && path === "auth/request-otp") {
    const phone = String(body.phone ?? "").trim();
    const purpose = String(body.purpose ?? "");
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return fail(422, "Validation failed.", { phone: ["A valid phone number is required."] });
    }
    if (purpose !== "authentication" && purpose !== "registration") {
      return fail(422, "Validation failed.", { purpose: ["A valid OTP purpose is required."] });
    }
    store.otps.set(otpKey(phone, purpose), MOCK_OTP);
    return envelope(null, { message: "Verification code sent." });
  }

  if (method === "POST" && path === "auth/verify-otp") {
    const phone = String(body.phone ?? "").trim();
    const code = String(body.code ?? "").trim();
    const key = otpKey(phone, "authentication");
    if (store.otps.get(key) !== code) {
      return fail(422, "The verification code is invalid or has expired.");
    }
    store.otps.delete(key);
    let customer = store.customers.find((c) => c.phone === phone);
    const isNew = !customer;
    if (!customer) {
      customer = {
        id: store.nextId++,
        name: "",
        phone,
        email: null,
        password: null,
        vehicles: [],
        addresses: [],
      };
      store.customers.push(customer);
    }
    const token = `mock_${crypto.randomUUID()}`;
    store.tokens.set(token, customer.id);
    const { vehicles: _v, addresses: _a, password: _pw, ...publicCustomer } = customer;
    return envelope({ token, customer: publicCustomer, is_new: isNew });
  }

  // Everything below requires auth.
  const customer = authCustomer(req);
  if (!customer) return fail(401, "Unauthenticated.");

  if (method === "GET" && path === "auth/me") {
    const { vehicles: _v, addresses: _a, password: _pw, ...publicCustomer } = customer;
    return envelope(publicCustomer);
  }

  if (method === "POST" && path === "auth/logout") {
    const header = req.headers.get("authorization") ?? "";
    const token = header.replace(/^Bearer\s+/i, "");
    if (token) store.tokens.delete(token);
    return envelope(null, { message: "Logged out." });
  }

  if (method === "PUT" && path === "profile") {
    if (typeof body.name === "string") customer.name = body.name.trim();
    if (typeof body.email === "string") customer.email = body.email.trim() || null;
    const passwordChanged = typeof body.password === "string" && body.password;
    if (passwordChanged) {
      customer.password = body.password;
      for (const [token, customerId] of store.tokens.entries()) {
        if (customerId === customer.id) store.tokens.delete(token);
      }
    }
    const { vehicles: _v, addresses: _a, password: _pw, ...publicCustomer } = customer;
    const response = envelope(publicCustomer, {
      message: passwordChanged
        ? "Password updated. Please sign in again."
        : "Profile updated.",
    });
    if (passwordChanged) response.headers.set("X-Reauthentication-Required", "true");
    return response;
  }

  if (method === "POST" && path === "privacy/export") {
    const id = store.nextId++;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("");
    const expiresAt = Date.now() + 15 * 60 * 1000;
    privacyExports.set(id, { customerId: customer.id, token, expiresAt, used: false });
    return envelope({
      request_id: id,
      token,
      expires_at: new Date(expiresAt).toISOString(),
      policy_version: "2026-07-18-v1",
    }, { status: 201, message: "Your data export is ready for one download." });
  }

  const privacyDownload = path.match(/^privacy\/export\/(\d+)\/download$/);
  if (method === "POST" && privacyDownload) {
    const record = privacyExports.get(Number(privacyDownload[1]));
    if (!record || record.customerId !== customer.id) return fail(404, "Data export not found.");
    if (record.used || record.expiresAt <= Date.now() || record.token !== String(body.token ?? "")) {
      return fail(410, "This data export link has expired or has already been used.");
    }
    record.used = true;
    const { password: _password, vehicles, addresses, ...profile } = customer;
    return envelope({
      policy_version: "2026-07-18-v1",
      generated_at: new Date().toISOString(),
      profile,
      addresses,
      vehicles,
      bookings: store.bookings.filter((booking) => booking.customer_id === customer.id),
      memberships: store.memberships.filter((membership) => membership.customer_id === customer.id),
      store_orders: store.storeOrders.filter((order) => order.customer_id === customer.id),
    });
  }

  if (method === "POST" && path === "privacy/delete-account") {
    const key = otpKey(customer.phone, "authentication");
    if (body.confirmation !== "DELETE" || store.otps.get(key) !== String(body.code ?? "")) {
      return fail(422, "The verification code is invalid or has expired.");
    }
    store.otps.delete(key);
    for (const [token, customerId] of store.tokens.entries()) {
      if (customerId === customer.id) store.tokens.delete(token);
    }
    const index = store.customers.findIndex((candidate) => candidate.id === customer.id);
    if (index >= 0) store.customers.splice(index, 1);
    return envelope({
      request_id: store.nextId++,
      completed_at: new Date().toISOString(),
      policy_version: "2026-07-18-v1",
      retention: {
        sessions_and_device_tokens: "revoked_immediately",
        otp_and_notification_delivery_logs: "90_days",
        security_and_access_logs: "12_months",
        support_records: "2_years",
        bookings_and_service_history: "5_years_pseudonymized",
        financial_order_membership_ledgers: "10_years_pseudonymized",
        legal_holds: "until_final_resolution",
        irreversibly_anonymous_statistics: "indefinite",
      },
    }, { message: "Your BubbleIt account has been deleted." });
  }

  // ── Vehicles ──
  if (method === "GET" && path === "vehicles") {
    return envelope(paginated(customer.vehicles));
  }
  if (method === "POST" && path === "vehicles") {
    const make = String(body.make ?? "").trim();
    const model = String(body.model ?? "").trim();
    const plate = String(body.plate_number ?? "").trim();
    // Only the ID / plate number is required; make/model/color are optional.
    if (!plate) {
      return fail(422, "Validation failed.", {
        plate_number: ["The plate number field is required."],
      });
    }
    const vehicle = {
      id: store.nextId++,
      make,
      model,
      year: body.year ? Number(body.year) : null,
      color: String(body.color ?? "").trim(),
      plate_number: plate,
      type: (["suv", "sedan", "caravan", "jet_ski", "jet_boat"].includes(body.type) ? body.type : "sedan") as Vehicle["type"],
    };
    customer.vehicles.push(vehicle);
    return envelope(vehicle, { status: 201, message: "Vehicle added." });
  }

  // ── Addresses ──
  if (method === "GET" && path === "addresses") {
    return envelope(paginated(customer.addresses));
  }
  if (method === "POST" && path === "addresses") {
    const area = String(body.area ?? "").trim();
    const buildingNumber = String(body.building_number ?? "").trim();
    if (!area || !buildingNumber || !mockQatarLand(body.latitude, body.longitude)) {
      return fail(422, "Validation failed.", {
        ...(area ? {} : { area: ["The area field is required."] }),
        ...(buildingNumber ? {} : { building_number: ["The building number field is required."] }),
        ...(mockQatarLand(body.latitude, body.longitude) ? {} : { latitude: ["Confirm a location on Qatar land territory."] }),
      });
    }
    const address = {
      id: store.nextId++,
      label: String(body.label ?? "Home").trim(),
      area,
      details: String(body.details ?? "").trim(),
      building_number: buildingNumber,
      zone_number: String(body.zone_number ?? "").trim() || null,
      street_number: String(body.street_number ?? "").trim() || null,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      service_area: { version: SERVICE_AREA_VERSION, eligible: true, stale: false },
    };
    customer.addresses.push(address);
    return envelope(address, { status: 201, message: "Address added." });
  }
  const addressMatch = path.match(/^addresses\/(\d+)$/);
  if (addressMatch && (method === "PUT" || method === "DELETE")) {
    const addressId = Number(addressMatch[1]);
    const index = customer.addresses.findIndex((address) => address.id === addressId);
    if (index === -1) return fail(404, "Address not found.");
    if (method === "DELETE") {
      customer.addresses.splice(index, 1);
      return envelope(null, { status: 200, message: "Address removed." });
    }

    const area = String(body.area ?? "").trim();
    const buildingNumber = String(body.building_number ?? "").trim();
    if (!area || !buildingNumber || !mockQatarLand(body.latitude, body.longitude)) {
      return fail(422, "Validation failed.", {
        ...(area ? {} : { area: ["The area field is required."] }),
        ...(buildingNumber ? {} : { building_number: ["The building number field is required."] }),
        ...(mockQatarLand(body.latitude, body.longitude) ? {} : { latitude: ["Confirm a location on Qatar land territory."] }),
      });
    }

    const updated = {
      ...customer.addresses[index],
      label: String(body.label ?? customer.addresses[index].label ?? "Home").trim(),
      area,
      details: String(body.details ?? "").trim(),
      building_number: buildingNumber,
      zone_number: String(body.zone_number ?? "").trim() || null,
      street_number: String(body.street_number ?? "").trim() || null,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      service_area: { version: SERVICE_AREA_VERSION, eligible: true, stale: false },
    };
    customer.addresses[index] = updated;
    return envelope(updated, { message: "Address updated." });
  }

  // ── Memberships ──
  if (method === "GET" && (path === "memberships" || path === "memberships/my")) {
    const mine = store.memberships
      .filter((m) => m.customer_id === customer.id)
      .map(({ customer_id: _c, ...pub }) => pub);
    return envelope(paginated(mine));
  }
  if (method === "POST" && path === "memberships") {
    const chosenPlan = MEMBERSHIP_PLANS.find((pl) => pl.id === Number(body.plan_id));
    if (!chosenPlan) return fail(422, "Validation failed.", { plan_id: ["Invalid plan."] });
    const membership = {
      id: store.nextId++,
      customer_id: customer.id,
      status: "pending_payment" as const,
      washes_used: 0,
      washes_remaining: chosenPlan.washes_count,
      price_paid: chosenPlan.price,
      activated_at: null,
      expires_at: null,
      plan: chosenPlan,
    };
    store.memberships.push(membership);
    const { customer_id: _c, ...pub } = membership;
    return envelope({ ...pub, payment: { status: "not_started", checkout_url: null } }, { status: 201, message: "Membership reserved." });
  }

  const membershipPayMatch = path.match(/^memberships\/(\d+)\/pay$/);
  if (method === "POST" && membershipPayMatch) {
    const membership = store.memberships.find(
      (item) => item.id === Number(membershipPayMatch[1]) && item.customer_id === customer.id,
    );
    if (!membership) return fail(404, "Membership not found.");
    if (membership.status !== "pending_payment") return fail(422, "This membership is not awaiting payment.");
    const activatedAt = new Date();
    membership.status = "active";
    membership.activated_at = activatedAt.toISOString();
    membership.expires_at = new Date(
      activatedAt.getTime() + membership.plan.validity_days * 24 * 60 * 60 * 1000,
    ).toISOString();
    return envelope(mockPayment("MEM", membership.id));
  }

  const membershipPaymentStatusMatch = path.match(/^memberships\/(\d+)\/payment-status$/);
  if (method === "POST" && membershipPaymentStatusMatch) {
    const membership = store.memberships.find(
      (item) => item.id === Number(membershipPaymentStatusMatch[1]) && item.customer_id === customer.id,
    );
    if (!membership) return fail(404, "Membership not found.");
    const { customer_id: _customerId, ...customerMembership } = membership;
    return envelope(customerMembership);
  }

  // ── Bookings ──
  if (method === "GET" && path === "bookings") {
    const mine = store.bookings
      .filter((b) => b.customer_id === customer.id)
      .sort((a, b) => b.id - a.id)
      .map(({ customer_id: _c, ...pub }) => pub);
    return envelope(paginated(mine));
  }

  // Server-side price preview with membership coverage applied.
  if (method === "POST" && path === "bookings/quote") {
    const scheduledAt = String(body.scheduled_at ?? "");
    const quoteCars = Array.isArray(body.cars) ? body.cars : [];
    const useMembership = body.use_membership !== false;
    if (body.service_area_version !== SERVICE_AREA_VERSION) {
      return serviceAreaFailure("SERVICE_AREA_STALE", "The service-area map changed. Please confirm the location again.", 409);
    }
    const quoteAddress = body.address_id
      ? customer.addresses.find((address) => address.id === Number(body.address_id))
      : null;
    if (quoteAddress?.service_area.stale) {
      return serviceAreaFailure("SERVICE_AREA_STALE", "This saved address must be revalidated.", 409);
    }
    if (!quoteAddress && !mockQatarLand(body.latitude, body.longitude)) {
      return serviceAreaFailure("SERVICE_AREA_OUTSIDE_QATAR", "This location is outside Bubble It’s Qatar service area.");
    }
    if (typeof body.duration_version !== "string" || body.duration_version.length === 0) {
      return fail(422, "Validation failed.", {
        duration_version: ["The duration version field is required."],
      });
    }
    const durationContract = await durationSnapshot(quoteCars.map((car: Record<string, unknown>) => ({
      service_id: Number(car.service_id),
      add_on_ids: Array.isArray(car.add_on_ids) ? car.add_on_ids.map(Number) : [],
    })));
    if (String(body.duration_version ?? "") !== durationContract.version) {
      return staleDuration(durationContract);
    }

    const mine = useMembership
      ? store.memberships.filter((m) => m.customer_id === customer.id)
      : [];
    const norm: {
      service_id: number;
      type: string;
      add_on_ids: number[];
      membership_id?: number | null;
      has_membership_choice: boolean;
    }[] = quoteCars.map((c: { service_id: number; vehicle_type: string; add_on_ids?: number[]; membership_id?: number | null }) => ({
      service_id: Number(c.service_id),
      type: String(c.vehicle_type ?? "sedan"),
      add_on_ids: Array.isArray(c.add_on_ids) ? c.add_on_ids.map(Number) : [],
      membership_id: c.membership_id,
      has_membership_choice: Object.prototype.hasOwnProperty.call(c, "membership_id"),
    }));
    const preselected = allocateMemberships(mine, norm, scheduledAt);
    const alloc = norm.map((car, index) => {
      if (!car.has_membership_choice) return preselected[index];
      if (car.membership_id === null) return undefined;
      return mine.find((membership) => membership.id === Number(car.membership_id)
        && membershipCoversCar(membership, car.service_id, car.type, scheduledAt));
    });

    let serviceTotal = 0;
    let membershipDiscount = 0;
    const totalDuration = durationContract.total_minutes;
    let firstService: (typeof SERVICES)[number] | undefined;
    const summary = new Map<number, { m: MockMembership; applied: number }>();
    const carsOut = norm.map((c, i: number) => {
      const service = SERVICES.find((s) => s.id === c.service_id);
      firstService ??= service;
      const base = service ? (c.type === "suv" ? service.price_suv : service.price) : 0;
      const selectedAddons = service?.add_ons.filter((addon) => c.add_on_ids.includes(addon.id)) ?? [];
      const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
      serviceTotal += base + addonTotal;
      const m = alloc[i];
      if (m) {
        membershipDiscount += base;
        const s = summary.get(m.id) ?? { m, applied: 0 };
        s.applied += 1;
        summary.set(m.id, s);
      }
      const eligibleMemberships = mine
        .filter((membership) => membershipCoversCar(membership, c.service_id, c.type, scheduledAt))
        .map((membership) => ({
          id: membership.id,
          name: membership.plan.name,
          remaining_washes: membership.washes_remaining,
        }));
      return {
        index: i,
        service_id: c.service_id,
        subtotal: base + addonTotal,
        covered: !!m,
        membership_id: m?.id ?? null,
        membership_name: m?.plan.name ?? null,
        membership_discount: m ? base : 0,
        remaining_before: m?.washes_remaining ?? null,
        remaining_after: m ? Math.max(0, m.washes_remaining - 1) : null,
        eligible_memberships: eligibleMemberships,
      };
    });

    const quotedProducts: {
      product_id: number;
      sku: string;
      name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
    }[] = (Array.isArray(body.product_lines) ? body.product_lines : []).flatMap((line: { product_id?: number; quantity?: number }) => {
      const product = store.storeProducts.find((item) => item.id === Number(line.product_id));
      const quantity = Number(line.quantity ?? 0);
      if (!product || !Number.isInteger(quantity) || quantity < 1) return [];
      return [{
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unit_price: product.price,
        line_total: product.price * quantity,
      }];
    });
    const productTotal = quotedProducts.reduce((sum, line) => sum + line.line_total, 0);
    const promo = membershipDiscount === 0 && body.promo_code
      ? evaluatePromo(store, String(body.promo_code), customer.id, serviceTotal, norm.map((car) => car.service_id))
      : { valid: false, discount: 0 };
    const promoDiscount = promo.valid ? promo.discount : 0;
    const total = Math.max(0, serviceTotal - membershipDiscount - promoDiscount + productTotal);
    // Nominal wall-clock start (as sent) + duration → end and range label.
    const startHm = scheduledAt.slice(11, 16);
    const endDate = new Date(scheduledAt);
    endDate.setMinutes(endDate.getMinutes() + totalDuration);
    const endHm = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
    const quoteId = crypto.randomUUID();
    const quoteVersion = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify({ carsOut, quotedProducts, total, scheduledAt, duration: durationContract.version })),
    ).then((bytes) => Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join(""));
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    bookingQuotes.set(quoteId, {
      customerId: customer.id,
      version: quoteVersion,
      expiresAt,
      cars: carsOut.map((car) => ({ index: car.index, membership_id: car.membership_id })),
    });
    return envelope({
      quote_id: quoteId,
      quote_version: quoteVersion,
      pricing_schema: "booking-cart-pricing:v1",
      currency: "QAR",
      expires_at: expiresAt,
      service: firstService && norm.length === 1 ? {
        id: firstService.id,
        name: firstService.name,
        price: serviceTotal,
        duration_minutes: totalDuration,
        duration_label: formatDuration(totalDuration),
      } : null,
      scheduled_start_at: scheduledAt,
      scheduled_end_at: endDate.toISOString(),
      time_range_label: `${startHm}–${endHm}`,
      duration_minutes: totalDuration,
      duration_label: formatDuration(totalDuration),
      duration: durationContract,
      base_price: serviceTotal,
      discount_total: membershipDiscount + promoDiscount,
      service_total: serviceTotal,
      membership_eligible: membershipDiscount > 0,
      membership_discount: membershipDiscount,
      promo_discount: promoDiscount,
      product_total: productTotal,
      total_price: total,
      payment_required: total > 0,
      payment_method: total <= 0 && membershipDiscount > 0 ? "membership" : "online",
      cars: carsOut,
      memberships: [...summary.values()].map(({ m, applied }) => ({
        id: m.id,
        name: m.plan.name,
        remaining_washes: m.washes_remaining,
        washes_applied: applied,
        remaining_after: Math.max(0, m.washes_remaining - applied),
      })),
      products: quotedProducts,
      service_area: { version: SERVICE_AREA_VERSION, eligible: true },
    });
  }

  if (method === "POST" && path === "promo-codes/validate") {
    const subtotal = Number(body.subtotal ?? 0);
    const serviceIds = Array.isArray(body.service_ids) ? body.service_ids.map(Number) : [];
    const result = evaluatePromo(store, String(body.code ?? ""), customer.id, subtotal, serviceIds);
    return envelope({
      valid: result.valid,
      code: result.code,
      discount_amount: result.discount,
      final_total: Math.max(0, subtotal - result.discount),
      message: result.message,
    });
  }

  if (method === "POST" && path === "bookings") {
    const scheduledAt = String(body.scheduled_at ?? "");
    if (body.service_area_version !== SERVICE_AREA_VERSION) {
      return serviceAreaFailure("SERVICE_AREA_STALE", "The service-area map changed. Please confirm the location again.", 409);
    }
    const bookingAddress = body.address_id
      ? customer.addresses.find((address) => address.id === Number(body.address_id))
      : null;
    if (!bookingAddress && !mockQatarLand(body.latitude, body.longitude)) {
      return serviceAreaFailure("SERVICE_AREA_OUTSIDE_QATAR", "This location is outside Bubble It’s Qatar service area.");
    }
    if (typeof body.duration_version !== "string" || body.duration_version.length === 0) {
      return fail(422, "Validation failed.", {
        duration_version: ["The duration version field is required."],
      });
    }
    const committedQuote = typeof body.quote_id === "string" ? bookingQuotes.get(body.quote_id) : null;
    if (body.quote_id && (!committedQuote
      || committedQuote.customerId !== customer.id
      || committedQuote.version !== body.quote_version
      || new Date(committedQuote.expiresAt).getTime() <= Date.now())) {
      return fail(409, "This booking quote has expired or changed. Please request a new quote.");
    }

    // Membership redemption: single vehicle, plan-defined service, QR 0.
    if (body.membership_id) {
      const membership = store.memberships.find(
        (m) => m.id === Number(body.membership_id) && m.customer_id === customer.id,
      );
      const vehicle = customer.vehicles.find((v) => v.id === Number(body.vehicle_id));
      if (!membership || !vehicle) return fail(422, "Invalid membership or vehicle.");
      if (membership.status !== "active" || membership.washes_remaining <= 0) {
        return fail(422, "This membership is not active or has no washes remaining.");
      }
      const planService = SERVICES.find((sv) => sv.id === (membership.plan.scope === "full_wash" ? 1 : 1)) ?? SERVICES[0];
      const membershipDuration = await durationSnapshot([{ service_id: planService.id, add_on_ids: [] }]);
      if (String(body.duration_version ?? "") !== membershipDuration.version) {
        return staleDuration(membershipDuration);
      }
      if (!hasFleetCapacity(scheduledAt, membershipDuration.total_minutes)) {
        return fail(409, "This time slot is no longer available. Please pick another slot.");
      }
      membership.washes_used += 1;
      membership.washes_remaining -= 1;
      if (membership.washes_remaining === 0) membership.status = "exhausted" as never;
      const id = store.nextId++;
      const booking: Booking & { customer_id: number } = {
        id,
        customer_id: customer.id,
        reference: makeReference(id),
        status: "paid",
        status_label: STATUS_LABELS.paid,
        scheduled_at: new Date(scheduledAt).toISOString(),
        service_date: qatarServiceDate(scheduledAt),
        timezone: "Asia/Qatar",
        scheduled_end_at: new Date(new Date(scheduledAt).getTime() + (membershipDuration.total_minutes * 60_000)).toISOString(),
        duration_minutes: membershipDuration.total_minutes,
        duration: { ...membershipDuration, status: "accepted", ambiguous: false },
        payment_method: "membership",
        total: 0,
        address_label: bookingAddress?.label ?? (String(body.address_label ?? "").trim() || null),
        address_area: bookingAddress?.area ?? String(body.address_area ?? "").trim(),
        address_street: bookingAddress?.details ?? (String(body.address_street ?? "").trim() || null),
        building_number: bookingAddress?.building_number ?? (String(body.building_number ?? "").trim() || null),
        zone_number: bookingAddress?.zone_number ?? (String(body.zone_number ?? "").trim() || null),
        street_number: bookingAddress?.street_number ?? (String(body.street_number ?? "").trim() || null),
        notes: String(body.notes ?? "").trim(),
        cars: [{
          vehicle,
          service: { id: planService.id, name: planService.name, price: 0 },
          add_ons: [],
          subtotal: 0,
        }],
        created_at: new Date().toISOString(),
      };
      store.bookings.push(booking);
      const { customer_id: _c, ...pub } = booking;
      return envelope(pub, { status: 201, message: "Booking created." });
    }

    const cars = Array.isArray(body.cars) ? body.cars : [];
    const bookingDurationContract = await durationSnapshot(cars.map((car: Record<string, unknown>) => ({
      service_id: Number(car.service_id),
      add_on_ids: Array.isArray(car.add_on_ids) ? car.add_on_ids.map(Number) : [],
    })));
    if (String(body.duration_version ?? "") !== bookingDurationContract.version) {
      return staleDuration(bookingDurationContract);
    }
    const paymentMethod = body.payment_method as PaymentMethod;

    if (!scheduledAt || cars.length === 0 || !["pay_on_site", "online"].includes(paymentMethod)) {
      return fail(422, "Validation failed.", {
        ...(scheduledAt ? {} : { scheduled_at: ["The scheduled at field is required."] }),
        ...(cars.length ? {} : { cars: ["At least one car is required."] }),
      });
    }
    const bookingCars = [];
    for (const car of cars) {
      const vehicle = customer.vehicles.find((v) => v.id === car.vehicle_id);
      const service = SERVICES.find((s) => s.id === car.service_id);
      if (!vehicle || !service) {
        return fail(422, "Validation failed.", { cars: ["Invalid vehicle or service."] });
      }
      const addOns = service.add_ons.filter((a) => (car.add_on_ids ?? []).includes(a.id));
      // Price depends on the vehicle type (salon vs SUV pricelist).
      const basePrice = vehicle.type === "suv" ? service.price_suv : service.price;
      bookingCars.push({
        vehicle,
        service: { id: service.id, name: service.name, price: basePrice },
        add_ons: addOns,
        subtotal: basePrice + addOns.reduce((sum, a) => sum + a.price, 0),
      });
    }

    const productInput = Array.isArray(body.product_lines) ? body.product_lines : [];
    const bookingProducts: NonNullable<Booking["products"]> = [];
    const requestedProductQuantities: Record<string, number> = {};
    let productTotal = 0;
    for (const input of productInput) {
      const product = store.storeProducts.find((item) => item.id === Number(input.product_id));
      const quantity = Number(input.quantity ?? 0);
      const available = product
        ? Math.max(0, product.stock_quantity - product.reserved_quantity)
        : 0;
      const requested = (requestedProductQuantities[String(product?.id)] ?? 0) + quantity;
      if (!product || !Number.isInteger(quantity) || quantity < 1 || requested > available) {
        return fail(422, "One or more booking products are unavailable.");
      }
      requestedProductQuantities[String(product.id)] = requested;
      const lineTotal = product.price * quantity;
      bookingProducts.push({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unit_price: product.price,
        line_total: lineTotal,
      });
      productTotal += lineTotal;
    }

    const bookingDuration = bookingDurationContract.total_minutes;
    if (!hasFleetCapacity(scheduledAt, bookingDuration)) {
      return fail(409, "This time slot is no longer available. Please pick another slot.");
    }

    const mineActive = store.memberships.filter((m) => m.customer_id === customer.id);
    const bookingAlloc = committedQuote
      ? committedQuote.cars.map((car) => mineActive.find((membership) => membership.id === car.membership_id))
      : body.use_membership !== false
        ? allocateMemberships(
            mineActive,
            bookingCars.map((c) => ({ service_id: c.service.id, type: c.vehicle.type as string })),
            scheduledAt,
          )
        : [];
    let coveredCount = 0;
    bookingCars.forEach((c, i) => {
      const m = bookingAlloc[i];
      if (!m) return;
      coveredCount += 1;
      c.service = { ...c.service, price: 0 };
      c.subtotal = c.add_ons.reduce((sum, addon) => sum + addon.price, 0);
      m.washes_used += 1;
      m.washes_remaining -= 1;
      if (m.washes_remaining === 0) m.status = "exhausted" as never;
    });
    const fullyCovered = coveredCount > 0 && bookingCars.every((c) => c.subtotal === 0) && bookingProducts.length === 0;

    let addressArea = String(body.address_area ?? "").trim();
    if (body.address_id) {
      const address = customer.addresses.find((a) => a.id === body.address_id);
      if (!address) return fail(422, "Validation failed.", { address_id: ["Invalid address."] });
      addressArea = address.area;
    }

    const subtotal = bookingCars.reduce((sum, c) => sum + c.subtotal, 0);

    // Re-validate the promo server-side (never trust a client-sent discount).
    let discount = 0;
    let appliedCode: string | null = null;
    if (body.promo_code) {
      const serviceIds = bookingCars.map((c) => c.service.id);
      const result = evaluatePromo(store, String(body.promo_code), customer.id, subtotal, serviceIds);
      if (!result.valid) {
        return fail(422, result.message ?? "This promo code cannot be applied.", {
          promo_code: [result.message ?? "Invalid promo code."],
        });
      }
      discount = result.discount;
      appliedCode = result.code;
    }

    const id = store.nextId++;
    const reference = makeReference(id);
    const booking: Booking & { customer_id: number } = {
      id,
      customer_id: customer.id,
      reference,
      status: fullyCovered ? "paid" : "pending_payment",
      status_label: fullyCovered ? STATUS_LABELS.paid : STATUS_LABELS.pending_payment,
      scheduled_at: new Date(scheduledAt).toISOString(),
      service_date: qatarServiceDate(scheduledAt),
      timezone: "Asia/Qatar",
      scheduled_end_at: new Date(new Date(scheduledAt).getTime() + (bookingDuration * 60_000)).toISOString(),
      duration_minutes: bookingDuration,
      duration: { ...bookingDurationContract, status: "accepted", ambiguous: false },
      payment_method: fullyCovered ? "membership" : paymentMethod,
      total: Math.max(0, subtotal - discount + productTotal),
      product_total: productTotal,
      address_label: bookingAddress?.label ?? (String(body.address_label ?? "").trim() || null),
      address_area: addressArea,
      address_street: bookingAddress?.details ?? (String(body.address_street ?? "").trim() || null),
      building_number: bookingAddress?.building_number ?? (String(body.building_number ?? "").trim() || null),
      zone_number: bookingAddress?.zone_number ?? (String(body.zone_number ?? "").trim() || null),
      street_number: bookingAddress?.street_number ?? (String(body.street_number ?? "").trim() || null),
      notes: String(body.notes ?? "").trim(),
      cars: bookingCars,
      products: bookingProducts,
      created_at: new Date().toISOString(),
    };
    store.bookings.push(booking);
    for (const line of bookingProducts) {
      const product = store.storeProducts.find((item) => item.id === line.product_id);
      if (product) product.reserved_quantity += line.quantity;
    }

    // Record the redemption — this is the row the admin dashboard reads back.
    if (appliedCode && discount > 0) {
      store.redemptions.push({
        id: store.nextId++,
        code: appliedCode,
        customer_id: customer.id,
        booking_reference: reference,
        discount_amount: discount,
        redeemed_at: new Date().toISOString(),
      });
    }

    const { customer_id: _c, ...pub } = booking;
    return envelope({
      ...pub,
      payment: {
        status: pub.payment_method === "online" && pub.total > 0 ? "not_started" : "not_required",
        checkout_url: null,
      },
    }, { status: 201, message: "Booking created." });
  }

  const bookingMatch = path.match(/^bookings\/(\d+)(?:\/(cancel|pay|payment-status|mock-complete-payment|reschedule-options|reschedule))?$/);
  if (bookingMatch) {
    const booking = store.bookings.find(
      (b) => b.id === Number(bookingMatch[1]) && b.customer_id === customer.id,
    );
    if (!booking) return fail(404, "Booking not found.");
    const action = bookingMatch[2];

    if (method === "GET" && !action) {
      const { customer_id: _c, ...pub } = booking;
      return envelope(pub);
    }


    if (method === "GET" && action === "reschedule-options") {
      if (!["pending_payment", "paid", "assigned"].includes(booking.status)) {
        return fail(409, "This booking requires manual support to reschedule.", null, null, "RESCHEDULE_MANUAL_REQUIRED");
      }
      if (new Date(booking.scheduled_at).getTime() - Date.now() < 2 * 60 * 60 * 1000) {
        return fail(409, "Customer rescheduling closes two hours before service.", null, null, "RESCHEDULE_CUTOFF_PASSED");
      }
      const date = req.nextUrl.searchParams.get("date") ?? booking.service_date;
      const duration = booking.duration ?? await durationSnapshot([]);
      const slots = SLOT_GRID.map((start) => {
        const scheduledAt = `${date}T${start}:00+03:00`;
        const end = new Date(new Date(scheduledAt).getTime() + (duration.total_minutes * 60_000));
        const endTime = formatQatarDateTime(end.toISOString(), "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        });
        return {
          start,
          end: endTime,
          available: new Date(scheduledAt).getTime() > Date.now()
            && hasFleetCapacity(scheduledAt, duration.total_minutes, booking.id),
          slot_version: mockRescheduleSlotVersion(booking, date, start),
        };
      });
      return envelope({
        date,
        timezone: "Asia/Qatar",
        duration,
        service_area: { version: SERVICE_AREA_VERSION, eligible: true },
        policy_version: "reschedule-v1",
        cutoff_hours: 2,
        slots,
      });
    }

    if (method === "POST" && action === "reschedule") {
      if (!["pending_payment", "paid", "assigned"].includes(booking.status)) {
        return fail(409, "This booking requires manual support to reschedule.", null, null, "RESCHEDULE_MANUAL_REQUIRED");
      }
      if (new Date(booking.scheduled_at).getTime() - Date.now() < 2 * 60 * 60 * 1000) {
        return fail(409, "Customer rescheduling closes two hours before service.", null, null, "RESCHEDULE_CUTOFF_PASSED");
      }
      const scheduledAt = String(body.scheduled_at ?? "");
      const date = qatarServiceDate(scheduledAt);
      const start = formatQatarDateTime(scheduledAt, "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
      const duration = booking.duration ?? await durationSnapshot([]);
      if (body.duration_version !== duration.version) return staleDuration(duration);
      if (body.service_area_version !== SERVICE_AREA_VERSION) {
        return serviceAreaFailure("SERVICE_AREA_STALE", "The service-area map changed. Please confirm the location again.", 409);
      }
      if (body.slot_version !== mockRescheduleSlotVersion(booking, date, start)) {
        return fail(409, "Availability changed. Please refresh the available times.", null, null, "SLOT_VERSION_STALE");
      }
      if (!hasFleetCapacity(scheduledAt, duration.total_minutes, booking.id)) {
        return fail(409, "This time slot is no longer available. Please pick another slot.", null, null, "SLOT_UNAVAILABLE");
      }
      booking.scheduled_at = new Date(scheduledAt).toISOString();
      booking.scheduled_end_at = new Date(new Date(scheduledAt).getTime() + (duration.total_minutes * 60_000)).toISOString();
      booking.service_date = date;
      if (booking.status === "assigned") {
        booking.status = "paid";
        booking.status_label = STATUS_LABELS.paid;
      }
      const { customer_id: _c, ...pub } = booking;
      return envelope(pub, { message: "Booking rescheduled." });
    }

    if (method === "POST" && action === "cancel") {
      const cancellable: BookingStatus[] = ["pending_payment", "paid", "assigned"];
      if (!cancellable.includes(booking.status)) {
        return fail(422, "This booking can no longer be cancelled.");
      }
      const captured = booking.status !== "pending_payment"
        || booking.payment?.captured === true
        || booking.payment?.status === "paid";
      booking.status = "cancelled_by_customer";
      booking.status_label = STATUS_LABELS.cancelled_by_customer;
      if (captured) {
        booking.refund = {
          id: store.nextId++,
          status: "submitted",
          status_label: "Submitted",
        };
      }
      for (const line of booking.products ?? []) {
        const product = store.storeProducts.find((item) => item.id === line.product_id);
        if (product) product.reserved_quantity = Math.max(0, product.reserved_quantity - line.quantity);
      }
      const { customer_id: _c, ...pub } = booking;
      return envelope(pub, {
        message: captured
          ? "Booking cancelled. Your refund request was submitted."
          : "Booking cancelled.",
      });
    }

    if (method === "POST" && action === "payment-status") {
      const { customer_id: _customerId, ...customerBooking } = booking;
      return envelope(customerBooking);
    }

    if (method === "POST" && action === "pay") {
      if (booking.status === "paid" || booking.payment?.captured === true) {
        return envelope({
          ...mockPayment("BKG", booking.id),
          checkout_url: null,
          status: "paid",
        });
      }
      if (booking.status !== "pending_payment" || booking.payment_method !== "online") {
        return fail(422, "This booking is not awaiting online payment.");
      }
      return envelope(mockPayment("BKG", booking.id));
    }

    // Mock-only: the fake checkout page calls this to simulate a successful
    // gateway webhook (pending_payment -> paid).
    if (method === "POST" && action === "mock-complete-payment") {
      if (booking.status !== "pending_payment") {
        return fail(422, "This booking is not awaiting payment.");
      }
      booking.status = "paid";
      booking.status_label = STATUS_LABELS.paid;
      for (const line of booking.products ?? []) {
        const product = store.storeProducts.find((item) => item.id === line.product_id);
        if (!product) continue;
        product.reserved_quantity = Math.max(0, product.reserved_quantity - line.quantity);
        product.stock_quantity -= line.quantity;
        product.sold_quantity += line.quantity;
      }
      const { customer_id: _c, ...pub } = booking;
      return envelope(pub, { message: "Payment confirmed." });
    }
  }

  return fail(404, "Not found.");
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: Ctx) {
  const segments = (await ctx.params).path;
  const key = req.headers.get("idempotency-key");
  if (!key) return handle(req, segments);

  const requestBody = await req.clone().json().catch(() => ({}));
  const customerScope = authCustomer(req)?.id ?? "anonymous";
  const cacheKey = `${customerScope}:${segments.join("/")}:${key}`;
  const requestHash = JSON.stringify(requestBody);
  const cached = idempotencyResponses.get(cacheKey);
  if (cached) {
    if (cached.request !== requestHash) {
      return fail(409, "This idempotency key was already used for a different request.", null, null, "IDEMPOTENCY_KEY_REUSED");
    }
    return NextResponse.json(cached.body, { status: cached.status });
  }

  const response = await handle(req, segments);
  if (response.ok) {
    idempotencyResponses.set(cacheKey, {
      request: requestHash,
      status: response.status,
      body: await response.clone().json(),
    });
  }
  return response;
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
