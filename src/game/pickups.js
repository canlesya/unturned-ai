import * as THREE from 'three';
import { box, cylY, ico, mergeVC } from '../core/geo.js';
import { TUNE } from './balance.js';
import { WSTATS } from './stats.js';
import { PAINT_COLORS } from './paint.js';

// Paintball toplanabilir kutular (harita map.pickups; yalnız paintball modunda): boya topu kutusu (silahların yedeğini doldurur) ve can kutusu (+TUNE.pbHeal).
// SUNUCU YETKİLİ: kimin aldığına çevrimdışında yerel oyun, çevrimiçinde sunucu karar verir (aynı adımda en yakın uygun savaşçı → iki kişi aynı kutuyu alamaz),
// 'pk' ağ olayı herkese gider ({ i, a: 1 } belirdi · { i, a: 0, v, t } v aldı, t sn sonra yeniden belirir). Can doluysa can kutusu, cephane doluysa mermi kutusu alınmaz.
// Çizim: tür başına 1 örneklenmiş kutu ağı + 1 "hayalet" (yeniden belirirken soluk, büyüyen) + tüm zemin halkaları 1 → toplam 5 çizim çağrısı, karede ayırma yok.
export const PK_R = 1.2;                      // alma yarıçapı (yatay, m)
const TYPES = ['ammo', 'health'];
const RING_COL = { ammo: '#ffc21a', health: '#3dff7a' };

export const ammoFull = (s) => s.items.every((it) => { const st = WSTATS[it.id]; return !st || st.kind !== 'gun' || it.reserve >= (st.reserve ?? 0); });
export const respawnOf = (type) => (type === 'health' ? TUNE.pbHealthRespawn : TUNE.pbAmmoRespawn);
export function canTake(s, type) { return type === 'health' ? s.hp < s.maxHp - 0.01 : !ammoFull(s); }
// Etki (sunucu + alanın kendi istemcisi aynı formülle uygular → tahmin = sunucu)
export function applyPickup(s, type) {
  if (type === 'health') { s.heal(TUNE.pbHeal); return; }
  for (const it of s.items) { const st = WSTATS[it.id]; if (st && st.kind === 'gun') it.reserve = Math.max(it.reserve, st.reserve ?? 0); }
}

function ammoModel() {
  const g = new THREE.Group();
  box(g, [0.62, 0.3, 0.42], '#3c4a2c', [0, 0.15, 0]);                                   // boya topu sandığı (asker yeşili plastik)
  box(g, [0.66, 0.05, 0.46], '#2a3420', [0, 0.32, 0]);                                  // kenar
  for (const sx of [-1, 1]) box(g, [0.04, 0.12, 0.2], '#1e2418', [sx * 0.33, 0.2, 0]);   // tutamak
  box(g, [0.5, 0.012, 0.012], '#ffc21a', [0, 0.18, 0.212]);                            // sarı şerit
  box(g, [0.5, 0.012, 0.012], '#ffc21a', [0, 0.18, -0.212]);
  // üstte açık tepside renkli boya topları + iki boya kutusu
  let k = 0;
  for (let ix = 0; ix < 4; ix++) for (let iz = 0; iz < 3; iz++) ico(g, 0.045, PAINT_COLORS[(k++ * 5) % PAINT_COLORS.length], [-0.21 + ix * 0.075 + (iz % 2) * 0.03, 0.385, -0.1 + iz * 0.075], 1);
  for (const [x, c] of [[0.2, '#ff2b3a'], [0.2, '#2f7dff']]) cylY(g, 0.06, 0.06, 0.14, c, [x, 0.41, c === '#ff2b3a' ? -0.08 : 0.08], 10);
  box(g, [0.13, 0.012, 0.13], '#e8e8e8', [0.2, 0.485, -0.08]); box(g, [0.13, 0.012, 0.13], '#e8e8e8', [0.2, 0.485, 0.08]);
  return mergeVC(g).children[0].geometry;
}
function healthModel() {
  const g = new THREE.Group();
  box(g, [0.56, 0.38, 0.4], '#f4f4f0', [0, 0.19, 0]);                                   // beyaz ilk yardım kutusu
  box(g, [0.58, 0.04, 0.42], '#d8d8d2', [0, 0.36, 0]);                                  // kapak çizgisi
  box(g, [0.18, 0.05, 0.08], '#9aa0a6', [0, 0.405, 0]);                                 // sap
  const C = '#20c64a';                                                                  // yeşil artı (dört yüz + üst)
  for (const [sx, sz] of [[0, 1], [0, -1]]) { box(g, [0.2, 0.06, 0.012], C, [0, 0.19, sz * 0.204]); box(g, [0.06, 0.2, 0.012], C, [0, 0.19, sz * 0.204]); void sx; }
  for (const sx of [-1, 1]) { box(g, [0.012, 0.06, 0.2], C, [sx * 0.284, 0.19, 0]); box(g, [0.012, 0.2, 0.06], C, [sx * 0.284, 0.19, 0]); }
  box(g, [0.16, 0.012, 0.05], C, [0.13, 0.386, 0]); box(g, [0.05, 0.012, 0.16], C, [0.13, 0.386, 0]);
  return mergeVC(g).children[0].geometry;
}

export class Pickups {
  constructor(game) {
    this.g = game;
    const defs = (game.mode.paintball && game.map.pickups) || [];
    this.list = defs.map((d, i) => ({ i, type: d.type, x: d.x, y: d.y, z: d.z, name: d.name || '', t: 0, tot: 1, by: -1 }));
    this.taken = 0;
    if (game.headless || !this.list.length) return;
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.08 });
    const ghost = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, depthWrite: false, wireframe: true });
    const geos = { ammo: ammoModel(), health: healthModel() };
    this.mesh = {}; this.ghost = {}; this.idx = {};
    for (const t of TYPES) {
      const n = this.list.filter((p) => p.type === t).length; if (!n) continue;
      const m = new THREE.InstancedMesh(geos[t], vc, n); m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const gh = new THREE.InstancedMesh(geos[t], ghost, n); gh.frustumCulled = false; gh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      game.scene.add(m, gh); this.mesh[t] = m; this.ghost[t] = gh;
    }
    let c = { ammo: 0, health: 0 }; for (const p of this.list) p.k = c[p.type]++;
    // zemin halkası: yumuşak parlayan halka (toplamalı karışım), türün renginde; yeniden belirirken sönük
    const rg = new THREE.RingGeometry(0.42, 0.62, 40, 1); rg.rotateX(-Math.PI / 2);
    const rmat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.rings = new THREE.InstancedMesh(rg, rmat, this.list.length); this.rings.frustumCulled = false; this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringCol = this.list.map((p) => new THREE.Color(RING_COL[p.type]));
    for (const p of this.list) this.rings.setColorAt(p.i, this.ringCol[p.i]);
    game.scene.add(this.rings);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this._e = new THREE.Euler();
    this.draw();
  }

  // ── yetkili güncelleme (çevrimdışı oyun / sunucu); çevrimiçi istemcide yalnız geri sayım (görüntü) ──
  update(dt) {
    const g = this.g, list = this.list; if (!list.length) return;
    const auth = !g.online;
    for (const p of list) {
      if (p.t > 0) { p.t = Math.max(0, p.t - dt); if (p.t === 0 && auth) g.netEvent({ e: 'pk', i: p.i, a: 1 }); continue; }
      if (!auth) continue;
      let best = null, bd = PK_R * PK_R;
      for (const s of g.soldiers) {
        if (!s.alive || s.vacant) continue;
        const dy = s.pos.y - p.y; if (dy < -0.7 || dy > 1.5) continue;
        const dx = s.pos.x - p.x, dz = s.pos.z - p.z, d2 = dx * dx + dz * dz;
        if (d2 < bd && canTake(s, p.type)) { bd = d2; best = s; }
      }
      if (best) this.take(p, best);
    }
  }

  take(p, s) {
    applyPickup(s, p.type);
    p.t = p.tot = respawnOf(p.type); p.by = s.id; this.taken++;
    this.g.netEvent({ e: 'pk', i: p.i, a: 0, v: s.id, t: p.t });
    this._fx(p, s);
  }

  // alan / görenler için: ses, ekrandaki bildirim
  _fx(p, s) {
    const g = this.g; if (g.headless) return;
    if (s === g.playerSoldier) {
      if (p.type === 'health') g.hud.pickupToast(`+${TUNE.pbHeal} CAN`, '#5dff8f'); else g.hud.pickupToast('+TOPLAR · yedek dolu', '#ffd23a');
      g.sfx.pickup?.(p.type);
    } else if (Math.hypot(p.x - g.camera.position.x, p.z - g.camera.position.z) < 25) g.sfx.pickup?.(p.type, s.pos);
  }

  // ── çevrimiçi istemci ──
  onNet(ev) {
    const p = this.list[ev.i]; if (!p) return;
    if (ev.a) { p.t = 0; return; }
    p.t = p.tot = ev.t || respawnOf(p.type); p.by = ev.v;
    const s = this.g.soldiers[ev.v]; if (!s) return;
    if (s === this.g.playerSoldier) applyPickup(s, p.type);          // kendi tahminim: cephane / can hemen (sunucu anlık görüntüsü aynı değeri getirir)
    this._fx(p, s);
  }
  netState() { return this.list.filter((p) => p.t > 0).map((p) => [p.i, +p.t.toFixed(1), p.tot]); }
  applyState(st) { if (Array.isArray(st)) for (const [i, t, tot] of st) { const p = this.list[i]; if (p) { p.t = t; p.tot = tot || t; } } }

  // Bot: canı / cephanesi azsa en yakın (yol mesafesi değil, düz) uygun kutu
  botWant(s) {
    const lowHp = s.hp < s.maxHp * 0.55, lowAmmo = s.items.some((it) => { const st = WSTATS[it.id]; return st && st.kind === 'gun' && it.mag + it.reserve < (st.mag + (st.reserve ?? 0)) * 0.3; });
    if (!lowHp && !lowAmmo) return null;
    let best = null, bd = 30;
    for (const p of this.list) {
      if (p.t > 0 || (p.type === 'health' ? !lowHp : !lowAmmo)) continue;
      const d = Math.hypot(p.x - s.pos.x, p.z - s.pos.z) + Math.abs(p.y - s.pos.y) * 1.5;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ── çizim (Game.render öncesi): yavaş dönüş + iniş-çıkış, yeniden belirirken soluk hayalet büyür ──
  draw() {
    if (!this.rings) return;
    const T = performance.now() / 1000, m = this._m, q = this._q, v = this._v, sc = this._s;
    for (const p of this.list) {
      const on = p.t <= 0, mesh = this.mesh[p.type], gh = this.ghost[p.type];
      const ph = p.i * 1.7, bob = Math.sin(T * 2 + ph) * 0.07;
      q.setFromEuler(this._e.set(0, T * 1.1 + ph, 0));
      v.set(p.x, p.y + 0.32 + bob, p.z);
      if (on) { mesh.setMatrixAt(p.k, m.compose(v, q, sc.set(1, 1, 1))); gh.setMatrixAt(p.k, m.makeScale(0, 0, 0)); }
      else {
        const f = 1 - p.t / Math.max(0.1, p.tot);                     // yeniden belirmeye ilerleme
        mesh.setMatrixAt(p.k, m.makeScale(0, 0, 0));
        const k = 0.45 + 0.55 * f; v.y = p.y + 0.32; gh.setMatrixAt(p.k, m.compose(v, q, sc.set(k, k, k)));
      }
      const pulse = on ? 0.85 + Math.sin(T * 3 + ph) * 0.15 : 0.18;
      const rs = on ? 1 + Math.sin(T * 3 + ph) * 0.06 : 0.8;
      this.rings.setMatrixAt(p.i, m.compose(v.set(p.x, p.y + 0.02, p.z), q.identity(), sc.set(rs, 1, rs)));
      this.rings.setColorAt(p.i, this._c.copy(this.ringCol[p.i]).multiplyScalar(pulse));
    }
    for (const t of TYPES) if (this.mesh[t]) { this.mesh[t].instanceMatrix.needsUpdate = true; this.ghost[t].instanceMatrix.needsUpdate = true; }
    this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true;
  }
}
