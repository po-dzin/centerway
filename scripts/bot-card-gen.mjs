#!/usr/bin/env node
/**
 * Generates the photographic bot cards through Vercel AI Gateway.
 *
 * The menu cards were made by hand in an image model; these two continue that
 * series, so the existing «Мої курси» card goes in as the style reference and
 * every prompt ends in the same STYLE paragraph. Output lands as `*-draft.png`
 * — a generation is a proposal, and a person renames the one worth keeping to
 * `-vN.png`, which is the name the code points at.
 *
 * Costs credits (~$0.07 per image on the model below at the time of writing).
 *
 * Usage:
 *   vercel env pull <file> && set -a && . <file> && set +a
 *   node scripts/bot-card-gen.mjs
 */

import sharp from "sharp";
const OUT = "public/cw/bot/final";
const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
if (!token) throw new Error("bot-card-gen: set AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN (vercel env pull)");
const ref = await sharp("public/cw/bot/final/menu-courses-printed-stamp-v5.png")
  .resize(768)
  .jpeg({ quality: 85 })
  .toBuffer();
const refUrl = `data:image/jpeg;base64,${ref.toString("base64")}`;
const STYLE =
  "Match the reference image exactly in style: top-down flat-lay product photograph on the same warm pale limestone plaster surface, soft diffused natural daylight from the upper left with gentle long shadows, muted palette of cream paper, olive and deep forest green linen, natural stone, unglazed ceramic. Calm, premium, wellness-clinic mood, lots of empty space, no people, no hands, no text, no letters, no numbers, no logos except one small printed ink stamp of the reference's concentric-arcs mark where noted. Square 1:1.";
const jobs = {
  "reminder-course-waiting": `A closed deep forest-green linen hardcover notebook lying slightly angled right of center, a thin olive silk ribbon bookmark trailing out of it across the surface in a loose curve, a small faded ink stamp of the concentric-arcs mark in the lower corner of the cover. Beside it a small unglazed ceramic cup of pale herbal tea, a single smooth river stone, a sprig of olive leaves. The feeling: something prepared and waiting for you, no rush. ${STYLE}`,
  "reminder-lesson-ready": `An open cream notebook with blank pages in the center, a forest-green silk ribbon marking today's page, a natural wooden pencil resting across the lower page, a small steaming unglazed ceramic cup of herbal tea at the upper right with a soft wisp of steam, soft window-light shadow falling diagonally across the surface, a tiny faded ink stamp of the concentric-arcs mark in the lower corner of the right page. The feeling: today's short practice is ready, a quiet morning. ${STYLE}`,
};
for (const [name, prompt] of Object.entries(jobs)) {
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-image",
      modalities: ["image", "text"],
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Reference image for style (do not copy its objects):" },
            { type: "image_url", image_url: { url: refUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.log(name, res.status, JSON.stringify(json).slice(0, 400));
    continue;
  }
  const img = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!img) {
    console.log(name, "no image", JSON.stringify(json).slice(0, 400));
    continue;
  }
  const buf = Buffer.from(img.split(",")[1], "base64");
  await sharp(buf).withIccProfile("srgb").png({ compressionLevel: 9 }).toFile(`${OUT}/${name}-draft.png`);
  const meta = await sharp(buf).metadata();
  console.log(name, meta.width + "x" + meta.height, JSON.stringify(json.usage), json.model);
}
