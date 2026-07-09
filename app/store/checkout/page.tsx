import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { StoreCheckoutClient } from "@/components/store/StoreCheckoutClient";

export const metadata: Metadata = {
  title: "Store Checkout | Bubbleit",
  description: "Complete your Bubbleit store product order.",
};

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
