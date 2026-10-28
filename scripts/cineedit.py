# 12.217 Tanıtım videosu kurgusu: çekim karelerinden (scripts/cinerec.mjs) zaman çizelgesi, geçişler (kesme / çapraz / siyaha), dürbün örtüsü,
# sinema şeridi, oyunun yazı stiliyle (Arial Narrow Bold Italic = Mac'te HUD yazısı, turuncu #ff8a1f) başlık kartları, açılış / kapanış logosu,
# ses: çekimlerin oyun sesi + scripts/cinemusic.mjs müziği. ffmpeg'e ham kare akıtılır (libx264, 60 fps).
#   python3 scripts/cineedit.py full tr   ·  full en  ·  short tr  ·  vert tr      (çıktı /tmp/wb-cine/)
import sys, os, json, math, subprocess, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

CUT, LANG = (sys.argv[1] if len(sys.argv) > 1 else 'full'), (sys.argv[2] if len(sys.argv) > 2 else 'tr')
ROOT = os.environ.get('SHOTS', '/tmp/wb-cine/shots'); OUTD = os.environ.get('OUTD', '/tmp/wb-cine')
HERE = os.path.dirname(os.path.abspath(__file__))
FPS, SR = 60, 48000
VERT = CUT == 'vert'
W, H = (1080, 1920) if VERT else (1920, 1080)
F_BI = '/System/Library/Fonts/Supplemental/Arial Narrow Bold Italic.ttf'
F_B = '/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf'
ORANGE, ORANGE2, WHITE = (255, 138, 31), (255, 179, 71), (240, 244, 250)

TXT = {
  'tr': {
    'kv': 'KUZEY VADİSİ', 'big': ("128'E 128 DEV SAVAŞLAR", None), 'heli': ('HELİKOPTER', None), 'tank': ('TANK', None), 'jip': ('JİP', None), 'motor': ('MOTOR', None),
    'kule': ('KULELER VE SABİT SİLAHLAR', None), 'keskin': ('KESKİN NİŞANCI', None), 'manga': ('MANGAN İLE SAVAŞ', 'ARKADAŞININ YANINDA DOĞ'),
    'bayrak': ('BAYRAKLARI ELE GEÇİR, SAVUN', None), 'gece': ('GÜNDÜZ · GÜN BATIMI · GECE', None), 'tarayici': ('TARAYICIDA, İNDİRMEDEN', None),
    'end1': 'warbyte.io', 'end2': 'TARAYICIDA ÜCRETSİZ OYNA', 'arac': ('HELİKOPTER · TANK · JİP · MOTOR', None),
  },
  'en': {
    'kv': 'NORTH VALLEY', 'big': ('128 VS 128 MASSIVE BATTLES', None), 'heli': ('HELICOPTERS', None), 'tank': ('TANKS', None), 'jip': ('JEEPS', None), 'motor': ('DIRT BIKES', None),
    'kule': ('WATCHTOWERS AND MOUNTED GUNS', None), 'keskin': ('SNIPERS', None), 'manga': ('FIGHT WITH YOUR SQUAD', 'SPAWN ON YOUR SQUADMATES'),
    'bayrak': ('CAPTURE AND HOLD THE FLAGS', None), 'gece': ('DAY · SUNSET · NIGHT', None), 'tarayici': ('IN YOUR BROWSER. NO DOWNLOAD.', None),
    'end1': 'warbyte.io', 'end2': 'PLAY FREE IN YOUR BROWSER', 'arac': ('HELICOPTERS · TANKS · JEEPS · BIKES', None),
  },
}[LANG]

# ── kurgu planı: (çekim, giriş sn, süre sn, geçiş, metin, metin başlangıcı (klip içi), metin süresi) ──
# geçiş: cut | x (0,35 sn çapraz) | b (siyahtan) ; çekim adı 'oturum/ad'
P = {
  'full': [
    ('gold/acilis', 0.3, 7.0, 'b', 'big', 3.6, 3.0),
    ('gold/heli', 0.8, 4.4, 'cut', 'heli', 0.5, 2.6),
    ('gold/tank', 0.4, 4.6, 'cut', 'tank', 0.5, 2.6),
    ('gold/jip', 0.3, 3.8, 'cut', 'jip', 0.4, 2.4),
    ('gold/motor', 0.3, 4.0, 'cut', 'motor', 0.4, 2.6),
    ('gold/saldiri', 0.3, 6.0, 'x', None, 0, 0),
    ('gold/duello', 0.1, 3.2, 'cut', None, 0, 0),
    ('gold/kule', 0.3, 5.0, 'x', 'kule', 0.5, 3.0),
    ('gold/keskin', 0.1, 4.0, 'cut', 'keskin', 0.5, 2.8),
    ('gold/durbun', 0.2, 3.8, 'cut', None, 0, 0),
    ('gold/manga', 0.3, 5.5, 'x', 'manga', 0.5, 3.4),
    ('gold/bayrak', 0.3, 5.5, 'cut', 'bayrak', 0.5, 3.2),
    ('night/gece-tank', 0.3, 5.0, 'x', 'gece', 0.6, 3.0),
    ('gold/patlama', -1, 5.6, 'cut', None, 0, 0),
    ('gold/kapanis', 0.3, 6.0, 'x', 'tarayici', 1.6, 3.6),
  ],
  'short': [
    ('gold/acilis', 0.3, 3.6, 'b', None, 0, 0),
    ('gold/kapanis', 0.5, 2.6, 'cut', 'big', 0.25, 2.2),
    ('gold/heli', 1.0, 2.0, 'cut', 'arac', 0.2, 6.8),
    ('gold/tank', 1.4, 1.8, 'cut', None, 0, 0),
    ('gold/jip', 0.6, 1.4, 'cut', None, 0, 0),
    ('gold/motor', 0.5, 1.6, 'cut', None, 0, 0),
    ('gold/saldiri', 0.8, 2.4, 'cut', None, 0, 0),
    ('gold/kule', 0.5, 2.0, 'cut', 'kule', 0.2, 1.7),
    ('gold/durbun', 0.4, 2.0, 'cut', 'keskin', 0.2, 1.7),
    ('gold/bayrak', 0.5, 2.2, 'cut', 'bayrak', 0.2, 1.9),
    ('night/gece-tank', 0.5, 2.0, 'cut', None, 0, 0),
    ('gold/patlama', -1, 3.4, 'cut', None, 0, 0),
  ],
}
P['vert'] = P['short']
PLAN = P['short' if VERT else CUT]
TITLE = 3.4 if CUT == 'full' else 2.6          # açılış logosu (ilk çekimin üstünde)
ENDC = 5.0 if CUT == 'full' else 3.0           # kapanış kartı (siyah)
XF = 0.35

def meta(name):
    d = None
    sess, n = name.split('/')
    for x in sorted(os.listdir(f'{ROOT}/{sess}')):
        if x.endswith('-' + n) and os.path.isdir(f'{ROOT}/{sess}/{x}'): d = f'{ROOT}/{sess}/{x}'
    m = json.load(open(f'{d}/meta.json')); m['dir'] = d
    return m

def read_wav(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).astype(np.float32) / 32768
    return a

# ── zaman çizelgesi ──
clips, t = [], 0.0
for i, (name, tin, dur, tr, tk, ts, td) in enumerate(PLAN):
    m = meta(name)
    if tin < 0:                                                            # patlama: patlamadan 3 sn önce başla
        tin = max(0, m['boomAt'] / FPS - 3.0)
    maxd = m['frames'] / FPS - tin
    dur = min(dur, maxd - 0.02)
    ov = XF if tr == 'x' and clips else 0
    start = t - ov
    clips.append(dict(name=name, m=m, tin=tin, dur=dur, tr=tr, start=start, ov=ov, text=tk, ts=ts, td=td))
    t = start + dur
end_start = t
TOTAL = end_start + ENDC
NF = int(round(TOTAL * FPS))
print(f'[{CUT}/{LANG}] {len(clips)} çekim, {TOTAL:.1f} sn, {NF} kare')

# ── metin kartları (bir kez çizilir; karede kaydırma + saydamlık) ──
def font(p, s): return ImageFont.truetype(p, s)
def spaced(draw, xy, s, f, fill, sp):
    x, y = xy
    for ch in s:
        draw.text((x, y), ch, font=f, fill=fill); x += draw.textlength(ch, font=f) + sp
    return x
def spaced_w(s, f, sp):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    return sum(d.textlength(ch, font=f) + sp for ch in s) - sp
def card(l1, l2, scale=1.0, center=False):
    f1, f2 = font(F_BI, int(118 * scale)), font(F_BI, int(66 * scale))
    sp1, sp2 = int(4 * scale), int(5 * scale)
    w1 = spaced_w(l1, f1, sp1); w2 = spaced_w(l2, f2, sp2) if l2 else 0
    cw, ch = int(max(w1, w2) + 120 * scale), int((330 if l2 else 220) * scale)
    im = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x0 = int(40 * scale) if not center else int((cw - w1) / 2)
    bar = [(x0 + 10 * scale, 18 * scale), (x0 + 150 * scale, 18 * scale), (x0 + 140 * scale, 30 * scale), (x0, 30 * scale)]      # eğik turuncu şerit (menü "OYNA" düğmesi gibi)
    if center: bar = [(cw / 2 - 70 * scale + 10 * scale, 18 * scale), (cw / 2 + 70 * scale, 18 * scale), (cw / 2 + 60 * scale, 30 * scale), (cw / 2 - 70 * scale, 30 * scale)]
    d.polygon(bar, fill=ORANGE + (255,))
    y1 = int(40 * scale)
    spaced(d, (x0, y1), l1, f1, WHITE + (255,), sp1)
    if l2:
        x2 = x0 if not center else int((cw - w2) / 2)
        spaced(d, (x2, y1 + int(128 * scale)), l2, f2, ORANGE2 + (255,), sp2)
    sh = im.split()[3].filter(ImageFilter.GaussianBlur(10 * scale))         # yumuşak gölge
    shadow = Image.new('RGBA', im.size, (0, 0, 0, 0)); shadow.putalpha(sh.point(lambda v: int(v * 0.75)))
    out = Image.alpha_composite(shadow, im)
    return out
def logo(scale=1.0, sub=None):
    f = font(F_BI, int(230 * scale)); fs = font(F_B, int(40 * scale))
    d0 = ImageDraw.Draw(Image.new('L', (1, 1)))
    wa, wb = d0.textlength('WAR', font=f), d0.textlength('BYTE', font=f)
    cw, ch = int(wa + wb + 140 * scale), int(400 * scale)
    im = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x = (cw - wa - wb) / 2
    d.text((x, 20 * scale), 'WAR', font=f, fill=WHITE + (255,)); d.text((x + wa, 20 * scale), 'BYTE', font=f, fill=ORANGE + (255,))
    if sub:
        sw = spaced_w(sub, fs, int(14 * scale)); spaced(d, ((cw - sw) / 2, 300 * scale), sub, fs, (220, 226, 236, 255), int(14 * scale))
        d.rectangle([cw / 2 - 60 * scale, 282 * scale, cw / 2 + 60 * scale, 286 * scale], fill=ORANGE + (255,))
    glow = im.split()[3].filter(ImageFilter.GaussianBlur(24 * scale)); g = Image.new('RGBA', im.size, (0, 0, 0, 0)); g.putalpha(glow.point(lambda v: int(v * 0.8)))
    return Image.alpha_composite(g, im)
def endcard(scale=1.0):
    lg = logo(scale)
    f1, f2 = font(F_BI, int(84 * scale)), font(F_B, int(52 * scale))
    cw, ch = max(lg.width, int(1100 * scale)), int(lg.height + 230 * scale)
    im = Image.new('RGBA', (cw, ch), (0, 0, 0, 0)); im.alpha_composite(lg, ((cw - lg.width) // 2, 0)); d = ImageDraw.Draw(im)
    w1 = d.textlength(TXT['end1'], font=f1); d.text(((cw - w1) / 2, lg.height - 40 * scale), TXT['end1'], font=f1, fill=WHITE + (255,))
    w2 = spaced_w(TXT['end2'], f2, int(8 * scale)); spaced(d, ((cw - w2) / 2, lg.height + 70 * scale), TXT['end2'], f2, ORANGE2 + (255,), int(8 * scale))
    return im

SC = 0.82 if VERT else 1.0
CARDS = {k: card(*TXT[k], scale=SC, center=VERT) for k in ('big', 'heli', 'tank', 'jip', 'motor', 'kule', 'keskin', 'manga', 'bayrak', 'gece', 'tarayici', 'arac') if True}
MAXW = W - 60 if VERT else W - 240                                          # uzun satır kadraja sığsın (dikey: tam genişlik, yatay: sol boşluk 120)
for k, im in list(CARDS.items()):
    if im.width > MAXW: CARDS[k] = im.resize((MAXW, int(im.height * MAXW / im.width)), Image.LANCZOS)
LOGO = logo(0.62 if VERT else 1.0, TXT['kv']); END = endcard(0.62 if VERT else 0.9)

def ease(x): x = min(1, max(0, x)); return x * x * (3 - 2 * x)
def put(base, im, x, y, a):
    if a <= 0.003: return
    if a < 0.999:
        im = im.copy(); al = im.split()[3].point(lambda v: int(v * a)); im.putalpha(al)
    base.alpha_composite(im, (int(x), int(y)))

# dürbün örtüsü (yalnız 16:9 boyut; dikeyde de ortada aynı daire)
def scope_mask(w, h):
    m = Image.new('RGBA', (w, h), (0, 0, 0, 255)); d = ImageDraw.Draw(m)
    r = int(min(w, h) * 0.47); cx, cy = w // 2, h // 2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 0))
    ring = Image.new('L', (w, h), 0); dr = ImageDraw.Draw(ring); dr.ellipse([cx - r - 6, cy - r - 6, cx + r + 6, cy + r + 6], fill=255); dr.ellipse([cx - r + 40, cy - r + 40, cx + r - 40, cy + r - 40], fill=0)
    ring = ring.filter(ImageFilter.GaussianBlur(26)); vig = Image.new('RGBA', (w, h), (0, 0, 0, 0)); vig.putalpha(ring.point(lambda v: int(v * 0.7)))
    m = Image.alpha_composite(vig, m) if False else Image.alpha_composite(m, vig)
    d = ImageDraw.Draw(m); c = (10, 10, 10, 235)
    d.line([cx - r, cy, cx - 26, cy], fill=c, width=2); d.line([cx + 26, cy, cx + r, cy], fill=c, width=2); d.line([cx, cy + 26, cx, cy + r], fill=c, width=2); d.line([cx, cy - r, cx, cy - 26], fill=c, width=2)
    d.line([cx - r, cy, cx - int(r * 0.55), cy], fill=c, width=7); d.line([cx + int(r * 0.55), cy, cx + r, cy], fill=c, width=7); d.line([cx, cy + int(r * 0.55), cx, cy + r], fill=c, width=7)
    for k in range(1, 6):
        o = int(k * r * 0.085); d.line([cx - 7, cy + o, cx + 7, cy + o], fill=c, width=2); d.line([cx + o, cy - 6, cx + o, cy + 6], fill=c, width=2); d.line([cx - o, cy - 6, cx - o, cy + 6], fill=c, width=2)
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(200, 30, 20, 230))
    return m
SCOPE = scope_mask(W, H)

cache = {}
def shot_frame(c, k):
    idx = min(c['m']['frames'] - 1, int(round(c['tin'] * FPS)) + k)
    p = f"{c['m']['dir']}/f{idx:06d}.jpg"
    im = Image.open(p).convert('RGB')
    if VERT:
        cw = int(round(1080 * 9 / 16)); x0 = (1920 - cw) // 2
        im = im.crop((x0, 0, x0 + cw, 1080)).resize((W, H), Image.BICUBIC)
    sc = c['m']['ov'][idx]['scope'] if idx < len(c['m']['ov']) else 0
    im = im.convert('RGBA')
    if sc: im.alpha_composite(SCOPE)
    return im

LB = 0 if VERT else 96                                                      # sinema şeridi (≈ 2,2:1)
def frame(k):
    tt = k / FPS
    base = None
    act = [c for c in clips if c['start'] - 1e-6 <= tt < c['start'] + c['dur']]
    for c in act:
        kk = int(round((tt - c['start']) * FPS))
        im = shot_frame(c, kk)
        a = 1.0
        if c['ov'] > 0 and tt < c['start'] + c['ov']: a = ease((tt - c['start']) / c['ov'])
        if c['tr'] == 'b': im = Image.blend(Image.new('RGBA', im.size, (0, 0, 0, 255)), im, ease((tt - c['start']) / 1.4))
        base = im if base is None or a >= 0.999 else Image.blend(base, im, a)
    if base is None: base = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    # açılış: logo (ilk çekimin üstünde), çekim hafif karartılır
    if tt < TITLE + 0.8:
        k1 = ease((tt - 0.35) / 0.9) * (1 - ease((tt - TITLE) / 0.7))
        if k1 > 0:
            base = Image.blend(base, Image.new('RGBA', (W, H), (0, 0, 0, 255)), 0.45 * k1)
            s = 1.0 + 0.05 * (1 - ease(tt / (TITLE + 0.6)))
            lg = LOGO if abs(s - 1) < 0.002 else LOGO.resize((int(LOGO.width * s), int(LOGO.height * s)), Image.BICUBIC)
            put(base, lg, (W - lg.width) / 2, (H - lg.height) / 2 - (40 if not VERT else 60), k1)
    # metin kartları
    for c in clips:
        if not c['text']: continue
        t0 = c['start'] + c['ts']; t1 = t0 + c['td']
        if t0 - 0.01 <= tt <= t1 + 0.5:
            im = CARDS[c['text']]
            a = ease((tt - t0) / 0.35) * (1 - ease((tt - t1) / 0.45))
            dx = (1 - ease((tt - t0) / 0.5)) * -46 + ease((tt - t1) / 0.45) * 30
            if VERT: put(base, im, (W - im.width) / 2 + dx * 0.5, H * 0.70, a)
            else: put(base, im, 120 + dx, H - LB - im.height - 40, a)
    # kapanış kartı
    if tt >= end_start - 0.6:
        kb = ease((tt - end_start + 0.6) / 0.6)
        base = Image.blend(base, Image.new('RGBA', (W, H), (0, 0, 0, 255)), kb)
        ke = ease((tt - end_start - 0.3) / 0.8) * (1 - ease((tt - TOTAL + 0.9) / 0.8))
        put(base, END, (W - END.width) / 2, (H - END.height) / 2, ke)
    if LB:
        d = ImageDraw.Draw(base); d.rectangle([0, 0, W, LB], fill=(0, 0, 0, 255)); d.rectangle([0, H - LB, W, H], fill=(0, 0, 0, 255))
    return base.convert('RGB')

# ── ses ──
def build_audio(music_path):
    n = int(TOTAL * SR) + SR
    game = np.zeros((n, 2), np.float32)
    for c in clips:
        wp = f"{c['m']['dir']}/ses.wav"
        if not os.path.exists(wp): continue
        a = read_wav(wp)
        want = int(round(c['m']['frames'] / FPS * SR))                     # eski kayıtlar: ses kare başına 768 örnek ilerlemişti (800 yerine) → süreye ger
        if abs(len(a) - want) > SR * 0.02:
            x = np.linspace(0, len(a) - 1, want); a = np.stack([np.interp(x, np.arange(len(a)), a[:, ch]) for ch in (0, 1)], 1).astype(np.float32)
        i0 = int(c['tin'] * SR); seg = a[i0:i0 + int(c['dur'] * SR)].copy()
        L = len(seg)
        if L == 0: continue
        fi = int(max(c['ov'], 0.08) * SR); fo = int(0.08 * SR)
        if c['tr'] == 'b': fi = int(1.2 * SR)
        seg[:fi] *= np.linspace(0, 1, min(fi, L))[:, None][:L]
        seg[-fo:] *= np.linspace(1, 0, min(fo, L))[:, None]
        j = int(c['start'] * SR); game[j:j + L] += seg[: max(0, min(L, n - j))]
    pk = np.max(np.abs(game)) + 1e-9
    game *= min(1.0, 0.7 / pk) if pk > 0.7 else 1.0
    mus = read_wav(music_path); mus = np.pad(mus, ((0, max(0, n - len(mus))), (0, 0)))[:n]
    # müzik: başlık / kapanışta öne, aksiyonda oyun sesinin altında
    env = np.full(n, 0.55, np.float32); ts = np.arange(n) / SR
    env[ts < TITLE] = 0.9; env[ts >= end_start] = 0.95
    env = np.convolve(env, np.ones(SR // 4) / (SR // 4), mode='same')
    mix = game * 0.95 + mus * env[:, None]
    mix *= 0.93 / (np.max(np.abs(mix)) + 1e-9)
    mix = mix[: int(TOTAL * SR)]
    fade = int(0.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return mix

def write_wav(p, a):
    with wave.open(p, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes())

tag = {'full': 'warbyte-tanitim', 'short': 'warbyte-tanitim-30sn', 'vert': 'warbyte-tanitim-dikey'}[CUT] + ('' if LANG == 'tr' else '-en')
BUILD = f'{OUTD}/build'; os.makedirs(BUILD, exist_ok=True)
# müzik işaretleri
cues = dict(dur=TOTAL, bpm=100, pulse=0.0, drums=clips[1]['start'] if len(clips) > 1 else 3, end=end_start,
            hits=[{'t': 0.35, 'ch': [26, 38, 45, 50, 57]}] + [{'t': c['start'] + c['ts']} for c in clips if c['text']] + [{'t': end_start, 'big': True}],
            risers=[], brk=None)
for c in clips:
    if c['name'].endswith('patlama'):
        b0 = c['start'] + (c['m']['boomAt'] / FPS - c['tin'] if c['m']['boomAt'] > 0 else 2.5)
        cues['risers'].append([max(0, c['start'] - 1.6), c['start']]); cues['brk'] = [c['start'], c['start'] + c['dur']]
        cues['hits'].append({'t': b0, 'big': True, 'ch': [26, 38, 45, 50]})
cues['risers'].append([end_start - 1.8, end_start])
json.dump(cues, open(f'{BUILD}/cues-{CUT}.json', 'w'))
mw = f'{BUILD}/muzik-{CUT}.wav'
subprocess.run(['node', f'{HERE}/cinemusic.mjs', f'{BUILD}/cues-{CUT}.json', mw], check=True)
aw = f'{BUILD}/ses-{tag}.wav'; write_wav(aw, build_audio(mw))

out = f'{OUTD}/{tag}.mp4'
ff = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', '-i', aw,
                       '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
                       '-c:a', 'aac', '-b:a', '192k', '-shortest', out], stdin=subprocess.PIPE)
for k in range(NF):
    ff.stdin.write(frame(k).tobytes())
    if k % 600 == 0: print(f'  {k}/{NF}', flush=True)
ff.stdin.close(); ff.wait()
json.dump({'out': out, 'total': TOTAL, 'clips': [{'name': c['name'], 'start': round(c['start'], 2), 'dur': round(c['dur'], 2), 'text': c['text']} for c in clips]}, open(f'{BUILD}/{tag}.json', 'w'), indent=1)
print('çıktı', out, f'{TOTAL:.1f} sn')
