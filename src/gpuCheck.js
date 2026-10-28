// 12.222 Yazılım WebGL algısı: tarayıcıda donanım hızlandırma kapalıysa (ya da GPU sürücüsü engelliyse) WebGL işlemcide çalışır
// (SwiftShader / "Microsoft Basic Render Driver" / llvmpipe). Bu durumda menü de oyun da saniyede birkaç kare çizer ve sekme bütünüyle ağırlaşır
// (F12 bile geç açılır). Algı: failIfMajorPerformanceCaveat ile bağlam açılamıyorsa ya da WEBGL_debug_renderer_info yazılım çiziciyi adlandırıyorsa.
// Sonuç: menüde uyarı (tarayıcı ayarı: "Kullanılabilir olduğunda grafik hızlandırmayı kullan" + yeniden başlat) ve düşük kalite (gölge / son işleme yok,
// düşük çözünürlük). ?softgl=1 algıyı zorlar (test), ?softgl=0 kapatır.
const SOFT_RE = /swiftshader|basic render|llvmpipe|softpipe|software|mesa offscreen|apple software/i;
let cached = null;

function probe(attrs) {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2', attrs) || c.getContext('webgl', attrs);
  if (!gl) return null;
  let name = '';
  try { const ext = gl.getExtension('WEBGL_debug_renderer_info'); name = String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || ''); } catch (e) { /* yok say */ }
  try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { /* yok say */ }
  return name;
}

export function gpuInfo() {
  if (cached) return cached;
  cached = { soft: false, noGL: false, caveat: false, renderer: '' };
  const f = new URLSearchParams(globalThis.location?.search || '').get('softgl');
  if (typeof document === 'undefined') return cached;
  try {
    const hw = probe({ failIfMajorPerformanceCaveat: true });
    if (hw === null) {
      const any = probe({});
      if (any === null) cached.noGL = true;
      else { cached.caveat = true; cached.renderer = any; }
    } else cached.renderer = hw;
    cached.soft = !cached.noGL && (cached.caveat || SOFT_RE.test(cached.renderer));
  } catch (e) { /* algılanamadı: donanım say */ }
  if (f === '1') cached.soft = true; else if (f === '0') cached.soft = false;
  return cached;
}
