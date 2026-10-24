// ffperf.mjs kaydında uzun karelerin çevresi: önceki 3 karenin JS / render süresi ve yeni program sayısı (Firefox'ta GPU süreci işi bir SONRAKİ kareyi geciktirir)
//   node scripts/ffperf-ctx.mjs /tmp/wb-ff/perf-<etiket>-<tarayıcı>-0.json [eşik ms=50]
import fs from 'fs';
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), r = d.rec, thr = +(process.argv[3] || 50);
const t0 = r.marks.find((m) => m[1] === 'oyun')?.[0] ?? r.t[0];
const markAt = (t) => { let m = ''; for (const [mt, s] of r.marks) if (mt <= t + 5 && t - mt < 4000) m = `${s}+${Math.round(t - mt)}`; return m; };
for (let i = 1; i < r.t.length; i++) {
  const dt = r.t[i] - r.t[i - 1]; if (dt < thr) continue;
  const prev = []; for (let j = Math.max(1, i - 3); j <= i; j++) prev.push(`${j - i}:js${r.cb[j].toFixed(0)}/rd${r.rd[j].toFixed(0)}/p${r.prog[j] - r.prog[j - 1]}`);
  console.log(`t=${((r.t[i] - t0) / 1000).toFixed(2)} ${dt.toFixed(0)}ms  ${prev.join('  ')}  ${markAt(r.t[i])}`);
}
