// Kasaba kuşbakışı şema verisi:  node scripts/kasabaplan.mjs [çıktı.json]  → python3 scripts/kasabaplan.py çıktı.json şema.png "başlık"
// Çarpışma kutuları (yüksekliğe göre), yollar, hedefler, doğuşlar, üs bölgeleri, bina girişleri; nav ızgarası (yürünebilir hücreler).
import fs from 'fs';
import { MapBuilder } from '../src/maps/builder.js';
MapBuilder.noVisual = true;
import { MAPS } from '../src/maps/index.js';
import { NavGrid } from '../src/game/nav.js';
const out = process.argv[2] || '/tmp/wb-kasaba/plan.json';
const m = MAPS.kasaba.build();
const nav = new NavGrid(m.colliders, m.bounds, null, !!m.layered);
const seen = nav.reachable(m.spawns.blue[0].x, m.spawns.blue[0].z);
const walk = []; for (let i = 0; i < seen.length; i++) if (seen[i]) walk.push(i);
fs.writeFileSync(out, JSON.stringify({
  bounds: m.bounds, zones: m.baseZones, roads: m.roads, objectives: m.objectives, spawns: m.spawns,
  boxes: m.colliders.filter((c) => c.max[0] - c.min[0] < 150).map((c) => [c.min[0], c.min[2], c.max[0], c.max[2], c.min[1], c.max[1], c.tag || '']),
  entries: Object.entries(m.infos || {}).filter(([, v]) => v && v.entry).map(([k, v]) => [k, v.entry.x, v.entry.z]),
  callouts: m.callouts || [],
  nav: { minX: nav.minX, minZ: nav.minZ, w: nav.w, h: nav.h, cell: 0.5, walk },
}));
console.log('yazıldı', out, m.colliders.length, 'kutu', walk.length, 'yürünebilir hücre');
