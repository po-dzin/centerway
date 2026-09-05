import type { CwIconName } from "@/components/iconNames";
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

export type NavItem = { label: string; href: string; match: "exact" | "prefix" };

/** The public platform bar. `Головна` is intentionally explicit here. */
export const platformNav: NavItem[] = [
  { label: "Головна", href: platformHomeHref, match: "exact" },
  { label: "Діагностика", href: "/tests", match: "prefix" as const },
  { label: "Програми", href: "/programs", match: "prefix" as const },
  { label: "Продукти", href: "/products", match: "prefix" as const },
  /* «Консультація», not «Про автора». The page merged the two on 2026-08-23 and
     the topbar names what a reader can DO there — the author's credentials are
     the evidence on that page, not a fifth destination. `prefix`, because the
     merged surface is the one `/consult` now serves whole. */
  { label: "Консультація", href: "/consult", match: "prefix" as const },
];

/**
 * The bar on the personal host.
 *
 * `my` is an application rather than a public route map: it keeps only the
 * learner shelf and authoring workspace. Public navigation belongs to `www`
 * and is deliberately not repeated over a person's own courses or lessons.
 */
export const builderNavItem: NavItem = { label: "Майстерня", href: "/build", match: "prefix" };

export const personalNav: NavItem[] = [
  { label: "Бібліотека", href: LEARNING_SHELF_HREF, match: "exact" },
  builderNavItem,
];

/** The account switcher's learning destination; not a public route-map item. */
export const learningNavItem = {
  label: "Бібліотека",
  href: LEARNING_SHELF_HREF,
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

export type PlatformOfferSurfaceType = "program" | "mini-course" | "product";
export type PlatformOfferConversionMode = "lead" | "direct-pay" | "hybrid" | "redirect";
export type PlatformOfferPrimaryActionKind = "enroll" | "buy";
/* Two masters, one scene. `mobile` is the phone plate — a flat lay looking
   straight down at the surface. `desktop` is the same objects, the same ground
   and the same light restaged as a space: high three-quarter angle, near and
   far, one window light, and the left half of the frame left empty because
   that is where the headline sits. It is not a crop of the portrait — a 3:2
   box cut out of a 9:19 plate keeps about a fifth of the composition, which is
   what every offer except way21 shipped until 2026-08-27. Offer cards read
   `desktop` at every width (see PlatformOfferCard); only the standalone offer
   hero swaps to `mobile`, below 900px portrait. */
export type PlatformOfferArtwork = {
  desktop: string;
  /**
   * The same picture at 960px, for the places that draw it small.
   *
   * A program card in the catalogue grid is about 370 CSS pixels wide and was
   * drawing the full 1600px plate as a background — six of those on the home
   * page measured at just over a megabyte. Named rather than derived from
   * `desktop`: a rule like "append -960" is a promise about a file that exists
   * nowhere in the type system, and it fails as a 404 on a public page. Written
   * out, it is checked by `npm run guard:assets` like every other path here.
   *
   * Optional because not every plate has one: a small original stays one file.
   * `desktop` is the fallback, which is exactly what happened before.
   */
  card?: string;
  mobile?: string;
  altPreview?: string;
  desktopPosition?: string;
  mobilePosition?: string;
  /** Vertical focus past 16:9 — see the hero framing contract. */
  widePosition?: string;
  /**
   * The magnification each of those focal points is read at, 1–4. Absent means
   * 1, which is `cover` and is what every hand-written plate in this file is:
   * the zoom exists for covers an author uploaded whole and framed in the
   * builder, not for artwork already cropped before it reached the repo.
   */
  desktopScale?: number;
  mobileScale?: number;
  wideScale?: number;
};

export const programs = [
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
      desktop: "/cw/platform/aggregates/products-hero-v1.webp",
      card: "/cw/platform/aggregates/products-hero-v1-960.webp",
      desktopPosition: "center 24%",
      mobilePosition: "center 22%",
    },
    description: "Трав'яні формули і м'яка природна підтримка, яку обирають за станом, ритмом і поточним етапом відновлення.",
    /* The three lines a reader needs before they can judge whether this product
       is for them — appropriateness, limits, context. They used to be a prose
       block ABOVE the card (`naturalSupportItems`, plus a "Як читати" panel on
       /products), which meant the home page argued about herbs for three
       paragraphs before showing one. Carried on the offer itself so the next
       product to land brings its own set instead of needing a panel written for
       it. See `points` on PlatformOfferCard. */
    points: [
      "Доречно: м'яка підтримка травлення, ритму і щоденного самопочуття.",
      "Не замінює: діагностику, лікаря і власне харчування, сон та практику.",
      "Підбір за станом і конституцією, не за універсальною схемою.",
    ],
    longDescription:
      "Трав'яна підтримка може бути доречною, коли потрібно м'яко підтримати травлення, ритм і щоденне самопочуття. Її важливо розглядати не окремо від життя, а разом із харчуванням, сном, практикою і вашим поточним станом — тоді продукт не стає випадковою покупкою без сенсу.",
    results: [
      "Зрозуміти, коли трав'яна підтримка доречна, а коли ні",
      "Побачити, як трави поєднуються з режимом, харчуванням і програмами",
      "Отримати ясний наступний крок: консультація, підбір або окрема сторінка замовлення",
      "Уникнути хаотичного вибору банок без контексту стану і меж методу",
    ],
  },
  /* NOTHING HERE IS A COURSE ANY MORE (2026-08-29). `herbs` is the last entry
     and it is a product — a jar, not a syllabus, with no author, no lessons and
     nothing in `lms_courses` to read it from.

     The five courses that used to sit above it left one at a time, each for the
     same reason: the database already said what this array claimed, and better.
     reset-day went first (2026-08-26) while this file still insisted it was one
     day and the funnel selling it said three. way21 and natural-body followed —
     way21's long description, the line that says this is wellness education and
     not medical treatment, moved onto the course `summary` rather than being
     dropped, and its 1 UAH test charge became the `course:way21` offer row so
     the dynamic route had a price to read. reboot and irem came last, and they
     are the two that prove why the ADDRESS is not the course slug: they are
     sold at /programs/reboot and /programs/irem while their rows are named
     `short` and `irem-gymnastics`. Neither has an offer row, because neither is
     delivered by the platform — both still fulfil through a Telegram bot, and
     both keep charging the hand-written `PRODUCTS` code through
     `resolveOfferCommerce`. Moving the page did not move the delivery.

     What is left in this file is layout, navigation, artwork and copy that
     belongs to no course. A new offer does not come here; it comes out of the
     builder. */
];

export const programPageBySlug = Object.fromEntries(programs.map((program) => [program.slug, program]));

/* The programme and mini-course selectors are gone with the entries they
   selected: `programs` holds one product and no courses, so both would be a
   constant `[]` shipped to a rail that reads the database instead. */
export const platformProductOffers = programs.filter((program) => program.surfaceType === "product");

export const platformAggregateArtwork = {
  programs: {
    desktop: "/cw/platform/aggregates/programs-hero-v1.webp",
    card: "/cw/platform/aggregates/programs-hero-v1-960.webp",
    desktopPosition: "center 18%",
    mobilePosition: "center 16%",
  },
  products: {
    desktop: "/cw/platform/aggregates/products-hero-v1.webp",
      card: "/cw/platform/aggregates/products-hero-v1-960.webp",
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
    desktop: "/cw/platform/pages/consult-hero-v1.webp",
    card: "/cw/platform/pages/consult-hero-v1-960.webp",
    desktopPosition: "center 18%",
    mobilePosition: "center 16%",
  },
  expert: {
    desktop: "/cw/platform/pages/expert-hero-v1.webp",
    card: "/cw/platform/pages/expert-hero-v1-960.webp",
    desktopPosition: "center 16%",
    mobilePosition: "center 18%",
  },
} satisfies Record<string, PlatformOfferArtwork>;

export const journeySteps = [
  { id: "center", title: "Центр", text: "Де мій живий ритм і що зараз важливо відновити?" },
  { id: "signals", title: "Сигнали тіла", text: "Які симптоми є мовою перевантаження, а не «поломкою»?" },
  { id: "method", title: "Метод", text: "Як працює м'яке відновлення через тіло, харчування і ритм?" },
  { id: "diagnostics", title: "Діагностика", text: "З якого персонального кроку варто почати саме мені?" },
  { id: "programs", title: "Матеріали й курси", text: "Який формат підходить моєму поточному стану?" },
  { id: "guide", title: "Провідник", text: "Хто веде цей процес і як відбувається супровід?" },
  { id: "stories", title: "Історії", text: "Які зміни проходять інші люди в реальних умовах?" },
  { id: "support-nature", title: "Природна підтримка", text: "Як трави і побутові ритуали підтримують процес?" },
  { id: "consultation", title: "Консультація", text: "Як отримати індивідуальні рекомендації і чіткий план?" },
];

export const bodySignals = [
  "Втома, важкість, нестабільний сон і просідання енергії",
  "Набряки, зміни ваги, складність утримувати ритм харчування",
  "Дискомфорт травлення, шкіра як індикатор перевантаження",
  "Втрата контакту з тілом, напруга і перевтома нервової системи",
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

/* ── The guides ───────────────────────────────────────

   ONE AUTHOR, WRITTEN AS A LIST, on purpose. The platform is moving to more
   than one author — `lms_authors` already exists, a course carries an
   `author_profile_id`, and the builder is edited by whoever owns the course —
   but the home page still had Євгеній hard-coded into the block's markup: his
   photo, his sentence and his four facts inline, in a panel shaped for exactly
   one person. A second author would have needed the block rewritten rather
   than a row added.

   So the block reads a list. It has one entry today, and the card it renders is
   built to look finished alone (the rail gives a lone card the panorama shape,
   the same switch the products block uses) — not like a grid with the other
   three missing. When these come from `lms_authors`, only the source changes.

   `href` is on the record rather than derived: the founder's profile is
   `/consult` (see the `/expert` merge, 2026-08-23), and the next author's will
   be `/expert/<slug>`. A rule that has one exception on day one is not a rule. */
export type PlatformGuide = {
  slug: string;
  name: string;
  /** What they are, in the line under the name — not a job title, a practice. */
  role: string;
  /** One sentence: why this person, for this. */
  note: string;
  photo: { src: string; alt: string };
  href: string;
  linkLabel: string;
  facts: { label: string; icon: CwIconName }[];
};

export const platformGuides = [
  {
    slug: "evgeniy-koryakin",
    name: "Євгеній Корякін",
    role: "Дослідник і практик аюрведи · засновник CenterWay",
    note: "Веде програми, консультації і супровід практики — від першої діагностики стану до довгих циклів відновлення.",
    photo: { src: "/shared/img/author-evgeniy-2026-08.webp", alt: "Євгеній Корякін" },
    href: "/consult",
    linkLabel: "Більше про автора",
    facts: [
      { label: "12 років практики", icon: "clock" },
      { label: "Магістр комплементарної медицини та інтегративної психології", icon: "shield-check" },
      { label: "Інструктор з йоги та практикуючий йогін", icon: "body" },
    ],
  },
] satisfies PlatformGuide[];




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
  /* No name in the hero title since the 2026-08-22 merge with /expert — the
     page now carries a full author section (facts, path, portrait) a few
     scrolls down, so the title repeating "з Євгенієм Корякіним" was saying the
     same thing twice on one page. The name still opens the body copy just
     below and the metadata title. */
  title: "Особиста консультація",
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
