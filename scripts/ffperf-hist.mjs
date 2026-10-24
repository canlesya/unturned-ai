// ffperf.mjs kaydı: maç bölümünde kare süresi dağılımı (titreme) + 5 sn'lik dilimlerde ortalama / en kötü kare
//   node scripts/ffperf-hist.mjs /tmp/wb-ff/perf-<etiket>-<tarayıcı>-0.json ...
import fs from 'fs';
for (const f of process.argv.slice(2)) {
  const r = JSON.parse(fs.readFileSync(f, 'utf8')).rec;
  const a = r.marks.find((m) => m[1] === 'oyun')[0], b = r.marks.find((m) => m[1].startsWith('harita:'))[0];
  const dts = [], cbs = [];
  for (let i = 1; i < r.t.length; i++) if (r.t[i] > a && r.t[i] < b) { dts.push(r.t[i] - r.t[i - 1]); cbs.push(r.cb[i]); }
  const bins = [10, 14, 20, 34, 50, 100, 1e9], c = bins.map(() => 0);
  for (const d of dts) c[bins.findIndex((x) => d <= x)]++;
  const s = [...dts].sort((x, y) => x - y), q = (p) => s[Math.floor(s.length * p)].toFixed(1);
  const cs = [...cbs].sort((x, y) => x - y);
  console.log(f.split('/').pop(), `n=${dts.length} med ${q(0.5)} p90 ${q(0.9)} p95 ${q(0.95)} p99 ${q(0.99)} | js med ${cs[cs.length >> 1].toFixed(1)} p99 ${cs[Math.floor(cs.length * 0.99)].toFixed(1)}`);
  console.log('   ≤10:', c[0], '≤14:', c[1], '≤20:', c[2], '≤34:', c[3], '≤50:', c[4], '≤100:', c[5], '>100:', c[6]);
}
