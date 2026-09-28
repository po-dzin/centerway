/**
 * The corpus as the server sees it: assembled from the live catalogue, cached
 * for as long as a course stays unchanged.
 *
 * Tagged with the same cache tags the catalogue uses (`COURSE_LIST_TAG`), so a
 * publish in the builder drops this entry too. A knowledge base that answers
 * from yesterday's catalogue is the specific failure everybody expects of an
 * assistant, and here it would be self-inflicted: the invalidation already
 * exists and only had to be reused.
 *
 * ONLY PUBLISHED, ONLY VISIBLE. `listLiveCourses` returns what a learner may
 * reach; drafts and hidden courses are filtered here as well rather than
 * trusted, because "what the catalogue lists" and "what the assistant may
 * describe" have to be the same set for a reason that is easy to state and easy
 * to forget: an assistant that mentions an unlisted course has published it.
 */

import { unstable_cache } from "next/cache";

import { COURSE_LIST_TAG, listLiveCourses } from "@/lib/lms/liveCatalog";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseCourseOfferCode } from "@/lms-core/offerCode";
import { buildCorpus, type CorpusOffer } from "./corpus";
import { buildIndex, type KnowledgeIndex } from "./search";
import { validateCorpus, type KnowledgeDoc } from "./types";

/** Bounds staleness if a publish ever fails to revalidate. Same reasoning as the catalogue's. */
const REVALIDATE_SECONDS = 300;

async function collect(): Promise<KnowledgeDoc[]> {
  const courses = (await listLiveCourses()).filter(
    (course) => course.status === "published" && course.visibility !== "hidden",
  );

  const docs = buildCorpus({ courses, offers: await loadCorpusOffers(courses) });

  // Reported, never thrown. A malformed document is a content problem, and
  // taking the assistant down over one is worse than answering from the rest of
  // a corpus that is fine — but a problem nobody is told about is how a corpus
  // rots quietly, so it goes to the log where the deploy can see it.
  const problems = validateCorpus(docs);
  if (problems.length) {
    console.error("[knowledge] corpus problems:", problems.map((p) => `${p.id}:${p.problem}`).join(", "));
  }

  return docs;
}

type OfferRow = {
  code: string;
  mode: string;
  amount: number | null;
  currency: string;
  experience_id: string;
  invoice_heading: { uk?: string } | null;
  invoice_description: { uk?: string } | null;
};

/**
 * The offers on sale, from the same table the checkout charges. Only things on
 * the shelf, and only through a course the assistant may describe — a price
 * for a hidden course would publish it.
 */
async function loadCorpusOffers(courses: Awaited<ReturnType<typeof listLiveCourses>>): Promise<CorpusOffer[]> {
  try {
    const db = supabaseAdmin();
    const [offers, things, links] = await Promise.all([
      db
        .from("experience_offers")
        .select("code, mode, amount, currency, experience_id, invoice_heading, invoice_description")
        .eq("active", true),
      db.from("experiences").select("id, kind, title, listed"),
      db.from("lms_courses").select("slug, experience_id"),
    ]);
    if (offers.error || things.error || links.error) return [];
    const thingById = new Map((things.data ?? []).map((thing) => [thing.id as string, thing]));
    const courseBySlug = new Map(courses.map((course) => [course.slug, course]));
    // First visible course of each thing, for offers not named after one (`way21-group`).
    const courseByThing = new Map<string, (typeof courses)[number]>();
    for (const link of links.data ?? []) {
      const course = courseBySlug.get(link.slug as string);
      const thingId = link.experience_id as string | null;
      if (course && thingId && !courseByThing.has(thingId)) courseByThing.set(thingId, course);
    }

    const out: CorpusOffer[] = [];
    for (const row of (offers.data ?? []) as OfferRow[]) {
      const thing = thingById.get(row.experience_id);
      if (!thing?.listed) continue;
      const isContent = ["course", "mini", "checklist"].includes(thing.kind as string);
      const ownSlug = parseCourseOfferCode(row.code);
      const course = isContent ? (ownSlug && courseBySlug.get(ownSlug)) || courseByThing.get(row.experience_id) : null;
      if (isContent && !course) continue;
      const heading = row.invoice_heading?.uk?.trim() || course?.title || (thing.title as string | null) || row.code;
      out.push({
        code: row.code,
        heading,
        description: row.invoice_description?.uk?.trim() || null,
        mode: row.mode === "lead" || row.mode === "free" ? row.mode : "checkout",
        amount: row.amount,
        currency: row.currency,
        delivery: course ? "course" : "cabinet",
        href: course ? `/programs/${course.programSlug}` : null,
      });
    }
    return out;
  } catch {
    // The rest of the corpus stands without prices; an assistant that says
    // «уточніть ціну» is better than one that is down.
    return [];
  }
}

const cachedCorpus = unstable_cache(collect, ["agent-knowledge-corpus"], {
  tags: [COURSE_LIST_TAG],
  revalidate: REVALIDATE_SECONDS,
});

export async function loadKnowledgeCorpus(): Promise<KnowledgeDoc[]> {
  return cachedCorpus();
}

/**
 * The searchable form.
 *
 * Rebuilt per request from the cached documents rather than cached itself: a
 * `Map` does not survive the cache boundary, and building an index over forty
 * documents is microseconds. When that stops being true the fix is a serialised
 * index, not a longer-lived one.
 */
export async function loadKnowledgeIndex(): Promise<KnowledgeIndex> {
  return buildIndex(await loadKnowledgeCorpus());
}
