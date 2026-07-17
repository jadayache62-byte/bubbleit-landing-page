import type { Lang } from "@/lib/locale";

export function formatQar(amount: number, lang: Lang, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(lang === "ar" ? "ar-QA" : "en-QA", {
    style: "currency",
    currency: "QAR",
    currencyDisplay: "code",
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(amount);
}
