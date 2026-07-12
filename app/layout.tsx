import type { Metadata } from "next";
import { DM_Sans, IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

export const metadata: Metadata = {
  title: "Bubbleit | Mobile Car Wash Booking App",
  description:
    "Book a professional mobile car wash in minutes with Bubbleit. Choose your service, set your time, and let the team come to you.",
  metadataBase: new URL("https://bubbleit.qa"),
  openGraph: {
    title: "Bubbleit | Mobile Car Wash Booking App",
    description:
      "A clean, fast way to book mobile car wash services from your phone.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bubbleit | Mobile Car Wash Booking App",
    description:
      "Book a professional mobile car wash in minutes with Bubbleit.",
  },
  keywords: [
    "Bubbleit",
    "mobile car wash",
    "car wash booking app",
    "car cleaning service",
    "Qatar car wash app",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${headingFont.variable} ${bodyFont.variable} ${arabicFont.variable}`}
    >
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
