"""Bilingual callouts over a Blender render, anchored to the parts' projected positions (mounter.py --anchors).

The labels are drawn in 2D after rendering so the type stays crisp at any resolution and the same render can carry
Arabic, English or no labels. Run with any Python that has Pillow built with raqm (Arabic shaping):
    python3 label.py render.png anchors.json out.png [--ar-font F.ttf] [--en-font F.otf]
"""
import sys, json, argparse
from PIL import Image, ImageDraw, ImageFont, features

ap = argparse.ArgumentParser()
ap.add_argument('render'); ap.add_argument('anchors'); ap.add_argument('out')
ap.add_argument('--ar-font', default='/home/user/Animation/studio/assets/fonts/IBMPlexSansArabic-Medium.ttf')
ap.add_argument('--en-font', default='/usr/share/fonts/opentype/inter/Inter-Regular.otf')
ap.add_argument('--en-bold', default='/usr/share/fonts/opentype/inter/Inter-SemiBold.otf')
A = ap.parse_args()
if not features.check('raqm'):
    sys.exit('Pillow lacks raqm: Arabic would render unshaped. Install a Pillow build with libraqm.')

# part id -> (Arabic, English). Wording follows the guide's terms; the machine is an illustrative reconstruction.
TEXT = {
    'MNT.head.spindles': ('رأس التركيب: ٨ شفّاطات', 'Placement head, 8 vacuum spindles'),
    'MNT.head.camera': ('كاميرا علامات اللوحة', 'Fiducial camera'),
    'MNT.gantry.beam': ('الجسر المتحرك', 'Carbon gantry beam, X axis'),
    'MNT.feeders_front.feeders': ('مغذّيات الشريط', 'Tape feeders'),
    'MNT.feeders_front.reels': ('بكرات القطع', 'Component reels'),
    'MNT.feeders_rear.feeders': ('مغذّيات الجهة الخلفية', 'Rear feeder bank'),
    'MNT.board.pcb': ('اللوحة أثناء التركيب', 'Board being populated'),
    'MNT.hood.tower': ('برج الإشارة', 'Signal tower'),
    'MNT.hood.hmi': ('شاشة المشغّل', 'Operator screen'),
    'MNT.hood.frame': ('غطاء الأمان', 'Interlocked safety hood'),
    'MNT.yaxis.beam_left': ('محور الحركة الطولي', 'Y axis, guide and linear motor'),
    'MNT.conveyor.rails': ('سير نقل اللوحات', 'Board conveyor'),
    'MNT.cabinet.front': ('أبواب الصيانة', 'Service doors'),
    'MNT.cabinet.side_right': ('لوح جانبي', 'Side panel'),
    'MNT.controls.vacuum': ('مضخة التفريغ', 'Vacuum pump'),
    'MNT.controls.servo_rack': ('مشغّلات المحاور', 'Servo amplifiers'),
    'MNT.controls.pc': ('كمبيوتر التحكم والرؤية', 'Control and vision computer'),
    'MNT.tooling.up_camera': ('كاميرا فحص القطعة', 'Upward component camera'),
    'MNT.tooling.nozzle_changer': ('مبدّل الشفّاطات', 'Nozzle changer'),
    'MNT.bed.casting': ('القاعدة المصبوبة', 'Mineral-cast bed'),
    'MNT.head.nozzles': ('الشفّاطات', 'Vacuum nozzles'),
}
STATE = {'assembled': ('متركّبة', 'Assembled'), 'exploded': ('متفكّكة', 'Exploded view'),
         'ghost': ('الغطاء شفّاف', 'X-ray view'), 'cut': ('مقطع', 'Cutaway')}
# which callouts each view carries, and where each label sits relative to its anchor (fractions of the image width)
LAYOUT = {
    'assembled': [('MNT.head.spindles', -0.20, -0.22), ('MNT.hood.tower', 0.10, -0.03), ('MNT.hood.hmi', -0.12, -0.12),
                  ('MNT.feeders_front.feeders', -0.16, 0.06), ('MNT.feeders_front.reels', -0.06, 0.2),
                  ('MNT.conveyor.rails', 0.14, 0.05)],
    'exploded': [('MNT.hood.frame', 0.2, -0.04), ('MNT.gantry.beam', -0.24, -0.05), ('MNT.head.spindles', -0.22, 0.02),
                 ('MNT.yaxis.beam_left', -0.2, -0.02), ('MNT.conveyor.rails', 0.22, -0.07), ('MNT.feeders_front.feeders', -0.15, 0.1),
                 ('MNT.cabinet.side_right', 0.16, 0.1), ('MNT.controls.pc', 0.02, 0.2)],
    'ghost': [('MNT.controls.vacuum', 0.16, 0.03), ('MNT.controls.servo_rack', -0.02, 0.22), ('MNT.controls.pc', 0.14, 0.16),
              ('MNT.head.spindles', -0.18, -0.2), ('MNT.conveyor.rails', 0.18, -0.08)],
    'cut': [('MNT.controls.vacuum', 0.17, 0.02), ('MNT.controls.pc', 0.12, 0.15), ('MNT.controls.servo_rack', -0.2, 0.12),
            ('MNT.bed.casting', 0.2, -0.08), ('MNT.head.spindles', -0.2, -0.2)],
    'head': [('MNT.head.nozzles', -0.18, 0.14), ('MNT.head.camera', 0.14, -0.1), ('MNT.gantry.beam', 0.1, -0.2),
             ('MNT.board.pcb', 0.16, 0.12), ('MNT.tooling.nozzle_changer', -0.12, 0.06)],
}

data = json.load(open(A.anchors))
img = Image.open(A.render).convert('RGBA')
W, H = img.size
s = W / 1920
over = Image.new('RGBA', img.size, (0, 0, 0, 0)); d = ImageDraw.Draw(over)
f_ar = ImageFont.truetype(A.ar_font, int(30 * s), layout_engine=ImageFont.Layout.RAQM)
f_en = ImageFont.truetype(A.en_font, int(18 * s))
f_tag_ar = ImageFont.truetype(A.ar_font, int(34 * s), layout_engine=ImageFont.Layout.RAQM)
f_tag_en = ImageFont.truetype(A.en_bold, int(19 * s))
f_small = ImageFont.truetype(A.en_font, int(15 * s))
f_small_ar = ImageFont.truetype(A.ar_font, int(19 * s), layout_engine=ImageFont.Layout.RAQM)
INK, MUTED, CARD, LINE, BLUE = (14, 20, 34, 255), (86, 94, 110, 255), (255, 255, 255, 236), (14, 20, 34, 200), (20, 40, 160, 255)

def ar(draw, xy, text, font, fill, anchor='ra'):
    draw.text(xy, text, font=font, fill=fill, anchor=anchor, direction='rtl', language='ar')

view = data['shot'] if data['shot'] == 'head' else data['state']
for pid, fx, fy in LAYOUT.get(view, []):
    a = data['anchors'].get(pid)
    if not a or pid not in TEXT: continue
    t_ar, t_en = TEXT[pid]
    ax, ay = a['x'], a['y']
    lx, ly = ax + fx * W, ay + fy * W
    pad = 14 * s
    w_ar = d.textlength(t_ar, font=f_ar, direction='rtl', language='ar'); w_en = d.textlength(t_en, font=f_en)
    bw = max(w_ar, w_en) + 2 * pad; bh = 92 * s
    bx = min(max(lx - bw / 2, 24 * s), W - bw - 24 * s); by = min(max(ly - bh / 2, 24 * s), H - bh - 120 * s)
    # leader: from the anchor to the nearest edge of the card
    ex = min(max(ax, bx), bx + bw); ey = by + bh if ay > by + bh else (by if ay < by else ay)
    d.line([(ax, ay), (ex, ey)], fill=LINE, width=max(1, int(2 * s)))
    r = 7 * s
    d.ellipse([ax - r, ay - r, ax + r, ay + r], fill=(255, 255, 255, 255), outline=BLUE, width=max(2, int(3 * s)))
    d.ellipse([ax - r * 0.35, ay - r * 0.35, ax + r * 0.35, ay + r * 0.35], fill=BLUE)
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=6 * s, fill=CARD, outline=(14, 20, 34, 40), width=1)
    d.rectangle([bx + bw - 4 * s, by + 10 * s, bx + bw, by + bh - 10 * s], fill=BLUE)
    ar(d, (bx + bw - pad, by + 6 * s), t_ar, f_ar, INK)
    d.text((bx + bw - pad, by + bh - 10 * s), t_en, font=f_en, fill=MUTED, anchor="rd")

# view tag, top right (Arabic reads first), and the honest footer
t_ar, t_en = STATE.get(data['state'], ('', ''))
if data['shot'] == 'head': t_ar, t_en = 'رأس التركيب من قريب', 'Placement head, close-up'
tw = max(d.textlength(t_ar, font=f_tag_ar, direction='rtl', language='ar'), d.textlength(t_en, font=f_tag_en)) + 40 * s
d.rounded_rectangle([W - tw - 32 * s, 32 * s, W - 32 * s, 32 * s + 92 * s], radius=6 * s, fill=(14, 20, 34, 225))
ar(d, (W - 52 * s, 42 * s), t_ar, f_tag_ar, (255, 255, 255, 255))
d.text((W - 52 * s, 112 * s), t_en, font=f_tag_en, fill=(170, 190, 255, 255), anchor="rd")
foot_ar = 'ماكينة تركيب القطع · خط اللوح الإلكتروني ٤ · مصنع EG-01 (مصنع خيالي)'
foot_en = 'SMD placement machine, Mounter B, line SMD-4, Plant EG-01 (fictional). Illustrative reconstruction, not a vendor model.'
d.rectangle([0, H - 84 * s, W, H], fill=(14, 20, 34, 200))
ar(d, (W - 32 * s, H - 76 * s), foot_ar, f_small_ar, (255, 255, 255, 255))
d.text((W - 32 * s, H - 14 * s), foot_en, font=f_small, fill=(190, 198, 214, 255), anchor="rd")
Image.alpha_composite(img, over).convert('RGB').save(A.out, quality=92)
print('WROTE', A.out)
