// Enfekte botlu maç matrisi (headless, paralel): zorluk × harita × oyuncu sayısı × N maç. node scripts/infmatrix.mjs [maç=10] [süre=300]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

if (isMainThread) {
  const N = +(process.argv[2] || 10), TIME = +(process.argv[3] || 300);
  const diffs = ['easy', 'normal', 'hard'], maps = ['kasaba', 'vadi', 'us'], sizes = [10, 24];
  const jobs = [];
  for (const diff of diffs) for (const map of maps) for (const size of sizes) for (let i = 0; i < N; i++) jobs.push({ diff, map, size, time: TIME });
  const results = [], workers = Math.max(1, os.cpus().length - 1);
  let next = 0, done = 0; const t0 = Date.now();
  await new Promise((resolve) => {
    for (let w = 0; w < workers; w++) {
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: {} });
      const feed = () => { if (next < jobs.length) wk.postMessage(jobs[next++]); else { wk.terminate(); if (++done === workers) resolve(); } };
      wk.on('message', (r) => { results.push(r); if (results.length % 20 === 0) console.error(`  ${results.length}/${jobs.length} (${Math.round((Date.now() - t0) / 1000)} sn)`); feed(); });
      wk.on('error', (e) => { console.error('HATA', e); process.exit(1); });
      feed();
    }
  });
  const L = { easy: 'Kolay', normal: 'Orta', hard: 'Zor' }, M = { kasaba: 'Kasaba', vadi: 'Vadi', us: 'Üs' };
  console.log(`\nEnfekte · botlu · ${N} maç/durum · süre sınırı ${TIME} sn · toplam ${results.length} maç · ${Math.round((Date.now() - t0) / 1000)} sn\n`);
  console.log('Zorluk | Harita | Kişi | İnsan kazandı | Ort. süre | Ort. kalan insan | Ort. iyileşen | Boss düşen | Hata');
  const out = [];
  for (const diff of diffs) for (const map of maps) for (const size of sizes) {
    const r = results.filter((x) => x.diff === diff && x.map === map && x.size === size), n = r.length, avg = (f) => r.reduce((a, x) => a + f(x), 0) / n;
    const line = { diff, map, size, win: r.filter((x) => x.winner === 'blue').length, n, t: avg((x) => x.t), h: avg((x) => x.h), cure: avg((x) => x.cure), boss: avg((x) => x.bossDown), err: r.filter((x) => x.err).length };
    out.push(line);
    console.log(`${L[diff].padEnd(6)} | ${M[map].padEnd(6)} | ${String(size).padEnd(4)} | ${line.win}/${n}`.padEnd(40) + ` | ${line.t.toFixed(0).padStart(4)} sn | ${line.h.toFixed(1).padStart(5)} | ${line.cure.toFixed(1).padStart(5)} | ${line.boss.toFixed(1).padStart(4)} | ${line.err}`);
  }
  console.log('\nZorluğa göre özet:');
  for (const diff of diffs) { const r = results.filter((x) => x.diff === diff); console.log(`  ${L[diff]}: insan kazandı ${r.filter((x) => x.winner === 'blue').length}/${r.length} · ort. süre ${(r.reduce((a, x) => a + x.t, 0) / r.length).toFixed(0)} sn`); }
  for (const size of sizes) { const r = results.filter((x) => x.size === size); console.log(`  ${size} kişi: insan kazandı ${r.filter((x) => x.winner === 'blue').length}/${r.length} · ort. süre ${(r.reduce((a, x) => a + x.t, 0) / r.length).toFixed(0)} sn`); }
  for (const map of maps) { const r = results.filter((x) => x.map === map); console.log(`  ${M[map]}: insan kazandı ${r.filter((x) => x.winner === 'blue').length}/${r.length} · ort. süre ${(r.reduce((a, x) => a + x.t, 0) / r.length).toFixed(0)} sn`); }
  const errs = results.filter((x) => x.err); if (errs.length) console.log('\nHATALAR:', errs.slice(0, 3).map((e) => e.err));
  process.exit(errs.length ? 1 : 0);
} else {
  const { Game } = await import('../src/game/game.js');
  parentPort.on('message', (j) => {
    const r = { ...j, winner: null, t: 0, h: 0, cure: 0, bossDown: 0, err: null };
    try {
      const g = new Game(null, { headless: true, map: j.map, tod: 'day', weather: 'clear', diff: j.diff, match: { perTeam: j.size, type: 'inf', time: j.time } });
      g.on('cure', (s) => { r.cure++; });
      const bosses = g.soldiers.filter((s) => s.boss);
      for (let i = 0; i < j.time * 30 + 60 && !g.ended; i++) g.step(1 / 30);
      r.winner = g.winner; r.t = Math.round(g.time); r.h = g.infCounts().h;
      r.bossDown = bosses.filter((b) => !b.boss).length;
    } catch (e) { r.err = String(e.stack || e).split('\n').slice(0, 3).join(' | '); }
    parentPort.postMessage(r);
  });
}
