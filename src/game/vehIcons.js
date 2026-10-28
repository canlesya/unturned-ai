// 12.205 araç simgeleri (yandan, 24 × 15 kutu): ölüm doğuş haritası (canvas Path2D) + doğuş listesi / seçim satırı (satır içi SVG) aynı yollar.
// Tür: helikopter, tank, motor, jip (diğer kara araçları jip simgesi). Her parça ayrı doldurulur (üst üste binen parçalar delik açmasın); 's' = çizgi (teker halkası).
const circ = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
const P = {
  jip: [['M1 10V6.6L4 6l2.2-3.6h6.6L14.4 6h6.2L23 7.4V10z'], [circ(5.6, 11, 2.6)], [circ(18.4, 11, 2.6)]],
  tank: [['M2 9.2h20l-2.2 4.2H4.2z'], ['M3.2 8.8l1.6-2.6h14.6l1.6 2.6z'], ['M7.6 5.8l1-2.6h6l1.4 2.6z'], ['M15.4 3.7h8.2v1.4h-8.2z']],
  heli: [['M3 8.6C3 6.1 5.5 5 8.5 5h4.6l2.2 2.8H22v1.7h-6.6C14 11.6 12 12.2 9 12.2H7.2C4.6 12.2 3 10.7 3 8.6z'], ['M1.5 2.2h19.5v1.2H1.5z'], ['M10.6 3.3h1.5v1.8h-1.5z'],
    ['M5 13.4h9.6v1.1H5z'], ['M6.6 12h1v1.5h-1z'], ['M11.6 12h1v1.5h-1z'], ['M21.4 5.6h1.2v5.6h-1.2z']],
  moto: [[circ(4.8, 10.4, 2.9), 1], [circ(19.2, 10.4, 2.9), 1], ['M4.2 10.2L8.6 5.6h6.2l4.9 4.6-1 .9-4.4-4H9.3L5.2 11.2z'], ['M7.6 4.2h6.8v1.5H7.6z'], ['M15.6 2.6h3v1.3h-3z'], ['M16.4 3.6l1.2-.2 2.2 6.8-1.2.3z']],
};
export const vehKind = (v) => { const d = v?.def || {}; return d.heli ? 'heli' : d.moto ? 'moto' : d.cannon || d.tracked ? 'tank' : 'jip'; };
const _p2 = {};
// canvas: x.save(); x.translate(sol üst); x.scale(k); vehIconDraw(x, v); x.restore() — renk x.fillStyle / x.strokeStyle
export function vehIconDraw(x, v) {
  const k = vehKind(v), L = (_p2[k] ||= P[k].map(([d, st]) => [new Path2D(d), st]));
  for (const [p, st] of L) if (st) { x.lineWidth = 1.5; x.stroke(p); } else x.fill(p);
}
export function vehIconSvg(v, cls = 'hsi vi') {
  return `<svg class="${cls}" viewBox="0 0 24 15">${P[vehKind(v)].map(([d, st]) => st ? `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5"/>` : `<path d="${d}" fill="currentColor"/>`).join('')}</svg>`;
}
