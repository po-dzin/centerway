"use client";

import type { Course } from "@/lms-core";

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
};

export type DurableDraftDecision =
  | { kind: "none" }
  | { kind: "recover"; draft: DurableCourseDraft }
  | { kind: "conflict"; draft: DurableCourseDraft };

function sameCourse(left: Course, right: Course): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function classifyDurableDraft(
  draft: DurableCourseDraft | null,
  serverCourse: Course,
  serverGeneration: number,
): DurableDraftDecision {
  if (!draft || draft.courseId !== serverCourse.id || sameCourse(draft.course, serverCourse)) {
    return { kind: "none" };
  }
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
  return await withStore("readonly", (store) => store.get(courseId)) as DurableCourseDraft | null;
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
): Promise<DurableDraftDecision> {
  const draft = await readDurableCourseDraft(serverCourse.id).catch(() => null);
  const decision = classifyDurableDraft(draft, serverCourse, serverGeneration);
  if (draft && decision.kind === "none") await clearDurableCourseDraft(serverCourse.id).catch(() => undefined);
  return decision;
}
