"use client";

import { useI18n } from "@/lib/i18n";

export function BookingPageHeading() {
  const { t } = useI18n();

  return (
    <div className="mb-5 text-center sm:mb-8">
      <span className="section-kicker">{t("Book a Wash")}</span>
      <h1 className="section-title mt-4">{t("Your car wash, your schedule")}</h1>
    </div>
  );
}
