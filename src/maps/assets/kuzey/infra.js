import { KK } from './surface.js';
import { footY, shade, ctxAdd } from '../common/kuzeyKit.js';
import { KZ_LAKE } from './layout.js';

// Kuzey Vadisi altyapı parçaları (12.172): taş kemer köprü, çelik kafes köprü, baraj gövdesi, enerji nakil direği (+ tel verisi), ahşap elektrik direği.
// Köprü / baraj boyu araziden ölçülür (tabliye altında arazi kalan kısım + 1 m gömme). Tabliye ve altındaki gövde 'deck' etiketli (yol bulma suyun üstünden
// geçer; gövde kutuları tabliyenin altında kaldığı için hücreyi kapatmaz). Korkuluklar normal (kapatır).
// Kemer altı: 0,6 m dilimlerle basamaklı katı taş (görünen kemer = çarpışma); kafes köprüde çapraz çubuklar ince (0,22 m) görsel, dikmeler + üst başlık katı.
const STONE = '#8a8378', CONC = '#8f8c85', STEEL = '#4f5a63', ASPH = '#45474a';

// eksen boyunca araziden ölçülen açıklık: merkezden iki yöne, arazi tabliye − 0,15'e erişene dek
function spanOf(T, x, z, ax, deck, max = 140) {
  const at = (s) => (ax === 'z' ? T.heightAt(x, z + s) : T.heightAt(x + s, z));
  let a = 0, b = 0;
  while (a < max && at(-a) < deck - 0.15) a += 0.5;
  while (b < max && at(b) < deck - 0.15) b += 0.5;
  let w0 = 0, w1 = 0;                                                     // su kenarı (zemin < 0,4)
  while (w0 < a && at(-w0) < 0.4) w0 += 0.5;
  while (w1 < b && at(w1) < 0.4) w1 += 0.5;
  return { a: a + 1, b: b + 1, w0, w1 };
}

// ── Taş kemer köprü (eksen z) ──
export function stoneBridge(b, T, def) {
  const { x, z, deck, w } = def, S = spanOf(T, x, z, 'z', deck), z0 = z - S.a, z1 = z + S.b, L = z1 - z0;
  b.obj('köprü:' + def.id, () => b.with(x, 0, 0, 0, () => {
    b.box(0, deck - 0.75, (z0 + z1) / 2, w, 0.65, L, STONE, { kind: KK.STONE, tag: 'deck' });
    b.box(0, deck - 0.1, (z0 + z1) / 2, w - 1.2, 0.1, L, ASPH, { kind: KK.ASPH, tag: 'deck' });
    for (const sd of [-1, 1]) {
      b.box(sd * (w / 2 - 0.3), deck - 0.1, (z0 + z1) / 2, 0.6, 1.1, L, shade(STONE, 1.05), { kind: KK.STONE });       // korkuluk duvarı
      b.box(sd * (w / 2 - 0.3), deck + 1.0, (z0 + z1) / 2, 0.7, 0.12, L + 0.2, '#a39c90', { collide: false, kind: KK.STONE });
    }
    // su açıklığı kemerlere bölünür; iki uçta dolu taş ayak (abutment)
    const wa = z - S.w0, wb = z + S.w1, n = Math.max(1, Math.round((wb - wa) / 15)), sp = (wb - wa) / n, ys = 0.8, yc = deck - 1.6, under = deck - 0.75;
    const bedAt = (zz) => Math.min(T.heightAt(x - w / 2, zz), T.heightAt(x, zz), T.heightAt(x + w / 2, zz));
    for (const [za, zb] of [[z0, wa], [wb, z1]]) { if (zb - za < 0.2) continue; const fy = footY(T, x - w / 2, x + w / 2, za, zb); b.box(0, fy.min - 0.6, (za + zb) / 2, w, under - fy.min + 0.6, zb - za, STONE, { kind: KK.STONE, tag: 'deck' }); }
    for (let i = 0; i < n; i++) {
      const a0 = wa + i * sp, a1 = a0 + sp, pierW = 2.6, k0 = a0 + (i ? pierW / 2 : 0), k1 = a1 - (i < n - 1 ? pierW / 2 : 0);
      const SL = 0.6, m = Math.max(2, Math.round((k1 - k0) / SL));
      for (let j = 0; j < m; j++) {
        const t = (j + 0.5) / m, yy = ys + (yc - ys) * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
        b.box(0, yy, k0 + (j + 0.5) * (k1 - k0) / m, w, under - yy, (k1 - k0) / m, STONE, { kind: KK.STONE, tag: 'deck' });
      }
      b.box(0, yc - 0.05, (k0 + k1) / 2, w + 0.08, 0.5, 0.5, shade(STONE, 0.82), { collide: false, kind: KK.STONE });   // kilit taşı
      if (i < n - 1) {                                                   // ayak (pier) + selyaran
        const pz = a1, fy = bedAt(pz) - 0.6;
        b.box(0, fy, pz, w + 0.6, under - fy, pierW, shade(STONE, 0.94), { kind: KK.STONE, tag: 'deck' });
        for (const sd of [-1, 1]) b.box(sd * (w / 2 + 0.9), fy, pz, 1.2, ys + 0.6 - fy, pierW * 0.7, shade(STONE, 0.86), { kind: KK.STONE });
      }
    }
  }));
  return { z0, z1 };
}

// ── Çelik kafes köprü (eksen z) ──
export function trussBridge(b, T, def) {
  const { x, z, deck, w } = def, S = spanOf(T, x, z, 'z', deck), z0 = z - S.a, z1 = z + S.b, L = z1 - z0;
  b.obj('köprü:' + def.id, () => b.with(x, 0, 0, 0, () => {
    b.box(0, deck - 1.1, (z0 + z1) / 2, w, 0.9, L, STEEL, { kind: KK.METAL, tag: 'deck' });
    b.box(0, deck - 0.2, (z0 + z1) / 2, w - 0.8, 0.2, L, ASPH, { kind: KK.ASPH, tag: 'deck' });
    const panels = Math.max(4, Math.round(L / 6)), pl = L / panels, TH = 5.6;
    for (const sd of [-1, 1]) {
      const sx = sd * (w / 2 - 0.2);
      b.box(sx, deck - 0.2, (z0 + z1) / 2, 0.4, 0.7, L, STEEL, { kind: KK.METAL });                      // alt başlık / bordür
      b.box(sx, deck + TH - 0.45, (z0 + z1) / 2, 0.45, 0.45, L - pl, STEEL, { kind: KK.METAL });              // üst başlık
      for (let i = 0; i <= panels; i++) {
        const pz = z0 + i * pl, top = i === 0 || i === panels ? 0.5 : TH;
        b.box(sx, deck + 0.5, pz, 0.3, top - 0.5 + (top > 1 ? 0 : 0.01), 0.3, STEEL, { kind: KK.METAL });     // dikme
        if (i < panels) {
          const dz = pl, ang = Math.atan2(TH - 0.6, dz), len = Math.hypot(dz, TH - 0.6), up = i < panels / 2;
          b.box(sx, deck + 0.5 + (TH - 0.6) / 2 - 0.11, pz + dz / 2, 0.22, 0.22, len, shade(STEEL, 1.1), { collide: false, rx: up ? -ang : ang, kind: KK.METAL });
        }
      }
    }
    for (let i = 1; i < panels; i++) b.box(0, deck + TH - 0.4, z0 + i * pl, w - 0.4, 0.3, 0.3, STEEL, { kind: KK.METAL });   // üst enine kiriş
    for (const sd of [-1, 1]) { b.box(sd * (w / 2 - 0.45), deck + 0.5, (z0 + z1) / 2, 0.08, 0.7, L, '#6b757d', { kind: KK.METAL }); b.box(sd * (w / 2 - 0.45), deck + 1.15, (z0 + z1) / 2, 0.12, 0.08, L, '#6b757d', { collide: false, kind: KK.METAL }); }   // korkuluk (1,2 m: üstünden atlanmaz)
    // beton ayaklar (su içinde ~ her 22 m)
    const np = Math.max(1, Math.round(L / 22));
    for (let i = 1; i < np; i++) {
      const pz = z0 + i * L / np, fy = Math.min(T.heightAt(x, pz), T.heightAt(x - w / 2, pz), T.heightAt(x + w / 2, pz)) - 0.6;
      if (deck - 1.1 - fy > 0.4) b.box(0, fy, pz, w + 1.2, deck - 1.1 - fy, 2.4, CONC, { kind: KK.CONC, tag: 'deck' });
    }
  }));
  return { z0, z1 };
}

// ── Baraj (gövde z boyunca; menba yüzü +x düşey, mansap yüzü −x basamaklı eğim) ──
export function dam(b, T, D) {
  const S = spanOf(T, D.x, D.z, 'z', D.crest, 120), z0 = D.z - S.a - 2, z1 = D.z + S.b + 2, L = z1 - z0, up = D.x + D.thick / 2;
  b.obj('baraj', () => b.with(0, 0, (z0 + z1) / 2, 0, () => {
    const bed = -7.5;
    for (let y = bed; y < D.crest - 1.2; y += 2) {
      const yt = Math.min(D.crest - 1.2, y + 2), t = D.thick + (D.crest - yt) * 0.62;
      b.box(up - t / 2, y, 0, t, yt - y, L, '#9a978e', { kind: KK.CONC, tag: 'deck' });
    }
    b.box(up - D.thick / 2, D.crest - 1.2, 0, D.thick, 1.0, L, '#a29f96', { kind: KK.CONC, tag: 'deck' });
    b.box(up - D.thick / 2 + 0.25, D.crest - 0.2, 0, D.w, 0.2, L, ASPH, { kind: KK.ASPH, tag: 'deck' });
    // menba korkuluk duvarı + 12.180 göl merdiveni: korkulukta 1,4 m açıklık, menba yüzüne yaslı beton basamaklı payanda (göl tabanından yükselen
    // dolu kütle; 15 basamak × 0,247 m, 0,4 m basamak) → alt sahanlık su yüzeyinin 0,3 m üstünde: yüzen oyuncu kenara tutunup çıkar, buradan göle girilir
    const zg = Math.round(L * 0.2), gw = 0.7, SW = 1.4, NS = 15, RISE = (D.crest - (KZ_LAKE + 0.3)) / NS, RUN = 0.4;
    b.box(up - 0.4, D.crest - 0.2, (-L / 2 + zg - gw) / 2, 0.8, 1.6, zg - gw + L / 2, '#a9a69d', { kind: KK.CONC });
    b.box(up - 0.4, D.crest - 0.2, (L / 2 + zg + gw) / 2, 0.8, 1.6, L / 2 - zg - gw, '#a9a69d', { kind: KK.CONC });
    b.box(up + SW / 2, bed, zg, SW, D.crest - bed, 2 * gw, '#9a978e', { kind: KK.CONC });                 // üst sahanlık (tepe kotunda)
    for (let i = 1; i <= NS; i++) {
      const len = i === NS ? 1.6 : RUN, zc = zg - gw - (i - 1) * RUN - len / 2, top = D.crest - i * RISE;
      b.box(up + SW / 2, bed, zc, SW, top - bed, len, '#9a978e', { kind: KK.CONC });
    }
    ctxAdd(b, 'swimExits', [up + SW / 2, +(KZ_LAKE + 0.3).toFixed(2), +((z0 + z1) / 2 + zg - gw - (NS - 1) * RUN - 0.8).toFixed(2)]);
    b.box(up - D.thick + 0.375, D.crest - 0.2, 0, 0.75, 1.1, L, '#a9a69d', { kind: KK.CONC });             // mansap korkuluğu
    // dolusavak kapakları (görsel ayaklar) + tepe lambaları
    for (let i = -2; i <= 2; i++) b.box(up - D.thick - 0.6, 6, i * 6, 1.2, D.crest - 7.2, 1.0, '#8d8a82', { kind: KK.CONC });
    for (let i = -3; i <= 3; i++) b.cyl(up - D.thick + 0.375, D.crest + 0.9, i * L / 7, 0.06, 0.06, 2.4, '#3a3f44', { seg: 5, collide: false });
  }));
  return { z0, z1 };
}

// ── Enerji nakil direği (kafes, 30 m): ayak tabanları + alt 5 m ayak katı, üstü ince kafes (görsel). Tel bağlantı noktaları döner. ──
export function pylon(b, T, x, z, ry = 0, h = 30) {
  const y0 = T.heightAt(x, z) - 0.2, base = 3.4, top = 0.9, arms = [];
  b.obj(`direk:${Math.round(x)}:${Math.round(z)}`, () => b.with(x, y0, z, 0, () => {
    const leg = (yy) => base - (base - top) * Math.min(1, yy / (h * 0.82));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      b.box(sx * base, -0.6, sz * base, 1.1, 1.0, 1.1, CONC, { kind: KK.CONC });
      for (let k = 0; k < 5; k++) b.box(sx * leg(k + 0.5), 0.4 + k, sz * leg(k + 0.5), 0.26, 1.0, 0.26, STEEL, { kind: KK.METAL });
      const r0 = leg(5.4), y1 = h * 0.82, D = top - r0, len = Math.hypot(D, y1 - 5.4, D);          // ayak üst kısmı: (r0, 5,4) → (top, y1), içe eğik
      const tz = -Math.asin(sx * D / len), tx = Math.asin(sz * D / (len * Math.cos(tz)));
      b.box(sx * (r0 + top) / 2, (5.4 + y1) / 2 - len / 2, sz * (r0 + top) / 2, 0.24, len, 0.24, STEEL, { collide: false, rx: tx, rz: tz, kind: KK.METAL });
    }
    for (let yy = 4; yy < h * 0.8; yy += 4) { const r = leg(yy); for (const sd of [-1, 1]) { b.box(0, yy, sd * r, 2 * r, 0.14, 0.14, STEEL, { collide: false, kind: KK.METAL }); b.box(sd * r, yy, 0, 0.14, 0.14, 2 * r, STEEL, { collide: false, kind: KK.METAL }); } }
    b.box(0, h * 0.82, 0, 2 * top, h * 0.18, 2 * top, STEEL, { collide: false, kind: KK.METAL });
    for (const [ay, aw] of [[h * 0.72, 6.5], [h * 0.88, 4.6]]) {
      b.box(0, ay, 0, 2 * aw, 0.4, ay < h * 0.82 ? 2 * leg(ay) + 0.3 : 0.5, STEEL, { collide: false, kind: KK.METAL });     // 12.182 alt kol ayaklara değer
      for (const sd of [-1, 1]) arms.push([x + Math.cos(ry) * sd * aw, y0 + ay - 1.6, z - Math.sin(ry) * sd * aw]);
    }
  }));
  return arms;
}

// ── Ahşap elektrik direği (8 m, travers) ──
export function pole(b, T, x, z) {
  const y0 = T.heightAt(x, z) - 0.3;
  b.obj(`elektrik:${Math.round(x)}:${Math.round(z)}`, () => {
    b.cyl(x, y0, z, 0.12, 0.16, 8.6, '#5b4636', { seg: 6, collide: false, kind: KK.BARK });
    b.collide(x, y0, z, 0.24, 8.6, 0.24);
    b.box(x, y0 + 7.7, z, 1.8, 0.12, 0.12, '#4d3b2c', { collide: false, kind: KK.PLANK });
  });
  return [[x - 0.8, y0 + 7.9, z], [x + 0.8, y0 + 7.9, z]];
}
