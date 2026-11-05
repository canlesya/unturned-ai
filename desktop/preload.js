// Sayfaya yalnız küçük, salt okunur bir nesne açılır: window.__desktop (oyun "Masaüstü" yazar, F3 paneli VSync düğmesini gösterir).
// Gömülü modda server = wss://ws.warbyte.io/ws (src/net/protocol.js defaultServerUrl bunu kullanır). Node erişimi yok (sandbox + contextIsolation).
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('wb-info');
contextBridge.exposeInMainWorld('__desktop', {
  ...info,
  setUncapped: (v) => ipcRenderer.invoke('wb-set-uncapped', !!v),
  toggleFullscreen: () => ipcRenderer.invoke('wb-fullscreen'),
});
