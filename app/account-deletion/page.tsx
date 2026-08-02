import { AccountDeletionClient } from "./AccountDeletionClient";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("accountDeletion");

export default function AccountDeletionPage() {
  return <AccountDeletionClient />;
}
