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

// Conservative, framework-agnostic security headers. A full CSP is intentionally
// left out here because Leaflet/inline styles need runtime validation first.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
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
