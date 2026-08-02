import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { StoreCheckoutClient } from "@/components/store/StoreCheckoutClient";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("storeCheckout");

export default function StoreCheckoutPage() {
  return (
    <>
      <Navbar />
      <main>
        <StoreCheckoutClient />
      </main>
      <Footer />
    </>
  );
}
