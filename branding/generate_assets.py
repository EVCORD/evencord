# SPDX-License-Identifier: GPL-3.0-or-later
# Original EvenCord artwork, copyright 2026 EvenCord contributors.
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'branding/assets'
ASSETS.mkdir(parents=True, exist_ok=True)
C = json.loads((ROOT / 'branding/project.json').read_text())['colors']
MARK = json.loads((ROOT / 'branding/mark.json').read_text())
PATHS = ''.join(f'<path d="{p}"/>' for p in MARK['paths'])

def svg(fill):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="EvenCord"><g fill="{fill}">{PATHS}</g></svg>\n'

for name, fill in {'master':C['primary'], 'mark':C['primary'], 'mark-light':C['text'], 'mark-dark':C['dark'], 'monochrome':'currentColor', 'settings':'currentColor', 'badge':'currentColor', 'icon':C['primary']}.items():
    (ASSETS / f'{name}.svg').write_text(svg(fill), encoding='utf-8', newline='\n')

def draw_mark(draw, x, y, scale, fill):
    for points in MARK['polygons']:
        draw.polygon([(round(x+a*scale),round(y+b*scale)) for a,b in points],fill=fill)

def icon(size, fill):
    im=Image.new('RGBA',(size*4,size*4),(0,0,0,0))
    draw_mark(ImageDraw.Draw(im),0,0,size*4/24,fill)
    return im.resize((size,size),Image.Resampling.LANCZOS)

for size in [16,20,24,32,48,64,96,128,256,512,1024]:
    icon(size,C['primary']).save(ASSETS/f'icon-{size}.png')
icon(256,C['primary']).save(ASSETS/'icon.ico',sizes=[(s,s) for s in [16,20,24,32,48,64,96,128,256]])
for role in ['text','dark']:
    icon(256,C[role]).save(ASSETS/f'icon-{role}.png')
wordmark=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 120" role="img" aria-label="EvenCord"><g transform="scale(5)" fill="{C["text"]}">{PATHS}</g><text x="144" y="87" font-family="Segoe UI, sans-serif" font-size="82" font-weight="600" letter-spacing="-3" fill="{C["text"]}">EvenCord</text></svg>\n'
(ASSETS/'wordmark.svg').write_text(wordmark,encoding='utf-8',newline='\n')
banner=f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640" role="img" aria-label="EvenCord. Make Discord your own."><rect width="1280" height="640" fill="{C["dark"]}"/><g transform="translate(80 140) scale(12)" fill="{C["text"]}">{PATHS}</g><text x="420" y="286" font-family="Segoe UI, sans-serif" font-size="106" font-weight="600" letter-spacing="-4" fill="{C["text"]}">EvenCord</text><text x="424" y="356" font-family="Segoe UI, sans-serif" font-size="32" fill="{C["text"]}">Make Discord your own.</text><path d="M424 398h680" stroke="{C["surface"]}"/><text x="424" y="449" font-family="Segoe UI, sans-serif" font-size="23" fill="{C["text"]}">Open source. Built on Equicord and Vencord.</text></svg>\n'
(ASSETS/'banner.svg').write_text(banner,encoding='utf-8',newline='\n')
im=Image.new('RGB',(2560,1280),C['dark']);draw=ImageDraw.Draw(im)
draw_mark(draw,160,280,24,C['text'])
def font(size,bold=False):return ImageFont.truetype('C:/Windows/Fonts/'+('seguisb.ttf' if bold else 'segoeui.ttf'),size*2)
draw.text((840,350),'EvenCord',font=font(106,True),fill=C['text'])
draw.text((848,650),'Make Discord your own.',font=font(32),fill=C['text'])
draw.line((848,796,2208,796),fill=C['surface'],width=2)
draw.text((848,850),'Open source. Built on Equicord and Vencord.',font=font(23),fill=C['text'])
im.resize((1280,640),Image.Resampling.LANCZOS).save(ASSETS/'social-preview.png')
