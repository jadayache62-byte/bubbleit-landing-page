import { AppCTA } from "@/components/AppCTA";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Navbar } from "@/components/Navbar";
import { Services } from "@/components/Services";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main id="top" className="overflow-x-clip">
        <Hero />
        <Services />
        <AppCTA />
      </main>
      <Footer />
    </>
  );
}
