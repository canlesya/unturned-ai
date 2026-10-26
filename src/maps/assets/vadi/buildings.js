// VADİ v3 binaları (12.169) — modüler: 2 m'lik ızgarada ayak izi, taş taban (plinth), duvar = parça parça kutular (açıklık kenarında biter),
// pencere = pervaz (açıklığın içine oturan 4 çıta + kayıt) + dış denizlik + kepenk + lento (duvarın DIŞ yüzüne yaslı), kapı = pervaz + içe açık kanat,
// çatı = katı prizma (çatı arası / alın duvarı, çarpışması içine çizilmiş basamaklar) + üstüne yatan iki eğik levha (saçak / alın taşması).
// Yerel çerçeve: orijin = zemin (düzlük kotu), ayak izi x ∈ [−w/2, w/2], z ∈ [−d/2, d/2]; 'n' = −z, 's' = +z, 'w' = −x, 'e' = +x.
import { VK, PAL } from './surface.js';
import { roofPrism, roofSlabs, octCyl, roundCollide } from './kit.js';
import * as P from './props.js';

export const PLINTH = 0.3;                // döşeme kotu (taban taşı üstü)
// temel / taban taşı: bilerek toprağa gömülü kutu (denetimde 'footing' olarak tanınır: yarı gömülü sayılmaz)
export function footing(b, x, y, z, w, h, d, color, opt = {}) { b.box(x, y, z, w, h, d, color, { kind: VK.STONE, ...opt }); }

// tek duvar şeridi: yön boyunca a0 → a1, kalınlık ekseni c0 → c1 (dış yüz = out), y0 → y0 + h, açıklıklar [{at, w, b, top, kind:'win'|'door'}]
function wallRun(b, axis, a0, a1, c0, c1, y0, h, color, kind, openings) {
  const ops = [...openings].sort((p, q) => p.at - q.at);
  const t = c1 - c0, cm = (c0 + c1) / 2;
  const piece = (s, e, yb, yt) => {
    if (e - s < 0.005 || yt - yb < 0.005) return;
    if (axis === 'x') b.box((s + e) / 2, y0 + yb, cm, e - s, yt - yb, t, color, { kind });
    else b.box(cm, y0 + yb, (s + e) / 2, t, yt - yb, e - s, color, { kind });
  };
  let cur = a0;
  for (const o of ops) {
    const s = o.at - o.w / 2, e = o.at + o.w / 2;
    piece(cur, s, 0, h); piece(s, e, 0, o.b); piece(s, e, o.top, h);
    cur = e;
  }
  piece(cur, a1, 0, h);
}

// açıklık süsü (pervaz, kayıt, cam, denizlik, kepenk, lento, kapı kanadı). side: dış normal işareti (+1 / −1) eksen boyunca; inner: iç yüz koordinatı
function openingTrim(b, axis, o, c0, c1, outSign, y0, { trim = PAL.trim, shutter = '#4f6a4a', glass = true, leaf = '#6a4a2e', lintel = PAL.stoneL } = {}, minA = -1e9) {
  const s = o.at - o.w / 2, e = o.at + o.w / 2, ft = 0.07, fd = 0.12;
  const cm = (c0 + c1) / 2, outF = outSign > 0 ? c1 : c0, inF = outSign > 0 ? c0 : c1;
  const B = (a, yb, along, hh, across, ac, col, opt) => {      // along: açıklık yönünde uzunluk, ac: kalınlık ekseni merkezi
    if (axis === 'x') b.box(a, y0 + yb, ac, along, hh, across, col, opt);
    else b.box(ac, y0 + yb, a, across, hh, along, col, opt);
  };
  const W = { kind: VK.WOOD };
  // pervaz: iki dikme + başlık (+ pencerede alt kayıt), duvar kalınlığının ortasında, açıklığın kenarına değer
  B(s + ft / 2, o.b, ft, o.top - o.b, fd, cm, trim, W); B(e - ft / 2, o.b, ft, o.top - o.b, fd, cm, trim, W);
  B(o.at, o.top - ft, o.w - 2 * ft, ft, fd, cm, trim, W);
  if (o.kind === 'win') {
    B(o.at, o.b, o.w - 2 * ft, ft, fd, cm, trim, W);
    B(o.at, (o.b + o.top) / 2 - 0.03, o.w - 2 * ft, 0.06, fd * 0.6, cm, trim, { collide: false, kind: VK.WOOD });        // yatay kayıt
    if (glass) {
      const gh = (o.top - o.b - 2 * ft - 0.06) / 2;
      for (const gy of [o.b + ft, (o.b + o.top) / 2 + 0.03]) B(o.at, gy, o.w - 2 * ft, gh, 0.02, cm, o.glow ? PAL.glow : PAL.glass, { collide: false, o: o.glow ? { glow: true, transparent: true, opacity: 0.62, roughness: 0.4 } : { transparent: true, opacity: 0.3, roughness: 0.12 } });
    }
    B(o.at, o.b - 0.06, o.w + 0.16, 0.06, 0.12, outF + outSign * 0.06, PAL.stoneL, { collide: false, kind: VK.STONE });   // dış denizlik
    if (shutter) for (const sg of [-1, 1]) B(o.at + sg * (o.w / 2 + 0.25), o.b, 0.46, o.top - o.b, 0.04, outF + outSign * 0.02, shutter, { collide: false, kind: VK.PLANK });
    B(o.at, o.top, o.w + 0.24, 0.14, 0.05, outF + outSign * 0.025, lintel, { collide: false, kind: VK.STONE });              // lento
  } else {
    // kapı kanadı: sonuna kadar açık, iç duvar yüzüne yaslı (menteşe s kenarı); kapı aralığını daraltmaz (botların yol ızgarası kapıdan geçer)
    const len = Math.min(1.0, o.w - 0.1, s - minA - 0.02);      // iç köşeye (dik duvar) girmesin
    if (leaf && len > 0.3) {
      if (axis === 'x') b.box(s - len / 2, y0 + 0.045, inF - outSign * 0.025, len, o.top - ft - 0.06, 0.05, leaf, { kind: VK.PLANK });
      else b.box(inF - outSign * 0.025, y0 + 0.045, s - len / 2, 0.05, o.top - ft - 0.06, len, leaf, { kind: VK.PLANK });
    }
    B(o.at, o.top, o.w + 0.24, 0.14, 0.05, outF + outSign * 0.025, lintel, { collide: false, kind: VK.STONE });
  }
}

// dört duvar (köşeler tam örtüşmez: kuzey / güney duvarı x boyunca tüm genişlik, doğu / batı aralarında) + açıklıklar + süs
// ops: { n:[...], s:[...], e:[...], w:[...] } — at: duvarın ortasından uzaklık (n/s: x, e/w: z)
export function walls(b, w, d, y0, h, t, color, kind, ops, trimO = {}) {
  const hw = w / 2, hd = d / 2;
  const sideDef = {
    n: ['x', -hw, hw, -hd, -hd + t, -1], s: ['x', -hw, hw, hd - t, hd, 1],
    w: ['z', -hd + t, hd - t, -hw, -hw + t, -1], e: ['z', -hd + t, hd - t, hw - t, hw, 1],
  };
  for (const k of ['n', 's', 'w', 'e']) {
    const [axis, a0, a1, c0, c1, sg] = sideDef[k];
    const list = (ops[k] || []).map((o) => ({ ...o }));
    wallRun(b, axis, a0, a1, c0, c1, y0, h, color, kind, list);
    for (const o of list) openingTrim(b, axis, o, c0, c1, sg, y0, trimO, axis === 'x' ? -hw + t : a0);
  }
}
const WIN = (at, o = {}) => ({ at, w: o.w ?? 1.0, b: o.b ?? 0.95, top: o.top ?? 2.15, kind: 'win', glow: o.glow });
const DOOR = (at, o = {}) => ({ at, w: o.w ?? 1.4, b: 0, top: o.top ?? 2.25, kind: 'door' });     // 1,4 m: botların yol ızgarası kapıdan geçer
export { WIN, DOOR };

// taban taşı + iç döşeme + kapı önü basamakları
// taban: duvarların altında taş halka (üstü PLINTH, duvar dış yüzünden 6 cm taşar) + içeride kalın döşeme bloğu (üstü PLINTH + 0,03, tahta).
// İnce döşeme levhası YOK: fizik ince geniş kutuya düşerken duvara değince kutunun ucuna itiyordu (oda boyu ışınlanma).
export function baseRing(b, w, d, t, top, floorTop, floorC = PAL.plank, ringC = PAL.plinth, y0 = -0.5) {
  const e = 0.06;
  footing(b, 0, y0, -d / 2 + t / 2 - e / 2, w + 2 * e, top - y0, t + e, ringC);
  footing(b, 0, y0, d / 2 - t / 2 + e / 2, w + 2 * e, top - y0, t + e, ringC);
  footing(b, -w / 2 + t / 2 - e / 2, y0, 0, t + e, top - y0, d - 2 * t, ringC);
  footing(b, w / 2 - t / 2 + e / 2, y0, 0, t + e, top - y0, d - 2 * t, ringC);
  footing(b, 0, y0, 0, w - 2 * t, floorTop - y0, d - 2 * t, floorC, { kind: VK.PLANK });
}
function plinthFloor(b, w, d, t, doors) {
  baseRing(b, w, d, t, PLINTH, PLINTH + 0.03);
  for (const [side, at, dw] of doors) {
    const sw = dw + 0.4, dd = 0.4;
    if (side === 'n') b.box(at, 0, -d / 2 - 0.06 - dd / 2, sw, 0.15, dd, PAL.stoneL, { kind: VK.STONE });
    if (side === 's') b.box(at, 0, d / 2 + 0.06 + dd / 2, sw, 0.15, dd, PAL.stoneL, { kind: VK.STONE });
    if (side === 'w') b.box(-w / 2 - 0.06 - dd / 2, 0, at, dd, 0.15, sw, PAL.stoneL, { kind: VK.STONE });
    if (side === 'e') b.box(w / 2 + 0.06 + dd / 2, 0, at, dd, 0.15, sw, PAL.stoneL, { kind: VK.STONE });
  }
}

// ───────── Ev / kulübe (1–2 kat, beşik çatı) ─────────
// o: { w, d, h=2.9, floors=1, wall, wallKind, roof, roofKind, ridge, pitch, ops:{n,s,e,w} (zemin kat), ops2 (üst kat), stairs?, furnish(b, inner) }
export function house(b, o) {
  const w = o.w, d = o.d, h = o.h ?? 2.9, t = o.t ?? 0.3, floors = o.floors ?? 1;
  const wallC = o.wall ?? PAL.plaster, wk = o.wallKind ?? VK.PLASTER;
  const ridge = o.ridge ?? (w >= d ? 'x' : 'z');
  const ops = o.ops || {};
  const doors = [];
  for (const k of ['n', 's', 'e', 'w']) for (const q of ops[k] || []) if (q.kind === 'door') doors.push([k, q.at, q.w]);
  plinthFloor(b, w, d, t, doors);
  walls(b, w, d, PLINTH, h, t, wallC, wk, ops, o.trim || {});
  let top = PLINTH + h;
  if (floors > 1) {
    // ara kat döşemesi (merdiven boşluğu bırakılır) + üst kat duvarları
    const hole = o.stairHole;                     // [x0, x1, z0, z1] iç çerçevede
    const ix0 = -w / 2 + t, ix1 = w / 2 - t, iz0 = -d / 2 + t, iz1 = d / 2 - t, fy = top - 0.2;
    if (hole) {
      const [hx0, hx1, hz0, hz1] = hole;
      if (hx0 - ix0 > 0.01) b.box((ix0 + hx0) / 2, fy, 0, hx0 - ix0, 0.2, iz1 - iz0, PAL.plank, { kind: VK.PLANK });
      if (ix1 - hx1 > 0.01) b.box((hx1 + ix1) / 2, fy, 0, ix1 - hx1, 0.2, iz1 - iz0, PAL.plank, { kind: VK.PLANK });
      if (hz0 > iz0) b.box((hx0 + hx1) / 2, fy, (iz0 + hz0) / 2, hx1 - hx0, 0.2, hz0 - iz0, PAL.plank, { kind: VK.PLANK });
      if (iz1 > hz1) b.box((hx0 + hx1) / 2, fy, (hz1 + iz1) / 2, hx1 - hx0, 0.2, iz1 - hz1, PAL.plank, { kind: VK.PLANK });
    } else b.box(0, fy, 0, ix1 - ix0, 0.2, iz1 - iz0, PAL.plank, { kind: VK.PLANK });
    walls(b, w, d, top, h, t, wallC, wk, o.ops2 || {}, o.trim || {});
    // kat bandı (dış yüze yaslı ince silme)
    for (const [bx, bz, bw, bd] of [[0, -d / 2 - 0.03, w + 0.12, 0.06], [0, d / 2 + 0.03, w + 0.12, 0.06], [-w / 2 - 0.03, 0, 0.06, d], [w / 2 + 0.03, 0, 0.06, d]]) b.box(bx, top - 0.08, bz, bw, 0.12, bd, PAL.stoneL, { collide: false, kind: VK.STONE });
    top += h;
  }
  const across = ridge === 'x' ? d : w, along = ridge === 'x' ? w : d;
  const rh = (across / 2) * Math.tan((o.pitch ?? 33) * Math.PI / 180);
  roofPrism(b, 0, top, 0, across, rh, along, wallC, { ridge, kind: wk });
  roofSlabs(b, 0, top, 0, across, rh, along, o.roof ?? PAL.roofTile, { ridge, kind: o.roofKind ?? VK.ROOF });
  if (o.furnish) b.with(0, PLINTH + 0.03, 0, 0, () => o.furnish(b, { x0: -w / 2 + t, x1: w / 2 - t, z0: -d / 2 + t, z1: d / 2 - t, y: 0, ceil: h - 0.03 - (floors > 1 ? 0.2 : 0) }));     // eşya döşeme üstünde (y 0)
  return { top, rh };
}

// ───────── Ahır (tahta kaplama, iki alında büyük kapı, oluklu sac çatı) ─────────
export function barn(b, o) {
  const w = o.w, d = o.d, h = o.h ?? 4.2, t = 0.25, color = o.color ?? PAL.barnRed;
  // kapılar sırt boyunca iki alında (ridge 'z' → n / s duvarları)
  const ridge = o.ridge ?? (d >= w ? 'z' : 'x');
  const gd = (at) => ({ at, w: 3.6, b: 0, top: 3.4, kind: 'door' });
  const ops = ridge === 'z' ? { n: [gd(0)], s: [gd(0)], e: [WIN(-d / 4, { b: 1.6, top: 2.6, w: 1.2 }), WIN(d / 4, { b: 1.6, top: 2.6, w: 1.2 })], w: [WIN(-d / 4, { b: 1.6, top: 2.6, w: 1.2 }), WIN(d / 4, { b: 1.6, top: 2.6, w: 1.2 })] }
    : { e: [gd(0)], w: [gd(0)], n: [WIN(-w / 4, { b: 1.6, top: 2.6, w: 1.2 }), WIN(w / 4, { b: 1.6, top: 2.6, w: 1.2 })], s: [WIN(-w / 4, { b: 1.6, top: 2.6, w: 1.2 }), WIN(w / 4, { b: 1.6, top: 2.6, w: 1.2 })] };
  baseRing(b, w, d, t, 0.15, 0.18, '#8f7a58');
  const y0 = 0.15;
  // kapı kanatları: dışarıda, açıklığın iki yanında duvara yaslı sürgülü kapılar (kanat duvar yüzünden 2 cm dışarıda)
  const trim = { trim: PAL.trim, shutter: null, glass: false, leaf: null, lintel: PAL.trim };
  walls(b, w, d, y0, h, t, color, VK.WOOD, ops, trim);
  const slide = (side) => {
    for (const sg of [-1, 1]) {
      const off = sg * (1.8 + 0.95);
      if (side === 'n') b.box(off, y0, -d / 2 - 0.025, 1.9, 2.75, 0.04, color, { kind: VK.PLANK });      // 2,75 m: üstüne çıkan çatıya zıplayamaz
      if (side === 's') b.box(off, y0, d / 2 + 0.025, 1.9, 2.75, 0.04, color, { kind: VK.PLANK });
      if (side === 'w') b.box(-w / 2 - 0.025, y0, off, 0.04, 2.75, 1.9, color, { kind: VK.PLANK });
      if (side === 'e') b.box(w / 2 + 0.025, y0, off, 0.04, 2.75, 1.9, color, { kind: VK.PLANK });
    }
  };
  if (ridge === 'z') { slide('n'); slide('s'); } else { slide('e'); slide('w'); }
  // köşe dikmeleri (beyaz boyalı, dış yüze yaslı)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    b.box(sx * (w / 2 + 0.025), y0, sz * (d / 2 - 0.12), 0.05, h - 0.12, 0.24, PAL.trim, { collide: false, kind: VK.WOOD });     // saçak levhasının altında biter
  }
  const across = ridge === 'x' ? d : w, along = ridge === 'x' ? w : d;
  const rh = across / 2 * Math.tan(38 * Math.PI / 180);
  roofPrism(b, 0, y0 + h, 0, across, rh, along, color, { ridge, kind: VK.WOOD });
  roofSlabs(b, 0, y0 + h, 0, across, rh, along, o.roof ?? PAL.roofMetal, { ridge, kind: VK.ROOFM, ovE: 0.5, ovG: 0.3 });
  if (o.furnish) b.with(0, y0 + 0.03, 0, 0, () => o.furnish(b, { x0: -w / 2 + t, x1: w / 2 - t, z0: -d / 2 + t, z1: d / 2 - t, y: 0 }));
}

// ───────── Taş karakol (düz beton çatı, korkuluk duvarı, mazgal pencereler) ─────────
export function outpost(b, o) {
  const w = o.w, d = o.d, h = 2.7, t = 0.4;
  const ops = o.ops;
  const doors = []; for (const k of ['n', 's', 'e', 'w']) for (const q of ops[k] || []) if (q.kind === 'door') doors.push([k, q.at, q.w]);
  plinthFloor(b, w, d, t, doors);
  walls(b, w, d, PLINTH, h, t, PAL.stone, VK.STONE, ops, { trim: '#6a5a48', shutter: null, glass: false, leaf: '#5a4630', lintel: PAL.conc });
  const top = PLINTH + h;
  b.box(0, top, 0, w + 0.3, 0.25, d + 0.3, PAL.conc, { kind: VK.CONC, tag: 'roof' });
  // korkuluk duvarı (çatı kenarı)
  for (const [bx, bz, bw, bd] of [[0, -d / 2 - 0.15 + 0.1, w + 0.3, 0.2], [0, d / 2 + 0.15 - 0.1, w + 0.3, 0.2], [-w / 2 - 0.05, 0, 0.2, d + 0.3 - 0.4], [w / 2 + 0.05, 0, 0.2, d + 0.3 - 0.4]]) b.box(bx, top + 0.25, bz, bw, 0.45, bd, PAL.conc, { kind: VK.CONC, tag: 'roof' });
  if (o.furnish) b.with(0, PLINTH + 0.03, 0, 0, () => o.furnish(b, { x0: -w / 2 + t, x1: w / 2 - t, z0: -d / 2 + t, z1: d / 2 - t, y: 0, ceil: h - 0.03 }));
}

// ───────── Beton sığınak (bunker): kalın duvar, geniş mazgal (bakış yönü 'face'), arkada giriş ─────────
export function bunker(b, o) {
  const w = o.w ?? 4, d = o.d ?? 6, h = 2.3, t = 0.5;
  const face = o.face ?? 'e', back = { n: 's', s: 'n', e: 'w', w: 'e' }[face];
  const slit = { at: 0, w: (face === 'n' || face === 's' ? w : d) - 1.6, b: 1.15, top: 1.6, kind: 'slit' };
  const ops = { [face]: [slit], [back]: [{ at: 0, w: 1.4, b: 0, top: 2.0, kind: 'door' }] };
  footing(b, 0, -0.4, 0, w + 0.1, 0.4 + 0.15, d + 0.1, PAL.concD, { kind: VK.CONC });
  const hw = w / 2, hd = d / 2;
  const sideDef = { n: ['x', -hw, hw, -hd, -hd + t], s: ['x', -hw, hw, hd - t, hd], w: ['z', -hd + t, hd - t, -hw, -hw + t], e: ['z', -hd + t, hd - t, hw - t, hw] };
  for (const k of ['n', 's', 'w', 'e']) { const [axis, a0, a1, c0, c1] = sideDef[k]; wallRun(b, axis, a0, a1, c0, c1, 0.15, h, PAL.conc, VK.CONC, ops[k] || []); }
  b.box(0, 0.15 + h, 0, w + 0.4, 0.4, d + 0.4, PAL.concD, { kind: VK.CONC, tag: 'roof' });
  // çatıda kum torbası sırası (çatı kenarından içeride, üstüne oturur) — ulaşılmaz süs, çarpışmalı (görsel = çarpışma)
  b.with(0, 0.55 + h, 0, 0, () => {
    if (face === 'e' || face === 'w') P.sandbags(b, (face === 'e' ? 1 : -1) * (w / 2 - 0.2), 0, d - 0.6, Math.PI / 2, 1);
    else P.sandbags(b, 0, (face === 's' ? 1 : -1) * (d / 2 - 0.2), w - 0.6, 0, 1);
  });
}

// ───────── Yıkık taş ev: çatısız, duvar üstleri basamaklı kırık, içeride moloz ─────────
export function ruin(b, rng, o) {
  const w = o.w, d = o.d, t = 0.5, gy = o.gy || (() => 0);
  const hw = w / 2, hd = d / 2;
  const lo = (x0, x1, z0, z1) => Math.min(gy(x0, z0), gy(x1, z0), gy(x0, z1), gy(x1, z1), gy((x0 + x1) / 2, (z0 + z1) / 2));
  const hi = (x0, x1, z0, z1) => Math.max(gy(x0, z0), gy(x1, z0), gy(x0, z1), gy(x1, z1), gy((x0 + x1) / 2, (z0 + z1) / 2));
  const runs = [['x', -hw, hw, -hd, -hd + t, [[0.8, 1.2]]], ['x', -hw, hw, hd - t, hd, []], ['z', -hd + t, hd - t, -hw, -hw + t, [[-0.4, 1.1]]], ['z', -hd + t, hd - t, hw - t, hw, []]];
  for (const [axis, a0, a1, c0, c1, gaps] of runs) {
    const n = Math.round((a1 - a0) / 0.5);
    for (let i = 0; i < n; i++) {
      const s = a0 + i * 0.5, e = s + 0.5, m = (s + e) / 2;
      if (gaps.some(([g, gw]) => Math.abs(m - g) < gw / 2)) continue;
      const hh = 0.6 + 2.2 * Math.abs(Math.sin(m * 1.7 + c0 * 0.9)) * (0.4 + 0.6 * rng());
      // parça kendi ayak izinin en alçağından 0,3 m aşağı iner (temel), üstü en yüksek zeminden hh yukarıda → yamaçta altı boş / gömülü kalmaz
      const [x0, x1, z0, z1] = axis === 'x' ? [s, e, c0, c1] : [c0, c1, s, e];
      const yb = lo(x0, x1, z0, z1) - 0.3, yt = hi(x0, x1, z0, z1) + hh;
      if (axis === 'x') footing(b, m, yb, (c0 + c1) / 2, 0.5, yt - yb, t, PAL.stone);
      else footing(b, (c0 + c1) / 2, yb, m, t, yt - yb, 0.5, PAL.stone);
    }
  }
  // moloz yığını (içeride, duvarlara değmez; kendi zemininde)
  const r1 = lo(-0.4, 1.0, -0.15, 0.95) - 0.15, r1t = hi(-0.4, 1.0, -0.15, 0.95) + 0.45;
  footing(b, 0.3, r1, 0.4, 1.4, r1t - r1, 1.1, PAL.stoneD);
  b.box(0.1, r1t, 0.5, 0.8, 0.3, 0.6, PAL.stone, { kind: VK.STONE });
  const r2 = lo(-1.45, -0.55, -1.25, -0.55) - 0.15, r2t = hi(-1.45, -0.55, -1.25, -0.55) + 0.3;
  footing(b, -1.0, r2, -0.9, 0.9, r2t - r2, 0.7, PAL.stoneD);
}

// ───────── Yel değirmeni (kare taş kule, iki kat, ahşap başlık + dönen kanatlar) ─────────
// Gövde 6 × 6 × 6,4 m, iç merdiven 2. kata; kanatlar 'face' yüzünde, göbek 9 m'de (en alt uç ≈ 3,7 m: yürünen bandın üstünde, çarpışmasız).
// Kanatlar ayrı küçük ağda döner (visual: döndürülecek kanat kutuları sails dizisine eklenir; harita fx'i çevirir).
export function windmill(b, o) {
  const w = 6, d = 6, h = 3.1, t = 0.45;
  const face = o.face ?? 'n';
  const ops = { s: [DOOR(0)], e: [WIN(1.2, { w: 0.8, b: 1.0, top: 2.0 })], w: [WIN(-1.2, { w: 0.8, b: 1.0, top: 2.0 })], n: [WIN(-1.4, { w: 0.8 })] };
  const ops2 = { n: [WIN(0, { w: 1.4, b: 0.9, top: 2.0 })], s: [WIN(0, { w: 1.4, b: 0.9, top: 2.0 })], e: [WIN(0, { w: 1.4, b: 0.9, top: 2.0 })], w: [WIN(0, { w: 1.4, b: 0.9, top: 2.0 })] };
  const r = house(b, {
    w, d, h, t, floors: 2, wall: PAL.stone, wallKind: VK.STONE, roof: PAL.roofTileB, roofKind: VK.ROOF, ridge: face === 'n' || face === 's' ? 'z' : 'x', pitch: 40,
    ops, ops2, trim: { trim: '#6a5038', shutter: '#5a4630', lintel: PAL.stoneL },
    stairHole: [0.9, 2.55, -2.55, 1.0],
    furnish: (bb, I) => {
      // iç merdiven: doğu duvarı boyunca kuzeye yükselir (döşeme boşluğu x 0,9…2,55, z −2,55…1,0)
      const steps = 10, rise = (h - 0.03) / steps, run = 0.34;
      for (let i = 0; i < steps; i++) bb.box(1.725, I.y, 1.0 - (i + 0.5) * run - 0.0, 1.6, rise * (i + 1), run, PAL.plank, { kind: VK.PLANK });
      P.sack(bb, -1.6, I.y, -1.6); P.sack(bb, -1.6, I.y + 0.32, -1.6, 0); P.sack(bb, -0.9, I.y, -1.8, 0);
      bb.box(-1.5, I.y, 1.4, 1.2, 0.5, 1.2, '#8a857a', { kind: VK.STONE });       // değirmen taşı kaidesi
      octCyl(bb, -1.5, I.y + 0.5, 1.4, 0.55, 0.3, '#9a958a', { kind: VK.STONE, small: true });
    },
  });
  // kanatlar: göbek dış yüzün 0,3 m önünde
  const hubY = 9.0, off = (face === 'n' || face === 's' ? d : w) / 2 + 0.7;
  const hub = face === 'n' ? [0, -off] : face === 's' ? [0, off] : face === 'e' ? [off, 0] : [-off, 0];
  b.box(hub[0], hubY - 0.3, hub[1], 0.6, 0.6, 0.6, '#4a3622', { collide: false, kind: VK.WOOD });
  return { hub: [hub[0], hubY, hub[1]], axis: face === 'n' || face === 's' ? 'z' : 'x', top: r.top };
}
// kanat ağı: 4 kanat (çıta + kafes), merkez (0,0,0), dönme ekseni z
export function sailGeometry(THREE) {
  const parts = [];
  const add = (w, h, d, x, y, z, rz) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); g.rotateZ(rz); parts.push(g); };
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2;
    add(0.16, 5.6, 0.12, 0, 3.0, 0, a);                       // kol
    for (let i = 0; i < 6; i++) add(1.5, 0.06, 0.05, 0.62, 1.0 + i * 0.85, 0.05, a);        // kafes çıtaları
    add(0.06, 4.6, 0.05, 1.32, 3.3, 0.05, a);                 // dış çıta
  }
  return parts;
}
