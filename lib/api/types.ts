// Types mirror the live Laravel customer API responses used by bubbleit.qa.
// The envelope and paginator shapes are identical to the admin API.

export type Envelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors: Record<string, string[]> | null;
  code?: string;
};

export type ServiceAreaSnapshot = {
  version: string;
  eligible: boolean;
};

export type DurationContribution = {
  line_index: number;
  kind: "service" | "add_on" | "fallback";
  service_id: number | null;
  add_on_id: number | null;
  name: string;
  configured_minutes: number;
  contributes: boolean;
  minutes: number;
};

export type DurationSnapshot = {
  schema: "duration-v1" | string;
  version: string;
  total_minutes: number;
  contributions: DurationContribution[];
  status?: "accepted" | "deterministic_legacy" | "ambiguous_legacy";
  ambiguous?: boolean;
};

export type Paginated<T> = {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
};

export type AddOn = {
  id: number;
  name: string;
  price: number;
  duration_minutes?: number;
  extends_duration: boolean;
};

export type VehicleType = "sedan" | "suv" | "caravan" | "jet_ski" | "jet_boat";

export type WashTarget = "car" | "caravan" | "jet_ski" | "jet_boat";

export type Service = {
  id: number;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  price: number; // salon price
  price_suv: number;
  duration_minutes: number;
  duration_label: string;
  category: string;
  add_ons: AddOn[];
};

export type Slot = {
  start: string; // "08:00"
  end: string; // "09:00"
  available: boolean;
  available_bus_count?: number;
  has_recommendation?: boolean;
};

export type Availability = {
  date: string; // "YYYY-MM-DD"
  duration_minutes: number;
  duration: DurationSnapshot;
  slots: Slot[];
  service_area: ServiceAreaSnapshot;
};

export type Customer = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
};

export type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: number | null;
  color: string;
  plate_number: string;
  type: VehicleType;
};

export type Address = {
  id: number;
  label: string;
  area: string;
  details: string;
  building_number?: string | null;
  zone_number?: string | null;
  street_number?: string | null;
  latitude: number | null;
  longitude: number | null;
  service_area: ServiceAreaSnapshot & { stale: boolean };
};

export type PaymentMethod = "pay_on_site" | "online" | "membership";

export type PaymentState = {
  status:
    | "not_started"
    | "not_required"
    | "ready"
    | "retryable"
    | "pending"
    | "paid"
    | "partially_refunded"
    | "refunded"
    | "reconciliation_required";
  captured: boolean;
  reconciliation_reason: string | null;
  checkout_url: string | null;
};

export type MembershipPlan = {
  id: number;
  name: string;
  name_ar: string;
  scope: "full_wash" | "exterior" | "midnight_exterior";
  vehicle_type: "sedan" | "suv" | null;
  washes_count: number;
  price: number;
  validity_days: number;
  window_start: string | null;
  window_end: string | null;
};

export type CustomerMembership = {
  id: number;
  status: "pending_payment" | "active" | "exhausted" | "expired" | "cancelled";
  washes_used: number;
  washes_remaining: number;
  price_paid: number;
  activated_at: string | null;
  expires_at: string | null;
  plan: MembershipPlan;
  payment?: PaymentState;
};

export type BookingStatus =
  | "pending_payment"
  | "paid"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled_by_customer"
  | "cancelled_by_admin"
  | "no_show";

export type BookingCar = {
  vehicle: Vehicle;
  service: Pick<Service, "id" | "name" | "price">;
  add_ons: AddOn[];
  subtotal: number;
};

export type Booking = {
  id: number;
  reference: string;
  status: BookingStatus;
  status_label: string;
  scheduled_at: string; // ISO
  scheduled_end_at?: string;
  service_date: string; // Qatar YYYY-MM-DD
  timezone: "Asia/Qatar";
  duration_minutes?: number;
  duration_label?: string;
  duration?: DurationSnapshot;
  time_range_label?: string | null;
  membership_applied?: boolean;
  payment_method: PaymentMethod;
  total: number;
  product_total?: number;
  products?: {
    product_id: string | number;
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
  address_label?: string | null;
  address_area: string;
  address_street?: string | null;
  building_number?: string | null;
  zone_number?: string | null;
  street_number?: string | null;
  notes: string;
  cars: BookingCar[];
  created_at: string;
  // Server-authoritative payment state. Checkout URLs are returned only by the
  // separate idempotent payment-initialization command.
  payment?: PaymentState;
};

export type VerifyOtpResult = {
  customer: Customer;
  is_new: boolean;
  session?: {
    label: string;
    created_at: string | null;
    last_used_at: string | null;
    expires_at: string;
  };
};

export type CreateBookingPayload = {
  quote_id?: string;
  quote_version?: string;
  scheduled_at: string;
  duration_version: string;
  cars?: { vehicle_id: number; service_id: number; add_on_ids: number[] }[];
  membership_id?: number;
  vehicle_id?: number;
  address_id?: number;
  address_area?: string;
  latitude?: number;
  longitude?: number;
  service_area_version: string;
  payment_method?: PaymentMethod;
  use_membership?: boolean;
  notes?: string;
  promo_code?: string;
  product_lines?: { product_id: string | number; quantity: number }[];
};

export type BookingRescheduleOptions = {
  date: string;
  timezone: "Asia/Qatar";
  duration: DurationSnapshot;
  service_area: ServiceAreaSnapshot;
  policy_version: string;
  cutoff_hours: number;
  slots: (Slot & { slot_version: string })[];
};

// Server-side price preview. The confirm page renders this instead of computing
// a total locally — the server applies eligible memberships and is the source
// of truth for the amount charged.
export type QuoteCar = {
  vehicle_type: VehicleType;
  service_id: number;
  add_on_ids: number[];
  membership_id?: number | null;
};

export type BookingQuote = {
  quote_id: string;
  quote_version: string;
  pricing_schema: "booking-cart-pricing:v1";
  currency: "QAR";
  expires_at: string;
  service: {
    id: number;
    name: string;
    price: number;
    duration_minutes: number;
    duration_label: string;
  } | null;
  scheduled_start_at: string;
  scheduled_end_at: string;
  time_range_label: string;
  duration_minutes: number;
  duration_label: string;
  duration: DurationSnapshot;
  base_price: number;
  discount_total: number;
  service_total: number;
  membership_eligible: boolean;
  membership_discount: number;
  promo_discount: number;
  product_total: number;
  total_price: number;
  payment_required: boolean;
  payment_method: PaymentMethod;
  cars: {
    index: number;
    service_id: number;
    subtotal: number;
    covered: boolean;
    membership_id: number | null;
    membership_name: string | null;
    membership_discount: number;
    remaining_before: number | null;
    remaining_after: number | null;
    eligible_memberships: {
      id: number;
      name: string | null;
      remaining_washes: number;
    }[];
  }[];
  memberships: {
    id: number;
    name: string;
    remaining_washes: number;
    washes_applied: number;
    remaining_after: number;
  }[];
  service_area: ServiceAreaSnapshot;
  products: {
    product_id: string | number;
    sku: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[];
};

// Result of validating a promo code against the current cart. All rule
// enforcement (expiry, usage limits, minimum spend, service scoping) lives
// server-side; the client only sends the cart and renders the outcome.
export type PromoValidation = {
  valid: boolean;
  code: string;
  discount_amount: number;
  final_total: number;
  message: string | null;
};

export type StoreProductInventory = {
  id: string | number;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  imageSrc: string | null;
  imageAlt?: string;
  stock_quantity: number;
  sold_quantity: number;
  reserved_quantity: number;
  available_quantity?: number;
  accounting_code: string | null;
  is_available?: boolean;
};

export type StoreOrderLine = {
  id?: number;
  product_id: string | number;
  inventory_item_id?: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  accounting_code: string | null;
};

export type StoreOrder = {
  id: number;
  customer_id: number;
  reference: string;
  status:
    | "pending_payment"
    | "paid"
    | "confirmed"
    | "preparing"
    | "out_for_delivery"
    | "delivered"
    | "cancelled"
    | "refunded"
    | "received"
    | "fulfilled";
  payment_status?: "unpaid" | "pending" | "paid" | "failed" | "refunded";
  payment_method?: string;
  payment?: PaymentState;
  accounting_status: "pending_sync" | "synced" | "sync_failed" | "not_required" | "failed";
  customer_name: string;
  customer_phone: string;
  delivery_area: string;
  delivery_details: string;
  building_number?: string | null;
  zone_number?: string | null;
  street_number?: string | null;
  latitude: number | null;
  longitude: number | null;
  service_area: ServiceAreaSnapshot;
  subtotal: number;
  total: number;
  lines: StoreOrderLine[];
  expires_at: string;
  created_at: string;
};

export type CreateStoreOrderPayload = {
  delivery_area: string;
  delivery_details: string;
  building_number?: string;
  zone_number?: string;
  street_number?: string;
  latitude: number;
  longitude: number;
  service_area_version: string;
  notes?: string;
  lines: { product_id: string | number; inventory_item_id?: number; quantity: number }[];
};

export type StoreOrderPayment = {
  purchase_id: number;
  attempt_id: number;
  merchant_reference: string;
  checkout_url: string;
  payment_reference: string;
  status: "ready" | "retryable" | "pending";
};
