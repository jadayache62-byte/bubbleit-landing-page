"use client";

import { AppButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const phoneActions = [
  { label: "Service", icon: "sparkles" },
  { label: "Time", icon: "clock" },
  { label: "Track", icon: "pin" },
] as const;

function PhoneActionIcon({ icon }: { icon: (typeof phoneActions)[number]["icon"] }) {
  if (icon === "clock") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
        <circle cx="12" cy="12" r="7.25" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 8.2v4.05l2.8 1.55"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (icon === "pin") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
        <path
          d="M12 20s5.25-5.13 5.25-9a5.25 5.25 0 1 0-10.5 0c0 3.87 5.25 9 5.25 9Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="1.9" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path
        d="m12 3.8 1.8 3.65 4.03.58-2.9 2.83.68 4-3.6-1.9-3.6 1.9.68-4-2.9-2.83 4.03-.58L12 3.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Hero() {
  const { t } = useI18n();
  return (
    <section className="relative isolate overflow-hidden bg-linear-to-br from-[#f6fbff] via-white to-[#e7f4ff]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-linear-to-b from-white/80 via-white/35 to-transparent" />
      <div className="pointer-events-none absolute left-[6%] top-28 h-56 w-56 rounded-full bg-[color:var(--cyan)]/18 blur-[90px]" />
      <div className="pointer-events-none absolute right-[10%] top-24 h-72 w-72 rounded-full bg-[color:var(--blue)]/16 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-8 left-1/3 h-40 w-40 rounded-full bg-white/70 blur-[90px]" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-4.5rem)] w-full max-w-[1400px] items-center px-6 py-16 md:px-16 md:py-20 xl:px-[120px]">
        <div className="grid w-full items-center gap-14 lg:grid-cols-[45%_55%] lg:gap-8">
          <div className="mx-auto flex w-full max-w-[34rem] flex-col items-center text-center lg:mx-0 lg:max-w-[36rem] lg:items-start lg:text-left">
            <span className="section-kicker">{t("Book. Confirm. Bubbleit arrives.")}</span>
            <h1
              className="mt-6 max-w-[10ch] font-bold tracking-[-0.06em] text-[color:var(--foreground)]"
              style={{ fontSize: "clamp(3rem, 6vw, 4.5rem)", lineHeight: 0.95 }}
            >
              {t("Mobile Car Wash,")}
              <span className="block text-[color:var(--blue)]">{t("Booked in Minutes")}</span>
            </h1>
            <p className="mt-6 max-w-[34.375rem] text-base leading-8 text-[color:var(--muted-foreground)] sm:text-lg">
              {t("Bubbleit lets you book a professional car wash from your phone. Choose your service, pick your time, confirm your location, and we'll come to you.")}
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <AppButton href="/book" className="sm:min-w-[10.5rem]">
                {t("Book Now")}
              </AppButton>
              <AppButton href="/memberships" variant="secondary" className="sm:min-w-[10.5rem]">
                {t("Memberships")}
              </AppButton>
            </div>
          </div>

          <div className="relative mx-auto flex w-full justify-center lg:justify-end">
            <div className="pointer-events-none absolute left-1/2 top-[18%] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-white/45 blur-[130px]" />
            <div className="pointer-events-none absolute left-1/2 top-[20%] h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[color:var(--cyan)]/14 blur-[110px]" />

            <div className="relative translate-y-2 rotate-[4deg] rounded-[3.5rem] bg-[#0f1225] p-[10px] shadow-[0_55px_120px_rgba(20,137,222,0.24),0_25px_60px_rgba(17,24,39,0.26)] ring-1 ring-black/6 transition duration-300 ease-out">
              <div className="absolute left-1/2 top-3 z-20 h-7 w-32 -translate-x-1/2 rounded-full bg-black shadow-[inset_0_-1px_1px_rgba(255,255,255,0.08)]" />

              <div
                className="relative h-[42rem] w-[20.5rem] overflow-hidden rounded-[3rem] bg-linear-to-b from-[#edf6ff] via-[#f7fbff] to-[#e8f4ff]"
                style={{
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
                }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-linear-to-b from-[color:var(--blue)]/10 via-white/0 to-transparent" />
                <div className="pointer-events-none absolute inset-x-10 top-32 h-40 rounded-full bg-[color:var(--cyan)]/10 blur-3xl" />

                <div className="relative z-10 flex h-full flex-col px-5 pb-5 pt-4">
                  <div className="flex items-center justify-between px-2 text-[0.8rem] font-semibold tracking-[-0.01em] text-[#101828]">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5 text-[#101828]">
                      <span className="flex items-end gap-px">
                        <span className="h-2 w-[3px] rounded-full bg-current opacity-60" />
                        <span className="h-2.5 w-[3px] rounded-full bg-current opacity-75" />
                        <span className="h-3 w-[3px] rounded-full bg-current opacity-90" />
                        <span className="h-3.5 w-[3px] rounded-full bg-current" />
                      </span>
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true" fill="none">
                        <path
                          d="M3.3 7.9a9.2 9.2 0 0 1 13.4 0"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M6.1 10.5a5.4 5.4 0 0 1 7.8 0"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 13.2a1.7 1.7 0 0 1 2 0"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="inline-flex h-4 w-6 rounded-[6px] border border-current/75 p-[1px]">
                        <span className="h-full w-[72%] rounded-[4px] bg-current" />
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between">
                    <div className="rounded-full bg-white/72 px-3 py-1.5 text-[0.7rem] font-semibold tracking-[0.14em] text-[color:var(--blue)] shadow-[0_10px_24px_rgba(20,137,222,0.08)] backdrop-blur-md">
                      {t("LIVE BOOKING")}
                    </div>
                    <div className="rounded-full bg-white/72 px-3 py-1.5 text-[0.75rem] font-medium text-[#3a5177] backdrop-blur-md">
                      Bubbleit
                    </div>
                  </div>

                  <div className="mt-5 rounded-[2rem] border border-white/70 bg-white/72 p-3 shadow-[0_22px_45px_rgba(20,137,222,0.12)] backdrop-blur-xl">
                    <div className="rounded-[1.6rem] bg-linear-to-br from-[color:var(--navy)] to-[color:var(--deep-blue)] p-4 text-white">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white/72">
                            {t("Today, 3:30 PM")}
                          </p>
                          <p className="mt-2 text-[1.75rem] font-semibold tracking-[-0.04em]">
                            {t("Full Car Wash")}
                          </p>
                        </div>
                        <div className="rounded-full bg-white/16 px-3 py-1.5 text-[0.78rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                          {t("Confirmed")}
                        </div>
                      </div>

                      <div className="mt-5 rounded-[1.6rem] border border-white/12 bg-white/10 p-3 backdrop-blur-md">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-full bg-white/18 p-2">
                            <PhoneActionIcon icon="pin" />
                          </div>
                          <div>
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/64">
                              {t("Location")}
                            </p>
                            <p className="mt-1 text-[0.88rem] leading-6 text-white/92">
                              {t("Your address is pinned and ready for arrival.")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-[1.5rem] bg-[#f6fbff] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--blue)]">
                          {t("Service")}
                        </p>
                        <p className="mt-2 text-[0.92rem] font-semibold text-[color:var(--foreground)]">
                          {t("Exterior + Interior")}
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] bg-[#f6fbff] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--blue)]">
                          {t("Payment")}
                        </p>
                        <p className="mt-2 text-[0.92rem] font-semibold text-[color:var(--foreground)]">
                          {t("Secure checkout")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[2rem] border border-white/70 bg-white/65 p-2.5 shadow-[0_18px_40px_rgba(20,137,222,0.1)] backdrop-blur-xl">
                    <div className="grid grid-cols-3 gap-2">
                      {phoneActions.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="rounded-[1.5rem] bg-white px-3 py-3 text-center shadow-[0_10px_22px_rgba(20,137,222,0.08)] transition hover:-translate-y-0.5"
                        >
                          <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--cyan)]/14 text-[color:var(--deep-blue)]">
                            <PhoneActionIcon icon={item.icon} />
                          </span>
                          <span className="mt-2 block text-[0.74rem] font-semibold text-[color:var(--foreground)]">
                            {t(item.label)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto px-16 pb-1 pt-5">
                    <div className="h-1.5 rounded-full bg-[#101828]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
