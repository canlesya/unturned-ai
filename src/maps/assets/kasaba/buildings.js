// Kasaba binaları (asset kitinden: modüler bina + eşya + yerleştirici). 12.168
// Her bina KANONİK yönde tanımlanır (ön kapı güney = +z yüzünde, merkez (0,0)); place() ile (cx, cz) konumuna, ry (90° katları) yönüne konur.
// Ölçüler 0,5 m ızgarasında; açıklık kenarları 0,25 m ızgarasında (nav hücre merkezleri 0,25 / 0,75'te: 1,5 m kapı → iki boş hücre).
import * as THREE from 'three';
import { Bld, level, T, TO, FH, BASE } from '../common/kasaba-building.js';
import { boxR, post, hull, extrude, shade, roundCollide, NC } from '../common/kasaba-shapes.js';
import { furnishRoom } from '../common/kasaba-furniture.js';
import * as P from '../common/kasaba-props.js';
import { PAL, KS, bstyle } from './style.js';

const _v = new THREE.Vector3();
// kanonik çerçevede kur, bilgiyi dünyaya çevir
export function place(b, cx, cz, ry, fn, y = 0) {
  let info;
  b.with(cx, y, cz, ry, () => {
    info = fn() || {};
    const W = (p) => { if (!p) return p; _v.set(p.x, p.y || 0, p.z).applyMatrix4(b.M); return { ...p, x: _v.x, y: _v.y, z: _v.z }; };
    info = { ...info, entry: W(info.entry), targets: (info.targets || []).map(W), doors: (info.doors || []).map(W) };
    if (info.box) { const c = [W({ x: info.box.x0, z: info.box.z0 }), W({ x: info.box.x1, z: info.box.z1 })]; info.box = { ...info.box, x0: Math.min(c[0].x, c[1].x), x1: Math.max(c[0].x, c[1].x), z0: Math.min(c[0].z, c[1].z), z1: Math.max(c[0].z, c[1].z) }; }
  });
  return info;
}

// pencere dizisi: [a, b] aralığında eşit aralıklı, yasak aralıklara (kapı, bölme birleşimi, merdiven) değmeyen sol kenarlar
export function bays(a, b, step, w, forbid = []) {
  const n = Math.max(1, Math.floor((b - a) / step)), out = [];
  const s0 = a + ((b - a) - n * step) / 2;
  for (let i = 0; i < n; i++) {
    const c = s0 + step * (i + 0.5), u = Math.round((c - w / 2) * 4) / 4;
    if (forbid.some(([p, q]) => u < q && u + w > p)) continue;
    out.push(u);
  }
  return out;
}

// oda eşyası: odanın içi (iç yüzler) + kaçınılacak alanlar
function furnish(h, rng, k, x0, x1, z0, z1, list, extraAvoid = []) {
  const S = h.S, avoid = [...extraAvoid];
  // kapı önleri (dış kapı + bölme kapıları), merdiven + sahanlıklar
  for (const f of ['n', 's', 'e', 'w']) for (const op of h.ops[f]) {
    if (op.k !== k) continue;
    const isDoor = op.type === 'door' || op.type === 'gate' || op.type === 'arch';
    const dep = isDoor ? 1.5 : 0.6, ext = isDoor ? (op.u1 - op.u0) / 2 + 0.1 : 0;
    const [ax, az] = h.fxz(f, op.u0 - ext, T), [bx, bz] = h.fxz(f, op.u1 + ext, T + dep);
    if (isDoor || op.type === 'shop' || op.type === 'tall') avoid.push([Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)]);
  }
  for (const p of h.parts) if (p.floors.includes(k)) for (const d of p.doors) {
    const w = (d.w || 1.5) / 2 + 0.1;
    if (p.axis === 'x') avoid.push([d.at - w, d.at + w, p.at - 1.4, p.at + 1.4]); else avoid.push([p.at - 1.4, p.at + 1.4, d.at - w, d.at + w]);
  }
  for (const s of h.stairsL) if (s.k === k || s.k + 1 === k) {
    const g = h.stairGeom(s), m = 1.4;
    const R = g.hz ? [g.lo - m, g.hi + m, g.w0 - 0.3, g.w1 + 0.3] : [g.w0 - 0.3, g.w1 + 0.3, g.lo - m, g.hi + m];
    avoid.push(R);
  }
  // pencereler (dünya aralığı) — uzun eşya önüne gelmez
  const wins = { n: [], s: [], e: [], w: [] };
  for (const f of ['n', 's', 'e', 'w']) for (const op of h.ops[f]) if (op.k === k) { const [ax, az] = h.fxz(f, op.u0, 0), [bx, bz] = h.fxz(f, op.u1, 0); wins[f].push(f === 'n' || f === 's' ? [Math.min(ax, bx), Math.max(ax, bx)] : [Math.min(az, bz), Math.max(az, bz)]); }
  // odanın yüzleri hangi dış yüze denk geliyor: yalnız dış duvara yaslı yüzlerde pencere sayılır
  const rw = { n: Math.abs(z0 - (h.z0 + T)) < 0.05 ? wins.n : [], s: Math.abs(z1 - (h.z1 - T)) < 0.05 ? wins.s : [], w: Math.abs(x0 - (h.x0 + T)) < 0.05 ? wins.w : [], e: Math.abs(x1 - (h.x1 - T)) < 0.05 ? wins.e : [] };
  // gerçek duvar olan yüzler: dış duvar iç yüzü ya da o kattaki bölme
  const isPart = (axis, c) => h.parts.some((p) => p.floors.includes(k) && p.axis === axis && Math.abs(Math.abs(p.at - c) - 0.07) < 0.03);
  const solid = { n: Math.abs(z0 - (h.z0 + T)) < 0.05 || isPart('x', z0), s: Math.abs(z1 - (h.z1 - T)) < 0.05 || isPart('x', z1), w: Math.abs(x0 - (h.x0 + T)) < 0.05 || isPart('z', x0), e: Math.abs(x1 - (h.x1 - T)) < 0.05 || isPart('z', x1) };
  // tavan lambası (oda ortasında, merdiven / kapı önü değilse; gece parlar)
  const lx = (x0 + x1) / 2, lz = (z0 + z1) / 2, top = level(k + 1) - 0.2;
  const sr = k + 1 < h.F && h.o.slabRect ? h.o.slabRect[k + 1] : null, inSlab = !sr || (lx > sr[0] && lx < sr[1] && lz > sr[2] && lz < sr[3]);
  if (inSlab && !(h.o.skipSlab || []).includes(k + 1) && !avoid.some((r) => lx > r[0] - 0.3 && lx < r[1] + 0.3 && lz > r[2] - 0.3 && lz < r[3] + 0.3)) h.b.obj('eşya:tavan-lambası', () => {
    boxR(h.b, lx - 0.02, lx + 0.02, top - 0.42, top, lz - 0.02, lz + 0.02, '#3a3d42', KS.metal, NC);
    boxR(h.b, lx - 0.22, lx + 0.22, top - 0.6, top - 0.42, lz - 0.22, lz + 0.22, '#e8e0c8', KS.plain, NC);
    boxR(h.b, lx - 0.16, lx + 0.16, top - 0.64, top - 0.6, lz - 0.16, lz + 0.16, '#ffe2a0', KS.plain, { collide: false, o: { glow: true } });
  });
  return furnishRoom(h.b, S, rng, { x0, x1, z0, z1, y: level(k), avoid, wins: rw, solid }, list);
}

// ═════════ KONUT (beşik çatı, 2–3 kat) ═════════
// w × d (≥ 8 × 8), ön kapı güneyde u = doorU. Arka odada kuzey duvarı boyunca merdiven (3 katta dönüşlü iki kol).
export function house(b, rng, id, { w = 9, d = 9, floors = 2, style, doorU = 1.25, balcony = false, roofAxis = 'x', pitch = 0.62, decor = true, overG = 0.3, party = null } = {}) {
  // party: 'e' | 'w' → o yüz komşu binaya sırt sırta (ortak duvar): süs, pencere ve alın taşması yok
  const S = style;
  const x0 = -w / 2, z0 = -d / 2, ix0 = x0 + T, ix1 = w / 2 - T, iz0 = z0 + T, iz1 = d / 2 - T;
  const oG = party === 'e' ? [overG, 0] : party === 'w' ? [0, overG] : overG;
  const h = new Bld(b, { id, x0, z0, w, d, floors, style: S, noDecor: party ? [party] : [], roof: { type: 'gable', axis: roofAxis, pitch, overE: 0.4, overG: oG } });
  const zp = iz0 + 3.4 + 0.07;                                            // arka oda / ön oda bölmesi (x boyunca)
  const xs = ix0 + 1.0, xe = xs + 3.6;                                     // merdiven kolu A (kuzey duvarı, +x)
  const pdoor = Math.round(Math.min(ix1 - 1.0, xe + 1.0) * 2) / 2;          // bölme kapısı ortası (varış sahanlığının önünde; kenarlar 0,25 ızgarasında → nav'da iki boş hücre)
  h.part('x', zp, ix0, ix1, [...Array(floors).keys()], [{ at: pdoor, w: 1.5 }]);
  h.stair(0, xs, iz0 + 0.6, '+x', { wall: 'l', rails: floors > 2 ? ['end'] : undefined });
  if (floors > 2) h.stair(1, xe, iz0 + 1.8, '-x', { wall: null });
  // açıklıklar: güney (ön) kapı + pencereler; kuzey: merdiven üstü pencere yok
  h.door('s', doorU, { canopy: true, main: true });
  const fS = [[doorU - 0.7, doorU + 2.2]];
  const winS = bays(0.6, w - 0.6, 2.6, 1.0, []);
  for (let k = 0; k < floors; k++) {
    const fb = k === 0 ? fS : [];
    for (const u of winS) if (!fb.some(([p, q]) => u < q && u + 1 > p)) {
      if (balcony && k === 1 && Math.abs(u + 0.5 - (doorU + 0.75)) < 1.3) continue;
      h.open('s', u, 'win', [k]);
    }
  }
  if (balcony) { h.open('s', doorU + 0.25, 'door', [1], { w: 1.0, leaf: false }); h.balcony('s', doorU - 0.55, doorU + 2.05, 1, 1.1); }
  const stairBand = [[xs - x0 - 0.4, xe - x0 + 0.4]];
  for (let k = 0; k < floors; k++) for (const u of bays(0.6, w - 0.6, 2.6, 1.0, stairBand)) h.open('n', u, 'win', [k]);
  // yan (alın) yüzler: ön odada bir pencere, arka odada (merdiven başı değilse) bir pencere
  for (const f of ['e', 'w'].filter((q) => q !== party)) for (let k = 0; k < floors; k++) {
    const uFront = Math.round(((zp + iz1) / 2 - z0 - 0.5) * 4) / 4;
    h.open(f, uFront, 'win', [k]);
    if (f === 'e' && k === 0) h.open(f, Math.round((iz0 - z0 + 1.5) * 4) / 4, 'win', [k]);
  }
  const info = h.build();
  // eşya: zemin kat ön oda oturma, arka oda mutfak; üst katlar yatak odası
  furnish(h, rng, 0, ix0, ix1, zp + 0.07, iz1, ['sofa', 'shelf', 'cabinet', { center: 'table', chairs: 4 }]);
  furnish(h, rng, 0, ix0, ix1, iz0, zp - 0.07, ['counter', 'stove', 'fridge']);
  for (let k = 1; k < floors; k++) {
    furnish(h, rng, k, ix0, ix1, zp + 0.07, iz1, ['bed', 'wardrobe', 'cabinet', { center: 'rug' }]);
    furnish(h, rng, k, ix0, ix1, iz0, zp - 0.07, k === floors - 1 ? ['bed', 'cabinet'] : ['desk', 'shelf']);
  }
  return info;
}

// ═════════ DÜZ ÇATILI KAMU / TİCARİ BİNA (okul, karakol, belediye, banka, pazar hali, ofis) ═════════
// theme: 'school' | 'police' | 'townhall' | 'bank' | 'market' | 'office'. Merdiven çekirdeği iç tarafta (dış duvara değmez) → çatı çıkışı kulübesi.
export function civic(b, rng, id, { w = 11, d = 9, floors = 2, style, theme = 'office', doorU = null, access = true, shopFront = false, signs = [], extraDoors = [], canopy = !shopFront } = {}) {
  const S = style;
  const x0 = -w / 2, z0 = -d / 2, ix0 = x0 + T, ix1 = w / 2 - T, iz0 = z0 + T, iz1 = d / 2 - T;
  const h = new Bld(b, { id, x0, z0, w, d, floors, style: S, roof: { type: 'flat', access, parapet: 1.0 }, signs });
  // merdiven çekirdeği: batı yarıda, kuzeyden 1,8 m içeride; kollar z boyunca (A: −z, B: +z), şeritler x'te [cx−1.2, cx] / [cx, cx+1.2]
  const cx = Math.round((x0 + Math.max(3.4, w * 0.3)) * 2) / 2, zN = z0 + 1.8, zS = zN + 3.6;
  for (let k = 0; k < floors; k++) {
    const A = k % 2 === 0;
    const last = k === floors - 1;
    if (A) h.stair(k, cx - 0.6, zS, '-z', { wall: null, rails: last ? [] : ['l', 'end'] });
    else h.stair(k, cx + 0.6, zN, '+z', { wall: null, rails: last ? [] : ['r', 'end'] });
  }
  h.roof.accessDoor = 'e';
  // bölmeler: zemin kat açık salon; üst katlarda koridor bölmesi (x boyunca, merdivenin güneyinde) + oda bölmeleri
  const zc = zS + 1.5;                                                      // koridor bölmesi (üst katlar)
  if (floors > 1 && zc < iz1 - 3) {
    const fl = [...Array(floors).keys()].slice(1);
    const doorsX = bays(ix0 + 0.5, ix1 - 0.5, 3.6, 1.5, []).map((u) => ({ at: u + 0.75, w: 1.5 }));
    h.part('x', zc, ix0, ix1, fl, doorsX);
    const xr = Math.round(((ix0 + ix1) / 2 + 1.5) * 2) / 2;
    if (xr + 0.07 < ix1 - 2) h.part('z', xr, zc + 0.07, iz1, fl, []);
  }
  // ön cephe
  const du = doorU ?? Math.round((w / 2 - 0.75) * 4) / 4;
  h.door('s', du, { canopy, main: true });
  for (const [f, u] of extraDoors) h.door(f, u);
  const fS = [[du - 0.6, du + 2.1]];
  if (shopFront) {
    for (const u of bays(0.6, w - 0.6, 3.4, 2.5, fS)) h.open('s', u, 'shop', [0]);
  } else for (const u of bays(0.6, w - 0.6, 2.6, 1.0, fS)) h.open('s', u, theme === 'townhall' ? 'tall' : 'win', [0]);
  for (let k = 1; k < floors; k++) for (const u of bays(0.6, w - 0.6, 2.6, 1.0, [])) h.open('s', u, 'win', [k]);
  for (let k = 0; k < floors; k++) for (const u of bays(0.6, w - 0.6, 2.6, 1.0, [])) h.open('n', u, 'win', [k]);
  for (const f of ['e', 'w']) for (let k = 0; k < floors; k++) for (const u of bays(0.6, d - 0.6, 2.8, 1.0, extraDoors.filter(([g]) => g === f).map(([, u]) => [u - 0.6, u + 2.1]))) h.open(f, u, 'win', [k]);
  const info = h.build();
  // eşya
  const G = { school: ['board', 'schooldesk', 'schooldesk', 'schooldesk', 'shelf', 'cabinet'], police: ['locker', 'desk', 'desk', 'cabinet', 'locker'], townhall: ['desk', 'shelf', 'shelf', 'cabinet', { center: 'rug' }],
    bank: ['counter', 'safe', 'desk', 'cabinet'], market: ['counter', 'shelf', 'shelf', 'cabinet', 'fridge'], office: ['desk', 'desk', 'shelf', 'cabinet'] }[theme];
  furnish(h, rng, 0, ix0, ix1, iz0, iz1, G);
  for (let k = 1; k < floors; k++) {
    furnish(h, rng, k, ix0, ix1, zc + 0.07, iz1, theme === 'school' ? ['board', 'schooldesk', 'schooldesk', 'schooldesk'] : ['desk', 'shelf', 'cabinet', 'desk']);
  }
  return info;
}

// ═════════ GARAJ / ATÖLYE (tek kat, düz çatı, iki büyük kapı) ═════════
export function garage(b, rng, id, { w = 11, d = 9, style, access = false } = {}) {
  const S = style, x0 = -w / 2, z0 = -d / 2, ix0 = x0 + T, ix1 = w / 2 - T, iz0 = z0 + T, iz1 = d / 2 - T;
  const h = new Bld(b, { id, x0, z0, w, d, floors: 1, style: S, roof: { type: 'flat', access, parapet: 0.9 }, signs: [{ f: 's', u0: 1.0, u1: w - 1.0, y0: 3.35, y1: 3.95, color: '#2c5aa0', text: '#e8e4d8' }] });
  h.open('s', 1.0, 'gate', [0], { w: 3.5 }); h.open('s', w - 4.5, 'gate', [0], { w: 3.5 });
  h.door('n', Math.round((w / 2 - 0.75) * 4) / 4, { main: false });
  h.open('e', 2.0, 'win', [0]); h.open('w', 2.0, 'win', [0]); h.open('e', d - 3.0, 'win', [0]); h.open('w', d - 3.0, 'win', [0]);
  if (access) h.stair(0, 0.5, iz0 + 2.2 + 3.6, '-z', { wall: null, rails: [] });
  const info = h.build();
  furnish(h, rng, 0, ix0, ix1, iz0, iz1, ['workbench', 'rack', 'locker', 'workbench', 'barrels']);
  return info;
}

// ═════════ KİLİSE: nef (çift yükseklik) + çan kulesi (4 kat, içten merdiven, kemerli çan katı, piramit çatı) ═════════
export function church(b, rng, id, { style, towerStyle } = {}) {
  const S = style, St = towerStyle || style;
  // nef: x [−4.5, 4.5], z [0, 12]; kule: x [−2.5, 2.5], z [−5, 0] (nefin kuzeyinde, giriş kuzeyden)
  const nave = new Bld(b, { id: id + '-nef', x0: -4.5, z0: 0, w: 9, d: 12, floors: 2, style: S, skipSlab: [1], bands: false, roof: { type: 'gable', axis: 'z', pitch: 0.85, overE: 0.45, overG: [0, 0.35] } });
  nave.out.n.push({ u0: 1.9, u1: 7.1, y0: 0, y1: 99 });                       // kulenin yaslandığı bölgede cephe şeridi yok
  nave.door('n', 3.75, { leaf: false, casing: false });                        // kule geçidi (x −0.75…0.75)
  nave.door('s', 3.75);                                                       // arka kapı
  for (const f of ['e', 'w']) for (const u of [2.0, 5.25, 8.5]) nave.open(f, u, 'tall', [0], { y1: 5.2, w: 1.25 });
  nave.open('s', 1.25, 'tall', [0], { y1: 4.4, w: 1.0 }); nave.open('s', 6.75, 'tall', [0], { y1: 4.4, w: 1.0 });
  const ni = nave.build();
  // kule (nefin kuzey alın duvarına sırt sırta; ortak yüzlerde süs yok)
  const tw = new Bld(b, { id: id + '-kule', x0: -2.5, z0: -5, w: 5, d: 5, floors: 4, style: St, noDecor: ['s'], bands: true, roof: { type: 'pyramid', pitch: 1.6, overE: 0.35 } });
  tw.door('n', 1.75, { canopy: true, main: true, leaf: true });
  tw.door('s', 1.75, { leaf: false, casing: false });
  for (const f of ['e', 'w']) tw.open(f, 1.75, 'win', [1, 2], { w: 1.0 });
  tw.open('n', 2.0, 'win', [1, 2]);
  for (const f of ['n', 'e', 'w', 's']) tw.open(f, 1.25, 'arch', [3], { w: 2.5, y1: 2.5 });
  // merdivenler: kollar batı / doğu duvarlarında, z boyunca (kanonik: kule iç z [−4.7, −0.3])
  const run = 0.26, n = 12, L = n * run;
  tw.stair(0, -1.6, -0.3, '-z', { wall: 'l', run, n, rails: ['r'] });
  tw.stair(1, 1.6, -0.3 - L, '+z', { wall: 'r', run, n, rails: ['l', 'end'] });
  tw.stair(2, -1.6, -0.3, '-z', { wall: 'l', run, n, rails: ['r'] });
  const ti = tw.build();
  // çan (çan katının tavanından asılı: tavan döşemesine yapışık askı + çan gövdesi kesik koni)
  const by = level(4) - 0.2;
  boxR(b, -0.06, 0.06, by - 0.5, by, -2.56, -2.44, '#3a3d42', KS.metal, NC);
  b.obj('çan', () => { b.cyl(0, by - 1.45, -2.5, 0.28, 0.6, 0.95, '#8a6a2a', { seg: 8, ry: Math.PI / 8, collide: false, kind: KS.metal }); roundCollide(b, 0, by - 1.45, -2.5, 0.28, 0.95); });
  // nef içi: sıralar + mihrap
  for (let r = 0; r < 4; r++) for (const sx of [-1, 1]) {
    const z = 3.0 + r * 1.6;
    b.with(sx * 2.05, level(0), z, 0, () => b.obj('eşya:sıra', () => { boxR(b, -1.3, 1.3, 0, 0.44, 0.1, 0.6, '#6a4a30', KS.wood); boxR(b, -1.3, 1.3, 0, 0.95, 0, 0.1, '#5a3d24', KS.wood); }));
  }
  b.with(0, level(0), 10.0, 0, () => b.obj('eşya:mihrap', () => {
    boxR(b, -1.0, 1.0, 0, 0.15, 0, 0.9, '#b9b5aa', KS.stone); boxR(b, -0.8, 0.8, 0.15, 0.95, 0.1, 0.8, '#d8d0bc', KS.stone);
    boxR(b, -0.9, 0.9, 0.95, 1.0, 0.05, 0.85, '#e8e0cc', KS.stone, NC);
    for (const x of [-0.6, 0.6]) { boxR(b, x - 0.04, x + 0.04, 1.0, 1.3, 0.4, 0.48, '#c8a050', KS.metal, NC); boxR(b, x - 0.025, x + 0.025, 1.3, 1.36, 0.415, 0.465, '#ffe2a0', KS.plain, { collide: false, o: { glow: true } }); }
  }));
  // avize (nef tavanından, sıraların ortasında)
  b.obj('eşya:avize', () => {
    const top = level(2) - 0.2, z = 6.0;
    boxR(b, -0.03, 0.03, top - 1.2, top, z - 0.03, z + 0.03, '#3a3d42', KS.metal, NC);
    boxR(b, -0.6, 0.6, top - 1.3, top - 1.2, z - 0.6, z + 0.6, '#8a6a2a', KS.metal, NC);
    for (const [dx, dz] of [[-0.5, -0.5], [0.44, -0.5], [-0.5, 0.44], [0.44, 0.44]]) boxR(b, dx, dx + 0.06, top - 1.2, top - 1.1, z + dz, z + dz + 0.06, '#ffe2a0', KS.plain, { collide: false, o: { glow: true } });
  });
  return { entry: ti.entry, doors: [...ti.doors, ...ni.doors], targets: [...ni.targets.slice(0, 1), ...ti.targets], box: { x0: -4.5, x1: 4.5, z0: -5, z1: 12, H: ti.box.ridge } };
}

// ═════════ BENZİNLİK: sundurma (4 sütun + kalın saçak) + pompa adaları + market (tek kat) ═════════
export function gasStation(b, rng, id, { style } = {}) {
  const S = style;
  // sundurma: x [−5, 5], z [−4, 4]; sütunlar 0,5 × 0,5; çatı 4,2…4,9
  b.obj('benzinlik:sundurma', () => {
    for (const x of [-4.5, 4.0]) for (const z of [-3.5, 3.0]) boxR(b, x, x + 0.5, 0.15, 4.2, z, z + 0.5, '#e8e8e4', KS.conc);
    boxR(b, -5.5, 5.5, 4.2, 4.9, -4.5, 4.5, '#e8e8e4', KS.conc);
    boxR(b, -5.56, 5.56, 4.45, 4.75, -4.56, -4.5, '#c0392b', KS.paint, NC); boxR(b, -5.56, 5.56, 4.45, 4.75, 4.5, 4.56, '#c0392b', KS.paint, NC);
    boxR(b, -5.56, -5.5, 4.45, 4.75, -4.5, 4.5, '#c0392b', KS.paint, NC); boxR(b, 5.5, 5.56, 4.45, 4.75, -4.5, 4.5, '#c0392b', KS.paint, NC);
    boxR(b, -5.5, 5.5, 0, 0.15, -4.5, 4.5, '#b9b5aa', KS.paver);           // beton zemin
    for (const z of [-1.4, 1.4]) {                                          // pompa adası: bordür + iki pompa
      boxR(b, -3.0, 3.0, 0.15, 0.35, z - 0.45, z + 0.45, '#d8d4c8', KS.conc);
      for (const x of [-1.8, 1.0]) { boxR(b, x, x + 0.8, 0.35, 1.9, z - 0.3, z + 0.3, '#d8d8d4', KS.plain); boxR(b, x, x + 0.8, 1.9, 2.1, z - 0.32, z + 0.32, '#c0392b', KS.paint); boxR(b, x + 0.15, x + 0.65, 1.0, 1.6, z + 0.3, z + 0.32, '#2a2b2e', KS.plain, NC); }
    }
  });
  b.softCover?.(0, 4.6, 0, 0.1);
  // market: x [−5.5, 2.5], z [−11, −5] (sundurmanın kuzeyinde), kapı güneyde
  const h = new Bld(b, { id: id + '-market', x0: -5.5, z0: -11.5, w: 8, d: 6, floors: 1, style: S, roof: { type: 'flat', parapet: 0.8 }, signs: [{ f: 's', u0: 0.8, u1: 7.2, y0: 3.2, y1: 3.85, color: '#c0392b', text: '#f2efe8' }] });
  h.door('s', 5.25, { main: true }); h.open('s', 1.0, 'shop', [0], { w: 3.0 });
  h.open('w', 2.0, 'win', [0]); h.open('e', 2.5, 'win', [0]); h.door('n', 2.25);
  const info = h.build();
  furnish(h, rng, 0, -5.5 + T, 2.5 - T, -11.5 + T, -5.5 - T, ['counter', 'shelf', 'fridge', 'shelf']);
  return { ...info, box: { x0: -5.6, x1: 5.6, z0: -11.6, z1: 4.6, H: 4.9 } };
}

// ═════════ AMBAR (çiftlik): tahta kaplama, beşik çatı, iki büyük kapı, samanlık asma katı ═════════
export function barn(b, rng, id, { w = 10, d = 14, style } = {}) {
  const S = { ...style, wallBands: [[0, 99, '#8a3a2c', KS.board]], inner: '#7a5a3a', floor: '#8a7a5a', trim: '#e8e4d8', pil: '#e8e4d8' };
  const x0 = -w / 2, z0 = -d / 2;
  const h = new Bld(b, { id, x0, z0, w, d, floors: 2, style: S, skipSlab: [], slabRect: { 1: [x0 + T, x0 + T + 4.0, z0 + T, d / 2 - T] }, bands: false, plinth: false, roof: { type: 'gable', axis: 'z', pitch: 0.75, overE: 0.4, overG: 0.3 } });
  h.open('s', w / 2 - 1.75, 'gate', [0], { w: 3.5, y1: 3.0, roll: false }); h.open('n', w / 2 - 1.75, 'gate', [0], { w: 3.5, y1: 3.0, roll: false });
  h.open('e', 3.0, 'win', [0]); h.open('e', d - 4.0, 'win', [0]); h.open('w', d / 2 - 0.5, 'win', [1]);
  // samanlık merdiveni: asma katın doğu kenarında, +z (kuzeyden güneye çıkar), varış asma kat üstünde değil: kol asma katın yanında, sahanlık kolun ucunda (asma kat kenarı)
  const lx = x0 + T + 4.0;
  h.stair(0, lx + 0.6, z0 + T + 1.0, '+z', { wall: 'l', rails: [] });        // batı yanı asma kata açılır (son basamaklardan asma kata geçilir)
  h.rail(lx - 0.06, lx, z0 + T, z0 + T + 3.4, 1); h.rail(lx - 0.06, lx, z0 + T + 4.6, d / 2 - T, 1);   // asma kat açık kenarı; varış önünde 1,2 m açıklık
  const info = h.build();
  for (const [x, z, y] of [[x0 + 1.2, z0 + 2, level(1)], [x0 + 1.2, z0 + 3.3, level(1)], [x0 + 2.5, z0 + 2, level(1)], [x0 + 1.2, d / 2 - 2, level(1)], [x0 + 2.4, d / 2 - 2.2, level(1)], [x0 + 1.2, z0 + 2.65, level(1) + 0.6]]) P.hayBale(b, S, x, z, y, Math.PI / 2);
  P.hayBale(b, S, w / 2 - 1.2, 0, BASE); P.hayBale(b, S, w / 2 - 1.2, 0, BASE + 0.6); P.hayBale(b, S, w / 2 - 1.2, 1.3, BASE);
  return info;
}

// ═════════ DEPO (oluklu sac, alçak eğimli çatı, asma kat) ═════════
export function warehouse(b, rng, id, { w = 14, d = 12, style } = {}) {
  const S = { ...style, wallBands: [[0, 99, '#8f949c', KS.corr]], inner: '#9aa0a6', floor: '#8a8d8a', roof: '#6c7078', trim: '#5a5e64', pil: '#5a5e64', sill: '#5a5e64', frame: '#4a4d52' };
  const x0 = -w / 2, z0 = -d / 2;
  const h = new Bld(b, { id, x0, z0, w, d, floors: 2, style: S, slabRect: { 1: [x0 + T, x0 + T + 4.5, z0 + T, d / 2 - T] }, bands: false, roof: { type: 'gable', axis: 'x', pitch: 0.32, overE: 0.35, overG: 0.25 } });
  h.open('s', w / 2 - 1.0, 'gate', [0], { w: 4.0, y1: 3.4 }); h.door('e', d / 2 - 0.75); h.door('n', w - 3.75);
  for (const u of [3.0, 6.0]) h.open('n', u, 'win', [1]);
  const lx = x0 + T + 4.5;
  h.stair(0, lx + 0.6, z0 + T + 1.2, '+z', { wall: 'l', rails: [] });
  h.rail(lx - 0.06, lx, z0 + T, z0 + T + 3.6, 1); h.rail(lx - 0.06, lx, z0 + T + 4.8, d / 2 - T, 1);
  const info = h.build();
  furnish(h, rng, 0, lx + 1.4, w / 2 - T, z0 + T, d / 2 - T, ['rack', 'rack', 'workbench']);
  furnish(h, rng, 1, x0 + T, lx - 0.06, z0 + T, d / 2 - T, ['rack', 'cabinet']);
  return info;
}

// ═════════ KULÜBE (tek kat, beşik çatı) ═════════
export function hut(b, rng, id, { w = 7, d = 6, style } = {}) {
  const S = style, x0 = -w / 2, z0 = -d / 2;
  const h = new Bld(b, { id, x0, z0, w, d, floors: 1, style: S, roof: { type: 'gable', axis: 'x', pitch: 0.65, overE: 0.4, overG: 0.3 } });
  h.door('s', Math.round((w / 2 - 0.75) * 4) / 4, { canopy: true, main: true });
  h.open('n', w / 2 - 0.5, 'win', [0]); h.open('e', d / 2 - 0.5, 'win', [0]); h.open('w', d / 2 - 0.5, 'win', [0]);
  const info = h.build();
  furnish(h, rng, 0, x0 + T, w / 2 - T, z0 + T, d / 2 - T, ['bed', 'cabinet', 'shelf', { center: 'table', chairs: 2 }]);
  return info;
}

