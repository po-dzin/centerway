#!/usr/bin/env python3.12
"""Готує згенероване СЕРЕДОВИЩЕ до ролі кімнати прототипу.

Різниця з prep-artwork.py: там пейзаж, тут інтер'єр, і з нього треба
дістати не лише щільність туші, а й МІСЦЯ. Ніші в камені намальовані
моделлю; полиці мають сідати саме в них, а не поруч. Тому скрипт:

  1. знімає щільність туші (альфа = наскільки темніше за папір) — колір
     потім дає тема через mask-image, як і в пейзажі;
  2. знаходить самі отвори: найтемніші зв'язні плями, відфільтровані за
     площею, пропорцією і заповненістю прямокутника;
  3. пише поруч JSON із нормованими координатами цих отворів.

Прототип читає JSON і кладе комірки в знайдені гнізда. Саме тому
комірки перестають «випадати» з середовища: їхні місця беруться з
малюнка, а не вигадуються поруч із ним.

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

# Порогові значення пошуку гнізда. Всі — частки кадру, не пікселі:
# артворк може прийти будь-якого розміру.
DARK = 0.60          # від якої щільності туші вважаємо, що це отвір
MIN_AREA = 0.0022    # менше — це тріщина, а не ніша
MAX_AREA = 0.09      # більше — це вже хід або тінь усієї стіни
MIN_FILL = 0.52      # наскільки пляма заповнює свій прямокутник
ASPECT = (0.35, 3.2)
MAX_SEATS = 14


def density(im):
    a = np.asarray(im, np.float32) / 255.0
    paper = float(np.percentile(a, 97))
    floor = float(np.percentile(a, 0.5))
    d = np.clip((paper - a) / max(paper - floor, 1e-3), 0, 1)
    return d ** 1.15


def seats(dens):
    """Зв'язні темні плями — обходом у ширину по зменшеній масці.

    Зменшення тут не оптимізація, а частина методу: на повному розмірі
    отвір розсипається на десяток плям через зерно паперу і сколи, і
    жоден поріг цього не лікує. На 1/4 масштабу зерно зникає, а форма
    отвору лишається.
    """
    h, w = dens.shape
    sw, sh = w // 4, h // 4
    small = np.asarray(Image.fromarray((dens * 255).astype(np.uint8))
                       .resize((sw, sh), Image.BILINEAR), np.float32) / 255.0
    mask = small > DARK
    seen = np.zeros_like(mask, bool)
    found = []
    total = sw * sh
    for y0 in range(sh):
        for x0 in range(sw):
            if not mask[y0, x0] or seen[y0, x0]:
                continue
            stack = [(y0, x0)]
            seen[y0, x0] = True
            pts = []
            while stack:
                y, x = stack.pop()
                pts.append((y, x))
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < sh and 0 <= nx < sw and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
            ys = [p[0] for p in pts]
            xs = [p[1] for p in pts]
            bx0, bx1, by0, by1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
            bw, bh = bx1 - bx0, by1 - by0
            area = len(pts) / total
            fill = len(pts) / float(bw * bh)
            asp = bw / float(bh)
            if not (MIN_AREA <= area <= MAX_AREA):
                continue
            if fill < MIN_FILL or not (ASPECT[0] <= asp <= ASPECT[1]):
                continue
            found.append({
                "x": round(bx0 / sw, 4), "y": round(by0 / sh, 4),
                "w": round(bw / float(sw), 4), "h": round(bh / float(sh), 4),
                "area": area,
            })
    found.sort(key=lambda s: -s["area"])
    for s in found:
        del s["area"]
    return found[:MAX_SEATS]


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

    # ФАКТУРА НЕ МАЄ ГНІЗД. У стіни, знятої в лоб, отворів не
    # намальовано — їх ріже розкладка, і саме тому вона й масштабується.
    # Темні плями в ній є (сколи, мокрий край), але це не ніші, і
    # шукати їх там означало б посадити полицю в тріщину.
    found = [] if key.startswith("wall-") else seats(dens)
    meta = {"tex": os.path.basename(tex), "body": "env-" + key + "-body.webp",
            "w": rgba.shape[1], "h": rgba.shape[0],
            "seats": found}
    with open(os.path.join(OUT, "env-" + key + ".json"), "w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print("%-40s %5.0f KiB  %dx%d  гнізд: %d"
          % (tex, os.path.getsize(tex) / 1024, meta["w"], meta["h"], len(found)))
    for s in found:
        print("    %.3f %.3f  %.3f x %.3f" % (s["x"], s["y"], s["w"], s["h"]))


if __name__ == "__main__":
    for f in sorted(os.listdir(SRC)):
        if f.endswith(".png") and ("--room-" in f or "--wall-" in f):
            prep(f, f.split("--")[-1][:-4])
