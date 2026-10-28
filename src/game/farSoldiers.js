// ───── 12.203 Uzak asker LOD'u (yalnız istemci, büyük harita / kalabalık maç) ─────
// Ölçüm (Kuzey Vadisi 64v64 / 128v128, Mac GPU): her asker ~17 parça (çizim çağrısı) + silah; 256 askerde sahnenin yarısı asker çizimi ve her karede
// 256 iskeletin poz hesabı (syncModel) + matris güncellemesi. Uzaktaki asker ekranda birkaç piksel: tam modeli çizmek boşa.
// Kademe (etkin uzaklık = gerçek uzaklık ÷ nişangâh büyütmesi; dürbünle bakınca uzak asker yine tam model):
//   ≤ NEAR m    : tam model, her kare poz
//   ≤ FAR m     : tam model, poz 2 karede bir (birikmiş süreyle; 3 m/sn koşuda adım evresi kaymaz)
//   > FAR m     : tam model gizlenir (alt ağacın matris güncellemesi de durur), yerine takım renkli TEK PARÇA vekil: bütün uzak askerler takım başına
//                 tek InstancedMesh (2 çizim çağrısı). Yatan asker yatık, ölü asker (ilk 5 sn) yatık vekil.
//   görüş dışı  : (kamera konisinin arkası, > 12 m) poz hesaplanmaz, alt ağaç güncellenmez (three zaten çizmez)
// Vuruş kutusu / ağ / sim etkilenmez: yalnız görsel.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TEAMS } from '../core/palette.js';

export const LOD = { NEAR: 60, FAR: 120, MIN_SOLDIERS: 40 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sp = new THREE.Sphere();

// kaba asker silueti (1,8 m): bacaklar, gövde + yelek, kollar, baş, kask — köşe renkleri takımdan
function proxyGeometry(c) {
  const parts = [];
  const add = (w, h, d, x, y, z, col) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z);
    const k = new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = k.r; a[i * 3 + 1] = k.g; a[i * 3 + 2] = k.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  add(0.15, 0.86, 0.17, -0.11, 0.43, 0, c.pants); add(0.15, 0.86, 0.17, 0.11, 0.43, 0, c.pants);       // bacaklar
  add(0.44, 0.58, 0.26, 0, 1.17, 0, c.shirt); add(0.46, 0.36, 0.3, 0, 1.2, 0, c.vest);                // gövde + yelek
  add(0.12, 0.56, 0.13, -0.29, 1.12, -0.06, c.shirt); add(0.12, 0.56, 0.13, 0.29, 1.12, -0.1, c.shirt);   // kollar (öne dönük, silah tutar gibi)
  add(0.2, 0.22, 0.22, 0, 1.6, 0, '#c9a27e'); add(0.26, 0.12, 0.28, 0, 1.73, 0, c.helmet);            // baş + kask
  add(0.07, 0.07, 0.7, 0.16, 1.22, -0.38, '#2a2a2a');                                                     // tüfek
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

export class FarSoldiers {
  constructor(game) {
    this.g = game;
    this.mesh = {};
    const cap = game.soldiers.length + 4;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    for (const team of ['blue', 'red']) {
      const im = new THREE.InstancedMesh(proxyGeometry(TEAMS[team]), mat, cap);
      im.count = 0; im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.name = 'farSoldiers:' + team;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      game.scene.add(im);
      this.mesh[team] = im;
    }
    this.frame = 0;
    this.stats = { far: 0, mid: 0, near: 0, off: 0 };
  }

  static wanted(game) { return !game.headless && !!game.scene && (game.map?.big || game.soldiers.length > 64) && game.soldiers.length >= LOD.MIN_SOLDIERS; }

  // kare başında: kamera konisi + büyütme (dürbün / nişangâh: fov küçülür → etkin uzaklık kısalır)
  begin() {
    const cam = this.g.camera;
    this.frame++;
    cam.updateMatrixWorld();
    _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    _fr.setFromProjectionMatrix(_pm);
    const base = this.g.player?.fov || 75;
    this.zoom = Math.max(1, Math.tan((base * Math.PI) / 360) / Math.tan((cam.fov * Math.PI) / 360));
    this.cx = cam.position.x; this.cy = cam.position.y; this.cz = cam.position.z;
    this.stats.far = this.stats.mid = this.stats.near = this.stats.off = 0;
    for (const t in this.mesh) this.mesh[t].count = 0;
  }

  // asker başına kademe: 0 tam · 1 orta (2 karede bir poz) · 2 uzak (vekil) · 3 görüş dışı (poz yok). Oyuncunun kendisi / araçtaki her zaman 0.
  tier(s) {
    if (s.isPlayer || s.veh) return 0;
    const dx = s.pos.x - this.cx, dy = s.pos.y - this.cy, dz = s.pos.z - this.cz, d = Math.sqrt(dx * dx + dy * dy + dz * dz) / this.zoom;
    if (d > 12) { _sp.center.set(s.pos.x, s.pos.y + 0.9, s.pos.z); _sp.radius = 1.6; if (!_fr.intersectsSphere(_sp)) { this.stats.off++; return 3; } }
    if (d > LOD.FAR && this.mesh[s.team]) { this.stats.far++; return 2; }
    if (d > LOD.NEAR) { this.stats.mid++; return 1; }
    this.stats.near++;
    return 0;
  }

  // uzak vekil örneği (syncModel'den; kök gizli)
  push(s) {
    const im = this.mesh[s.team]; if (!im) return;
    const by = s.bodyYaw ?? s.yaw;
    let rx = 0, y = s.pos.y;
    if (!s.alive) rx = (s.deadDir || 1) * Math.min(1, (s.deadT || 0) * 3.2) * 1.5;
    else if (s.proneT > 0.3) { rx = -(Math.PI / 2) * s.proneT; y += 0.17 * s.proneT; }
    const cr = s.alive ? 1 - 0.27 * (s.crouchT || 0) : 1;
    _e.set(rx, by, 0); _q.setFromEuler(_e); _p.set(s.pos.x, y, s.pos.z); _s.set(1, cr, 1);
    _m.compose(_p, _q, _s);
    im.setMatrixAt(im.count++, _m);
  }

  end() { for (const t in this.mesh) { const im = this.mesh[t]; im.instanceMatrix.needsUpdate = true; im.instanceMatrix.clearUpdateRanges?.(); im.instanceMatrix.addUpdateRange?.(0, im.count * 16); } }

  dispose() { for (const t in this.mesh) { this.g.scene.remove(this.mesh[t]); this.mesh[t].geometry.dispose(); } this.mesh = {}; }
}
