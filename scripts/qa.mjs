// 12.231 Test koşucusu: hangi testlerin koşacağını seçer, vite + sunucuyu açar (ya da açık olanı kullanır), testleri paralel koşar,
// süre tablosu + tek satır OK / HATA basar. Testlerin listesi ve "dosya → test" eşlemesi: scripts/qa-map.json.
//
//   node scripts/qa.mjs --smoke                    hızlı katman (< 1 dk): başsız duman + çekirdek savaş / ağ / mod testleri
//   node scripts/qa.mjs --changed [taban]          değişen dosyalara göre seçer (taban: vars. `online` ile ortak ata; "A..B" aralığı da olur)
//   node scripts/qa.mjs --area bomba,uyku          qa-map "areas" grubundan
//   node scripts/qa.mjs --all                      kayıtlı bütün regresyon testleri (gece / büyük canlıya alma öncesi)
//   node scripts/qa.mjs --only nettest,bombatest   yalnız bunlar
//   seçenekler: --list (koşmadan ne seçildiğini göster) · --jobs 4 (başsız paralel) · --web-jobs 2 (tarayıcı paralel)
//               --vite 5180 --port 8787 (vars.: çalışma klasörüne göre sabit, çakışmasız port) · --keep (sunucuları kapatma)
//               --no-smoke (--changed'e smoke ekleme) · --full (testleri hızlı değil tam ayarla koş: "fast" env'i yok sayılır) · --shared (tek ortak sunucu) · --srv-jobs 3
// Kayıtlar /tmp/wb-qa/<port>/<test>.log. Çıkış kodu: hepsi OK → 0, değilse 1.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/qa-map.json'), 'utf8'));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

// çalışma klasörüne göre sabit port (alt ajanların worktree'leri çakışmasın): 5300–5699 / 9100–9499 (çift: oyun, tek: yönetici)
const h = [...ROOT].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 200;
const VITE = +opt('vite', process.env.QA_VITE || 5300 + h * 2), PORT = +opt('port', process.env.QA_PORT || 9100 + h * 2);
const URL = `http://127.0.0.1:${VITE}`, WS = `ws://127.0.0.1:${PORT}`;
const LOGS = `/tmp/wb-qa/${PORT}`; fs.mkdirSync(LOGS, { recursive: true });
const JOBS = +opt('jobs', Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2)))), WEB_JOBS = +opt('web-jobs', 2);
const FULL = flag('full');

// ───── 1) seçim ─────
const tests = MAP.tests, why = new Map();
const add = (name, reason) => { if (!tests[name]) { console.log(`uyarı: qa-map'te "${name}" yok (${reason})`); return; } if (!why.has(name)) why.set(name, reason); };
const globRe = (g) => new RegExp('^' + g.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\{([^}]*)\}/g, (_, a) => '(' + a.split(',').join('|') + ')').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0001/g, '(.*/)?').replace(/\u0002/g, '.*') + '$');
const sh = (c) => { try { return execSync(c, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };

if (flag('smoke')) for (const t of MAP.smoke) add(t, 'smoke');
if (flag('all')) for (const [n, t] of Object.entries(tests)) if (t.tier !== 'manual') add(n, 'all');
if (opt('only')) for (const t of opt('only').split(',')) add(t, 'only');
if (opt('area')) for (const a of opt('area').split(',')) for (const t of MAP.areas[a] || (console.log(`uyarı: alan yok: ${a}`), [])) add(t, 'alan ' + a);
if (flag('changed')) {
  const b = opt('changed', '');
  let files;
  if (b.includes('..')) files = sh(`git diff --name-only ${b}`).split('\n');
  else {
    const base = b || sh('git merge-base HEAD online') || sh('git merge-base HEAD origin/online') || 'HEAD~1';
    files = [...sh(`git diff --name-only ${base}`).split('\n'), ...sh('git ls-files --others --exclude-standard').split('\n')];
  }
  files = [...new Set(files.filter(Boolean))];
  const rules = MAP.map.map(([g, ts]) => [globRe(g), g, ts]);
  let code = false;
  for (const f of files) {
    let hit = false;
    for (const [n, t] of Object.entries(tests)) if ((t.file || `scripts/${n}.mjs`) === f) { add(n, 'kendi betiği değişti'); hit = true; }
    for (const [re, g, ts] of rules) if (re.test(f)) { hit = true; for (const t of ts) add(t, `${f} ← ${g}`); }
    if (!MAP.ignore.some((g) => globRe(g).test(f))) { code = true; if (!hit) for (const t of MAP.fallback) add(t, `${f} (eşlemesiz)`); }
  }
  if (code && !flag('no-smoke')) for (const t of MAP.changedAlways) add(t, 'her değişiklikte');
  console.log(`değişen ${files.length} dosya${code ? '' : ' (oyun kodu değişmedi: yalnız belge / görsel / test betiği)'}`);
}
if (!why.size) { console.log(flag('changed') ? 'QA: seçilen test yok (OK)' : 'kullanım: node scripts/qa.mjs --smoke | --changed [taban] | --area a,b | --all | --only a,b   [--list]'); process.exit(0); }

const sel = [...why.keys()].map((n) => ({ name: n, ...tests[n], reason: why.get(n) }));
for (const t of sel) { t.web = (t.needs || []).includes('vite'); t.srv = (t.needs || []).includes('server'); }
const eta = (list) => list.reduce((a, t) => a + (t.sec || 5), 0);
if (flag('list')) {
  for (const t of sel) console.log(`${t.name.padEnd(16)}${t.known ? '*' : ' '}${(t.web ? 'tarayıcı' : t.srv ? 'sunucu' : 'başsız').padEnd(9)} ~${String(t.sec ?? '?').padStart(4)} sn  ${t.reason}`);
  const w = sel.filter((t) => t.web), n = sel.filter((t) => !t.web);
  console.log(`${sel.length} test (* = bilinen eski düşüş) · tahmini seri ${eta(sel)} sn · paralel ≈ ${Math.round(Math.max(eta(w) / WEB_JOBS, eta(n) / JOBS, ...sel.map((t) => t.sec || 5)))} sn`);
  process.exit(0);
}

// ───── 2) vite + sunucu (açık olanı kullan, yoksa başlat) ─────
const started = [];
const portOpen = (port) => new Promise((r) => { const s = net.connect(port, '127.0.0.1'); s.once('connect', () => { s.destroy(); r(true); }); s.once('error', () => r(false)); });
const waitPort = async (port, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await portOpen(port)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
const startProc = (name, cmd, args, env, port, ms = 30000) => {
  const out = fs.openSync(`${LOGS}/_${name}.log`, 'w');
  const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', out, out], detached: false });
  started.push(p); return waitPort(port, ms).then((ok) => (ok ? p : null));      // süreç tutamacı döner (paralel başlatmada karışmasın)
};
// Sunucu: varsayılan HER sunucu testi kendi taze sunucusunda (zamanlamaya duyarlı nettest / netdmg / shotlag ortak sunucuda paralel
// koşunca düşüyordu; eski testlerin bıraktığı botlu odalar da yük bindiriyor). --shared: tek ortak sunucu (PORT; açıksa onu kullanır).
const SHARED = flag('shared'), SRV_JOBS = +opt('srv-jobs', 3);
// BF_WARM=0 / BF_SPARE=0: açılışta 15 haritayı kurma (5–21 sn, CPU) ve yedek iş parçacığı ısıtma yok → test sunucusu ~1 sn'de hazır
async function startServer(port, env = {}) {
  const p = await startProc('server-' + port, process.execPath, ['server/index.js'], { PORT: String(port), ADMIN_PORT: String(port + 1), BF_DATA: `/tmp/wb-qa/data-${port}`, BF_DEBUG: '1', BF_WARM: '0', BF_SPARE: '0', ...env }, port, 120000);      // yük altında resmi odaların kurulumu 30 sn'yi aşabiliyor
  if (!p) throw new Error(`sunucu :${port} başlamadı (${LOGS}/_server-${port}.log)`);
  return p;
}
async function ensureShared() {
  if (await portOpen(PORT)) { console.log(`sunucu :${PORT} açık, kullanılıyor (BF_DEBUG=1 ile açıldığından emin ol)`); return; }
  await startServer(PORT);
}
let slot = 0, srvBusy = 0; const srvWait = [];
const srvAcquire = () => (srvBusy < SRV_JOBS ? (srvBusy++, Promise.resolve()) : new Promise((r) => srvWait.push(r)));
const srvRelease = () => { const n = srvWait.shift(); if (n) n(); else srvBusy--; };
async function freePort() {      // 20000 + h·20 … (çalışma klasörüne göre ayrık aralık)
  for (let i = 0; i < 40; i++) { const p = 20000 + h * 20 + 2 * (slot++ % 10); if (!(await portOpen(p)) && !(await portOpen(p + 1))) return p; }
  throw new Error('boş port bulunamadı');
}
const stopAll = () => { if (!flag('keep')) for (const p of started) try { p.kill('SIGTERM'); } catch {} };
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { stopAll(); process.exit(130); });
process.on('exit', stopAll);                                  // beklenmedik çıkışta da açtıklarımızı kapat
const T0 = Date.now();
if (sel.some((t) => t.web)) {
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    const main = sh('git worktree list --porcelain').split('\n')[0]?.replace(/^worktree /, '');
    if (main && fs.existsSync(path.join(main, 'node_modules'))) { fs.symlinkSync(path.join(main, 'node_modules'), path.join(ROOT, 'node_modules')); console.log(`node_modules → ${main}/node_modules (bağ)`); }
  }
  if (await portOpen(VITE)) console.log(`vite :${VITE} açık, kullanılıyor`);
  else if (!(await startProc('vite', path.join(ROOT, 'node_modules/.bin/vite'), ['--port', String(VITE), '--strictPort', '--host', '127.0.0.1'], {}, VITE))) throw new Error(`vite :${VITE} başlamadı (${LOGS}/_vite.log)`);
}
if (SHARED && sel.some((t) => t.srv && !t.ownServer)) await ensureShared();
const tSetup = Date.now() - T0;

// ───── 3) koş: başsız havuzu (JOBS) + tarayıcı havuzu (WEB_JOBS) aynı anda ─────
const sub = (s, extra) => String(s).replace(/\$URL/g, URL).replace(/\$WS/g, extra?.ws || WS).replace(/\$PORT/g, String(extra?.port || PORT)).replace(/\$OUT/g, `${LOGS}/out-${extra?.name}`);
async function runOne(t) {
  if (t.headful && process.env.HEADFUL !== '1') { t.res = { code: 0, sec: 0, ok: 0, bad: [], log: '', st: 'ATLANDI' }; console.log(`ATLANDI ${t.name.padEnd(16)} pencere ister (HEADFUL-only: ${t.headful}) — HEADFUL=1 ile koşulur`); return; }
  const own = t.srv && (!SHARED || t.ownServer);
  if (own) await srvAcquire();
  let srv = null;
  try {
    const t0 = Date.now();
    let port = PORT;
    if (own) {
      port = await freePort();
      try { srv = await startServer(port, t.serverEnv || {}); } catch (e) {
        t.res = { code: 1, sec: (Date.now() - t0) / 1000, ok: 0, bad: ['HATA  ' + e.message], log: `${LOGS}/_server-${port}.log`, st: 'HATA' };
        console.log(`HATA    ${t.name.padEnd(16)} ${e.message}`); return;
      }
    }
    await runTest(t, t0, port);
  } finally { if (srv) { try { srv.kill('SIGTERM'); } catch {} } if (own) srvRelease(); }
}
async function runTest(t, t0, port) {
  const log = `${LOGS}/${t.name}.log`, ws = `ws://127.0.0.1:${port}`;
  const x = { ws, port, name: t.name };
  const env = { ...process.env, ...(t.headful ? { PW_OFFSCREEN: '1' } : {}), URL, BASE: URL, WS: ws, SERVER: ws, SRV: ws, WSURL: ws, PORT: String(port), OUT: `${LOGS}/out-${t.name}` };
  for (const [k, v] of Object.entries(t.env || {})) env[k] = sub(v, x);
  if (!FULL) for (const [k, v] of Object.entries(t.fast || {})) env[k] = sub(v, x);
  const pre = t.web ? ['--import', 'file://' + path.join(ROOT, 'scripts/lib/pw-quiet.mjs')] : [];      // başsız + gerçek GPU + kısıtlama yok (HEADFUL=1: pencereli)
  const args = [...pre, ...(t.node || []), path.join(ROOT, t.file || `scripts/${t.name}.mjs`), ...(t.args || []).map((a) => sub(a, x))];
  // retry: rastgele yerleşimli (ara sıra düşen) testler bir kez daha denenir; ikinci denemede geçerse "OK (2. deneme)"
  let code, tries = 0, flakyBad = [], firstBad = null;
  for (; tries <= (t.retry || 0); tries++) {
    const out = fs.openSync(log, 'w');
    code = await new Promise((r) => {
      const p = spawn(process.execPath, args, { cwd: ROOT, env, stdio: ['ignore', out, out] });
      const kill = setTimeout(() => { p.kill('SIGKILL'); fs.appendFileSync(log, `\nHATA  zaman aşımı (${t.timeout || 600} sn)\n`); }, (t.timeout || 600) * 1000);
      p.on('exit', (c) => { clearTimeout(kill); r(c ?? 1); });
    });
    fs.closeSync(out);
    flakyBad = fs.readFileSync(log, 'utf8').split('\n').filter((l) => /^\s*HATA\b|^HATA:/.test(l));
    if (code === 0 && !flakyBad.length) break;
    firstBad ??= flakyBad[0] || `çıkış kodu ${code}`;
    if (code === 0) code = 1;                    // çıkış kodu 0 ama HATA satırı var (ör. igstest) → düşmüş say
  }
  const txt = fs.readFileSync(log, 'utf8');
  const ok = (txt.match(/^\s*OK\b/gm) || []).length, bad = txt.split('\n').filter((l) => /^\s*HATA\b|^HATA:/.test(l));
  t.res = { code, sec: (Date.now() - t0) / 1000, ok, bad, log, tries: Math.min(tries, t.retry || 0) + 1 };
  t.res.st = code === 0 ? 'OK' : t.known ? 'BİLİNEN' : 'HATA';
  const again = code === 0 && t.res.tries > 1 ? ` (${t.res.tries}. deneme; ilki: ${String(firstBad).trim().slice(0, 90)})` : '';
  console.log(`${t.res.st.padEnd(7)} ${t.name.padEnd(16)} ${t.res.sec.toFixed(1).padStart(6)} sn  ${ok} OK${bad.length ? ` · ${bad.length} HATA` : ''}${again}`);
}
async function pool(list, n) { const q = [...list].sort((a, b) => (b.sec || 5) - (a.sec || 5)); await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await runOne(q.shift()); })); }
console.log(`${sel.length} test · başsız ${JOBS} / tarayıcı ${WEB_JOBS} paralel · vite ${URL} · sunucu ${SHARED ? WS + " (ortak)" : "her teste ayrı (aynı anda en çok " + SRV_JOBS + ")"} · kayıtlar ${LOGS}/`);
try {
  await Promise.all([pool(sel.filter((t) => !t.web), JOBS), pool(sel.filter((t) => t.web), WEB_JOBS)]);
} finally {
  stopAll();
  if (flag('keep') && started.length) console.log(`--keep: vite :${VITE} / sunucu :${PORT} açık bırakıldı (pid ${started.map((p) => p.pid).join(' ')})`);
}

// ───── 4) tablo + özet ─────
const wall = (Date.now() - T0) / 1000, serial = sel.reduce((a, t) => a + (t.res?.sec || 0), 0);
console.log('\n test              katman   süre      sonuç');
for (const t of [...sel].sort((a, b) => b.res.sec - a.res.sec)) console.log(` ${t.name.padEnd(17)} ${(t.tier || '').padEnd(7)} ${t.res.sec.toFixed(1).padStart(6)} sn  ${t.res.st} (${t.res.ok}${t.res.bad.length ? '/' + t.res.bad.length + ' HATA' : ''})`);
const failed = sel.filter((t) => t.res.st === 'HATA'), known = sel.filter((t) => t.res.st === 'BİLİNEN'), skipped = sel.filter((t) => t.res.st === 'ATLANDI');
for (const t of known) console.log(`\n── ${t.name}: bilinen eski düşüş (${t.known}) — koşuyu düşürmez`);
for (const t of failed) { console.log(`\n── ${t.name} (${t.res.log}):`); console.log((t.res.bad.length ? t.res.bad : fs.readFileSync(t.res.log, 'utf8').trim().split('\n').slice(-8)).slice(0, 8).map((l) => '   ' + l.slice(0, 220)).join('\n')); }
console.log(`\nQA: ${failed.length ? 'HATA' : 'OK'} · ${sel.length - failed.length}/${sel.length} test${failed.length ? ' (düşen: ' + failed.map((t) => t.name).join(', ') + ')' : ''} ${skipped.length ? ' · atlanan ' + skipped.length + ' (pencereli: HEADFUL=1)' : ''}${known.length ? ' · bilinen ' + known.length + ' (' + known.map((t) => t.name).join(', ') + ')' : ''} · ${wall.toFixed(0)} sn (kurulum ${(tSetup / 1000).toFixed(1)} sn, seri toplam ${serial.toFixed(0)} sn)`);
process.exit(failed.length ? 1 : 0);
