import type { Metadata } from "next";
import { ReviewPageClient } from "./ReviewPageClient";

export const metadata: Metadata = {
  title: "Review your wash | Bubbleit",
  description: "Share feedback about your completed Bubbleit service.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ invitation: string }>;
}) {
  const { invitation } = await params;

  return <ReviewPageClient invitation={invitation} />;
}
