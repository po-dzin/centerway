/**
 * Everything the support bot says, in one file.
 *
 * VOICE. One address form: «ви». The bot used to mix it — menus on «ви», the
 * account-link reply on «ти» — and the day-N reminders that arrive in the SAME
 * chat from the SAME token were on «ти» as well, so a learner could get three
 * registers in one conversation. The cabinet is on «ви», the cabinet is where
 * every path here ends, and it is the larger surface; so «ви» wins and the
 * reminders move to it (src/lib/lms/reminders.ts).
 *
 * Beyond the pronoun, three rules, in the platform's register — plain, calm,
 * never salesy:
 *   1. Say where the thing IS before saying what to press. "Курси відкриваються
 *      в кабінеті" and then the link — not a bare button.
 *   2. Never promise a human timeframe the bot cannot keep. "Передали в
 *      підтримку" is true; "відповімо протягом години" is not ours to say.
 *   3. One idea per message. Telegram has no visual hierarchy to lean on.
 */

import { LEARNING_SHELF_HREF } from "@/lib/platform/content";
import { PLATFORM_ORIGIN, platformUrl, surfaceUrl } from "@/lib/surfaces/catalog";

// The shelf address, not a copy of it: this literal was already one release
// behind the constant once. `surfaceUrl`, not `platformUrl`, because the shelf
// moved to the personal host and the bot's link would otherwise spend a 308
// getting there.
export const CABINET_URL = surfaceUrl(LEARNING_SHELF_HREF);
export const PROGRAMS_URL = platformUrl("/programs");
export const SUPPORT_BOT_URL = "https://telegram.me/centerway_support_bot";

/**
 * The brand card the greeting carries, and the same file BotFather takes for
 * the empty-chat picture — baked by scripts/brand-mark-bake.mjs off the one
 * mark geometry, so the bot cannot end up wearing a logo the site retired.
 *
 * Passed to Telegram as a URL rather than an upload: Telegram fetches it once
 * and serves its own copy afterwards, which keeps the webhook handler — a
 * serverless function with a cold start to pay — free of file I/O on a path
 * that runs on every single /start.
 */
export const GREETING_PHOTO_URL = platformUrl("/cw/brand/cw-tg-cover.png");

export { PLATFORM_ORIGIN };

export const botCopy = {
  greeting: [
    "Вітаємо в CenterWay.",
    "",
    "Тут можна знайти свій доступ, поставити питання і написати підтримці.",
    "Курси відкриваються в кабінеті на сайті — бот допомагає до нього дійти.",
  ].join("\n"),

  menuPrompt: "З чим допомогти?",

  /* The cabinet answer is the bot's main job now, so it says the whole thing in
     one message: where the courses are, and the one condition that actually
     trips people up — signing in with the address the purchase was made on. */
  cabinet: [
    "Усі придбані курси лежать у кабінеті, у розділі «Бібліотека»:",
    CABINET_URL,
    "",
    "Важливо увійти тією поштою, на яку оформлювали замовлення — за нею кабінет знаходить покупку.",
    "Якщо курс там не з'явився, натисніть «Не бачу доступ».",
  ].join("\n"),

  accessPickProduct: "Який курс шукаємо?",
  accessAskContact: "Надішліть email або телефон, які вказували під час оплати.",

  accessFoundPlatform: (title: string) =>
    [
      `Оплату за «${title}» знайдено — курс уже відкритий у кабінеті.`,
      "",
      "Увійдіть тією ж поштою, що й під час оплати, і курс буде в розділі «Бібліотека».",
    ].join("\n"),

  /* The two lines a bot delivery needed — "here is your link", and "your link
     is not configured yet" — are gone with the deliveries themselves
     (2026-08-29). Every course is in the cabinet now, so there is one answer to
     "where is my access" and it does not depend on which product was bought. */

  accessNotFound: [
    "За цими даними оплату не знайшли.",
    "",
    "Буває, що оплата оформлена на іншу пошту або телефон — спробуйте другий контакт.",
    "Якщо контакт правильний, напишіть підтримці: розберемося вручну.",
  ].join("\n"),

  faqPrompt: "Оберіть питання:",

  /* Keys here ARE the callback data, and the keyboard is built from this object
     (see faqKeyboard) rather than from a parallel list. A button whose key had
     no entry would answer with the "інше" fallback — a dead button that looks
     alive, and the kind of mismatch a hand-kept second list produces eventually. */
  faq: {
    where_course: [
      "Курс відкривається в кабінеті на сайті, у розділі «Бібліотека»:",
      CABINET_URL,
      "",
      "Уроки, поступ і наступний крок — усе там. Окремий застосунок не потрібен.",
    ].join("\n"),
    access_missing: [
      "Найчастіша причина — вхід не тією поштою, на яку оформлено замовлення.",
      "",
      "Перевірте адресу, якою входите в кабінет. Якщо вона правильна — натисніть «Не бачу доступ», перевіримо оплату.",
    ].join("\n"),
    login: [
      "Вхід у кабінет — за поштою, без пароля: приходить лист із посиланням.",
      "",
      "Якщо лист не дійшов, подивіться в «Промоакції» та «Спам». Якщо його немає й там — напишіть підтримці.",
    ].join("\n"),
    schedule: [
      "Уроки не замикаються за розкладом: можна дивитися наперед, щоб заздалегідь підготуватися.",
      "",
      "Нагадування приходять за планом курсу — щоб підключити їх сюди, у кабінеті натисніть «Підключити Telegram».",
    ].join("\n"),
    check_payment: [
      "Натисніть «Не бачу доступ» і надішліть email або телефон із замовлення — перевіримо оплату за ними.",
    ].join("\n"),
    payment_problem: [
      "Якщо гроші списані, а доступу немає — напишіть підтримці.",
      "",
      "Додайте email або телефон із замовлення і, якщо є, номер платежу: так знайдемо швидше.",
    ].join("\n"),
    other: "Якщо питання не підходить під жоден розділ — натисніть «Написати підтримці» й опишіть ситуацію.",
  } as const,

  /** Button labels, keyed by the same union — so the two cannot drift. */
  faqLabels: {
    where_course: "Де мій курс",
    access_missing: "Курс не з'явився в кабінеті",
    login: "Не можу увійти",
    schedule: "Розклад і нагадування",
    check_payment: "Як перевірити оплату",
    payment_problem: "Проблема з оплатою",
    other: "Інше",
  } as const,

  supportAskContact: "Надішліть email або телефон, за яким підтримка знайде ваше замовлення.",
  supportAskMessage: "Тепер опишіть ситуацію одним повідомленням.",
  supportSent: "Передали звернення підтримці. Відповідь прийде сюди, в цей чат.",
  supportUnavailable: "Підтримка тимчасово недоступна. Спробуйте, будь ласка, пізніше.",

  linkedOk: "Готово — акаунт CenterWay підключено. Нагадування про уроки приходитимуть сюди.",
  linkExpired: "Посилання застаріло. Відкрийте кабінет і натисніть «Підключити Telegram» ще раз.",
  linkBroken: "Не вдалося перевірити посилання. Спробуйте ще раз із кабінету.",

  fallback: "Не зрозуміли запит. Оберіть пункт нижче — або натисніть «Написати підтримці».",
} as const;

/* Bot profile texts, applied by scripts/tg-bot-profile.mjs. Kept here so the
   description a user reads before pressing Start is written in the same file,
   and the same voice, as everything they read after. */
export const botProfile = {
  /**
   * The avatar, applied with setMyProfilePhoto.
   *
   * Gold on the deep ground rather than the launcher icon's ink on cream, for
   * the reason the favicon flips: a chat-list avatar sits on whatever ground
   * the reader's Telegram theme paints, and a PNG cannot follow it. See the
   * bake script's call site.
   */
  photo: "public/cw/brand/cw-tg-avatar.png",
  /** The display name. Max 64 chars. */
  name: "CenterWay Support",
  /**
   * The picture on the empty-chat screen, above the description. 640x360 —
   * BotFather's size. The Bot API has no method for it (probed: there is no
   * setMyDescriptionPhoto), so this path is printed for the manual step rather
   * than applied.
   */
  descriptionPicture: "public/cw/brand/cw-tg-cover.png",
  /** Shown on the empty chat screen, before /start. Max 512 chars. */
  description: [
    "Бот підтримки CenterWay.",
    "",
    "Допоможе знайти доступ до придбаного курсу, відповість на часті питання і передасть звернення підтримці.",
    "Самі курси відкриваються в кабінеті на сайті.",
  ].join("\n"),
  /** Shown on the bot's profile page. Max 120 chars. */
  shortDescription: "Підтримка CenterWay: доступ до курсів, питання, звернення.",
  commands: [
    { command: "start", description: "Головне меню" },
    { command: "courses", description: "Мої курси в кабінеті" },
    { command: "access", description: "Не бачу доступ" },
    { command: "help", description: "Часті питання" },
    { command: "support", description: "Написати підтримці" },
  ],
  /**
   * The blue button next to the input field: the command list, not a web_app
   * pointing at the cabinet.
   *
   * A `web_app` menu button opens inside Telegram's own webview, and the
   * cabinet signs people in by emailed magic link — which opens in the system
   * browser, i.e. a different session from the webview that asked for it. The
   * button would look like the fastest way in and be the one way that cannot
   * complete. Cabinet links stay in message bodies and inline url buttons,
   * where Telegram hands them to the real browser.
   */
  menuButton: { type: "commands" as const },
} as const;
