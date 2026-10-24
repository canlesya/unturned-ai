import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { MapBuilder, makeRng } from './builder.js';
import { YK, makeYorungeMaterial } from './yorungeSurface.js';

// "Yörünge Üssü" — Uzay modu haritası (12.157; 120 × 80 m, 6v6–8v8 takım çatışması). Ay yüzeyinde, büyük bir krater çanağının içine kurulmuş maden / araştırma üssü.
// Batı = Mavi, doğu = Kırmızı; harita x = 0'a göre AYNA simetrik (iki takım aynı yolları görür). Üç hat:
//   · ORTA: kapalı hangar (doğuş) → hava kilidi koridoru → Lab modülü → koridor → cam kubbeli MERKEZ MODÜL (asma kat, reaktör çekirdeği) — yakın mesafe
//   · KUZEY: açık Ay yüzeyi — güneş paneli tarlası, kraterler (kaya kenarlı), kaya sırtı, ortada çatısına çıkılan Anten İstasyonu (4 m, anten direği) — uzun / orta mesafe
//   · GÜNEY: iniş pisti + küçük mekik (kanatlardan gövde üstüne çıkılır), ay aracı, kargo konteynerleri, krater — orta mesafe
// Dikey: her yarıda kuzey ve güney iskeleler 3,5 m'de Lab–Merkez koridorunun çatısıyla birleşir (kuzey ↔ güney köprü); Anten İstasyonu çatısı 4 m.
// Düşük yer çekimi (TUNE.spaceGrav): zıplama zirvesi ≈ 2 m, koşarak ≈ 14 m sıçrama. Bu yüzden modül duvarları 6,2 m (3,5 m iskeleden zıplayınca 5,5 m: çatıya çıkılmaz),
// cam kubbeler modül çatısında (ulaşılmaz; çarpışmasız cam yok sayılır), çevre krater duvarı ≥ 8 m. Kural: görünen her katı parçanın çarpışması birebir (eksen hizalı kutular),
// bileşik eşyada süs parçaları çarpışmasız; görünmez engel yok. Kayalar: taban dikdörtgeni = çarpışma kutusu, üst yüzler hafif içe çekik (≤ %16).
export const YORUNGE_BOUNDS = { minX: -60, maxX: 60, minZ: -40, maxZ: 40 };
const NC = { collide: false };
const k = (kind, o = {}) => ({ ...o, kind }), nk = (kind, o = {}) => ({ collide: false, ...o, kind });
const PI = Math.PI, P2 = PI / 2;
export const MOD_H = 6.2, MOD_T = 0.5, COR_H = 3.2, DECK = 3.5;      // modül duvarı, kalınlık; koridor duvarı; koridor çatısı / iskele güvertesi üstü

// renkler: gri regolit, kırık beyaz gövde, koyu metal; turuncu uyarı; takım rengi yalnız hangarlarda ince şerit
const REG = '#8d8c88', REG2 = '#7d7c78', DUSTC = '#6c6b68', ROCKC = ['#6e6c68', '#64625e', '#77746e', '#5c5a56'];
const HULL = '#d9d7cf', HULL2 = '#c4c2ba', INNER = '#b9bcbf', FLOOR = '#80868d', METAL = '#3d4247', METAL2 = '#555b62', GRATE = '#4a4f55';
const ORANGE = '#e07a2a', SOLAR = '#1d2c4a', PADC = '#9a9890', CRATE = ['#c9c4b4', '#8e9aa3', '#b0763e', '#6f7c6b'], STRIPE = '#e2b52c';
export const TEAM_COL = { blue: '#2f6fd6', red: '#d0443a' };
// sürekli ışıyan malzemeler (gün saatinden bağımsız; ışıyan kova başına 1 çizim çağrısı)
const LIGHT = (c, i = 1.4) => ({ collide: false, o: { emissive: c, emissiveIntensity: i, roughness: 0.6 } });
const L_CYAN = '#7fe6ff', L_WARM = '#fff1cf', L_ORANGE = '#ffae4a';

// Tabela (yalnız tarayıcı): ışığa tepki veren düzlem
function textPlane(text, w, h, { fg = '#20242a', bg = null, font = 'bold 300px Arial, sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(64, Math.round(512 * h / w));
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const fit = Math.min(c.width * 0.86 / Math.max(1, g.measureText(text).width), c.height * 0.8 / (+/(\d+)px/.exec(font)[1]));
  if (fit < 1) g.font = font.replace(/(\d+)px/, (_, n) => Math.floor(n * fit) + 'px');
  g.fillStyle = fg; g.fillText(text, c.width / 2, c.height / 2 + 6);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// ── Uzay göğü (yalnız tarayıcı): yıldız alanı, Dünya (prosedürel doku, güneşle aydınlanan yarım küre + atmosfer halesi), güneş parlaması.
// Hepsi kameraya kilitli (onBeforeRender: konum = kamera + sabit uzaklık) → harita içinde yürürken paralaks / kayma yok; sis yok; frustum ayıklaması kapalı.
export const SUN_POS = [70, 52, 38];
export const EARTH_DIR = new THREE.Vector3(-0.6, 0.55, -0.62).normalize();
const lockToCam = (o, off) => { o.frustumCulled = false; o.onBeforeRender = (r, s, cam) => { o.position.copy(cam.position).add(off); }; return o; };
function vnoise(seed) {
  const P = new Float32Array(512); let s = seed >>> 0; for (let i = 0; i < 512; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; P[i] = s / 4294967296; }
  const h = (x, y) => P[((x & 255) + ((y & 255) * 31 & 255)) & 511];
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; };
  return (x, y, o = 5) => { let a = 0, f = 1, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += n(x * f, y * f) * w; t += w; f *= 2.03; w *= 0.5; } return a / t; };
}
export function earthTexture(W = 512, H = 256) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), N = vnoise(11), C = vnoise(29);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const lon = (x / W) * Math.PI * 2, lat = (y / H - 0.5) * Math.PI, cx = Math.cos(lat) * Math.cos(lon), cz = Math.cos(lat) * Math.sin(lon), cy = Math.sin(lat);
    const e = N(cx * 2.2 + 5, cz * 2.2 + cy * 1.7 + 5, 6), land = e > 0.53, polar = Math.abs(lat) > 1.22 + (N(cx * 6, cz * 6, 3) - 0.5) * 0.25;
    let r, gg, b;
    if (polar) { r = 236; gg = 242; b = 248; }
    else if (land) { const k = Math.min(1, (e - 0.53) * 6), dry = N(cx * 4 + 9, cz * 4 + cy * 3, 4); r = 62 + 70 * dry * k; gg = 104 + 36 * (1 - dry) - 10 * k; b = 52 + 22 * dry; }
    else { const d = Math.min(1, (0.53 - e) * 5); r = 22 - 12 * d; gg = 74 - 30 * d; b = 150 - 40 * d; }
    const cl = C(cx * 3.2 + 1, cz * 3.2 + cy * 2.6 + 1, 5), cw = Math.max(0, Math.min(1, (cl - 0.52) * 4));
    r = r + (250 - r) * cw * 0.9; gg = gg + (252 - gg) * cw * 0.9; b = b + (255 - b) * cw * 0.9;
    const i = (y * W + x) * 4; img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function spaceSky(group) {
  const sky = new THREE.Group(); sky.name = 'uzay-gök';
  // yıldızlar: 1600 nokta, ufkun biraz altına kadar, parlaklık / renk çeşitli (ekran piksel boyu sabit)
  const n = 1600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let s = 7;
  const r = () => ((s = (Math.imul(s, 16807) % 2147483647 + 2147483647) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = r() * 1.15 - 0.15, a = r() * Math.PI * 2, q = Math.sqrt(Math.max(0, 1 - u * u));
    pos[i * 3] = Math.cos(a) * q * 600; pos[i * 3 + 1] = u * 600; pos[i * 3 + 2] = Math.sin(a) * q * 600;
    const l = 0.35 + Math.pow(r(), 3) * 0.9, w = r();
    col[i * 3] = l * (w < 0.15 ? 1.0 : w > 0.85 ? 0.78 : 0.92); col[i * 3 + 1] = l * 0.92; col[i * 3 + 2] = l * (w > 0.85 ? 1.0 : w < 0.15 ? 0.72 : 0.95);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.8, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true }));
  stars.renderOrder = -900; sky.add(lockToCam(stars, new THREE.Vector3()));
  // Dünya: 560 m uzakta, yarıçap 58 (≈ 12°), güneşle aydınlanan yüz + ince mavi atmosfer halesi (arka yüz, eklemeli)
  const off = EARTH_DIR.clone().multiplyScalar(560);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(58, 48, 32), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.85, metalness: 0, fog: false, emissive: '#0a1a33', emissiveIntensity: 0.25 }));
  earth.rotation.set(0.35, 2.2, 0.15); earth.renderOrder = -800; sky.add(lockToCam(earth, off));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(61.5, 48, 32), new THREE.ShaderMaterial({
    uniforms: { sun: { value: new THREE.Vector3(...SUN_POS).normalize() } }, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vV; void main(){ float rim = pow(1.0 - abs(dot(vN, vV)), 3.0); float lit = smoothstep(-0.3, 0.5, dot(vN, sun)); gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * rim * (0.25 + lit) * 1.4, 1.0); }',
  }));
  halo.renderOrder = -790; sky.add(lockToCam(halo, off));
  // güneş parlaması: yumuşak ışın kümesi (eklemeli sprite), göğün güneş diskinin önünde
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const x = gc.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.06, 'rgba(255,250,235,0.95)'); gr.addColorStop(0.2, 'rgba(255,235,200,0.28)'); gr.addColorStop(1, 'rgba(255,220,180,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { x.save(); x.translate(128, 128); x.rotate((i / 6) * Math.PI + 0.2); const l = x.createLinearGradient(-128, 0, 128, 0); l.addColorStop(0, 'rgba(255,240,220,0)'); l.addColorStop(0.5, 'rgba(255,245,230,0.35)'); l.addColorStop(1, 'rgba(255,240,220,0)'); x.fillStyle = l; x.fillRect(-128, -1.5, 256, 3); x.restore(); }
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
  const glare = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  glare.scale.set(150, 150, 1); glare.renderOrder = -780; sky.add(lockToCam(glare, new THREE.Vector3(...SUN_POS).normalize().multiplyScalar(580)));
  group.add(sky);
}

export function buildYorunge() {
  const b = new MapBuilder();
  const rng = makeRng(157);
  b.surface = { ground: () => 0, kindOf: () => YK.PLAIN, seeded: true, material: makeYorungeMaterial };
  const callouts = [];
  const co = (name, x, z, major = false) => callouts.push({ name, x, z, ...(major ? { major: true } : {}) });
  const domes = [];                                                                      // cam kubbeler (görsel, çarpışmasız, ulaşılmaz): [cx, cz, R, y]

  // ───────── yardımcılar ─────────
  // Ay kayası: taban dikdörtgeni (w × d) birebir çarpışma kutusu; üst köşeler rastgele içe çekik / alçak, tepe ≈ h (çarpışma tepesi = 0,95 h)
  const rock = (x, z, w, d, h, col = ROCKC[Math.floor(rng() * 4)], y0 = 0) => {
    const pts = [], hw = w / 2, hd = d / 2, j = () => (rng() - 0.5);
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pts.push(new THREE.Vector3(sx * hw, 0, sz * hd));
    const ins = 0.08 + rng() * 0.08;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) pts.push(new THREE.Vector3(sx * hw * (1 - ins * 0.4) + (sx ? 0 : j() * hw), h * (0.6 + rng() * 0.2), sz * hd * (1 - ins * 0.4) + (sz ? 0 : j() * hd)));
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) pts.push(new THREE.Vector3(sx * hw * (1 - ins) * (0.86 + rng() * 0.14), h * (0.92 + rng() * 0.08), sz * hd * (1 - ins) * (0.86 + rng() * 0.14)));
    b.withKind(YK.ROCK, () => b.addGeo(new ConvexGeometry(pts), col, b._local(x, y0, z)));
    b.collide(x, y0, z, w, h * 0.95, d);
  };
  // Krater: koyu toz tabanı (çarpışmasız 2 cm), kenarda alçak kaya halkası (siper; boşluklu)
  const crater = (cx, cz, R, gaps = []) => {
    b.cyl(cx, 0, cz, R * 1.12, R * 1.12, 0.012, REG2, nk(YK.REGOLITH, { seg: 28 }));
    b.cyl(cx, 0, cz, R * 0.82, R * 0.82, 0.024, DUSTC, nk(YK.DUST, { seg: 24 }));
    const n = Math.round((2 * PI * R) / 2.3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * PI;
      if (gaps.some((g) => Math.abs(((a - g + 3 * PI) % (2 * PI)) - PI) < 0.32)) continue;
      const s = 1.3 + rng() * 0.9;
      rock(cx + Math.cos(a) * R, cz + Math.sin(a) * R, s, s * (0.8 + rng() * 0.4), 0.75 + rng() * 0.75);
    }
  };
  // Modül: beyaz gövde kabuğu (duvar 6,2 m), iç zemin plakası, çatı (kubbeli: dairesel açıklık + cam kubbe), kapı çerçeveleri + üstte ışık şeridi
  const door = (at, w = 3) => ({ at, w, b: 0, top: 3.0 });
  const module = (id, x0, x1, z0, z1, ops, domeR = 0) => b.obj('modül:' + id, () => {
    b.shell(x0, x1, z0, z1, 0, MOD_H, MOD_T, HULL, ops, k(YK.HULL));
    b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0 - MOD_T, 0.02, z1 - z0 - MOD_T, FLOOR, nk(YK.PLATE));
    b.box((x0 + x1) / 2, MOD_H - 0.35, z0 - MOD_T / 2 - 0.04, x1 - x0 + MOD_T + 0.1, 0.35, 0.08, METAL, nk(YK.METAL));      // çatı saçağı bandı (dört yüz)
    b.box((x0 + x1) / 2, MOD_H - 0.35, z1 + MOD_T / 2 + 0.04, x1 - x0 + MOD_T + 0.1, 0.35, 0.08, METAL, nk(YK.METAL));
    b.box(x0 - MOD_T / 2 - 0.04, MOD_H - 0.35, (z0 + z1) / 2, 0.08, 0.35, z1 - z0 + MOD_T, METAL, nk(YK.METAL));
    b.box(x1 + MOD_T / 2 + 0.04, MOD_H - 0.35, (z0 + z1) / 2, 0.08, 0.35, z1 - z0 + MOD_T, METAL, nk(YK.METAL));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, W = x1 - x0 + MOD_T, D = z1 - z0 + MOD_T;
    if (!domeR) b.box(cx, MOD_H, cz, W, 0.3, D, HULL2, k(YK.HULL));
    else {
      // çatı: kare levha, ortada R yarıçaplı dairesel açıklık (görsel tek parça); çarpışma = açıklığın dışındaki çerçeve + köşe kademeleri (levhanın içinde kalır)
      const sh = new THREE.Shape([new THREE.Vector2(-W / 2, -D / 2), new THREE.Vector2(W / 2, -D / 2), new THREE.Vector2(W / 2, D / 2), new THREE.Vector2(-W / 2, D / 2)]);
      const hole = new THREE.Path(); hole.absarc(0, 0, domeR, 0, 2 * PI, true); sh.holes.push(hole);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-P2);
      b.withKind(YK.HULL, () => b.addGeo(g, HULL2, b._local(cx, MOD_H, cz)));
      b.collide(cx, MOD_H, z0 - MOD_T / 2 + (D / 2 - domeR) / 2, W, 0.3, D / 2 - domeR);
      b.collide(cx, MOD_H, z1 + MOD_T / 2 - (D / 2 - domeR) / 2, W, 0.3, D / 2 - domeR);
      b.collide(x0 - MOD_T / 2 + (W / 2 - domeR) / 2, MOD_H, cz, W / 2 - domeR, 0.3, 2 * domeR);
      b.collide(x1 + MOD_T / 2 - (W / 2 - domeR) / 2, MOD_H, cz, W / 2 - domeR, 0.3, 2 * domeR);
      const q = domeR * 0.72, e = domeR - q;                                         // köşe kademesi: dairenin dışında kalan kare köşe (levha içinde)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.collide(cx + sx * (q + e / 2 + 0.02), MOD_H, cz + sz * (q + e / 2 + 0.02), e - 0.04, 0.3, e - 0.04);
      b.cyl(cx, MOD_H + 0.3, cz, domeR + 0.25, domeR + 0.25, 0.22, METAL, nk(YK.METAL, { seg: 32 }));      // kubbe bileziği (görsel, ulaşılmaz)
      domes.push([cx, cz, domeR, MOD_H + 0.52]);
    }
    // kapı çerçeveleri + ışık şeridi (iki yüzde; çarpışmasız, duvardan 6 cm taşar)
    const frame = (axis, at, c) => {
      const o = 0.06, t = MOD_T + 2 * o;
      if (axis === 'x') { for (const sx of [-1, 1]) b.box(at + sx * 1.62, 0, c, 0.24, 3.24, t, METAL, nk(YK.METAL)); b.box(at, 3.0, c, 3.48, 0.24, t, METAL, nk(YK.METAL)); b.box(at, 3.3, c, 2.4, 0.08, t + 0.02, L_CYAN, LIGHT(L_CYAN)); b.box(at, 0, c, 3.0, 0.03, t, STRIPE, nk(YK.STRIPE)); }
      else { for (const sz of [-1, 1]) b.box(c, 0, at + sz * 1.62, t, 3.24, 0.24, METAL, nk(YK.METAL)); b.box(c, 3.0, at, t, 0.24, 3.48, METAL, nk(YK.METAL)); b.box(c, 3.3, at, t + 0.02, 0.08, 2.4, L_CYAN, LIGHT(L_CYAN)); b.box(c, 0, at, t, 0.03, 3.0, STRIPE, nk(YK.STRIPE)); }
    };
    for (const o of ops.n || []) frame('x', o.at, z0);
    for (const o of ops.s || []) frame('x', o.at, z1);
    for (const o of ops.w || []) frame('z', o.at, x0);
    for (const o of ops.e || []) frame('z', o.at, x1);
    // iç tavan ışıkları (çatı altında, çarpışmasız)
    for (let x = x0 + 3; x < x1 - 2; x += 6) b.box(x, MOD_H - 0.08, cz, 1.6, 0.06, 0.4, L_WARM, LIGHT(L_WARM, 1.1));
  });
  // Hava kilidi koridoru: x0..x1 boyunca, zc ekseninde; iç genişlik 4 m, duvar 3,2 m + 0,3 m çatı (üstü 3,5 m), kaburga halkaları, tavan ışığı
  const tube = (id, x0, x1, zc, ops = {}) => b.obj('koridor:' + id, () => {
    b.wall('x', x0, x1, zc - 2.2, 0, COR_H, 0.4, HULL, ops.n || [], k(YK.HULL));
    b.wall('x', x0, x1, zc + 2.2, 0, COR_H, 0.4, HULL, ops.s || [], k(YK.HULL));
    b.box((x0 + x1) / 2, COR_H, zc, x1 - x0, 0.3, 4.8, HULL2, k(YK.HULL));
    b.box((x0 + x1) / 2, 0, zc, x1 - x0, 0.02, 4.0, FLOOR, nk(YK.PLATE));
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) {
      if ([...(ops.n || []), ...(ops.s || [])].some((o) => Math.abs(o.at - x) < o.w / 2 + 0.4)) continue;
      b.box(x, 0, zc - 2.46, 0.3, COR_H + 0.12, 0.12, METAL2, nk(YK.METAL)); b.box(x, 0, zc + 2.46, 0.3, COR_H + 0.12, 0.12, METAL2, nk(YK.METAL));
      b.box(x, COR_H + 0.3, zc, 0.3, 0.06, 5.04, METAL2, nk(YK.METAL));
    }
    b.box((x0 + x1) / 2, COR_H - 0.06, zc, x1 - x0 - 1, 0.05, 0.3, L_CYAN, LIGHT(L_CYAN, 1.0));
    for (const o of [...(ops.n || []).map((o) => [o, zc - 2.2]), ...(ops.s || []).map((o) => [o, zc + 2.2])]) {
      const [op, c] = o;
      for (const sx of [-1, 1]) b.box(op.at + sx * (op.w / 2 + 0.12), 0, c, 0.24, 3.24, 0.52, METAL, nk(YK.METAL));
      b.box(op.at, 3.0, c, op.w + 0.48, 0.2, 0.52, METAL, nk(YK.METAL)); b.box(op.at, 0, c, op.w, 0.03, 0.52, STRIPE, nk(YK.STRIPE));
    }
  });
  // İskele güvertesi (ızgara, 3,5 m), köşe payandaları (birebir kutular), iki yanda korkuluk (1 m; uçlarda açıklık)
  const deck = (x0, x1, z0, z1, rails = { w: true, e: true }) => {
    b.box((x0 + x1) / 2, DECK - 0.3, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, GRATE, k(YK.GRATE));
    for (const x of [x0 + 0.2, x1 - 0.2]) for (let z = z0 + 0.2; z <= z1 - 0.2 + 1e-6; z += Math.max(2, (z1 - z0 - 0.4) / Math.ceil((z1 - z0 - 0.4) / 5))) b.box(x, 0, z, 0.3, DECK - 0.3, 0.3, METAL, k(YK.METAL));
    if (rails.w) b.box(x0 + 0.05, DECK, (z0 + z1) / 2, 0.1, 1.0, z1 - z0, METAL2, k(YK.METAL));
    if (rails.e) b.box(x1 - 0.05, DECK, (z0 + z1) / 2, 0.1, 1.0, z1 - z0, METAL2, k(YK.METAL));
    b.box(x0 + 0.05, DECK + 0.98, (z0 + z1) / 2, 0.14, 0.06, z1 - z0, STRIPE, nk(YK.STRIPE));
    b.box(x1 - 0.05, DECK + 0.98, (z0 + z1) / 2, 0.14, 0.06, z1 - z0, STRIPE, nk(YK.STRIPE));
  };
  // Kargo konteyneri / sandık (tek kutu, kaburgalı gölgelendirici), üstte ışık şeridi
  const crate = (x, z, w, h, d, col = CRATE[Math.floor(rng() * 4)]) => {
    b.box(x, 0, z, w, h, d, col, k(YK.CRATE));
    b.box(x, h, z, w * 0.6, 0.04, 0.12, L_ORANGE, LIGHT(L_ORANGE, 1.0));
  };

  // ───────── zemin + çevre krater duvarı ─────────
  b.box(0, -0.6, 0, 400, 0.6, 360, REG, nk(YK.REGOLITH));
  const B = YORUNGE_BOUNDS;
  // krater duvarı: sınırın dışında 8–12 m kaya blokları (iç yüz = sınır), arkada daha yüksek ikinci kademe (silüet)
  const cliff = (x0, x1, z0, z1, along, tiers) => {
    tiers.forEach(([h0, h1, inset], ti) => {
      let a = along === 'x' ? x0 : z0; const end = along === 'x' ? x1 : z1;
      while (a < end - 0.01) {
        const w = Math.min(end - a, 3 + rng() * 5), h = h0 + rng() * (h1 - h0), ins = ti ? inset : -rng() * 1.6;      // ön kademe: blok başına 0–1,6 m içeri taşma (düz duvar gibi durmasın; çarpışma = taban)
        if (along === 'x') { const zz0 = z0 < 0 ? z0 - ins : z0 + ins, zz1 = z0 < 0 ? z1 - ins : z1 + ins; rock(a + w / 2, (zz0 + zz1) / 2, w + 0.02, Math.abs(zz1 - zz0), h); }
        else { const xx0 = x0 < 0 ? x0 - ins : x0 + ins, xx1 = x0 < 0 ? x1 - ins : x1 + ins; rock((xx0 + xx1) / 2, a + w / 2, Math.abs(xx1 - xx0), w + 0.02, h); }
        a += w;
      }
    });
  };
  cliff(B.minX - 12, B.maxX + 12, B.minZ - 8, B.minZ, 'x', [[6.5, 13, 0], [13, 22, 7]]);
  cliff(B.minX - 12, B.maxX + 12, B.maxZ, B.maxZ + 8, 'x', [[6.5, 13, 0], [13, 22, 7]]);
  cliff(B.minX - 8, B.minX, B.minZ, B.maxZ, 'z', [[6.5, 13, 0], [13, 22, 7]]);
  cliff(B.maxX, B.maxX + 8, B.minZ, B.maxZ, 'z', [[6.5, 13, 0], [13, 22, 7]]);

  // ───────── MERKEZ MODÜL (x ±12, z ±12): cam kubbe, reaktör çekirdeği, kuzey + güney asma kat ─────────
  module('merkez', -12, 12, -12, 12, { w: [door(3)], e: [door(3)], n: [door(0, 3.2)], s: [door(0, 3.2)] }, 7.5);
  b.obj('merkez:çekirdek', () => {
    b.box(0, 0, 0, 5.6, 0.5, 5.6, METAL, k(YK.METAL));                                     // kaide
    b.box(0, 0.5, 0, 4.4, 4.0, 4.4, HULL2, k(YK.HULL));                                    // çekirdek gövdesi (4,5 m; kubbe altından görünür)
    for (const sx of [-1, 1]) { b.box(sx * 2.22, 1.0, 0, 0.06, 3.0, 0.5, L_CYAN, LIGHT(L_CYAN, 1.6)); b.box(0, 1.0, sx * 2.22, 0.5, 3.0, 0.06, L_CYAN, LIGHT(L_CYAN, 1.6)); }
    b.box(0, 4.5, 0, 3.2, 0.25, 3.2, L_CYAN, { ...LIGHT(L_CYAN, 1.8), collide: true });    // ışıyan tepe (çekirdeğin üstü, birebir)
  });
  for (const sz of [-1, 1]) {                                                              // asma katlar (z ±8 … ±11,75), 3,5 m; merdiven x = ±6,5
    const z0 = sz < 0 ? -11.75 : 8, z1 = sz < 0 ? -8 : 11.75;
    b.box(0, DECK - 0.3, (z0 + z1) / 2, 23.5, 0.3, z1 - z0, GRATE, k(YK.GRATE));
    for (const x of [-11, -4.5, 4.5, 11]) b.box(x, 0, sz * 8.2, 0.35, DECK - 0.3, 0.35, METAL, k(YK.METAL));
    const ez = sz * 8.05;
    for (const [xa, xb] of [[-11.75, -7.5], [-5.5, 5.5], [7.5, 11.75]]) b.box((xa + xb) / 2, DECK, ez, xb - xa, 1.0, 0.1, METAL2, k(YK.METAL));     // korkuluk (merdiven başlarında açık)
    b.box(0, DECK + 0.98, ez, 23.5, 0.05, 0.14, STRIPE, nk(YK.STRIPE));
    for (const sx of [-1, 1]) b.stairs(sx * 6.5, sz * 2.0, 0, sz < 0 ? '-z' : '+z', 1.9, 14, 0.25, 0.43, METAL2, { tag: 'stair' });
  }
  for (const [x, z] of [[-9.0, -4.5], [9.0, -4.5], [-3.8, 6.8], [3.8, 6.8]]) crate(x, z, 1.4, 1.1, 1.4);
  co('Merkez Modül', 0, 0, true); co('Reaktör', 0, 3.5); co('Kuzey Asma Kat', 0, -10); co('Güney Asma Kat', 0, 10);

  // ───────── iki yarı (s = −1 Mavi / batı, +1 Kırmızı / doğu), x'te ayna ─────────
  const spawnPts = {}, zones = {};
  for (const s of [-1, 1]) {
    const team = s < 0 ? 'blue' : 'red', TC = TEAM_COL[team], X = (x) => s * x, xr = (a, c) => (s < 0 ? [-c, -a] : [a, c]);
    const side = (name) => (s < 0 ? 'Batı ' : 'Doğu ') + name;
    // Hangar (doğuş): x 44…56, z ±10; iç kapı koridora, kuzey / güney kapıları dışarı; kapıların arkasında perde duvar (içerisi dışarıdan görünmez)
    {
      const [x0, x1] = xr(44, 56), innerW = s < 0 ? 'e' : 'w';
      module('hangar-' + team, x0, x1, -10, 10, { [innerW]: [door(0)], n: [door(X(48), 3.2)], s: [door(X(48), 3.2)] });
      b.obj('hangar-perde-' + team, () => {
        b.box(X(48.2), 0, -6.8, 5.0, 3.2, 0.4, HULL2, k(YK.HULL)); b.box(X(48.2), 0, 6.8, 5.0, 3.2, 0.4, HULL2, k(YK.HULL));
        b.box(X(46.6), 0, 0, 0.4, 3.2, 5.6, HULL2, k(YK.HULL));
        for (const z of [-6.8, 6.8]) b.box(X(48.2), 2.6, z + (z < 0 ? -0.22 : 0.22), 5.0, 0.3, 0.04, TC, nk(YK.PANEL));
        b.box(X(46.6) + s * 0.22, 2.6, 0, 0.04, 0.3, 5.6, TC, nk(YK.PANEL));
      });
      for (const z of [-9.0, 9.0]) for (const x of [52.5, 54.5]) crate(X(x), z, 1.6, 1.2, 1.2);
      b.box(X(55.72), 1.0, 0, 0.06, 0.8, 14, TC, LIGHT(TC, 0.9));                          // arka duvarda takım rengi ışık bandı
      spawnPts[team] = [];
      for (let x = 48.0; x <= 54.6; x += 1.6) for (let z = -5.2; z <= 5.21; z += 1.6) if (!(x < 49.4 && Math.abs(z) < 3.4)) spawnPts[team].push({ x: +X(x).toFixed(2), z: +z.toFixed(2), ry: s < 0 ? -P2 : P2 });
      zones[team] = { minX: Math.min(X(44), X(56)), maxX: Math.max(X(44), X(56)), minZ: -10, maxZ: 10 };
      co((s < 0 ? 'Mavi' : 'Kırmızı') + ' Hangar', X(50), 0, true);
    }
    // Koridor A (hangar ↔ Lab), z = 0; güneyde hava kilidi kapısı
    { const [x0, x1] = xr(33.25, 43.75); tube('A-' + team, x0, x1, 0, { s: [door(X(38.5), 2.4)] }); co(side('Hava Kilidi'), X(38.5), 0); }
    // Lab modülü (x 21…33, z ±6): dört kapı (hat kavşağı); içeride konsollar
    {
      const [x0, x1] = xr(21, 33), wIn = s < 0 ? 'e' : 'w', wOut = s < 0 ? 'w' : 'e';
      module('lab-' + team, x0, x1, -6, 6, { [wIn]: [door(3)], [wOut]: [door(0)], n: [door(X(27))], s: [door(X(27))] }, 4.2);
      b.obj('lab-konsol-' + team, () => {
        b.box(X(27), 0, -1.2, 3.2, 1.0, 1.0, METAL2, k(YK.METAL)); b.box(X(27), 1.0, -1.2, 3.0, 0.05, 0.8, L_CYAN, LIGHT(L_CYAN, 1.2));
        b.box(X(30.4), 0, 3.6, 1.0, 1.3, 2.4, METAL2, k(YK.METAL)); b.box(X(23.6), 0, -3.8, 1.0, 1.3, 2.0, METAL2, k(YK.METAL));
      });
      co(side('Lab'), X(27), 0, true);
    }
    // Koridor B (Lab ↔ Merkez), z = 3; çatısı kuzey ↔ güney köprüsünün parçası (3,5 m)
    {
      const [x0, x1] = xr(12.25, 20.75); tube('B-' + team, x0, x1, 3);
      const [r0, r1] = xr(14.4, 17.6);
      for (const zz of [0.62, 5.38]) {                                                     // çatı kenarı korkuluğu (iskele birleşimlerinde açık)
        for (const [a, c] of [[x0, r0], [r1, x1]]) b.box((a + c) / 2, DECK, zz, c - a, 1.0, 0.1, METAL2, k(YK.METAL));
      }
      co(side('Köprü'), X(16), 3);
    }
    // Kuzey + güney iskele (x 14,5…17,5): güverte 3,5 m, merdiven dış uçta
    {
      const [x0, x1] = xr(14.5, 17.5);
      deck(x0, x1, -14, 0.6); b.stairs(X(16), -20.02, 0, '+z', 2.4, 14, 0.25, 0.43, METAL2, { tag: 'stair' });
      deck(x0, x1, 5.4, 14); b.stairs(X(16), 20.02, 0, '-z', 2.4, 14, 0.25, 0.43, METAL2, { tag: 'stair' });
      co(side('Kuzey İskele'), X(16), -10); co(side('Güney İskele'), X(16), 10);
    }
    // ── KUZEY HAT ──
    crater(X(21), -28, 6.2, [s < 0 ? 0 : PI, -P2 * 0.5 + (s < 0 ? 0 : PI)]);
    co(side('Krater'), X(21), -28);
    for (const z of [-35.5, -30.0, -24.5]) b.obj('panel-' + team + z, () => {               // güneş paneli tarlası: 3 sıra; batarya dolabı (siper) + eğik panel (2,05 m üstü; altından geçilir)
      const [x0, x1] = xr(32, 43), cx = (x0 + x1) / 2, L = x1 - x0;
      b.box(cx, 0, z, L - 1.0, 1.05, 0.9, METAL2, k(YK.METAL));
      b.box(cx, 1.05, z - 0.46, L - 1.2, 0.06, 0.04, L_CYAN, LIGHT(L_CYAN, 0.8));
      for (const x of [x0 + 0.3, x1 - 0.3]) b.box(x, 0, z, 0.2, 2.05, 0.2, METAL, k(YK.METAL));
      const tilt = 0.26, D = 2.0, th = 0.08;
      b.box(cx, 2.05 + Math.sin(tilt) * D / 2, z, L, th, D, SOLAR, nk(YK.SOLAR, { rx: tilt }));
      for (let i = 0; i < 3; i++) {                                                     // çarpışma: eğik levha 3 kademede (levhanın içinde)
        const zc = z - D / 2 + (i + 0.5) * (D / 3), yc = 2.05 + Math.sin(tilt) * D / 2 - Math.tan(tilt) * (zc - z);
        b.collide(cx, yc - Math.tan(tilt) * D / 6, zc, L, th + Math.tan(tilt) * D / 3, D / 3);
      }
    });
    co(side('Güneş Tarlası'), X(37.5), -30);
    for (const [x, z, w, d, h] of [[26.5, -17.5, 4.5, 2.6, 2.6], [30.0, -18.6, 3.0, 2.2, 1.8], [23.4, -16.8, 2.2, 1.8, 1.4], [9.5, -19.5, 2.4, 2.0, 1.3], [45.5, -22.0, 3.2, 2.4, 2.2], [52.0, -26.5, 4.0, 3.0, 2.8], [51.0, -33.5, 2.4, 2.0, 1.5]]) rock(X(x), z, w, d, h);
    co(side('Kaya Sırtı'), X(27), -18);
    for (const [x, z] of [[40.5, -14.2], [44.0, -15.6], [34.8, -13.0]]) crate(X(x), z, 1.6, 1.2, 1.6);
    // ── GÜNEY HAT ──
    crater(X(38), 28.5, 5.2, [s < 0 ? 0 : PI, P2]);
    co(side('Güney Krater'), X(38), 28.5);
    b.obj('rover-' + team, () => {                                                          // ay aracı: şasi + kabin + tekerlekler (birebir kutular), altı 0,5 m (yüzüstü geçilmez: tekerlekler kapatır)
      const x = X(22.5), z = 23.5;
      b.box(x, 0.55, z, 2.4, 0.5, 4.4, HULL2, k(YK.HULL)); b.box(x, 1.05, z + 0.6, 2.2, 0.9, 1.8, HULL, k(YK.HULL));
      b.box(x, 1.5, z - 0.35, 2.0, 0.42, 0.06, '#26313d', nk(YK.PANEL));
      for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) b.box(x + sx * 1.32, 0, z + sz, 0.36, 1.0, 1.0, '#2d3034', k(YK.METAL));
      b.box(x, 1.95, z + 1.2, 0.08, 1.2, 0.08, METAL, nk(YK.METAL)); b.box(x, 3.1, z + 1.2, 0.5, 0.05, 0.5, L_ORANGE, LIGHT(L_ORANGE, 1.2));
    });
    co(side('Ay Aracı'), X(22.5), 23.5);
    for (const [x, z, w, h, d] of [[9.5, 17.0, 2.4, 2.2, 2.4], [11.5, 34.5, 2.4, 1.2, 4.8], [30.5, 18.2, 4.8, 2.4, 2.4], [43.5, 15.5, 2.4, 1.2, 2.4], [47.0, 33.0, 4.8, 2.4, 2.4]]) crate(X(x), z, w, h, d);
    for (const [x, z, w, d, h] of [[27.5, 33.5, 3.6, 2.6, 2.2], [30.8, 36.2, 2.6, 2.0, 1.4], [53.0, 25.5, 3.4, 2.6, 2.6], [52.5, 17.5, 2.2, 1.8, 1.4], [16.5, 36.5, 3.0, 2.2, 1.8]]) rock(X(x), z, w, d, h);
    // ışık direkleri (direk kendi kutusu; lamba çarpışmasız, ulaşılmaz)
    for (const [x, z] of [[33, -12], [33, 12], [12.5, 19.5]]) {
      b.box(X(x), 0, z, 0.24, 6.6, 0.24, METAL, k(YK.METAL)); b.box(X(x), 6.6, z, 0.9, 0.18, 0.5, METAL, nk(YK.METAL)); b.box(X(x), 6.52, z, 0.7, 0.06, 0.36, L_WARM, LIGHT(L_WARM, 1.6));
    }
  }

  // ───────── ANTEN İSTASYONU (kuzey orta, x ±4,5, z −31…−24): çatı 4 m, iki yandan merdiven, ortada anten direği ─────────
  b.obj('anten', () => {
    b.box(0, 0, -27.5, 9, 4.0, 7, HULL, k(YK.HULL));
    b.box(0, 3.98, -27.5, 8.8, 0.03, 6.8, GRATE, nk(YK.GRATE));
    for (const sz of [-1, 1]) b.box(0, 4.0, -27.5 + sz * 3.45, 9, 0.6, 0.1, METAL2, k(YK.METAL));                 // korkuluk duvarı (n / s)
    for (const sx of [-1, 1]) for (const [za, zb] of [[-31, -28.75], [-26.25, -24]]) b.box(sx * 4.45, 4.0, (za + zb) / 2, 0.1, 0.6, zb - za, METAL2, k(YK.METAL));   // e / w (merdiven başında açık)
    for (const sx of [-1, 1]) b.stairs(sx * 10.58, -27.5, 0, sx < 0 ? '+x' : '-x', 2.4, 16, 0.25, 0.38, METAL2, { tag: 'stair' });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 0.7, 4.0, -27.5 + sz * 0.7, 0.16, 14, 0.16, METAL, k(YK.METAL));   // anten direği bacakları (birebir); çaprazlar süs
    for (let y = 5.0; y < 18; y += 1.6) { b.box(0, 4 + y - 4, -26.8, 1.56, 0.08, 0.08, METAL, nk(YK.METAL)); b.box(0, 4 + y - 4, -28.2, 1.56, 0.08, 0.08, METAL, nk(YK.METAL)); b.box(0.7, 4 + y - 4, -27.5, 0.08, 0.08, 1.56, METAL, nk(YK.METAL)); b.box(-0.7, 4 + y - 4, -27.5, 0.08, 0.08, 1.56, METAL, nk(YK.METAL)); }
    b.box(0, 18.0, -27.5, 0.3, 0.3, 0.3, '#ff3b30', LIGHT('#ff3b30', 2.2));
    b.box(3.0, 4.0, -29.6, 1.4, 0.8, 1.2, METAL2, k(YK.METAL));                                                // çanak kaidesi (siper)
    b.cyl(3.0, 5.2, -29.6, 1.3, 0.25, 0.5, HULL2, nk(YK.HULL, { rx: 0.8, seg: 14 }));
    for (const sx of [-1, 1]) b.box(sx * 2.0, 0, -23.96, 1.6, 2.4, 0.06, METAL, nk(YK.METAL));                  // kapalı servis kapıları (süs)
  });
  co('Anten İstasyonu', 0, -27.5, true);
  rock(-6.5, -35.6, 2.2, 1.8, 1.3); rock(7.0, -35.2, 1.8, 1.6, 1.0); rock(0.5, -36.4, 1.4, 1.2, 0.8);

  // ───────── İNİŞ PİSTİ + MEKİK (güney orta) ─────────
  b.obj('pist', () => {
    b.box(0, 0, 26, 24, 0.35, 12, PADC, k(YK.PAD)); b.box(0, 0, 26, 12, 0.35, 22, PADC, k(YK.PAD));
    for (const [w, d] of [[24.1, 0.3], [0.3, 12.1]]) { b.box(0, 0.35, 20.15, w, 0.012, d, STRIPE, nk(YK.STRIPE)); b.box(0, 0.35, 31.85, w, 0.012, d, STRIPE, nk(YK.STRIPE)); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * 11.6, 0.35, 26 + sz * 5.6, 0.25, 0.05, 0.25, L_ORANGE, LIGHT(L_ORANGE, 1.6));
  });
  b.obj('mekik', () => {
    const y0 = 0.35, z0 = 21.5, z1 = 31.0;
    b.box(0, y0 + 0.75, (z0 + z1) / 2, 3.4, 2.1, z1 - z0, HULL, k(YK.HULL));                 // gövde (altı 0,75 m: yüzüstü geçilir)
    b.box(0, y0 + 0.75, z0 - 1.1, 2.6, 1.6, 2.2, HULL, k(YK.HULL));                          // burun kademesi
    b.box(0, y0 + 1.55, z0 - 2.23, 2.0, 0.5, 0.1, '#1b2733', { collide: false, o: { roughness: 0.15, metalness: 0.5 } });   // kokpit camı (burun kutusunun içinde, süs)
    for (const sx of [-1, 1]) {
      b.box(sx * 2.7, y0 + 1.05, 28.6, 2.0, 0.3, 4.4, HULL2, k(YK.HULL));                   // kanat kademeleri (gövde üstüne çıkış basamağı)
      b.box(sx * 4.5, y0 + 1.05, 29.6, 1.6, 0.3, 2.6, HULL2, k(YK.HULL));
      b.box(sx * 5.18, y0 + 1.35, 30.2, 0.25, 0.9, 1.4, ORANGE, k(YK.PANEL));
      for (const zz of [23.5, 29.8]) b.box(sx * 1.1, y0, zz, 0.3, 0.75, 0.3, METAL, k(YK.METAL));   // iniş takımı
    }
    for (const sx of [-1, 1]) { b.box(sx * 0.95, y0 + 1.0, z1 + 0.45, 1.3, 1.3, 0.9, METAL, k(YK.METAL)); b.box(sx * 0.95, y0 + 1.15, z1 + 0.92, 1.0, 1.0, 0.04, L_CYAN, LIGHT(L_CYAN, 2.0)); }
    b.box(0, y0 + 2.85, 27.5, 1.2, 0.05, 4.0, ORANGE, nk(YK.PANEL));                          // sırt şeridi
  });
  co('İniş Pisti', 0, 26, true); co('Mekik', 0, 25);
  for (const [x, z, w, h, d] of [[-7.5, 17.4, 2.4, 1.2, 1.6], [7.5, 17.4, 2.4, 1.2, 1.6]]) crate(x, z, w, h, d);

  // ───────── dış silüet (çarpışmasız, sınır dışı): uzak krater kenarı ─────────
  const nCol = b.colliders.length;
  b.withKind(YK.ROCK, () => {
    for (let a = 0; a < 30; a++) {
      const ang = a / 30 * PI * 2 + rng() * 0.1, R = 120 + rng() * 40, r = 26 + rng() * 18;
      b.ico(Math.cos(ang) * R * 1.15, -2, Math.sin(ang) * R * 0.95, r, ROCKC[a % 4], { ry: rng() * 6.3, scale: [1, (10 + rng() * 14) / r, 0.8 + rng() * 0.4] });
    }
  });
  b.colliders.length = nCol;

  const group = b.build();
  if (typeof document !== 'undefined' && !MapBuilder.noVisual) {
    spaceSky(group);
    // cam kubbeler: yarım küre cam + 6 meridyen kaburgası + orta bilezik
    const glass = new THREE.MeshStandardMaterial({ color: '#cfeeff', transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide, emissive: '#2a5274', emissiveIntensity: 0.35 });
    const ribM = new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.45, metalness: 0.6, flatShading: true });
    for (const [cx, cz, R, y] of domes) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 10, 0, 2 * PI, 0, P2), glass); m.position.set(cx, y, cz); m.renderOrder = 3; group.add(m);
      const ribs = [];
      for (let i = 0; i < 3; i++) { const t = new THREE.TorusGeometry(R + 0.02, 0.07, 4, 20, PI); t.rotateY((i / 3) * PI); ribs.push(t); }
      const ring = new THREE.TorusGeometry(R * Math.cos(0.6) + 0.02, 0.06, 4, 32); ring.rotateX(P2); ring.translate(0, R * Math.sin(0.6), 0); ribs.push(ring);
      for (const g of ribs) { const mm = new THREE.Mesh(g, ribM); mm.position.set(cx, y, cz); mm.castShadow = true; group.add(mm); }
    }
    const add = (m, x, y, z, ry = 0) => { m.position.set(x, y, z); m.rotation.set(0, ry, 0); m.renderOrder = 2; group.add(m); return m; };
    const sign = { fg: '#1e2329', font: 'bold 160px Arial, sans-serif' };
    add(textPlane('MERKEZ', 4.2, 0.8, sign), 0, 4.0, -12.27, PI); add(textPlane('MERKEZ', 4.2, 0.8, sign), 0, 4.0, 12.27, 0);
    for (const s of [-1, 1]) {
      add(textPlane(s < 0 ? 'LAB-1' : 'LAB-2', 2.6, 0.7, sign), s * 27, 4.0, -6.27, PI); add(textPlane(s < 0 ? 'LAB-1' : 'LAB-2', 2.6, 0.7, sign), s * 27, 4.0, 6.27, 0);
      const tc = s < 0 ? '#2f6fd6' : '#d0443a', nm = s < 0 ? 'MAVİ ÜS' : 'KIZIL ÜS';
      add(textPlane(nm, 4.6, 1.0, { fg: tc, font: 'bold 200px Arial, sans-serif' }), s * 48, 4.2, -10.27, PI); add(textPlane(nm, 4.6, 1.0, { fg: tc, font: 'bold 200px Arial, sans-serif' }), s * 48, 4.2, 10.27, 0);
    }
  }

  return {
    id: 'yorunge',
    name: 'Yörünge Üssü',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: YORUNGE_BOUNDS,
    layered: true,                                                   // iskele / asma kat / merdiven: yol bulma hücre başına zemin kotu tutar
    callouts,
    mini: { bg: '#4a4a48', ground: [140, 139, 135], wall: '#2a2c30', mid: '#55585c', low: '#76777a', roof: 'rgba(40,44,50,0.45)' },
    spawns: spawnPts,
    baseZones: zones,
    objectives: [],
    roads: [],
    space: true,
    forceTod: 'day',                                                // gün saati / hava yok: hep aynı uzay ışığı (gece / gün batımı ön ayarları göğü boyardı)
    env: {
      sky: ['#000003', '#020309', '#06070d'], fog: ['#06070c', 160, 520],
      sun: ['#fffaf0', 3.0], hemi: ['#9aa6bd', '#3a3a3c', 0.85], cloud: '#000000', clouds: 0,
      sunPos: SUN_POS,
      grade: { exposure: 1.0, tint: [1.0, 1.0, 1.02], sat: 1.0, contrast: 1.08, vig: 0.18, bloom: 0.16, thr: 1.2 },
    },
  };
}
