"use client";

import { SectionHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const benefits = [
  {
    title: "Easy Booking",
    description: "Book your car wash in just a few taps.",
  },
  {
    title: "Mobile Service",
    description: "No need to drive anywhere. Bubbleit comes to your location.",
  },
  {
    title: "Booking Management",
    description: "View your upcoming bookings and service details from the app.",
  },
  {
    title: "Secure Payment",
    description:
      "Membership checkout is online today; regular bookings can be paid later when our team confirms or arrives.",
  },
  {
    title: "Customer Support",
    description: "Get updates and support for your booking when needed.",
  },
  {
    title: "Arabic & English Ready",
    description:
      "Built to support customers in both Arabic and English when enabled.",
  },
];

export function Benefits() {
  const { t } = useI18n();
  return (
    <section id="benefits" className="section-spacing">
      <div className="section-shell">
        <SectionHeader
          eyebrow={t("Benefits")}
          title={t("Why Book With Bubbleit?")}
          description={t("Built around convenience, clarity, and a cleaner ownership experience.")}
          titleId="benefits-title"
        />

        <div className="card-grid mt-12 md:grid-cols-2 xl:grid-cols-3">
          {benefits.map((benefit, index) => (
            <article
              key={benefit.title}
              className="glass-panel rounded-[var(--radius-card)] p-6"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--cyan)]/16 text-sm font-bold text-[color:var(--deep-blue)]">
                  0{index + 1}
                </div>
                <h3 className="text-lg font-bold text-[color:var(--foreground)]">
                  {t(benefit.title)}
                </h3>
              </div>
              <p className="mt-4 text-base leading-7 text-[color:var(--muted-foreground)]">
                {t(benefit.description)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
