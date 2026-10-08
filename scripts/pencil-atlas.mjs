/** Static review evidence, using shipped geometry rather than redrawn samples. */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ICONS, GRAPHICS } from "./lib/icon-glyphs.mjs";
import { nicheInk, spineInk, markInk } from "../src/components/platform/cabinet/roomInk.ts";
import { handArcPath } from "../src/components/platform/handArc.ts";
const root = path.resolve(import.meta.dirname, "..");
const tokens = JSON.parse(await fs.readFile(path.join(root, "data/design-tokens/cw.tokens.json"), "utf8"));
const scope = {
  ...tokens.layers.primitives.color,
  ...tokens.layers.semanticAliases,
  ...tokens.layers.modeOverrides.platform,
};
const resolve = (value) => value.replace(/var\((--[\w-]+)\)/g, (_, key) => resolve(scope[key]));
const palette = {
  paper: resolve(scope["--cw-platform-bg"]),
  ink: resolve(scope["--cw-platform-text"]),
  line: resolve(scope["--cw-platform-ink-strong"]),
  surface: resolve(scope["--cw-platform-surface"]),
  dark: tokens.layers.modeOverrides.platformDark["--cw-platform-bg"],
  inverse: tokens.layers.modeOverrides.platformDark["--cw-platform-text"],
};
const out = path.join(root, "docs/design-system/previews/pencil-2026-10-05");
await fs.mkdir(out, { recursive: true });
const beforePath = path.join(out, "before.svg");
try {
  await fs.access(beforePath);
} catch {
  await fs.copyFile("/tmp/cw-pencil-before/cw-icons.svg", beforePath);
}
const roomBeforePath = path.join(out, "before-room.json");
try {
  await fs.access(roomBeforePath);
} catch {
  await fs.copyFile("/tmp/cw-pencil-before/room.json", roomBeforePath);
}
const before = await fs.readFile(beforePath, "utf8");
const after = await fs.readFile(path.join(root, "public/cw/icons/cw-icons.svg"), "utf8");
const beforeRoom = JSON.parse(await fs.readFile(roomBeforePath, "utf8"));
const glyph = (sprite, name, x, y, size = 36) => {
  const match = sprite.match(new RegExp(`<symbol id="cw-${name}"([\\s\\S]*?)<\\/symbol>`));
  if (!match)
    return name === "walker"
      ? `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24"><g transform="translate(1 0)" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4.6" r="2.1"/><path d="M11 6.7v6.6 M7.5 11.6 11 9.4l3.7 2.4 m-3.7 1.5 3.8 3.9.6 4.2 M11 13.3 7.4 18.4 6.2 21.6"/></g></svg>`
      : "";
  const vb = match[1].match(/viewBox="([^"]+)"/)[1];
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}">${match[1].slice(match[1].indexOf(">") + 1)}</svg>`;
};
const rgb = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((part) => parseInt(part, 16));
const mix = (a, b, ratio) =>
  `rgb(${rgb(a)
    .map((v, i) => Math.round(v * ratio + rgb(b)[i] * (1 - ratio)))
    .join(",")})`;
const alpha = (hex, value) => `rgba(${rgb(hex).join(",")},${value})`;
const bookFront = mix(palette.surface, resolve(scope["--cw-sem-warmth"]), 0.94);
const bookTop = `rgb(${rgb(palette.surface)
  .map((v, i) => Math.round(v * 0.72 + Number(bookFront.match(/\d+/g)[i]) * 0.28))
  .join(",")})`;
const innerStroke = tokens.layers.material.light["--cw-mat-stroke-inner"].match(/(#[a-f0-9]{6}) (\d+)%/);
const applyPalette = (content) =>
  content
    .replaceAll("#faefe0", palette.paper)
    .replaceAll("#18261d", palette.ink)
    .replaceAll("#203126", palette.line)
    .replaceAll("#fff8ef", palette.surface)
    .replaceAll("#191918", palette.dark)
    .replaceAll("#e4e4e1", palette.inverse);
const svg = (width, height, body) =>
  applyPalette(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><style>text{font-family:Arial,sans-serif;fill:#18261d}.side{fill:${alpha(innerStroke[1], Number(innerStroke[2]) / 100)}}.top{fill:${bookTop}}.front{fill:${bookFront}}.plate{fill:${alpha(palette.ink, 0.07)};stroke:${alpha(palette.ink, 0.42)};stroke-width:1}.foot{fill:none}.line{fill:none;stroke:${alpha(palette.ink, 0.42)};stroke-width:1;stroke-linecap:round}.pencil{color:${alpha(palette.ink, 0.42)}}</style><rect width="100%" height="100%" fill="#faefe0"/><g color="#203126">${body}</g></svg>`,
  );
const text = (x, y, t, size = 18) => `<text x="${x}" y="${y}" font-size="${size}">${t}</text>`;
const nested = (raw, x, y, width, height) =>
  raw.replace("<svg ", `<svg x="${x}" y="${y}" width="${width}" height="${height}" `).replace(/style="[^"]*"/, "");
let all =
  text(32, 44, "CenterWay · единая карандашная графика", 28) +
  text(32, 75, `${Object.keys(ICONS).length} иконки · общий hand2 · 7 графических примитивов`, 16);
Object.keys(ICONS).forEach((name, i) => {
  const x = 32 + (i % 12) * 96,
    y = 108 + Math.floor(i / 12) * 93;
  all += glyph(after, name, x + 25, y, 42) + text(x + 3, y + 64, name, 11);
});
let y = 800;
all += text(32, y, "Графические примитивы", 22);
Object.keys(GRAPHICS).forEach(
  (name, i) => (all += glyph(after, name, 45 + i * 150, y + 25, 70) + text(38 + i * 150, y + 115, name, 13)),
);
all +=
  '<rect x="0" y="950" width="1200" height="180" fill="#191918"/><g color="#e4e4e1">' +
  Object.keys(GRAPHICS)
    .map((name, i) => glyph(after, name, 45 + i * 150, 986, 70))
    .join("") +
  "</g>";
await sharp(Buffer.from(svg(1200, 1130, all)))
  .png()
  .toFile(path.join(out, "all.png"));
let comparison =
  text(32, 44, "CenterWay · до / после", 28) +
  text(32, 76, "Реальные исходники и сгенерированные формы · одинаковый масштаб", 16) +
  text(90, 120, "ДО", 18) +
  text(650, 120, "ЕДИНЫЙ КАРАНДАШ", 18);
for (const [i, name] of [
  "user",
  "walker",
  "leaf",
  "vata",
  "pitta",
  "kapha",
  "ink-rule",
  "ink-ring",
  "orbit",
  "rail",
].entries()) {
  const x = 70 + (i % 5) * 98,
    y = 148 + Math.floor(i / 5) * 115;
  comparison +=
    glyph(before, name, x, y, 64) +
    glyph(after, name, x + 560, y, 64) +
    text(x, y + 83, name, 12) +
    text(x + 560, y + 83, name, 12);
}
comparison += text(70, 416, "Библиотека: ниша, штриховка, корешки", 19);
comparison += nested(beforeRoom.niche, 70, 444, 380, 231) + nested(nicheInk(2, 280, 170, false), 630, 444, 380, 231);
for (let i = 0; i < 5; i++) {
  comparison +=
    nested(beforeRoom.spine, 155 + i * 43, 525, 36, 145) + nested(spineInk(28, 104), 715 + i * 43, 525, 36, 145);
}
comparison += text(70, 728, "Прогресс: спокойнее линия, сохранены интервалы и счёт", 19);
for (let j = 0; j < 2; j++)
  for (let i = 0; i < 9; i++) {
    const d = handArcPath({
      cx: 180 + j * 560,
      cy: 834,
      radius: 60,
      fromDeg: i * 40 + 4,
      toDeg: (i + 1) * 40 - 4,
      seed: i,
      amplitude: j ? 0.8 : 1.1,
    });
    comparison += `<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>`;
  }
comparison +=
  text(320, 804, "Нажим — в геометрии", 17) +
  text(320, 830, "Без runtime-фильтров", 17) +
  text(320, 856, "И без дрожания текста", 17);
await sharp(Buffer.from(svg(1200, 940, comparison)))
  .png()
  .toFile(path.join(out, "comparison.png"));
const room = { niche: nicheInk(2, 280, 170, false), spine: spineInk(28, 104), attention: markInk(2, 280, 170, false) };
await fs.writeFile(path.join(out, "after-room.json"), JSON.stringify(room, null, 2));
const cards = ["icons-set", "icons-character", "graphics-primitives", "dosha-marks", "icons-contract"];
const brands = ["cw-mark", "cw-mark-compact", "cw-mark-ink", "cw-mark-gold", "cw-wordmark-light", "cw-wordmark-dark"];
const rasters = (await fs.readdir(path.join(root, "public/cw/brand"))).filter((name) => name.endsWith(".png"));
await fs.mkdir(path.join(out, "brand"), { recursive: true });
for (const name of brands)
  await fs.copyFile(path.join(root, `public/cw/brand/${name}.svg`), path.join(out, `brand/${name}.svg`));
for (const name of rasters) await fs.copyFile(path.join(root, "public/cw/brand", name), path.join(out, "brand", name));
await fs.writeFile(
  path.join(out, "index.html"),
  applyPalette(
    `<!doctype html><html lang="ru"><meta charset="utf-8"><title>CenterWay · карандашный каталог</title><style>body{margin:0;padding:32px;background:#faefe0;color:#18261d;font:16px/1.6 system-ui}main{max-width:1200px;margin:auto}img{max-width:100%;display:block}a{color:inherit}iframe{width:100%;height:950px;border:0;margin:20px 0}.brand{display:flex;gap:32px;flex-wrap:wrap}.brand img{width:140px;height:140px;object-fit:contain}.dark{background:#191918;padding:12px}</style><main><h1>CenterWay · единый карандашный стиль</h1><p>Общий рецепт давления: data/brand/cw-pencil.json. Публичный вариант — hand2; base, hand1 и hand3 оставлены для сравнения, не для смешивания в интерфейсе.</p><img src="comparison.png" alt="До и после"><img src="all.png" alt="Полный набор"><h2>Сохранённые версии бренда</h2><div class="brand">${brands.map((name) => `<figure class="${name.includes("dark") ? "dark" : ""}"><img src="brand/${name}.svg" alt="${name}"><figcaption>${name}</figcaption></figure>`).join("")}</div><h2>Экспорты бренда: PWA, Telegram, cover</h2><div class="brand">${rasters.map((name) => `<figure><img src="brand/${name}" alt="${name}"><figcaption>${name}</figcaption></figure>`).join("")}</div><h2>Контур внимания библиотеки · до / после</h2><div class="brand">${beforeRoom.attention}${room.attention}</div><h2>Ниша в тёмной теме</h2><div class="dark" style="color:#e4e4e1;max-width:560px">${nicheInk(2, 280, 170, true)}</div>${cards.map((name) => `<h2><a href="guidelines/${name}.card.html">${name}</a></h2><iframe title="${name}" src="guidelines/${name}.card.html" loading="lazy"></iframe>`).join("")}<p>Фото, официальные знаки сервисов и авторская ветка IREM сохраняют свою функцию. Детальная карта применимости: pencil-unification-2026-10-05.md.</p></main></html>`,
  ),
);
console.log(`Atlas: ${out}`);
