import { getFunnelHostUrl, getPlatformRoute } from "@/lib/surfaces/catalog";

export const platformHomeHref = "/";

/**
 * The learner's shelf. One constant, because it is referenced from six places
 * that must not drift: the header's learning entry, the header's brand link in
 * learning mode, the footer, the course view, the support bot, and the
 * installed app's start_url.
 *
 * A ROUTE since the shelf left the profile. It was `/profile#learning` — a hash
 * standing in for a page, which the back button did not step through, which
 * could not be prefetched, and which made `/learn` the one missing node in a
 * tree that already had `/learn/<course>/<lesson>`.
 */
export const LEARNING_SHELF_HREF = "/learn";

/**
 * The showcase bar.
 *
 * NO "Головна" ITEM. The brand mark sits immediately to its left and is a link
 * to the same place on every surface of the platform — a second control for
 * the same destination, right beside the first, only makes the bar longer.
 * Signed in and with the admin role, that bar was carrying SEVEN items across
 * a hero photograph; the ones that were left are the ones that go somewhere
 * the brand cannot.
 */
export const platformNav = [
  { label: "Діагностика", href: "/tests", match: "prefix" as const },
  { label: "Програми", href: "/programs", match: "prefix" as const },
  { label: "Продукти", href: "/products", match: "prefix" as const },
  { label: "Про автора", href: "/expert", match: "exact" as const },
];

/**
 * Shown only to someone who has courses.
 *
 * Deliberately NOT a sixth item in `platformNav`: that list is the showcase,
 * addressed to everybody, and it is the same for a signed-out visitor as for a
 * buyer. Learning is the opposite — it exists only if you own something, and
 * for the people it exists for it outranks every other item. Putting it in the
 * same array would either advertise an empty shelf to strangers or make the
 * showcase nav conditional on a fetch.
 *
 * Until this landed, the only route into a purchased course was avatar →
 * profile → the "Навчання" tab → the card → the lesson: four steps to the thing
 * that was paid for, and none of them named on the bar.
 */
export const learningNavItem = {
  label: "Навчання",
  href: LEARNING_SHELF_HREF,
  match: "prefix" as const,
};

/**
 * The admin entry. Rendered only for `user_roles.role` in {admin, support} —
 * see `isAdminRole`. Kept out of `platformNav` on purpose: that array is the
 * public showcase and is rendered for signed-out visitors, so an admin item in
 * it would be a link everyone sees and almost nobody may follow.
 *
 * `prefix`, because /admin has sub-routes and the entry should read as current
 * throughout them.
 */
export const adminNavItem = {
  label: "Адмінка",
  href: "/admin",
  match: "prefix" as const,
};

export const socialLinks = [
  { label: "YouTube", network: "youtube", href: "https://www.youtube.com/channel/UC0VPHLWTIXD3Rad5XkcyliA" },
  { label: "Telegram", network: "telegram", href: "https://telegram.me/E_Koriakin" },
  {
    label: "Facebook",
    network: "facebook",
    href: "https://www.facebook.com/people/%D0%95%D0%B2%D0%B3%D0%B5%D0%BD%D0%B8%D0%B9-%D0%9A%D0%BE%D1%80%D1%8F%D0%BA%D0%B8%D0%BD/pfbid0YaunkXwFi6MSSbgp7GjtxRMR7B3j6X9456AFwomQ7mLkracAdH9uCiKMxVYgkU8Ml/",
  },
  { label: "Instagram", network: "instagram", href: "https://www.instagram.com/evgeniy_koryakin/" },
];

export const contact = {
  phone: "+38 (063) 602 44 50",
  email: "centertheway@gmail.com",
};

const way21FunnelHref = getFunnelHostUrl("way21") ?? "/way21";
const consultFunnelHref = getFunnelHostUrl("consult") ?? "/consult";
const iremFunnelHref = getFunnelHostUrl("irem") ?? "/irem";
const rebootFunnelHref = getFunnelHostUrl("reboot") ?? "/reboot";
const resetDayFunnelHref = getFunnelHostUrl("reset-day") ?? "/reset-day";

export type PlatformOfferSurfaceType = "program" | "mini-course" | "product";
export type PlatformOfferConversionMode = "lead" | "direct-pay" | "hybrid" | "redirect";
export type PlatformOfferPrimaryActionKind = "enroll" | "buy";
export type PlatformOfferArtwork = {
  desktop: string;
  mobile?: string;
  altPreview?: string;
  desktopPosition?: string;
  mobilePosition?: string;
};

export const programs = [
  {
    slug: "reboot",
    surfaceType: "mini-course" as PlatformOfferSurfaceType,
    conversionMode: "direct-pay" as PlatformOfferConversionMode,
    primaryActionKind: "buy" as PlatformOfferPrimaryActionKind,
    // The names people actually meet: the funnel landing has run
    // "Short-Перезавантаження" as its h1 all along, and the course catalogue
    // (data/courses/reset-day.json) calls the other one "Розвантажувальний
    // день". The English placeholders on the platform were the odd ones out.
    title: "Short-Перезавантаження",
    fullTitle: "Short-Перезавантаження — тілесний міні-курс",
    href: getPlatformRoute("reboot") ?? "/programs/reboot",
    funnelHref: rebootFunnelHref,
    tag: "Міні-курс руху",
    duration: "короткий вхід",
    visual: "movement",
    artwork: {
      desktop: "/cw/platform/programs/reboot-card-v1.png",
      desktopPosition: "center 18%",
      mobilePosition: "center 18%",
    },
    description: "Короткий тілесний міні-курс: розігрів, увага, дихання і м'яке повернення енергії.",
    // Was two sentences about funnels and conversion surfaces — internal
    // architecture, printed to the buyer, and false the moment this page
    // started selling. Copy on an offer page answers the reader's question,
    // not the team's.
    longDescription:
      "Компактний вхід у тілесну практику CenterWay: короткі заняття, які реально втримати в буденному дні. Розігрів, увага до дихання, м'яка мобільність — без спортивного перевантаження і без вимоги перебудувати розклад.",
    results: [
      "почати з короткого безпечного входу без перевантаження",
      "зрозуміти базову логіку руху, уваги і дихання",
      "повернути відчуття енергії через коротку практику",
      "отримати ясний наступний крок до глибшої програми",
    ],
  },
  {
    slug: "way21",
    surfaceType: "program" as PlatformOfferSurfaceType,
    conversionMode: "lead" as PlatformOfferConversionMode,
    primaryActionKind: "enroll" as PlatformOfferPrimaryActionKind,
    title: "Шлях 21",
    fullTitle: "Детокс Програма «Шлях 21»",
    href: getPlatformRoute("way21") ?? "/programs/way21",
    funnelHref: way21FunnelHref,
    tag: "Очищення",
    duration: "21 день",
    visual: "water",
    artwork: {
      desktop: "/cw/platform/programs/way21-home-desktop-v1.png",
      mobile: "/cw/platform/programs/way21-home-mobile-v1.png",
      altPreview: "/cw/platform/programs/way21-home-alt-v1.png",
    },
    description: "21-денна аюрведична програма розвантаження: харчування, трави, режим і щоденні опори без жорсткого тиску.",
    longDescription:
      "Програма перекладає принципи аюрведичного очищення у структуровану 21-денну програму: підготовка, м'яке виведення перевантаження, підтримка травлення, трав'яний супровід і повернення до стабільного ритму. Це wellness-освіта і направлена практика, а не медичне лікування.",
    results: [
      "зрозуміти особистий ритм розвантаження і харчування",
      "підтримати травлення без крайніх обмежень",
      "зібрати простий режим сну, їжі, води і руху",
      "пройти програму з видимими межами методу і підтримкою",
      "вийти з програми з планом м'якого продовження",
    ],
  },
  {
    slug: "ideal-body",
    surfaceType: "program" as PlatformOfferSurfaceType,
    conversionMode: "lead" as PlatformOfferConversionMode,
    primaryActionKind: "enroll" as PlatformOfferPrimaryActionKind,
    title: "Ідеальне тіло з Аюрведою",
    fullTitle: "Ідеальне тіло з Аюрведою",
    href: "/programs/ideal-body",
    funnelHref: consultFunnelHref,
    tag: "Харчування",
    duration: "8 тижнів",
    visual: "stone",
    artwork: {
      desktop: "/cw/platform/programs/ideal-body-card-v1.png",
      desktopPosition: "center 16%",
      mobilePosition: "center 16%",
    },
    description: "8-тижнева програма харчування і тілесної стабілізації: вага, апетит, травлення і раціон під вашу конституцію.",
    longDescription:
      "Програма допомагає зібрати живе, комфортне тіло через ритм харчування, стабільну енергію і бережну корекцію звичок. Фокус - не зовнішній культ «ідеалу», а стійкі щоденні рішення, які можна втримати.",
    results: [
      "побачити зв'язок між конституцією, апетитом і режимом",
      "зменшити хаос у харчуванні без самокритики",
      "зібрати раціон, який легше повторювати щодня",
      "підтримати комфорт травлення і стабільність енергії",
      "мати план корекції, якщо вага або режим знову пливуть",
    ],
  },
  {
    slug: "irem",
    surfaceType: "program" as PlatformOfferSurfaceType,
    conversionMode: "lead" as PlatformOfferConversionMode,
    primaryActionKind: "enroll" as PlatformOfferPrimaryActionKind,
    title: "IREM Гімнастика",
    fullTitle: "Відновлююча гімнастика IREM",
    href: getPlatformRoute("irem") ?? "/programs/irem",
    funnelHref: iremFunnelHref,
    tag: "Рух",
    duration: "12 тижнів",
    visual: "mountain",
    artwork: {
      desktop: "/cw/platform/programs/irem-card-v1.png",
      desktopPosition: "center 16%",
      mobilePosition: "center 18%",
    },
    description: "12-тижнева рухова практика для контакту з тілом, м'якшої мобільності, енергії і зняття побутової напруги.",
    longDescription:
      "IREM збирає прості рухові техніки у послідовну практику: розігрів, дихання, мобільність, робота з напруженням і повернення уваги до сигналів тіла. Дванадцять тижнів ідуть по порядку, від простого до глибшого, щоб тіло встигало за темпом.",
    results: [
      "зрозуміти, як вбудувати коротку практику руху в день",
      "помічати напруження раніше і м'якше з ним працювати",
      "підтримати відчуття легкості, мобільності і дихання",
      "рухатися за структурою без спортивного перевантаження",
      "мати опору для продовження після основного циклу",
    ],
  },
  {
    slug: "herbs",
    surfaceType: "product" as PlatformOfferSurfaceType,
    conversionMode: "redirect" as PlatformOfferConversionMode,
    primaryActionKind: "buy" as PlatformOfferPrimaryActionKind,
    title: "Травʼяний збір",
    fullTitle: "Травʼяний збір CenterWay",
    href: getPlatformRoute("herbs") ?? "/products/herbs",
    funnelHref: getFunnelHostUrl("herbs") ?? "/herbs",
    tag: "Природна підтримка",
    duration: "підбір за станом",
    visual: "leaf",
    artwork: {
      desktop: "/cw/platform/aggregates/products-hero-v1.png",
      desktopPosition: "center 24%",
      mobilePosition: "center 22%",
    },
    description: "Трав'яні формули і м'яка природна підтримка, яку обирають за станом, ритмом і поточним етапом відновлення.",
    longDescription:
      "Трав'яна підтримка може бути доречною, коли потрібно м'яко підтримати травлення, ритм і щоденне самопочуття. Її важливо розглядати не окремо від життя, а разом із харчуванням, сном, практикою і вашим поточним станом — тоді продукт не стає випадковою покупкою без сенсу.",
    results: [
      "зрозуміти, коли трав'яна підтримка доречна, а коли ні",
      "побачити, як трави поєднуються з режимом, харчуванням і програмами",
      "отримати ясний наступний крок: консультація, підбір або окрема сторінка замовлення",
      "уникнути хаотичного вибору банок без контексту стану і меж методу",
    ],
  },
  {
    slug: "reset-day",
    surfaceType: "mini-course" as PlatformOfferSurfaceType,
    conversionMode: "direct-pay" as PlatformOfferConversionMode,
    primaryActionKind: "buy" as PlatformOfferPrimaryActionKind,
    title: "Розвантажувальний день",
    fullTitle: "Розвантажувальний день — практикум з умовного голодування",
    // Catalog cards lead to the platform page, checkout stays on the funnel —
    // the same split `reboot` uses. It also gives a buyer somewhere to land
    // that can tell them they already own the course.
    href: getPlatformRoute("reset-day") ?? "/programs/reset-day",
    funnelHref: resetDayFunnelHref,
    tag: "Міні-курс детоксу",
    duration: "1 день",
    visual: "stone",
    artwork: {
      desktop: "/cw/platform/programs/reset-day-card-v1.png",
      desktopPosition: "center 14%",
      mobilePosition: "center 16%",
    },
    description: "Один м'який день режиму, простого харчування і спостереження за сигналами тіла.",
    longDescription:
      "Reset Day дає м'який одноденний формат, щоб знизити перевантаження, впорядкувати режим і спокійно побачити сигнали тіла без різких обіцянок та жорсткого тиску.",
    results: [
      "спокійно увійти у практику без довгого зобов'язання",
      "побачити, як тіло реагує на прості зміни режиму",
      "зменшити харчовий шум і перевантаження на один день",
      "зафіксувати сигнали травлення, енергії і сну",
      "обрати наступний крок: консультація, Way 21 або підтримка",
    ],
  },
];

export const programPageBySlug = Object.fromEntries(programs.map((program) => [program.slug, program]));

export const platformProgramOffers = programs.filter((program) => program.surfaceType === "program");
export const platformMiniCourses = programs.filter((program) => program.surfaceType === "mini-course");
export const platformProductOffers = programs.filter((program) => program.surfaceType === "product");

export const platformAggregateArtwork = {
  programs: {
    desktop: "/cw/platform/aggregates/programs-hero-v1.png",
    desktopPosition: "center 18%",
    mobilePosition: "center 16%",
  },
  products: {
    desktop: "/cw/platform/aggregates/products-hero-v1.png",
    desktopPosition: "center 16%",
    mobilePosition: "center 18%",
  },
} satisfies Record<string, PlatformOfferArtwork>;

export const platformPageArtwork = {
  dosha: {
    /* Three doshas as three materials under one light: dry grass in matte
       ceramic, resin in patinated copper, still water and a leaf in dark
       stoneware. The portrait master is not a crop of the landscape one — it
       restages the same three centres tall, because a portrait viewport shows
       only about a third of a 16:10 plate and would drop two of the three. */
    desktop: "/shared/img/dosha-tridosha-2026-08.webp",
    mobile: "/shared/img/dosha-tridosha-portrait-2026-08.webp",
    desktopPosition: "center 42%",
    mobilePosition: "center 34%",
  },
  consult: {
    desktop: "/cw/platform/pages/consult-hero-v1.png",
    desktopPosition: "center 18%",
    mobilePosition: "center 16%",
  },
  expert: {
    desktop: "/cw/platform/pages/expert-hero-v1.png",
    desktopPosition: "center 16%",
    mobilePosition: "center 18%",
  },
} satisfies Record<string, PlatformOfferArtwork>;

export const featuredPrograms = platformProgramOffers;

export const miniCourses = [
  ...platformMiniCourses,
].filter(Boolean);

export const journeySteps = [
  { id: "center", title: "Центр", text: "Де мій живий ритм і що зараз важливо відновити?" },
  { id: "signals", title: "Сигнали тіла", text: "Які симптоми є мовою перевантаження, а не «поломкою»?" },
  { id: "method", title: "Метод", text: "Як працює м'яке відновлення через тіло, харчування і ритм?" },
  { id: "diagnostics", title: "Діагностика", text: "З якого персонального кроку варто почати саме мені?" },
  { id: "programs", title: "Програми", text: "Яка програма підходить моєму поточному стану?" },
  { id: "guide", title: "Провідник", text: "Хто веде цей процес і як відбувається супровід?" },
  { id: "stories", title: "Історії", text: "Які зміни проходять інші люди в реальних умовах?" },
  { id: "support-nature", title: "Природна підтримка", text: "Як трави і побутові ритуали підтримують процес?" },
  { id: "consultation", title: "Консультація", text: "Як отримати індивідуальні рекомендації і чіткий план?" },
];

export const bodySignals = [
  "втома, важкість, нестабільний сон і просідання енергії",
  "набряки, зміни ваги, складність утримувати ритм харчування",
  "дискомфорт травлення, шкіра як індикатор перевантаження",
  "втрата контакту з тілом, напруга і перевтома нервової системи",
];

export const platformEntryCards = [
  {
    label: "Стан",
    title: "Зрозуміти, що відбувається",
    text: "Почати не з програми, а з чесної картини: травлення, сон, енергія, шкіра, вага, рух і рівень напруги.",
    visual: "state",
  },
  {
    label: "Метод",
    title: "Побачити свою конституцію",
    text: "Тест доші і консультація допомагають перекласти симптоми в зрозумілу мову ритму, харчування і практики.",
    visual: "method",
  },
  {
    label: "Маршрут",
    title: "Обрати наступний крок",
    text: "Після орієнтації людина переходить до короткого входу, програми, консультації або окремої практики.",
    visual: "route",
  },
];

/* Glyph names from the baked set (scripts/lib/icon-glyphs.mjs). They used to be
   four hand-written Material-style paths inlined as CSS mask data-URIs — a
   second icon set, in a second hand, on the one block that is meant to read as
   the person behind the platform. */
export const expertFacts = [
  { label: "12 років практики", icon: "clock" as const },
  { label: "Магістр комплементарної медицини та інтегративної психології", icon: "shield-check" as const },
  { label: "Інструктор з йоги та практикуючий йогін", icon: "body" as const },
  { label: "Засновник центру Centerway", icon: "support" as const },
];

export const educationTimeline = [
  "Київський політехнічний інститут, інформатика і обчислювальна техніка.",
  "2009 р. - базовий курс класичного, антицелюлітного і дитячого масажу; повний курс тайського масажу.",
  "2010-2011 рр. - Інститут натуральної медицини, Ганновер, спеціальність «бакалавр натуральної медицини».",
  "2010-2013 рр. - оздоровчий центр Healsyjoy: китайські масажні техніки, гуа-ша, хіромасаж живота, моделювання і лімфодренаж обличчя.",
  "2012 р. - Чакрапані аюрведа-клініка, напрям «аюрведична марма-терапія».",
  "2012-2013 рр. - Інститут міждисциплінарних досліджень і освіти, Ганновер: магістр комплементарної медицини і інтегративної психології.",
  "Магістерська робота: «Способи корекції ваги і очищення організму з допомогою засобів аюрведи».",
  "2014 р. - засновано центр Centerway.",
  "2016 р. - Сіббі Керала Аюрведа-центр, Індія: аюрведична дієтологія, стиль життя і йога-терапія.",
  "2017 р. - орден «Заслужений натуропат Європи».",
];

export const expertStory = [
  "Привіт! Давайте знайомитись: я - Євгеній Корякін, дослідник і практик аюрведи, магістр комплементарної медицини і засновник центру Centerway.",
  "У дитинстві я хотів бути лікарем, а питання здоров'я і розвитку фізичної форми людини цікавили мене завжди. Любов до фізкультури і філософських наук підштовхнула мене до вивчення тіла людини як предмета вищого творіння.",
  "Технічна освіта не задовольняла сутність мого внутрішнього світу. Я почав цікавитись йогою і масажем, а практики і філософія показали мені шлях. Масаж став провідником у світ тонкого устрою реальності - у світ без слів і концепцій.",
];

export const personalFacts = [
  "Я вегетаріанець, але їм яйця.",
  "Йога - невід'ємний аспект мого життя.",
  "Люблю подорожувати і роблю це багато років підряд.",
  "Мені близька філософія аскетизму.",
  "Люблю філософію і релігію, але не відношу себе до жодної конкретної релігії.",
  "Тричі проходив десятиденний віпасана-ретрит.",
  "Мрію про утопічний ретрит-центр для відновлення після міської метушні.",
];

export const doshas = [
  {
    title: "Харчування",
    text: "Їжа під конституцію і поточний стан: не контроль заради контролю, а ясний ритм, який підтримує енергію.",
  },
  {
    title: "Очищення",
    text: "М'яке звільнення від накопиченого перевантаження без насильства над тілом і без екстремальних режимів.",
  },
  {
    title: "Практика і ритм",
    text: "Рух, дихання, сон і побутові опори повертають зібраність, легкість і стабільний контакт із собою.",
  },
];

export const consultationCopy = {
  title: "Особиста консультація з Євгенієм Корякіним",
  text: "Не «просто порада», а персональний план відновлення: стан, конституція, харчування, очищення, ритм і наступні кроки без зайвого тиску.",
};

/* Each note carries its own glyph. A column of three text plates reads as a
   wall — the icon is what lets the eye tell them apart before reading, and it
   comes from the baked set so it is the same hand as everything else. */
export const proofItems = [
  { icon: "day" as const, text: "Коли з'являється ясний план, легше втримувати харчування, сон і щоденний ритм без самокритики." },
  { icon: "rhythm" as const, text: "Практики працюють не як одноразовий ривок, а як повторювані дії, які поступово повертають опору." },
  { icon: "support" as const, text: "Найціннішим для учасників часто стає не швидкий результат, а розуміння, що робити далі у звичайному житті." },
];

export const naturalSupportItems = [
  { icon: "leaf" as const, text: "Трави - не «магічний продукт», а природна підтримка процесу очищення і відновлення." },
  { icon: "vata" as const, text: "Підбір має спиратися на стан, конституцію і поточний ритм, а не на універсальну схему для всіх." },
  { icon: "bowl" as const, text: "Трави доречні тоді, коли вони підтримують основне, а не замінюють харчування, сон і практику." },
];

export const legal = {
  publicOffer:
    "Цей договір є офіційною та публічною пропозицією укласти договір щодо купівлі та надання цифрових онлайн-продуктів, представлених на сайті CenterWay та його піддоменах.",
  privacy:
    "Політика конфіденційності описує, як CenterWay збирає, використовує та захищає інформацію користувачів, які взаємодіють із сайтом, формами, оплатами та супутніми сервісами.",
};
