/**
 * THE ROOM'S GEOMETRY — where each niche, shelf and book lands.
 *
 * Lifted out of `LearnRoomView.tsx` on 2026-09-11, unchanged: the packing
 * math and the camera arithmetic are the prototype's own (зб. 59, 40 commits
 * of hand-tuned iteration), and that file's header says plainly what happens
 * to code like this when it is re-derived blind. Moving it out of a React
 * component does not touch it; it makes it callable from a test, which is the
 * only thing that can hold 270 lines of bin-packing to what it did yesterday.
 *
 * Nothing here renders. No React, no DOM, no styles — arguments in, numbers
 * out. `roomInk.ts` draws; this decides where.
 */

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import type { CourseCategory } from "@/lms-core";
import type { CabinetCopy } from "./copy";

export const CATEGORY_ORDER: CourseCategory[] = [
  "movement",
  "nutrition",
  "cleansing",
  "breathing",
  "meditation",
  "focus",
  "energy",
  "relaxation",
];
export const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

export type RoomBook = {
  slug: string;
  title: string;
  state: string;
  /** Real access, not "owned" in the prototype's sense — a course you can
      actually open right now stands out in brass. */
  live: boolean;
  /** The whole course rides along: the spread asks it questions the spine
      never had to answer, and looking it up again by slug would mean two
      places that decide which course a book is. */
  course: LearnerShelfCourseDto;
};

export type RoomCase = {
  ci: number;
  label: string;
  books: RoomBook[];
};

/** ONE COURSE, ONE BOOK. A course may carry several subjects, and it used to
    be cut into every matching niche — so pointing at it lit two shelves at
    once and two spines that were the same course, which is the room saying
    there are more books in it than the reader owns. A book is an object: it
    stands in one place.

    THE PLACE IS THE FIRST OF ITS SUBJECTS IN `CATEGORY_ORDER`, not the first
    in `course.categories`. The author's array is written in the order they
    tapped the choices, so a course would change walls because someone
    unchecked a subject and checked it again; the room's own order does not
    move. The other subjects are not lost — the sheet's row prints all of
    them, which is now the one place that says a course belongs to two.

    A course with no subject is unreachable here on purpose: `categories` is
    required before a course goes public (see readiness.ts), so an empty case
    is a draft, not a gap in the room. */
export function toCases(courses: LearnerShelfCourseDto[], copy: CabinetCopy): RoomCase[] {
  const home = (c: LearnerShelfCourseDto) => CATEGORY_ORDER.find((key) => c.categories.includes(key));
  return CATEGORY_ORDER.map((key, ci) => {
    const books: RoomBook[] = courses
      .filter((c) => home(c) === key)
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        state:
          c.standing && c.standing.totalLessons > 0
            ? `${c.standing.completedLessons} / ${c.standing.totalLessons}`
            : c.access === "locked"
              ? copy.courseLocked
              : copy.courseNotStarted,
        live: c.access === "enrolled",
        course: c,
      }));
    return { ci, label: `${ROMAN[ci] ?? String(ci + 1)} · ${copy.courseCategories[key]}`, books };
  }).filter((c) => c.books.length > 0);
}

/* ---------- the prototype's own deterministic drawing functions ---------- */

export function seeded(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** One filled polygon per pen stroke — thin in, body, thin out, with a
    slight seeded bow, so the same line drawn twice in one room never
    repeats itself exactly. Ported verbatim from the prototype's `nicheSvg`
    inner `stroke`/`line` helpers. */

export type BookLayout = RoomBook & { x: number; y: number; w: number; h: number; tilt: number };
export type NicheLayout = {
  ci: number;
  /** Index of this section's first book inside its case. A case with more
      books than one cut can hold is split across several, so `ci` alone does
      not name a niche — two sections of the same category carried the same
      React key, which is how a re-layout can hand a niche the wrong contents.
      `from` is what makes the pair unique, and it is already the number the
      label and the "+n" marker are decided by. */
  from: number;
  label: string | null;
  more: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cut: number;
  depth: number;
  books: BookLayout[];
};

/* THE LADDER OF BOOK SIZES, LARGEST FIRST — the packer walks down it and stops
   at the first rung whose block of shelves fits the band.
   TWO RUNGS ADDED ABOVE THE PROTOTYPE'S (2026-08-29). Its top rung was 26px
   spines, which is right for a wall of a hundred works; a personal shelf of a
   dozen took that rung immediately and left two thirds of the band bare — the
   ladder can only ever step DOWN, so the first rung is also the biggest the
   room will ever draw. Starting higher lets a small library fill its wall,
   and changes nothing for a large one: those never reach these rungs. */
export const LADDER = [
  { bw: 36, per: 9 },
  { bw: 31, per: 9 },
  { bw: 26, per: 9 },
  { bw: 23, per: 9 },
  { bw: 20, per: 8 },
  { bw: 17, per: 8 },
  { bw: 15, per: 7 },
  { bw: 12, per: 7 },
  { bw: 10, per: 6 },
  { bw: 8, per: 6 },
] as const;

export type Section = {
  ci: number;
  from: number;
  count: number;
  bw: number;
  gap: number;
  pad: number;
  w: number;
  h: number;
  x: number;
  y: number;
};
export type Group = {
  ci: number;
  secs: Section[];
  w: number;
  h: number;
  hidden: number;
  sgap: number;
  bw: number;
  x0: number;
  x1: number;
};

/** Packs every category's books into shelf sections and lays those sections
    into rows inside the wall's band, weighted so a heavier category gets a
    bigger, closer-reading niche. Faithful to the prototype's `buildRoom`,
    minus the perspective divide (a constant scalar here — see the file
    header) and minus the overflow-guard that drops whole sections past a
    few hundred books, which this shelf does not need yet. */
export function layoutRoom(cases: RoomCase[], W: number, H: number, narrow: boolean): NicheLayout[] {
  if (cases.length === 0 || W <= 0 || H <= 0) return [];

  const LABEL_H = 17;
  const LEVEL = 14;
  const GAP_X = narrow ? 12 : 22;
  const GAP_Y = (narrow ? 14 : 22) + LABEL_H;
  const band = narrow
    ? { x: W * 0.045, y: H * 0.05, w: W * 0.91, h: H * 0.4 * 0.9 }
    : { x: W * 0.5, y: H * 0.075, w: W * 0.46, h: H * 0.84 * 0.88 };

  const maxN = Math.max(1, ...cases.map((c) => c.books.length));
  const raw = cases.map((c, ci) => (c.books.length / maxN) * 0.6 + seeded(ci * 29 + 7) * 0.4);
  const rMin = Math.min(...raw);
  const rMax = Math.max(...raw);
  const span = rMax - rMin;
  const facet = raw.map((v) => {
    const t = span < 0.02 ? 0.5 : (v - rMin) / span;
    return { t, size: 0.84 + t * 0.34 };
  });

  function sectionsFor(step: { bw: number; per: number }) {
    const groups: Group[] = [];
    let list: Section[] = [];
    cases.forEach((data, ci) => {
      const bw = Math.max(5, step.bw * (facet[ci]?.size ?? 1));
      const gap = Math.max(3, Math.round(bw * 0.34));
      const pad = Math.max(5, Math.round(bw * 0.34));
      const unit = Math.max(46, Math.min(170, Math.round(bw * 4.7)));
      const n = data.books.length;
      let i = 0;
      let k = 0;
      const secs: Section[] = [];
      while (i < n) {
        let take = Math.round(step.per * (0.34 + seeded(ci * 17 + k) * 1.2));
        take = Math.max(2, Math.min(take, n - i));
        if (n - i - take === 1) take += 1;
        secs.push({
          ci,
          from: i,
          count: take,
          bw,
          gap,
          pad,
          w: take * (bw + gap) - gap + pad * 2,
          h: unit,
          x: 0,
          y: 0,
        });
        i += take;
        k += 1;
      }
      const SGAP = Math.max(6, Math.round(bw * 0.5));
      const width = (l: Section[]) => l.reduce((a, it) => a + it.w, 0) + SGAP * Math.max(0, l.length - 1);
      let cut = 0;
      while (secs.length > 1 && width(secs) > band.w) cut += secs.pop()!.count;
      groups.push({ ci, secs, w: width(secs), h: unit, hidden: cut, sgap: SGAP, bw, x0: 0, x1: 0 });
      list = list.concat(secs);
    });
    return { groups, list, bw: step.bw };
  }

  /* HOW MANY SHELVES MAY SHARE A COURSE OF THE WALL (2026-08-29).
     The packer's only rule used to be "until it stops fitting", and the band is
     wide enough that three categories always fitted — so the room came out as
     one strip of cuts across the middle with the whole upper half of the wall
     empty. That is a frieze, not a room: a wall is read in two directions, and
     a single row throws one of them away.
     `ceil(sqrt(n))` is the shape that keeps the block of shelves closest to the
     band's own proportion (which is near square: the right half of a 16:10
     stage). Three categories become two and one; four become two and two; nine
     become three rows of three. And because a taller block makes `packed.height`
     larger, the size ladder below steps down on its own until the block fills
     the band — the wall gets fuller, not just taller. */
  const perLine = Math.max(1, Math.ceil(Math.sqrt(cases.length)));

  function pack(secs: { groups: Group[] }) {
    const lines: { groups: Group[]; w: number; h: number }[] = [];
    let line: Group[] = [];
    let lineW = 0;
    let total = 0;
    function flush() {
      if (!line.length) return;
      let hMax = 0;
      line.forEach((g) => (hMax = Math.max(hMax, g.h)));
      if (lineW > band.w) {
        let air = GAP_X * (line.length - 1);
        line.forEach((g) => (air += g.sgap * Math.max(0, g.secs.length - 1)));
        const k = Math.max(0.2, (band.w - air) / Math.max(1, lineW - air));
        line.forEach((g) => {
          g.secs.forEach((it) => (it.w = Math.max(24, Math.floor(it.w * k))));
          g.w = g.secs.reduce((a, it) => a + it.w, 0) + g.sgap * Math.max(0, g.secs.length - 1);
        });
        lineW = line.reduce((a, g) => a + g.w, 0) + GAP_X * (line.length - 1);
      }
      lines.push({ groups: line, w: lineW, h: hMax });
      total += hMax + LEVEL + GAP_Y;
      line = [];
      lineW = 0;
    }
    secs.groups.forEach((g) => {
      if (line.length && (line.length >= perLine || lineW + GAP_X + g.w > band.w)) flush();
      lineW += (line.length ? GAP_X : 0) + g.w;
      line.push(g);
    });
    flush();
    return { lines, height: Math.max(0, total - GAP_Y) };
  }

  let secs = sectionsFor(LADDER[0]);
  let packed = pack(secs);
  for (const rung of LADDER) {
    secs = sectionsFor(rung);
    packed = pack(secs);
    if (packed.height <= band.h) break;
  }

  const byCase = new Map<number, Group>();
  secs.groups.forEach((gr) => byCase.set(gr.ci, gr));
  let cursorY = band.y + Math.max(0, (band.h - packed.height) / 2);
  packed.lines.forEach((ln, li) => {
    const slide = (seeded(li * 13 + 3) - 0.5) * Math.min(46, band.w * 0.06);
    let x = Math.max(band.x, Math.min(band.x + (band.w - ln.w) / 2 + slide, band.x + band.w - ln.w));
    ln.groups.forEach((gr) => {
      const gy = cursorY + (ln.h - gr.h) * 0.62 + Math.round(seeded(gr.ci * 7 + 11) * LEVEL);
      gr.x0 = x;
      gr.secs.forEach((it) => {
        it.x = x;
        it.y = gy;
        x += it.w + gr.sgap;
      });
      x -= gr.sgap;
      gr.x1 = x;
      x += GAP_X;
    });
    cursorY += ln.h + LEVEL + GAP_Y;
  });

  const hidden = new Map<number, number>();
  secs.groups.forEach((gr) => {
    if (gr.hidden) hidden.set(gr.ci, gr.hidden);
  });

  const niches: NicheLayout[] = [];
  secs.list.forEach((sec) => {
    const data = cases[sec.ci];
    const f = facet[sec.ci];
    if (!data || !f) return;
    const cw = Math.max(28, Math.round(sec.w));
    const ch = Math.max(34, Math.round(sec.h));
    const cut = Math.max(3, Math.min(22, Math.min(cw, ch) * (0.1 + f.t * 0.1)));
    const inner = Math.max(6, cw - cut * 2);
    const bwFit = Math.max(4, Math.min(Math.round(sec.bw), Math.floor((inner + sec.gap) / sec.count) - sec.gap));
    const books: BookLayout[] = data.books.slice(sec.from, sec.from + sec.count).map((book, j) => {
      const bi = sec.from + j;
      const lean = bwFit > 16 ? Math.round(seeded(bi * 3 + sec.ci) * 4) : 0;
      const bh = Math.round((ch - cut * 2) * (0.74 + seeded(bi + sec.ci * 7) * 0.16));
      const last = j === sec.count - 1;
      const room4 = cw - cut * 2 - sec.count * (bwFit + sec.gap) > bwFit * 0.6;
      const tilt = last && room4 && bwFit > 12 ? 4 + seeded(bi) * 3 : 0;
      return {
        ...book,
        w: bwFit,
        h: bh,
        x: Math.round(cut + j * (bwFit + sec.gap) + lean),
        y: Math.round(cut * 0.82),
        tilt,
      };
    });
    const hiddenCount = hidden.get(sec.ci) ?? 0;
    const showMore = hiddenCount > 0 && sec.from + sec.count >= data.books.length - hiddenCount;
    niches.push({
      ci: sec.ci,
      from: sec.from,
      label: sec.from === 0 ? data.label : null,
      more: showMore ? hiddenCount : 0,
      x: Math.round(sec.x),
      y: Math.round(sec.y),
      w: cw,
      h: ch,
      cut,
      depth: f.t,
      books,
    });
  });

  return niches;
}

/* ---------- the camera ---------- */

/** How long the walk takes.
    The prototype moved in 2300ms, and it was right to: nothing else in that
    page moved at all, so the camera WAS the interaction and it could take the
    time a step across a room takes. Here the same act also narrows the column
    of text beside the wall, and a list that has already answered while the
    wall is still travelling reads as two events. Shortened until the two land
    close enough to be one, and no shorter — under a second the move stops
    being a walk and becomes a cut. */
export const CAMERA_MS = 1200;

export type Camera = { x: number; y: number; s: number };

export const HALL: Camera = { x: 0, y: 0, s: 1 };

/**
 * WHERE THE CAMERA STANDS TO READ ONE SHELF.
 *
 * The prototype's own note is the method, and it still holds: "наїзд
 * рахується, а не підганяється" — measure, solve, make ONE move. It had to
 * measure the live DOM because its camera also carried z and its niches were
 * on real facets; here the layout is already known in stage coordinates
 * before a single node is painted, so the same solve is arithmetic on numbers
 * this module produced itself. No `getBoundingClientRect`, and therefore no
 * reading of a layout that the transition is in the middle of changing.
 *
 * Scale pulls everything towards the transform origin, which is the stage's
 * own centre O. A point p lands at `O + (p - O) * s + t`, so framing the
 * case's bounding box at the point the room wants it means
 * `t = want - O - (centre - O) * s`. The clamps and the 0.82 breathing factor
 * are the prototype's, kept: they are what stops a two-spine shelf from
 * filling the wall like a poster.
 */
export function frameCase(niches: NicheLayout[], open: number, W: number, H: number, narrow: boolean): Camera {
  if (open < 0 || W <= 0 || H <= 0) return HALL;
  const mine = niches.filter((n) => n.ci === open);
  if (mine.length === 0) return HALL;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const n of mine) {
    x0 = Math.min(x0, n.x);
    y0 = Math.min(y0, n.y);
    x1 = Math.max(x1, n.x + n.w);
    y1 = Math.max(y1, n.y + n.h);
  }

  /* WHERE THE FRAMED SHELF IS PUT. On a desk the room's right half is the
     wall's and the left half is the column's, so the shelf is brought to the
     middle of its own half and not to the middle of the screen — walking up
     to a shelf must not walk over the text. On a phone the wall has the
     whole width and the column is below it, so the shelf goes to the middle
     of the frame. */
  const wantX = narrow ? W * 0.5 : W * 0.71;
  const wantY = narrow ? H * 0.5 : H * 0.46;
  const maxW = narrow ? W * 0.86 : W * 0.46;
  const maxH = narrow ? H * 0.8 : H * 0.74;

  const bw = Math.max(1, x1 - x0);
  const bh = Math.max(1, y1 - y0);
  const s = Math.max(1.15, Math.min(4.2, Math.min(maxW / bw, maxH / bh) * 0.82));

  const ox = W / 2;
  const oy = H / 2;
  return {
    x: wantX - ox - ((x0 + x1) / 2 - ox) * s,
    y: wantY - oy - ((y0 + y1) / 2 - oy) * s,
    s,
  };
}

/* Both generators are pure functions of their arguments — same key, same
   drawn ink, everywhere in the app. A module-level cache is therefore the
   correct home for it, not a per-instance ref: reading or writing a ref
   during render is impure (see the `react-hooks/refs` rule), and this cache
   was never instance-scoped to begin with — `nicheCache`/`bookCache` were
   plain module variables in the original prototype too. */
