// Mock implementation of customer-contract-v1 (bubbleit-mobile/docs/api-contract/).
// Response envelope, paginator shape, and status semantics match the contract so
// the frontend swaps to the real Laravel backend via NEXT_PUBLIC_API_BASE only.

import { NextRequest, NextResponse } from "next/server";
import type {
  Booking,
  BookingStatus,
  PaymentMethod,
  StoreOrder,
  StoreOrderLine,
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
  const token =
    header.replace(/^Bearer\s+/i, "") ||
    req.cookies.get("bubbleit_customer_token")?.value ||
    "";
  const customerId = db().tokens.get(token);
  if (!customerId) return null;
  return db().customers.find((c) => c.id === customerId) ?? null;
}

// Mock fleet capacity: 2 buses → a slot is unavailable once 2 active bookings hold it.
const FLEET_CAPACITY = 2;
const POST_BOOKING_BUFFER_MINUTES = 30;

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

function hasFleetCapacity(dateTime: string, durationMinutes: number) {
  const date = qatarServiceDate(dateTime);
  const start = new Date(dateTime).getTime();
  const end = start + (durationMinutes + POST_BOOKING_BUFFER_MINUTES) * 60_000;
  const overlaps = db().bookings.filter((booking) => {
    if (booking.service_date !== date) return false;
    if (["cancelled_by_customer", "cancelled_by_admin"].includes(booking.status)) return false;
    const bookingStart = new Date(booking.scheduled_at).getTime();
    const bookingEnd = bookingStart + ((booking.duration_minutes ?? 60) + POST_BOOKING_BUFFER_MINUTES) * 60_000;
    return bookingStart < end && bookingEnd > start;
  }).length;
  return overlaps < FLEET_CAPACITY;
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

  // ── Store inventory ──
  if (method === "GET" && path === "store/products") {
    return envelope(paginated(store.storeProducts));
  }

  if (method === "POST" && path === "store/orders") {
    const linkedCustomer = authCustomer(req);
    const linesInput = Array.isArray(body.lines) ? body.lines : [];
    const customerName = String(body.customer_name ?? linkedCustomer?.name ?? "").trim();
    const customerPhone = String(body.customer_phone ?? linkedCustomer?.phone ?? "").trim();
    const deliveryArea = String(body.delivery_area ?? "").trim();
    const deliveryDetails = String(body.delivery_details ?? "").trim();
    const buildingNumber = String(body.building_number ?? "").trim();
    const zoneNumber = String(body.zone_number ?? "").trim();
    const streetNumber = String(body.street_number ?? "").trim();

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
      const product = store.storeProducts.find((item) => item.id === String(input.product_id));
      const quantity = Number(input.quantity ?? 0);
      if (!product || !Number.isInteger(quantity) || quantity < 1) {
        return fail(422, "Validation failed.", { lines: ["Invalid product or quantity."] });
      }
      if (product.stock_quantity < quantity) {
        return fail(409, `${product.name} does not have enough stock for that quantity.`);
      }
      orderLines.push({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        quantity,
        unit_price: product.price,
        line_total: product.price * quantity,
        accounting_code: product.accounting_code,
      });
    }

    for (const line of orderLines) {
      const product = store.storeProducts.find((item) => item.id === line.product_id);
      if (!product) continue;
      product.stock_quantity -= line.quantity;
      product.sold_quantity += line.quantity;
    }

    const id = store.nextId++;
    const subtotal = orderLines.reduce((sum, line) => sum + line.line_total, 0);
    const order: StoreOrder = {
      id,
      customer_id: linkedCustomer?.id ?? null,
      reference: `SO-${String(id).padStart(5, "0")}`,
      status: "received",
      accounting_status: "pending_sync" as const,
      customer_name: customerName,
      customer_phone: customerPhone,
      delivery_area: deliveryArea,
      delivery_details: deliveryDetails,
      building_number: buildingNumber,
      zone_number: zoneNumber || null,
      street_number: streetNumber || null,
      latitude: typeof body.latitude === "number" ? body.latitude : null,
      longitude: typeof body.longitude === "number" ? body.longitude : null,
      subtotal,
      total: subtotal,
      lines: orderLines,
      created_at: new Date().toISOString(),
    };
    store.storeOrders.push(order);

    return envelope(order, { status: 201, message: "Store order received." });
  }

  const storePayMatch = path.match(/^store\/orders\/(\d+)\/pay$/);
  if (method === "POST" && storePayMatch) {
    const linkedCustomer = authCustomer(req);
    if (!linkedCustomer) return fail(401, "Unauthenticated.");

    const order = store.storeOrders.find((item) => item.id === Number(storePayMatch[1]));
    if (!order || order.customer_id !== linkedCustomer.id) {
      return fail(404, "Store order not found.");
    }

    if (order.status === "cancelled") {
      return fail(422, "This store order cannot be paid.");
    }

    order.status = "confirmed";
    return envelope({
      checkout_url: null,
      payment_reference: `MOCK-PAY-${order.id}`,
    });
  }

  // ── Availability ──
  if (method === "GET" && path === "availability") {
    const date = req.nextUrl.searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return fail(422, "Validation failed.", { date: ["A valid date is required."] });
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
    const duration = cartCars.length
      ? cartCars.reduce((sum, car) => {
          const service = SERVICES.find((candidate) => candidate.id === car.serviceId);
          if (!service) return sum;

          return sum + service.duration_minutes + service.add_ons
            .filter((addOn) => car.addOnIds.includes(addOn.id))
            .reduce((addOnTotal, addOn) => addOnTotal + (addOn.duration_minutes ?? 0), 0);
        }, 0) || 60
      : serviceIds.length
        ? serviceIds.reduce((sum, id) => sum + (SERVICES.find((s) => s.id === id)?.duration_minutes ?? 0), 0) || 60
        : 60;
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
    return envelope({ date, duration_minutes: duration, slots });
  }

  // ── Auth ──
  if (method === "POST" && path === "auth/check-phone") {
    const existing = store.customers.find((c) => c.phone === String(body.phone ?? "").trim());
    return envelope({
      registered: existing !== undefined,
      has_password: existing?.password != null && existing.password !== "",
    });
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
    const token =
      header.replace(/^Bearer\s+/i, "") ||
      req.cookies.get("bubbleit_customer_token")?.value ||
      "";
    if (token) store.tokens.delete(token);
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
    const buildingNumber = String(body.building_number ?? "").trim();
    if (!area || !buildingNumber) {
      return fail(422, "Validation failed.", {
        ...(area ? {} : { area: ["The area field is required."] }),
        ...(buildingNumber ? {} : { building_number: ["The building number field is required."] }),
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
    if (!area || !buildingNumber) {
      return fail(422, "Validation failed.", {
        ...(area ? {} : { area: ["The area field is required."] }),
        ...(buildingNumber ? {} : { building_number: ["The building number field is required."] }),
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
    let totalDuration = 0;
    let firstService: (typeof SERVICES)[number] | undefined;
    const summary = new Map<number, { m: MockMembership; applied: number }>();
    const carsOut = norm.map((c: { service_id: number; type: string }, i: number) => {
      const service = SERVICES.find((s) => s.id === c.service_id);
      firstService ??= service;
      const base = service ? (c.type === "suv" ? service.price_suv : service.price) : 0;
      serviceTotal += base;
      totalDuration += service?.duration_minutes ?? 0;
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
    // Nominal wall-clock start (as sent) + duration → end and range label.
    const startHm = scheduledAt.slice(11, 16);
    const endDate = new Date(scheduledAt);
    endDate.setMinutes(endDate.getMinutes() + totalDuration);
    const endHm = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
    return envelope({
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
      base_price: serviceTotal,
      discount_total: membershipDiscount,
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
      const planService = SERVICES.find((sv) => sv.id === (membership.plan.scope === "full_wash" ? 1 : 1)) ?? SERVICES[0];
      if (!hasFleetCapacity(scheduledAt, planService.duration_minutes)) {
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
        scheduled_end_at: new Date(new Date(scheduledAt).getTime() + (planService.duration_minutes * 60_000)).toISOString(),
        duration_minutes: planService.duration_minutes,
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
      const product = store.storeProducts.find((item) => String(item.id) === String(input.product_id));
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

    const bookingDuration = bookingCars.reduce(
      (sum, car) => sum + (SERVICES.find((service) => service.id === car.service.id)?.duration_minutes ?? 0) + car.add_ons.reduce((addOnTotal, addOn) => addOnTotal + (addOn.duration_minutes ?? 0), 0),
      0,
    ) || 60;
    if (!hasFleetCapacity(scheduledAt, bookingDuration)) {
      return fail(409, "This time slot is no longer available. Please pick another slot.");
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
    const fullyCovered = coveredCount > 0 && bookingCars.every((c) => c.subtotal === 0) && bookingProducts.length === 0;

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
      scheduled_at: new Date(scheduledAt).toISOString(),
      service_date: qatarServiceDate(scheduledAt),
      timezone: "Asia/Qatar",
      scheduled_end_at: new Date(new Date(scheduledAt).getTime() + (bookingDuration * 60_000)).toISOString(),
      duration_minutes: bookingDuration,
      payment_method: fullyCovered ? "membership" : paymentMethod,
      total: Math.max(0, subtotal - discount + productTotal),
      product_total: productTotal,
      address_area: addressArea,
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
      for (const line of booking.products ?? []) {
        const product = store.storeProducts.find((item) => item.id === line.product_id);
        if (product) product.reserved_quantity = Math.max(0, product.reserved_quantity - line.quantity);
      }
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
  return handle(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(req, (await ctx.params).path);
}
