#!/usr/bin/env node
/**
 * Grade "CenterWay v1" — the single finishing pass for every image that enters
 * the project, generated or shot. Verified in
 * docs/archive/working-notes/ds-visual-language-research-2026-08-15.md.
 *
 * The recipe is matte and warm on purpose: lifted blacks (linear 0.93/14) are
 * what make the photography sit with the matte-glass material instead of
 * fighting it.
 *
 * PIPELINE BUG THIS SCRIPT EXISTS TO PREVENT: sharp's withIccProfile('srgb')
 * does NOT survive webp encoding. Untagged webp is read as P3 on iOS, which is
 * exactly the barely-visible colour seam the project has hit before. So every
 * webp gets `webpmux -set icc` as a mandatory final step, and the result is
 * verified with `webpmux -get icc` before the file is accepted.
 *
 * Usage:
 *   node scripts/img/grade.mjs in.png --out public/cw/img/backdrop/foo.webp
 *   node scripts/img/grade.mjs in.png --out … --profile practice --width 1600
 *   node scripts/img/grade.mjs in.png --out … --avif        # also emit .avif
 */

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

const ICC_SRGB = "/System/Library/ColorSync/Profiles/sRGB Profile.icc";

/**
 * `practice` drops saturation further — frames with skin and greenery go garish
 * at the default, which is what the archive audit found.
 */
export const GRADE_PROFILES = {
  default: { saturation: 0.8, brightness: 1.03 },
  practice: { saturation: 0.68, brightness: 1.03 },
};

const WARM_RECOMB = [
  [1.045, 0.005, -0.02],
  [0, 1, 0],
  [-0.03, 0.01, 0.955],
];

/**
 * Applies the grade and encodes. Returns the paths written.
 * `width` resizes the long edge; omit to keep the source size.
 */
export async function gradeImage(input, { out, profile = "default", width, avif = false, jpeg = false, quality = 82 }) {
  const grade = GRADE_PROFILES[profile];
  if (!grade) throw new Error(`unknown grade profile "${profile}"`);

  let pipeline = sharp(input).toColorspace("srgb").modulate(grade).recomb(WARM_RECOMB).linear(0.93, 14).gamma(1.02);
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });

  await fs.mkdir(path.dirname(out), { recursive: true });
  await pipeline.clone().webp({ quality, effort: 5 }).toFile(out);
  await tagSrgb(out);

  const written = [out];
  if (jpeg) {
    // og:image stays JPEG on purpose: link-preview crawlers are the one place
    // where webp support is still uneven, and a broken preview is invisible to us.
    const jpegOut = out.replace(/\.webp$/, ".jpg");
    await pipeline.clone().jpeg({ quality, mozjpeg: true }).withIccProfile("srgb").toFile(jpegOut);
    written.push(jpegOut);
  }
  if (avif) {
    const avifOut = out.replace(/\.webp$/, ".avif");
    // avif carries the profile through sharp correctly — only webp is broken.
    await pipeline.clone().avif({ quality: quality - 4, effort: 5 }).withIccProfile("srgb").toFile(avifOut);
    written.push(avifOut);
  }
  return written;
}

/** Injects the sRGB profile into a webp and verifies it stuck. */
export async function tagSrgb(file) {
  const tmp = `${file}.icc.webp`;
  await run("webpmux", ["-set", "icc", ICC_SRGB, file, "-o", tmp]);
  await fs.rename(tmp, file);

  const { stdout } = await run("webpmux", ["-get", "icc", file, "-o", `${file}.probe.icc`]).catch((error) => ({
    stdout: String(error),
  }));
  const probe = `${file}.probe.icc`;
  const size = await fs
    .stat(probe)
    .then((s) => s.size)
    .catch(() => 0);
  await fs.rm(probe, { force: true });
  if (!size) {
    throw new Error(`ICC injection failed for ${file} — webpmux -get icc returned nothing (${stdout.trim()})`);
  }
}

function parseArgs(argv) {
  const args = { input: null, out: null, profile: "default", width: null, avif: false, jpeg: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") args.out = argv[++i];
    else if (arg === "--profile") args.profile = argv[++i];
    else if (arg === "--width") args.width = Number(argv[++i]);
    else if (arg === "--avif") args.avif = true;
    else if (arg === "--jpeg") args.jpeg = true;
    else if (!args.input) args.input = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  if (!args.input || !args.out) throw new Error("usage: grade.mjs <input> --out <file.webp> [--profile p] [--width n] [--avif]");
  if (!args.out.endsWith(".webp")) throw new Error("--out must be a .webp path");
  return args;
}

if (import.meta.filename === process.argv[1]) {
  const args = parseArgs(process.argv);
  const written = await gradeImage(args.input, args);
  for (const file of written) console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
