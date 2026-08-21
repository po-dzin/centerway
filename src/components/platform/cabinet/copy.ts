/**
 * Cabinet-only strings.
 *
 * The pre-LMS profile copy (`../profile/copy.ts`) still carries the shared
 * states — loading, auth wall, dosha labels, contact field names — and is reused
 * as-is. This file adds only what the cabinet introduced: section navigation,
 * the learning shelf and its lesson links.
 */

import type { ProfileLang } from "../profile/types";

export type CabinetSection = "overview" | "learning" | "tests" | "products" | "account";

export type CabinetCopy = {
  nav: Record<CabinetSection, string>;
  navAria: string;

  continueTitle: string;
  continueLead: string;
  continueAction: string;
  startAction: string;
  openCourseMap: string;
  reviewAction: string;

  learningTitle: string;
  learningLabel: string;
  learningEmptyTitle: string;
  learningEmptyLead: string;
  browsePrograms: string;

  stepsOf: (done: number, total: number) => string;
  coursesCount: (count: number) => string;
  productsCount: (count: number) => string;
  dayNumber: (day: number) => string;
  courseFinished: string;
  courseNotStarted: string;
  courseDraft: string;
  courseLocked: string;
  courseExpired: string;
  nextStepLabel: string;
  startedAtLabel: string;
  openProgramPage: string;

  testsLabel: string;
  testsTitle: string;
  testsLead: string;
  testPlanned: string;
  testPassed: string;
  testOpen: string;

  accountLabel: string;
  accountEntry: string;
  accountTitle: string;
  accountLead: string;

  notificationsTitle: string;
  notificationsLinked: string;
  notificationsMissing: string;
  connectTelegram: string;
  notificationsUnavailable: string;

  installTitle: string;
  installLead: string;
  installAction: string;
  installIosLead: string;
  installIosSteps: string[];

  shelfErrorTitle: string;
  shelfErrorLead: string;
  retry: string;
};

/** Ukrainian counts take three forms: 1 курс, 2 курси, 5 курсів. */
function ukPlural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function getCabinetCopy(lang: ProfileLang): CabinetCopy {
  if (lang === "en") {
    return {
      nav: {
        overview: "Overview",
        learning: "Learning",
        tests: "Tests",
        products: "Products",
        account: "Account",
      },
      navAria: "Cabinet sections",

      continueTitle: "Continue where you stopped",
      continueLead: "Your next step is already open.",
      continueAction: "Continue",
      startAction: "Start the course",
      openCourseMap: "Course map",
      reviewAction: "Open again",

      learningTitle: "My courses",
      learningLabel: "Learning",
      learningEmptyTitle: "No courses in this profile yet",
      learningEmptyLead: "Once a program is purchased, it opens here — with lessons, progress and the next step.",
      browsePrograms: "Browse programs",

      stepsOf: (done, total) => `${done} of ${total} steps`,
      coursesCount: (count) => (count === 1 ? "1 course" : `${count} courses`),
      productsCount: (count) => (count === 1 ? "1 product" : `${count} products`),
      dayNumber: (day) => `Day ${day}`,
      courseFinished: "Completed",
      courseNotStarted: "Not started",
      courseDraft: "Draft — preview access",
      courseLocked: "No access yet",
      courseExpired: "Access expired",
      nextStepLabel: "Next step",
      startedAtLabel: "Started",
      openProgramPage: "About the program",

      testsLabel: "Tests",
      testsTitle: "Diagnostics and results",
      testsLead: "Your results stay in the profile and shape what is suggested next.",
      testPlanned: "In preparation",
      testPassed: "Completed",
      testOpen: "Open the test",

      accountLabel: "Account",
      accountEntry: "Account settings",
      accountTitle: "Account and contacts",
      accountLead: "The fields orders and access notifications are matched against.",

      notificationsTitle: "Course reminders",
      notificationsLinked: "Telegram is connected — step reminders arrive there.",
      notificationsMissing:
        "No delivery channel is connected, so course reminders will not reach you. Connect Telegram in one tap.",
      connectTelegram: "Connect Telegram",
      notificationsUnavailable: "Reminder delivery is temporarily unavailable. Nothing is lost — try again later.",

      installTitle: "Add CenterWay to your home screen",
      installLead:
        "It opens as an app — full screen, with its own icon, and your courses stay one tap away.",
      installAction: "Add",
      installIosLead: "On iPhone and iPad the browser adds it, in two steps:",
      installIosSteps: ["Tap Share in the Safari toolbar.", "Choose “Add to Home Screen”."],

      shelfErrorTitle: "Could not load your courses",
      shelfErrorLead: "The rest of the profile is shown — try loading the courses again.",
      retry: "Try again",
    };
  }

  return {
    nav: {
      overview: "Огляд",
      learning: "Навчання",
      tests: "Тести",
      products: "Продукти",
      account: "Акаунт",
    },
    navAria: "Розділи кабінету",

    continueTitle: "Продовжити з місця зупинки",
    continueLead: "Наступний урок уже відкритий.",
    continueAction: "Продовжити",
    startAction: "Почати курс",
    openCourseMap: "Карта курсу",
    reviewAction: "Відкрити знову",

    learningTitle: "Мої курси",
    learningLabel: "Навчання",
    learningEmptyTitle: "У профілі ще немає курсів",
    learningEmptyLead: "Після придбання програма відкривається тут — з уроками, поступом і наступним уроком.",
    browsePrograms: "Подивитися програми",

    stepsOf: (done, total) => `${done} з ${total} уроків`,
    coursesCount: (count) => `${count} ${ukPlural(count, "курс", "курси", "курсів")}`,
    productsCount: (count) => `${count} ${ukPlural(count, "продукт", "продукти", "продуктів")}`,
    dayNumber: (day) => `День ${day}`,
    courseFinished: "Пройдено",
    courseNotStarted: "Ще не розпочато",
    courseDraft: "Чернетка — доступ на перегляд",
    courseLocked: "Доступу поки немає",
    courseExpired: "Термін доступу минув",
    nextStepLabel: "Наступний урок",
    startedAtLabel: "Старт",
    openProgramPage: "Про програму",

    testsLabel: "Тести",
    testsTitle: "Діагностика і результати",
    testsLead: "Результати лишаються в профілі і впливають на те, що пропонується далі.",
    testPlanned: "Готується",
    testPassed: "Пройдено",
    testOpen: "Пройти тест",

    accountLabel: "Акаунт",
    accountEntry: "Налаштування акаунта",
    accountTitle: "Акаунт і контакти",
    accountLead: "Поля, за якими зіставляються замовлення і повідомлення про доступ.",

    notificationsTitle: "Нагадування про курс",
    notificationsLinked: "Telegram підключено — нагадування про уроки приходять туди.",
    notificationsMissing:
      "Канал доставки не підключено, тому нагадування про уроки курсу до вас не дійдуть. Підключити Telegram — один дотик.",
    connectTelegram: "Підключити Telegram",
    notificationsUnavailable: "Доставка нагадувань тимчасово недоступна. Нічого не втрачено — спробуйте пізніше.",

    installTitle: "Додати CenterWay на екран телефона",
    installLead:
      "Відкриватиметься як застосунок — на весь екран, з власною іконкою, і шлях лишається за один дотик.",
    installAction: "Додати",
    installIosLead: "На iPhone та iPad застосунок додає сам браузер, у два кроки:",
    installIosSteps: ["Натисніть «Поділитися» на панелі Safari.", "Оберіть «На початковий екран»."],

    shelfErrorTitle: "Не вдалося завантажити курси",
    shelfErrorLead: "Решта профілю показана — спробуйте завантажити курси ще раз.",
    retry: "Спробувати ще раз",
  };
}
