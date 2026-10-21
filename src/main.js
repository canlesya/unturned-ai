import { Game } from './game/game.js';
import { showMenu, loadPrefs, recordMatch, patchPrefs, FOV_KEY, Q_KEY } from './menu.js';
import { MENU_CSS } from './menuStyle.js';
import { NetClient } from './net/client.js';
import { defaultServerUrl, healthUrl } from './net/protocol.js';
import { fetchBalance, useBalance } from './game/balance.js';
import { t } from './i18n/index.js';
import './i18n/match.js';
import './i18n/menu.js';
import { mapName, modeLabel } from './i18n/data.js';
import { acctTok, getSession } from './account.js';

const q = new URLSearchParams(location.search);
const loading = document.getElementById('loading');
let game = null;
// Çevrimdışı maçlar da admin panelindeki denge ayarlarını kullanır (sunucuya ulaşılamazsa koddaki varsayılanlar)
const balReady = fetchBalance(healthUrl(q.get('server') || loadPrefs().server || defaultServerUrl()).replace(/\/health$/, ''));

// Yükleme ekranı: logo · yüklenen harita + mod (biliniyorsa) · ilerleme çubuğu · menüdeki ipuçlarından biri (seçili dilde)
function showLoading(opts) {
  const what = opts?.editor ? `${mapName(opts.map)}<small>${t('menu.load.editor')}</small>` : opts?.map ? `${mapName(opts.map)}<small>${modeLabel(opts.match?.type || 'conquest')}</small>` : t('menu.load.online');
  loading.innerHTML = `<div class="lg">WAR<b>BYTE</b></div><div class="lm">${t('menu.load.loading')} · ${what}</div><div class="lb"></div><div class="lt"><b>${t('menu.tipLabel')}</b> ${t('menu.tip.' + Math.floor(Math.random() * 7))}</div>`;
  loading.style.display = 'flex';
}
const st = document.createElement('style'); st.textContent = MENU_CSS; document.head.appendChild(st);
if (FOV_KEY === 'fovM') document.documentElement.classList.add('touch');      // dokunmatik cihaz: menüde büyük dokunma hedefleri (menuStyle.js html.touch)

function start(opts) {
  showLoading(opts);
  // arayüz boyansın, sonra ağır kurulum
  const go = opts.online ? Promise.resolve() : balReady.then((b) => useBalance(b));
  go.then(() => setTimeout(() => {
    try {
      game = new Game(document.body, {
        ...opts,
        debug: q.get('debug') === '1',
        nolock: q.get('nolock') === '1',
        autoplay: q.get('autoplay') === '1',
        onMatchEnd: recordMatch,
        onExit: opts.onExit || (() => { game = null; showMenu(start, beginOnline); }),
        onRestart: opts.onRestart || ((nx) => start(nx ? { ...opts, ...nx } : opts)),      // çevrimdışı sonraki maç: maç sonu ekranında seçilen harita / gün saati / hava
      });
    } catch (e) {
      console.error(e);
      loading.textContent = t('menu.load.error', { m: e.message });
      return;
    }
    loading.style.display = 'none';
  }, 60));
}

// Çevrimiçi: bağlantı kurulduktan sonra (menüden ya da URL'den) oyunu başlat
function beginOnline({ net, welcome, name: name0, pw }) {
  const p = loadPrefs();
  const c = welcome.cfg, me = welcome.roster[welcome.id], name = (me && me.name) || name0;      // sunucunun verdiği ad (hesap adı / misafire eklenen sayı / odada aynı ad varsa ek)
  try { if (pw) sessionStorage.setItem('bf_pw_' + welcome.room, pw); } catch (e) { /* yok say */ }       // sayfa yenilenince (maç sonu / takım değişimi) yeniden sorulmasın
  const cls = me.cls, loadout = (p.loadouts && p.loadouts[cls]) || {};
  history.replaceState(null, '', `?online=${welcome.room}${q.get('debug') ? '&debug=1' : ''}${q.get('nolock') ? '&nolock=1' : ''}${q.get('touch') ? '&touch=' + q.get('touch') : ''}${q.get('server') ? '&server=' + encodeURIComponent(q.get('server')) : ''}&name=${encodeURIComponent(name)}`);   // sunucu adresi de kalır (yenilenince başka sunucuya gidip "bağlanılamadı" olmasın)
  document.getElementById('menu').style.display = 'none';
  // Maç bitti → sunucu yeni maçı kurup aynı bağlantıda yeni 'welcome' yollar: sayfa yenilenmeden, menüye düşmeden yeni maç kurulur
  net.onWelcome = (w) => { const g = game; game = null; g?.dispose(true); net.resetMatch(); beginOnline({ net, welcome: w, name, pw }); };
  start({
    online: { net, id: welcome.id, roster: welcome.roster, deps: welcome.deps, pk: welcome.pk, room: welcome.room, cfg: c },
    match: { perTeam: c.perTeam, type: c.type, tickets: c.tickets, time: c.time }, map: c.map, tod: c.tod, weather: c.weather, diff: c.diff,
    optic: q.get('optic') || p.optic || 'reddot', team: me.team, cls, playerName: name,
    keys: p.keys, leftHand: p.leftHand, adsToggle: p.adsToggle, onPref: patchPrefs,
    loadout, loadouts: p.loadouts || {}, onExit: () => { location.href = location.pathname; }, onRestart: () => location.reload(),
    settings: { sens: p.sens, fov: p[FOV_KEY], volume: p.volume ?? 0.6, vSfx: p.vSfx, vMusic: p.vMusic, vAmb: p.vAmb, rainSound: p.rainSound, shadows: q.get('shadows') !== '0' && p.shadows !== false, post: q.has('post') ? q.get('post') === '1' : p.post, adaptive: p.adaptive !== false, fullscreen: p.fullscreen !== false, pixelRatio: +(q.get('pr') || p[Q_KEY] || 1) },
  });
}

// URL ile: /?online=new (oda kur) ya da /?online=ABCD (katıl)  &name=Ad [&server=ws://host:8787] [&map=&per=&tod=&weather=&type=&cls=&team=]
async function startOnline() {
  const p = loadPrefs();
  document.getElementById('menu').style.display = 'none';
  showLoading();
  const url = q.get('server') || p.server || defaultServerUrl();
  const name = (getSession()?.kind === 'acct' && getSession().name) || q.get('name') || p.name || 'Oyuncu';      // hesaplı: sunucu da jetondan hesabın adını kullanır
  const code = q.get('online');
  const cls = q.get('cls') || p.cls || 'assault', loadout = (p.loadouts && p.loadouts[cls]) || {};
  let pw = q.get('pw') || '';
  if (!pw && code.toLowerCase() !== 'new') { try { pw = sessionStorage.getItem('bf_pw_' + code.toUpperCase()) || ''; } catch (e) { /* yok say */ } }
  const hello = code.toLowerCase() === 'new'
    ? { t: 'create', name, tok: acctTok(), cls, loadout, team: q.get('team') || undefined, cfg: { name: q.get('room') || undefined, pw, listed: q.get('listed') !== '0', bots: q.get('bots') !== '0', third: q.get('third') === '1', map: q.get('map') || 'kasaba', tod: q.get('tod') || 'day', weather: q.get('weather') || 'clear', type: q.get('type') || 'conquest', perTeam: +q.get('per') || 5, diff: q.get('diff') || 'normal', tickets: +q.get('tickets') || undefined, time: q.has('time') ? +q.get('time') : undefined } }
    : { t: 'join', room: code, name, tok: acctTok(), cls, loadout, pw, team: q.get('team') || undefined };
  try {
    const { net, welcome } = await NetClient.connect(url, hello, { onWait: (ms) => { loading.querySelector('.lt').textContent = t('match.waitNext', { s: Math.ceil((ms || 0) / 1000) }); } });     // maç sonu ekranındaki odaya: yeni maçta otomatik katılım
    beginOnline({ net, welcome, name, pw });
  } catch (e) {
    loading.style.display = 'flex';
    loading.innerHTML = `<div class="lg">WAR<b>BYTE</b></div><div class="lt">${t('menu.load.noConnect', { m: e.message })}<br><br><a href="${location.pathname}">${t('menu.load.back')}</a></div>`;
  }
}

if (q.get('online')) startOnline();
else if (q.get('editor')) {                     // /?editor=colgecidi : doğrudan Harita Editörü bölümü (botsuz, uçuş, panel açık)
  const p = loadPrefs();
  document.getElementById('menu').style.display = 'none';
  start({
    editor: true, devMode: true, map: q.get('editor'), tod: q.get('tod') || 'day', weather: 'clear', team: 'blue', cls: p.cls || 'assault', diff: 'normal', optic: p.optic || 'reddot',
    match: { perTeam: 1, type: 'dm', time: 900 }, third: false, keys: p.keys, leftHand: p.leftHand, adsToggle: p.adsToggle, onPref: patchPrefs, loadout: {},
    settings: { sens: p.sens, fov: p.fov, volume: 0, shadows: q.get('shadows') !== '0', pixelRatio: +(q.get('pr') || p[Q_KEY] || 1) },
    onExit: () => { location.href = location.pathname; },
  });
}
else if (q.get('autostart')) {
  const p = loadPrefs();
  document.getElementById('menu').style.display = 'none';
  const mm = /^(\d+)v\d+$/.exec(q.get('autostart'));
  start({
    third: q.get('third') !== '0',
    devMode: q.get('dev') === '1',
    match: { perTeam: (mm ? +mm[1] : 10) * (q.get('type') === 'inf' ? 2 : 1), type: q.get('type') || 'conquest', tickets: +q.get('tickets') || undefined, time: q.has('time') ? +q.get('time') : 900 }, map: q.get('map') || 'kasaba', tod: q.get('tod') || 'day', weather: q.get('weather') || 'clear', optic: q.get('optic') || 'reddot', team: q.get('team') || 'blue', cls: q.get('cls') || 'assault', diff: q.get('diff') || 'normal',
    keys: p.keys, leftHand: p.leftHand, adsToggle: p.adsToggle, onPref: patchPrefs,
    loadout: { primary: q.get('primary') || undefined, secondary: q.get('secondary') || undefined, gadget: q.get('gadget') || undefined, melee: q.get('melee') || undefined },
    settings: { sens: p.sens, fov: p[FOV_KEY], volume: 0, shadows: q.get('shadows') !== '0', post: q.has('post') ? q.get('post') === '1' : p.post, pixelRatio: +(q.get('pr') || (FOV_KEY === 'fovM' ? p[Q_KEY] : 1)) },      // dokunmatikte telefon kalitesi
  });
} else showMenu(start, beginOnline);
