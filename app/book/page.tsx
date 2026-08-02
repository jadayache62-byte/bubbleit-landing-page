import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { BookingPageHeading } from "@/components/booking/BookingPageHeading";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("book");

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
