/**
 * The assistant's world as the server sees it: the cached knowledge index and
 * the live courses a stranger may find. Built per request, from caches that a
 * builder publish already invalidates (`COURSE_LIST_TAG`).
 *
 * Server-only — `listLiveCourses` reads with the service role.
 */

import "server-only";

import { loadKnowledgeIndex } from "@/lib/agent/knowledge/server";
import { listLiveCourses } from "@/lib/lms/liveCatalog";
import { isFindable, type AssistantWorld } from "./tools";

export async function loadAssistantWorld(): Promise<AssistantWorld> {
  const [index, courses] = await Promise.all([loadKnowledgeIndex(), listLiveCourses()]);
  return { index, courses: courses.filter(isFindable) };
}
