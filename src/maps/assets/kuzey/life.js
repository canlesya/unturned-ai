import * as THREE from 'three';

// Kuzey Vadisi yaşam izleri (12.172, yalnız görsel): baca dumanı (gölgelendiricide yükselen yumuşak noktalar, tek çizim), fabrika bacası tüteni,
// gece pencere ışıkları (varlıkların bıraktığı pencere listesi → tek birleşik ağ, ışıma) + lamba / projektör ışık havuzları (zemin pulları, eklemeli),
// çamaşır ipleri (ince çizgi + çamaşırlar, rüzgârda salınır). Gece / akşam görünürlüğü setLight(0..1) ile (maç içi gün döngüsü de kullanır).

function smoke(sources, scale = 1) {
  // sources: [[x, y, z, güç]] — her kaynak N tanecik; tanecik: başlangıç, evre, hız
  const P = [], A = [];
  for (const [x, y, z, k] of sources) { const n = Math.round(6 + k * 26); for (let i = 0; i < n; i++) { P.push(x, y, z); A.push(i / n, k, Math.random(), Math.random()); } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aP', new THREE.Float32BufferAttribute(A, 4));
  const U = { uTime: { value: 0 }, uWind: { value: new THREE.Vector2(1.2, 0.5) }, uCol: { value: new THREE.Color('#b9b8b4') }, uH: { value: 600 }, uA: { value: 1 } };
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, U]), transparent: true, depthWrite: false, fog: true,
    vertexShader: `attribute vec4 aP; uniform float uTime, uH; uniform vec2 uWind; varying float vA;
      #include <fog_pars_vertex>
      void main(){
        float big = aP.y, life = mix(9.0, 22.0, big), t = fract(aP.x + uTime / life + aP.z * 0.37);
        float rise = t * mix(9.0, 60.0, big);
        vec3 p = position + vec3(uWind.x * rise * 0.9 + (aP.z - 0.5) * 2.0 * t * (1.0 + 4.0 * big), rise, uWind.y * rise * 0.9 + (aP.w - 0.5) * 2.0 * t * (1.0 + 4.0 * big));
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        float sz = mix(1.2, 4.0, big) * (0.6 + 2.6 * t);
        gl_PointSize = sz * uH / max(1.0, -mvPosition.z);
        vA = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.45, 1.0, t)) * mix(0.42, 0.55, big);
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vA;
      #include <fog_pars_fragment>
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard;
        gl_FragColor = vec4(uCol, vA * uA * (1.0 - smoothstep(0.08, 0.25, d)));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 4; pts.userData.U = m.uniforms;
  return pts;
}

export class Life {
  constructor(T, ctx, { quality = 'high' } = {}) {
    this.group = new THREE.Group(); this.group.name = 'kuzey-yasam';
    // baca dumanı: evlerin ~%45'i + fabrika bacası + kamp
    const ch = (ctx.chimneys || []).filter((_, i) => (i * 7) % 20 < 9).map(([x, y, z]) => [x, y, z, 0]);
    if (ctx.bigSmoke) ch.push(...ctx.bigSmoke.map(([x, y, z]) => [x, y, z, 1]));
    this.smoke = smoke(quality === 'low' ? ch.filter((_, i) => i % 2 === 0) : ch); this.group.add(this.smoke);
    // pencere ışıkları
    // pencere başına uv + ton: kayıt (çapraz çerçeve) koyu, alt sıcak / üst soluk, perde gölgesi; bazı pencereler mavimsi (TV / soğuk lamba)
    const L = ctx.lights || [], pos = [], uv = [], tone = [];
    L.forEach(([x, y, z, nx, nz, w, h], i) => {
      const tx = -nz, tz = nx, hw = w / 2, hh = h / 2, px = x + nx * 0.03, pz = z + nz * 0.03;
      const a = [px - tx * hw, y - hh, pz - tz * hw], b = [px + tx * hw, y - hh, pz + tz * hw], c = [px + tx * hw, y + hh, pz + tz * hw], d = [px - tx * hw, y + hh, pz - tz * hw];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
      const k = ((i * 2654435761) >>> 0) / 4294967296; for (let v = 0; v < 6; v++) tone.push(k);
    });
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); wg.setAttribute('aT', new THREE.Float32BufferAttribute(tone, 1));
    this.winMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { opacity: { value: 0 } }]), transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
      vertexShader: `attribute float aT; varying vec2 vUv; varying float vT;
        #include <fog_pars_vertex>
        void main(){ vUv = uv; vT = aT; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `uniform float opacity; varying vec2 vUv; varying float vT;
        #include <fog_pars_fragment>
        void main(){
          vec3 warm = mix(vec3(1.0, 0.62, 0.26), vec3(1.0, 0.78, 0.45), vT);
          vec3 c = vT > 0.86 ? vec3(0.45, 0.6, 0.95) : warm;
          c *= mix(1.15, 0.55, vUv.y) * (0.75 + 0.35 * vT);
          float bar = max(1.0 - smoothstep(0.0, 0.035, abs(vUv.x - 0.5)), 1.0 - smoothstep(0.0, 0.05, abs(vUv.y - 0.55)));
          float frame = 1.0 - smoothstep(0.0, 0.06, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
          float curtain = smoothstep(0.62, 0.7, abs(vUv.x - 0.5) * 2.0) * step(0.4, vT) * 0.55;
          c *= (1.0 - 0.85 * max(bar, frame)) * (1.0 - curtain);
          gl_FragColor = vec4(c * 1.6, opacity);
          #include <fog_fragment>
        }`,
    });
    this.windows = new THREE.Mesh(wg, this.winMat); this.windows.renderOrder = 3; this.group.add(this.windows);
    // lamba / projektör havuzları (zemin pulları)
    const lp = [], la = [];
    for (const [x, , z, r] of ctx.lamps || []) { const y = T.heightAt(x, z) + 0.06; const n = 14; for (let i = 0; i < n; i++) { const a0 = i / n * 6.283, a1 = (i + 1) / n * 6.283; lp.push(x, y, z, x + Math.cos(a0) * r, T.heightAt(x + Math.cos(a0) * r, z + Math.sin(a0) * r) + 0.06, z + Math.sin(a0) * r, x + Math.cos(a1) * r, T.heightAt(x + Math.cos(a1) * r, z + Math.sin(a1) * r) + 0.06, z + Math.sin(a1) * r); la.push(1, 0, 0); } }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); pg.setAttribute('aC', new THREE.Float32BufferAttribute(la, 1));
    this.poolMat = new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aC; varying float vC; void main(){ vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying float vC; void main(){ gl_FragColor = vec4(vec3(1.0, 0.78, 0.46) * vC * vC * 0.55 * uA, 1.0); }' });
    this.pools = new THREE.Mesh(pg, this.poolMat); this.pools.renderOrder = 3; this.group.add(this.pools);
    // çamaşır ipleri
    const lines = [], cl = [], cc = [], palette = ['#e8e4da', '#9fb7cf', '#c9584a', '#e3c25a', '#7aa06a', '#f0f0f0'].map((c) => new THREE.Color(c));
    for (const [ax, ay, az, bx, by, bz] of ctx.laundry || []) {
      const h = 1.9; lines.push(ax, ay, az, ax, ay + h, az, bx, by, bz, bx, by + h, bz, ax, ay + h, az, bx, by + h, bz);
      const L2 = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.floor(L2 / 0.8));
      for (let i = 1; i < n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ay + (by - ay) * t + h - 0.08 * Math.sin(t * Math.PI), w = 0.28 + Math.random() * 0.2, hh = 0.35 + Math.random() * 0.35, tx = (bx - ax) / L2 * w, tz = (bz - az) / L2 * w;
        cl.push(x - tx, y, z - tz, x + tx, y, z + tz, x + tx, y - hh, z + tz, x - tx, y, z - tz, x + tx, y - hh, z + tz, x - tx, y - hh, z - tz);
        const c = palette[Math.floor(Math.random() * palette.length)]; for (let k = 0; k < 6; k++) cc.push(c.r, c.g, c.b);
      }
    }
    if (lines.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#4a3f35' }))); }
    if (cl.length) {
      const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(cl, 3)); cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); cg.computeVertexNormals();
      const cm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 });
      const U = { uTime: { value: 0 } }; cm.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.x += sin(uTime * 2.3 + position.z * 1.7) * 0.06 * fract(position.y * 0.0 + 1.0);'); };
      cm.customProgramCacheKey = () => 'kuzey-camasir'; this.clothU = U;
      const mesh = new THREE.Mesh(cg, cm); mesh.castShadow = true; this.group.add(mesh);
    }
    this.light = -1; this.setLight(0);
  }
  // 0 gündüz … 1 gece: pencereler, lamba havuzları; duman akşam / sabah biraz yoğun
  setLight(k) {
    if (Math.abs(k - this.light) < 0.01) return;
    this.light = k;
    this.winMat.uniforms.opacity.value = 0.95 * k; this.windows.visible = k > 0.02;
    this.poolMat.uniforms.uA.value = k; this.pools.visible = k > 0.02;
  }
  update(t, h) {
    this.smoke.userData.U.uTime.value = t;
    this.smoke.userData.U.uH.value = (typeof innerHeight !== 'undefined' ? innerHeight : 900) * 0.9;
    if (this.clothU) this.clothU.uTime.value = t;
  }
  setSmokeColor(c, a = 1) { this.smoke.userData.U.uCol.value.copy(c); this.smoke.userData.U.uA.value = a; }
}
