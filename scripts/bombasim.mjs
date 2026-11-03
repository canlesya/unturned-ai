// 12.226 Bomba modu başsız bot maçları (tarayıcısız, birden çok maç): node scripts/bombasim.mjs [harita=colgecidi] [maç=4] [NvN=5]
// Maç başına headless-sim (TYPE=bomba) koşar, raunt kayıtlarını toplar: kurma / imha / patlama oranı, raunt süresi, saldıran / savunan galibiyeti, nedenler.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const map = process.argv[2] || 'colgecidi', N = +(process.argv[3] || 4), per = process.argv[4] || '5';
const R = [], S = { plants: 0, defuses: 0, booms: 0, drops: 0, pickups: 0, siteN: [0, 0] }, scores = [];
for (let i = 0; i < N; i++) {
  const out = path.join(os.tmpdir(), `bmsim-${process.pid}-${i}.json`);
  execFileSync(process.execPath, [path.join(import.meta.dirname, 'headless-sim.mjs'), map, per, '3600'], { env: { ...process.env, TYPE: 'bomba', OUT: out }, stdio: 'ignore' });
  const d = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  R.push(...d.rounds); scores.push(d.score.join('-'));
  for (const k of ['plants', 'defuses', 'booms', 'drops', 'pickups']) S[k] += d.stats[k];
  S.siteN[0] += d.stats.siteN[0] || 0; S.siteN[1] += d.stats.siteN[1] || 0;
}
const n = R.length || 1, pct = (k) => Math.round((100 * k) / n), why = {};
for (const r of R) { const k = r.side + '/' + r.why + (r.planted && r.why === 'elim' ? '(kurulu)' : ''); why[k] = (why[k] || 0) + 1; }
const d = R.map((r) => r.dur).sort((a, b) => a - b), P = R.filter((r) => r.planted).length;
console.log(`${map}: ${N} maç · ${R.length} raunt · skorlar ${scores.join(', ')}`);
console.log(`  galibiyet: saldıran %${pct(R.filter((r) => r.side === 'att').length)} · savunan %${pct(R.filter((r) => r.side === 'def').length)} · berabere ${R.filter((r) => r.side === 'draw').length}`);
console.log(`  kurma %${pct(P)} (A ${S.siteN[0]} / B ${S.siteN[1]}) · imha %${pct(S.defuses)} (kurulanın %${Math.round(100 * S.defuses / Math.max(1, P))}) · patlama %${pct(S.booms)} · düşme ${S.drops} / alma ${S.pickups}`);
console.log(`  raunt süresi ort ${(d.reduce((a, b) => a + b, 0) / n).toFixed(0)} sn · medyan ${(d[d.length >> 1] || 0).toFixed(0)} · en kısa ${(d[0] || 0).toFixed(0)} · en uzun ${(d[d.length - 1] || 0).toFixed(0)} sn · süre dolan ${R.filter((r) => r.why === 'time').length}`);
console.log(`  nedenler ${JSON.stringify(why)}`);
