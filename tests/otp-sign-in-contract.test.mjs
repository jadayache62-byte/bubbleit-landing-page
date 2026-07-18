import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("../components/booking/AuthPanel.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");

test("returning customers can choose direct authentication-purpose OTP sign-in", () => {
  assert.match(panel, /async function startOtpLogin\(\)/);
  assert.match(panel, /requestOtp\(normalizeQatarPhone\(phone\), "authentication"\)/);
  assert.match(panel, /setStage\("otp_login"\)/);
  assert.match(panel, /async function submitOtpLogin\(\)/);
  assert.match(panel, /const result = await verifyOtp\(normalizeQatarPhone\(phone\), code\.trim\(\)\);/);
  assert.match(panel, /onAuthed\(result\.customer\)/);
  assert.match(panel, /Sign in with SMS code/);
});

test("registration remains purpose-isolated and the mock signs an existing customer in", () => {
  assert.match(panel, /requestOtp\(normalizeQatarPhone\(phone\), "registration"\)/);
  assert.match(mock, /const key = otpKey\(phone, "authentication"\)/);
  assert.match(mock, /const isNew = !customer/);
  assert.match(mock, /return envelope\(\{ token, customer: publicCustomer, is_new: isNew \}\)/);
});

test("customer authentication copy reflects Twilio SMS instead of WhatsApp", () => {
  assert.doesNotMatch(panel, /WhatsApp/);
  assert.match(panel, /We sent a 6-digit SMS code\. Enter it to sign in\./);
  assert.match(panel, /We sent a 6-digit code by SMS — enter it to finish\./);
});
