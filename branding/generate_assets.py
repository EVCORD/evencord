# SPDX-License-Identifier: GPL-3.0-or-later
# Original EvenCord artwork, copyright 2026 EvenCord contributors.
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "branding/assets"
ASSETS.mkdir(parents=True, exist_ok=True)
PROJECT = json.loads((ROOT / "branding/project.json").read_text())
COLORS = PROJECT["colors"]
POINTS = [(5, 4), (21, 4), (18, 8), (9, 8), (9, 10), (17, 10),
          (14, 14), (9, 14), (9, 16), (21, 16), (18, 20), (5, 20)]
PATH = "M5 4H21L18 8H9V10H17L14 14H9V16H21L18 20H5Z"


def svg(fill, background=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="EvenCord">{background}<path fill="{fill}" d="{PATH}"/></svg>\n'


(ASSETS / "mark.svg").write_text(svg(COLORS["primary"]), encoding="utf-8")
(ASSETS / "monochrome.svg").write_text(svg("currentColor"), encoding="utf-8")
(ASSETS / "settings.svg").write_text(svg("currentColor"), encoding="utf-8")
(ASSETS / "icon.svg").write_text(svg(COLORS["primary"], '<rect width="24" height="24" rx="5" fill="#101820"/>'), encoding="utf-8")


def icon(size):
    scale = size * 4 / 24
    im = Image.new("RGBA", (size * 4, size * 4))
    draw = ImageDraw.Draw(im)
    draw.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=size * 4 * 5 / 24, fill=COLORS["dark"])
    draw.polygon([(round(x * scale), round(y * scale)) for x, y in POINTS], fill=COLORS["primary"])
    return im.resize((size, size), Image.Resampling.LANCZOS)


for size in (16, 24, 32, 48, 64, 96, 128, 256, 512, 1024):
    icon(size).save(ASSETS / f"icon-{size}.png")
icon(256).save(ASSETS / "icon.ico", sizes=[(n, n) for n in (16, 24, 32, 48, 64, 96, 128, 256)])
banner = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-labelledby="title desc">
<title id="title">EvenCord</title><desc id="desc">An open-source Discord client modification based on Equicord.</desc>
<rect width="1280" height="640" rx="32" fill="{COLORS["dark"]}"/>
<g transform="translate(88 160) scale(12)" fill="{COLORS["primary"]}"><path d="{PATH}"/></g>
<text x="420" y="300" font-family="Segoe UI, sans-serif" font-size="106" font-weight="600" fill="{COLORS["text"]}">EvenCord</text>
<path d="M424 345h84" stroke="{COLORS["accent"]}" stroke-width="8"/>
<text x="420" y="404" font-family="Segoe UI, sans-serif" font-size="28" fill="{COLORS["text"]}">An open-source Discord client modification.</text>
<text x="420" y="449" font-family="Segoe UI, sans-serif" font-size="24" fill="{COLORS["primary"]}">Based on Equicord and Vencord.</text>
</svg>
'''
(ASSETS / "banner.svg").write_text(banner, encoding="utf-8")
im = Image.new("RGB", (2560, 1280), COLORS["dark"])
draw = ImageDraw.Draw(im)
draw.polygon([(round((88 + x * 12) * 2), round((160 + y * 12) * 2)) for x, y in POINTS], fill=COLORS["primary"])
font_root = Path("C:/Windows/Fonts")


def font(size, bold=False):
    return ImageFont.truetype(str(font_root / ("seguisb.ttf" if bold else "segoeui.ttf")), size * 2)


draw.text((840, 390), "EvenCord", font=font(106, True), fill=COLORS["text"])
draw.line((848, 690, 1016, 690), fill=COLORS["accent"], width=16)
draw.text((840, 750), "An open-source Discord client modification.", font=font(28), fill=COLORS["text"])
draw.text((840, 850), "Based on Equicord and Vencord.", font=font(24), fill=COLORS["primary"])
im.resize((1280, 640), Image.Resampling.LANCZOS).save(ASSETS / "social-preview.png")
