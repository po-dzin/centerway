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
import { buildCorpus } from "./corpus";
import { buildIndex, type KnowledgeIndex } from "./search";
import { validateCorpus, type KnowledgeDoc } from "./types";

/** Bounds staleness if a publish ever fails to revalidate. Same reasoning as the catalogue's. */
const REVALIDATE_SECONDS = 300;

async function collect(): Promise<KnowledgeDoc[]> {
  const courses = (await listLiveCourses()).filter(
    (course) => course.status === "published" && course.visibility !== "hidden"
  );

  const docs = buildCorpus({ courses });

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
