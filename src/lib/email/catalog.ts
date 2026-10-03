/**
 * Every letter the platform sends, in one list.
 *
 * WHY A LIST. The letters were built one at a time, in four files, by the
 * thread that needed each one; nobody could answer «what does a person get
 * from us, and when» without reading all of them. This is that answer, and it
 * is also what the design system's email gallery is rendered from
 * (`npm run email:gallery` → docs/design-system/email-gallery.html), so the
 * gallery cannot show a letter the code does not send, or miss one it does.
 *
 * Each entry renders its letter with sample data through the SAME builder the
 * sender calls. A letter added to the platform without an entry here is a
 * letter the design system does not know about; `catalog.test.ts` checks that
 * every builder in `src/lib/email/` is listed.
 */

import { renderBroadcast } from "@/lib/broadcasts/render";

import { buildSignInCodeTemplate } from "./authEmails";
import { buildStreamEmail, buildWelcomeEmail, type Links } from "./lifecycleEmails";
import { buildPurchaseEmail } from "./purchaseEmail";
import { buildLessonReminderEmail, buildUnstartedReminderEmail } from "./reminderEmails";

export type EmailCatalogEntry = {
  id: string;
  /** What the owner calls it. */
  name: string;
  /** What makes it go out. */
  trigger: string;
  /** Who hands it to the mail server. */
  sender: "Supabase Auth" | "Resend";
  /** What has to be true in production for it to be sent at all. */
  gate: string;
  /** The builder's file. */
  source: string;
  render: () => { subject: string; html: string; preheader?: string };
};

const SAMPLE_LINKS: Links = {
  cabinetUrl: "https://my.centerway.net.ua/",
  programsUrl: "https://www.centerway.net.ua/programs",
  doshaTestUrl: "https://www.centerway.net.ua/dosha-test",
  supportUrl: "https://t.me/centerway_support_bot",
  channelUrl: "https://t.me/centerway_flow",
  streamChatUrl: "https://t.me/+stream-chat",
};

export const EMAIL_CATALOG: EmailCatalogEntry[] = [
  {
    id: "sign-in-code",
    name: "Код для входу",
    trigger: "Людина вводить email на сторінці входу (і новий, і наявний акаунт).",
    sender: "Supabase Auth",
    gate: "Шаблони «Magic Link» і «Confirm signup» у налаштуваннях Auth проєкту мають бути цим листом (npm run email:auth-templates).",
    source: "src/lib/email/authEmails.ts",
    render: () => buildSignInCodeTemplate("482915"),
  },
  {
    id: "receipt-course",
    name: "Оплату отримано",
    trigger: "Платіж підтверджено шлюзом або оператор записав продаж вручну.",
    sender: "Resend",
    gate: "RESEND_API_KEY. Завжди, без перемикача: це чек.",
    source: "src/lib/email/purchaseEmail.ts",
    render: () =>
      buildPurchaseEmail({
        email: "olena@example.com",
        productTitle: "Шлях 21",
        amount: 4100,
        currency: "UAH",
        fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
        orderRef: "cw_way21_8f3k2",
      }),
  },
  {
    id: "receipt-stream",
    name: "Оплату отримано · груповий потік",
    trigger: "Те саме, коли оффер груповий і має дату старту.",
    sender: "Resend",
    gate: "RESEND_API_KEY. Дата береться з cohort_starts_on оффера.",
    source: "src/lib/email/purchaseEmail.ts",
    render: () =>
      buildPurchaseEmail({
        email: "olena@example.com",
        productTitle: "Шлях 21 · груповий потік",
        amount: 4100,
        currency: "UAH",
        fulfilment: { kind: "course", courseSlug: "way21", programSlug: "way21" },
        orderRef: "cw_way21g_2m9x1",
        cohortStartsOn: "2026-11-01",
      }),
  },
  {
    id: "welcome",
    name: "Вітаємо в CenterWay",
    trigger: "Новий акаунт; ранковий прогін cron підбирає тих, хто ще не отримав.",
    sender: "Resend",
    gate: "LIFECYCLE_EMAILS=on; акаунти, створені після WELCOME_EMAILS_SINCE.",
    source: "src/lib/email/lifecycleEmails.ts",
    render: () => buildWelcomeEmail({ name: "Олена", links: SAMPLE_LINKS }),
  },
  {
    id: "stream-tomorrow",
    name: "Завтра стартує потік",
    trigger: "За день до cohort_starts_on, учасникам потоку.",
    sender: "Resend",
    gate: "LIFECYCLE_EMAILS=on; посилання на чат з TELEGRAM_STREAM_CHAT_URL.",
    source: "src/lib/email/lifecycleEmails.ts",
    render: () =>
      buildStreamEmail({
        stage: "tomorrow",
        name: "Олена",
        programTitle: "Шлях 21",
        startsOn: "2026-11-01",
        links: SAMPLE_LINKS,
      }),
  },
  {
    id: "stream-day1",
    name: "День 1 потоку",
    trigger: "У день cohort_starts_on, учасникам потоку.",
    sender: "Resend",
    gate: "LIFECYCLE_EMAILS=on.",
    source: "src/lib/email/lifecycleEmails.ts",
    render: () =>
      buildStreamEmail({
        stage: "day1",
        name: "Олена",
        programTitle: "Шлях 21",
        startsOn: "2026-11-01",
        links: SAMPLE_LINKS,
      }),
  },
  {
    id: "lesson-reminder",
    name: "Урок дня готовий",
    trigger: "Ранковий прогін: відкрився урок дня N, а Telegram до акаунта не підключено.",
    sender: "Resend",
    gate: "LIFECYCLE_EMAILS=on; лише без Telegram; день 1 потоку покриває лист «День 1».",
    source: "src/lib/email/reminderEmails.ts",
    render: () =>
      buildLessonReminderEmail({
        name: "Олена",
        courseTitle: "Шлях 21",
        lessonTitle: "Ранок без поспіху",
        dayNumber: 3,
        lessonUrl: "https://my.centerway.net.ua/learn/way21",
        supportUrl: SAMPLE_LINKS.supportUrl,
      }),
  },
  {
    id: "unstarted-reminder",
    name: "Курс чекає",
    trigger: "Курс куплено, але жодного разу не відкрито; кілька м'яких нагадувань.",
    sender: "Resend",
    gate: "LIFECYCLE_EMAILS=on; лише без Telegram.",
    source: "src/lib/email/reminderEmails.ts",
    render: () =>
      buildUnstartedReminderEmail({
        name: "Олена",
        courseTitle: "Розвантажувальний день",
        nudgeNumber: 2,
        courseUrl: "https://my.centerway.net.ua/learn/reset-day",
        supportUrl: SAMPLE_LINKS.supportUrl,
      }),
  },
  {
    id: "broadcast",
    name: "Розсилка",
    trigger: "Оператор надсилає розсилку з адмінки (вкладка «Розсилки»).",
    sender: "Resend",
    gate: "BROADCAST_FROM, UNSUBSCRIBE_SECRET; лише підписаним, без тих, хто відписався чи відбився.",
    source: "src/lib/broadcasts/render.ts",
    render: () =>
      renderBroadcast(
        {
          subject: "«Шлях 21» у групі: старт 1 листопада",
          preheader: "21 день, три фази, щотижневі ефіри.",
          body: [
            "{{first_name|Вітаємо}}, у листопаді ми вперше проходимо «Шлях 21» разом.",
            "# Що буде",
            "- три фази: підготовка, глибоке очищення, вихід;\n- закрита група потоку;\n- ефіри щосереди.",
            "Доступ до матеріалів лишається після програми. **Wellness-освіта і практика, а не лікування.**",
          ].join("\n\n"),
          ctaLabel: "Переглянути програму",
          ctaUrl: "https://www.centerway.net.ua/programs/way21",
        },
        { name: "Олена Коваль" },
        "https://www.centerway.net.ua/api/unsubscribe?t=sample",
      ),
  },
];
