# 12.221 çekim özeti: oturum klasöründeki her çekimin kare sayısı, patlama karesi, ses süresi (ses kayması denetimi: ses = kare / 60 sn olmalı).
#   python3 scripts/cineshots.py /tmp/wb-cine2/shots/gece
import sys, os, json, wave
root = sys.argv[1]
for d in sorted(os.listdir(root)):
    p = os.path.join(root, d)
    if not os.path.isdir(p) or not os.path.exists(f'{p}/meta.json'): continue
    m = json.load(open(f'{p}/meta.json'))
    au = None
    if os.path.exists(f'{p}/ses.wav'):
        with wave.open(f'{p}/ses.wav') as w: au = w.getnframes() / w.getframerate()
    vd = m['frames'] / 60
    slow = min((o['ts'] for o in m.get('ov', [])), default=1)
    print(f"{d:22s} kare {m['frames']:5d} ({vd:6.2f} sn)  patlama {m.get('boomAt', -1):5d}  ses {au if au is None else round(au, 3)} sn  fark {'-' if au is None else f'{(au - vd) * 1000:+.0f} ms'}  yavaş {slow}")
    # patlama çekimi: ses zarfının en büyük sıçraması (20 ms pencere) patlama karesine denk mi
    if au and m.get('boomAt', -1) > 0:
        import numpy as np
        with wave.open(f'{p}/ses.wav') as w: a = np.frombuffer(w.readframes(w.getnframes()), np.int16).reshape(-1, 2).astype(np.float32).mean(1)
        win = 960; e = np.sqrt(np.convolve(a * a, np.ones(win) / win, 'valid')[::win // 4] + 1)
        on = np.diff(np.log(e)); t0 = m['boomAt'] / 60; i0 = int((t0 - 0.5) * 200); i1 = int((t0 + 0.5) * 200)
        k = i0 + int(np.argmax(on[max(0, i0):i1])); print(f"{'':22s} patlama karesi {t0:.3f} sn · sesteki en sert sıçrama {k / 200:.3f} sn (fark {(k / 200 - t0) * 1000:+.0f} ms)")
