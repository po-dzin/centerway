import type { PlatformOfferArtwork } from "@/lib/platform/content";

export type PlatformTestStatus = "active" | "planned";

export type PlatformTestEntry = {
  slug: string;
  /** Slug of the test definition in the database, null while the test is only planned. */
  apiSlug: string | null;
  /** Route of the test surface; null while the test has no surface yet. */
  href: string | null;
  title: string;
  tag: string;
  format: string;
  description: string;
  /** What the test reads about the state — the hub's "як читати" column. */
  reads: string;
  visual: string;
  artwork?: PlatformOfferArtwork;
  status: PlatformTestStatus;
};

export const TESTS_HUB_ROUTE = "/tests";
export const DOSHA_TEST_ROUTE = "/tests/dosha";
export const LEGACY_DOSHA_TEST_ROUTE = "/dosha-test";

export const platformTests: PlatformTestEntry[] = [
  {
    slug: "dosha",
    apiSlug: "dosha-test",
    href: DOSHA_TEST_ROUTE,
    title: "Тест доші",
    tag: "Конституція",
    format: "12 питань • 3-5 хв",
    description:
      "Самодіагностика ритму, енергії, травлення і напруги: короткий профіль доші як робоча гіпотеза і перший доречний маршрут у платформі.",
    reads: "ритм, енергія, травлення, сон, напруга",
    visual: "stone",
    artwork: {
      desktop: "/cw/platform/pages/dosha-hero-variant-ceramic-v1.png",
      desktopPosition: "center 32%",
      mobilePosition: "center 34%",
    },
    status: "active",
  },
  {
    slug: "agni",
    apiSlug: null,
    href: null,
    title: "Стан травлення",
    tag: "Травлення",
    format: "готуємо",
    description:
      "Окремий зріз про апетит, регулярність і реакцію на їжу — щоб бачити, що саме зараз перевантажує травлення, а не лише загальний тип конституції.",
    reads: "апетит, регулярність, реакція на їжу",
    visual: "leaf",
    status: "planned",
  },
  {
    slug: "overload",
    apiSlug: null,
    href: null,
    title: "Рівень перевантаження",
    tag: "Нервова система",
    format: "готуємо",
    description:
      "Зріз про втому, сон і темп: коли ресурс ще тримається, а коли режим уже працює проти вас і потрібна не програма, а пауза.",
    reads: "втома, сон, темп, відновлення",
    visual: "water",
    status: "planned",
  },
  {
    slug: "rhythm",
    apiSlug: null,
    href: null,
    title: "Ритм дня",
    tag: "Режим",
    format: "готуємо",
    description:
      "Зріз про побутові опори: час сну, їжі, руху і пауз — щоб побачити, які прості зміни режиму дадуть найбільше при найменшому тиску.",
    reads: "сон, їжа, рух, побутові опори",
    visual: "mountain",
    status: "planned",
  },
];

export const platformTestBySlug = Object.fromEntries(platformTests.map((test) => [test.slug, test]));

export const activePlatformTests = platformTests.filter((test) => test.status === "active");
export const plannedPlatformTests = platformTests.filter((test) => test.status === "planned");

export const testsHubCopy = {
  badge: "Стан · Гіпотеза · Маршрут",
  title: "Діагностика CenterWay",
  lead:
    "Тести не ставлять діагноз. Вони перекладають ваш поточний стан у зрозумілу мову ритму, харчування і практики — і показують, з якого кроку доречно починати.",
  readingLabel: "Як читати результат",
  readingItems: [
    "результат тесту — це робоча гіпотеза про ваш стан, а не медичний висновок;",
    "гіпотеза потрібна не для ярлика, а для вибору першого кроку: практика, програма або консультація;",
    "стан змінюється, тому тест доречно повторювати, коли змінюються сон, харчування або навантаження;",
    "якщо симптоми стійкі або гострі — спочатку лікар, і лише потім режим і практика.",
  ],
  activeLabel: "Доступні тести",
  activeTitle: "З чого можна почати вже зараз",
  plannedLabel: "Готуються",
  plannedTitle: "Наступні зрізи стану",
  plannedNote: "Ці тести ще збираються. Поки що їхні питання частково закриває тест доші і консультація.",
  bridgeLabel: "Жива діагностика",
  bridgeTitle: "Коли тесту недостатньо",
  bridgeLead:
    "Тест дає напрямок, але не читає контекст: історію, обмеження, поточні навантаження і те, що вже пробували. Для цього є консультація — там стан збирається разом і маршрут стає персональним.",
  bridgeCta: "Подивитися формат консультації",
  soonLabel: "Скоро",
};
