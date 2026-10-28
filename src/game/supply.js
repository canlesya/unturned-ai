// 12.208 İKMAL KUTULARI (Battlefield ikmal istasyonu; kullanıcı: "üste ve bayraklara ikmal / RPG kutusu"): sürülen araçlı haritada (Kuzey Vadisi) her
// üste 2, her bayrakta 1 kalıcı kutu. Yanındaki (3,6 m) asker 1,5 sn'de bir: mermi yedeği + %30, roketatar +1 (RPG en çok 3, LAW 1), bomba / C4 /
// mayın / claymore +1 (2 tikte bir), kutunun sahibi = üs takımı / bayrağın o anki sahibi (sahipsiz bayrakta kimse). Sunucu (ya da çevrimdışı oyun) uygular;
// istemci kutuları aynı kuralla kendisi çizer (konum = yol ızgarasında açık nokta, deterministik).
import * as THREE from 'three';
import { createWeapon } from '../models/weapons.js';
import { WSTATS } from './stats.js';
import { t as $t } from '../i18n/index.js';
import '../i18n/vehicle.js';
import { wName } from '../i18n/game.js';

export const SUPPLY = { r: 3.6, use: 2.6, tick: 1.5, base: 2, gunK: 0.3, kit: 'rpg' };      // use: E ile kutudan RPG alma / anında ikmal (kutu merkezine m)

// 12.216 kutunun sahibi: üs kutusu = üs takımı, bayrak kutusu = bayrağın o anki sahibi; null = TARAFSIZ (sahipsiz bayrak → herkes kullanır;
// eskiden kimse kullanamıyordu: kullanıcı "mapin bazı noktalarında RPG var ama kullanılamıyor")
export const crateTeam = (c) => (c.of ? c.of.owner || null : c.team);
export const crateOpen = (c, team) => { const t = crateTeam(c); return !t || t === team; };
// askerin E menzilindeki en yakın kutu (yoksa null)
export function nearCrate(g, s, R = SUPPLY.use) {
  if (!g.supply?.length || !s?.alive || s.veh || s.def?.zombie) return null;
  let best = null, bd = R;
  for (const c of g.supply) {
    const d = Math.hypot(s.pos.x - c.x, s.pos.z - c.z);
    if (d <= bd && Math.abs(s.pos.y - c.y) < 2.2) { best = c; bd = d; }
  }
  return best;
}
const isLauncher = (it) => WSTATS[it.id]?.kind === 'launcher';
const gadgetSlot = (s) => { const i = s.items.findIndex((it) => WSTATS[it.id]?.slot === 'gadget' || ['throwable', 'mine', 'medkit', 'ammobox', 'launcher'].includes(WSTATS[it.id]?.kind)); return i >= 0 ? i : Math.min(2, s.items.length); };
// eksik cephane var mı (mermi yedeği / roket / bomba)
function needs(s) {
  for (const it of s.items) {
    const ws = WSTATS[it.id]; if (!ws) continue;
    if (ws.kind === 'gun' && ws.reserve && it.reserve < ws.reserve) return true;
    if (ws.kind === 'launcher' && it.mag + it.reserve < 1 + (ws.reserve || 0)) return true;
    if ((ws.kind === 'throwable' || ws.kind === 'mine') && it.mag < (ws.count || 1)) return true;
  }
  return false;
}
// Kutunun bu askere ne yapacağı (ipucu + E): 'enemy' (düşmanın kutusu) · 'take' (roketatarı yok → kutudaki RPG'yi alır; ekipman yuvasındakinin
// yerine: el bombası / sağlık paketi …) · 'refill' (eksik cephane: E anında doldurur, yanında durmak da 1,5 sn'de bir doldurur) · 'full'
export function crateAction(g, s, c) {
  if (!crateOpen(c, s.team)) return { act: 'enemy', team: crateTeam(c) };
  if (!s.items.some(isLauncher)) { const k = gadgetSlot(s); return { act: 'take', slot: k, old: s.items[k]?.id || null }; }
  return { act: needs(s) ? 'refill' : 'full' };
}
// Cephane ver (otomatik tik ve E aynı kural); 'rkOnly' değil: her şey. Dönen: bir şey verildi mi
function giveAmmo(s, c, nade) {
  let any = false;
  for (const it of s.items) {
    const ws = WSTATS[it.id]; if (!ws) continue;
    if (ws.kind === 'gun' && ws.reserve && it.reserve < ws.reserve) { it.reserve = Math.min(ws.reserve, it.reserve + Math.ceil(ws.reserve * SUPPLY.gunK)); any = true; }
    else if (ws.kind === 'launcher' && it.mag + it.reserve < 1 + (ws.reserve || 0)) { if (it.mag <= 0 && s.cur !== s.items.indexOf(it)) it.mag = 1; else it.reserve++; any = true; }
    else if ((ws.kind === 'throwable' || ws.kind === 'mine') && it.mag < (ws.count || 1) && nade) { it.mag++; any = true; }
  }
  return any;
}
// E ile kutuyu kullan (YETKİLİ taraf: çevrimdışı oyun ya da sunucu; çevrim içi istemci 've' kenarı yollar). Dönen eylem adı ya da null
export function useCrate(g, s) {
  const c = nearCrate(g, s); if (!c) return null;
  const a = crateAction(g, s, c);
  if (a.act === 'take') {
    const ws = WSTATS[SUPPLY.kit];
    s.items[a.slot] = { id: SUPPLY.kit, mag: ws.mag ?? 1, reserve: ws.reserve ?? 0 };      // RPG 1 + 2 roket (mühendisin başlangıcı)
    if (s.cur === a.slot) { s.reloadT = 0; s.useT = 0; s.cook = null; s.swing = null; s._modelWeapon = undefined; if (!g.headless) { s._syncWeaponModel?.(); g.emit?.('switch', s); } }
  } else if (a.act === 'refill') giveAmmo(s, c, true);
  if (s.isPlayer) crateToast(g, a, c);
  else if (s.human) g.netEvent({ e: 'kit', v: s.id, a: a.act, o: a.old || '' });
  return a.act;
}
// oyuncuya kutu sonucu (çevrimdışı doğrudan, çevrim içi 'kit' olayıyla)
export function crateToast(g, a, c) {
  const me = g.playerSoldier; if (!me || g.headless) return;
  const key = g.binds?.codes?.('slot3')?.[0], k = key ? key.replace(/^Digit/, '') : '4';
  if (a.act === 'take') { g.hud.toast($t(g.player?.touch ? 'sup.t.takeT' : 'sup.t.take', { k, o: a.old ? wName(a.old) : '' }), '#9be07a'); g.sfx?.deploy?.(me.pos); }
  else if (a.act === 'refill') { g.hud.toast($t('sup.t.refill'), '#9be07a'); g.sfx?.deploy?.(me.pos); }
  else if (a.act === 'full') g.hud.toast($t('sup.t.full'), '#cfd6dd');
  else if (a.act === 'enemy') g.hud.toast($t('sup.t.enemy'), '#ff9a88');
}
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
    const team = crateTeam(c);                                          // 12.216 tarafsız (sahipsiz bayrak) kutu herkese
    c.t++;
    for (const s of g.soldiers) {
      if (!s.alive || s.veh || (team && s.team !== team) || Math.abs(s.pos.x - c.x) > SUPPLY.r || Math.abs(s.pos.z - c.z) > SUPPLY.r || Math.hypot(s.pos.x - c.x, s.pos.z - c.z) > SUPPLY.r) continue;
      const any = giveAmmo(s, c, c.t % 2 === 0);
      if (any && s.isPlayer) { g.hud.toast($t('sup.t.auto'), '#9be07a'); g.sfx.deploy(s.pos); }
      else if (any && s.human) g.netEvent({ e: 'ammo', v: s.id });
    }
  }
}
// ipucunun eylem kısmı ("RPG al (3 roket · El Bombası yerine)" / "mermi / roket al" / "cephane dolu" / "düşmanın …")
export function crateLabel(a) {
  if (a.act === 'take') return $t('sup.take', { o: a.old ? $t('sup.instead', { o: wName(a.old) }) : '' });
  return $t('sup.' + a.act);
}
