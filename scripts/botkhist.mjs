// 12.214 bot başına leş dağılımı histogramı (önce / sonra) → PNG. botkills.mjs OUT=… JSON'larından:
//   node scripts/botkhist.mjs /tmp/wb-botk/before /tmp/wb-botk/after /tmp/wb-botk/histogram.png
import fs from 'node:fs';
import { chromium } from 'playwright';
const [A = '/tmp/wb-botk/before', B = '/tmp/wb-botk/after', OUTP = '/tmp/wb-botk/histogram.png'] = process.argv.slice(2);
const SC = [['kuzey10', 'Kuzey Vadisi fetih 10v10'], ['kuzey32', 'Kuzey Vadisi fetih 32v32'], ['cgtdm', 'Çöl Geçidi TDM 10v10'], ['cgcq', 'Çöl Geçidi fetih 10v10'], ['kasaba', 'Kasaba TDM 10v10']];
const load = (d, k) => { try { return JSON.parse(fs.readFileSync(`${d}/${k}.json`, 'utf8')); } catch { return null; } };
const fmt = (v, n = 2) => (Number.isFinite(v) ? v.toFixed(n).replace('.', ',') : '-');
let html = `<html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;font:13px system-ui,sans-serif;color:#222;width:1500px}
h1{font-size:18px;margin:14px 18px 2px}p.s{margin:0 18px 8px;color:#666}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:0 14px 14px}
.c{border:1px solid #ddd;border-radius:6px;padding:8px}.c h2{font-size:14px;margin:0 0 4px}.k{font-size:12px;color:#444;line-height:1.45}
.lg span{display:inline-block;width:11px;height:11px;margin:0 4px -1px 10px;border-radius:2px}</style></head><body>
<h1>Bot başına leş dağılımı — önce (12.214 öncesi, online 108ed00) / sonra</h1><p class="s">Başsız maç, normal zorluk, 300 sn × 3 tohum (32v32: × 2). Çubuk = o kadar leş alan bot sayısı. <span class="lg"><span style="background:#b9bec7"></span>önce<span style="background:#2a7de1"></span>sonra</span></p><div class="g">`;
for (const [k, title] of SC) {
  const a = load(A, k), b = load(B, k);
  if (!a || !b) continue;
  const ka = a.recs.map((r) => r.kills), kb = b.recs.map((r) => r.kills), mx = Math.max(...ka, ...kb), bw = mx > 24 ? 2 : 1, nb = Math.floor(mx / bw) + 1;
  const ha = new Array(nb).fill(0), hb = new Array(nb).fill(0);
  for (const v of ka) ha[Math.floor(v / bw)]++; for (const v of kb) hb[Math.floor(v / bw)]++;
  const W = 460, H = 210, L = 30, T = 8, Bm = 26, ym = Math.max(...ha, ...hb), sx = (W - L - 6) / nb, sy = (H - T - Bm) / ym;
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><g font-size="10" fill="#666">`;
  for (let y = 0; y <= ym; y += Math.max(1, Math.ceil(ym / 5))) svg += `<line x1="${L}" x2="${W - 4}" y1="${H - Bm - y * sy}" y2="${H - Bm - y * sy}" stroke="#eee"/><text x="${L - 4}" y="${H - Bm - y * sy + 3}" text-anchor="end">${y}</text>`;
  for (let i = 0; i < nb; i++) {
    const x = L + i * sx;
    svg += `<rect x="${x + 1}" y="${H - Bm - ha[i] * sy}" width="${sx / 2 - 1}" height="${ha[i] * sy}" fill="#b9bec7"/><rect x="${x + sx / 2}" y="${H - Bm - hb[i] * sy}" width="${sx / 2 - 1}" height="${hb[i] * sy}" fill="#2a7de1"/>`;
    if (i % Math.max(1, Math.ceil(nb / 14)) === 0) svg += `<text x="${x + sx / 2}" y="${H - Bm + 12}" text-anchor="middle">${i * bw}${bw > 1 ? '' : ''}</text>`;
  }
  svg += `<text x="${(W + L) / 2}" y="${H - 2}" text-anchor="middle">leş / bot${bw > 1 ? ` (${bw}'li küme)` : ''}</text></g></svg>`;
  const s0 = a.sum, s1 = b.sum;
  html += `<div class="c"><h2>${title}</h2>${svg}<div class="k">alt %20 ort.: <b>${fmt(s0.lo20)} → ${fmt(s1.lo20)}</b> · üst %20: ${fmt(s0.hi20)} → ${fmt(s1.hi20)}<br>Gini: <b>${fmt(s0.gini, 3)} → ${fmt(s1.gini, 3)}</b> · 0 leşli bot: <b>${s0.zero} → ${s1.zero}</b> / ${s1.bots}<br>leş / dk: ${fmt(s0.killsPerMin, 1)} → ${fmt(s1.killsPerMin, 1)} · isabet: %${fmt(s0.loVsHi['acc%'][2], 1)} → %${fmt(s1.loVsHi['acc%'][2], 1)}</div></div>`;
}
html += '</div></body></html>';
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1500, height: 800 } });
await pg.setContent(html);
await pg.screenshot({ path: OUTP, fullPage: true });
await br.close();
console.log('yazıldı', OUTP);
