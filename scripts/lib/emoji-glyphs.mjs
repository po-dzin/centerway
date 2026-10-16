/**
 * CenterWay reaction emoji — the single source of truth.
 *
 * Contract (docs/design-system.md § Емодзі-реакції):
 *   - 48 grid, one stroke for the whole set: 1.5 with
 *     vector-effect="non-scaling-stroke", the icon stroke. A chip at 20px and
 *     the picker at 40px carry the same line the icons do, instead of a weight
 *     that grows with the render size (G compared the two on 2026-10-16);
 *   - a seeded pencil wobble and a misregistered colour fill, both computed
 *     here at bake time, never at render time;
 *   - the DETAIL GATE below fails the bake when a drawing gets too fine.
 *
 * Unlike the icons, the hand character IS authored here: the wobble is part of
 * the drawing, not a preset applied to clean geometry. This is a faithful port
 * of the Python generator the set was drawn and approved with on 2026-10-16
 * (emoji_gen.py, «по эмоджи ок, можно их в дс добавлять»). The arithmetic is
 * kept in the same order as the original — the sin-based jitter, the radians
 * conversion, Python's round-half-even in `dark()` and in `.2f` — so the baked
 * paths are byte-identical to what was approved. Rewriting an expression "more
 * cleanly" can move a point by one ulp and a coordinate by 0.01; if you do, look
 * at the drawings again.
 *
 * Each emoji has a stable ASCII `id` (the sprite symbol is `cwe-<id>`) that names
 * WHAT IS DRAWN, the way Unicode names its emoji (sparkles, raised-hands,
 * hundred), and a Ukrainian `name` that says what the reaction MEANS. The id is
 * what a stored reaction will point at, so it never changes once shipped; the
 * name and the drawing may.
 *
 * To add one: write a drawing function, add a row to EMOJI with a fresh seed,
 * run `npm run emoji:build`, look at it at 20px.
 */

/* ── Palette ─────────────────────────────────────────────────────────────────
 * Token colours where the system has one (data/design-tokens/cw.tokens.json):
 * warm = mainOrange / --cw-sem-warmth, gold = deepGold, sand = mediumOrange,
 * terra = boundary, trust = trustBlue, teal = routeTeal, clay = mineralWarmth,
 * paper = --cw-sem-calm-surface.
 *
 * THE EXCEPTION, ON PURPOSE. skin #f0b840, moon #f5dc82, crater #e2bd5c, the
 * two greens #3f7c4a / #7ba75d and night #496a7c are not tokens: G set them on
 * 2026-10-16 on purpose, leaning towards Noto. stone, pink and sky are not
 * tokens either; they came with the same approved set. They live here and nowhere else — an emoji is a picture
 * with its own palette, and these colours are not to be reused by any
 * component as if they were part of the system.
 */
export const PALETTE = {
  warm: "#e5ae65",
  gold: "#c8913f",
  sand: "#edc693",
  green: "#3f7c4a",
  life: "#7ba75d",
  terra: "#b76045",
  trust: "#4a6577",
  teal: "#4f7e76",
  clay: "#c1906b",
  paper: "#fff8ef",
  stone: "#a89b8a",
  skin: "#f0b840",
  moon: "#f5dc82",
  crater: "#e2bd5c",
  night: "#496a7c",
  pink: "#e3a08c",
  sky: "#9cbcc4",
};
const C = PALETTE;

/** One stroke for the whole set, the icon stroke (see the header). */
export const STROKE = 1.5;

export const VIEWBOX = "0 0 48 48";

/* ── Detail gate ─────────────────────────────────────────────────────────────
 * The emoji form of the icon contract. An emoji is read at 20px in a reaction
 * chip, where one unit of this 48 grid is 0.42px; anything that cannot survive
 * that render is ripple, not drawing. G asked for a gate like the icon gate so
 * the set never turns into ripple: the bake refuses an emoji that breaks it.
 */
export const GATE = {
  parts: 12, // drawn elements per emoji (shape, line or dot)
  dot: 1.6, // smallest dot radius: a 1.3px dot at 20px
  shape: 4.5, // smallest shape span
  line: 4.0, // shortest stroke length
  stroke: 1.2, // thinnest nominal stroke (the drawing's intended weight)
  fills: 4, // distinct fill colours, outline excluded
};

/* ── Python-compatible arithmetic ───────────────────────────────────────── */

const DEG = Math.PI / 180; // math.radians(x) is x * (pi / 180) in CPython
const radians = (x) => x * DEG;

/** Python's float `%`: the result takes the sign of the divisor. */
const pymod = (a, b) => {
  const r = a % b;
  return r !== 0 && r < 0 !== b < 0 ? r + b : r;
};

/** Python's round(): half to even, on the exact binary value. */
const roundHalfEven = (x) => {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

/**
 * Python's f"{x:.2f}". toFixed agrees with it except on an exact binary tie
 * (x * 100 ending in exactly .5, e.g. 12.125), where Python rounds to even and
 * toFixed rounds away from zero, and on -0, which Python prints with its sign.
 */
const f2 = (x) => {
  if (Object.is(x, -0)) return "-0.00";
  const a = Math.abs(x);
  const h = a * 100;
  if (Number.isInteger(a * 8) && h - Math.floor(h) === 0.5) {
    const n = Math.floor(h);
    const even = n % 2 === 0 ? n : n + 1;
    return (x < 0 ? "-" : "") + (even / 100).toFixed(2);
  }
  return x.toFixed(2);
};

/* colorsys.rgb_to_hls / hls_to_rgb, line for line (CPython 3.13). */
function rgbToHls(r, g, b) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const sumc = maxc + minc;
  const rangec = maxc - minc;
  const l = sumc / 2.0;
  if (minc === maxc) return [0.0, l, 0.0];
  const s = l <= 0.5 ? rangec / sumc : rangec / (2.0 - maxc - minc);
  const rc = (maxc - r) / rangec;
  const gc = (maxc - g) / rangec;
  const bc = (maxc - b) / rangec;
  let h;
  if (r === maxc) h = bc - gc;
  else if (g === maxc) h = 2.0 + rc - bc;
  else h = 4.0 + gc - rc;
  return [pymod(h / 6.0, 1.0), l, s];
}

const ONE_THIRD = 1.0 / 3.0;
const ONE_SIXTH = 1.0 / 6.0;
const TWO_THIRD = 2.0 / 3.0;

function hlsV(m1, m2, hue) {
  hue = pymod(hue, 1.0);
  if (hue < ONE_SIXTH) return m1 + (m2 - m1) * hue * 6.0;
  if (hue < 0.5) return m2;
  if (hue < TWO_THIRD) return m1 + (m2 - m1) * (TWO_THIRD - hue) * 6.0;
  return m1;
}

function hlsToRgb(h, l, s) {
  if (s === 0.0) return [l, l, l];
  const m2 = l <= 0.5 ? l * (1.0 + s) : l + s - l * s;
  const m1 = 2.0 * l - m2;
  return [hlsV(m1, m2, h + ONE_THIRD), hlsV(m1, m2, h), hlsV(m1, m2, h - ONE_THIRD)];
}

/** Deeper shade of the same colour, used as that shape's outline. */
export function dark(hex, k = 0.38) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [hh, l, sa] = rgbToHls(r, g, b);
  // paper-white fills take a slate outline
  if (l > 0.88) return dark(C.trust, 0.75);
  const rgb = hlsToRgb(hh, l * k, Math.min(1, sa * 1.1));
  return (
    "#" +
    rgb
      .map((v) =>
        roundHalfEven(v * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const INK = dark(C.gold, 0.36);

/* ── The pencil ──────────────────────────────────────────────────────────── */

/** Seeded jitter in [0, 1): the classic sin hash, same constants as the original. */
function jit(i, salt) {
  const n = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** Pushes every point a seeded distance in a seeded direction. */
function wob(pts, seed, amp = 0.55) {
  return pts.map(([x, y], i) => {
    const a = jit(i, seed) * Math.PI * 2;
    const r = amp * (0.4 + 0.6 * jit(i, seed + 3));
    return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
}

/** Catmull-Rom through the points -> cubic Beziers. */
function smooth(P, closed = true) {
  const n = P.length;
  if (n < 2) return "";
  let d = `M${f2(P[0][0])} ${f2(P[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i += 1) {
    const p0 = closed || i > 0 ? P[pymod(i - 1, n)] : P[i];
    const p1 = P[i];
    const p2 = P[(i + 1) % n];
    const p3 = closed || i + 2 < n ? P[(i + 2) % n] : P[(i + 1) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f2(c1[0])} ${f2(c1[1])} ${f2(c2[0])} ${f2(c2[1])} ${f2(p2[0])} ${f2(p2[1])}`;
  }
  return d + (closed ? "Z" : "");
}

function ell(cx, cy, rx, ry, n = 16, rot = 0.0, start = 0.0) {
  const out = [];
  for (let t = 0; t < n; t += 1) {
    out.push([
      cx + rx * Math.cos(start + (t * 2 * Math.PI) / n + rot),
      cy + ry * Math.sin(start + (t * 2 * Math.PI) / n + rot),
    ]);
  }
  return out;
}

function arc(cx, cy, rx, ry, a0, a1, n = 8) {
  const out = [];
  for (let t = 0; t < n; t += 1) {
    out.push([
      cx + rx * Math.cos(radians(a0 + ((a1 - a0) * t) / (n - 1))),
      cy + ry * Math.sin(radians(a0 + ((a1 - a0) * t) / (n - 1))),
    ]);
  }
  return out;
}

const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);

/** One emoji being drawn: its parts (SVG elements) and what the gate measures. */
class Drawing {
  constructor(seed) {
    this.s = seed;
    this.parts = [];
    this.k = 0;
    this.meta = [];
  }

  nextSeed() {
    this.k += 1;
    return this.s * 31 + this.k * 7;
  }

  note(kind, pts, w = null, fill = null) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    let span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (kind === "line") {
      span = 0;
      for (let i = 0; i < pts.length - 1; i += 1) span += dist(pts[i], pts[i + 1]);
    }
    this.meta.push({ kind, span, w, fill });
  }

  /** A closed (or open) form: offset colour fill under a wobbling outline. */
  shape(pts, fill, { ink = true, w = 1.6, amp = 0.5, off = [0.45, 0.4], closed = true } = {}) {
    this.note("shape", pts, ink ? w : null, fill);
    const sd = this.nextSeed();
    if (fill) {
      const fp = wob(pts, sd + 101, amp * 0.6).map(([x, y]) => [x + off[0], y + off[1]]);
      this.parts.push(`<path d="${smooth(fp, closed)}" fill="${fill}"/>`);
    }
    if (ink) {
      this.parts.push(
        `<path d="${smooth(wob(pts, sd, amp), closed)}" fill="none" stroke="${fill ? dark(fill) : INK}" ` +
          `stroke-width="${STROKE}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
  }

  line(pts, w = 1.6, amp = 0.35, color = INK) {
    this.note("line", pts, w);
    const sd = this.nextSeed();
    this.parts.push(
      `<path d="${smooth(wob(pts, sd, amp), false)}" fill="none" stroke="${color}" ` +
        `stroke-width="${STROKE}" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }

  dot(x, y, r = 1.3, color = INK) {
    this.note(
      "dot",
      [
        [x - r, y - r],
        [x + r, y + r],
      ],
      null,
      color,
    );
    const sd = this.nextSeed();
    this.parts.push(`<path d="${smooth(wob(ell(x, y, r, r * 0.92, 7), sd, r * 0.18))}" fill="${color}"/>`);
  }
}

/* ── Builders ────────────────────────────────────────────────────────────── */

const faceDisc = (e) => e.shape(ell(24, 25, 16.5, 16, 18), C.skin, { w: 1.7 });

function happyEyes(e, y = 21) {
  e.line(arc(17.5, y + 2.2, 3.8, 3.4, 200, 340, 6), 2.1);
  e.line(arc(30.5, y + 2.2, 3.8, 3.4, 200, 340, 6), 2.1);
}

/** Plain dark ovals, as in Noto. */
function dotEyes(e, y = 21, r = 2.1, color = null) {
  for (const x of [18, 30]) {
    e.shape(ell(x, y, r, r * 1.5, 10), color || INK, { ink: false, amp: 0.12, off: [0, 0] });
  }
}

function cheeks(e) {
  e.dot(14.5, 27, 2.2, C.pink);
  e.dot(33.5, 27, 2.2, C.pink);
}

function heartPts(cx, cy, s) {
  const pts = [];
  for (let i = 0; i < 22; i += 1) {
    const t = (i / 22) * 2 * Math.PI;
    const x = 16 * Math.sin(t) ** 3;
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    pts.push([cx + x * s, cy + y * s]);
  }
  return pts;
}

/** Open palm, four fingers up, thumb to the right; finger gaps come from the dips. */
// prettier-ignore
const PALM = [[-5, 9], [-5.6, 2], [-5.8, -4], [-5.6, -9], [-4.6, -10.6], [-3.4, -9.6], [-3.0, -5], [-2.6, -11.2], [-1.3, -12.6], [0, -11.4], [0.2, -5.2], [0.6, -11.8], [1.9, -12.8], [3.1, -11.4], [3.2, -5], [3.6, -10], [4.8, -10.8], [5.8, -9.4], [5.6, -2], [8.2, -5.2], [9.6, -4.6], [9.4, -2.8], [6.8, 3.5], [4, 8.5], [-1, 9.6]];

function palm(e, cx, cy, ang, fill, scale = 1.0) {
  const ca = Math.cos(radians(ang));
  const sa = Math.sin(radians(ang));
  const pts = PALM.map(([x, y]) => [cx + (x * ca - y * sa) * scale * 0.85, cy + (x * sa + y * ca) * scale * 0.85]);
  e.shape(pts, fill, { w: 1.3, amp: 0.12 });
}

function drop(e, cx = 24, cy = 27, s = 1.0, fill = C.teal) {
  const pts = [
    [cx, cy - 18 * s],
    [cx + 6 * s, cy - 8 * s],
    [cx + 11 * s, cy + 2 * s],
    [cx + 10 * s, cy + 10 * s],
    [cx + 4 * s, cy + 15 * s],
    [cx - 4 * s, cy + 15 * s],
    [cx - 10 * s, cy + 10 * s],
    [cx - 11 * s, cy + 2 * s],
    [cx - 6 * s, cy - 8 * s],
  ];
  e.shape(pts, fill, { w: 1.6 });
}

function sparkle(e, cx, cy, r, fill = C.warm) {
  const pts = [];
  for (let i = 0; i < 8; i += 1) {
    const a = radians(i * 45 - 90);
    const rr = i % 2 === 0 ? r : r * 0.32;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  e.shape(pts, fill, { w: 1.3, amp: 0.25, off: [0.6, 0.6] });
}

function leaf(e, cx, cy, L, ang, fill = C.life) {
  const ca = Math.cos(radians(ang));
  const sa = Math.sin(radians(ang));
  const base = [
    [0, 0],
    [L * 0.3, -L * 0.22],
    [L * 0.7, -L * 0.2],
    [L, 0],
    [L * 0.7, L * 0.2],
    [L * 0.3, L * 0.22],
  ];
  const pts = base.map(([x, y]) => [cx + x * ca - y * sa, cy + x * sa + y * ca]);
  e.shape(pts, fill, { w: 1.4, amp: 0.3, off: [0.6, 0.6] });
}

/** Points along a ray from (cx, cy), at angle `a` degrees, between radii r0 and r1. */
const ray = (cx, cy, a, r0, r1) => [
  [cx + r0 * Math.cos(radians(a)), cy + r0 * Math.sin(radians(a))],
  [cx + r1 * Math.cos(radians(a)), cy + r1 * Math.sin(radians(a))],
];

/* ── Емоції ──────────────────────────────────────────────────────────────── */

function joy(e) {
  faceDisc(e);
  happyEyes(e);
  cheeks(e);
  e.line(arc(24, 26, 7.5, 6.5, 20, 160, 7), 1.7);
}
function laugh(e) {
  faceDisc(e);
  // prettier-ignore
  e.line([[15.5, 19], [20, 21], [15.5, 23]], 1.5);
  // prettier-ignore
  e.line([[32.5, 19], [28, 21], [32.5, 23]], 1.5);
  // prettier-ignore
  e.shape([[15, 27], [33, 27], [31, 33], [24, 36.5], [17, 33]], C.terra, { w: 1.5, amp: 0.3 });
  drop(e, 9.5, 23, 0.28, C.sky);
  drop(e, 38.5, 23, 0.28, C.sky);
}
function delight(e) {
  faceDisc(e);
  e.shape(heartPts(18, 20.5, 0.24), C.terra, { w: 1.3, amp: 0.15, off: [0.4, 0.4] });
  e.shape(heartPts(30, 20.5, 0.24), C.terra, { w: 1.3, amp: 0.15, off: [0.4, 0.4] });
  e.line(arc(24, 27, 7, 6, 15, 165, 7), 1.7);
}
function moved(e) {
  faceDisc(e);
  dotEyes(e, 21.5, 2.6);
  // prettier-ignore
  e.line([[20, 31.5], [22, 30.5], [24, 31.5], [26, 30.5], [28, 31.5]], 1.4, 0.15);
  // prettier-ignore
  e.line([[13.5, 18], [17.5, 15.8]], 1.3);
  // prettier-ignore
  e.line([[34.5, 18], [30.5, 15.8]], 1.3);
}
function sad(e) {
  faceDisc(e);
  dotEyes(e, 22);
  e.line(arc(24, 35, 6, 4.5, 200, 340, 6), 1.6);
  // prettier-ignore
  e.line([[15, 18], [19.5, 17]], 1.2);
  // prettier-ignore
  e.line([[33, 18], [28.5, 17]], 1.2);
  drop(e, 30.5, 28.5, 0.22, C.sky);
}
function wow(e) {
  faceDisc(e);
  dotEyes(e, 20.5);
  e.shape(ell(24, 31, 3.2, 4, 10), C.terra, { w: 1.4, amp: 0.2 });
  // prettier-ignore
  e.line([[15, 15.5], [19.5, 14.5]], 1.2);
  // prettier-ignore
  e.line([[33, 15.5], [28.5, 14.5]], 1.2);
}
function mindBlown(e) {
  e.shape(ell(24, 30, 14, 13, 16), C.skin, { w: 1.7 });
  dotEyes(e, 27.5, 1.9);
  e.shape(ell(24, 36, 2.6, 2.8, 9), C.terra, { w: 1.3, amp: 0.15 });
  for (let a = -150; a < -20; a += 26) e.line(ray(24, 25, a, 15, 19.5), 1.4, 0.2, C.gold);
}
function calm(e) {
  faceDisc(e);
  e.line(arc(18.5, 20.5, 2.8, 2.2, 20, 160, 5), 1.5);
  e.line(arc(29.5, 20.5, 2.8, 2.2, 20, 160, 5), 1.5);
  e.line(arc(24, 28, 5, 3.5, 25, 155, 6), 1.5);
  cheeks(e);
}
function thinking(e) {
  faceDisc(e);
  dotEyes(e, 21, 1.9);
  // prettier-ignore
  e.line([[15, 16], [20, 15.5]], 1.3);
  // prettier-ignore
  e.line([[28, 14.5], [33, 16.5]], 1.3);
  // prettier-ignore
  e.line([[20, 31], [25, 30], [29, 31.5]], 1.5);
  palm(e, 31, 38, -30, C.skin, 0.62);
}
function sleep(e) {
  e.shape(ell(23, 26, 15.5, 15, 18), C.skin, { w: 1.7 });
  e.line(arc(17.5, 22.5, 2.6, 2, 20, 160, 5), 1.5);
  e.line(arc(28.5, 22.5, 2.6, 2, 20, 160, 5), 1.5);
  e.shape(ell(23, 31, 2.4, 2.6, 8), C.terra, { w: 1.2, amp: 0.1, off: [0.3, 0.3] });
  // prettier-ignore
  e.line([[34, 6], [40, 6], [34, 12], [40, 12]], 1.4, 0.15, C.trust);
  // prettier-ignore
  e.line([[39, 15], [43, 15], [39, 19], [43, 19]], 1.2, 0.1, C.trust);
}

/* ── Почуття і жести ─────────────────────────────────────────────────────── */

function heart(e) {
  e.shape(heartPts(24, 25, 1.18), C.terra, { w: 1.7 });
}
function thanks(e) {
  palm(e, 19.5, 26, 14, C.skin, 1.35);
  palm(e, 28.5, 26, -14, C.skin, 1.35);
}
function hug(e) {
  e.shape(ell(24, 21, 13.5, 13, 16), C.skin, { w: 1.6 });
  happyEyes(e, 17);
  e.line(arc(24, 21, 5, 4, 30, 150, 6), 1.5);
  palm(e, 13, 36, 40, C.skin, 0.9);
  palm(e, 35, 36, -40, C.skin, 0.9);
}
function clap(e) {
  palm(e, 21, 27, 25, C.skin, 1.25);
  palm(e, 28, 25, -15, C.skin, 1.25);
  for (const a of [-115, -65]) {
    e.line(
      [
        [30 + 11 * Math.cos(radians(a)), 14 + 8 * Math.sin(radians(a))],
        [30 + 17 * Math.cos(radians(a)), 14 + 13 * Math.sin(radians(a))],
      ],
      1.5,
      0.1,
      C.gold,
    );
  }
}
function raisedHands(e) {
  palm(e, 15, 26, -12, C.skin, 1.15);
  palm(e, 33, 26, 12, C.skin, 1.15);
  for (const [x, y] of [
    [8, 9],
    [24, 8],
    [40, 9],
  ]) {
    // prettier-ignore
    e.line([[x, y + 3], [x, y - 2]], 1.4, 0.1, C.gold);
  }
}
function together(e) {
  palm(e, 17, 26, 72, C.skin, 1.2);
  palm(e, 31, 23, -72, C.skin, 1.2);
  // prettier-ignore
  e.line([[4, 33], [9.5, 31]], 1.6, 0.1);
  // prettier-ignore
  e.line([[38.5, 26], [44, 24]], 1.6, 0.1);
}
function eyes(e) {
  for (const x of [16, 32]) {
    e.shape(ell(x, 24, 7, 10, 14), C.paper, { w: 1.6, off: [0.6, 0.6] });
    e.shape(ell(x + 1.5, 26, 3.2, 3.6, 10), C.night, { w: 1.2, amp: 0.15 });
  }
}
function hundred(e) {
  // prettier-ignore
  e.line([[6, 14], [9, 12], [9, 32]], 2.4, 0.2, C.terra);
  e.shape(ell(19.5, 22, 5, 9.5, 12), null, { w: 2.4 });
  e.shape(ell(32.5, 22, 5, 9.5, 12), null, { w: 2.4 });
  // the two zeros are outline only; recolour their ink to the numeral's
  const n = e.parts.length;
  e.parts[n - 2] = e.parts[n - 2].replaceAll(INK, C.terra);
  e.parts[n - 1] = e.parts[n - 1].replaceAll(INK, C.terra);
  // prettier-ignore
  e.line([[6, 37], [24, 35.5], [42, 37]], 2, 0.25, C.terra);
  // prettier-ignore
  e.line([[9, 41.5], [24, 40], [39, 41.5]], 1.6, 0.25, C.terra);
}

/* ── Стихії ──────────────────────────────────────────────────────────────── */

function fire(e) {
  // prettier-ignore
  const out = [[24, 4], [29, 11], [35, 17], [37, 26], [34, 36], [24, 43], [14, 37], [11, 28], [14, 20], [17, 25], [19, 15]];
  e.shape(out, C.terra, { w: 1.6 });
  // prettier-ignore
  const inner = [[24, 20], [28, 27], [29, 34], [24, 39], [19, 34], [20, 28]];
  e.shape(inner, C.warm, { ink: false, off: [0, 0] });
}
function water(e) {
  drop(e);
  e.line(arc(20, 31, 4, 5, 110, 200, 5), 1.2, 0.1, C.paper);
}
function air(e) {
  // prettier-ignore
  e.line([[5, 16], [22, 16], ...arc(26, 12, 4.5, 4.5, 90, -200, 8).slice(0, 7)], 1.8, 0.2, C.teal);
  // prettier-ignore
  e.line([[5, 25], [32, 25], ...arc(35, 20.5, 4.8, 4.5, 90, -200, 8).slice(0, 7)], 1.8, 0.2, C.teal);
  // prettier-ignore
  e.line([[9, 34], [24, 34], ...arc(27, 38.5, 4, 4.5, -90, 200, 8).slice(0, 7)], 1.8, 0.2, C.teal);
}
function earth(e) {
  // prettier-ignore
  e.shape([[4, 40], [17, 14], [23, 23], [29, 15], [44, 40]], C.green, { w: 1.7 });
  // prettier-ignore
  e.shape([[17, 14], [20.5, 21], [17.5, 19.5], [14.5, 21]], C.paper, { w: 1.2, amp: 0.15, off: [0, 0] });
  // prettier-ignore
  e.line([[2, 42], [46, 42]], 1.6, 0.3, C.gold);
}
function ether(e) {
  e.shape(ell(24, 24, 17, 17, 18), C.night, { w: 1.7 });
  const sp = [];
  for (let i = 0; i < 26; i += 1) {
    const t = i * 0.5;
    sp.push([24 + (0.6 + t * 0.55) * Math.cos(t * 0.95) * 1.0, 24 + (0.6 + t * 0.55) * Math.sin(t * 0.95) * 0.75]);
  }
  e.line(sp, 1.8, 0.15, C.warm);
  e.line(
    sp.slice(0, 20).map(([x, y]) => [48 - x, 48 - y]),
    1.3,
    0.15,
    C.sand,
  );
  sparkle(e, 14, 14, 4.5, C.sand);
}
function bolt(e) {
  // prettier-ignore
  e.shape([[27, 3], [11, 26], [22, 26], [18, 45], [37, 19], [25, 19]], C.warm, { w: 1.7, amp: 0.3 });
}
function stone(e) {
  // prettier-ignore
  e.shape([[15, 44], [13, 24], [14, 13], [19, 6], [30, 5], [35, 12], [35, 25], [33, 44]], C.stone, { w: 1.7 });
  // prettier-ignore
  e.line([[16, 18], [32, 18]], 2.2, 0.2);
  // prettier-ignore
  e.line([[25, 19], [28.5, 30], [24, 31.5]], 1.6, 0.15);
  // prettier-ignore
  e.line([[19, 36], [30, 36]], 1.8, 0.2);
  e.dot(20, 23, 1.8);
  e.dot(30, 23, 1.8);
}
function poop(e) {
  const br = C.clay;
  // prettier-ignore
  e.shape([[7, 40], [8, 33], [14, 30], [34, 30], [40, 33], [41, 40], [34, 44], [14, 44]], br, { w: 1.6 });
  // prettier-ignore
  e.shape([[11, 31], [13, 25], [18, 22], [30, 22], [35, 25], [37, 31]], br, { w: 1.6 });
  // prettier-ignore
  e.shape([[16, 23], [18, 16], [24, 13], [28, 8], [27, 4], [32, 8], [32, 16], [32, 23]], br, { w: 1.6 });
  dotEyes(e, 35.5, 1.8);
  e.line(arc(24, 38.5, 4.5, 3, 20, 160, 6), 1.6);
}

/* ── Небо ────────────────────────────────────────────────────────────────── */

function sun(e) {
  for (let i = 0; i < 8; i += 1) {
    const a = radians(i * 45 + 8);
    const [r0, r1] = [13, 19.5];
    e.line(
      [
        [24 + r0 * Math.cos(a), 24 + r0 * Math.sin(a)],
        [24 + r1 * Math.cos(a), 24 + r1 * Math.sin(a)],
      ],
      1.6,
      0.15,
      C.gold,
    );
  }
  e.shape(ell(24, 24, 10, 10, 14), C.warm, { w: 1.7 });
}
function moonLight(e) {
  e.shape(ell(24, 24, 16.5, 16.5, 18), C.moon, { w: 1.7 });
  e.dot(15, 31, 2.6, C.crater);
  e.line(arc(19, 21, 2.6, 2, 20, 160, 5), 1.4);
  e.line(arc(29, 21, 2.6, 2, 20, 160, 5), 1.4);
  e.line(arc(24, 26, 5, 4, 25, 155, 6), 1.5);
}
function moonDark(e) {
  e.shape(ell(24, 24, 16.5, 16.5, 18), C.night, { w: 1.7 });
  e.dot(15, 31, 2.6, C.trust);
  dotEyes(e, 21, 1.9, C.paper);
  // prettier-ignore
  e.line([[20, 28.5], [24, 29.5], [28, 28]], 1.4, 0.15, C.paper);
}
function sparkles(e) {
  sparkle(e, 20, 25, 13);
  sparkle(e, 36, 11, 6.5, C.sand);
  sparkle(e, 37, 35, 5, C.gold);
}
function dove(e) {
  // prettier-ignore
  const body = [[37, 13], [41, 14.5], [44, 16.5], [40, 18], [38, 23], [33, 30], [24, 33], [15, 34], [5, 39], [8, 31], [16, 27], [26, 25], [32, 19], [33, 14.5]];
  e.shape(body, C.paper, { w: 1.6, off: [0.9, 0.9] });
  // prettier-ignore
  e.shape([[20, 26], [12, 15], [13, 6], [22, 10], [29, 17], [29, 24]], C.sky, { w: 1.5 });
  e.dot(37.5, 15.5, 1.6);
  // prettier-ignore
  e.line([[42, 17], [40, 24]], 1.3, 0.1, C.green);
  leaf(e, 41.5, 20, 6, 150, C.life);
  leaf(e, 40.5, 23, 6, 60, C.life);
}

/* ── Рослини ─────────────────────────────────────────────────────────────── */

function sprout(e) {
  // prettier-ignore
  e.shape([[8, 40], [15, 36], [24, 35], [33, 36], [40, 40], [24, 43]], C.clay, { w: 1.5, amp: 0.3 });
  // prettier-ignore
  e.line([[24, 36], [24.5, 27], [23.5, 19]], 1.8, 0.2, C.green);
  leaf(e, 24, 23, 14, -150, C.life);
  leaf(e, 24.5, 20, 13, -35, C.life);
}
function greens(e) {
  // prettier-ignore
  e.line([[8, 42], [18, 30], [28, 20], [38, 8]], 1.7, 0.3, C.green);
  for (const [x, y, a] of [
    [14, 35, -130],
    [18, 30, -20],
    [23, 25, -125],
    [28, 20, -15],
    [33, 14, -120],
  ]) {
    leaf(e, x, y, 10, a, a < -100 ? C.life : C.green);
  }
}
function flower(e) {
  for (let i = 0; i < 5; i += 1) {
    const a = radians(i * 72 - 90);
    e.shape(ell(24 + 9 * Math.cos(a), 22 + 9 * Math.sin(a), 6.5, 5.2, 10, a), C.pink, {
      w: 1.4,
      amp: 0.25,
      off: [0.5, 0.5],
    });
  }
  e.shape(ell(24, 22, 5, 5, 10), C.warm, { w: 1.4, amp: 0.2 });
  // prettier-ignore
  e.line([[24, 33], [25, 45]], 1.6, 0.15, C.green);
  leaf(e, 24.6, 40, 8, -30, C.life);
}
function leaves(e) {
  leaf(e, 9, 30, 17, -35, C.life);
  leaf(e, 22, 18, 14, -55, C.sand);
  for (const y of [34, 39]) {
    // prettier-ignore
    e.line([[28, y], [36, y - 1], [44, y]], 1.2, 0.2, C.teal);
  }
}

/* ── Тіло ────────────────────────────────────────────────────────────────────
 * Asanas as stick figures, the same body the icon set draws (`seated`,
 * `motion` in scripts/lib/icon-glyphs.mjs): a ring for the head, one stroke per
 * limb, two segments per limb so the joints read at 20px.
 */

const LIMB = dark(C.terra, 0.62);

const stick = (e, pts, w = 2.1) => e.line(pts, w, 0.18, LIMB);
const ring = (e, x, y, r = 3.6) => e.shape(ell(x, y, r, r, 12), C.skin, { w: 1.3, amp: 0.12, off: [0.3, 0.3] });
// prettier-ignore
const mat = (e) => e.line([[4, 45], [44, 45]], 2.2, 0.15, C.life);

/* prettier-ignore */
function lotus(e) {
  // Падмасана: spine, hands resting on the knees, shins crossed
  mat(e);
  stick(e, [[24, 33], [8.5, 38.5], [29, 42]]); stick(e, [[24, 33], [39.5, 38.5], [19, 42]]);
  stick(e, [[24, 15.5], [24, 33]]);
  stick(e, [[24, 19], [16.5, 26], [11, 37]]); stick(e, [[24, 19], [31.5, 26], [37, 37]]);
  ring(e, 24, 11, 3.6);
}
/* prettier-ignore */
function tree(e) {
  // Врікшасана
  mat(e);
  stick(e, [[24, 13.5], [24, 28]]); stick(e, [[24, 28], [24, 36], [24, 43.5]]);
  stick(e, [[24, 28], [32.5, 33], [25, 36]]);
  stick(e, [[24, 16.5], [15.5, 10.5], [23, 2.8]]); stick(e, [[24, 16.5], [32.5, 10.5], [25, 2.8]]);
  ring(e, 24, 9.2, 3.4);
}
/* prettier-ignore */
function warrior(e) {
  // Вірабхадрасана II
  mat(e);
  stick(e, [[24.5, 14], [24, 28]]);
  stick(e, [[24, 28], [34, 31], [35, 43.5]]); stick(e, [[24, 28], [14.5, 36], [6, 43.5]]);
  stick(e, [[24.4, 17.5], [14, 17.5], [4.5, 17]]); stick(e, [[24.4, 17.5], [34, 17.5], [43.5, 17]]);
  ring(e, 25, 9.8, 3.4);
}
/* prettier-ignore */
function dog(e) {
  // Адхо мукха шванасана
  mat(e);
  stick(e, [[15, 30], [21.5, 21.5], [28, 13]]); stick(e, [[15, 30], [11.5, 37], [8, 43.5]]);
  stick(e, [[28, 13], [34.5, 28], [40, 43.5]]);
  ring(e, 19, 34.5, 3.3);
}
/* prettier-ignore */
function cobra(e) {
  // Бхуджангасана
  mat(e);
  stick(e, [[28, 40.5], [36, 42.5], [44, 43.5]]); stick(e, [[28, 40.5], [19.5, 36.5], [15, 27.5]]);
  stick(e, [[15.5, 30], [15.2, 37], [15, 43.5]]);
  ring(e, 13, 22, 3.3);
}
/* prettier-ignore */
function starJump(e) {
  mat(e);
  stick(e, [[24, 13.5], [24, 28]]);
  stick(e, [[24, 28], [19, 36], [14, 43.5]]); stick(e, [[24, 28], [29, 36], [34, 43.5]]);
  stick(e, [[24, 16.5], [17, 10.5], [10, 4.5]]); stick(e, [[24, 16.5], [31, 10.5], [38, 4.5]]);
  ring(e, 24, 9.2, 3.4);
}

/* ── The set, in picker order ────────────────────────────────────────────────
 * `seed` drives the wobble: changing it redraws the pencil line, so an existing
 * emoji keeps its seed forever. Seeds go up by one inside a group and each
 * group starts on its own decade (10, 30, 50, 70, 90, 110), which is how the
 * set was drawn; a new emoji takes the next free seed in its group.
 */
const GROUPS = [
  [
    "Емоції",
    10,
    [
      ["joy", "Радість", joy],
      ["laugh", "Смішно", laugh],
      ["delight", "Захват", delight],
      ["moved", "Зворушує", moved],
      ["sad", "Сум", sad],
      ["wow", "Здивування", wow],
      ["mind-blown", "Відкриття", mindBlown],
      ["calm", "Спокій", calm],
      ["thinking", "Роздуми", thinking],
      ["sleep", "Сон", sleep],
    ],
  ],
  [
    "Почуття і жести",
    30,
    [
      ["heart", "Відгукнулось", heart],
      ["thanks", "Дякую", thanks],
      ["hug", "Обіймаю", hug],
      ["clap", "Браво", clap],
      ["raised-hands", "Підтримую", raisedHands],
      ["together", "Разом", together],
      ["eyes", "Цікаво", eyes],
      ["hundred", "Точно", hundred],
    ],
  ],
  [
    "Стихії",
    50,
    [
      ["fire", "Вогонь", fire],
      ["water", "Вода", water],
      ["air", "Повітря", air],
      ["earth", "Земля", earth],
      ["ether", "Ефір", ether],
      ["bolt", "Енергія", bolt],
      ["stone", "Камінь", stone],
      ["poop", "Какашка", poop],
    ],
  ],
  [
    "Небо",
    70,
    [
      ["sun", "Сонце", sun],
      ["moon-light", "Світлий місяць", moonLight],
      ["moon-dark", "Темний місяць", moonDark],
      ["sparkles", "Світло", sparkles],
      ["dove", "Мир", dove],
    ],
  ],
  [
    "Рослини",
    90,
    [
      ["sprout", "Спробую", sprout],
      ["greens", "Зелень", greens],
      ["flower", "Цвітіння", flower],
      ["leaves", "Легкість", leaves],
    ],
  ],
  [
    "Тіло",
    110,
    [
      ["lotus", "Практика", lotus],
      ["tree", "Дерево", tree],
      ["warrior", "Воїн", warrior],
      ["dog", "Собака", dog],
      ["cobra", "Кобра", cobra],
      ["star-jump", "Гімнастика", starJump],
    ],
  ],
];

/** Every emoji in picker order: { id, name, group, seed, draw }. */
export const EMOJI = GROUPS.flatMap(([group, base, rows]) =>
  rows.map(([id, name, draw], i) => ({ id, name, group, seed: base + i, draw })),
);

export const EMOJI_GROUPS = GROUPS.map(([group]) => group);

/** What the gate says about one drawing; an empty list means it passes. */
export function gateFailures(meta) {
  const bad = [];
  if (meta.length > GATE.parts) bad.push(`${meta.length} parts > ${GATE.parts}`);
  for (const { kind, span, w } of meta) {
    if (kind === "dot" && span / 2 < GATE.dot) bad.push(`dot r=${(span / 2).toFixed(1)}`);
    if (kind === "shape" && span < GATE.shape) bad.push(`shape span ${span.toFixed(1)}`);
    if (kind === "line" && span < GATE.line) bad.push(`line ${span.toFixed(1)} long`);
    if (w !== null && w < GATE.stroke) bad.push(`stroke ${w}`);
  }
  const fills = new Set(meta.filter((m) => m.fill && m.kind !== "line").map((m) => m.fill));
  if (fills.size > GATE.fills) bad.push(`${fills.size} fills > ${GATE.fills}`);
  return [...new Set(bad)].sort();
}

/** Draws one emoji: its SVG elements, in paint order, and the gate's measurements. */
export function drawEmoji(entry) {
  const e = new Drawing(entry.seed);
  entry.draw(e);
  return { parts: e.parts, meta: e.meta };
}
