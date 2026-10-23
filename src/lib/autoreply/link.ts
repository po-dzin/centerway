/**
 * The link a rule sends, with the tags that tell analytics which rule brought
 * the person. Pure, so the admin screen can show the exact result.
 */

export const DEFAULT_OPEN_LABEL = "Отримати лінк";
export const DEFAULT_LINK_LABEL = "Відкрити";

const LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "h",
  ґ: "g",
  д: "d",
  е: "e",
  є: "ie",
  ж: "zh",
  з: "z",
  и: "y",
  і: "i",
  ї: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ь: "",
  ю: "iu",
  я: "ia",
  ы: "y",
  э: "e",
  ё: "io",
  ъ: "",
};

/** A campaign name as a tag: lowercase Latin letters and digits joined by dashes. */
export function campaignSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/./gu, (char) => LATIN[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * The button link, absolute. A link that already carries its own utm_ tags is
 * sent as written; otherwise the Instagram tags are added.
 */
export function buildLink(url: string, rule: { name: string; utmCampaign: string | null }, siteOrigin: string): string {
  const link = new URL(url, siteOrigin);
  if ([...link.searchParams.keys()].some((key) => key.startsWith("utm_"))) return link.toString();
  const campaign = campaignSlug(rule.utmCampaign || rule.name);
  link.searchParams.set("utm_source", "instagram");
  link.searchParams.set("utm_medium", "autodm");
  if (campaign) link.searchParams.set("utm_campaign", campaign);
  return link.toString();
}
