import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The server-only BFF owns the upstream URL and bearer token. Keep the former
// NEXT_PUBLIC name as a deployment-compatible fallback, but client code never
// reads either value.
if (
  process.env.NODE_ENV === "production" &&
  !process.env.CUSTOMER_API_BASE &&
  !process.env.NEXT_PUBLIC_API_BASE
) {
  throw new Error(
    "CUSTOMER_API_BASE must be set for a production build — without it the " +
      "site serves the local mock API instead of the real Laravel backend.",
  );
}

// Request-specific CSP nonces are applied by proxy.ts. These static headers are
// intentionally present on pages, route handlers, and error responses alike.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
