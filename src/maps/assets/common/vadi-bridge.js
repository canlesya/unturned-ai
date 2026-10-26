import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

// Paylaşılabilir köprü asset'leri (12.169, ilk kullanan: Vadi). İkisi de TEK PARÇA: tabliye, korkuluk, ayak ve kemer birbirine değer, iç içe girmez;
// çarpışma = görsel (tabliye 'deck' → yol bulma üstünden geçer, korkuluk 'rail').
//
// stoneArchBridge(b, o): taş kemerli köprü. Yerel çerçeve: x boyunca uzanır (−L/2 … L/2), z ± W/2, y mutlak (tabliye üstü o.top).
//   Kemerler dilim dilim dışbükey parçalar (yüzü yumuşak yay, basamak / piksel yok); her dilimin çarpışması dilimin içine çizilmiş kutu.
// plankBridge(b, o): ip korkuluklu tahta asma köprü (x0 → x1, z sabit, tabliye üstü o.top, genişlik o.w).
// kind: yüzey sınıfları ({ stone, wood, plank, rope }) — haritanın gölgelendirici sınıf numaraları.

export function stoneArchBridge(b, o) {
  const L = o.L ?? 20, W = o.W ?? 6.6, top = o.top, K = o.kind || {}, deckT = 0.45;
  const stone = o.stone ?? '#958d7c', dark = o.dark ?? '#7c7464', cap = o.cap ?? '#a7a08f';
  const piers = o.piers ?? [[-2.8, -1.6], [1.6, 2.8]];       // ayak x aralıkları
  const abut = o.abut ?? 6.6;                                   // kemer uç yüzü (kıyı ayağı) |x|
  const spring = o.spring ?? 0.0, apexGap = 0.15, bed = o.bed ?? -1.5;
  const db = top - deckT;                                       // tabliye altı
  const kd = (k) => ({ kind: K[k] });
  // tabliye (yol bulma tabliyesi) + korkuluk + kapak taşı
  b.withKind(K.stone, () => b.box(0, db, 0, L, deckT, W, stone, { tag: 'deck' }));
  for (const sz of [-1, 1]) {
    b.withKind(K.stone, () => b.box(0, top, sz * (W / 2 - 0.2), L, 0.72, 0.4, stone, { tag: 'rail' }));
    b.withKind(K.stone, () => b.box(0, top + 0.72, sz * (W / 2 - 0.25), L, 0.1, 0.5, cap, { tag: 'rail' }));     // kapak taşı içe taşar, dışa değil (kıyıda yanından geçenin başına değmez)
  }
  // ayaklar: yataktan tabliye altına; uçları tabliyeden 0,35 m taşar (su kesici). Tabliye altı parçalar 'deck' etiketli: yol bulma bunları engel
  // saymaz (tabliyenin altında kalırlar), fizik aynı (katı)
  for (const [x0, x1] of piers) footing(b, K, (x0 + x1) / 2, bed, 0, x1 - x0, db - bed, W + 0.7, dark);
  // kıyı ayakları: kemer ucundan tabliye ucuna, yataktan tabliye altına (çoğu kıyı toprağına gömülü)
  for (const sg of [-1, 1]) footing(b, K, sg * (abut + (L / 2 - abut) / 2), bed, 0, L / 2 - abut, db - bed, W, dark);
  // kemerler: her açıklıkta (ayak / kıyı yüzleri arası) yarım elips tavan; dilim i = [xa, xb] × [tavan(xa..xb), db] dışbükey 8 köşeli parça
  const spans = [];
  const edges = [-abut, ...piers.flat(), abut];
  for (let i = 0; i < edges.length; i += 2) spans.push([edges[i], edges[i + 1]]);
  for (const [a0, a1] of spans) {
    const c = (a0 + a1) / 2, hw = (a1 - a0) / 2, rise = db - apexGap - spring, N = 10;
    const soffit = (x) => spring + rise * Math.sqrt(Math.max(0, 1 - ((x - c) / hw) ** 2));
    for (let i = 0; i < N; i++) {
      const xa = a0 + (a1 - a0) * i / N, xb = a0 + (a1 - a0) * (i + 1) / N;
      const ya = soffit(xa), yb = soffit(xb);
      const pts = [];
      for (const z of [-W / 2, W / 2]) pts.push(new THREE.Vector3(xa, ya, z), new THREE.Vector3(xb, yb, z), new THREE.Vector3(xa, db, z), new THREE.Vector3(xb, db, z));
      const g = new ConvexGeometry(pts);
      b.withKind(K.stone, () => b.addGeo(g, i === 0 || i === N - 1 ? dark : stone, new THREE.Matrix4()));
      const lo = Math.max(ya, yb);
      if (db - lo > 0.04) b.collide((xa + xb) / 2, lo, 0, xb - xa, db - lo, W, 'deck');
    }
    // kilit taşı bandı: kemer alnında (dış yüzlere yaslı) ince açık taş şerit — çarpışmasız süs
    for (const sz of [-1, 1]) b.withKind(K.stone, () => b.box(c, db - apexGap - 0.06, sz * (W / 2 + 0.02), 0.5, apexGap + 0.06, 0.04, cap, { collide: false }));
  }
  // kör kemerler: dolu kıyı ayaklarının alnında kemer çizgisi (yüze yaslı 3 cm kabartma taş dizisi; çarpışmasız süs)
  for (const [a0, a1] of o.blind || []) {
    const c = (a0 + a1) / 2, hw = (a1 - a0) / 2, rise = db - apexGap - 0.1, N = 9;
    for (let i = 0; i <= N; i++) {
      const t = -1 + 2 * i / N, x = c + t * hw * 0.92, y = 0.05 + rise * Math.sqrt(Math.max(0, 1 - t * t));
      for (const sz of [-1, 1]) b.withKind(K.stone, () => b.box(x, y - 0.09, sz * (W / 2 + 0.015), 0.22, 0.18, 0.03, cap, { collide: false }));
    }
  }
}

function footing(b, K, x, y, z, w, h, d, color) { b.withKind(K.stone, () => b.box(x, y, z, w, h, d, color, { tag: 'deck' })); }

export function plankBridge(b, o) {
  const { x0, x1, z, top } = o, w = o.w ?? 2.2, K = o.kind || {};
  const len = x1 - x0, pw = 0.25, n = Math.round(len / pw), st = len / n;
  const plank = o.plank ?? '#8b6a45', plank2 = o.plank2 ?? '#7d5e3c', post = o.post ?? '#5a3f26', rope = o.rope ?? '#b9a77a';
  // tahtalar aralıksız (tek tabliye çarpışması = tahtaların birleşimi), iki ton sırayla
  // tahtalar (üst 7 cm) + altında koyu taban tahtası (18 cm): tabliye 25 cm kalınlığında tek çarpışma (ince geniş kutu fizikte itme hatası yapıyordu)
  for (let i = 0; i < n; i++) b.withKind(K.plank, () => b.box(x0 + (i + 0.5) * st, top - 0.07, z, st, 0.07, w, i % 2 ? plank : plank2, { collide: false }));
  b.withKind(K.wood, () => b.box((x0 + x1) / 2, top - 0.25, z, len, 0.18, w, post, { collide: false }));
  b.collide((x0 + x1) / 2, top - 0.25, z, len, 0.25, w, 'deck');
  // alttan iki boylama kiriş: yalnız açıklık boyunca (kıyı düzlüklerine girmez), taban tahtasına değer
  const bx0 = o.span ? o.span[0] : x0 + 1.5, bx1 = o.span ? o.span[1] : x1 - 1.5;
  for (const sz of [-1, 1]) b.withKind(K.wood, () => b.box((bx0 + bx1) / 2, top - 0.45, z + sz * (w / 2 - 0.15), bx1 - bx0, 0.2, 0.16, post, { collide: false }));
  // uç direkleri (kıyı düzlüğünde, tabliyenin yanında) + sarkan ip korkuluk + askılar
  const ends = [x0 + 0.35, x1 - 0.35], ph = 1.35, pw2 = 0.09;
  for (const ex of ends) for (const sz of [-1, 1]) b.withKind(K.wood, () => b.box(ex, top - 0.07 - 0.6, z + sz * (w / 2 + 0.09), 0.18, ph + 0.67, 0.18, post));
  // yan tahta perde (0,6 m; tabliyenin yan yüzüne yaslı, direkten direğe): yürürken kenardan düşülmez (botlar dahil), ip korkuluk üstte süs
  for (const sz of [-1, 1]) b.withKind(K.plank, () => b.box((ends[0] + ends[1]) / 2, top - 0.25, z + sz * (w / 2 + 0.03), ends[1] - ends[0] - 0.18, 0.85, 0.06, plank2, { tag: 'rail' }));
  const r0 = ends[0] + pw2, span = ends[1] - pw2 - r0, sag = Math.min(0.55, span * 0.04), seg = Math.max(6, Math.round(span / 1.2));     // ip direklerin iç yüzünden başlar
  const ry = (t) => top + ph - 0.12 - sag * 4 * t * (1 - t);
  for (const sz of [-1, 1]) {
    const zz = z + sz * (w / 2 + 0.09);
    for (let k = 0; k < seg; k++) {
      const ta = k / seg, tb = (k + 1) / seg, xa = r0 + span * ta, xb = r0 + span * tb, ya = ry(ta), yb = ry(tb);
      const L = Math.hypot(xb - xa, yb - ya), a = Math.atan2(yb - ya, xb - xa);
      b.withKind(K.rope, () => b.box((xa + xb) / 2, (ya + yb) / 2 - 0.025, zz, L, 0.05, 0.05, rope, { collide: false, rz: a }));
      if (k > 0) b.withKind(K.rope, () => b.box(xa, top, zz, 0.03, ya - top, 0.03, rope, { collide: false }));
    }
  }
}
