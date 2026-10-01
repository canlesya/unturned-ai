import * as THREE from 'three';
import { rand } from './util.js';

// Görsel efektler: iz mermisi, vuruş kıvılcımı/kan, mermi izi (decal), patlama, namlu alevi.
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const mats = {};
const bm = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  return (mats[k] ||= new THREE.MeshBasicMaterial({ color, ...o }));
};

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.parts = [];
    this.decals = [];
    this.flashes = [];
    this.explosions = [];
    this.shake = 0;
    this.boom = new THREE.PointLight('#ff9a3c', 0, 40, 2);
    this.boom.userData = { life: 0, max: 0.35, peak: 80 };
    scene.add(this.boom);
    this._decalGeo = new THREE.PlaneGeometry(0.2, 0.2);
    this._decalMat = new THREE.MeshBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this._scorchMat = new THREE.MeshBasicMaterial({ color: '#0d0d0d', transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this._tracerMat = new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this._tracerMats = {};
    this.slashes = [];
    this._slashGeo = new THREE.RingGeometry(0.62, 1, 18, 1, -0.95, 1.9);   // yay şeklinde şerit (bıçak izi)
    this._slashGeo.translate(-0.81, 0, 0);                                    // yayın ortası merkezden geçsin
  }

  // Bıçak vuruş izi: gözün önünde, savurma eğimine göre yatık yay şeridi
  slash(origin, dir, kind, reach, team) {
    const col = kind === 'stab' ? '#ffffff' : '#dfeeff';
    const m = new THREE.Mesh(this._slashGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const r = kind === 'stab' ? 0.3 : reach * 0.62;
    m.position.copy(origin).addScaledVector(dir, reach * 0.7);
    m.lookAt(origin);                                                    // düzlem normali gözlemciye bakar
    const roll = { rl: 0.75, lr: -0.75, chop: 1.57, diag: 0.5, stab: 0 }[kind] ?? 0;
    m.rotateZ(roll + (kind === 'stab' ? 0 : 0));
    const flip = kind === 'lr' ? -1 : 1;
    m.scale.set(kind === 'stab' ? r * 0.35 : r * flip, kind === 'stab' ? r * 2.2 : r, 1);
    m.userData = { life: 0.16, max: 0.16, own: true, slash: true };
    this.scene.add(m);
    this.slashes.push(m);
  }

  // color: iz mermisi rengi (silaha göre); verilmezse sarı
  tracer(from, to, color = null) {
    const len = from.distanceTo(to);
    if (len < 1) return;
    const m = new THREE.Mesh(boxGeo, color ? this._tracerMats[color] ||= new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }) : this._tracerMat);
    m.position.copy(from).lerp(to, 0.5);
    const w = 0.014 + Math.min(len, 150) * 0.00035;
    m.scale.set(w, w, len);
    m.lookAt(to);
    m.userData.life = 0.07;
    this.scene.add(m);
    this.tracers.push(m);
  }

  spark(p, n, normal, color = '#ffd27a', speed = 4) {
    for (let i = 0; i < n; i++) this._part(p, color, rand(0.02, 0.05), normal, speed, 0.35 + Math.random() * 0.25, 9);
  }

  blood(p, n = 8, normal) {
    for (let i = 0; i < n; i++) this._part(p, '#b3170f', rand(0.03, 0.07), normal, 3, 0.6 + Math.random() * 0.4, 12);
  }

  dust(p, normal) {
    for (let i = 0; i < 3; i++) this._part(p, '#b7a98a', rand(0.05, 0.1), normal, 1.6, 0.5, 2);
  }

  _part(p, color, size, normal, speed, life, grav) {
    const m = new THREE.Mesh(boxGeo, bm(color));
    m.scale.setScalar(size);
    m.position.copy(p);
    const v = new THREE.Vector3(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).multiplyScalar(speed * 0.5);
    if (normal) v.addScaledVector(normal, speed * rand(0.4, 1));
    m.userData = { v, life, max: life, grav };
    this.scene.add(m);
    this.parts.push(m);
    if (this.parts.length > 260) this._remove(this.parts, 0);
  }

  decal(p, n, big = false) {
    const m = new THREE.Mesh(this._decalGeo, big ? this._scorchMat : this._decalMat);
    m.position.copy(p).addScaledVector(n, 0.012);
    m.lookAt(p.clone().add(n));
    m.rotateZ(Math.random() * 6);
    if (big) m.scale.setScalar(rand(14, 20));
    m.userData.life = big ? 40 : 18;
    this.scene.add(m);
    this.decals.push(m);
    if (this.decals.length > 160) this._remove(this.decals, 0);
  }

  muzzle(pos, dirObj) {
    const m = new THREE.Mesh(boxGeo, bm('#ffd36a', { transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.scale.set(0.12, 0.12, 0.2);
    m.position.copy(pos);
    if (dirObj) m.lookAt(pos.clone().add(dirObj));
    m.userData.life = 0.045;
    this.scene.add(m);
    this.flashes.push(m);
  }

  // flaşbang patlaması: kısa, parlak beyaz küre + kıvılcım
  flashBurst(p) {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.copy(p);
    core.userData = { life: 0.25, max: 0.25, r: 3.2, own: true };
    this.scene.add(core);
    this.explosions.push(core);
    for (let i = 0; i < 14; i++) this._part(p, '#fff6d0', rand(0.05, 0.1), null, 7, rand(0.2, 0.5), 3);
  }

  explosion(p, radius = 6) {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.copy(p);
    core.userData = { life: 0.45, max: 0.45, r: radius * 0.55, own: true };
    this.scene.add(core);
    this.explosions.push(core);
    this.boom.position.copy(p); this.boom.position.y += 1.2;
    this.boom.userData.life = this.boom.userData.max;
    for (let i = 0; i < 26; i++) this._part(p, i % 3 ? '#ff8a2a' : '#ffd27a', rand(0.08, 0.2), null, 9, rand(0.4, 0.9), 6);
    for (let i = 0; i < 18; i++) this._part(p, i % 2 ? '#4a4a4a' : '#6b6b6b', rand(0.2, 0.45), null, 4, rand(0.8, 1.6), -1.5);
    for (let i = 0; i < 10; i++) this._part(p, '#6b5a40', rand(0.08, 0.16), null, 11, rand(0.6, 1.1), 14);
    this.shake = Math.max(this.shake, 0.6);
  }

  _remove(arr, i) {
    const m = arr[i];
    this.scene.remove(m);
    if (m.userData.own) { m.geometry.dispose(); m.material.dispose(); }
    arr.splice(i, 1);
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) { const m = this.tracers[i]; if ((m.userData.life -= dt) <= 0) this._remove(this.tracers, i); }
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const m = this.slashes[i], u = m.userData;
      if ((u.life -= dt) <= 0) { this.scene.remove(m); m.material.dispose(); this.slashes.splice(i, 1); continue; }
      m.material.opacity = 0.85 * (u.life / u.max);
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) { const m = this.flashes[i]; if ((m.userData.life -= dt) <= 0) this._remove(this.flashes, i); }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const m = this.decals[i];
      if ((m.userData.life -= dt) <= 0) this._remove(this.decals, i);
    }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const m = this.parts[i], u = m.userData;
      if ((u.life -= dt) <= 0) { this._remove(this.parts, i); continue; }
      u.v.y -= u.grav * dt;
      m.position.addScaledVector(u.v, dt);
      if (m.position.y < 0.02) { m.position.y = 0.02; u.v.multiplyScalar(0.3); u.v.y = 0; }
      m.scale.multiplyScalar(1 - dt * 0.6);
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const m = this.explosions[i], u = m.userData;
      u.life -= dt;
      if (u.life <= 0) { this._remove(this.explosions, i); continue; }
      const t = 1 - u.life / u.max;
      m.scale.setScalar(u.r * (0.3 + t * 0.9));
      m.material.opacity = 0.95 * (1 - t);
    }
    const bl = this.boom;
    bl.userData.life = Math.max(0, bl.userData.life - dt);
    bl.intensity = bl.userData.peak * (bl.userData.life / bl.userData.max);
    this.shake = Math.max(0, this.shake - dt * 1.8);
  }
}
