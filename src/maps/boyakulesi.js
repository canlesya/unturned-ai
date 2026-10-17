import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MapBuilder, makeRng } from './builder.js';
import { KIND } from './surface.js';

// Boya Kulesi — Paintball (herkes tek) haritası, ~52×52 m, üç kat (Unturned paintball haritasından esinli, yükseklik hissi ön planda).
//   Zemin (0 m): şişme paintball siperleri (dorito / fıçı / yılan / küp), ortada kule çevresinde r 11 m, 28 m derin KUYU (düşen elenir).
//   Orta kat (9 m): köşelerde 4 renkli kale (turuncu KB, mor KD, turkuaz GD, mavi GB) direkler üstünde; her kalenin kanadından kuleye korkuluksuz,
//   kuyunun üstünden geçen dar köprü (fırıldak düzeni: köprüler eksen hizalı, çarpışma birebir). Yalnız kuzey (turuncu↔mor) ve doğu (mor↔turkuaz)
//   kenarında ince iskele yolu (bilinçli asimetri). Turuncu ve turkuaz kalenin önünde zıplama minderi (zeminden kaleye fırlatır).
//   Kule (8×8, 18 m, daralan): 9 m giriş katı (4 köprü kapısı), iç merdiven → 13,5 m balkon (+ mor kanada inen basamaklı yol), iç merdiven → 18 m TEPE.
// Koordinat: −z kuzey, +x doğu. Her kale kanonik (turuncu) çerçevede kurulur, b.with(…, −k·90°) ile döndürülür (eksen hizası korunur).

export const BK_BOUNDS = { minX: -25.9, maxX: 25.9, minZ: -25.9, maxZ: 25.9 };
const E = 25.5, PIT_R = 11, PIT_D = 28, DECK = 9;
export const BK = { pitR: PIT_R, pitD: PIT_D, deck: DECK, voidY: -5, tepe: { x: 0, y: 18, z: 0, r: 3 } };

const FORTS = [                                                   // k: dönüş (kanonik turuncu KB → saat yönünde)
  { k: 0, name: 'Turuncu Kale', c: '#ff7a1a', d: '#c4500a', pad: true },
  { k: 1, name: 'Mor Kale', c: '#9b4dff', d: '#6a2cc0', pad: false },
  { k: 2, name: 'Turkuaz Kale', c: '#12c2ad', d: '#0a8476', pad: true },
  { k: 3, name: 'Mavi Kale', c: '#2f7bff', d: '#1b4fb8', pad: false },
];
const rotXZ = (k, x, z) => { for (let i = 0; i < k; i++) [x, z] = [-z, x]; return [x, z]; };   // kanonik → dünya (k × 90°)

const WOOD = '#b9a07e', WOOD_D = '#76593c', PLY = '#d9b27a', CONC = '#ece8de', STEEL = '#3a3f4a';
const SOFT = { flatShading: false, roughness: 0.42 };           // şişme siper vinili: yumuşak gölgeli, hafif parlak
const INFL = ['#ffd23a', '#ff4fa3', '#8be03a', '#ff4040', '#2fd2ff', '#f6f6f2', '#ff9b2f', '#b05cff'];

// ───────── kuyu: zemin 0, r < PIT_R içinde −28 (yürüme fiziği / mermi / yol bulma bunu okur) ─────────
class PitTerrain {
  constructor(r, d) { this.r = r; this.d = d; this.deepWater = -1e9; this.navMin = -2; }   // fizik: kuyuya yürünür (su yok); yol bulma: −2 m altı kapalı (NavGridML navMin)
  heightAt(x, z) { return x * x + z * z < this.r * this.r ? -this.d : 0; }
  slopeAt(x, z, e = 0.5) { const h = (a, b) => this.heightAt(a, b); return Math.hypot(h(x + e, z) - h(x - e, z), h(x, z + e) - h(x, z - e)) / (2 * e); }
  wallAt(x, z, y) { return this.heightAt(x, z) > y + 0.5; }           // kuyu duvarı: içeriden kenara geri tırmanılmaz (World.move)
  raycast(o, d, maxT, out) {
    const r2 = this.r * this.r, D = this.d;
    out.normal ||= new THREE.Vector3();
    let tIn = -1;
    if (o.y >= 0) {
      if (d.y >= -1e-6) return null;
      const t = -o.y / d.y;
      if (t >= maxT) return null;
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if (x * x + z * z >= r2) { out.t = t; out.normal.set(0, 1, 0); return out; }                 // çim zemin
      tIn = t;
    } else if (o.x * o.x + o.z * o.z < r2) tIn = 0; else return null;
    let best = maxT, n = null;
    if (d.y < -1e-6) { const tf = (-D - o.y) / d.y; if (tf > tIn && tf < best) { best = tf; n = [0, 1, 0]; } }    // kuyu tabanı
    const a = d.x * d.x + d.z * d.z;
    if (a > 1e-9) {                                                                                     // kuyu duvarı (içeriden): silindirden çıkış
      const bq = 2 * (o.x * d.x + o.z * d.z), c = o.x * o.x + o.z * o.z - r2, disc = bq * bq - 4 * a * c;
      if (disc >= 0) {
        const tw = (-bq + Math.sqrt(disc)) / (2 * a), y = o.y + d.y * tw;
        if (tw > tIn && tw < best && y <= 0 && y >= -D) { best = tw; const x = o.x + d.x * tw, z = o.z + d.z * tw; n = [-x / this.r, 0, -z / this.r]; }
      }
    }
    if (!n) return null;
    out.t = best; out.normal.set(n[0], n[1], n[2]);
    return out;
  }
}

// ───────── şişme siperler (görsel yumuşak; çarpışma görselin İÇİNDE kalan kutular: görünmez engel yok, vinile en çok ~0,15 m girilir) ─────────
function can(b, x, z, r, h, color, stripe = '#ffffff') {
  const hc = h - r * 0.35;
  b.addGeo(new THREE.CylinderGeometry(r, r * 1.03, hc, 26), color, b._local(x, hc / 2, z), SOFT);
  const dome = new THREE.SphereGeometry(r, 26, 7, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.35, 1);
  b.addGeo(dome, color, b._local(x, hc, z), SOFT);
  b.addGeo(new THREE.CylinderGeometry(r * 1.015, r * 1.03, 0.16, 26, 1, true), stripe, b._local(x, hc * 0.62, z), SOFT);
  const a = r * 0.707, w = r * 0.42, l = Math.sqrt(r * r - w * w);
  b.collide(x, 0, z, a * 2, hc + 0.24 * r, a * 2);
  b.collide(x, 0, z, l * 2 * 0.98, hc + 0.1 * r, w * 2);
  b.collide(x, 0, z, w * 2, hc + 0.1 * r, l * 2 * 0.98);
}
// "Dorito": üçgen kesitli şişme prizma (3 dilimli silindir, yumuşak gölge → kabarık). alongX: uzun ekseni x boyunca
function dorito(b, x, z, len, H, color, alongX = true) {
  const rho = H / 1.5, hw0 = (Math.sqrt(3) * rho) / 2;
  b.with(x, 0, z, alongX ? 0 : Math.PI / 2, () => {
    const g = new THREE.CylinderGeometry(rho, rho, len, 3, 1, false, Math.PI / 2);
    b.addGeo(g, color, b._local(0, rho / 2, 0, 0, 0, Math.PI / 2), SOFT);
    b.collide(0, 0, 0, len - 0.1, H * 0.42, hw0 * 2 * 0.55);           // alt dilim (görselin içinde)
    b.collide(0, 0, 0, len - 0.1, H * 0.74, hw0 * 2 * 0.24);           // üst dilim
  });
}
// Yılan / küp: yuvarlatılmış kutu (köşe yarıçapı küçük → çarpışma = kutu)
function pillow(b, x, z, w, h, d, color, rr = 0.18) {
  b.addGeo(new RoundedBoxGeometry(w, h, d, 3, rr), color, b._local(x, h / 2, z), SOFT);
  b.collide(x, 0, z, w - rr * 0.6, h - rr * 0.3, d - rr * 0.6);
}

// ───────── yardımcılar ─────────
const NC = { collide: false };
const wood = (b, x, y, z, w, h, d, color = WOOD, tag) => b.box(x, y, z, w, h, d, color, { kind: KIND.WOOD, ...(tag ? { tag } : {}) });
const deck = (b, x0, x1, z0, z1, top = DECK, color = WOOD) => wood(b, (x0 + x1) / 2, top - 0.3, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, color, 'plat');
const post = (b, x, z, top, color = WOOD_D) => wood(b, x, 0, z, 0.36, top, 0.36, color);
// Açık merdiven (basamak = 0,3 m kalın tabla, köşeden köşeye değer → kesintisiz basamak şeridi). dir: '+x' '-x' '+z' '-z'
function treadStair(b, x, z, y0, dir, width, n, rise, run, color, trim) {
  const horiz = dir[1] === 'x', sg = dir[0] === '+' ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const s = sg * (i * run + run / 2), top = y0 + (i + 1) * rise, cx = horiz ? x + s : x, cz = horiz ? z : z + s;
    const th = Math.min(0.3, top);
    wood(b, cx, top - th, cz, horiz ? run : width, th, horiz ? width : run, color, 'plat');
    if (trim) b.box(horiz ? cx + sg * (run / 2 - 0.03) : cx, top - 0.06, horiz ? cz : cz + sg * (run / 2 - 0.03), horiz ? 0.06 : width, 0.062, horiz ? width : 0.06, trim, NC);   // burun şeridi (tabla içinde)
  }
}

// ───────── kanonik kale (turuncu, KB). Yapılar: ana güverte, kanat, köprü, zemin merdiveni, kulübe, siperler ─────────
function fort(b, F) {
  const C = F.c, Dk = F.d, L = '#' + new THREE.Color(C).lerp(new THREE.Color('#ffffff'), 0.12).getHexString();      // siperler: kale rengi (uzaktan hangi kale olduğu okunur)
  // ana güverte x −25,5…−15, z −25,5…−15; direkler
  deck(b, -E, -15, -E, -15);
  for (const px of [-25.15, -20.25, -15.35]) for (const pz of [-25.15, -20.25, -15.35]) post(b, px, pz, DECK - 0.3);
  // kenar bantları (tabla yüzü, rengi kale) — tablanın içinde, çarpışmasız
  b.box(-20.25, DECK - 0.3, -15.02, 10.46, 0.3, 0.04, C, NC); b.box(-15.02, DECK - 0.3, -20.25, 0.04, 0.3, 10.46, C, NC);
  // dış duvarlar (harita kenarı): 1,6 m, atlanamaz
  b.box(-20.25, DECK, -E + 0.15, 10.5, 1.6, 0.3, C);
  b.box(-E + 0.15, DECK, -20.1, 0.3, 1.6, 10.2, C);
  b.box(-18.1, DECK + 1.6, -E + 0.15, 6.2, 0.1, 0.36, '#ffffff');                // duvar başlığı (kulübe dışında; çarpışmalı)
  b.box(-E + 0.15, DECK + 1.6, -18.1, 0.36, 0.1, 6.2, '#ffffff');
  // kulübe: kuzeybatı köşede çatılı sığınak (2 dış duvar yükselir + 1 direk + çatı)
  b.box(-23.35, DECK + 1.6, -E + 0.15, 4.3, 1.2, 0.3, C);
  b.box(-E + 0.15, DECK + 1.6, -23.2, 0.3, 1.2, 4.0, C);
  wood(b, -21.4, DECK, -21.4, 0.3, 2.8, 0.3, WOOD_D);
  b.box(-23.3, DECK + 2.8, -23.3, 4.4, 0.22, 4.4, Dk);
  b.box(-23.3, DECK + 3.02, -23.3, 4.0, 0.08, 4.0, C, NC);
  // iç siperler (1,1 m: çömelince saklar). Boşluklar: güney x −25,1…−22,3 (merdiven / iskele), doğu z −23,5…−22,3 (iskele), kanat ağzı
  b.box(-20.5, DECK, -15.15, 2.6, 1.1, 0.3, L);
  b.box(-15.15, DECK, -19.4, 0.3, 1.1, 4.6, L);
  b.box(-15.15, DECK, -24.45, 0.3, 1.1, 1.5, L);
  b.box(-19.0, DECK, -19.2, 1.2, 1.1, 1.2, C);                                   // ortada boyalı sandık
  b.box(-19.0, DECK + 1.1, -19.2, 0.9, 0.04, 0.9, '#ffffff', NC);
  // kanat: x −18,6…−15, z −15…−2,1 (kuleye köprü bunun güney ucundan)
  deck(b, -18.6, -15, -15, -2.1);
  for (const pz of [-11.2, -6.6, -2.45]) for (const px of [-18.25, -15.35]) post(b, px, pz, DECK - 0.3);
  b.box(-18.45, DECK, -12.0, 0.3, 1.1, 3.0, L);                                  // dış kenar siperleri
  b.box(-18.45, DECK, -4.6, 0.3, 1.1, 2.6, L);
  // kale bayrağı: kulübe çatısından 16 m'ye direk + kale renginde bayrak (her yerden hangi kale olduğu görünür)
  b.box(-24.9, DECK + 3.02, -24.9, 0.14, 4.6, 0.14, '#e8e8e8');
  b.box(-24.9 + 1.05, DECK + 6.4, -24.9, 1.9, 1.1, 0.05, C, NC);
  b.box(-24.9 + 1.05, DECK + 6.4, -24.9, 1.9, 0.18, 0.06, '#ffffff', NC);
  b.box(-15.02, DECK - 0.3, -8.55, 0.04, 0.3, 12.9, C, NC);
  // köprü: x −15…−4, z −3,7…−2,1 (1,6 m, korkuluksuz). Orta tahta + iki renkli kenar (hepsi yürünür)
  wood(b, -9.5, DECK - 0.25, -2.9, 11, 0.25, 1.2, WOOD, 'plat');
  b.box(-9.5, DECK - 0.25, -3.6, 11, 0.25, 0.2, C, { tag: 'plat' });
  b.box(-9.5, DECK - 0.25, -2.2, 11, 0.25, 0.2, C, { tag: 'plat' });
  for (let x = -14.5; x < -4.4; x += 1.25) b.box(x, DECK - 0.38, -2.9, 0.12, 0.13, 1.6, STEEL);      // alt kirişler (tablanın altında, çarpışmalı)
  // zemin merdiveni: batı kenarı x −25,1…−23,5, z 0 → −15 (30 basamak × 0,5 m, 9 m)
  treadStair(b, -24.3, 0, 0, '-z', 1.6, 30, 0.3, 0.5, WOOD, C);
  for (const i of [6, 12, 18, 24]) { const z = -i * 0.5, top = i * 0.3 - 0.3; for (const px of [-25.0, -23.6]) post(b, px, z, top); }
  // zıplama minderi (turuncu + turkuaz): kanadın önünde, kuyuya 3 m
  if (F.pad) trampoline(b, -11.5, -8.5, C, F.name);
  // kalenin altı: zeminde boyalı sandıklar (kale direkleri arasında siper)
  wood(b, -22.4, 0, -17.6, 1.2, 1.2, 1.2, PLY); wood(b, -17.4, 0, -22.6, 1.4, 0.9, 1.4, PLY); wood(b, -17.4, 0.9, -22.6, 0.9, 0.9, 0.9, PLY);
}

// Zıplama minderi: kuyu kenarından kanada fırlatır. Çarpışma 'pad' etiketli (World.move üstüne basanı fırlatır; fırlatma vektörü kurulumdan sonra c.pad)
function trampoline(b, x, z, color, name) {
  const r = 1.15, top = 0.48;
  b.obj('minder:' + name, () => {
    b.cyl(x, 0, z, r, r, top - 0.06, color, { collide: false, seg: 24 });
    b.cyl(x, top - 0.06, z, r * 0.84, r * 0.84, 0.06, '#1b1d24', { collide: false, seg: 24 });
    b.cyl(x, top - 0.004, z, r * 0.36, r * 0.36, 0.01, '#ffe23a', { collide: false, seg: 20 });
    for (let a = 0; a < 6; a++) b.box(x + Math.cos(a * 1.047) * r * 0.93, 0, z + Math.sin(a * 1.047) * r * 0.93, 0.12, 0.18, 0.12, STEEL, NC);
    const a = r * 0.707;
    b.collide(x, 0, z, a * 2, top, a * 2, 'pad');
    b.collide(x, 0, z, r * 1.8, top, r * 0.8, 'pad');
    b.collide(x, 0, z, r * 0.8, top, r * 1.8, 'pad');
  });
}

// Kule iç merdiveni (+x yönünde çıkar): dolu basamaklar, basamak yüzleri sırayla kale renklerinde (her parça tek kutu, çarpışma birebir)
function solidStair(b, x, z, y0, n, rise, run, width) {
  for (let i = 0; i < n; i++) {
    const h = (i + 1) * rise, cx = x + i * run + run / 2;
    b.box(cx, y0, z, run, h - 0.06, width, '#d8d3c8', { tag: 'plat', kind: KIND.STONE });
    b.box(cx, y0 + h - 0.06, z, run, 0.06, width, FORTS[i % 4].c, { tag: 'plat' });
  }
}

// ───────── zemin siper kümesi (kanonik: kuzey kuşağı x −14…14, z −21…−12,5); dört yöne döndürülür ─────────
function groundCluster(b, k) {
  const P = (i) => INFL[(i + k * 3) % INFL.length];
  pillow(b, -1.0, -17.2, 8.0, 0.95, 0.9, P(0), 0.3);                     // yılan
  can(b, -8.2, -14.4, 0.75, 1.9, P(1));
  can(b, 7.6, -16.8, 0.75, 1.9, P(2));
  dorito(b, -11.2, -19.4, 2.6, 1.6, P(3), true);
  dorito(b, 10.4, -20.0, 2.6, 1.6, P(4), true);
  pillow(b, 0.6, -13.4, 1.4, 1.4, 1.4, P(5), 0.2);                       // küp (kuyu kenarında: riskli siper)
  can(b, 3.8, -20.6, 0.55, 1.2, P(6));
  can(b, -4.4, -20.4, 0.55, 1.2, P(7));
  pillow(b, -7.6, -21.2, 2.4, 1.05, 1.1, P(2), 0.25);
  if (k % 2 === 0) can(b, 8.5, -11.8, 0.55, 1.15, P(1));                    // minder olmayan yönlerde minder yerine küçük fıçı
  dorito(b, 12.8, -14.2, 1.8, 1.1, P(0), false);
}

// Çim: 2 m biçilmiş şeritler (açık / koyu) — ölçek ve derinlik hissi. Kuyuyu kesen şerit iki çokgene bölünür (yay kenarlı)
function groundStrips(b) {
  const H = 26.2, W = 2.0, R = PIT_R;
  const f = (x, sg) => (Math.abs(x) < R ? sg * Math.sqrt(R * R - x * x) : 0);
  for (let i = 0, x0 = -H; x0 < H - 1e-6; i++, x0 += W) {
    const x1 = Math.min(H, x0 + W), col = i % 2 ? '#4ba545' : '#5ab752';
    const polys = [];
    if (x1 <= -R || x0 >= R) polys.push([[x0, -H], [x1, -H], [x1, H], [x0, H]]);
    else for (const sg of [-1, 1]) {
      const p = [[x0, sg * H], [x1, sg * H]];
      const xs = [x1]; for (let k = 1; k < 12; k++) xs.push(x1 + (x0 - x1) * (k / 12)); xs.push(x0);
      for (const ax of [R, -R]) if (ax < x1 && ax > x0) xs.push(ax);
      xs.sort((a, c) => c - a);
      for (const x of xs) p.push([x, f(x, sg)]);
      polys.push(sg > 0 ? p.reverse() : p);
    }
    for (const P of polys) {
      const g = new THREE.ShapeGeometry(new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, z))));
      g.rotateX(Math.PI / 2);                                                     // (x, y) → (x, 0, y): şekil düzleminde z = y
      const pos = g.attributes.position; for (let k = 0; k < pos.count; k++) pos.setY(k, 0);
      const idx = g.index; if (idx) for (let k = 0; k < idx.count; k += 3) { const a = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, a); }   // yüz yukarı
      g.computeVertexNormals();
      b.addGeo(g, col, new THREE.Matrix4());
    }
  }
}

// Arena dışı (çarpışmasız, oynanış alanı dışında): ağaç halkası, tribün, uzak tepeler
function scenery(b) {
  const rng = makeRng(77);
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + rng() * 0.08, r = 36 + rng() * 26, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (z > 26 && Math.abs(x) < 20) continue;                                   // güneyde tribün
    const h = 3.5 + rng() * 3, s = 1.6 + rng() * 1.4;
    b.box(x, -0.1, z, 0.45, h * 0.55, 0.45, '#6b4a2e', NC);
    b.ico(x, h * 0.55 + s * 0.7, z, s, rng() < 0.5 ? '#3f8a3c' : '#4f9a40', { scale: [1, 1.15, 1], ry: rng() * 3 });
    b.ico(x + s * 0.4, h * 0.55 + s * 1.4, z - s * 0.2, s * 0.7, '#57a646', { ry: rng() * 3 });
  }
  for (let i = 0; i < 6; i++) {                                                 // tribün (güney, ağın dışında)
    b.box(0, 0, 29.6 + i * 0.8, 30, 0.45 + i * 0.45, 0.8, '#d8dde3', NC);
    for (let k = -14; k <= 14; k += 1.0) b.box(k + 0.5, 0.45 + i * 0.45, 29.45 + i * 0.8, 0.7, 0.18, 0.4, INFL[(k + 14 + i) % INFL.length], NC);
  }
  b.box(0, 0, 34.6, 30.6, 5.4, 0.3, '#3a4250', NC);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2, r = 150 + (i % 3) * 30; b.ico(Math.cos(a) * r, -18, Math.sin(a) * r, 40 + (i % 4) * 10, '#7fa15c', { scale: [1.8, 0.55, 1.2], ry: i }); }
}

function signTex(text, w, h, { fg = '#ffffff', bg = '#1d2230', font = 'bold 150px Arial Black, Arial, sans-serif', stroke = null } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w);
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = 18; g.strokeStyle = stroke; g.strokeText(text, c.width / 2, c.height / 2 + 6, c.width * 0.92); }
  g.fillStyle = fg; g.fillText(text, c.width / 2, c.height / 2 + 6, c.width * 0.92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, transparent: !bg }));
}

export function buildBoyaKulesi() {
  const b = new MapBuilder();
  b.surface = { ground: () => 0, kindOf: () => 0, seeded: false };               // dokular yalnız açıkça seçilen parçalarda (ahşap / beton): şişme siperler ve boya düz, temiz

  // ───── zemin: çim (kuyu deliği), saha çizgileri, kuyu kenarı uyarı halkası, dış çayır ─────
  groundStrips(b);                                                               // biçilmiş çim şeritleri (2 m), kuyu deliği şeritlerden kesilir
  for (let s = 0; s < 4; s++) {                                                  // arena dışı: çakıl şerit + çayır (kuyunun üstünü kesmez)
    const [x, z] = rotXZ(s, 0, -163.1), [gx, gz] = rotXZ(s, 0, -28.15);
    b.box(x, -0.34, z, s % 2 ? 274 : 600, 0.3, s % 2 ? 600 : 274, '#86a860', NC);
    b.box(gx, -0.3, gz, s % 2 ? 3.9 : 60.2, 0.31, s % 2 ? 60.2 : 3.9, '#c8bfa9', NC);
  }
  for (const s of [-1, 1]) { b.box(s * 13.2, 0.004, 0, 0.14, 0.01, 51.6, '#f2f6ee', NC); b.box(0, 0.004, s * 13.2, 51.6, 0.01, 0.14, '#f2f6ee', NC); }
  for (let i = 0; i < 40; i++) {                                                 // kuyu kenarı: sarı / siyah uyarı halkası
    const g = new THREE.RingGeometry(PIT_R, PIT_R + 0.7, 3, 1, (i / 40) * Math.PI * 2, Math.PI * 2 / 40); g.rotateX(-Math.PI / 2);
    b.addGeo(g, i % 2 ? '#1e1f26' : '#ffd21f', b._local(0, 0.006, 0));
  }
  // ───── kuyu: içe bakan duvar (renk bantları derinliği gösterir) + taban hedefi ─────
  const bandC = ['#ff4fa3', '#ffd23a', '#2fd2ff', '#8be03a', '#ff7a1a', '#b05cff'];
  for (let y = 0, i = 0; y > -PIT_D; i++) {
    const hb = i % 2 ? 0.7 : 3.3, col = i % 2 ? bandC[(i >> 1) % bandC.length] : (y > -8 ? '#3a3f52' : y > -16 ? '#2a2e3d' : '#1c1f2a');
    const g = new THREE.CylinderGeometry(PIT_R, PIT_R, hb, 64, 1, true); g.scale(-1, 1, 1);
    b.addGeo(g, col, b._local(0, y - hb / 2, 0));
    y -= hb;
  }
  { const g = new THREE.CircleGeometry(PIT_R, 64); g.rotateX(-Math.PI / 2); b.addGeo(g, '#151823', b._local(0, -PIT_D, 0)); }
  for (const [r, c] of [[8.5, '#ff3b3b'], [6.2, '#f4f4f4'], [4.0, '#ff3b3b'], [1.8, '#f4f4f4']]) { const g = new THREE.CircleGeometry(r, 48); g.rotateX(-Math.PI / 2); b.addGeo(g, c, b._local(0, -PIT_D + 0.01 + (9 - r) * 0.002, 0)); }

  // ───── çevre: yüksek ağ çit (çarpışma = ağ düzlemi), direkler ─────
  const NET = { o: { transparent: true, opacity: 0.13, roughness: 0.9, depthWrite: false } }, FH = 12;
  for (let s = 0; s < 4; s++) {
    const [ax, az] = rotXZ(s, 0, -25.85);
    const alongX = s % 2 === 0;
    b.box(ax, 0, az, alongX ? 51.8 : 0.1, FH, alongX ? 0.1 : 51.8, '#2c3444', NET);
    for (let t = -24; t <= 24; t += 6) { const [px, pz] = rotXZ(s, t, -25.85); b.box(px, 0, pz, 0.18, FH + 0.2, 0.18, '#5c6676'); }
    b.box(ax, FH, az, alongX ? 51.8 : 0.08, 0.08, alongX ? 0.08 : 51.8, '#5c6676');                    // üst halat (ağ düzleminde)
    for (let y = 1.5; y < FH; y += 1.5) b.box(ax, y, az, alongX ? 51.8 : 0.02, 0.02, alongX ? 0.02 : 51.8, '#4a5361', NC);
    for (let t = -24.75; t <= 25; t += 1.5) { const [px, pz] = rotXZ(s, t, -25.85); b.box(px, 0, pz, 0.02, FH, 0.02, '#4a5361', NC); }
  }
  scenery(b);
  // ───── kaleler (fırıldak) ─────
  for (const F of FORTS) b.with(0, 0, 0, -F.k * Math.PI / 2, () => b.obj('kale:' + F.name, () => fort(b, F)));
  for (let k = 0; k < 4; k++) b.with(0, 0, 0, -k * Math.PI / 2, () => b.obj('siper:' + k, () => groundCluster(b, k)));

  // ───── iskele yolları (yalnız kuzey ve doğu): 1,2 m tabla, boru direkler (mor / turkuaz zemin merdiveninin direklerine değmeyen yerlerde) ─────
  const POLES = [-12.5, -8.5, -4.5, -0.5, 4.15, 7.25, 10.35, 13.6];
  b.obj('iskele:kuzey', () => {
    wood(b, 0, DECK - 0.2, -22.9, 30, 0.2, 1.2, PLY, 'plat');
    for (const x of POLES) { for (const pz of [-23.42, -22.38]) b.box(x, 0, pz, 0.14, DECK - 0.2, 0.14, '#c9ced6'); b.box(x, 4.4, -22.9, 0.1, 0.1, 1.2, '#c9ced6'); }
  });
  b.obj('iskele:doğu', () => {
    wood(b, 22.9, DECK - 0.2, 0, 1.2, 0.2, 30, PLY, 'plat');
    for (const z of POLES.map((v) => -v)) { for (const px of [22.38, 23.42]) b.box(px, 0, z, 0.14, DECK - 0.2, 0.14, '#c9ced6'); b.box(22.9, 4.4, z, 1.2, 0.1, 0.1, '#c9ced6'); }
  });

  // ───── kule ─────
  b.obj('kule:sütun', () => b.withKind(KIND.STONE, () => b.box(0, -PIT_D, 0, 8, PIT_D + DECK, 8, CONC, { tag: 'plat' })));
  for (let y = -PIT_D + 4; y < DECK - 1; y += 4) b.box(0, y, 0, 8.04, 0.5, 8.04, y % 8 === 0 ? '#ffd23a' : '#ff4fa3', NC);      // derinlik bantları (sütun yüzünde)
  const TA = 13.5, TB = 18;
  b.obj('kule:alt-kat', () => {
    for (const F of FORTS) b.with(0, 0, 0, -F.k * Math.PI / 2, () => {
      b.wall('z', -4, 3.7, -3.85, DECK, TA - 0.3 - DECK, 0.3, CONC, [{ at: -2.9, w: 1.6, b: 0, top: 2.3 }, { at: 1.4, w: 1.6, b: 1.1, top: 1.9 }], { kind: KIND.STONE });
      b.box(-4.02, DECK + 2.6, 0, 0.04, 1.3, 7.6, F.c, NC);                   // dış yüzde kale rengi bant
      b.box(-4.02, DECK + 2.3, -2.9, 0.04, 0.12, 1.9, '#ffffff', NC);
    });
    solidStair(b, -2.9, 0, DECK, 10, 0.45, 0.5, 1.6);         // 9 → 13,5, x −2,9…2,1 (önünde 0,8 m yaklaşma): basamak 0,5 m = yol bulma hücresi, rıht 0,45 < 0,5 adım
  });
  // Merdiven boşlukları: başı tavana değecek ilk basamağa çıkarken oyuncu kutusu (0,64 m) hâlâ bir alttaki basamakta → delik o basamaktan 0,7 m önce başlar, yanlarda 0,35 m pay
  const HA = [-1.1, 2.1, -1.15, 1.15], HB = [-0.6, 2.6, 1.25, 3.2], TBH = 3.5;          // alt delik (balkon tablasında), üst kapak (tepe tablasında), üst kat yarı genişlik
  b.obj('kule:balkon', () => {
    const y = TA - 0.3, S = 5.8;                                                // 11,6 × 11,6 tabla (kule 8 × 8 → 1,8 m konsol); delikten alt merdiven çıkar, üstü doğu kapısına bakar
    const slab = (x0, x1, z0, z1) => b.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, '#cfc9bd', { tag: 'plat', kind: KIND.STONE });
    slab(-S, S, -S, HA[2]); slab(-S, S, HA[3], S); slab(-S, HA[0], HA[2], HA[3]); slab(HA[1], S, HA[2], HA[3]);
    for (const F of FORTS) b.with(0, 0, 0, -F.k * Math.PI / 2, () => {
      b.box(-S + 0.02, y, 0, 0.04, 0.3, 2 * S - 0.04, '#ffd21f', NC);            // kenar şeridi (tabla yüzünde)
      for (const t of [-3.3, -1.1, 1.1, 3.3]) b.box(-4.9, y - 0.3, t, 1.8, 0.3, 0.25, STEEL);   // konsol kirişler (tablanın altında; köşede komşu yüzün kirişiyle kesişmez)
    });
  });
  b.obj('kule:üst-kat', () => {
    const op = (at) => [{ at, w: 1.6, b: 0, top: 2.3 }], W = TBH, I = TBH - 0.3, H = TB - 0.3 - TA;
    b.wall('x', -W, W, -W + 0.15, TA, H, 0.3, '#f4f1ea', op(0), { kind: KIND.STONE });                 // kuzey kapı
    b.wall('x', -W, W, W - 0.15, TA, H, 0.3, '#f4f1ea', [], { kind: KIND.STONE });                     // güney (içinde merdiven)
    b.wall('z', -I, I, -W + 0.15, TA, H, 0.3, '#f4f1ea', op(0), { kind: KIND.STONE });                 // batı kapı
    b.wall('z', -I, I, W - 0.15, TA, H, 0.3, '#f4f1ea', op(0), { kind: KIND.STONE });                  // doğu kapı (alt merdivenin çıkışı)
    for (const F of FORTS) b.with(0, 0, 0, -F.k * Math.PI / 2, () => b.box(-W - 0.02, TB - 1.25, 0, 0.04, 0.5, 2 * W, '#ff3b3b', NC));     // kırmızı kuşak
    solidStair(b, -2.4, 2.4, TA, 10, 0.45, 0.5, 1.6);          // 13,5 → 18 güney duvarı boyunca, x −2,4…2,6; son basamak tepe kotunda (doğuya / kuzeye çıkılır)
  });
  b.obj('kule:tepe', () => {
    const y = TB - 0.3, S = TBH + 0.3;                                          // tepe tablası 7,6 × 7,6 (üst kat duvarından 0,3 m taşar); kapak HB
    const slab = (x0, x1, z0, z1) => b.box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0, 0.3, z1 - z0, '#ffd23a', { tag: 'plat' });
    slab(-S, S, -S, HB[2]); slab(-S, HB[0], HB[2], S); slab(HB[1], S, HB[2], S); slab(HB[0], HB[1], HB[3], S);
    for (const F of FORTS) b.with(0, 0, 0, -F.k * Math.PI / 2, () => b.box(-S + 0.125, TB, 0.125, 0.25, 1.0, 2 * S - 0.25, F.c));    // korkuluk duvarı (fırıldak köşe)
    b.cyl(-1.2, TB, -1.2, 1.25, 1.25, 0.02, '#ffffff', { collide: false, seg: 32 });          // TEPE işareti (boya halkası)
    b.cyl(-1.2, TB, -1.2, 0.95, 0.95, 0.035, '#ff3b3b', { collide: false, seg: 32 });
    b.cyl(-1.2, TB, -1.2, 0.45, 0.45, 0.05, '#ffffff', { collide: false, seg: 24 });
    b.box(-3.1, TB, -3.1, 0.12, 3.6, 0.12, '#e8e8e8');                          // bayrak direği (kuzeybatı köşe)
    b.box(-3.1 + 0.9, TB + 2.7, -3.1, 1.7, 0.9, 0.04, '#ff3b3b', NC);
  });
  // balkondan mor kanada inen basamaklı yol: x 4,2…5,8; mor kanattan (z −15) 1,7 m düz sahanlık, sonra 15 basamak × 0,5 m → balkon (z −5,8, 13,5 m)
  b.obj('kule:mor-yolu', () => { deck(b, 4.2, 5.8, -15, -13.3); treadStair(b, 5.0, -13.3, DECK, '+z', 1.6, 15, 0.3, 0.5, WOOD, '#9b4dff'); });

  // ───── doğuşlar (zemin + kale güverteleri), dolaşma noktaları, bölge adları ─────
  const spawns = [];
  const sp = (x, z, y = 0) => spawns.push({ x, z, y, ry: Math.atan2(x, z) });
  for (const [x, z] of [[0, -19.4], [19.4, 0], [0, 19.4], [-19.4, 0], [-9.6, -23.2], [23.2, -9.6], [9.6, 23.2], [-23.2, 9.6]]) sp(x, z);
  for (let k = 0; k < 4; k++) { const [x, z] = rotXZ(k, -20.8, -17.2); sp(x, z, DECK); }
  const roam = [[-1.2, -1.2, 18], [1.5, -1.5, 18], [-2, 1.5, 18], [-1.2, -1.2, 18], [3.2, 4.6, 13.5], [-4.6, -3.2, 13.5], [4.6, -4.6, 13.5], [-2.2, -2.2, 9], [2.6, 2.6, 9], [0, -16, 0], [16, 0, 0], [0, 16, 0], [-16, 0, 0], [5.0, -10, 11]];      // [x, z, kat]: tepe ağırlıklı (en güçlü nokta)
  for (let k = 0; k < 4; k++) for (const [x, z, y] of [[-20.2, -19.5, DECK], [-16.8, -8.6, DECK], [-9.5, -2.9, DECK]]) { const [wx, wz] = rotXZ(k, x, z); roam.push([wx, wz, y]); }
  roam.push([0, -22.9, DECK], [22.9, 0, DECK]);
  const callouts = [
    ...FORTS.map((F) => { const [x, z] = rotXZ(F.k, -20.2, -20.2); return { name: F.name, x, z, r: 7, major: true }; }),
    { name: 'Kule', x: 0, z: 0, r: 4.5, major: true },
    ...FORTS.map((F) => { const [x, z] = rotXZ(F.k, -9.5, -2.9); return { name: F.name.split(' ')[0] + ' Köprüsü', x, z, r: 3 }; }),
    ...FORTS.map((F) => { const [x, z] = rotXZ(F.k, -16.8, -8.6); return { name: F.name.split(' ')[0] + ' Kanadı', x, z, r: 3 }; }),
    { name: 'Kuzey İskelesi', x: 0, z: -22.9, r: 3 }, { name: 'Doğu İskelesi', x: 22.9, z: 0, r: 3 },
  ];

  // ───── toplanabilir kutular (paintball): boya topu kutusu (yedeği doldurur) + can kutusu (+TUNE.pbHeal). Çarpışmasız, yürünür yüzeyde, yol kesmez ─────
  // Mermi: her kalenin kulübesinde (çatı altı) + kuzey / güney zemin siperlerinin arkası. Can: riskli yerler — Turuncu Köprüsü ortası (kuyunun üstü),
  // kule balkonu (GB köşe), doğu / batı zeminde kuyu kenarına 2,3 m (açıkta)
  const pickups = [];
  for (const F of FORTS) { const [x, z] = rotXZ(F.k, -23.0, -23.0); pickups.push({ type: 'ammo', x, y: DECK, z, name: F.name.split(' ')[0] + ' Kulübesi' }); }
  for (const k of [0, 2]) { const [x, z] = rotXZ(k, 5.6, -18.6); pickups.push({ type: 'ammo', x, y: 0, z, name: k ? 'Güney Siperleri' : 'Kuzey Siperleri' }); }
  pickups.push({ type: 'health', x: -9.5, y: DECK, z: -2.9, name: 'Turuncu Köprüsü' }, { type: 'health', x: -4.7, y: TA, z: 4.7, name: 'Kule Balkonu' });
  for (const k of [1, 3]) { const [x, z] = rotXZ(k, -3, -13); pickups.push({ type: 'health', x, y: 0, z, name: k === 1 ? 'Doğu Kuyu Kenarı' : 'Batı Kuyu Kenarı' }); }

  const group = b.build();
  // minderler: fırlatma vektörü (dünya). Tepe ≈ 10,7 m, ~1,6 sn'de kanada (6–7 m ötede) iner; havada yön değiştirme azdır (launchT, sim/input.js)
  for (const c of b.colliders) {
    if (c.tag !== 'pad') continue;
    const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[2] + c.max[2]) / 2;
    const k = cx < 0 ? 0 : 2, [dx, dz] = rotXZ(k, -1, 0);
    c.pad = [dx * 4.2, 17.5, dz * 4.2, 1.9];
  }
  if (typeof document !== 'undefined' && !MapBuilder.noVisual) {
    const t1 = signTex('BOYA KULESİ', 4.6, 0.62, { bg: null, fg: '#ffffff', stroke: '#1d2230' });
    for (let k = 0; k < 4; k++) { const m = k ? t1.clone() : t1; const [x, z] = rotXZ(k, 0, -3.56); m.position.set(x, 16.15, z); m.rotation.y = -k * Math.PI / 2 + Math.PI; group.add(m); }
    const t2 = signTex('TEPE', 1.6, 0.5, { bg: '#ff3b3b', fg: '#ffffff', font: 'bold 260px Arial Black, Arial, sans-serif' });
    t2.position.set(-3.1 + 0.9, 18 + 3.15, -3.1 + 0.03); group.add(t2);
    const t3 = t2.clone(); t3.position.z = -3.1 - 0.03; t3.rotation.y = Math.PI; group.add(t3);
  }
  return {
    id: 'boyakulesi',
    name: 'Boya Kulesi',
    group,
    colliders: b.colliders,
    sight: b.sight,
    bounds: BK_BOUNDS,
    terrain: new PitTerrain(PIT_R, PIT_D),
    baseZones: null,
    spawns: { blue: spawns, red: spawns },
    ffaSpawns: spawns,
    pickups,
    objectives: [],
    roamPoints: roam,
    callouts,
    layered: true,
    navLayers: true,                                                         // çok katlı yol bulma (NavGridML): zemin + kale + kule katları üst üste
    voidY: BK.voidY,                                                          // bunun altına düşen elenir (kuyu)
    tepe: BK.tepe,
    roads: [],
    mini: { bg: '#3f8a3a', ground: [82, 168, 74], wall: '#f4f1ea', mid: '#d9b27a', low: '#ffd23a', roof: '#c4500a', pit: [22, 24, 36] },
    env: { sky: ['#3d8fe0', '#86c2f0', '#dff0fa'], fog: ['#d4e9f6', 120, 380], sun: ['#fff3dc', 2.9], hemi: ['#d8ecff', '#6c8c52', 1.35], sunPos: [42, 85, 28], clouds: 14 },
  };
}
