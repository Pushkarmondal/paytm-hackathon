#!/usr/bin/env python3
"""Cuts the element crops used on the pitch deck from the full-page captures made by shot.mjs.
usage: crops.py <shots-dir> <out-dir>      (captures are 800px wide at device scale 2; coordinates below are 1x)
"""
import os
import sys

from PIL import Image

shots, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
CROPS = {
    "headline-demo": ("overview-demo", 24, 342, 776, 776),
    "headline-nia": ("overview-nia", 24, 342, 776, 776),
    "ladder-demo": ("overview-demo", 24, 798, 776, 1232),
    "twin-roomicu": ("twin-demo", 24, 334, 776, 762),
    "twin-classes": ("twin-demo", 24, 1068, 776, 1464),
    "twin-totals": ("twin-demo", 24, 1463, 776, 1776),
    "twin-confirmed-ame": ("twin-confirmed-demo", 24, 752, 776, 1046),
    "twin-confirmed-totals": ("twin-confirmed-demo", 24, 1443, 776, 1736),
    "twin-nia-ame": ("twin-nia", 24, 752, 776, 1242),
    "twin-nia-totals": ("twin-nia", 24, 1405, 776, 1776),
    "trace-top": ("trace-demo", 290, 0, 800, 410),
    "trace-bottom": ("trace-demo", 290, 410, 800, 1000),
    "unc-resolve": ("uncertainty-demo", 24, 334, 776, 632),
    "unc-hospital": ("uncertainty-demo", 24, 658, 776, 940),
    "unc-insurer": ("uncertainty-demo", 24, 964, 776, 1216),
    "unc-notmodelled": ("uncertainty-demo", 24, 1240, 776, 1526),
    "unc-nia-2020": ("uncertainty-nia", 41, 1157, 759, 1422),
    "unc-nia-caveat": ("uncertainty-nia", 41, 647, 759, 862),
    "sheet": ("sheet-demo", 48, 24, 752, 500),
    "why-deltas": ("why-demo", 24, 278, 776, 398),
    "why-rule": ("why-demo", 24, 1282, 776, 1800),
    "review-wordings": ("review-demo", 24, 280, 776, 566),
    "review-cases": ("review-demo", 24, 594, 776, 906),
    "review-upload": ("review-demo", 24, 928, 776, 1416),
    "review-schedule": ("review-demo", 24, 1785, 776, 2192),
    "review-estimate": ("review-demo", 24, 2218, 776, 2520),
    "review-nia-verification": ("review-nia", 24, 280, 776, 732),
    "builder-find": ("builder-q", 24, 372, 776, 878),
    "builder-proposal-1": ("builder-nia", 45, 687, 755, 931),
    "builder-proposal-differs": ("builder-nia", 45, 1487, 755, 1823),
}
cache = {}
for name, (src, x0, y0, x1, y1) in CROPS.items():
    im = cache.setdefault(src, Image.open(os.path.join(shots, f"{src}.png")).convert("RGB"))
    crop = im.crop((x0 * 2, y0 * 2, x1 * 2, y1 * 2))
    crop.save(os.path.join(out, f"{name}.jpg"), quality=92, subsampling=0)
    print(f"{name}: {crop.size[0]}x{crop.size[1]}")
