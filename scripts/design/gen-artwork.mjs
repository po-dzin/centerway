/**
 * Генерує фонові артворки для прототипу «Бібліотека в глибині»
 * через Vercel AI Gateway.
 *
 *   node scripts/design/gen-artwork.mjs <model> [prompt-keys...]
 *
 * Композиція задана промптом навмисно: текстова колонка живе зліва,
 * ніші справа, тож туш має збиратися внизу і праворуч, а верх-ліворуч
 * лишатися папером. Артворк, який не тримає цю порожнечу, конфліктує
 * з текстом і в макет не годиться.
 */
import fs from "node:fs";
import path from "node:path";

for (const line of fs.readFileSync("/Users/G/Documents/Projects/CenterWay/.env.vercel.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { experimental_generateImage: generateImage } = await import("ai");

const COMMON =
  "Traditional East Asian sumi-e ink wash painting on warm off-white rice paper. " +
  "Monochrome black ink only, absolutely no colour. Wide cinematic horizontal composition. " +
  "The upper-left two thirds of the frame is empty paper — untouched negative space (ma). " +
  "All ink weight sits low and to the right. Soft wet-edge washes, visible brush fibre, " +
  "dry-brush scuffing, subtle paper grain. No text, no calligraphy, no seals, no signature, " +
  "no border or frame, no watermark, no logo, no stock-photo mark, " +
  "no figures, no buildings, no birds.";

const PROMPTS = {
  ranges:
    "Five receding ranges of distant mountains, each plane paler and softer than the one in front, " +
    "valleys filled with mist that eats the bases of the ridges. Serene, immense, far away. " + COMMON,
  rock:
    "A single near cliff face rising from the lower right, its body built from short axe-cut " +
    "texture strokes (fu pi cun), one faint far ridge behind it, the foot of the cliff dissolving " +
    "into low mist. " + COMMON,
  ma:
    "Almost empty. One low distant ridge along the bottom third and three horizontal bands of mist " +
    "above still water. Ninety percent of the paper is left blank. Extreme restraint. " + COMMON,
  water:
    "A still wide lake in the lower third, one low far shore of hills, mist lying flat on the water, " +
    "the faintest second shore beyond. Horizontal calm. " + COMMON,
};

const model = process.argv[2] || "bytedance/seedream-5.0-pro";
const keys = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(PROMPTS);
const outDir = "docs/design-system/prototypes/assets/art";
fs.mkdirSync(outDir, { recursive: true });

const slug = model.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

for (const key of keys) {
  try {
    const res = await generateImage({
      model,
      prompt: PROMPTS[key],
      aspectRatio: "16:9",
      providerOptions: { gateway: { tags: ["feature:ds-prototype", "env:local"] } },
    });
    const img = res.images?.[0] ?? res.image;
    const file = path.join(outDir, `${slug}--${key}.png`);
    fs.writeFileSync(file, Buffer.from(img.uint8Array));
    console.log(`${file}  ${(fs.statSync(file).size / 1024).toFixed(0)} KiB`);
  } catch (e) {
    console.log(`${key}: FAIL ${e.statusCode || ""} ${String(e.message).slice(0, 160)}`);
  }
}
