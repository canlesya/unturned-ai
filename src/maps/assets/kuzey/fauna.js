import * as THREE from 'three';
import { RIVER, FIELDS } from './layout.js';

// Kuzey Vadisi hayvanları (12.172, YALNIZ İSTEMCİ görseli: sunucuya / ağa / çarpışmaya / bot görüşüne etkisi yok; Math.random serbest).
// İnek sürüsü (çiftlik çayırı), koyun sürüsü (köy yamacı), geyik grupları (orman kenarı: askere 45 m yaklaşınca / yakında ateş edilince kaçar,
// uzaklaşıp görünmeden yeniden belirir), karga sürüleri (tarlada yerde; ateş sesiyle havalanır, döner, başka tarlaya konar), yüksekte süzülen
// yırtıcılar, nehirde ördekler, ara sıra sıçrayan balık. Tür başına tek InstancedMesh (kanat çırpma / yürüme salınımı gölgelendiricide).
// Güncelleme: kameraya < 450 m olanlar her kare, ötekiler 8 karede bir. Sesler ambience.js (on(event)).

const C = (h) => new THREE.Color(h);
function part(g, col, out) { const p = g.index ? g.toNonIndexed() : g; const n = p.attributes.position.count; for (let i = 0; i < n; i++) out.col.push(col.r, col.g, col.b); out.pos.push(...p.attributes.position.array); out.wing.push(...new Array(n).fill(0)); return p; }
function boxP(o, w, h, d, x, y, z, col, rx = 0, rz = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); part(g, col, o); }
function done(o) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3)); g.setAttribute('aWing', new THREE.Float32BufferAttribute(o.wing, 1));
  g.computeVertexNormals(); return g;
}
const geoms = {
  cow() { const o = { pos: [], col: [], wing: [] }, b = C('#3b2f27'), w = C('#e8e2d6'), k = C('#1d1915');
    boxP(o, 1.9, 0.85, 0.75, 0, 1.0, 0, w); boxP(o, 0.9, 0.86, 0.77, -0.35, 1.0, 0, b); boxP(o, 0.5, 0.5, 0.42, 1.15, 1.18, 0, b); boxP(o, 0.22, 0.24, 0.36, 1.42, 1.05, 0, C('#c9a49a'));
    for (const [x, z] of [[0.7, 0.24], [0.7, -0.24], [-0.7, 0.24], [-0.7, -0.24]]) boxP(o, 0.16, 0.66, 0.16, x, 0.33, z, k);
    boxP(o, 0.08, 0.6, 0.08, -0.98, 0.9, 0, k); return done(o); },
  sheep() { const o = { pos: [], col: [], wing: [] }, w = C('#dcd6c8'), k = C('#2b2622');
    const s = new THREE.IcosahedronGeometry(0.48, 1); s.scale(1.35, 0.85, 0.9); s.translate(0, 0.72, 0); part(s, w, o);
    boxP(o, 0.3, 0.3, 0.26, 0.66, 0.86, 0, k); for (const [x, z] of [[0.35, 0.16], [0.35, -0.16], [-0.35, 0.16], [-0.35, -0.16]]) boxP(o, 0.1, 0.46, 0.1, x, 0.23, z, k); return done(o); },
  deer() { const o = { pos: [], col: [], wing: [] }, b = C('#8a6141'), l = C('#d9c3a3'), k = C('#2a201a');
    boxP(o, 1.35, 0.55, 0.42, 0, 1.12, 0, b); boxP(o, 0.5, 0.3, 0.44, -0.6, 1.08, 0, l); boxP(o, 0.22, 0.6, 0.2, 0.62, 1.5, 0, b, 0, -0.45); boxP(o, 0.42, 0.22, 0.2, 0.86, 1.82, 0, b);
    for (const [x, z] of [[0.5, 0.15], [0.5, -0.15], [-0.5, 0.15], [-0.5, -0.15]]) boxP(o, 0.08, 0.86, 0.08, x, 0.43, z, k);
    for (const z of [0.08, -0.08]) boxP(o, 0.04, 0.42, 0.04, 0.78, 2.1, z, C('#5b4836'), 0, 0.3); return done(o); },
  crow() { const o = { pos: [], col: [], wing: [] }, k = C('#1a1a1d');
    boxP(o, 0.34, 0.12, 0.12, 0, 0, 0, k); boxP(o, 0.1, 0.09, 0.09, 0.2, 0.03, 0, k);
    const wg = new THREE.BufferGeometry(); const P = [[0.08, 0, 0.05], [-0.1, 0, 0.05], [-0.02, 0, 0.42], [0.08, 0, -0.05], [-0.02, 0, -0.42], [-0.1, 0, -0.05]];
    wg.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3)); const pg = part(wg, k, o); const n = pg.attributes.position.count; o.wing.splice(o.wing.length - n, n, 0, 0, 1, 0, 1, 0); return done(o); },
  hawk() { const o = { pos: [], col: [], wing: [] }, k = C('#4a3a2e');
    boxP(o, 0.55, 0.16, 0.16, 0, 0, 0, k);
    const wg = new THREE.BufferGeometry(); const P = [[0.14, 0, 0.06], [-0.14, 0, 0.06], [-0.05, 0, 0.85], [0.14, 0, -0.06], [-0.05, 0, -0.85], [-0.14, 0, -0.06]];
    wg.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3)); const pg = part(wg, k, o); const n = pg.attributes.position.count; o.wing.splice(o.wing.length - n, n, 0, 0, 1, 0, 1, 0); return done(o); },
  duck() { const o = { pos: [], col: [], wing: [] };
    boxP(o, 0.42, 0.18, 0.22, 0, 0.06, 0, C('#6b5a44')); boxP(o, 0.14, 0.16, 0.12, 0.2, 0.2, 0, C('#2f5a3a')); boxP(o, 0.1, 0.04, 0.06, 0.3, 0.19, 0, C('#d9a33a')); return done(o); },
  fish() { const o = { pos: [], col: [], wing: [] }; boxP(o, 0.34, 0.1, 0.05, 0, 0, 0, C('#9aa3a2')); boxP(o, 0.1, 0.12, 0.02, -0.2, 0, 0, C('#7d8786')); return done(o); },
};

function makeMat(flap) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  const U = { uTime: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aWing; uniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.9;
  ${flap ? 'transformed.y += aWing * sin(uTime * 13.0 + ph) * 0.32 * length(instanceMatrix[0].xyz);' : ''}
#endif`);
  };
  m.customProgramCacheKey = () => 'kuzey-fauna-' + (flap ? 'f' : 's');
  m.userData.U = U;
  return m;
}

const rnd = (a, b) => a + Math.random() * (b - a);
export class Fauna {
  constructor(T, map) {
    this.T = T; this.map = map; this.group = new THREE.Group(); this.group.name = 'kuzey-hayvan';
    this.mat = makeMat(false); this.flapMat = makeMat(true);
    this.kinds = {};
    const add = (k, n, flap = false) => { const im = new THREE.InstancedMesh(geoms[k](), flap ? this.flapMat : this.mat, n); im.castShadow = !flap; im.receiveShadow = true; im.frustumCulled = false; this.group.add(im); this.kinds[k] = { im, list: [] }; return this.kinds[k]; };
    this.events = [];
    const H = (x, z) => T.heightAt(x, z);
    // sürüler: alan dikdörtgeni içinde dolaşır
    const pasture = (k, n, cx, cz, w, d) => { const K = this.kinds[k] || add(k, 0); for (let i = 0; i < n; i++) K.list.push({ k, x: cx + rnd(-w, w) / 2, z: cz + rnd(-d, d) / 2, ry: rnd(0, 6.3), area: [cx, cz, w / 2, d / 2], st: 'graze', t: rnd(1, 8), sp: 0 }); };
    this.kinds.cow = add('cow', 14); this.kinds.sheep = add('sheep', 30); this.kinds.deer = add('deer', 18); this.kinds.crow = add('crow', 48, true); this.kinds.hawk = add('hawk', 3, true); this.kinds.duck = add('duck', 14); this.kinds.fish = add('fish', 1);
    const meadow = FIELDS.find((f) => f[4] === 'grass') || [300, 540, 110, 70];
    pasture('cow', 9, meadow[0], meadow[1], meadow[2] * 0.9, meadow[3] * 0.9);
    pasture('cow', 5, 520, 460, 50, 40);
    pasture('sheep', 18, -120, 370, 80, 50); pasture('sheep', 12, -420, 180, 60, 40);
    // geyik: orman kenarı noktaları
    for (const [x, z] of [[-300, -360], [-560, -250], [500, -420], [-560, 470], [620, 280], [170, 150]]) for (let i = 0; i < 3; i++) this.kinds.deer.list.push({ k: 'deer', x: x + rnd(-8, 8), z: z + rnd(-8, 8), ry: rnd(0, 6.3), home: [x, z], area: [x, z, 25, 25], st: 'graze', t: rnd(2, 9), sp: 0, hid: 0 });
    // kargalar: 4 sürü, tarlalarda
    const wheat = FIELDS.filter((f) => f[4] !== 'grass');
    this.flocks = [];
    for (let f = 0; f < 4; f++) {
      const fl = wheat[(f * 3) % wheat.length], flock = { cx: fl[0], cz: fl[1], st: 'ground', t: 0, h: 0, ang: 0, birds: [] };
      for (let i = 0; i < 12; i++) { const b = { k: 'crow', x: fl[0] + rnd(-12, 12), z: fl[1] + rnd(-12, 12), ry: rnd(0, 6.3), y: 0, flock, off: [rnd(-10, 10), rnd(-3, 3), rnd(-10, 10)], hop: rnd(0, 5) }; flock.birds.push(b); this.kinds.crow.list.push(b); }
      this.flocks.push(flock);
    }
    for (let i = 0; i < 3; i++) this.kinds.hawk.list.push({ k: 'hawk', cx: rnd(-500, 500), cz: rnd(-500, 500), r: rnd(60, 120), a: rnd(0, 6.3), y: rnd(110, 180), sp: rnd(0.08, 0.14) });
    // ördekler: köprüler çevresinde nehirde
    for (const [x, z] of [[-40, 18], [60, -22], [-420, -20], [250, -66]]) for (let i = 0; i < 3 + (x > 0 ? 1 : 0); i++) if (this.kinds.duck.list.length < 14) this.kinds.duck.list.push({ k: 'duck', x: x + rnd(-6, 6), z: z + rnd(-4, 4), ry: rnd(0, 6.3), vx: 0, vz: 0, t: rnd(0, 4) });
    this.fish = { t: rnd(3, 8), on: false };
    for (const k in this.kinds) this.kinds[k].im.count = this.kinds[k].list.length || 0;
    this.M = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.s = new THREE.Vector3(1, 1, 1); this.p = new THREE.Vector3();
    this.frame = 0; this.last = 0;
  }
  // silah sesi (game.sfx.shot / explosion kancası): yakındaki geyik kaçar, kargalar havalanır
  onShot(pos, loud = 1) {
    if (!pos) return;
    for (const d of this.kinds.deer.list) if (Math.hypot(d.x - pos.x, d.z - pos.z) < 120 * loud) this.flee(d, pos.x, pos.z);
    for (const f of this.flocks) if (f.st === 'ground' && Math.hypot(f.cx - pos.x, f.cz - pos.z) < 160 * loud) { f.st = 'fly'; f.t = rnd(14, 22); f.ang = Math.random() * 6.3; this.events.push(['crows', f.cx, f.cz]); }
  }
  flee(a, fx, fz) { if (a.st === 'flee') return; a.st = 'flee'; a.t = rnd(5, 8); a.ry = Math.atan2(-(a.z - fz), a.x - fx); a.sp = rnd(8, 11); if (a.k === 'deer' && Math.random() < 0.4) this.events.push(['deer', a.x, a.z]); }
  update(cam, t, soldiers) {
    const dt = Math.min(0.1, this.last ? t - this.last : 0.016); this.last = t; this.frame++;
    this.mat.userData.U.uTime.value = t; this.flapMat.userData.U.uTime.value = t;
    const T = this.T, near = (a) => Math.hypot(a.x - cam.x, a.z - cam.z) < 450, step = (a) => near(a) || (this.frame & 7) === 0, k8 = (a) => (near(a) ? dt : dt * 8);
    const S = soldiers || [];
    // sürü hayvanları + geyik
    for (const k of ['cow', 'sheep', 'deer']) for (const a of this.kinds[k].list) {
      if (!step(a)) continue;
      const d = k8(a); a.t -= d;
      if (k === 'deer' && a.st !== 'flee') for (const s of S) if (s.alive && Math.hypot(s.pos.x - a.x, s.pos.z - a.z) < 45) { this.flee(a, s.pos.x, s.pos.z); break; }
      if (k !== 'deer' && a.st !== 'flee') for (const s of S) if (s.alive && Math.hypot(s.pos.x - a.x, s.pos.z - a.z) < 9) { this.flee(a, s.pos.x, s.pos.z); a.sp = k === 'cow' ? 2.2 : 3.2; a.t = 3; break; }
      if (a.st === 'graze' && a.t <= 0) { a.st = 'walk'; a.t = rnd(2, 6); a.ry += rnd(-1.2, 1.2); a.sp = k === 'deer' ? 1.2 : 0.7; }
      else if (a.st === 'walk' && a.t <= 0) { a.st = 'graze'; a.t = rnd(4, 14); a.sp = 0; }
      else if (a.st === 'flee' && a.t <= 0) {
        a.st = 'graze'; a.t = rnd(3, 9); a.sp = 0;
        if (k === 'deer' && Math.hypot(a.x - cam.x, a.z - cam.z) > 120) { a.x = a.home[0] + rnd(-10, 10); a.z = a.home[1] + rnd(-10, 10); }     // görünmeden yuvaya döner
      }
      if (a.sp) {
        let nx = a.x + Math.cos(a.ry) * a.sp * d, nz = a.z - Math.sin(a.ry) * a.sp * d;
        const A = a.area, out = a.st !== 'flee' && A && (Math.abs(nx - A[0]) > A[2] || Math.abs(nz - A[1]) > A[3]);
        if (out || T.heightAt(nx, nz) < 0.8 || T.slopeAt(nx, nz, 1) > 0.7 || Math.abs(nx) > 790 || Math.abs(nz) > 790) { a.ry += Math.PI * rnd(0.6, 1.4); nx = a.x; nz = a.z; }
        a.x = nx; a.z = nz;
      }
      if (k !== 'deer' && Math.random() < 0.0009 * (k === 'cow' ? 1 : 1.4) && near(a)) this.events.push([k, a.x, a.z]);
    }
    // karga sürüleri
    for (const f of this.flocks) {
      if (f.st === 'fly') {
        f.t -= dt; f.ang += dt * 0.5; f.h = Math.min(32, f.h + dt * 9);
        if (f.t <= 0) { const fl = FIELDS[Math.floor(Math.random() * FIELDS.length)]; f.st = 'land'; f.tx = fl[0]; f.tz = fl[1]; }
      } else if (f.st === 'land') {
        f.cx += (f.tx - f.cx) * Math.min(1, dt * 0.25); f.cz += (f.tz - f.cz) * Math.min(1, dt * 0.25);
        if (Math.hypot(f.tx - f.cx, f.tz - f.cz) < 6) { f.h = Math.max(0, f.h - dt * 7); if (f.h <= 0) { f.st = 'ground'; for (const b of f.birds) { b.x = f.cx + b.off[0]; b.z = f.cz + b.off[2]; } } }
        f.ang += dt * 0.4;
      }
      if (f.st === 'ground') for (const s of S) if (s.alive && Math.hypot(s.pos.x - f.cx, s.pos.z - f.cz) < 22) { f.st = 'fly'; f.t = rnd(12, 18); this.events.push(['crows', f.cx, f.cz]); break; }
    }
    // ördek / yırtıcı / balık
    for (const a of this.kinds.duck.list) { a.t -= dt; if (a.t <= 0) { a.t = rnd(2, 6); a.vx = rnd(-0.4, 0.4); a.vz = rnd(-0.3, 0.3); if (Math.random() < 0.15 && Math.hypot(a.x - cam.x, a.z - cam.z) < 80) this.events.push(['duck', a.x, a.z]); }
      const nx = a.x + a.vx * dt, nz = a.z + a.vz * dt; if (T.heightAt(nx, nz) < -0.8) { a.x = nx; a.z = nz; a.ry = Math.atan2(-a.vz, a.vx); } else { a.vx = -a.vx; a.vz = -a.vz; } }
    for (const h of this.kinds.hawk.list) h.a += h.sp * dt;
    const F = this.fish; F.t -= dt;
    if (!F.on && F.t <= 0) {                                                                    // kameraya yakın nehir noktasında sıçrama
      F.t = rnd(4, 9);
      let best = null; for (let i = 0; i < 12; i++) { const q = RIVER[Math.floor(Math.random() * 19)], x = q[0] + rnd(-q[2] * 0.6, q[2] * 0.6), z = q[1] + rnd(-q[2] * 0.6, q[2] * 0.6), dd = Math.hypot(x - cam.x, z - cam.z); if (dd < 110 && T.heightAt(x, z) < -1.2) { best = [x, z]; break; } }
      if (best) { F.on = true; F.x = best[0]; F.z = best[1]; F.u = 0; F.ry = rnd(0, 6.3); this.events.push(['fish', F.x, F.z]); }
    }
    if (F.on) { F.u += dt / 0.7; if (F.u >= 1) F.on = false; }
    this.write(t);
  }
  write(t) {
    const { M, q, e, s, p, T } = this;
    const put = (K, i, x, y, z, ry, rz = 0, sc = 1) => { M.compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, rz)), s.setScalar(sc)); K.im.setMatrixAt(i, M); };
    for (const k of ['cow', 'sheep', 'deer']) { const K = this.kinds[k]; K.list.forEach((a, i) => { const bob = a.sp ? Math.abs(Math.sin(t * a.sp * 3 + i)) * 0.06 * Math.min(1, a.sp) : 0; put(K, i, a.x, T.heightAt(a.x, a.z) + bob, a.z, a.ry, a.st === 'graze' ? 0.12 : 0, k === 'sheep' ? 0.95 : 1); }); K.im.instanceMatrix.needsUpdate = true; }
    const K = this.kinds.crow;
    K.list.forEach((b, i) => {
      const f = b.flock;
      if (f.st === 'ground') { b.hop -= 0.016; if (b.hop <= 0) { b.hop = rnd(1, 5); b.ry = rnd(0, 6.3); b.x += Math.cos(b.ry) * 0.3; b.z -= Math.sin(b.ry) * 0.3; } put(K, i, b.x, T.heightAt(b.x, b.z) + 0.1, b.z, b.ry, 0, 0.9); }
      else { const a = f.ang + i * 0.52, r = 16 + b.off[0]; const x = f.cx + Math.cos(a) * r, z = f.cz + Math.sin(a) * r; put(K, i, x, T.heightAt(f.cx, f.cz) + f.h + b.off[1] + 2, z, -a - Math.PI / 2 + Math.PI, 0, 1.1); }
    });
    K.im.instanceMatrix.needsUpdate = true;
    const Hk = this.kinds.hawk; Hk.list.forEach((h, i) => put(Hk, i, h.cx + Math.cos(h.a) * h.r, h.y, h.cz + Math.sin(h.a) * h.r, -h.a, 0.25, 1.6)); Hk.im.instanceMatrix.needsUpdate = true;
    const D = this.kinds.duck; D.list.forEach((a, i) => put(D, i, a.x, 0.02 + Math.sin(t * 2 + i) * 0.02, a.z, a.ry)); D.im.instanceMatrix.needsUpdate = true;
    const Fi = this.kinds.fish, F = this.fish;
    if (F.on) { put(Fi, 0, F.x + Math.cos(F.ry) * F.u * 0.9, Math.sin(F.u * Math.PI) * 0.75 - 0.1, F.z - Math.sin(F.ry) * F.u * 0.9, F.ry, (0.5 - F.u) * 2.2); Fi.im.count = 1; } else Fi.im.count = 0;
    Fi.im.instanceMatrix.needsUpdate = true;
  }
}
