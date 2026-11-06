#!/usr/bin/env python3
"""Overflow / overlap / bounds QA for the generated deck."""
from pptx import Presentation
from pptx.util import Emu

EMU_IN = 914400
prs = Presentation("Abhyas_Pitch.pptx")
W, H = prs.slide_width / EMU_IN, prs.slide_height / EMU_IN
issues = 0

def walk(shapes):
    for sh in shapes:
        if sh.shape_type == 6:
            yield from walk(sh.shapes)
        else:
            yield sh

for idx, slide in enumerate(prs.slides, 1):
    boxes = []
    for sh in walk(slide.shapes):
        if sh.left is None:
            continue
        x, y = sh.left / EMU_IN, sh.top / EMU_IN
        w, h = (sh.width or 0) / EMU_IN, (sh.height or 0) / EMU_IN
        txt = ""
        if sh.has_text_frame:
            txt = sh.text_frame.text.strip()
        # bounds check (allow deliberate bleed for ovals/watermark)
        if txt and (x < -0.05 or y < -0.55 or x + w > W + 0.05 or y + h > H + 0.05):
            print(f"S{idx} OUT-OF-BOUNDS: ({x:.2f},{y:.2f},{w:.2f},{h:.2f}) {txt[:40]!r}")
            issues += 1
        if txt:
            boxes.append((x, y, w, h, txt))
    # text-vs-text overlap check
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            a, b = boxes[i], boxes[j]
            ox = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
            oy = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
            if ox > 0.08 and oy > 0.08:
                # ignore text sitting inside a bigger same-position composite (chip+label pairs are separate boxes)
                area_o = ox * oy
                if area_o > 0.12:
                    print(f"S{idx} OVERLAP {area_o:.2f}in2: {a[4][:32]!r} <-> {b[4][:32]!r}")
                    issues += 1

print(f"done, {issues} issue(s)")
