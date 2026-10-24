import * as THREE from 'three';

// 12.159: BAŞKALARININ FENERİ (3. şahıs). Yerel oyuncunun feneri kameraya bağlı SpotLight (game.torch) olarak aynen kalır; bu modül diğer
// savaşçıların (çevrimiçi: snapshot bayrağı F_TORCH → s.flashNet; çevrimdışı: botların s.flashOn) fenerini çizer.
//  · Gerçek ışık: SABİT HAVUZ (LIGHTS adet SpotLight, gölgesiz). Maç başında (yalnız gece / gün batımı haritasında) sahneye eklenir, kapalıyken
//    intensity 0 kalır → sahnedeki ışık sayısı hiç değişmez, malzemeler yeniden derlenmez (three.js ışık sayısı değişince tüm programları yeniden kurar).
//    Havuz 12.151 ön ısıtmasından ÖNCE kurulur; ön ısıtma programları bu ışık sayısıyla derler. Her karede kameraya en yakın (ekranda olan öne) LIGHTS fener ışığı alır.
//  · Ucuz görsel (her fenerde, en çok VIS adet): uçta parlak nokta (sprite) + yarı saydam hacimsel hüzme konisi (additive, depthWrite kapalı);
//    hüzme boyu duvara çarpınca kısalır (seyrek ışın).
//  · Göz kamaştırma: fener kameraya doğru bakıyorsa ve arada duvar yoksa uçta büyüyen küçük parıltı (abartısız).
const LIGHTS = 4, VIS = 12, BEAM_LEN = 13, BEAM_R = 2.6, LIGHT_RANGE = 60;
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _f = new THREE.Vector3(), _Z = new THREE.Vector3(0, 0, 1);

function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.18, 'rgba(255,246,220,0.85)'); g.addColorStop(0.45, 'rgba(255,230,180,0.25)'); g.addColorStop(1, 'rgba(255,220,160,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function beamGeo() {
  const g = new THREE.ConeGeometry(1, 1, 20, 1, true);      // tepe +Y'de → tepe orijinde, taban +Z'de (boy 1, yarıçap 1; ölçekle boyutlanır)
  g.translate(0, -0.5, 0); g.rotateX(-Math.PI / 2);
  return g;
}

const beamMat = (op) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color('#fff1d0') }, uOp: { value: op } },
  vertexShader: `varying float vA; varying vec3 vN; varying vec3 vV;
    void main(){ vA = position.z; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uColor; uniform float uOp; varying float vA; varying vec3 vN; varying vec3 vV;
    void main(){ float e = abs(dot(normalize(vN), normalize(vV)));
      float a = uOp * pow(1.0 - clamp(vA, 0.0, 1.0), 1.6) * smoothstep(0.05, 0.7, e) * smoothstep(0.0, 0.04, vA);
      gl_FragColor = vec4(uColor, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});

export class RemoteTorches {
  constructor(game) {
    this.g = game;
    this.enabled = !game.headless && !!game.renderer && (game.night || game.tod === 'sunset');
    if (!this.enabled) return;
    const night = game.night;
    this.lightI = night ? 140 : 45; this.beamOp = night ? 0.14 : 0.05; this.glowOp = night ? 0.95 : 0.6;
    this.lights = [];
    for (let i = 0; i < LIGHTS; i++) {
      const l = new THREE.SpotLight('#fff3d6', 0, 45, 0.42, 0.6, 1.1);
      l.castShadow = false;
      game.scene.add(l, l.target);
      this.lights.push(l);
    }
    const tex = glowTex(), geo = beamGeo();
    this.slots = [];
    for (let i = 0; i < VIS; i++) {
      const beam = new THREE.Mesh(geo, beamMat(this.beamOp)); beam.frustumCulled = false; beam.renderOrder = 5;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#fff4dc', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: this.glowOp }));
      const glare = new THREE.Sprite(glow.material.clone()); glare.material.opacity = 0;
      glow.renderOrder = glare.renderOrder = 6;
      // ilk karede görünür bırakılır: 12.151 ön ısıtması (traverseVisible) programlarını derlesin; ilk update gizler
      game.scene.add(beam, glow, glare);
      this.slots.push({ beam, glow, glare, s: null, len: BEAM_LEN, rayT: 0, seeT: 0, sees: false });
    }
    this.list = [];
  }

  active(s) {
    const g = this.g;
    if (s === g.playerSoldier || !s.alive || s.vacant || !s.model?.root?.visible || s.def?.zombie) return false;
    return g.online ? !!s.flashNet : !!s.flashOn;
  }

  update(dt) {
    if (!this.enabled) return;
    const g = this.g, cam = g.camera.position;
    g.camera.getWorldDirection(_f);
    const L = this.list; L.length = 0;
    for (const s of g.soldiers) {
      if (!this.active(s)) continue;
      const dx = s.pos.x - cam.x, dy = s.pos.y - cam.y, dz = s.pos.z - cam.z, d = Math.hypot(dx, dy, dz);
      const front = (dx * _f.x + dy * _f.y + dz * _f.z) / (d + 1e-6) > -0.2;      // ekranda (ya da hüzmesi ekrana girebilecek) olanlar öne
      L.push({ s, d, k: d + (front ? 0 : 40) });
    }
    L.sort((a, b) => a.k - b.k);
    // slot eşleşmesi: aynı savaşçı aynı slotta kalsın (ışın / görüş zamanlayıcıları sürsün)
    const want = new Set(L.slice(0, VIS).map((e) => e.s));
    for (const sl of this.slots) if (sl.s && !want.has(sl.s)) sl.s = null;
    for (const s of want) if (!this.slots.some((sl) => sl.s === s)) { const sl = this.slots.find((x) => !x.s); if (sl) { sl.s = s; sl.rayT = 0; sl.seeT = 0; } }
    const lit = new Set(L.slice(0, LIGHTS).filter((e) => e.d < LIGHT_RANGE).map((e) => e.s));
    let li = 0;
    for (const sl of this.slots) {
      const s = sl.s;
      sl.beam.visible = sl.glow.visible = sl.glare.visible = !!s;
      if (!s) continue;
      s.muzzleWorld(_o); s.aimDir(_d);
      _o.addScaledVector(_d, 0.06);
      if ((sl.rayT -= dt) <= 0) {                                                       // hüzme boyu: duvara / zemine kadar (8 Hz)
        sl.rayT = 0.12 + Math.random() * 0.04;
        const h = g.world.raycast(_o, _d, BEAM_LEN, (sl.hit ||= {}));
        sl.len = h ? Math.max(0.6, h.t + 0.3) : BEAM_LEN;
      }
      const len = sl.len, r = BEAM_R * (len / BEAM_LEN);
      sl.beam.position.copy(_o); sl.beam.quaternion.setFromUnitVectors(_Z, _d); sl.beam.scale.set(r, r, len);
      sl.glow.position.copy(_o); sl.glow.scale.setScalar(Math.max(0.22, _c.copy(cam).sub(_o).length() * 0.005));      // uzakta da birkaç piksel kalsın
      // göz kamaştırma: fener kameraya bakıyor + arada engel yok
      _c.copy(cam).sub(_o); const cd = _c.length(); _c.divideScalar(cd || 1);
      const cosA = _c.dot(_d);
      let gl = cd < 55 ? THREE.MathUtils.smoothstep(cosA, 0.88, 0.995) * (1 - cd / 55) : 0;
      if (gl > 0 && (sl.seeT -= dt) <= 0) { sl.seeT = 0.15; sl.sees = g.world.clear(_o, cam); }
      if (!sl.sees) gl = 0;
      sl.glare.position.copy(_o); sl.glare.scale.setScalar(0.4 + gl * 2.6); sl.glare.material.opacity = gl * 0.8;
      sl.glare.visible = gl > 0.01;
      if (lit.has(s) && li < LIGHTS) {
        const l = this.lights[li++];
        l.intensity = this.lightI; l.position.copy(_o); l.target.position.copy(_o).add(_d);
        l.target.updateMatrixWorld();
      }
    }
    for (; li < LIGHTS; li++) this.lights[li].intensity = 0;
  }
}
