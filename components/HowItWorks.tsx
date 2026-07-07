"use client";

import { SectionHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const steps = [
  {
    title: "Choose Your Service",
    description: "Select the car wash package that fits your needs.",
  },
  {
    title: "Pick Time & Location",
    description:
      "Choose your booking time and add your location directly in the app.",
  },
  {
    title: "Confirm Your Booking",
    description: "Review your details and confirm your booking.",
  },
  {
    title: "We Come to You",
    description:
      "Our team arrives at your location and completes the service.",
  },
];

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <section
      id="how-it-works"
      className="section-spacing bg-white/55"
      aria-labelledby="how-it-works-title"
    >
      <div className="section-shell">
        <SectionHeader
          eyebrow={t("How It Works")}
          title={t("How Bubbleit Works")}
          description={t("A simple booking flow designed to feel fast, clear, and mobile-friendly.")}
          titleId="how-it-works-title"
        />

        <div className="relative mt-12">
          <div className="pointer-events-none absolute left-8 top-8 bottom-8 hidden w-px bg-linear-to-b from-[color:var(--cyan)]/30 via-[color:var(--blue)]/20 to-transparent md:block lg:left-1/2 lg:top-14 lg:h-px lg:w-auto lg:-translate-x-1/2 lg:right-16 lg:bottom-auto" />
          <div className="card-grid lg:grid-cols-4">
            {steps.map((step, index) => (
              <article
                key={step.title}
                className="glass-panel relative rounded-[var(--radius-card)] p-6"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[color:var(--navy)] text-lg font-bold text-white shadow-[var(--shadow-card)]">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-bold text-[color:var(--foreground)]">
                  {t(step.title)}
                </h3>
                <p className="mt-3 text-base leading-7 text-[color:var(--muted-foreground)]">
                  {t(step.description)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
