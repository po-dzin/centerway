/**
 * /llms.txt — the platform, written for the thing that answers questions about it.
 *
 * WHY IT EXISTS. Search sends a person to a page; an assistant reads a site and
 * says a sentence. What it says is assembled from whatever it can parse, and
 * everything CenterWay publishes is a Ukrainian marketing page with the facts
 * spread across headings, cards and a hero photograph. This file states the
 * same facts once, in order, in plain text: what the platform is, what it
 * offers, at what address, for what price, and where the method stops.
 *
 * IT IS NOT A SECOND TRUTH. Every line is derived — the brand identity, the
 * product catalogue and the live course list — so it cannot quietly disagree
 * with the pages. The only thing written here is the ORDER.
 *
 * THE BOUNDARY IS NOT DECORATION. An assistant summarising a wellness site is
 * exactly the reader most likely to turn "детокс" into a medical claim. The
 * limit is stated at the top, in its own section, before any offer.
 */

import { BRAND, brandSummary } from "@/lib/brand/identity";
import { programs } from "@/lib/platform/content";
import { formatPrice } from "@/lib/products";
import { loadCourseOffer, listStorefrontCourses } from "@/lib/platform/offers";
import { resolveOfferCommerce } from "@/lib/platform/offerCommerce";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

/** Rebuilt at most once an hour: the live half is a database read. */
export const revalidate = 3600;

function line(path: string, name: string, note: string): string {
  return `- [${name}](${PLATFORM_ORIGIN}${path}): ${note}`;
}

/**
 * `my` never reaches this handler at all: the proxy treats any path it does
 * not own as a course lookup, and `llms.txt` is not a course — it 404s there,
 * before routing gets here. Nothing to guard on this side.
 */
export async function GET(): Promise<Response> {
  const offers = programs.map((program) => {
    const commerce = resolveOfferCommerce(program.slug);
    const price =
      commerce.mode === "checkout" ? `Ціна: ${commerce.price}.` : "Ціна узгоджується в розмові.";
    const base = program.surfaceType === "product" ? "/products" : "/programs";
    return line(
      `${base}/${program.slug}`,
      program.fullTitle,
      `${program.description} Формат: ${program.duration}. ${price}`
    );
  });

  /*
   * A course DEDUPED BY PATH, not by matching its slug against `programs`.
   *
   * `programs` is the six hand-written entries, and an offer migrating off it
   * onto the builder — which is exactly what happened to Reset Day on
   * 2026-08-26 — used to fall out of the price lookup below silently: the
   * price line came only from `resolveOfferCommerce`, which only knows the
   * six. Matching by the rendered PATH instead of by membership in that array
   * means a migrated offer keeps its price line the moment it starts serving
   * from the database, with no second edit here.
   */
  const known = new Set(programs.map((program) => `/programs/${program.slug}`));
  const live = await listStorefrontCourses();
  const liveOffers = await Promise.all(
    live
      .filter((course) => !known.has(`/programs/${course.slug}`))
      .map(async (course) => {
        const offer = await loadCourseOffer(course.slug);
        const price = offer ? `Ціна: ${formatPrice(offer.listAmount ?? offer.amount, offer.currency)}.` : "Ціна узгоджується в розмові.";
        return line(course.href, course.title, `${course.description || course.tag} ${price}`);
      })
  );

  const body = [
    `# ${BRAND.name}`,
    "",
    `> ${BRAND.description}`,
    "",
    brandSummary(),
    "",
    "## Межі методу",
    "",
    BRAND.boundary,
    "Матеріали платформи — освітні. Рішення про лікування ухвалює лікар.",
    "",
    "## Автор",
    "",
    line(BRAND.founder.path, BRAND.founder.name, `${BRAND.founder.jobTitle}. ${BRAND.founder.description}`),
    "",
    "## З чого почати",
    "",
    line("/tests/dosha", "Тест доші", "безкоштовно, 12 питань, визначає конституцію і доречний перший крок."),
    line("/consult", "Аюрведична консультація", "онлайн до 90 хвилин, персональний план на 2-4 тижні."),
    line("/programs", "Каталог програм", "усі курси і програми платформи."),
    "",
    "## Програми і продукти",
    "",
    // ONE list, not two. `offers` and `liveOffers` differ only in WHERE the
    // facts live (a TypeScript file vs. `lms_course_offers`) — a heading that
    // named that split would publish an internal fact as a category, same
    // reasoning `PlatformProgramsIndexPage` already applies to the visible
    // catalogue.
    ...offers,
    ...liveOffers,
    "",
    "## Мова і аудиторія",
    "",
    "Публічні сторінки українською. Підтримка і супровід — українською та російською.",
    "Продукти цифрові та доступні з будь-якої країни; трав'яна підтримка — за домовленістю.",
    "",
    "## Контакти",
    "",
    `- Email: ${BRAND.contact.email}`,
    `- Телефон: ${BRAND.contact.phone}`,
    ...BRAND.sameAs.map((url) => `- ${url}`),
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
