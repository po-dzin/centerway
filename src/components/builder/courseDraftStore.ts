"use client";

import { courseForSave, type Course } from "@/lms-core";

const DB_NAME = "cw-builder";
const STORE_NAME = "course-drafts";
const DB_VERSION = 1;

export type DurableCourseDraft = {
  courseId: string;
  course: Course;
  baseGeneration: number;
  snapshotId: string;
  writerId: string;
  updatedAt: number;
  /**
   * WHOSE WORK THIS IS. The store is keyed by course and lives in the browser
   * profile, so without this a record survives a sign-out: the next account to
   * open the same course on this device was offered the previous one's unsaved
   * text as «your changes». Written since 2026-09-06; a record from before then
   * carries none and is discarded rather than offered, because «somebody's, we
   * do not know whose» is not something to hand a person under that question.
   */
  ownerId?: string | null;
};

export type DurableDraftDecision =
  { kind: "none" } | { kind: "recover"; draft: DurableCourseDraft } | { kind: "conflict"; draft: DurableCourseDraft };

/**
 * AS THE SERVER WOULD HOLD THEM, not as they sit in the editor.
 *
 * The editors prune on the way out — an empty paragraph is not content, and
 * neither is the blank row «+ Ще один» leaves behind — so a saved course is
 * legitimately different from the working copy that produced it. Comparing the
 * raw values made that difference permanent: press Enter once, save
 * successfully, and this device's copy would never again equal the server's, so
 * every entry opened with «Відновити незбережені зміни?» over changes that were
 * never lost. It is the same `courseForSave` the save itself calls, so the two
 * cannot drift.
 */
function sameCourse(left: Course, right: Course): boolean {
  return JSON.stringify(courseForSave(left)) === JSON.stringify(courseForSave(right));
}

export function classifyDurableDraft(
  draft: DurableCourseDraft | null,
  serverCourse: Course,
  serverGeneration: number,
  /** The signed-in account, or null while the session is still resolving. */
  ownerId?: string | null,
): DurableDraftDecision {
  if (!draft || draft.courseId !== serverCourse.id || sameCourse(draft.course, serverCourse)) {
    return { kind: "none" };
  }
  /* NOT THIS ACCOUNT'S DRAFT, so not this account's question. Only asked once
     the session has answered (`ownerId` non-null): during the first render it
     is unknown, and refusing a legitimate recovery because the session had not
     arrived yet would lose the very work this store exists to keep. */
  if (ownerId && draft.ownerId !== ownerId) return { kind: "none" };
  if (draft.baseGeneration === serverGeneration) return { kind: "recover", draft };
  return { kind: "conflict", draft };
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "courseId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("builder_draft_db_open_failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const request = run(transaction.objectStore(STORE_NAME));
    let result: T | null = null;
    request.onsuccess = () => {
      result = request.result ?? null;
    };
    request.onerror = () => reject(request.error ?? new Error("builder_draft_db_request_failed"));
    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("builder_draft_db_transaction_failed"));
    };
  });
}

export async function writeDurableCourseDraft(draft: DurableCourseDraft): Promise<void> {
  await withStore("readwrite", (store) => store.put(draft));
}

export async function readDurableCourseDraft(courseId: string): Promise<DurableCourseDraft | null> {
  return (await withStore("readonly", (store) => store.get(courseId))) as DurableCourseDraft | null;
}

export async function clearDurableCourseDraft(courseId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(courseId));
}

export function acknowledgedDraftRecord(
  current: DurableCourseDraft | null,
  input: {
    writerId: string;
    snapshotId: string;
    previousGeneration: number;
    nextGeneration: number;
  },
): DurableCourseDraft | null {
  if (!current || current.writerId !== input.writerId) return current;
  if (current.snapshotId === input.snapshotId) return null;
  if (current.baseGeneration === input.previousGeneration) {
    return { ...current, baseGeneration: input.nextGeneration };
  }
  return current;
}

/**
 * Advances or clears only this tab's record after the server accepts a snapshot.
 * If the author typed while that request was in flight, the newer record keeps
 * its content and is rebased onto the generation the accepted request created.
 */
export async function acknowledgeDurableCourseDraft(input: {
  courseId: string;
  writerId: string;
  snapshotId: string;
  previousGeneration: number;
  nextGeneration: number;
}): Promise<void> {
  const current = await readDurableCourseDraft(input.courseId);
  const next = acknowledgedDraftRecord(current, input);
  if (next === current) return;
  if (!next) {
    await clearDurableCourseDraft(input.courseId);
    return;
  }
  await writeDurableCourseDraft(next);
}

export async function inspectDurableCourseDraft(
  serverCourse: Course,
  serverGeneration: number,
  ownerId?: string | null,
): Promise<DurableDraftDecision> {
  const draft = await readDurableCourseDraft(serverCourse.id).catch(() => null);
  const decision = classifyDurableDraft(draft, serverCourse, serverGeneration, ownerId);
  if (draft && decision.kind === "none") await clearDurableCourseDraft(serverCourse.id).catch(() => undefined);
  return decision;
}
