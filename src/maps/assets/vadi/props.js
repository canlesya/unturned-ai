// VADİ v3 eşyaları (12.169): sandık, varil, saman balyası, çuval, kum torbası, el arabası, at arabası, traktör, kamyonet, çit, kuru taş duvar,
// kütük / kütük yığını, basamak taşı, fener direği, bayrak, kamp ateşi, ev eşyası (masa, sedir, dolap, yatak, soba).
// Hepsi yerel çerçevede, zemin = 0; kutular birbirine değer, iç içe girmez; çarpışma = görsel (yuvarlaklar içine çizilmiş kutu).
import { VK, PAL } from './surface.js';
import { octCyl, hCyl } from './kit.js';

export function crate(b, x, z, s = 1.0, y = 0, color = '#b08a5a') {
  b.box(x, y, z, s, s, s, color, { kind: VK.CRATE });
}
export function crateStack(b, x, z, rng, n = 3) {
  crate(b, x, z, 1.1); crate(b, x + 1.15, z + 0.05, 1.0);
  if (n > 2) crate(b, x + 0.05, z, 0.9, 1.1);
}
export function barrel(b, x, z, color = '#5f6a48', y = 0) {
  // gövde dilimleri + iki koyu çember dilimi üst üste (aynı yarıçap: iç içe / eş düzlem yüz yok)
  const cuts = [0, 0.18, 0.24, 0.7, 0.76, 0.95];
  for (let i = 0; i < 5; i++) b.cyl(x, y + cuts[i], z, 0.32, 0.32, cuts[i + 1] - cuts[i], i % 2 ? '#3e3a35' : color, { seg: 8, ry: Math.PI / 8, collide: false, kind: i % 2 ? VK.METAL : VK.PAINT });
  b.collide(x, y, z, 0.32 * 0.9239 * 1.4142, 0.95, 0.32 * 0.9239 * 1.4142);
}
// dikdörtgen saman balyası 1,2 × 0,5 × 0,6 (uzun kenar x); yığın: alt sıra n, üst sıra n−1 (üstteki balyalar alttakilerin TAM üstünde)
export function bale(b, x, y, z, rotZ = false) {
  if (rotZ) b.box(x, y, z, 0.6, 0.5, 1.2, PAL.hay, { kind: VK.HAY });
  else b.box(x, y, z, 1.2, 0.5, 0.6, PAL.hay, { kind: VK.HAY });
}
export function baleStack(b, x, z, n = 3, rows = 2) {
  for (let r = 0; r < rows; r++) for (let i = 0; i < n - r; i++) bale(b, x + (i + r * 0.5) * 1.2 - (n - 1) * 0.6, r * 0.5, z);
}
export function sack(b, x, y, z, ry = 0) { b.box(x, y, z, 0.5, 0.32, 0.75, PAL.sack, { kind: VK.CANVAS, ry }); }
const BAG = ['#b4a57a', '#c8ba90', '#a99a70'];
// kum torbası siperi: len (x boyunca), 3 sıra × 0,3 m = 0,9; torbalar sırada birbirine değer, üst sıra yarım kaydırılmış. Tek çarpışma kutusu = görsel hacim.
export function sandbags(b, x, z, len = 3.4, ry = 0, rows = 3) {
  b.with(x, 0, z, ry, () => {
    const BL = 0.62, BD = 0.42, BH = 0.3;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? BL / 2 : 0, n = Math.floor((len - off) / BL + 1e-6);
      const x0 = -len / 2 + off, used = n * BL;
      for (let i = 0; i < n; i++) b.box(x0 + (i + 0.5) * BL, r * BH, 0, BL, BH, BD, BAG[(i + r * 2) % 3], { collide: false, kind: VK.CANVAS });      // üç ton sırayla: torbalar tek tek seçilir
      if (off > 0) b.box(-len / 2 + off / 2, r * BH, 0, off, BH, BD, '#b7a97f', { collide: false, kind: VK.CANVAS });      // sıra başı yarım torba
      const rest = len - off - used;
      if (rest > 0.02) b.box(len / 2 - rest / 2, r * BH, 0, rest, BH, BD, '#b7a97f', { collide: false, kind: VK.CANVAS });
    }
    b.collide(0, 0, 0, len, rows * BH, BD);
  });
}
// eğimli zeminde kum torbası: ~1,24 m'lik (iki torba) dilimler, her dilim kendi ayak izinin en alçağına oturur (basamaklı sıra; havada / gömülü uç yok).
// gy(x, z): çağıranın çerçevesinde zemin; along 'x' | 'z'
export function sandbagsOn(b, gy, x, z, len, along = 'x', rows = 3) {
  const n = Math.max(1, Math.round(len / 1.24)), st = len / n;
  for (let i = 0; i < n; i++) {
    const a = -len / 2 + (i + 0.5) * st, cx = along === 'x' ? x + a : x, cz = along === 'x' ? z : z + a;
    const hx = along === 'x' ? st / 2 : 0.21, hz = along === 'x' ? 0.21 : st / 2;
    const g = Math.min(gy(cx, cz), gy(cx - hx, cz - hz), gy(cx + hx, cz - hz), gy(cx - hx, cz + hz), gy(cx + hx, cz + hz));
    b.with(cx, g - 0.02, cz, along === 'x' ? 0 : Math.PI / 2, () => sandbags(b, 0, 0, st, 0, rows));
  }
}
// fener direği (gece yol gösterir): kare direk + kol + cam kafes (ışıyan)
export function lantern(b, h = 3.1) {
  b.box(0, 0, 0, 0.14, h, 0.14, '#3a2d22', { kind: VK.WOOD });
  b.box(0.27, h - 0.22, 0, 0.4, 0.08, 0.08, '#3a2d22', { collide: false, kind: VK.WOOD });
  b.box(0.4, h - 0.62, 0, 0.22, 0.32, 0.22, PAL.glow, { collide: false, o: { glow: true } });
  b.box(0.4, h - 0.3, 0, 0.3, 0.08, 0.3, '#2a2522', { collide: false, kind: VK.METAL });
}
export function flagPole(b, color) {
  octCyl(b, 0, 0, 0, 0.08, 5.6, '#d8d8d2', { kind: VK.METAL, small: true, rTop: 0.06 });
  b.box(0.69, 4.1, 0, 1.2, 0.8, 0.04, color, { collide: false, kind: VK.CANVAS });
  b.box(0, 5.6, 0, 0.16, 0.12, 0.16, '#c9a33a', { collide: false, kind: VK.METAL });
}
// kamp ateşi: taş halka (8 taş, her biri kendi kutusu), ortada kütükler + köz (ışıyan)
export function campfire(b) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, r = 0.62;
    b.box(Math.cos(a) * r, 0, Math.sin(a) * r, 0.3, 0.22, 0.3, i % 2 ? PAL.rock : PAL.rockD, { kind: VK.ROCK, ry: Math.round(a / (Math.PI / 2)) * Math.PI / 2 });
  }
  b.box(0, 0, 0, 0.5, 0.06, 0.5, '#ff8a3a', { collide: false, o: { glow: true } });
  b.box(-0.05, 0.06, 0, 0.7, 0.1, 0.12, '#4a3220', { collide: false, kind: VK.BARK });
  b.box(0.05, 0.16, 0, 0.12, 0.1, 0.7, '#3e2a1a', { collide: false, kind: VK.BARK });
}
// kütük (devrik ağaç): yatay sekizgen gövde, çarpışma içine çizilmiş kare. axis 'x' | 'z'. Zemin eğimli olabilir: y = gövde ekseni.
export function log(b, x, y, z, len, axis = 'x', r = 0.28) { hCyl(b, x, y, z, r, len, axis, PAL.bark, { kind: VK.BARK }); }
export function logPile(b, x, z, len = 2.6) {          // üçgen kütük yığını (3 + 2 + 1), z boyunca uzanır
  const r = 0.2;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) hCyl(b, x + (i - (2 - row) / 2) * 2 * r, r + row * r * 1.7, z, r, len, 'z', row % 2 ? PAL.barkB : PAL.bark, { kind: VK.BARK });
}
export function steppingStone(b, x, y, z, s = 0.55, ry = 0) {
  b.box(x, y, z, s * 1.3, 0.24, s, '#8e8c84', { kind: VK.ROCK, ry, collide: false });
}
// el arabası / at arabası (tekerlekli): kasa + iki tekerlek (yanlarda, kasaya değer) + oklar
export function cart(b, { color = PAL.wood, hay = false } = {}) {
  b.box(0, 0.62, 0, 2.6, 0.1, 1.4, color, { kind: VK.PLANK });                   // taban
  for (const sz of [-0.66, 0.66]) b.box(0, 0.72, sz, 2.6, 0.42, 0.08, color, { kind: VK.PLANK });
  for (const sx of [-1.26, 1.26]) b.box(sx, 0.72, 0, 0.08, 0.42, 1.24, color, { kind: VK.PLANK });
  for (const sz of [-0.82, 0.82]) {
    hCyl(b, 0.1, 0.55, sz, 0.55, 0.1, 'z', '#4a3220', { kind: VK.WOOD, seg: 10 });
  }
  for (const sz of [-0.4, 0.4]) b.box(-1.3 - 0.9, 0.52, sz, 1.8, 0.07, 0.07, '#5a3f26', { collide: false, kind: VK.WOOD });
  b.box(-1.3 - 0.25, 0, -0.4, 0.07, 0.52, 0.07, '#5a3f26', { kind: VK.WOOD });       // ayak (oklar havada kalmasın)
  b.box(-1.3 - 0.25, 0, 0.4, 0.07, 0.52, 0.07, '#5a3f26', { kind: VK.WOOD });
  if (hay) { bale(b, -0.6, 0.72, 0, false); bale(b, 0.6, 0.72, 0, false); }
}
// traktör: gövde, kaput, kabin direkleri + tavan, büyük arka / küçük ön tekerlek
export function tractor(b, { color = '#3a6aa8' } = {}) {
  b.box(0.6, 0.55, 0, 2.2, 0.75, 0.95, color, { kind: VK.PAINT });                 // kaput + motor
  b.box(-0.9, 0.45, 0, 1.0, 0.95, 1.0, color, { kind: VK.PAINT });                 // sürücü bölmesi
  b.box(-0.9, 1.4, 0, 0.5, 0.12, 0.55, '#2a2a2a', { collide: false, kind: VK.PLAIN });   // koltuk
  for (const [px, pz] of [[-1.35, -0.47], [-1.35, 0.47], [-0.45, -0.47], [-0.45, 0.47]]) b.box(px, 1.4, pz, 0.06, 1.0, 0.06, '#2a2a2a', { collide: false, kind: VK.METAL });
  b.box(-0.9, 2.4, 0, 1.0, 0.06, 1.0, color, { collide: false, kind: VK.PAINT });
  b.box(1.4, 1.3, 0.25, 0.08, 0.5, 0.08, '#2a2a2a', { collide: false, kind: VK.METAL });   // egzoz
  for (const sz of [-0.72, 0.72]) hCyl(b, -0.9, 0.7, sz, 0.7, 0.44, 'z', '#1f1f1f', { kind: VK.PLAIN, seg: 10 });
  for (const sz of [-0.6, 0.6]) hCyl(b, 1.25, 0.4, sz, 0.4, 0.25, 'z', '#1f1f1f', { kind: VK.PLAIN, seg: 10 });
}
// kamyonet (eski, terk edilmiş): şasi, kabin, kasa (yanlar + arka kapak), tekerlekler; araç gövdesi parça parça çarpışır (cam boşluğundan atış geçer)
export function pickup(b, { color = '#7a8a6a', wreck = false } = {}) {
  const C = wreck ? '#6a5a4a' : color;
  b.box(0, 0.35, 0, 4.6, 0.45, 1.8, '#2e2b28', { kind: VK.METAL });                  // şasi
  b.box(1.35, 0.8, 0, 1.6, 0.45, 1.8, C, { kind: VK.PAINT });                        // kaput
  b.box(0.05, 0.8, 0, 1.0, 0.55, 1.8, C, { kind: VK.PAINT });                        // kabin alt
  // kabin: dört köşe direği + tavan; camlar direklerin arasında (direk yüzlerine değer, üst üste binmez)
  const cx0 = -0.45, cx1 = 0.55, pz = 0.86, pt = 0.08;
  for (const px of [cx0 + pt / 2, cx1 - pt / 2]) for (const sg of [-1, 1]) b.box(px, 1.35, sg * pz, pt, 0.5, pt, C, { collide: false, kind: VK.PAINT });
  b.box(0.05, 1.85, 0, 1.0, 0.08, 1.8, C, { kind: VK.PAINT });                        // tavan
  const G = { collide: false, o: { transparent: true, opacity: 0.35, roughness: 0.15 } };
  for (const px of [cx0 + pt / 2, cx1 - pt / 2]) b.box(px, 1.35, 0, 0.04, 0.5, 2 * pz - pt, '#9fb6bf', G);        // ön / arka cam
  for (const sg of [-1, 1]) b.box(0.05, 1.35, sg * pz, 1.0 - 2 * pt, 0.5, 0.04, '#9fb6bf', G);                   // yan camlar
  b.box(-1.6, 0.8, 0, 2.0, 0.08, 1.8, C, { kind: VK.PAINT });                         // kasa tabanı
  for (const sz of [-0.86, 0.86]) b.box(-1.6, 0.88, sz, 2.0, 0.45, 0.08, C, { kind: VK.PAINT });
  b.box(-2.56, 0.88, 0, 0.08, 0.45, 1.64, C, { kind: VK.PAINT });
  for (const [px, pz] of [[1.45, -0.95], [1.45, 0.95], [-1.4, -0.95], [-1.4, 0.95]]) hCyl(b, px, 0.38, pz, 0.38, 0.1, 'z', '#1c1c1c', { kind: VK.PLAIN, seg: 10 });
}
// ahşap çit: direk her 2 m'de, iki kuşak. Uçlar (x0, z0) → (x1, z1) eksen hizalı. gl(x, z): zemin. Kuşak, parçanın iki ucundaki yüksek zemine göre
// (eğimde alçak uçta kuşağın altı boşluk = doğal çit). Çarpışma: direkler + kuşaklar (her biri kendi kutusu).
export function fence(b, gl, x0, z0, x1, z1, { h = 1.05, color = '#8a6a45' } = {}) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const n = Math.max(1, Math.round(L / 2)), st = L / n;
  const P = (t) => (alongX ? [Math.min(x0, x1) + t, z0] : [x0, Math.min(z0, z1) + t]);
  for (let i = 0; i <= n; i++) {
    const [px, pz] = P(i * st), g = gl(px, pz);
    b.box(px, g - 0.3, pz, 0.12, h + 0.3, 0.12, '#5e4329', { kind: VK.WOOD });
  }
  for (let i = 0; i < n; i++) {
    const [ax, az] = P(i * st), [bx2, bz2] = P((i + 1) * st), g = Math.max(gl(ax, az), gl(bx2, bz2), gl((ax + bx2) / 2, (az + bz2) / 2));
    const cx = (ax + bx2) / 2, cz = (az + bz2) / 2, ln = st - 0.12;
    for (const ry of [0.42, 0.86]) {
      if (alongX) b.box(cx, g + ry, cz, ln, 0.1, 0.05, color, { kind: VK.PLANK });
      else b.box(cx, g + ry, cz, 0.05, 0.1, ln, color, { kind: VK.PLANK });
    }
  }
}
// kuru taş duvar: eksen hizalı, 1 m'lik parçalar, her parça kendi zemininin en alçağından iner (gömülü taban), üstte kapak taşı.
// gaps: [{at (uzunluk boyunca başlangıçtan), w}] kapı aralığı. y: düz düzlükte sabit kot (yoksa gl).
export function stoneWall(b, gl, x0, z0, x1, z1, { h = 1.15, t = 0.6, gaps = [], seg = 1.0 } = {}) {
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), L = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
  const a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), c = alongX ? z0 : x0;
  const runs = []; let cur = 0;
  for (const g of [...gaps].sort((p, q) => p.at - q.at)) { if (g.at > cur) runs.push([cur, g.at]); cur = g.at + g.w; }
  if (cur < L) runs.push([cur, L]);
  for (const [s, e] of runs) {
    const n = Math.max(1, Math.round((e - s) / seg)), st = (e - s) / n;
    for (let i = 0; i < n; i++) {
      const m = a0 + s + (i + 0.5) * st;
      const [px, pz] = alongX ? [m, c] : [c, m];
      const lo = Math.min(gl(px, pz), alongX ? Math.min(gl(px - st / 2, pz - t / 2), gl(px + st / 2, pz - t / 2), gl(px - st / 2, pz + t / 2), gl(px + st / 2, pz + t / 2)) : Math.min(gl(px - t / 2, pz - st / 2), gl(px - t / 2, pz + st / 2), gl(px + t / 2, pz - st / 2), gl(px + t / 2, pz + st / 2)));
      const top = Math.max(gl(px, pz), lo) + h;
      const bw = alongX ? st : t, bd = alongX ? t : st;
      b.box(px, lo - 0.25, pz, bw, top - lo + 0.25 - 0.12, bd, PAL.stone, { kind: VK.STONE });
      b.box(px, top - 0.12, pz, alongX ? st : t + 0.06, 0.12, alongX ? t + 0.06 : st, PAL.cap, { kind: VK.STONE });
    }
  }
}

// ───────── ev eşyası (katı biçimli: altında boşluk yok → görünmez çarpışma yok; tezgâh boyu 0,85 m → üstüne basamakla çıkılmaz) ─────────
export function table(b, x, z, w = 1.6, d = 0.8, ry = 0) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0.79, 0, w, 0.06, d, '#8a6440', { kind: VK.PLANK });
    for (const sx of [-1, 1]) b.box(sx * (w / 2 - 0.1), 0, 0, 0.08, 0.79, d - 0.12, '#6e4e30', { kind: VK.WOOD });    // iki uç ayak tahtası (yan levha)
  });
}
export function bench(b, x, z, len = 1.4, ry = 0) {
  b.with(x, 0, z, ry, () => { b.box(0, 0, 0, len, 0.42, 0.34, '#7a5634', { kind: VK.PLANK }); });
}
export function cabinet(b, x, z, w = 1.0, d = 0.5, h = 1.8, ry = 0) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, w, h, d, '#6e4e30', { kind: VK.WOOD });
    b.box(0, h * 0.2, -d / 2 - 0.02, w - 0.16, h * 0.62, 0.02, '#7d5a3a', { collide: false, kind: VK.PLANK });     // kapak (ön yüze yaslı)
  });
}
export function bed(b, x, z, ry = 0) {
  b.with(x, 0, z, ry, () => {
    b.box(0, 0, 0, 2.0, 0.42, 0.95, '#6e4e30', { kind: VK.WOOD });
    b.box(0.05, 0.42, 0, 1.9, 0.14, 0.85, '#d8d2c0', { kind: VK.CANVAS });
    b.box(-0.95, 0.42, 0, 0.1, 0.5, 0.95, '#5a3f26', { kind: VK.WOOD });
  });
}
export function stove(b, x, z, ceil) {             // döküm soba + baca borusu tavana kadar
  b.box(x, 0, z, 0.7, 0.8, 0.6, '#2f2d2b', { kind: VK.METAL });
  b.box(x, 0.8, z, 0.16, ceil - 0.8, 0.16, '#2a2826', { collide: false, kind: VK.METAL });
}
export function rug(b, x, z, w, d) { b.box(x, 0, z, w, 0.015, d, '#8a3a2e', { collide: false, kind: VK.CANVAS }); }
