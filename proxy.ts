import { NextRequest, NextResponse } from "next/server";

import {
  contentSecurityPolicy,
  cspMode,
  cspResponseHeader,
} from "@/lib/security/csp";

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
  );
  const requestHeaders = new Headers(request.headers);

  // Next.js reads the request CSP to apply the nonce to framework scripts.
  // The browser receives either report-only or enforced policy by rollout mode.
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(cspResponseHeader(cspMode()), policy);
  response.headers.set(
    "Reporting-Endpoints",
    'csp-endpoint="/api/csp-report"',
  );
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
