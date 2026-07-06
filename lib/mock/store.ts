// In-memory mock backend store. Survives HMR via globalThis. Dev/demo only —
// replaced entirely by the Laravel backend (customer-contract-v1) in production.

import type {
  Address,
  Booking,
  BookingStatus,
  Customer,
  CustomerMembership,
  MembershipPlan,
  PaymentMethod,
  Service,
  Vehicle,
} from "@/lib/api/types";

export const MOCK_OTP = "123456";

export type MockDB = {
  customers: (Customer & { vehicles: Vehicle[]; addresses: Address[] })[];
  memberships: (CustomerMembership & { customer_id: number })[];
  tokens: Map<string, number>; // token -> customer id
  otps: Map<string, string>; // phone -> code
  bookings: (Booking & { customer_id: number })[];
  nextId: number;
};

// Official Bubbleit pricelist — salon vs SUV pricing + extended catalog.
const svc = (
  id: number, name: string, name_ar: string, description: string, description_ar: string,
  price: number, price_suv: number, category: string,
): Service => ({ id, name, name_ar, description, description_ar, price, price_suv, category, add_ons: [] });

export const SERVICES: Service[] = [
  svc(1, "Standard Bubble", "ستاندرد بابل", "Exterior wash & interior cleaning.", "غسيل خارجي و تنظيف داخلي.", 60, 70, "wash"),
  svc(2, "Steam Bubble", "ستيم بابل", "Exterior wash & interior cleaning with steam.", "غسيل خارجي و تنظيف داخلي بالبخار.", 120, 140, "wash"),
  svc(3, "Deep Bubble", "ديب بابل", "Exterior wash, engine wash, under-chassis & interior steam cleaning.", "غسيل خارجي و غسيل المكينة و تحت الهيكل.", 180, 200, "wash"),
  svc(4, "Interior Detailing", "بولش داخلي", "Full interior polish and deep detailing.", "بولش داخلي.", 450, 550, "detailing"),
  svc(5, "Exterior Detailing", "بولش خارجي", "Full exterior polish and paint care.", "بولش خارجي.", 550, 650, "detailing"),
  svc(6, "Bubbleit Detailing", "ببلت ديتيلنق", "The complete package — interior & exterior polish.", "بولش داخلي و خارجي.", 850, 1000, "detailing"),
  ...[["6", 480], ["8", 640], ["10", 800], ["12", 960], ["14", 1200]].map(([m, p], i) =>
    svc(10 + i, `Caravan Wash In & Out — ${m}m`, `غسيل الكرفان داخل و برع — ${m} متر`, "Full interior & exterior caravan wash.", "غسيل الكرفان داخل و برع.", p as number, p as number, "caravan")),
  ...[["6", 300], ["8", 400], ["10", 500], ["12", 600], ["14", 700]].map(([m, p], i) =>
    svc(20 + i, `Caravan Wash Single Side — ${m}m`, `الكرفان داخل فقط او برع فقط — ${m} متر`, "Interior only or exterior only.", "داخل فقط او برع فقط.", p as number, p as number, "caravan_single")),
  ...[["Standard Jet", "ستاندر جيت", 100], ["Deep Jet", "ديب جيت", 200], ["Polish Jet", "بولش جيت", 500], ["Bubbleit Jet", "ببلت جيت", 650]].map(([n, a, p], i) =>
    svc(30 + i, `${n} — Jet Ski`, `${a} — جت سكي`, "Jet ski wash service.", "غسيل جت سكي.", p as number, p as number, "jet_ski")),
  ...[["Standard Jet", "ستاندرد جيت", 250], ["Deep Jet", "ديب جيت", 500], ["Polish Jet", "بولش جيت", 1200], ["Bubbleit Jet", "ببلت جيت", 1600]].map(([n, a, p], i) =>
    svc(40 + i, `${n} — Jet Boat`, `${a} — جيت بوت`, "Jet boat wash service.", "غسيل جيت بوت.", p as number, p as number, "jet_boat")),
];

const plan = (
  id: number, name: string, name_ar: string, scope: MembershipPlan["scope"],
  vehicle_type: MembershipPlan["vehicle_type"], washes_count: number, price: number,
  window: [string, string] | null = null,
): MembershipPlan => ({
  id, name, name_ar, scope, vehicle_type, washes_count, price,
  validity_days: 30,
  window_start: window?.[0] ?? null,
  window_end: window?.[1] ?? null,
});

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  ...([[4, 230], [8, 450], [24, 1349], [48, 2549]] as const).map(([w, p], i) =>
    plan(1 + i, `Full Wash Membership — ${w} washes (Salon)`, `اشتراك غسيل داخل و برع — ${w} غسلات (صالون)`, "full_wash", "sedan", w, p)),
  ...([[4, 260], [8, 500], [24, 1399], [48, 2599]] as const).map(([w, p], i) =>
    plan(5 + i, `Full Wash Membership — ${w} washes (4-Wheel)`, `اشتراك غسيل داخل و برع — ${w} غسلات (فور ويل)`, "full_wash", "suv", w, p)),
  ...([[4, 200], [8, 380], [24, 1199], [48, 2149]] as const).map(([w, p], i) =>
    plan(9 + i, `Exterior Wash Membership — ${w} washes (Salon)`, `اشتراك غسيل خارجي — ${w} غسلات (صالون)`, "exterior", "sedan", w, p)),
  ...([[4, 220], [8, 400], [24, 1199], [48, 2149]] as const).map(([w, p], i) =>
    plan(13 + i, `Exterior Wash Membership — ${w} washes (4-Wheel)`, `اشتراك غسيل خارجي — ${w} غسلات (فور ويل)`, "exterior", "suv", w, p)),
  ...([[4, 139], [8, 259], [24, 799], [48, 1499]] as const).map(([w, p], i) =>
    plan(17 + i, `Midnight Membership — ${w} washes`, `اشتراك ميدنايت — ${w} غسلات`, "midnight_exterior", null, w, p, ["00:00", "05:00"])),
];

export const MIDNIGHT_SLOT_GRID = ["00:00", "01:00", "02:00", "03:00", "04:00"];

export const SLOT_GRID = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending_payment: "Pending Payment",
  paid: "Confirmed",
  assigned: "Team Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled_by_customer: "Cancelled",
  cancelled_by_admin: "Cancelled",
  no_show: "No Show",
};

function seed(): MockDB {
  return {
    customers: [],
    memberships: [],
    tokens: new Map(),
    otps: new Map(),
    bookings: [],
    nextId: 100,
  };
}

const g = globalThis as typeof globalThis & { __bubbleitMockDb?: MockDB };

export function db(): MockDB {
  g.__bubbleitMockDb ??= seed();
  return g.__bubbleitMockDb;
}

export function makeReference(id: number) {
  return `BK-${String(id).padStart(5, "0")}`;
}

export function isPayable(status: BookingStatus, method: PaymentMethod) {
  return status === "pending_payment" && method === "online";
}
