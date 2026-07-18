"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { LANG_COOKIE, LANG_STORAGE_KEY, type Lang } from "@/lib/locale";

export type { Lang } from "@/lib/locale";

// UI strings. Keys are English; Arabic provided per key.
const AR: Record<string, string> = {
  // Navbar / footer
  "Services": "الخدمات",
  "Store": "المتجر",
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
  "Account deletion": "حذف الحساب",
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
  "Car Wash Services at Your Doorstep": "خدمات غسيل السيارات حتى باب منزلك",
  "Choose the service you need and book directly from the app.":
    "اختر الخدمة التي تحتاجها واحجز مباشرة.",
  "Salon": "صالون",
  "SUV": "فور ويل",
  "Book →": "احجز ←",
  // Home service cards
  "Standard Bubble": "ستاندرد بابل",
  "Steam Bubble": "ستيم بابل",
  "Deep Bubble": "ديب بابل",
  "Interior Detailing": "تلميع داخلي",
  "Exterior Detailing": "تلميع خارجي",
  "Bubbleit Detailing": "ببلت ديتيلنق",
  "Exterior wash & interior cleaning.": "غسيل خارجي وتنظيف داخلي.",
  "Exterior wash & interior cleaning with steam.": "غسيل خارجي وتنظيف داخلي بالبخار.",
  "Exterior wash, engine wash, under-chassis & interior steam cleaning.":
    "غسيل خارجي وغسيل المحرك وأسفل الهيكل وتنظيف داخلي بالبخار.",
  "Full interior polish and deep detailing.": "تلميع داخلي كامل وتنظيف عميق.",
  "Full exterior polish and paint care.": "تلميع خارجي كامل والعناية بالطلاء.",
  "The complete package — interior & exterior polish.": "الباقة الكاملة — تلميع داخلي وخارجي.",

  // Booking wizard
  "Book a Wash | Bubbleit": "احجز غسلة | ببلت",
  "Your car wash, your schedule": "غسلتك على جدولك",
  "Location": "الموقع",
  "Schedule": "الموعد",
  "Payment": "الدفع",
  "Confirm": "التأكيد",
  "Pay & Confirm": "ادفع وأكّد",
  "Pay online and confirm your booking in one final step.":
    "ادفع أونلاين وأكّد حجزك في خطوة أخيرة واحدة.",
  "Secure card payment. We'll take you to checkout and confirm your booking after payment.":
    "دفع آمن بالبطاقة. سننقلك إلى صفحة الدفع ونؤكّد حجزك بعد الدفع.",
  "What are we washing?": "ماذا نغسل؟",
  "Pick what you'd like us to wash.": "اختر ما تريد غسله.",
  "Car": "سيارة",
  "Caravan": "كرفان",
  "Jet": "جت",
  "Jet Ski": "جت سكي",
  "Jet Boat": "جت بوت",
  "Popular": "الأكثر طلباً",
  "Pick a service for each car — add as many cars as you like.":
    "اختر خدمة لكل سيارة — أضف أي عدد من السيارات.",
  "Pick a service for each vehicle — add as many as you like.":
    "اختر خدمة لكل مركبة — أضف ما تشاء.",
  "Pick a service.": "اختر الخدمة.",
  "Vehicle type": "نوع المركبة",
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
  "+ Add vehicle": "+ أضف مركبة",
  "Where should we come?": "أين نأتي إليك؟",
  "Our wash bus comes to you — home, office, anywhere.":
    "باص الغسيل يصل إليك — المنزل أو المكتب أو أي مكان.",
  "Use my exact location": "استخدم موقعي الحالي",
  "Locating…": "جاري تحديد الموقع…",
  "Location pinned": "تم تثبيت الموقع",
  "Couldn't get your location — check browser permissions, or type the area below.":
    "تعذّر تحديد موقعك — تحقق من أذونات المتصفح أو اكتب المنطقة أدناه.",
  "Tap the map or drag the pin to set your exact spot — the driver navigates straight to it.":
    "اضغط على الخريطة أو حرّك الدبوس لتحديد موقعك بدقة — سيتوجّه السائق إليه مباشرة.",
  "Use membership": "استخدام الاشتراك",
  "your membership": "اشتراكك",
  "Membership": "اشتراك",
  "Covered by membership": "مغطّى بالاشتراك",
  "covered by membership": "مغطّى بالاشتراك",
  "Washes left after booking": "الغسلات المتبقية بعد الحجز",
  "not covered": "غير مشمول",
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
  "Secure online payment. You'll be redirected to complete it after confirming.":
    "دفع إلكتروني آمن. سيتم تحويلك لإتمام الدفع بعد التأكيد.",
  "Pay online (SkipCash)": "الدفع أونلاين (سكيب كاش)",
  "Secure card payment. We'll take you to the checkout after you confirm.":
    "دفع آمن بالبطاقة. سننقلك إلى صفحة الدفع بعد التأكيد.",
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
  "Subtotal": "المجموع الفرعي",
  "Discount": "الخصم",
  "Promo code": "رمز الخصم",
  "e.g. SUMMER20": "مثال: SUMMER20",
  "Apply": "تطبيق",
  "Checking…": "جاري التحقق…",
  "Code": "الرمز",
  "applied": "مطبّق",
  "you save": "توفّر",
  "saved": "وفّرت",
  "This code can't be applied.": "لا يمكن تطبيق هذا الرمز.",
  "Couldn't check that code.": "تعذّر التحقق من الرمز.",
  "Back": "رجوع",
  "Continue": "متابعة",
  "Confirming…": "جاري التأكيد…",
  "Confirm & Pay": "تأكيد ودفع",
  "Confirm Booking": "تأكيد الحجز",
  "Booking confirmed!": "تم تأكيد الحجز!",
  "Price confirmation required": "يلزم تأكيد السعر",
  "We couldn't verify the current price and coverage. Retry the quote before confirming.":
    "تعذّر التحقق من السعر الحالي وتغطية الاشتراك. أعد محاولة عرض السعر قبل التأكيد.",
  "Retry quote": "إعادة محاولة عرض السعر",
  "Authoritative quote required": "يلزم عرض سعر مؤكّد",
  "Choose membership coverage": "اختر تغطية الاشتراك",
  "Eligible washes are preselected. Choose each car you want the membership to cover.":
    "تم تحديد الغسلات المؤهلة مسبقاً. اختر كل سيارة تريد أن يغطيها الاشتراك.",
  "Selected washes are covered. Add-ons, products, and uncovered cars remain in the total.":
    "الغسلات المحددة مغطاة. تبقى الإضافات والمنتجات والسيارات غير المغطاة ضمن المجموع.",
  "Selected washes are covered by membership.": "الغسلات المحددة مغطاة بالاشتراك.",
  "No membership washes are selected. The full total will be paid online.":
    "لم يتم اختيار غسلات من الاشتراك. سيتم دفع المجموع كاملاً عبر الإنترنت.",
  "Your price or membership availability changed. Review a fresh quote before confirming.":
    "تغيّر السعر أو توفر الاشتراك. راجع عرض سعر جديداً قبل التأكيد.",
  "membership applied · remaining total": "تم تطبيق الاشتراك · المبلغ المتبقي",
  "Membership applied + online payment for remaining total":
    "تم تطبيق الاشتراك + دفع المبلغ المتبقي عبر الإنترنت",
  "Booking confirmed — membership covered": "تم تأكيد الحجز — مغطّى بالاشتراك",
  "Booking confirmed — payment received": "تم تأكيد الحجز — تم استلام الدفع",
  "Booking saved — payment pending": "تم حفظ الحجز — الدفع معلّق",
  "Your booking was saved once. Retry payment without creating another booking.":
    "تم حفظ حجزك مرة واحدة. أعد محاولة الدفع من دون إنشاء حجز آخر.",
  "Retry secure payment": "إعادة محاولة الدفع الآمن",
  "Retrying…": "جارٍ إعادة المحاولة…",
  "Payment is not ready yet. Your booking is saved once and has not been confirmed as paid.":
    "الدفع غير جاهز بعد. تم حفظ حجزك مرة واحدة ولم يتم تأكيده كمدفوع.",
  "Covered by your membership. No payment is required.":
    "مغطّى باشتراكك. لا يلزم دفع.",
  "Paid": "تم دفع",
  "online.": "إلكترونياً.",
  "A captured payment needs review. This booking is not being shown as paid or reinstated.":
    "تحتاج الدفعة المستلمة إلى مراجعة. لا يظهر هذا الحجز كمدفوع أو معاد التفعيل.",
  "Payment is still required. This saved booking is not confirmed as paid.":
    "لا يزال الدفع مطلوباً. هذا الحجز المحفوظ غير مؤكّد كمدفوع.",
  "Payment closed": "الدفع مغلق",
  "This payment is closed and cannot be retried.":
    "تم إغلاق هذه الدفعة ولا يمكن إعادة محاولتها.",
  "Reference": "رقم المرجع",
  "View my bookings": "عرض حجوزاتي",
  "Back to home": "العودة للرئيسية",
  "We couldn't load our services": "تعذّر تحميل الخدمات",
  "Please refresh the page or try again shortly.": "يرجى تحديث الصفحة أو المحاولة لاحقاً.",
  "That slot was just taken. Please pick another time.":
    "تم حجز هذا الموعد للتو. يرجى اختيار وقت آخر.",
  "One of your cars already has a booking at this time. Pick a different time for it.":
    "إحدى سياراتك لديها حجز بالفعل في هذا الوقت. يرجى اختيار وقت آخر لها.",
  "Something went wrong. Please try again.": "حدث خطأ ما. يرجى المحاولة مجدداً.",

  // Account
  "My Account": "حسابي",
  "Bookings": "الحجوزات",
  "My Cars": "سياراتي",
  "Loading your cars…": "جارٍ تحميل سياراتك…",
  "No cars saved yet": "لا توجد سيارات محفوظة بعد",
  "Cars you add during a booking are saved here by plate number.":
    "السيارات التي تضيفها أثناء الحجز تُحفظ هنا برقم اللوحة.",
  "Remove this car?": "إزالة هذه السيارة؟",
  "Your saved cars": "سياراتك المحفوظة",
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
  "Notifications": "الإشعارات",
  "Booking, payment, cancellation, refund, and appointment reminders appear here.":
    "تظهر هنا تحديثات الحجز والدفع والإلغاء والاسترداد وتذكيرات المواعيد.",
  "How delivery works": "آلية إرسال الإشعارات",
  "Browser push is optional. Important transactional WhatsApp or SMS remains the fallback when push cannot be delivered.":
    "إشعارات المتصفح اختيارية. تبقى رسائل واتساب أو الرسائل النصية المهمة هي البديل عند تعذر الإرسال الفوري.",
  "Browser notifications are blocked. Change your browser permission to enable them.":
    "إشعارات المتصفح محظورة. غيّر إذن المتصفح لتفعيلها.",
  "This browser does not support push notifications.": "هذا المتصفح لا يدعم الإشعارات الفورية.",
  "Enable browser notifications": "تفعيل إشعارات المتصفح",
  "Turn off browser notifications": "إيقاف إشعارات المتصفح",
  "Updating…": "جارٍ التحديث…",
  "Could not load notifications.": "تعذّر تحميل الإشعارات.",
  "Could not update notification settings.": "تعذّر تحديث إعدادات الإشعارات.",
  "This notification is no longer available.": "لم يعد هذا الإشعار متاحاً.",
  "Loading notifications…": "جارٍ تحميل الإشعارات…",
  "No notifications yet": "لا توجد إشعارات بعد",
  "Your transactional updates will appear here.": "ستظهر تحديثات معاملاتك هنا.",
  "Open": "فتح",

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
  "Payment under review": "الدفع قيد المراجعة",
  "Payment received after this membership closed. It was not reactivated, and our team is arranging the required refund.":
    "تم استلام الدفعة بعد إغلاق هذا الاشتراك. لم تتم إعادة تفعيله، ويعمل فريقنا على ترتيب الاسترداد المطلوب.",
  "Payment received after this booking closed. It was not reinstated, and our team is arranging the required refund.":
    "تم استلام الدفعة بعد إغلاق هذا الحجز. لم تتم إعادة الحجز، ويعمل فريقنا على ترتيب الاسترداد المطلوب.",
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
  "Choose how you would like to continue.": "اختر كيف تريد المتابعة.",
  "Sign in with password": "تسجيل الدخول بكلمة المرور",
  "Create or claim an account": "إنشاء حساب أو استلام حساب",
  "Reset my password": "إعادة تعيين كلمة المرور",
  "Enter your account password.": "أدخل كلمة مرور حسابك.",
  "Create or claim your account after WhatsApp verification.":
    "أنشئ حسابك أو استلمه بعد التحقق عبر واتساب.",
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

  // Account, booking, membership, location, and store workflow coverage
  "+ Add another vehicle": "+ أضف مركبة أخرى",
  "Account sections": "أقسام الحساب",
  "Active plans": "الاشتراكات الفعّالة",
  "Add car-care essentials and we’ll bring them with your wash.":
    "أضف مستلزمات العناية بالسيارة وسنحضرها مع خدمة الغسيل.",
  "Add new": "إضافة جديد",
  "Add one": "أضف واحداً",
  "Add products to your booking": "أضف منتجات إلى حجزك",
  "Add through booking": "أضفها أثناء الحجز",
  "Add to booking": "إضافة إلى الحجز",
  "Add your first location using the form.": "أضف موقعك الأول باستخدام النموذج.",
  "Address details / note": "تفاصيل العنوان / ملاحظة",
  "Any vehicle": "أي مركبة",
  "Back to account": "العودة إلى الحساب",
  "Blue Plate": "اللوحة الزرقاء",
  "Blue plate": "اللوحة الزرقاء",
  "Blue plate details": "تفاصيل اللوحة الزرقاء",
  "Book a new wash": "احجز غسلة جديدة",
  "Book a wash": "احجز غسلة",
  "Book again": "احجز مرة أخرى",
  "Book in one tap": "احجز بخطوة واحدة",
  "Booking products": "منتجات الحجز",
  "Browse plans": "تصفح الاشتراكات",
  "Browse products": "تصفح المنتجات",
  "Building": "المبنى",
  "Building No.": "رقم المبنى",
  "Building number, area, and a confirmed map pin are required.":
    "يلزم إدخال رقم المبنى والمنطقة وتأكيد الموقع على الخريطة.",
  "Check the details before continuing. No request has been sent yet.":
    "راجع التفاصيل قبل المتابعة. لم يتم إرسال أي طلب بعد.",
  "Checking membership coverage…": "جارٍ التحقق من تغطية الاشتراك…",
  "Choose a new time": "اختر موعداً جديداً",
  "Choose a service and we’ll come to you.": "اختر الخدمة وسنصل إليك.",
  "Choose this plan": "اختر هذا الاشتراك",
  "Close": "إغلاق",
  "Complete your wash": "أكمل تفاصيل الغسيل",
  "Confirm an eligible Qatar location and refresh availability.":
    "أكّد موقعاً مؤهلاً داخل قطر ثم حدّث المواعيد المتاحة.",
  "Confirm and continue": "تأكيد ومتابعة",
  "Confirm booking": "تأكيد الحجز",
  "Confirm membership": "تأكيد الاشتراك",
  "Confirm new time": "تأكيد الموعد الجديد",
  "Confirm your map location before checking availability.":
    "أكّد موقعك على الخريطة قبل التحقق من المواعيد المتاحة.",
  "Continue Payment": "متابعة الدفع",
  "Could not get your location. You can still drop the pin manually.":
    "تعذّر تحديد موقعك. لا يزال بإمكانك وضع العلامة يدوياً.",
  "Could not load reschedule options.": "تعذّر تحميل خيارات تغيير الموعد.",
  "Could not remove this location.": "تعذّرت إزالة هذا الموقع.",
  "Could not reschedule the booking.": "تعذّر تغيير موعد الحجز.",
  "Could not save this location.": "تعذّر حفظ هذا الموقع.",
  "Could not validate this location.": "تعذّر التحقق من هذا الموقع.",
  "Date": "التاريخ",
  "Edit": "تعديل",
  "Edit added products": "تعديل المنتجات المضافة",
  "Edit location": "تعديل الموقع",
  "Explore Bubbleit": "استكشف ببلت",
  "Extra details": "تفاصيل إضافية",
  "Flat, floor, gate, parking level…": "الشقة، الطابق، البوابة، مستوى المواقف…",
  "Get a membership": "اشترك في باقة",
  "Go back": "رجوع",
  "Home, Work, Marina…": "المنزل، العمل، المارينا…",
  "Included": "مشمول",
  "Label": "اسم الموقع",
  "Loading account…": "جارٍ تحميل الحساب…",
  "Loading available times…": "جارٍ تحميل المواعيد المتاحة…",
  "Loading locations…": "جارٍ تحميل المواقع…",
  "Loading membership plans…": "جارٍ تحميل الاشتراكات…",
  "Location is not available in this browser.": "تحديد الموقع غير متاح في هذا المتصفح.",
  "Location removed.": "تمت إزالة الموقع.",
  "Location saved.": "تم حفظ الموقع.",
  "Location updated.": "تم تحديث الموقع.",
  "Locations": "المواقع",
  "Manage": "إدارة",
  "Manage locations": "إدارة المواقع",
  "Membership plans": "باقات الاشتراك",
  "Membership — no payment required": "الاشتراك — لا يلزم دفع",
  "Most popular": "الأكثر طلباً",
  "My memberships": "اشتراكاتي",
  "My vehicles": "مركباتي",
  "New booking": "حجز جديد",
  "New location": "موقع جديد",
  "Next up": "الموعد القادم",
  "Next: enter the plate number.": "التالي: أدخل رقم اللوحة.",
  "Next: select a saved car or enter the plate number.":
    "التالي: اختر سيارة محفوظة أو أدخل رقم اللوحة.",
  "No extra time": "لا وقت إضافي",
  "No memberships yet": "لا توجد اشتراكات بعد",
  "No products selected": "لم يتم اختيار منتجات",
  "No saved locations yet": "لا توجد مواقع محفوظة بعد",
  "No upcoming wash": "لا يوجد موعد غسيل قادم",
  "No vehicles saved": "لا توجد مركبات محفوظة",
  "Optional": "اختياري",
  "Optional add-ons": "إضافات اختيارية",
  "Out of stock": "نفد المخزون",
  "Overview": "نظرة عامة",
  "Payment is still unavailable. Your booking remains saved.":
    "لا يزال الدفع غير متاح. حجزك محفوظ.",
  "Pick one and continue without entering the Blue plate again.":
    "اختر واحدة وتابع من دون إعادة إدخال اللوحة الزرقاء.",
  "Prepaid wash bundles make every booking faster.":
    "باقات الغسيل مسبقة الدفع تجعل كل حجز أسرع.",
  "Processing…": "جارٍ التنفيذ…",
  "Quick actions": "إجراءات سريعة",
  "Remove one": "إزالة واحد",
  "Remove this saved location?": "هل تريد إزالة هذا الموقع المحفوظ؟",
  "Reschedule": "تغيير الموعد",
  "Reschedule booking": "تغيير موعد الحجز",
  "Rescheduling…": "جارٍ تغيير الموعد…",
  "Review the authoritative service timing before confirming.":
    "راجع مدة الخدمة المعتمدة قبل التأكيد.",
  "Review upcoming and previous wash appointments.":
    "راجع مواعيد الغسيل القادمة والسابقة.",
  "Review your selection": "راجع اختياراتك",
  "Save": "حفظ",
  "Save changes": "حفظ التغييرات",
  "Save location": "حفظ الموقع",
  "Save more when you wash regularly.": "وفّر أكثر مع الغسيل المنتظم.",
  "Save your home, office, or marina once. During booking, you can pick it instantly.":
    "احفظ المنزل أو المكتب أو المارينا مرة واحدة، ثم اختره فوراً أثناء الحجز.",
  "Saved location": "موقع محفوظ",
  "Saved locations": "المواقع المحفوظة",
  "Savings": "التوفير",
  "Saving…": "جارٍ الحفظ…",
  "Secure payment": "دفع آمن",
  "See memberships": "عرض الاشتراكات",
  "See remaining washes, validity, and book with a plan.":
    "اطّلع على الغسلات المتبقية والصلاحية واحجز باستخدام اشتراك.",
  "Service": "الخدمة",
  "Service timing changed. Please choose your time again.":
    "تغيّرت مدة الخدمة. يرجى اختيار الموعد مرة أخرى.",
  "Service timing changed. Please review the updated time before confirming.":
    "تغيّرت مدة الخدمة. راجع الوقت المحدّث قبل التأكيد.",
  "Shop products": "تسوّق المنتجات",
  "Sign in to manage locations": "سجّل الدخول لإدارة المواقع",
  "Street": "الشارع",
  "Street No.": "رقم الشارع",
  "Tap the map or drag the pin if the current location is not exact.":
    "اضغط على الخريطة أو حرّك العلامة إذا لم يكن الموقع الحالي دقيقاً.",
  "The Qatar service-area map changed or this saved location needs confirmation. Please reselect the location.":
    "تغيّرت خريطة منطقة الخدمة في قطر أو يحتاج هذا الموقع المحفوظ إلى تأكيد. يرجى اختيار الموقع مجدداً.",
  "Upcoming": "القادمة",
  "Upcoming booking": "الحجز القادم",
  "Use a saved location": "استخدم موقعاً محفوظاً",
  "Use my current location": "استخدم موقعي الحالي",
  "Valid for 30 days": "صالح لمدة 30 يوماً",
  "Validity": "الصلاحية",
  "Vehicle": "المركبة",
  "Vehicles": "المركبات",
  "Vehicles saved during booking appear here.": "تظهر هنا المركبات المحفوظة أثناء الحجز.",
  "View all": "عرض الكل",
  "View all bookings": "عرض جميع الحجوزات",
  "View all memberships": "عرض جميع الاشتراكات",
  "Wash more, pay less": "اغسل أكثر وادفع أقل",
  "Wash type": "نوع الغسيل",
  "Welcome back": "مرحباً بعودتك",
  "We’ll bring these with your service and include them in this payment.":
    "سنحضرها مع خدمتك ونضيفها إلى هذه الدفعة.",
  "Your password was reset. Sign in again on this device.":
    "تمت إعادة تعيين كلمة المرور. سجّل الدخول مجدداً على هذا الجهاز.",
  "Your payment, membership wash, products, and total stay attached to this booking.":
    "تبقى الدفعة وغسلة الاشتراك والمنتجات والمجموع مرتبطة بهذا الحجز.",
  "Your session has ended. Sign in again to continue.":
    "انتهت جلستك. سجّل الدخول مجدداً للمتابعة.",
  "Your vehicle is saved automatically when you book.":
    "تُحفظ مركبتك تلقائياً عند الحجز.",
  "Zone": "المنطقة",
  "Zone No.": "رقم المنطقة",
  "active membership plans": "اشتراكات فعّالة",
  "days": "أيام",
  "min": "دقيقة",
  "saved locations": "مواقع محفوظة",
  "saved vehicles": "مركبات محفوظة",
  "selected": "محدد",
  "upcoming bookings": "حجوزات قادمة",
  "wash": "غسلة",
  "Add a product to start your order.": "أضف منتجاً لبدء طلبك.",
  "Add to cart": "أضف إلى السلة",
  "Added": "تمت الإضافة",
  "Available": "متوفر",
  "Bubbleit Store": "متجر ببلت",
  "Cart actions": "إجراءات السلة",
  "Checkout": "إتمام الطلب",
  "Checkout securely": "إتمام الطلب بأمان",
  "Clear filters": "مسح عوامل التصفية",
  "Close cart": "إغلاق السلة",
  "Continue shopping": "متابعة التسوق",
  "Delivery details are confirmed at checkout.": "تُؤكّد تفاصيل التوصيل عند إتمام الطلب.",
  "Find products": "البحث عن المنتجات",
  "Loading the store…": "جارٍ تحميل المتجر…",
  "No products found": "لم يتم العثور على منتجات",
  "Product categories": "فئات المنتجات",
  "Professional car care, delivered": "عناية احترافية بالسيارة تصل إليك",
  "Retry store": "إعادة تحميل المتجر",
  "Search car care products": "ابحث في منتجات العناية بالسيارة",
  "Search products": "البحث عن المنتجات",
  "Shop all products": "تسوّق جميع المنتجات",
  "The same practical tools and towels trusted by Bubbleit detailers, ready for delivery across Qatar.":
    "الأدوات والمناشف العملية نفسها التي يعتمد عليها مختصو ببلت، جاهزة للتوصيل في جميع أنحاء قطر.",
  "The store is temporarily unavailable": "المتجر غير متاح مؤقتاً",
  "Try a different search or category.": "جرّب عبارة بحث أو فئة أخرى.",
  "View cart": "عرض السلة",
  "We couldn’t verify current products or stock. No offline products have been added to your cart.":
    "تعذّر التحقق من المنتجات أو المخزون الحالي. لم تُضف أي منتجات غير متصلة إلى سلتك.",
  "We’re checking current products, prices, and stock.":
    "جارٍ التحقق من المنتجات والأسعار والمخزون الحالي.",
  "Your cart": "سلتك",
  "Your cart is empty": "سلتك فارغة",
  "in cart": "في السلة",
  "item": "منتج",
  "items": "منتجات",
  "products": "منتجات",
  "Account owner": "صاحب الحساب",
  "Back to cart": "العودة إلى السلة",
  "Back to store": "العودة إلى المتجر",
  "Bubbleit customer": "عميل ببلت",
  "By placing your order, you confirm the delivery and contact details above.":
    "بإتمام الطلب، فإنك تؤكد تفاصيل التوصيل والتواصل الموضحة أعلاه.",
  "Checking your cart…": "جارٍ التحقق من سلتك…",
  "Checkout is temporarily unavailable": "إتمام الطلب غير متاح مؤقتاً",
  "Checkout progress": "مراحل إتمام الطلب",
  "Choose your products before starting checkout.": "اختر منتجاتك قبل بدء إتمام الطلب.",
  "Confirm the delivery pin before checkout.": "أكّد علامة موقع التوصيل قبل إتمام الطلب.",
  "Confirm updated total and pay": "أكّد المجموع المحدّث وادفع",
  "Continue to contact": "المتابعة إلى الحساب",
  "Could not place the order. Please try again.": "تعذّر إرسال الطلب. يرجى المحاولة مجدداً.",
  "Creating order…": "جارٍ إنشاء الطلب…",
  "Deliver to": "التوصيل إلى",
  "Delivery fee": "رسوم التوصيل",
  "Finding your location…": "جارٍ تحديد موقعك…",
  "Flat, floor, gate, parking level": "الشقة، الطابق، البوابة، مستوى المواقف",
  "Loading map…": "جارٍ تحميل الخريطة…",
  "Location access failed. Tap the map to place the pin manually.":
    "تعذّر الوصول إلى موقعك. اضغط على الخريطة لوضع العلامة يدوياً.",
  "Location pinned successfully": "تم تثبيت الموقع بنجاح",
  "Order": "الطلب",
  "Payment could not start because no checkout link was returned. Please retry payment.":
    "تعذّر بدء الدفع لعدم توفر رابط الدفع. يرجى إعادة محاولة الدفع.",
  "Payment could not start. Your order is saved; please retry payment.":
    "تعذّر بدء الدفع. طلبك محفوظ؛ يرجى إعادة محاولة الدفع.",
  "Pin the exact location, then add the building details.":
    "حدّد الموقع بدقة، ثم أضف تفاصيل المبنى.",
  "Place order": "إرسال الطلب",
  "Pricing changed since your first review. This updated QAR total must be confirmed before payment starts.":
    "تغيّرت الأسعار منذ المراجعة الأولى. يجب تأكيد المجموع المحدّث بالريال القطري قبل بدء الدفع.",
  "Qty": "الكمية",
  "Redirecting…": "جارٍ التحويل…",
  "Retry checkout": "إعادة محاولة إتمام الطلب",
  "Retry payment": "إعادة محاولة الدفع",
  "Retry payment to continue.": "أعد محاولة الدفع للمتابعة.",
  "Review order": "مراجعة الطلب",
  "Review your order": "راجع طلبك",
  "Sign in or create your verified account before checkout.":
    "سجّل الدخول أو أنشئ حساباً موثّقاً قبل إتمام الطلب.",
  "Sign in or verify your account to continue": "سجّل الدخول أو وثّق حسابك للمتابعة",
  "Starting payment…": "جارٍ بدء الدفع…",
  "Step 1 of 3": "الخطوة 1 من 3",
  "Step 2 of 3": "الخطوة 2 من 3",
  "Step 3 of 3": "الخطوة 3 من 3",
  "Store checkout requires a signed-in customer account. Your cart stays here while you sign in or verify a new account by OTP.":
    "يتطلب إتمام طلب المتجر حساب عميل مسجلاً. ستبقى سلتك محفوظة أثناء تسجيل الدخول أو توثيق حساب جديد برمز التحقق.",
  "Store order received": "تم استلام طلب المتجر",
  "Store product": "منتج من المتجر",
  "The store total changed. Review the updated prices and confirm again to continue to payment.":
    "تغيّر مجموع المتجر. راجع الأسعار المحدّثة وأكّدها مجدداً للمتابعة إلى الدفع.",
  "Update precise location": "تحديث الموقع الدقيق",
  "Use my precise location": "استخدم موقعي الدقيق",
  "Using signed-in account": "استخدام الحساب المسجّل",
  "Verify your account": "تحقق من حسابك",
  "View": "عرض",
  "We couldn’t verify the live catalogue. Your saved cart has not been submitted or replaced with offline products.":
    "تعذّر التحقق من الكتالوج المباشر. لم تُرسل سلتك المحفوظة ولم تُستبدل بمنتجات غير متصلة.",
  "We’re verifying every product, price, and stock level with Bubbleit.":
    "جارٍ التحقق من كل منتج وسعر ومستوى مخزون لدى ببلت.",
  "Where should we deliver?": "إلى أين نوصّل طلبك؟",
  "Your Bubbleit store order has been captured. The team will contact you to confirm delivery and payment details.":
    "تم تسجيل طلبك من متجر ببلت. سيتواصل معك الفريق لتأكيد تفاصيل التوصيل والدفع.",
  "e.g. West Bay, The Pearl": "مثال: الخليج الغربي، اللؤلؤة",
  "is saved.": "محفوظ.",
  "Booking": "الحجز",
  "Booking progress": "مراحل الحجز",
  "Bubbleit home": "الصفحة الرئيسية لببلت",
  "Go to my bookings": "الانتقال إلى حجوزاتي",
  "Loading…": "جارٍ التحميل…",
  "Map — drag the pin to your exact location": "الخريطة — حرّك العلامة إلى موقعك الدقيق",
  "Enter coordinates without using the map": "أدخل الإحداثيات من دون استخدام الخريطة",
  "Latitude": "خط العرض",
  "Longitude": "خط الطول",
  "Apply coordinates": "تطبيق الإحداثيات",
  "Enter valid latitude and longitude values.": "أدخل قيمًا صحيحة لخط العرض وخط الطول.",
  "Selected coordinates": "الإحداثيات المحددة",
  "Menu": "القائمة",
  "Bubbleit logo": "شعار ببلت",
  "Open navigation menu": "فتح قائمة التنقل",
  "Close navigation menu": "إغلاق قائمة التنقل",
  "Mobile navigation": "التنقل على الهاتف",
  "Nothing to pay here": "لا توجد دفعة مطلوبة هنا",
  "Pay now": "ادفع الآن",
  "Primary navigation": "التنقل الرئيسي",
  "Secure Checkout (Demo)": "دفع آمن (تجريبي)",
  "QR code placeholder": "موضع رمز الاستجابة السريعة",
  "This booking isn't awaiting payment, or your session expired.":
    "هذا الحجز لا ينتظر الدفع، أو أن جلستك انتهت.",
  "This is a demo checkout. In production this page is the payment gateway's hosted card form.":
    "هذه صفحة دفع تجريبية. في الإنتاج ستظهر هنا صفحة البطاقة المستضافة لدى بوابة الدفع.",
  "Bubbleit on": "ببلت على",
  "coming soon": "قريباً",
  "Coming soon": "قريباً",
  "Today, 3:30 PM": "اليوم، ٣:٣٠ م",
  "Full Car Wash": "غسيل كامل للسيارة",
  "Confirmed": "مؤكّد",
  "Your address is pinned and ready for arrival.": "تم تثبيت عنوانك وهو جاهز لوصول الفريق.",
  "Exterior + Interior": "خارجي + داخلي",
  "Secure checkout": "دفع آمن",
  "App coming soon": "التطبيق قريباً",
  "LIVE BOOKING": "حجز مباشر",
  "Time": "الوقت",
  "Track": "التتبع",
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

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
    document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
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
