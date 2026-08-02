import { LegalPolicyPage } from "@/components/legal/LegalPolicyPage";
import { PRIVACY_POLICY } from "@/lib/legal/policies";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("privacy");

export default function PrivacyPage() {
  return <LegalPolicyPage policy={PRIVACY_POLICY} />;
}
