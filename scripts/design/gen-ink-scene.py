#!/usr/bin/env python3
"""Генератор тушевих фонів для прототипу «Бібліотека в глибині».

Друкує PNG з чорним RGB і альфою = щільність туші. Тому один файл
працює і як mask-image (альфа-маска, колір бере тема), і як звичайний
шар під multiply у світлій темі. Кольору у файлі немає навмисно:
темна тема пише ті самі форми кремом.

Все процедурне і seeded — той самий seed дає той самий кадр.

    python scripts/design/gen-ink-scene.py [outdir]
"""

import sys
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 2048, 1152


# ---------- база ----------

def upscale(a, w, h):
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L")
    return np.asarray(im.resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0


def noise(rng, w, h, cells):
    g = rng.random((max(2, int(cells * h / w)) + 1, cells + 1))
    return upscale(g, w, h)


def fbm(rng, w, h, cells=4, octaves=6, gain=0.5):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for i in range(octaves):
        out += amp * noise(rng, w, h, cells * (2 ** i))
        tot += amp
        amp *= gain
    return out / tot


def fbm1d(rng, w, cells=3, octaves=6, gain=0.5):
    out = np.zeros(w, np.float32)
    amp, tot = 1.0, 0.0
    for i in range(octaves):
        n = cells * (2 ** i)
        g = rng.random(n + 2)
        x = np.linspace(0, n, w)
        i0 = np.floor(x).astype(int)
        f = x - i0
        f = f * f * (3 - 2 * f)          # smoothstep між вузлами
        out += amp * (g[i0] * (1 - f) + g[i0 + 1] * f)
        tot += amp
        amp *= gain
    return out / tot


def blur(a, r):
    if r <= 0:
        return a
    im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255.0


def over(dst, src):
    """Туш не додається лінійно — вона насичує папір."""
    return 1.0 - (1.0 - dst) * (1.0 - src)


YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)


def ridge(rng, base, amp, cells, oct_=6, tilt=0.0, peaks=3, sharp=1.0):
    """Силует гряди: кілька вершин, складених через max, плюс шум.

    Сума октав дає рівну хвилю — гори так не стоять. Вершина має бути
    подією: крутий бік, довгий схил, а між ними — сідловина."""
    x = np.arange(W, dtype=np.float32) / W
    prof = np.zeros(W, np.float32)
    for _ in range(peaks):
        cx = rng.random()
        wdt = (0.09 + rng.random() * 0.22) / sharp
        hgt = 0.45 + rng.random() * 0.85
        skew = 0.55 + rng.random() * 0.9        # один бік крутіший
        t = (x - cx) / wdt
        t = np.where(t < 0, t * skew, t / skew)
        prof = np.maximum(prof, hgt * np.exp(-np.abs(t) ** 1.55))
    rough = fbm1d(rng, W, cells=cells, octaves=oct_) - 0.5
    prof = prof + rough * 0.55 * np.clip(prof + 0.25, 0, 1)
    line = base - amp * prof * 2.0 + tilt * (x - 0.5)
    return line


def fill_below(line, soft=2.0):
    return np.clip((YY - line[None, :]) / soft + 0.5, 0, 1)


# ---------- фактури пензля ----------

def paper_bite(rng, coarse=1.0):
    """飛白 — сухий пензель лишає папір непокритим у западинах."""
    fine = fbm(rng, W, H, cells=48, octaves=4, gain=0.62)
    return np.clip(0.55 + coarse * (fine - 0.5) * 1.9, 0, 1.35)


def fibres(rng, n=1400, length=170, width=2):
    """Волокно паперу — витягнутий шум, а не крапки."""
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    for _ in range(n):
        x = rng.random() * W
        y = rng.random() * H
        a = (rng.random() - 0.5) * 0.5
        ln = length * (0.3 + rng.random())
        d.line([(x, y), (x + ln * np.cos(a), y + ln * np.sin(a))],
               fill=int(30 + rng.random() * 60), width=width)
    im = im.filter(ImageFilter.GaussianBlur(1.1))
    return np.asarray(im, np.float32) / 255.0


def cun_strokes(rng, mask, line, clusters=90, per=14, ln=(6, 22), fill=(50, 130)):
    """斧劈皴 — короткі рублені штрихи гронами, а не рівним ворсом.

    Рівномірний посів дає хутро. Штрихи ходять сім'ями по гранях
    породи: спільний нахил на гроно, розкид всередині малий."""
    im = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(im)
    got = 0
    guard = 0
    while got < clusters and guard < clusters * 60:
        guard += 1
        cx = rng.random() * W
        cy = rng.random() * H
        if mask[int(cy), int(cx)] < 0.6:
            continue
        i = int(np.clip(cx, 1, W - 2))
        slope = float(line[i + 1] - line[i - 1]) * 0.5
        base_a = np.arctan2(1.0, -slope) + (rng.random() - 0.5) * 0.55
        rx = 30 + rng.random() * 120
        ry = 14 + rng.random() * 50
        for _ in range(int(per * (0.5 + rng.random()))):
            x = cx + (rng.random() - 0.5) * 2 * rx
            y = cy + (rng.random() - 0.5) * 2 * ry
            if not (0 <= x < W and 0 <= y < H) or mask[int(y), int(x)] < 0.5:
                continue
            a = base_a + (rng.random() - 0.5) * 0.30
            L = ln[0] + rng.random() * (ln[1] - ln[0])
            d.line([(x, y), (x + L * np.cos(a), y + L * np.sin(a))],
                   fill=int(fill[0] + rng.random() * (fill[1] - fill[0])),
                   width=1 if rng.random() < 0.8 else 2)
        got += 1
    im = im.filter(ImageFilter.GaussianBlur(0.7))
    return np.asarray(im, np.float32) / 255.0


def wet_edge(line, w=9.0):
    """Калюжка туші, що сохне по краю мазка."""
    d = (YY - line[None, :]) / w
    return np.exp(-(d * d)) * (YY > line[None, :] - w * 2)


def save(a, path):
    a = np.clip(a, 0, 1)
    la = np.zeros((H, W, 2), np.uint8)      # L=0 (чорна туш), A=щільність
    la[..., 1] = (a * 255).astype(np.uint8)
    Image.fromarray(la, "LA").save(path, optimize=True)
    print("%-52s %6.0f KiB" % (path, os.path.getsize(path) / 1024))


# ---------- варіант A: далекі гряди ----------

def variant_ranges(seed=21):
    rng = np.random.default_rng(seed)
    ink = np.zeros((H, W), np.float32)
    # шість гряд, що йдуть у глибину: далі — світліше й розмитіше
    plan = [
        # (база, амплітуда, крупність, сила, розмиття, tilt, вершин, гострота)
        (0.615, 0.230, 2, 0.13, 12.0, -0.02, 2, 1.0),
        (0.700, 0.185, 3, 0.19, 7.0, 0.03, 3, 1.25),
        (0.780, 0.150, 4, 0.25, 4.0, -0.04, 3, 1.5),
        (0.855, 0.110, 5, 0.32, 2.2, 0.02, 3, 1.5),
        (0.930, 0.075, 7, 0.40, 1.2, -0.01, 4, 1.7),
    ]
    for base, amp, cells, strength, br, tilt, pk, sh in plan:
        line = ridge(rng, H * base, H * amp, cells, tilt=tilt * H, peaks=pk, sharp=sh)
        body = fill_below(line, soft=2.5)
        # тіло гряди світлішає донизу — це повітря між планами
        fade = np.clip(1.0 - (YY - line[None, :]) / (H * 0.30), 0.18, 1.0)
        layer = body * fade * strength
        layer = over(layer, body * wet_edge(line, 7.0) * strength * 0.55)
        layer *= 0.72 + 0.28 * paper_bite(rng, 0.7)
        ink = over(ink, blur(layer, br))
    # туман, що лягає в долини між планами
    mist = blur(fbm(rng, W, H, cells=3, octaves=4), 26.0)
    band = np.clip(1.0 - np.abs(YY / H - 0.70) / 0.30, 0, 1)
    ink *= 1.0 - 0.42 * mist * band
    ink = over(ink * 0.94, fibres(rng, 900, 150) * 0.16)
    return ink


# ---------- варіант B: скеля зблизька ----------

def variant_rock(seed=8):
    rng = np.random.default_rng(seed)
    ink = np.zeros((H, W), np.float32)
    # дві далекі гряди тримають глибину за скелею
    for base, amp, cells, strength, br in [(0.56, 0.20, 3, 0.11, 11.0),
                                           (0.66, 0.15, 4, 0.16, 6.0)]:
        line = ridge(rng, H * base, H * amp, cells, peaks=2, sharp=1.3)
        ink = over(ink, blur(fill_below(line, 3.0) * strength
                             * (0.75 + 0.25 * paper_bite(rng, 0.6)), br))
    # тіло скелі
    line = ridge(rng, H * 0.86, H * 0.36, 3, oct_=7, tilt=-0.05 * H,
                 peaks=2, sharp=1.15)
    body = fill_below(line, soft=2.0)
    wash = body * np.clip(1.0 - (YY - line[None, :]) / (H * 0.75), 0.30, 1.0)
    rock = wash * 0.30
    rock = over(rock, body * wet_edge(line, 11.0) * 0.42)
    rock = over(rock, cun_strokes(rng, body, line, clusters=70, per=12) * body * 0.7)
    # тріщини — довгі сухі штрихи, рідше й темніше
    rock = over(rock, cun_strokes(rng, body, line, clusters=14, per=4,
                                  ln=(40, 130), fill=(90, 190)) * body * 0.6)
    rock *= 0.62 + 0.38 * paper_bite(rng, 1.15)
    ink = over(ink, rock)
    # підніжжя тоне в тумані
    foot = np.clip((YY / H - 0.86) / 0.14, 0, 1) * blur(fbm(rng, W, H, 4, 4), 18.0)
    ink *= 1.0 - 0.55 * foot
    ink = over(ink * 0.97, fibres(rng, 1200, 140) * 0.2)
    return ink


# ---------- варіант C: ма (порожнеча) ----------

def variant_ma(seed=55):
    rng = np.random.default_rng(seed)
    ink = np.zeros((H, W), np.float32)
    # одна гряда, дуже далеко, майже вода
    line = ridge(rng, H * 0.80, H * 0.145, 3, tilt=0.02 * H, peaks=2, sharp=1.4)
    body = fill_below(line, 3.0)
    fade = np.clip(1.0 - (YY - line[None, :]) / (H * 0.26), 0.0, 1.0)
    layer = body * fade * 0.33
    layer = over(layer, body * wet_edge(line, 6.0) * 0.34)
    layer *= 0.7 + 0.3 * paper_bite(rng, 0.8)
    ink = over(ink, blur(layer, 3.4))
    # ще одна, ледь намічена, вище й лівіше
    line2 = ridge(rng, H * 0.735, H * 0.095, 5, peaks=3, sharp=1.9)
    ink = over(ink, blur(fill_below(line2, 4.0)
                         * np.clip(1.0 - (YY - line2[None, :]) / (H * 0.14), 0, 1)
                         * 0.15, 9.0))
    # горизонтальні смуги туману — те, чим тримається порожнеча
    for cy, hh, s in [(0.79, 0.020, 0.10), (0.845, 0.014, 0.075), (0.885, 0.010, 0.05)]:
        band = np.exp(-((YY / H - cy) / hh) ** 2)
        wob = fbm(rng, W, H, cells=2, octaves=3)
        ink = over(ink, blur(band * (0.55 + 0.9 * wob) * s, 5.0))
    ink = over(ink * 0.9, fibres(rng, 700, 200) * 0.12)
    return ink


VARIANTS = [
    ("scene-ranges", variant_ranges, "далекі гряди — шість планів у глибину"),
    ("scene-rock", variant_rock, "скеля зблизька — 皴 по тілу, туман у підніжжі"),
    ("scene-ma", variant_ma, "ма — одна гряда і смуги туману, решта папір"),
]


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "docs/design-system/prototypes/assets"
    os.makedirs(out, exist_ok=True)
    for name, fn, note in VARIANTS:
        save(fn(), os.path.join(out, name + ".png"))
