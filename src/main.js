import { Game } from './game/game.js';
import { showMenu, loadPrefs } from './menu.js';

const q = new URLSearchParams(location.search);
const loading = document.getElementById('loading');
let game = null;

function start(opts) {
  loading.style.display = 'flex';
  // arayüz boyansın, sonra ağır kurulum
  setTimeout(() => {
    try {
      game = new Game(document.body, {
        ...opts,
        debug: q.get('debug') === '1',
        nolock: q.get('nolock') === '1',
        autoplay: q.get('autoplay') === '1',
        onExit: () => { game = null; showMenu(start); },
        onRestart: () => start(opts),
      });
    } catch (e) {
      console.error(e);
      loading.textContent = 'Hata: ' + e.message;
      return;
    }
    loading.style.display = 'none';
  }, 60);
}

if (q.get('autostart')) {
  const p = loadPrefs();
  document.getElementById('menu').style.display = 'none';
  start({
    mode: q.get('autostart'), team: q.get('team') || 'blue', cls: q.get('cls') || 'assault', diff: q.get('diff') || 'normal',
    settings: { sens: p.sens, fov: p.fov, volume: 0, shadows: q.get('shadows') !== '0', pixelRatio: 1 },
  });
} else showMenu(start);
