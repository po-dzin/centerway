#!/usr/bin/env python3.12
"""Готує згенероване СЕРЕДОВИЩЕ до ролі кімнати прототипу.

Різниця з prep-artwork.py: там пейзаж, тут матеріал стіни. Готуються
ЛИШЕ фронтальні фактури. Мальовані кімнати з готовими нішами тут були
і пішли: отворів у них рівно стільки, скільки їх намалювала модель, на
її ж глибинах і під її ж кутом, а комірок має бути стільки, скільки
розділів у каталозі, — ці два числа не синхронізуються ніяк.

Знімається дві речі:

  1. щільність туші в альфу — колір дає тема через mask-image;
  2. окремо тіло каменю (середні щільності) — щоб темна тема не
     показувала негатив.

    python scripts/design/prep-env.py
"""
import json
import os

import numpy as np
from PIL import Image

SRC = "docs/design-system/prototypes/assets/art"
OUT = "docs/design-system/prototypes/assets"
W = 1280

# Модель ставить свою позначку в правому нижньому куті.
CROP_R, CROP_B = 0.035, 0.045

def density(im):
    a = np.asarray(im, np.float32) / 255.0
    paper = float(np.percentile(a, 97))
    floor = float(np.percentile(a, 0.5))
    d = np.clip((paper - a) / max(paper - floor, 1e-3), 0, 1)
    return d ** 1.15


def material_box(dens, edge=0.06):
    """Де на аркуші справді лежить матеріал.

    Промпт навмисно лишає верх-ліворуч порожнім папером — це потрібно
    пейзажу, під яким стоїть текст. Фактурі стіни це шкодить: у смузі
    з полицями половина кадру виявляється чистим аркушем, і комірки
    висять ні на чому. Тому для стін кадр обрізається до самої маси:
    беруться рядки й стовпці, де середня щільність вища за поріг.
    """
    col = dens.mean(axis=0)
    row = dens.mean(axis=1)
    cx = np.where(col > edge)[0]
    ry = np.where(row > edge)[0]
    if not len(cx) or not len(ry):
        return None
    return int(cx[0]), int(ry[0]), int(cx[-1]) + 1, int(ry[-1]) + 1


def prep(name, key):
    im = Image.open(os.path.join(SRC, name)).convert("L")
    w, h = im.size
    im = im.crop((0, 0, int(w * (1 - CROP_R)), int(h * (1 - CROP_B))))
    im = im.resize((W, round(W * im.size[1] / im.size[0])), Image.LANCZOS)
    dens = density(im)

    if key.startswith("wall-"):
        box = material_box(dens)
        if box:
            im = im.crop(box)
            im = im.resize((W, round(W * im.size[1] / im.size[0])), Image.LANCZOS)
            dens = density(im)

    rgba = np.zeros(dens.shape + (4,), np.uint8)
    rgba[..., 3] = (dens * 255).astype(np.uint8)
    tex = os.path.join(OUT, "env-" + key + ".webp")
    # method=6 замість 4: та сама альфа тисне вп'ятеро краще, а платимо
    # секундою на файл — не тим, що йде в браузер.
    Image.fromarray(rgba, "RGBA").save(tex, quality=55, alpha_quality=62, method=6)

    # ТІЛО КАМЕНЮ ОКРЕМИМ КАНАЛОМ.
    # Одна щільність туші працює лише у світлій темі: там густе — це
    # тінь, і воно темніє. У темній тією самою маскою малюють кремом, і
    # картина стає негативом — отвори світяться, перемички чорніють.
    # Тому пишеться другий канал: сама перемичка, тобто середні
    # щільності. Отвори (найгустіше) і порожній папір (найрідше) з
    # нього виключені, і в темряві він дає освітлений камінь, поверх
    # якого перший канал кладе ту саму тінь у ті самі отвори.
    def band(x, a, b):
        t = np.clip((x - a) / max(b - a, 1e-3), 0, 1)
        return t * t * (3 - 2 * t)
    bodya = band(dens, 0.10, 0.40) * (1 - band(dens, 0.52, 0.78))
    rgbb = np.zeros(dens.shape + (4,), np.uint8)
    rgbb[..., 3] = (bodya * 255).astype(np.uint8)
    Image.fromarray(rgbb, "RGBA").save(os.path.join(OUT, "env-" + key + "-body.webp"),
                                       quality=55, alpha_quality=62, method=6)

    meta = {"tex": os.path.basename(tex), "body": "env-" + key + "-body.webp",
            "w": rgba.shape[1], "h": rgba.shape[0]}
    with open(os.path.join(OUT, "env-" + key + ".json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("%-40s %5.0f KiB  %dx%d"
          % (tex, os.path.getsize(tex) / 1024, meta["w"], meta["h"]))


if __name__ == "__main__":
    for f in sorted(os.listdir(SRC)):
        if f.endswith(".png") and "--wall-" in f:
            prep(f, f.split("--")[-1][:-4])
