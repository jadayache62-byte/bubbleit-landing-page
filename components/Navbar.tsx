"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useI18n } from "@/lib/i18n";

// Absolute paths so the links work from /book and /account too.
const navItems = [
  { label: "Services", description: "Explore wash options", href: "/#services" },
  { label: "Memberships", description: "Save on regular washes", href: "/memberships" },
  { label: "Store", description: "Shop car-care products", href: "/store" },
  { label: "Account", description: "Bookings, plans and vehicles", href: "/account" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { lang, t, setLang } = useI18n();
  const pathname = usePathname();
  const isActive = (href: string) => href.startsWith("/#") ? pathname === "/" : pathname.startsWith(href);

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
            aria-label={t("Bubbleit home")}
          >
            <Image
              src="/assets/brand/logo-secondary.png"
              alt={t("Bubbleit logo")}
              width={1600}
              height={510}
              priority
              className="block w-[145px] h-auto max-h-[44px] shrink-0 object-contain md:w-[170px] md:max-h-[50px] lg:w-[205px] lg:max-h-[58px]"
            />
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label={t("Primary navigation")}>
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={clsx("border-b-2 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]", isActive(item.href) ? "border-[color:var(--blue)] text-[color:var(--navy)]" : "border-transparent text-[color:var(--muted-foreground)] hover:text-[color:var(--navy)]")}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {t(item.label)}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-sm font-semibold text-[color:var(--navy)] transition hover:border-[color:var(--blue)] hover:text-[color:var(--blue)]"
            >
              {lang === "en" ? "عربي" : "EN"}
            </button>
            <Link href="/book" className="primary-button min-h-12 px-5">{t("Book a Wash")}</Link>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--navy)] transition hover:border-[color:var(--blue)] hover:text-[color:var(--blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)] lg:hidden"
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-label={t(isOpen ? "Close navigation menu" : "Open navigation menu")}
            onClick={() => setIsOpen((current) => !current)}
          >
            <span className="sr-only">{t("Menu")}</span>
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
          aria-hidden={!isOpen}
          inert={!isOpen}
          className={clsx(
            "overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out lg:hidden",
            isOpen ? "grid grid-rows-[1fr] pb-4 opacity-100" : "grid grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <nav
              className="commerce-card flex flex-col gap-1.5 p-3"
              aria-label={t("Mobile navigation")}
            >
              <div className="px-3 pb-2 pt-1"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">{t("Explore Bubbleit")}</p></div>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx("flex items-center justify-between rounded-xl px-4 py-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]", isActive(item.href) ? "bg-blue-50 text-[color:var(--deep-blue)]" : "text-[color:var(--foreground)] hover:bg-[color:var(--background)]")}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                >
                  <span><span className="block text-sm font-bold">{t(item.label)}</span><span className="mt-0.5 block text-xs font-medium text-[color:var(--muted-foreground)]">{t(item.description)}</span></span><span aria-hidden="true" className="text-lg">→</span>
                </Link>
              ))}
              <Link href="/book" onClick={() => setIsOpen(false)} className="primary-button mt-2 min-h-14 w-full text-base">{t("Book a Wash")}</Link>
              <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--background)]">{lang === "en" ? "العربية" : "English"}</button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
