const REPORT_ENDPOINT = "/api/csp-report";

export type CspMode = "enforce" | "report-only";

export function cspMode(value = process.env.CSP_MODE): CspMode {
  return value === "enforce" ? "enforce" : "report-only";
}

export function contentSecurityPolicy(nonce: string, development: boolean) {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://nominatim.openstreetmap.org",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
    `report-uri ${REPORT_ENDPOINT}`,
    "report-to csp-endpoint",
  ];

  return directives.join("; ");
}

export function cspResponseHeader(mode: CspMode) {
  return mode === "enforce"
    ? "Content-Security-Policy"
    : "Content-Security-Policy-Report-Only";
}
