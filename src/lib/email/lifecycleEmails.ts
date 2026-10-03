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
import { emailLink, renderEmailLayout, type EmailBlock } from "./layout";

export type LifecycleEmail = { subject: string; html: string; text: string };

type Line = { text: string } | { link: string; before: string; label: string; after?: string };

function lineHtml(line: Line, tone: "ink" | "muted" = "ink"): string {
  if ("text" in line) return escapeHtml(line.text);
  return `${escapeHtml(line.before)}${emailLink(line.link, escapeHtml(line.label), tone)}${escapeHtml(line.after ?? "")}`;
}

function lineText(line: Line): string {
  if ("text" in line) return line.text;
  return `${line.before}${line.label}${line.after ?? ""}: ${line.link}`;
}

type Step = { title: string; line: Line };

/**
 * One letter shape for every lifecycle message, poured into the shared frame:
 * an eyebrow, a serif headline, paragraphs, optional steps or facts, one button,
 * a quiet foot. The plain-text twin is written from the same parts.
 */
function compose(input: {
  subject: string;
  preheader: string;
  eyebrow: string;
  title: string;
  greeting: string;
  paragraphs: Line[];
  steps?: Step[];
  facts?: { label: string; value: Line }[];
  note?: Line;
  closing?: Line[];
  cta: { label: string; href: string };
  foot?: Line[];
}): LifecycleEmail {
  const foot = input.foot ?? [];
  const blocks: EmailBlock[] = [
    { kind: "paragraph", html: escapeHtml(input.greeting) },
    ...input.paragraphs.map((p): EmailBlock => ({ kind: "paragraph", html: lineHtml(p) })),
  ];
  if (input.facts?.length) {
    blocks.push({
      kind: "facts",
      rows: input.facts.map((f) => ({ label: escapeHtml(f.label), value: lineHtml(f.value) })),
    });
  }
  if (input.steps?.length) {
    blocks.push({
      kind: "steps",
      items: input.steps.map((step) => ({ title: escapeHtml(step.title), html: lineHtml(step.line, "muted") })),
    });
  }
  for (const line of input.closing ?? []) blocks.push({ kind: "paragraph", html: lineHtml(line) });
  if (input.note) blocks.push({ kind: "note", html: lineHtml(input.note) });

  const html = renderEmailLayout({
    preheader: input.preheader,
    eyebrow: input.eyebrow,
    title: input.title,
    blocks,
    cta: input.cta,
    after: foot.map((line) => lineHtml(line, "muted")),
    signature: "Команда CenterWay",
  });
  const text = [
    input.greeting,
    ...input.paragraphs.map(lineText),
    ...(input.facts ?? []).map((f) => `${f.label}: ${lineText(f.value)}`),
    ...(input.steps ?? []).map((step, i) => `${i + 1}. ${step.title} — ${lineText(step.line)}`),
    ...(input.closing ?? []).map(lineText),
    ...(input.note ? [lineText(input.note)] : []),
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
  const steps: Step[] = [
    {
      title: "Тест доші",
      line: {
        link: links.doshaTestUrl,
        before: "",
        label: "Пройдіть тест",
        after: " — він підкаже, яка конституція у вас переважає і з чого краще починати.",
      },
    },
    {
      title: "Програми",
      line: {
        link: links.programsUrl,
        before: "",
        label: "Подивіться програми",
        after: " — у кожної є самостійний формат, а в деяких і груповий потік.",
      },
    },
    {
      title: "Кабінет",
      line: { text: "Зберігає уроки й прогрес: повертайтеся, коли зручно." },
    },
  ];
  if (links.channelUrl) {
    steps.push({
      title: "Канал",
      line: {
        link: links.channelUrl,
        before: "Практики, розбори й анонси — у ",
        label: "Telegram-каналі CenterWay",
        after: ".",
      },
    });
  }
  return compose({
    subject: "Вітаємо в CenterWay",
    preheader: "З чого почати: тест доші, програми і ваш кабінет.",
    eyebrow: "Ласкаво просимо",
    title: "Ваш простір відновлення готовий",
    greeting: greet(input.name),
    paragraphs: [
      {
        text: "Ви створили акаунт на CenterWay — платформі цілісного відновлення. Тут живуть програми наших авторів: харчування, режим, тіло, практики.",
      },
      { text: "З чого почати:" },
    ],
    steps,
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

  const facts = (lessons: string): { label: string; value: Line }[] => [
    { label: "Старт", value: { text: when } },
    { label: "Формат", value: { text: "Груповий потік" } },
    { label: "Уроки", value: { text: lessons } },
  ];
  const help: Line = {
    link: links.supportUrl,
    before: "Якщо щось не відкривається — ",
    label: "напишіть нам",
    after: ".",
  };

  if (input.stage === "tomorrow") {
    return compose({
      subject: `Завтра стартує ${programTitle}`,
      preheader: `${when} починаємо разом. Перший урок — зранку в кабінеті.`,
      eyebrow: `Потік · ${programTitle}`,
      title: "Завтра починаємо",
      greeting: greet(input.name),
      paragraphs: [
        {
          text: `Завтра, ${when}, стартує потік програми «${programTitle}». Усі учасники починають з першого дня разом.`,
        },
      ],
      facts: facts("Щодня в кабінеті, перший — зранку"),
      closing: [
        {
          text: "Якщо є можливість, підготуйтеся сьогодні: перегляньте вступ і спокійно сплануйте завтрашній день.",
        },
        chat,
      ],
      note: signIn,
      cta: { label: "Відкрити кабінет", href: links.cabinetUrl },
      foot: [help],
    });
  }

  return compose({
    subject: `День 1 · ${programTitle}`,
    preheader: "Перший урок уже в кабінеті.",
    eyebrow: `День 1 · ${programTitle}`,
    title: "Перший урок уже чекає",
    greeting: greet(input.name),
    paragraphs: [
      { text: `Сьогодні перший день потоку «${programTitle}». Перший урок уже чекає в кабінеті.` },
      {
        text: "Рухайтеся у своєму темпі: головне — щоденна опора, а не ідеальне виконання. Питання пишіть у чат потоку — відповімо протягом дня.",
      },
      chat,
    ],
    note: signIn,
    cta: { label: "Відкрити перший урок", href: links.cabinetUrl },
    foot: [help],
  });
}
