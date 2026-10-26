// VADİ v3 asset kiti — ortak kurallar (12.169):
//  · Her asset kendi yerel çerçevesinde çizilir: orijin = zemin (düzlük kotu), ayak izi ortada, 90°'nin katlarıyla döner (çarpışma kutuları birebir kalır).
//  · Parçalar birbirine DEĞER, içine girmez (iç içe / eş düzlem yüz yok → z-fighting yok); süs parçaları duvarın dış yüzüne yaslanır.
//  · Görünen her katı parça ya kendi kutusuyla çarpışır ya da (silindir / kütük / gövde) içine çizilmiş kutularla: çarpışma hep görselin İÇİNDE
//    (görünmez engel yok). Ulaşılamayan yükseklikteki süs (saçak, kanat, ip) çarpışmasızdır.
import { VK } from './surface.js';

// yuvarlak gövde (8 kenar, kenarlar eksenlere bakar → kullanıcı silindiri ry = π/8 ile çizer): içine çizilmiş artı + kare kutular.
// a = kenar orta uzaklığı (apothem) = r·cos(22,5°). small: tek kare (ince direk / gövde).
export function roundCollide(b, x, y, z, r, h, { small = false, tag } = {}) {
  const a = r * 0.9239, s = a * 0.4142, q = a * 0.7071;
  if (small) { b.collide(x, y, z, q * 2, h, q * 2, tag); return; }
  b.collide(x, y, z, a * 2, h, s * 2, tag);
  b.collide(x, y, z, s * 2, h, a * 2, tag);
  b.collide(x - (q + s) / 2, y, z, q - s, h, q * 2, tag); b.collide(x + (q + s) / 2, y, z, q - s, h, q * 2, tag);
}
// sekizgen silindir (kenarlar eksenlere dik): görsel + içine çizilmiş çarpışma
export function octCyl(b, x, y, z, r, h, color, { kind, collide = true, small = false, rTop = r, tag } = {}) {
  b.cyl(x, y, z, rTop, r, h, color, { seg: 8, ry: Math.PI / 8, collide: false, kind });
  if (collide) roundCollide(b, x, y, z, Math.min(r, rTop), h, { small, tag });
}
// yatay kütük / tekerlek (eksen x ya da z): görsel 8 kenarlı silindir, çarpışma içine çizilmiş kare
export function hCyl(b, x, y, z, r, len, axis, color, { kind = VK.BARK, collide = true, seg = 8 } = {}) {
  b.cyl(x, y, z, r, r, len, color, { seg, center: true, collide: false, kind, ...(axis === 'x' ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 }), ry: 0 });
  if (!collide) return;
  const q = r * Math.cos(Math.PI / seg) * 0.7071 * 2;
  if (axis === 'x') b.collide(x, y - q / 2, z, len, q, q); else b.collide(x, y - q / 2, z, q, q, len);
}
// çatı prizması (sırt z ekseninde; ridge 'x' → 90° döner): görsel b.prism, çarpışma İÇİNE çizilmiş basamaklar (her basamak kendi dış kenarındaki
// yükseklikte → üçgenin dışına taşmaz). Tag 'roof'.
export function roofPrism(b, x, y, z, w, h, d, color, { ridge = 'z', kind, fr = [0.75, 0.5, 0.25], tag = 'roof' } = {}) {
  b.withKind(kind ?? VK.PLASTER, () => b.prism(x, y, z, w, h, d, color, { ry: ridge === 'x' ? Math.PI / 2 : 0, collide: false }));
  // basamak k: |yatay| ≤ fr[k]·w/2 aralığında, yüksekliği o aralığın dış ucundaki prizma yüksekliği h·(1 − fr[k]) (iç içe kutular; dış kenarı üçgenin içinde)
  for (const f of fr) {
    const hk = h * (1 - f), half = f * w / 2;
    if (hk < 0.05 || half < 0.05) continue;
    if (ridge === 'x') b.collide(x, y, z, d, hk, half * 2, tag); else b.collide(x, y, z, half * 2, hk, d, tag);
  }
  // taban levhası: hb yüksekliğinde üçgenin genişliği w·(1 − hb/h) → içine çizilmiş; içeriden tavan (saçak şeridi dahil) katı, çatı arasına girilmez
  const hb = Math.min(0.12, h * 0.2), wb = w * (1 - hb / h);
  if (ridge === 'x') b.collide(x, y, z, d, hb, wb, tag); else b.collide(x, y, z, wb, hb, d, tag);
}
// iki eğik çatı levhası (çarpışmasız; altındaki prizma katıdır): eğim düzlemi prizmanın yüzüyle çakışık alt yüz, saçak ovE, alın taşması ovG
export function roofSlabs(b, x, y, z, w, h, d, color, { ridge = 'z', ovE = 0.45, ovG = 0.35, t = 0.13, kind = VK.ROOF } = {}) {
  const a = Math.atan2(h, w / 2), c = Math.cos(a), s = Math.sin(a);
  const run = w / 2 + ovE, e = 0.14, L = run / c + e;
  b.withKind(kind, () => {
    for (const sg of [-1, 1]) {
      // eğim boyunca (aşağı) birim u = (sg·c, −s), dış normal n = (sg·s, c); alt yüz tepe noktasından geçer
      const along = L / 2 - e;
      const px = sg * c * along + sg * s * (t / 2), py = h - s * along + c * (t / 2);
      if (ridge === 'x') b.box(x, y + py - t / 2, z + px, d + 2 * ovG, t, L, color, { collide: false, rx: sg * a });
      else b.box(x + px, y + py - t / 2, z, L, t, d + 2 * ovG, color, { collide: false, rz: -sg * a });
    }
  });
}
export const ROT = { n: 0, e: -Math.PI / 2, s: Math.PI, w: Math.PI / 2 };
