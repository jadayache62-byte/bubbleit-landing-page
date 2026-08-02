import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LANG_COOKIE, type Lang } from "@/lib/locale";

type MetadataKey =
  | "root"
  | "book"
  | "store"
  | "storeCheckout"
  | "accountDeletion"
  | "privacy"
  | "terms"
  | "review";

type LocalizedMetadataCopy = {
  title: string;
  description: string;
  openGraphDescription?: string;
  twitterDescription?: string;
  keywords?: string[];
};

const COPY: Record<MetadataKey, Record<Lang, LocalizedMetadataCopy>> = {
  root: {
    en: {
      title: "Bubbleit | Mobile Car Wash Booking App",
      description:
        "Book a professional mobile car wash in minutes with Bubbleit. Choose your service, set your time, and let the team come to you.",
      openGraphDescription:
        "A clean, fast way to book mobile car wash services from your phone.",
      twitterDescription:
        "Book a professional mobile car wash in minutes with Bubbleit.",
      keywords: [
        "Bubbleit",
        "mobile car wash",
        "car wash booking app",
        "car cleaning service",
        "Qatar car wash app",
      ],
    },
    ar: {
      title: "ببلت | تطبيق حجز غسيل السيارات المتنقل",
      description:
        "احجز غسيل سيارات متنقلاً واحترافياً خلال دقائق مع ببلت. اختر خدمتك وحدد موعدك وسيصل الفريق إليك.",
      openGraphDescription:
        "طريقة سريعة وسهلة لحجز خدمات غسيل السيارات المتنقل من هاتفك.",
      twitterDescription:
        "احجز غسيل سيارات متنقلاً واحترافياً خلال دقائق مع ببلت.",
      keywords: [
        "ببلت",
        "غسيل سيارات متنقل",
        "حجز غسيل سيارات",
        "تنظيف السيارات",
        "غسيل سيارات قطر",
      ],
    },
  },
  book: {
    en: {
      title: "Book a Wash | Bubbleit",
      description:
        "Book a professional mobile car wash in minutes. Membership customers choose a covered car and time; other customers choose their service.",
    },
    ar: {
      title: "احجز غسلة | ببلت",
      description:
        "احجز غسيل سيارات متنقلاً واحترافياً خلال دقائق. يختار عملاء الاشتراكات المركبة المشمولة والوقت، ويختار بقية العملاء خدمتهم.",
    },
  },
  store: {
    en: {
      title: "Store | Bubbleit",
      description:
        "Shop Bubbleit car care products, microfiber towels, brushes, gloves, and accessories.",
    },
    ar: {
      title: "المتجر | ببلت",
      description:
        "تسوّق منتجات العناية بالسيارة والمناشف والفرش والقفازات والإكسسوارات من ببلت.",
    },
  },
  storeCheckout: {
    en: {
      title: "Store Checkout | Bubbleit",
      description: "Complete your Bubbleit store product order.",
    },
    ar: {
      title: "إتمام طلب المتجر | ببلت",
      description: "أكمل طلب منتجاتك من متجر ببلت.",
    },
  },
  accountDeletion: {
    en: {
      title: "Account Data & Deletion | Bubbleit",
      description:
        "Download your BubbleIt customer data or permanently delete your BubbleIt account and associated personal data.",
    },
    ar: {
      title: "بيانات الحساب وحذفه | ببلت",
      description:
        "نزّل بياناتك كعميل ببلت أو احذف حساب ببلت والبيانات الشخصية المرتبطة به نهائياً.",
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy | Bubbleit",
      description:
        "How Bubble It Cars Washing LLC collects, uses, protects, retains, exports, and deletes personal data.",
    },
    ar: {
      title: "سياسة الخصوصية | ببلت",
      description:
        "كيفية جمع شركة ببلت لغسيل السيارات ذ.م.م للبيانات الشخصية واستخدامها وحمايتها والاحتفاظ بها وتصديرها وحذفها.",
    },
  },
  terms: {
    en: {
      title: "Terms & Conditions | Bubbleit",
      description:
        "Terms governing BubbleIt bookings, memberships, store purchases, payments, cancellations, and customer accounts in Qatar.",
    },
    ar: {
      title: "الشروط والأحكام | ببلت",
      description:
        "الشروط المنظمة لحجوزات ببلت والاشتراكات ومشتريات المتجر والمدفوعات والإلغاءات وحسابات العملاء في قطر.",
    },
  },
  review: {
    en: {
      title: "Review your wash | Bubbleit",
      description: "Share feedback about your completed Bubbleit service.",
    },
    ar: {
      title: "قيّم غسلتك | ببلت",
      description: "شارك ملاحظاتك عن خدمة ببلت المكتملة.",
    },
  },
};

const PAGE_SETTINGS: Partial<
  Record<
    MetadataKey,
    {
      canonical?: string;
      openGraphType?: "article" | "website";
      robots?: Metadata["robots"];
    }
  >
> = {
  accountDeletion: {
    canonical: "/account-deletion",
    openGraphType: "website",
  },
  privacy: { canonical: "/privacy", openGraphType: "article" },
  terms: { canonical: "/terms", openGraphType: "article" },
  review: { robots: { index: false, follow: false, nocache: true } },
};

export async function localizedMetadata(key: MetadataKey): Promise<Metadata> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  const lang: Lang = saved === "ar" ? "ar" : "en";
  const copy = COPY[key][lang];
  const settings = PAGE_SETTINGS[key];

  return {
    title: copy.title,
    description: copy.description,
    ...(key === "root" ? { metadataBase: new URL("https://bubbleit.qa") } : {}),
    ...(settings?.canonical
      ? { alternates: { canonical: settings.canonical } }
      : {}),
    openGraph: {
      title: copy.title,
      description: copy.openGraphDescription ?? copy.description,
      ...(settings?.canonical ? { url: settings.canonical } : {}),
      type: settings?.openGraphType ?? "website",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.twitterDescription ?? copy.description,
    },
    ...(copy.keywords ? { keywords: copy.keywords } : {}),
    ...(settings?.robots ? { robots: settings.robots } : {}),
  };
}
