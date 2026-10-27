// Nişangâh simgeleri (24 × 24 SVG içeriği, retikül görünüşü): dokunmatik seçici, T tekerleği ve Cephanelik çipleri ortak (12.190; eskiden touch.js içindeydi).
// Kırmızı parçalar retikül rengi (--rc) ile boyanır; gri = mercek kenarı, açık = siyah retikülün simgedeki karşılığı (koyu zeminde seçilsin).
const RC = 'var(--rc,#ff2a1a)', RIM = '#8a929c', LN = '#e8edf5';
const rim = `<circle cx="12" cy="12" r="10" stroke="${RIM}" stroke-width="1.5" fill="none"/>`;
export const OPTIC_ICON = {
  iron: `<path d="M4 20h6v-8h4v8h6" stroke="${LN}" stroke-width="2" fill="none"/><rect x="11" y="6" width="2" height="9" fill="${LN}"/>`,
  reddot: `<circle cx="12" cy="12" r="9" stroke="${RIM}" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="2.4" style="fill:${RC}"/>`,
  holo: `<circle cx="12" cy="12" r="7" style="stroke:${RC}" stroke-width="1.6" fill="none"/><circle cx="12" cy="12" r="1.4" style="fill:${RC}"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" style="stroke:${RC}" stroke-width="1.6"/>`,
  x2: `${rim}<path d="M2 12h5.5M16.5 12H22M12 2v5.5M12 16.5V22" stroke="${LN}" stroke-width="2"/><circle cx="12" cy="12" r="1.6" style="fill:${RC}"/>`,
  x3: `${rim}<path d="M2 12h20M12 2v20" stroke="${LN}" stroke-width=".9"/><path d="M2 12h4M18 12h4M12 18v4M12 2v4" stroke="${LN}" stroke-width="2.2"/><path d="M10.4 14.4h3.2M10.8 16h2.4" stroke="${LN}" stroke-width=".9"/><circle cx="12" cy="12" r="1.3" style="fill:${RC}"/>`,
  acog: `${rim}<path d="M12 13.6V19M10 15.2h4M10.5 16.8h3M11 18.3h2M2 12h5M17 12h5" stroke="${LN}" stroke-width="1"/><path d="M12 9.2l2.6 3.6h-1.1L12 10.7l-1.5 2.1H9.4z" style="fill:${RC}"/>`,
  scope: `${rim}<path d="M2 12h20M12 2v20" stroke="${LN}" stroke-width="1"/>`,
  ww_peep: `<circle cx="12" cy="12" r="7" stroke="${LN}" stroke-width="2" fill="none"/><rect x="11" y="10" width="2" height="7" fill="${LN}"/>`,
  ww_scout: `${rim}<path d="M2 12h20" stroke="${LN}" stroke-width="1"/><path d="M10.6 22v-8L12 12l1.4 2v8z" fill="${LN}"/>`,
  ww_sc4: `${rim}<path d="M2 11h7.5v2H2zM14.5 11H22v2h-7.5zM10.8 22v-8L12 12l1.2 2v8z" fill="${LN}"/>`,
};
OPTIC_ICON.scope6 = OPTIC_ICON.x6 = OPTIC_ICON.scope;
OPTIC_ICON.x8 = `${rim}<path d="M2 12h20M12 2v20" stroke="${LN}" stroke-width="1"/><path d="M2 12h4.5M17.5 12H22M12 2v4.5M12 17.5V22" stroke="${LN}" stroke-width="2.4"/><circle cx="12" cy="12" r=".9" style="fill:${RC}"/>`;
OPTIC_ICON.ww_sc25 = OPTIC_ICON.ww_sc4;
export const opticSvg = (id, cls = '') => `<svg viewBox="0 0 24 24"${cls ? ` class="${cls}"` : ''}>${OPTIC_ICON[id] || ''}</svg>`;
// Kısa büyütme etiketi (dokunmatik nişangâh düğmesi, çipler): 1× nişangâhlarda boş → ad gösterilir
export const OPTIC_MAG = { x2: '2×', x3: '3×', acog: '4×', scope: '4×', scope6: '6×', x6: '6×', x8: '8×', ww_scout: '1,5×', ww_sc25: '2,5×', ww_sc4: '4×' };
