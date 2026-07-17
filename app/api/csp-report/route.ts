import { NextRequest, NextResponse } from "next/server";

const MAX_REPORT_BYTES = 16_384;

function safeLocation(value: unknown) {
  if (typeof value !== "string" || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`;
    }
    return url.protocol;
  } catch {
    return undefined;
  }
}

function safeToken(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(value)
    ? value
    : undefined;
}

export async function POST(request: NextRequest) {
  const declaredLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: "Report too large." }, { status: 413 });
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REPORT_BYTES) {
    return NextResponse.json({ error: "Report too large." }, { status: 413 });
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const report =
      (parsed["csp-report"] as Record<string, unknown> | undefined) ?? parsed;
    const evidence = {
      effectiveDirective: safeToken(
        report["effective-directive"] ?? report.effectiveDirective,
      ),
      violatedDirective: safeToken(
        report["violated-directive"] ?? report.violatedDirective,
      ),
      disposition: safeToken(report.disposition),
      document: safeLocation(report["document-uri"] ?? report.documentURL),
      blocked: safeLocation(report["blocked-uri"] ?? report.blockedURL),
    };
    console.warn("CSP violation", evidence);
  } catch {
    return NextResponse.json({ error: "Invalid CSP report." }, { status: 400 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store, private" },
  });
}
