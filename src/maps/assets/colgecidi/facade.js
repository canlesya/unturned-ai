import { T_FLOOR } from './layout.js';
import { CK } from '../common/cgSurface.js';
import { NC, shade, cgWindow, cgDoor, cgAwning, cgLamp, cgPipe, cgAC, DOOR_COL, CLOTH_COL } from '../common/cgKit.js';

// Cephe süsü (12.171): bina kütlelerinin SOKAĞA bakan yüzlerine modüller — korniş + kiriş uçları (çatı hattı), pencere (kepenk / parmaklık / perde),
// kapı (taş söve, eşik), tente, yağmur borusu, lamba, klima. Hepsi yüze yapışık, çarpışmasız (kapı eşiği hariç) ve ≤ 0,12 m taşar (erişilebilir bantta);
// önü dolu (kapı / köprü / kasa / korkuluk / yükselen zemin) dilime ya da çatılı geçide kapı / pencere / tente konmaz. Kararlı (tohumlu) rastgelelik.
const LIGHT = '#e2c995', BEAM = '#6e5236';
const SN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const RY = [Math.PI / 2, -Math.PI / 2, 0, Math.PI];          // yerel +z → dış normal

export function decorateFacades(b, T, L, faces, { blocked, roofed, wallColorOf, noDecor = () => false }) {
  const hq = (a, c, d) => { const v = Math.sin((a * 127.1 + c * 311.7 + d * 74.7) * 12.9898) * 43758.5453; return v - Math.floor(v); };
  let nWin = 0, nDoor = 0, nAwn = 0;
  faces.forEach((f, fi) => {
    const [nx, nz] = SN[f.s], ux = f.b[0] - f.a[0], uz = f.b[1] - f.a[1], len = Math.hypot(ux, uz), dx = ux / len, dz = uz / len;
    if (len < 1.4) return;
    const oid = 'cephe:' + (f.id < 0 ? 'çevre' : f.id) + ':' + fi;
    b.obj(oid, () => {
      // korniş bandı (tüm yüz boyunca, tepeden 0,55 aşağıda) — yalnız tepe ≥ 3,5 m ise
      const H0 = f.y1 - f.y0;
      if (H0 > 3.0) {
        const mx = (f.a[0] + f.b[0]) / 2, mz = (f.a[1] + f.b[1]) / 2;
        b.with(mx, 0, mz, RY[f.s], () => {
          b.box(0, f.y1 - 0.62, 0.06, len, 0.22, 0.12, LIGHT, { collide: false, kind: CK.COPING });
          b.box(0, f.y1 - 0.4, 0.03, len, 0.06, 0.06, shade(LIGHT, 0.86), { collide: false, kind: CK.COPING });
          if (f.street && len > 3 && hq(fi, 1, 0) < 0.4 && H0 > 4.5) for (let t = -len / 2 + 0.6; t < len / 2 - 0.4; t += 1.05) b.box(t, f.y1 - 1.05, 0.18, 0.18, 0.18, 0.36, BEAM, { collide: false, kind: CK.WOOD });   // kiriş uçları
        });
      }
      if (!f.street) return;
      const nb = Math.max(1, Math.round(len / 3.2)), seg = len / nb;
      for (let s = 0; s < nb; s++) {
        const t = (s + 0.5) * seg, wx = f.a[0] + dx * t, wz = f.a[1] + dz * t;
        const g = T.heightAt(wx + nx * 0.3, wz + nz * 0.3), H = f.y1 - g;
        if (noDecor(wx, wz)) continue;
        const edgeOk = (need) => t >= need && len - t >= need;
        const clear = (hw, dep, y0, y1) => !blocked(wx, wz, nx, nz, dx, dz, hw, dep, y0, y1);
        const flat = (hw) => Math.abs(T.heightAt(wx + nx * 0.3 + dx * hw, wz + nz * 0.3 + dz * hw) - g) < 0.04 && Math.abs(T.heightAt(wx + nx * 0.3 - dx * hw, wz + nz * 0.3 - dz * hw) - g) < 0.04;
        const r = hq(fi, s, 3), cov = roofed(wx + nx * 0.6, wz + nz * 0.6);
        b.with(wx, g, wz, RY[f.s], () => {
          // kapı (zemin katta)
          let door = false;
          if (!cov && H > 3.6 && seg > 2.2 && r < 0.2 && edgeOk(1.2) && flat(0.8) && clear(1.0, 1.3, g + 0.05, g + 2.7)) {
            const col = DOOR_COL[Math.floor(hq(fi, s, 4) * DOOR_COL.length)];
            const cl = hq(fi, s, 8) < 0.3 ? CLOTH_COL[Math.floor(hq(fi, s, 10) * CLOTH_COL.length)] : null;
            b.obj(oid + ':kapı:' + s, () => cgDoor(b, { w: 1.3, h: 2.45, color: col, arch: hq(fi, s, 5) < 0.35, cloth: cl }));
            door = true; nDoor++;
            if (hq(fi, s, 6) < 0.5 && clear(1.4, 1.2, g + 2.8, g + 3.6)) { b.with(0, 0, 0.0, 0, () => cgAwning(b, { w: 2.2, depth: 0.9, y: 3.05, cols: [['#b5402e', '#ecdcb6'], ['#2d6fa8', '#ecdcb6'], ['#c58a2a', '#ecdcb6'], ['#2f7a6e', '#ecdcb6']][Math.floor(hq(fi, s, 7) * 4)] })); nAwn++; }
          }
          // pencereler: üst katlar (zeminden 2,9 m ve 5,9 m)
          for (const wy of [2.9, 5.9]) {
            if (H < wy + 2.3 || seg < 2.2 || !edgeOk(1.1) || cov && wy < 4) continue;
            if (hq(fi, s, wy) > 0.62) continue;
            if (!clear(0.95, 0.6, g + wy - 0.4, g + wy + 1.8) || !flat(0.75)) continue;
            b.obj(oid + ':pencere:' + s + ':' + wy, () => cgWindow(b, { y: wy, w: 1.05, h: 1.45, style: Math.floor(hq(fi, s, wy + 1) * 4), seed: Math.floor(hq(fi, s, wy + 2) * 6) }));
            nWin++;
            if (wy < 4 && !door && hq(fi, s, 9) < 0.18 && clear(1.3, 1.1, g + wy + 1.6, g + wy + 2.5)) { cgAwning(b, { w: 1.8, depth: 0.75, y: wy + 1.75, cols: ['#2f7a6e', '#e8dcc0'] }); nAwn++; }
          }
          // klima / lamba / boru
          if (H > 4.2 && hq(fi, s, 11) < 0.12 && clear(0.6, 0.6, g + 3.6, g + 4.4) && !door) b.with(seg * 0.28, 0, 0, 0, () => cgAC(b, { y: 3.7 }));
          if (!cov && H > 3.6 && hq(fi, s, 12) < 0.14 && clear(0.3, 0.4, g + 2.4, g + 3.2)) b.with(door ? 1.05 : -seg * 0.3, 0, 0, 0, () => cgLamp(b, { y: 2.85 }));
          if (H > 3.2 && hq(fi, s, 13) < 0.12 && (s === 0 || s === nb - 1) && clear(0.15, 0.3, g + 0.1, g + H - 0.5)) b.with((s === 0 ? -1 : 1) * (seg / 2 - 0.3), 0, 0, 0, () => cgPipe(b, { h: H - 0.65 }));
        });
      }
    });
  });
  return { nWin, nDoor, nAwn };
}
