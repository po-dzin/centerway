"use client";

/**
 * The picture a post becomes for a story, 1080×1920 (G 2026-10-21: «сам пост
 * як фокус», the brand once and small, no bare link).
 *
 * - The ground is the post's own photo, blurred and darkened, so the frame
 *   reads as one piece; a post of words alone stands on graphite with a warm glow.
 * - The mark and wordmark, small, at the top: the brand says its name once.
 * - The post itself is the card in the middle: the author's face and name once
 *   (none on the platform's own post — the mark already says it), the photo,
 *   and the words with the author's own line breaks; the opening line is set
 *   heavier, as the shared link's headline.
 * - At the foot a compact «Читати допис» instead of an address. A link inside
 *   a picture is never tappable in Instagram — only the link sticker is, and
 *   the person adds it; the share copies the address for that sticker.
 * - The lowest ~18 % stays empty for that sticker and the app's own controls.
 *
 * Prepared before the share gesture so iOS keeps the activation.
 */

import { feedHeadline } from "@/lib/feed/model";

const W = 1080;
const H = 1920;
const CARD_X = 72;
const CARD_W = W - CARD_X * 2;
const PAD = 52;
const INNER = CARD_W - PAD * 2;
/** Kept clear for the sticker and the app's own controls. */
const SAFE_BOTTOM = 340;

export type StoryInput = {
  author: { name: string; photo: string | null; platform: boolean };
  /** ISO time the post was published. */
  when: string;
  /** The words as a reader sees them, line breaks kept. */
  text: string;
  image: string | null;
};

async function picture(src: string): Promise<HTMLImageElement | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

/** Draw `image` covering the box, cropped from its centre. */
function cover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * A blur every browser draws the same: the photo shrunk to a few dozen pixels
 * and stretched back with smoothing. `ctx.filter` would be simpler, but older
 * Safari ignores it and would ship a sharp, busy ground.
 */
function blurred(image: HTMLImageElement): HTMLCanvasElement {
  const small = document.createElement("canvas");
  small.width = 27;
  small.height = 48;
  const ctx = small.getContext("2d");
  if (ctx) cover(ctx, image, 0, 0, small.width, small.height);
  return small;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

type Line = { text: string; strong: boolean; blank: boolean };

/** The words laid out in lines of `width`: the author's breaks first, then wrapping. */
function layout(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  fonts: { strong: string; body: string },
): Line[] {
  const { title, rest } = feedHeadline(text);
  const lines: Line[] = [];
  const wrap = (paragraph: string, strong: boolean) => {
    ctx.font = strong ? fonts.strong : fonts.body;
    let line = "";
    for (const word of paragraph.split(/[ \t]+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push({ text: line, strong, blank: false });
        line = word;
      } else line = next;
    }
    if (line) lines.push({ text: line, strong, blank: false });
  };
  wrap(title, true);
  for (const paragraph of rest ? rest.split("\n") : []) {
    if (paragraph.trim()) wrap(paragraph.trim(), false);
    else if (lines.length && !lines.at(-1)?.blank) lines.push({ text: "", strong: false, blank: true });
  }
  return lines;
}

export async function storyCard(input: StoryInput): Promise<File> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  // Canvas does not resolve var(): read each token through a probe element.
  const resolved = (token: string) => {
    const element = document.createElement("span");
    element.style.color = `var(${token})`;
    document.body.append(element);
    const value = getComputedStyle(element).color;
    element.remove();
    return value;
  };
  const face = getComputedStyle(document.documentElement).getPropertyValue("--cw-font-ui").trim() || "sans-serif";
  const surface = resolved("--cw-platform-surface");
  const text = resolved("--cw-platform-text");
  const muted = resolved("--cw-platform-muted");
  const gold = resolved("--cw-platform-accent");

  const [photo, avatar, mark, word] = await Promise.all([
    input.image ? picture(input.image) : Promise.resolve(null),
    !input.author.platform && input.author.photo ? picture(input.author.photo) : Promise.resolve(null),
    picture("/cw/brand/cw-mark-gold.svg"),
    picture("/cw/brand/cw-wordmark-light.svg"),
  ]);

  /* ── the ground ── */
  ctx.fillStyle = "#191918";
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blurred(photo), -60, -60, W + 120, H + 120);
    ctx.fillStyle = "rgba(14, 14, 13, 0.5)";
    ctx.fillRect(0, 0, W, H);
  } else {
    const glow = ctx.createRadialGradient(W * 0.8, H * 0.18, 0, W * 0.8, H * 0.18, W);
    glow.addColorStop(0, "rgba(229, 174, 101, 0.26)");
    glow.addColorStop(1, "rgba(229, 174, 101, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── the brand, once ── */
  const lockH = 64;
  const markW = lockH;
  const wordW = lockH * 4.19;
  const lockX = (W - (markW + 18 + wordW)) / 2;
  const lockY = 132;
  if (mark) ctx.drawImage(mark, lockX, lockY, markW, lockH);
  if (word) ctx.drawImage(word, lockX + markW + 18, lockY, wordW, lockH);

  /* ── the post ── */
  const fonts = { strong: `700 46px ${face}`, body: `400 42px ${face}` };
  const lineH = 62;
  const hasByline = !input.author.platform;
  const bylineH = hasByline ? 104 + 36 : 0;
  const photoH = photo ? Math.min(Math.round((INNER * photo.naturalHeight) / photo.naturalWidth), 600) : 0;
  const photoGap = photo ? 40 : 0;
  const pillH = 108;
  const top = lockY + lockH + 72;
  const bottom = H - SAFE_BOTTOM - pillH - 56;
  const room = bottom - top - PAD * 2 - bylineH - photoH - photoGap;
  let lines = layout(ctx, input.text, INNER, fonts);
  const fit = Math.max(3, Math.floor(room / lineH));
  if (lines.length > fit) {
    lines = lines.slice(0, fit);
    while (lines.at(-1)?.blank) lines.pop();
    const last = lines[lines.length - 1];
    if (last) last.text = `${last.text.replace(/[\s,.;:—–-]+$/, "")}…`;
  }
  const cardH = PAD * 2 + bylineH + photoH + photoGap + lines.length * lineH;
  const cardY = Math.round(top + Math.max(0, (bottom - top - cardH) / 2));

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 18;
  roundRect(ctx, CARD_X, cardY, CARD_W, cardH, 56);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.restore();

  let y = cardY + PAD;
  const x = CARD_X + PAD;
  if (hasByline) {
    const size = 104;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (avatar) cover(ctx, avatar, x, y, size, size);
    else {
      ctx.fillStyle = gold;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = "#191918";
      ctx.font = `700 48px ${face}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(input.author.name.trim().charAt(0).toUpperCase(), x + size / 2, y + size / 2 + 2);
    }
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = text;
    ctx.font = `700 44px ${face}`;
    ctx.fillText(input.author.name, x + size + 28, y + 46, INNER - size - 28);
    ctx.fillStyle = muted;
    ctx.font = `400 32px ${face}`;
    const date = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long" }).format(new Date(input.when));
    ctx.fillText(`Стрічка · ${date}`, x + size + 28, y + 92, INNER - size - 28);
    y += bylineH;
  }
  if (photo) {
    ctx.save();
    roundRect(ctx, x, y, INNER, photoH, 34);
    ctx.clip();
    cover(ctx, photo, x, y, INNER, photoH);
    ctx.restore();
    y += photoH + photoGap;
  }
  ctx.fillStyle = text;
  ctx.textBaseline = "alphabetic";
  for (const line of lines) {
    if (!line.blank) {
      ctx.font = line.strong ? fonts.strong : fonts.body;
      ctx.fillText(line.text, x, y + 46, INNER);
    }
    y += lineH;
  }

  /* ── «Читати допис» ── */
  const label = "Читати допис";
  ctx.font = `700 40px ${face}`;
  const icon = 36;
  const pillW = Math.round(ctx.measureText(label).width + icon + 16 + 88);
  const pillX = (W - pillW) / 2;
  const pillY = H - SAFE_BOTTOM - pillH;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.strokeStyle = "#191918";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const ix = pillX + 44;
  const iy = pillY + (pillH - icon) / 2;
  ctx.beginPath();
  ctx.moveTo(ix + 6, iy + icon - 6);
  ctx.lineTo(ix + icon - 6, iy + 6);
  ctx.moveTo(ix + 12, iy + 6);
  ctx.lineTo(ix + icon - 6, iy + 6);
  ctx.lineTo(ix + icon - 6, iy + icon - 12);
  ctx.stroke();
  ctx.fillStyle = "#191918";
  ctx.textBaseline = "middle";
  ctx.fillText(label, ix + icon + 16, pillY + pillH / 2 + 2);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("canvas_failed"))), "image/png"),
  );
  return new File([blob], "centerway-story.png", { type: "image/png" });
}
