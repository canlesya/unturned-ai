// 12.208 İKMAL KUTULARI (Battlefield ikmal istasyonu; kullanıcı: "üste ve bayraklara ikmal / RPG kutusu"): sürülen araçlı haritada (Kuzey Vadisi) her
// üste 2, her bayrakta 1 kalıcı kutu. Yanındaki (3,6 m) asker 1,5 sn'de bir: mermi yedeği + %30, roketatar +1 (RPG en çok 3, LAW 1), bomba / C4 /
// mayın / claymore +1 (2 tikte bir), kutunun sahibi = üs takımı / bayrağın o anki sahibi (sahipsiz bayrakta kimse). Sunucu (ya da çevrimdışı oyun) uygular;
// istemci kutuları aynı kuralla kendisi çizer (konum = yol ızgarasında açık nokta, deterministik).
import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { WSTATS } from './stats.js';

export const SUPPLY = { r: 3.6, tick: 1.5, base: 2, gunK: 0.3 };
function crateMesh() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.75), new THREE.MeshStandardMaterial({ color: '#4d5734', roughness: 0.85 }));
  box.position.y = 0.35; box.castShadow = true; box.receiveShadow = true; g.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: '#3a4227', roughness: 0.8 })); lid.position.y = 0.72; g.add(lid);
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.12, 0.77), new THREE.MeshStandardMaterial({ color: '#e0a92c', roughness: 0.6 })); band.position.y = 0.5; g.add(band);
  try { const r = createWeapon('rpg', 'iron', true); r.scale.setScalar(1.3); r.position.set(0, 0.82, 0); r.rotation.y = Math.PI / 2; g.add(r); } catch { /* model yok */ }
  return g;
}
export function initSupply(g) {
  g.supply = [];
  if (!g.vehicles || !g.map.big) return;
  const spot = (x, z) => { const vi = g.nav.nearestFree(x, z, 8); return vi >= 0 ? { x: g.nav.cx(vi), z: g.nav.cz(vi) } : { x, z }; };
  for (const team of ['blue', 'red']) {
    const sp = g.map.spawns[team][0], fo = g.map.spawns[team === 'blue' ? 'red' : 'blue'][0], a = Math.atan2(fo.z - sp.z, fo.x - sp.x);
    for (let i = 0; i < SUPPLY.base; i++) { const s = (i ? -1 : 1) * 7; g.supply.push({ team, ...spot(sp.x + Math.cos(a) * 9 - Math.sin(a) * s, sp.z + Math.sin(a) * 9 + Math.cos(a) * s) }); }
  }
  for (const o of g.mode.objectives) g.supply.push({ of: o, ...spot(o.x + Math.min(8, o.r * 0.45), o.z + 3) });
  for (const c of g.supply) {
    c.y = g.world.heightAt(c.x, c.z); c.t = 0;
    if (g.headless) continue;
    c.mesh = crateMesh(); c.mesh.position.set(c.x, c.y, c.z); c.mesh.rotation.y = Math.random() * 6.28; g.scene.add(c.mesh);
  }
}
export function updateSupply(g, dt) {
  if (g.online || !g.supply?.length) return;
  if ((g._supT = (g._supT ?? SUPPLY.tick) - dt) > 0) return;
  g._supT = SUPPLY.tick;
  for (const c of g.supply) {
    const team = c.of ? c.of.owner : c.team; if (!team) continue;
    c.t++;
    for (const s of g.soldiers) {
      if (!s.alive || s.veh || s.team !== team || Math.abs(s.pos.x - c.x) > SUPPLY.r || Math.abs(s.pos.z - c.z) > SUPPLY.r || Math.hypot(s.pos.x - c.x, s.pos.z - c.z) > SUPPLY.r) continue;
      let any = false;
      for (const it of s.items) {
        const ws = WSTATS[it.id]; if (!ws) continue;
        if (ws.kind === 'gun' && ws.reserve && it.reserve < ws.reserve) { it.reserve = Math.min(ws.reserve, it.reserve + Math.ceil(ws.reserve * SUPPLY.gunK)); any = true; }
        else if (ws.kind === 'launcher' && it.mag + it.reserve < 1 + (ws.reserve || 0)) { if (it.mag <= 0 && s.cur !== 2) it.mag = 1; else it.reserve++; any = true; }
        else if ((ws.kind === 'throwable' || ws.kind === 'mine') && it.mag < (ws.count || 1) && c.t % 2 === 0) { it.mag++; any = true; }
      }
      if (any && s.isPlayer) { g.hud.toast('İkmal: cephane / tanksavar dolduruldu', '#9be07a'); g.sfx.deploy(s.pos); }
      else if (any && s.human) g.netEvent({ e: 'ammo', v: s.id });
    }
  }
}
