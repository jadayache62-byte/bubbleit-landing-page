import type { Metadata } from "next";
import { AccountDeletionClient } from "./AccountDeletionClient";

export const metadata: Metadata = {
  title: "Account Data & Deletion | Bubbleit",
  description: "Download your BubbleIt customer data or permanently delete your BubbleIt account and associated personal data.",
  alternates: { canonical: "/account-deletion" },
  openGraph: { title: "Bubbleit Account Data & Deletion", url: "/account-deletion", type: "website" },
};

export default function AccountDeletionPage() {
  return <AccountDeletionClient />;
}
