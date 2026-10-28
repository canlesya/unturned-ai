// 12.203 Önce / sonra ölçek karşılaştırması (başsız): her (tohum × NvN) için ÖNCE (BEFORE=eski sürümün kökü, scripts/scalesim.mjs kopyalanmış) ve SONRA
// (bu depo) AYNI ANDA koşar: paylaşılan makinede yük ikisine eşit biner. Dağılım ölçüleri (öldürme konumu) tohumla belirlenimli, yükten bağımsız.
//   BEFORE=/yol/eski node scripts/scalebench.mjs [haritalar=kuzey] [boylar=32,64,128] [tohumlar=1,2,3] [saniye=300]   OUT=/tmp/wb-scale/data
//   → OUT/{before,after}-<harita>-<N>-s<tohum>.json (+ .log) ve stdout'a özet tablo
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const maps = (process.argv[2] || 'kuzey').split(','), sizes = (process.argv[3] || '32,64,128').split(',').map(Number), seeds = (process.argv[4] || '1,2,3').split(',').map(Number), secs = +(process.argv[5] || 300);
const OUT = process.env.OUT || '/tmp/wb-scale/data', BEFORE = process.env.BEFORE, HERE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(OUT, { recursive: true });
const run = (root, tag, map, n, sd) => new Promise((res) => {
  const out = `${OUT}/${tag}-${map}-${n}-s${sd}.json`;
  const p = spawn(process.execPath, ['scripts/scalesim.mjs', map, String(n), String(secs), String(sd)], { cwd: root, env: { ...process.env, OUT: out, PROF: process.env.PROF ?? '1' } });
  let log = ''; p.stdout.on('data', (d) => (log += d)); p.stderr.on('data', (d) => (log += d));
  p.on('close', () => { fs.writeFileSync(out.replace(/\.json$/, '.log'), log); try { res(JSON.parse(fs.readFileSync(out))); } catch { res(null); } });
});
const rows = [];
for (const map of maps) for (const sd of seeds) for (const n of sizes) {
  const [b, a] = await Promise.all([BEFORE ? run(BEFORE, 'before', map, n, sd) : null, run(HERE, 'after', map, n, sd)]);
  for (const [tag, r] of [['önce', b], ['sonra', a]]) if (r) {
    const row = { tag, map, n, sd, stepAvg: r.stepUs.avg, p95: r.stepUs.p95, p99: r.stepUs.p99, brain: r.prof?.brain?.usPerStep, sees: r.prof?.botSees?.usPerStep, path: r.prof?.path?.usPerStep, pathWait: r.pathWaitAvg, kills: r.kills, top3: r.dist.top3Pct, ent50: r.dist.entropy50, regEnt: r.dist.regionEntropy, reg5: r.dist.regions5, cells: r.dist.cells50, spawnKill: r.spawn.spawnKillPct, overlap: r.spawn.overlap, indoor: r.spawn.indoor, blocked: r.spawn.blocked, kbs: r.snap.allKBs, imKbs: r.snap.imKBs, err: r.errors + r.bad };
    rows.push(row); console.log(JSON.stringify(row));
  }
}
fs.writeFileSync(`${OUT}/bench-${Date.now()}.json`, JSON.stringify(rows));
