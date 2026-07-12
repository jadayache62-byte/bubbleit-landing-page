import { redirect } from "next/navigation";

// Memberships are detected and applied automatically inside the standard
// booking wizard. Keep this redirect for old bookmarks and shared links.
export default function LegacyMembershipBookingPage() {
  redirect("/book");
}
