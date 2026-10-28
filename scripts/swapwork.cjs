// 12.210 swapperf.mjs çıktısından değişim başına iş: vm.setItem + ilk 4 karedeki silah sahnesi çizimi (boşta çizime göre fazlası)
//   node scripts/swapwork.cjs a.json [b.json ...]
const files = process.argv.slice(2);
for (const p of files) {
  const r = require(p), g = {};
  const idle = r.rows[0].sum4['render.other'] || 0;
  for (const x of r.rows.slice(1)) {
    if (x.from === x.id) continue;
    const [t, w] = x.label.split(' '), k = t + ' ' + (w === 'K' || w === 'J' ? 'J/K' : w);
    const s = x.sum4, ren = Math.max(0, (s['render.other'] || 0) - idle), set = s['vm.setItem'] || 0;
    (g[k] ||= []).push({ work: set + ren, set, ren, max: x.max, link: x.link || 0 });
  }
  console.log(p.split('/').slice(-2).join('/'), '· boşta silah sahnesi çizimi (4 kare)', idle, 'ms');
  for (const [k, v] of Object.entries(g)) {
    const a = (q) => (v.reduce((s, o) => s + o[q], 0) / v.length).toFixed(1), mx = (q) => Math.max(...v.map((o) => o[q])).toFixed(1);
    console.log('  ', k.padEnd(14), 'n', String(v.length).padStart(2), '| iş ort', a('work').padStart(5), 'en çok', mx('work').padStart(5), '| setItem ort', a('set').padStart(4), '| ilk çizim ek ort', a('ren').padStart(5), '| kare en uzun', mx('max').padStart(5), '| derleme ort', a('link'));
  }
}
