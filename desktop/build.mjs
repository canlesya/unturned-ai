// Paketleme: node build.mjs win mac  →  out/WarByte-win32-x64.zip (kurulumsuz, açıp WarByte.exe) · out/WarByte-darwin-arm64.zip (WarByte.app)
// Önce kökte istemci derlenir (dist/; gömülü --local modu için uygulamaya kaynak olarak girer). Windows paketi macOS'tan da çıkar: @electron/packager
// exe simgesi / sürüm bilgisi için resedit (saf JS) kullanır, wine gerekmez. macOS paketi imzasız; Apple Silicon imzasız ikiliyi hiç çalıştırmadığı için
// geçici (ad-hoc) imza atılır (codesign -s -). İnternetten indirilen kopyada: sağ tık → Aç ya da xattr -cr WarByte.app.
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(HERE, 'out');
const want = process.argv.slice(2).length ? process.argv.slice(2) : ['win', 'mac'];
const pkg = JSON.parse(fs.readFileSync(path.join(HERE, 'package.json'), 'utf8'));
const electronVersion = JSON.parse(fs.readFileSync(path.join(HERE, 'node_modules/electron/package.json'), 'utf8')).version;

if (process.env.SKIP_WEB !== '1') {
  console.log('• istemci derleniyor (vite build)…');
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
}
if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) throw new Error('dist/index.html yok: önce kökte npx vite build');
fs.mkdirSync(OUT, { recursive: true });

const common = {
  dir: HERE, out: OUT, name: 'WarByte', executableName: 'WarByte', appVersion: pkg.version, electronVersion, overwrite: true, asar: true, prune: true,
  extraResource: [path.join(ROOT, 'dist')],
  ignore: [/^\/out($|\/)/, /^\/node_modules($|\/)/, /^\/build\/make-icon\.py$/, /^\/build\.mjs$/, /^\/README\.md$/, /^\/\.gitignore$/],
  appCopyright: 'WarByte',
};
const targets = {
  win: { platform: 'win32', arch: 'x64', icon: path.join(HERE, 'build/icon.ico'), win32metadata: { CompanyName: 'WarByte', ProductName: 'WarByte', FileDescription: 'WarByte', OriginalFilename: 'WarByte.exe' } },
  mac: { platform: 'darwin', arch: 'arm64', icon: path.join(HERE, 'build/icon.icns'), appBundleId: 'io.warbyte.desktop', appCategoryType: 'public.app-category.games', osxSign: false },
};

for (const t of want) {
  const o = targets[t];
  if (!o) throw new Error('bilinmeyen hedef: ' + t + ' (win | mac)');
  console.log(`• paketleniyor: ${o.platform}-${o.arch} (Electron ${electronVersion})`);
  const [dir] = await packager({ ...common, ...o });
  const zip = path.join(OUT, path.basename(dir) + '.zip');
  fs.rmSync(zip, { force: true });
  if (o.platform === 'darwin') {
    const app = path.join(dir, 'WarByte.app');
    if (process.platform === 'darwin') execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });      // geçici imza (Apple Silicon şartı)
    if (process.platform === 'darwin') execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);           // çerçeve sembolik bağları korunur
  } else if (process.platform === 'win32') {
    execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${dir}' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
  } else {
    execFileSync('zip', ['-qry', zip, path.basename(dir)], { cwd: OUT, stdio: 'inherit' });
  }
  console.log('  →', dir, fs.existsSync(zip) ? '\n  → ' + zip + ' (' + (fs.statSync(zip).size / 1048576).toFixed(1) + ' MB)' : '');
}
