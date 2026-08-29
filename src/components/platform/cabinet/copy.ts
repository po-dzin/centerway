/**
 * Cabinet-only strings.
 *
 * The pre-LMS profile copy (`../profile/copy.ts`) still carries the shared
 * states — loading, auth wall, dosha labels, contact field names — and is reused
 * as-is. This file adds only what the cabinet introduced: section navigation,
 * the learning shelf and its lesson links.
 */

import type { ProfileLang } from "../profile/types";

export type CabinetCopy = {
  /* `continueTitle` and `continueLead` lived here for the resume card's kicker
     and its one-line lead. Both are gone: the card's own control says
     «Продовжити», and a caption narrating the button beside it is a label for a
     reader who has not looked at the card. */
  continueAction: string;
  startAction: string;
  openCourseMap: string;
  reviewAction: string;
  allCourses: string;

  learningTitle: string;
  learningLabel: string;
  /** The stat over the count in the room. Not «Бібліотека» — that is the
      library ROUTE, and the count standing beside «Доша» is about what this
      account holds, not about where to go and read it. */
  coursesLabel: string;
  /** One sentence under the shelf's title: whose these are, and what a card does. */
  learningLead: string;
  /** The shelf's card/list switch — a control, so all three are labels for it. */
  shelfViewLabel: string;
  shelfViewCards: string;
  shelfViewRows: string;
  shelfViewRoom: string;
  /** The opened book in the room view: the way back to the shelf, and the
      heading over its right page. Everything else it says — the state, the
      action — is the shelf's existing vocabulary, so a course does not get
      described one way on a card and another way in a book. */
  roomSpreadBack: string;
  roomSpreadNext: string;
  learningLoadingTitle: string;
  learningLoadingLead: string;
  learningEmptyTitle: string;
  learningEmptyLead: string;
  browsePrograms: string;
  /** The empty PRODUCTS fold's way out. Not `browsePrograms`: that fold is
      about products, and offering programmes from it answered a question the
      reader had not asked. */
  browseProducts: string;

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
  /* The window of access, as the card says it. A learner asks two questions of
     a paid course — «чи ще діє» and «скільки лишилось» — and the second one is
     the only one a bare date does not answer. */
  courseActive: string;
  courseRevoked: string;
  courseBlocked: string;
  accessUntilLabel: string;
  accessForeverLabel: string;
  daysLeft: (days: number) => string;
  buyAccess: string;
  renewAccess: string;

  accountLabel: string;
  accountTitle: string;
  accountLead: string;

  notificationsTitle: string;
  notificationsLinked: string;
  notificationsMissing: string;
  connectTelegram: string;
  notificationsUnavailable: string;

  installTitle: string;
  installLead: string;
  /** Shown where this origin is the storefront: installing here would add the shop. */
  installElsewhereLead: string;
  installElsewhereAction: string;
  installBrowserLead: string;
  installInstalledTitle: string;
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
      continueAction: "Continue",
      startAction: "Start the course",
      openCourseMap: "Contents",
      reviewAction: "Open again",
      allCourses: "All my courses",

      learningTitle: "My courses",
      learningLabel: "Library",
      coursesLabel: "Courses",
      learningLead: "Courses you have access to. Open one and it resumes at the lesson you stopped on.",
      shelfViewLabel: "Shelf view",
      shelfViewCards: "Cards",
      shelfViewRows: "List",
      shelfViewRoom: "Room",
      roomSpreadBack: "Back to the shelf",
      roomSpreadNext: "Next",
      learningLoadingTitle: "Loading your courses…",
      learningLoadingLead: "Restoring access, progress and your next lesson.",
      learningEmptyTitle: "No courses in this profile yet",
      learningEmptyLead: "Once a program is purchased, it opens here — with lessons, progress and the next step.",
      browsePrograms: "Browse programs",
      browseProducts: "See products",

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
      courseActive: "Active",
      courseRevoked: "Access withdrawn",
      courseBlocked: "Access closed",
      accessUntilLabel: "Access until",
      accessForeverLabel: "Access without an end date",
      daysLeft: (days) => (days === 1 ? "1 day left" : `${days} days left`),
      buyAccess: "Get access",
      renewAccess: "Renew access",

      accountLabel: "Account",
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
      installElsewhereLead:
        "The app is added from your shelf, so the icon opens your courses rather than the shop.",
      installElsewhereAction: "Open the shelf to add it",
      installBrowserLead: "Open your browser menu and choose \"Install app\" or \"Add to Home Screen\".",
      installInstalledTitle: "CenterWay is already added to your home screen.",
      installAction: "Add",
      installIosLead: "On iPhone and iPad the browser adds it, in two steps:",
      installIosSteps: ["Tap Share in the Safari toolbar.", "Choose “Add to Home Screen”."],

      shelfErrorTitle: "Could not load your courses",
      shelfErrorLead: "The rest of the profile is shown — try loading the courses again.",
      retry: "Try again",
    };
  }

  return {
    continueAction: "Продовжити",
    startAction: "Почати курс",
    openCourseMap: "Зміст",
    reviewAction: "Відкрити знову",
    allCourses: "Усі мої курси",

    learningTitle: "Мої курси",
    learningLabel: "Бібліотека",
    coursesLabel: "Курси",
    learningLead: "Курси, до яких у вас є доступ. Відкриваються з того уроку, на якому ви зупинились.",
    shelfViewLabel: "Вигляд полиці",
    shelfViewCards: "Картки",
    shelfViewRows: "Список",
    shelfViewRoom: "Кімната",
    roomSpreadBack: "До полиці",
    roomSpreadNext: "Далі",
    learningLoadingTitle: "Завантажуємо ваші курси…",
    learningLoadingLead: "Відновлюємо доступ, поступ і ваш наступний урок.",
    learningEmptyTitle: "У кабінеті ще немає курсів",
    learningEmptyLead: "Після придбання програма відкривається тут — з уроками, поступом і наступним уроком.",
    browsePrograms: "Подивитися програми",
    browseProducts: "Подивитися продукти",

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
    courseActive: "Активна",
    courseRevoked: "Доступ відкликано",
    courseBlocked: "Доступ закрито",
    accessUntilLabel: "Доступ до",
    accessForeverLabel: "Доступ без обмеження в часі",
    daysLeft: (days) => `лишил${days === 1 ? "ся" : "ось"} ${days} ${ukPlural(days, "день", "дні", "днів")}`,
    buyAccess: "Придбати доступ",
    renewAccess: "Продовжити доступ",

    accountLabel: "Акаунт",
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
    installElsewhereLead:
      "Застосунок додається з вашої полиці — тоді іконка відкриває ваші курси, а не вітрину.",
    installElsewhereAction: "Відкрити полицю, щоб додати",
    installBrowserLead: "Відкрийте меню браузера та оберіть «Встановити застосунок» або «На початковий екран».",
    installInstalledTitle: "CenterWay уже додано на ваш екран.",
    installAction: "Додати",
    installIosLead: "На iPhone та iPad застосунок додає сам браузер, у два кроки:",
    installIosSteps: ["Натисніть «Поділитися» на панелі Safari.", "Оберіть «На початковий екран»."],

    shelfErrorTitle: "Не вдалося завантажити курси",
    shelfErrorLead: "Решта кабінету показана — спробуйте завантажити курси ще раз.",
    retry: "Спробувати ще раз",
  };
}
