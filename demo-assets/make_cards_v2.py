#!/usr/bin/env python3
"""Gameverse title/end cards — YUGAANTAR-inspired night realm with portal glow."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, random

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
NAVY0 = (6, 11, 32)
NAVY1 = (11, 20, 52)
NAVY2 = (16, 28, 68)
GOLD = (255, 201, 75)
GOLD2 = (255, 224, 138)
GOLD_DEEP = (143, 95, 14)
CREAM = (244, 238, 218)
MUTED = (159, 176, 224)
CYAN = (82, 205, 255)
MINT = (111, 229, 143)
CORAL = (255, 125, 146)

F = os.path.join(OUT, "fonts")
SILK_R = lambda s: ImageFont.truetype(os.path.join(F, "Silkscreen-Regular.ttf"), s)
SILK_B = lambda s: ImageFont.truetype(os.path.join(F, "Silkscreen-Bold.ttf"), s)

def baloo(size, weight=700):
    f = ImageFont.truetype(os.path.join(F, "Baloo2.ttf"), size)
    try:
        f.set_variation_by_name({400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold"}[weight])
    except Exception:
        pass
    return f

def night_bg():
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        r = int(NAVY0[0] + (NAVY2[0] - NAVY0[0]) * t)
        g = int(NAVY0[1] + (NAVY2[1] - NAVY0[1]) * t)
        b = int(NAVY0[2] + (NAVY2[2] - NAVY0[2]) * t)
        for x in range(W):
            px[x, y] = (r, g, b)
    # vignette corners darker
    ov = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(ov)
    d.ellipse([-W * 0.25, -H * 0.35, W * 1.25, H * 1.35], fill=90)
    ov = ov.filter(ImageFilter.GaussianBlur(180))
    dark = Image.new("RGB", (W, H), (3, 6, 18))
    img = Image.composite(img, dark, ov)
    return img

def stars(img, n=90, seed=7):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(n):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        s = rnd.choice([1, 1, 1, 2, 2, 3])
        c = rnd.choice([(244, 238, 218, 200), (255, 224, 138, 190), (159, 176, 224, 170), (82, 205, 255, 150)])
        d.rectangle([x, y, x + s, y + s], fill=c)

def portal(img, cx, cy, r, ring=(CYAN, 5), glow=(82, 205, 255)):
    """Glowing gameverse portal ring behind text."""
    glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow_layer)
    for rr, a in [(r + 46, 40), (r + 30, 70), (r + 16, 110)]:
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=glow + (a,), width=26)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(26))
    img.paste(Image.alpha_composite(img.convert("RGBA"), glow_layer).convert("RGB"), (0, 0))
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ring[0] + (255,), width=ring[1])
    d.ellipse([cx - r + 10, cy - r + 10, cx + r - 10, cy + r - 10], outline=GOLD + (160,), width=3)
    # sparkles on ring
    for ang, rr in [(35, r), (150, r), (250, r), (330, r + 8)]:
        import math
        x = cx + rr * math.cos(math.radians(ang))
        y = cy + rr * math.sin(math.radians(ang))
        d.rectangle([x - 3, y - 3, x + 3, y + 3], fill=GOLD2 + (255,))

def pixel_chip(d, x, y, text, font, fg, border, pad=18):
    tw = d.textlength(text, font=font)
    d.rectangle([x, y, x + tw + pad * 2 + 8, y + 44], outline=border + (255,), width=3)
    d.text((x + pad, y + 10), text, font=font, fill=fg)
    return tw + pad * 2 + 8

def title_card():
    img = night_bg()
    stars(img)
    portal(img, W // 2, 470, 300)
    d = ImageDraw.Draw(img, "RGBA")
    kick = "SEVA FIRST INNOVATION CHALLENGE  ·  SOUTH ZONE"
    kw = d.textlength(kick, font=SILK_R(22))
    d.text(((W - kw) / 2, 130), kick, font=SILK_R(22), fill=MUTED + (255,))
    # Pixel title with hard offset shadow
    t = "ABHYAS"
    f_t = SILK_B(148)
    tw = d.textlength(t, font=f_t)
    x0, y0 = (W - tw) / 2, 330
    d.text((x0 + 8, y0 + 10), t, font=f_t, fill=GOLD_DEEP + (255,))
    d.text((x0, y0), t, font=f_t, fill=GOLD + (255,))
    tag = "अभ्यास · the teaching gameverse"
    f_tag = baloo(58, 700)
    tw2 = d.textlength(tag, font=f_tag)
    d.text(((W - tw2) / 2, 560), tag, font=f_tag, fill=CREAM + (255,))
    sub = "Rehearse real classrooms. Earn XP. Unlock realms."
    f_sub = baloo(34, 500)
    tw3 = d.textlength(sub, font=f_sub)
    d.text(((W - tw3) / 2, 650), sub, font=f_sub, fill=MUTED + (255,))
    x = 0
    row_w = 0
    chips = [("MATHS · CLASSES 1-3", SILK_R(20)), ("VOICE-FIRST", SILK_R(20)), ("WORKING V0", SILK_R(20))]
    widths = [d.textlength(c, font=f) + 52 for c, f in chips]
    total = sum(widths) + 2 * 24
    cx = (W - total) / 2
    for (c, f), wch in zip(chips, widths):
        pixel_chip(d, cx, 740, c, f, GOLD2, GOLD_DEEP)
        cx += wch + 24
    foot = "TEAM COGNIX  ·  SEVA31417  —  PRESS START"
    fw = d.textlength(foot, font=SILK_R(22))
    d.text(((W - fw) / 2, 920), foot, font=SILK_R(22), fill=MUTED + (255,))
    img.save(os.path.join(OUT, "card-title.png"))

def end_card():
    img = night_bg()
    stars(img)
    portal(img, W - 330, 250, 170)
    d = ImageDraw.Draw(img, "RGBA")
    d.text((130, 110), "MISSION COMPLETE", font=SILK_B(88), fill=GOLD + (255,))
    d.text((134, 225), "Evidence from the live V0, verified today", font=baloo(34, 500), fill=MUTED + (255,))
    facts = [
        ("72", "automated tests — engine, evidence, isolation, offline sync"),
        ("MAE 0.066", "AI-vs-expert calibration error (gate: <= 0.25)"),
        ("100%", "decision agreement with expert labels"),
        ("88 · 85", "evidence-cited scores — next quest targets the gap"),
    ]
    y = 330
    for n, l in facts:
        d.text((140, y), n, font=SILK_B(52), fill=GOLD + (255,))
        d.text((600, y + 12), l, font=baloo(32, 500), fill=CREAM + (230,))
        d.text((140, y + 78), "." * 46, font=SILK_R(12), fill=(60, 74, 130, 255))
        y += 130
    d.text((140, 870), "Pilots don't learn to fly from a manual.", font=baloo(44, 700), fill=CREAM + (255,))
    d.text((140, 938), "Every teacher deserves a safe place to practise before they teach.", font=baloo(44, 700), fill=GOLD2 + (255,))
    foot = "TEAM COGNIX  ·  SEVA31417  —  CHOOSE YOUR NEXT QUEST"
    d.text((140, 1010), foot, font=SILK_R(20), fill=MUTED + (255,))
    d.text((140, 1045), "Music: Carefree — Kevin MacLeod (incompetech.com), CC BY 4.0",
           font=baloo(18, 500), fill=MUTED + (230,))
    img.save(os.path.join(OUT, "card-end.png"))

title_card()
end_card()
print("gameverse cards written")
