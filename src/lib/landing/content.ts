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
    description: "7 простих вправ, що за 10 хвилин відновлюють тіло та розум.",
    hero: {
      badge: "АВТОРСЬКИЙ КУРС",
      title: "Short-Перезавантаження",
      subtitle: "7 простих вправ, що за 10 хвилин відновлюють тіло та розум",
      lead: "Інтегруйте цей метод в своє життя і ви отримаєте:",
      chips: [
        "Зниження стресу та покращення сну",
        "Збільшення рівня енергії",
        "Зміцнення здоров'я",
      ],
      note: "Цей метод розроблений та практикується моїм вчителем протягом 44 років",
      ctaPrimaryLabel: "Хочу на курс",
      ctaStickyLabel: "Хочу на курс",
      priceCurrent: "359 грн",
      priceOld: "799 грн",
      cta: {
        primary: "Хочу на курс",
        sticky: "Хочу на курс",
        note: "Підходить і новачкам, і практикуючим",
      },
      price: {
        preface: "Почніть вже сьогодні 👇",
        old: "799 грн",
        current: "359 грн",
        notes: ["Доступ назавжди", "300+ людей пройшли курс"],
      },
    },
    utility: {
      thanks: {
        botUrl: "https://t.me/ShortRebootBot?start=ZGw6MjA1MTc3",
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
      badge: "Авторська методика",
      title: "ІВЕМ гімнастика",
      subtitle:
        "Інтегральна відновлювальна енергомодулююча гімнастика (‘ІВЕМ-гімнастика’) – система щоденних вправ для енергії, тонусу та стабільного стану",
      lead: "Ключові переваги",
      chips: ["Універсальний інструмент", "Без спеціальної підготовки", "Підходить для будь-якого віку"],
      note: "🌀 Система поєднує рух, дихання й відновлення без перевантаження",
      ctaPrimaryLabel: "Приєднатися",
      ctaStickyLabel: "Приєднатися",
      priceCurrent: "4100 грн",
      priceOld: null,
      cta: {
        primary: "Приєднатися",
        sticky: "Приєднатися",
        note: null,
      },
      price: {
        preface: null,
        old: null,
        current: "4100 грн",
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
