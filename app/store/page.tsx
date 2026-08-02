import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { StoreClient } from "@/components/store/StoreClient";
import { localizedMetadata } from "@/lib/localized-metadata";

export const generateMetadata = () => localizedMetadata("store");

export default function StorePage() {
  return (
    <>
      <Navbar />
      <main>
        <StoreClient />
      </main>
      <Footer />
    </>
  );
}
