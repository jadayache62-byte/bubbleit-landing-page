"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <>
      <Navbar />
      <main className="section-shell flex min-h-[60vh] flex-col items-center justify-center gap-6 py-24 text-center">
        <p className="font-heading text-7xl font-bold text-[color:var(--navy)]">404</p>
        <h1 className="font-heading text-3xl font-bold text-[color:var(--navy)] sm:text-4xl">
          {t("Page not found")}
        </h1>
        <p className="max-w-md text-base leading-7 text-[color:var(--navy)]/70">
          {t(
            "We couldn't find the page you were looking for. It may have been moved or the link may be incorrect.",
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="primary-button min-h-12 px-6">
            {t("Go to homepage")}
          </Link>
          <Link
            href="/store"
            className="text-sm font-semibold text-[color:var(--navy)] underline-offset-4 hover:underline"
          >
            {t("Browse the store")}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
