import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const disableSentryBuildUploads = process.env.SENTRY_BUILD_UPLOADS === "false";

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
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(), usb=()" },
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

export default withSentryConfig(nextConfig, {
  // Local verification can disable build network writes without changing
  // application error reporting or the release pipeline's default behavior.
  sourcemaps: { disable: disableSentryBuildUploads },
  ...(disableSentryBuildUploads
    ? { telemetry: false, release: { create: false, finalize: false } }
    : {}),
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "mad-intelligence-ai-solutions",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
