import type { Metadata } from "next";
import { LegalPolicyPage } from "@/components/legal/LegalPolicyPage";
import { PRIVACY_POLICY } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Privacy Policy | Bubbleit",
  description: "How Bubble It Cars Washing LLC collects, uses, protects, retains, exports, and deletes personal data.",
  alternates: { canonical: "/privacy" },
  openGraph: { title: "Bubbleit Privacy Policy", url: "/privacy", type: "article" },
};

export default function PrivacyPage() {
  return <LegalPolicyPage policy={PRIVACY_POLICY} />;
}
