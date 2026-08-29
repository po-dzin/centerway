"use client";

/**
 * THE ROOM — the library's third shelf view, at `/learn`.
 *
 * Ported from docs/design-system/prototypes/library-depth-2026-08-26.html
 * (зб. 59, branch claude/library-room-prototype-f17a4a — 40 commits of
 * hand-tuned geometry). The packing math and the ink-drawn niche/spine
 * generators below are that prototype's own functions, translated to
 * TypeScript and fed real courses instead of its mock catalogue — not
 * re-derived. Re-deriving a weighted bin-packing layout blind, without the
 * live visual iteration the original 32 commits had, is how you re-introduce
 * bugs that were already found and fixed once.
 *
 * WHAT THIS STEP DOES NOT CARRY (see the CSS module's own header for why):
 * sound, mouse-parallax, the ink "attention" glow, the procedural wall
 * canvas, camera zoom-into-a-shelf, and the open-book reading "spread".
 * A book click navigates straight to the course for now.
 *
 * DEPTH IS ALREADY FLAT IN THE SOURCE. The prototype's own `buildRoom` sets
 * `Z_FAR = 0, Z_NEAR = 0, MAXPHI = 0` — rotation and z-translation per niche
 * already multiply out to nothing in зб. 59; what is left of "depth" is
 * niche SIZE (a heavier category sits in a bigger cut) and the shadow inside
 * the cut, not a 3D tilt. That is why this port has no camera, no
 * `translateZ`/`rotateY` per niche, and no screen→facet perspective divide:
 * with z pinned at 0 that divide is a constant scalar for every niche, not a
 * perspective at all, so multiplying every coordinate by it and then
 * un-multiplying it back out would be motion with no visible effect.
 */

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import type { CourseCategory } from "@/lms-core";
import styles from "./LearnRoomView.module.css";

const CATEGORY_ORDER: CourseCategory[] = ["movement", "nutrition", "cleansing"];
const CATEGORY_LABEL: Record<CourseCategory, string> = {
  movement: "Рух",
  nutrition: "Харчування",
  cleansing: "Очищення",
};
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

type RoomBook = {
  slug: string;
  title: string;
  state: string;
  /** Real access, not "owned" in the prototype's sense — a course you can
      actually open right now stands out in brass. */
  live: boolean;
};

type RoomCase = {
  ci: number;
  label: string;
  books: RoomBook[];
};

/** Groups the shelf by `course.categories`. A course in two categories
    appears on both walls — the model allows it, and a reader looking under
    either heading should find it there. A course with none is unreachable
    here on purpose: `categories` is required before a course goes public
    (see readiness.ts), so an empty case is a draft, not a gap in the room. */
function toCases(courses: LearnerShelfCourseDto[]): RoomCase[] {
  return CATEGORY_ORDER.map((key, ci) => {
    const books: RoomBook[] = courses
      .filter((c) => c.categories.includes(key))
      .map((c) => ({
        slug: c.slug,
        title: c.title,
        state:
          c.standing && c.standing.totalLessons > 0
            ? `${c.standing.completedLessons} / ${c.standing.totalLessons}`
            : c.access === "locked"
              ? "закрито"
              : "не почато",
        live: c.access === "enrolled",
      }));
    return { ci, label: `${ROMAN[ci] ?? String(ci + 1)} · ${CATEGORY_LABEL[key]}`, books };
  }).filter((c) => c.books.length > 0);
}

/* ---------- the prototype's own deterministic drawing functions ---------- */

function seeded(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** One filled polygon per pen stroke — thin in, body, thin out, with a
    slight seeded bow, so the same line drawn twice in one room never
    repeats itself exactly. Ported verbatim from the prototype's `nicheSvg`
    inner `stroke`/`line` helpers. */
function penStroke(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  wMax: number,
  op: number,
  n: number,
  inkW: number,
  jr: (n: number) => number,
): string {
  wMax *= inkW;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const bow = (jr(n + 900) * 2 - 1) * Math.min(1.6, len * 0.012);
  const N = 7;
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = x1 + dx * t + nx * bow * Math.sin(Math.PI * t);
    const cy = y1 + dy * t + ny * bow * Math.sin(Math.PI * t);
    let w = wMax * (0.3 + 0.7 * Math.sin(Math.PI * t)) * (0.75 + jr(n * 7 + i) * 0.5);
    if (i === 0 || i === N) w = wMax * 0.1;
    top.push(`${(cx + (nx * w) / 2).toFixed(1)},${(cy + (ny * w) / 2).toFixed(1)}`);
    bot.push(`${(cx - (nx * w) / 2).toFixed(1)},${(cy - (ny * w) / 2).toFixed(1)}`);
  }
  return `<polygon points="${top.join(" ")} ${bot.reverse().join(" ")}" fill="currentColor" opacity="${op.toFixed(2)}"/>`;
}

function penLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  wMax: number,
  op: number,
  n: number,
  inkW: number,
  jr: (n: number) => number,
): string {
  let out = penStroke(x1, y1, x2, y2, wMax, op, n, inkW, jr);
  if (jr(n + 300) > 0.45) {
    const t0 = jr(n + 310) * 0.35;
    const t1 = t0 + 0.35 + jr(n + 320) * 0.3;
    out += penStroke(
      x1 + (x2 - x1) * t0,
      y1 + (y2 - y1) * t0,
      x1 + (x2 - x1) * t1,
      y1 + (y2 - y1) * t1,
      wMax * 0.8,
      op * 0.5,
      n + 17,
      inkW,
      jr,
    );
  }
  return out;
}

/** The drawn niche border — one-point perspective in ink, seeded per case
    index so three niches are three different hands drawing the same
    session's line. Ported verbatim from the prototype's `nicheSvg`. */
function nicheSvg(ci: number, W: number, H: number, inkW: number): string {
  const jr = (n: number) => seeded(ci * 53 + n);
  const bx = W * 0.14;
  const by = H * 0.18;
  const bX = W * 0.87;
  const bY = H * 0.86;
  let out = "";
  for (let i = 1; i <= 4; i++) {
    const t = i / 5;
    out += penStroke(1 + (bx - 1) * t, 1 + (by - 1) * t, W - 1 + (bX - W + 1) * t, 1 + (by - 1) * t, 0.9, 0.16, 60 + i, inkW, jr);
    out += penStroke(1 + (bx - 1) * t, 1 + (by - 1) * t, 1 + (bx - 1) * t, H - 1 + (bY - H + 1) * t, 0.9, 0.14, 70 + i, inkW, jr);
  }
  out += penStroke(1, 1, bx, by, 1, 0.22, 40, inkW, jr);
  out += penStroke(W - 1, 1, bX, by, 1, 0.22, 41, inkW, jr);
  out += penStroke(1, H - 1, bx, bY, 1, 0.2, 42, inkW, jr);
  out += penStroke(W - 1, H - 1, bX, bY, 1, 0.2, 43, inkW, jr);
  out += penLine(bx, by, bX, by, 1.5, 0.5, 50, inkW, jr);
  out += penLine(bX, by, bX, bY, 1.5, 0.5, 51, inkW, jr);
  out += penLine(bX, bY, bx, bY, 1.5, 0.5, 52, inkW, jr);
  out += penLine(bx, bY, bx, by, 1.5, 0.5, 53, inkW, jr);
  out += penLine(-4 - jr(1) * 3, 1, W + 4 + jr(2) * 3, 1, 1.9, 0.62, 54, inkW, jr);
  out += penLine(W - 1, -4 - jr(3) * 3, W - 1, H + 4 + jr(4) * 3, 1.9, 0.62, 55, inkW, jr);
  out += penLine(W + 4 + jr(5) * 3, H - 1, -4 - jr(6) * 3, H - 1, 1.9, 0.62, 56, inkW, jr);
  out += penLine(1, H + 4 + jr(7) * 3, 1, -4 - jr(8) * 3, 1.9, 0.62, 57, inkW, jr);
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" style="overflow:visible">${out}</svg>`;
}

/** The drawn spine — one SVG, three faces sharing edges, so nothing doubles
    a line or drops one at the seam. Ported verbatim from the prototype's
    `bookInk`. */
function bookInk(w: number, h: number): string {
  const d = Math.max(1.5, Math.min(6, w * 0.42));
  const r = d * 0.84;
  const W = w + d;
  const H = h + r;
  const p = (pts: [number, number][]) => pts.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" ");
  const front: [number, number][] = [
    [0, r],
    [w, r],
    [w, r + h],
    [0, r + h],
  ];
  const top: [number, number][] = [
    [0, r],
    [w, r],
    [W, 0],
    [d, 0],
  ];
  const side: [number, number][] = [
    [w, r],
    [W, 0],
    [W, h],
    [w, r + h],
  ];
  const band1 = r + Math.max(4, h * 0.09);
  const band2 = band1 + Math.max(3, h * 0.035);
  const pw = w * 0.54;
  const px = (w - pw) / 2;
  const py = r + h * 0.27;
  const ph = h * 0.22;
  return (
    `<svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" style="position:absolute;left:0;top:${(-r).toFixed(1)}px;width:${W.toFixed(1)}px;height:${H.toFixed(1)}px;overflow:visible" aria-hidden="true">` +
    `<polygon class="side" points="${p(side)}"/>` +
    `<polygon class="top" points="${p(top)}"/>` +
    `<polygon class="front" points="${p(front)}"/>` +
    `<g class="band"><path class="line" d="M1,${band1.toFixed(1)} H${(w - 1).toFixed(1)}"/><path class="line" d="M1,${band2.toFixed(1)} H${(w - 1).toFixed(1)}"/></g>` +
    `<rect class="plate" x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="1"/>` +
    `<rect class="foot" x="0" y="${(r + h - 3).toFixed(1)}" width="${w.toFixed(1)}" height="3"/>` +
    `<path class="line" d="M0,${r.toFixed(1)} L${d.toFixed(1)},0 L${W.toFixed(1)},0 L${W.toFixed(1)},${h.toFixed(1)} L${w.toFixed(1)},${(r + h).toFixed(1)} L0,${(r + h).toFixed(1)} Z"/>` +
    `<path class="line" d="M0,${r.toFixed(1)} H${w.toFixed(1)} L${W.toFixed(1)},0"/>` +
    `<path class="line" d="M${w.toFixed(1)},${r.toFixed(1)} V${(r + h).toFixed(1)}"/>` +
    `</svg>`
  );
}

/* ---------- layout: the prototype's own weighted bin-packing ---------- */

type BookLayout = RoomBook & { x: number; y: number; w: number; h: number; tilt: number };
type NicheLayout = {
  ci: number;
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

const LADDER = [
  { bw: 26, per: 9 },
  { bw: 23, per: 9 },
  { bw: 20, per: 8 },
  { bw: 17, per: 8 },
  { bw: 15, per: 7 },
  { bw: 12, per: 7 },
  { bw: 10, per: 6 },
  { bw: 8, per: 6 },
];

type Section = { ci: number; from: number; count: number; bw: number; gap: number; pad: number; w: number; h: number; x: number; y: number };
type Group = { ci: number; secs: Section[]; w: number; h: number; hidden: number; sgap: number; bw: number; x0: number; x1: number };

/** Packs every category's books into shelf sections and lays those sections
    into rows inside the wall's band, weighted so a heavier category gets a
    bigger, closer-reading niche. Faithful to the prototype's `buildRoom`,
    minus the perspective divide (a constant scalar here — see the file
    header) and minus the overflow-guard that drops whole sections past a
    few hundred books, which this shelf does not need yet. */
function layoutRoom(cases: RoomCase[], W: number, H: number, narrow: boolean): NicheLayout[] {
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
      const bw = Math.max(5, step.bw * facet[ci].size);
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
        secs.push({ ci, from: i, count: take, bw, gap, pad, w: take * (bw + gap) - gap + pad * 2, h: unit, x: 0, y: 0 });
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
      if (line.length && lineW + GAP_X + g.w > band.w) flush();
      lineW += (line.length ? GAP_X : 0) + g.w;
      line.push(g);
    });
    flush();
    return { lines, height: Math.max(0, total - GAP_Y) };
  }

  let secs = sectionsFor(LADDER[0]);
  let packed = pack(secs);
  for (let si = 0; si < LADDER.length; si++) {
    secs = sectionsFor(LADDER[si]);
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

/* Both generators are pure functions of their arguments — same key, same
   drawn ink, everywhere in the app. A module-level cache is therefore the
   correct home for it, not a per-instance ref: reading or writing a ref
   during render is impure (see the `react-hooks/refs` rule), and this cache
   was never instance-scoped to begin with — `nicheCache`/`bookCache` were
   plain module variables in the original prototype too. */
const inkCache = new Map<string, string>();

function nicheInk(ci: number, w: number, h: number, dark: boolean): string {
  const key = `${ci}|${w}|${h}|${dark ? "d" : "l"}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = nicheSvg(ci, w, h, dark ? 1.7 : 1);
    inkCache.set(key, hit);
  }
  return hit;
}

function spineInk(w: number, h: number): string {
  const key = `spine|${w}x${h}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = bookInk(w, h);
    inkCache.set(key, hit);
  }
  return hit;
}

export function LearnRoomView({ courses }: { courses: LearnerShelfCourseDto[] }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dark, setDark] = useState(false);

  const cases = useMemo(() => toCases(courses), [courses]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ w: box.width, h: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = stageRef.current?.closest<HTMLElement>("[data-cw-theme]");
    const read = () => setDark((root?.getAttribute("data-cw-theme") ?? "") === "dark");
    read();
    if (!root) return;
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ["data-cw-theme"] });
    return () => obs.disconnect();
  }, []);

  const narrow = size.w > 0 && size.w <= 640;
  const niches = useMemo(() => layoutRoom(cases, size.w, size.h, narrow), [cases, size.w, size.h, narrow]);

  /* No camera in this pass, so there is no in-flight zoom for the LOD reading
     to poll every 110ms the way the prototype's `trackLod` did — the layout
     that lands in one render is the layout that stays, so LOD is derived
     from it directly rather than chased in an effect. */
  const firstBook = niches[0]?.books[0];
  const lod: "name" | "plate" | "bare" = !firstBook
    ? "name"
    : firstBook.w >= 22 && firstBook.h >= 80
      ? "name"
      : firstBook.w >= 9
        ? "plate"
        : "bare";

  if (cases.length === 0) {
    return (
      <div className={styles.room}>
        <div className={styles.empty}>Полиця порожня.</div>
      </div>
    );
  }

  return (
    <div className={styles.room} data-lod={lod}>
      <div className={styles.stage} ref={stageRef}>
        <div className={styles.wall} />
        <div className={styles.rake} aria-hidden="true" />
        {niches.map((n) => (
          <div
            key={n.ci}
            className={styles.niche}
            style={{ left: n.x, top: n.y, width: n.w, height: n.h, ["--depth" as string]: n.depth.toFixed(2) }}
          >
            <div className={styles.nicheCast} aria-hidden="true" />
            <div className={styles.nicheBox}>
              <div className={styles.nichePersp} dangerouslySetInnerHTML={{ __html: nicheInk(n.ci, n.w, n.h, dark) }} />
              {n.books.map((b) => (
                <button
                  key={b.slug}
                  type="button"
                  className={styles.book}
                  data-live={b.live}
                  style={{ left: b.x, bottom: b.y, width: b.w, height: b.h, ["--tilt" as string]: `${b.tilt.toFixed(1)}deg` }}
                  aria-label={`${b.title} · ${b.state}`}
                  onClick={() => router.push(`/learn/${b.slug}`)}
                >
                  <span className={styles.bookDraw} dangerouslySetInnerHTML={{ __html: spineInk(b.w, b.h) }} />
                  <span className={styles.bookSpine}>{b.title}</span>
                </button>
              ))}
            </div>
            {n.label ? <span className={styles.nicheLabel}>{n.label}</span> : null}
            {n.more ? <span className={styles.nicheMore}>+{n.more}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
