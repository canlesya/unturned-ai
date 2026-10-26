// Çöl Geçidi v2 yerleşim şablonu (kuşbakışı): zemin katları / rampalar, bina kütleleri, istinat duvarları, kapılar, köprü, çatılı geçitler, doğuşlar,
// hedefler, bölge adları → PNG.   node scripts/cgplan_plot.mjs [çıktı.png=screenshots/colgecidi-plan.png]
import { chromium } from 'playwright';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { buildColGecidi } from '../src/maps/colgecidi.js';
import { FLOORS, MASSES, OUTSIDE } from '../src/maps/assets/colgecidi/plan.js';
import { GATES, ROOFS } from '../src/maps/assets/colgecidi/build.js';
const OUT = process.argv[2] || 'screenshots/colgecidi-plan.png';
const m = buildColGecidi(), T = m.terrain, L = T.L;
const S = 7, X0 = -67, Z0 = -72, W = 134 * S, H = 144 * S + 70;
const X = (x) => (x - X0) * S, Z = (z) => (z - Z0) * S;
const hcol = (h) => { const t = Math.max(0, Math.min(1, (h + 1.5) / 8.5)); const c = [[96, 78, 58], [174, 150, 108], [214, 192, 140], [236, 216, 160], [248, 236, 196]]; const k = t * (c.length - 1), i = Math.min(c.length - 2, Math.floor(k)), f = k - i; return `rgb(${c[i].map((v, a) => Math.round(v + (c[i + 1][a] - v) * f)).join(',')})`; };
const p = [];
p.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#1b1d24"/>`);
for (const f of FLOORS) {
  const [x0, z0, x1, z1, t, a, b, c, d] = f;
  if (t === 'f') p.push(`<rect x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" fill="${hcol(a)}"/>`);
  else { const id = 'g' + p.length, hz = t === 'x', h0 = b, h1 = d; p.push(`<defs><linearGradient id="${id}" x1="0" y1="0" x2="${hz ? 1 : 0}" y2="${hz ? 0 : 1}"><stop offset="0" stop-color="${hcol(hz ? b + (d - b) * (x0 - a) / (c - a) : b + (d - b) * (z0 - a) / (c - a))}"/><stop offset="1" stop-color="${hcol(hz ? b + (d - b) * (x1 - a) / (c - a) : b + (d - b) * (z1 - a) / (c - a))}"/></linearGradient></defs><rect x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" fill="url(#${id})"/>`); }
}
for (const [id, top, x0, z0, x1, z1] of MASSES) { const v = Math.round(52 + (top - 6) * 9); p.push(`<rect x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" fill="rgb(${v},${v + 4},${v + 18})"/>`); }
for (const [x0, z0, x1, z1] of OUTSIDE) p.push(`<rect x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" fill="#2a2c36"/>`);
// istinat duvarları (dikey zemin kenarları) ve pahlar
const SN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (let k = 0; k < L.N; k++) for (let s = 0; s < 4; s++) { const e = T.edge[k * 4 + s]; if (e !== 2 && e !== 1) continue; const [a, b] = T.edgePts(k % L.nx, (k / L.nx) | 0, s); p.push(`<line x1="${X(a[0])}" y1="${Z(a[1])}" x2="${X(b[0])}" y2="${Z(b[1])}" stroke="${e === 2 ? '#d8452f' : '#f0b13a'}" stroke-width="${e === 2 ? 2.2 : 1.4}"/>`); }
// çatılı geçitler + köprü
for (const [, [x0, z0, x1, z1]] of ROOFS) p.push(`<rect x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" fill="rgba(120,90,50,0.28)" stroke="#8a6a3c" stroke-dasharray="5 3" stroke-width="1.5"/>`);
p.push(`<rect x="${X(15)}" y="${Z(-51)}" width="${8 * S}" height="${16.5 * S}" fill="rgba(70,120,190,0.25)" stroke="#5fa0ff" stroke-width="2" stroke-dasharray="6 3"/><text x="${X(19)}" y="${Z(-42.5)}" class="t2" text-anchor="middle">KÖPRÜ 4,6</text>`);
for (const c of m.colliders) { if (!/^(kasa|sandık|palmiye|kapı|korkuluk|duvar|B-penceresi|köprü:ayak|köprü:kemer)/.test(c.oid)) continue; const col = /^kapı/.test(c.oid) ? (c.tag === 'wood' ? '#c98a3a' : '#e9dcbc') : /^palmiye/.test(c.oid) ? '#4e8a3a' : /^(korkuluk|duvar)/.test(c.oid) ? '#f2e3b8' : '#a07a48'; p.push(`<rect x="${X(c.min[0])}" y="${Z(c.min[2])}" width="${Math.max(1, (c.max[0] - c.min[0]) * S)}" height="${Math.max(1, (c.max[2] - c.min[2]) * S)}" fill="${col}" stroke="#111" stroke-width="0.5"/>`); }
for (const g of GATES) { const x = g.axis === 'x' ? g.c : g.at + 0.5, z = g.axis === 'x' ? g.at + 0.5 : g.c; p.push(`<text x="${X(x)}" y="${Z(z) - 8}" class="t3" text-anchor="middle">${g.name}</text>`); }
for (const s of m.spawns.blue) p.push(`<circle cx="${X(s.x)}" cy="${Z(s.z)}" r="3.2" fill="#4a9bff" stroke="#fff" stroke-width="0.8"/>`);
for (const s of m.spawns.red) p.push(`<circle cx="${X(s.x)}" cy="${Z(s.z)}" r="3.2" fill="#ff5a4a" stroke="#fff" stroke-width="0.8"/>`);
for (const o of m.objectives) p.push(`<circle cx="${X(o.x)}" cy="${Z(o.z)}" r="${o.r * S}" fill="rgba(255,220,80,0.12)" stroke="#ffd84a" stroke-width="2"/><text x="${X(o.x)}" y="${Z(o.z) + 7}" class="ob" text-anchor="middle">${o.label}</text>`);
for (const c of m.callouts) p.push(`<text x="${X(c.x)}" y="${Z(c.z)}" class="${c.major ? 't1' : 't2'}" text-anchor="middle">${c.name}</text>`);
for (let g = -60; g <= 60; g += 10) p.push(`<text x="${X(g)}" y="12" class="ax" text-anchor="middle">${g}</text><text x="4" y="${Z(g) + 4}" class="ax">${g}</text>`);
const leg = [['#d8452f', 'istinat duvarı (dikey, görünen = çarpışma)'], ['#f0b13a', 'pah (≤ 0,55 m yürünür basamak)'], ['#8a6a3c', 'çatılı geçit'], ['#5fa0ff', 'köprü (altında 2. kat)'], ['#4a9bff', 'T / mavi doğuş'], ['#ff5a4a', 'CT / kırmızı doğuş'], ['#ffd84a', 'hedef (U / O / T)']];
leg.forEach(([c, t], i) => p.push(`<rect x="${10 + (i % 3) * 310}" y="${H - 64 + Math.floor(i / 3) * 20}" width="14" height="14" fill="${c}"/><text x="${30 + (i % 3) * 310}" y="${H - 52 + Math.floor(i / 3) * 20}" class="lg">${t}</text>`));
p.push(`<text x="${W - 10}" y="${H - 10}" class="lg" text-anchor="end">Çöl Geçidi v2 — plan ızgarası 0,5 m · zemin rengi = kot (koyu −1,2 … açık 6,6 m) · 7 px = 1 m</text>`);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><style>.t1{font:700 13px Arial;fill:#fff;paint-order:stroke;stroke:#000;stroke-width:3px}.t2{font:600 10px Arial;fill:#fff8e0;paint-order:stroke;stroke:#000;stroke-width:2.5px}.t3{font:600 9px Arial;fill:#ffd9a0;paint-order:stroke;stroke:#000;stroke-width:2px}.ob{font:800 18px Arial;fill:#ffd84a;paint-order:stroke;stroke:#000;stroke-width:3px}.ax{font:10px Arial;fill:#aaa}.lg{font:12px Arial;fill:#ddd}</style>${p.join('')}</svg>`;
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: W, height: H } });
await pg.setContent(svg); await pg.screenshot({ path: OUT }); await b.close(); console.log(OUT);
