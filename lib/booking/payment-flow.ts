export type BookingPaymentStatus =
  | "not_started"
  | "not_required"
  | "ready"
  | "retryable"
  | "failed"
  | "cancelled"
  | "timed_out"
  | "pending"
  | "cash_due"
  | "paid"
  | "reconciliation_required"
  | "partially_refunded"
  | "refunded";

export type BookingPaymentUiState =
  | "covered_confirmed"
  | "paid_confirmed"
  | "payment_pending"
  | "cash_due"
  | "payment_retryable"
  | "payment_reconciliation"
  | "payment_closed";

export function bookingPaymentUiState(
  status: BookingPaymentStatus | null | undefined,
): BookingPaymentUiState {
  switch (status) {
    case "not_required":
      return "covered_confirmed";
    case "paid":
      return "paid_confirmed";
    case "cash_due":
      return "cash_due";
    case "retryable":
    case "failed":
    case "cancelled":
    case "timed_out":
      return "payment_retryable";
    case "reconciliation_required":
      return "payment_reconciliation";
    case "partially_refunded":
    case "refunded":
      return "payment_closed";
    default:
      return "payment_pending";
  }
}

export function canRetryBookingPayment(state: BookingPaymentUiState): boolean {
  return state === "payment_pending" || state === "payment_retryable";
}

export function usableCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const candidate = value.trim();
  if (candidate.startsWith("/")) return candidate.startsWith("//") ? null : candidate;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
