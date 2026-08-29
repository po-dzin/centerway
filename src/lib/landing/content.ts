import type { StaticLandingProduct } from "@/lib/landing/types";

type LandingUtilityContent = {
  thanks: {
    /* Where a paid buyer is sent from the funnel's own thanks page. It named a
       Telegram bot until 2026-08-29 — Short and IREM were delivered there — and
       it is the course in the cabinet now, the same address the receipt email
       links to. */
    courseUrl: string;
    siteUrl: string;
  };
  payFailed: {
    retryUrl: string;
  };
};

type LandingHeroPriceContent = {
  preface: string | null;
  old: string | null;
  current: string;
  notes: string[];
};

type LandingHeroCtaContent = {
  primary: string;
  sticky: string;
  note: string | null;
};

type LandingHeroContent = {
  badge: string;
  title: string;
  subtitle: string;
  lead: string | null;
  chips: string[];
  note: string | null;
  ctaPrimaryLabel: string;
  ctaStickyLabel: string;
  priceCurrent: string;
  priceOld: string | null;
  cta: LandingHeroCtaContent;
  price: LandingHeroPriceContent;
};

export type LandingProductContent = {
  title: string;
  description: string;
  hero: LandingHeroContent;
  utility: LandingUtilityContent;
};

export const LANDING_CONTENT: Record<StaticLandingProduct, LandingProductContent> = {
  short: {
    title: "Short-Перезавантаження",
    description:
      "3 комплекси вправ. Швидко відновлюють тіло та розум. Всього 15 хвилин на день.",
    hero: {
      badge: "АВТОРСЬКИЙ КУРС",
      title: "Short-Перезавантаження",
      subtitle:
        "3 комплекси вправ. Швидко відновлюють тіло та розум. Всього 15 хвилин на день.",
      lead: "Інтегруйте цей метод в своє життя і ви отримаєте:",
      chips: [
        "Зниження стресу та покращення сну",
        "Збільшення рівня енергії",
        "Зміцнення здоров'я",
      ],
      note: "Цей метод розроблений та практикується моїм вчителем протягом 44 років",
      ctaPrimaryLabel: "Почати відновлення",
      ctaStickyLabel: "Почати відновлення",
      priceCurrent: "795 грн",
      priceOld: null,
      cta: {
        primary: "Почати відновлення",
        sticky: "Почати відновлення",
        note: "Підходить і новачкам, і практикуючим",
      },
      price: {
        preface: "Почніть вже сьогодні 👇",
        old: null,
        current: "795 грн",
        notes: ["500+ людей вже придбали курс і почали відновлення"],
      },
    },
    utility: {
      thanks: {
        courseUrl: "https://my.centerway.net.ua/learn/short",
        siteUrl: "https://reboot.centerway.net.ua/",
      },
      payFailed: {
        retryUrl: "https://reboot.centerway.net.ua/",
      },
    },
  },
  irem: {
    title: "ІВЕМ-гімнастика",
    description:
      "Інтегральна відновлювальна енергомодулююча гімнастика для енергії, тонусу та стабільного стану.",
    hero: {
      badge: "Ця система розроблена та практикується моїм вчителем щодня протягом 44 років",
      title: "Унікальна інтегральна система <em>психофізичної саморегуляції</em>",
      subtitle:
        "Сила, гнучкість, витривалість та відновлення — одна практика, яка щодня змінює фокус під ваш стан. Тому її не кидають.",
      lead: null,
      chips: ["Без спеціальної підготовки", "Будь-який вік", "60 хв удома", "Рух · дихання · увага"],
      note: "Гарантія результату 14 днів або повернення коштів",
      ctaPrimaryLabel: "Почати практику",
      ctaStickyLabel: "Почати практику",
      priceCurrent: "3950 грн",
      priceOld: null,
      cta: {
        primary: "Почати практику",
        sticky: "Почати практику",
        note: null,
      },
      price: {
        preface: null,
        old: null,
        current: "3950 грн",
        notes: [],
      },
    },
    utility: {
      thanks: {
        courseUrl: "https://my.centerway.net.ua/learn/irem-gymnastics",
        siteUrl: "https://irem.centerway.net.ua/",
      },
      payFailed: {
        retryUrl: "https://irem.centerway.net.ua/",
      },
    },
  },
};
