 "use client";

import { AppButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const qrPattern = [0, 1, 3, 5, 6, 10, 12, 14, 18, 19, 21, 22, 24];

function AppleStoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.15rem] w-[1.15rem] fill-current"
      aria-hidden="true"
    >
      <path d="M15.46 12.3c.02 2.18 1.9 2.9 1.92 2.91-.02.05-.3 1.03-.98 2.04-.59.87-1.2 1.73-2.17 1.74-.95.02-1.25-.56-2.33-.56-1.08 0-1.42.54-2.31.58-.93.03-1.64-.94-2.23-1.8-1.2-1.74-2.11-4.92-.88-7.05.61-1.06 1.72-1.73 2.92-1.75.91-.02 1.77.61 2.33.61.56 0 1.62-.75 2.73-.64.47.02 1.77.19 2.61 1.42-.07.05-1.56.91-1.53 2.5Zm-1.95-5.57c.49-.59.82-1.41.73-2.23-.7.03-1.55.47-2.06 1.06-.45.52-.84 1.35-.73 2.15.78.06 1.57-.4 2.06-.98Z" />
    </svg>
  );
}

function GooglePlayIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.15rem] w-[1.15rem]"
      aria-hidden="true"
    >
      <path
        d="M3.88 2.76c-.24.25-.38.63-.38 1.12v16.24c0 .49.14.87.38 1.12l.06.06 9.1-9.09v-.42L3.94 2.7l-.06.06Z"
        fill="#00CCFF"
      />
      <path
        d="m16.07 15.24-3.03-3.03v-.42l3.03-3.03.07.04 3.6 2.04c1.03.58 1.03 1.52 0 2.1l-3.6 2.04-.07.26Z"
        fill="#FFD23F"
      />
      <path
        d="M16.14 14.98 13.04 11.88 3.88 21.03c.38.39 1 .44 1.71.05l10.55-5.99Z"
        fill="#1489DE"
      />
      <path
        d="M16.14 9.02 5.59 3.03c-.71-.4-1.33-.34-1.71.05l9.16 9.13 3.1-3.19Z"
        fill="#6ED15E"
      />
    </svg>
  );
}

function StoreBadge({
  label,
  platform,
}: {
  label: string;
  platform: string;
}) {
  return (
    <span
      aria-label={`Bubbleit on ${label} — coming soon`}
      className="relative inline-flex min-h-14 cursor-default items-center gap-3 rounded-[22px] border border-white/14 bg-[#11152f]/55 px-4 py-3 text-left text-white/75 shadow-[0_14px_30px_rgba(12,18,44,0.22)] backdrop-blur-md"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 opacity-70">
        {platform === "apple" ? (
          <AppleStoreIcon />
        ) : (
          <GooglePlayIcon />
        )}
      </span>
      <span>
        <span className="block text-[0.68rem] font-medium uppercase tracking-[0.18em] text-[color:var(--cyan)]">
          Coming soon
        </span>
        <span className="mt-0.5 block text-sm font-semibold">{label}</span>
      </span>
    </span>
  );
}

export function AppCTA() {
  const { t } = useI18n();

  return (
    <section id="download" className="py-20">
      <div className="mx-auto w-full max-w-[1400px] px-6 md:px-16 xl:px-[72px]">
        <div className="relative overflow-hidden rounded-[40px] bg-linear-to-br from-[#262262] via-[#2b2d7a] to-[#1489de] px-6 py-14 text-white shadow-[0_36px_100px_rgba(25,40,108,0.28)] md:px-[72px] md:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_82%_20%,rgba(0,204,255,0.18),transparent_24%),radial-gradient(circle_at_70%_78%,rgba(255,255,255,0.12),transparent_22%)]" />
          <div className="pointer-events-none absolute left-[10%] top-[14%] h-32 w-32 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute right-[14%] top-[32%] h-44 w-44 rounded-full bg-[color:var(--cyan)]/14 blur-[100px]" />

          <div className="relative grid items-center gap-14 lg:grid-cols-[65%_35%] lg:gap-10">
            <div className="mx-auto w-full max-w-[42rem] text-center lg:mx-0 lg:text-left">
              <span className="inline-flex rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-medium text-white/88 backdrop-blur-md">
                {t("Book on the web today — app coming soon")}
              </span>

              <h2
                className="mt-5 max-w-[12ch] font-bold tracking-[-0.06em] text-white"
                style={{ fontSize: "clamp(3rem, 5vw, 4.5rem)", lineHeight: 0.95 }}
              >
                {t("Ready to book your next car wash?")}
              </h2>

              <p className="mt-5 max-w-[37.5rem] text-base leading-8 text-white/78 sm:text-lg">
                {t("Book your next wash on the web in minutes — pick your service, time, and location, manage your bookings from any device, and pay later when our team confirms or arrives. The Bubbleit mobile app is on its way.")}
              </p>

              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:items-start">
                <AppButton
                  href="/book"
                  className="min-w-[12rem] bg-white text-[color:var(--navy)] hover:bg-[#eaf8ff]"
                >
                  {t("Book a wash now")}
                </AppButton>
                <AppButton
                  href="/account"
                  variant="secondary"
                  className="min-w-[12rem] border-white/20 bg-white/10 text-white backdrop-blur-md hover:border-white/40 hover:bg-white/14 hover:text-white"
                >
                  {t("My bookings")}
                </AppButton>
              </div>

              <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap lg:items-start">
                <StoreBadge label={t("App Store")} platform="apple" />
                <StoreBadge label={t("Google Play")} platform="play" />
              </div>
            </div>

            <div className="relative mx-auto flex w-full max-w-[26rem] justify-center lg:justify-end">
              <div className="pointer-events-none absolute inset-x-8 top-14 h-32 rounded-full bg-white/10 blur-3xl" />
              <div className="pointer-events-none absolute left-1/2 top-16 h-[31rem] w-[17rem] -translate-x-1/2 rounded-[5rem] bg-white/16 blur-[120px]" />

              <div className="relative rotate-[4deg] rounded-[3.4rem] bg-[#0f1225] p-[10px] shadow-[0_55px_120px_rgba(10,19,61,0.34),0_24px_55px_rgba(20,137,222,0.18)] ring-1 ring-white/10">
                <div className="absolute left-1/2 top-3 z-20 h-7 w-32 -translate-x-1/2 rounded-full bg-black shadow-[inset_0_-1px_1px_rgba(255,255,255,0.08)]" />

                <div className="relative h-[39rem] w-[19rem] overflow-hidden rounded-[3rem] bg-linear-to-b from-[#eef7ff] via-[#f8fbff] to-[#e8f3ff]">
                  <div className="pointer-events-none absolute inset-x-8 top-24 h-36 rounded-full bg-[color:var(--cyan)]/10 blur-3xl" />

                  <div
                    className="relative z-10 flex h-full flex-col px-5 pb-5 pt-4"
                    style={{
                      fontFamily:
                        "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif",
                    }}
                  >
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

                    <div className="mt-7 rounded-[2rem] border border-white/70 bg-white/72 p-3 shadow-[0_22px_45px_rgba(20,137,222,0.12)] backdrop-blur-xl">
                      <div className="rounded-[1.7rem] bg-linear-to-br from-[color:var(--navy)] to-[color:var(--deep-blue)] p-4 text-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white/70">
                              Today, 3:30 PM
                            </p>
                            <p className="mt-2 text-[1.65rem] font-semibold tracking-[-0.04em]">
                              Full Car Wash
                            </p>
                          </div>
                          <div className="rounded-full bg-white/16 px-3 py-1.5 text-[0.78rem] font-semibold text-white">
                            Confirmed
                          </div>
                        </div>

                        <div className="mt-5 rounded-[1.5rem] border border-white/12 bg-white/10 p-3 backdrop-blur-md">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white/64">
                            Location
                          </p>
                          <p className="mt-1 text-[0.9rem] leading-6 text-white/92">
                            Your address is pinned and ready for arrival.
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div className="rounded-[1.45rem] bg-[#f6fbff] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--blue)]">
                            Service
                          </p>
                          <p className="mt-2 text-[0.92rem] font-semibold text-[color:var(--foreground)]">
                            Exterior + Interior
                          </p>
                        </div>
                        <div className="rounded-[1.45rem] bg-[#f6fbff] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[color:var(--blue)]">
                            Payment
                          </p>
                          <p className="mt-2 text-[0.92rem] font-semibold text-[color:var(--foreground)]">
                            Secure checkout
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-[1.9rem] border border-white/70 bg-white/65 p-2.5 shadow-[0_18px_40px_rgba(20,137,222,0.1)] backdrop-blur-xl">
                      {["Service", "Time", "Track"].map((item) => (
                        <div
                          key={item}
                          className="rounded-[1.45rem] bg-white px-3 py-3 text-center shadow-[0_10px_22px_rgba(20,137,222,0.08)]"
                        >
                          <div className="mx-auto h-9 w-9 rounded-full bg-[color:var(--cyan)]/14" />
                          <span className="mt-2 block text-[0.74rem] font-semibold text-[color:var(--foreground)]">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto px-16 pb-1 pt-5">
                      <div className="h-1.5 rounded-full bg-[#101828]" />
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -right-5 z-30 w-[11.5rem] rounded-[28px] border border-white/20 bg-white/86 p-4 text-[color:var(--foreground)] shadow-[0_24px_50px_rgba(12,18,44,0.24)] backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[color:var(--cyan)]/16 text-[color:var(--deep-blue)]">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
                        <path
                          d="M6.5 5.5h4v4h-4Zm7 0h4v4h-4Zm-7 7h4v4h-4Zm7 0h4v4h-4Z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--blue)]">
                        App coming soon
                      </p>
                    </div>
                  </div>

                  <div
                    aria-label="QR code placeholder"
                    className="grid grid-cols-5 gap-1 rounded-[20px] bg-[#f2f8ff] p-3"
                  >
                    {Array.from({ length: 25 }).map((_, index) => (
                      <span
                        key={index}
                        className={`h-3.5 w-3.5 rounded-[4px] ${
                          qrPattern.includes(index)
                            ? "bg-[color:var(--navy)]"
                            : "bg-[color:var(--cyan)]/30"
                        }`}
                      />
                    ))}
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
