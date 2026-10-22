/**
 * ONE ADDRESS PER PROGRAM: `/go/<program>` (owner, 2026-10-17).
 *
 * The link an admin copies after granting access, the link a mailing carries,
 * the link a bot prints — all of them are this one shape, whatever the program
 * is called today. The name is resolved the way the offer page resolves it:
 * the program's public address (`reboot`, `irem`), the course row's own slug
 * (`short`, `irem-gymnastics`), or any old name `experience_aliases` remembers.
 *
 * WHERE IT LEADS. Without a personal offer: to the course on the personal host.
 * Access is not opened here — the grant is — and a reader who is not signed in
 * meets the standard door in front of `/learn`, which returns them to the
 * course (`signInReturn.ts`). With `?offer_token`: to the program's page on the
 * storefront, where the token rides into the checkout and `/api/pay/start`
 * charges the personal price.
 *
 * `/go/irem` WAS ITS OWN ROUTE and is folded in here. Its job — a bot or a
 * mailing hands over who the reader is and a campaign, and gets back a
 * personal IREM price — is kept for the links already sent, but the price now
 * lands on the storefront page, not on the platform's home, which read no
 * token at all.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminClient } from "@/lib/auth/adminClient";
import { resolveExperience } from "@/lib/experiences/registry";
import { IREM_OFFER_CODE, issueOrReuseIremPersonalOffer } from "@/lib/landing/offers";
import { listLiveCourses } from "@/lib/lms/liveCatalog";
import { normalizeEmail } from "@/lib/strings";
import { LEARNING_PATH_PREFIX, PERSONAL_ORIGIN, PLATFORM_ORIGIN, canonicalPersonalPath } from "@/lib/surfaces/catalog";
import { courseOfferCode, type Course } from "@/lms-core";

export const runtime = "nodejs";

const OFFER_TOKEN_PARAM = "offer_token";

/* Who the reader is and why they were sent: read here, never forwarded — an
   email in the address bar of the page it lands on is a leak, not a feature. */
const CONTROL_QUERY_PARAMS = new Set([
  OFFER_TOKEN_PARAM,
  "tguserid",
  "tg_user_id",
  "email",
  "recipient_key",
  "campaign",
  "channel",
  "note",
  "source",
]);

function readTrimmed(searchParams: URLSearchParams, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** The live course a name stands for, or null. Drafts are not a destination. */
async function findCourse(name: string): Promise<Course | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;

  const courses = (await listLiveCourses()).filter((course) => course.status === "published");
  const byName = (candidate: string) =>
    courses.find((course) => course.programSlug === candidate) ??
    courses.find((course) => course.slug === candidate) ??
    null;

  const direct = byName(key);
  if (direct) return direct;

  try {
    const found = await resolveExperience(adminClient(), key);
    return found ? byName(found.experience.slug) : null;
  } catch {
    // A registry that cannot be read leaves an old name unresolved, not a 500.
    return null;
  }
}

/**
 * The personal IREM price a bot or a mailing asks for, as a token, or null
 * when the request is not one of those (no identity or no campaign).
 */
async function issueLegacyIremToken(searchParams: URLSearchParams): Promise<string | null> {
  const tgUserId = readTrimmed(searchParams, "tgUserId", "tg_user_id");
  const rawEmail = readTrimmed(searchParams, "email");
  const email = rawEmail ? normalizeEmail(rawEmail) : null;
  const campaign = readTrimmed(searchParams, "campaign");
  const recipientKey = tgUserId ? `tg:${tgUserId}` : email ? `email:${email}` : null;
  if (!recipientKey || !campaign) return null;

  const channel = readTrimmed(searchParams, "channel") ?? (email ? "email" : "telegram");
  const source = readTrimmed(searchParams, "source") ?? (email ? "sendpulse" : "smartsender");
  try {
    const resolved = await issueOrReuseIremPersonalOffer({
      product: "irem",
      recipientKey,
      campaign,
      channel,
      note: readTrimmed(searchParams, "note") ?? `dynamic:${source}`,
    });
    return resolved.offer.offerToken;
  } catch (error) {
    // The reader still reaches the page and can buy at the public price.
    console.error("go_offer_issue_failed", {
      campaign,
      channel,
      source,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Everything the link carried that is not a control field (utm, fbclid…). */
function carryQuery(from: URLSearchParams, to: URL): URL {
  for (const [key, value] of from.entries()) {
    if (CONTROL_QUERY_PARAMS.has(key.toLowerCase())) continue;
    if (!to.searchParams.has(key)) to.searchParams.set(key, value);
  }
  return to;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ program: string }> }) {
  const { program } = await params;
  const url = new URL(req.url);
  const course = await findCourse(program);

  if (!course) {
    return NextResponse.redirect(carryQuery(url.searchParams, new URL("/programs", PLATFORM_ORIGIN)), 302);
  }

  const offerToken =
    readTrimmed(url.searchParams, OFFER_TOKEN_PARAM) ??
    (courseOfferCode(course.slug) === IREM_OFFER_CODE ? await issueLegacyIremToken(url.searchParams) : null);

  if (offerToken) {
    const storefront = new URL(`/programs/${course.programSlug}`, PLATFORM_ORIGIN);
    storefront.searchParams.set(OFFER_TOKEN_PARAM, offerToken);
    return NextResponse.redirect(carryQuery(url.searchParams, storefront), 302);
  }

  const learnPath = canonicalPersonalPath(`${LEARNING_PATH_PREFIX}/${course.slug}`);
  return NextResponse.redirect(carryQuery(url.searchParams, new URL(learnPath, PERSONAL_ORIGIN)), 302);
}
