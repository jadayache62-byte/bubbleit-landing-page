import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 31000 + (process.pid % 1000);
const origin = `http://127.0.0.1:${port}`;
const phone = `+97455${String(process.pid % 1_000_000).padStart(6, "0")}`;
const serverEnv = { ...process.env };
delete serverEnv.CUSTOMER_API_BASE;
delete serverEnv.NEXT_PUBLIC_API_BASE;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
  { env: serverEnv, stdio: ["ignore", "pipe", "pipe"] },
);
let serverError = "";
server.stderr.on("data", (chunk) => {
  serverError += chunk.toString();
});

async function waitUntilReady() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js session test server exited early.\n${serverError}`);
    }
    try {
      const response = await fetch(`${origin}/api/customer/services`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next.js session test server did not become ready.\n${serverError}`);
}

async function post(path, body, cookie, requestOrigin = origin) {
  return fetch(`${origin}/api/customer/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: requestOrigin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

try {
  await waitUntilReady();

  const crossSite = await post(
    "auth/check-phone",
    { phone },
    undefined,
    "https://attacker.example",
  );
  assert.equal(crossSite.status, 403);

  const otp = await post("auth/request-otp", {
    phone,
    purpose: "registration",
  });
  assert.equal(otp.status, 200);

  const registration = await post("auth/register", {
    phone,
    name: "MAD-54 BFF",
    password: "oldpass123",
    code: "123456",
    device_name: "BFF integration test",
  });
  assert.equal(registration.status, 201);
  const registrationBody = await registration.json();
  assert.equal(Object.hasOwn(registrationBody.data, "token"), false);

  const setCookie = registration.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /^bubbleit_customer_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=lax/i);
  const cookie = setCookie.split(";", 1)[0];

  const me = await fetch(`${origin}/api/customer/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(me.status, 200);

  const reset = await fetch(`${origin}/api/customer/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify({ name: "MAD-54 BFF", password: "newpass123" }),
  });
  assert.equal(reset.status, 200);
  assert.match(reset.headers.get("set-cookie") ?? "", /Max-Age=0/i);

  const revoked = await fetch(`${origin}/api/customer/auth/me`, {
    headers: { Cookie: cookie },
  });
  assert.equal(revoked.status, 401);
  assert.equal(revoked.headers.get("x-session-ended"), "true");

  const login = await post("auth/login", {
    phone,
    password: "newpass123",
    device_name: "BFF integration test",
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  assert.equal(Object.hasOwn(loginBody.data, "token"), false);
  const loginCookie = (login.headers.get("set-cookie") ?? "").split(";", 1)[0];

  const logout = await post("auth/logout", {}, loginCookie);
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0/i);

  const loggedOut = await fetch(`${origin}/api/customer/auth/me`, {
    headers: { Cookie: loginCookie },
  });
  assert.equal(loggedOut.status, 401);

  process.stdout.write("session_bff_integration=passed\n");
} finally {
  server.kill("SIGTERM");
}
