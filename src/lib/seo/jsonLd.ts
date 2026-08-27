/**
 * Structured data — the part of the platform an answer engine can actually cite.
 *
 * WHY IT EXISTS. The platform shipped without a single `application/ld+json`
 * block. Everything a machine could learn about it — that CenterWay is an
 * organisation, that Євгеній Корякін is the person behind it, that «Шлях 21» is
 * a 21-day course with a price — had to be inferred from prose. Search results
 * survive that; a generative answer does not: it quotes whatever is stated
 * plainly, and nothing here was stated plainly.
 *
 * ONE GRAPH, NOT A PILE. Every node is given a stable `@id` on the platform
 * origin and refers to the others by that id, so the Organization emitted in
 * the layout and the Course emitted on a program page are the same graph rather
 * than two unrelated claims about the same brand.
 *
 * WHAT IS DELIBERATELY ABSENT. No `FAQPage`: no page here carries a real
 * question-and-answer block, and inventing one to win a rich result is exactly
 * the thing that gets structured data ignored. No `Review`/`AggregateRating`:
 * the testimonials on the platform are not collected as ratings, and marking
 * them up as such would be a claim the data cannot support.
 */

import { BRAND, BRAND_COVER, brandSummary } from "@/lib/brand/identity";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

type JsonLdNode = Record<string, unknown>;

const ORG_ID = `${PLATFORM_ORIGIN}/#organization`;
const SITE_ID = `${PLATFORM_ORIGIN}/#website`;
const PERSON_ID = `${PLATFORM_ORIGIN}${BRAND.founder.path}#person`;

function abs(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${PLATFORM_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The brand itself.
 *
 * `EducationalOrganization` as well as `Organization`: what the platform sells
 * is courses, and the narrower type is what makes a Course node's `provider`
 * mean something.
 */
export function organizationLd(): JsonLdNode {
  return {
    "@type": ["Organization", "EducationalOrganization"],
    "@id": ORG_ID,
    name: BRAND.name,
    alternateName: BRAND.category,
    url: `${PLATFORM_ORIGIN}/`,
    logo: abs("/cw/brand/cw-icon-512.png"),
    image: abs(BRAND_COVER),
    description: brandSummary(),
    slogan: BRAND.tagline,
    knowsAbout: [...BRAND.entities],
    sameAs: [...BRAND.sameAs],
    founder: { "@id": PERSON_ID },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: BRAND.contact.email,
      telephone: BRAND.contact.phone,
      availableLanguage: ["uk", "en"],
    },
  };
}

/** The site, so a citation has something to name besides a bare URL. */
export function websiteLd(): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${PLATFORM_ORIGIN}/`,
    name: BRAND.name,
    description: BRAND.description,
    inLanguage: "uk-UA",
    publisher: { "@id": ORG_ID },
  };
}

/** The person the method is answered for. */
export function personLd(): JsonLdNode {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: BRAND.founder.name,
    jobTitle: BRAND.founder.jobTitle,
    description: BRAND.founder.description,
    url: abs(BRAND.founder.path),
    worksFor: { "@id": ORG_ID },
    sameAs: [...BRAND.sameAs],
  };
}

export type CourseFacts = {
  path: string;
  name: string;
  description: string;
  /** What the page is allowed to PRINT — never the charged amount. `null` when there is no agreed price. */
  price: number | null;
  currency?: string;
  /** Human duration as the page states it ("21 день"), for the instance. */
  duration?: string;
  image?: string;
};

/**
 * A program, as a course.
 *
 * `hasCourseInstance` is not optional in practice: a Course with no instance is
 * treated as an outline rather than something anyone can take, and every
 * program here is online and self-paced.
 */
export function courseLd(facts: CourseFacts): JsonLdNode {
  const url = abs(facts.path);
  const node: JsonLdNode = {
    "@type": "Course",
    "@id": `${url}#course`,
    name: facts.name,
    description: facts.description,
    url,
    inLanguage: "uk-UA",
    provider: { "@id": ORG_ID },
    isAccessibleForFree: false,
    ...(facts.image ? { image: abs(facts.image) } : {}),
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: facts.duration ?? undefined,
      inLanguage: "uk-UA",
      instructor: { "@id": PERSON_ID },
    },
  };

  if (facts.price !== null) {
    node.offers = {
      "@type": "Offer",
      price: facts.price,
      priceCurrency: facts.currency ?? "UAH",
      availability: "https://schema.org/InStock",
      category: "Paid",
      url,
    };
  }

  return node;
}

/** The consultation: a service, not a course — nothing is delivered as lessons. */
export function serviceLd(facts: { path: string; name: string; description: string }): JsonLdNode {
  const url = abs(facts.path);
  return {
    "@type": "Service",
    "@id": `${url}#service`,
    name: facts.name,
    description: facts.description,
    url,
    serviceType: "Аюрведична консультація",
    provider: { "@id": ORG_ID },
    areaServed: "Worldwide",
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: url,
      availableLanguage: ["uk", "en"],
    },
  };
}

/**
 * A physical product.
 *
 * No `offers` when there is no agreed price. An Offer with a missing price is
 * an invalid one, and inventing a figure to make a rich result appear would
 * publish a price nobody agreed to.
 */
export function productLd(facts: {
  path: string;
  name: string;
  description: string;
  price: number | null;
  currency?: string;
  image?: string;
}): JsonLdNode {
  const url = abs(facts.path);
  return {
    "@type": "Product",
    "@id": `${url}#product`,
    name: facts.name,
    description: facts.description,
    url,
    brand: { "@id": ORG_ID },
    ...(facts.image ? { image: abs(facts.image) } : {}),
    ...(facts.price === null
      ? {}
      : {
          offers: {
            "@type": "Offer",
            price: facts.price,
            priceCurrency: facts.currency ?? "UAH",
            availability: "https://schema.org/InStock",
            url,
          },
        }),
  };
}

/** The catalogue, as a list — so «які програми є» has one node to answer from. */
export function itemListLd(facts: {
  path: string;
  name: string;
  items: { path: string; name: string }[];
}): JsonLdNode {
  return {
    "@type": "ItemList",
    "@id": `${abs(facts.path)}#list`,
    name: facts.name,
    itemListElement: facts.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: abs(item.path),
    })),
  };
}

/** Where a page sits, for the crumb line in a result. */
export function breadcrumbLd(trail: { path: string; name: string }[]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: step.name,
      item: abs(step.path),
    })),
  };
}

/** Wrap nodes into one graph document. */
export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { "@context": "https://schema.org", "@graph": nodes };
}
