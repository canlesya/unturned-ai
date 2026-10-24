// Batı Cephesi yerleşim planı verisi (kuşbakışı şema için): node scripts/frontplan.mjs [çıktı.json]  →  python3 scripts/frontplan.py girdi.json çıktı.png
// Arazi kesikleri (siper / sığınak / rampa), çarpışma kutuları (nesne kimliğiyle), nokta zinciri (12.161 Cephe Hattı), etkin noktaya göre doğuşlar, bot mevzi havuzu, kapaklar, bölge adları.
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
import { buildCephe } from '../src/maps/cephe.js';
MapBuilder.noVisual = true;
const m = buildCephe(), T = m.terrain;
const cells = [];
for (let j = 0; j < T.ch; j++) for (let i = 0; i < T.cw; i++) { const c = j * T.cw + i; if (T.cut[c]) cells.push([T.minX + i * T.cell, T.minZ + j * T.cell, T.cut[c], +T.fl[c].toFixed(2), T.rv[c]]); }
const craters = [];
for (let j = 0; j < T.nz; j++) for (let i = 0; i < T.nx; i++) { const h = T.h[j * T.nx + i]; if (h < -0.3) craters.push([T.minX + i * T.cell, T.minZ + j * T.cell, +h.toFixed(2)]); }
const cols = m.colliders.filter((c) => c.max[1] - c.min[1] > 0.3).map((c) => [+c.min[0].toFixed(2), +c.min[2].toFixed(2), +c.max[0].toFixed(2), +c.max[2].toFixed(2), +c.max[1].toFixed(2), String(c.oid || '').split(':')[0], c.tag || '']);
const out = { bounds: m.bounds, cell: T.cell, cells, craters, cols, objectives: m.objectives, chain: m.front.chain, stages: m.front.stages, holds: m.front.holds, covers: m.front.covers, callouts: m.callouts };
const file = process.argv[2] || '/tmp/wb-cephe/plan.json';
fs.mkdirSync(file.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(file, JSON.stringify(out));
console.log('yazıldı', file, 'kesik', cells.length, 'kutu', cols.length);
