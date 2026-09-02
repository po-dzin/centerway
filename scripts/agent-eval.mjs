/**
 * npm run agent:eval [-- --db] [-- --k=5]
 *
 * Runs the knowledge base's retrieval against the labelled questions and prints
 * what missed.
 *
 * TWO SOURCES OF CASES, and the second one is the point of the whole exercise:
 *
 *   · `data/agent/question-eval.json` — the seed, written by hand because at
 *     the start there were no captured questions to label. Always used.
 *   · `--db` — the questions people actually asked, from `agent_questions`,
 *     once a human has said which document should have answered them. Needs
 *     database credentials; without them the flag says so and exits rather than
 *     quietly reporting the seed's number as if it covered real traffic.
 *
 * Runs against the SNAPSHOT catalogue (`data/courses/*.json`), not the live
 * one, so the number is reproducible from a checkout with no database. The
 * difference matters only for courses published since the last `lms:pull`.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const useDatabase = args.includes("--db");
const k = Number(args.find((arg) => arg.startsWith("--k="))?.slice(4) ?? 5);

const { snapshotCourses } = await import("../src/lib/lms/catalog.ts");
const { buildCorpus } = await import("../src/lib/agent/knowledge/corpus.ts");
const { buildIndex } = await import("../src/lib/agent/knowledge/search.ts");
const { evaluateRetrieval, formatReport } = await import("../src/lib/agent/knowledge/eval.ts");

const seedPath = path.join(process.cwd(), "data/agent/question-eval.json");
const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const cases = [...seed.cases];

if (useDatabase) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error("agent:eval --db потребує NEXT_PUBLIC_SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const { listQuestions } = await import("../src/lib/agent/questions/store.ts");
  const stored = await listQuestions({ labelled: true, limit: 1000 });
  for (const question of stored) {
    cases.push({ question: question.text, expectedDocId: question.expectedDocId, origin: question.source });
  }
  console.log(`Зібрано ${stored.length} розмічених питань із бази.`);
}

const index = buildIndex(buildCorpus({ courses: snapshotCourses() }));
const report = evaluateRetrieval(index, cases, { k });

console.log(`\nКорпус: ${index.docs.length} документів. Кейсів: ${report.total}.`);
console.log(formatReport(report, k));

if (report.unknownExpectations.length) {
  console.log("\nМітки на документи, яких у корпусі немає:");
  for (const stale of report.unknownExpectations) console.log(`  ? ${stale}`);
}

if (report.misses.length) {
  console.log("\nПромахи:");
  for (const miss of report.misses) {
    console.log(`  ✗ «${miss.question}»`);
    console.log(`      чекали: ${miss.expectedDocId}`);
    console.log(`      знайшли: ${miss.got.join(", ") || "нічого"}`);
  }
}

// Non-zero on a miss so this can gate a branch later. It is NOT in `ds:qa`
// today: the same cases already run in `eval.test.ts`, and a second gate over
// the identical seed would only slow the suite down. The script earns its exit
// code once `--db` is the normal way to run it.
process.exit(report.misses.length > 0 ? 1 : 0);
