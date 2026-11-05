// 12.231 Sessiz tarayıcı: test betiklerine dokunmadan her Chromium'u BAŞSIZ açar (pencere öne fırlayıp kullanıcının işini bölmesin).
//   node --import ./scripts/lib/pw-quiet.mjs scripts/bombatest.mjs                      (tek test)
//   NODE_OPTIONS="--import=$PWD/scripts/lib/pw-quiet.mjs" node scripts/…                 (her node süreci)
//   qa.mjs bunu tarayıcı testlerine kendisi ekler. HEADFUL=1 → betiğin kendi ayarı (pencereli) korunur; PW_OFFSCREEN=1 → pencere ekran dışına.
// Başsız kabuk + `--use-angle=metal` Mac'te GERÇEK GPU verir (ölçüm: "ANGLE Metal Renderer: Apple M4 Pro", 60 fps;
// bayraksız başsız = SwiftShader yazılım GPU, oyun gpuCheck ile düşük kaliteye iner). Betik SwiftShader istiyorsa (SOFT=1) dokunulmaz.
// Her durumda arka plan / örtülü pencere kısıtlaması kapatılır (paralel testlerde rAF / zamanlayıcı kısılıp oyun zamanı durmasın).
import { chromium } from 'playwright';
const HEADFUL = process.env.HEADFUL === '1';
const KEEP = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'];
const GPU = ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'];
const fix = (o = {}) => {
  o = { ...o, args: [...(o.args || []), ...((o.args || []).some((a) => a.startsWith('--lang')) ? [] : ['--lang=' + (process.env.LOCALE || 'tr-TR')])] };
  const args = [...(o.args || [])], soft = args.some((a) => /swiftshader/.test(a));
  const out = { ...o, args: [...new Set([...args, ...KEEP, ...(soft ? [] : GPU.filter((g) => !(g.startsWith('--use-angle') && args.some((a) => a.startsWith('--use-angle')))))])] };
  if (HEADFUL && process.env.PW_OFFSCREEN === '1') out.args = [...out.args.filter((a) => !a.startsWith('--window-position')), '--window-position=-3000,-3000'];      // qa'nın pencereli testleri: ekran dışında (macOS kenara kısabilir)
  if (!HEADFUL) { out.headless = true; delete out.devtools; out.args = out.args.filter((a) => !/^--(start-fullscreen|start-maximized|window-position|kiosk)/.test(a)); }
  return out;
};
// Dil: pencereli Chrome sistem dilini (tr) alır, başsız kabuk en-US → oyun İngilizce açılır, Türkçe metin denetimleri düşer.
// Betik locale vermediyse tr-TR (LOCALE=… ile değiştirilebilir).
const LOCALE = process.env.LOCALE || 'tr-TR';
const withLocale = (o) => ({ locale: LOCALE, ...(o || {}) });
const wrap = (b) => {
  const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = (o) => nc(withLocale(o));
  b.newPage = (o) => np(withLocale(o));
  return b;
};
const launch = chromium.launch.bind(chromium), persist = chromium.launchPersistentContext.bind(chromium);
chromium.launch = async (o) => wrap(await launch(fix(o)));
chromium.launchPersistentContext = (dir, o) => persist(dir, withLocale(fix(o)));
