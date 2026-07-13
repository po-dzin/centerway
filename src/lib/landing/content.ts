import type { StaticLandingProduct } from "@/lib/landing/types";

type LandingUtilityContent = {
  thanks: {
    botUrl: string;
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
      ctaPrimaryLabel: "Хочу на курс",
      ctaStickyLabel: "Хочу на курс",
      priceCurrent: "795 грн",
      priceOld: null,
      cta: {
        primary: "Хочу на курс",
        sticky: "Хочу на курс",
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
        botUrl: "https://t.me/ShortRebotBot?start=6a1b2e01f73e6df7570fff07",
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
      title: "Одна практика <em>замість п'яти</em> — під ваші біоритми.",
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
        botUrl: "https://t.me/IREM_gymnastic_Bot?start=ZGw6MjA1MTY4",
        siteUrl: "https://irem.centerway.net.ua/",
      },
      payFailed: {
        retryUrl: "https://irem.centerway.net.ua/",
      },
    },
  },
};
