import { KK } from './surface.js';
import { Q, footY, worldRect, pickOf, lw, ctxAdd } from '../common/kuzeyKit.js';
import { house, barn, church } from './house.js';
import { hall, silo, chimney, tank, office } from './industry.js';
import { dam, pylon, pole } from './infra.js';
import { helipad, hangar, barracks, hesco, watchtower, radarTower, parking } from './military.js';
import { fence, stoneWall, logStack, crate, barrel, hayBale, streetLamp, jersey, wreck } from './props.js';
import { DAM, HELIPADS, VEHICLES, HQ } from './layout.js';
import { tank as tankM, apc as apcM, jeep as jeepM, truck as truckM } from '../../vehicles.js';
import { placeFill } from './hamlets.js';
import { spillwaySill } from '../common/kuzeyRural.js';
import { makeRng } from '../../builder.js';

// Kuzey Vadisi yerleşimi — AŞAMA 1 iskeleti (12.172): bölgeler gerçek varlıklarla, ama seyrek (taslak). Her yapı ChunkSet'te konumunun yığınına yazılır.
// occ: yapı ayak izleri (ağaç / çakışma süzgeci). Yerleşim deterministik (tohumlu rng): sunucu = istemci.
export function placeAll(cs, T, rng) {
  const occ = [], wires = [];
  const at = (x, z) => cs.at(x, z), b0 = cs.at(0, 0);
  const free = (r, pad = 1.5) => {
    for (const o of occ) if (r[0] - pad < o[1] && r[1] + pad > o[0] && r[2] - pad < o[3] && r[3] + pad > o[2]) return false;
    for (let x = r[0]; x <= r[1]; x += 2) for (let z = r[2]; z <= r[3]; z += 2) if (T.roadAt(x, z) || T.heightAt(x, z) < 1.2) return false;
    return true;
  };
  const put = (fn, o, w, d) => { const r = worldRect(o.x, o.z, w, d, o.ry || 0); if (!free(r, o.pad ?? 1.5)) return null; occ.push(r); return fn(at(o.x, o.z), T, o); };
  // 12.182: araç doğuş noktaları + helipedler önce ayrılır (yapı üstlerine kurulmaz: araç / helikopter doğuşu hep boş)
  for (const v of VEHICLES) if (!v.type.startsWith('heli')) occ.push([v.x - 4, v.x + 4, v.z - 4, v.z + 4]);
  for (const hp of HELIPADS) occ.push([hp.x - hp.r - 2, hp.x + hp.r + 2, hp.z - hp.r - 2, hp.z + hp.r + 2]);
  // 12.182 HESCO / istihkâm hattı yolu kesmez: hat yol hücrelerinin (± 2 m) olduğu yerde açıklık bırakır
  const hescoLine = (x0, z0, x1, z1, rows = 2) => {
    const ax = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = ax ? x1 - x0 : z1 - z0, n = Math.max(1, Math.round(Math.abs(L) / 1.1)), st = L / n;
    const ok = (k) => { const c = (k + 0.5) * st, x = ax ? x0 + c : x0, z = ax ? z0 : z0 + c; for (const e of [-2.6, 0, 2.6]) if (T.roadAt(ax ? x + e : x, ax ? z : z + e) || T.roadAt(ax ? x : x + 1.6, ax ? z + 1.6 : z) || T.roadAt(ax ? x : x - 1.6, ax ? z - 1.6 : z)) return false; return true; };
    let s0 = null;
    for (let k = 0; k <= n; k++) {
      const good = k < n && ok(k);
      if (good && s0 == null) s0 = k;
      if (!good && s0 != null) { const a = s0 * st, c = k * st; hesco(at(ax ? x0 + (a + c) / 2 : x0, ax ? z0 : z0 + (a + c) / 2), T, ax ? x0 + a : x0, ax ? z0 : z0 + a, ax ? x0 + c : x0, ax ? z0 : z0 + c, rows); occ.push(ax ? [x0 + Math.min(a, c), x0 + Math.max(a, c), z0 - 0.6, z0 + 0.6] : [x0 - 0.6, x0 + 0.6, z0 + Math.min(a, c), z0 + Math.max(a, c)]); s0 = null; }
    }
  };
  const faceTo = (x, z, tx, tz) => { let best = 0, bd = -2; for (let k = 0; k < 4; k++) { const ry = k * Q, d = Math.sin(ry) * (tx - x) + Math.cos(ry) * (tz - z); if (d > bd) { bd = d; best = ry; } } return best; };

  // ── B · Köy ──
  const VC = { x: -230, z: 250 }, WALLS = ['#d8cfbd', '#cdbb98', '#e0d6c2', '#b9a886', '#c9c1b0', '#d2b48e', '#bfc2b4'], ROOFS = ['#8a4a32', '#7a3f2c', '#6e4434', '#93553a'];
  put(church, { x: VC.x - 4, z: VC.z - 30, ry: 0, id: 'kilise' }, 16, 26);
  // 12.172 organik köy: evler sokakların (yollar + dar kaldırım taşı sokaklar) iki yanına, düzensiz aralıkla, cephesi sokağa dönük dizilir.
  // Arkada bahçe duvarı / çit (1,6 m geçit: piyade geçer, araç geçmez), kulübe, odun yığını, çamaşır ipi. Dönüş 90°'nin katı (çarpışma eksen hizalı).
  const streets = T.roads.map((r) => ({ r, pts: r.pts.filter((q) => Math.hypot(q[0] - VC.x, q[1] - VC.z) < 132) })).filter((q) => q.pts.length > 3);
  const facing = (nx, nz) => { let best = 0, bd = -2; for (let k = 0; k < 4; k++) { const ry = k * Q, dd = Math.sin(ry) * nx + Math.cos(ry) * nz; if (dd > bd) { bd = dd; best = ry; } } return best; };
  for (const { r, pts } of streets) for (const side of [-1, 1]) {
    let next = rng() * 8;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], dl = Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); next -= dl;
      if (next > 0) continue;
      const tx = pts[i + 1][0] - pts[i - 1][0], tz = pts[i + 1][1] - pts[i - 1][1], L = Math.hypot(tx, tz) || 1, nx = -tz / L * side, nz = tx / L * side;
      const floors = rng() < 0.6 ? 2 : 1, w = 7 + rng() * 3.5, d = 6 + rng() * 2, setback = r.w / 2 + 2.2 + rng() * 2.8;
      const ry = facing(-nx, -nz), x = p[0] + nx * (setback + d / 2), z = p[1] + nz * (setback + d / 2);
      next = w + 3.5 + rng() * 7;
      if (Math.hypot(x - VC.x, z - VC.z) < 26 || Math.hypot(x - VC.x, z - VC.z) > 125) continue;          // meydan boş
      const fy = footY(T, ...worldRect(x, z, w, d, ry)); if (fy.max - fy.min > 2.6) continue;
      const res = put(house, { x, z, w, d, ry, floors, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS), roofKind: rng() < 0.85 ? KK.TILE : KK.SHEET, seed: Math.floor(rng() * 9), pad: 1.6 }, w + 0.3, d + 0.3);
      if (!res) continue;
      // arka bahçe: duvar / çit (bir uçta 1,6 m geçit), kulübe, odun, çamaşır ipi
      const back = (k) => lw(x, z, ry, 0, -(d / 2 + k));
      if (rng() < 0.7) {
        const [ax, az] = lw(x, z, ry, -w / 2 - 1.2, -(d / 2 + 4.2)), [bx, bz] = lw(x, z, ry, w / 2 - 0.4, -(d / 2 + 4.2));
        const rr = [Math.min(ax, bx) - 0.4, Math.max(ax, bx) + 0.4, Math.min(az, bz) - 0.4, Math.max(az, bz) + 0.4];
        if (free(rr, 0.2)) { (rng() < 0.45 ? stoneWall : fence)(at(ax, az), T, ax, az, bx, bz); occ.push(rr); }
      }
      if (rng() < 0.35) { const [sx, sz] = back(2.2); put(barn, { x: sx + (rng() - 0.5) * 3, z: sz, w: 4.4, d: 3.4, h: 2.6, ry, wall: '#7d5a3d', roof: '#5d6459', pad: 0.6 }, 4.7, 3.7); }
      else if (rng() < 0.5) { const [sx, sz] = back(1.8); if (free([sx - 1.6, sx + 1.6, sz - 1.6, sz + 1.6], 0.3)) { logStack(at(sx, sz), T, sx, sz, (Math.round(ry / Q) & 1) ? 'z' : 'x', 2.4, 2, 0.16); occ.push([sx - 1.4, sx + 1.4, sz - 1.4, sz + 1.4]); } }
      if (rng() < 0.3) { const [ax, az] = lw(x, z, ry, -w / 2 + 0.5, -(d / 2 + 2.6)), [bx, bz] = lw(x, z, ry, w / 2 - 0.5, -(d / 2 + 2.6)); ctxAdd(b0, 'laundry', [ax, T.heightAt(ax, az), az, bx, T.heightAt(bx, bz), bz]); }
    }
  }
  // meydan çeşmesi + lambalar
  // meydan lambaları (12.182: yol hücresine düşen lamba konmaz)
  for (const [dx, dz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) { const lx = VC.x + dx, lz = VC.z + dz; if (T.roadAt(lx, lz) || T.roadAt(lx + 0.8, lz) || T.roadAt(lx, lz + 0.8) || T.roadAt(lx - 0.8, lz) || T.roadAt(lx, lz - 0.8)) continue; streetLamp(at(lx, lz), T, lx, lz); occ.push([lx - 0.3, lx + 0.3, lz - 0.3, lz + 0.3]); }
  // 12.182 çeşme: meydanda, bayrak merkezinin (B direği) ve yolların dışında; kaide eğimde en alçak köşeye iner
  for (const [ox, oz] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, -8.5], [0, 8.5], [-8.5, 0], [8.5, 0]]) {
    const cx = VC.x + ox, cz = VC.z + oz; let road = false; for (let a = -3; a <= 3; a += 1) for (let c = -3; c <= 3; c += 1) if (T.roadAt(cx + a, cz + c)) road = true;
    if (road || !free([cx - 2.2, cx + 2.2, cz - 2.2, cz + 2.2], 0.6)) continue;
    const fy = footY(T, cx - 2.2, cx + 2.2, cz - 2.2, cz + 2.2), yt = fy.max + 0.55, bb = at(cx, cz);
    bb.obj('çeşme', () => { bb.box(cx, fy.min - 0.3, cz, 4.4, yt - fy.min + 0.3, 4.4, '#8a8378', { kind: KK.STONE });
      bb.box(cx, yt, cz, 3.6, 0.05, 3.6, '#4d6a70', { collide: false, o: { roughness: 0.15, metalness: 0.3 } });
      bb.cyl(cx, yt, cz, 0.25, 0.35, 1.6, '#8a8378', { seg: 8, kind: KK.STONE }); });
    occ.push([cx - 2.2, cx + 2.2, cz - 2.2, cz + 2.2]); break;
  }

  // ── D · Fabrika ──
  const FC = { x: 250, z: -300 };
  put(hall, { x: FC.x - 52, z: FC.z - 42, w: 60, d: 28, h: 11, id: 'hal:1' }, 61, 29);
  put(hall, { x: FC.x + 52, z: FC.z - 50, w: 44, d: 24, h: 9, wall: '#9a8f80', id: 'hal:2' }, 45, 25);
  put(hall, { x: FC.x + 60, z: FC.z + 42, w: 34, d: 20, h: 8, wall: '#7f8b84', ry: Q, id: 'hal:3' }, 35, 21);
  put(office, { x: FC.x - 40, z: FC.z + 38, w: 18, d: 10, id: 'idare' }, 18.6, 10.6);
  for (let i = 0; i < 3; i++) put(silo, { x: FC.x + 8 + i * 8, z: FC.z - 72, r: 3.3, h: 18, id: 'silo:' + i, pad: 0.6 }, 7.6, 7.6);
  put(chimney, { x: FC.x + 12, z: FC.z - 92, h: 40, id: 'baca' }, 5, 5);
  ctxAdd(b0, 'bigSmoke', [FC.x + 12, T.heightAt(FC.x + 12, FC.z - 92) + 42.5, FC.z - 92]);
  put(tank, { x: FC.x - 96, z: FC.z + 10, r: 6, h: 8, id: 'tank:1' }, 13.2, 13.2);
  put(tank, { x: FC.x - 96, z: FC.z + 30, r: 5, h: 7, id: 'tank:2' }, 11.2, 11.2);
  for (let i = 0; i < 10; i++) { const x = FC.x - 8 + (rng() - 0.5) * 30, z = FC.z + 18 + (rng() - 0.5) * 16; if (free([x - 0.6, x + 0.6, z - 0.6, z + 0.6], 0.2)) { crate(at(x, z), T, x, z, 1.1 + rng() * 0.3); occ.push([x - 0.6, x + 0.6, z - 0.6, z + 0.6]); } }
  for (let i = 0; i < 6; i++) { const x = FC.x + 22 + i * 0.75, z = FC.z + 8; barrel(at(x, z), T, x, z, i % 2 ? '#3f6a8a' : '#a3392e'); }
  jersey(at(FC.x + 40, FC.z + 4), T, FC.x + 40, FC.z + 4, 'x', 4);

  // ── F · Çiftlik ──
  const KC = { x: 400, z: 420 };
  put(house, { x: KC.x - 18, z: KC.z - 14, w: 10, d: 8, floors: 2, ry: Q * 2, wall: '#e0d6c2', roof: '#7a3f2c', id: 'çiftlik-evi' }, 10.3, 8.3);
  put(barn, { x: KC.x + 22, z: KC.z + 12, w: 18, d: 11, h: 6, ry: Q * 3, id: 'ahır:1' }, 18.3, 11.3);
  put(barn, { x: KC.x - 30, z: KC.z + 26, w: 12, d: 8, h: 4.6, wall: '#8a6a48', id: 'ahır:2' }, 12.3, 8.3);
  for (let i = 0; i < 2; i++) put(silo, { x: KC.x + 34 + i * 7.5, z: KC.z - 18, r: 3, h: 13, color: '#c8c6bb', id: 'çsilo:' + i, pad: 0.5 }, 6.8, 6.8);
  for (let i = 0; i < 8; i++) { const x = KC.x + 6 + (i % 4) * 1.4, z = KC.z + 30 + Math.floor(i / 4) * 1.4; hayBale(at(x, z), T, x, z); }
  fence(at(KC.x - 60, KC.z + 52), T, KC.x - 60, KC.z + 52, KC.x + 60, KC.z + 52); occ.push([KC.x - 60.2, KC.x + 60.2, KC.z + 51.8, KC.z + 52.2]);   // 12.182 ayak izi (devrik ağaç / kaya çite girmez)
  fence(at(KC.x + 62, KC.z - 50), T, KC.x + 62, KC.z - 50, KC.x + 62, KC.z + 48); occ.push([KC.x + 61.8, KC.x + 62.2, KC.z - 50.2, KC.z + 48.2]);

  // ── G · Kereste Kampı ──
  const GC = { x: -380, z: -450 };
  put(hall, { x: GC.x - 26, z: GC.z - 18, w: 34, d: 14, h: 7, wall: '#7b5a3e', trim: '#5b4130', roof: '#5d6459', doors: [[0, 1], [0, -1]], id: 'hızar' }, 35, 15);
  put(house, { x: GC.x + 30, z: GC.z - 24, w: 8, d: 6, floors: 1, wall: '#8d6b49', roof: '#5d6459', roofKind: KK.SHEET, ry: Q, id: 'kamp-ofis' }, 8.3, 6.3);
  for (let i = 0; i < 9; i++) { const x = GC.x - 30 + (i % 3) * 14, z = GC.z + 14 + Math.floor(i / 3) * 9; if (free([x - 4, x + 4, z - 1.6, z + 1.6], 0.6)) { logStack(at(x, z), T, x, z, 'x', 7, 3); occ.push([x - 4, x + 4, z - 1.6, z + 1.6]); } }
  watchtower(at(GC.x + 40, GC.z + 30), T, { x: GC.x + 40, z: GC.z + 30, h: 8 }); occ.push([GC.x + 30.8, GC.x + 41.8, GC.z + 28.2, GC.z + 31.8]);   // 12.182 merdiven dahil
  wreck(at(GC.x + 10, GC.z + 2), T, GC.x + 10, GC.z + 2, 0, 'truck', '#6b5f45');

  // ── A · Radar Tepesi ──
  const AC = { x: -560, z: 120 };
  radarTower(at(AC.x + 8, AC.z - 8), T, { x: AC.x + 8, z: AC.z - 8 }); occ.push([AC.x + 3, AC.x + 13, AC.z - 13, AC.z - 3]);
  put(barracks, { x: AC.x - 16, z: AC.z + 22, w: 16, d: 6, id: 'radar-koğuş' }, 16.6, 6.6);
  hescoLine(AC.x + 28, AC.z - 18, AC.x + 28, AC.z + 18); hescoLine(AC.x - 18, AC.z - 30, AC.x + 14, AC.z - 30);

  // ── Baraj (12.182: köprüler kalktı — nehir yok) ──
  const dm = dam(at(DAM.x, DAM.z), T, DAM); occ.push([DAM.x - 30, DAM.x + 5, dm.z0, dm.z1]);
  { const sx = DAM.x - 34, sz = -53; occ.push(spillwaySill(at(sx, sz), T, sx, sz, 14)); }          // 12.182 barajın mansabı: kuru dolusavak kanalının başında beton eşik
  put(office, { x: 662, z: 22, w: 14, d: 9, ry: Q * 2, wall: '#a9a59a', id: 'santral' }, 14.6, 9.6);
  // C köprü başı evleri
  for (const [x, z, ry] of [[-20, 72, Q], [22, 78, Q * 3], [-24, -58, Q], [24, -62, Q * 3], [36, 94, Q * 3]]) put(house, { x, z, w: 8.5, d: 7, floors: 2, ry, wall: pickOf(rng, WALLS), roof: pickOf(rng, ROOFS) }, 8.8, 7.3);

  // ── Üsler (Mavi güney, Kırmızı kuzey; ayna) ──
  for (const team of ['blue', 'red']) {
    const s = team === 'blue' ? 1 : -1, H = HQ[team], X = (dx) => H.x + s * dx, Z = (dz) => H.z + s * dz;
    put(hangar, { x: X(-10), z: Z(38), w: 26, d: 20, h: 9, ry: team === 'blue' ? Q * 2 : 0, id: 'hangar:' + team }, 27, 21);
    put(barracks, { x: X(-80), z: Z(-10), w: 20, d: 7, ry: Q, id: 'koğuş:' + team + ':1' }, 7.6, 20.6);
    put(barracks, { x: X(80), z: Z(-10), w: 20, d: 7, ry: Q, id: 'koğuş:' + team + ':2' }, 7.6, 20.6);
    for (const dx of [-105, 105]) { watchtower(at(X(dx), Z(-70)), T, { x: X(dx), z: Z(-70) }); occ.push([X(dx) - 8.7, X(dx) + 1.8, Z(-70) - 1.8, Z(-70) + 1.8]); }   // 12.182 ayak izi (ağaç kuleye girmez)
    hescoLine(X(-100), Z(-72), X(-22), Z(-72)); hescoLine(X(22), Z(-72), X(100), Z(-72));
    parking(at(X(-34), Z(-32)), T, X(-34), Z(-32), 4, 16);
  }
  for (const hp of HELIPADS) helipad(at(hp.x, hp.z), T, hp);                                   // ayak izi başta ayrıldı
  // araç doğuş noktaları: henüz mekaniği olmayan türlerde sabit model (görsel yer tutucu). 12.177 / 12.178: jip + tank gerçek araç (game/vehicles.js) → yer tutucu yok, alan yine dolu sayılır
  for (const v of VEHICLES) {
    if (v.type === 'jip' || v.type === 'tank' || v.type.startsWith('heli')) continue;      // 12.178: tank da gerçek araç (ayak izi başta ayrıldı)
    const fn = v.type === 'tank' ? tankM : v.type === 'zpt' ? apcM : v.type === 'kamyon' ? truckM : jeepM, ry = Math.round((v.ry - Math.PI / 2) / Q) * Q;
    const b = at(v.x, v.z), y = T.heightAt(v.x, v.z) - 0.05;
    b.obj('araç-doğuş:' + v.id, () => b.with(0, y, 0, 0, () => fn(b, { x: v.x, z: v.z, ry, color: v.team === 'red' ? '#5d5a46' : '#4f5a42', wreck: false })));
  }

  // ── Enerji nakil hattı (barajdan batıya) + köy elektrik direkleri ──
  const PL = [[650, -205], [540, -178], [430, -160], [318, -168], [205, -196], [92, -226], [-22, -246], [-138, -262], [-254, -286], [-372, -312], [-488, -330], [-604, -340], [-720, -344]];
  let prev = null;
  for (let i = 0; i < PL.length; i++) {
    const n = PL[Math.min(PL.length - 1, i + 1)], p = PL[Math.max(0, i - 1)], ry = Math.atan2(-(n[1] - p[1]), n[0] - p[0]) + Q;
    // 12.182: direk ayağı yola / yapıya denk gelirse hat boyunca kaydırılır
    const dl = Math.hypot(n[0] - p[0], n[1] - p[1]) || 1, ux = (n[0] - p[0]) / dl, uz = (n[1] - p[1]) / dl;
    let [x, z] = PL[i];
    for (const s of [0, 9, -9, 18, -18, 27, -27]) { const qx = PL[i][0] + ux * s, qz = PL[i][1] + uz * s; if (free([qx - 4.2, qx + 4.2, qz - 4.2, qz + 4.2], 0.5)) { x = qx; z = qz; break; } }
    const arms = pylon(at(x, z), T, x, z, ry); occ.push([x - 4, x + 4, z - 4, z + 4]);
    if (prev) for (let k = 0; k < arms.length; k++) wires.push([prev[k], arms[k], 0.035]);
    prev = arms;
  }
  let pp = null;
  for (let i = 0; i <= 9; i++) {
    const x = -120 + i * -14, z = 360 - i * 12 + 6;
    if (!free([x - 0.4, x + 0.4, z - 0.4, z + 0.4], 0.3)) { pp = null; continue; }                  // 12.182: eve / yola denk gelen direk atlanır
    const a = pole(at(x, z), T, x, z);
    if (pp) for (let k = 0; k < 2; k++) wires.push([pp[k], a[k], 0.02]);
    pp = a; occ.push([x - 1, x + 1, z - 1, z + 1]);
  }
  // ── 12.182 doldurma: Kavşak (C), mezralar, çiftlikler, benzinlik, trafo, yol kenarı, mevziler, kontrol noktaları, üs çadırları ──
  const orchard = [], rocks = [];
  placeFill({ cs, T, rng: makeRng(18200), occ, put, free, at, wires, orchard, rocks, miss: placeAll.miss });
  return { occ, wires, orchard, rocks };
}
