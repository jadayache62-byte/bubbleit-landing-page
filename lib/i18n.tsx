"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "en" | "ar";

const LANG_KEY = "bubbleit.lang";

// UI strings. Keys are English; Arabic provided per key.
const AR: Record<string, string> = {
  // Navbar / footer
  "Services": "الخدمات",
  "How It Works": "كيف تعمل",
  "Benefits": "المميزات",
  "Download": "التطبيق",
  "Memberships": "الاشتراكات",
  "My Bookings": "حجوزاتي",
  "Book Now": "احجز الآن",
  "Book": "الحجز",
  "Book a Wash": "احجز غسلة",
  "Contact": "تواصل معنا",
  "Legal": "قانوني",
  "Privacy Policy": "سياسة الخصوصية",
  "Terms & Conditions": "الشروط والأحكام",
  "WhatsApp": "واتساب",
  "All rights reserved.": "جميع الحقوق محفوظة.",
  "Bubbleit makes mobile car wash booking simple, fast, and convenient.":
    "ببلت تجعل حجز غسيل السيارات المتنقل سهلاً وسريعاً ومريحاً.",

  // Hero / sections
  "Book. Confirm. Bubbleit arrives.": "احجز. أكّد. ببلت تصل إليك.",
  "Mobile Car Wash,": "غسيل سيارات متنقل،",
  "Booked in Minutes": "احجزه في دقائق",
  "Bubbleit lets you book a professional car wash from your phone. Choose your service, pick your time, confirm your location, and we'll come to you.":
    "ببلت تتيح لك حجز غسيل احترافي لسيارتك من هاتفك. اختر الخدمة والوقت وأكّد موقعك، ونحن نصل إليك.",
  "How it Works": "كيف تعمل",
  "Car Wash Services at Your Doorstep": "خدمات غسيل السيارات حتى باب منزلك",
  "Choose the service you need and book directly from the app.":
    "اختر الخدمة التي تحتاجها واحجز مباشرة.",
  "Salon": "صالون",
  "SUV": "فور ويل",
  "Book →": "احجز ←",

  // Booking wizard
  "Book a Wash | Bubbleit": "احجز غسلة | ببلت",
  "Your car wash, your schedule": "غسلتك على جدولك",
  "Location": "الموقع",
  "Schedule": "الموعد",
  "Payment": "الدفع",
  "Confirm": "التأكيد",
  "What are we washing?": "ماذا نغسل؟",
  "Pick what you'd like us to wash.": "اختر ما تريد غسله.",
  "Car": "سيارة",
  "Caravan": "كرفان",
  "Jet Ski": "جت سكي",
  "Jet Boat": "جت بوت",
  "Pick a service for each car — add as many cars as you like.":
    "اختر خدمة لكل سيارة — أضف أي عدد من السيارات.",
  "Pick a service.": "اختر الخدمة.",
  "Vehicle type": "نوع السيارة",
  "Salon / Sedan": "صالون / سيدان",
  "SUV / 4-Wheel": "فور ويل / دفع رباعي",
  "Add-ons": "إضافات",
  "Make": "الشركة",
  "Model": "الموديل",
  "Color": "اللون",
  "Plate no.": "رقم اللوحة",
  "ID / Registration": "الرقم / التسجيل",
  "Remove": "حذف",
  "+ Add another car": "+ أضف سيارة أخرى",
  "Where should we come?": "أين نأتي إليك؟",
  "Our wash bus comes to you — home, office, anywhere.":
    "باص الغسيل يصل إليك — المنزل أو المكتب أو أي مكان.",
  "Use my exact location": "استخدم موقعي الحالي",
  "Locating…": "جاري تحديد الموقع…",
  "Location pinned": "تم تثبيت الموقع",
  "Couldn't get your location — check browser permissions, or type the area below.":
    "تعذّر تحديد موقعك — تحقق من أذونات المتصفح أو اكتب المنطقة أدناه.",
  "Area / neighborhood": "المنطقة / الحي",
  "e.g. West Bay, The Pearl…": "مثال: الخليج الغربي، اللؤلؤة…",
  "Building, street, parking details": "تفاصيل المبنى والشارع والمواقف",
  "Tower name, gate number, parking level…": "اسم البرج، رقم البوابة، طابق المواقف…",
  "Pick your time": "اختر وقتك",
  "Choose a day and an available slot.": "اختر اليوم والموعد المتاح.",
  "Checking availability…": "جاري التحقق من المواعيد…",
  "Today": "اليوم",
  "Tomorrow": "غداً",
  "How would you like to pay?": "كيف تود الدفع؟",
  "Pay securely online, or in person when we arrive.":
    "احجز الآن وادفع لاحقاً عند التأكيد أو عند وصولنا.",
  "Pay on site": "الدفع عند الوصول",
  "Cash or card when the team arrives.": "نقداً أو ببطاقة عند وصول الفريق.",
  "Pay online now": "الدفع أونلاين غير متاح حالياً",
  "Secure card payment at confirmation.": "حالياً نؤكد الحجز أولاً ثم يتم الدفع لاحقاً.",
  "Notes for the team (optional)": "ملاحظات للفريق (اختياري)",
  "Gate code, preferred parking spot…": "رمز البوابة، مكان الوقوف المفضل…",
  "Verify your phone": "تأكيد رقم هاتفك",
  "We'll text you a 6-digit code to confirm your booking.":
    "سنرسل لك رمزاً من 6 أرقام لتأكيد حجزك.",
  "Review & confirm": "المراجعة والتأكيد",
  "Everything look right?": "هل كل شيء صحيح؟",
  "Your name": "اسمك",
  "Full name": "الاسم الكامل",
  "Phone number": "رقم الهاتف",
  "Send code": "أرسل الرمز",
  "Verification code": "رمز التحقق",
  "Resend code": "إعادة إرسال الرمز",
  "Change phone number": "تغيير رقم الهاتف",
  "Booking summary": "ملخص الحجز",
  "When": "الموعد",
  "Total": "المجموع",
  "Back": "رجوع",
  "Continue": "متابعة",
  "Confirming…": "جاري التأكيد…",
  "Confirm & Pay": "تأكيد ودفع",
  "Confirm Booking": "تأكيد الحجز",
  "Booking confirmed!": "تم تأكيد الحجز!",
  "Reference": "رقم المرجع",
  "View my bookings": "عرض حجوزاتي",
  "Back to home": "العودة للرئيسية",
  "We couldn't load our services": "تعذّر تحميل الخدمات",
  "Please refresh the page or try again shortly.": "يرجى تحديث الصفحة أو المحاولة لاحقاً.",
  "That slot was just taken. Please pick another time.":
    "تم حجز هذا الموعد للتو. يرجى اختيار وقت آخر.",
  "Something went wrong. Please try again.": "حدث خطأ ما. يرجى المحاولة مجدداً.",

  // Account
  "My Account": "حسابي",
  "Sign in with your phone": "سجّل الدخول برقم هاتفك",
  "We'll text you a 6-digit code — no passwords needed.":
    "سنرسل لك رمزاً من 6 أرقام — لا حاجة لكلمة مرور.",
  "Sign in": "تسجيل الدخول",
  "Sending…": "جاري الإرسال…",
  "Verifying…": "جاري التحقق…",
  "Log out": "تسجيل الخروج",
  "Loading your bookings…": "جاري تحميل حجوزاتك…",
  "No bookings yet": "لا حجوزات بعد",
  "Your first sparkling-clean car is a few taps away.":
    "سيارتك النظيفة الأولى على بعد خطوات.",
  "Book your first wash": "احجز غسلتك الأولى",
  "Cancel": "إلغاء",
  "Cancel this booking?": "إلغاء هذا الحجز؟",
  "Hi,": "أهلاً،",

  // Memberships
  "Wash Memberships": "اشتراكات الغسيل",
  "Prepaid wash bundles — better prices, one tap to book.":
    "باقات غسيل مدفوعة مسبقاً — أسعار أفضل وحجز بضغطة واحدة.",
  "Full Wash": "غسيل داخلي وخارجي",
  "Exterior Only": "غسيل خارجي فقط",
  "Midnight (12am–5am)": "ميدنايت (١٢ ليلاً – ٥ فجراً)",
  "washes": "غسلات",
  "Valid 30 days": "صالح لمدة 30 يوماً",
  "Buy": "اشترك",
  "Buying…": "جاري الاشتراك…",
  "Membership requested!": "تم طلب الاشتراك!",
  "We'll activate it as soon as payment is confirmed — our team will contact you.":
    "سيتم تفعيله فور تأكيد الدفع — سيتواصل معك فريقنا.",
  "My Memberships": "اشتراكاتي",
  "washes left": "غسلات متبقية",
  "Awaiting activation": "بانتظار التفعيل",
  "Active": "فعّال",
  "Expired": "منتهي",
  "Used up": "مستهلك",
  "Cancelled": "ملغي",
  "Expires": "ينتهي",
  "Book with membership": "احجز باشتراكك",
  "Sign in to buy a membership.": "سجّل الدخول لشراء اشتراك.",
  "Pick your vehicle": "اختر سيارتك",
  "Add a vehicle": "أضف سيارة",
  "Free with membership": "مجاناً مع الاشتراك",
  "Exterior wash only, between 12am and 5am.": "غسيل خارجي فقط، من ١٢ ليلاً حتى ٥ فجراً.",

  // Password auth
  "Enter your phone number to sign in or create your account.":
    "أدخل رقم هاتفك لتسجيل الدخول أو إنشاء حساب.",
  "Welcome back!": "أهلاً بعودتك!",
  "Password": "كلمة المرور",
  "Forgot password?": "نسيت كلمة المرور؟",
  "New number — let's set up your account.": "رقم جديد — لننشئ حسابك.",
  "Add a password for your account": "أضف كلمة مرور لحسابك",
  "Verify on WhatsApp": "تحقق عبر واتساب",
  "Password must be at least 6 characters.": "كلمة المرور 6 أحرف على الأقل.",
  "We sent a 6-digit code to your WhatsApp — enter it to finish.":
    "أرسلنا رمزاً من 6 أرقام إلى واتساب — أدخله للإكمال.",
  "Create account": "إنشاء الحساب",
  "We sent a 6-digit code to your WhatsApp. Enter it and choose a new password.":
    "أرسلنا رمزاً من 6 أرقام إلى واتساب. أدخله واختر كلمة مرور جديدة.",
  "New password": "كلمة مرور جديدة",
  "Sign in to confirm your booking.": "سجّل الدخول لتأكيد حجزك.",
  "Redirecting to secure payment…": "جاري التحويل إلى الدفع الآمن…",
  "Payment received — your membership is active!": "تم الدفع — اشتراكك فعّال الآن!",
  "Book on the web today — app coming soon": "احجز من الموقع اليوم — التطبيق قريباً",
  "Ready to book your next car wash?": "جاهز تحجز غسيلتك القادمة؟",
  "Book your next wash on the web in minutes — pick your service, time, and location, manage your bookings from any device, and pay later when our team confirms or arrives. The Bubbleit mobile app is on its way.":
    "احجز غسيلتك القادمة من الموقع خلال دقائق — اختر الخدمة والوقت والموقع، وأدر حجوزاتك من أي جهاز، وادفع لاحقاً عند تأكيد الحجز أو عند وصول فريقنا. تطبيق ببلت في الطريق.",
  "Book a wash now": "احجز غسلة الآن",
  "My bookings": "حجوزاتي",
  "App Store": "آب ستور",
  "Google Play": "جوجل بلاي",
};

type I18n = {
  lang: Lang;
  t: (key: string) => string;
  setLang: (lang: Lang) => void;
};

const I18nContext = createContext<I18n>({
  lang: "en",
  t: (k) => k,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === "ar" || stored === "en") queueMicrotask(() => setLangState(stored));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(LANG_KEY, next);
  }, []);

  const t = useCallback(
    (key: string) => (lang === "ar" ? (AR[key] ?? key) : key),
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, t, setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Pick the localized field from an API object ({name, name_ar}, …). */
export function localized(lang: Lang, en: string, ar?: string | null) {
  return lang === "ar" && ar ? ar : en;
}
