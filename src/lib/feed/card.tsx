/**
 * The picture under a shared link to a post, 1200×630 (`/api/feed/:id/card`).
 *
 * G 2026-10-21: «сам пост как фокус», the brand once and small. With a photo
 * (or the video's frame) the picture is the post's own, full bleed, the mark
 * and wordmark in its corner and the author's face and name at the foot. A
 * post of words alone shows its opening, as the author wrote it, on the
 * platform's paper. The platform's own post carries no byline: the mark
 * already says who it is.
 *
 * Drawn on request by `next/og`, which reads no woff2: the fonts in
 * `src/lib/feed/og-fonts` are the platform's Manrope and
 * Cormorant cut to TTF. Photos are re-encoded to JPEG first, since the feed
 * stores WebP and the renderer cannot be trusted with it.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import sharp from "sharp";

import { FEED_CARD_SIZE, feedHeadline, feedShareImage, isPlatformAuthor } from "./model";
import { feedPlainText } from "./format";
import type { FeedPost } from "./server";

const ROOT = process.cwd();
const FONTS = join(ROOT, "src/lib/feed/og-fonts");
const BRAND = join(ROOT, "public/cw/brand");

/* Each subset is its own family: the renderer keeps one font per name and weight. */
const UI = "Manrope, Manrope Cyrillic";
const EDITORIAL = "Cormorant, Cormorant Cyrillic";

const GOLD = "#e5ae65";
const INK = "#203126";
const PAPER = "#fff8ef";
const TEXT = "#18261d";
const MUTED = "#48544c";

type Font = { name: string; data: Buffer; weight: 500 | 700; style: "normal" };

let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    [
      ["Manrope", "manrope-latin-700", 700],
      ["Manrope Cyrillic", "manrope-cyrillic-700", 700],
      ["Manrope", "manrope-latin-500", 500],
      ["Manrope Cyrillic", "manrope-cyrillic-500", 500],
      ["Cormorant", "cormorant-latin-500", 500],
      ["Cormorant Cyrillic", "cormorant-cyrillic-500", 500],
    ].map(async ([name, file, weight]) => ({
      name: name as string,
      data: await readFile(join(FONTS, `${file}.ttf`)),
      weight: weight as 500 | 700,
      style: "normal" as const,
    })),
  );
  return fonts;
}

/**
 * The card's quote without emoji: the renderer has no emoji font and would
 * have to fetch one from a CDN on every request, failing the whole card when
 * it cannot. The link's own headline above the picture keeps them.
 */
function withoutEmoji(text: string): string {
  return text
    .replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The brand file painted in one colour, as a data URI the renderer can draw. */
async function brandSvg(file: string, color: string): Promise<string> {
  const svg = (await readFile(join(BRAND, file), "utf8")).replace(/fill="#(?:000|E5AE65|203126)"/gi, `fill="${color}"`);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** A remote or site picture as a JPEG data URI no wider than `width`, or null. */
async function jpeg(src: string, origin: string, width: number): Promise<string | null> {
  try {
    const response = await fetch(new URL(src, origin), { signal: AbortSignal.timeout(6000) });
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    const output = await sharp(input)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${output.toString("base64")}`;
  } catch {
    return null;
  }
}

function Lockup({ mark, word, height }: { mark: string; word: string; height: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: height * 0.3 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img */}
      <img src={mark} width={height} height={height} alt="" />
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img */}
      <img src={word} width={height * 4.19} height={height} alt="" />
    </div>
  );
}

/** The share card of a published post; `origin` resolves the site's own picture paths. */
export async function feedCardResponse(post: FeedPost, origin: string): Promise<ImageResponse> {
  const picture = feedShareImage(post);
  const platform = isPlatformAuthor(post.author);
  const [loaded, photo, face] = await Promise.all([
    loadFonts(),
    picture ? jpeg(picture.url, origin, FEED_CARD_SIZE.width) : Promise.resolve(null),
    !platform && post.author.photo ? jpeg(post.author.photo.src, origin, 192) : Promise.resolve(null),
  ]);
  const onPhoto = photo !== null;
  const [mark, word] = await Promise.all([
    brandSvg("cw-mark.svg", onPhoto ? GOLD : INK),
    brandSvg(onPhoto ? "cw-wordmark-light.svg" : "cw-wordmark-dark.svg", onPhoto ? GOLD : INK),
  ]);
  const crop = post.author.photo;
  const facePosition = `${crop?.avatarCropX ?? crop?.cropX ?? 50}% ${crop?.avatarCropY ?? crop?.cropY ?? 50}%`;

  const byline = platform ? null : (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      {face ? (
        // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img
        <img
          src={face}
          width={76}
          height={76}
          alt=""
          style={{
            borderRadius: 38,
            objectFit: "cover",
            objectPosition: facePosition,
            boxShadow: onPhoto ? "0 0 0 3px rgba(255,248,239,0.5)" : "none",
          }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
        <span style={{ fontWeight: 700, fontSize: 34, color: onPhoto ? PAPER : TEXT }}>{post.author.name}</span>
        <span style={{ fontWeight: 500, fontSize: 25, color: onPhoto ? "rgba(255,248,239,0.78)" : MUTED }}>
          у Стрічці
        </span>
      </div>
    </div>
  );

  const body = onPhoto ? (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#191918",
        fontFamily: UI,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img */}
      <img
        src={photo}
        width={FEED_CARD_SIZE.width}
        height={FEED_CARD_SIZE.height}
        alt=""
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundImage:
            "linear-gradient(0deg, rgba(14,14,13,0.78) 0%, rgba(14,14,13,0.18) 46%, rgba(14,14,13,0) 70%, rgba(14,14,13,0) 74%, rgba(14,14,13,0.6) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 50px",
        }}
      >
        <Lockup mark={mark} word={word} height={44} />
        {byline ?? <div style={{ display: "flex" }} />}
      </div>
    </div>
  ) : (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "48px 50px",
        fontFamily: UI,
        backgroundColor: PAPER,
        backgroundImage: "radial-gradient(circle at 88% 12%, rgba(229,174,101,0.28), rgba(229,174,101,0) 55%)",
      }}
    >
      <Lockup mark={mark} word={word} height={44} />
      <div
        style={{
          display: "flex",
          fontFamily: EDITORIAL,
          fontWeight: 500,
          fontSize: 68,
          lineHeight: 1.08,
          color: TEXT,
          maxWidth: 1000,
          maxHeight: 68 * 1.08 * 3,
          overflow: "hidden",
        }}
      >
        {withoutEmoji(feedHeadline(feedPlainText(post.body)).title)}
      </div>
      {byline ?? <div style={{ display: "flex" }} />}
    </div>
  );

  return new ImageResponse(body, {
    ...FEED_CARD_SIZE,
    fonts: loaded,
    headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
