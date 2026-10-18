import * as THREE from 'three';
import { box, cylY, ico, mergeVC } from '../core/geo.js';
import { TUNE } from './balance.js';
import { WSTATS } from './stats.js';
import { PAINT_COLORS } from './paint.js';
import { t } from '../i18n/index.js';
import '../i18n/pb.js';

// Paintball toplanabilir kutular (harita map.pickups; yalnız paintball modunda): boya topu kutusu (silahların yedeğini doldurur) ve can kutusu (+TUNE.pbHeal).
// SUNUCU YETKİLİ: kimin aldığına çevrimdışında yerel oyun, çevrimiçinde sunucu karar verir (aynı adımda en yakın uygun savaşçı → iki kişi aynı kutuyu alamaz),
// 'pk' ağ olayı herkese gider ({ i, a: 1 } belirdi · { i, a: 0, v, t } v aldı, t sn sonra yeniden belirir). Can doluysa can kutusu, cephane doluysa mermi kutusu alınmaz.
// Çizim: tür başına 1 örneklenmiş kutu ağı + parıltı halesi (kameraya dönük, toplamalı) 1 + zemin halkaları 1 → toplam 4 çizim çağrısı, karede ayırma yok.
// Yeniden belirmeyi beklerken kutu ve hale gizli, zemin halkası çok sönük (yer belli olsun).
export const PK_R = 1.2;                      // alma yarıçapı (yatay, m)
const TYPES = ['ammo', 'health'];
const KIND = { ammo: 'ammo', paint: 'ammo', balls: 'ammo', health: 'health', hp: 'health', heal: 'health', medkit: 'health' };     // pickupSpots kind eş anlamlıları
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
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
  box(g, [0.62, 0.3, 0.42], '#ffb514', [0, 0.15, 0]);                                   // boya topu sandığı (sarı sert plastik, uzaktan seçilir)
  box(g, [0.66, 0.05, 0.46], '#22252b', [0, 0.32, 0]);                                  // kenar
  box(g, [0.64, 0.04, 0.44], '#22252b', [0, 0.02, 0]);                                  // taban
  for (const sx of [-1, 1]) box(g, [0.04, 0.12, 0.2], '#22252b', [sx * 0.33, 0.2, 0]);   // tutamak
  box(g, [0.5, 0.05, 0.012], '#22252b', [0, 0.17, 0.212]);                             // siyah şerit
  box(g, [0.5, 0.05, 0.012], '#22252b', [0, 0.17, -0.212]);
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
    // harita kutuları: map.pickups ({ type, x, y, z, name }) ya da map.pickupSpots ({ x, y, z, kind: 'ammo' | 'health' }; başka paintball haritaları için); y verilmezse zemin
    const defs = game.mode.paintball ? (game.map.pickups || game.map.pickupSpots || []) : [];
    this.list = defs.map((d) => ({ type: KIND[d.type || d.kind] || 'ammo', x: d.x, y: Number.isFinite(d.y) ? d.y : game.world.heightAt(d.x, d.z), z: d.z, name: d.name || '' }))
      .map((d, i) => ({ i, ...d, t: 0, tot: 1, by: -1 }));
    this.taken = 0;
    if (game.headless || !this.list.length) return;
    const vc = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.08 });

    const geos = { ammo: ammoModel(), health: healthModel() };
    this.mesh = {};
    for (const t of TYPES) {
      const n = this.list.filter((p) => p.type === t).length; if (!n) continue;
      const m = new THREE.InstancedMesh(geos[t], vc, n); m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      game.scene.add(m); this.mesh[t] = m;
    }
    let c = { ammo: 0, health: 0 }; for (const p of this.list) p.k = c[p.type]++;
    // zemin halkası: yumuşak parlayan halka (toplamalı karışım), türün renginde; yeniden belirirken sönük
    const rg = new THREE.RingGeometry(0.42, 0.62, 40, 1); rg.rotateX(-Math.PI / 2);
    const rmat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.rings = new THREE.InstancedMesh(rg, rmat, this.list.length); this.rings.frustumCulled = false; this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ringCol = this.list.map((p) => new THREE.Color(RING_COL[p.type]));
    for (const p of this.list) this.rings.setColorAt(p.i, this.ringCol[p.i]);
    game.scene.add(this.rings);
    // parıltı halesi: yumuşak radyal doku, kameraya dönük düzlem (örnek başına), derinliğe yazmaz
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x2 = cv.getContext('2d'), gr = x2.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x2.fillStyle = gr; x2.fillRect(0, 0, 64, 64);
    const hmat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, opacity: 0.5 });      // normal karışım: gündüz parlak zeminde de renkli hale görünür
    this.halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.7, 1.7), hmat, this.list.length); this.halo.frustumCulled = false; this.halo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (const p of this.list) this.halo.setColorAt(p.i, this.ringCol[p.i]);
    game.scene.add(this.halo);
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
      if (p.type === 'health') g.hud.pickupToast(t('pb.pkHeal', { n: TUNE.pbHeal }), '#5dff8f'); else g.hud.pickupToast(t('pb.pkAmmo'), '#ffd23a');
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
    const T = performance.now() / 1000, m = this._m, q = this._q, v = this._v, sc = this._s, cq = this.g.camera.quaternion;
    for (const p of this.list) {
      const on = p.t <= 0, mesh = this.mesh[p.type];
      const ph = p.i * 1.7, bob = Math.sin(T * 2 + ph) * 0.07;
      q.setFromEuler(this._e.set(0, T * 1.1 + ph, 0));
      v.set(p.x, p.y + 0.32 + bob, p.z);
      if (on) { mesh.setMatrixAt(p.k, m.compose(v, q, sc.set(1, 1, 1))); v.y += 0.22; this.halo.setMatrixAt(p.i, m.compose(v, cq, sc.setScalar(0.9 + Math.sin(T * 3 + ph) * 0.1))); }
      else { mesh.setMatrixAt(p.k, ZERO); this.halo.setMatrixAt(p.i, ZERO); }
      const pulse = on ? 0.85 + Math.sin(T * 3 + ph) * 0.15 : 0.07, rs = on ? 1 + Math.sin(T * 3 + ph) * 0.06 : 0.7;
      this.rings.setMatrixAt(p.i, m.compose(v.set(p.x, p.y + 0.02, p.z), q.identity(), sc.set(rs, 1, rs)));
      this.rings.setColorAt(p.i, this._c.copy(this.ringCol[p.i]).multiplyScalar(pulse));
    }
    for (const t of TYPES) if (this.mesh[t]) this.mesh[t].instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true; this.rings.instanceMatrix.needsUpdate = true; this.rings.instanceColor.needsUpdate = true;
  }
}
