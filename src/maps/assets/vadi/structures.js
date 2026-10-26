// VADİ v3 yapıları (12.169): gözetleme kulesi, kuyu, çadır, keskin nişancı yuvası, kaya geçidi. Yerel çerçeve, zemin = 0, 90° katlarıyla döner.
import { VK, PAL } from './surface.js';
import { roofPrism, roofSlabs, octCyl } from './kit.js';
import * as P from './props.js';
import { rock, rockShape } from './nature.js';
import { footing } from './buildings.js';

// ───────── Gözetleme kulesi: 4 × 4 platform (üstü H), dört ayak, göğüs hizası tahta korkuluk (siper), dört direkli piramit çatı,
// güney (+z) kenarından inen kapalı basamaklı merdiven (basamak + rıht zinciri; altı boş, çarpışma = basamak / rıht).
export function watchtower(b, { H = 3.6, steps = 12, run = 0.32, stairX = 1.0 } = {}) {
  const S = 2, legC = '#5a3f26', deckC = PAL.plank, boardC = '#7a5a38';
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (S - 0.15), -0.3, sz * (S - 0.15), 0.3, H - 0.2 + 0.3, 0.3, legC, { kind: VK.WOOD });
  // çapraz kuşaklar (ayak arası, dış yüzlere yaslı) — çarpışmasız ince çıta; ayaklara değer
  for (const sz of [-1, 1]) b.box(0, 1.2, sz * (S - 0.15), 2 * S - 0.6, 0.12, 0.08, legC, { collide: false, kind: VK.WOOD });
  for (const sx of [-1, 1]) b.box(sx * (S - 0.15), 1.2, 0, 0.08, 0.12, 2 * S - 0.6, legC, { collide: false, kind: VK.WOOD });
  b.box(0, H - 0.2, 0, 2 * S, 0.2, 2 * S, deckC, { kind: VK.PLANK });
  // korkuluk: köşe dikmeleri (çatıya kadar) + kalın tahta panolar (0,15…1,05), merdiven ağzı (güney kenarda stairX ± 0,6) açık
  const RH = 2.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * (S - 0.08), H, sz * (S - 0.08), 0.16, RH, 0.16, legC, { kind: VK.WOOD });
  const panel = (x0, x1, z0, z1) => { if (x1 - x0 > 0.01 && z1 - z0 > 0.01) b.box((x0 + x1) / 2, H, (z0 + z1) / 2, x1 - x0, 1.05, z1 - z0, boardC, { kind: VK.WOOD }); };
  const pt = 0.08;
  panel(-S + 0.16, S - 0.16, -S, -S + pt);                                  // kuzey
  panel(-S, -S + pt, -S + 0.16, S - 0.16);                                  // batı
  panel(S - pt, S, -S + 0.16, S - 0.16);                                    // doğu
  const g0 = stairX - 0.6, g1 = stairX + 0.6;                               // güney: merdiven ağzı
  panel(-S + 0.16, g0, S - pt, S); panel(g1, S - 0.16, S - pt, S);
  // çatı: dikmelerin üstünde kare taban levhası + piramit (4 kenarlı koni; çarpışmasız — erişilemez)
  b.box(0, H + RH, 0, 2 * S + 0.1, 0.12, 2 * S + 0.1, legC, { kind: VK.WOOD, tag: 'roof' });
  b.cyl(0, H + RH + 0.12, 0, 0.02, (S + 0.6) * Math.SQRT2, 1.5, PAL.roofTileB, { seg: 4, ry: Math.PI / 4, collide: false, kind: VK.ROOF });
  b.box(0.3, H + 0.6, -S - 0.011, 0.5, 0.35, 0.02, '#3a2d22', { collide: false, kind: VK.WOOD });     // küçük levha (kuzey panonun dış yüzünde)
  // merdiven: basamak i (0 = en alt) z ∈ [S + (steps − 1 − i)·run, S + (steps − i)·run], üstü (i + 1)·rise; rıht ön kenarda
  const rise = H / steps, tw = 1.2;
  for (let i = 0; i < steps; i++) {
    const zf = S + (steps - i) * run, zb = S + (steps - 1 - i) * run, top = (i + 1) * rise;
    if (i === 0) { b.box(stairX, 0, (zf + zb) / 2, tw, top, run, deckC, { kind: VK.PLANK }); continue; }      // ilk basamak dolu blok (altı boş kalmaz)
    b.box(stairX, top - 0.07, (zf + zb) / 2, tw, 0.07, run, deckC, { kind: VK.PLANK });
    b.box(stairX, top - rise, zf - 0.02, tw, rise - 0.07, 0.04, boardC, { kind: VK.WOOD });
  }
  // merdiven yan kirişleri: her basamağın iki yanında basamak boyunca dikey levha (basamak + rıhtın yanını kapatır, zincir tek parça)
  for (let i = 0; i < steps; i++) {
    const zf = S + (steps - i) * run, zb = S + (steps - 1 - i) * run, top = (i + 1) * rise, bot = Math.max(0, top - rise * 2.2);
    for (const sg of [-1, 1]) b.box(stairX + sg * (tw / 2 + 0.03), bot, (zf + zb) / 2, 0.06, top - bot, run, legC, { collide: false, kind: VK.WOOD });
  }
  // tırabzan (dış yan, eğik çıta + iki dikme) — çarpışmasız
  const L = Math.hypot(steps * run, H), a = Math.atan2(H, steps * run);
  b.box(stairX + tw / 2 + 0.03, H / 2 + 0.85, S + steps * run / 2, 0.05, 0.05, L, legC, { collide: false, rx: a, kind: VK.WOOD });
}

// ───────── Silo: beton kaide, sekizgen galvaniz gövde (kenarlar eksenlere bakar), konik çatı (erişilemez, çarpışmasız), +x yüzünde merdiven ─────────
export function silo(b, { r = 2.2, h = 9 } = {}) {
  const base = 0.3, a = r * 0.9239;
  footing(b, 0, -0.3, 0, 2 * a + 0.4, base + 0.3, 2 * a + 0.4, PAL.concD, { kind: VK.CONC });
  octCyl(b, 0, base, 0, r, h, '#b9bdc2', { kind: VK.METAL });
  b.cyl(0, base + h, 0, 0.15, r + 0.18, 1.6, '#8a8f95', { seg: 8, ry: Math.PI / 8, collide: false, kind: VK.METAL });
  for (const sz of [-0.22, 0.22]) b.box(a + 0.03, base + 0.6, sz, 0.06, h - 0.4, 0.05, '#5a5f65', { collide: false, kind: VK.METAL });
  for (let y = base + 0.9; y < base + h - 0.2; y += 0.35) b.box(a + 0.035, y, 0, 0.05, 0.04, 0.39, '#5a5f65', { collide: false, kind: VK.METAL });
}

// ───────── Kuyu: kare taş bilezik (içi su), iki dikme + kiriş + küçük beşik çatı (çarpışmalı) ─────────
export function well(b) {
  const S = 0.8, t = 0.24, h = 0.8;
  b.box(0, -0.3, -S + t / 2, 2 * S, h + 0.3, t, PAL.stone, { kind: VK.STONE });
  b.box(0, -0.3, S - t / 2, 2 * S, h + 0.3, t, PAL.stone, { kind: VK.STONE });
  b.box(-S + t / 2, -0.3, 0, t, h + 0.3, 2 * S - 2 * t, PAL.stone, { kind: VK.STONE });
  b.box(S - t / 2, -0.3, 0, t, h + 0.3, 2 * S - 2 * t, PAL.stone, { kind: VK.STONE });
  b.box(0, -0.3, 0, 2 * S - 2 * t, 0.62, 2 * S - 2 * t, '#2f4a52', { kind: VK.PLAIN });      // su (iç dolgu; içine düşen basamakla çıkar)
  for (const sx of [-1, 1]) b.box(sx * (S - t / 2), h, 0, 0.12, 1.3, 0.12, '#5a3f26', { kind: VK.WOOD });
  b.box(0, h + 1.3, 0, 2 * S, 0.1, 0.12, '#5a3f26', { kind: VK.WOOD });
  roofPrism(b, 0, h + 1.4, 0, 1.0, 0.45, 2 * S + 0.2, '#6e4e30', { ridge: 'x', kind: VK.WOOD, fr: [0.5] });
  roofSlabs(b, 0, h + 1.4, 0, 1.0, 0.45, 2 * S + 0.2, PAL.roofTileB, { ridge: 'x', ovE: 0.25, ovG: 0.1, t: 0.06 });
}

// ───────── Çadır (A biçimi): bez prizma (katı; çarpışma içine çizilmiş basamaklar), ön / arka direk, taban çerçevesi ─────────
export function tent(b, { w = 2.6, h = 1.8, d = 3.2, color = PAL.canvas } = {}) {
  roofPrism(b, 0, 0, 0, w, h, d, color, { ridge: 'z', kind: VK.CANVAS, fr: [0.66, 0.33], tag: 'tent' });     // iki basamak ≥ 0,55 m: üstüne basamakla çıkılmaz (sandık gibi zıplanır)
  for (const sz of [-1, 1]) b.box(0, -0.1, sz * (d / 2 + 0.07), 0.06, h + 0.25, 0.06, '#5a3f26', { collide: false, kind: VK.WOOD });     // kapı bezinin önünde (yüzleri çakışmaz)
  b.box(0, 0, -d / 2 - 0.02, w * 0.36, h * 0.6, 0.02, '#2f2a22', { collide: false, kind: VK.CANVAS });      // kapı aralığı (karanlık iç)
}

// ───────── Keskin nişancı yuvası: kum torbası sırası (önde, z −), yanında sandık + fener ─────────
export function sniperNest(b) {
  P.sandbags(b, 0, -1.0, 3.4, 0, 3);
  P.crate(b, -2.3, 0.1, 1.0);
  b.with(2.25, 0, 0.2, 0, () => P.lantern(b, 2.6));
}

// ───────── Kaya geçidi: yolun iki yanında ikişer kaya ayak + üstlerine OTURAN lento kaya (yol x boyunca, genişlik w, serbest yükseklik ≥ h)
export function rockArch(b, gy, { len = 6, w = 3.4, h = 2.9 } = {}) {
  const side = w / 2, sxp = len * 0.48, tops = [];
  for (const sg of [-1, 1]) for (let k = 0; k < 2; k++) {
    const x = (k - 0.5) * len * 0.525, z = sg * (side + 1.1);
    const g = Math.min(gy(x - sxp / 2, z - 1.05), gy(x + sxp / 2, z - 1.05), gy(x - sxp / 2, z + 1.05), gy(x + sxp / 2, z + 1.05), gy(x, z));
    const gTop = Math.max(gy(0, 0), gy(-len / 2, 0), gy(len / 2, 0));
    const R = rockShape(1 + k + (sg > 0 ? 2 : 0));
    const want = gTop + h - g;                                 // ayak tepesi = lento tabanı
    const sy = want / (R.box.max[1] - R.low);
    tops.push(rock(b, 1 + k + (sg > 0 ? 2 : 0), x, z, sxp, sy, 2.1, 0, { seat: g }).top);
  }
  const R5 = rockShape(5), base = Math.min(...tops), syl = 1.5;
  rock(b, 5, 0, 0, len * 0.95, syl, w + 3.4, 0, { y: base - R5.box.min[1] * syl - 0.1 });      // lento ayaklara oturur (yuvarlak alt yüz uçlarda ~0,16 m yukarıda)
}
