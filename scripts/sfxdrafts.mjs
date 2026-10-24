// Atış sesi taslakları (12.141): her silah sınıfı × taslak (A = eski, B = tok, C = açık hava) için WAV + karşılaştırma sayfası.
// Tarayıcıda OfflineAudioContext ile oyunun kendi ses zinciri (Sfx: mesafe, yankı, sınırlayıcı) çizilir → dinlenen ses = oyundaki ses.
//   node scripts/sfxdrafts.mjs [çıktı=/tmp/wb-sounds] [taban url=http://127.0.0.1:5180]
// QUICK=1 → yalnız tek atış ölçümü (dosya yazmaz; düzey ayarı için)
// Çıktı: <sınıf>-<A|B|C>.wav (kendi silahın, tek atış) · <sınıf>-<X>-seri.wav (silahın temposunda seri) · <sınıf>-<X>-80m.wav (80 m uzak, sağdan) · index.html · olcum.json
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const out = process.argv[2] || '/tmp/wb-sounds', base = process.argv[3] || 'http://127.0.0.1:5180';
mkdirSync(out, { recursive: true });
const ROWS = [
  ['pistol', 'Tabanca 9 mm (Glock 17)'], ['pistol45', 'Tabanca .45 (M1911)'], ['magnum', 'Magnum (Desert Eagle)'], ['revolver', 'Revolver'],
  ['smg', 'SMG (MP5)'], ['vector', 'SMG .45 (Vector)'], ['p90', 'SMG 5.7 (P90)'], ['mac10', 'Makineli tabanca (MAC-10)'],
  ['rifle', 'Tüfek 7.62 (AK-47)'], ['carbine', 'Karabina 5.56 (M4A1 / G36 …)'], ['battle', 'Muharebe tüfeği (SCAR-H)'],
  ['lmg', 'LMG (M249)'], ['pkm', 'Ağır makineli (PKM)'], ['shotgun', 'Pompalı'], ['aa12', 'Otomatik pompalı (AA-12)'], ['dbl', 'Çift namlu'],
  ['dmr', 'DMR (SVD)'], ['sniper', 'Keskin nişancı (M24)'], ['barrett', 'Barrett .50'], ['rpg', 'RPG-7'], ['m79', 'M79 bomba atar'],
  ['marker', 'Paintball tüfeği'], ['pbpistol', 'Paintball tabancası'], ['suppressed', 'Susturuculu (oyunda silah yok, taslak)'],
];
const DR = ['A', 'B', 'C'];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base + '/?debug=1');
const QUICK = !!process.env.QUICK;
const res = await page.evaluate(async ({ ROWS, DR, QUICK }) => {
  const { Sfx } = await import('/src/game/audio.js');
  const { WSTATS } = await import('/src/game/stats.js');
  const SR = 44100;
  const wav = (buf) => {                                                         // 16 bit stereo PCM → base64
    const n = buf.length, ch = buf.numberOfChannels, dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const W = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    W(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); W(8, 'WAVE'); W(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); W(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const d = [...Array(ch)].map((_, c) => buf.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { dv.setInt16(o, Math.max(-1, Math.min(1, d[c][i])) * 32767, true); o += 2; }
    const u8 = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s);
  };
  const meas = (buf) => { let pk = 0, ss = 0; const d = buf.getChannelData(0), e = buf.getChannelData(1), n = Math.min(d.length, Math.round(SR * 0.3)); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]), Math.abs(e[i])); for (let i = 0; i < n; i++) ss += (d[i] * d[i] + e[i] * e[i]) / 2; return { peak: +pk.toFixed(3), db: +(10 * Math.log10(ss / n + 1e-12)).toFixed(1) }; };
  const render = async (draft, sec, fn) => {
    const off = new OfflineAudioContext(2, Math.ceil(SR * sec), SR); const s = new Sfx(); s.draft = draft; s.setVolume(0.6); s.init(off);
    s._dd = 0; const orig = s._voice.bind(s); s._voice = (p, g, o = {}) => orig(p, g, { ...o, delay: (o.delay || 0) + s._dd });
    s.setListener({ position: { x: 0, y: 0, z: 0 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } });
    fn(s); return off.startRendering();
  };
  const statOf = (k) => Object.values(WSTATS).find((w) => w.sound === k) || (k === 'rifle' ? WSTATS.ak47 : k === 'suppressed' ? WSTATS.pistol : null);
  const r = {};
  for (const [k] of ROWS) {
    const st = statOf(k) || { rpm: 300 }, auto = !!st.auto, iv = Math.max(60 / (st.rpm || 300), auto ? 0 : 0.24), n = auto ? 8 : st.rpm < 70 ? 2 : 4;
    for (const d of DR) {
      if (d === 'A' && k === 'suppressed') continue;
      const kk = d === 'A' && k === 'rifle' ? 'rifle' : k;
      const one = await render(d, 1.8, (s) => s.shot(kk, null));
      if (QUICK) { const fq = await render(d, 1.2, (s) => s.shot(kk, { x: 80, y: 0, z: 0 })); r[`${k}-${d}`] = { m: meas(one), mf: meas(fq), ms: meas(one) }; continue; }
      const ser = await render(d, iv * (n - 1) + 1.8, (s) => { for (let i = 0; i < n; i++) { s._dd = i * iv; s.shot(kk, null); } });
      const far = await render(d, 2.2, (s) => s.shot(kk, { x: 80, y: 0, z: 0 }));
      r[`${k}-${d}`] = { one: wav(one), ser: wav(ser), far: wav(far), m: meas(one), mf: meas(far), ms: meas(ser) };
    }
  }
  return r;
}, { ROWS, DR, QUICK });
const metrics = {};
for (const [key, v] of Object.entries(res)) {
  metrics[key] = { tek: v.m, seri: v.ms, uzak80: v.mf };
  if (QUICK) continue;
  writeFileSync(`${out}/${key}.wav`, Buffer.from(v.one, 'base64'));
  writeFileSync(`${out}/${key}-seri.wav`, Buffer.from(v.ser, 'base64'));
  writeFileSync(`${out}/${key}-80m.wav`, Buffer.from(v.far, 'base64'));
}
if (!QUICK) writeFileSync(`${out}/olcum.json`, JSON.stringify(metrics, null, 1));
// karşılaştırma sayfası
const cell = (k, d) => res[`${k}-${d}`] ? `<td><div class="b"><button data-s="${k}-${d}.wav">▶ tek</button><button data-s="${k}-${d}-seri.wav">▶ seri</button><button data-s="${k}-${d}-80m.wav">▶ 80 m</button></div><small>${metrics[`${k}-${d}`].tek.db} dB · tepe ${metrics[`${k}-${d}`].tek.peak}</small></td>` : '<td class="na">— (eskide yok)</td>';
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WarByte atış sesleri</title>
<style>:root{--bg:#14161b;--fg:#e8eaee;--mut:#8b93a1;--card:#1d2027;--ac:#ffb347;--line:#2c3039}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}
h1{font-size:20px;margin:0 0 4px}p{color:var(--mut);margin:0 0 14px;max-width:900px}
table{border-collapse:collapse;width:100%;max-width:1100px}th,td{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
th{color:var(--mut);font-weight:600;font-size:13px}td:first-child{font-weight:600}
.b{display:flex;gap:4px;flex-wrap:wrap}button{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:5px 9px;cursor:pointer;font:inherit;font-size:13px}
button:hover{border-color:var(--ac)}button.on{background:var(--ac);color:#111}small{color:var(--mut);font-size:11px}.na{color:var(--mut)}
.wrap{overflow-x:auto}</style></head><body>
<h1>WarByte · atış sesi taslakları</h1>
<p><b>A</b> = şu anki (eski) ses · <b>B</b> = tok / arcade (dolgun gümbürtü, kısa kuyruk, belirgin sürgü sesi) · <b>C</b> = açık hava / gerçekçi (parlak çatlama, uzun kuyruk, çift yankı).
Hepsi prosedürel (dosya / telif yok), oyunun kendi ses zinciriyle (Ana ses 0,6) çizildi. "tek" = kendi silahın, "seri" = silahın temposunda, "80 m" = sağdan uzak bir atış. Oyunda şu an <b>B</b> kurulu; denemek için adrese <code>?sfx=A</code> / <code>?sfx=C</code> ekle.</p>
<div class="wrap"><table><tr><th>Sınıf</th><th>A · eski</th><th>B · tok</th><th>C · açık hava</th></tr>
${ROWS.map(([k, n]) => `<tr><td>${n}</td>${DR.map((d) => cell(k, d)).join('')}</tr>`).join('\n')}
</table></div>
<script>let a=null,cur=null;document.addEventListener('click',e=>{const b=e.target.closest('button[data-s]');if(!b)return;if(a){a.pause();cur&&cur.classList.remove('on')}a=new Audio(b.dataset.s);cur=b;b.classList.add('on');a.onended=()=>b.classList.remove('on');a.play()});</script>
</body></html>`;
if (!QUICK) writeFileSync(`${out}/index.html`, html);
// özet: taslak başına ortalama düzey (susturucu hariç)
const avg = (d) => { const v = ROWS.filter(([k]) => k !== 'suppressed').map(([k]) => metrics[`${k}-${d}`].tek.db); return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); };
const pk = (d) => Math.max(...ROWS.filter(([k]) => metrics[`${k}-${d}`]).map(([k]) => metrics[`${k}-${d}`].seri.peak));
console.log(DR.map((d) => `${d}: ort ${avg(d)} dB, en yüksek tepe (seri) ${pk(d)}`).join(' · '));
for (const [k] of ROWS) console.log(k.padEnd(11), DR.map((d) => metrics[`${k}-${d}`] ? `${d} ${String(metrics[`${k}-${d}`].tek.db).padStart(6)} dB / ${metrics[`${k}-${d}`].tek.peak} (80 m ${metrics[`${k}-${d}`].uzak80.db})` : `${d}    —`).join('   '));
console.log('sayfa hatası:', errs.length, errs.slice(0, 3));
await browser.close();
