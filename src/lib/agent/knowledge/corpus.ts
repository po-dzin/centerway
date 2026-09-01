/**
 * Assembling the assistant's corpus out of what the platform already states.
 *
 * NOTHING HERE IS WRITTEN FOR THE ASSISTANT. Every sentence in the corpus is a
 * sentence a person can already read on a page or receive from the support bot,
 * pulled from the module that owns it. That is the difference between a
 * knowledge base and a second copy of the product: a knowledge base written
 * separately starts drifting the day after it is written, and the drift is
 * invisible — nobody reads it except the model.
 *
 * SIX SOURCES, NAMED. Products, catalogue programmes, live courses, tests, the
 * support bot's own FAQ, and the two legal leads. Everything else on the
 * platform — landings, `docs/legacy/**`, retired offers — is deliberately out
 * (docs/agent-contour-2026-08-21.md §4).
 *
 * THE PRICE TRAP, since this is the module most likely to get it wrong: a
 * product carries TWO figures. `amount` is what the payment provider is asked
 * to take and diverges from the real price while the 1 ₴ QA window is open;
 * `listAmount` is what a surface may print. The corpus reads `productListPrice`
 * for the same reason a page does — an assistant quoting `amount` during that
 * window would tell a buyer a course costs one hryvnia.
 *
 * COURSES CONTRIBUTE THEIR OFFER, NOT THEIR LESSONS. See `types.ts`.
 */

import { inlineToPlainText, type Course } from "@/lms-core";
import { contact, legal, programs } from "@/lib/platform/content";
import { plural } from "@/lib/plural";
import { PRODUCTS, formatPrice, productDescription, productHeading, productListPrice, type CatalogProductCode } from "@/lib/products";
import { platformTests } from "@/lib/platform/tests";
import { botCopy, SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import type { KnowledgeDoc } from "./types";

/**
 * How the course behaves in time, in the words a buyer asks about it.
 *
 * The gate matters more than the mode here. A daily course whose gate is `soft`
 * — the default — lets a person look ahead, and "уроки за розкладом" would read
 * to them as a lock on material they already paid for. That distinction is
 * exactly what the support bot's `schedule` answer spends its four lines on.
 */
function scheduleSentence(schedule: Course["schedule"]): string {
  if (schedule.mode === "open") return "Усі уроки доступні одразу.";
  if (schedule.mode === "sequential") return "Уроки відкриваються послідовно, один за одним.";
  return schedule.gate === "hard"
    ? "Уроки прив'язані до днів курсу і відкриваються у свій день."
    : "Уроки прив'язані до днів курсу, але не замикаються: можна дивитися наперед.";
}

/** Joins the lines of a document, dropping the empty ones a builder produced. */
function paragraphs(lines: (string | null | undefined | false)[]): string {
  return lines.filter((line): line is string => typeof line === "string" && line.trim() !== "").join("\n\n");
}

function list(label: string, items: readonly string[] | undefined): string | null {
  if (!items?.length) return null;
  return `${label}: ${items.join("; ")}.`;
}

/**
 * What support already answers.
 *
 * The most valuable source in the corpus and the cheapest: these are the
 * questions people actually ask, with answers the house has already agreed on
 * and already sends. An assistant that starts from them is not guessing at a
 * tone — it is saying what the bot says, on a surface where the person did not
 * have to open Telegram.
 *
 * `other` is skipped: it routes to a human rather than answering anything, and
 * a document whose content is "press the other button" would compete in search
 * with documents that hold an answer.
 */
export function supportDocs(): KnowledgeDoc[] {
  return Object.entries(botCopy.faq)
    .filter(([key]) => key !== "other")
    .map(([key, answer]) => {
      const label = botCopy.faqLabels[key as keyof typeof botCopy.faqLabels];
      return {
        id: `support:${key.replace(/_/g, "-")}`,
        kind: "support" as const,
        title: label,
        href: SUPPORT_BOT_URL,
        text: paragraphs([label, answer]),
        locale: "uk" as const,
        // Signed-out visitors ask "where is my course" too — often before they
        // realise they are signed out, which is the answer itself.
        audience: "public" as const,
        source: "src/lib/tgSupportBotCopy.ts",
        updatedAt: null,
      };
    });
}

/** The payable catalogue: what a thing is called, what it costs, how it is delivered. */
export function productDocs(): KnowledgeDoc[] {
  return (Object.keys(PRODUCTS) as CatalogProductCode[]).map((code) => {
    const price = productListPrice(code);
    const fulfilment = PRODUCTS[code].fulfilment;
    const programme = programs.find((entry) => entry.slug === code);

    return {
      id: `product:${code}`,
      kind: "product" as const,
      title: productHeading(code, "uk"),
      href: programme?.href ?? null,
      text: paragraphs([
        productHeading(code, "uk"),
        productDescription(code, "uk"),
        price === null
          ? "Ціна узгоджується окремо."
          : `Ціна: ${formatPrice(price, PRODUCTS[code].currency)}.`,
        fulfilment.kind === "course"
          ? "Доступ відкривається в кабінеті, у розділі «Бібліотека»."
          : "Доступ відкривається в Telegram-боті продукту після оплати.",
      ]),
      locale: "uk" as const,
      audience: "public" as const,
      source: "src/lib/products.ts",
      updatedAt: null,
    };
  });
}

/** The catalogue's own description of a programme — what the offer page says. */
export function programmeDocs(): KnowledgeDoc[] {
  return programs.map((programme) => ({
    id: `product:programme-${programme.slug}`,
    kind: "product" as const,
    title: programme.fullTitle ?? programme.title,
    href: programme.href,
    text: paragraphs([
      `${programme.fullTitle ?? programme.title} — ${programme.tag}, ${programme.duration}.`,
      programme.longDescription ?? programme.description,
      list("Що це дає", programme.results),
    ]),
    locale: "uk" as const,
    audience: "public" as const,
    source: "src/lib/platform/content.ts",
    updatedAt: null,
  }));
}

/**
 * A course as its offer surface.
 *
 * Only what an author filled in on the «Вітрина» panel plus the shape of the
 * course — module titles and a lesson count. The modules are named because
 * "what is inside" is the question every buyer asks and a title is not the
 * content; the blocks are absent because they are.
 */
export function courseDocs(courses: Course[]): KnowledgeDoc[] {
  return courses.map((course) => {
    const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
    const summary = course.summary ? inlineToPlainText(course.summary) : null;

    return {
      id: `course:${course.slug}`,
      kind: "course" as const,
      title: course.title,
      // THE ADDRESS, NOT THE ROW NAME. A course is stored under `slug` and sold
      // under `programSlug` — `short` at /programs/reboot, `irem-gymnastics` at
      // /programs/irem — and the offer route resolves only the latter. An
      // assistant citing the row name would hand a person a 404.
      href: `/programs/${course.programSlug}`,
      text: paragraphs([
        [course.pretitle, course.title, course.posttitle].filter(Boolean).join(" — "),
        course.tagline,
        summary,
        list("Результати", course.results),
        list("Для кого", course.audience),
        list("З чого складається", course.format),
        course.durationDays
          ? `Тривалість: ${course.durationDays} ${plural(course.durationDays, "день", "дні", "днів")}.`
          : null,
        `Структура: ${course.modules.length} ${plural(course.modules.length, "модуль", "модулі", "модулів")}, ${lessons} ${plural(lessons, "урок", "уроки", "уроків")} — ${course.modules
          .map((module) => module.title)
          .join("; ")}.`,
        scheduleSentence(course.schedule),
        course.accessNote,
      ]),
      locale: course.locale === "uk" ? "uk" : course.locale === "en" ? "en" : "ru",
      audience: "public" as const,
      source: "lms_courses",
      updatedAt: null,
    };
  });
}

/** Platform tests: what each one asks about, and what it does not claim to be. */
export function testDocs(): KnowledgeDoc[] {
  return platformTests.map((test) => ({
    id: `test:${test.slug}`,
    kind: "test" as const,
    title: test.title,
    href: test.href,
    text: paragraphs([
      `${test.title} — ${test.tag}. ${test.format}.`,
      test.description,
      `Що читає: ${test.reads}.`,
      test.status === "planned"
        ? "Тест ще готується — пройти його поки не можна."
        : "Тест доступний і безкоштовний.",
      // Said in the corpus rather than left to the model, because this is the
      // boundary the assistant is most likely to be pushed across: a test is a
      // working hypothesis about a state, not a diagnosis.
      "Результат тесту — робоча гіпотеза про стан, а не медичний висновок і не діагноз.",
    ]),
    locale: "uk" as const,
    audience: "public" as const,
    source: "src/lib/platform/tests.ts",
    updatedAt: null,
  }));
}

/**
 * The policy layer, and it is thin on purpose.
 *
 * Only the two leads that live as DATA are here. The bodies of the offer and
 * the privacy policy are prose inside JSX (`app/(platform)/legal/**`), and this
 * module will not scrape a React tree to get them: text extracted from a
 * component is text nobody owns, and the first refactor of a `<p>` silently
 * changes what the assistant tells people about refunds. Moving that copy into
 * data is a real task with a real owner, and until it happens the assistant
 * answers a legal question by pointing at the page — which is the correct
 * answer anyway.
 */
export function policyDocs(): KnowledgeDoc[] {
  return [
    {
      id: "policy:public-offer",
      kind: "policy" as const,
      title: "Публічна оферта",
      href: "/legal/public-offer",
      text: paragraphs([
        legal.publicOffer,
        "Повний текст оферти — на сторінці /legal/public-offer. Умови повернення, строки доступу і спірні питання вирішуються за нею.",
      ]),
      locale: "uk" as const,
      audience: "public" as const,
      source: "src/lib/platform/content.ts",
      updatedAt: null,
    },
    {
      id: "policy:privacy",
      kind: "policy" as const,
      title: "Політика конфіденційності",
      href: "/legal/privacy",
      text: paragraphs([
        legal.privacy,
        `Питання щодо персональних даних — на ${contact.email} або ${contact.phone}.`,
      ]),
      locale: "uk" as const,
      audience: "public" as const,
      source: "src/lib/platform/content.ts",
      updatedAt: null,
    },
    {
      id: "policy:health-boundary",
      kind: "policy" as const,
      title: "Межа: що платформа не робить",
      href: null,
      text: paragraphs([
        "Межа: що платформа не робить",
        "Курси CenterWay — тілесні практики і освітній матеріал. Вони не замінюють обстеження, діагноз і призначення лікаря.",
        "Питання про протипоказання, захворювання, хвороби, вагітність, тиск, ліки і сумісність практики з лікуванням вирішуються з лікарем, а не в чаті. У таких випадках підтримка передає розмову людині.",
        "Вопросы о противопоказаниях, заболеваниях, беременности, давлении и лекарствах решаются с врачом: ассистент передаёт такой разговор человеку.",
      ]),
      locale: "uk" as const,
      audience: "public" as const,
      // The only document written here rather than lifted from a surface, and
      // it is the one the assistant needs most: the platform states this
      // boundary in a dozen places in its own voice and nowhere as one fact a
      // retrieval can find.
      //
      // Written in the reader's vocabulary, in two languages, because that is
      // how a document gets FOUND — the first version used the platform's own
      // wording and a question about «захворювання» retrieved a test instead.
      // The rule in `boundaries.ts` is what actually stops that question; this
      // is what the person is shown once it has.
      source: "docs/agent-contour-2026-08-21.md §4",
      updatedAt: null,
    },
  ];
}

/**
 * The whole corpus.
 *
 * Courses are passed in rather than read here so the assembly stays pure: the
 * same function serves the live catalogue on a server and a fixture in a test,
 * and the test is what proves a course's lesson text never enters the index.
 */
export function buildCorpus(input: { courses: Course[] }): KnowledgeDoc[] {
  return [
    ...supportDocs(),
    ...productDocs(),
    ...programmeDocs(),
    ...courseDocs(input.courses),
    ...testDocs(),
    ...policyDocs(),
  ];
}
