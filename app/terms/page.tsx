import type { Metadata } from "next";
import { LegalPolicyPage } from "@/components/legal/LegalPolicyPage";
import { TERMS_POLICY } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Terms & Conditions | Bubbleit",
  description: "Terms governing BubbleIt bookings, memberships, store purchases, payments, cancellations, and customer accounts in Qatar.",
  alternates: { canonical: "/terms" },
  openGraph: { title: "Bubbleit Terms & Conditions", url: "/terms", type: "article" },
};

export default function TermsPage() {
  return <LegalPolicyPage policy={TERMS_POLICY} />;
}
