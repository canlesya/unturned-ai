// Sayfaya yalnız küçük, salt okunur bir nesne açılır: window.__desktop (oyun "Masaüstü" yazar, F3 paneli FPS düğmesini gösterir).
// Gömülü modda server = wss://ws.warbyte.io/ws (src/net/protocol.js defaultServerUrl bunu kullanır). Node erişimi yok (sandbox + contextIsolation).
// 12.232: fps ('vsync' | '60' | '144' | '240' | 'uncapped'), fpsCap (oyun döngüsü sınırı, 0 = yok), hz (ekran hızı), battery, inactive (test penceresi);
// onState(cb): odak / pil / ekran hızı / FPS sınırı değişince { focused?, battery?, hz?, fpsCap? } (src/framePace.js dinler).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('wb-info');
contextBridge.exposeInMainWorld('__desktop', {
  ...info,
  setUncapped: (v) => ipcRenderer.invoke('wb-set-uncapped', !!v),
  setFps: (v) => ipcRenderer.invoke('wb-set-fps', String(v)),
  chooseFps: () => ipcRenderer.invoke('wb-choose-fps'),
  onState: (cb) => { if (typeof cb === 'function') ipcRenderer.on('wb-state', (e, s) => cb(s)); },
  toggleFullscreen: () => ipcRenderer.invoke('wb-fullscreen'),
});
