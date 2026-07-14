import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "bubbleit_customer_session";
const AUTHENTICATING_PATHS = new Set([
  "auth/login",
  "auth/register",
  "auth/verify-otp",
]);

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

function isCrossSiteMutation(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (origin === null) return false;

  try {
    return new URL(origin).origin !== requestOrigin(request);
  } catch {
    return true;
  }
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
    ...(expiresAt ? { expires: new Date(expiresAt) } : { maxAge: 60 * 60 * 24 * 30 }),
  });
}

async function proxy(request: NextRequest, context: RouteContext) {
  if (isCrossSiteMutation(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Cross-site request rejected.",
        data: null,
        errors: null,
      },
      { status: 403 },
    );
  }

  const { path: segments } = await context.params;
  const path = segments.join("/");
  const target = new URL(`${upstreamBase(request)}/${path}`);
  target.search = request.nextUrl.search;

  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const idempotencyKey = request.headers.get("idempotency-key");
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method)
      ? undefined
      : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = new Headers({
    "Cache-Control": "no-store, private",
    "Content-Type": upstream.headers.get("content-type") ?? "application/json",
  });
  const retryAfter = upstream.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("Retry-After", retryAfter);

  let body = await upstream.text();
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
