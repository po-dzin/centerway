/**
 * Tell the crawlers the pages changed, instead of waiting for them to notice.
 *
 * WHY THIS EXISTS. The brand signature was rewritten on 2026-08-27 — the
 * platform stopped calling itself "аюрведична платформа відновлення" and became
 * "курована платформа цілісного відновлення" (src/lib/brand/identity.ts). Every
 * live surface served the new line the same day. Bing kept quoting the old one
 * in its results for weeks, which is what Edge's address bar, Copilot and every
 * answer engine reading Bing's index then repeat. Nothing was broken in the
 * pages: the index was simply stale, and a sitemap `lastmod` is a hint a
 * crawler is free to ignore.
 *
 * IndexNow is the one channel that is a REQUEST rather than a hint: Bing,
 * Yandex, Seznam and Naver share one endpoint, and a submitted URL is fetched
 * again within days instead of whenever the crawl budget comes round. One ping
 * reaches all of them.
 *
 * GOOGLE IS NOT HERE — it does not participate in IndexNow, and it retired the
 * sitemap ping in 2023. The only lever for Google is "Request indexing" in
 * Search Console, by hand, per URL. This script prints that reminder rather
 * than pretending it covered it.
 *
 * THE KEY IS PUBLIC ON PURPOSE. IndexNow authenticates by asking the host to
 * serve the key back from its own root: `public/<key>.txt`. Anyone can read it;
 * what it proves is that whoever submits controls the site. Do not "hide" it —
 * a key the host does not serve is a submission that is rejected.
 *
 * Usage:
 *   npm run seo:indexnow                     # every URL in the live sitemap
 *   npm run seo:indexnow -- /consult /programs   # only these paths
 *   npm run seo:indexnow -- --dry-run        # print what would be sent
 */

import { readdirSync } from "node:fs";
import path from "node:path";

const ORIGIN = process.env.PLATFORM_ORIGIN ?? "https://www.centerway.net.ua";
const ENDPOINT = "https://api.indexnow.org/indexnow";
/** The engines that share the protocol, for the line printed at the end. */
const ENGINES = "Bing / Edge / Copilot, Yandex, Seznam, Naver";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const paths = args.filter((arg) => !arg.startsWith("--"));

/**
 * The key is read from the file the host serves, not from a constant here —
 * so the value submitted and the value a crawler fetches back cannot drift.
 */
function readKey() {
  const publicDir = path.join(process.cwd(), "public");
  const keyFiles = readdirSync(publicDir).filter((name) => /^[0-9a-f]{8,128}\.txt$/.test(name));
  if (keyFiles.length !== 1) {
    console.error(
      keyFiles.length === 0
        ? "seo:indexnow FAILED — no IndexNow key file in public/. Create public/<32-hex>.txt containing that same key."
        : `seo:indexnow FAILED — ${keyFiles.length} key files in public/ (${keyFiles.join(", ")}). Keep exactly one.`,
    );
    process.exit(1);
  }
  return keyFiles[0].replace(/\.txt$/, "");
}

/** The live sitemap is the list of what is public — it is already derived, so it cannot disagree with routing. */
async function sitemapUrls() {
  const response = await fetch(`${ORIGIN}/sitemap.xml`, { headers: { "user-agent": "centerway-indexnow" } });
  if (!response.ok) {
    console.error(`seo:indexnow FAILED — ${ORIGIN}/sitemap.xml answered ${response.status}`);
    process.exit(1);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

const key = readKey();
const urlList = paths.length
  ? paths.map((entry) => (entry.startsWith("http") ? entry : `${ORIGIN}${entry.startsWith("/") ? entry : `/${entry}`}`))
  : await sitemapUrls();

if (urlList.length === 0) {
  console.error("seo:indexnow FAILED — nothing to submit.");
  process.exit(1);
}

const host = new URL(ORIGIN).host;
const payload = {
  host,
  key,
  keyLocation: `${ORIGIN}/${key}.txt`,
  urlList,
};

if (dryRun) {
  console.log(`seo:indexnow DRY RUN — would submit ${urlList.length} URL(s) as ${host}:`);
  for (const url of urlList) console.log(`  ${url}`);
  console.log(`\nKey location: ${payload.keyLocation}`);
  process.exit(0);
}

/*
 * The key file has to be reachable BEFORE the submission, not after — a
 * submission whose key 404s is discarded silently, and the only symptom would
 * be the same stale snippet a week later.
 */
const keyCheck = await fetch(payload.keyLocation, { headers: { "user-agent": "centerway-indexnow" } });
const keyBody = keyCheck.ok ? (await keyCheck.text()).trim() : "";
if (!keyCheck.ok || keyBody !== key) {
  console.error(
    `seo:indexnow FAILED — ${payload.keyLocation} answered ${keyCheck.status}${
      keyCheck.ok ? ` with "${keyBody.slice(0, 40)}"` : ""
    }. The key file must be deployed before submitting.`,
  );
  process.exit(1);
}

const response = await fetch(ENDPOINT, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(payload),
});

/* 200 and 202 both mean accepted; 202 only adds "the key is still being verified". */
if (response.status !== 200 && response.status !== 202) {
  const body = await response.text().catch(() => "");
  console.error(`seo:indexnow FAILED — endpoint answered ${response.status} ${body.slice(0, 200)}`);
  process.exit(1);
}

console.log(`seo:indexnow OK — ${urlList.length} URL(s) submitted for ${host} (${response.status}).`);
console.log(`Reaches: ${ENGINES}. Recrawl usually lands within a few days.`);
console.log("Google ignores IndexNow — request indexing for the home page in Search Console by hand.");
