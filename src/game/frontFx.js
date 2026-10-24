import * as THREE from 'three';

// Cephe modu savaş atmosferi (12.161; yalnız istemci, oynanışı etkilemez: çarpışma / bot görüşü / hasar yok):
//  · yükselen duman sütunları (yanan enkazlardan + harita dışından) ve yanan enkaz alevleri — tek örnekli (instanced) yüz-kameraya kart katmanı, katman başına 1 çizim
//  · havada süzülen toz / kül (kameranın çevresinde, tek Points)
//  · ufukta top ateşi parlamaları (sis üstü, toplamsal) + boğuk uzak gümbürtü (ses hızı gecikmesiyle)
//  · ara sıra uzakta (55–120 m, etkin noktadan ve askerlerden uzak) düşen top mermisi: parlama + toprak / duman fışkırması + konumlu patlama sesi (abartısız)
// Performans: masaüstü 6 çizim çağrısı / ~200 kart, telefonda kartlar ve kül yarıya iner. CPU: kare başına ~200 kart güncellemesi.
let TEX = null;
function smokeTex() {
  if (TEX) return TEX;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d');
  for (let i = 0; i < 16; i++) {                                                   // yumuşak, düzensiz bulut topakları
    const x = S * (0.3 + Math.random() * 0.4), y = S * (0.3 + Math.random() * 0.4), r = S * (0.16 + Math.random() * 0.17);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.36)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
  }
  TEX = new THREE.CanvasTexture(cv); TEX.colorSpace = THREE.SRGBColorSpace;
  return TEX;
}
let FTEX = null;
function flameTex() {
  if (FTEX) return FTEX;
  const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'), g = c.createRadialGradient(S / 2, S * 0.62, 0, S / 2, S * 0.6, S * 0.46);
  g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.35, 'rgba(255,170,70,0.85)'); g.addColorStop(1, 'rgba(200,60,10,0)');
  c.fillStyle = g; c.beginPath(); c.ellipse(S / 2, S * 0.58, S * 0.3, S * 0.42, 0, 0, Math.PI * 2); c.fill();
  FTEX = new THREE.CanvasTexture(cv); FTEX.colorSpace = THREE.SRGBColorSpace;
  return FTEX;
}

let DTEX = null;
function dotTex() {                                                                // kül tanesi: yumuşak yuvarlak (kare nokta görünmesin)
  if (DTEX) return DTEX;
  const S = 32, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const c = cv.getContext('2d'), g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  DTEX = new THREE.CanvasTexture(cv); DTEX.colorSpace = THREE.SRGBColorSpace;
  return DTEX;
}

// yüz-kameraya kart katmanı: örnek başına konum, boyut, saydamlık, dönüş, renk. additive: alev / parlama (sis saydamlığı söndürür)
class Cards {
  constructor(n, tex, additive) {
    this.n = n;
    const g = new THREE.InstancedBufferGeometry();
    const q = new THREE.PlaneGeometry(1, 1);
    g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
    this.pos = new Float32Array(n * 3); this.dat = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iDat', new THREE.InstancedBufferAttribute(this.dat, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = n;
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]);
    u.map.value = tex;
    const m = new THREE.ShaderMaterial({
      uniforms: u, fog: true, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 iPos; attribute vec3 iDat; attribute vec3 iCol;
        varying vec2 vUv; varying float vA; varying vec3 vC;
        #include <fog_pars_vertex>
        void main(){
          vUv = uv; vA = iDat.y; vC = iCol;
          vec4 mvPosition = viewMatrix * vec4(iPos, 1.0);
          float c = cos(iDat.z), s = sin(iDat.z);
          vec2 p = position.xy * iDat.x;
          mvPosition.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map; varying vec2 vUv; varying float vA; varying vec3 vC;
        #include <fog_pars_fragment>
        void main(){
          vec4 t = texture2D(map, vUv);
          float a = t.a * vA;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vC * t.rgb, a);
          ${additive ? '#ifdef USE_FOG\n float fF = smoothstep(fogNear, fogFar, vFogDepth); gl_FragColor.a *= 1.0 - fF;\n #endif' : '#include <fog_fragment>'}
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, m);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = additive ? 3 : 2;
    this.geo = g; this.mat = m;
  }
  set(i, x, y, z, size, alpha, rot, c) {
    const k = i * 3;
    this.pos[k] = x; this.pos[k + 1] = y; this.pos[k + 2] = z;
    this.dat[k] = size; this.dat[k + 1] = alpha; this.dat[k + 2] = rot;
    this.col[k] = c.r; this.col[k + 1] = c.g; this.col[k + 2] = c.b;
  }
  flush() { for (const a of ['iPos', 'iDat', 'iCol']) this.geo.attributes[a].needsUpdate = true; }
  dispose() { this.geo.dispose(); this.mat.dispose(); }
}

const C_SMOKE = new THREE.Color('#5e5b56'), C_SMOKE2 = new THREE.Color('#3c3a37'), C_DIRT = new THREE.Color('#4a3f33'), C_FIRE = new THREE.Color('#ffb36a'), C_FLASH = new THREE.Color('#ffd9a0');
const _c = new THREE.Color();

export class FrontFx {
  constructor(game) {
    this.g = game; this.t = 0; this.nextBoom = 2.5; this.nextShell = 12 + Math.random() * 10;
    const mob = (this.mob = !!game.touch || innerWidth < 900), sc = game.scene;
    // duman / ateş kaynakları: [x, y (taban), z, yanıyor mu, ölçek] — haritadaki enkazlar + harita dışı
    const src = game.map.front?.fires || [];
    const off = [[-96, 0, 30, 0, 1.3], [98, 0, -24, 0, 1.4], [-98, 0, -110, 0, 1.2], [96, 0, 104, 0, 1.2], [6, 0, -182, 0, 1.6], [-44, 0, 182, 0, 1.4], [64, 0, -176, 0, 1.3]];
    this.cols = [...src.map((f) => [...f]), ...off.slice(0, mob ? 3 : off.length)];
    const per = mob ? 5 : 9;
    this.smoke = new Cards(this.cols.length * per + 24, smokeTex(), false);     // + 24: top mermisi toprak fışkırması
    this.puffs = [];
    this.cols.forEach((c, ci) => { for (let k = 0; k < per; k++) this.puffs.push({ ci, life: 10 + Math.random() * 5, age: (k / per) * 12 + Math.random(), rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.15 }); });
    this.burst = [];                                                                // top mermisi fışkırması (ömürlü)
    const nFire = this.cols.filter((c) => c[3]).length * 3;
    this.fire = new Cards(Math.max(1, nFire + 1), flameTex(), true);              // + 1: yakın top mermisi parlaması
    sc.add(this.smoke.mesh); sc.add(this.fire.mesh);
    // toz / kül: kameranın çevresinde 36 × 14 × 36 m'lik kutuda süzülür (dünya koordinatı; kamera kutudan çıktıkça parçacık öbür yana sarılır)
    const N = (this.nAsh = mob ? 110 : 280), ap = (this.ashP = new Float32Array(N * 3)), c0 = game.camera.position;
    this.ashV = new Float32Array(N);
    for (let i = 0; i < N; i++) { ap[i * 3] = c0.x + (Math.random() - 0.5) * 36; ap[i * 3 + 1] = c0.y - 4 + Math.random() * 14; ap[i * 3 + 2] = c0.z + (Math.random() - 0.5) * 36; this.ashV[i] = 0.15 + Math.random() * 0.35; }
    const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(ap, 3).setUsage(THREE.DynamicDrawUsage));
    this.ash = new THREE.Points(ag, new THREE.PointsMaterial({ map: dotTex(), color: '#b3aea4', size: 0.07, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
    this.ash.frustumCulled = false; sc.add(this.ash);
    // ufuk parlamaları: harita uçlarının ve yanlarının ötesinde (sis yok, toplamsal)
    const fm = new THREE.SpriteMaterial({ map: smokeTex(), color: '#ffb35a', transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending, fog: false });
    this.flashes = [];
    for (const [x, y, z] of [[-110, 10, -290], [40, 10, -310], [150, 10, -270], [-130, 10, 300], [60, 10, 320], [-260, 12, -60], [270, 12, 40]].slice(0, mob ? 4 : 7)) {
      const sp = new THREE.Sprite(fm.clone()); sp.scale.set(90, 34, 1); sp.position.set(x, y, z); sc.add(sp); this.flashes.push({ sp, t: 0 });
    }
    this.v = new THREE.Vector3();
  }

  // yakın (ama oyunu etkilemeyen) top mermisi: kameradan 55–120 m, etkin noktadan ≥ 35 m, her askerden ≥ 25 m uzak arazi noktası
  shell() {
    const g = this.g, cam = g.camera.position, B = g.map.bounds, o = g.front?.active;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 65, x = cam.x + Math.cos(a) * r, z = cam.z + Math.sin(a) * r;
      if (x < B.minX + 4 || x > B.maxX - 4 || z < B.minZ + 4 || z > B.maxZ - 4) continue;
      if (o && Math.hypot(x - o.x, z - o.z) < 35) continue;
      if (g.soldiers.some((s) => s.alive && Math.hypot(s.pos.x - x, s.pos.z - z) < 25)) continue;
      const y = g.world.heightAt(x, z);
      for (let i = 0; i < 8; i++) this.burst.push({ x: x + (Math.random() - 0.5) * 2, y: y + 0.3, z: z + (Math.random() - 0.5) * 2, vx: (Math.random() - 0.5) * 3, vy: 5 + Math.random() * 6, vz: (Math.random() - 0.5) * 3, age: 0, life: 2.6 + Math.random() * 1.6, rot: Math.random() * 6, dirt: i < 5 });
      if (this.burst.length > 24) this.burst.splice(0, this.burst.length - 24);
      this.flashAt = { x, y: y + 1.5, z, t: 0.22 };
      const sfx = g.sfx;
      if (sfx?.ctx && sfx.explosion) sfx.explosion(this.v.set(x, y + 0.5, z));
      return;
    }
  }

  update(dt) {
    this.t += dt;
    const g = this.g, cam = g.camera.position, wind = 0.7;
    // duman sütunları
    let i = 0;
    for (const p of this.puffs) {
      p.age += dt;
      if (p.age > p.life) { p.age -= p.life; p.life = 10 + Math.random() * 5; p.rot = Math.random() * 6; }
      const c = this.cols[p.ci], f = p.age / p.life, sc = c[4] || 1;
      const y = c[1] + 1.2 + Math.pow(f, 1.4) * 26 * sc, size = (1.8 + f * 11) * sc, al = Math.min(1, f * 12) * (1 - f) * (c[3] ? 0.9 : 0.75);   // dipten yükselir (enkazın hemen üstünde koyu, yukarıda açılır)
      _c.copy(C_SMOKE2).lerp(C_SMOKE, f);
      this.smoke.set(i++, c[0] + f * wind * 9 + Math.sin(this.t * 0.3 + p.ci) * 0.6, y, c[2] + f * 1.5, size, al, p.rot + p.age * p.spin, _c);
    }
    for (const b of this.burst) {                                                    // top mermisi fışkırması: toprak hızla yükselip düşer, duman yavaş açılır
      b.age += dt;
      const f = Math.min(1, b.age / b.life);
      if (b.dirt) { b.vy -= 12 * dt; b.x += b.vx * dt; b.y = Math.max(b.y + b.vy * dt, g.world.heightAt(b.x, b.z)); b.z += b.vz * dt; } else { b.vy *= 1 - dt * 1.4; b.y += b.vy * dt * 0.5; b.x += wind * dt; }
      this.smoke.set(i++, b.x, b.y, b.z, (b.dirt ? 1.6 + f * 2.4 : 3 + f * 7), (1 - f) * (b.dirt ? 0.9 : 0.6), b.rot, b.dirt ? C_DIRT : C_SMOKE);
    }
    this.burst = this.burst.filter((b) => b.age < b.life);
    while (i < this.smoke.n) this.smoke.set(i++, 0, -999, 0, 0, 0, 0, C_SMOKE);
    this.smoke.flush();
    // alevler (yanan enkaz): titreşen 3 kart
    let j = 0;
    for (const c of this.cols) {
      if (!c[3]) continue;
      for (let k = 0; k < 3; k++) {
        const fl = 0.75 + 0.25 * Math.sin(this.t * (9 + k * 3.1) + k * 2 + c[0]) * Math.sin(this.t * 5.3 + k);
        this.fire.set(j++, c[0] + (k - 1) * 0.55, c[1] + 0.5 + k * 0.15 + fl * 0.2, c[2] + (k % 2 ? 0.3 : -0.2), (1.3 + k * 0.25) * fl * (c[4] || 1), 0.85 * fl, Math.sin(this.t * 2 + k) * 0.15, C_FIRE);
      }
    }
    if (this.flashAt) {                                                              // yakın top mermisi parlaması
      const F = this.flashAt; F.t -= dt;
      this.fire.set(j++, F.x, F.y, F.z, 9, Math.max(0, F.t / 0.22), 0, C_FLASH);
      if (F.t <= 0) this.flashAt = null;
    }
    while (j < this.fire.n) this.fire.set(j++, 0, -999, 0, 0, 0, 0, C_FIRE);
    this.fire.flush();
    // toz / kül: rüzgârla süzülür, kameranın çevresindeki kutuya sarılır
    const ap = this.ashP, N = this.nAsh;
    for (let k = 0; k < N; k++) {
      let x = ap[k * 3] + (wind * 0.4 + Math.sin(this.t * 0.4 + k) * 0.15) * dt, y = ap[k * 3 + 1] - this.ashV[k] * dt * 0.35, z = ap[k * 3 + 2] + Math.cos(this.t * 0.3 + k * 1.7) * 0.12 * dt;
      if (x - cam.x > 18) x -= 36; else if (x - cam.x < -18) x += 36;
      if (z - cam.z > 18) z -= 36; else if (z - cam.z < -18) z += 36;
      if (y < cam.y - 4) y += 14; else if (y > cam.y + 10) y -= 14;
      ap[k * 3] = x; ap[k * 3 + 1] = y; ap[k * 3 + 2] = z;
    }
    this.ash.geometry.attributes.position.needsUpdate = true;
    // ufuk top ateşi: parıltı + ses hızı gecikmeli uzak gümbürtü
    for (const f of this.flashes) { f.t = Math.max(0, f.t - dt * 1.8); f.sp.material.opacity = f.t * f.t * 0.85; }
    if ((this.nextBoom -= dt) <= 0) {
      this.nextBoom = 2 + Math.random() * 4.5;
      const n = Math.random() < 0.3 ? 2 : 1;                                        // ara sıra çift atış
      for (let q = 0; q < n; q++) {
        const f = this.flashes[Math.floor(Math.random() * this.flashes.length)];
        setTimeout(() => { f.t = 0.7 + Math.random() * 0.3; }, q * 260);
        const sfx = g.sfx, d = f.sp.position.distanceTo(cam);
        if (sfx?.ctx && sfx.distantBoom) setTimeout(() => { if (!this.dead) sfx.distantBoom(); }, Math.min(1400, d / 343 * 1000) + q * 260);
      }
    }
    if ((this.nextShell -= dt) <= 0) { this.nextShell = 14 + Math.random() * 18; this.shell(); }
  }

  dispose() {
    this.dead = true;
    const sc = this.g.scene;
    sc.remove(this.smoke.mesh); sc.remove(this.fire.mesh); sc.remove(this.ash);
    this.smoke.dispose(); this.fire.dispose(); this.ash.geometry.dispose(); this.ash.material.dispose();
    for (const f of this.flashes) { sc.remove(f.sp); f.sp.material.dispose(); }
  }
}
