/**
 * What a thread shows after a read (2026-10-21), kept apart from the component
 * so the rule that broke can be tested on its own.
 *
 * A failed read is not an empty thread: turning it into `[]` told the card
 * «0 коментарів» under a post that had them. A failure keeps what is shown —
 * still `null` (not loaded yet) if nothing was — and a reader who signed out
 * loses their own held comments, which only they could see.
 */

type Shown<T> = (T & { held?: boolean })[] | null;

export function commentsAfterRead<T>(
  current: Shown<T>,
  result: { ok: true; comments: (T & { held?: boolean })[] } | { ok: false },
  signedIn: boolean,
): Shown<T> {
  if (result.ok) return result.comments;
  if (signedIn || current === null) return current;
  return current.filter((comment) => !comment.held);
}
