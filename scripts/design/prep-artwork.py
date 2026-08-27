#!/usr/bin/env python3
"""Готує згенеровані артворки до ролі фону сцени.

Модель віддає туш на теплому папері. Сцена ж має жити в обох темах,
тож із картини знімається лише ЩІЛЬНІСТЬ туші: альфа = наскільки
темніше за папір. Колір потім дає тема через mask-image. Заразом
зрізається правий нижній кут — модель ставить туди свою позначку.

    python scripts/design/prep-artwork.py
"""
import os
import numpy as np
from PIL import Image

SRC = "docs/design-system/prototypes/assets/art"
OUT = "docs/design-system/prototypes/assets"
W = 1600

# Скільки зрізати з країв, щоб позначка моделі не поїхала в макет.
CROP_R, CROP_B = 0.045, 0.055


def prep(name, key):
    im = Image.open(os.path.join(SRC, name)).convert("L")
    w, h = im.size
    im = im.crop((0, 0, int(w * (1 - CROP_R)), int(h * (1 - CROP_B))))
    im = im.resize((W, round(W * im.size[1] / im.size[0])), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255.0

    # Папір — це не 100% білий, а найсвітліший тон самої картини; беремо
    # високий перцентиль, інакше ледь помітний серпанок піде в чорноту.
    paper = float(np.percentile(a, 97))
    floor = float(np.percentile(a, 0.5))
    dens = np.clip((paper - a) / max(paper - floor, 1e-3), 0, 1)
    dens = dens ** 1.15                      # трохи прибрати сірий шум паперу

    # Кладеться WebP: корисна в файлі лише альфа, тож і тиснеться саме
    # вона (alpha_quality). Фон іде під зерном і паралаксом — різниці
    # від втрат не видно, а вага падає в кілька разів проти PNG.
    rgba = np.zeros(dens.shape + (4,), np.uint8)
    rgba[..., 3] = (dens * 255).astype(np.uint8)
    path = os.path.join(OUT, "art-" + key + ".webp")
    Image.fromarray(rgba, "RGBA").save(path, quality=60, alpha_quality=74, method=4)
    print("%-46s %5.0f KiB  %dx%d" % (path, os.path.getsize(path) / 1024,
                                      rgba.shape[1], rgba.shape[0]))


if __name__ == "__main__":
    for f in sorted(os.listdir(SRC)):
        if f.endswith(".png"):
            prep(f, f.rsplit("--", 1)[-1][:-4])
