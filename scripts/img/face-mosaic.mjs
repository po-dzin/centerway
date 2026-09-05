#!/usr/bin/env node
/**
 * Face mosaic — the participant photographs are evidence, not portraits.
 *
 * WHY THIS EXISTS. The before/after rail publishes photographs of real people
 * who agreed to have their RESULT shown. A recognisable face is a second thing
 * entirely, and it is the thing that turns a proof rail into a question: who is
 * she, did she really agree to this, what happens when a colleague scrolls past.
 * The consent line under the rail cannot answer any of that after the fact. So
 * the face is removed from the file that ships, not hidden by a CSS overlay —
 * an overlay still downloads the face, which is not censorship, it is a
 * curtain.
 *
 * WHY A MOSAIC AND NOT A BLUR OR A BAR. A blur at web sizes is reversible
 * enough to be an argument, and a solid bar reads as a redaction — the visual
 * language of something being hidden FROM you. A coarse mosaic reads as
 * anonymity: the person is present, the identity is not. Eight blocks across
 * the face at every size, so the same intent survives a 279px rail card and a
 * full-size open.
 *
 * WHY THE BOXES ARE FRACTIONS. A pixel box silently points at the wrong part of
 * the picture the first time somebody re-crops or re-exports a source. The
 * manifest is in fractions of the frame, so it survives a resize and fails
 * loudly (a mosaic in the wrong place is visible) rather than quietly.
 *
 * NOT LISTED HERE, AND ON PURPOSE:
 *   · ba-2026-06-back.webp — both figures are photographed from behind. There
 *     is no face in it, and mosaicking the back of a head is noise that implies
 *     something was hidden.
 *   · video-*.webp — posters for video testimonials. The person chose to speak
 *     on camera and the linked video shows her face for its whole length;
 *     pixelating the thumbnail in front of it is theatre, not privacy.
 *   · screenshot_*.webp — messages, not photographs. What identifies a person
 *     there is the NAME in the chat header, which a face mosaic does not touch.
 *     That is a separate decision about a different exposure.
 *
 * The operation is visually idempotent: the grid is derived from the box, so a
 * second run averages already-equal pixels and lands on the same mosaic. It
 * still re-encodes, so do not run it in a loop for no reason.
 *
 * Usage:
 *   node scripts/img/face-mosaic.mjs           # write the mosaics in place
 *   node scripts/img/face-mosaic.mjs --check   # report, change nothing
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const feedbackDir = path.join(repoRoot, "src/landing-static/shared/img/feedback");
const check = process.argv.includes("--check");

/* How many mosaic blocks span the width of a face. The number is the whole
   design decision: too few and the block edges stop reading as a face at all,
   too many and the features come back. Eight is a face-shaped smudge. */
const BLOCKS_ACROSS = 8;

/* Every box is [x, y, w, h] as a FRACTION of the frame, measured on the source
   and verified by cropping it out and looking at it. Faces are listed one per
   entry — a frame with two people gets two boxes. */
const MANIFEST = [
  {
    file: "ba-2021-before.webp",
    note: "outdoors, white sweater — the participant is the left figure; the man beside her is cropped at the frame edge and shows no face",
    faces: [[0.4558, 0.116, 0.3204, 0.1975]],
  },
  {
    file: "ba-2021-after.webp",
    note: "indoors, blue dress",
    faces: [[0.2679, 0.0518, 0.2179, 0.15]],
  },
  {
    file: "ba-2026-06-studio-before.webp",
    note: "portrait crop, black t-shirt — the face fills much of the frame, so the box is correspondingly large",
    faces: [[0.0946, 0.0743, 0.4595, 0.3108]],
  },
  {
    file: "ba-2026-06-studio-after.webp",
    note: "studio mirror selfie; the phone already covers the mouth, the box covers the rest",
    faces: [[0.2725, 0.045, 0.2225, 0.1413]],
  },
];

function run(cmd, args) {
  return execFileSync(cmd, args, { encoding: "buffer", stdio: ["ignore", "pipe", "pipe"] });
}

function probeSize(file) {
  const out = run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=p=0:s=x",
    file,
  ]).toString().trim();
  const [width, height] = out.split("x").map(Number);
  if (!width || !height) throw new Error(`could not read dimensions of ${file}`);
  return { width, height };
}

/* Even sides. An odd crop width with a neighbour downscale lands the grid half
   a pixel off and the mosaic gets a soft edge on one side only, which reads as
   a rendering mistake rather than a decision. */
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

function boxToPixels([fx, fy, fw, fh], { width, height }) {
  const w = even(fw * width);
  const h = even(fh * height);
  const x = Math.min(Math.max(0, Math.round(fx * width)), width - w);
  const y = Math.min(Math.max(0, Math.round(fy * height)), height - h);
  return { x, y, w, h };
}

function buildFilter(boxes) {
  /* One chain per face, each overlaid on the result of the previous, so a frame
     with two people needs no second pass over the file. */
  const parts = [];
  let base = "0:v";
  boxes.forEach((box, index) => {
    const block = Math.max(4, Math.round(box.w / BLOCKS_ACROSS));
    const sw = Math.max(1, Math.round(box.w / block));
    const sh = Math.max(1, Math.round(box.h / block));
    const cropped = `c${index}`;
    const out = index === boxes.length - 1 ? "" : `[b${index}]`;
    parts.push(
      `[0:v]crop=${box.w}:${box.h}:${box.x}:${box.y},` +
        `scale=${sw}:${sh}:flags=neighbor,scale=${box.w}:${box.h}:flags=neighbor[${cropped}]`
    );
    parts.push(`[${base}][${cropped}]overlay=${box.x}:${box.y}${out}`);
    base = `b${index}`;
  });
  return parts.join(";");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "face-mosaic-"));
let changed = 0;
let failed = 0;

for (const entry of MANIFEST) {
  const file = path.join(feedbackDir, entry.file);
  if (!fs.existsSync(file)) {
    console.error(`[FAIL] missing source: ${entry.file}`);
    failed += 1;
    continue;
  }

  const size = probeSize(file);
  const boxes = entry.faces.map((face) => boxToPixels(face, size));
  const summary = boxes
    .map((b) => `${b.w}x${b.h}+${b.x}+${b.y} (block ${Math.max(4, Math.round(b.w / BLOCKS_ACROSS))}px)`)
    .join(", ");

  if (check) {
    console.log(`[plan] ${entry.file} ${size.width}x${size.height} → ${summary}`);
    continue;
  }

  const flat = path.join(tmp, `${entry.file}.png`);
  const encoded = path.join(tmp, `${entry.file}.enc.webp`);
  const icc = path.join(tmp, `${entry.file}.icc`);

  /* The ICC profile is lifted off the source and put back on the output. This
     project has already paid for an untagged webp once: an untagged file is
     read as the display's own space, and on a P3 screen the photograph came
     back a different white from the card behind it. Losing the tag here would
     be that bug again, arriving through a privacy change. */
  let hasIcc = false;
  try {
    run("webpmux", ["-get", "icc", file, "-o", icc]);
    hasIcc = fs.existsSync(icc) && fs.statSync(icc).size > 0;
  } catch {
    hasIcc = false;
  }

  run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-filter_complex", buildFilter(boxes), flat]);
  /* EXIF is dropped rather than carried over: a participant's photograph can
     arrive with a capture date, a device and sometimes a location on it, and
     none of that belongs on a public page for the same reason the face does
     not. `-metadata none` is the whole of that decision. */
  /* q80, not the encoder's default 75 and not the 90 this first shipped at.
     A mosaic is the worst case for a webp: hard block edges are exactly what
     the transform spends bits on, so encoding these at 90 put 15-22% back onto
     four photographs on a landing page — the rail card renders them at ~279px
     and would never have shown the difference. 80 lands within a few percent
     of the untouched originals at the size they are actually looked at. */
  run("cwebp", ["-quiet", "-q", "80", "-metadata", "none", flat, "-o", encoded]);

  if (hasIcc) {
    run("webpmux", ["-set", "icc", icc, encoded, "-o", file]);
  } else {
    fs.copyFileSync(encoded, file);
  }

  const after = fs.statSync(file).size;
  console.log(`[ok] ${entry.file} → ${summary}  ${(after / 1024).toFixed(1)} KiB${hasIcc ? " · sRGB kept" : ""}`);
  changed += 1;
}

fs.rmSync(tmp, { recursive: true, force: true });

if (failed > 0) {
  console.error(`\n[FAIL] face mosaic — ${failed} source(s) missing`);
  process.exit(1);
}
console.log(check ? `\n[plan] ${MANIFEST.length} photograph(s)` : `\n[ok] face mosaic — ${changed} photograph(s)`);
