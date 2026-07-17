import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { BookingPageHeading } from "@/components/booking/BookingPageHeading";

export const metadata: Metadata = {
  title: "Book a Wash | Bubbleit",
  description:
    "Book a professional mobile car wash in minutes. Choose your service, pick a time, and Bubbleit comes to you.",
};

export default function BookPage() {
  return (
    <>
      <Navbar />
      <main className="section-shell py-6 sm:py-14">
        <BookingPageHeading />
        <BookingWizard />
      </main>
      <Footer />
    </>
  );
}
