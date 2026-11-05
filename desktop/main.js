// WarByte masaüstü (Electron) — 12.230 ilk deneme sürümü: tarayıcı ile aynı oyun. Varsayılan: canlı site (https://warbyte.io) yüklenir → hep güncel
// sürüm, aynı sunucular / odalar. --local (ya da WARBYTE_LOCAL=1): uygulamanın içindeki derlenmiş dist/ warbyte://app adresinden açılır, oyun bağlantısı
// wss://ws.warbyte.io/ws (preload __desktop.server).
// 12.232 FPS ayarı: ayarlar.json { v: 2, fps: 'vsync' | '60' | '144' | '240' | 'uncapped', hz } — varsayılan VSync (ekran hızı). Eski sürümün varsayılanı
// "sınırsız"dı (disable-gpu-vsync + disable-frame-rate-limit): kareler ekranla eşzamansız sunuluyor, rAF seli ana iş parçacığını boğuyordu → menü donması,
// yürürken titreme, GPU %100 / fan. v1 dosyası (uncapped alanı) VSync'e taşınır. Değiştirmek: F9 ya da F3 panelindeki düğme. Tek açılışlık: --fps=… / --vsync / --uncapped.
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, net, powerMonitor, protocol, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const LIVE = 'https://warbyte.io/';
const argv = process.argv.slice(1);
const arg = (name) => { const a = argv.find((x) => x === '--' + name || x.startsWith('--' + name + '=')); return a === undefined ? undefined : a.includes('=') ? a.slice(a.indexOf('=') + 1) : true; };

// ── ayarlar (kullanıcı verisi klasöründe; Windows: %APPDATA%\WarByte, macOS: ~/Library/Application Support/WarByte) ──
app.setName('WarByte');
const dataDir = typeof arg('data') === 'string' ? arg('data') : process.env.WARBYTE_DATA;    // test: ayrı kullanıcı verisi klasörü (gerçek ayarlara / localStorage'a dokunmasın)
if (dataDir) app.setPath('userData', path.resolve(dataDir));
const SETTINGS = path.join(app.getPath('userData'), 'ayarlar.json');
const FPS_OPTS = ['vsync', '60', '144', '240', 'uncapped'];
const FPS_LABEL = { vsync: 'Ekran hızı (VSync)', 60: '60 FPS', 144: '144 FPS', 240: '240 FPS', uncapped: 'Sınırsız' };
function writeSettings(s) { try { fs.mkdirSync(path.dirname(SETTINGS), { recursive: true }); fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2)); } catch (e) { console.error('[warbyte] ayar yazılamadı', e); } }
function readSettings() {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch { /* yok / bozuk */ }
  if (!s || typeof s !== 'object') return { v: 2, fps: 'vsync' };
  if (s.v !== 2) {                                                                // 12.230 dosyası: { uncapped } (eski varsayılan sınırsız) → VSync
    const was = s.uncapped; s = { ...s, v: 2, fps: 'vsync', from: 'v1:' + (was === false ? 'vsync' : 'uncapped') }; delete s.uncapped;
    writeSettings(s);
  }
  if (!FPS_OPTS.includes(String(s.fps))) s.fps = 'vsync';
  s.fps = String(s.fps);
  return s;
}
const settings = readSettings();
const cliFps = typeof arg('fps') === 'string' && FPS_OPTS.includes(arg('fps')) ? arg('fps') : arg('vsync') || process.env.WARBYTE_VSYNC === '1' ? 'vsync' : arg('uncapped') ? 'uncapped' : null;
let fpsMode = cliFps || settings.fps;
const hz0 = +settings.hz || 60;                                                   // son açılışta ölçülen ekran hızı (anahtarlar app hazır olmadan belirlenmeli)
const capOf = (m) => (/^\d+$/.test(m) ? +m : 0);
const needUncapped = (m) => m === 'uncapped' || (capOf(m) > 0 && capOf(m) > hz0 + 1);   // ekran hızından yüksek sınır VSync'siz çalışmalı (döngü sınırlar)
const uncapped = needUncapped(fpsMode);
let fpsCap = capOf(fpsMode);                                                       // oyun döngüsünün sınırı (0 = yok)
const local = !!arg('local') || process.env.WARBYTE_LOCAL === '1';
const startUrl = typeof arg('url') === 'string' ? arg('url') : process.env.WARBYTE_URL || null;
const inactive = !!arg('inactive') || process.env.WARBYTE_INACTIVE === '1';            // test betikleri: pencere görünür ama odağı çalmaz (kullanıcının önüne atlamasın)
const occlusion = !!arg('occlusion');                                                 // test: --inactive ile de örtülü / simge durumundaki pencere gizli sayılsın
const query = typeof arg('query') === 'string' ? arg('query') : '';                 // örn. --query="autostart=5v5&map=colgecidi&type=tdm&nolock=1&perf=1"

// ── Chromium anahtarları (app hazır olmadan önce) ──
const sw = (k, v) => (v === undefined ? app.commandLine.appendSwitch(k) : app.commandLine.appendSwitch(k, v));
if (uncapped) {
  sw('disable-frame-rate-limit');           // requestAnimationFrame ekran yenileme hızını beklemez
  sw('disable-gpu-vsync');                  // GPU sunumu dikey eşitlemeyi beklemez (yırtılma, düzensiz kare temposu)
}
sw('ignore-gpu-blocklist');                 // kara listedeki sürücüde de donanım WebGL (yazılım çiziciye düşmesin, bkz. 12.222)
sw('enable-gpu-rasterization');
sw('force_high_performance_gpu');           // iki GPU'lu dizüstünde (Intel + NVIDIA / AMD) güçlü olan
sw('disable-background-timer-throttling');  // 12.232 gizli pencerede zamanlayıcı kısılmasın (çevrim içi sim / ağ 10 Hz sürer); rAF / çizim ise durur
// 12.232: eskiden disable-renderer-backgrounding + disable-backgrounding-occluded-windows + backgroundThrottling:false → arkadaki / simge durumundaki
// pencere de tam hız çiziyordu (menüde 2 sa: GPU süreci %137 CPU). Artık gizli = çizim yok. Test penceresi (--inactive) hep arkada açıldığı için
// örtülme sayılmaz (ölçüm yapılabilsin); --occlusion ile sayılır.
if (inactive && !occlusion) sw('disable-backgrounding-occluded-windows');

// ── gömülü mod: dist/ → warbyte://app/ (standart + güvenli şema: ES modülleri, localStorage, pano, işaretçi kilidi çalışır) ──
protocol.registerSchemesAsPrivileged([{ scheme: 'warbyte', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }]);
const DIST = app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(__dirname, '..', 'dist');
function serveDist() {
  protocol.handle('warbyte', async (req) => {
    let rel = decodeURIComponent(new URL(req.url).pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(DIST, path.normalize(rel));
    if (!file.startsWith(DIST + path.sep)) return new Response('', { status: 403 });
    if (!fs.existsSync(file)) return new Response('Bulunamadı', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

let hz = hz0;
const battery = () => { try { return powerMonitor.isOnBatteryPower(); } catch { return false; } };
const info = () => ({
  version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, platform: process.platform,
  uncapped, fps: fpsMode, fpsCap, hz, inactive, battery: battery(), mode: local ? 'local' : 'live', server: local ? 'wss://ws.warbyte.io/ws' : undefined,
});
const sendState = (o) => { if (win && !win.isDestroyed()) win.webContents.send('wb-state', o); };
ipcMain.on('wb-info', (e) => { e.returnValue = info(); });
ipcMain.handle('wb-set-uncapped', (e, v) => setFps(v ? 'uncapped' : 'vsync'));     // 12.230 düğmesi (geriye uyum)
ipcMain.handle('wb-set-fps', (e, v) => setFps(String(v)));
ipcMain.handle('wb-choose-fps', () => chooseFps());
ipcMain.handle('wb-fullscreen', () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.setFullScreen(!w.isFullScreen()); });

let win = null;
// F9 / F3 paneli: FPS seçimi. Sınırsız ayrıca uyarılır. Chromium anahtarı (VSync) değişecekse yeniden başlatır, değişmeyecekse (ör. VSync ↔ 60 FPS) anında.
async function chooseFps() {
  const cur = FPS_OPTS.indexOf(fpsMode);
  const r = await dialog.showMessageBox(win, {
    type: 'question', title: 'WarByte', buttons: [...FPS_OPTS.map((k) => FPS_LABEL[k] + (k === 'vsync' ? ' (önerilen)' : k === 'uncapped' ? ' (önerilmez)' : '') + (k === fpsMode ? '  ✓' : '')), 'Vazgeç'],
    defaultId: cur, cancelId: FPS_OPTS.length, message: 'Kare hızı (FPS) sınırı',
    detail: `Şu an: ${FPS_LABEL[fpsMode]} · ekran ${hz} Hz.\nEkran hızı (VSync) en akıcı ve en sessiz seçenektir. 60 / 144 / 240 oyun döngüsünde sınırlanır (ekran hızından yüksekse VSync kapanır).`,
  });
  if (r.response >= FPS_OPTS.length) return false;
  return setFps(FPS_OPTS[r.response]);
}
async function setFps(v) {
  if (!FPS_OPTS.includes(v) || v === fpsMode) return false;
  if (v === 'uncapped') {
    const w = await dialog.showMessageBox(win, {
      type: 'warning', title: 'WarByte', buttons: ['Yine de sınırsız', 'Vazgeç'], defaultId: 1, cancelId: 1, message: 'Sınırsız FPS önerilmez',
      detail: 'Sınır olmayınca ekran kartı kareyi olabildiğince hızlı çizer: sahne basit de olsa GPU sürekli %100 çalışır (fan, ısı, pil). Kareler ekranla eşzamansız sunulur; '
        + 'sayaç 500+ FPS gösterse de görüntü düzensiz akar (takılma / titreme hissi), menü ağırlaşabilir. Pilde kendiliğinden ekran hızına sınırlanır.',
    });
    if (w.response !== 0) return false;
  }
  const restart = needUncapped(v) !== uncapped;
  if (restart) {
    const r = await dialog.showMessageBox(win, { type: 'question', buttons: ['Yeniden başlat', 'Vazgeç'], defaultId: 0, cancelId: 1, title: 'WarByte', message: `FPS: ${FPS_LABEL[v]}`, detail: 'VSync ayarı Chromium açılırken uygulanır; oyun yeniden başlatılacak.' });
    if (r.response !== 0) return false;
  }
  writeSettings({ ...readSettings(), fps: v });
  if (restart) { app.relaunch({ args: argv.filter((a) => !/^--(vsync|uncapped|fps(=.*)?)$/.test(a)) }); app.exit(0); return true; }
  fpsMode = v; fpsCap = capOf(v); sendState({ fpsCap, fps: v });                 // aynı anahtarlar: anında
  return true;
}

function sameSite(u) {
  try { const x = new URL(u); return x.protocol === 'warbyte:' || x.hostname === 'warbyte.io' || x.hostname.endsWith('.warbyte.io') || (!app.isPackaged && /^(127\.0\.0\.1|localhost)$/.test(x.hostname)) || (startUrl && x.origin === new URL(startUrl).origin); } catch { return false; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, title: 'WarByte', backgroundColor: '#070a10', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: true, spellcheck: false },
  });
  win.removeMenu();
  // 12.232 odak / pil / ekran hızı sayfaya (src/framePace.js): odaksız pencere 30 FPS (menü 10), pil + sınırsız → ekran hızı
  win.on('focus', () => sendState({ focused: true }));
  win.on('blur', () => sendState({ focused: false }));
  // simge durumu / gizli: Chromium sayfaya document.hidden vermiyor (ölçüldü) → oyun çizimi durdurur, çevrim içi sim 10 Hz sürer
  win.on('minimize', () => sendState({ shown: false })); win.on('hide', () => sendState({ shown: false }));
  win.on('restore', () => sendState({ shown: !win.isMinimized() && win.isVisible() })); win.on('show', () => sendState({ shown: !win.isMinimized() }));
  const measureHz = () => { try { const d = screen.getDisplayMatching(win.getBounds()); const h = Math.round(d.displayFrequency || 0); if (h >= 30 && h !== hz) { hz = h; sendState({ hz }); } if (h >= 30) { const st = readSettings(); if (st.hz !== h) writeSettings({ ...st, hz: h }); } } catch { /* yok */ } };
  measureHz(); win.on('moved', measureHz);
  win.once('ready-to-show', () => (inactive ? win.showInactive() : win.show()));
  win.on('page-title-updated', (e) => e.preventDefault());                       // pencere adı hep WarByte
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!sameSite(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // Maç sırasında oyun beforeunload ile kapatmayı durdurur (tarayıcıda "Siteden ayrılınsın mı?" çıkar); Electron'da bu kendiliğinden sessizce
  // engellenir → pencere kapanmaz / F5 çalışmazdı. Aynı soruyu biz soruyoruz: "Çık" derse engel yok sayılır.
  win.webContents.on('will-prevent-unload', (e) => {
    const r = dialog.showMessageBoxSync(win, { type: 'question', buttons: ['Çık', 'Maça dön'], defaultId: 1, cancelId: 1, title: 'WarByte', message: 'Maçtan çıkılsın mı?', detail: 'Maç sürüyor; çıkarsan bu maçtaki ilerleme kaybolur.' });
    if (r === 0) e.preventDefault();
  });
  win.webContents.on('before-input-event', (e, k) => {
    if (k.type !== 'keyDown') return;
    if (k.key === 'F11' || (process.platform === 'darwin' && k.meta && k.control && k.key.toLowerCase() === 'f')) { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    else if (k.key === 'F9') { e.preventDefault(); chooseFps(); }
    else if (k.key === 'F12' || (k.control && k.shift && k.key.toLowerCase() === 'i') || (k.meta && k.alt && k.key.toLowerCase() === 'i')) { e.preventDefault(); win.webContents.toggleDevTools(); }
    else if (k.key === 'F5' || ((k.control || k.meta) && !k.shift && k.key.toLowerCase() === 'r')) { e.preventDefault(); win.webContents.reload(); }
  });
  const base = startUrl || (local ? 'warbyte://app/index.html' : LIVE);
  win.loadURL(query ? base + (base.includes('?') ? '&' : '?') + query.replace(/^\?/, '') : base);
}

app.whenReady().then(() => {
  // macOS: uygulama menüsü üst çubukta (pencerede değil); Cmd+Q / kopyala-yapıştır için en küçük menü. Windows / Linux: menü yok.
  if (inactive && process.platform === 'darwin') app.dock?.hide();               // test: Dock simgesi / etkinleştirme yok
  if (process.platform === 'darwin') Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]));
  else Menu.setApplicationMenu(null);
  serveDist();
  createWindow();
  powerMonitor.on('on-battery', () => sendState({ battery: true }));
  powerMonitor.on('on-ac', () => sendState({ battery: false }));
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
