/**
 * The letters the platform sends on its own, at moments in a person's life with
 * it: an account appears, a group stream is about to start, the stream starts.
 *
 * PURE: no network, no database, no env. The senders in `lifecycleRuns.ts`
 * decide who and when; this file only decides the words, so the words can be
 * tested without sending anything.
 *
 * THE VOICE IS THE PLATFORM'S (decided 2026-09-28): «ми» to «ви», signed by the
 * CenterWay team, not by an author. The purchase receipt keeps its own file; it
 * is the one letter with money in it.
 */

import { escapeHtml } from "@/lib/strings";

export type LifecycleEmail = { subject: string; html: string; text: string };

type Line = { text: string } | { link: string; before: string; label: string; after?: string };

const INK = "#2b2723";
const MUTED = "#6b625a";
const FAINT = "#9a9089";

function lineHtml(line: Line): string {
  if ("text" in line) return escapeHtml(line.text);
  return `${escapeHtml(line.before)}<a href="${escapeHtml(line.link)}" style="color:${INK}">${escapeHtml(line.label)}</a>${escapeHtml(line.after ?? "")}`;
}

function lineText(line: Line): string {
  if ("text" in line) return line.text;
  return `${line.before}${line.label}${line.after ?? ""}: ${line.link}`;
}

/** One letter shape for every lifecycle message: paragraphs, one button, a quiet foot. */
function compose(input: {
  subject: string;
  greeting: string;
  paragraphs: Line[];
  cta: { label: string; href: string };
  foot?: Line[];
}): LifecycleEmail {
  const foot = input.foot ?? [];
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:${INK};max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 20px">${escapeHtml(input.greeting)}</p>
  ${input.paragraphs.map((p) => `<p style="margin:0 0 20px">${lineHtml(p)}</p>`).join("\n  ")}
  <p style="margin:8px 0 28px"><a href="${escapeHtml(input.cta.href)}" style="display:inline-block;background:${INK};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${escapeHtml(input.cta.label)}</a></p>
  ${foot.map((p) => `<p style="margin:0 0 16px;color:${MUTED}">${lineHtml(p)}</p>`).join("\n  ")}
  <p style="margin:24px 0 0;color:${FAINT}">Команда CenterWay</p>
</div>`;
  const text = [
    input.greeting,
    ...input.paragraphs.map(lineText),
    `${input.cta.label}: ${input.cta.href}`,
    ...foot.map(lineText),
    "Команда CenterWay",
  ].join("\n\n");
  return { subject: input.subject, html, text };
}

function greet(name: string | null | undefined): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Вітаємо, ${first}!` : "Вітаємо!";
}

/** «1 жовтня» — the date as a person reads it, from a calendar date. */
export function ukDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export type Links = {
  cabinetUrl: string;
  programsUrl: string;
  doshaTestUrl: string;
  supportUrl: string;
  channelUrl?: string | null;
  streamChatUrl?: string | null;
};

export function buildWelcomeEmail(input: { name?: string | null; links: Links }): LifecycleEmail {
  const { links } = input;
  const paragraphs: Line[] = [
    {
      text: "Ви створили акаунт на CenterWay — платформі цілісного відновлення. Тут живуть програми наших авторів: харчування, режим, тіло, практики.",
    },
    { text: "З чого почати:" },
    {
      link: links.doshaTestUrl,
      before: "— пройдіть ",
      label: "тест доші",
      after: " — він підкаже, яка конституція у вас переважає і з чого краще починати;",
    },
    {
      link: links.programsUrl,
      before: "— подивіться ",
      label: "програми",
      after: " — у кожної є самостійний формат, а в деяких і груповий потік;",
    },
    { text: "— ваш кабінет зберігає уроки й прогрес: повертайтеся, коли зручно." },
  ];
  if (links.channelUrl) {
    paragraphs.push({
      link: links.channelUrl,
      before: "Практики, розбори й анонси ми публікуємо в ",
      label: "Telegram-каналі CenterWay",
      after: ".",
    });
  }
  return compose({
    subject: "Вітаємо в CenterWay",
    greeting: greet(input.name),
    paragraphs,
    cta: { label: "Відкрити кабінет", href: links.cabinetUrl },
    foot: [{ link: links.supportUrl, before: "Якщо щось не відкривається — ", label: "напишіть нам", after: "." }],
  });
}

export type StreamStage = "tomorrow" | "day1";

export function buildStreamEmail(input: {
  stage: StreamStage;
  name?: string | null;
  programTitle: string;
  startsOn: string;
  links: Links;
}): LifecycleEmail {
  const { links, programTitle } = input;
  const when = ukDate(input.startsOn);
  const chat: Line = links.streamChatUrl
    ? {
        link: links.streamChatUrl,
        before: "Закритий чат потоку: ",
        label: "приєднатися",
        after: " — там питання, досвід дня й відповіді.",
      }
    : { text: "Посилання на закритий чат потоку надішлемо окремим повідомленням." };
  const signIn: Line = {
    text: "Заходьте до кабінету тим самим email, на який прийшов цей лист, — за ним відкривається доступ.",
  };

  if (input.stage === "tomorrow") {
    return compose({
      subject: `Завтра стартує ${programTitle}`,
      greeting: greet(input.name),
      paragraphs: [
        {
          text: `Завтра, ${when}, стартує потік програми «${programTitle}». Усі учасники починають з першого дня разом.`,
        },
        {
          text: "Уроки відкриваються в кабінеті щодня — перший буде готовий зранку. Якщо є можливість, підготуйтеся сьогодні: перегляньте вступ і спокійно сплануйте завтрашній день.",
        },
        chat,
      ],
      cta: { label: "Відкрити кабінет", href: links.cabinetUrl },
      foot: [
        signIn,
        { link: links.supportUrl, before: "Якщо щось не відкривається — ", label: "напишіть нам", after: "." },
      ],
    });
  }

  return compose({
    subject: `День 1 · ${programTitle}`,
    greeting: greet(input.name),
    paragraphs: [
      { text: `Сьогодні перший день потоку «${programTitle}». Перший урок уже чекає в кабінеті.` },
      {
        text: "Рухайтеся у своєму темпі: головне — щоденна опора, а не ідеальне виконання. Питання пишіть у чат потоку — відповімо протягом дня.",
      },
      chat,
    ],
    cta: { label: "Відкрити перший урок", href: links.cabinetUrl },
    foot: [
      signIn,
      { link: links.supportUrl, before: "Якщо щось не відкривається — ", label: "напишіть нам", after: "." },
    ],
  });
}
