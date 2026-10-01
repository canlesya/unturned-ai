import { Game } from './game/game.js';
import { showMenu, loadPrefs, recordMatch } from './menu.js';
import { MENU_CSS } from './menuStyle.js';

const q = new URLSearchParams(location.search);
const loading = document.getElementById('loading');
let game = null;

const TIPS = ['Bayrağın çevresinde kal: sıhhiye yakınındaysa canın yenilenir.', 'Köşeden Q / E ile eğilerek ateş et.', 'Gece fenerini F ile aç.', 'Ele geçirdiğin bayrakta yeniden doğabilirsin.', 'Keskin nişancılar yüksek noktaları sever.'];
function showLoading() {
  loading.innerHTML = `<div class="lg">BLOCK<b>FRONT</b></div><div class="lb"></div><div class="lt">${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>`;
  loading.style.display = 'flex';
}
const st = document.createElement('style'); st.textContent = MENU_CSS; document.head.appendChild(st);

function start(opts) {
  showLoading();
  // arayüz boyansın, sonra ağır kurulum
  setTimeout(() => {
    try {
      game = new Game(document.body, {
        ...opts,
        debug: q.get('debug') === '1',
        nolock: q.get('nolock') === '1',
        autoplay: q.get('autoplay') === '1',
        onMatchEnd: recordMatch,
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
  const mm = /^(\d+)v\d+$/.exec(q.get('autostart'));
  start({
    match: { perTeam: mm ? +mm[1] : 10, type: q.get('type') || 'conquest', tickets: +q.get('tickets') || undefined, time: q.has('time') ? +q.get('time') : 900 }, map: q.get('map') || 'kasaba', tod: q.get('tod') || 'day', weather: q.get('weather') || 'clear', optic: q.get('optic') || 'reddot', team: q.get('team') || 'blue', cls: q.get('cls') || 'assault', diff: q.get('diff') || 'normal',
    loadout: { primary: q.get('primary') || undefined, secondary: q.get('secondary') || undefined, gadget: q.get('gadget') || undefined, melee: q.get('melee') || undefined },
    settings: { sens: p.sens, fov: p.fov, volume: 0, shadows: q.get('shadows') !== '0', pixelRatio: +(q.get('pr') || 1) },
  });
} else showMenu(start);
