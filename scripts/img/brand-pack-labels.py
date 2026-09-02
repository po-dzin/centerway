#!/usr/bin/env python3.12
"""Prints the CenterWay label onto the blank kraft pouches in the way21 photos.

WHY. The Шлях 21 phase cards were carrying stock-looking plates: a blank kraft
doypack next to some herbs. A blank bag says "a bag"; the page needs it to say
"Збір №1, the pouch this program ships". Rather than re-shoot, the label the
pack would actually wear is printed onto the existing plates.

WHAT IT DRAWS. The mark (F2, baked from data/brand via cw-mark-ink.svg), the
wordmark in IBM Plex Mono, the blend number in Cormorant Garamond and the
program line in mono — the same three faces and the same way21 palette
(network-tokens.css) the landing itself uses, so the pack belongs to the page
instead of merely appearing on it.

HOW IT LANDS. Each photo names the pouch's front face as a quad; the label is
perspective-warped into a box inside it, then relit by the photo's own pixels:
per-channel shading normalised against the region mean, with `cast` keeping
part of the scene's warm light in the paper instead of flattening it to
neutral. A blurred alpha under the sticker does the contact shadow, grain
matches the plate's noise. Without that relight the label reads as a rectangle
pasted on a photo, which is exactly what it must not read as.

The unbranded plates stay in the tree: they are this script's input, and
re-running it is the only way to change a label.

Fonts come from the landing's own woff2 subsets, which are split by
unicode-range — Latin and Cyrillic live in separate files — so each family is
merged back into one static TTF in a temp dir before use.

    python3.12 scripts/img/brand-pack-labels.py [--check]

Needs pillow, numpy, fonttools, brotli.
"""
import re
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[2]
SHARED = ROOT / "src/landing-static/shared"
HERBS = SHARED / "img/herbs"
MARK = SHARED / "img/cw-mark-ink.svg"
FONT_DIR = SHARED / "fonts/platform"
QUALITY = 80  # scripts/img/landing-webp.mjs

# way21 skin, network-tokens.css
INK = (29, 58, 48)
INK_SOFT = (69, 100, 88)
GOLD = (186, 141, 72)
PAPER = (238, 228, 206)
KEYLINE = (203, 195, 176)

GLYPHS = "ЗБІР №1 CENTERWAY"  # a subset must cover these to be worth merging


# ---------------------------------------------------------------- fonts

def build_fonts(out_dir):
    """Merge the unicode-range subsets back into one TTF per family."""
    # keyed by full name, style included: the Plex subsets ship three weights
    # side by side, and merging them together would collide glyph for glyph
    faces = {}
    for path in sorted(FONT_DIR.glob("*.woff2")):
        faces.setdefault(TTFont(path)["name"].getDebugName(4), []).append(path)

    def pick(face, weight):
        parts = []
        with tempfile.TemporaryDirectory() as tmp:
            for i, path in enumerate(faces[face]):
                font = TTFont(path)
                cmap = set(font.getBestCmap())
                if not any(ord(c) in cmap for c in GLYPHS if c != " "):
                    continue
                if "fvar" in font and weight:
                    font = instantiateVariableFont(font, {"wght": weight}, inplace=True)
                font.flavor = None
                part = Path(tmp) / f"{i}.ttf"
                font.save(part)
                parts.append(str(part))
            target = out_dir / f"{face.replace(' ', '-').lower()}.ttf"
            if len(parts) > 1:
                Merger().merge(parts).save(target)
            else:
                target.write_bytes(Path(parts[0]).read_bytes())
        return target

    # the variable faces report their default instance in the name table, hence
    # "Light" / "ExtraLight"; `weight` is the instance actually cut from them
    return {
        "display": pick("Cormorant Garamond Light", 600),
        "mono": pick("IBM Plex Mono Medium", None),
        "ui": pick("Manrope ExtraLight", 600),
    }


# ---------------------------------------------------------------- mark

def load_mark(size, ss=4):
    """Rasterise the baked mark: M/L strokes, even-odd for holes, then the
    core dot on top — it is a <circle>, not a path, and unioned, not XORed."""
    src = MARK.read_text()
    vx, vy, vw, vh = map(float, re.search(r'viewBox="([\d.\- ]+)"', src).group(1).split())
    n = size * ss
    acc = Image.new("L", (n, n), 0)
    for d in re.findall(r'<path[^>]*\sd="([^"]+)"', src):
        for sub in (s for s in d.replace("Z", "").split("M") if s.strip()):
            pts = [((float(x) - vx) / vw * n, (float(y) - vy) / vh * n)
                   for x, y in re.findall(r"(-?[\d.]+)\s+(-?[\d.]+)", sub.replace("L", " "))]
            if len(pts) < 3:
                continue
            layer = Image.new("L", (n, n), 0)
            ImageDraw.Draw(layer).polygon(pts, fill=255)
            acc = Image.frombytes("L", acc.size,
                                  bytes(a ^ b for a, b in zip(acc.tobytes(), layer.tobytes())))
    draw = ImageDraw.Draw(acc)
    for cx, cy, r in re.findall(
            r'<circle[^>]*\scx="([\d.]+)"[^>]*\scy="([\d.]+)"[^>]*\sr="([\d.]+)"', src):
        x = (float(cx) - vx) / vw * n
        y = (float(cy) - vy) / vh * n
        rr = float(r) / vw * n
        draw.ellipse([x - rr, y - rr, x + rr, y + rr], fill=255)
    return acc.resize((size, size), Image.LANCZOS)


# ---------------------------------------------------------------- label

def fit_font(draw, text, path, size, max_w, track_ratio):
    """Shrink until the letterspaced run fits. Returns (font, tracking)."""
    while size > 6:
        font = ImageFont.truetype(str(path), size)
        track = size * track_ratio
        width = sum(draw.textlength(c, font=font) for c in text) + track * (len(text) - 1)
        if width <= max_w:
            return font, track
        size -= 1
    return ImageFont.truetype(str(path), 6), 0


def tracked(draw, xy, text, font, fill, track):
    widths = [draw.textlength(c, font=font) for c in text]
    x = xy[0] - (sum(widths) + track * (len(text) - 1)) / 2
    for char, width in zip(text, widths):
        draw.text((x, xy[1]), char, font=font, fill=fill, anchor="lm")
        x += width + track


def make_label(fonts, w, h, title, sub, foot, ss=3):
    W, H = w * ss, h * ss
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    radius, line = int(W * 0.035), max(1, ss)
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=radius, fill=PAPER + (255,))
    d.rounded_rectangle([0, 0, W - 1, H - 1], radius=radius, outline=KEYLINE + (255,), width=line)

    mark_px = int(W * 0.22)
    im.paste(INK, (int((W - mark_px) / 2), int(H * 0.085)), load_mark(mark_px))

    inner = W * 0.78
    f_brand, t_brand = fit_font(d, "CENTERWAY", fonts["mono"], int(W * 0.060), inner, 0.30)
    f_title, t_title = fit_font(d, title, fonts["display"], int(W * 0.175), inner, 0.012)
    f_sub, t_sub = fit_font(d, sub, fonts["ui"], int(W * 0.080), inner, 0.02)
    f_foot, t_foot = fit_font(d, foot, fonts["mono"], int(W * 0.050), inner, 0.22)

    tracked(d, (W / 2, H * 0.345), "CENTERWAY", f_brand, INK_SOFT, t_brand)
    d.line([(W * 0.34, H * 0.415), (W * 0.66, H * 0.415)], fill=GOLD, width=line)
    tracked(d, (W / 2, H * 0.545), title, f_title, INK, t_title)
    tracked(d, (W / 2, H * 0.685), sub, f_sub, INK_SOFT, t_sub)
    d.line([(W * 0.20, H * 0.775), (W * 0.80, H * 0.775)], fill=KEYLINE + (255,), width=line)
    tracked(d, (W / 2, H * 0.860), foot, f_foot, INK_SOFT, t_foot)
    return im.resize((w, h), Image.LANCZOS)


# ---------------------------------------------------------------- placing

def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def bilerp(quad, u, v):
    tl, tr, br, bl = quad
    top = (tl[0] + (tr[0] - tl[0]) * u, tl[1] + (tr[1] - tl[1]) * u)
    bot = (bl[0] + (br[0] - bl[0]) * u, bl[1] + (br[1] - bl[1]) * u)
    return (top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v)


def warp(label, quad, size, ss=2):
    """Perspective-place the label so its corners land on `quad`."""
    W, H = size
    lw, lh = label.size
    rows, rhs = [], []
    for (dx, dy), (sx, sy) in zip([(p[0] * ss, p[1] * ss) for p in quad],
                                  [(0, 0), (lw, 0), (lw, lh), (0, lh)]):
        rows += [[dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy],
                 [0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]]
        rhs += [sx, sy]
    coeffs = np.linalg.solve(np.array(rows, float), np.array(rhs, float))
    big = label.transform((W * ss, H * ss), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    return big.resize((W, H), Image.LANCZOS)


def brand(fonts, src, quad, box, title, sub, foot, blur=0.6, strength=0.96,
          paper_gain=0.92, shadow=0.30, grain=1.6, cast=0.5):
    photo = Image.open(src)
    icc = photo.info.get("icc_profile")
    photo = photo.convert("RGB")
    W, H = photo.size

    u0, v0, u1, v1 = box
    corners = [bilerp(quad, u0, v0), bilerp(quad, u1, v0),
               bilerp(quad, u1, v1), bilerp(quad, u0, v1)]
    lw = int(dist(corners[0], corners[1]) * 1.8)  # render above native size
    lh = int(lw * dist(corners[1], corners[2]) / dist(corners[0], corners[1]))
    warped = warp(make_label(fonts, lw, lh, title, sub, foot), corners, (W, H))
    if blur:
        warped = warped.filter(ImageFilter.GaussianBlur(blur))

    base = np.asarray(photo, np.float32)
    lab = np.asarray(warped, np.float32)
    alpha = (lab[:, :, 3:4] / 255.0) * strength
    inside = alpha[:, :, 0] > 0.02

    if shadow:  # the sticker sits on the bag, so it darkens its own edge
        sh = np.asarray(warped.split()[3].filter(
            ImageFilter.GaussianBlur(max(2.0, lw * 0.012))), np.float32)[:, :, None] / 255.0
        base = base * (1 - sh * shadow * (1 - alpha / max(strength, 1e-3)))

    mean = base[inside].mean(axis=0)
    luma = float(mean @ np.array([0.299, 0.587, 0.114], np.float32))
    # cast=0 prints the paper neutral; cast=1 gives it the scene's full colour
    denom = np.maximum(mean, 1e-3) ** (1 - cast) * luma ** cast
    printed = lab[:, :, :3] * np.clip(base / denom, 0.35, 1.7) * paper_gain
    printed += np.random.default_rng(21).normal(0, grain, printed.shape[:2])[:, :, None]
    out = base * (1 - alpha) + printed * alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)), icc


PLATES = [
    dict(src="way21-week1-2026-08.webp", out="way21-week1-pack-2026-09.webp",
         quad=[(218, 352), (508, 259), (766, 616), (441, 755)],
         box=(0.17, 0.29, 0.83, 0.80), blur=0.8,
         title="ЗБІР №1", sub="дренажний", foot="ШЛЯХ 21 · ТИЖДЕНЬ 01"),
    dict(src="way21-week2-2026-08.webp", out="way21-week2-pack-2026-09.webp",
         quad=[(101, 172), (420, 172), (420, 666), (101, 666)],
         box=(0.13, 0.30, 0.87, 0.84), blur=0.5,
         title="ЗБІР №2", sub="лімфатичний", foot="ШЛЯХ 21 · ТИЖДЕНЬ 02"),
]


# The /herbs store sells the same pouches the programme ships, so it gets the
# same plates rather than a second labelling pass: one pack, one label, cropped
# square for the blend cards.
CARDS = [
    dict(src="way21-week1-pack-2026-09.webp", out="herbs-pack-1-2026-09.webp",
         crop=(100, 0, 948, 848), size=800),
    dict(src="way21-week2-pack-2026-09.webp", out="herbs-pack-2-2026-09.webp",
         crop=(0, 0, 843, 843), size=800),
]


def main():
    check = "--check" in sys.argv
    with tempfile.TemporaryDirectory() as tmp:
        fonts = build_fonts(Path(tmp))
        for plate in PLATES:
            spec = dict(plate)
            src, out = HERBS / spec.pop("src"), HERBS / spec.pop("out")
            image, icc = brand(fonts, src, **spec)
            if check:
                print(f"{out.name}: {image.size[0]}×{image.size[1]} (not written)")
                continue
            image.save(out, "WEBP", quality=QUALITY, method=6, icc_profile=icc)
            print(f"{out.relative_to(ROOT)} {out.stat().st_size // 1024} KB")

    for card in CARDS:
        src = HERBS / card["src"]
        out = HERBS / card["out"]
        photo = Image.open(src)
        icc = photo.info.get("icc_profile")
        square = photo.convert("RGB").crop(card["crop"]).resize(
            (card["size"], card["size"]), Image.LANCZOS)
        if check:
            print(f"{out.name}: {card['size']}×{card['size']} (not written)")
            continue
        square.save(out, "WEBP", quality=QUALITY, method=6, icc_profile=icc)
        print(f"{out.relative_to(ROOT)} {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
