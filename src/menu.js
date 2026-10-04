import { MAPS, DEFAULT_MAP } from './maps/index.js';
import { CLASS_DEFS, WSTATS, DIFFICULTY, OPTICS, OPTIC_ORDER } from './game/stats.js';
import { MATCH_TYPES, TODS_LIST, defaultTickets, defaultScoreLimit, DM_MAX, DM_KILLS, isTotalType as tot, totalMin as totMin, totalMax as totMax, INF_MAX } from './game/match.js';
import { MENU_CSS } from './menuStyle.js';
import { MenuScene } from './menuScene.js';
import { WEATHERS } from './game/weather.js';
import { NetClient } from './net/client.js';
import { defaultServerUrl, healthUrl } from './net/protocol.js';
import { Binds, ACTIONS, GROUPS, codeLabel, RESERVED, norm } from './core/keybinds.js';
import { music } from './game/music.js';

const KEY = 'warbyte.v2';
export const DEFAULTS = {
  map: DEFAULT_MAP, tod: 'day', weather: 'clear', type: 'conquest', perTeam: 10, tickets: 0, time: 900,
  team: 'blue', cls: 'assault', diff: 'normal', optic: 'reddot', loadouts: {}, name: 'Sen',
  sens: 0.0022, fov: 75, volume: 0.6, shadows: true, quality: 1.5,
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

const TIPS = [
  'İpucu: Bayrağın çevresinde kal; yanında sıhhiye varsa canın yenilenir.',
  'İpucu: Gece ya da gün batımında <b>F</b> ile fenerini aç.',
  'İpucu: Keskin nişancılar uzak bayrakları gören yüksek noktalara yerleşir.',
  'İpucu: Düşman üssüne girersen birkaç saniye sonra can kaybedersin.',
  'İpucu: Ele geçirdiğin bayrakta yeniden doğabilirsin.',
  'İpucu: <b>Q</b> / <b>E</b> ile köşeden eğilerek ateş et.',
  'İpucu: Dumanlı bomba görüşü keser; bot ve oyuncular dumanın içini göremez.',
];
const NEWS = [
  'Özel oyun: takım başına 1–32 oyuncu',
  'Gece, gün batımı ve gündüz seçenekleri',
  'Sınıf başına silah ve gadget seçimi',
  'Yeni haritalar: Vadi ve Askeri Üs',
  '32 silah: yeni tüfekler, SMG, DMR, .50, mayın, duman, flaşbang',
  'Daha hızlı şarjör değiştirme, yeni bıçak kombosu',
  'Mangal tabanlı bot stratejisi, ileri doğma noktaları',
];
const SIZE_PRESETS = [[1, '1v1'], [3, '3v3'], [5, '5v5'], [10, '10v10'], [16, '16v16'], [24, '24v24'], [32, '32v32']];
const TIME_OPTS = [[300, '5 dk'], [600, '10 dk'], [900, '15 dk'], [1200, '20 dk'], [1800, '30 dk'], [0, '∞']];
const TICKET_OPTS = [[0, 'Otomatik'], [50, '50'], [100, '100'], [200, '200'], [400, '400'], [800, '800']];
// oyuncu sayısı 'toplam' olan modlarda (Ölüm Maçı, Enfekte) alt/üst sınır ve hızlı seçimler
const lo = (t) => (tot(t) ? totMin(t) : 1), hi = (t) => (tot(t) ? totMax(t) : 32);
const TOT_PRESETS = { dm: [[2, '2'], [4, '4'], [6, '6'], [8, '8'], [10, '10']], inf: [[6, '6'], [8, '8'], [12, '12'], [16, '16'], [24, '24']] };
const totTx = (t, n) => (t === 'inf' ? `${n} savaşçı: ${Math.max(1, Math.round(n / 8))} ilk zombi, kalanı insan. Zombi öldürdüğü insanı enfekte eder.` : `${n} savaşçı, herkes tek. İlk ${DM_KILLS} öldürmeye ulaşan kazanır.`);
const SCORE_OPTS = [[0, 'Otomatik'], [30, '30'], [50, '50'], [75, '75'], [100, '100'], [150, '150'], [200, '200']];
const SLOTS = [['primary', 'Ana silah', 'primaryOptions'], ['secondary', 'Yedek', 'secondaryOptions'], ['gadget', 'Gadget', 'gadgetOptions'], ['melee', 'Yakın dövüş', 'meleeOptions']];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

function weaponBars(id) {
  const st = WSTATS[id] || {};
  if (st.stats) return st.stats;
  const r = st.range ? st.range[1] : 40;
  return { dmg: Math.min(100, Math.round((st.dmg || 20) * (st.pellets || 1) / 1.3)), range: Math.min(100, Math.round(r / 1.6)), rate: Math.min(100, Math.round((st.rpm || 300) / 9)), control: 60, mobility: Math.round(((st.move || 1) - 0.8) * 250) };
}
const STAT_LABEL = { dmg: 'Hasar', range: 'Menzil', rate: 'Atış hızı', control: 'Kontrol', mobility: 'Hareket' };

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
    <div class="mn-top"><div class="mn-logo">WAR<b>BYTE</b><small>TAKIM SAVAŞI · TARAYICIDA</small></div><div class="mn-user" id="mnUser"></div></div>
    <nav class="mn-side" id="mnNav"></nav>
    <main class="mn-stage" id="mnStage"></main>
    <div class="mn-foot"><span id="mnTip"></span><span>WARBYTE v2.0 · yerel ve çevrimiçi, botlu</span></div>`;
  const q = (s) => el.querySelector(s);
  const stage = q('#mnStage'), nav = q('#mnNav');
  let scene = null;
  try { scene = new MenuScene(q('#mnBg')); } catch (e) { console.warn('menü sahnesi açılamadı', e); }
  let screen = 'home', slot = 'primary';
  let ol = { msg: '', err: false, busy: false, rooms: null, pwFor: null, pw: '', cpw: '' }, olChk = 0;
  let tipI = Math.floor(Math.random() * TIPS.length);
  const tipTimer = setInterval(() => { tipI = (tipI + 1) % TIPS.length; q('#mnTip').innerHTML = TIPS[tipI]; }, 7000);
  q('#mnTip').innerHTML = TIPS[tipI];

  const NAV = [['home', 'Ana Menü', 'Hızlı başla'], ['custom', 'Özel Oyun', 'Harita · mod · boyut'], ['online', 'Çevrimiçi', 'Oda kur · katıl'], ['loadout', 'Sınıf & Silah', 'Teçhizatını seç'], ['settings', 'Ayarlar', 'Ses · görüntü · fare'], ['controls', 'Kontroller', 'Tuş haritası']];
  const save = () => savePrefs(p);
  const effTickets = () => p.tickets || (p.type === 'tdm' ? defaultScoreLimit(p.perTeam) : defaultTickets(p.perTeam));
  const mapName = () => (p.map === 'random' ? 'Rastgele' : MAPS[p.map].name);
  const todName = () => (p.tod === 'random' ? 'Rastgele' : TODS_LIST.find((t) => t[0] === p.tod)[1]);
  const loadoutOf = (cls) => p.loadouts[cls] || (p.loadouts[cls] = {});

  function bg() {
    if (!scene) return;
    const m = p.map === 'random' ? (scene.mapId || DEFAULT_MAP) : p.map;
    const t = p.tod === 'random' ? (scene.tod || 'day') : p.tod;
    if (screen === 'loadout') {
      scene.setMode('showroom');
      scene.showCharacter({ team: p.team === 'red' ? 'red' : 'blue', cls: p.cls, weapon: loadoutOf(p.cls).primary || null, optic: p.optic });
    } else { scene.setMode('orbit'); scene.setWorld(m, t); }
    q('.mn-vig').className = 'mn-vig' + (screen === 'loadout' ? ' light' : '');
  }

  function renderUser() {
    const lv = levelOf(p.xp), lo = (lv - 1) ** 2 * 120, hi = lv ** 2 * 120;
    const s = p.stats;
    q('#mnUser').innerHTML = `<div class="mn-lv">${lv}</div><div><div class="nm"><input id="mnName" maxlength="14" value="${p.name.replace(/"/g, '')}" spellcheck="false"></div>
      <div class="xp"><i style="width:${Math.round(((p.xp - lo) / (hi - lo)) * 100)}%"></i></div>
      <small>${s.matches} MAÇ · ${s.wins} ZAFER · K/D ${s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills}</small></div>`;
    q('#mnName').addEventListener('input', (e) => { p.name = e.target.value.trim() || 'Sen'; save(); });
    q('#mnName').addEventListener('keydown', (e) => e.stopPropagation());
  }

  function renderNav() {
    nav.innerHTML = NAV.map(([k, t, s]) => `<button class="mn-nav ${screen === k || (k === 'online' && screen === 'ocreate') ? 'on' : ''}" data-a="go" data-v="${k}">${t}<small>${s}</small></button>`).join('')
      + '<div class="mn-spacer"></div>';
  }

  // ───── ekranlar ─────
  const summary = () => `<div class="sumline"><span><b>${mapName()}</b></span><span>${todName()}${p.weather !== 'clear' ? ' · ' + (p.weather === 'random' ? 'Rastgele hava' : WEATHERS.find((w) => w[0] === p.weather)[1]) : ''}</span><span>${MATCH_TYPES[p.type].label}</span>${tot(p.type) ? `<span><b>${p.perTeam}</b> oyuncu</span>` : `<span><b>${p.perTeam}</b> v <b>${p.perTeam}</b></span>`}<span>${DIFFICULTY[p.diff].label}</span></div>`;

  function homeHTML() {
    return `<div class="home"><div class="news"><h3>YENİLİKLER · v2.0</h3><ul>${NEWS.map((n) => `<li>${n}</li>`).join('')}</ul></div>
      ${summary()}
      <div class="cta"><button class="play" data-a="quick">Hızlı Oyun<small>Son ayarlarınla hemen başla · Enter</small></button>
      <button class="play sec" data-a="random">🎲 Rastgele maç</button><button class="play sec" data-a="go" data-v="custom">Özel oyun ›</button></div></div>`;
  }

  function customHTML() {
    const mapCards = Object.values(MAPS).map((m) => `<button class="mapc ${p.map === m.id ? 'on' : ''}" data-a="map" data-v="${m.id}"><img src="${m.thumb}" alt=""><div class="t"><b>${m.name}</b><small>${m.tag}</small></div></button>`).join('')
      + `<button class="mapc rnd ${p.map === 'random' ? 'on' : ''}" data-a="map" data-v="random">🎲<div class="t"><b>Rastgele</b></div></button>`;
    const desc = p.map === 'random' ? 'Her maçta farklı bir harita seçilir.' : `<b>${MAPS[p.map].name}.</b> ${MAPS[p.map].desc}`;
    const warn = p.perTeam > 20 ? '<span class="warn">Çok oyunculu maçlar güçlü bilgisayar ister; takılırsa sayıyı azalt.</span>' : '';
    const tods = [...TODS_LIST.map(([k, n]) => `<button class="tod ${k} ${p.tod === k ? 'on' : ''}" data-a="tod" data-v="${k}"><span>${n}</span></button>`), `<button class="tod rnd ${p.tod === 'random' ? 'on' : ''}" data-a="tod" data-v="random"><span>🎲 Rastgele</span></button>`].join('');
    return `<div class="scroll">
      <div class="pan"><h3>Harita</h3><div class="maps">${mapCards}</div><div class="mapdesc">${desc}</div></div>
      <div class="pan"><h3>Günün saati</h3><div class="tods">${tods}</div></div>
      <div class="pan"><h3>Hava durumu</h3><div class="row">${[...WEATHERS, ['random', 'Rastgele']].map(([k, n]) => `<button class="chip ${p.weather === k ? 'on' : ''}" data-a="weather" data-v="${k}">${n}</button>`).join('')}</div></div>
      <div class="pan"><h3>3. şahıs kamera <em>oyunda H ile aç/kapat · Q / E omuz değiştirir</em></h3><div class="row">${[[true, 'Açık'], [false, 'Kapalı']].map(([v, l]) => `<button class="chip ${p.third === v ? 'on' : ''}" data-a="third" data-v="${v ? 1 : 0}">${l}</button>`).join('')}</div></div>
      <div class="split">
        <div class="pan"><h3>Oyun modu</h3><div class="row">${Object.entries(MATCH_TYPES).map(([k, m]) => `<button class="chip ${p.type === k ? 'on' : ''}" data-a="type" data-v="${k}">${m.label}<small>${m.desc}</small></button>`).join('')}</div></div>
        <div class="pan">${tot(p.type) ? '' : `<h3>Takımın</h3><div class="row">${[['blue', 'Mavi', 'blue'], ['red', 'Kırmızı', 'red'], ['random', 'Rastgele', '']].map(([k, n, c]) => `<button class="chip ${c} ${p.team === k ? 'on' : ''}" data-a="team" data-v="${k}">${n}</button>`).join('')}</div>
        `}<h3 style="margin-top:14px">Bot zorluğu</h3><div class="row">${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="chip ${p.diff === k ? 'on' : ''}" data-a="diff" data-v="${k}">${d.label}</button>`).join('')}</div></div>
      </div>
      <div class="pan"><h3>Oyuncu sayısı <em>${tot(p.type) ? `toplam, sen dahil · en çok ${hi(p.type)} · kalanı botlar` : 'takım başına, sen dahil · kalanı botlar'}</em></h3>
        <div class="big"><div class="n" id="vSize">${tot(p.type) ? `${p.perTeam}<i>kişi</i>` : `${p.perTeam}<i>vs</i>${p.perTeam}`}</div><div class="tx">${tot(p.type) ? totTx(p.type, p.perTeam) : `${p.perTeam * 2} savaşçı. ${warn}`}</div></div>
        <input type="range" id="rSize" min="${lo(p.type)}" max="${hi(p.type)}" step="${p.type === 'inf' ? 2 : 1}" value="${p.perTeam}" style="--p:${((p.perTeam - lo(p.type)) / ((hi(p.type)) - lo(p.type))) * 100}%">
        <div class="row">${(tot(p.type) ? TOT_PRESETS[p.type] : SIZE_PRESETS).map(([n, l]) => `<button class="chip ${p.perTeam === n ? 'on' : ''}" data-a="size" data-v="${n}">${l}</button>`).join('')}</div></div>
      <div class="split">
        <div class="pan"><h3>${p.type === 'inf' ? 'Hayatta kalma' : p.type === 'dm' ? 'Öldürme sınırı' : `${p.type === 'tdm' ? 'Skor sınırı' : 'Bilet'} <em>${effTickets()}</em>`}</h3>${p.type === 'inf' ? `<div class="hint" style="margin:0">Süre dolana kadar hayatta kalan insanlar kazanır; son insan enfekte olursa zombiler. Süreyi sağdan seç.</div>` : p.type === 'dm' ? `<div class="hint" style="margin:0">İlk <b>${DM_KILLS}</b> öldürmeye ulaşan kazanır; süre dolarsa en çok öldüren.</div>` : `<div class="row">${(p.type === 'tdm' ? SCORE_OPTS : TICKET_OPTS).map(([v, l]) => `<button class="chip ${p.tickets === v ? 'on' : ''}" data-a="tickets" data-v="${v}">${l}</button>`).join('')}</div>`}</div>
        <div class="pan"><h3>Süre</h3><div class="row">${TIME_OPTS.map(([v, l]) => `<button class="chip ${p.time === v ? 'on' : ''}" data-a="time" data-v="${v}">${l}</button>`).join('')}</div></div>
      </div></div>
      <div class="startbar">${summary()}<button class="play" data-a="quick" style="min-width:300px">Oyna</button></div>`;
  }

  const OLCFG0 = { name: '', listed: true, map: 'kasaba', tod: 'day', weather: 'clear', type: 'conquest', perTeam: 5, bots: true, diff: 'normal', tickets: 0, time: 900, third: false };
  const oc = () => (p.olCfg = { ...OLCFG0, ...(p.olCfg || {}) });
  const esc = (t) => String(t ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  const TODN = Object.fromEntries(TODS_LIST), WEAN = Object.fromEntries(WEATHERS);

  function roomCard(r) {
    const m = MAPS[r.map] || { name: r.map, thumb: '' }, t = MATCH_TYPES[r.type]?.label || r.type;
    const full = r.humans >= r.cap, tl = r.tl >= 0 ? ` · ${Math.floor(r.tl / 60)}:${String(r.tl % 60).padStart(2, '0')}` : '';
    const sub = `${m.name} · ${TODN[r.tod] || r.tod}${r.weather !== 'clear' ? ' · ' + (WEAN[r.weather] || r.weather) : ''}`;
    return `<div class="rcard ${r.official ? 'off' : ''}"><div class="th" style="background-image:url(${m.thumb})"></div>
      <div class="rb"><div class="rt">${r.official ? '<em class="bd">RESMİ</em>' : ''}${r.locked ? '<em class="lk" title="Şifreli">🔒</em>' : ''}<b>${esc(r.name)}</b></div>
      <div class="rs">${sub}</div><div class="rs">${t} · ${tot(r.type) ? r.perTeam + ' oyuncu' : r.perTeam + 'v' + r.perTeam}${r.bots ? ' · botlu' : ' · botsuz'}${r.third ? ' · 3. şahıs' : ''}${tl}</div>${r.by ? `<div class="rs by">kuran: ${esc(r.by)}</div>` : ''}</div>
      <div class="rp"><div class="pc ${full ? 'full' : ''}"><b>${r.humans}</b>/${r.cap}<small>oyuncu</small></div>
      <button class="chip join" data-a="rjoin" data-code="${r.code}" data-locked="${r.locked ? 1 : 0}" ${ol.busy || full || r.ended ? 'disabled' : ''}>${r.ended ? 'Bitti' : full ? 'Dolu' : 'Katıl'}</button></div></div>`;
  }
  function roomListHTML() {
    if (!ol.rooms) return '<div class="hint">Oda listesi yükleniyor…</div>';
    const off = ol.rooms.filter((r) => r.official), usr = ol.rooms.filter((r) => !r.official);
    return `<h3 class="sub">Resmi sunucular <em>7/24 açık · hep bot destekli · harita sırayla döner</em></h3><div class="rgrid">${off.map(roomCard).join('') || '<div class="hint">Resmi oda yok.</div>'}</div>
      <h3 class="sub" style="margin-top:16px">Oyuncu odaları <em>${usr.length} oda</em></h3><div class="rgrid">${usr.map(roomCard).join('') || '<div class="hint">Şu an açık oda yok. İlk odayı sen kur!</div>'}</div>`;
  }
  function pwPromptHTML() {
    if (!ol.pwFor) return '';
    return `<div class="pan pwp"><h3>Şifreli oda <em>${esc(ol.pwFor.name)}</em></h3><div class="row"><input class="olin" id="olPwJoin" type="password" maxlength="16" placeholder="Oda şifresi" autocomplete="off" style="flex:1">
      <button class="chip on" data-a="rpwgo">Katıl</button><button class="chip" data-a="rpwcancel">Vazgeç</button></div></div>`;
  }
  function onlineHTML() {
    const tm = [['auto', 'Otomatik', ''], ['blue', 'Mavi', 'blue'], ['red', 'Kırmızı', 'red']].map(([k, n, c]) => `<button class="chip ${c} ${p.olTeam === k ? 'on' : ''}" data-a="oltm" data-v="${k}">${n}</button>`).join('');
    const msg = ol.msg ? `<div class="olmsg ${ol.err ? 'err' : ''}">${ol.msg}</div>` : '';
    const dis = ol.busy ? 'disabled' : '';
    return `<div class="scroll">${msg}${pwPromptHTML()}
      <div class="pan"><h3>Odalar <em id="olStat">kontrol ediliyor…</em></h3><div id="olRooms">${roomListHTML()}</div></div>
      <div class="split">
        <div class="pan"><h3>Oda kur</h3><div class="hint" style="margin:0 0 12px">Kendi odanı kur: ad, şifre, harita, mod, bot ve daha fazlasını sen seçersin.</div>
          <button class="play" data-a="oview" data-v="ocreate" ${dis} style="width:100%">+ Oda kur<small>Ayarları seç, kodu arkadaşlarına ver</small></button></div>
        <div class="pan"><h3>Kodla katıl</h3>
          <input class="olin code" id="olCode" maxlength="4" placeholder="KOD" value="${esc(p.room || '')}" spellcheck="false" autocomplete="off">
          <input class="olin" id="olPw" type="password" maxlength="16" placeholder="Şifre (varsa)" autocomplete="off" style="margin-top:8px">
          <button class="play sec" data-a="oljoin" ${dis} style="margin-top:10px;width:100%">Katıl</button></div>
      </div>
      <div class="pan"><h3>Takım</h3><div class="row">${tm}</div>
        <div class="hint">Takım seçmezsen sunucu dengeler. Oyunda <kbd>M</kbd> ile takım değiştirebilirsin. Sınıf ve silahın "Sınıf &amp; Silah" ekranından, takma adın sol üstten gelir.</div></div></div>`;
  }
  function ocreateHTML() {
    const c = oc();
    const chips = (k, list) => list.map(([v, l, sm]) => `<button class="chip ${c[k] === v ? 'on' : ''}" data-a="olset" data-k="${k}" data-v="${v}">${l}${sm ? `<small>${sm}</small>` : ''}</button>`).join('');
    const maps = Object.values(MAPS).map((m) => `<button class="mapc ${c.map === m.id ? 'on' : ''}" data-a="olset" data-k="map" data-v="${m.id}"><img src="${m.thumb}" alt=""><div class="t"><b>${m.name}</b><small>${m.tag}</small></div></button>`).join('');
    const msg = ol.msg ? `<div class="olmsg ${ol.err ? 'err' : ''}">${ol.msg}</div>` : '';
    return `<div class="scroll">${msg}
      <div class="pan"><h3>Oda bilgileri</h3>
        <div class="split"><div><label class="lb">Oda adı</label><input class="olin" id="ocName" maxlength="24" placeholder="${esc(p.name)}'in odası" value="${esc(c.name)}" spellcheck="false" autocomplete="off"></div>
        <div><label class="lb">Şifre <em>boş bırakırsan herkes girebilir</em></label><input class="olin" id="ocPw" type="password" maxlength="16" placeholder="Şifre (isteğe bağlı)" value="${esc(ol.cpw || '')}" autocomplete="off"></div></div>
        <div style="margin-top:12px"><label class="lb">Görünürlük</label><div class="row">${chips('listed', [[true, 'Herkese açık', 'oda listesinde görünür'], [false, 'Gizli', 'yalnızca kodu bilenler']])}</div></div></div>
      <div class="pan"><h3>Harita</h3><div class="maps">${maps}</div></div>
      <div class="split"><div class="pan"><h3>Günün saati</h3><div class="row">${chips('tod', TODS_LIST.map(([k, n]) => [k, n]))}</div></div>
        <div class="pan"><h3>Hava durumu</h3><div class="row">${chips('weather', WEATHERS.map(([k, n]) => [k, n]))}</div></div></div>
      <div class="pan"><h3>Oyun modu</h3><div class="row">${chips('type', Object.entries(MATCH_TYPES).map(([k, m]) => [k, m.label, m.desc]))}</div></div>
<div class="pan"><h3>Oyuncu sayısı <em>${tot(c.type) ? `toplam · en fazla ${hi(c.type)} kişi` : `takım başına · en fazla ${c.perTeam * 2} kişi`}</em></h3>
        <div class="big"><div class="n" id="ocSizeV">${tot(c.type) ? `${c.perTeam}<i>kişi</i>` : `${c.perTeam}<i>vs</i>${c.perTeam}`}</div><div class="tx">${c.bots ? 'Boş yerleri botlar doldurur; oyuncu girince bir bot azalır.' : 'Botsuz: yalnızca gerçek oyuncular.'}</div></div>
        <input type="range" id="ocSize" min="${lo(c.type)}" max="${hi(c.type)}" step="${c.type === 'inf' ? 2 : 1}" value="${c.perTeam}" style="--p:${((c.perTeam - lo(c.type)) / ((hi(c.type)) - lo(c.type))) * 100}%">
        <div class="row">${(tot(c.type) ? TOT_PRESETS[c.type] : SIZE_PRESETS).map(([n, l]) => `<button class="chip ${c.perTeam === n ? 'on' : ''}" data-a="olset" data-k="perTeam" data-v="${n}">${l}</button>`).join('')}</div></div>
      <div class="pan"><h3>3. şahıs kamera <em>oyuncular H ile geçebilir · Q / E omuz değiştirir</em></h3><div class="row">${chips('third', [[true, 'Açık', 'omuz üstü kamera serbest'], [false, 'Kapalı', 'yalnızca 1. şahıs']])}</div></div>
      <div class="split"><div class="pan"><h3>Botlar</h3><div class="row">${chips('bots', [[true, 'Açık', 'boş slotlara bot'], [false, 'Kapalı', 'yalnızca oyuncular']])}</div>
        ${c.bots ? `<h3 style="margin-top:14px">Bot zorluğu</h3><div class="row">${chips('diff', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]))}</div>` : ''}</div>
        <div class="pan"><h3>${c.type === 'inf' ? 'Hayatta kalma' : c.type === 'dm' ? 'Öldürme sınırı' : `${c.type === 'tdm' ? 'Skor sınırı' : 'Bilet'} <em>${c.tickets || (c.type === 'tdm' ? defaultScoreLimit(c.perTeam) : defaultTickets(c.perTeam))}</em>`}</h3>${c.type === 'inf' ? `<div class="hint" style="margin:0 0 6px">Süre dolana kadar hayatta kalan insanlar kazanır; zombiler tüm insanları enfekte ederse onlar.</div>` : c.type === 'dm' ? `<div class="hint" style="margin:0 0 6px">İlk <b>${DM_KILLS}</b> öldürmeye ulaşan kazanır.</div>` : `<div class="row">${chips('tickets', c.type === 'tdm' ? SCORE_OPTS : TICKET_OPTS)}</div>`}
        <h3 style="margin-top:14px">Süre</h3><div class="row">${chips('time', TIME_OPTS)}</div></div></div>
      </div>
      <div class="startbar"><button class="chip" data-a="oview" data-v="online">‹ Geri</button><button class="play" data-a="olcreate" ${ol.busy ? 'disabled' : ''} style="min-width:300px">Odayı oluştur</button></div>`;
  }

  // Sunucu durumu + oda listesi (menü çevrimiçi ekranındayken 2,5 sn'de bir)
  const httpBase = () => healthUrl(p.server || defaultServerUrl()).replace(/\/health$/, '');
  async function checkServer() {
    const my = ++olChk;
    if (!q('#olStat')) return;
    const set = (cls, t) => { const e = q('#olStat'); if (e && my === olChk) { e.className = cls; e.textContent = t; } };
    try {
      const c = new AbortController(), tm = setTimeout(() => c.abort(), 2500);
      const r = await fetch(httpBase() + '/rooms', { signal: c.signal, cache: 'no-store' });
      clearTimeout(tm);
      ol.rooms = await r.json();
      const n = ol.rooms.reduce((a, x) => a + x.humans, 0);
      set('ok', `● hazır · ${n} oyuncu çevrimiçi`);
      const box = q('#olRooms'); if (box && !ol.busy) box.innerHTML = roomListHTML();
    } catch (e) { ol.rooms = null; set('bad', '● sunucuya ulaşılamıyor'); const box = q('#olRooms'); if (box) box.innerHTML = '<div class="hint">Sunucuya ulaşılamıyor. Sunucunun çalıştığından emin ol.</div>'; }
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
      if (code.length !== 4) { ol = { ...ol, msg: '4 harfli oda kodunu gir.', err: true, busy: false }; render(); return; }
      pw = o.pw ?? ol.pw ?? '';
      hello = { t: 'join', room: code, name, cls, loadout, team, pw };
    }
    ol = { ...ol, msg: 'Bağlanılıyor…', err: false, busy: true, pwFor: null }; render();
    try {
      const r = await NetClient.connect(url, hello);
      cleanup();
      onOnline?.({ net: r.net, welcome: r.welcome, name, pw });
    } catch (e) { ol = { ...ol, msg: e.message, err: true, busy: false }; render(); }
  }

  function loadoutHTML() {
    const def = CLASS_DEFS[p.cls], lo = loadoutOf(p.cls), team = p.team === 'red' ? 'red' : 'blue';
    const cur = (k) => {
      const opts = def[SLOTS.find((s) => s[0] === k)[2]] || [];
      const want = lo[k];
      if (want && opts.includes(want)) return want;
      const d = def.defaults?.[k];
      return typeof d === 'object' ? d[team] || d.blue : d;
    };
    const icon = (id) => (scene ? `<img data-icon="${id}" ${scene.iconCache.get(id + '|' + p.optic) ? `src="${scene.iconCache.get(id + '|' + p.optic)}"` : ''} alt="">` : '');
    const opts = def[SLOTS.find((s) => s[0] === slot)[2]] || [];
    const sel = cur(slot);
    const tabs = Object.entries(CLASS_DEFS).map(([k, d]) => `<button class="tab ${p.cls === k ? 'on' : ''}" data-a="cls" data-v="${k}">${d.label}</button>`).join('');
    const slotBtns = SLOTS.map(([k, n]) => `<button class="slotb ${slot === k ? 'on' : ''}" data-a="slot" data-v="${k}"><small>${n}</small><b>${WSTATS[cur(k)]?.name || '—'}</b>${icon(cur(k))}</button>`).join('');
    const grid = opts.map((id) => {
      const st = WSTATS[id] || {}, b = weaponBars(id);
      const mini = st.kind === 'gun' || st.kind === 'launcher' || st.kind === 'melee' ? ['dmg', 'range', 'rate'].map((k) => `<span>${STAT_LABEL[k]}</span><div class="bar"><i style="width:${Math.max(4, Math.min(100, b[k] || 0))}%"></i></div>`).join('') : '';
      return `<button class="wc ${sel === id ? 'on' : ''}" data-a="pick" data-v="${id}">${icon(id)}<b>${st.name || id}</b><div class="mini">${mini}</div></button>`;
    }).join('');
    const st = WSTATS[sel] || {}, b = weaponBars(sel);
    const utility = !(b.dmg || b.range);
    const stats = utility ? '' : ['dmg', 'range', 'rate', 'control', 'mobility'].map((k) => `<div class="stat"><span>${STAT_LABEL[k]}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, b[k] || 0))}%"></i></div><em>${Math.round(b[k] || 0)}</em></div>`).join('');
    const optics = slot === 'primary' && !(WSTATS[sel] && WSTATS[sel].scope) ? `<div class="pan"><h3>Nişangâh <em>oyunda B ile değiştir</em></h3><div class="row">${OPTIC_ORDER.map((k) => `<button class="chip ${p.optic === k ? 'on' : ''}" data-a="optic" data-v="${k}">${OPTICS[k].label}</button>`).join('')}</div></div>` : '';
    return `<div class="tabs">${tabs}</div><div class="scroll"><div class="slots">${slotBtns}</div>
      <div class="pan"><h3>${SLOTS.find((s) => s[0] === slot)[1]} <em>${def.label}</em></h3><div class="wgrid">${grid}</div></div>
      <div class="pan"><h3>${st.name || ''}</h3>${stats}<div class="wdesc">${st.desc || def.desc}</div></div>${optics}</div>`;
  }

  function settingsHTML() {
    const sl = (id, label, min, max, step, v, fmt) => `<div class="setrow"><span>${label}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}" style="--p:${((v - min) / (max - min)) * 100}%"><em id="v_${id}">${fmt(v)}</em></div>`;
    return `<div class="scroll"><div class="pan"><h3>Fare ve görüş</h3>
      ${sl('sSens', 'Hassasiyet', 0.0008, 0.006, 0.0001, p.sens, (x) => (x / 0.0022).toFixed(2) + '×')}
      ${sl('sFov', 'Görüş açısı', 60, 100, 1, p.fov, (x) => x + '°')}</div>
      <div class="pan"><h3>Ses</h3>${sl('sVol', 'Ana ses', 0, 1, 0.05, p.volume, (x) => Math.round(x * 100) + '%')}
      ${sl('sSfx', 'Efekt sesleri', 0, 1, 0.05, p.vSfx, (x) => Math.round(x * 100) + '%')}
      ${sl('sMusic', 'Müzik', 0, 1, 0.05, p.vMusic, (x) => Math.round(x * 100) + '%')}
      ${sl('sAmb', 'Ortam (yağmur, rüzgâr)', 0, 1, 0.05, p.vAmb, (x) => Math.round(x * 100) + '%')}
      <div class="row" style="margin-top:8px"><button class="chip ${p.rainSound ? 'on' : ''}" data-a="rain" data-v="1">Yağmur sesi: ${p.rainSound ? 'Açık' : 'Kapalı'}</button></div>
      <div class="hint">Lobi ve maç müziği için dosyalar henüz yok; <b>public/audio/music/</b> altına eklenince otomatik çalar (bkz. OYUN.md).</div></div>
      <div class="pan"><h3>Grafik</h3><div class="row">${[[1, 'Düşük'], [1.5, 'Orta'], [2, 'Yüksek']].map(([v, l]) => `<button class="chip ${p.quality === v ? 'on' : ''}" data-a="quality" data-v="${v}">${l}</button>`).join('')}
      <button class="chip ${p.shadows ? 'on' : ''}" data-a="shadows" data-v="1">Gölgeler: ${p.shadows ? 'Açık' : 'Kapalı'}</button></div>
      <div class="hint">Düşük kalite ve kapalı gölge, zayıf bilgisayarlarda ve büyük maçlarda akıcılığı artırır.</div></div>
      <div class="pan"><h3>Veri</h3><button class="chip" data-a="reset">İlerlemeyi sıfırla</button></div></div>`;
  }

  let ctl = { cap: null, msg: '' };             // Kontroller ekranı: tuş atama durumu
  function controlsHTML() {
    const kb = new Binds(p.keys), cap = ctl.cap;
    const handKey = codeLabel(kb.codes('leftHand')[0]);
    const groups = GROUPS.map((g, gi) => `<div class="pan"><h3>${g}</h3>${ACTIONS.filter((a) => a.group === gi).map((a) => `<div class="kbrow"><span>${a.label}</span><div>${[0, 1].map((sl) => {
      const on = cap && cap.id === a.id && cap.slot === sl;
      return `<button class="kbk ${on ? 'cap' : ''}" data-a="kbind" data-id="${a.id}" data-slot="${sl}" title="Tıkla, sonra yeni tuşa bas · Geri tuşu: temizle · Esc: vazgeç">${on ? 'Tuşa bas…' : codeLabel(kb.codes(a.id)[sl])}</button>`;
    }).join('')}</div></div>`).join('')}</div>`).join('');
    const fixed = [
      ['Ateş / Nişan', 'Sol tık / Sağ tık (basılı tut) — sabit'],
      ['Silah değiştir', 'Fare tekeri · yuva tuşları yukarıdan değişir'],
      ['Duraklat', '<kbd>Esc</kbd> · menüde <b>Kill (yeniden doğ)</b> düğmesi'],
      ['Bakış (yedek)', 'Fare kilitlenmezse ok tuşları'],
    ];
    return `<div class="scroll">
      <div class="pan"><h3>Silahı tutan el</h3><div class="row"><button class="chip ${p.leftHand ? '' : 'on'}" data-a="hand" data-v="right">Sağ el</button><button class="chip ${p.leftHand ? 'on' : ''}" data-a="hand" data-v="left">Sol el</button></div>
      <div class="hint">Birinci şahıs silah modeli aynalanır. Oyunda <kbd>${handKey}</kbd> tuşuyla anında değiştirilebilir.</div></div>
      <div class="pan"><h3>Nişan alma (sağ tık)</h3><div class="row"><button class="chip ${p.adsToggle ? '' : 'on'}" data-a="ads" data-v="hold">Basılı tut</button><button class="chip ${p.adsToggle ? 'on' : ''}" data-a="ads" data-v="toggle">Bir kez bas (aç-kapa)</button></div>
      <div class="hint">Aç-kapa seçilirse sağ tıkla nişan açılır, tekrar sağ tıkla kapanır; koşmak ve silah değiştirmek nişanı kapatır.</div></div>
      <div class="pan"><h3>Ateş modu</h3><div class="hint">Oyunda <kbd>${codeLabel(kb.codes('fireMode')[0])}</kbd>: <b>Tek atış</b> (her tık 1 mermi) → <b>Seri</b> (tek tık ya da basılı tutma 3-5 mermi atar; tekrar için tetiği bırakıp yeniden çek) → <b>Otomatik</b> (basılı tutunca sürekli). Tabanca, pompalı, keskin nişancı gibi yarı otomatik silahlar her zaman tek atar.</div></div>
      <div class="pan"><h3>Tuş atama</h3><div class="hint">Bir tuşa tıkla, sonra yeni tuşa bas. Her eyleme en çok 2 tuş atanabilir. Geri tuşu temizler, Esc vazgeçer. Aynı tuş başka eyleme atanmışsa oradan alınır.</div>
      <div class="row" style="margin-top:8px"><button class="chip" data-a="kreset">Varsayılana dön</button></div>${ctl.msg ? `<div class="hint" style="color:var(--acc2)">${ctl.msg}</div>` : ''}</div>
      ${groups}
      <div class="pan"><h3>Sabit tuşlar</h3><table class="keys">${fixed.map(([a, c]) => `<tr><td>${a}</td><td>${c}</td></tr>`).join('')}</table></div></div>`;
  }

  function render() {
    const keep = stage.querySelector('.scroll')?.scrollTop || 0;
    stage.className = 'mn-stage' + (screen === 'loadout' ? ' right' : '');
    stage.innerHTML = { home: homeHTML, custom: customHTML, online: onlineHTML, ocreate: ocreateHTML, loadout: loadoutHTML, settings: settingsHTML, controls: controlsHTML }[screen]();
    const sc = stage.querySelector('.scroll'); if (sc) sc.scrollTop = keep;
    renderNav(); renderUser(); bg();
    if (screen === 'loadout') fillIcons();
    if (screen === 'online') checkServer();
  }

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

  // ───── olaylar ─────
  function launch(randomize = false) {
    const pick = (v, list) => (v === 'random' ? rnd(list) : v);
    const map = randomize ? rnd(Object.keys(MAPS).filter((k) => !MAPS[k].dev)) : pick(p.map, Object.keys(MAPS).filter((k) => !MAPS[k].dev));
    const tod = randomize ? rnd(['day', 'sunset', 'night']) : pick(p.tod, ['day', 'sunset', 'night']);
    const weather = randomize ? rnd(['clear', 'clear', 'rain', 'fog']) : pick(p.weather, ['clear', 'rain', 'fog']);
    const perTeam = randomize ? rnd([4, 6, 8, 10, 12, 16]) : p.perTeam;
    const cls = p.cls;
    const payload = {
      map, tod, weather, team: p.team === 'random' ? rnd(['blue', 'red']) : p.team, cls, diff: p.diff, optic: p.optic, playerName: p.name,
      match: { perTeam, type: p.type, tickets: randomize ? undefined : p.tickets || undefined, time: p.time }, third: p.third,
      keys: p.keys, leftHand: p.leftHand, adsToggle: p.adsToggle, onPref: patchPrefs,
      loadout: loadoutOf(cls), loadouts: p.loadouts,                    // tüm sınıfların kayıtlı yüklemeleri: oyunda sınıf değişince o sınıfınki gelir
      settings: { sens: p.sens, fov: p.fov, volume: p.volume, vSfx: p.vSfx, vMusic: p.vMusic, vAmb: p.vAmb, rainSound: p.rainSound, shadows: p.shadows, pixelRatio: p.quality },
    };
    cleanup();
    onStart(payload);
  }
  function cleanup() {
    clearInterval(tipTimer); clearTimeout(iconTimer); clearInterval(roomPoll);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keydown', onCap, true);
    music.stop();
    scene?.dispose(); scene = null;
    el.style.display = 'none'; el.innerHTML = '';
  }
  // tuş atama yakalama (Kontroller ekranı): yakalama aşamasında dinler, oyun/menü kısayollarına sızdırmaz
  const onCap = (e) => {
    if (screen !== 'controls' || !ctl.cap) return;
    e.preventDefault(); e.stopPropagation();
    const code = norm(e.code), { id, slot } = ctl.cap, kb = new Binds(p.keys);
    if (code === 'Escape') { ctl = { cap: null, msg: '' }; render(); return; }
    if (code === 'Backspace' || code === 'Delete') { kb.clear(id, slot); p.keys = kb.toJSON(); ctl = { cap: null, msg: 'Tuş temizlendi' }; save(); render(); return; }
    if (RESERVED.has(code)) { ctl.msg = 'Bu tuş atanamaz'; render(); return; }
    const taken = kb.set(id, slot, code);
    p.keys = kb.toJSON();
    ctl = { cap: null, msg: taken ? `"${codeLabel(code)}" tuşu "${ACTIONS.find((a) => a.id === taken).label}" eyleminden alındı` : '' };
    save(); render();
  };
  document.addEventListener('keydown', onCap, true);
  const onKey = (e) => { if (e.key === 'Enter' && (screen === 'home' || screen === 'custom') && e.target.tagName !== 'INPUT') launch(); };
  document.addEventListener('keydown', onKey);

  stage.addEventListener('input', (e) => {
    const t = e.target, id = t.id;
    if (id === 'olCode') { t.value = t.value.toUpperCase().replace(/[^A-Z]/g, ''); p.room = t.value; save(); return; }
    if (id === 'olPw') { ol.pw = t.value; return; }
    if (id === 'ocName') { oc().name = t.value; save(); return; }
    if (id === 'ocPw') { ol.cpw = t.value; return; }
    if (id === 'ocSize') { const v = +t.value; oc().perTeam = v; t.style.setProperty('--p', ((v - lo(oc().type)) / (hi(oc().type) - lo(oc().type))) * 100 + '%'); q('#ocSizeV').innerHTML = tot(oc().type) ? `${v}<i>kişi</i>` : `${v}<i>vs</i>${v}`; stage.querySelectorAll('[data-k=perTeam]').forEach((c) => c.classList.toggle('on', +c.dataset.v === v)); save(); return; }
    if (t.type !== 'range') return;
    const v = +t.value, mn = +t.min, mx = +t.max;
    t.style.setProperty('--p', ((v - mn) / (mx - mn)) * 100 + '%');
    if (id === 'rSize') {
      p.perTeam = v; stage.querySelector('#vSize').innerHTML = tot(p.type) ? `${v}<i>kişi</i>` : `${v}<i>vs</i>${v}`;
      stage.querySelectorAll('[data-a=size]').forEach((c) => c.classList.toggle('on', +c.dataset.v === v));
    } else if (id === 'sSens') { p.sens = v; stage.querySelector('#v_sSens').textContent = (v / 0.0022).toFixed(2) + '×'; }
    else if (id === 'sFov') { p.fov = v; stage.querySelector('#v_sFov').textContent = v + '°'; }
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
    switch (a) {
      case 'go': screen = v; break;
      case 'quick': launch(false); return;
      case 'random': launch(true); return;
      case 'map': p.map = v; break;
      case 'tod': p.tod = v; break;
      case 'weather': p.weather = v; break;
      case 'third': p.third = v === '1'; break;
      case 'type': p.type = v; if (tot(v)) p.perTeam = Math.max(lo(v), Math.min(hi(v), p.perTeam)); break;
      case 'team': p.team = v; break;
      case 'diff': p.diff = v; break;
      case 'size': p.perTeam = +v; break;
      case 'tickets': p.tickets = +v; break;
      case 'time': p.time = +v; break;
      case 'oltm': p.olTeam = v; break;
      case 'oview': screen = v; ol = { ...ol, msg: '', err: false }; break;
      case 'olset': {
        const k = b.dataset.k, c = oc();
        c[k] = v === 'true' ? true : v === 'false' ? false : (k === 'perTeam' || k === 'tickets' || k === 'time') ? +v : v;
        if (k === 'type' && tot(v)) c.perTeam = Math.max(lo(v), Math.min(hi(v), c.perTeam));
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
      case 'quality': p.quality = +v; break;
      case 'shadows': p.shadows = !p.shadows; break;
      case 'rain': p.rainSound = !p.rainSound; break;
      case 'hand': p.leftHand = v === 'left'; break;
      case 'ads': p.adsToggle = v === 'toggle'; break;
      case 'kbind': ctl = { cap: { id: b.dataset.id, slot: +b.dataset.slot }, msg: '' }; break;
      case 'kreset': p.keys = {}; ctl = { cap: null, msg: 'Tuşlar varsayılana döndü' }; break;
      case 'reset': if (confirm('Seviye ve istatistikler sıfırlansın mı?')) { p.xp = 0; p.stats = { ...DEFAULTS.stats }; } break;
      default: return;
    }
    save(); render();
  };
  stage.addEventListener('click', act);
  nav.addEventListener('click', act);

  render();
  music.setVolume((p.volume ?? 0.6) * (p.vMusic ?? 0.5));
  music.play('lobby');                       // lobi müziği (public/audio/music/lobby.mp3 varsa)
}
