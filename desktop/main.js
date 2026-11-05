// WarByte masaüstü (Electron) — 12.230 ilk deneme sürümü: tarayıcı ile aynı oyun, ekran yenileme hızına kilitlenmeden (sınırsız FPS) ölçmek için.
// Varsayılan: canlı site (https://warbyte.io) yüklenir → hep güncel sürüm, aynı sunucular / odalar. --local (ya da WARBYTE_LOCAL=1): uygulamanın
// içindeki derlenmiş dist/ warbyte://app adresinden açılır, oyun bağlantısı wss://ws.warbyte.io/ws (preload __desktop.server).
// VSync: ayarlar.json { "uncapped": true } (varsayılan sınırsız). Değiştirmek: F9 ya da F3 panelindeki düğme (yeniden başlatır); tek açılışlık: --vsync / --uncapped.
'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const LIVE = 'https://warbyte.io/';
const argv = process.argv.slice(1);
const arg = (name) => { const a = argv.find((x) => x === '--' + name || x.startsWith('--' + name + '=')); return a === undefined ? undefined : a.includes('=') ? a.slice(a.indexOf('=') + 1) : true; };

// ── ayarlar (kullanıcı verisi klasöründe; Windows: %APPDATA%\WarByte, macOS: ~/Library/Application Support/WarByte) ──
app.setName('WarByte');
const SETTINGS = path.join(app.getPath('userData'), 'ayarlar.json');
function readSettings() { try { return { uncapped: true, ...JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) }; } catch { return { uncapped: true }; } }
function writeSettings(s) { try { fs.mkdirSync(path.dirname(SETTINGS), { recursive: true }); fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2)); } catch (e) { console.error('[warbyte] ayar yazılamadı', e); } }
const settings = readSettings();
const uncapped = arg('vsync') ? false : arg('uncapped') ? true : process.env.WARBYTE_VSYNC === '1' ? false : settings.uncapped !== false;
const local = !!arg('local') || process.env.WARBYTE_LOCAL === '1';
const startUrl = typeof arg('url') === 'string' ? arg('url') : process.env.WARBYTE_URL || null;
const inactive = !!arg('inactive') || process.env.WARBYTE_INACTIVE === '1';            // test betikleri: pencere görünür ama odağı çalmaz (kullanıcının önüne atlamasın)
const query = typeof arg('query') === 'string' ? arg('query') : '';                 // örn. --query="autostart=5v5&map=colgecidi&type=tdm&nolock=1&perf=1"

// ── Chromium anahtarları (app hazır olmadan önce) ──
const sw = (k, v) => (v === undefined ? app.commandLine.appendSwitch(k) : app.commandLine.appendSwitch(k, v));
if (uncapped) {
  sw('disable-frame-rate-limit');           // requestAnimationFrame ekran yenileme hızını beklemez
  sw('disable-gpu-vsync');                  // GPU sunumu dikey eşitlemeyi beklemez (yırtılma olabilir; ölçüm için)
}
sw('ignore-gpu-blocklist');                 // kara listedeki sürücüde de donanım WebGL (yazılım çiziciye düşmesin, bkz. 12.222)
sw('enable-gpu-rasterization');
sw('force_high_performance_gpu');           // iki GPU'lu dizüstünde (Intel + NVIDIA / AMD) güçlü olan
sw('disable-renderer-backgrounding');       // pencere arkadayken de tam hız
sw('disable-background-timer-throttling');
sw('disable-backgrounding-occluded-windows');

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

const info = () => ({
  version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, platform: process.platform,
  uncapped, mode: local ? 'local' : 'live', server: local ? 'wss://ws.warbyte.io/ws' : undefined,
});
ipcMain.on('wb-info', (e) => { e.returnValue = info(); });
ipcMain.handle('wb-set-uncapped', (e, v) => askRestart(!!v));
ipcMain.handle('wb-fullscreen', () => { const w = BrowserWindow.getFocusedWindow(); if (w) w.setFullScreen(!w.isFullScreen()); });

let win = null;
async function askRestart(v) {
  const r = await dialog.showMessageBox(win, {
    type: 'question', buttons: ['Yeniden başlat', 'Vazgeç'], defaultId: 0, cancelId: 1, title: 'WarByte',
    message: v ? 'VSync kapatılsın mı? (sınırsız FPS)' : 'VSync açılsın mı? (ekran yenileme hızına kilitli)',
    detail: 'Bu ayar Chromium açılırken uygulanır; oyun yeniden başlatılacak.',
  });
  if (r.response !== 0) return false;
  writeSettings({ ...readSettings(), uncapped: v });
  app.relaunch({ args: argv.filter((a) => a !== '--vsync' && a !== '--uncapped') });
  app.exit(0);
  return true;
}

function sameSite(u) {
  try { const x = new URL(u); return x.protocol === 'warbyte:' || x.hostname === 'warbyte.io' || x.hostname.endsWith('.warbyte.io') || (!app.isPackaged && /^(127\.0\.0\.1|localhost)$/.test(x.hostname)) || (startUrl && x.origin === new URL(startUrl).origin); } catch { return false; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, title: 'WarByte', backgroundColor: '#070a10', autoHideMenuBar: true, show: false,
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false },
  });
  win.removeMenu();
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
    else if (k.key === 'F9') { e.preventDefault(); askRestart(!uncapped); }
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
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
