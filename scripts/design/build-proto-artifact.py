#!/usr/bin/env python3
"""Складає самодостатню копію прототипу для публікації артефактом.

Артефакт живе за суворим CSP і не тягне сусідні файли, тож растри
пейзажу вшиваються в HTML як data:-URI. Робоча копія в репозиторії
лишається з відносними шляхами — так її можна редагувати.

    python scripts/design/build-proto-artifact.py <out.html>
"""
import base64
import os
import re
import sys

SRC = "docs/design-system/prototypes/library-depth-2026-08-26.html"
ASSETS = "docs/design-system/prototypes/assets"

out = sys.argv[1] if len(sys.argv) > 1 else "dist-library-depth.html"
html = open(SRC, encoding="utf-8").read()

MIME = {".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg"}

for name in sorted(os.listdir(ASSETS)):
    mime = MIME.get(os.path.splitext(name)[1])
    if not mime or "assets/" + name not in html:
        continue
    raw = open(os.path.join(ASSETS, name), "rb").read()
    uri = "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode("ascii"))
    html = html.replace("assets/" + name, uri)

# сторінку загортає хост — власні doctype/html/head/body зайві
html = re.sub(r"(?is)^.*?<body[^>]*>", "", html, count=1)
html = re.sub(r"(?is)</body>\s*</html>\s*$", "", html, count=1)

open(out, "w", encoding="utf-8").write(html)
print("%s  %.1f MiB" % (out, os.path.getsize(out) / 1048576))
