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

  /* СЕРЕДОВИЩЕ, А НЕ ПЕЙЗАЖ.
     Процедурна маса не тримала матеріалу: лінії лишались лініями, і
     комірки випадали з неї, бо падати їм було нікуди. Тут середовище
     малюється як інтер'єр — стіна з уже вирізаними порожніми нішами,
     у які потім сідають справжні полиці. Тому в промпті ніші ПОРОЖНІ
     і прямокутні: усе, що модель домалює всередину, доведеться
     закривати нашими ж полицями.
     Правий низ — хід углиб: лавка, у якої після входу виявились
     внутрішні ходи в скелю. */
  "room-niches":
    "Interior of a small chamber hewn out of living clay and stone. The right two thirds of the " +
    "frame is a rough rock wall with six or seven EMPTY rectangular alcoves cut into it at " +
    "different depths and sizes, their cut edges chipped and uneven, deep shadow inside each. " +
    "A low arched passage at the bottom right leads further down into darkness. " +
    "Heavy stone mass, visible chisel work, grain of clay. " + COMMON,
  "room-cave":
    "Interior of a cave chamber cut into warm rock. An irregular vault overhead, uneven floor, " +
    "the right half of the wall carrying four EMPTY hewn niches of different size, deep black " +
    "inside them. Beyond, a narrow passage descends into the rock. Mass and weight, " +
    "wet-edge washes for the shadowed rock, dry-brush for the lit faces. " + COMMON,
  "room-shelf":
    "Interior wall of a rock-cut library. A tall face of clay-stone on the right two thirds with " +
    "EMPTY carved shelf openings in an irregular grid, no books, deep shadow in every opening, " +
    "chipped stone lips. A low descending arch at the bottom. " + COMMON,
  /* ФРОНТАЛЬНА СТІНА — МАТЕРІАЛ, А НЕ СЦЕНА.
     Намальована кімната має власну перспективу, і комірки в ній
     статичні: гнізда з малюнка не множаться разом із каталогом. Тому
     середовище повертається до ролі, у якій воно масштабується, —
     до фактури. Стіна знята строго в лоб, без сходу ліній і без
     готових ніш: отвори в неї ріже вже розкладка, і їх рівно стільки,
     скільки розділів. Від моделі потрібен матеріал: маса, сколи,
     тріщини, слід інструмента. */
  "wall-clay":
    "A flat wall of warm rammed clay photographed straight on, perfectly frontal, no perspective, " +
    "no vanishing point, no corners, no floor and no ceiling in frame — only the surface itself, " +
    "edge to edge. Uneven hand-smoothed plaster with trowel marks, hairline cracks, small chips " +
    "and pits, patches where the clay dried lighter. No openings, no niches, no holes, no objects. " + COMMON,
  "wall-rock":
    "A flat face of cut sandstone photographed straight on, perfectly frontal, no perspective, " +
    "no vanishing point, no corners, no floor and no ceiling in frame — only the surface, edge to " +
    "edge. Visible chisel courses, shallow fractures, flaked scars, grain and pitting, weathered " +
    "unevenly. No openings, no niches, no holes, no objects. " + COMMON,
  "wall-plaster":
    "A flat lime-plastered wall photographed straight on, perfectly frontal, no perspective, " +
    "no corners, no floor, no ceiling — only the surface, edge to edge. Quiet, almost bare: " +
    "faint tide marks of damp, a few hairline cracks, one flaked patch, otherwise still. " +
    "Extreme restraint. No openings, no niches, no objects. " + COMMON,

  "room-passage":
    "Standing inside a hewn stone room looking at its far wall. The wall carries three EMPTY " +
    "carved recesses and, at its foot, an arched opening going down into a darker level. " +
    "The vault and side walls of the near room frame the view from the top and right. " + COMMON,
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
