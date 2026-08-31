export type WorkspaceMode = "course" | "content" | "offer" | "author" | "release";
export const DEFAULT_COURSE_WORKSPACE_MODE: WorkspaceMode = "course";

/** Stable hashes are shared by the rail, mobile navigation and blocker links. */
export const COURSE_WORKSPACE_HASH: Record<WorkspaceMode, string> = {
  course: "#course-overview",
  content: "#course-structure",
  offer: "#course-offer",
  author: "#course-author",
  release: "#course-release",
};

export function courseWorkspaceModeFromHash(hash: string): WorkspaceMode {
  return (Object.keys(COURSE_WORKSPACE_HASH) as WorkspaceMode[]).find(
    (mode) => COURSE_WORKSPACE_HASH[mode] === hash,
  ) ?? DEFAULT_COURSE_WORKSPACE_MODE;
}
