import * as THREE from 'three';
import { createJeep, JEEP_MATS } from '../models/jeep.js';
import { createTank, setTracks } from '../models/tank.js';
import { createHeli, HELI_MATS } from '../models/heli.js';
import { toWorld, gunPose, groundAt } from '../sim/vehicle.js';
import { SIM_DT } from '../net/protocol.js';
import { waterYAt } from '../sim/swim.js';
import { SEAT_DROP } from './vehicles.js';
import { createMoto } from '../models/moto.js';                     // 12.204 arazi motosikleti
import { MOTO_FX, motoFrame } from './motorbike.js';

// ───── Araç görünümü (12.177; yalnız tarayıcı) ─────
// Model (takım rengine göre şablon kopyası), görsel süspansiyon (dikey ivme + eğim / yatış gecikmesi: yaylı gövde), teker dönüşü + ön teker
// direksiyonu, direksiyon simidi + hız ibresi, 1. şahıs sürücü elleri; farlar (gece / gün batımında SABİT 2 SpotLight havuzu en yakın yanan
// araçlara + her farda ucuz hüzme konisi + parıltı noktası; 12.159 fener havuzu gibi: ışık sayısı maç boyu sabit → gölgelendirici yeniden derlenmez),
// stop lambaları; egzoz, toz (toprak / çimende hızla), su sıçraması (sığ geçit), hasar dumanı (%50 altı), yanma (alev + kara duman), enkaz (kömürleşmiş
// gövde + duman). Parçacıklar tek çizimli nokta bulutları (normal + toplamalı). Ses: motor (devir = hız / vites, yük = gaz) en yakın 3 araçta,
// korna (iki tonlu) — sentez, sfx kanalı. Kamera: vehCamera (sürücü içeriden / takip; V).
const MAXP = 700;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _p = { x: 0, y: 0, z: 0 }, _h = {};
const _rp = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rq2 = new THREE.Quaternion(), _ry = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
const CHAR = new THREE.MeshStandardMaterial({ color: '#1f1c1a', flatShading: true, roughness: 0.95 });
// türe göre efekt noktaları (yerel f, r, u): farlar, egzoz [f, r, u, yukarı mı], toz (palet / arka teker), hasar dumanı (motor), motor sesi [taban Hz, devir aralığı]
const FXP = {
  jip: { lights: [[2.02, -0.5, 0.86], [2.02, 0.5, 0.86]], exh: [[-2.0, -0.55, 0.38, 0]], dust: [[-1.2, -0.81], [-1.2, 0.81]], hood: [1.35, 0, 1.05], eng: [34, 70], vol: 0.32, inVol: 0.16 },
  heli: { lights: [[2.62, 0, 0.75]], exh: [[-1.95, -0.55, 2.95, 1], [-1.95, 0.55, 2.95, 1]], dust: [], hood: [-0.6, 0, 3.0], eng: [7, 13], vol: 0.7, inVol: 0.28, rotor: true },
  tank: { lights: [[3.02, -1.3, 1.55], [3.02, 1.3, 1.55]], exh: [[-3.25, -1.0, 1.62, 1], [-3.25, 1.0, 1.62, 1]], dust: [[-2.8, -1.42], [-2.8, 1.42], [2.5, -1.42], [2.5, 1.42]], hood: [-1.8, 0, 1.85], eng: [19, 36], vol: 0.5, inVol: 0.2, clank: true },
  moto: MOTO_FX,                                                       // 12.204 (game/motorbike.js): tek far, sağ egzoz, arka teker tozu, tiz motor
};

class Puffs {
  constructor(scene, additive) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAXP * 3); this.col = new Float32Array(MAXP * 3); this.al = new Float32Array(MAXP); this.sz = new Float32Array(MAXP);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.al, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float alpha; attribute float size; varying float vA; varying vec3 vC;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * uScale / max(0.3, -mv.z), 1.0, 380.0); gl_Position = projectionMatrix * mv; }`.replace('void main', 'uniform float uScale; void main'),
      fragmentShader: `varying float vA; varying vec3 vC;
        void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard; float a = vA * smoothstep(0.5, ${additive ? '0.0' : '0.18'}, d); gl_FragColor = vec4(vC, a); }`,
      vertexColors: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 7 : 6;
    scene.add(this.pts);
    this.list = []; this.fixed = [];
  }
  // tek karelik sabit nokta (far parıltısı): bu karenin update'inde çizilir, sonra silinir
  still(x, y, z, size, r, g, b, a) { if (this.fixed.length < 64) this.fixed.push([x, y, z, size, r, g, b, a]); }
  emit(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a0, grav = 0, drag = 0.6) {
    if (this.list.length >= MAXP - 64) this.list.shift();
    this.list.push({ x, y, z, vx, vy, vz, t: 0, life, s0, s1, r, g, b, a0, grav, drag });
  }
  update(dt, scale) {
    this.mat.uniforms.uScale.value = scale;
    const L = this.list; let n = 0;
    for (const f of this.fixed) { this.pos[n * 3] = f[0]; this.pos[n * 3 + 1] = f[1]; this.pos[n * 3 + 2] = f[2]; this.col[n * 3] = f[4]; this.col[n * 3 + 1] = f[5]; this.col[n * 3 + 2] = f[6]; this.al[n] = f[7]; this.sz[n] = f[3]; n++; }
    const nf = n; this.fixed.length = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.t += dt;
      if (p.t >= p.life) continue;
      const k = Math.exp(-p.drag * dt); p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const u = p.t / p.life;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 3] = p.r; this.col[n * 3 + 1] = p.g; this.col[n * 3 + 2] = p.b;
      this.al[n] = p.a0 * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85); this.sz[n] = p.s0 + (p.s1 - p.s0) * u;
      L[n - nf] = p; n++;
    }
    L.length = n - nf;
    const g = this.pts.geometry; g.setDrawRange(0, n);
    for (const k of ['position', 'color', 'alpha', 'size']) { const a = g.attributes[k]; a.needsUpdate = true; a.clearUpdateRanges?.(); }
  }
  dispose() { this.pts.removeFromParent(); this.pts.geometry.dispose(); this.mat.dispose(); }
}

function beamGeo() { const g = new THREE.ConeGeometry(1, 1, 16, 1, true); g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2); return g; }
const beamMat = (op) => new THREE.ShaderMaterial({
  uniforms: { uOp: { value: op } },
  vertexShader: `varying float vA; varying vec3 vN; varying vec3 vV; void main(){ vA = position.z; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uOp; varying float vA; varying vec3 vN; varying vec3 vV; void main(){ float e = abs(dot(normalize(vN), normalize(vV))); float a = uOp * pow(1.0 - clamp(vA, 0.0, 1.0), 1.7) * smoothstep(0.05, 0.7, e) * smoothstep(0.0, 0.05, vA); gl_FragColor = vec4(1.0, 0.95, 0.82, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});

export class VehicleView {
  constructor(game) {
    this.g = game; this.V = game.vehicles;
    this.group = new THREE.Group(); this.group.name = 'araçlar'; game.scene.add(this.group);
    this.items = this.V.list.map((v) => ({ v, model: null, team: undefined, sy: 0, svy: 0, sp: 0, svp: 0, sr: 0, svr: 0, lvy: 0, lyaw: null, roll: 0, exT: 0, duT: 0, smT: 0, fiT: 0, spT: 0, charred: false }));
    this.smoke = new Puffs(game.scene, false); this.glow = new Puffs(game.scene, true);
    this.night = game.night || game.tod === 'sunset';
    this.lights = [];
    if (this.night) {                                                  // sabit havuz (ön ısıtmadan önce kurulur; sayısı hiç değişmez)
      for (let i = 0; i < 2; i++) { const l = new THREE.SpotLight('#fff1d2', 0, 55, 0.55, 0.55, 1.2); l.castShadow = false; game.scene.add(l, l.target); this.lights.push(l); }
      const geo = beamGeo();
      this.beamMat = beamMat(game.night ? 0.12 : 0.05); this.beamGeo = geo;
    }
    this.voices = []; this.horns = [];
    this.t = 0;
    game.on('vehboom', ({ v, quiet }) => { const it = this.items[v.idx]; if (it && !quiet) it.boomT = 1; if (quiet) this.sink(v); });
    game.on('vehfire', (sh) => this.cannonFx(sh));                    // 12.178 tank topu: namlu alevi, duman halkası, geri tepme, ses
  }

  // gösterilecek durum: tahmin edilen (kendi sürdüğüm) araç iki sim adımı arasında ara değerlenir + düzeltme yumuşatması
  pose(v) {
    const st = v.st, g = this.g;
    if (!v.pred || !g.online || !v.p0) return st;
    const a = Math.max(0, Math.min(1, (g._acc || 0) / SIM_DT)), p = v.p0, vo = g.online.viewOff, o = (this._ps ||= {});
    const la = (x, y) => x + (((y - x + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * a;
    o.x = p.x + (st.x - p.x) * a + vo.x; o.y = p.y + (st.y - p.y) * a + vo.y; o.z = p.z + (st.z - p.z) * a + vo.z;
    o.yaw = la(p.yaw, st.yaw); o.pitch = p.pitch + (st.pitch - p.pitch) * a; o.roll = p.roll + (st.roll - p.roll) * a;
    o.vx = st.vx; o.vy = st.vy; o.vz = st.vz; o.steer = st.steer; o.thr = st.thr; o.air = st.air; o.def = st.def; o.tyaw = st.tyaw; o.gp = st.gp; o.brk = st.brk;
    o.rpm = st.rpm; o.sunk = st.sunk; o.fall = st.fall; o.fallK = st.fallK;      // 12.204 motor devrik durumu              // 12.183: rotor devri de (yoksa çevrim içi pilotun kendi helikopterinde rotor / rotor sesi / rüzgârı 0'da kalıyordu)
    return o;
  }

  // 12.209 ÇİZİLEN zemin kenedi (her mesafe, her durum: yerde / havada / çevrim içi ara değerleme): modelin o karedeki (konum + eğim + yatış +
  // görsel süspansiyon + motor yatışı) teker temas noktaları ve gövde altı, çizilen zeminin altına inmesin. Çizilen zemin = arazi ağının o anki
  // kademesi (TerrainMesh.renderedHeightAt; uzak kademede yol yarması / çukur kabaca dolar, fiziğin 18 m'ye dek üstüne çıkar) ya da tekerin
  // bastığı kutu tepesi (köprü / bordür: fizikle aynı ağ). En çok gömülen nokta kadar model kaldırılır. 12.200 lodLift'in yerine: o yalnız
  // ayak izinin arazi farkına bakıyordu (fiziğe göre), 150 m'den yakında / havada / zeminden 0,6 m yukarıda hiç çalışmıyordu, 2,5 m'de
  // kırpılıyordu ve kademe bir kare geriden geliyordu → uzak motor / jip yarmada 3–5 m, sıçrayan motor 0,9 m arazinin içinde görünüyordu.
  // Yalnız görünüm (fizik / ağ / vuruş kutusu değişmez). Uçan helikopter, batan / suya gömülen araç hariç.
  groundLift(it, v, st, d, m) {
    if ((d.heli && st.air) || it.sinkT || st.sunk) return 0;
    const W = this.g.world, tm = this.g.map.fx?.tm, R = tm?.renderedHeightAt ? (x, z) => tm.renderedHeightAt(x, z) : (x, z) => W.heightAt(x, z);
    const up = d.stepUp ?? 0.55, M = (m.updateMatrix(), m.matrix), tr = d.moto ? 0 : d.tr / 2, hf = d.wb / 2;
    let sink = -1e9;
    const F = d.tracked ? [hf, hf / 2, 0, -hf / 2, -hf] : [hf, -hf];
    for (const f of F) for (const r of tr ? [-tr, tr] : [0]) {                         // teker / palet / kızak temas noktası (yerel u = 0)
      _w.set(r, 0, -f).applyMatrix4(M);
      const h = W.heightAt(_w.x, _w.z), gp = groundAt(W, _w.x, _w.z, _w.y + 0.05, up), gy = gp > h + 0.01 ? gp : R(_w.x, _w.z);
      if (gy - _w.y > sink) sink = gy - _w.y;
    }
    const hr = d.moto ? [0] : [-d.hw * 0.9, 0, d.hw * 0.9];                            // gövde altı (motor yatar: yalnız orta hat)
    for (const f of [-d.hl * 0.9, 0, d.hl * 0.9]) for (const r of hr) {
      _w.set(r, d.clear, -f).applyMatrix4(M);
      const gy = R(_w.x, _w.z);
      if (gy - _w.y > sink) sink = gy - _w.y;
    }
    return Math.max(0, Math.min(25, sink - (v.alive ? 0 : 0.14)));                     // enkaz bilerek 0,12 m oturur
  }

  ensure(it) {
    const v = it.v, want = v.st && (v.alive || v.wreck);
    if (!want) { if (it.model) it.model.visible = false; return false; }
    const team = v.paint || null;
    if (!it.model || it.team !== team) {
      if (it.model) this.group.remove(it.model);
      const m = v.def.heli ? createHeli(team) : v.type === 'tank' ? createTank(team) : v.def.moto ? createMoto(team) : createJeep(team);
      if (m.userData.blur) { m.userData.blur.material = HELI_MATS.BLUR.clone(); m.userData.blur.userData.beam = true; }      // rotor bulanıklığı araç başına (kömürleşmez)
      const lens = JEEP_MATS.LENS.clone(), tail = JEEP_MATS.TAIL.clone();              // farlar araç başına (açık / kapalı)
      m.userData.fx.traverse((o) => { if (o.material === JEEP_MATS.LENS) o.material = lens; else if (o.material === JEEP_MATS.TAIL) o.material = tail; });
      m.userData.lens = lens; m.userData.tail = tail;
      if (this.beamMat) {
        const beams = [];
        for (const L of FXP[fxk(v)].lights) { const b = new THREE.Mesh(this.beamGeo, this.beamMat); b.position.set(L[1], L[2], -L[0]); b.rotation.y = Math.PI; b.rotation.x = 0.08; b.scale.set(2.4, 1.4, 14); b.frustumCulled = false; b.renderOrder = 5; b.visible = false; b.userData.beam = true; m.add(b); beams.push(b); }
        m.userData.beams = beams;
      }
      this.group.add(m);
      it.model = m; it.team = team; it.charred = false; it.sy = it.sp = it.sr = 0;
    }
    it.model.visible = true;
    return true;
  }

  // 12.192 koltuktakiler aracın ÇİZİLEN gövdesine oturur (her karede, aracın modeli konduktan sonra): konum = gövde yerelinde koltuk − oturma payı,
  // dönüş = gövdenin dünya dönüşü (eğim / yatış / görsel süspansiyon dahil) · koltuk yaw'ı. Eskiden kök dünya dikeyinde 0,78 m aşağıda + ham sim
  // durumuyla dönüyordu → eğik helikopterde (ileri uçuşta burun −0,28 rad, virajda yatış) asker gövdeye göre 0,15–0,25 m kayıyor, gövdeden / kapıdan
  // taşıyor, uzaktaki yolcu sallanıyordu
  seatRiders(it, v) {
    if (!v.alive || !v.st) return;
    const d = v.def, B = it.model.userData.body || it.model;
    let upd = false;
    for (let i = 0; i < v.seats.length; i++) {
      const s = v.seats[i], r = s?.model?.root;
      if (!s || !s.alive || s.veh !== v || !r || !r.visible || !r.parent) continue;
      if (!upd) { it.model.updateMatrixWorld(true); upd = true; }
      const sp = d.seat[i];
      _rp.set(sp[1], sp[2] - SEAT_DROP - 0.28 + (s.model.groundOffset ?? 0), -sp[0]); B.localToWorld(_rp); r.parent.worldToLocal(_rp);
      r.position.copy(_rp);
      B.getWorldQuaternion(_rq); _ry.setFromAxisAngle(_up, s._seatRel || 0); r.quaternion.copy(_rq).multiply(_ry);
      r.quaternion.premultiply(r.parent.getWorldQuaternion(_rq2).invert());          // kökün ebeveyni sahne (birim) — değilse onun dönüşü düşülür
    }
  }

  setCharred(it, on) {
    if (it.charred === on) return;
    it.charred = on;
    it.model.traverse((o) => { if (!o.isMesh || o.userData.beam || o.isInstancedMesh) return; if (on) { o.userData.m0 = o.material; if (o.material !== JEEP_MATS.GLASS) o.material = CHAR; else o.visible = false; } else if (o.userData.m0) { o.material = o.userData.m0; o.visible = true; } });
  }

  sink(v) { const it = this.items[v.idx]; if (it) it.sinkT = 0.001; }

  frame(dt) {
    const g = this.g, cam = g.camera, me = g.playerSoldier, P = g.player;
    this.t += dt;
    const scale = (g.renderer?.domElement.height || innerHeight) / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const lit = [];
    for (const it of this.items) {
      const v = it.v;
      if (!this.ensure(it)) continue;
      const m = it.model, U = m.userData, st = this.pose(v), d = v.def;
      const far = cam.position.distanceTo(_v.set(st.x, st.y, st.z));
      // görsel süspansiyon: dikey hız değişimine (ivme) ve eğim / yatış değişimine yay-sönüm
      const ay = (st.vy - it.lvy) / Math.max(dt, 1e-3); it.lvy = st.vy;
      const sp = Math.hypot(st.vx, st.vz), fwd = st.vx * -Math.sin(st.yaw) + st.vz * -Math.cos(st.yaw);
      const yr = it.lyaw == null ? 0 : (((st.yaw - it.lyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / Math.max(dt, 1e-3); it.lyaw = st.yaw;
      const accF = (fwd - (it.lf ?? fwd)) / Math.max(dt, 1e-3); it.lf = fwd;
      if (dt > 0) {
        const K = 90, C = 11;
        it.svy += (-K * it.sy - C * it.svy - Math.max(-30, Math.min(30, ay)) * 0.06) * dt; it.sy += it.svy * dt;
        it.svp += (-K * it.sp - C * it.svp + Math.max(-25, Math.min(25, accF)) * 0.004) * dt; it.sp += it.svp * dt;
        it.svr += (-K * it.sr - C * it.svr + Math.max(-30, Math.min(30, yr * fwd)) * 0.0022) * dt; it.sr += it.svr * dt;
        it.sy = Math.max(-0.12, Math.min(0.12, it.sy)); it.sp = Math.max(-0.07, Math.min(0.07, it.sp)); it.sr = Math.max(-0.07, Math.min(0.07, it.sr));
      }
      m.position.set(st.x, st.y + (v.alive ? it.sy * 0.6 : -0.12), st.z);
      m.rotation.order = 'YXZ';
      m.rotation.set(st.pitch + (v.alive ? it.sp : 0.03), st.yaw, st.roll + (v.alive ? it.sr : -0.04));
      if (it.sinkT) { it.sinkT += dt; m.position.y -= Math.min(1.5, it.sinkT * 0.35); if (!v.alive && !v.wreck) it.sinkT = 0; }
      U.body.position.y = v.alive ? it.sy * 0.4 : 0;
      const mine = me && me.veh === v && me.alive;
      if (U.heli) {
        // 12.179 rotorlar (devirle), bulanıklık diski, kapı makineleri (nişancının bakışı; yay içinde), rotor rüzgârı (alçakta toz / su)
        const rpm = st.rpm || 0;
        U.rotor.rotation.y += rpm * 26 * dt; U.tailRotor.rotation.x += rpm * 48 * dt;
        U.blur.material.opacity = Math.max(0, rpm - 0.45) * 0.3; U.blur.visible = rpm > 0.45;
        const M = v.def.mg;
        U.doors.forEach((dg, i) => {
          const seat = M.seats[i], side = M.arc[seat], gn = v.seats[seat], rest = -side * Math.PI / 2;
          let rel = gn ? ((gn.yaw - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI : rest;
          const dd = ((rel - rest + Math.PI * 3) % (Math.PI * 2)) - Math.PI; rel = rest + Math.max(-M.arcW, Math.min(M.arcW, dd));
          dg.rotation.y = rel; U.doorGuns[i].rotation.x = gn ? Math.max(M.elev[0], Math.min(M.elev[1], gn.pitch)) : -0.2;
        });
        if (v.alive && rpm > 0.5 && far < 160) this.wash(it, v, st, rpm, dt);
      } else if (U.tank) {
        // 12.178 kule / top / nişancı halkası; paletler (sol / sağ hız: ileri ± dönüş · yarım iz) + yol tekerleri; top geri tepmesi
        U.turret.rotation.y = ((st.tyaw - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        it.rec = Math.max(0, (it.rec || 0) - dt * 2.2);
        U.gun.rotation.x = st.gp; U.gun.position.z = -1.35 + Math.sin(Math.min(1, it.rec) * Math.PI) * 0.35;
        const gn = v.def.mg ? v.seats[v.def.mg.seats[0]] : null;      // 12.188: eski "mg.seat" (yok) → halka nişancıyı hiç izlemiyordu
        U.ring.rotation.y = gn ? ((gn.yaw - st.tyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI : 0;
        U.mg.rotation.x = gn ? Math.max(-0.3, Math.min(0.6, gn.pitch)) : 0;
        if (v.alive) { const w = yr * 1.3; it.sL = (it.sL || 0) + (fwd - w) * dt; it.sR = (it.sR || 0) + (fwd + w) * dt; }
        if (far < 90 && v.alive) setTracks(m, it.sL || 0, it.sR || 0);
        U.links.visible = U.rw.visible = far < 260;
      } else if (U.moto) motoFrame(it, v, st, dt, fwd, yr, far);      // 12.204 motor: yatma / devrilme / teker / çatal
      else {
        // tekerler: dönüş (ileri hız / yarıçap), ön tekerler direksiyon
        it.spin = ((it.spin || 0) + (v.alive ? fwd : 0) * dt / 0.4) % (Math.PI * 2);
        for (const w of U.wheels) { w.w.rotation.x = -it.spin; w.piv.rotation.y = w.front ? st.steer * 1.0 : 0; w.piv.position.y = 0.4 - (v.alive ? it.sy * 0.5 : 0.08); }
        const near = far < 70; U.steer.visible = near; U.needle.visible = near; if (U.glass) U.glass.visible = near && !it.charred;      // uzakta iç ayrıntı çizilmez
        U.steer.rotation.z = -st.steer * 2.2;
        U.needle.rotation.z = -Math.min(1, Math.abs(fwd) / d.maxF) * 2.4 + 1.2;
        const fp = mine && me.seat === 0 && P && P._vcam === 'first';
        U.hands.visible = !!fp;
        if (U.jmg && d.mg) {                                             // 12.188 jip makinelisi: nişancının bakışıyla 360° (yoksa ileri), yükseliş sınırlı
          const gn = v.seats[d.mg.seats[0]];
          U.jmg.rotation.y = gn ? ((gn.yaw - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI : 0;
          U.jgun.rotation.x = gn ? Math.max(d.mg.elev[0], Math.min(d.mg.elev[1], gn.pitch)) : -0.05;
        }
      }
      m.position.y += it.lift = this.groundLift(it, v, st, d, m);      // 12.209 çizilen zeminin üstünde (motor yatışı / süspansiyon dahil)
      this.seatRiders(it, v);
      this.setCharred(it, !v.alive && v.wreck);
      // ışıklar
      const on = v.alive && v.lights, br = v.alive && (st.thr < -0.05 && fwd > 0.5 || v.st.brk);
      U.lens.emissiveIntensity = on ? (g.night ? 3.2 : 1.6) : 0.05;
      U.tail.emissiveIntensity = !v.alive ? 0 : br ? 2.4 : on ? 0.9 : 0.1;
      if (U.beams) for (const b of U.beams) b.visible = on && far < 260;
      if (on) lit.push({ it, st, far });
      // efektler
      if (far < 220) this.fx(it, v, st, sp, fwd, dt, far);
    }
    // gece: en yakın yanan farlara gerçek ışık
    if (this.lights.length) {
      lit.sort((a, b) => a.far - b.far);
      this.lights.forEach((l, i) => {
        const o = lit[i];
        if (!o || o.far > 180) { l.intensity = 0; return; }
        const L0 = FXP[fxk(o.it.v)].lights[0];
        toWorld(o.st, L0[0] + 0.1, 0, L0[2], _p); l.position.set(_p.x, _p.y, _p.z);
        toWorld(o.st, L0[0] + 12, 0, -1.2, _p); l.target.position.set(_p.x, _p.y, _p.z); l.target.updateMatrixWorld();
        l.intensity = g.night ? 160 : 60;
      });
    }
    for (const o of lit) if (o.far < 400) for (const L of FXP[fxk(o.it.v)].lights) { toWorld(o.st, L[0], L[1], L[2], _p); this.glow.still(_p.x, _p.y, _p.z, g.night ? 0.9 : 0.45, 1, 0.93, 0.75, g.night ? 0.9 : 0.5); }
    // 12.178 tank mermileri: parlak çekirdek + ince duman izi
    for (const sh of this.V.shells) { this.glow.still(sh.x, sh.y, sh.z, 0.55, 1, 0.82, 0.5, 1); if (Math.random() < 0.6) this.smoke.emit(sh.x, sh.y, sh.z, 0, 0.2, 0, 0.6, 0.15, 0.5, 0.7, 0.7, 0.7, 0.25, 0, 1); }
    this.smoke.update(dt, scale); this.glow.update(dt, scale);
    this.sound(dt);
  }

  fx(it, v, st, sp, fwd, dt, far) {
    const d = v.def, T = this.g.terrain, S = this.smoke, rnd = Math.random;
    const occ = v.seats.some(Boolean) || (this.g.online && v.alive && (Math.abs(st.thr) > 0.01 || sp > 0.3));
    if (v.alive) {
      // egzoz (arka sol altı): rölantide seyrek, gazda yoğun
      const X = FXP[fxk(v)];
      if (occ && (it.exT -= dt) <= 0) { it.exT = 0.09 / (0.4 + Math.abs(st.thr)); for (const e of X.exh) { toWorld(st, e[0], e[1], e[2], _p); const k = e[3] ? 1.6 : 0.35; S.emit(_p.x, _p.y, _p.z, st.vx * 0.3 + (rnd() - 0.5) * 0.3, k, st.vz * 0.3 + (rnd() - 0.5) * 0.3, e[3] ? 1.6 : 1.1, e[3] ? 0.3 : 0.18, e[3] ? 1.3 : 0.7, 0.36, 0.36, 0.36, 0.28 + Math.abs(st.thr) * 0.2, -0.2); } }
      // toz / su: arka tekerlerden
      if (sp > (X.clank ? 1.2 : 2.5) && !st.air && (it.duT -= dt) <= 0) {
        it.duT = 0.05 + 0.25 / sp;
        for (const [df, sx] of X.dust) {
          toWorld(st, df, sx, 0.1, _p);
          const wy = waterYAt(T, _p.x, _p.z), gy = T ? T.heightAt(_p.x, _p.z) : 0, wet = wy > -1e9 && wy - gy > 0.08;
          if (wet) { for (let k = 0; k < 2; k++) S.emit(_p.x, wy + 0.05, _p.z, (rnd() - 0.5) * 2 + st.vx * 0.2, 1.6 + rnd() * 1.6, (rnd() - 0.5) * 2 + st.vz * 0.2, 0.7, 0.25, 0.8, 0.82, 0.88, 0.92, 0.55, 7, 0.2); continue; }
          const road = T?.roadAt ? T.roadAt(_p.x, _p.z) : 0;
          const a = (road ? 0.12 : 0.32 * Math.min(1, sp / 12)) * (X.clank ? 1.3 : 1), big = X.clank ? 1.5 : 1;
          S.emit(_p.x, _p.y + 0.15, _p.z, -st.vx * 0.15 + (rnd() - 0.5), 0.5 + rnd() * 0.5, -st.vz * 0.15 + (rnd() - 0.5), 1.8, 0.4 * big, 2.2 * big, 0.55, 0.49, 0.38, a, -0.1, 0.9);
        }
      }
      // hasar dumanı / yanma (kaput)
      const hp = v.hp / d.hp;
      if (hp < 0.5 && (it.smT -= dt) <= 0) { it.smT = hp < d.burnAt ? 0.05 : 0.14; toWorld(st, X.hood[0], (rnd() - 0.5) * 0.6, X.hood[2], _p); const k = hp < d.burnAt ? 0.12 : 0.38; S.emit(_p.x, _p.y, _p.z, (rnd() - 0.5) * 0.4, 1.3, (rnd() - 0.5) * 0.4, 2.4, 0.35, 2.0, k, k, k, hp < d.burnAt ? 0.6 : 0.4, -0.25, 0.4); }
      if (v.burn && (it.fiT -= dt) <= 0) { it.fiT = 0.03; toWorld(st, X.hood[0] + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.9, X.hood[2] - 0.05, _p); this.glow.emit(_p.x, _p.y, _p.z, (rnd() - 0.5) * 0.3, 1.8 + rnd(), (rnd() - 0.5) * 0.3, 0.45, 0.45, 0.1, 1, 0.45 + rnd() * 0.25, 0.12, 0.9, -1); }
    } else if (v.wreck) {
      if ((it.smT -= dt) <= 0) { it.smT = 0.07; toWorld(st, (rnd() - 0.5) * 2.5, (rnd() - 0.5) * 1.2, 1.0, _p); S.emit(_p.x, _p.y, _p.z, (rnd() - 0.5) * 0.4, 1.6, (rnd() - 0.5) * 0.4, 3.2, 0.5, 2.8, 0.1, 0.1, 0.1, 0.55, -0.25, 0.3); }
      if (v.deadT < 4 && (it.fiT -= dt) <= 0) { it.fiT = 0.04; toWorld(st, (rnd() - 0.5) * 2.6, (rnd() - 0.5) * 1.2, 0.8, _p); this.glow.emit(_p.x, _p.y, _p.z, 0, 2 + rnd(), 0, 0.5, 0.6, 0.1, 1, 0.4 + rnd() * 0.3, 0.1, 0.85, -1); }
    }
    if (it.sinkT && it.sinkT < 3 && (it.spT -= dt) <= 0) { it.spT = 0.05; S.emit(st.x + (rnd() - 0.5) * 3, Math.max(st.y, waterYAt(T, st.x, st.z)) + 0.05, st.z + (rnd() - 0.5) * 3, 0, 1.2 + rnd(), 0, 0.8, 0.3, 1, 0.85, 0.9, 0.95, 0.6, 5); }
  }

  // ── ses: motor (en yakın 3 dolu / hareketli araç) + korna ──
  sound(dt) {
    const sfx = this.g.sfx, c = sfx?.ctx;
    if (!c || !sfx.sfxBus) return;
    const L = sfx.listener.pos, me = this.g.playerSoldier;
    const cand = [];
    for (const it of this.items) {
      const v = it.v; if (!v.alive || !v.st) continue;
      const st = this.pose(v), sp = Math.hypot(st.vx, st.vz), act = v.seats.some(Boolean) || sp > 0.5 || Math.abs(st.thr) > 0.01 || st.rpm > 0.05;
      if (!act) continue;
      const d = Math.hypot(st.x - L.x, st.y - L.y, st.z - L.z);
      if (d < (v.def.heli ? 500 : 160)) cand.push({ v, st, d, sp });
    }
    cand.sort((a, b) => a.d - b.d);
    while (this.voices.length < Math.min(3, cand.length)) this.voices.push(this.mkEngine(c, sfx));
    this.voices.forEach((vo, i) => {
      const o = cand[i], t = c.currentTime;
      if (!o) { vo.g.gain.setTargetAtTime(0, t, 0.1); return; }
      const d = o.v.def, fwd = Math.abs(o.st.vx * -Math.sin(o.st.yaw) + o.st.vz * -Math.cos(o.st.yaw)), r = Math.min(1, fwd / d.maxF);
      const gear = r < 0.22 ? 0 : r < 0.48 ? 1 : r < 0.75 ? 2 : 3, g0 = [0, 0.22, 0.48, 0.75][gear], g1 = [0.22, 0.48, 0.75, 1.05][gear];
      const rpm = 0.22 + 0.78 * Math.min(1, (r - g0) / (g1 - g0)) * (0.55 + 0.45 * Math.min(1, gear / 2)), load = Math.min(1, Math.abs(o.st.thr));
      const E = FXP[fxk(o.v)], rr = E.rotor ? (o.st.rpm || 0) : rpm, f = E.eng[0] + rr * E.eng[1];      // helikopter: testere ≈ pal geçişi (≈ 20 Hz "pat-pat")
      vo.o1.frequency.setTargetAtTime(f, t, 0.05); vo.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05); vo.nf.frequency.setTargetAtTime(160 + rpm * 500, t, 0.08);
      vo.lp.frequency.setTargetAtTime(260 + rpm * 900 + load * 700, t, 0.06);
      const inside = me && me.veh === o.v;
      const gain = E.rotor ? (inside ? E.inVol : E.vol) * Math.min(1, rr * 1.2) / (1 + (o.d / 60) ** 1.4) : (inside ? E.inVol : E.vol) * (0.55 + 0.45 * load) / (1 + (o.d / 22) ** 1.5);
      if (vo.cl) vo.cl.gain.setTargetAtTime(E.clank ? Math.min(1, o.sp / 5) * 0.9 : 0, t, 0.08);      // paletli: bakla tıkırtısı
      vo.g.gain.setTargetAtTime(gain, t, 0.06);
      if (vo.pan) { const dx = o.st.x - L.x, dz = o.st.z - L.z, R = sfx.listener.right; vo.pan.pan.setTargetAtTime(o.d > 1 ? Math.max(-1, Math.min(1, (dx * R.x + dz * R.z) / o.d)) * 0.7 : 0, t, 0.05); }
    });
    // korna
    const hc = cand.filter((o) => o.v.horn).slice(0, 2);
    while (this.horns.length < hc.length) this.horns.push(this.mkHorn(c, sfx));
    this.horns.forEach((h, i) => { const o = hc[i], t = c.currentTime; h.g.gain.setTargetAtTime(o ? 0.22 / (1 + (o.d / 30) ** 1.4) : 0, t, 0.02); });
  }
  mkEngine(c, sfx) {
    const o1 = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square'; o1.frequency.value = 40; o2.frequency.value = 20;
    const n = c.createBufferSource(); n.buffer = sfx.noise; n.loop = true; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 300; nf.Q.value = 1.2; const ng = c.createGain(); ng.gain.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2; g.gain.value = 0;
    const m2 = c.createGain(); m2.gain.value = 0.55;
    o1.connect(lp); o2.connect(m2); m2.connect(lp); n.connect(nf); nf.connect(ng); ng.connect(lp); lp.connect(g);
    const cf = c.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 1100; cf.Q.value = 3; const cl = c.createGain(); cl.gain.value = 0; n.connect(cf); cf.connect(cl); cl.connect(g);
    let out = g, pan = null;
    if (c.createStereoPanner) { pan = c.createStereoPanner(); g.connect(pan); out = pan; }
    out.connect(sfx.sfxBus);
    o1.start(); o2.start(); n.start();
    return { o1, o2, n, nf, lp, g, pan, cl, nodes: [o1, o2, n, nf, ng, lp, g, m2, pan, cf, cl] };
  }
  mkHorn(c, sfx) {
    const a = c.createOscillator(), b = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
    a.type = b.type = 'square'; a.frequency.value = 392; b.frequency.value = 494; lp.type = 'lowpass'; lp.frequency.value = 1700; g.gain.value = 0;
    a.connect(lp); b.connect(lp); lp.connect(g); g.connect(sfx.sfxBus); a.start(); b.start();
    return { a, b, lp, g, nodes: [a, b, lp, g] };
  }

  // 12.179 rotor rüzgârı: helikopterin altındaki zeminde (≤ 14 m) dışa savrulan toz halkası, su üstünde serpinti
  wash(it, v, st, rpm, dt) {
    const T = this.g.terrain, gy = T ? T.heightAt(st.x, st.z) : 0, alt = st.y - gy;
    if (alt > 14 || (it.waT = (it.waT || 0) - dt) > 0) return;
    it.waT = 0.05;
    const wy = waterYAt(T, st.x, st.z), wet = wy > -1e9 && wy > gy, k = (1 - alt / 14) * rpm, y0 = wet ? wy : gy;
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 3, vx = Math.cos(a), vz = Math.sin(a);
      if (wet) this.smoke.emit(st.x + vx * r, y0 + 0.1, st.z + vz * r, vx * 7 * k, 1.2, vz * 7 * k, 0.9, 0.3, 1.6, 0.85, 0.9, 0.95, 0.45 * k, 2, 1.2);
      else this.smoke.emit(st.x + vx * r, y0 + 0.2, st.z + vz * r, vx * 8 * k, 0.6, vz * 8 * k, 1.6, 0.5, 2.6, 0.58, 0.52, 0.42, 0.32 * k, -0.1, 1.1);
    }
  }

  // 12.178 tank topu ateşi (her istemcide 'ts' / çevrimdışı fireCannon): namlu alevi + duman halkası + yer tozu + geri tepme + kamera sarsıntısı + ses
  cannonFx(sh) {
    const g = this.g, v = sh.v, it = this.items[v.idx], st = v.st;
    if (!st) return;
    if (sh.w) {                                                          // 12.188 helikopter roketi: kapsül ağzında alev + geri püskürme dumanı + "fışş" sesi
      const sp = Math.hypot(sh.vx, sh.vy, sh.vz) || 1, dx = sh.vx / sp, dy = sh.vy / sp, dz = sh.vz / sp;
      for (let i = 0; i < 5; i++) this.glow.emit(sh.x, sh.y, sh.z, dx * 4 + (Math.random() - 0.5), dy * 4, dz * 4 + (Math.random() - 0.5), 0.12, 0.9, 0.25, 1, 0.7, 0.3, 1, 0, 4);
      for (let i = 0; i < 6; i++) this.smoke.emit(sh.x - dx * 1.2, sh.y - dy * 1.2, sh.z - dz * 1.2, -dx * 6 + (Math.random() - 0.5) * 2, -dy * 6 + 0.3, -dz * 6 + (Math.random() - 0.5) * 2, 1.2, 0.4, 1.6, 0.7, 0.68, 0.64, 0.45, -0.1, 1.2);
      const sfx = g.sfx, P = new THREE.Vector3(sh.x, sh.y, sh.z), dc = P.distanceTo(g.camera.position);
      if (sfx?.ctx && sfx._voice) { const vv = sfx._voice(dc < 3 ? null : P, 1, { ref: 45, rv: 0.4 }); if (vv.gain > 0.003) { sfx._noise({ v: vv, gain: 0.7, dur: 0.45, f0: 3500, f1: 900, type: 'bandpass', q: 0.7, att: 0.005 }); sfx._tone({ v: vv, gain: 0.35, dur: 0.25, f0: 140, f1: 60, att: 0.004 }); } else for (const x of vv.nodes) x.disconnect(); }
      return;
    }
    if (it) { it.rec = 1; it.svp -= 0.9; }
    const o = { x: 0, y: 0, z: 0 }, d = { x: 0, y: 0, z: 0 }; gunPose(st, o, d);
    for (let i = 0; i < 10; i++) this.glow.emit(o.x + d.x * 0.6, o.y + d.y * 0.6, o.z + d.z * 0.6, d.x * (6 + Math.random() * 8) + (Math.random() - 0.5) * 2, d.y * 8 + (Math.random() - 0.5) * 2, d.z * (6 + Math.random() * 8) + (Math.random() - 0.5) * 2, 0.16, 1.2, 0.3, 1, 0.75, 0.35, 1, 0, 4);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; this.smoke.emit(o.x, o.y, o.z, d.x * 3 + Math.cos(a) * 2.2, d.y * 3 + Math.sin(a) * 1.5 + 0.4, d.z * 3 + Math.sin(a) * 2.2, 2.4, 0.6, 3.2, 0.62, 0.6, 0.56, 0.5, -0.1, 1.2); }
    for (let i = 0; i < 8; i++) this.smoke.emit(st.x + (Math.random() - 0.5) * 5, st.y + 0.3, st.z + (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3, 0.6, (Math.random() - 0.5) * 3, 1.6, 0.6, 2.4, 0.55, 0.49, 0.38, 0.35, -0.1, 1);
    const dc = Math.hypot(o.x - g.camera.position.x, o.y - g.camera.position.y, o.z - g.camera.position.z);
    g.effects.boomShake?.(o, 0.45, 22);      // 12.199d tank topu ağız patlaması
    const sfx = g.sfx;
    if (sfx?.ctx && sfx._voice) {
      const P = new THREE.Vector3(o.x, o.y, o.z), vv = sfx._voice(dc < 2.5 ? null : P, 1, { ref: 60, rv: 0.6 });
      if (vv.gain > 0.003) {
        sfx._noise({ v: vv, gain: 1.0, dur: 0.05, f0: 6000, f1: 1500, type: 'highpass', att: 0.0008 });
        sfx._noise({ v: vv, gain: 1.2, dur: 1.1, f0: 2200, f1: 60, att: 0.003 });
        sfx._tone({ v: vv, gain: 1.1, dur: 0.7, f0: 70, f1: 26, att: 0.003 });
        sfx._noise({ v: vv, gain: 0.5, dur: 2.2, f0: 380, f1: 40, delay: 0.06, att: 0.08 });
        sfx._clk?.(vv, 0.9, 1600, 0.25);                               // dolum mekanizması
      } else for (const x of vv.nodes) x.disconnect();
    }
  }

  dispose() {
    for (const v of [...this.voices, ...this.horns]) for (const n of v.nodes) { try { n?.stop?.(); } catch (e) { /* yok */ } try { n?.disconnect(); } catch (e) { /* yok */ } }
    this.voices = []; this.horns = [];
    this.smoke.dispose(); this.glow.dispose();
    this.group.removeFromParent();
  }
}

const fxk = (v) => (v.def.heli ? 'heli' : v.type);

// ── araç kamerası (Player.update'ten; ele alındıysa true) ──
// Sürücü: 'third' (varsayılan, takip: aracın arkasında, bakışla döner, duvara girmez) ya da 'first' (koltukta, aracın eğim / yatışıyla, içi görünür).
// Yolcu: normal asker kamerası (koltuktaki göz; silahla nişan) → false.
export function vehCamera(P, dt) {
  const s = P.s, g = P.game, v = s.veh, cam = g.camera;
  if (!v?.st || s.seat !== 0) { P._vcam = null; return false; }
  const view = g.vehView, st = view ? view.pose(v) : v.st, mode = P.vehCam || 'third';
  const sh = g.effects.shake || 0, jx = (Math.random() - 0.5) * sh * 0.05, jy = (Math.random() - 0.5) * sh * 0.05;
  const tk = !!v.def.turret;
  if (tk && mode === 'first') {                                      // 12.178 tank: nişancı dürbünü (kulenin sol önünde, kuleyle döner); sağ tık yakınlaştırır
    const tu = v.def.turret, cy = Math.cos(st.tyaw), sy = Math.sin(st.tyaw);
    toWorld(st, tu.f, 0, tu.y1 + 0.32, _p);
    cam.position.set(_p.x - sy * 0.9 - cy * 0.55, _p.y, _p.z - cy * 0.9 + sy * 0.55);
    _e.set(Math.max(-0.5, Math.min(0.6, s.pitch)) + jy, s.yaw + jx, 0, 'YXZ'); cam.quaternion.setFromEuler(_e);
    cam.fov = P.baseFov() / P.zoomCur(); cam.updateProjectionMatrix();      // 12.201: ×1,15 → sağ tık ×2,6 yumuşak (Player.vehZoom)
    P.bodyVisible = false; P._vcs = null;
  } else if (mode === 'first' && v.def.heli) {                       // 12.201 helikopter kokpiti: bakış dünyada dengeli (burun bakışı / nişanı izler; gövde eğimi
    const sp = v.def.seat[0];                                          // bakışa eklenirse burun eğildikçe kamera da eğilip geri besleme olurdu), yatışın yarısı hissedilir
    toWorld(st, sp[0] - 0.04, sp[1], sp[2] + 0.72, _p);
    cam.position.set(_p.x, _p.y, _p.z);
    _e.set(Math.max(-1.2, Math.min(1.0, s.pitch)) + jy, s.yaw + jx, (st.roll || 0) * 0.5, 'YXZ'); cam.quaternion.setFromEuler(_e);
    P.bodyVisible = false; P._vcs = null;
  } else if (mode === 'first') {
    const sp = v.def.seat[0];
    toWorld(st, sp[0] - 0.04, sp[1], sp[2] + 0.72, _p);
    cam.position.set(_p.x, _p.y, _p.z);
    _e.set(st.pitch, st.yaw, st.roll, 'YXZ'); _q.setFromEuler(_e);
    const rel = ((s.yaw - st.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    _e.set(Math.max(-1.2, Math.min(1.0, s.pitch)) + jy, rel + jx, 0, 'YXZ'); _q2.setFromEuler(_e);
    cam.quaternion.copy(_q).multiply(_q2);
    P.bodyVisible = false; P._vcs = null;
  } else {
    const hl = !!v.def.heli;
    toWorld({ ...st, pitch: 0, roll: 0 }, tk ? v.def.turret.f : 0, 0, tk ? 3.0 : hl ? 2.6 : 1.7, _p);
    const pv = _w.set(_p.x, _p.y, _p.z), pit = Math.max(-0.75, Math.min(0.55, s.pitch)) - (tk ? 0 : 0.16);      // tank: kamera bakışı = nişan (artı = bakış yönü)
    const dx = -Math.sin(s.yaw) * Math.cos(pit), dy = Math.sin(pit), dz = -Math.cos(s.yaw) * Math.cos(pit);
    const D = tk ? 10.5 : hl ? 14 : 7.2, des = _v.set(pv.x - dx * D, pv.y - dy * D + (tk ? 1.0 : hl ? 0 : 0.8), pv.z - dz * D);
    // 12.201 helikopter: kamera bakışa DİK yukarı kaydırılır (3 m) → aşağı bakınca bakış ışını gövdenin üstünden geçer, helikopter artının altında kalır
    // (eski sabit +2,2 m dikey payda aşağı bakan artı helikopterin kendisine düşüyor, yerdeki hedef gövdenin arkasında kalıyordu). Düz bakışta ≈ eskisi
    if (hl) { const sp = Math.sin(pit), cp = Math.cos(pit); des.x += Math.sin(s.yaw) * sp * 3.0; des.y += cp * 3.0 - Math.max(0, sp) * 0.8; des.z += Math.cos(s.yaw) * sp * 3.0; }
    if (tk) { cam.fov = P.baseFov() / P.zoomCur(); cam.updateProjectionMatrix(); }      // 12.201: sağ tık ×1,6 yumuşak
    const dir = des.clone().sub(pv), len = dir.length(); dir.multiplyScalar(1 / len);
    const h = g.world.raycast(pv, dir, len + 0.3, _h);
    if (h) des.copy(pv).addScaledVector(dir, Math.max(1.2, h.t - 0.3));
    des.y = Math.max(des.y, g.world.heightAt(des.x, des.z) + 0.4);
    if (!P._vcs || P._vcam !== 'third') P._vcs = des.clone(); else P._vcs.lerp(des, 1 - Math.exp(-14 * dt));
    cam.position.copy(P._vcs);
    _e.set(pit + jy, s.yaw + jx, 0, 'YXZ'); cam.quaternion.setFromEuler(_e);
    P.bodyVisible = true;
  }
  const vo = g.online && g.online.viewOff;
  if (vo) { const k = Math.exp(-dt * 11); vo.x *= k; vo.y *= k; vo.z *= k; if (mode === 'first') { cam.position.x += vo.x; cam.position.y += vo.y; cam.position.z += vo.z; } }
  P._vcam = mode;
  s.shotOff = null;
  return true;
}
