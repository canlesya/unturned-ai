// 12.234 Menü arka planı iş parçacığı: OffscreenCanvas'a MenuBg (src/menuBg.js) çizer; harita kurulumu / çizim ana iş parçacığını bekletmez.
// İleti: ana → { t: 'init' | 'world' | 'mode' | 'size' | 'state' | 'prefetch' | 'stats' }, iş parçacığı → { t: 'ready' | 'fade' | 'world' | 'stats' | 'err' }.
import { MenuBg } from './menuBg.js';
import { setPaceState } from './framePace.js';
import { MAPS } from './maps/index.js';

let bg = null;
const post = (m) => self.postMessage(m);

// Bazı haritalar tabela / yazı dokusunu 2B tuvalle çizer (typeof document denetimi). İş parçacığında document yok: yalnız kurulum süresince
// OffscreenCanvas veren küçük bir yer tutucu (modüllerin açılışta document'a bakan kodu bunu görmez).
const docShim = { createElement: (t) => (t === 'canvas' ? new OffscreenCanvas(1, 1) : null), documentElement: { style: { setProperty() {} } } };
for (const m of Object.values(MAPS)) {
  const b = m.build;
  m.build = (...a) => { const had = 'document' in self; if (!had) self.document = docShim; try { return b(...a); } finally { if (!had) delete self.document; } };
}

self.onmessage = (e) => {
  const d = e.data || {};
  try {
    if (d.t === 'init') {
      if (typeof self.requestAnimationFrame !== 'function') { post({ t: 'err', m: 'noraf' }); return; }     // Safari: iş parçacığında rAF yok → ana iş parçacığı
      setPaceState(d.state);
      bg = new MenuBg(d.canvas, { w: d.w, h: d.h, dpr: d.dpr, soft: d.soft, maxMaps: d.maxMaps, opts: d.opts, post });
      post({ t: 'ready' });
    } else if (!bg) return;
    else if (d.t === 'world') bg.setWorld(d.id, d.tod);
    else if (d.t === 'mode') bg.setMode(d.mode);
    else if (d.t === 'size') bg.resize(d.w, d.h, d.dpr);
    else if (d.t === 'state') setPaceState(d.state);
    else if (d.t === 'prefetch') bg.prefetch(d.ids);
    else if (d.t === 'stats') post({ t: 'stats', q: d.q, s: bg.stats() });
    else if (d.t === 'dispose') { bg.dispose(); bg = null; self.close(); }       // bağlam açık kalmasın (12.222 sızıntı dersi), sonra iş parçacığı kapanır
  } catch (err) { console.error(err); post({ t: 'err', m: String(err?.message || err), init: d.t === 'init' }); }
};
