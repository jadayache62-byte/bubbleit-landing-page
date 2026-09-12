const REPORT_ENDPOINT = "/api/csp-report";

export type CspMode = "enforce" | "report-only";

export function cspMode(value = process.env.CSP_MODE): CspMode {
  return value === "enforce" ? "enforce" : "report-only";
}

export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  mode: CspMode,
) {
  const googleMapsEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY);
  const reverbHost = process.env.NEXT_PUBLIC_REVERB_HOST;
  const reverbPort = process.env.NEXT_PUBLIC_REVERB_PORT ?? "443";
  const reverbScheme = process.env.NEXT_PUBLIC_REVERB_SCHEME === "http" ? "ws" : "wss";
  const reverbSource = reverbHost && /^[A-Za-z0-9.-]+$/.test(reverbHost) && /^[0-9]+$/.test(reverbPort)
    ? `${reverbScheme}://${reverbHost}:${reverbPort}`
    : null;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development || googleMapsEnabled ? " 'unsafe-eval'" : ""}${googleMapsEnabled ? " https://maps.googleapis.com https://maps.gstatic.com blob:" : ""}`,
    `style-src 'self' 'unsafe-inline'${googleMapsEnabled ? " https://fonts.googleapis.com" : ""}`,
    `img-src 'self' data: blob: https://tile.openstreetmap.org${googleMapsEnabled ? " https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com" : ""}`,
    `font-src 'self' data:${googleMapsEnabled ? " https://fonts.gstatic.com" : ""}`,
    `connect-src 'self' https://nominatim.openstreetmap.org${googleMapsEnabled ? " https://*.googleapis.com https://*.gstatic.com https://*.google.com data: blob:" : ""}${reverbSource ? ` ${reverbSource}` : ""}`,
    "worker-src 'self' blob:",
    ...(googleMapsEnabled ? ["frame-src https://*.google.com"] : []),
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(mode === "enforce" ? ["upgrade-insecure-requests"] : []),
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
