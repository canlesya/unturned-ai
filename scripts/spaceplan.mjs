// Yörünge Üssü (12.157) yerleşim planı verisi: çarpışma kutuları + doğuşlar + bölge adları → JSON (scripts/spaceplan.py kuşbakışı şemayı çizer)
//   node scripts/spaceplan.mjs /tmp/wb-uzay/plan.json
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
import { buildYorunge } from '../src/maps/yorunge.js';
MapBuilder.noVisual = true;
const m = buildYorunge();
const out = { bounds: m.bounds, boxes: m.colliders.filter((c) => c.max[1] > 0.3 && c.max[0] - c.min[0] < 60 && c.max[2] - c.min[2] < 60).map((c) => [c.min[0], c.min[2], c.max[0], c.max[2], +c.min[1].toFixed(2), +c.max[1].toFixed(2)]),
  spawns: m.spawns, callouts: m.callouts };
fs.writeFileSync(process.argv[2] || '/tmp/wb-uzay/plan.json', JSON.stringify(out));
console.log('kutu', out.boxes.length, 'doğuş', m.spawns.blue.length, m.spawns.red.length);
