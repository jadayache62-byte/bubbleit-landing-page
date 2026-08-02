import { ReviewPageClient } from "./ReviewPageClient";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("review");

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ invitation: string }>;
}) {
  const { invitation } = await params;

  return <ReviewPageClient invitation={invitation} />;
}
