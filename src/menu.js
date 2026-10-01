import { MAPS, DEFAULT_MAP } from './maps/index.js';
import { CLASS_DEFS, WSTATS, DIFFICULTY, OPTICS, OPTIC_ORDER } from './game/stats.js';
import { MATCH_TYPES, TODS_LIST, defaultTickets } from './game/match.js';
import { MENU_CSS } from './menuStyle.js';
import { MenuScene } from './menuScene.js';
import { WEATHERS } from './game/weather.js';

const KEY = 'blockfront.v2';
export const DEFAULTS = {
  map: DEFAULT_MAP, tod: 'day', weather: 'clear', type: 'conquest', perTeam: 10, tickets: 0, time: 900,
  team: 'blue', cls: 'assault', diff: 'normal', optic: 'reddot', loadouts: {}, name: 'Sen',
  sens: 0.0022, fov: 75, volume: 0.6, shadows: true, quality: 1.5,
  xp: 0, stats: { matches: 0, wins: 0, kills: 0, deaths: 0 },
};

export function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('blockfront.v1') || '{}');
    return { ...DEFAULTS, ...raw, stats: { ...DEFAULTS.stats, ...(raw.stats || {}) }, loadouts: raw.loadouts || {} };
  } catch (e) { return { ...DEFAULTS }; }
}
function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* yok say */ } }

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
  'Mangal tabanlı bot stratejisi, ileri doğma noktaları',
];
const SIZE_PRESETS = [[1, '1v1'], [3, '3v3'], [5, '5v5'], [10, '10v10'], [16, '16v16'], [24, '24v24'], [32, '32v32']];
const TIME_OPTS = [[300, '5 dk'], [600, '10 dk'], [900, '15 dk'], [1200, '20 dk'], [1800, '30 dk'], [0, '∞']];
const TICKET_OPTS = [[0, 'Otomatik'], [50, '50'], [100, '100'], [200, '200'], [400, '400'], [800, '800']];
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

export function showMenu(onStart) {
  ensureStyle();
  const el = document.getElementById('menu');
  const p = loadPrefs();
  if (!MAPS[p.map] && p.map !== 'random') p.map = DEFAULT_MAP;
  el.style.display = 'block';
  el.innerHTML = `<canvas id="mnBg"></canvas><div class="mn-vig"></div>
    <div class="mn-top"><div class="mn-logo">BLOCK<b>FRONT</b><small>TAKIM SAVAŞI · TARAYICIDA</small></div><div class="mn-user" id="mnUser"></div></div>
    <nav class="mn-side" id="mnNav"></nav>
    <main class="mn-stage" id="mnStage"></main>
    <div class="mn-foot"><span id="mnTip"></span><span>BLOCKFRONT v2.0 · yerel oyun, botlu</span></div>`;
  const q = (s) => el.querySelector(s);
  const stage = q('#mnStage'), nav = q('#mnNav');
  let scene = null;
  try { scene = new MenuScene(q('#mnBg')); } catch (e) { console.warn('menü sahnesi açılamadı', e); }
  let screen = 'home', slot = 'primary';
  let tipI = Math.floor(Math.random() * TIPS.length);
  const tipTimer = setInterval(() => { tipI = (tipI + 1) % TIPS.length; q('#mnTip').innerHTML = TIPS[tipI]; }, 7000);
  q('#mnTip').innerHTML = TIPS[tipI];

  const NAV = [['home', 'Ana Menü', 'Hızlı başla'], ['custom', 'Özel Oyun', 'Harita · mod · boyut'], ['loadout', 'Sınıf & Silah', 'Teçhizatını seç'], ['settings', 'Ayarlar', 'Ses · görüntü · fare'], ['controls', 'Kontroller', 'Tuş haritası']];
  const save = () => savePrefs(p);
  const effTickets = () => p.tickets || defaultTickets(p.perTeam);
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
    nav.innerHTML = NAV.map(([k, t, s]) => `<button class="mn-nav ${screen === k ? 'on' : ''}" data-a="go" data-v="${k}">${t}<small>${s}</small></button>`).join('')
      + '<div class="mn-spacer"></div>';
  }

  // ───── ekranlar ─────
  const summary = () => `<div class="sumline"><span><b>${mapName()}</b></span><span>${todName()}${p.weather !== 'clear' ? ' · ' + (p.weather === 'random' ? 'Rastgele hava' : WEATHERS.find((w) => w[0] === p.weather)[1]) : ''}</span><span>${MATCH_TYPES[p.type].label}</span><span><b>${p.perTeam}</b> v <b>${p.perTeam}</b></span><span>${DIFFICULTY[p.diff].label}</span></div>`;

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
      <div class="split">
        <div class="pan"><h3>Oyun modu</h3><div class="row">${Object.entries(MATCH_TYPES).map(([k, m]) => `<button class="chip ${p.type === k ? 'on' : ''}" data-a="type" data-v="${k}">${m.label}<small>${m.desc}</small></button>`).join('')}</div></div>
        <div class="pan"><h3>Takımın</h3><div class="row">${[['blue', 'Mavi', 'blue'], ['red', 'Kırmızı', 'red'], ['random', 'Rastgele', '']].map(([k, n, c]) => `<button class="chip ${c} ${p.team === k ? 'on' : ''}" data-a="team" data-v="${k}">${n}</button>`).join('')}</div>
        <h3 style="margin-top:14px">Bot zorluğu</h3><div class="row">${Object.entries(DIFFICULTY).map(([k, d]) => `<button class="chip ${p.diff === k ? 'on' : ''}" data-a="diff" data-v="${k}">${d.label}</button>`).join('')}</div></div>
      </div>
      <div class="pan"><h3>Oyuncu sayısı <em>takım başına, sen dahil · kalanı botlar</em></h3>
        <div class="big"><div class="n" id="vSize">${p.perTeam}<i>vs</i>${p.perTeam}</div><div class="tx">${p.perTeam * 2} savaşçı. ${warn}</div></div>
        <input type="range" id="rSize" min="1" max="32" step="1" value="${p.perTeam}" style="--p:${((p.perTeam - 1) / 31) * 100}%">
        <div class="row">${SIZE_PRESETS.map(([n, l]) => `<button class="chip ${p.perTeam === n ? 'on' : ''}" data-a="size" data-v="${n}">${l}</button>`).join('')}</div></div>
      <div class="split">
        <div class="pan"><h3>Bilet <em>${effTickets()}</em></h3><div class="row">${TICKET_OPTS.map(([v, l]) => `<button class="chip ${p.tickets === v ? 'on' : ''}" data-a="tickets" data-v="${v}">${l}</button>`).join('')}</div></div>
        <div class="pan"><h3>Süre</h3><div class="row">${TIME_OPTS.map(([v, l]) => `<button class="chip ${p.time === v ? 'on' : ''}" data-a="time" data-v="${v}">${l}</button>`).join('')}</div></div>
      </div></div>
      <div class="startbar">${summary()}<button class="play" data-a="quick" style="min-width:300px">Oyna</button></div>`;
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
    const stats = ['dmg', 'range', 'rate', 'control', 'mobility'].map((k) => `<div class="stat"><span>${STAT_LABEL[k]}</span><div class="bar"><i style="width:${Math.max(3, Math.min(100, b[k] || 0))}%"></i></div><em>${Math.round(b[k] || 0)}</em></div>`).join('');
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
      <div class="pan"><h3>Ses</h3>${sl('sVol', 'Ana ses', 0, 1, 0.05, p.volume, (x) => Math.round(x * 100) + '%')}</div>
      <div class="pan"><h3>Grafik</h3><div class="row">${[[1, 'Düşük'], [1.5, 'Orta'], [2, 'Yüksek']].map(([v, l]) => `<button class="chip ${p.quality === v ? 'on' : ''}" data-a="quality" data-v="${v}">${l}</button>`).join('')}
      <button class="chip ${p.shadows ? 'on' : ''}" data-a="shadows" data-v="1">Gölgeler: ${p.shadows ? 'Açık' : 'Kapalı'}</button></div>
      <div class="hint">Düşük kalite ve kapalı gölge, zayıf bilgisayarlarda ve büyük maçlarda akıcılığı artırır.</div></div>
      <div class="pan"><h3>Veri</h3><button class="chip" data-a="reset">İlerlemeyi sıfırla</button></div></div>`;
  }

  function controlsHTML() {
    const rows = [
      ['Hareket', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · koşma <kbd>Shift</kbd> · zıpla <kbd>Boşluk</kbd>'],
      ['Duruş', 'çömel <kbd>Ctrl</kbd>/<kbd>C</kbd> · yat <kbd>Z</kbd> · kalkmak için <kbd>Boşluk</kbd>'],
      ['Eğilme', 'sola <kbd>Q</kbd> · sağa <kbd>E</kbd> (eğilerek ateş edilir)'],
      ['Ateş / Nişan', 'Sol tık / Sağ tık (basılı tut)'],
      ['Şarjör', '<kbd>R</kbd> (şarjör doluyken taktik yükleme daha hızlıdır)'],
      ['Silah', '<kbd>1</kbd> ana · <kbd>2</kbd> yedek · <kbd>3</kbd> gadget · <kbd>4</kbd> bıçak · fare tekeri'],
      ['Nişangâh', '<kbd>B</kbd> demir / red dot / holografik / ACOG · ateş modu <kbd>V</kbd>'],
      ['Fener', '<kbd>F</kbd> (gece ve gün batımında)'],
      ['Bakış (yedek)', 'Fare kilitlenmezse ok tuşları'],
      ['Skor tablosu', '<kbd>Tab</kbd> · duraklat <kbd>Esc</kbd>'],
    ];
    return `<div class="scroll"><div class="pan"><h3>Tuş haritası</h3><table class="keys">${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div></div>`;
  }

  function render() {
    const keep = stage.querySelector('.scroll')?.scrollTop || 0;
    stage.className = 'mn-stage' + (screen === 'loadout' ? ' right' : '');
    stage.innerHTML = { home: homeHTML, custom: customHTML, loadout: loadoutHTML, settings: settingsHTML, controls: controlsHTML }[screen]();
    const sc = stage.querySelector('.scroll'); if (sc) sc.scrollTop = keep;
    renderNav(); renderUser(); bg();
    if (screen === 'loadout') fillIcons();
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
      const id = next.dataset.icon, url = scene.weaponIcon(id, p.optic);
      stage.querySelectorAll(`img[data-icon="${id}"]`).forEach((im) => im.setAttribute('src', url));
      fillIcons();
    }, 20);
  }

  // ───── olaylar ─────
  function launch(randomize = false) {
    const pick = (v, list) => (v === 'random' ? rnd(list) : v);
    const map = randomize ? rnd(Object.keys(MAPS)) : pick(p.map, Object.keys(MAPS));
    const tod = randomize ? rnd(['day', 'sunset', 'night']) : pick(p.tod, ['day', 'sunset', 'night']);
    const weather = randomize ? rnd(['clear', 'clear', 'rain', 'fog']) : pick(p.weather, ['clear', 'rain', 'fog']);
    const perTeam = randomize ? rnd([4, 6, 8, 10, 12, 16]) : p.perTeam;
    const cls = p.cls;
    const payload = {
      map, tod, weather, team: p.team === 'random' ? rnd(['blue', 'red']) : p.team, cls, diff: p.diff, optic: p.optic, playerName: p.name,
      match: { perTeam, type: p.type, tickets: randomize ? undefined : p.tickets || undefined, time: p.time },
      loadout: loadoutOf(cls),
      settings: { sens: p.sens, fov: p.fov, volume: p.volume, shadows: p.shadows, pixelRatio: p.quality },
    };
    cleanup();
    onStart(payload);
  }
  function cleanup() {
    clearInterval(tipTimer); clearTimeout(iconTimer);
    document.removeEventListener('keydown', onKey);
    scene?.dispose(); scene = null;
    el.style.display = 'none'; el.innerHTML = '';
  }
  const onKey = (e) => { if (e.key === 'Enter' && (screen === 'home' || screen === 'custom') && e.target.tagName !== 'INPUT') launch(); };
  document.addEventListener('keydown', onKey);

  stage.addEventListener('input', (e) => {
    const t = e.target, id = t.id;
    if (t.type !== 'range') return;
    const v = +t.value, mn = +t.min, mx = +t.max;
    t.style.setProperty('--p', ((v - mn) / (mx - mn)) * 100 + '%');
    if (id === 'rSize') {
      p.perTeam = v; stage.querySelector('#vSize').innerHTML = `${v}<i>vs</i>${v}`;
      stage.querySelectorAll('[data-a=size]').forEach((c) => c.classList.toggle('on', +c.dataset.v === v));
    } else if (id === 'sSens') { p.sens = v; stage.querySelector('#v_sSens').textContent = (v / 0.0022).toFixed(2) + '×'; }
    else if (id === 'sFov') { p.fov = v; stage.querySelector('#v_sFov').textContent = v + '°'; }
    else if (id === 'sVol') { p.volume = v; stage.querySelector('#v_sVol').textContent = Math.round(v * 100) + '%'; }
    save();
  });
  stage.addEventListener('change', (e) => { if (e.target.id === 'rSize') render(); });

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
      case 'type': p.type = v; break;
      case 'team': p.team = v; break;
      case 'diff': p.diff = v; break;
      case 'size': p.perTeam = +v; break;
      case 'tickets': p.tickets = +v; break;
      case 'time': p.time = +v; break;
      case 'cls': p.cls = v; slot = 'primary'; break;
      case 'slot': slot = v; break;
      case 'pick': loadoutOf(p.cls)[slot] = v; break;
      case 'optic': p.optic = v; scene?.iconCache.clear(); break;
      case 'quality': p.quality = +v; break;
      case 'shadows': p.shadows = !p.shadows; break;
      case 'reset': if (confirm('Seviye ve istatistikler sıfırlansın mı?')) { p.xp = 0; p.stats = { ...DEFAULTS.stats }; } break;
      default: return;
    }
    save(); render();
  };
  stage.addEventListener('click', act);
  nav.addEventListener('click', act);

  render();
}
