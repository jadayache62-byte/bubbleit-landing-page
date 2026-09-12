import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "bubbleit_customer_session";
const AUTHENTICATING_PATHS = new Set([
  "auth/login",
  "auth/register",
  "auth/verify-otp",
]);
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

function requestOrigin(request: NextRequest) {
  const host =
    request.headers.get("host") ??
    request.nextUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");

  return `${protocol}://${host}`;
}

function upstreamBase(request: NextRequest) {
  const configured =
    process.env.CUSTOMER_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error("CUSTOMER_API_BASE is required in production.");
  }

  return `${requestOrigin(request)}/api/mock/v1/customer`;
}

function isCrossSiteMutation(request: NextRequest, requireExactOrigin = false) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (origin === null) return requireExactOrigin;

  try {
    return new URL(origin).origin !== requestOrigin(request);
  } catch {
    return true;
  }
}

function trackingRoute(path: string) {
  if (/^bookings\/[1-9][0-9]*\/tracking$/.test(path)) return "snapshot" as const;
  if (/^bookings\/[1-9][0-9]*\/live\/authorize$/.test(path)) return "authorize" as const;
  return null;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function pick(value: unknown, keys: readonly string[]) {
  const source = object(value);
  if (!source) return null;
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

function sanitizeTrackingBody(body: string, kind: "snapshot" | "authorize") {
  try {
    const envelope = object(JSON.parse(body));
    if (!envelope) return body;
    const clean: Record<string, unknown> = {
      success: envelope.success,
      message: envelope.message,
      data: envelope.data,
      errors: envelope.errors,
      ...(typeof envelope.code === "string" ? { code: envelope.code } : {}),
    };
    if (envelope.success !== true) return JSON.stringify(clean);
    const data = object(envelope.data);
    if (!data) return JSON.stringify({ ...clean, data: null });

    if (kind === "authorize") {
      clean.data = pick(data, ["auth", "channel", "grant_id", "purpose", "epoch", "revision", "expires_at"]);
      return JSON.stringify(clean);
    }

    const sanitized = pick(data, [
      "schema_version", "server_time", "policy_revision", "booking_id", "dispatch_state",
      "assignment_version", "tracking_available", "reason", "trip", "bus", "position",
      "destination", "route", "eta", "delay", "health", "stream",
    ]) ?? {};
    sanitized.trip = pick(data.trip, ["id", "status", "plan_revision", "window_starts_at", "arrived_at"]);
    sanitized.bus = pick(data.bus, ["bus_number", "plate_number"]);
    sanitized.position = pick(data.position, ["latitude", "longitude", "heading", "accuracy_m", "captured_at"]);
    sanitized.destination = pick(data.destination, ["latitude", "longitude"]);
    sanitized.route = pick(data.route, ["encoded_polyline", "calculated_at", "expires_at"]);
    sanitized.eta = pick(data.eta, ["arrival_at", "remaining_seconds", "source", "calculated_at", "expires_at"]);
    sanitized.delay = pick(data.delay, ["late_seconds", "source"]);
    sanitized.health = pick(data.health, ["status", "last_valid_at", "last_received_at"]);
    sanitized.stream = pick(data.stream, ["purpose", "epoch", "revision", "grant_id", "channel", "expires_at"]);
    clean.data = sanitized;
    return JSON.stringify(clean);
  } catch {
    return body;
  }
}

function requestId(request: NextRequest) {
  const candidate = request.headers.get("x-request-id");
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : crypto.randomUUID();
}

function expireSession(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

function establishSession(response: NextResponse, token: string, expiresAt?: string) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(expiresAt ? { expires: new Date(expiresAt) } : { maxAge: 60 * 60 * 24 * 21 }),
  });
}

async function proxy(request: NextRequest, context: RouteContext) {
  const correlationId = requestId(request);
  const { path: segments } = await context.params;
  const path = segments.join("/");
  const tracking = trackingRoute(path);
  if (isCrossSiteMutation(request, tracking === "authorize")) {
    return NextResponse.json(
      {
        success: false,
        message: "Cross-site request rejected.",
        data: null,
        errors: null,
      },
      { status: 403, headers: { "X-Request-ID": correlationId } },
    );
  }
  if (tracking === "snapshot" && request.method !== "GET"
    || tracking === "authorize" && request.method !== "POST") {
    return NextResponse.json(
      { success: false, message: "Method not allowed.", data: null, errors: null },
      { status: 405, headers: { "Cache-Control": "no-store, private", "X-Request-ID": correlationId } },
    );
  }
  const target = new URL(`${upstreamBase(request)}/${path}`);
  target.search = request.nextUrl.search;

  const headers = new Headers({ Accept: "application/json" });
  headers.set("X-Request-ID", correlationId);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (tracking && !token) {
    return NextResponse.json(
      { success: false, message: "Authentication required.", data: null, errors: null },
      { status: 401, headers: { "Cache-Control": "no-store, private", "X-Request-ID": correlationId } },
    );
  }

  let requestBody: ArrayBuffer | undefined;
  if (!["GET", "HEAD"].includes(request.method)) {
    requestBody = await request.arrayBuffer();
  }
  if (tracking === "authorize") {
    if (!requestBody || requestBody.byteLength > 1024) {
      return NextResponse.json(
        { success: false, message: "Invalid live authorization request.", data: null, errors: null },
        { status: 422, headers: { "Cache-Control": "no-store, private", "X-Request-ID": correlationId } },
      );
    }
    try {
      const input = object(JSON.parse(new TextDecoder().decode(requestBody)));
      if (!input || Object.keys(input).some((key) => !["socket_id", "grant_id", "purpose"].includes(key))) {
        throw new Error("invalid");
      }
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid live authorization request.", data: null, errors: null },
        { status: 422, headers: { "Cache-Control": "no-store, private", "X-Request-ID": correlationId } },
      );
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: requestBody,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "The Bubbleit service is temporarily unavailable.",
        data: null,
        errors: null,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, private",
          "X-Request-ID": correlationId,
        },
      },
    );
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store, private",
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  });
  responseHeaders.set(
    "X-Request-ID",
    upstream.headers.get("x-request-id") ?? correlationId,
  );
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("Retry-After", retryAfter);

  let body = await upstream.text();
  if (tracking) body = sanitizeTrackingBody(body, tracking);
  let issuedToken: string | undefined;
  let expiresAt: string | undefined;

  if (AUTHENTICATING_PATHS.has(path) && upstream.ok) {
    try {
      const envelope = JSON.parse(body) as {
        data?: {
          token?: string;
          session?: { expires_at?: string };
        };
      };
      issuedToken = envelope.data?.token;
      expiresAt = envelope.data?.session?.expires_at;
      if (envelope.data) delete envelope.data.token;
      body = JSON.stringify(envelope);
    } catch {
      // Preserve the upstream response; the browser client will reject a
      // malformed envelope and no session cookie will be established.
    }
  }

  const response = new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });

  if (issuedToken) establishSession(response, issuedToken, expiresAt);
  if (upstream.status === 401 && token) {
    response.headers.set("X-Session-Ended", "true");
  }
  if (
    upstream.status === 401 ||
    path === "auth/logout" ||
    (path === "privacy/delete-account" && upstream.ok) ||
    upstream.headers.get("x-reauthentication-required") === "true"
  ) {
    expireSession(response);
  }

  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
