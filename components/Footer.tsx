"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-[color:var(--navy)] pb-8 pt-14 text-white">
      <div className="section-shell">
        <div className="grid gap-10 border-b border-white/10 pb-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Image
              src="/assets/brand/logo-white.svg"
              alt={t("Bubbleit logo")}
              width={160}
              height={48}
              className="h-11 w-auto"
            />
            <p className="mt-5 max-w-md text-base leading-7 text-white/74">
              {t("Bubbleit makes mobile car wash booking simple, fast, and convenient.")}
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/72">
                {t("Book")}
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-base">
                <a
                  href="/book"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  {t("Book a Wash")}
                </a>
                <a
                  href="/account"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  {t("My Bookings")}
                </a>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/72">
                {t("Contact")}
              </h2>
              <p dir="ltr" className="mt-4 text-base text-white rtl:text-right">+974 7788 6668</p>
              <a
                href="https://wa.me/97477886668"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-base font-medium text-[color:var(--cyan)] transition hover:text-white"
              >
                {t("WhatsApp")}
              </a>
              <div className="mt-3 flex flex-col gap-2 text-base">
                <a
                  href="https://instagram.com/bubbleitqa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  Instagram @bubbleitqa
                </a>
                <a
                  href="https://tiktok.com/@bubbleitqa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  TikTok @bubbleitqa
                </a>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/72">
                {t("Legal")}
              </h2>
              <div className="mt-4 flex flex-col gap-3 text-base">
                <a
                  href="/privacy"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  {t("Privacy Policy")}
                </a>
                <a
                  href="/terms"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  {t("Terms & Conditions")}
                </a>
                <a
                  href="/account-deletion"
                  className="text-white/82 transition hover:text-[color:var(--cyan)]"
                >
                  {t("Account deletion")}
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="pt-6 text-sm text-white/58">
          © 2026 Bubbleit. {t("All rights reserved.")}
        </p>
      </div>
    </footer>
  );
}
