/**
 * Does every public surface answer "what is CenterWay" with the SAME sentence?
 *
 * WHY. src/lib/brand/identity.ts exists so the answer is written once, but
 * writing it once only holds if nothing downstream quietly keeps its own copy —
 * the web app manifest did exactly that until this check was written, and a
 * fourth wording is what an install prompt, a browser profile and anything
 * reading the manifest would have shown. The readers are not only browsers:
 * Bing feeds Edge and Copilot, Google feeds its overviews, and answer engines
 * read /llms.txt and the structured data directly. One drift is one reader
 * repeating a retired positioning.
 *
 * THE RETIRED LINE IS CHECKED BY NAME. "аюрведична платформа" was the category
 * until 2026-08-27; ayurveda is now the METHOD, named inside the summary and in
 * the consultation's own title, never as what the platform is. A page that says
 * it again has regressed, so the phrase is failed on as a category claim.
 *
 * NEEDS THE LIVE SITE — this is a `smoke:*`, not a `guard:*`: it reads what is
 * actually served, because the whole class of bug it catches is "the repository
 * is right and the surface is not".
 *
 * Usage:
 *   npm run smoke:seo:signature
 *   npm run smoke:seo:signature -- --origin http://localhost:8000
 */

import { BRAND, brandSummary } from "../src/lib/brand/identity.ts";

const args = process.argv.slice(2);
const originArg = args.indexOf("--origin");
const ORIGIN = originArg === -1 ? (process.env.PLATFORM_ORIGIN ?? BRAND.origin) : args[originArg + 1];

/** The category phrase that stopped being true. */
const RETIRED = /аюрведичн\w*\s+платформ/i;

const failures = [];
const notes = [];

function check(label, actual, expected) {
  if (actual === expected) return;
  failures.push(`${label}\n    expected: ${expected}\n    served:   ${actual ?? "(missing)"}`);
}

async function get(url, init) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "centerway-seo-signature" },
    ...init,
  });
  return { response, body: await response.text() };
}

function meta(html, attribute, name) {
  const pattern = new RegExp(`<meta[^>]+${attribute}="${name}"[^>]+content="([^"]*)"`, "i");
  const reversed = new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attribute}="${name}"`, "i");
  const match = html.match(pattern) ?? html.match(reversed);
  return match?.[1];
}

function decode(value) {
  return value
    ?.replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/* ---- 1. The home page: the sentence every browser quotes. ------------- */

const home = await get(`${ORIGIN}/`);
if (!home.response.ok) {
  console.error(`smoke:seo:signature FAILED — ${ORIGIN}/ answered ${home.response.status}`);
  process.exit(1);
}

const expectedTitle = `${BRAND.name} — ${BRAND.category}`;
check("home <title>", decode(home.body.match(/<title>([^<]*)<\/title>/i)?.[1]), expectedTitle);
check("home meta description", decode(meta(home.body, "name", "description")), BRAND.description);
check("home og:title", decode(meta(home.body, "property", "og:title")), expectedTitle);
check("home og:description", decode(meta(home.body, "property", "og:description")), BRAND.description);
check("home twitter:title", decode(meta(home.body, "name", "twitter:title")), expectedTitle);
check("home twitter:description", decode(meta(home.body, "name", "twitter:description")), BRAND.description);

/* ---- 2. Structured data: the sentence answer engines lift verbatim. ---- */

const nodes = [];
for (const block of home.body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
  try {
    const parsed = JSON.parse(block[1]);
    const graph = Array.isArray(parsed) ? parsed : (parsed["@graph"] ?? [parsed]);
    nodes.push(...graph);
  } catch {
    failures.push("home JSON-LD is not parseable");
  }
}

const types = (node) => (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]);
const website = nodes.find((node) => types(node).includes("WebSite"));
const organisation = nodes.find((node) => types(node).includes("Organization"));

if (!website) failures.push("home JSON-LD has no WebSite node");
else check("JSON-LD WebSite.description", website.description, BRAND.description);

if (!organisation) failures.push("home JSON-LD has no Organization node");
else check("JSON-LD Organization.description", organisation.description, brandSummary());

/* ---- 3. /llms.txt: what an assistant reads instead of the pages. ------- */

const llms = await get(`${ORIGIN}/llms.txt`);
if (!llms.response.ok) failures.push(`/llms.txt answered ${llms.response.status}`);
else {
  if (!llms.body.includes(`> ${BRAND.description}`)) failures.push("/llms.txt does not open with BRAND.description");
  if (!llms.body.includes(BRAND.boundary)) failures.push("/llms.txt does not carry the method boundary");
}

/* ---- 4. The manifest: what an installed app and a browser profile show. */

const manifest = await get(`${ORIGIN}/manifest.webmanifest`);
if (!manifest.response.ok) failures.push(`/manifest.webmanifest answered ${manifest.response.status}`);
else {
  try {
    check("manifest description", JSON.parse(manifest.body).description, BRAND.description);
  } catch {
    failures.push("/manifest.webmanifest is not parseable");
  }
}

/* ---- 5. Every indexed page: nobody re-states the retired category. ----- */

const sitemap = await get(`${ORIGIN}/sitemap.xml`);
if (!sitemap.response.ok) failures.push(`/sitemap.xml answered ${sitemap.response.status}`);
else {
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  notes.push(`${urls.length} indexed URL(s) read from the sitemap`);
  for (const url of urls) {
    const page = await get(url);
    if (!page.response.ok) {
      failures.push(`${url} answered ${page.response.status} — it is in the sitemap`);
      continue;
    }
    const head = page.body.slice(0, page.body.indexOf("</head>") + 7);
    if (RETIRED.test(head)) {
      failures.push(`${url} still calls the platform an "аюрведична платформа" in its head`);
    }
  }
}

/* ---- 6. One home, one host. ------------------------------------------- */

const apex = await get(BRAND.origin.replace("://www.", "://"));
if (new URL(apex.response.url).origin !== BRAND.origin) {
  failures.push(`the apex resolves to ${apex.response.url} instead of ${BRAND.origin} — two hosts, two index entries`);
}

/* ---- Verdict ----------------------------------------------------------- */

for (const note of notes) console.log(`  ${note}`);

if (failures.length) {
  console.error("");
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(`\nsmoke:seo:signature FAILED — ${failures.length} surface(s) answer with a different signature.`);
  process.exit(1);
}

console.log(`smoke:seo:signature OK — every public surface on ${ORIGIN} carries one signature.`);
