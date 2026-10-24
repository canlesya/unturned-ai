// Seri sesi taslakları (12.148): A / B / C stilleri × seri 2, 3, 4, 5, 10 → WAV + dinleme sayfası. Vite çalışırken:
//   node scripts/streakwav.mjs [url=http://127.0.0.1:5180] [çıktı=/tmp/wb-streak]
// Tarayıcıda OfflineAudioContext ile oyunun gerçek ses zinciri (Sfx: sınırlayıcı + yankı) çizilir: öldürme onay sesi + 0,2 sn sonra seri sesi (oyunda duyulan).
// Ayrıca her stil için "seri" dosyası: art arda 1 → 6 + 10 öldürme (1,1 sn arayla). Tepe < 1 (kırpma yok), sessiz değil denetlenir.
import { chromium } from 'playwright';
import fs from 'fs';
const base = process.argv[2] || 'http://127.0.0.1:5180';
const OUT = process.argv[3] || '/tmp/wb-streak'; fs.mkdirSync(OUT, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(base + '/?debug=1');
const res = await page.evaluate(async () => {
  const { Sfx } = await import('/src/game/audio.js');
  const { playStreak, STREAK_STYLES, STREAK_STYLE } = await import('/src/game/streakSfx.js');
  const SR = 44100;
  const wav = (buf) => {                                   // 16 bit PCM stereo → base64
    const n = buf.length, ch = buf.numberOfChannels, dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const d = [...Array(ch)].map((_, c) => buf.getChannelData(c));
    let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { dv.setInt16(o, Math.max(-1, Math.min(1, d[c][i])) * 32767, true); o += 2; }
    const u = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const meas = (buf) => { let pk = 0, ss = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; ss += d[i] * d[i]; n++; } } return { peak: +pk.toFixed(3), rms: +Math.sqrt(ss / n).toFixed(4) }; };
  const mk = (sec) => { const off = new OfflineAudioContext(2, Math.ceil(SR * sec), SR); const s = new Sfx(); s.setVolume(0.8); s.init(off); return { off, s }; };
  const out = { def: STREAK_STYLE, files: {} };
  for (const st of STREAK_STYLES) {
    for (const n of [2, 3, 4, 5, 10]) {
      const { off, s } = mk(n >= 10 ? 2.8 : 2);
      s.kill(false, 1); const len = playStreak(s, n, { style: st });
      const b = await off.startRendering();
      out.files[`${st}-${n}`] = { ...meas(b), len: +len.toFixed(2), live: s.live, b64: wav(b) };
    }
    // seri: 1 → 6 + 10 (her öldürme 1,1 sn arayla; öldürme onayı da gecikmeli kurulur)
    const seq = [1, 2, 3, 4, 5, 6, 10], { off, s } = mk(seq.length * 1.1 + 1.6);
    const orig = s._voice.bind(s); s._dd = 0; s._voice = (p, g, o = {}) => orig(p, g, { ...o, delay: (o.delay || 0) + s._dd });
    seq.forEach((n, i) => { s._dd = i * 1.1; s.kill(i === 3, 1); if (n >= 2) playStreak(s, n, { style: st, delay: i * 1.1 + 0.2 }); });
    const b = await off.startRendering();
    out.files[`${st}-seri`] = { ...meas(b), b64: wav(b) };
  }
  // karşılaştırma: yalnız öldürme onayı (seri sesi yok)
  { const { off, s } = mk(1.2); s.kill(false, 1); const b = await off.startRendering(); out.files['0-tek'] = { ...meas(b), b64: wav(b) }; }
  return out;
});
for (const [k, r] of Object.entries(res.files)) {
  fs.writeFileSync(`${OUT}/${k}.wav`, Buffer.from(r.b64, 'base64'));
  check(r.peak < 1 && r.rms > 0.004, `${k.padEnd(8)} tepe ${r.peak}  rms ${r.rms}${r.len != null ? `  seri sesi ${r.len} sn` : ''}`);
}
const DESC = {
  A: ['Sade arpej', 'Üçgen dalga majör arpej + hafif oktav parıltısı; kök her seride yükselir, nota sayısı artar. 5+ çan, 6+ yumuşak akor, 10\'da iki oktav koşu + akor + çift çan.'],
  B: ['Arcade', 'Filtreli kare dalga, hızlı arpej + sonda "jeton" sıçraması. 5+ yankı tekrarı ve titreşim, 10\'da güç-yükselme taraması + kare akor.'],
  C: ['Tok / askerî', 'Filtre zarflı testere "boru" ile borazan notaları (G-C-E-G) + her notada trampet tıkı. 5+ timpani, 10\'da trampet rulosu + fanfar.'],
};
const cell = (f, lbl) => `<div class="c"><span>${lbl}</span><audio controls preload="auto" src="${f}.wav"></audio><button data-f="${f}.wav">▶</button></div>`;
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WarByte · Seri sesleri</title>
<style>body{margin:0;background:#0d1117;color:#e6edf3;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:24px 16px}main{max-width:1100px;margin:0 auto}
h1{font-size:24px;letter-spacing:2px;margin:0 0 4px}h1 b{color:#ff8a1f}p.s{opacity:.75;margin:0 0 20px}
.st{background:#161b22;border:1px solid #30363d;border-left:4px solid #ff8a1f;padding:14px 16px;margin:0 0 16px;border-radius:4px}.st.def{border-left-color:#3fb950}
.st h2{margin:0;font-size:18px}.st h2 em{font-style:normal;font-size:12px;background:#3fb950;color:#04260f;padding:1px 8px;border-radius:3px;margin-left:8px;vertical-align:2px}
.st p{margin:4px 0 10px;opacity:.8}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.c{display:flex;align-items:center;gap:6px;background:#0d1117;border:1px solid #30363d;padding:6px 8px;border-radius:4px}.c span{font-weight:700;min-width:58px;color:#ffb347}
.c audio{display:none}.c button{margin-left:auto;background:#ff8a1f;border:0;color:#160a02;font-weight:800;border-radius:3px;width:42px;height:30px;cursor:pointer}
.c.on{border-color:#ff8a1f}.all{background:#21262d;color:#e6edf3;border:1px solid #30363d;padding:6px 12px;border-radius:4px;cursor:pointer;margin-top:8px}
code{background:#21262d;padding:1px 6px;border-radius:3px}</style></head><body><main>
<h1>WAR<b>BYTE</b> · seri sesi taslakları</h1>
<p class="s">Her dosya oyunda duyulduğu gibi: öldürme onay sesi + 0,2 sn sonra seri sesi (efekt zinciri: sınırlayıcı + yankı). "Seri" = 1 → 6 ve 10 art arda öldürme. Oyundaki varsayılan: <b>${res.def}</b> (değiştirmek: <code>src/game/streakSfx.js</code> → <code>STREAK_STYLE</code>).</p>
<div class="st"><h2>Karşılaştırma: yalnız öldürme onayı (seri yok)</h2><div class="g">${cell('0-tek', 'tek')}</div></div>
${['A', 'B', 'C'].map((s) => `<div class="st${s === res.def ? ' def' : ''}"><h2>${s} · ${DESC[s][0]}${s === res.def ? '<em>VARSAYILAN</em>' : ''}</h2><p>${DESC[s][1]}</p>
<div class="g">${[2, 3, 4, 5, 10].map((n) => cell(`${s}-${n}`, 'seri ' + n)).join('')}${cell(`${s}-seri`, '1→6, 10')}</div></div>`).join('')}
</main><script>
let cur=null;document.querySelectorAll('.c button').forEach((b)=>b.onclick=()=>{const a=b.parentNode.querySelector('audio');if(cur&&cur!==a){cur.pause();cur.currentTime=0;cur.parentNode.classList.remove('on');}
if(!a.paused){a.pause();a.currentTime=0;b.parentNode.classList.remove('on');return;}a.currentTime=0;a.play();cur=a;b.parentNode.classList.add('on');a.onended=()=>b.parentNode.classList.remove('on');});
</script></body></html>`;
fs.writeFileSync(`${OUT}/index.html`, html);
console.log(`      ${Object.keys(res.files).length} WAV + ${OUT}/index.html (varsayılan ${res.def})`);
check(!errs.length, 'sayfa hatası yok ' + errs.slice(0, 3).join(' | '));
await browser.close();
console.log(fail ? `sonuç: HATA (${fail})` : 'sonuç: OK');
process.exit(fail ? 1 : 0);
