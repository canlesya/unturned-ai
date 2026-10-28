// 12.205 araç simgeleri (yandan, 24 × 15 kutu): ölüm doğuş haritası (canvas Path2D) + doğuş listesi / seçim satırı (satır içi SVG) aynı yollar.
// Tür: helikopter, tank, motor, jip (diğer kara araçları jip simgesi). Her parça ayrı doldurulur (üst üste binen parçalar delik açmasın); 's' = çizgi (teker halkası).
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
const P = {
  jip: [['M1 10V6.6L4 6l2.2-3.6h6.6L14.4 6h6.2L23 7.4V10z'], [circ(5.6, 11, 2.6)], [circ(18.4, 11, 2.6)]],
  tank: [['M2 9.2h20l-2.2 4.2H4.2z'], ['M3.2 8.8l1.6-2.6h14.6l1.6 2.6z'], ['M7.6 5.8l1-2.6h6l1.4 2.6z'], ['M15.4 3.7h8.2v1.4h-8.2z']],
  heli: [['M3 8.6C3 6.1 5.5 5 8.5 5h4.6l2.2 2.8H22v1.7h-6.6C14 11.6 12 12.2 9 12.2H7.2C4.6 12.2 3 10.7 3 8.6z'], ['M1.5 2.2h19.5v1.2H1.5z'], ['M10.6 3.3h1.5v1.8h-1.5z'],
    ['M5 13.4h9.6v1.1H5z'], ['M6.6 12h1v1.5h-1z'], ['M11.6 12h1v1.5h-1z'], ['M21.4 5.6h1.2v5.6h-1.2z']],
  moto: [[circ(4.8, 10.4, 2.9), 1], [circ(19.2, 10.4, 2.9), 1], ['M4.2 10.2L8.6 5.6h6.2l4.9 4.6-1 .9-4.4-4H9.3L5.2 11.2z'], ['M7.6 4.2h6.8v1.5H7.6z'], ['M15.6 2.6h3v1.3h-3z'], ['M16.4 3.6l1.2-.2 2.2 6.8-1.2.3z']],
  // 12.213 sabit yuvalar: ağır makineli (tripod + kalkan + uzun namlu), tanksavar (tripod + kalın tüp)
  hmg: [['M3 7.6h11v2H3z'], ['M14 8h9v1.2h-9z'], ['M8.4 4.2h1.6v7h-1.6z'], ['M8.6 10.6L4 14h1.8l3.6-2.6z'], ['M9.8 10.6L14 14h-1.8l-3.6-2.6z'], ['M2.6 9.6h4v1.4h-4z']],
  atgm: [['M2 6.2h17v3.4H2z'], ['M19 5.6h3v4.6h-3z'], ['M6 3.6h5v2.2H6z'], ['M10 9.4h1.4v2h-1.4z'], ['M10.2 11L5 14.4h1.9l4-2.8z'], ['M11.2 11l5.2 3.4h-1.9l-4-2.8z']],
};
export const vehKind = (v) => { const d = v?.def || {}; return d.fixed ? (d.atgm ? 'atgm' : 'hmg') : d.heli ? 'heli' : d.moto ? 'moto' : d.cannon || d.tracked ? 'tank' : 'jip'; };
const _p2 = {};
// canvas: x.save(); x.translate(sol üst); x.scale(k); vehIconDraw(x, v); x.restore() — renk x.fillStyle / x.strokeStyle
export function vehIconDraw(x, v) {
  const k = vehKind(v), L = (_p2[k] ||= P[k].map(([d, st]) => [new Path2D(d), st]));
  for (const [p, st] of L) if (st) { x.lineWidth = 1.5; x.stroke(p); } else x.fill(p);
}
export function vehIconSvg(v, cls = 'hsi vi') {
  return `<svg class="${cls}" viewBox="0 0 24 15">${P[vehKind(v)].map(([d, st]) => st ? `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5"/>` : `<path d="${d}" fill="currentColor"/>`).join('')}</svg>`;
}

// 12.213 harita (M / mini harita) sabit yuva işareti: koyu yuvarlak rozet içinde yuva simgesi; dolu (kullanan) = takım rengi, boş = açık gri
export function empMark(x, px, py, v, tm, occ, D = 1) {
  const r = 9 * D;
  x.save(); x.translate(px, py);
  x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fillStyle = 'rgba(12,16,20,.78)'; x.fill();
  x.lineWidth = 1.6 * D; x.strokeStyle = occ ? (tm === 'blue' ? '#4aa3ff' : tm === 'red' ? '#ff5a43' : '#fff') : 'rgba(255,255,255,.55)'; x.stroke();
  const k = (r * 1.5) / 24; x.translate(-12 * k, -7.5 * k); x.scale(k, k);
  x.fillStyle = occ ? (tm === 'blue' ? '#8cc6ff' : tm === 'red' ? '#ff9a88' : '#fff') : '#d8d4c4'; vehIconDraw(x, v);
  x.restore();
}
// 12.216 yok edilmiş (yeniden kurulan) sabit yuva: soluk rozet + kırmızı çarpı (M / mini harita; konum doğuş verisinden)
export function empDownMark(x, px, py, v, D = 1) {
  x.save(); x.globalAlpha = 0.5; empMark(x, px, py, v, null, 0, D); x.restore();
  const r = 5.5 * D; x.save(); x.translate(px, py); x.strokeStyle = '#ff8a74'; x.lineWidth = 1.8 * D;
  x.beginPath(); x.moveTo(-r, -r); x.lineTo(r, r); x.moveTo(r, -r); x.lineTo(-r, r); x.stroke(); x.restore();
}
// 12.216 ikmal kutusu (RPG + cephane): yeşil sandık + sarı şerit + üstünde roket; kullanılamayan (düşmanın) soluk
export function supMark(x, px, py, open, D = 1) {
  const w = 7 * D, h = 4.6 * D;
  x.save(); x.translate(px, py); x.globalAlpha = open ? 1 : 0.45;
  x.fillStyle = '#56633a'; x.strokeStyle = open ? '#eef7d8' : 'rgba(255,255,255,.5)'; x.lineWidth = 1.4 * D;
  x.fillRect(-w, -h + 2 * D, w * 2, h * 2); x.strokeRect(-w, -h + 2 * D, w * 2, h * 2);
  x.fillStyle = '#e0a92c'; x.fillRect(-w + D, 2.2 * D, w * 2 - 2 * D, 1.8 * D);
  x.fillStyle = '#dfe7c8'; x.fillRect(-w - D, -h - 1.2 * D, w * 2, 2 * D);                                                   // roket tüpü (kutunun üstünde)
  x.beginPath(); x.moveTo(w - D, -h - 2.4 * D); x.lineTo(w + 3.4 * D, -h - 0.2 * D); x.lineTo(w - D, -h + 2 * D); x.closePath(); x.fill();      // savaş başlığı
  x.restore();
}
