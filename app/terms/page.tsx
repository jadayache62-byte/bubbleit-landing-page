import { LegalPolicyPage } from "@/components/legal/LegalPolicyPage";
import { TERMS_POLICY } from "@/lib/legal/policies";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("terms");

export default function TermsPage() {
  return <LegalPolicyPage policy={TERMS_POLICY} />;
}
