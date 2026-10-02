// Sunucu (headless) için "boş" nesne: her yöntem çağrısı sessizce yutulur, atanan alanlar saklanır.
// Örn. game.sfx / game.effects / game.hud / game.weather yerine konur; mantık kodu bunları çağırmaya devam edebilir.
export function nullSink(init = {}) {
  const store = { ...init };
  const noop = () => undefined;
  return new Proxy(store, {
    get: (t, k) => (k in t ? t[k] : noop),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}
