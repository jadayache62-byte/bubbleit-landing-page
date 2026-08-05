import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panel = readFileSync(new URL("../components/booking/AuthPanel.tsx", import.meta.url), "utf8");
const mock = readFileSync(new URL("../app/api/mock/v1/customer/[...path]/route.ts", import.meta.url), "utf8");
const client = readFileSync(new URL("../lib/api/client.ts", import.meta.url), "utf8");

test("returning customers can choose direct authentication-purpose OTP sign-in", () => {
  assert.match(panel, /async function startOtpLogin\(\)/);
  assert.match(panel, /requestOtp\(normalizeQatarPhone\(phone\), "authentication"\)/);
  assert.match(panel, /setStage\("otp_login"\)/);
  assert.match(panel, /async function submitOtpLogin\(\)/);
  assert.match(panel, /const result = await verifyOtp\(normalizeQatarPhone\(phone\), code\.trim\(\)\);/);
  assert.match(panel, /onAuthed\(result\.customer\)/);
  assert.match(panel, /Sign in with verification code/);
});

test("registration remains purpose-isolated and the mock signs an existing customer in", () => {
  assert.match(panel, /requestOtp\(normalizeQatarPhone\(phone\), "registration"\)/);
  assert.match(mock, /const key = otpKey\(phone, "authentication"\)/);
  assert.match(mock, /const isNew = !customer/);
  assert.match(mock, /return envelope\(\{ token, customer: publicCustomer, is_new: isNew \}\)/);
});

test("customer authentication copy remains accurate for either configured OTP transport", () => {
  assert.doesNotMatch(panel, /Twilio|WhatsApp|SMS code|by SMS/);
  assert.match(panel, /We sent a 6-digit verification code to your phone\. Enter it to sign in\./);
  assert.match(panel, /We sent a 6-digit verification code to your phone\. Enter it to finish\./);
});

test("every OTP authentication stage explains and enforces the 30-second resend delay", () => {
  assert.match(panel, /const OTP_RESEND_DELAY_SECONDS = 30;/);
  assert.match(panel, /Date\.now\(\) \+ OTP_RESEND_DELAY_SECONDS \* 1000/);
  assert.match(panel, /You can request a new code in \{seconds\} seconds\./);
  assert.match(panel, /You can request a new code now\./);
  assert.match(panel, /disabled=\{busy \|\| waiting\}/);
  assert.equal(panel.match(/\{resendControl\((?:sendRegisterCode|startOtpLogin|startForgot)\)\}/g)?.length, 3);
});

test("forgot password verifies OTP before exposing the new-password step", () => {
  assert.match(panel, /setStage\("forgot_code"\)/);
  assert.match(panel, /await verifyPasswordResetOtp\(normalizeQatarPhone\(phone\), code\.trim\(\)\)/);
  assert.match(panel, /setPasswordResetToken\(grant\.reset_token\)/);
  assert.match(panel, /setStage\("forgot_password"\)/);
  assert.match(panel, /await resetPassword\(passwordResetToken, newPassword, newPasswordConfirmation\)/);
  assert.doesNotMatch(panel, /updateProfile\([^)]*password/);
  assert.match(client, /"\/auth\/forgot-password\/verify-otp"/);
  assert.match(client, /"\/auth\/forgot-password\/reset"/);
});

test("the development mock issues a one-time recovery grant without creating a login session", () => {
  assert.match(mock, /path === "auth\/forgot-password\/verify-otp"/);
  assert.match(mock, /passwordResetGrants\.set\(resetToken/);
  assert.match(mock, /path === "auth\/forgot-password\/reset"/);
  assert.match(mock, /passwordResetGrants\.delete\(resetToken\)/);
  assert.match(mock, /response\.headers\.set\("X-Reauthentication-Required", "true"\)/);
});
