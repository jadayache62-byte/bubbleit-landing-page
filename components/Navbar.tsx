"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { AppButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

// Absolute paths so the links work from /book and /account too.
const navItems = [
  { label: "Services", href: "/#services" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Benefits", href: "/#benefits" },
  { label: "Download", href: "/#download" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { lang, t, setLang } = useI18n();

  useEffect(() => {
    const closeMenu = () => setIsOpen(false);
    window.addEventListener("resize", closeMenu);
    return () => window.removeEventListener("resize", closeMenu);
  }, []);

  return (
    <header className="sticky top-0 z-50 overflow-visible border-b border-[color:var(--border)] bg-white/88 backdrop-blur-xl">
      <div className="section-shell">
        <div className="flex h-[64px] items-center justify-between gap-3 md:h-[72px] md:gap-4 lg:h-[78px]">
          <Link
            href="/"
            className="flex shrink-0 items-center overflow-visible"
            aria-label="Bubbleit home"
          >
            <Image
              src="/assets/brand/logo-secondary.png"
              alt="Bubbleit logo"
              width={1600}
              height={510}
              priority
              className="block w-[145px] h-auto max-h-[44px] shrink-0 object-contain md:w-[170px] md:max-h-[50px] lg:w-[205px] lg:max-h-[58px]"
            />
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-[color:var(--muted-foreground)] transition hover:text-[color:var(--navy)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]"
              >
                {t(item.label)}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="/memberships"
              className="text-sm font-medium text-[color:var(--muted-foreground)] transition hover:text-[color:var(--navy)]"
            >
              {t("Memberships")}
            </a>
            <a
              href="/account"
              className="text-sm font-medium text-[color:var(--muted-foreground)] transition hover:text-[color:var(--navy)]"
            >
              {t("My Bookings")}
            </a>
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--navy)] transition hover:border-[color:var(--blue)] hover:text-[color:var(--blue)]"
            >
              {lang === "en" ? "عربي" : "EN"}
            </button>
            <AppButton href="/book" className="px-5">
              {t("Book Now")}
            </AppButton>
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--navy)] transition hover:border-[color:var(--blue)] hover:text-[color:var(--blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)] lg:hidden"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className="sr-only">Menu</span>
            <div className="flex flex-col gap-1.5">
              <span
                className={clsx(
                  "block h-0.5 w-5 rounded-full bg-current transition",
                  isOpen && "translate-y-2 rotate-45",
                )}
              />
              <span
                className={clsx(
                  "block h-0.5 w-5 rounded-full bg-current transition",
                  isOpen && "opacity-0",
                )}
              />
              <span
                className={clsx(
                  "block h-0.5 w-5 rounded-full bg-current transition",
                  isOpen && "-translate-y-2 -rotate-45",
                )}
              />
            </div>
          </button>
        </div>

        <div
          id="mobile-menu"
          className={clsx(
            "overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out lg:hidden",
            isOpen ? "grid grid-rows-[1fr] pb-4 opacity-100" : "grid grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <nav
              className="glass-panel flex flex-col gap-2 rounded-[28px] p-3"
              aria-label="Mobile"
            >
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]"
                  onClick={() => setIsOpen(false)}
                >
                  {t(item.label)}
                </a>
              ))}
              <a
                href="/memberships"
                className="rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)]"
                onClick={() => setIsOpen(false)}
              >
                {t("Memberships")}
              </a>
              <a
                href="/account"
                className="rounded-2xl px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--background)]"
                onClick={() => setIsOpen(false)}
              >
                {t("My Bookings")}
              </a>
              <button
                type="button"
                onClick={() => setLang(lang === "en" ? "ar" : "en")}
                className="rounded-2xl px-4 py-3 text-start text-sm font-semibold text-[color:var(--navy)] transition hover:bg-[color:var(--background)]"
              >
                {lang === "en" ? "عربي" : "English"}
              </button>
              <AppButton href="/book" className="mt-2 w-full" variant="primary">
                {t("Book Now")}
              </AppButton>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
