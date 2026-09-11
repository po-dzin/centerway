/**
 * THE ROOM'S INK — every mark in the library, drawn as an SVG string.
 *
 * Lifted out of `LearnRoomView.tsx` on 2026-09-11, unchanged. These are the
 * prototype's own pen functions (зб. 59): a stroke is a filled polygon with a
 * seeded bow, so the same line drawn twice is never quite the same line, and
 * the whole room is deterministic in `seeded` — the same course list draws
 * the same library, on every device, on every render.
 *
 * Nothing here measures or positions anything; `roomGeometry.ts` decides
 * where a niche is, this decides what it looks like.
 */

import { seeded } from "./roomGeometry";

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
    out += penStroke(
      1 + (bx - 1) * t,
      1 + (by - 1) * t,
      W - 1 + (bX - W + 1) * t,
      1 + (by - 1) * t,
      0.9,
      0.16,
      60 + i,
      inkW,
      jr,
    );
    out += penStroke(
      1 + (bx - 1) * t,
      1 + (by - 1) * t,
      1 + (bx - 1) * t,
      H - 1 + (bY - H + 1) * t,
      0.9,
      0.14,
      70 + i,
      inkW,
      jr,
    );
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
      if (!q || !prev || !next) continue;
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
export function spineCode(title: string, w: number, h: number): string {
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

const inkCache = new Map<string, string>();

export function nicheInk(ci: number, w: number, h: number, dark: boolean): string {
  const key = `${ci}|${w}|${h}|${dark ? "d" : "l"}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = nicheSvg(ci, w, h, dark ? 1.7 : 1);
    inkCache.set(key, hit);
  }
  return hit;
}

export function spineInk(w: number, h: number): string {
  const key = `spine|${w}x${h}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = bookInk(w, h);
    inkCache.set(key, hit);
  }
  return hit;
}

export function markInk(ci: number, w: number, h: number, dark: boolean): string {
  const key = `mark|${ci}|${w}|${h}|${dark ? "d" : "l"}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = attentionSvg(ci, w, h, dark ? 1.7 : 1);
    inkCache.set(key, hit);
  }
  return hit;
}

export function codeInk(title: string, w: number, h: number): string {
  const key = `code|${title}|${w}x${h}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = spineCode(title, w, h);
    inkCache.set(key, hit);
  }
  return hit;
}

export function rowInk(seed: number, dark: boolean): string {
  const key = `row|${seed}|${dark ? "d" : "l"}`;
  let hit = inkCache.get(key);
  if (!hit) {
    hit = rayInk(120, false, seed, dark ? 1.7 : 1);
    inkCache.set(key, hit);
  }
  return hit;
}
