// 12.209 doğan / üsse dönen araç zemine oturuyor mu (başsız): Kuzey'in tüm kara aracı doğuşlarında trySpawn sonrası (ve 3 sn uyku sonrası)
// teker temas noktası ile fizik zemini (groundAt) farkı + gövde altı 5 × 3 ızgara ile arazi farkı. > 0,12 m teker / > 0,08 m gövde = gömülü.
// 12.215 genişletildi: (1) takım boyu PER=10,32,64 (12.206 ek araçlar / ek helipadler oyuncu sayısıyla gelir), (2) doğuş yolları: ilk doğuş,
// patlayıp yeniden doğuş, 12.212 sessiz yok oluş (terk / batma) → yeniden doğuş, bayrak ele geçirilince bayrak aracının ilk doğuşu — hepsi
// yöneticinin kendi akışıyla (Vehicles.update / deadTick), (3) ÇİZİLEN model: VehicleView başsız kurulur (THREE sahnesi, GPU yok), her doğuşta
// 3 sn kare kare modelin o karedeki matrisiyle teker / gövde altı noktaları fizik zeminine göre ölçülür (sessiz yok oluştan kalan batma sayacı
// modeli 1,5 m gömüyordu; fizik doğruydu, eski test bu yüzden görmüyordu). Helikopter teker yerine kızaklarıyla ölçülür.
//   node scripts/vehspawnsink.mjs   · ENV: PER=10,32,64 · SCEN=ilk,patla,terk,bayrak · çıkış kodu: gömülü doğuş varsa 1
import * as THREE from 'three';
import { Game } from '../src/game/game.js';
import { LIMITS } from '../src/game/balance.js';
import { VehicleView } from '../src/game/vehicleView.js';
import { toWorld, groundAt } from '../src/sim/vehicle.js';

const PERS = (process.env.PER || '10,32,64').split(',').map(Number), SCEN = (process.env.SCEN || 'ilk,patla,terk,bayrak').split(',');
LIMITS.maxPerTeam = Math.max(LIMITS.maxPerTeam, ...PERS);
globalThis.innerHeight ??= 760;
const _p = { x: 0, y: 0, z: 0 }, _w = new THREE.Vector3();
// fizik durumu: teker / kızak temas noktası − groundAt, gövde altı 5 × 3 − arazi
function sink(W, st) {
  const d = st.def; let wheel = -9, hull = -9;
  for (const f of [d.wb / 2, -d.wb / 2]) for (const r of d.moto ? [0] : [-d.tr / 2, d.tr / 2]) { toWorld(st, f, r, 0, _p); wheel = Math.max(wheel, groundAt(W, _p.x, _p.z, _p.y + 0.05, d.stepUp ?? 0.55) - _p.y); }
  if (!d.heli) for (let i = 0; i <= 4; i++) for (const j of d.moto ? [0] : [-1, 0, 1]) { toWorld(st, -d.hl + (i / 4) * 2 * d.hl, j * d.hw, d.clear, _p); hull = Math.max(hull, W.heightAt(_p.x, _p.z) - _p.y); }
  return { wheel, hull };
}
// çizilen model: o karedeki model matrisiyle aynı noktalar (vehicleView.groundLift kümesi) − fizik zemini (arazi + bastığı kutu)
function viewSink(W, it, d) {
  const m = it.model; if (!m?.visible) return null;
  m.updateMatrix(); const M = m.matrix, tr = d.moto ? 0 : d.tr / 2, hf = d.wb / 2, up = d.stepUp ?? 0.55;
  let s = -9;
  for (const f of d.tracked ? [hf, 0, -hf] : [hf, -hf]) for (const r of tr ? [-tr, tr] : [0]) { _w.set(r, 0, -f).applyMatrix4(M); s = Math.max(s, groundAt(W, _w.x, _w.z, _w.y + 0.05, up) - _w.y); }
  if (!d.heli) for (let i = 0; i <= 4; i++) for (const r of d.moto ? [0] : [-d.hw, 0, d.hw]) { _w.set(r, d.clear, d.hl - i * d.hl / 2).applyMatrix4(M); s = Math.max(s, W.heightAt(_w.x, _w.z) - _w.y + 0.04); }
  return s;
}

let fails = 0;
for (const PER of PERS) {
  const g = new Game(null, { headless: true, map: 'kuzey', tod: 'day', weather: 'clear', diff: 'normal', match: { perTeam: PER, type: process.env.TYPE || 'conquest' } });
  const W = g.world, V = g.vehicles;
  for (const s of g.soldiers) { s.vacant = true; s.alive = false; }                 // doğuş yerini tutan asker yok (trySpawn bekletmesin)
  g.brains = [];
  g.scene = new THREE.Scene(); g.camera = new THREE.PerspectiveCamera(55, 1.6, 0.1, 3000);
  const view = new VehicleView(g);
  const born = new Map(); g.on('vehspawn', (v) => born.set(v.idx, g.time));
  const tick = (n) => { for (let i = 0; i < n; i++) { g.time += 1 / 60; V.update(1 / 60); view.frame(1 / 60); } };
  for (const o of g.mode.objectives) o.owner = 'blue';
  for (const v of V.list) if (!v.alive) V.trySpawn(v, true);
  tick(30);
  const L = V.list.filter((v) => !v.def.fixed), rows = [];
  for (const sc of SCEN) {
    const R = [];
    for (const v of L) {
      const flag = typeof v.spawn.team === 'string' && v.spawn.team.startsWith('flag:');
      if (sc === 'bayrak' && !flag) continue;
      born.delete(v.idx);
      if (sc === 'ilk') { v.alive = false; v.wreck = false; v.st = null; V.trySpawn(v, true); }
      else if (sc === 'bayrak') { const o = g.mode.objectives.find((q) => q.id === v.spawn.team.slice(5)); v.alive = false; v.st = null; v.spawnN = 0; v.wreck = false; o.owner = null; tick(2); o.owner = o.owner === 'red' ? 'blue' : 'red'; }
      else { if (!v.alive) V.trySpawn(v, true); V.destroy(v, null, sc === 'terk'); tick(3); v.deadT = v.def.wreck; tick(2); v.respawnT = 0; }
      // doğuşu bekle (yöneticinin kendi akışı), sonra 3 sn kare kare
      for (let i = 0; i < 120 && !born.has(v.idx); i++) tick(1);
      if (!born.has(v.idx)) { R.push({ id: v.id, t: v.type, miss: true }); continue; }
      const r = { sc, id: v.id, t: v.type, w: -9, h: -9, view: -9 };
      const it = view.items[v.idx];
      for (let f = 0; f <= 180; f++) {
        if (f === 0 || f === 180) { const s = sink(W, v.st); r.w = Math.max(r.w, s.wheel); r.h = Math.max(r.h, s.hull); }
        const vs = viewSink(W, it, v.def); if (vs != null) r.view = Math.max(r.view, vs);
        tick(1);
      }
      for (const k of ['w', 'h', 'view']) r[k] = +r[k].toFixed(2);
      R.push(r);
    }
    const ok = R.filter((r) => !r.miss), bad = ok.filter((r) => r.w > 0.12 || r.h > 0.08 || r.view > 0.12), miss = R.filter((r) => r.miss);
    console.log(`${bad.length || miss.length ? 'HATA' : 'OK  '} ${PER}v${PER} ${sc.padEnd(6)} ${String(ok.length).padStart(3)} doğuş · gömülü ${bad.length} · en kötü teker ${Math.max(...ok.map((r) => r.w)).toFixed(2)} m · gövde ${Math.max(...ok.map((r) => r.h)).toFixed(2)} m · çizilen model ${Math.max(...ok.map((r) => r.view)).toFixed(2)} m${miss.length ? ` · doğmayan ${miss.map((r) => r.id).join(' ')}` : ''}`);
    for (const r of bad.slice(0, 6)) console.log('     ', JSON.stringify(r));
    if (bad.length || miss.length) fails++;
    rows.push(...R);
  }
  g.dispose?.();
}
process.exit(fails ? 1 : 0);
