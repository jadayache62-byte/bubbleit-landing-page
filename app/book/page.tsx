import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { BookingWizard } from "@/components/booking/BookingWizard";

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
        <div className="mb-5 text-center sm:mb-8">
          <span className="section-kicker">Book a Wash</span>
          <h1 className="section-title mt-4">Your car wash, your schedule</h1>
        </div>
        <BookingWizard />
      </main>
      <Footer />
    </>
  );
}
