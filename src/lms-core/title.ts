/**
 * A course title, split into the two things an author writes into it.
 *
 * WHY THIS IS IN THE CORE. The split itself was already the storefront's rule —
 * `src/lib/platform/offerPreview.ts` has cut the h1 and the card at the spaced
 * dash since the day «Розвантажувальний день — практикум з умовного
 * голодування» arrived from the builder. What was NOT in the core was the
 * knowledge that the rule exists, so when a hard title ceiling was added to
 * `validateCourse` (2026-09-01) it measured the whole string — name plus the
 * explanation hung off it — and rejected the very course the split was written
 * for. A row that no longer validates is dropped from the shelf by
 * `listLiveCourses` and cannot even be OPENED in the builder, so the course
 * disappeared from the storefront while the admin screen still called it «у
 * продажу».
 *
 * The ceiling belongs on the NAME, because the name is what has nowhere to go:
 * two lines of card, one h1, one invoice line. The tail has a home — the
 * subtitle under the h1 — and costs those surfaces nothing.
 */

/** The dashes a Ukrainian title actually uses to hang an explanation off a name. */
const NAME_TAIL = /\s[—–-]\s.*$/u;

/**
 * The name, without the explanation someone hung off it.
 *
 * Only a SPACED dash counts. «Short-Перезавантаження» is one word with a hyphen
 * in it, and cutting there would leave the product called «Short».
 */
export function courseTitleName(title: string): string {
  return title.replace(NAME_TAIL, "").trim() || title.trim();
}

/**
 * The half the name gave up, for the one surface with room to print it.
 *
 * Empty when the title is only a name, so a page prints nothing rather than an
 * empty line.
 */
export function courseTitleTail(title: string): string {
  const match = title.match(NAME_TAIL);
  if (!match || courseTitleName(title) === title.trim()) return "";
  return match[0].replace(/^\s[—–-]\s/u, "").trim();
}
