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
import Link from "next/link";

import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import type { CourseCategory } from "@/lms-core";
import { courseAction } from "./CourseCard";
import type { CabinetCopy } from "./copy";
import styles from "./LearnRoomView.module.css";

const CATEGORY_ORDER: CourseCategory[] = ["movement", "nutrition", "cleansing"];
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

type RoomBook = {
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
function toCases(courses: LearnerShelfCourseDto[], copy: CabinetCopy): RoomCase[] {
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
              ? copy.courseLocked
              : copy.courseNotStarted,
        live: c.access === "enrolled",
        course: c,
      }));
    return { ci, label: `${ROMAN[ci] ?? String(ci + 1)} · ${copy.courseCategories[key]}`, books };
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

/** THE ATTENTION MARK — the shelf, gone round once with the same pen.
    The prototype's own note is the whole specification: "ВИБІР — ЦЕ КОНТУР,
    А НЕ ЩЕ ОДИН ШАР. Дно виїмки не міняє кольору, губа не золотиться,
    нічого не світиться і нічого не накладається зверху: полицю просто
    ОБВОДЯТЬ — рамкою, писаною тим самим пером, що й уся кімната." Not a
    sight from the corners: one confident lap of the perimeter, the weight
    drifting on a slow wave, the hand wandering a little off the ruler, and
    the movement broken by two or three short lifts of the brush. Ported
    verbatim from the prototype's `attentionSvg`. */
function attentionSvg(ci: number, W: number, H: number, inkW: number): string {
  const M = 26;
  const jr = (n: number) => seeded(ci * 71 + n);
  const d = 8;
  const x0 = M - d;
  const y0 = M - d;
  const x1 = M + W + d;
  const y1 = M + H + d;
  const Pm = 2 * (x1 - x0 + (y1 - y0));

  function pointAt(p: number): [number, number] {
    p = ((p % Pm) + Pm) % Pm;
    if (p < x1 - x0) return [x0 + p, y0];
    p -= x1 - x0;
    if (p < y1 - y0) return [x1, y0 + p];
    p -= y1 - y0;
    if (p < x1 - x0) return [x1 - p, y1];
    p -= x1 - x0;
    return [x0, y1 - p];
  }

  /* 2–3 lifts of the brush, each shorter than an arm of the frame, and never
     in a corner. */
  const gapCount = 2 + (jr(2) > 0.55 ? 1 : 0);
  const gaps: [number, number][] = [];
  for (let gi = 0; gi < gapCount; gi++) {
    const gp = Pm * ((gi + 0.3 + jr(10 + gi) * 0.4) / gapCount);
    gaps.push([gp, gp + 9 + jr(20 + gi) * 10]);
  }
  const inGap = (p: number) => {
    const q = ((p % Pm) + Pm) % Pm;
    return gaps.some(([a, b]) => q >= a && q <= b);
  };

  const stepLen = 8;
  const N = Math.ceil(Pm / stepLen);
  const startP = jr(1) * Pm;
  const runs: [number, number, number][][] = [];
  let cur: [number, number, number][] | null = null;
  for (let i = 0; i <= N; i++) {
    const p = startP + i * stepLen;
    if (inGap(p)) {
      if (cur && cur.length > 2) runs.push(cur);
      cur = null;
      continue;
    }
    const pt = pointAt(p);
    const drift = (jr(i * 3 + 44) - 0.5) * 1.6;
    /* The weight is the slow wave of a confident movement — but a FINE one.
       The prototype wrote this frame at 1.7–3.1px because there it was seen
       through a camera that could pull back from the wall; here the room is
       always at reading distance, and at that distance the same numbers were a
       marker line round a pen drawing. Halved, and the hand steadied (the drift
       came down with it), the frame reads as the same pen that drew the niche
       instead of as something laid on top of it. */
    const wgt = (0.85 + 0.7 * Math.abs(Math.sin(i * 0.09 + jr(3) * 6)) + (jr(i + 7) - 0.5) * 0.3) * inkW;
    if (!cur) cur = [];
    cur.push([pt[0] + drift * 0.6, pt[1] + drift * 0.6, wgt]);
  }
  if (cur && cur.length > 2) runs.push(cur);

  let out = "";
  for (const run of runs) {
    const top: string[] = [];
    const bot: string[] = [];
    const L = run.length;
    for (let i = 0; i < L; i++) {
      const q = run[i];
      const prev = run[Math.max(0, i - 1)];
      const next = run[Math.min(L - 1, i + 1)];
      const dx = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const t = Math.min(i / 2.2, (L - 1 - i) / 2.2, 1);
      const w = q[2] * (0.15 + 0.85 * t);
      top.push(`${(q[0] + (nx * w) / 2).toFixed(1)},${(q[1] + (ny * w) / 2).toFixed(1)}`);
      bot.push(`${(q[0] - (nx * w) / 2).toFixed(1)},${(q[1] - (ny * w) / 2).toFixed(1)}`);
    }
    out += `<polygon points="${top.join(" ")} ${bot.reverse().join(" ")}" fill="currentColor" opacity="0.78"/>`;
  }
  return `<svg viewBox="0 0 ${W + M * 2} ${H + M * 2}" aria-hidden="true" style="overflow:visible">${out}</svg>`;
}

/** ONE PEN-STROKE THE LENGTH OF A LINE — thin at the start, heavier through
    the body, with a barely-visible bow and one lift of the brush. The same
    profile as the niche's own lines, and the same stroke the platform draws
    under everything it points at (see the `feedback-ink-not-highlights`
    rule: attention here is ink, never a filled highlight). Ported verbatim
    from the prototype's `rayInk`. */
function rayInk(len: number, vertical: boolean, seed: number, inkW: number): string {
  const T = 18;
  const mid = T / 2;
  const jr = (n: number) => seeded(seed * 37 + n);
  const bow = (jr(1) * 2 - 1) * Math.min(3.4, len * 0.016);
  /* One lift, and not always: two breaks turned the stroke into a dashed
     line, and this has to stay ONE line — just one written by a hand. */
  const lifts: [number, number][] = [];
  if (jr(4) > 0.45) {
    const g0 = 0.3 + jr(2) * 0.3;
    lifts.push([g0, g0 + 0.02 + jr(3) * 0.03]);
  }
  const inLift = (t: number) => lifts.some(([a, b]) => t > a && t < b);

  const N = 48;
  let out = "";
  let run: [number, number, number][] = [];
  function flush() {
    if (run.length < 2) {
      run = [];
      return;
    }
    const s1: string[] = [];
    const s2: string[] = [];
    for (const [a, c, w] of run) {
      const hw = w / 2;
      s1.push(vertical ? `${(c - hw).toFixed(1)},${a.toFixed(1)}` : `${a.toFixed(1)},${(c - hw).toFixed(1)}`);
      s2.push(vertical ? `${(c + hw).toFixed(1)},${a.toFixed(1)}` : `${a.toFixed(1)},${(c + hw).toFixed(1)}`);
    }
    out += `<polygon points="${s1.join(" ")} ${s2.reverse().join(" ")}" fill="currentColor"/>`;
    run = [];
  }
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    if (inLift(t)) {
      flush();
      continue;
    }
    const along = len * t;
    const across = mid + bow * Math.sin(Math.PI * t) + (jr(i + 40) - 0.5) * 0.7;
    /* The pressure builds towards the middle and comes to nothing at the ends. */
    let wdt = (0.3 + 1.5 * Math.sin(Math.PI * t)) * (0.72 + jr(i + 90) * 0.5) * inkW;
    if (i === 0 || i === N) wdt = 0.22;
    run.push([along, across, wdt]);
  }
  flush();
  return (
    `<svg viewBox="0 0 ${vertical ? `${T} ${Math.round(len)}` : `${Math.round(len)} ${T}`}"` +
    ` preserveAspectRatio="none" aria-hidden="true">${out}</svg>`
  );
}

/** THE NAME ON A SPINE IS NOT READ — IT IS RECOGNISED.
    Two things were tried here and both failed the same way. The title set as
    real type came out at half a legible letter on a 26px board and shimmered.
    A barcode of the title's own length shimmered too, and for the same reason:
    twenty small marks at a pitch the screen cannot resolve is speckle whatever
    the marks mean.
    So the spine wears what a spine actually wears — a label. One panel, and a
    second smaller one under it when the name is long enough to have run onto a
    second. Same width as the plate the book carries at rest, so the select
    changes what is written on the board and not the board itself. The title is
    on the row beside the shelf and in the link's own accessible name, which is
    where a title can be read. */
function spineCode(title: string, w: number, h: number): string {
  const pw = w * 0.54;
  const px = (w - pw) / 2;
  const long = title.trim().length > 15;
  const top = h * 0.22;
  const main = h * (long ? 0.28 : 0.24);
  let out = `<rect class="code" x="${px.toFixed(1)}" y="${top.toFixed(1)}" width="${pw.toFixed(1)}" height="${main.toFixed(1)}" rx="1"/>`;
  if (long) {
    const y = top + main + h * 0.07;
    out += `<rect class="code" x="${px.toFixed(1)}" y="${y.toFixed(1)}" width="${pw.toFixed(1)}" height="${(h * 0.12).toFixed(1)}" rx="1"/>`;
  }
  return `<svg viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" style="position:absolute;inset:0;width:100%;height:100%" aria-hidden="true">${out}</svg>`;
}

/* ---------- layout: the prototype's own weighted bin-packing ---------- */

type BookLayout = RoomBook & { x: number; y: number; w: number; h: number; tilt: number };
type NicheLayout = {
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
const LADDER = [
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

function markInk(ci: number, w: number, h: number, dark: boolean): string {
  const key = `mark|${ci}|${w}|${h}|${dark ? "d" : "l"}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = attentionSvg(ci, w, h, dark ? 1.7 : 1);
    inkCache.set(key, hit);
  }
  return hit;
}

function codeInk(title: string, w: number, h: number): string {
  const key = `code|${title}|${w}x${h}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = spineCode(title, w, h);
    inkCache.set(key, hit);
  }
  return hit;
}

function rowInk(seed: number, dark: boolean): string {
  const key = `row|${seed}|${dark ? "d" : "l"}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = rayInk(120, false, seed, dark ? 1.7 : 1);
    inkCache.set(key, hit);
  }
  return hit;
}


export function LearnRoomView({
  courses,
  copy,
  match,
}: {
  courses: LearnerShelfCourseDto[];
  copy: CabinetCopy;
  /* THE QUERY DIMS; IT DOES NOT REPACK. A predicate rather than an already
     filtered list, and that is the whole point — the wall is laid out from
     every course the shelf holds, and the query only decides which cuts go
     quiet. The prototype's own rule: "стіна не перебудовується під запит, вона
     пригасає". A wall that repacks itself on every keystroke has answered a
     different question from the one that was typed, and the reader loses the
     one thing the room is for: seeing WHERE a work stands. */
  match?: (course: LearnerShelfCourseDto) => boolean;
}) {
  /* Which course is being looked at, wherever the looking came from. The
     prototype's rule: "стан рядка не залежить від того, звідки прийшла увага"
     — a row and its spine light together whether the pointer is on the text
     or on the shelf, because otherwise half the scene answers and half does
     not. */
  const [hot, setHot] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dark, setDark] = useState(false);

  const cases = useMemo(() => toCases(courses, copy), [courses, copy]);
  const shown = useMemo(() => (match ? courses.filter(match) : courses), [courses, match]);
  const lit = useMemo(() => new Set(shown.map((c) => c.slug)), [shown]);

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
        <div className={styles.empty}>{copy.learningEmptyTitle}</div>
      </div>
    );
  }

  return (
    <div
      className={styles.room}
      data-lod={lod}
      /* The keyboard's own release, and the same rule: focus moving from one
         spine to the next never passes through nothing. `onBlur` is React's
         `focusout`, so it bubbles here and can ask where the focus WENT. */
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHot(null);
      }}
    >
      <div
        className={styles.stage}
        ref={stageRef}
        /* ATTENTION IS RELEASED BY LEAVING THE ROOM, NOT BY LEAVING A BOOK.
           Each spine used to clear `hot` on its own mouseleave, so sliding
           along a shelf ran leave→enter on every neighbour and the whole
           niche's titles blinked off for the frame in between — a row of
           names strobing under the pointer. The niche keeps its attention
           until the pointer is out of the scene entirely. */
        onMouseLeave={() => setHot(null)}
      >
        <div className={styles.wall} />
        <div className={styles.rake} aria-hidden="true" />
        {niches.map((n) => (
          <div
            key={`${n.ci}:${n.from}`}
            className={styles.niche}
            /* ATTENTION IS ONE STATE, WHEREVER IT CAME FROM. A niche is hot
               when the course being looked at stands in it — pointed at on the
               wall, or pointed at in the column beside it. Same `hot` as the
               row and the spine, so the three never disagree about which work
               is being read. */
            data-hot={n.books.some((b) => b.slug === hot)}
            data-dim={!n.books.some((b) => lit.has(b.slug))}
            style={{ left: n.x, top: n.y, width: n.w, height: n.h, ["--depth" as string]: n.depth.toFixed(2) }}
          >
            <div className={styles.nicheCast} aria-hidden="true" />
            {/* THE MARK LIVES OUTSIDE THE CUT — it is drawn AROUND the shelf,
                and `.nicheBox` clips. Drawn eagerly rather than on first look
                (the prototype's `ensureMark`): that laziness paid for a wall of
                a hundred openings, and this room has one cut per section of one
                of three categories. Drawing it up front is what lets the fade
                actually be a fade. */}
            <div
              className={styles.nicheMark}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: markInk(n.ci, n.w, n.h, dark) }}
            />
            <div className={styles.nicheBox}>
              <div className={styles.nichePersp} dangerouslySetInnerHTML={{ __html: nicheInk(n.ci, n.w, n.h, dark) }} />
              {n.books.map((b) => (
                <Link
                  key={b.slug}
                  className={styles.book}
                  data-live={b.live}
                  data-hot={hot === b.slug}
                  style={{ left: b.x, bottom: b.y, width: b.w, height: b.h, ["--tilt" as string]: `${b.tilt.toFixed(1)}deg` }}
                  aria-label={`${b.title} · ${b.state}`}
                  href={courseAction(b.course, copy).href}
                  onMouseEnter={() => setHot(b.slug)}
                  onFocus={() => setHot(b.slug)}
                >
                  <span className={styles.bookDraw} dangerouslySetInnerHTML={{ __html: spineInk(b.w, b.h) }} />
                  <span
                    className={styles.bookSpine}
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: codeInk(b.title, b.w, b.h) }}
                  />
                </Link>
              ))}
            </div>
            {n.label ? <span className={styles.nicheLabel}>{n.label}</span> : null}
            {n.more ? <span className={styles.nicheMore}>+{n.more}</span> : null}
          </div>
        ))}
      </div>

      {/* THE ROOM IS THE ENVIRONMENT; THIS IS THE CONTENT.
          In the prototype the shelves live in a fixed, `aria-hidden` stage and
          the thing a reader actually reads is a text column beside them — which
          is why its niches are packed into the right half and the left half is
          not empty space but the column's. Porting the stage without the column
          left a room that looked broken and, worse, could only be used by
          pointing at 20px spines: the titles were in the drawing, not in the
          document. The column is the shelf as text — the same courses, the same
          doorways, in a list that can be read, scrolled and tabbed through. */}
      <nav
        className={styles.sheet}
        aria-label={copy.learningLabel}
        onMouseLeave={() => setHot(null)}
      >
        <ol className={styles.shelfList}>
          {shown.map((course, i) => {
            const done = course.standing?.completedLessons ?? 0;
            const total = course.standing?.totalLessons ?? 0;
            const live = course.access === "enrolled";
            return (
              <li key={course.slug}>
                <Link
                  className={styles.row}
                  href={courseAction(course, copy).href}
                  data-hot={hot === course.slug}
                  onMouseEnter={() => setHot(course.slug)}
                  onFocus={() => setHot(course.slug)}
                >
                  <span className={styles.rowIndex}>{String(i + 1).padStart(2, "0")}</span>
                  <span className={styles.rowMain}>
                    {/* THE STROKE UNDER THE NAME, IN TWO STRENGTHS. The weaker
                        one is where attention is pointing (pointer, keyboard,
                        or the shelf on the wall). It is the same pen the room
                        is drawn with, and it is the product's one way of saying
                        "here" — never a filled highlight. */}
                    <span className={styles.inkLabel}>
                      <span className={styles.rowTitle}>{course.title}</span>
                      <span
                        className={styles.rowMark}
                        aria-hidden="true"
                        dangerouslySetInnerHTML={{ __html: rowInk(i * 5 + 3, dark) }}
                      />
                    </span>
                    <span className={styles.rowNote}>
                      {course.categories.map((c) => copy.courseCategories[c]).join(" · ")}
                    </span>
                  </span>
                  <span className={styles.rowState} data-held={live}>
                    {total > 0
                      ? `${done} / ${total}`
                      : course.access === "locked"
                        ? copy.courseLocked
                        : copy.courseNotStarted}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        {/* An empty result is as much of an answer as a list, and it says so in
            the list's own place rather than replacing the room. */}
        {shown.length === 0 ? <p className={styles.noMatch}>{copy.shelfNoMatch}</p> : null}
      </nav>
    </div>
  );
}
