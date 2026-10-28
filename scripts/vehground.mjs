// 12.200 Araç zemin denetimi (başsız): araçlar yerin altında / havada / bir yapının içinde mi?   node scripts/vehground.mjs [harita...]
//   1) Sürülen araçlar (VT türleri; Ele Geçirme): her doğuş noktası (ilk doğuş + 3 sn boşta bekleme), yeniden doğuş (patlat → yeniden doğsun),
//      batan araç (gölde batır → yeniden doğsun). Ölçü: teker / palet temas noktalarında zemin (arazi + üstüne çıkılan kutu tepesi) − teker altı
//      (gömülme > 0,12 m HATA, havada > 0,3 m HATA), gövde altı ızgarasında (yerel u = clear) zeminin gövdeye girmesi (> 0,08 m HATA),
//      gövdenin bina / ağaç / duvar kutusuna girmesi (> 0,1 m HATA).
//   2) Rastgele yerleşim (her türden ~300 nokta, savaş alanında, araç yamacı < 0,6): aynı doğuş yordamı → gömülme / gövde içi arazi oranı (model hatası
//      yoksa ~0). 3) Dekor araçlar (vehicles.js modelleri; tüm haritalar): ayak izi köşe / kenar ortalarında zemin − araç tabanı (> 0,15 m gömülü).
//   ENV: JSON=dosya (ölçümler) · RAND=0 (rastgele yerleşimi atla) · DECOR=0 · PER=takım başına kişi (12.206: büyük maçta ek araçlar; varsayılan 16)
import { Game } from '../src/game/game.js';
import { LIMITS } from '../src/game/balance.js';
if (+process.env.PER > LIMITS.maxPerTeam) LIMITS.maxPerTeam = +process.env.PER;      // 12.206: 64v64 / 128v128 ek araç yerleri (oda sınırı başka işte yükseltilir; burada yalnız deneme)
import { MAPS } from '../src/maps/index.js';
import { MapBuilder } from '../src/maps/builder.js';
import { VT, toWorld, toLocal2, groundAt, makeVehicle, stepVehicle, obbBox } from '../src/sim/vehicle.js';
import * as THREE from 'three';
import fs from 'node:fs';

let fails = 0; const ok = (c, m, x = '') => { console.log((c ? 'OK   ' : 'HATA ') + m + (x !== '' ? ' · ' + x : '')); if (!c) fails++; };
const f2 = (v) => (+v).toFixed(2);
const _p = { x: 0, y: 0, z: 0 };
const out = { spawns: [], respawn: [], sunk: [], rand: {}, decor: [] };

// Bir aracın zemin ölçüsü: { wheel: en çok gömülme (m), air: en çok havada teker, hull: gövde altına giren zemin, box: kutu girişimi, boxId }
export function measure(W, st) {
  const d = st.def, wheelPts = [];
  if (d.heli) { for (const f of [d.wb / 2, -d.wb / 2]) for (const r of [-d.tr / 2, d.tr / 2]) wheelPts.push([f, r]); }
  else if (d.tracked) { for (let k = 0; k <= 8; k++) for (const r of [-d.tr / 2, d.tr / 2]) wheelPts.push([-d.wb / 2 + (k / 8) * d.wb, r]); }
  else for (const f of [d.wb / 2, -d.wb / 2]) for (const r of [-d.tr / 2, d.tr / 2]) wheelPts.push([f, r]);
  let wheel = -9, air = 9, hull = -9, box = 0, boxId = null;
  for (const [f, r] of wheelPts) {
    toWorld(st, f, r, 0, _p);
    const g = groundAt(W, _p.x, _p.z, _p.y + 0.05, d.stepUp ?? 0.55);
    wheel = Math.max(wheel, g - _p.y); air = Math.min(air, _p.y - g);
  }
  // paletli / tekerli: en az bir teker / palet noktası yere değmeli (havada kalan en düşük nokta)
  for (let i = 0; i <= 10; i++) for (let j = 0; j <= 4; j++) {
    const f = -d.hl + (i / 10) * 2 * d.hl, r = -d.hw + (j / 4) * 2 * d.hw;
    toWorld(st, f, r, d.clear, _p);
    const g = W.heightAt(_p.x, _p.z);                                 // gövde altı yalnız araziyle (kutu tepeleri tekerin bastığı bordür / kütük)
    hull = Math.max(hull, g - _p.y);
  }
  const lo = st.y + (d.stepUp ?? 0.55) + 0.02, hi = st.y + d.top;
  for (const c of W.query(st.x - 6, st.z - 6, st.x + 6, st.z + 6, [])) {
    if (c.max[1] <= lo || c.min[1] >= hi || c.nocar) continue;
    const m = obbBox(st, c);
    if (m && m.d > box) { box = m.d; boxId = `[${c.min.map((v) => v.toFixed(1))}]..[${c.max.map((v) => v.toFixed(1))}]${c.tag ? ' ' + c.tag : ''}`; }
  }
  return { wheel, air: Math.max(0, air), hull, box, boxId };
}
const bad = (m) => m.wheel > 0.12 || m.air > 0.3 || m.hull > 0.08 || m.box > 0.1;
const desc = (m) => `gömülme ${f2(m.wheel)} · havada ${f2(m.air)} · gövde altı zemin ${f2(m.hull)} · kutu ${f2(m.box)}${m.boxId && m.box > 0.1 ? ' ' + m.boxId : ''}`;

// 12.200 uzak kademe batması: arazi ağının l kademesinde (TerrainMesh: 200 m yığın, adım 1 / 2 / 4 / 10 hücre, köşegen a–d) çizilen yükseklik − fizik,
// aracın ayak izinin 9 noktasında en büyük (m; > 0 = araç ağın içinde görünür)
function lodSink(T) {
  const ST = [1, 2, 4, 10], CH = 200, cpc = CH / T.cell;
  const rh = (x, z, l) => {
    const ci = Math.floor((x - T.minX) / CH), cj = Math.floor((z - T.minZ) / CH), s = ST[l], i0 = ci * cpc, j0 = cj * cpc;
    const u = ((x - T.minX) / T.cell - i0) / s, v = ((z - T.minZ) / T.cell - j0) / s, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    const H = (a, b) => T.h[(j0 + b * s) * T.nx + i0 + a * s], a = H(i, j), b = H(i + 1, j), c = H(i, j + 1), dd = H(i + 1, j + 1);
    return fu >= fv ? a + (b - a) * fu + (dd - b) * fv : a + (dd - c) * fu + (c - a) * fv;
  };
  return (st, d, l) => { let m = 0; const sn = Math.sin(st.yaw), c = Math.cos(st.yaw); for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) { const x = st.x - sn * a * d.hl + c * b * d.hw, z = st.z - c * a * d.hl - sn * b * d.hw; m = Math.max(m, rh(x, z, l) - T.heightAt(x, z)); } return m; };
}

function driveable(id) {
  const M = MAPS[id];
  if (!M || (M.only && !M.only.includes('conquest'))) return;
  const g = new Game(null, { headless: true, map: id, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: +(process.env.PER || 16), type: process.env.TYPE || 'conquest' } });
  const V = g.vehicles;
  if (!V) { console.log(`${id}: sürülen araç yok`); g.dispose?.(); return; }
  for (const s of g.soldiers) { s.vacant = true; s.alive = false; }
  g.brains = [];
  // bayrak araçları: bayrağın sahibine doğar → bayrakları sırayla iki takıma ver
  for (const o of g.mode.objectives) o.owner = 'blue';
  for (const v of V.list) if (!v.alive) V.trySpawn(v, true);
  for (let i = 0; i < 90; i++) V.update(1 / 30);                       // 3 sn boşta (oturma)
  console.log(`── ${g.map.name}: ${V.list.length} araç ──`);
  { const ids = (g.map.vehicles || []).map((d) => d.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i); ok(!dup.length, `${id}: araç doğuş kimlikleri benzersiz`, dup.join(', ') || `${ids.length}`); }
  let nb = 0;
  for (const v of V.list) {
    if (v.def.fixed) continue;                                                     // 12.213 sabit yuvalar (kule / mevzi; scripts/towertest.mjs)
    if (!v.alive) { ok(false, `${id} ${v.id}: doğmadı`); continue; }
    const m = measure(g.world, v.st);
    out.spawns.push({ map: id, id: v.id, type: v.type, x: +v.st.x.toFixed(1), z: +v.st.z.toFixed(1), ...m });
    if (bad(m)) { nb++; ok(false, `${id} ${v.id} (${v.type}) doğuş ${f2(v.st.x)}, ${f2(v.st.z)}`, desc(m)); }
  }
  ok(nb === 0, `${id}: ${V.list.length} doğuş noktasında araç zeminde (teker / palet yere değer, gövde arazide / yapıda değil)`, `kötü ${nb}`);
  // 12.200 doğuş açıklığı: ağaç tepesi / çalı (bot görüş küreleri = görünen yaprak) gövdeye girmiyor, yapı / ağaç gövdesi 0,5 m'den yakın değil,
  // piyade doğuşu aracın üstünde değil, iki araç doğuşu üst üste değil (helikopter pisti hariç)
  const SG = g.map.sight || [], SP = Object.values(g.map.spawns || {}).flat().filter((p) => p && Number.isFinite(p.x));
  let nc = 0;
  for (const v of V.list) {
    if (!v.alive || v.def.heli || v.def.fixed) continue;
    const st = v.st, d = v.def, why = [];
    for (const q of SG) {
      const L = toLocal2(st, q[0], q[2]), dh = Math.hypot(Math.max(0, Math.abs(L.f) - d.hl), Math.max(0, Math.abs(L.r) - d.hw));
      if (dh < q[3] - 0.3 && q[1] - q[3] < st.y + d.top - 0.2 && q[1] + q[3] > st.y + d.clear) { why.push(`yaprak [${q.map((x) => x.toFixed(1))}]`); break; }
    }
    for (const c of g.world.query(st.x - 8, st.z - 8, st.x + 8, st.z + 8, [])) {
      if (c.max[1] <= st.y + (d.stepUp ?? 0.55) + 0.02 || c.min[1] >= st.y + d.top || c.nocar) continue;
      if (obbBox(st, c, 0.5)) { why.push(`yapı 0,5 m [${c.min.map((x) => x.toFixed(1))}]..[${c.max.map((x) => x.toFixed(1))}]`); break; }
    }
    for (const p of SP) { const L = toLocal2(st, p.x, p.z); if (Math.abs(L.f) < d.hl + 0.8 && Math.abs(L.r) < d.hw + 0.8) { why.push(`piyade doğuşu (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`); break; } }
    for (const o of V.list) if (o !== v && o.alive && !o.def.heli && !o.def.fixed && Math.hypot(o.spawn.x - v.spawn.x, o.spawn.z - v.spawn.z) < d.hl + o.def.hl) { why.push(`araç ${o.id} üst üste`); break; }
    if (why.length) { nc++; ok(false, `${id} ${v.id} doğuş açıklığı`, why.join(' · ')); }
  }
  // 12.206 helikopter doğuşu: rotor çemberi (13 m) içinde gövdenin 0,6 m üstüne çıkan kutu / yaprak yok, piyade doğuşu pistte değil, iki helikopter 20 m'den yakın değil
  let nh = 0;
  for (const v of V.list) {
    if (!v.alive || !v.def.heli) continue;
    const st = v.st, why = [];
    for (const c of g.world.query(st.x - 14, st.z - 14, st.x + 14, st.z + 14, [])) { const cx = Math.max(c.min[0], Math.min(st.x, c.max[0])), cz = Math.max(c.min[2], Math.min(st.z, c.max[2])); if (Math.hypot(cx - st.x, cz - st.z) < 13 && c.max[1] > st.y + 0.6) { why.push(`kutu [${c.min.map((x) => x.toFixed(1))}]..[${c.max.map((x) => x.toFixed(1))}]`); break; } }
    for (const q of SG) if (Math.hypot(q[0] - st.x, q[2] - st.z) < 13 + q[3] - 0.3 && q[1] + q[3] > st.y + 0.6) { why.push(`yaprak [${q.map((x) => x.toFixed(1))}]`); break; }
    for (const p of SP) if (Math.hypot(p.x - st.x, p.z - st.z) < 9) { why.push(`piyade doğuşu (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`); break; }
    for (const o of V.list) if (o !== v && o.alive && o.def.heli && Math.hypot(o.spawn.x - v.spawn.x, o.spawn.z - v.spawn.z) < 20) { why.push(`helikopter ${o.id} yakın`); break; }
    if (why.length) { nh++; ok(false, `${id} ${v.id} helikopter doğuşu (rotor) açıklığı`, why.join(' · ')); }
  }
  ok(nh === 0, `${id}: ${V.list.filter((v) => v.def.heli).length} helikopter doğuşu açık (rotor çemberinde kutu / yaprak yok, pistte piyade doğuşu yok)`, `kötü ${nh}`);
  // 12.200 uzaktan görünüm: arazi ağının uzak kademeleri (L1 4 m · L2 8 m · L3 20 m ızgara; 190 / 430 / 820 m'den sonra) fiziğin üstüne çıkarsa
  // araç ağın içinde görünür (kullanıcı: "bazı araçlar yerin altında"). Bilgi: her doğuşta kademe başına en büyük batma (ayak izinin 9 noktası).
  // Görünüm düzeltmesi (vehicleView.lodLift) aynı formülle modeli kaldırır; gerçek GPU ölçümü vehgroundshot.mjs.
  const TT = g.world.terrain;
  if (TT?.h && TT.nx) {
    const T = TT;
    const sinkL = lodSink(T);
    const L = [1, 2, 3].map((l) => { const a = V.list.filter((v) => v.alive && !v.def.heli).map((v) => sinkL(v.st, v.def, l)); return { l, max: Math.max(...a), n15: a.filter((x) => x > 0.15).length, n: a.length }; });
    out.lod = L;
    console.log(`     uzak kademede ağın içinde görünen doğuş (> 0,15 m): ${L.map((q) => `L${q.l} ${q.n15}/${q.n} (en çok ${f2(q.max)} m)`).join(' · ')} → vehicleView.lodLift kaldırır`);
  }
  ok(nc === 0, `${id}: ${V.list.filter((v) => !v.def.heli).length} kara aracı doğuşu açık (ağaç tepesi / yapı / piyade doğuşu / araç üst üste değil)`, `kötü ${nc}`);
  // yeniden doğuş: sessiz yok et → sayaç → aynı yordam
  let nr = 0;
  for (const v of V.list) V.destroy(v, null, true);
  for (let i = 0; i < 30 * 80; i++) { V.update(1 / 30); if (V.list.every((v) => v.alive)) break; }
  for (let i = 0; i < 60; i++) V.update(1 / 30);
  for (const v of V.list) {
    if (!v.alive) { nr++; ok(false, `${id} ${v.id}: yeniden doğmadı`); continue; }
    const m = measure(g.world, v.st); out.respawn.push({ id: v.id, ...m });
    if (bad(m)) { nr++; ok(false, `${id} ${v.id} yeniden doğuş`, desc(m)); }
  }
  ok(nr === 0, `${id}: yeniden doğan ${V.list.length} araç zeminde`, `kötü ${nr}`);
  // batan araç: derin suya koy (göl), batsın, yok olsun, doğuşunda yeniden doğsun
  const T = g.world.terrain;
  if (T?.waterY) {
    let wp = null;
    for (let k = 0; k < 4000 && !wp; k++) {
      const x = -790 + Math.random() * 1580, z = -790 + Math.random() * 1580, w = T.waterY(x, z), h = T.heightAt(x, z);
      if (w > -1e9 && w - h > 3) wp = [x, z, w];
    }
    if (wp) {
      const ns = [];
      for (const v of V.list.filter((q) => !q.def.heli).slice(0, 3)) {
        v.st.x = wp[0]; v.st.z = wp[1]; v.st.y = T.heightAt(wp[0], wp[1]); v.sleep = false;
        let sunkT = -1, back = -1;
        for (let i = 0; i < 30 * 90; i++) { V.update(1 / 30); if (sunkT < 0 && (v.st?.sunk || !v.alive)) sunkT = i / 30; if (sunkT >= 0 && v.alive && !v.st.sunk) { back = i / 30; break; } }
        for (let i = 0; i < 60; i++) V.update(1 / 30);
        const m = v.alive ? measure(g.world, v.st) : null;
        ns.push({ id: v.id, sunkT, back, m });
        ok(v.alive && m && !bad(m) && Math.hypot(v.st.x - v.spawn.x, v.st.z - v.spawn.z) < 3, `${id} ${v.id}: gölde batan araç doğuşunda zemine oturarak yeniden doğar`, `batma ${f2(sunkT)} sn · dönüş ${f2(back)} sn · ${m ? desc(m) : 'doğmadı'}`);
      }
      out.sunk.push(...ns);
    }
  }
  // rastgele yerleşim: aynı doğuş yordamı her yerde zemine oturtuyor mu (model)
  if (process.env.RAND !== '0') {
    const A = g.map.playArea || g.map.bounds;
    for (const type of [...new Set(V.list.filter((v) => !v.def.fixed).map((v) => v.type))]) {
      const st0 = [], R = { n: 0, wheel: 0, air: 0, hull: 0, box: 0, maxW: 0, maxH: 0, worst: null };
      for (let k = 0; k < 4000 && R.n < 300; k++) {
        const x = A.minX + 10 + Math.random() * (A.maxX - A.minX - 20), z = A.minZ + 10 + Math.random() * (A.maxZ - A.minZ - 20);
        if (T && (T.slopeAt?.(x, z, 2) > 0.6 || (T.waterY && T.waterY(x, z) > T.heightAt(x, z) - 0.2))) continue;
        const st = makeVehicle(type, x, groundAt(g.world, x, z, g.world.heightAt(x, z) + 1), z, Math.random() * 6.28);
        stepVehicle(st, null, 1 / 60, g.world); stepVehicle(st, null, 1 / 60, g.world);
        st.vx = st.vz = st.vy = 0;
        for (let i = 0; i < 60; i++) stepVehicle(st, null, 1 / 30, g.world);
        const m = measure(g.world, st);
        if (m.box > 0.1) continue;                                         // yapının içine düşen rastgele nokta: doğuş verisi değil
        R.n++;
        if (m.wheel > 0.12) R.wheel++; if (m.air > 0.3) R.air++; if (m.hull > 0.08) R.hull++;
        if (m.wheel > R.maxW) R.maxW = m.wheel;
        if (m.hull > R.maxH) { R.maxH = m.hull; R.worst = { x: +x.toFixed(1), z: +z.toFixed(1), slope: +(T?.slopeAt?.(x, z, 2) || 0).toFixed(2) }; }
        st0.push({ x: +x.toFixed(1), z: +z.toFixed(1), ...m });
      }
      out.rand[type] = R;
      if (process.env.V) for (const q of st0.filter((q) => q.wheel > 0.12 || q.hull > 0.08).slice(0, 12)) console.log('     ', type, q.x, q.z, desc(q));
      const rate = (R.wheel + R.hull) / Math.max(1, R.n);
      ok(rate < 0.03, `${id} rastgele ${R.n} nokta (${type}): teker gömülmesi ${R.wheel} · havada ${R.air} · gövdeye giren arazi ${R.hull}`, `en çok teker ${f2(R.maxW)} m · gövde ${f2(R.maxH)} m ${R.worst ? JSON.stringify(R.worst) : ''}`);
    }
  }
  g.dispose?.();
}

// dekor araçlar: vparts kaydına taban y'si de eklenir
function decor(ids) {
  const orig = MapBuilder.prototype.vparts;
  let list = [];
  MapBuilder.prototype.vparts = function (kind, off, len, wid, parts) {
    const n = this.vehicles.length; orig.call(this, kind, off, len, wid, parts);
    const v = this.vehicles[n]; if (!v) return;
    const pos = new THREE.Vector3(); this.M.clone().multiply(this._local(off, 0, 0)).decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    list.push({ ...v, y: pos.y });
  };
  for (const id of ids) {
    list = [];
    const m = MAPS[id].build(), T = m.terrain, C = m.colliders;
    const gnd = (x, z, y) => {
      let h = T ? T.heightAt(x, z) : 0;
      for (const c of C) if (c.tag !== 'veh' && x > c.min[0] && x < c.max[0] && z > c.min[2] && z < c.max[2] && c.max[1] > h && c.max[1] <= y + 0.6 && Math.max(c.max[0] - c.min[0], c.max[2] - c.min[2]) > 2.5) h = c.max[1];      // küçük kutular (moloz yığını) yok sayılır: kaldırım / platform / tabliye
      return h;
    };
    let nb = 0, worst = 0;
    for (const v of list) {
      const c = Math.cos(v.ry), s = Math.sin(v.ry);
      let sink = -9, flo = 9;
      for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) {
        const lx = a * v.hl * 0.92, lz = b * v.hw * 0.92, x = v.x + lx * c + lz * s, z = v.z - lx * s + lz * c, g = gnd(x, z, v.y);
        sink = Math.max(sink, g - v.y); flo = Math.min(flo, v.y - g);
      }
      out.decor.push({ map: id, kind: v.kind, x: +v.x.toFixed(1), z: +v.z.toFixed(1), y: +v.y.toFixed(2), sink: +sink.toFixed(2), air: +flo.toFixed(2) });
      worst = Math.max(worst, sink);
      if (sink > 0.15 || flo > 0.25) { nb++; console.log(`     ${id}: dekor ${v.kind} (${f2(v.x)}, ${f2(v.z)}) taban ${f2(v.y)} · gömülü ${f2(sink)} m · havada ${f2(Math.max(0, flo))} m`); }
    }
    ok(nb === 0, `${id}: ${list.length} dekor araç zeminde`, `gömülü / havada ${nb} · en çok gömülme ${f2(worst)} m`);
    // 'veh' etiketli çarpışma kutuları (Kasaba / Askeri Üs araç modülleri vparts kullanmaz): aracın en alt kutusu (teker / gövde altı) arazinin
    // ya da bir kaldırım / platform kutusunun içinde mi
    const VC = C.filter((c) => c.tag === 'veh' && c.min[1] - (T ? T.heightAt((c.min[0] + c.max[0]) / 2, (c.min[2] + c.max[2]) / 2) : 0) < 0.25);
    let nv = 0, wv = 0;
    for (const c of VC) {
      let sink = -9;
      for (const [x, z] of [[c.min[0] + 0.05, c.min[2] + 0.05], [c.max[0] - 0.05, c.min[2] + 0.05], [c.min[0] + 0.05, c.max[2] - 0.05], [c.max[0] - 0.05, c.max[2] - 0.05]]) {
        let h = T ? T.heightAt(x, z) : 0;
        for (const q of C) if (q.tag !== 'veh' && q.tag !== 'deco' && x > q.min[0] && x < q.max[0] && z > q.min[2] && z < q.max[2] && q.max[1] > h && q.max[1] < c.min[1] + 0.8 && q.min[1] < c.min[1] + 0.1 && Math.max(q.max[0] - q.min[0], q.max[2] - q.min[2]) > 2.5) h = q.max[1];
        sink = Math.max(sink, h - c.min[1]);
      }
      wv = Math.max(wv, sink);
      if (sink > 0.15) { nv++; if (nv <= 8) console.log(`     ${id}: araç kutusu [${c.min.map((v) => v.toFixed(1))}]..[${c.max.map((v) => v.toFixed(1))}] tabanı zeminin ${f2(sink)} m altında`); }
    }
    ok(nv === 0, `${id}: ${VC.length} araç alt kutusu (teker / şasi) zeminde`, `gömülü ${nv} · en çok ${f2(wv)} m`);
  }
  MapBuilder.prototype.vparts = orig;
}

// 4) oynanış taraması: botlu maç (botlar sürer, bırakır, batırır, patlatır), her 1 sn her araç (canlı + enkaz) ölçülür
function play(id, secs) {
  const M = MAPS[id];
  if (!M || (M.only && !M.only.includes('conquest'))) return;
  const g = new Game(null, { headless: true, map: id, tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: 10, type: 'conquest' } });
  const V = g.vehicles; if (!V) { g.dispose?.(); return; }
  const hits = new Map(); let n = 0, nb = 0;
  const TT = g.world.terrain, sinkL = TT?.h && TT.nx ? lodSink(TT) : null, LS = [0, 0, 0, 0], LM = [0, 0, 0, 0], LW = [null, null, null, null];
  for (let i = 0; i < secs * 30 && !g.ended; i++) {
    g.step(1 / 30);
    if (i % 30) continue;
    for (const v of V.list) {
      if (!v.st || (!v.alive && !v.wreck) || v.st.sunk || (v.def.heli && v.st.air)) continue;
      if (!v.alive && v.def.heli) continue;
      n++;
      if (sinkL && v.st.y - TT.heightAt(v.st.x, v.st.z) < 0.6) for (const l of [1, 2, 3]) { const k = sinkL(v.st, v.def, l); if (k > 0.15) LS[l]++; if (k > LM[l]) { LM[l] = k; LW[l] = { id: v.id, type: v.type, x: +v.st.x.toFixed(1), z: +v.st.z.toFixed(1), yaw: +v.st.yaw.toFixed(3), sink: +k.toFixed(2) }; } }
      const m = measure(g.world, v.st);
      if (!bad(m)) continue;
      nb++;
      const k = `${v.id}@${Math.round(v.st.x / 10) * 10},${Math.round(v.st.z / 10) * 10}`;
      const e = hits.get(k) || { id: v.id, x: +v.st.x.toFixed(1), z: +v.st.z.toFixed(1), n: 0, drv: !!v.seats[0], wreck: !v.alive, m };
      e.n++; if (m.wheel + m.hull > e.m.wheel + e.m.hull) e.m = m; hits.set(k, e);
    }
  }
  const L = [...hits.values()].sort((a, b) => b.n - a.n);
  for (const e of L.slice(0, 20)) console.log(`     ${e.id} (${e.x}, ${e.z}) ×${e.n} ${e.drv ? 'sürücülü' : e.wreck ? 'enkaz' : 'boş'} · ${desc(e.m)}`);
  out.play = { samples: n, bad: nb, list: L, lod: { n15: LS, max: LM, worst: LW } };
  if (sinkL) console.log(`     oynanışta uzak kademede ağın içinde görünen (> 0,15 m): ${[1, 2, 3].map((l) => `L${l} %${(100 * LS[l] / Math.max(1, n)).toFixed(1)} (en çok ${f2(LM[l])} m)`).join(' · ')} → vehicleView.lodLift kaldırır`);
  ok(nb / Math.max(1, n) < 0.01, `${id} oynanış (${secs} sn, 10v10 botlu): ${n} araç ölçümünde gömülü / gövdesi arazide / yapıda ${nb}`, `%${(100 * nb / Math.max(1, n)).toFixed(2)}`);
  g.dispose?.();
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAPS);
for (const id of ids) { driveable(id); if (process.env.PLAY !== '0') play(id, +(process.env.PLAY || 300)); }
if (process.env.DECOR !== '0') decor(ids.filter((id) => MAPS[id]));
if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(out, null, 1));
console.log(fails ? `${fails} HATA` : 'hepsi OK');
process.exit(fails ? 1 : 0);
