"use client";

import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { useI18n } from "@/lib/i18n";
import {
  LEGAL_ENTITY,
  LEGAL_POLICY_EFFECTIVE_DATE,
  LEGAL_POLICY_VERSION,
  type LegalPolicy,
} from "@/lib/legal/policies";

export function LegalPolicyPage({ policy }: { policy: LegalPolicy }) {
  const { lang } = useI18n();
  const pick = (value: { en: string; ar: string }) => value[lang];

  return (
    <>
      <Navbar />
      <main id="main-content" className="section-shell py-10 sm:py-16">
        <article className="mx-auto max-w-4xl">
          <header className="commerce-card bg-[color:var(--navy)] p-6 text-white sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-white/70">
              {lang === "ar" ? `الإصدار ${LEGAL_POLICY_VERSION}` : `Version ${LEGAL_POLICY_VERSION}`}
            </p>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">{pick(policy.title)}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/80 sm:text-lg">{pick(policy.summary)}</p>
            <p className="mt-5 text-sm text-white/65">
              {lang === "ar" ? "تاريخ السريان" : "Effective date"}: <span dir="ltr">{LEGAL_POLICY_EFFECTIVE_DATE}</span>
            </p>
          </header>

          <div className="mt-8 space-y-5">
            {policy.sections.map((section) => (
              <section key={section.id} id={section.id} className="commerce-card scroll-mt-24 p-5 sm:p-8">
                <h2 className="text-xl font-extrabold text-[color:var(--navy)] sm:text-2xl">{pick(section.title)}</h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-[color:var(--muted-foreground)]">
                  {section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`}>{pick(paragraph)}</p>)}
                  {section.items && (
                    <ul className="list-disc space-y-2 ps-6">
                      {section.items.map((item, index) => <li key={`${section.id}-item-${index}`}>{pick(item)}</li>)}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>

          <aside className="mt-8 rounded-3xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-slate-700 sm:p-7">
            <strong className="text-[color:var(--navy)]">{LEGAL_ENTITY.name}</strong><br />
            {lang === "ar" ? "السجل التجاري" : "Commercial Registration"}: <span dir="ltr">{LEGAL_ENTITY.commercialRegistration}</span><br />
            {LEGAL_ENTITY.address}<br />
            <a className="font-semibold text-[color:var(--navy)] underline" href={`mailto:${LEGAL_ENTITY.privacyEmail}`}>{LEGAL_ENTITY.privacyEmail}</a>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="font-semibold text-[color:var(--navy)] underline" href="/privacy">{lang === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
              <Link className="font-semibold text-[color:var(--navy)] underline" href="/terms">{lang === "ar" ? "الشروط والأحكام" : "Terms & Conditions"}</Link>
              <Link className="font-semibold text-[color:var(--navy)] underline" href="/account-deletion">{lang === "ar" ? "حذف الحساب" : "Account deletion"}</Link>
            </div>
          </aside>
        </article>
      </main>
      <Footer />
    </>
  );
}
