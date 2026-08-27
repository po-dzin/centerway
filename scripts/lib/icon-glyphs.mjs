/**
 * CenterWay icon + hand-graphics geometry — the single source of truth.
 *
 * Contract (docs/design-system.md § Icons):
 *   - 24 grid, stroke 1.5, round caps and joins, no fills except accent dots;
 *   - monoline character shared with the dot/path/orbit graphics language;
 *   - the "hand" character is NOT authored here — it is baked from this clean
 *     geometry by scripts/icons-bake.mjs (preset hand2). Keep these paths
 *     editable and geometric.
 *
 * `d` entries are plain path data. `dots` entries are filled accent circles
 * (the one exception to "stroke only" — a dot is a node, not a shape).
 */

/** Icons live on a 24x24 grid. */
export const ICON_VIEWBOX = "0 0 24 24";

/** Hand-graphics primitives live on a 36x36 grid (thinner relative stroke). */
export const GRAPHIC_VIEWBOX = "0 0 36 36";

/**
 * Baking presets, carried over from the approved character study
 * (docs/archive/working-notes/ds-icon-character-study-2026-08-15.html).
 * `hand2` is the author-approved character.
 */
export const HAND_PRESETS = {
  base: { frequency: 0, scale: 0, seed: 0 },
  hand1: { frequency: 0.03, scale: 1.4, seed: 7 },
  hand2: { frequency: 0.05, scale: 2.4, seed: 3 },
  hand3: { frequency: 0.08, scale: 3.6, seed: 11 },
};

export const DEFAULT_PRESET = "hand2";

/**
 * Icon set v1. Grouped only for the preview/docs — the sprite is flat.
 */
export const ICONS = {
  // ── Route: where I am / what is next ────────────────────────────────────
  "arrow-right": {
    group: "Route",
    d: ["M4 12h14", "M12.8 6.4 18.4 12l-5.6 5.6"],
  },
  "arrow-left": {
    group: "Route",
    d: ["M20 12H6", "M11.2 6.4 5.6 12l5.6 5.6"],
  },
  /* The vertical pair of `arrow-left`/`arrow-right`, same shaft length and same
     14-unit reach, so a row that offers "up / down / right" draws one family
     rather than two. Reordering is a vertical statement and had been borrowing
     the horizontal arrows for it. */
  "arrow-up": {
    group: "Route",
    d: ["M12 20V6", "M6.4 11.2 12 5.6l5.6 5.6"],
  },
  "arrow-down": {
    group: "Route",
    d: ["M12 4v14", "M6.4 12.8 12 18.4l5.6-5.6"],
  },
  /* Undo/redo. Not a rotated `arrow-left`: undoing is a return along a path
     already walked, and the arc is what says "back the way you came" rather
     than "one step left". The head keeps the arrows' 5.1-unit legs so the pair
     reads as the same family, and `redo` is the exact mirror — the two are one
     gesture in two directions, and drawing them independently would have made
     the redo arc sit a hair higher than the undo arc. */
  undo: {
    group: "Route",
    d: ["M4.5 9.5h9a4.5 4.5 0 0 1 0 9h-3.5", "M9.6 4.4 4.5 9.5l5.1 5.1"],
  },
  redo: {
    group: "Route",
    d: ["M19.5 9.5h-9a4.5 4.5 0 0 0 0 9h3.5", "M14.4 4.4 19.5 9.5l-5.1 5.1"],
  },
  "chevron-right": {
    group: "Route",
    d: ["M9.5 5.5 16 12l-6.5 6.5"],
  },
  "chevron-down": {
    group: "Route",
    d: ["M5.5 9.5 12 16l6.5-6.5"],
  },

  // ── Tagline trio: тело / ритм / опора ──────────────────────────────────
  body: {
    group: "Tagline",
    d: [
      "M12 4.2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
      "M12 8.6v6.2",
      "M7.4 11.2c2 1.1 3.1 1.6 4.6 1.6s2.6-.5 4.6-1.6",
      "M12 14.8 9.2 20",
      "M12 14.8 14.8 20",
    ],
  },
  rhythm: {
    group: "Tagline",
    d: ["M3.2 12h3.4l2.2-5.2 2.6 10.4L13.8 12h7"],
  },
  // Опора: a ground line with a low arch resting on it and the bearing point
  // marked. Deliberately NOT an arrow into a bar — that reads as "upload".
  support: {
    group: "Tagline",
    d: ["M3.6 19.4h16.8", "M4.6 15.6C7.4 9.6 9.8 6.6 12 6.6s4.6 3 7.4 9"],
    dots: [{ cx: 12, cy: 19.4, r: 1.3, accent: true }],
  },

  // ── Rhythm of time ─────────────────────────────────────────────────────
  day: {
    group: "Rhythm",
    d: [
      "M6.4 16.6a5.6 5.6 0 0 1 11.2 0",
      "M3 16.6h18",
      "M12 3.4v2.2",
      "M5.2 6.2l1.6 1.6",
      "M18.8 6.2l-1.6 1.6",
    ],
  },
  phase: {
    group: "Rhythm",
    d: ["M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z", "M12 3.6c3.4 3 3.4 13.8 0 16.8"],
  },
  // Seven days as dots on a rail — the dot/path language, not a bar. Pitch and
  // radius are tuned so the dots stay separate at 24px (they merged at r 1.1).
  week: {
    group: "Rhythm",
    d: [{ path: "M3.2 12h17.6", dash: "0.5 2.7" }],
    dots: [
      { cx: 3.2, cy: 12, r: 1.4, accent: true },
      { cx: 6.1, cy: 12, r: 0.95 },
      { cx: 9.1, cy: 12, r: 0.95 },
      { cx: 12, cy: 12, r: 0.95 },
      { cx: 14.9, cy: 12, r: 0.95 },
      { cx: 17.9, cy: 12, r: 0.95 },
      { cx: 20.8, cy: 12, r: 0.95 },
    ],
  },
  clock: {
    group: "Rhythm",
    d: ["M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z", "M12 7.4V12l3.4 2.2"],
  },

  // ── Proof / trust ──────────────────────────────────────────────────────
  check: {
    group: "Proof",
    d: ["M4.6 12.8l4.6 4.4L19.4 6.6"],
  },
  "shield-check": {
    group: "Proof",
    d: [
      "M12 3.4 4.8 6.2v5.4c0 4.2 2.9 7.4 7.2 9 4.3-1.6 7.2-4.8 7.2-9V6.2z",
      "M8.8 11.6 11.4 14.2l4-4.4",
    ],
  },
  star: {
    group: "Proof",
    d: ["M12 3.8l2.6 5.4 5.8.8-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.6 10l5.8-.8z"],
  },
  price: {
    group: "Proof",
    d: [
      "M12.6 3.8H20V11.2l-8.4 8.4a1.6 1.6 0 0 1-2.3 0L4 14.3a1.6 1.6 0 0 1 0-2.3z",
    ],
    dots: [{ cx: 16.2, cy: 7.6, r: 1.2 }],
  },

  // ── Elements / practice ────────────────────────────────────────────────
  water: {
    group: "Elements",
    d: ["M12 3.5c3.6 4.4 5.6 7.4 5.6 10a5.6 5.6 0 1 1-11.2 0c0-2.6 2-5.6 5.6-10z"],
  },
  leaf: {
    group: "Elements",
    d: ["M5 19c0-7 4-12 14-14 0 8-4 13-11 14", "M5 19c3-4 6-6 9-7"],
  },
  bowl: {
    group: "Elements",
    d: [
      "M3.5 10.5h17c0 5-3.8 8.5-8.5 8.5S3.5 15.5 3.5 10.5z",
      "M9 6.5c1.2-1 1.2-2 .4-3",
      "M13.5 6.5c1.2-1 1.2-2 .4-3",
    ],
  },
  stone: {
    group: "Elements",
    d: ["M4 13.5c1-4.5 4.5-7 8.5-7s7.5 3 7.5 6.5-3 6-8 6-9-1-8-5.5z", "M8 8.5c2 2.5 5.5 4 10.5 4.5"],
  },
  breath: {
    group: "Elements",
    d: ["M12 3.8a8.2 8.2 0 1 0 0 16.4 8.2 8.2 0 0 0 0-16.4z", "M12 3.8v4M12 16.2v4M3.8 12h4M16.2 12h4"],
  },
  sleep: {
    group: "Elements",
    d: ["M19.6 14.4A8.4 8.4 0 0 1 9.6 4.4a8.4 8.4 0 1 0 10 10z"],
    dots: [
      { cx: 17.2, cy: 5.2, r: 1.1, accent: true },
      { cx: 20.4, cy: 8.2, r: 0.9 },
    ],
  },
  // Fork + spoon. The spoon is an explicit bowl on a stem; the earlier single
  // curve read as an unidentifiable blob.
  food: {
    group: "Elements",
    d: [
      "M6.2 3.8v6.6a2.5 2.5 0 0 0 5 0V3.8",
      "M8.7 10.6v9.6",
      "M17.4 3.8a2.6 3.4 0 1 0 0 6.8 2.6 3.4 0 0 0 0-6.8z",
      "M17.4 10.6v9.6",
    ],
  },
  // Движение: a dot travelling along a curved path. Reads as motion rather than
  // as text alignment (the earlier three-lines-plus-arc did), and it borrows the
  // dot/path primitives so it sits inside the graphics language.
  motion: {
    group: "Elements",
    d: ["M3.4 18.6C7.4 8.6 12.6 5 19.4 6.2", "M15.6 4.2l3.8 2-1.6 3.8"],
    dots: [{ cx: 3.4, cy: 18.6, r: 1.5, accent: true }],
  },

  // ── Content: what the programme hands you ──────────────────────────────
  // Added 2026-08-17 when way21 became the reference organism: the two rows
  // of `#includes` that had no glyph in v1 (webinars, day-by-day instructions).
  play: {
    group: "Content",
    d: ["M9.2 6.2 17.8 12l-8.6 5.8z"],
  },
  guide: {
    group: "Content",
    d: ["M6.6 3.8h10.8v16.4H6.6z", "M9.4 8.6h5.2", "M9.4 12h5.2", "M9.4 15.4h3.4"],
  },

  // ── Authoring: create / bring content in ──────────────────────────────
  plus: {
    group: "Authoring",
    d: ["M12 4.6v14.8", "M4.6 12h14.8"],
  },
  import: {
    group: "Authoring",
    d: ["M12 3.8v10.4", "M7.8 10 12 14.2l4.2-4.2", "M5 17v2.8h14V17"],
  },

  // ── Interface / meta ───────────────────────────────────────────────────
  question: {
    group: "Meta",
    d: [
      "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z",
      "M9.4 9.2c.2-1.6 1.3-2.5 2.7-2.5 1.5 0 2.6 1 2.6 2.4 0 1.3-.8 1.9-1.9 2.6-.7.5-.9 1-.9 1.9",
    ],
    dots: [{ cx: 11.9, cy: 16.6, r: 1 }],
  },
  boundary: {
    group: "Meta",
    d: ["M12 4.2 3.4 19.2h17.2z", "M12 9.6v4.4"],
    dots: [{ cx: 12, cy: 16.8, r: 1 }],
  },
  user: {
    group: "Meta",
    d: ["M12 4.2a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z", "M4.8 20c.9-3.8 3.6-5.8 7.2-5.8s6.3 2 7.2 5.8"],
  },
  lock: {
    group: "Meta",
    d: ["M5.4 10.6h13.2v9.2H5.4z", "M8.4 10.6V7.8a3.6 3.6 0 0 1 7.2 0v2.8"],
    dots: [{ cx: 12, cy: 15.2, r: 1.1 }],
  },
  globe: {
    group: "Meta",
    d: [
      "M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8z",
      "M3.6 12h16.8",
      "M12 3.6c2.6 2.6 2.6 13.8 0 16.8-2.6-3-2.6-14.2 0-16.8z",
    ],
  },
  sun: {
    group: "Meta",
    d: [
      "M12 7.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4z",
      "M12 2.6V5M12 19v2.4M2.6 12H5M19 12h2.4M5.3 5.3 7 7M17 17l1.7 1.7M18.7 5.3 17 7M7 17l-1.7 1.7",
    ],
  },
  moon: {
    group: "Meta",
    d: ["M19.6 14.4A8.4 8.4 0 0 1 9.6 4.4a8.4 8.4 0 1 0 10 10z"],
  },
  mail: {
    group: "Meta",
    d: ["M3.6 6.2h16.8v11.6H3.6z", "M3.6 7 12 13.2 20.4 7"],
  },
  phone: {
    group: "Meta",
    d: [
      "M8.2 3.8H6.4A2.4 2.4 0 0 0 4 6.4c0 7.6 6 13.6 13.6 13.6a2.4 2.4 0 0 0 2.4-2.4v-1.8l-4.2-1.6-2 2.2c-2.4-1.3-4.3-3.2-5.6-5.6l2.2-2z",
    ],
  },
  telegram: {
    group: "Meta",
    d: ["M20.4 4.6 3.8 11.2l4.6 1.8 1.4 5.4 2.6-3.4 4.2 3.2z", "M8.4 13 20.4 4.6l-8 10.4"],
  },
  /* The drag handle. Six dots rather than the two bars a handle is usually
     drawn with: two bars in this set already mean `menu`, and a control that
     reorders must not wear the glyph of the control that opens a list. The dots
     are the same node language as `week` and `rail` — a thing you can pick up
     and put somewhere else in a sequence. */
  grip: {
    group: "Meta",
    dots: [
      { cx: 9.4, cy: 7, r: 1.15 },
      { cx: 14.6, cy: 7, r: 1.15 },
      { cx: 9.4, cy: 12, r: 1.15 },
      { cx: 14.6, cy: 12, r: 1.15 },
      { cx: 9.4, cy: 17, r: 1.15 },
      { cx: 14.6, cy: 17, r: 1.15 },
    ],
  },
  menu: {
    group: "Meta",
    d: ["M4 7.4h16", "M4 12h16", "M4 16.6h16"],
  },
  /* The two list layouts, as a pair. The builder's view switch had been set in
     WORDS because nothing in this set meant "a grid of cards" — and the two
     candidates it reached for first were both wrong in the same way: `menu` is
     three rules that mean "open the navigation", and the dot/orbit layer is
     block navigation that Icon.tsx forbids inside a text row.

     They are drawn as a PAIR and only read as one: three full-width bands
     against four half-width blocks is the same page arranged two ways, which is
     exactly what the control switches between. Deliberately not three lines —
     that is `menu`, four rows up — and deliberately closed rectangles rather
     than strokes, so the two glyphs share a vocabulary of areas rather than one
     being lines and the other boxes. */
  "view-rows": {
    group: "Meta",
    d: ["M4.5 5.4 H19.5 V8.6 H4.5 Z", "M4.5 10.4 H19.5 V13.6 H4.5 Z", "M4.5 15.4 H19.5 V18.6 H4.5 Z"],
  },
  "view-cards": {
    group: "Meta",
    d: [
      "M4.5 4.5 H11.2 V11.2 H4.5 Z",
      "M12.8 4.5 H19.5 V11.2 H12.8 Z",
      "M4.5 12.8 H11.2 V19.5 H4.5 Z",
      "M12.8 12.8 H19.5 V19.5 H12.8 Z",
    ],
  },
  /* Eye: «подивитися очима учня» — preview, on both authoring surfaces.

     ONE closed almond rather than the two mirrored arcs most sets use. Two
     arcs meet at a corner, and a corner is exactly what the hand bake rounds
     away: at 18px — the size both toolbars call it at — the two-arc eye reads
     as a plain circle, which is `dot` with extra steps.

     The pupil is a DOT, not a stroked inner circle. A circle at r 2 carries a
     1.5 stroke on a 4-wide shape, so its hole closes at small sizes; and a dot
     is what a node looks like in this language anyway. */
  eye: {
    group: "Meta",
    d: [
      "M3.6 12C6.3 7.7 9.1 5.9 12 5.9C14.9 5.9 17.7 7.7 20.4 12C17.7 16.3 14.9 18.1 12 18.1C9.1 18.1 6.3 16.3 3.6 12Z",
    ],
    dots: [{ cx: 12, cy: 12, r: 1.9 }],
  },
  // Edit: a compact pencil for inline-authored titles and addresses. Kept on
  // the same diagonal as the route arrows, with a separate cap rather than a
  // filled nib so it survives the hand-character bake at 16px.
  edit: {
    group: "Meta",
    d: ["M5 19l3.8-.8L19 7l-2.2-2.2L5.8 15z", "M14.8 6.8l2.4 2.4", "M5 19h4"],
  },
  document: {
    group: "Meta",
    d: ["M6 3.8h7.2L18 8.6V20H6z", "M13.2 3.8v4.8H18", "M8.7 12h6.6", "M8.7 15.3h5.4"],
  },
  // Settings, and it is a gear because a gear is what "settings" means to
  // everyone — eight teeth on a 45° pitch, cut shallow (9.0/6.5 of 12) so the
  // hand pass does not turn them into a saw. The hub is the same circle the
  // dosha glyphs use, which keeps it in the set rather than borrowed from one.
  settings: {
    group: "Meta",
    d: [
      "M18.11 9.78 L20.91 10.75 L20.91 13.25 L18.11 14.22 L17.89 14.75 L19.19 17.42 L17.42 19.19 L14.75 17.89 L14.22 18.11 L13.25 20.91 L10.75 20.91 L9.78 18.11 L9.25 17.89 L6.58 19.19 L4.81 17.42 L6.11 14.75 L5.89 14.22 L3.09 13.25 L3.09 10.75 L5.89 9.78 L6.11 9.25 L4.81 6.58 L6.58 4.81 L9.25 6.11 L9.78 5.89 L10.75 3.09 L13.25 3.09 L14.22 5.89 L14.75 6.11 L17.42 4.81 L19.19 6.58 L17.89 9.25 Z",
      "M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z",
    ],
  },
  close: {
    group: "Meta",
    d: ["M6 6l12 12", "M18 6 6 18"],
  },
  // "More actions" — three nodes on the same rail the rhythm glyphs use, so the
  // overflow control is drawn in this family rather than borrowed as a "⋯"
  // character from whatever font happens to load. Radius 1.35 and a 5.2 pitch:
  // at 0.95 (the `week` pitch) three dots read as a stalled progress bar, and
  // the control has to be recognisable at 18px in a list row.
  /* Delete. A lid on a body, with the handle above it — the one shape people
     read as "remove" without a label, which matters because this item is the
     only destructive one in every menu it appears in. No inner tick marks: at
     18px in a list row they close into a smudge. */
  trash: {
    group: "Meta",
    d: ["M4.5 7h15", "M9.5 7V4.8h5V7", "M6.8 7l1 12.2h8.4l1-12.2"],
  },
  more: {
    group: "Meta",
    dots: [
      { cx: 6.8, cy: 12, r: 1.35 },
      { cx: 12, cy: 12, r: 1.35 },
      { cx: 17.2, cy: 12, r: 1.35 },
    ],
  },
  // Link: two hooked arcs reaching for each other, not two closed rings — a
  // closed chain link reads as a padlock at 18px. The gap between the arcs IS
  // the join; `unlink` is the same author action reusing this glyph.
  link: {
    group: "Meta",
    d: [
      "M9.6 14.4 6.8 17.2A3 3 0 1 0 11 21.4L13.8 18.6",
      "M14.4 9.6 17.2 6.8A3 3 0 1 1 21.4 11L18.6 13.8",
    ],
  },
  // List (bulleted): the same three rules as `menu`, indented one unit for the
  // dots — a bullet list drawn in this set's own dot rather than a borrowed
  // glyph disc.
  list: {
    group: "Meta",
    d: ["M9 6.4h11", "M9 12h11", "M9 17.6h11"],
    dots: [
      { cx: 4.4, cy: 6.4, r: 1.15 },
      { cx: 4.4, cy: 12, r: 1.15 },
      { cx: 4.4, cy: 17.6, r: 1.15 },
    ],
  },
  // List (ordered): the same three rules, with ascending steps at the left
  // instead of level dots — the shape this set already uses for "climbing in
  // order" (`week`, `phase`), so a numbered list reads as a sequence rather
  // than a second bullet style.
  "list-ordered": {
    group: "Meta",
    d: ["M9 6.4h11", "M9 12h11", "M9 17.6h11", "M4.4 8v-2.6", "M4.4 13.6v-4.2", "M4.4 19.2v-5.8"],
  },
  // Quote: a mirrored pair of open hooks — the mark a raised comma leaves at
  // this weight once it stops being a filled glyph.
  quote: {
    group: "Meta",
    d: [
      "M5.4 9C5.4 7 6.8 5.6 8.8 5.6",
      "M5.4 9v3.6a2.2 2.2 0 0 0 2.2 2.2",
      "M13.4 9c0-2 1.4-3.4 3.4-3.4",
      "M13.4 9v3.6a2.2 2.2 0 0 0 2.2 2.2",
    ],
  },
  // Code: the angle brackets every editor already uses for "this is markup",
  // open on both sides so they read at 18px without closing into a diamond.
  code: {
    group: "Meta",
    d: ["M9.6 7.5 4.6 12l5 4.5", "M14.4 7.5 19.4 12l-5 4.5"],
  },
  // Bold: same convention as `code`'s angle brackets — a literal letterform,
  // not an abstract shape, because every rich-text editor already trained
  // authors on exactly this glyph. Two lobes growing top to bottom off one
  // spine, drawn open (no closed counters) so the bake's displacement cannot
  // pinch a hole shut at 18px the way a filled "B" would.
  bold: {
    group: "Meta",
    d: [
      "M7.6 4.8V19.2",
      "M7.6 4.8C11.6 4.8 13.4 6.3 13.4 8.4C13.4 10.5 11.6 12 7.6 12",
      "M7.6 12C12 12 14.2 13.6 14.2 15.8C14.2 18 12 19.2 7.6 19.2",
    ],
  },
  // Italic: the slanted stroke with a serif at each end — the other half of
  // the same literal-letterform convention as `bold`.
  italic: {
    group: "Meta",
    d: ["M10 5h6.4", "M14.6 5 9.4 19", "M7.6 19H14"],
  },
  /* The two node kinds the formatting set was missing. `list` and `list-ordered`
     already name two of the four things a paragraph can become; without these,
     half the kind menu wore icons and half did not.

     Heading: the literal letterform, the same convention `bold` and `italic`
     take — an H, not a stack of lines with one bigger, which at 18px is just
     `paragraph` drawn unevenly. */
  heading: {
    group: "Meta",
    d: ["M7.2 5v14", "M16.8 5v14", "M7.2 12h9.6"],
  },
  /* Paragraph: full-measure lines with a short last one — a block of set text,
     and the one shape that says "prose" without a letter in it. NOT a pilcrow:
     ¶ closes into a smudge at this size. It reads apart from `list` because
     `list` is indented behind its bullets and this runs the full width. */
  paragraph: {
    group: "Meta",
    d: ["M4.4 6.4h15.2", "M4.4 12h15.2", "M4.4 17.6h8.8"],
  },

  // ── Dosha glyphs ───────────────────────────────────────────────────────
  vata: {
    group: "Dosha",
    d: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M4.6 9.5c4 2 11 2 15 0M4.6 14.5c4-2 11-2 15 0"],
  },
  pitta: {
    group: "Dosha",
    d: [
      "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z",
      "M12 6.5c2.6 3 3.8 4.8 3.8 6.6a3.8 3.8 0 1 1-7.6 0c0-1.8 1.2-3.6 3.8-6.6z",
    ],
  },
  kapha: {
    group: "Dosha",
    d: ["M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z", "M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z"],
  },
};

/**
 * Hand-graphics primitives — dot / path / orbit, and the two composed patterns
 * (rail, connector) that carry them across a page. Same baking pass, so icons
 * and graphics read as one hand.
 *
 * `dashed: true` marks a stroke that keeps its dash pattern in the sprite.
 */
export const GRAPHICS = {
  /* A navigation mark, not a ruled underline. The baked hand pass gives the
     long stroke its irregular pressure; the two satellite dots are restrained
     ink drops that keep the gesture alive without turning it into decoration. */
  /* ONE PASS OF A PEN, WITH THE INK IT LEAVES AT EITHER END.

     It used to be TWO paths about 1.2 units apart, and that is what made it
     read as a degraded double line rather than a stroke. The measurement is the
     argument: this mark renders into a fixed 0.85rem band, so its vertical
     scale is a constant ~1.38px per unit — which puts those two paths 1.7px
     apart — while the hand bake (`hand2`) displaces every sample by up to 2.4
     units, i.e. ~3.3px. The wobble was TWICE the gap, so the two lines crossed
     and separated along their own length. No amount of nudging two parallel
     curves survives that; one curve does.

     The drops are the pen landing and leaving, the same idea `ink-ring` states
     one line below. They sit ON the ends of the stroke rather than beside them,
     which is where ink actually pools. */
  "ink-stroke": {
    group: "Graphics",
    d: ["M3.4 18.8C11.6 17.2 21.4 19.4 32.6 17.6"],
    dots: [
      { cx: 3.4, cy: 18.8, r: 1.15 },
      { cx: 32.6, cy: 17.6, r: 0.8 },
    ],
  },
  /* Hover/selection for icon-only controls. It is intentionally open at the
     upper-right edge, with one tiny drop where a pen would leave the paper. */
  "ink-ring": {
    group: "Graphics",
    d: [
      "M27.8 8.2C32.5 12.2 33.1 20.6 28.8 27.2C24.3 33.8 13.4 33.8 7.5 27.5C1.8 21.4 2.8 11.7 9.1 6.9C13.8 3.3 21.5 3.2 26.2 6.6",
    ],
    dots: [{ cx: 30.2, cy: 7.2, r: 0.8 }],
  },
  dot: {
    group: "Graphics",
    dots: [
      { cx: 18, cy: 18, r: 3, accent: true },
      { cx: 18, cy: 18, r: 7, ring: true },
    ],
  },
  // Nodes on a travelled path are FILLED, never rings: the dashed path runs
  // underneath them, and an open ring lets it show through as a hook that reads
  // like a rendering defect. Rings are only for `dot`, where nothing crosses.
  orbit: {
    group: "Graphics",
    d: [{ path: "M18 4a14 14 0 1 0 0 28 14 14 0 0 0 0-28z", dash: "1 4" }],
    dots: [
      { cx: 18, cy: 4, r: 2.4, accent: true },
      { cx: 30.4, cy: 24.4, r: 2.2 },
    ],
  },
  rail: {
    group: "Graphics",
    d: [{ path: "M18 2v32", dash: "1.5 4" }],
    dots: [
      { cx: 18, cy: 8, r: 2.4, accent: true },
      { cx: 18, cy: 19, r: 2.2 },
      { cx: 18, cy: 29, r: 2.2 },
    ],
  },
  connector: {
    group: "Graphics",
    d: [{ path: "M3 28C10 7 26 7 33 28", dash: "1.5 4" }],
    dots: [
      { cx: 3, cy: 28, r: 2.4, accent: true },
      { cx: 33, cy: 28, r: 2.2 },
    ],
  },
};

/** Stable, sorted glyph names — sprite order and preview order. */
export const ICON_NAMES = Object.keys(ICONS);
export const GRAPHIC_NAMES = Object.keys(GRAPHICS);

/** Grouping used by the preview pages and the Design System cards. */
export function groupsOf(set) {
  const out = new Map();
  for (const [name, spec] of Object.entries(set)) {
    const group = spec.group ?? "Other";
    if (!out.has(group)) out.set(group, []);
    out.get(group).push(name);
  }
  return out;
}
