// Mock implementation of customer-contract-v1 (bubbleit-mobile/docs/api-contract/).
// Response envelope, paginator shape, and status semantics match the contract so
// the frontend swaps to the real Laravel backend via NEXT_PUBLIC_API_BASE only.

import { NextRequest, NextResponse } from "next/server";
import type { Booking, BookingStatus, PaymentMethod, Vehicle } from "@/lib/api/types";
import {
  MEMBERSHIP_PLANS,
  MIDNIGHT_SLOT_GRID,
  MOCK_OTP,
  SERVICES,
  SLOT_GRID,
  STATUS_LABELS,
  db,
  evaluatePromo,
  makeReference,
} from "@/lib/mock/store";

function envelope(
  data: unknown,
  init: { status?: number; message?: string; errors?: Record<string, string[]> | null } = {},
) {
  const status = init.status ?? 200;
  return NextResponse.json(
    {
      success: status < 400,
      message: init.message ?? "",
      data,
      errors: init.errors ?? null,
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

function fail(status: number, message: string, errors: Record<string, string[]> | null = null) {
  return envelope(null, { status, message, errors });
}

function authCustomer(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  const customerId = db().tokens.get(token);
  if (!customerId) return null;
  return db().customers.find((c) => c.id === customerId) ?? null;
}

function slotTakenCount(dateTime: string) {
  return db().bookings.filter(
    (b) =>
      b.scheduled_at === dateTime &&
      !["cancelled_by_customer", "cancelled_by_admin"].includes(b.status),
  ).length;
}

// Mock fleet capacity: 2 buses → a slot is unavailable once 2 active bookings hold it.
const FLEET_CAPACITY = 2;

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

  // ── Availability ──
  if (method === "GET" && path === "availability") {
    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail(422, "Validation failed.", { date: ["A valid date is required."] });
    }
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const grid = req.nextUrl.searchParams.get("window") === "midnight" ? MIDNIGHT_SLOT_GRID : SLOT_GRID;
    const slots = grid.map((start) => {
      const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, "0")}:00`;
      const isPast = date < todayStr || (date === todayStr && start <= now.toTimeString().slice(0, 5));
      const full = slotTakenCount(`${date}T${start}:00`) >= FLEET_CAPACITY;
      return { start, end, available: !isPast && !full };
    });
    return envelope({ date, slots });
  }

  // ── Auth ──
  if (method === "POST" && path === "auth/check-phone") {
    const existing = store.customers.find((c) => c.phone === String(body.phone ?? "").trim());
    return envelope({ registered: !!(existing && existing.password) });
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
    if (store.otps.get(phone) !== String(body.code ?? "").trim()) {
      return fail(422, "The verification code is invalid or has expired.");
    }
    store.otps.delete(phone);
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
    if (!/^\+?\d{7,15}$/.test(phone)) {
      return fail(422, "Validation failed.", { phone: ["A valid phone number is required."] });
    }
    store.otps.set(phone, MOCK_OTP);
    return envelope(null, { message: "Verification code sent." });
  }

  if (method === "POST" && path === "auth/verify-otp") {
    const phone = String(body.phone ?? "").trim();
    const code = String(body.code ?? "").trim();
    if (store.otps.get(phone) !== code) {
      return fail(422, "The verification code is invalid or has expired.");
    }
    store.otps.delete(phone);
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
    store.tokens.delete(header.replace(/^Bearer\s+/i, ""));
    return envelope(null, { message: "Logged out." });
  }

  if (method === "PUT" && path === "profile") {
    if (typeof body.name === "string") customer.name = body.name.trim();
    if (typeof body.email === "string") customer.email = body.email.trim() || null;
    if (typeof body.password === "string" && body.password) customer.password = body.password;
    const { vehicles: _v, addresses: _a, password: _pw, ...publicCustomer } = customer;
    return envelope(publicCustomer);
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
    if (!area) {
      return fail(422, "Validation failed.", { area: ["The area field is required."] });
    }
    const address = {
      id: store.nextId++,
      label: String(body.label ?? "Home").trim(),
      area,
      details: String(body.details ?? "").trim(),
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
    };
    customer.addresses.push(address);
    return envelope(address, { status: 201, message: "Address added." });
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
    // Mock convenience: auto-activate after 5s so the flow can be demoed.
    setTimeout(() => {
      membership.status = "active" as never;
      membership.activated_at = new Date().toISOString() as never;
      membership.expires_at = new Date(Date.now() + 30 * 864e5).toISOString() as never;
    }, 5000);
    const { customer_id: _c, ...pub } = membership;
    return envelope({ ...pub, pay_url: null }, { status: 201, message: "Membership requested." });
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

    // Match the backend: auto-apply only for a single, add-on-free car.
    const singleAddonFree =
      quoteCars.length === 1 && (quoteCars[0].add_on_ids?.length ?? 0) === 0;
    const mine = useMembership && singleAddonFree
      ? store.memberships.filter((m) => m.customer_id === customer.id)
      : [];
    const norm = quoteCars.map((c: { service_id: number; vehicle_type: string }) => ({
      service_id: Number(c.service_id),
      type: String(c.vehicle_type ?? "sedan"),
    }));
    const alloc = allocateMemberships(mine, norm, scheduledAt);

    let serviceTotal = 0;
    let membershipDiscount = 0;
    const summary = new Map<number, { m: MockMembership; applied: number }>();
    const carsOut = norm.map((c: { service_id: number; type: string }, i: number) => {
      const service = SERVICES.find((s) => s.id === c.service_id);
      const base = service ? (c.type === "suv" ? service.price_suv : service.price) : 0;
      serviceTotal += base;
      const m = alloc[i];
      if (m) {
        membershipDiscount += base;
        const s = summary.get(m.id) ?? { m, applied: 0 };
        s.applied += 1;
        summary.set(m.id, s);
      }
      return { index: i, service_id: c.service_id, subtotal: base, covered: !!m, membership_id: m?.id ?? null };
    });

    const total = Math.max(0, serviceTotal - membershipDiscount);
    return envelope({
      service_total: serviceTotal,
      membership_eligible: membershipDiscount > 0,
      membership_discount: membershipDiscount,
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
      if (slotTakenCount(scheduledAt) >= FLEET_CAPACITY) {
        return fail(409, "This time slot is no longer available. Please pick another slot.");
      }
      const planService = SERVICES.find((sv) => sv.id === (membership.plan.scope === "full_wash" ? 1 : 1)) ?? SERVICES[0];
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
        scheduled_at: scheduledAt,
        payment_method: "membership",
        total: 0,
        address_area: String(body.address_area ?? "").trim(),
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
    const paymentMethod = body.payment_method as PaymentMethod;

    if (!scheduledAt || cars.length === 0 || !["pay_on_site", "online"].includes(paymentMethod)) {
      return fail(422, "Validation failed.", {
        ...(scheduledAt ? {} : { scheduled_at: ["The scheduled at field is required."] }),
        ...(cars.length ? {} : { cars: ["At least one car is required."] }),
      });
    }
    if (slotTakenCount(scheduledAt) >= FLEET_CAPACITY) {
      return fail(409, "This time slot is no longer available. Please pick another slot.");
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

    // Auto-apply a membership only for a single, add-on-free car (matches the
    // backend's dedicated-bus redemption model).
    const useMembership = body.use_membership !== false;
    const singleAddonFree =
      cars.length === 1 && (cars[0].add_on_ids?.length ?? 0) === 0;
    const mineActive = useMembership && singleAddonFree
      ? store.memberships.filter((m) => m.customer_id === customer.id)
      : [];
    const bookingAlloc = allocateMemberships(
      mineActive,
      bookingCars.map((c) => ({ service_id: c.service.id, type: c.vehicle.type as string })),
      scheduledAt,
    );
    let coveredCount = 0;
    bookingCars.forEach((c, i) => {
      const m = bookingAlloc[i];
      if (!m) return;
      coveredCount += 1;
      c.service = { ...c.service, price: 0 };
      c.add_ons = [];
      c.subtotal = 0;
      m.washes_used += 1;
      m.washes_remaining -= 1;
      if (m.washes_remaining === 0) m.status = "exhausted" as never;
    });
    const fullyCovered = coveredCount > 0 && bookingCars.every((c) => c.subtotal === 0);

    let addressArea = String(body.address_area ?? "").trim();
    if (body.address_id) {
      const address = customer.addresses.find((a) => a.id === body.address_id);
      if (!address) return fail(422, "Validation failed.", { address_id: ["Invalid address."] });
      addressArea = `${address.area}${address.details ? ` — ${address.details}` : ""}`;
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
      scheduled_at: scheduledAt,
      payment_method: fullyCovered ? "membership" : paymentMethod,
      total: Math.max(0, subtotal - discount),
      address_area: addressArea,
      notes: String(body.notes ?? "").trim(),
      cars: bookingCars,
      created_at: new Date().toISOString(),
    };
    store.bookings.push(booking);

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
    return envelope(pub, { status: 201, message: "Booking created." });
  }

  const bookingMatch = path.match(/^bookings\/(\d+)(?:\/(cancel|pay|mock-complete-payment))?$/);
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

    if (method === "POST" && action === "cancel") {
      const cancellable: BookingStatus[] = ["pending_payment", "paid", "assigned"];
      if (!cancellable.includes(booking.status)) {
        return fail(422, "This booking can no longer be cancelled.");
      }
      booking.status = "cancelled_by_customer";
      booking.status_label = STATUS_LABELS.cancelled_by_customer;
      const { customer_id: _c, ...pub } = booking;
      return envelope(pub, { message: "Booking cancelled." });
    }

    if (method === "POST" && action === "pay") {
      if (booking.status !== "pending_payment" || booking.payment_method !== "online") {
        return fail(422, "This booking is not awaiting online payment.");
      }
      return envelope({ checkout_url: `/book/checkout?booking=${booking.id}` });
    }

    // Mock-only: the fake checkout page calls this to simulate a successful
    // gateway webhook (pending_payment -> paid).
    if (method === "POST" && action === "mock-complete-payment") {
      if (booking.status !== "pending_payment") {
        return fail(422, "This booking is not awaiting payment.");
      }
      booking.status = "paid";
      booking.status_label = STATUS_LABELS.paid;
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
  return handle(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
