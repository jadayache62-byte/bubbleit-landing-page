import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingPaymentUiState,
  canRetryBookingPayment,
  usableCheckoutUrl,
} from "../lib/booking/payment-flow.ts";

test("membership-covered booking is confirmed without claiming an online payment", () => {
  assert.equal(bookingPaymentUiState("not_required"), "covered_confirmed");
  assert.equal(canRetryBookingPayment("covered_confirmed"), false);
});

test("only a paid server state is presented as payment confirmed", () => {
  assert.equal(bookingPaymentUiState("paid"), "paid_confirmed");
  assert.equal(bookingPaymentUiState("not_started"), "payment_pending");
  assert.equal(bookingPaymentUiState("ready"), "payment_pending");
  assert.equal(bookingPaymentUiState("pending"), "payment_pending");
  assert.equal(bookingPaymentUiState(undefined), "payment_pending");
});

test("retryable and reconciliation states have distinct recovery behavior", () => {
  assert.equal(bookingPaymentUiState("retryable"), "payment_retryable");
  assert.equal(bookingPaymentUiState("failed"), "payment_retryable");
  assert.equal(bookingPaymentUiState("cancelled"), "payment_retryable");
  assert.equal(bookingPaymentUiState("timed_out"), "payment_retryable");
  assert.equal(canRetryBookingPayment("payment_retryable"), true);
  assert.equal(
    bookingPaymentUiState("reconciliation_required"),
    "payment_reconciliation",
  );
  assert.equal(canRetryBookingPayment("payment_reconciliation"), false);
  assert.equal(bookingPaymentUiState("refunded"), "payment_closed");
  assert.equal(canRetryBookingPayment("payment_closed"), false);
});

test("null, blank, insecure, and protocol-relative checkout URLs fail closed", () => {
  assert.equal(usableCheckoutUrl(null), null);
  assert.equal(usableCheckoutUrl(""), null);
  assert.equal(usableCheckoutUrl("javascript:alert(1)"), null);
  assert.equal(usableCheckoutUrl("http://provider.invalid/pay"), null);
  assert.equal(usableCheckoutUrl("//provider.invalid/pay"), null);
});

test("HTTPS provider and same-origin simulator checkout URLs are usable", () => {
  assert.equal(
    usableCheckoutUrl("https://provider.invalid/pay/123"),
    "https://provider.invalid/pay/123",
  );
  assert.equal(usableCheckoutUrl("/book/checkout?id=123"), "/book/checkout?id=123");
});
