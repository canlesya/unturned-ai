import { Game } from './game/game.js';
import { showMenu, loadPrefs, recordMatch } from './menu.js';
import { MENU_CSS } from './menuStyle.js';
import { NetClient } from './net/client.js';
import { defaultServerUrl } from './net/protocol.js';

const q = new URLSearchParams(location.search);
const loading = document.getElementById('loading');
let game = null;

const TIPS = ['Bayrağın çevresinde kal: sıhhiye yakınındaysa canın yenilenir.', 'Köşeden Q / E ile eğilerek ateş et.', 'Gece fenerini F ile aç.', 'Ele geçirdiğin bayrakta yeniden doğabilirsin.', 'Keskin nişancılar yüksek noktaları sever.'];
function showLoading() {
  loading.innerHTML = `<div class="lg">WAR<b>BYTE</b></div><div class="lb"></div><div class="lt">${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>`;
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
        onExit: opts.onExit || (() => { game = null; showMenu(start, beginOnline); }),
        onRestart: opts.onRestart || (() => start(opts)),
      });
    } catch (e) {
      console.error(e);
      loading.textContent = 'Hata: ' + e.message;
      return;
    }
    loading.style.display = 'none';
  }, 60);
}

// Çevrimiçi: bağlantı kurulduktan sonra (menüden ya da URL'den) oyunu başlat
function beginOnline({ net, welcome, name, pw }) {
  const p = loadPrefs();
  const c = welcome.cfg, me = welcome.roster[welcome.id];
  try { if (pw) sessionStorage.setItem('bf_pw_' + welcome.room, pw); } catch (e) { /* yok say */ }       // sayfa yenilenince (maç sonu / takım değişimi) yeniden sorulmasın
  const cls = me.cls, loadout = (p.loadouts && p.loadouts[cls]) || {};
  history.replaceState(null, '', `?online=${welcome.room}${q.get('debug') ? '&debug=1' : ''}${q.get('nolock') ? '&nolock=1' : ''}&name=${encodeURIComponent(name)}`);
  document.getElementById('menu').style.display = 'none';
  start({
    online: { net, id: welcome.id, roster: welcome.roster, deps: welcome.deps, room: welcome.room, cfg: c },
    match: { perTeam: c.perTeam, type: c.type, tickets: c.tickets, time: c.time }, map: c.map, tod: c.tod, weather: c.weather, diff: c.diff,
    optic: q.get('optic') || p.optic || 'reddot', team: me.team, cls, playerName: name,
    loadout, loadouts: p.loadouts || {}, onExit: () => { location.href = location.pathname; }, onRestart: () => location.reload(),
    settings: { sens: p.sens, fov: p.fov, volume: p.volume ?? 0.6, shadows: q.get('shadows') !== '0' && p.shadows !== false, pixelRatio: +(q.get('pr') || p.quality || 1) },
  });
}

// URL ile: /?online=new (oda kur) ya da /?online=ABCD (katıl)  &name=Ad [&server=ws://host:8787] [&map=&per=&tod=&weather=&type=&cls=&team=]
async function startOnline() {
  const p = loadPrefs();
  document.getElementById('menu').style.display = 'none';
  showLoading();
  const url = q.get('server') || p.server || defaultServerUrl();
  const name = q.get('name') || p.name || 'Oyuncu';
  const code = q.get('online');
  const cls = q.get('cls') || p.cls || 'assault', loadout = (p.loadouts && p.loadouts[cls]) || {};
  let pw = q.get('pw') || '';
  if (!pw && code.toLowerCase() !== 'new') { try { pw = sessionStorage.getItem('bf_pw_' + code.toUpperCase()) || ''; } catch (e) { /* yok say */ } }
  const hello = code.toLowerCase() === 'new'
    ? { t: 'create', name, cls, loadout, team: q.get('team') || undefined, cfg: { name: q.get('room') || undefined, pw, listed: q.get('listed') !== '0', bots: q.get('bots') !== '0', third: q.get('third') === '1', map: q.get('map') || 'kasaba', tod: q.get('tod') || 'day', weather: q.get('weather') || 'clear', type: q.get('type') || 'conquest', perTeam: +q.get('per') || 5, diff: q.get('diff') || 'normal', tickets: +q.get('tickets') || undefined, time: q.has('time') ? +q.get('time') : undefined } }
    : { t: 'join', room: code, name, cls, loadout, pw, team: q.get('team') || undefined };
  try {
    const { net, welcome } = await NetClient.connect(url, hello);
    beginOnline({ net, welcome, name, pw });
  } catch (e) {
    loading.style.display = 'flex';
    loading.innerHTML = `<div class="lg">WAR<b>BYTE</b></div><div class="lt">Bağlanılamadı: ${e.message}<br><br><a href="${location.pathname}" style="color:#ff8a1f">Ana menüye dön</a></div>`;
  }
}

if (q.get('online')) startOnline();
else if (q.get('autostart')) {
  const p = loadPrefs();
  document.getElementById('menu').style.display = 'none';
  const mm = /^(\d+)v\d+$/.exec(q.get('autostart'));
  start({
    third: q.get('third') !== '0',
    match: { perTeam: mm ? +mm[1] : 10, type: q.get('type') || 'conquest', tickets: +q.get('tickets') || undefined, time: q.has('time') ? +q.get('time') : 900 }, map: q.get('map') || 'kasaba', tod: q.get('tod') || 'day', weather: q.get('weather') || 'clear', optic: q.get('optic') || 'reddot', team: q.get('team') || 'blue', cls: q.get('cls') || 'assault', diff: q.get('diff') || 'normal',
    loadout: { primary: q.get('primary') || undefined, secondary: q.get('secondary') || undefined, gadget: q.get('gadget') || undefined, melee: q.get('melee') || undefined },
    settings: { sens: p.sens, fov: p.fov, volume: 0, shadows: q.get('shadows') !== '0', pixelRatio: +(q.get('pr') || 1) },
  });
} else showMenu(start, beginOnline);
