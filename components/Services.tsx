"use client";

import { SectionHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const services = [
  {
    title: "Standard Bubble",
    description: "Exterior wash & interior cleaning.",
    salon: 60,
    suv: 70,
    icon: "01",
  },
  {
    title: "Steam Bubble",
    description: "Exterior wash & interior cleaning with steam.",
    salon: 120,
    suv: 140,
    icon: "02",
  },
  {
    title: "Deep Bubble",
    description:
      "Exterior wash, engine wash, under-chassis & interior steam cleaning.",
    salon: 180,
    suv: 200,
    icon: "03",
  },
  {
    title: "Interior Detailing",
    description: "Full interior polish and deep detailing.",
    salon: 450,
    suv: 550,
    icon: "04",
  },
  {
    title: "Exterior Detailing",
    description: "Full exterior polish and paint care.",
    salon: 550,
    suv: 650,
    icon: "05",
  },
  {
    title: "Bubbleit Detailing",
    description: "The complete package — interior & exterior polish.",
    salon: 850,
    suv: 1000,
    icon: "06",
  },
];

export function Services() {
  const { t } = useI18n();
  return (
    <section id="services" className="section-spacing">
      <div className="section-shell">
        <SectionHeader
          eyebrow={t("Services")}
          title={t("Car Wash Services at Your Doorstep")}
          description={t("Choose the service you need and book directly from the app.")}
          titleId="services-title"
        />

        <div className="card-grid mt-12 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.title}
              className="glass-panel group flex flex-col rounded-[var(--radius-card)] p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(20,137,222,0.18)]"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-[color:var(--cyan)]/25 to-[color:var(--blue)]/20 text-sm font-bold text-[color:var(--deep-blue)]">
                {service.icon}
              </div>
              <h3 className="mt-5 flex items-center gap-2 text-xl font-bold text-[color:var(--foreground)]">
                {t(service.title)}
                {service.title === "Deep Bubble" && (
                  <span className="rounded-full bg-[color:var(--cyan)]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--navy)]">
                    {t("Popular")}
                  </span>
                )}
              </h3>
              <p className="mt-3 flex-1 text-base leading-7 text-[color:var(--muted-foreground)]">
                {t(service.description)}
              </p>
              <div className="mt-5 flex items-center gap-4 border-t border-[color:var(--border)] pt-4 text-sm">
                <span>
                  <span className="block text-xs font-medium text-[color:var(--muted-foreground)]">
                    {t("Salon")}
                  </span>
                  <span className="font-bold text-[color:var(--blue)]">
                    {service.salon} QR
                  </span>
                </span>
                <span>
                  <span className="block text-xs font-medium text-[color:var(--muted-foreground)]">
                    {t("SUV")}
                  </span>
                  <span className="font-bold text-[color:var(--blue)]">
                    {service.suv} QR
                  </span>
                </span>
                <a
                  href="/book"
                  className="ml-auto text-sm font-semibold text-[color:var(--navy)] transition hover:text-[color:var(--blue)]"
                >
                  {t("Book →")}
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
