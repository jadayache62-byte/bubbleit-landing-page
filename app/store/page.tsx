import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { StoreClient } from "@/components/store/StoreClient";

export const metadata: Metadata = {
  title: "Store | Bubbleit",
  description:
    "Shop Bubbleit car care products, microfiber towels, brushes, gloves, and accessories.",
};

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
