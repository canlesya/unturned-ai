import { MAPS, DEFAULT_MAP, mapsFor } from './maps/index.js';
import { CLASS_DEFS, WSTATS, DIFFICULTY, OPTIC_ORDER } from './game/stats.js';
import { MATCH_TYPES, TODS_LIST, defaultTickets, defaultScoreLimit, isTotalType as tot, totalMin as totMin, totalMax as totMax } from './game/match.js';
import { LIMITS, TUNE } from './game/balance.js';
import { MENU_CSS } from './menuStyle.js';
import { loadEdits, clearEdits } from './game/mapEditor.js';
import { MenuScene } from './menuScene.js';
import { WEATHERS } from './game/weather.js';
import { NetClient } from './net/client.js';
import { defaultServerUrl, healthUrl } from './net/protocol.js';
import { Binds, ACTIONS, GROUPS, RESERVED, norm } from './core/keybinds.js';
import { music } from './game/music.js';
import { isTouch } from './game/touch.js';
import { t, lang, setLang, onLang, LANGS } from './i18n/index.js';
import './i18n/menu.js';
import { mapName as mapNm, mapTag, mapDesc, modeLabel, modeDesc, modeTag, className, classDesc, weaponName, weaponDesc, diffLabel, opticLabel, todLabel, weatherLabel, statLabel, actionLabel, groupLabel, keyName } from './i18n/data.js';

const KEY = 'warbyte.v2';
// Dokunmatik cihazda görüş açısı ve kalite AYRI tercihlerde (fovM = YATAY FOV, qualityM = çözünürlük çarpanı): telefonda kayıtlı eski
// masaüstü değerleri (dikey 75°, 1×) yeni varsayılanları ezmesin; masaüstü tercihleri hiç değişmez
const TOUCH = isTouch();
export const FOV_KEY = TOUCH ? 'fovM' : 'fov', Q_KEY = TOUCH ? 'qualityM' : 'quality';
export const FOV_RANGE = TOUCH ? [70, 110] : [60, 100];
export const DEFAULTS = {
  map: DEFAULT_MAP, tod: 'day', weather: 'clear', type: 'conquest', perTeam: 10, tickets: 0, time: 900,
  team: 'blue', cls: 'assault', diff: 'normal', optic: 'reddot', loadouts: {}, name: lang() === 'tr' ? 'Sen' : 'You',      // varsayılan takma ad ilk açılıştaki dilde
  sens: 0.0022, fov: 75, volume: 0.6, shadows: !TOUCH, quality: 1.5, fovM: 85, qualityM: 2, adaptive: true, fullscreen: true, devMode: false,   // telefonda: gölgesiz; keskinlik için 2× (FPS düşerse otomatik çözünürlük indirir)
  xp: 0, stats: { matches: 0, wins: 0, kills: 0, deaths: 0 },
  server: '', room: '', olTeam: 'auto', third: true,
  keys: {}, leftHand: false, adsToggle: false, vSfx: 0.9, vMusic: 0.5, vAmb: 0.8, rainSound: true,   // tuş atamaları, silah eli, ses kanalları
};

export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('blockfront.v2') || localStorage.getItem('blockfront.v1') || '{}');
    return { ...DEFAULTS, ...raw, stats: { ...DEFAULTS.stats, ...(raw.stats || {}) }, loadouts: raw.loadouts || {} };
  } catch (e) { return { ...DEFAULTS }; }
}
function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* yok say */ } }
// oyundan kısmi tercih yaz (ör. sol el)
export function patchPrefs(o) { const p = loadPrefs(); Object.assign(p, o); savePrefs(p); }

// Maç sonu: XP ve istatistikleri kaydet
export function recordMatch({ score = 0, kills = 0, deaths = 0, win = false }) {
  const p = loadPrefs();
  p.xp += Math.round(score + (win ? 300 : 80));
  p.stats.matches++; if (win) p.stats.wins++; p.stats.kills += kills; p.stats.deaths += deaths;
  savePrefs(p);
  return p;
}
const levelOf = (xp) => Math.floor(Math.sqrt(xp / 120)) + 1;

const TIP_N = 7, NEWS_N = 7;                                              // menu.tip.0..6 / menu.news.0..6 (src/i18n/menu.js)
const SIZE_PRESETS = [1, 3, 5, 10, 16, 24, 32];
const TIME_OPTS = [300, 600, 900, 1200, 1800, 0];
const TICKET_OPTS = [0, 50, 100, 200, 400, 800], SCORE_OPTS = [0, 30, 50, 75, 100, 150, 200];
const timeLabel = (v) => (v ? t('menu.min', { n: v / 60 }) : '∞');
// oyuncu sayısı 'toplam' olan modlarda (Ölüm Maçı, Enfekte) alt/üst sınır ve hızlı seçimler
const lo = (tp) => (tot(tp) ? totMin(tp) : 1), hi = (tp) => (tot(tp) ? totMax(tp) : LIMITS.maxPerTeam);
const TOT_PRESETS = { dm: [2, 4, 6, 8, 10], gg: [2, 4, 6, 8, 10], inf: [6, 8, 12, 16, 24], pb: [2, 4, 6, 8, 12] };
const totTx = (tp, n) => t(`menu.tot.${tp === 'pb' || tp === 'gg' || tp === 'inf' ? tp : 'dm'}`, { n, z: Math.max(1, Math.round(n / 8)), dm: LIMITS.dmKills, pb: LIMITS.pbKills });
const SLOTS = [['primary', 'primaryOptions'], ['secondary', 'secondaryOptions'], ['gadget', 'gadgetOptions'], ['melee', 'meleeOptions']];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
// sunucu / istemci hata metinleri (sunucu Türkçe yollar; sunucu davranışı değişmesin diye çeviri istemcide)
const NET_ERR = { 'Zaten bir odadasın': 'already', 'Sunucu dolu, sonra tekrar dene': 'full', 'Oda bulunamadı': 'notFound', 'Şifre yanlış': 'pw', 'Çok fazla yanlış şifre': 'pwMany', 'Oda dolu': 'roomFull', 'Maç bitti, yeni maç birazdan başlıyor': 'ended', 'Sunucuya bağlanılamadı': 'connect' };
const netErr = (m) => { const k = NET_ERR[m] || (String(m).startsWith('Sunucuya bağlanılamadı') ? 'connect' : null); return k ? t('menu.err.' + k) : m; };

// Çizgi ikonlar (24×24, currentColor): menü gezinmesi ve kısayol kartları
const ICON = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h4.5v-5.5h4v5.5h4.5V10"/>',
  custom: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/><path d="M4 12h12M20 12h0"/><circle cx="18" cy="12" r="2"/>',
  online: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5M12 3.5C9.4 5.9 8.2 8.7 8.2 12s1.2 6.1 3.8 8.5"/>',
  loadout: '<circle cx="12" cy="12" r="7"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><circle cx="12" cy="12" r="1.2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
  controls: '<rect x="2.5" y="6.5" width="19" height="11" rx="1.5"/><path d="M6 10h1M9.5 10h1M13 10h1M16.5 10h1.5M7 14h10"/>',
  editor: '<path d="M12 2.8 20.5 7.5v9L12 21.2 3.5 16.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9.2"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  lang: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5M12 3.5C9.4 5.9 8.2 8.7 8.2 12s1.2 6.1 3.8 8.5"/>',
};
const ico = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

function weaponBars(id) {
  const st = WSTATS[id] || {};
  if (st.stats) return st.stats;
  const r = st.range ? st.range[1] : 40;
  return { dmg: Math.min(100, Math.round((st.dmg || 20) * (st.pellets || 1) / 1.3)), range: Math.min(100, Math.round(r / 1.6)), rate: Math.min(100, Math.round((st.rpm || 300) / 9)), control: 60, mobility: Math.round(((st.move || 1) - 0.8) * 250) };
}

let styleEl = null;
function ensureStyle() {
  if (styleEl) return;
  styleEl = document.createElement('style'); styleEl.textContent = MENU_CSS; document.head.appendChild(styleEl);
}

export function showMenu(onStart, onOnline) {
  ensureStyle();
  const el = document.getElementById('menu');
  const p = loadPrefs();
  if (!MAPS[p.map] && p.map !== 'random') p.map = DEFAULT_MAP;
  el.style.display = 'block';
  el.innerHTML = `<canvas id="mnBg"></canvas><div class="mn-vig"></div>
    <div class="mn-top"><div class="mn-logo" id="mnLogo"></div><div class="mn-topr"><div class="mn-langs" id="mnLangs"></div><div class="mn-user" id="mnUser"></div></div></div>
    <nav class="mn-side" id="mnNav"></nav>
    <main class="mn-stage" id="mnStage"></main>
    <div class="mn-foot"><span id="mnTip"></span><span id="mnVer"></span></div>`;
  const q = (s) => el.querySelector(s);
  const stage = q('#mnStage'), nav = q('#mnNav');
  let scene = null;
  try { scene = new MenuScene(q('#mnBg')); } catch (e) { console.warn('menü sahnesi açılamadı', e); }
  let screen = 'home', slot = 'primary';
  let ol = { msg: '', err: false, busy: false, rooms: null, pwFor: null, pw: '', cpw: '' }, olChk = 0;
  let tipI = Math.floor(Math.random() * TIP_N);
  const showTip = () => { q('#mnTip').innerHTML = `<b>${t('menu.tipLabel')}</b> ${t('menu.tip.' + tipI)}`; };
  const tipTimer = setInterval(() => { tipI = (tipI + 1) % TIP_N; showTip(); }, 7000);
  const chrome = () => {                                                     // dil değişince sabit kabuk (logo, dil düğmeleri, alt bilgi) da yenilenir
    q('#mnLogo').innerHTML = `WAR<b>BYTE</b><small>${t('menu.tagline')}</small>`;
    q('#mnLangs').innerHTML = LANGS.map(([k]) => `<button class="lg ${lang() === k ? 'on' : ''}" data-a="lang" data-v="${k}" title="${t('menu.set.lang')}">${k.toUpperCase()}</button>`).join('');
    q('#mnVer').textContent = t('menu.version');
    showTip();
  };
  chrome();

  const NAV = ['home', 'custom', 'online', 'loadout', 'settings', 'controls', 'editor'];
  const save = () => savePrefs(p);
  const mapName = () => mapNm(p.map);
  const todName = () => (p.tod === 'random' ? t('menu.random') : todLabel(p.tod));
  const loadoutOf = (cls) => p.loadouts[cls] || (p.loadouts[cls] = {});
  const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

  function bg() {
    if (!scene) return;
    const m = screen === 'editor' && MAPS[p.edMap] ? p.edMap : p.map === 'random' ? (scene.mapId || DEFAULT_MAP) : p.map;
    const tt = p.tod === 'random' ? (scene.tod || 'day') : p.tod;
    if (screen === 'loadout') {
      scene.setMode('showroom');
      scene.showCharacter({ team: p.team === 'red' ? 'red' : 'blue', cls: p.cls, weapon: loadoutOf(p.cls).primary || null, optic: p.optic });
    } else { scene.setMode('orbit'); scene.setWorld(m, tt); }
    q('.mn-vig').className = 'mn-vig' + (screen === 'loadout' ? ' light' : screen === 'home' ? ' home' : '');
  }

  function renderUser() {
    const lv = levelOf(p.xp), l0 = (lv - 1) ** 2 * 120, l1 = lv ** 2 * 120;
    const s = p.stats;
    q('#mnUser').innerHTML = `<div class="mn-lv"><small>${t('menu.user.lv')}</small>${lv}</div><div class="mn-ub"><div class="nm" data-raw><input id="mnName" maxlength="14" value="${esc(p.name)}" spellcheck="false" aria-label="${t('menu.user.name')}" title="${t('menu.user.name')}"></div>
      <div class="xp"><i style="width:${Math.round(((p.xp - l0) / (l1 - l0)) * 100)}%"></i></div>
      <small>${t('menu.user.stats', { m: s.matches, w: s.wins, kd: s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills })}</small></div>`;
    q('#mnName').addEventListener('input', (e) => { p.name = e.target.value.trim() || DEFAULTS.name; save(); });
    q('#mnName').addEventListener('keydown', (e) => e.stopPropagation());
  }

  function renderNav() {
    nav.innerHTML = NAV.map((k) => `<button class="mn-nav ${screen === k || (k === 'online' && screen === 'ocreate') ? 'on' : ''}" data-a="go" data-v="${k}">${ico(k)}<span class="tx">${t('menu.nav.' + k)}<small>${t('menu.nav.' + k + '.sub')}</small></span></button>`).join('')
      + '<div class="mn-spacer"></div>';
  }
  // ekran başlığı (Ana Menü dışında): büyük başlık + kısa açıklama
  const head = (k, extra = '') => `<header class="mn-head"><h1>${t('menu.nav.' + (k === 'ocreate' ? 'ocreate' : k))}</h1><p>${t('menu.head.' + k)}</p>${extra}</header>`;

  // ───── ekranlar ─────
  const weaName = (w) => (w === 'random' ? t('menu.randomWeather') : weatherLabel(w));
  const summary = () => `<div class="sumline"><span>${ico('custom')}${modeLabel(p.type)}</span>${tot(p.type) ? `<span><b>${p.perTeam}</b> ${t('menu.players')}</span>` : `<span><b>${p.perTeam}</b> v <b>${p.perTeam}</b></span>`}<span>${todName()}${p.weather !== 'clear' ? ' · ' + weaName(p.weather) : ''}</span><span>${t('menu.bots')}: ${diffLabel(p.type === 'inf' ? 'hard' : p.diff)}</span>${p.devMode ? `<span class="dev">${t('menu.dev')}</span>` : ''}</div>`;

  function homeHTML() {
    const cm = p.map === 'random' ? null : MAPS[p.map];
    const def = CLASS_DEFS[p.cls] || CLASS_DEFS.assault, lw = loadoutOf(p.cls).primary;
    const prim = lw && def.primaryOptions.includes(lw) ? lw : (def.defaults.primary[p.team === 'red' ? 'red' : 'blue'] || def.defaults.primary.blue);
    return `<div class="home">
      <aside class="home-side">
        <div class="news card"><h3><span>${t('menu.news.title')}</span><em>v2.0</em></h3><ul>${Array.from({ length: NEWS_N }, (_, i) => `<li>${t('menu.news.' + i)}</li>`).join('')}</ul></div>
        <button class="lcard card" data-a="go" data-v="loadout"><small>${t('menu.home.loadout')}</small><b>${className(p.cls)}</b><span>${weaponName(prim)} · ${opticLabel(p.optic)}</span><i>›</i></button>
      </aside>
      <div class="hero">
        <div class="kick">${t('menu.home.ready')}</div>
        <h1>${cm ? mapName() : t('menu.randomMap')}</h1>
        <div class="htag">${cm ? mapTag(cm.id) : t('menu.randomMapTag')}</div>
        ${summary()}
        <div class="cta"><button class="play" data-a="quick">${ico('play')}<span>${t('menu.quick')}<small>${t('menu.quick.sub')}</small></span></button>
          <div class="cta2"><button class="play sec" data-a="random">${ico('dice')}<span>${t('menu.randomMatch')}</span></button><button class="play sec" data-a="go" data-v="custom">${ico('custom')}<span>${t('menu.nav.custom')}</span></button><button class="play sec" data-a="go" data-v="online">${ico('online')}<span>${t('menu.nav.online')}</span></button></div></div>
      </div></div>`;
  }

  // ───── Maç kurucu (Özel Oyun + Oda Kur ortak): 1 Mod → 2 Harita → 3 Ayarlar; sağda canlı özet + Oyna ─────
  const MODE_ICON = { conquest: '⚑', tdm: '⚔', dm: '☠', gg: '🔫', inf: '🧟', pb: '🎨', payload: '🚃' };
  function builderHTML(c, online) {
    const LOCAL = { map: 'map', type: 'type', tod: 'tod', weather: 'weather', third: 'third', diff: 'diff', time: 'time', tickets: 'tickets', perTeam: 'size', team: 'team' };
    const at = (k, v) => (online ? `data-a="olset" data-k="${k}" data-v="${v}"` : `data-a="${LOCAL[k]}" data-v="${k === 'third' ? (v ? '1' : '0') : v}"`);
    const chip = (k, v, label, sm) => `<button class="chip ${c[k] === v ? 'on' : ''}" ${at(k, v)}>${label}${sm ? `<small>${sm}</small>` : ''}</button>`;
    const tp = c.type, icon = MODE_ICON[tp];
    const maps = mapsFor(tp), cm = c.map === 'random' ? null : MAPS[c.map] || maps[0];
    const ftod = cm && cm.forceTod;
    const eff = c.tickets || (tp === 'tdm' ? defaultScoreLimit(c.perTeam) : defaultTickets(c.perTeam));
    const lk = tp === 'inf' || tp === 'gg' || tp === 'dm' || tp === 'pb' || tp === 'tdm' ? tp : 'conquest';
    const limitTitle = tp === 'payload' ? t('payload.limitTitle') : t('menu.limit.' + lk);
    const limitSum = tp === 'payload' ? t('payload.limitSum') : t('menu.limitSum.' + lk, { n: eff, dm: LIMITS.dmKills, pb: LIMITS.pbKills });
    const n = c.perTeam, sizeTxt = tot(tp) ? t('menu.nPeople', { n }) : `${n} vs ${n}`;
    const diffKey = tp === 'inf' ? 'hard' : c.diff, botsOn = online ? c.bots : true;
    const todLbl = ftod ? t('menu.nightMap') : c.tod === 'random' ? t('menu.random') : todLabel(c.tod);
    const weaLbl = c.weather === 'random' ? t('menu.random') : weatherLabel(c.weather);
    const warn = tot(tp) ? '' : n > 20 ? `<div class="warn">${t('menu.warnBig')}</div>` : '';
    const onOff = (v) => t(v ? 'menu.on' : 'menu.off');

    const modeCards = Object.keys(MATCH_TYPES).map((k) => `<button class="mdc ${tp === k ? 'on' : ''}" ${at('type', k)}><span class="ic">${MODE_ICON[k]}</span><b>${modeLabel(k)}</b><em>${modeTag(k)}</em><small>${modeDesc(k)}</small></button>`).join('');
    const mapCards = maps.map((m) => `<button class="mapc ${c.map === m.id ? 'on' : ''}" ${at('map', m.id)}><img src="${m.thumb}" alt="" loading="lazy">${m.mobile ? `<em class="mob">${t('menu.mobile')}</em>` : ''}<div class="t"><b>${mapNm(m.id)}</b><small>${mapTag(m.id)}</small></div></button>`).join('')
      + (maps.length > 1 ? `<button class="mapc rnd ${c.map === 'random' ? 'on' : ''}" ${at('map', 'random')}>${ico('dice')}<div class="t"><b>${t('menu.random')}</b></div></button>` : '');
    const mapNote = maps.length === 1 ? `<div class="hint">${t('menu.onlyMap', { m: mapNm(maps[0].id) })}</div>` : '';
    const mapDs = cm ? `<div class="mapdesc"><b>${mapNm(cm.id)}.</b> ${mapDesc(cm.id)}</div>` : `<div class="mapdesc">${t('menu.randomMapDesc')}</div>`;
    const tods = ftod ? `<div class="hint">${t('menu.nightOnly', { m: mapNm(cm.id) })}</div>`
      : `<div class="tods">${TODS_LIST.map(([k]) => `<button class="tod ${k} ${c.tod === k ? 'on' : ''}" ${at('tod', k)}><span>${todLabel(k)}</span></button>`).join('')}<button class="tod rnd ${c.tod === 'random' ? 'on' : ''}" ${at('tod', 'random')}><span>${t('menu.random')}</span></button></div>`;
    const limitBody = tp === 'payload' ? `<div class="hint">${t('payload.limitHint', { t: Math.round(LIMITS.plTime / 60), b: TUNE.plBonus, r: TUNE.plRadius, d: TUNE.plBackDelay })}</div>` : tp === 'inf' || tp === 'gg' || tp === 'dm' || tp === 'pb' ? `<div class="hint">${t('menu.limitHint.' + tp, { dm: LIMITS.dmKills, pb: LIMITS.pbKills })}</div>`
      : `<div class="row">${(tp === 'tdm' ? SCORE_OPTS : TICKET_OPTS).map((v) => `<button class="chip ${c.tickets === v ? 'on' : ''}" ${at('tickets', v)}>${v || t('menu.auto')}</button>`).join('')}</div><div class="hint">${t('menu.now')}: <b>${eff}</b></div>`;
    const sizeAttrs = online ? { id: 'ocSize', num: 'ocSizeV' } : { id: 'rSize', num: 'vSize' };
    const sizeCard = `<div class="sc wide"><h4>${t('menu.size')} <em>${tot(tp) ? t('menu.sizeTot', { n: hi(tp) }) : t('menu.sizeTeam')}${botsOn ? t('menu.sizeBots') : t('menu.sizeNoBots')}</em></h4>
        <div class="big"><div class="n" id="${sizeAttrs.num}">${sizeNum(tp, n)}</div><div class="tx">${tot(tp) ? totTx(tp, n) : `${t('menu.fighters', { n: n * 2 })}${online && c.bots ? ' ' + t('menu.botLeaves') : ''}`}${warn}</div></div>
        <input type="range" id="${sizeAttrs.id}" min="${lo(tp)}" max="${hi(tp)}" step="${tp === 'inf' ? 2 : 1}" value="${n}" style="--p:${((n - lo(tp)) / (hi(tp) - lo(tp))) * 100}%" aria-label="${t('menu.size')}">
        <div class="row">${(tot(tp) ? TOT_PRESETS[tp] : SIZE_PRESETS).map((v) => `<button class="chip ${n === v ? 'on' : ''}" ${at('perTeam', v)}>${tot(tp) ? v : `${v}v${v}`}</button>`).join('')}</div></div>`;
    const botCard = `<div class="sc"><h4>${t('menu.bots')}</h4>${online ? `<div class="row">${chip('bots', true, t('menu.on'), t('menu.botsOnSub'))}${chip('bots', false, t('menu.off'), t('menu.botsOffSub'))}</div>` : ''}
        ${botsOn ? (tp === 'inf' ? `<div class="row"><button class="chip on">${diffLabel('hard')}</button></div><div class="hint">${t('menu.infHard')}</div>` : `<div class="row">${Object.keys(DIFFICULTY).map((k) => chip('diff', k, diffLabel(k))).join('')}</div>`) : ''}</div>`;
    const teamCard = !online && !tot(tp) ? `<div class="sc"><h4>${t('menu.yourTeam')}</h4><div class="row">${[['blue', 'blue'], ['red', 'red'], ['random', '']].map(([k, cl]) => `<button class="chip ${cl} ${c.team === k ? 'on' : ''}" ${at('team', k)}>${t('menu.team.' + k)}</button>`).join('')}</div></div>` : '';
    const limitCard = `<div class="sc"><h4>${limitTitle}</h4>${limitBody}</div>`;
    const timeCard = `<div class="sc"><h4>${t('menu.time')}</h4>${tp === 'payload' ? `<div class="hint">${t('payload.timeHint', { t: Math.round(LIMITS.plTime / 60), b: TUNE.plBonus })}</div>` : ''}<div class="row">${TIME_OPTS.map((v) => `<button class="chip ${c.time === v ? 'on' : ''}" ${at('time', v)}>${timeLabel(v)}</button>`).join('')}</div></div>`;
    const todCard = `<div class="sc wide"><h4>${t('menu.tod')}</h4>${tods}</div>`;
    const devCard = online ? '' : `<div class="sc wide"><h4>${t('menu.devMode')} <em>${t('menu.devModeSub')}</em></h4><div class="row">${[[false, t('menu.off'), ''], [true, t('menu.on'), t('menu.devOnSub')]].map(([v, l, sm]) => `<button class="chip ${!!p.devMode === v ? 'on' : ''}" data-a="devmode" data-v="${v ? '1' : '0'}">${l}${sm ? `<small>${sm}</small>` : ''}</button>`).join('')}</div>${p.devMode ? `<div class="hint" style="margin-top:8px">${t('menu.devKeys')}</div>` : ''}</div>`;
    const weatherCard = `<div class="sc"><h4>${t('menu.weather')}</h4><div class="row">${[...WEATHERS.map((w) => w[0]), 'random'].map((k) => `<button class="chip ${c.weather === k ? 'on' : ''}" ${at('weather', k)}>${k === 'random' ? t('menu.random') : weatherLabel(k)}</button>`).join('')}</div></div>`;
    const camCard = `<div class="sc ${teamCard ? '' : 'wide'}"><h4>${t('menu.cam')}</h4><div class="row">${[[true, t('menu.on'), t('menu.camOnSub')], [false, t('menu.off'), '']].map(([v, l, sm]) => `<button class="chip ${c.third === v ? 'on' : ''}" ${at('third', v)}>${l}${sm ? `<small>${sm}</small>` : ''}</button>`).join('')}</div></div>`;

    const roomSec = online ? `<section class="bs" id="bs0"><h2><i>1</i>${t('menu.oc.room')}<small>${t('menu.oc.roomSub')}</small></h2><div class="sgrid">
        <div class="sc"><h4>${t('menu.oc.name')}</h4><input class="olin" id="ocName" maxlength="24" placeholder="${esc(t('menu.oc.namePh', { name: p.name }))}" value="${esc(c.name)}" spellcheck="false" autocomplete="off" data-raw></div>
        <div class="sc"><h4>${t('menu.oc.pw')} <em>${t('menu.oc.pwSub')}</em></h4><input class="olin" id="ocPw" type="password" maxlength="16" placeholder="${t('menu.oc.pwPh')}" value="${esc(ol.cpw || '')}" autocomplete="off"></div>
        <div class="sc wide"><h4>${t('menu.oc.vis')}</h4><div class="row">${chip('listed', true, t('menu.oc.public'), t('menu.oc.publicSub'))}${chip('listed', false, t('menu.oc.hidden'), t('menu.oc.hiddenSub'))}</div></div></div></section>` : '';
    const k0 = online ? 1 : 0;
    const steps = (online ? [['bs0', t('menu.oc.room')]] : []).concat([['bs1', t('menu.step.mode')], ['bs2', t('menu.step.map')], ['bs3', t('menu.step.settings')]]).map(([id, s], i) => `<button class="${i === 0 ? 'on' : ''}" data-a="jump" data-v="${id}"><i>${i + 1}</i>${s}</button>`).join('<span></span>');
    const msg = online && ol.msg ? `<div class="olmsg ${ol.err ? 'err' : ''}">${esc(ol.msg)}</div>` : '';

    const rows = [[t('menu.row.mode'), `${icon} ${modeLabel(tp)}`], [t('menu.row.players'), `${sizeTxt}${online && !c.bots ? ' · ' + t('menu.noBots') : ''}`], [t('menu.time'), timeLabel(c.time)], [limitTitle, limitSum],
      [t('menu.bots'), botsOn ? diffLabel(diffKey) : t('menu.off')], [t('menu.tod'), todLbl], [t('menu.row.weather'), weaLbl], [t('menu.row.cam'), c.third ? t('menu.third') : t('menu.first')]].concat(online || !p.devMode ? [] : [[t('menu.dev'), t('menu.on')]]);
    const startBtn = online
      ? `<button class="play" data-a="olcreate" ${ol.busy ? 'disabled' : ''}>${ico('play')}<span>${t('menu.oc.create')}</span></button><button class="chip back" data-a="oview" data-v="online">‹ ${t('menu.back')}</button>`
      : `<button class="play" data-a="quick">${ico('play')}<span>${t('menu.play')}<small>Enter</small></span></button>`;
    return `<div class="bld"><div class="scroll">${msg}<div class="bsteps">${steps}</div>${roomSec}
      <section class="bs" id="bs1"><h2><i>${1 + k0}</i>${t('menu.mode')}<small>${t('menu.modeSub')}</small></h2><div class="mdgrid">${modeCards}</div></section>
      <section class="bs" id="bs2"><h2><i>${2 + k0}</i>${t('menu.step.map')}<small>${maps.length === 1 ? t('menu.mapOnly') : t('menu.nMaps', { n: maps.length })}</small></h2><div class="maps">${mapCards}</div>${mapNote}${mapDs}</section>
      <section class="bs" id="bs3"><h2><i>${3 + k0}</i>${t('menu.step.settings')}<small>${t('menu.settingsSub')}</small></h2><div class="sgrid">${sizeCard}${timeCard}${limitCard}${botCard}${teamCard ? `${teamCard}${weatherCard}${camCard}${todCard}` : `${weatherCard}${todCard}${camCard}`}${devCard}</div></section>
      <div class="bld-mini">${startBtn}</div></div>
      <aside class="bld-side"><div class="pv"><div class="pvimg ${cm ? '' : 'rnd'}" ${cm ? `style="background-image:url(${cm.thumb})"` : ''}>${cm ? '' : ico('dice')}<span class="pvm">${icon} ${modeLabel(tp)}</span></div>
        <h2>${cm ? mapNm(cm.id) : t('menu.randomMap')}</h2><div class="pvtag">${cm ? mapTag(cm.id) : t('menu.randomMapTag')}</div>
        <ul class="pvl">${rows.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('')}</ul><div class="pvbtn">${startBtn}</div></div></aside></div>`;
  }
  const sizeNum = (tp, v) => (tot(tp) ? `${v}<i>${t('menu.people')}</i>` : `${v}<i>vs</i>${v}`);
  function customHTML() { return head('custom') + builderHTML(p, false); }

  const OLCFG0 = { name: '', listed: true, map: 'kasaba', tod: 'day', weather: 'clear', type: 'conquest', perTeam: 5, bots: true, diff: 'normal', tickets: 0, time: 900, third: false };
  const oc = () => (p.olCfg = { ...OLCFG0, ...(p.olCfg || {}) });
  const roomName = (r) => { const m = r.official && /^Resmi Sunucu\s*(#?\d*)$/.exec(r.name || ''); return m ? `<span>${t('menu.ol.officialName', { n: m[1] })}</span>` : `<span data-raw>${esc(r.name)}</span>`; };

  function roomCard(r) {
    const m = MAPS[r.map] || { thumb: '' };
    const full = r.humans >= r.cap, tl = r.tl >= 0 ? ` · ${Math.floor(r.tl / 60)}:${String(r.tl % 60).padStart(2, '0')}` : '';
    const sub = `${mapNm(r.map)} · ${todLabel(r.tod)}${r.weather !== 'clear' ? ' · ' + weatherLabel(r.weather) : ''}`;
    return `<div class="rcard ${r.official ? 'off' : ''}"><div class="th" style="background-image:url(${m.thumb})"></div>
      <div class="rb"><div class="rt">${r.official ? `<em class="bd">${t('menu.ol.official')}</em>` : ''}${r.locked ? `<em class="lk" title="${t('menu.ol.locked')}">🔒</em>` : ''}<b>${roomName(r)}</b></div>
      <div class="rs">${sub}</div><div class="rs">${modeLabel(r.type)} · ${tot(r.type) ? t('menu.nPlayers', { n: r.perTeam }) : r.perTeam + 'v' + r.perTeam}${r.bots ? ' · ' + t('menu.ol.withBots') : ' · ' + t('menu.noBots')}${r.third ? ' · ' + t('menu.ol.third') : ''}${tl}</div>${r.by ? `<div class="rs by">${t('menu.ol.by')} <span data-raw>${esc(r.by)}</span></div>` : ''}</div>
      <div class="rp"><div class="pc ${full ? 'full' : ''}"><b>${r.humans}</b>/${r.cap}<small>${t('menu.players')}</small></div>
      <button class="chip join" data-a="rjoin" data-code="${r.code}" data-locked="${r.locked ? 1 : 0}" ${ol.busy || full || r.ended ? 'disabled' : ''}>${r.ended ? t('menu.ol.ended') : full ? t('menu.ol.full') : t('menu.ol.join')}</button></div></div>`;
  }
  function roomListHTML() {
    if (!ol.rooms) return `<div class="hint">${t('menu.ol.loading')}</div>`;
    const off = ol.rooms.filter((r) => r.official), usr = ol.rooms.filter((r) => !r.official);
    return `<h3 class="sub">${t('menu.ol.officialT')} <em>${t('menu.ol.officialSub')}</em></h3><div class="rgrid">${off.map(roomCard).join('') || `<div class="hint">${t('menu.ol.noOfficial')}</div>`}</div>
      <h3 class="sub" style="margin-top:16px">${t('menu.ol.userT')} <em>${t('menu.ol.nRooms', { n: usr.length })}</em></h3><div class="rgrid">${usr.map(roomCard).join('') || `<div class="hint">${t('menu.ol.noRooms')}</div>`}</div>`;
  }
  function pwPromptHTML() {
    if (!ol.pwFor) return '';
    return `<div class="pan pwp"><h3>${t('menu.ol.pwRoom')} <em data-raw>${esc(ol.pwFor.name)}</em></h3><div class="row"><input class="olin" id="olPwJoin" type="password" maxlength="16" placeholder="${t('menu.ol.pwPh')}" autocomplete="off" style="flex:1">
      <button class="chip on" data-a="rpwgo">${t('menu.ol.join')}</button><button class="chip" data-a="rpwcancel">${t('menu.cancel')}</button></div></div>`;
  }
  function onlineHTML() {
    const tm = [['auto', ''], ['blue', 'blue'], ['red', 'red']].map(([k, c]) => `<button class="chip ${c} ${p.olTeam === k ? 'on' : ''}" data-a="oltm" data-v="${k}">${t('menu.team.' + k)}</button>`).join('');
    const msg = ol.msg ? `<div class="olmsg ${ol.err ? 'err' : ''}">${esc(ol.msg)}</div>` : '';
    const dis = ol.busy ? 'disabled' : '';
    return `${head('online', `<em id="olStat">${t('menu.ol.checking')}</em>`)}<div class="scroll">${msg}${pwPromptHTML()}
      <div class="pan"><h3>${t('menu.ol.rooms')}</h3><div id="olRooms">${roomListHTML()}</div></div>
      <div class="split ol-top">
        <div class="pan"><h3>${t('menu.ol.createT')}</h3><div class="hint" style="margin:0 0 12px">${t('menu.ol.createHint')}</div>
          <button class="play" data-a="oview" data-v="ocreate" ${dis} style="width:100%"><span>+ ${t('menu.nav.ocreate')}<small>${t('menu.ol.createSub')}</small></span></button></div>
        <div class="pan"><h3>${t('menu.ol.codeT')}</h3>
          <div class="codejoin"><input class="olin code" id="olCode" maxlength="4" placeholder="${t('menu.ol.codePh')}" value="${esc(p.room || '')}" spellcheck="false" autocomplete="off" data-raw>
          <input class="olin" id="olPw" type="password" maxlength="16" placeholder="${t('menu.ol.pwOpt')}" autocomplete="off">
          <button class="play sec" data-a="oljoin" ${dis}><span>${t('menu.ol.join')}</span></button></div></div>
      </div>
      <div class="pan"><h3>${t('menu.ol.team')}</h3><div class="row">${tm}</div>
        <div class="hint">${t('menu.ol.teamHint')}</div></div></div>`;
  }
  function ocreateHTML() { return head('ocreate') + builderHTML(oc(), true); }

  // Sunucu durumu + oda listesi (menü çevrimiçi ekranındayken 2,5 sn'de bir)
  const httpBase = () => healthUrl(p.server || defaultServerUrl()).replace(/\/health$/, '');
  async function checkServer() {
    const my = ++olChk;
    if (!q('#olStat')) return;
    const set = (cls, s) => { const e = q('#olStat'); if (e && my === olChk) { e.className = cls; e.textContent = s; } };
    try {
      const c = new AbortController(), tm = setTimeout(() => c.abort(), 2500);
      const r = await fetch(httpBase() + '/rooms', { signal: c.signal, cache: 'no-store' });
      clearTimeout(tm);
      ol.rooms = await r.json();
      const n = ol.rooms.reduce((a, x) => a + x.humans, 0);
      set('ok', t('menu.ol.ready', { n }));
      const box = q('#olRooms'); if (box && !ol.busy) box.innerHTML = roomListHTML();
    } catch (e) { ol.rooms = null; set('bad', t('menu.ol.unreach')); const box = q('#olRooms'); if (box) box.innerHTML = `<div class="hint">${t('menu.ol.unreachHint')}</div>`; }
  }
  const roomPoll = setInterval(() => { if (screen === 'online' && !ol.busy && !ol.pwFor) checkServer(); }, 2500);

  async function goOnline(kind, o = {}) {
    if (ol.busy) return;
    const url = (p.server || defaultServerUrl()).trim();
    const team = p.olTeam === 'blue' || p.olTeam === 'red' ? p.olTeam : undefined;
    const cls = p.cls, loadout = loadoutOf(cls), name = p.name;
    let hello, pw = '';
    if (kind === 'create') {
      const c = oc(); pw = ol.cpw || '';
      hello = { t: 'create', name, cls, loadout, team, cfg: { name: c.name.trim(), pw, listed: c.listed, map: c.map, tod: c.tod, weather: c.weather, type: c.type, perTeam: c.perTeam, bots: c.bots, diff: c.diff, third: c.third, tickets: c.tickets || undefined, time: c.time } };
    } else {
      const code = String(o.code || p.room || '').toUpperCase();
      if (code.length !== 4) { ol = { ...ol, msg: t('menu.ol.needCode'), err: true, busy: false }; render(); return; }
      pw = o.pw ?? ol.pw ?? '';
      hello = { t: 'join', room: code, name, cls, loadout, team, pw };
    }
    ol = { ...ol, msg: t('menu.ol.connecting'), err: false, busy: true, pwFor: null }; render();
    try {
      const r = await NetClient.connect(url, hello);
      cleanup();
      onOnline?.({ net: r.net, welcome: r.welcome, name, pw });
    } catch (e) { ol = { ...ol, msg: netErr(e.message), err: true, busy: false }; render(); }
  }

  function loadoutHTML() {
    const def = CLASS_DEFS[p.cls], lw = loadoutOf(p.cls), team = p.team === 'red' ? 'red' : 'blue';
    const cur = (k) => {
      const opts = def[SLOTS.find((s) => s[0] === k)[1]] || [];
      const want = lw[k];
      if (want && opts.includes(want)) return want;
      const d = def.defaults?.[k];
      return typeof d === 'object' ? d[team] || d.blue : d;
    };
    const icon = (id) => (scene ? `<img data-icon="${id}" ${scene.iconCache.get(id + '|' + p.optic) ? `src="${scene.iconCache.get(id + '|' + p.optic)}"` : ''} alt="">` : '');
    const opts = def[SLOTS.find((s) => s[0] === slot)[1]] || [];
    const sel = cur(slot);
    const tabs = Object.keys(CLASS_DEFS).map((k) => `<button class="tab ${p.cls === k ? 'on' : ''}" data-a="cls" data-v="${k}">${className(k)}</button>`).join('');
    const slotBtns = SLOTS.map(([k]) => `<button class="slotb ${slot === k ? 'on' : ''}" data-a="slot" data-v="${k}"><small>${t('menu.slot.' + k)}</small><b>${cur(k) ? weaponName(cur(k)) : '—'}</b>${icon(cur(k))}</button>`).join('');
    const grid = opts.map((id) => {
      const st = WSTATS[id] || {}, b = weaponBars(id);
      const mini = st.kind === 'gun' || st.kind === 'launcher' || st.kind === 'melee' ? ['dmg', 'range', 'rate'].map((k) => `<span>${statLabel(k)}</span><div class="bar"><i style="width:${Math.max(4, Math.min(100, b[k] || 0))}%"></i></div>`).join('') : '';
      return `<button class="wc ${sel === id ? 'on' : ''}" data-a="pick" data-v="${id}">${icon(id)}<b>${weaponName(id)}</b><div class="mini">${mini}</div></button>`;
    }).join('');
    const b = weaponBars(sel);
    const utility = !(b.dmg || b.range);
    const stats = utility ? '' : ['dmg', 'range', 'rate', 'control', 'mobility'].map((k) => `<div class="stat"><span>${statLabel(k)}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, b[k] || 0))}%"></i></div><em>${Math.round(b[k] || 0)}</em></div>`).join('');
    const optics = slot === 'primary' && !(WSTATS[sel] && WSTATS[sel].scope) ? `<div class="pan"><h3>${t('menu.lo.optic')} <em>${t('menu.lo.opticSub')}</em></h3><div class="row">${OPTIC_ORDER.map((k) => `<button class="chip ${p.optic === k ? 'on' : ''}" data-a="optic" data-v="${k}">${opticLabel(k)}</button>`).join('')}</div></div>` : '';
    return `${head('loadout')}<div class="tabs">${tabs}</div><div class="scroll"><div class="clsdesc">${classDesc(p.cls)}</div><div class="slots">${slotBtns}</div>
      <div class="pan"><h3>${t('menu.slot.' + slot)} <em>${className(p.cls)}</em></h3><div class="wgrid">${grid}</div></div>
      <div class="pan"><h3>${weaponName(sel)}</h3>${stats}<div class="wdesc">${weaponDesc(sel) || classDesc(p.cls)}</div></div>${optics}</div>`;
  }

  function settingsHTML() {
    const sl = (id, label, min, max, step, v, fmt) => `<div class="setrow"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${((v - min) / (max - min)) * 100}%" aria-label="${label}"><em id="v_${id}">${fmt(v)}</em></div>`;
    const tog = (a, on, label, title) => `<button class="chip tog ${on ? 'on' : ''}" data-a="${a}" data-v="1" ${title ? `title="${title}"` : ''}>${label}<small>${t(on ? 'menu.on' : 'menu.off')}</small></button>`;
    const pct = (x) => Math.round(x * 100) + '%';
    return `${head('settings')}<div class="scroll">
      <div class="pan"><h3>${t('menu.set.lang')}</h3><div class="row">${LANGS.map(([k, n]) => `<button class="chip lang ${lang() === k ? 'on' : ''}" data-a="lang" data-v="${k}"><span data-raw>${n}</span><small>${k.toUpperCase()}</small></button>`).join('')}</div><div class="hint">${t('menu.set.langHint')}</div></div>
      <div class="pan"><h3>${t('menu.set.mouse')}</h3>
      ${sl('sSens', t('menu.set.sens'), 0.0008, 0.006, 0.0001, p.sens, (x) => (x / 0.0022).toFixed(2) + '×')}
      ${sl('sFov', TOUCH ? t('menu.set.fovH') : t('menu.set.fov'), FOV_RANGE[0], FOV_RANGE[1], 1, p[FOV_KEY], (x) => x + '°')}</div>
      <div class="pan"><h3>${t('menu.set.sound')}</h3>${sl('sVol', t('menu.set.master'), 0, 1, 0.05, p.volume, pct)}
      ${sl('sSfx', t('menu.set.sfx'), 0, 1, 0.05, p.vSfx, pct)}
      ${sl('sMusic', t('menu.set.music'), 0, 1, 0.05, p.vMusic, pct)}
      ${sl('sAmb', t('menu.set.amb'), 0, 1, 0.05, p.vAmb, pct)}
      <div class="row" style="margin-top:8px">${tog('rain', p.rainSound, t('menu.set.rain'))}</div>
      <div class="hint">${t('menu.set.musicHint')}</div></div>
      <div class="pan"><h3>${t('menu.set.gfx')}</h3><div class="lbl">${t('menu.set.quality')}</div><div class="row">${[[1, 'low'], [1.5, 'mid'], [2, 'high']].map(([v, l]) => `<button class="chip ${p[Q_KEY] === v ? 'on' : ''}" data-a="quality" data-v="${v}">${t('menu.set.q.' + l)}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px">${tog('shadows', p.shadows, t('menu.set.shadows'))}${tog('post', p.post ?? !TOUCH, t('menu.set.post'), t('menu.set.postT'))}${tog('adaptive', p.adaptive !== false, t('menu.set.adaptive'), t('menu.set.adaptiveT'))}${tog('fullscreen', p.fullscreen !== false, t('menu.set.fullscreen'), t('menu.set.fullscreenT'))}</div>
      <div class="hint">${t('menu.set.gfxHint')}</div></div>
      <div class="pan"><h3>${t('menu.set.data')}</h3><button class="chip danger" data-a="reset">${t('menu.set.reset')}</button></div></div>`;
  }

  let ctl = { cap: null, msg: '' };             // Kontroller ekranı: tuş atama durumu
  function controlsHTML() {
    const kb = new Binds(p.keys), cap = ctl.cap;
    const handKey = keyName(kb.codes('leftHand')[0]);
    const groups = GROUPS.map((g, gi) => `<div class="pan"><h3>${groupLabel(gi)}</h3>${ACTIONS.filter((a) => a.group === gi).map((a) => `<div class="kbrow"><span>${actionLabel(a.id)}</span><div>${[0, 1].map((sl) => {
      const on = cap && cap.id === a.id && cap.slot === sl;
      return `<button class="kbk ${on ? 'cap' : ''}" data-a="kbind" data-id="${a.id}" data-slot="${sl}" title="${t('menu.ct.bindT')}">${on ? t('menu.ct.press') : keyName(kb.codes(a.id)[sl])}</button>`;
    }).join('')}</div></div>`).join('')}</div>`).join('');
    const fixed = ['fire', 'switch', 'pause', 'look'].map((k) => [t('menu.ct.fixed.' + k), t('menu.ct.fixed.' + k + '.v')]);
    const touchNote = TOUCH ? `<div class="pan"><h3>${t('menu.ct.touchT')}</h3><div class="hint">${t('menu.ct.touch')}</div></div>` : '';
    return `${head('controls')}<div class="scroll">${touchNote}
      <div class="split"><div class="pan"><h3>${t('menu.ct.hand')}</h3><div class="row"><button class="chip ${p.leftHand ? '' : 'on'}" data-a="hand" data-v="right">${t('menu.ct.right')}</button><button class="chip ${p.leftHand ? 'on' : ''}" data-a="hand" data-v="left">${t('menu.ct.left')}</button></div>
      <div class="hint">${t('menu.ct.handHint', { k: handKey })}</div></div>
      <div class="pan"><h3>${t('menu.ct.ads')}</h3><div class="row"><button class="chip ${p.adsToggle ? '' : 'on'}" data-a="ads" data-v="hold">${t('menu.ct.hold')}</button><button class="chip ${p.adsToggle ? 'on' : ''}" data-a="ads" data-v="toggle">${t('menu.ct.toggle')}</button></div>
      <div class="hint">${t('menu.ct.adsHint')}</div></div></div>
      <div class="pan"><h3>${t('menu.ct.fire')}</h3><div class="hint">${t('menu.ct.fireHint', { k: keyName(kb.codes('fireMode')[0]) })}</div></div>
      <div class="pan"><h3>${t('menu.ct.bind')}</h3><div class="hint">${t('menu.ct.bindHint')}</div>
      <div class="row" style="margin-top:8px"><button class="chip" data-a="kreset">${t('menu.ct.reset')}</button></div>${ctl.msg ? `<div class="hint" style="color:var(--acc2)">${ctl.msg}</div>` : ''}</div>
      <div class="kgrid">${groups}</div>
      <div class="pan"><h3>${t('menu.ct.fixedT')}</h3><table class="keys">${fixed.map(([a, c]) => `<tr><td>${a}</td><td>${c}</td></tr>`).join('')}</table></div></div>`;
  }

  let lastScreen = null;
  function render() {
    const keep = screen === render.last ? stage.querySelector('.scroll')?.scrollTop || 0 : 0;      // başka ekrana geçince en üstten (önceki ekranın kaydırması taşınmasın)
    render.last = screen;
    stage.className = 'mn-stage s-' + screen + (screen === 'loadout' ? ' right' : '') + (screen !== lastScreen ? ' enter' : '');     // ekran değişince kısa giriş animasyonu
    lastScreen = screen;
    stage.innerHTML = { home: homeHTML, custom: customHTML, online: onlineHTML, ocreate: ocreateHTML, loadout: loadoutHTML, settings: settingsHTML, controls: controlsHTML, editor: editorHTML }[screen]();
    const sc = stage.querySelector('.scroll'); if (sc) sc.scrollTop = keep;
    const bsc = stage.querySelector('.bld .scroll');                          // kurucu: kaydırdıkça üstteki adım çubuğunda hangi bölümdeysen vurgulanır
    if (bsc) {
      const spy = () => {
        const secs = [...bsc.querySelectorAll('section.bs')], y = bsc.scrollTop + 90;
        let cur = secs[0]?.id;
        for (const e of secs) if (e.offsetTop <= y) cur = e.id;
        bsc.querySelectorAll('.bsteps button').forEach((x) => x.classList.toggle('on', x.dataset.v === cur));
      };
      bsc.addEventListener('scroll', spy, { passive: true }); spy();
    }
    renderNav(); renderUser(); bg();
    if (screen === 'loadout') fillIcons();
    if (screen === 'online') checkServer();
  }
  stage.addEventListener('animationend', (e) => { if (e.target === stage) stage.classList.remove('enter'); });

  // Silah ikonları tek tek (arayüzü kilitlemeden) üretilir
  let iconTimer = 0;
  function fillIcons() {
    clearTimeout(iconTimer);
    if (!scene) return;
    const next = [...stage.querySelectorAll('img[data-icon]')].find((im) => !im.getAttribute('src'));
    if (!next) return;
    iconTimer = setTimeout(() => {
      if (!scene) return;
      const id = next.dataset.icon, url = scene.weaponIcon(id, p.optic) || 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
      stage.querySelectorAll(`img[data-icon="${id}"]`).forEach((im) => im.setAttribute('src', url));
      fillIcons();
    }, 20);
  }

  // ───── Harita Editörü: oyundan ayrı bölüm. Düzenlemeler yalnız bu tarayıcıda ve yalnız editörde görünür; oyunda harita hep orijinal ─────
  const edCount = (id) => loadEdits(id).length;
  const edMaps = () => Object.values(MAPS).filter((m) => !m.dev && !m.only);
  function editorHTML() {
    if (!edMaps().some((m) => m.id === p.edMap)) p.edMap = MAPS.colgecidi ? 'colgecidi' : edMaps()[0].id;
    const m = MAPS[p.edMap], n = edCount(m.id);
    const cards = edMaps().map((x) => { const k = edCount(x.id); return `<button class="mapc ${x.id === m.id ? 'on' : ''}" data-a="edmap" data-v="${x.id}"><img src="${x.thumb}" alt="" loading="lazy"><div class="t"><b>${mapNm(x.id)}</b><small>${k ? t('menu.ed.nEdits', { n: k }) : t('menu.ed.original')}</small></div></button>`; }).join('');
    return `${head('editor')}<div class="scroll"><div class="pan"><h3>${t('menu.ed.pick')}</h3><div class="maps">${cards}</div></div>
      <div class="pan"><h3>${mapNm(m.id)}</h3><div class="row"><button class="chip on" data-a="edopen">${t('menu.ed.open')} ›</button>${n ? `<button class="chip" data-a="edclear">${t('menu.ed.clear', { n })}</button>` : ''}</div>
      <div class="hint">${t('menu.ed.hint1')}</div>
      <div class="hint">${t('menu.ed.hint2')}</div></div></div>`;
  }
  const settingsPayload = () => ({ sens: p.sens, fov: p[FOV_KEY], volume: p.volume, vSfx: p.vSfx, vMusic: p.vMusic, vAmb: p.vAmb, rainSound: p.rainSound, shadows: p.shadows, post: p.post ?? !TOUCH, adaptive: p.adaptive !== false, fullscreen: p.fullscreen !== false, pixelRatio: p[Q_KEY] });
  function launchEditor() {
    const payload = {
      editor: true, devMode: true, map: p.edMap, tod: 'day', weather: 'clear', team: 'blue', cls: p.cls, diff: 'normal', optic: p.optic, playerName: p.name,
      match: { perTeam: 1, type: 'dm', time: 900 }, third: false,
      keys: p.keys, leftHand: p.leftHand, adsToggle: p.adsToggle, onPref: patchPrefs, loadout: loadoutOf(p.cls), loadouts: p.loadouts,
      settings: settingsPayload(),
    };
    cleanup();
    onStart(payload);
  }

  // ───── olaylar ─────
  function launch(randomize = false) {
    const pick = (v, list) => (v === 'random' ? rnd(list) : v);
    const okMaps = mapsFor(p.type).map((m) => m.id);
    const map = randomize ? rnd(okMaps) : pick(p.map, okMaps);
    const tod = randomize ? rnd(['day', 'sunset', 'night']) : pick(p.tod, ['day', 'sunset', 'night']);
    const weather = randomize ? rnd(['clear', 'clear', 'rain', 'fog']) : pick(p.weather, ['clear', 'rain', 'fog']);
    const perTeam = randomize ? rnd([4, 6, 8, 10, 12, 16]) : p.perTeam;
    const cls = p.cls;
    const payload = {
      map, tod, weather, team: p.team === 'random' ? rnd(['blue', 'red']) : p.team, cls, diff: p.type === 'inf' ? 'hard' : p.diff, optic: p.optic, playerName: p.name,
      match: { perTeam, type: p.type, tickets: randomize ? undefined : p.tickets || undefined, time: p.time }, third: p.third, devMode: !!p.devMode && !randomize,
      keys: p.keys, leftHand: p.leftHand, adsToggle: p.adsToggle, onPref: patchPrefs,
      loadout: loadoutOf(cls), loadouts: p.loadouts,                    // tüm sınıfların kayıtlı yüklemeleri: oyunda sınıf değişince o sınıfınki gelir
      settings: settingsPayload(),
    };
    cleanup();
    onStart(payload);
  }
  function cleanup() {
    clearInterval(tipTimer); clearTimeout(iconTimer); clearInterval(roomPoll);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keydown', onCap, true);
    offLang();
    music.stop();
    scene?.dispose(); scene = null;
    el.style.display = 'none'; el.innerHTML = '';
  }
  // tuş atama yakalama (Kontroller ekranı): yakalama aşamasında dinler, oyun/menü kısayollarına sızdırmaz
  const onCap = (e) => {
    if (screen !== 'controls' || !ctl.cap) return;
    e.preventDefault(); e.stopPropagation();
    const code = norm(e.code), { id, slot: sl } = ctl.cap, kb = new Binds(p.keys);
    if (code === 'Escape') { ctl = { cap: null, msg: '' }; render(); return; }
    if (code === 'Backspace' || code === 'Delete') { kb.clear(id, sl); p.keys = kb.toJSON(); ctl = { cap: null, msg: t('menu.ct.cleared') }; save(); render(); return; }
    if (RESERVED.has(code)) { ctl.msg = t('menu.ct.reserved'); render(); return; }
    const taken = kb.set(id, sl, code);
    p.keys = kb.toJSON();
    ctl = { cap: null, msg: taken ? t('menu.ct.taken', { k: keyName(code), a: actionLabel(taken) }) : '' };
    save(); render();
  };
  document.addEventListener('keydown', onCap, true);
  const onKey = (e) => { if (e.key === 'Enter' && (screen === 'home' || screen === 'custom') && e.target.tagName !== 'INPUT') launch(); };
  document.addEventListener('keydown', onKey);
  const offLang = onLang(() => { chrome(); render(); });                      // dil değişince menü yerinde yeniden çizilir (ekran / kaydırma korunur)

  stage.addEventListener('input', (e) => {
    const tg = e.target, id = tg.id;
    if (id === 'olCode') { tg.value = tg.value.toUpperCase().replace(/[^A-Z]/g, ''); p.room = tg.value; save(); return; }
    if (id === 'olPw') { ol.pw = tg.value; return; }
    if (id === 'ocName') { oc().name = tg.value; save(); return; }
    if (id === 'ocPw') { ol.cpw = tg.value; return; }
    if (id === 'ocSize') { const v = +tg.value; oc().perTeam = v; tg.style.setProperty('--p', ((v - lo(oc().type)) / (hi(oc().type) - lo(oc().type))) * 100 + '%'); q('#ocSizeV').innerHTML = sizeNum(oc().type, v); stage.querySelectorAll('[data-k=perTeam]').forEach((c) => c.classList.toggle('on', +c.dataset.v === v)); save(); return; }
    if (tg.type !== 'range') return;
    const v = +tg.value, mn = +tg.min, mx = +tg.max;
    tg.style.setProperty('--p', ((v - mn) / (mx - mn)) * 100 + '%');
    if (id === 'rSize') {
      p.perTeam = v; stage.querySelector('#vSize').innerHTML = sizeNum(p.type, v);
      stage.querySelectorAll('[data-a=size]').forEach((c) => c.classList.toggle('on', +c.dataset.v === v));
    } else if (id === 'sSens') { p.sens = v; stage.querySelector('#v_sSens').textContent = (v / 0.0022).toFixed(2) + '×'; }
    else if (id === 'sFov') { p[FOV_KEY] = v; stage.querySelector('#v_sFov').textContent = v + '°'; }
    else if (id === 'sVol') { p.volume = v; stage.querySelector('#v_sVol').textContent = Math.round(v * 100) + '%'; music.setVolume(p.volume * p.vMusic); }
    else if (id === 'sSfx') { p.vSfx = v; stage.querySelector('#v_sSfx').textContent = Math.round(v * 100) + '%'; }
    else if (id === 'sMusic') { p.vMusic = v; stage.querySelector('#v_sMusic').textContent = Math.round(v * 100) + '%'; music.setVolume(p.volume * p.vMusic); }
    else if (id === 'sAmb') { p.vAmb = v; stage.querySelector('#v_sAmb').textContent = Math.round(v * 100) + '%'; }
    save();
  });
  stage.addEventListener('change', (e) => { if (e.target.id === 'rSize' || e.target.id === 'ocSize') render(); });
  stage.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') { e.stopPropagation(); if (e.key === 'Enter' && (e.target.id === 'olCode' || e.target.id === 'olPw')) goOnline('join'); if (e.key === 'Enter' && e.target.id === 'olPwJoin') { const pw = e.target.value; goOnline('join', { code: ol.pwFor?.code, pw }); } } });

  const act = (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a, v = b.dataset.v;
    let adv = null;                                          // kurucuda seçimden sonra bir sonraki adıma kaydır
    switch (a) {
      case 'go': screen = v; break;
      case 'lang': setLang(v); return;                       // onLang → yeniden çizim
      case 'jump': q('#' + v)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return;
      case 'quick': launch(false); return;
      case 'random': launch(true); return;
      case 'map': if (p.map !== v) adv = 'bs3'; p.map = v; break;
      case 'tod': p.tod = v; break;
      case 'weather': p.weather = v; break;
      case 'third': p.third = v === '1'; break;
      case 'devmode': p.devMode = v === '1'; break;
      case 'edmap': p.edMap = v; break;
      case 'edopen': launchEditor(); return;
      case 'edclear': if (confirm(t('menu.ed.confirm', { m: mapNm(p.edMap) }))) { clearEdits(p.edMap); } break;
      case 'type': if (p.type !== v) adv = 'bs2'; p.type = v; if (tot(v)) p.perTeam = Math.max(lo(v), Math.min(hi(v), p.perTeam)); if (v === 'inf') p.map = 'newyork'; else if (v === 'pb') { if (!MAPS[p.map]?.only?.includes('pb') && p.map !== 'random') p.map = 'boyakulesi'; } else if (v === 'payload') p.map = 'maden'; else if (MAPS[p.map]?.only && !MAPS[p.map].only.includes(v)) p.map = DEFAULT_MAP; break;
      case 'team': p.team = v; break;
      case 'diff': p.diff = v; break;
      case 'size': p.perTeam = +v; break;
      case 'tickets': p.tickets = +v; break;
      case 'time': p.time = +v; break;
      case 'oltm': p.olTeam = v; break;
      case 'oview': screen = v; ol = { ...ol, msg: '', err: false }; break;
      case 'olset': {
        const k = b.dataset.k, c = oc();
        if ((k === 'type' || k === 'map') && c[k] !== v) adv = k === 'type' ? 'bs2' : 'bs3';
        c[k] = v === 'true' ? true : v === 'false' ? false : (k === 'perTeam' || k === 'tickets' || k === 'time') ? +v : v;
        if (k === 'type' && tot(v)) c.perTeam = Math.max(lo(v), Math.min(hi(v), c.perTeam));
        if (k === 'type' && v === 'inf') c.map = 'newyork'; else if (k === 'type' && v === 'pb') { if (!MAPS[c.map]?.only?.includes('pb') && c.map !== 'random') c.map = 'boyakulesi'; } else if (k === 'type' && v === 'payload') c.map = 'maden'; else if (k === 'type' && MAPS[c.map]?.only && !MAPS[c.map].only.includes(v)) c.map = DEFAULT_MAP;
        break;
      }
      case 'rjoin': {
        const r = ol.rooms?.find((x) => x.code === b.dataset.code);
        if (b.dataset.locked === '1') { ol = { ...ol, pwFor: { code: b.dataset.code, name: r?.name || '' }, msg: '', err: false }; save(); render(); setTimeout(() => q('#olPwJoin')?.focus(), 30); return; }
        goOnline('join', { code: b.dataset.code, pw: '' }); return;
      }
      case 'rpwgo': goOnline('join', { code: ol.pwFor?.code, pw: q('#olPwJoin')?.value || '' }); return;
      case 'rpwcancel': ol = { ...ol, pwFor: null }; break;
      case 'olcreate': goOnline('create'); return;
      case 'oljoin': goOnline('join'); return;
      case 'cls': p.cls = v; slot = 'primary'; break;
      case 'slot': slot = v; break;
      case 'pick': loadoutOf(p.cls)[slot] = v; break;
      case 'optic': p.optic = v; scene?.iconCache.clear(); break;
      case 'quality': p[Q_KEY] = +v; break;
      case 'shadows': p.shadows = !p.shadows; break;
      case 'adaptive': p.adaptive = p.adaptive === false; break;
      case 'post': p.post = !(p.post ?? !TOUCH); break;
      case 'fullscreen': p.fullscreen = p.fullscreen === false; break;
      case 'rain': p.rainSound = !p.rainSound; break;
      case 'hand': p.leftHand = v === 'left'; break;
      case 'ads': p.adsToggle = v === 'toggle'; break;
      case 'kbind': ctl = { cap: { id: b.dataset.id, slot: +b.dataset.slot }, msg: '' }; break;
      case 'kreset': p.keys = {}; ctl = { cap: null, msg: t('menu.ct.resetDone') }; break;
      case 'reset': if (confirm(t('menu.set.resetQ'))) { p.xp = 0; p.stats = { ...DEFAULTS.stats }; } break;
      default: return;
    }
    save(); render();
    if (adv) setTimeout(() => q('#' + adv)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  };
  stage.addEventListener('click', act);
  nav.addEventListener('click', act);
  q('#mnLangs').addEventListener('click', act);

  render();
  scene?.prefetch([...new Set([DEFAULT_MAP, ...Object.values(MAPS).filter((m) => m.only).map((m) => mapsFor(m.only[0])[0].id)])]);   // mod değişiminin zorladığı haritalar boşta hazırlanır (modun ilk haritası: New York, Boya Kulesi)
  music.setVolume((p.volume ?? 0.6) * (p.vMusic ?? 0.5));
  music.play('lobby');                       // lobi müziği (public/audio/music/lobby.mp3 varsa)
}
