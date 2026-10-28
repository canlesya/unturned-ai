import { KK } from './surface.js';
import { lw, shade } from '../common/kuzeyKit.js';

// 12.213 Kuzey Vadisi askerî gözetleme kuleleri + sabit silah yuvaları (VERİ + kurucu). Kullanıcı: "bir kaç yere kuleler yapalım, kulelerde sabit
// ağır makineli silahlar olsun, oradan da savunma yapılsın, keskin nişancı da olsun, sabit yerlerde tanksavarlar olsun".
// Kule (yerel çerçeve, ry yalnız 90°'nin katı → çarpışma kutuları eksen hizalı, görünen = çarpışma):
//   4 × 4 m kalas platform 6 m'de (4 direk + 2,4 m'de kuşak kirişleri), kenarında 1 m kum torbası siperi (3 sıra; +x yüzünde 1 m merdiven ağzı),
//   siper köşelerinden 1,6 m sac çatı direkleri + çatı, +x yüzünde araziden platforma tek kol dik ahşap merdiven (basamak ≤ 0,3 m: oyuncu / bot
//   yürüyerek çıkar). Basamaklar kademeli bloklar (her basamak kendi çarpışma kutusu: alt yüzü bir öncekinin üstüne biner; görünmez çarpışma yok).
// Yuvalar: kule tepesinde ağır makineli (bayrağa bakan siper yüzünde), bayrak çevresindeki mevcut kum torbası mevzilerinde (hamlets.flagDefenses /
// Kavşak) ağır makineli ve tanksavar. Yerler scripts/towerspots.mjs (düz, yapısız, ağaçsız, yolsuz, bayrağı + iki yaklaşma yolunu gören) ve
// scripts/nestdump.mjs (mevzi merkezi + ön yüz yönü) ile seçildi. Yuvalar TARAFSIZ: kim başına geçerse onun (Battlefield sabit silahları gibi).

export const TOWER = { P: 4, H: 6, wall: 0.5, par: 1.0, roof: 1.6, sw: 1.0, sz: 1.0, rise: 0.3, run: 0.28 };
// [id, x, z, ry (merdiven +x yerel → dünya), bayrak]
export const TOWERS = [
  ['A', -526.5, 117.5, 0], ['B', -210, 263, Math.PI / 2], ['C', -10, -23.5, Math.PI],
  ['D', 234.5, -270, 0], ['F', 406.5, 386.5, 0], ['G', -405.5, -458, 0],
];
// mevzi yuvaları: [tür, mevzi merkezi x, z, mevzinin ön yönü (sandbagNest ry: yerel −z ön), bayrak]
export const NESTS = [
  ['hmg', -11, -13, 0, 'C'], ['hmg', 11, 34, Math.PI, 'C'], ['hmg', -356.61, -442.46, -Math.PI / 2, 'G'], ['hmg', -564.48, 102.05, 0, 'A'],
  ['atgm', 12, -12, 0, 'C'], ['atgm', -10, 31, Math.PI, 'C'], ['atgm', 254.49, -268.93, Math.PI, 'D'], ['atgm', 414.49, 393.36, 0, 'F'], ['atgm', -246.23, 218.44, 0, 'B'],
];
const WOOD = '#6a5039', WOOD_D = '#54402e', PLANK = '#7a5d43', SAND = '#a3936b', SHEET = '#4f5649';

// Kule: dönen { id, flag, x, z, ry, y0, top, foot, pts (merdiven ara noktaları: dünya, aşağıdan yukarı), plat [x0, x1, z0, z1] (dünya), mg {x, z, yaw}, perch [...] }
export function milTower(b, T, [flag, x, z, ry], FLAG) {
  const { P, H, wall: WT, par, roof, sw, sz, rise, run } = TOWER, h2 = P / 2;
  const W = (lx, lz) => lw(x, z, ry, lx, lz), gAt = (lx, lz) => { const [wx, wz] = W(lx, lz); return T.heightAt(wx, wz); };
  // taban: platformun ayak izindeki en yüksek arazi (direkler araziye iner)
  let y0 = -1e9; for (const a of [-h2, 0, h2]) for (const c of [-h2, 0, h2]) y0 = Math.max(y0, gAt(a, c));
  y0 += 0.05;
  // merdiven: ayağının arazisine göre basamak sayısı (2 yineleme: uzunluk ayağın yerini değiştirir)
  let n = Math.ceil(H / rise), L = n * run, gF = 0;
  for (let k = 0; k < 3; k++) { gF = gAt(h2 + L + 0.1, sz) - y0; n = Math.ceil((H - gF) / rise); L = n * run; }
  const rs = (H - gF) / n;
  const id = `kule:${flag}`;
  b.obj(id, () => b.with(x, y0, z, ry, () => {
    // direkler (köşeler) + kuşak kirişleri (2,4 m; altından yürünür)
    for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) { const px = sx * (h2 - 0.2), pz = sz2 * (h2 - 0.2), g = gAt(px, pz) - 0.3 - y0; b.box(px, g, pz, 0.3, H - 0.25 - g, 0.3, WOOD, { kind: KK.PLANK }); }
    for (const s of [-1, 1]) {
      b.box(0, 2.4, s * (h2 - 0.2), P - 0.7, 0.18, 0.16, WOOD_D, { kind: KK.PLANK });
      b.box(s * (h2 - 0.2), 2.4, 0, 0.16, 0.18, P - 0.7, WOOD_D, { kind: KK.PLANK });
    }
    // platform (kalas döşeme 0,25 m) + kenar alın tahtası (görsel, yüzeye gömülü değil: döşemenin altında)
    b.box(0, H - 0.25, 0, P, 0.25, P, PLANK, { kind: KK.PLANK, tag: 'plat' });
    for (let i = 0; i < 8; i++) b.box(-h2 + (i + 0.5) * P / 8, H, 0, 0.02, 0.006, P - 0.04, shade(PLANK, 0.8), { collide: false, kind: KK.PLANK });      // kalas araları (çizgi)
    // kum torbası siperi: 4 yüz (−x tam boy; ±z x −1,5..2; +x z −1,5..0,5 → merdiven ağzı z 0,5..1,5). Her yüz tek çarpışma kutusu, 3 görsel sıra
    const bag = (cx, cz, w, d, k) => {
      b.collide(cx, H, cz, w, par, d);
      const rh = par / 3;
      for (let r = 0; r < 3; r++) { const ins = r === 1 ? 0.04 : 0; b.box(cx, H + r * rh, cz, w > d ? w : w - ins, rh, w > d ? d - ins : d, (r + k) & 1 ? shade(SAND, 0.9) : SAND, { collide: false, kind: KK.PLASTER }); }
    };
    bag(-h2 + WT / 2, 0, WT, P, 0);
    bag(WT / 2 / 1, -h2 + WT / 2, P - WT, WT, 1);
    bag(WT / 2, h2 - WT / 2, P - WT, WT, 1);
    const ga = sz - sw / 2, gb = sz + sw / 2;                                     // ağız: z ga..gb (+x yüzü)
    bag(h2 - WT / 2, (-h2 + WT + ga) / 2, WT, ga - (-h2 + WT), 0);
    // çatı: siper köşelerinde dört direk (siperin üstünden) + sac
    for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) b.box(sx * (h2 - 0.25), H + par, sz2 * (h2 - 0.25), 0.14, roof, 0.14, WOOD_D, { kind: KK.PLANK });
    b.box(0, H + par + roof, 0, P + 0.5, 0.1, P + 0.5, SHEET, { kind: KK.SHEET });
    // merdiven: +x yüzünde, z sz ± sw/2; basamak i: üstü gF + (i+1)·rs (platforma doğru yükselir), alt yüzü en çok 0,6 m aşağıda (en alttakiler araziye iner)
    for (let i = 0; i < n; i++) {
      const cx = h2 + L - (i + 0.5) * run, top = gF + (i + 1) * rs, gl = Math.min(gAt(cx - run / 2, sz - sw / 2), gAt(cx + run / 2, sz + sw / 2), gAt(cx, sz)) - y0;
      const b0 = top - 0.6 < gl + 0.3 ? Math.min(gl - 0.25, top - 0.05) : top - 0.6;      // alçak basamaklar araziye iner (altı boş kalmaz)
      b.box(cx, b0, sz, run, top - b0, sw, i & 1 ? shade(PLANK, 0.92) : PLANK, { kind: KK.PLANK });
    }
    // merdiven ayakları: iki çift direk (araziden basamağın altına)
    for (const k of [0.45, 0.8]) {
      const i = Math.floor(n * k), cx = h2 + L - (i + 0.5) * run, top = gF + (i + 1) * rs, under = top - 0.6;
      for (const s of [-1, 1]) { const pz = sz + s * (sw / 2 - 0.07), g = gAt(cx, pz) - 0.3 - y0; if (under - g > 0.3) b.box(cx, g, pz, 0.14, under - g, 0.14, WOOD_D, { kind: KK.PLANK }); }
    }
  }));
  // ağır makineli: bayrağa en çok bakan siper yüzü (merdiven yüzü +x hariç), yüzün 0,9 m içinde
  const fx = FLAG.x - x, fz = FLAG.z - z, lx = fx * Math.cos(ry) - fz * Math.sin(ry), lz = fx * Math.sin(ry) + fz * Math.cos(ry);      // dünya → yerel (lw'nin tersi)
  const sides = [[-1, 0], [0, -1], [0, 1]].map(([a, c]) => ({ a, c, k: a * lx + c * lz })).sort((p, q) => q.k - p.k), S = sides[0];
  const [mx, mz] = W(S.a * 0.9, S.c * 0.9);
  const [nx, nz] = W(S.a, S.c), yaw = Math.atan2(-(nx - x), -(nz - z));          // yayın ortası = siper yüzünün dışa normali (±70° yay siperin üstünden)
  // keskin nişancı yerleri: platformun iç köşeleri (±1,05), makineliden uzak iki köşe; merdiven ağzının köşesi (+x +z) hariç
  const perch = [[-1, -1], [-1, 1], [1, -1]].map(([a, c]) => ({ a, c, k: a * S.a + c * S.c })).sort((p, q) => p.k - q.k).slice(0, 2)
    .map(({ a, c }) => { const [wx, wz] = W(a * 1.05, c * 1.05); return { x: +wx.toFixed(2), z: +wz.toFixed(2), y: +(y0 + H).toFixed(2) }; });
  const pt = (lx2, lz2, yy) => { const [wx, wz] = W(lx2, lz2); return { x: +wx.toFixed(2), y: +(y0 + yy).toFixed(2), z: +wz.toFixed(2) }; };
  const top = y0 + H, foot = pt(h2 + L + 0.9, sz, gAt(h2 + L + 0.9, sz) - y0);
  const pts = [foot, pt(h2 + L - 0.1, sz, gF + rs), pt(h2 + L / 2, sz, gF + (H - gF) / 2), pt(h2 + 0.15, sz, H), pt(h2 - 0.9, sz, H)];      // ayak → ilk basamak → orta → son basamak → platform (ağzın içi)
  const [a0, a1] = [W(-h2, -h2), W(h2, h2)];
  return { id, flag, x, z, ry, y0, top, foot, pts, n, rs, L, plat: [Math.min(a0[0], a1[0]), Math.max(a0[0], a1[0]), Math.min(a0[1], a1[1]), Math.max(a0[1], a1[1])], mg: { x: +mx.toFixed(2), z: +mz.toFixed(2), y: +top.toFixed(2), yaw }, perch };
}

// map.emplacements (Vehicles doğuş verisi): kule tepeleri + mevziler. ry: araç verisi kuralı (yaw = ry + π)
export function emplacementsFor(towers, T) {
  const out = [];
  for (const t of towers) out.push({ id: `Y-${t.flag}-K`, type: 'hmg', x: t.mg.x, z: t.mg.z, y: t.mg.y, ry: t.mg.yaw - Math.PI, team: null, tower: t.id, flag: t.flag });
  for (const [type, x, z, fr, flag] of NESTS) {
    const [px, pz] = lw(x, z, fr, 0, type === 'hmg' ? -0.2 : 0.15);
    out.push({ id: `Y-${flag}-${type}-${Math.round(x)}`, type, x: +px.toFixed(2), z: +pz.toFixed(2), y: +T.heightAt(px, pz).toFixed(2), ry: fr - Math.PI, team: null, flag });
  }
  return out;
}
