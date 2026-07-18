export const LEGAL_POLICY_VERSION = "2026-07-18-v1";
export const LEGAL_POLICY_EFFECTIVE_DATE = "2026-07-18";

export const LEGAL_ENTITY = {
  name: "Bubble It Cars Washing LLC",
  commercialRegistration: "182268",
  address: "Building No. 24, Zone 60, Street 950, Qatar",
  privacyEmail: "privacy@bubbleit.qa",
  customerDomain: "https://bubbleit.qa",
  customerApi: "https://bubbleit-backend.on-forge.com/api/v1/customer",
  operationsApi: "https://bubbleit-backend.on-forge.com/api/v1",
  operationsWeb: "https://bubbleit-admin.web.app",
} as const;

export type LegalPolicyKind = "privacy" | "terms";

type LocalizedText = { en: string; ar: string };
export type LegalSection = {
  id: string;
  title: LocalizedText;
  paragraphs: LocalizedText[];
  items?: LocalizedText[];
};

export type LegalPolicy = {
  kind: LegalPolicyKind;
  title: LocalizedText;
  summary: LocalizedText;
  sections: LegalSection[];
};

export const PRIVACY_POLICY: LegalPolicy = {
  kind: "privacy",
  title: { en: "Privacy Policy", ar: "سياسة الخصوصية" },
  summary: {
    en: "This policy explains how Bubble It Cars Washing LLC collects, uses, protects, retains, and deletes personal data when you use BubbleIt.",
    ar: "توضح هذه السياسة كيفية جمع شركة ببل إت لغسيل السيارات ذ.م.م للبيانات الشخصية واستخدامها وحمايتها والاحتفاظ بها وحذفها عند استخدامك لخدمات ببلت.",
  },
  sections: [
    {
      id: "controller",
      title: { en: "1. Who controls your data", ar: "١. الجهة المسؤولة عن بياناتك" },
      paragraphs: [{
        en: "Bubble It Cars Washing LLC, Commercial Registration 182268, at Building No. 24, Zone 60, Street 950, Qatar, is responsible for the personal data described in this policy. Contact privacy@bubbleit.qa for privacy requests or questions.",
        ar: "شركة ببل إت لغسيل السيارات ذ.م.م، سجل تجاري رقم ١٨٢٢٦٨، وعنوانها مبنى رقم ٢٤، منطقة ٦٠، شارع ٩٥٠، دولة قطر، هي المسؤولة عن البيانات الشخصية الموضحة في هذه السياسة. يمكن التواصل عبر privacy@bubbleit.qa لطلبات الخصوصية أو الاستفسارات.",
      }],
    },
    {
      id: "data-collected",
      title: { en: "2. Data we collect", ar: "٢. البيانات التي نجمعها" },
      paragraphs: [{
        en: "We collect only information needed to operate, secure, and support BubbleIt and to meet legal and financial obligations.",
        ar: "نجمع فقط المعلومات اللازمة لتشغيل خدمات ببلت وتأمينها ودعمها والوفاء بالالتزامات القانونية والمالية.",
      }],
      items: [
        { en: "Identity and account data: name, Qatar mobile number, email if supplied, preferred language, OTP records, and session records.", ar: "بيانات الهوية والحساب: الاسم، رقم الهاتف القطري، البريد الإلكتروني إن تم تقديمه، اللغة المفضلة، سجلات رموز التحقق، وسجلات الجلسات." },
        { en: "Service data: saved addresses, map coordinates, building/zone/street details, vehicles, bookings, selected services, add-ons, notes, cancellations, rescheduling, and service history.", ar: "بيانات الخدمة: العناوين المحفوظة، إحداثيات الموقع، تفاصيل المبنى والمنطقة والشارع، المركبات، الحجوزات، الخدمات والإضافات المختارة، الملاحظات، الإلغاءات، إعادة الجدولة، وسجل الخدمات." },
        { en: "Commerce data: memberships and usage, store orders, prices, payment attempts, transaction references, refunds, currency, and reconciliation records. BubbleIt does not intentionally store full payment-card credentials.", ar: "بيانات المعاملات: الاشتراكات واستخدامها، طلبات المتجر، الأسعار، محاولات الدفع، مراجع المعاملات، المبالغ المستردة، العملة، وسجلات المطابقة. لا تتعمد ببلت تخزين بيانات بطاقة الدفع الكاملة." },
        { en: "Communication data: notification preferences, device notification tokens, delivery results, reviews, and support communications.", ar: "بيانات التواصل: تفضيلات الإشعارات، رموز إشعارات الأجهزة، نتائج التسليم، التقييمات، ومراسلات الدعم." },
        { en: "Security data: IP address, request identifiers, access history, device/session details, and fraud or security events.", ar: "بيانات الأمان: عنوان بروتوكول الإنترنت، معرفات الطلبات، سجل الدخول، تفاصيل الجهاز والجلسة، وأحداث الاحتيال أو الأمان." },
      ],
    },
    {
      id: "purposes",
      title: { en: "3. Why we use data", ar: "٣. أسباب استخدام البيانات" },
      paragraphs: [{
        en: "We process data to authenticate customers; calculate availability, duration and price; create and fulfil bookings and orders; administer memberships; allocate operational resources; process and reconcile payments and refunds; send transactional messages; provide support; prevent misuse; comply with law; and improve services using aggregated or irreversibly anonymous information.",
        ar: "نعالج البيانات للتحقق من هوية العملاء، وحساب التوفر والمدة والسعر، وإنشاء الحجوزات والطلبات وتنفيذها، وإدارة الاشتراكات، وتخصيص الموارد التشغيلية، ومعالجة المدفوعات والمبالغ المستردة ومطابقتها، وإرسال الرسائل المتعلقة بالمعاملات، وتقديم الدعم، ومنع إساءة الاستخدام، والامتثال للقانون، وتحسين الخدمات باستخدام معلومات مجمعة أو مجهولة الهوية بصورة نهائية.",
      }],
    },
    {
      id: "location",
      title: { en: "4. Location information", ar: "٤. معلومات الموقع" },
      paragraphs: [{
        en: "A precise service location is required to validate that an address is on Qatar land territory, calculate availability, and allow the service team to reach the vehicle. You may enter coordinates and address details manually instead of granting browser location permission.",
        ar: "يلزم تحديد موقع الخدمة بدقة للتحقق من وجود العنوان داخل الأراضي القطرية وحساب التوفر وتمكين فريق الخدمة من الوصول إلى المركبة. ويمكنك إدخال الإحداثيات وتفاصيل العنوان يدوياً بدلاً من منح المتصفح إذن الوصول إلى الموقع.",
      }],
    },
    {
      id: "sharing",
      title: { en: "5. Sharing and service providers", ar: "٥. مشاركة البيانات ومقدمو الخدمات" },
      paragraphs: [{
        en: "We share the minimum necessary information with approved hosting and infrastructure providers, payment processors, notification and customer-messaging providers, mapping services, professional advisers, and competent authorities when legally required. Providers may use the information only to perform the contracted service and protect it appropriately.",
        ar: "نشارك الحد الأدنى اللازم من المعلومات مع مقدمي خدمات الاستضافة والبنية التحتية المعتمدين، ومعالجي الدفع، ومقدمي الإشعارات ورسائل العملاء، وخدمات الخرائط، والمستشارين المهنيين، والجهات المختصة عند وجود التزام قانوني. ولا يجوز لمقدمي الخدمات استخدام المعلومات إلا لتنفيذ الخدمة المتعاقد عليها وحمايتها بالشكل المناسب.",
      }, {
        en: "Approved BubbleIt domains are bubbleit.qa, bubbleit-backend.on-forge.com, and the operations web application at bubbleit-admin.web.app. Live payment and messaging providers will be identified when their production integrations are enabled.",
        ar: "نطاقات ببلت المعتمدة هي bubbleit.qa وbubbleit-backend.on-forge.com، إضافة إلى تطبيق العمليات على الويب في bubbleit-admin.web.app. وسيتم تحديد مقدمي خدمات الدفع والرسائل الفعليين عند تفعيل تكاملاتهم الإنتاجية.",
      }],
    },
    {
      id: "privacy-notifications",
      title: { en: "6. Notifications and marketing", ar: "٦. الإشعارات والتسويق" },
      paragraphs: [{
        en: "We may send necessary booking, payment, cancellation, refund, order, membership, and service reminders. Browser or app push is optional. Critical transactional messages may use an approved WhatsApp or SMS channel. Marketing requires separate consent and can be disabled without disabling required transactional messages.",
        ar: "قد نرسل إشعارات ضرورية بشأن الحجوزات والمدفوعات والإلغاءات والمبالغ المستردة والطلبات والاشتراكات وتذكيرات الخدمة. إشعارات المتصفح أو التطبيق اختيارية. وقد تستخدم الرسائل المهمة المتعلقة بالمعاملات قناة واتساب أو رسائل نصية معتمدة. ويتطلب التسويق موافقة منفصلة ويمكن إيقافه دون إيقاف الرسائل الضرورية المتعلقة بالمعاملات.",
      }],
    },
    {
      id: "retention",
      title: { en: "7. How long we retain data", ar: "٧. مدة الاحتفاظ بالبيانات" },
      paragraphs: [{
        en: "Retention is limited by data type and purpose. A legal hold or active dispute may extend the relevant period until final resolution.",
        ar: "تختلف مدة الاحتفاظ بحسب نوع البيانات والغرض منها. وقد يؤدي حجز قانوني أو نزاع قائم إلى تمديد المدة ذات الصلة حتى التسوية النهائية.",
      }],
      items: [
        { en: "Sessions and device tokens: revoked immediately when the account is deleted.", ar: "الجلسات ورموز الأجهزة: تُلغى فوراً عند حذف الحساب." },
        { en: "OTP and notification-delivery logs: 90 days.", ar: "سجلات رموز التحقق وتسليم الإشعارات: ٩٠ يوماً." },
        { en: "Security and access logs: 12 months.", ar: "سجلات الأمان والدخول: ١٢ شهراً." },
        { en: "Support records: 2 years after closure.", ar: "سجلات الدعم: سنتان بعد إغلاق الطلب." },
        { en: "Bookings and service history: 5 years and pseudonymized after account deletion.", ar: "سجل الحجوزات والخدمات: ٥ سنوات مع إزالة الهوية بعد حذف الحساب." },
        { en: "Payments, refunds, invoices, orders, and membership ledgers: 10 years and pseudonymized after account deletion.", ar: "سجلات المدفوعات والمبالغ المستردة والفواتير والطلبات والاشتراكات: ١٠ سنوات مع إزالة الهوية بعد حذف الحساب." },
        { en: "Irreversibly anonymous statistics: may be retained indefinitely.", ar: "الإحصاءات مجهولة الهوية بصورة نهائية: يجوز الاحتفاظ بها دون مدة محددة." },
      ],
    },
    {
      id: "rights",
      title: { en: "8. Your privacy rights", ar: "٨. حقوقك المتعلقة بالخصوصية" },
      paragraphs: [{
        en: "Subject to applicable Qatar law, you may request access, a portable copy, correction, deletion, objection, or withdrawal of optional consent, and may ask how your data is processed and disclosed. Withdrawal does not invalidate processing already lawfully completed and does not remove records that must be retained for legal, financial, security, fraud-prevention, or dispute purposes.",
        ar: "وفقاً للقانون القطري المعمول به، يمكنك طلب الوصول إلى بياناتك، أو نسخة قابلة للنقل، أو التصحيح، أو الحذف، أو الاعتراض، أو سحب الموافقة الاختيارية، كما يمكنك الاستفسار عن كيفية معالجة بياناتك والإفصاح عنها. ولا يؤثر سحب الموافقة على المعالجة التي تمت بصورة مشروعة، ولا يؤدي إلى حذف السجلات الواجب الاحتفاظ بها لأغراض قانونية أو مالية أو أمنية أو لمنع الاحتيال أو تسوية النزاعات.",
      }],
    },
    {
      id: "export-deletion",
      title: { en: "9. Data export and account deletion", ar: "٩. تصدير البيانات وحذف الحساب" },
      paragraphs: [{
        en: "An authenticated customer may create a portable JSON export. Its download credential expires after 15 minutes and works once. Account deletion requires a fresh OTP and explicit irreversible confirmation. We immediately revoke sessions and notification devices, disable the account, and erase or irreversibly anonymize non-retained profile, address, vehicle, preference, notification, review, and location information. Pseudonymous records retained under section 7 remain unavailable for account use.",
        ar: "يمكن للعميل المسجل إنشاء نسخة قابلة للنقل بصيغة JSON. تنتهي صلاحية بيانات تنزيلها بعد ١٥ دقيقة وتُستخدم مرة واحدة. ويتطلب حذف الحساب رمز تحقق حديثاً وتأكيداً صريحاً غير قابل للتراجع. نلغي الجلسات وأجهزة الإشعارات فوراً، ونعطل الحساب، ونحذف أو نجهّل بصورة نهائية معلومات الملف الشخصي والعنوان والمركبة والتفضيلات والإشعارات والتقييمات والموقع غير الخاضعة للاحتفاظ. وتبقى السجلات مجهولة الهوية المحتفظ بها وفق البند ٧ غير متاحة لاستخدام الحساب.",
      }],
    },
    {
      id: "international",
      title: { en: "10. Processing locations", ar: "١٠. أماكن معالجة البيانات" },
      paragraphs: [{
        en: "Some approved technology providers may process data outside Qatar. BubbleIt will use appropriate contractual, organizational, and technical safeguards and will limit transfers to what is necessary for the stated service.",
        ar: "قد يعالج بعض مقدمي التقنية المعتمدين البيانات خارج قطر. تستخدم ببلت ضمانات تعاقدية وتنظيمية وتقنية مناسبة، وتحد عمليات النقل بما يلزم للخدمة المعلنة.",
      }],
    },
    {
      id: "security",
      title: { en: "11. Security", ar: "١١. الأمان" },
      paragraphs: [{
        en: "We use access controls, encryption in transit, restricted credentials, bounded sessions, audit records, monitoring, and data minimization. No internet service can guarantee absolute security; report suspected misuse promptly to privacy@bubbleit.qa.",
        ar: "نستخدم ضوابط الوصول والتشفير أثناء النقل وتقييد بيانات الاعتماد والجلسات المحددة المدة وسجلات التدقيق والمراقبة وتقليل البيانات. ولا يمكن لأي خدمة عبر الإنترنت ضمان الأمان المطلق؛ يرجى الإبلاغ سريعاً عن أي إساءة استخدام مشتبه بها عبر privacy@bubbleit.qa.",
      }],
    },
    {
      id: "age",
      title: { en: "12. Age requirement", ar: "١٢. شرط العمر" },
      paragraphs: [{
        en: "BubbleIt is intended for customers aged 18 or older. A person under 18 may use the service only with permission and supervision from a parent or legal guardian.",
        ar: "خدمات ببلت مخصصة للعملاء بعمر ١٨ عاماً أو أكثر. ولا يجوز لمن يقل عمره عن ١٨ عاماً استخدام الخدمة إلا بإذن وإشراف أحد الوالدين أو الوصي القانوني.",
      }],
    },
    {
      id: "changes-contact",
      title: { en: "13. Changes and contact", ar: "١٣. التغييرات والتواصل" },
      paragraphs: [{
        en: "Material changes are versioned and communicated before they apply when required. This English and Arabic policy is one policy version with the same legal meaning; neither language is maintained as an independent policy. Contact privacy@bubbleit.qa or write to the registered address above.",
        ar: "تُسجّل التغييرات الجوهرية بإصدار جديد ويُبلّغ عنها قبل تطبيقها متى كان ذلك مطلوباً. وتشكل الصياغتان الإنجليزية والعربية سياسة واحدة بالإصدار نفسه والمعنى القانوني ذاته، ولا تُدار أي منهما كسياسة مستقلة. يمكن التواصل عبر privacy@bubbleit.qa أو المراسلة على العنوان المسجل أعلاه.",
      }],
    },
  ],
};

export const TERMS_POLICY: LegalPolicy = {
  kind: "terms",
  title: { en: "Terms & Conditions", ar: "الشروط والأحكام" },
  summary: {
    en: "These terms govern customer use of BubbleIt mobile vehicle-washing, booking, membership, store, payment, and support services in Qatar.",
    ar: "تنظم هذه الشروط استخدام العملاء لخدمات ببلت لغسيل المركبات المتنقل والحجوزات والاشتراكات والمتجر والدفع والدعم في قطر.",
  },
  sections: [
    {
      id: "agreement",
      title: { en: "1. Agreement and operator", ar: "١. الاتفاق والجهة المشغلة" },
      paragraphs: [{ en: "BubbleIt is operated by Bubble It Cars Washing LLC, Commercial Registration 182268, Building No. 24, Zone 60, Street 950, Qatar. By creating an account or confirming an order or booking, you agree to this version of the Terms and the Privacy Policy.", ar: "تُشغّل ببلت بواسطة شركة ببل إت لغسيل السيارات ذ.م.م، سجل تجاري رقم ١٨٢٢٦٨، مبنى رقم ٢٤، منطقة ٦٠، شارع ٩٥٠، دولة قطر. بإنشاء حساب أو تأكيد طلب أو حجز، فإنك توافق على هذا الإصدار من الشروط وسياسة الخصوصية." }],
    },
    {
      id: "eligibility",
      title: { en: "2. Eligibility and accounts", ar: "٢. الأهلية والحسابات" },
      paragraphs: [{ en: "You must be 18 or older, or use BubbleIt with permission and supervision from a parent or legal guardian. Accounts use a verified Qatar mobile number. You must provide accurate information, protect account access, and promptly report unauthorized use.", ar: "يجب أن يكون عمرك ١٨ عاماً أو أكثر، أو أن تستخدم ببلت بإذن وإشراف أحد الوالدين أو الوصي القانوني. تعتمد الحسابات على رقم هاتف قطري تم التحقق منه. ويجب تقديم معلومات صحيحة وحماية الوصول إلى الحساب والإبلاغ فوراً عن أي استخدام غير مصرح به." }],
    },
    {
      id: "area",
      title: { en: "3. Service area", ar: "٣. نطاق الخدمة" },
      paragraphs: [{ en: "BubbleIt serves addressable locations anywhere on Qatar’s land territory, subject to valid coordinates and address details, safe access, capacity, scheduling rules, and operational availability.", ar: "تقدم ببلت خدماتها في المواقع القابلة للعنونة في جميع أنحاء الأراضي القطرية، بشرط صحة الإحداثيات وتفاصيل العنوان، وإمكانية الوصول الآمن، والسعة، وقواعد المواعيد، والتوفر التشغيلي." }],
    },
    {
      id: "booking",
      title: { en: "4. Bookings", ar: "٤. الحجوزات" },
      paragraphs: [{ en: "Availability, service duration, price, membership coverage, and capacity are calculated and confirmed by BubbleIt’s server. A displayed time is not reserved until the booking is successfully created. The confirmed booking records the accepted services, duration, price, location, and applicable policy versions.", ar: "يحسب خادم ببلت التوفر ومدة الخدمة والسعر وتغطية الاشتراك والسعة ويؤكدها. ولا يُحجز الموعد بمجرد ظهوره حتى يتم إنشاء الحجز بنجاح. ويسجل الحجز المؤكد الخدمات والمدة والسعر والموقع وإصدارات السياسات المقبولة." }],
    },
    {
      id: "prices",
      title: { en: "5. Prices and payments", ar: "٥. الأسعار والمدفوعات" },
      paragraphs: [{ en: "Prices are shown in Qatari riyals before confirmation and are calculated server-side. Online payment is recognized only after verified payment-provider confirmation. A failed, cancelled, expired, incomplete, or inconsistent payment is not treated as paid. BubbleIt does not intentionally store full card credentials.", ar: "تُعرض الأسعار بالريال القطري قبل التأكيد ويحسبها الخادم. ولا يُعتمد الدفع الإلكتروني إلا بعد تأكيد موثّق من مزود الدفع. ولا تُعامل الدفعة الفاشلة أو الملغاة أو المنتهية أو الناقصة أو غير المتطابقة كدفعة مسددة. ولا تتعمد ببلت تخزين بيانات البطاقة الكاملة." }],
    },
    {
      id: "cancel-reschedule",
      title: { en: "6. Cancellation, refund, rescheduling, and no-show", ar: "٦. الإلغاء والاسترداد وإعادة الجدولة وعدم الحضور" },
      paragraphs: [{ en: "You may cancel or reschedule at least two hours before the scheduled service. An eligible timely customer cancellation receives a full refund and applicable membership restoration. A BubbleIt-caused cancellation always receives a full refund or restoration. Late cancellation and no-show do not receive an automatic refund or membership restoration and may be reviewed manually. Rescheduling revalidates capacity and price and settles any difference before confirmation.", ar: "يمكنك الإلغاء أو إعادة الجدولة قبل موعد الخدمة بساعتين على الأقل. ويستحق الإلغاء المؤهل في الوقت المحدد استرداداً كاملاً وإعادة رصيد الاشتراك المطبق. كما يستحق الإلغاء من جانب ببلت دائماً استرداداً كاملاً أو إعادة الرصيد. ولا يترتب على الإلغاء المتأخر أو عدم الحضور استرداد أو إعادة رصيد تلقائياً، ويمكن مراجعته يدوياً. وتُعاد عند الجدولة الجديدة مراجعة السعة والسعر وتسوية أي فرق قبل التأكيد." }],
    },
    {
      id: "late-payment",
      title: { en: "7. Late payment confirmation", ar: "٧. تأكيد الدفع المتأخر" },
      paragraphs: [{ en: "If payment succeeds after cancellation or expiry and capacity or customer consent is no longer valid, BubbleIt will not silently reinstate the booking or order. BubbleIt will initiate a full refund and place any failed refund into an audited review process.", ar: "إذا نجح الدفع بعد الإلغاء أو انتهاء الصلاحية ولم تعد السعة أو موافقة العميل صالحة، فلن تعيد ببلت الحجز أو الطلب تلقائياً دون إشعار. وستبدأ ببلت استرداداً كاملاً وتضع أي استرداد فاشل ضمن عملية مراجعة موثقة." }],
    },
    {
      id: "memberships",
      title: { en: "8. Memberships", ar: "٨. الاشتراكات" },
      paragraphs: [{ en: "Eligible membership use is shown before confirmation. You explicitly choose which eligible vehicle lines use membership coverage; eligible uses may be preselected. Each selected eligible vehicle consumes one wash. Add-ons, products, and non-selected or ineligible vehicles remain payable. Existing bookings keep the accepted membership, duration, and price snapshot.", ar: "يُعرض استخدام الاشتراك المؤهل قبل التأكيد. وتختار صراحةً أي بنود المركبات المؤهلة تستخدم تغطية الاشتراك، وقد تُحدد الاستخدامات المؤهلة مسبقاً. تستهلك كل مركبة مؤهلة مختارة غسلة واحدة. وتبقى الإضافات والمنتجات والمركبات غير المختارة أو غير المؤهلة مدفوعة. وتحافظ الحجوزات الحالية على لقطة الاشتراك والمدة والسعر المقبولة." }],
    },
    {
      id: "store",
      title: { en: "9. Store purchases", ar: "٩. مشتريات المتجر" },
      paragraphs: [{ en: "Browsing does not reserve stock. A server-created pending checkout reserves confirmed stock for 15 minutes. An unpaid reservation expires and releases automatically. Product availability and price are not final until server confirmation, customer reconfirmation where required, and verified payment.", ar: "لا يؤدي تصفح المنتجات إلى حجز المخزون. ويحجز طلب دفع معلّق أنشأه الخادم المخزون المؤكد لمدة ١٥ دقيقة. وينتهي الحجز غير المدفوع ويُفرج عنه تلقائياً. ولا يصبح توفر المنتج وسعره نهائياً إلا بعد تأكيد الخادم وإعادة تأكيد العميل عند الحاجة والتحقق من الدفع." }],
    },
    {
      id: "customer-duties",
      title: { en: "10. Customer responsibilities", ar: "١٠. مسؤوليات العميل" },
      paragraphs: [{ en: "You must provide a correct service location, accessible vehicle, lawful and safe parking or service area, accurate vehicle details, and safe access for staff. You must remove valuables and disclose conditions that could make service unsafe. Unsafe, inaccessible, unlawful, or materially inaccurate conditions may require cancellation or rescheduling.", ar: "يجب توفير موقع خدمة صحيح ومركبة يمكن الوصول إليها وموقف أو موقع خدمة قانوني وآمن وتفاصيل دقيقة للمركبة ووصول آمن للموظفين. كما يجب إزالة المقتنيات الثمينة والإفصاح عن الظروف التي قد تجعل الخدمة غير آمنة. وقد تتطلب الظروف غير الآمنة أو غير القابلة للوصول أو غير القانونية أو غير الدقيقة بصورة جوهرية الإلغاء أو إعادة الجدولة." }],
    },
    {
      id: "delays",
      title: { en: "11. Delays and operational changes", ar: "١١. التأخير والتغييرات التشغيلية" },
      paragraphs: [{ en: "BubbleIt will make reasonable efforts to meet the scheduled time. Traffic, weather, safety, access, equipment, or other operational events may cause delay. Material changes will be communicated when reasonably possible.", ar: "تبذل ببلت جهداً معقولاً للالتزام بالموعد المحدد. وقد تتسبب حركة المرور أو الطقس أو السلامة أو الوصول أو المعدات أو أحداث تشغيلية أخرى في التأخير. وسيتم إبلاغ العميل بالتغييرات الجوهرية متى كان ذلك ممكناً بصورة معقولة." }],
    },
    {
      id: "terms-notifications",
      title: { en: "12. Communications", ar: "١٢. الاتصالات" },
      paragraphs: [{ en: "You agree to receive necessary account, booking, payment, cancellation, refund, order, membership, and service messages. Optional push and marketing preferences may be changed separately. Disabling marketing does not disable required transactional communications.", ar: "توافق على استلام الرسائل الضرورية المتعلقة بالحساب والحجز والدفع والإلغاء والاسترداد والطلب والاشتراك والخدمة. ويمكن تغيير تفضيلات الإشعارات الاختيارية والتسويق بصورة منفصلة. ولا يؤدي إيقاف التسويق إلى إيقاف الاتصالات الضرورية المتعلقة بالمعاملات." }],
    },
    {
      id: "acceptable-use",
      title: { en: "13. Acceptable use", ar: "١٣. الاستخدام المقبول" },
      paragraphs: [{ en: "You must not misuse accounts, OTPs, payment flows, promotions, memberships, booking capacity, reviews, staff communications, security controls, or BubbleIt systems. BubbleIt may restrict access to protect customers, staff, payments, operations, or legal compliance, while preserving applicable customer rights.", ar: "يُحظر إساءة استخدام الحسابات أو رموز التحقق أو مسارات الدفع أو العروض أو الاشتراكات أو سعة الحجز أو التقييمات أو التواصل مع الموظفين أو ضوابط الأمان أو أنظمة ببلت. ويجوز لببلت تقييد الوصول لحماية العملاء والموظفين والمدفوعات والعمليات أو للامتثال القانوني، مع الحفاظ على حقوق العميل المعمول بها." }],
    },
    {
      id: "liability",
      title: { en: "14. Responsibility and applicable rights", ar: "١٤. المسؤولية والحقوق المعمول بها" },
      paragraphs: [{ en: "BubbleIt remains responsible to the extent required by Qatar law. Nothing in these Terms excludes or limits a right or liability that cannot legally be excluded or limited. Claims must be supported by reasonable information so they can be investigated fairly.", ar: "تظل ببلت مسؤولة بالقدر الذي يفرضه القانون القطري. ولا تستبعد هذه الشروط أو تحد أي حق أو مسؤولية لا يجوز قانوناً استبعادها أو الحد منها. ويجب دعم المطالبات بمعلومات معقولة لتمكين التحقيق فيها بصورة عادلة." }],
    },
    {
      id: "changes-law",
      title: { en: "15. Changes, governing law, and contact", ar: "١٥. التغييرات والقانون المعمول به والتواصل" },
      paragraphs: [{ en: "Material changes are versioned and communicated before they apply when required. A confirmed booking or order keeps its recorded policy version unless law requires otherwise. These Terms are governed by the laws of Qatar and disputes are subject to the competent courts of Qatar. The English and Arabic texts are one Terms version with the same legal meaning; neither language is independently maintained. Contact privacy@bubbleit.qa or the registered address in section 1.", ar: "تُسجّل التغييرات الجوهرية بإصدار جديد ويُبلّغ عنها قبل تطبيقها متى كان ذلك مطلوباً. ويحتفظ الحجز أو الطلب المؤكد بإصدار السياسة المسجل عليه ما لم يقتض القانون خلاف ذلك. تخضع هذه الشروط لقوانين دولة قطر وتختص محاكم قطر المختصة بالنزاعات. وتشكل الصياغتان الإنجليزية والعربية إصداراً واحداً من الشروط بالمعنى القانوني ذاته، ولا تُدار أي منهما بصورة مستقلة. يمكن التواصل عبر privacy@bubbleit.qa أو العنوان المسجل في البند ١." }],
    },
  ],
};

export const LEGAL_POLICIES: Record<LegalPolicyKind, LegalPolicy> = {
  privacy: PRIVACY_POLICY,
  terms: TERMS_POLICY,
};
