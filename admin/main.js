// WarByte admin paneli: denge ayarları (3D önizlemeli), odalar, duyuru, sürüm geçmişi.
// Değerler: S.defs (koddaki varsayılan) ← S.saved (sunucudaki geçersiz kılmalar) ← S.draft (kaydedilmemiş taslak)
import { balanceSections, GROUP_LABELS, WEAPON_GROUPS } from '../src/game/balance.js';
import { WSTATS, CLASS_DEFS, DIFFICULTY } from '../src/game/stats.js';
import { Preview, thumb } from './preview.js';

const SECTIONS = balanceSections();
const FIELD = new Map();               // yol → { fd, item, sec }
for (const sec of SECTIONS) for (const item of sec.items) for (const fd of item.fields) FIELD.set(fd.path, { fd, item, sec });

const app = document.getElementById('app');
const S = { view: 'weapons', item: {}, saved: {}, draft: {}, defs: {}, meta: {}, rooms: [], hist: null };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ───────── İkonlar ─────────
const P = {
  run: '<circle cx="13" cy="4" r="1.6"/><path d="M4 17l5 1 .8-1.6M15 21v-4l-4-3 1-6M7 12V9l5-1 3 3 3 1"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1"/>',
  'first-aid-kit': '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M12 10.5v6M9 13.5h6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  users: '<circle cx="9" cy="7" r="3.5"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2M16 3.2a3.5 3.5 0 010 7.6M21 21v-2a4 4 0 00-3-3.85"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5M3 12v3M21 12v3"/>',
  skull: '<path d="M12 3a8 8 0 00-5 14.2V20a1 1 0 001 1h8a1 1 0 001-1v-2.8A8 8 0 0012 3z"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><path d="M10 21v-2M14 21v-2"/>',
  door: '<path d="M14 12v.01M3 21h18M6 21V5a2 2 0 012-2h8a2 2 0 012 2v16"/>',
  speaker: '<path d="M18 8a3 3 0 010 6M10 8v11a1 1 0 01-1 1H8a1 1 0 01-1-1v-5M12 8l4.6-3.8A.9.9 0 0118 5v12a.9.9 0 01-1.4.7L12 14H4a1 1 0 01-1-1V9a1 1 0 011-1h8"/>',
  history: '<path d="M12 8v4l2 2M3.05 11a9 9 0 11.5 4M3 20v-5h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  reset: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-1"/>',
  logout: '<path d="M14 8V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h7a2 2 0 002-2v-2M9 12h12l-3-3M18 15l3-3"/>',
  eye: '<circle cx="12" cy="12" r="2"/><path d="M22 12c-2.7 4.7-6 7-10 7s-7.3-2.3-10-7c2.7-4.7 6-7 10-7s7.3 2.3 10 7"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
};
const ic = (n) => `<svg class="i" viewBox="0 0 24 24">${P[n] || P.crosshair}</svg>`;

// ───────── Sunucu ─────────
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: body ? { 'content-type': 'application/json', 'x-wb': '1' } : { 'x-wb': '1' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  let j = {};
  try { j = await r.json(); } catch { /* boş */ }
  if (r.status === 401 && url !== '/api/login') { renderLogin(); throw new Error('Giriş gerekli'); }
  if (!r.ok) throw new Error(j.error || 'İstek başarısız');
  return j;
}
function toast(msg, bad = false) {
  const d = document.createElement('div');
  d.textContent = msg; if (bad) d.className = 'bad';
  document.getElementById('toast').appendChild(d);
  setTimeout(() => d.remove(), 3600);
}

// ───────── Değerler ─────────
const val = (p) => (p in S.draft ? S.draft[p] : S.defs[p]);
const savedVal = (p) => (p in S.saved ? S.saved[p] : S.defs[p]);
const changed = (p) => val(p) !== savedVal(p);
const modified = (p) => val(p) !== S.defs[p];
const pending = () => [...FIELD.keys()].filter(changed);
function setVal(p, v) { if (v === S.defs[p]) delete S.draft[p]; else S.draft[p] = v; }
const decs = (step) => { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
const disp = (fd, v) => +(v * fd.scale).toFixed(decs(fd.step));
const fromDisp = (fd, d) => +(Math.round(d / fd.step) * fd.step / fd.scale).toPrecision(10);
const optName = (v) => WSTATS[v]?.name || DIFFICULTY[v]?.label || v;
function fmt(path, v) {
  const { fd } = FIELD.get(path) || {};
  if (!fd) return String(v);
  if (fd.options) return optName(v);
  return String(disp(fd, v)).replace('.', ',') + (fd.unit && fd.unit !== '×' ? ' ' + fd.unit : fd.unit === '×' ? '×' : '');
}
const itemPending = (item) => item.fields.some((fd) => changed(fd.path));
const itemModified = (item) => item.fields.some((fd) => modified(fd.path));

// ───────── Giriş ─────────
function renderLogin() {
  app.innerHTML = `<div class="login"><form id="lf">
    <div class="logo">WAR<b>BYTE</b><small>YÖNETİM PANELİ</small></div>
    <label class="fld"><span>Admin şifresi</span><input class="inp" id="pw" type="password" autocomplete="current-password" autofocus></label>
    <div class="err" id="le"></div>
    <button class="btn pri wide">Giriş yap</button></form></div>`;
  document.getElementById('lf').onsubmit = async (e) => {
    e.preventDefault();
    const pw = document.getElementById('pw').value, le = document.getElementById('le');
    if (!pw) { le.textContent = 'Şifreyi yaz'; return; }
    try { await api('POST', '/api/login', { pw }); await boot(); } catch (er) { le.textContent = er.message; }
  };
}

// ───────── İskelet ─────────
const PAGES = [
  ...SECTIONS.map((s) => ({ id: s.id, label: s.label, icon: s.icon, sec: s })),
  { sep: true },
  { id: 'servers', label: 'Sunucular', icon: 'server' },
  { id: 'rooms', label: 'Odalar', icon: 'door' },
  { id: 'announce', label: 'Duyuru', icon: 'speaker' },
  { id: 'history', label: 'Geçmiş', icon: 'history' },
  { id: 'players', label: 'Hesaplar', icon: 'users' },
  { sep: true },
  { id: 'account', label: 'Hesap', icon: 'settings' },
];
const SHORT = { damage: 'Hasar', modes: 'Modlar', infection: 'Zombi' };

let preview = null, stageHost = null;
function shell() {
  const pg = PAGES.find((p) => p.id === S.view);
  const players = S.rooms.reduce((a, r) => a + r.humans, 0);
  const np = pending().length;
  app.innerHTML = `<div class="shell">
    <nav class="rail"><div class="mark">W</div>${PAGES.map((p) => p.sep ? '<div class="sep"></div>'
      : `<a data-v="${p.id}" class="${p.id === S.view ? 'on' : ''}" title="${esc(p.label)}">${p.sec && p.sec.items.some(itemPending) ? '<i class="dot"></i>' : ''}${ic(p.icon)}${esc(SHORT[p.id] || p.label)}</a>`).join('')}</nav>
    <header class="top"><span class="t">${esc(pg.label)}</span>
      <span class="pill">Sürüm v${S.meta.version || 0}</span>
      <span class="pill live">${S.rooms.length} oda · ${players} oyuncu</span>
      <span class="sp"></span>
      <span id="pendBox">${np ? `<span class="pend">${np} kaydedilmemiş değişiklik</span> <button class="btn sm" id="discard">Vazgeç</button> <button class="btn pri" id="save">Kaydet</button>` : ''}</span>
    </header>
    <main class="main" id="main"></main></div>`;
  app.querySelectorAll('.rail a').forEach((a) => (a.onclick = () => go(a.dataset.v)));
  bindPending();
  const main = document.getElementById('main');
  if (pg.sec) renderEditor(main, pg.sec);
  else if (S.view === 'servers') renderServers(main);
  else if (S.view === 'rooms') renderRooms(main);
  else if (S.view === 'announce') renderAnnounce(main);
  else if (S.view === 'history') renderHistory(main);
  else if (S.view === 'players') renderPlayers(main);
  else renderAccount(main);
}
function bindPending() {
  const s = document.getElementById('save'), d = document.getElementById('discard');
  if (s) s.onclick = openSave;
  if (d) d.onclick = () => { if (confirm('Kaydedilmemiş değişiklikler silinsin mi?')) { S.draft = { ...S.saved }; shell(); } };
}
function refreshPending() {
  const np = pending().length, box = document.getElementById('pendBox');
  if (box) box.innerHTML = np ? `<span class="pend">${np} kaydedilmemiş değişiklik</span> <button class="btn sm" id="discard">Vazgeç</button> <button class="btn pri" id="save">Kaydet</button>` : '';
  bindPending();
  document.querySelectorAll('.rail a').forEach((a) => {
    const p = PAGES.find((x) => x.id === a.dataset.v), has = p && p.sec && p.sec.items.some(itemPending), dot = a.querySelector('.dot');
    if (has && !dot) a.insertAdjacentHTML('afterbegin', '<i class="dot"></i>');
    if (!has && dot) dot.remove();
  });
}
function go(v) { S.view = v; if (location.hash !== '#' + v) history.pushState(null, '', '#' + v); shell(); if (v === 'rooms' || v === 'announce') loadRooms(); if (v === 'history') loadHistory(); if (v === 'servers') loadServers(); if (v === 'players') loadPlayers(); }

// ───────── Düzenleyici ─────────
function curItem(sec) {
  const id = S.item[sec.id];
  return sec.items.find((i) => i.id === id) || sec.items[0];
}
function renderEditor(main, sec) {
  const item = curItem(sec);
  let list = '';
  if (sec.id === 'weapons') {
    for (const [g, ids] of Object.entries(WEAPON_GROUPS)) {
      list += `<div class="grp">${esc(GROUP_LABELS[g])}</div>`;
      for (const id of ids) { const it = sec.items.find((i) => i.id === id); if (it) list += listItem(it, item); }
    }
  } else list = sec.items.map((it) => listItem(it, item)).join('');
  main.innerHTML = `<div class="ed">
    <div class="list">${list}</div>
    <div class="stagew"><div id="stageSlot" class="stage"></div>
      <div class="cap"><div class="k">${esc(capKind(sec, item))}</div><div class="n">${esc(item.name)}</div><div class="d">${esc(capDesc(sec, item))}</div></div>
      <div class="hint3d">${item.preview.kind === 'icon' ? '' : 'Sürükle: döndür · Tekerlek: yakınlaş'}</div>
      <div class="calc" id="calc"></div></div>
    <div class="fields" id="fields"></div></div>`;
  // 3D sahne tek kez kurulur, sayfalar arasında taşınır
  if (!stageHost) { stageHost = document.createElement('div'); stageHost.className = 'stage'; stageHost.style.cssText = 'position:absolute;inset:0'; preview = new Preview(stageHost); }
  document.getElementById('stageSlot').appendChild(stageHost);
  preview.resize();
  showPreview(sec, item);
  main.querySelectorAll('.it').forEach((el) => (el.onclick = () => { S.item[sec.id] = el.dataset.id; renderEditor(main, sec); }));
  renderFields(sec, item);
  renderCalc(sec, item);
  // küçük resimler sırayla (ilk boyama takılmasın)
  const imgs = [...main.querySelectorAll('img[data-th]')];
  const next = () => { const im = imgs.shift(); if (!im) return; if (im.isConnected) im.src = thumb(JSON.parse(im.dataset.th)); setTimeout(next, 0); };
  setTimeout(next, 30);
}
// Sınıf önizlemesi elinde o anki varsayılan ana silahı tutar
function showPreview(sec, item) {
  if (item.preview.kind === 'icon') return preview.show(null);
  preview.show(sec.id === 'classes' ? { ...item.preview, weapon: val(`cls.${item.id}.defaults.primary.blue`) } : item.preview);
}
function listItem(it, cur) {
  const th = it.preview.kind === 'icon' ? `<span style="width:56px;display:grid;place-items:center;color:var(--tx3)">${ic(it.preview.icon)}</span>` : `<img data-th='${esc(JSON.stringify(it.preview))}' alt="">`;
  const mark = itemPending(it) ? '<i class="chg" title="Kaydedilmemiş"></i>' : itemModified(it) ? '<i class="mod" title="Varsayılandan farklı"></i>' : '';
  return `<div class="it ${it === cur ? 'on' : ''}" data-id="${esc(it.id)}">${th}<span class="nm">${esc(it.name)}</span>${mark}</div>`;
}
function capKind(sec, item) {
  if (sec.id === 'weapons') return GROUP_LABELS[item.group] + (WSTATS[item.id]?.slot === 'secondary' ? ' · yedek' : '');
  if (sec.id === 'classes') return 'Sınıf';
  if (sec.id === 'infection') return item.id === 'rules' ? 'Enfekte modu' : 'Zombi';
  return sec.label;
}
function capDesc(sec, item) {
  if (WSTATS[item.id] && (sec.id === 'weapons' || sec.id === 'items')) return WSTATS[item.id].desc;
  if (sec.id === 'classes') return CLASS_DEFS[item.id].desc;
  return '';
}

function fieldHTML(fd) {
  const p = fd.path, v = val(p), cls = `f ${changed(p) ? 'chg' : ''} ${modified(p) ? 'mod' : ''}`;
  const sub = changed(p) ? `Kayıtlı: ${fmt(p, savedVal(p))} → ${fmt(p, v)}` : modified(p) ? `Varsayılan: ${fmt(p, S.defs[p])}` : '';
  if (fd.options) {
    return `<div class="${cls}" data-p="${p}"><div class="row1"><span class="lb">${esc(fd.label)}</span><button class="rs" title="Varsayılana dön">${ic('reset')}</button></div>
      <div class="opts">${fd.options.map((o) => `<div class="opt ${o === v ? 'on' : ''} ${o === S.defs[p] ? 'dflt' : ''}" data-o="${esc(o)}">${WSTATS[o] ? `<img data-th='${esc(JSON.stringify({ kind: WSTATS[o].kind === 'gun' || WSTATS[o].kind === 'melee' || WSTATS[o].kind === 'launcher' ? 'weapon' : 'item', id: o }))}' alt="">` : ''}${esc(optName(o))}</div>`).join('')}</div>
      <div class="sub">${esc(sub)}</div></div>`;
  }
  const lo = fd.min, hi = fd.max, d = disp(fd, v), dd = disp(fd, S.defs[p]);
  const pc = (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
  return `<div class="${cls}" data-p="${p}"><div class="row1"><span class="lb">${esc(fd.label)}</span>
      <input class="num" type="number" step="${fd.step}" min="${lo}" max="${hi}" value="${d}"><span class="u">${esc(fd.unit)}</span>
      <button class="rs" title="Varsayılana dön (${esc(fmt(p, S.defs[p]))})">${ic('reset')}</button></div>
    <div class="trk"><span class="def" style="left:calc(${pc(dd)}% - ${pc(dd) * 0.16 - 7}px)" title="Varsayılan"></span><input type="range" min="${lo}" max="${hi}" step="${fd.step}" value="${d}" style="--p:${pc(d)}%"></div>
    <div class="sub">${esc(sub)}</div></div>`;
}
function renderFields(sec, item) {
  const box = document.getElementById('fields');
  box.innerHTML = `<div class="fhead"><span class="h">Ayarlar</span>${itemModified(item) ? `<button class="btn sm" id="resetItem">${ic('reset')} Hepsini varsayılana</button>` : ''}</div>` + item.fields.map(fieldHTML).join('');
  const ri = document.getElementById('resetItem');
  if (ri) ri.onclick = () => { for (const fd of item.fields) setVal(fd.path, S.defs[fd.path]); afterChange(sec, item, true); };
  box.querySelectorAll('.f').forEach((row) => bindField(row, sec, item));
  box.querySelectorAll('img[data-th]').forEach((im) => (im.src = thumb(JSON.parse(im.dataset.th))));
}
function bindField(row, sec, item) {
  const p = row.dataset.p, { fd } = FIELD.get(p);
  row.querySelector('.rs').onclick = () => { setVal(p, S.defs[p]); afterChange(sec, item, true); };
  if (fd.options) { row.querySelectorAll('.opt').forEach((o) => (o.onclick = () => { setVal(p, o.dataset.o); afterChange(sec, item, true); })); return; }
  const rng = row.querySelector('input[type=range]'), num = row.querySelector('.num');
  rng.oninput = () => { num.value = rng.value; apply(+rng.value, false); };
  rng.onchange = () => apply(+rng.value, true);
  num.onchange = () => { let x = +String(num.value).replace(',', '.'); if (!Number.isFinite(x)) x = disp(fd, val(p)); x = Math.max(fd.min, Math.min(fd.max, x)); apply(x, true); };
  function apply(x, full) {
    setVal(p, fromDisp(fd, x));
    rng.style.setProperty('--p', ((x - fd.min) / (fd.max - fd.min)) * 100 + '%');
    if (full) afterChange(sec, item, true);
    else { row.classList.toggle('chg', changed(p)); row.classList.toggle('mod', modified(p)); renderCalc(sec, item); }
  }
}
function afterChange(sec, item, rerenderFields) {
  if (rerenderFields) renderFields(sec, item);
  if (sec.id === 'classes') showPreview(sec, item);
  renderCalc(sec, item);
  refreshPending();
  const li = document.querySelector(`.it[data-id="${CSS.escape(item.id)}"]`);
  if (li) { li.querySelector('.chg,.mod')?.remove(); li.insertAdjacentHTML('beforeend', itemPending(item) ? '<i class="chg"></i>' : itemModified(item) ? '<i class="mod"></i>' : ''); }
}

// Denge hesabı: değişikliğin etkisi (kayıtlıya göre)
function renderCalc(sec, item) {
  const box = document.getElementById('calc');
  if (!box) return;
  const cells = calcCells(sec, item);
  box.style.display = cells.length ? '' : 'none';
  box.innerHTML = cells.map(([lb, now, was, unit, better]) => {
    let delta = '';
    if (was !== undefined && Number.isFinite(now) && Number.isFinite(was) && Math.abs(now - was) > 1e-9) {
      const good = better === 'low' ? now < was : now > was;
      delta = `<i class="${good ? 'up' : 'dn'}">${now > was ? '▲' : '▼'} ${nf(was)}</i>`;
    }
    return `<div><p>${esc(lb)}</p><b>${Number.isFinite(now) ? nf(now) : esc(now)}</b>${unit ? `<span style="color:var(--tx3);font-size:12px"> ${unit}</span>` : ''}${delta}</div>`;
  }).join('');
}
const nf = (x) => (Math.abs(x) >= 100 ? Math.round(x) : Math.round(x * 100) / 100).toString().replace('.', ',');
function calcCells(sec, item) {
  const both = (fn) => [fn(val), fn(savedVal)];
  if (sec.id === 'weapons') {
    const id = item.id, st = WSTATS[id], k = (g) => (n) => g(`w.${id}.${n}`);
    if (st.kind === 'melee') {
      const [h, h0] = both((g) => Math.ceil(100 / k(g)('dmg')));
      const [t, t0] = both((g) => (Math.ceil(100 / k(g)('dmg')) - 1) * 60 / k(g)('rpm'));
      return [['100 cana vuruş', h, h0, '', 'low'], ['Öldürme süresi', t, t0, 'sn', 'low'], ['Erişim', val(`w.${id}.reach`), savedVal(`w.${id}.reach`), 'm', 'high'], ['Arkadan', val('tune.backstab') >= 100 ? 'Tek vuruş' : val('tune.backstab'), undefined, '']];
    }
    if (st.kind === 'launcher') {
      return [['Hasar', val(`w.${id}.dmg`), savedVal(`w.${id}.dmg`), '', 'high'], ['Yarıçap', val(`w.${id}.radius`), savedVal(`w.${id}.radius`), 'm', 'high'], ['Adet', val(`w.${id}.count`), savedVal(`w.${id}.count`), '', 'high'], ['Mermi hızı', val(`w.${id}.speed`), savedVal(`w.${id}.speed`), 'm/sn', 'high']];
    }
    const per = (g) => k(g)('dmg') * (st.pellets ? k(g)('pellets') : 1);
    const btk = (g, m = 1) => Math.ceil(100 / (per(g) * m));
    const [b, b0] = both((g) => btk(g));
    const [hb, hb0] = both((g) => btk(g, g('tune.headMul')));
    const [t, t0] = both((g) => (btk(g) - 1) * 60 / k(g)('rpm'));
    const [d, d0] = both((g) => per(g) * k(g)('rpm') / 60);
    return [[st.pellets ? '100 cana atış' : '100 cana mermi', b, b0, '', 'low'], ['Kafadan', hb, hb0, '', 'low'], ['Öldürme süresi', t, t0, 'sn', 'low'], ['Saniyede hasar', d, d0, '', 'high']];
  }
  if (sec.id === 'classes') {
    const c = item.id;
    return [['Can', val(`cls.${c}.hp`), savedVal(`cls.${c}.hp`), '', 'high'], ['Yürüme', val('tune.walkSpeed') * val(`cls.${c}.speed`), savedVal('tune.walkSpeed') * savedVal(`cls.${c}.speed`), 'm/sn', 'high'],
      ['Koşu', val('tune.walkSpeed') * val(`cls.${c}.speed`) * val('tune.sprintMul'), savedVal('tune.walkSpeed') * savedVal(`cls.${c}.speed`) * savedVal('tune.sprintMul'), 'm/sn', 'high'], ['Ana silah', optName(val(`cls.${c}.defaults.primary.blue`)), undefined, '']];
  }
  if (sec.id === 'items' && item.id === 'medkit') return [['Toplam can', val('w.medkit.heal') * val('w.medkit.count'), savedVal('w.medkit.heal') * savedVal('w.medkit.count'), '', 'high'], ['Tam can için', Math.ceil(100 / val('w.medkit.heal')), Math.ceil(100 / savedVal('w.medkit.heal')), 'kullanım', 'low']];
  if (sec.id === 'player' && item.id === 'move') {
    return [['Yürüme', val('tune.walkSpeed'), savedVal('tune.walkSpeed'), 'm/sn', 'high'], ['Koşu', val('tune.walkSpeed') * val('tune.sprintMul'), savedVal('tune.walkSpeed') * savedVal('tune.sprintMul'), 'm/sn', 'high'],
      ['Çömelme', val('tune.walkSpeed') * val('tune.crouchMul'), savedVal('tune.walkSpeed') * savedVal('tune.crouchMul'), 'm/sn', 'high'], ['Zıplama yüksekliği', val('tune.jumpSpeed') ** 2 / (2 * val('tune.gravity')), savedVal('tune.jumpSpeed') ** 2 / (2 * savedVal('tune.gravity')), 'm', 'high']];
  }
  if (sec.id === 'infection' && ZT(item.id)) {
    const p = item.id === 'boss' ? 'boss' : `zt.${item.id}`;
    return [['Can', val(`${p}.hp`), savedVal(`${p}.hp`), '', 'high'], ['Hız', val('tune.walkSpeed') * val(`${p}.speed`), savedVal('tune.walkSpeed') * savedVal(`${p}.speed`), 'm/sn', 'high'], ['Pençe hasarı', val(`${p}.dmg`), savedVal(`${p}.dmg`), '', 'high'], ['Oyuncuyu öldürme', Math.ceil(100 / val(`${p}.dmg`)), Math.ceil(100 / savedVal(`${p}.dmg`)), 'vuruş', 'low']];
  }
  return [];
}
const ZT = (id) => id === 'boss' || ['walker', 'runner', 'brute', 'ghost', 'blinker'].includes(id);

// ───────── Kaydet ─────────
function openSave() {
  const list = pending();
  if (!list.length) return;
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div class="box"><div class="bh"><div class="h" style="font-size:18px">Değişiklikleri kaydet</div><div style="color:var(--tx2);font-size:13px;margin-top:4px">Yeni başlayan maçlarda ve turlarda geçerli olur. Süren maçlar eski ayarlarla biter.</div></div>
    <div class="bb">${list.map((p) => { const { fd, item } = FIELD.get(p); return `<div class="cl"><div>${esc(fd.label)}<div class="w">${esc(item.name)}</div></div><div class="v"><s>${esc(fmt(p, savedVal(p)))}</s> → <b>${esc(fmt(p, val(p)))}</b></div></div>`; }).join('')}
      <label class="fld" style="margin:14px 0 6px"><span>Not (isteğe bağlı)</span><input class="inp" id="note" maxlength="200" placeholder="AK-47 biraz güçlendirildi"></label></div>
    <div class="bf"><button class="btn" id="mc">Vazgeç</button><button class="btn pri" id="mo">Kaydet ve yayınla</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector('#mc').onclick = () => m.remove();
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  m.querySelector('#mo').onclick = async () => {
    try {
      const r = await api('POST', '/api/balance', { overrides: S.draft, note: m.querySelector('#note').value });
      S.saved = { ...r.overrides }; S.draft = { ...r.overrides }; S.meta = r.meta; S.hist = null;
      m.remove(); shell();
      toast(`Kaydedildi: sürüm v${r.version} · yeni maçlarda geçerli`);
    } catch (e) { toast(e.message, true); }
  };
}

// ───────── Odalar ─────────
const MODE = { conquest: 'Ele Geçirme', tdm: 'Takım Çatışması', dm: 'Ölüm Maçı', gg: 'Silah Yarışı', inf: 'Enfekte' };
const MAP = { kasaba: 'Kasaba', vadi: 'Vadi', us: 'Askeri Üs', colgecidi: 'Çöl Geçidi', depo: 'Depo', liman: 'Liman', newyork: 'New York', dev: 'Geliştirme', kuzey: 'Kuzey Vadisi' };
const CLS = (c) => CLASS_DEFS[c]?.label || (c === 'zombie' ? 'Zombi' : c);
let roomTimer = 0;
async function loadRooms() {
  try { S.rooms = await api('GET', '/api/rooms'); } catch { return; }
  if (S.view === 'rooms') { const m = document.getElementById('main'); if (m) renderRooms(m); }
  const live = document.querySelector('.pill.live');
  if (live) live.textContent = `${S.rooms.length} oda · ${S.rooms.reduce((a, r) => a + r.humans, 0)} oyuncu`;
}
function renderRooms(main) {
  const v = S.meta.version || 0;
  main.innerHTML = `<div class="page"><h2>Odalar</h2><p class="lead">Açık odalar ve içindeki oyuncular. Liste 3 saniyede bir yenilenir.</p>
    <div class="grid">${S.rooms.map((r) => `<div class="card room">
      <div class="hd"><span class="nm">${esc(r.name)}</span>${r.official ? '<span class="tag or">Resmi</span>' : `<span class="tag">${esc(r.by || 'oyuncu')}</span>`}${r.locked ? '<span class="tag">Şifreli</span>' : ''}</div>
      <div class="meta">${esc(r.code)} · ${esc(MODE[r.type] || r.type)} · ${esc(MAP[r.map] || r.map)} · ${r.tl < 0 ? 'süresiz' : Math.floor(r.tl / 60) + ' dk kaldı'}${r.ended ? ' · maç bitti' : ''}
        · <span class="tag ${r.balVer !== v ? 'old' : ''}" title="Bu odanın maçı hangi denge sürümüyle oynanıyor">${r.balVer !== v ? `eski ayar v${r.balVer}` : `v${r.balVer}`}</span></div>
      <div style="display:flex;font-size:12px;color:var(--tx2)"><span style="flex:1">${r.humans} / ${r.cap} oyuncu</span>${r.bots ? 'botlar açık' : 'botsuz'}</div>
      <div class="bar"><s style="width:${Math.min(100, (r.humans / r.cap) * 100)}%"></s></div>
      ${r.perf ? `<div style="font-size:12px;color:var(--tx2);margin-top:6px" title="12.203: son 10 sn; bütçe adım başına 16 700 µs (60 Hz, bütün odalar tek iş parçacığında)">${r.soldiers} asker · sim ${r.perf.simAvg} µs (p95 ${r.perf.simP95}) · ağ ${r.perf.netAvg} µs · ${r.perf.kbPerClient} KB/sn/oyuncu</div>` : ''}
      ${r.players.length ? r.players.map((p) => `<div class="pl"><i class="tm" style="background:${p.team === 'blue' ? 'var(--blue)' : 'var(--red)'}"></i><span class="n">${esc(p.name)} <span style="color:var(--tx3);font-size:12px">${esc(CLS(p.cls))}</span></span><span class="k" title="Öldürme / Asist / Ölüm">${p.kills}/${p.assists ?? 0}/${p.deaths}</span><button class="btn sm dan" data-kick="${esc(r.code)}:${p.id}" data-nm="${esc(p.name)}">At</button></div>`).join('') : '<div class="empty">Oyuncu yok</div>'}
      ${r.official ? '' : `<div style="margin-top:10px;text-align:right"><button class="btn sm dan" data-close="${esc(r.code)}">Odayı kapat</button></div>`}
    </div>`).join('') || '<div class="empty">Açık oda yok</div>'}</div></div>`;
  main.querySelectorAll('[data-kick]').forEach((b) => (b.onclick = async () => {
    const [code, id] = b.dataset.kick.split(':');
    if (!confirm(`${b.dataset.nm} odadan atılsın mı?`)) return;
    try { await api('POST', '/api/rooms/kick', { code, id: +id }); toast(`${b.dataset.nm} atıldı`); loadRooms(); } catch (e) { toast(e.message, true); }
  }));
  main.querySelectorAll('[data-close]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`${b.dataset.close} odası kapatılsın mı? İçindeki oyuncular ana menüye düşer.`)) return;
    try { await api('POST', '/api/rooms/close', { code: b.dataset.close }); toast('Oda kapatıldı'); loadRooms(); } catch (e) { toast(e.message, true); }
  }));
}

// ───────── Resmi sunucular ─────────
const MAPN = { kasaba: 'Kasaba', vadi: 'Vadi', us: 'Askeri Üs', colgecidi: 'Çöl Geçidi', depo: 'Depo', liman: 'Liman', newyork: 'New York', boyakulesi: 'Boya Kulesi', ormankale: 'Orman Kalesi', maden: 'Maden Ocağı', yorunge: 'Yörünge Üssü', kuzey: 'Kuzey Vadisi' };
const MAPIMG = {
  kasaba: new URL('../public/img/kasaba.jpg', import.meta.url).href, vadi: new URL('../public/img/vadi.jpg', import.meta.url).href,
  us: new URL('../public/img/us.jpg', import.meta.url).href, colgecidi: new URL('../public/img/colgecidi.jpg', import.meta.url).href, liman: new URL('../public/img/liman.jpg', import.meta.url).href,
  newyork: new URL('../public/img/newyork.jpg', import.meta.url).href, kuzey: new URL('../public/img/kuzey.jpg', import.meta.url).href,
  depo: new URL('../public/img/depo.jpg', import.meta.url).href, boyakulesi: new URL('../public/img/boyakulesi.jpg', import.meta.url).href,
  ormankale: new URL('../public/img/ormankale.jpg', import.meta.url).href,
  maden: new URL('../public/img/maden.jpg', import.meta.url).href,
  cephe: new URL('../public/img/cephe.jpg', import.meta.url).href,
  yorunge: new URL('../public/img/yorunge.jpg', import.meta.url).href,      // 12.157
};
const MODES = [['conquest', 'Ele Geçirme'], ['tdm', 'Takım Çatışması'], ['dm', 'Ölüm Maçı'], ['gg', 'Silah Yarışı'], ['inf', 'Enfekte'], ['pb', 'Paintball'], ['payload', 'Vagon'], ['space', 'Uzay'], ['front', 'Cephe']];
const TODS = [['day', 'Gündüz'], ['sunset', 'Gün batımı'], ['night', 'Gece']];
const WEATHERS = [['clear', 'Açık'], ['rain', 'Yağmur'], ['fog', 'Sis']];
const DIFFS = [['easy', 'Kolay'], ['normal', 'Normal'], ['hard', 'Zor']];
const lbl = (L, v) => (L.find((x) => x[0] === v) || [, v])[1];
const isTotal = (t) => t === 'dm' || t === 'gg' || t === 'inf' || t === 'pb';
const mapsFor = (t) => (t === 'space' ? ['yorunge'] : t === 'inf' ? ['newyork'] : t === 'pb' ? ['boyakulesi', 'ormankale'] : t === 'payload' ? ['maden'] : t === 'front' ? ['cephe'] : t === 'conquest' || t === 'tdm' ? ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman', 'kuzey'] : ['kasaba', 'vadi', 'us', 'colgecidi', 'depo', 'liman']);
function sizeRange(t, L, rot) {
  if (t === 'inf') return [L.infMin, L.infMax, 2];
  if (t === 'pb') return [L.pbMin ?? 2, L.pbMax ?? 12, 1];
  if (t === 'dm' || t === 'gg') return [2, L.dmMax, 1];
  const big = (t === 'conquest' || t === 'tdm') && (rot || []).some((r) => r.map === 'kuzey');      // 12.203: düzende büyük harita (Kuzey Vadisi) varsa 128v128 (TDM 64v64); küçük haritada maç 32'ye kırpılır
  return [1, big ? Math.max(L.maxPerTeam, t === 'tdm' ? Math.min(L.maxPerTeamBig ?? 128, L.maxPerTeamBigTdm ?? 64) : L.maxPerTeamBig ?? 128) : L.maxPerTeam, 1];
}
const sizeTxt = (o) => (isTotal(o.type) ? `${o.perTeam} kişi` : `${o.perTeam}v${o.perTeam}`);
const timeTxt = (t) => (t ? `${Math.round(t / 60)} dk` : 'süresiz');

async function loadServers() {
  try { S.off = await api('GET', '/api/official'); } catch { return; }
  if (S.view === 'servers' && !document.querySelector('.modal') && !S.dragging) renderServers(document.getElementById('main'));
}
function renderServers(main) {
  const O = S.off;
  if (!O) { main.innerHTML = '<div class="page"><div class="empty">Yükleniyor…</div></div>'; return; }
  main.innerHTML = `<div class="page"><h2>Resmi sunucular</h2><p class="lead">Ana menüdeki sunucu listesinde herkese açık, botlu, sürekli açık odalar. Kapalı sunucu listede görünmez. Ayar değişikliği sunucu boşsa hemen, içinde oyuncu varsa sonraki maçta geçerli olur.<br><b style="color:var(--or2);font-weight:500">Kartları sürükleyip bırakarak oyundaki sırayı belirle.</b></p>
    <div class="grid" id="srvGrid">${O.list.map((o, idx) => {
      const m = o.live ? o.live.map : o.rotation[0].map;
      return `<div class="card srv ${o.enabled ? '' : 'off'}" draggable="true" data-code="${esc(o.code)}">
        <div class="simg" style="background-image:url('${MAPIMG[m]}')"><span class="code" title="Sürükle"><svg class="i grip" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>${idx + 1} · ${esc(o.code)}</span>
          <label class="sw" title="${o.enabled ? 'Açık' : 'Kapalı'}"><input type="checkbox" data-tg="${esc(o.code)}" ${o.enabled ? 'checked' : ''}><i></i></label>
          <span class="st">${o.enabled && o.live ? `<b class="on"></b>${o.live.humans}/${o.live.cap} oyuncu · ${esc(MAPN[o.live.map])}${o.live.ended ? ' · maç bitti' : o.live.tl >= 0 ? ` · ${Math.floor(o.live.tl / 60)} dk kaldı` : ''}` : '<b></b>Kapalı'}</span></div>
        <div class="sb"><div class="nm">${esc(o.name)}</div><div class="ds">${esc(o.desc || ' ')}</div>
          <div class="chips"><span class="tag or">${esc(lbl(MODES, o.type))}</span><span class="tag">${sizeTxt(o)}</span><span class="tag">${timeTxt(o.time)}</span><span class="tag">${o.bots ? lbl(DIFFS, o.diff) + ' bot' : 'Botsuz'}</span><span class="tag" title="Maç sonu oylaması">${o.vote !== false ? `Oylama ${o.voteSec ?? 15} sn` : 'Oylama yok'}</span><span class="tag" title="Boşken harita değişimi">${o.idleMin ? `Boşta ${o.idleMin} dk` : 'Boşta sabit'}</span></div>
          <div class="rot">${o.rotation.map((r, i) => `<span class="rm" title="${esc(MAPN[r.map])} · ${esc(lbl(TODS, r.tod))} · ${esc(lbl(WEATHERS, r.weather))}" style="background-image:url('${MAPIMG[r.map]}')"><i>${o.shuffle ? '?' : i + 1}</i></span>`).join('')}<span class="tag" style="align-self:center">${o.rotation.length < 2 ? 'Tek harita' : o.shuffle ? 'Rastgele' : 'Sırayla'}</span></div>
          <button class="btn sm" data-ed="${esc(o.code)}" style="margin-top:12px">Düzenle</button></div></div>`;
    }).join('')}
    ${O.list.length < O.max ? '<button class="card srvnew" id="srvNew"><span>+</span>Yeni resmi sunucu</button>' : ''}</div></div>`;
  main.querySelectorAll('[data-ed]').forEach((b) => (b.onclick = () => openServer(O.list.find((o) => o.code === b.dataset.ed))));
  // Sürükle-bırak: bırakınca yeni sıra sunucuya yazılır (oyundaki liste aynı sırada)
  const grid = document.getElementById('srvGrid');
  let dragEl = null;
  grid.querySelectorAll('.srv').forEach((card) => {
    card.ondragstart = (e) => { if (e.target.closest('input,button')) { e.preventDefault(); return; } dragEl = card; S.dragging = true; card.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.dataset.code); };
    card.ondragover = (e) => {
      e.preventDefault();
      if (!dragEl || dragEl === card) return;
      const r = card.getBoundingClientRect(), after = e.clientY > r.bottom - r.height * 0.25 || (e.clientY > r.top + r.height * 0.25 && e.clientX > r.left + r.width / 2);
      card.parentNode.insertBefore(dragEl, after ? card.nextSibling : card);
    };
    card.ondragend = async () => {
      card.classList.remove('drag'); dragEl = null;
      const codes = [...grid.querySelectorAll('.srv')].map((c) => c.dataset.code);
      if (codes.join() === O.list.map((o) => o.code).join()) { S.dragging = false; return; }
      try { S.off = await api('POST', '/api/official/order', { codes }); toast('Sıralama kaydedildi · oyundaki liste güncellendi'); } catch (e) { toast(e.message, true); }
      S.dragging = false; renderServers(main);
    };
  });
  grid.ondragover = (e) => e.preventDefault();
  const nb = document.getElementById('srvNew');
  if (nb) nb.onclick = () => openServer(null);
  main.querySelectorAll('[data-tg]').forEach((cb) => (cb.onchange = async () => {
    const o = O.list.find((x) => x.code === cb.dataset.tg);
    if (!cb.checked && o.live && o.live.humans && !confirm(`${o.name} kapatılsın mı? İçindeki ${o.live.humans} oyuncu ana menüye düşer.`)) { cb.checked = true; return; }
    try { S.off = await api('POST', '/api/official/toggle', { code: o.code, enabled: cb.checked }); toast(`${o.name} ${cb.checked ? 'açıldı' : 'kapatıldı'}`); renderServers(main); } catch (e) { toast(e.message, true); cb.checked = !cb.checked; }
  }));
}

function openServer(src) {
  const L = S.off.limits;
  const E = src ? JSON.parse(JSON.stringify(src)) : { name: 'Yeni Resmi Sunucu', desc: '', enabled: true, type: 'tdm', perTeam: 8, time: 600, diff: 'normal', tickets: 0, bots: true, third: false, vote: true, voteSec: 15, idleMin: 10, rotation: [{ map: 'kasaba', tod: 'day', weather: 'clear' }] };
  delete E.live;
  E.vote = E.vote !== false; E.voteSec ??= 15; E.idleMin ??= 10;
  const m = document.createElement('div');
  m.className = 'modal';
  document.body.appendChild(m);
  const seg = (name, L2, v, dis) => `<div class="seg">${L2.map(([k, t]) => `<button type="button" data-${name}="${k}" class="${k === v ? 'on' : ''}" ${dis ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>`;
  function fix() {
    const [lo, hi, st] = sizeRange(E.type, L, E.rotation);
    E.perTeam = Math.max(lo, Math.min(hi, Math.round(E.perTeam / st) * st));
    const ms = mapsFor(E.type);
    for (const r of E.rotation) { if (!ms.includes(r.map)) r.map = ms[0]; if (E.type === 'inf') r.tod = 'night'; }
    if (!isTotal(E.type) || E.type === 'dm') { /* bilet / skor sınırı yalnız ele geçirme ve takım çatışmasında */ }
  }
  function draw() {
    fix();
    const [lo, hi, st] = sizeRange(E.type, L, E.rotation), inf = E.type === 'inf', lim = E.type === 'conquest' || E.type === 'tdm';
    m.innerHTML = `<div class="box wide"><div class="bh"><div class="h" style="font-size:18px">${src ? esc(src.code) + ' · Sunucuyu düzenle' : 'Yeni resmi sunucu'}</div></div>
      <div class="bb sform">
        <div class="two"><label class="fld"><span>Sunucu adı</span><input class="inp" id="sName" maxlength="32" value="${esc(E.name)}"></label>
          <label class="fld"><span>Kısa açıklama</span><input class="inp" id="sDesc" maxlength="60" value="${esc(E.desc)}" placeholder="Ele Geçirme · 10v10 · bot destekli"></label></div>
        <div class="fld"><span>Oyun modu</span>${seg('mode', MODES, E.type)}</div>
        <div class="fld"><span>${isTotal(E.type) ? 'Toplam oyuncu' : 'Takım başına oyuncu'}: <b id="sSizeV">${sizeTxt(E)}</b></span>
          <div class="trk"><input type="range" id="sSize" min="${lo}" max="${hi}" step="${st}" value="${E.perTeam}" style="--p:${((E.perTeam - lo) / Math.max(1, hi - lo)) * 100}%"></div></div>
        <div class="fld"><span>Maç süresi: <b id="sTimeV">${timeTxt(E.time)}</b></span>
          <div class="trk"><input type="range" id="sTime" min="1" max="60" step="1" value="${Math.max(1, Math.round(E.time / 60))}" style="--p:${((Math.max(1, Math.round(E.time / 60)) - 1) / 59) * 100}%"></div></div>
        ${lim ? `<div class="fld"><span>${E.type === 'tdm' ? 'Skor sınırı' : 'Bilet sayısı'}</span><div class="row2"><label class="chk"><input type="checkbox" id="sAuto" ${E.tickets ? '' : 'checked'}> Otomatik (kişi sayısına göre)</label>
          <input class="inp" id="sTk" type="number" min="20" max="1000" value="${E.tickets || ''}" style="width:110px" ${E.tickets ? '' : 'disabled'}></div></div>` : ''}
        <div class="two"><div class="fld"><span>Bot zorluğu${inf ? ' (Enfekte: zor)' : ''}</span>${seg('diff', DIFFS, inf ? 'hard' : E.diff, inf)}</div>
          <div class="fld"><span>Seçenekler</span><label class="chk"><input type="checkbox" id="sBots" ${E.bots ? 'checked' : ''}> Botlar boş yerleri doldursun</label><label class="chk"><input type="checkbox" id="sThird" ${E.third ? 'checked' : ''}> 3. şahıs kamera serbest</label></div></div>
        <div class="fld"><span>Harita düzeni${inf ? ' (Enfekte yalnız New York, gece)' : ''}</span>${seg('shuf', [['seq', 'Sırayla'], ['rnd', 'Rastgele']], E.shuffle ? 'rnd' : 'seq')}
          <div style="font-size:12px;color:var(--tx3);margin:6px 0 10px">${E.shuffle ? 'Her maçta listedeki haritalardan biri rastgele seçilir; aynı harita üst üste gelmez.' : 'Her maç bitince listedeki sıradaki haritaya geçer.'}</div>
          ${E.rotation.map((r, i) => `<div class="rrow" data-i="${i}"><span class="ri">${E.shuffle ? '?' : i + 1}</span>
            <div class="mpick">${mapsFor(E.type).map((k) => `<button type="button" data-map="${k}" class="${k === r.map ? 'on' : ''}" style="background-image:url('${MAPIMG[k]}')"><span>${esc(MAPN[k])}</span></button>`).join('')}</div>
            <div class="rset">${seg('tod', TODS, r.tod, inf)}${seg('weather', WEATHERS, r.weather)}</div>
            <div class="rbtn"><button type="button" class="btn sm" data-up ${i ? '' : 'disabled'} title="Yukarı">↑</button><button type="button" class="btn sm" data-down ${i < E.rotation.length - 1 ? '' : 'disabled'} title="Aşağı">↓</button><button type="button" class="btn sm dan" data-rm ${E.rotation.length > 1 ? '' : 'disabled'} title="Kaldır">✕</button></div></div>`).join('')}
          ${E.rotation.length < 8 ? '<button type="button" class="btn sm" id="sAdd" style="margin-top:8px">+ Harita ekle</button>' : ''}</div>
        <div class="two"><div class="fld"><span>Maç sonu oylaması: <b id="sVoteV">${E.vote ? E.voteSec + ' sn' : 'Kapalı'}</b></span><label class="chk"><input type="checkbox" id="sVote" ${E.vote ? 'checked' : ''}> Oyuncular sonraki haritayı + gün saatini oylasın (3 seçenek)</label>
            <div class="trk"><input type="range" id="sVoteS" min="5" max="60" step="1" value="${E.voteSec}" style="--p:${((E.voteSec - 5) / 55) * 100}%" ${E.vote ? '' : 'disabled'}></div></div>
          <div class="fld"><span>Boşken harita değişimi: <b id="sIdleV">${E.idleMin ? E.idleMin + ' dk' : 'Kapalı'}</b></span><div style="font-size:12px;color:var(--tx3);margin:2px 0 6px">İçinde oyuncu yokken harita / gün saati kendiliğinden döner (0 = kapalı)</div>
            <div class="trk"><input type="range" id="sIdle" min="0" max="60" step="1" value="${E.idleMin}" style="--p:${(E.idleMin / 60) * 100}%"></div></div></div>
        <div class="err" id="sErr"></div></div>
      <div class="bf">${src ? '<button class="btn dan" id="sDel" style="margin-right:auto">Sunucuyu sil</button>' : ''}<button class="btn" id="sCancel">Vazgeç</button><button class="btn pri" id="sSave">${src ? 'Kaydet' : 'Oluştur ve aç'}</button></div></div>`;
    bind();
  }
  const keep = () => {           // metin alanlarını yeniden çizimden önce oku
    const n = m.querySelector('#sName'), d = m.querySelector('#sDesc');
    if (n) E.name = n.value; if (d) E.desc = d.value;
  };
  function bind() {
    m.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { keep(); E.type = b.dataset.mode; if (E.type === 'inf') E.diff = 'hard'; draw(); }));
    m.querySelectorAll('[data-diff]').forEach((b) => (b.onclick = () => { keep(); E.diff = b.dataset.diff; draw(); }));
    m.querySelectorAll('[data-shuf]').forEach((b) => (b.onclick = () => { keep(); E.shuffle = b.dataset.shuf === 'rnd'; draw(); }));
    const sz = m.querySelector('#sSize'), tm = m.querySelector('#sTime');
    sz.oninput = () => { E.perTeam = +sz.value; m.querySelector('#sSizeV').textContent = sizeTxt(E); sz.style.setProperty('--p', ((sz.value - sz.min) / Math.max(1, sz.max - sz.min)) * 100 + '%'); };
    tm.oninput = () => { E.time = +tm.value * 60; m.querySelector('#sTimeV').textContent = timeTxt(E.time); tm.style.setProperty('--p', ((tm.value - 1) / 59) * 100 + '%'); };
    const au = m.querySelector('#sAuto'), tk = m.querySelector('#sTk');
    if (au) { au.onchange = () => { tk.disabled = au.checked; if (au.checked) { E.tickets = 0; tk.value = ''; } else { tk.value = tk.value || (E.type === 'tdm' ? 50 : 200); E.tickets = +tk.value; tk.focus(); } }; tk.onchange = () => { E.tickets = Math.max(20, Math.min(1000, Math.round(+tk.value) || 0)); tk.value = E.tickets; }; }
    m.querySelector('#sBots').onchange = (e) => { E.bots = e.target.checked; };
    const vs = m.querySelector('#sVoteS'), vv = m.querySelector('#sVoteV'), il = m.querySelector('#sIdle');            // maç sonu oylaması + boş oda dönüşü
    m.querySelector('#sVote').onchange = (e) => { E.vote = e.target.checked; vs.disabled = !E.vote; vv.textContent = E.vote ? E.voteSec + ' sn' : 'Kapalı'; };
    vs.oninput = () => { E.voteSec = +vs.value; vv.textContent = E.voteSec + ' sn'; vs.style.setProperty('--p', ((vs.value - 5) / 55) * 100 + '%'); };
    il.oninput = () => { E.idleMin = +il.value; m.querySelector('#sIdleV').textContent = E.idleMin ? E.idleMin + ' dk' : 'Kapalı'; il.style.setProperty('--p', (il.value / 60) * 100 + '%'); };
    m.querySelector('#sThird').onchange = (e) => { E.third = e.target.checked; };
    m.querySelectorAll('.rrow').forEach((row) => {
      const i = +row.dataset.i, r = E.rotation[i];
      row.querySelectorAll('[data-map]').forEach((b) => (b.onclick = () => { keep(); r.map = b.dataset.map; draw(); }));
      row.querySelectorAll('[data-tod]').forEach((b) => (b.onclick = () => { keep(); r.tod = b.dataset.tod; draw(); }));
      row.querySelectorAll('[data-weather]').forEach((b) => (b.onclick = () => { keep(); r.weather = b.dataset.weather; draw(); }));
      const sw = (j) => { keep(); [E.rotation[i], E.rotation[j]] = [E.rotation[j], E.rotation[i]]; draw(); };
      row.querySelector('[data-up]').onclick = () => sw(i - 1);
      row.querySelector('[data-down]').onclick = () => sw(i + 1);
      row.querySelector('[data-rm]').onclick = () => { keep(); E.rotation.splice(i, 1); draw(); };
    });
    const add = m.querySelector('#sAdd');
    if (add) add.onclick = () => { keep(); const last = E.rotation[E.rotation.length - 1]; E.rotation.push({ map: mapsFor(E.type).find((k) => !E.rotation.some((r) => r.map === k)) || last.map, tod: last.tod, weather: 'clear' }); draw(); };
    m.querySelector('#sCancel').onclick = () => m.remove();
    const del = m.querySelector('#sDel');
    if (del) del.onclick = async () => {
      const lv = src.live && src.live.humans ? ` İçindeki ${src.live.humans} oyuncu ana menüye düşer.` : '';
      if (!confirm(`${src.name} kalıcı olarak silinsin mi?${lv}`)) return;
      try { S.off = await api('POST', '/api/official/delete', { code: src.code }); m.remove(); toast('Sunucu silindi'); renderServers(document.getElementById('main')); } catch (e) { toast(e.message, true); }
    };
    m.querySelector('#sSave').onclick = async () => {
      keep();
      const er = m.querySelector('#sErr');
      if (!E.name.trim()) { er.textContent = 'Sunucuya bir ad ver'; m.querySelector('#sName').focus(); return; }
      try {
        const r = await api('POST', '/api/official/save', { server: E });
        S.off = r; m.remove(); renderServers(document.getElementById('main'));
        const o = r.list.find((x) => x.code === r.code);
        toast(src ? (o && o.live && o.live.humans ? 'Kaydedildi · içinde oyuncu var, sonraki maçta geçerli' : 'Kaydedildi · hemen geçerli') : `${r.code} oluşturuldu ve açıldı`);
      } catch (e) { er.textContent = e.message; }
    };
  }
  draw();
}

// ───────── Duyuru ─────────
function renderAnnounce(main) {
  main.innerHTML = `<div class="page"><div class="ann"><h2>Duyuru</h2><p class="lead">Oyunculara sohbet kutusunda sistem mesajı olarak görünür.</p>
    <textarea id="at" maxlength="160" placeholder="Sunucu 5 dakika sonra güncellenecek"></textarea>
    <div class="row"><select id="ar" class="sel"><option value="">Tüm odalar</option>${S.rooms.map((r) => `<option value="${esc(r.code)}">${esc(r.name)} (${r.humans})</option>`).join('')}</select>
      <span id="ac" style="flex:1;color:var(--tx3);font-size:12px">0 / 160</span><button class="btn pri" id="as">Gönder</button></div>
    <div class="err" id="ae"></div>
    <div class="prev"><span style="color:var(--tx3);font-size:11px;letter-spacing:.15em">OYUNDA BÖYLE GÖRÜNÜR</span><div class="s" id="ap" style="margin-top:6px">📢 …</div></div></div></div>`;
  const t = document.getElementById('at'), ap = document.getElementById('ap'), ac = document.getElementById('ac'), ae = document.getElementById('ae');
  t.oninput = () => { ap.textContent = '📢 ' + (t.value.trim() || '…'); ac.textContent = `${t.value.length} / 160`; ae.textContent = ''; };
  document.getElementById('as').onclick = async () => {
    if (!t.value.trim()) { ae.textContent = 'Mesaj yaz'; return; }
    try { const r = await api('POST', '/api/announce', { text: t.value, code: document.getElementById('ar').value || undefined }); toast(`Duyuru gönderildi (${r.players} oyuncu)`); t.value = ''; t.oninput(); } catch (e) { toast(e.message, true); }
  };
}

// ───────── Geçmiş ─────────
async function loadHistory() {
  try { S.hist = await api('GET', '/api/history'); } catch { return; }
  if (S.view === 'history') renderHistory(document.getElementById('main'));
}
function renderHistory(main) {
  const v = S.meta.version || 0, H = S.hist;
  const when = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  main.innerHTML = `<div class="page"><div class="hist"><h2>Geçmiş</h2><p class="lead">Her kayıt bir sürümdür. Eski bir sürüme dönmek yeni bir sürüm olarak kaydedilir.</p>
    ${!H ? '<div class="empty">Yükleniyor…</div>' : H.map((h) => `<div class="ver"><div class="v">v${h.version}</div>
      <div><div class="w">${esc(when(h.savedAt))}${h.version === v ? ' · <span style="color:var(--ok)">şu an geçerli</span>' : ''}</div>${h.note ? `<div class="note">${esc(h.note)}</div>` : ''}
        ${h.changes.map((c) => { const f = FIELD.get(c.path); return `<div class="ch">${f ? `${esc(f.item.name)} · <b>${esc(f.fd.label)}</b>` : esc(c.path)}: ${esc(c.from === undefined ? '-' : fmt(c.path, c.from))} → <span class="to">${esc(c.to === undefined ? '-' : fmt(c.path, c.to))}</span></div>`; }).join('')}</div>
      <div>${h.version === v ? '' : `<button class="btn sm" data-rv="${h.version}">Bu sürüme dön</button>`}</div></div>`).join('')}
    ${H ? `<div class="ver"><div class="v" style="color:var(--tx3)">v0</div><div><div class="note">Koddaki varsayılan değerler</div></div><div>${v === 0 ? '' : '<button class="btn sm" data-rv="0">Varsayılanlara dön</button>'}</div></div>` : ''}</div></div>`;
  main.querySelectorAll('[data-rv]').forEach((b) => (b.onclick = async () => {
    const n = +b.dataset.rv;
    if (pending().length && !confirm('Kaydedilmemiş değişiklikler silinecek. Devam edilsin mi?')) return;
    if (!confirm(n ? `v${n} ayarlarına dönülsün mü? Yeni maçlarda geçerli olur.` : 'Tüm ayarlar varsayılana dönsün mü?')) return;
    try { const r = await api('POST', '/api/revert', { version: n }); S.saved = { ...r.overrides }; S.draft = { ...r.overrides }; S.meta = r.meta; toast(`Geri alındı: sürüm v${r.version}`); shell(); loadHistory(); } catch (e) { toast(e.message, true); }
  }));
}

// ───────── Oyuncu hesapları ─────────
const when = (t) => (t ? new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
async function loadPlayers() {
  try { [S.accts, S.bans] = await Promise.all([api('GET', '/api/accounts'), api('GET', '/api/bans')]); } catch (e) { toast(e.message, true); return; }
  if (S.view === 'players') { const m = document.getElementById('main'); if (m) renderPlayers(m); }
}
// Banlar: oyunda moderatörün /ban komutuyla eklenir (data/bans.json; moderatörler data/mods.json)
const left = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${Math.max(1, m)} dk` : m < 1440 ? `${Math.floor(m / 60)} sa ${m % 60} dk` : `${Math.floor(m / 1440)} gün`; };
function bansHTML() {
  const B = S.bans || [];
  return `<h2 style="margin-top:28px">Banlar</h2><p class="lead">Oyunda moderatörün <code>/ban</code> komutuyla eklenir. Moderatör hesapları sunucuda <code>data/mods.json</code> dosyasında (yeniden başlatma gerekmez).</p>
    <div class="card" style="padding:0;overflow:auto"><table class="atbl"><thead><tr><th>Ad</th><th>Tür</th><th>IP</th><th>Kalan</th><th>Sebep</th><th>Banlayan</th><th>Tarih</th><th></th></tr></thead><tbody>
    ${B.map((b) => `<tr><td><b>${esc(b.name)}</b></td><td>${b.acct ? 'hesap' : 'misafir'}</td><td style="font-family:monospace">${esc(b.ip || '—')}</td><td>${b.until ? left(b.until - Date.now()) : 'kalıcı'}</td><td>${esc(b.reason || '—')}</td><td>${esc(b.by || '')}</td><td>${when(b.at)}</td>
      <td style="text-align:right"><button class="btn sm" data-unban="${esc(b.name)}">Banı kaldır</button></td></tr>`).join('') || '<tr><td colspan="8"><div class="empty">Aktif ban yok</div></td></tr>'}
    </tbody></table></div>`;
}
function renderPlayers(main) {
  const L = S.accts, f = (S.acctQ || '').toLocaleLowerCase('tr');
  const rows = (L || []).filter((a) => !f || a.name.toLocaleLowerCase('tr').includes(f));
  main.innerHTML = `<div class="page"><h2>Hesaplar</h2><p class="lead">Oyunda ad + şifreyle kayıt olan oyuncular (misafirler burada görünmez). Şifre sıfırlanınca yeni şifre yalnız bir kez gösterilir ve oyuncunun tüm cihazlarındaki oturum kapanır.</p>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px"><input class="inp" id="aq" placeholder="Ad ara" value="${esc(S.acctQ || '')}" style="max-width:260px"><span style="color:var(--tx2)">${L ? `${rows.length} / ${L.length} hesap` : 'Yükleniyor…'}</span></div>
    <div class="card" style="padding:0;overflow:auto"><table class="atbl"><thead><tr><th>Ad</th><th>Kayıt</th><th>Son görülme</th><th>Maç</th><th>XP</th><th title="Öldürme / Asist / Ölüm">K / A / D</th><th>Cihaz</th><th></th></tr></thead><tbody>
    ${rows.map((a) => `<tr><td><b>${esc(a.name)}</b></td><td>${when(a.created)}</td><td>${when(a.seen)}</td><td>${a.matches}</td><td>${a.xp}</td><td style="white-space:nowrap">${a.kills ?? 0} / ${a.assists ?? 0} / ${a.deaths ?? 0}</td><td>${a.devices}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-reset="${esc(a.name)}">Şifre sıfırla</button> <button class="btn sm dan" data-del="${esc(a.name)}">Sil</button></td></tr>`).join('') || `<tr><td colspan="8"><div class="empty">${L ? 'Hesap yok' : 'Yükleniyor…'}</div></td></tr>`}
    </tbody></table></div>${bansHTML()}</div>`;
  main.querySelectorAll('[data-unban]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`${b.dataset.unban} banı kaldırılsın mı?`)) return;
    try { await api('POST', '/api/bans/remove', { name: b.dataset.unban }); toast(`${b.dataset.unban} banı kaldırıldı`); loadPlayers(); } catch (e) { toast(e.message, true); }
  }));
  const aq = main.querySelector('#aq');
  aq.oninput = () => { S.acctQ = aq.value; renderPlayers(main); const n = main.querySelector('#aq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  main.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm(`${b.dataset.del} hesabı kalıcı olarak silinsin mi? Seviye / istatistik de gider, ad yeniden alınabilir olur.`)) return;
    try { await api('POST', '/api/accounts/delete', { name: b.dataset.del }); toast(`${b.dataset.del} silindi`); loadPlayers(); } catch (e) { toast(e.message, true); }
  }));
  main.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = async () => {
    const nm = b.dataset.reset;
    if (!confirm(`${nm} için yeni şifre üretilsin mi? Eski şifre ve açık oturumlar geçersiz olur.`)) return;
    try {
      const r = await api('POST', '/api/accounts/reset', { name: nm });
      const d = document.createElement('div'); d.className = 'modal';
      d.innerHTML = `<div class="box"><div class="bh"><h3 style="margin:0">Yeni şifre: ${esc(nm)}</h3></div><div class="bb"><p class="lead" style="color:var(--tx2)">Bu şifre yalnız şimdi görünür, sonra tekrar gösterilemez. Oyuncuya ilet; unutursa buradan yeniden sıfırlanır.</p>
        <input class="inp" id="npw" readonly value="${esc(r.pw)}" style="font-size:20px;letter-spacing:2px;font-family:monospace"></div>
        <div class="bf"><button class="btn" id="ncp">Kopyala</button><button class="btn pri" id="nok">Tamam</button></div></div>`;
      document.body.appendChild(d);
      d.querySelector('#npw').select();
      d.querySelector('#ncp').onclick = () => { navigator.clipboard?.writeText(r.pw).then(() => toast('Kopyalandı'), () => {}); };
      d.querySelector('#nok').onclick = () => d.remove();
    } catch (e) { toast(e.message, true); }
  }));
}

// ───────── Hesap ─────────
function renderAccount(main) {
  main.innerHTML = `<div class="page"><div style="max-width:380px"><h2>Hesap</h2><p class="lead">Admin şifresini değiştir. Değişince tüm oturumlar kapanır.</p>
    <form id="pf"><label class="fld"><span>Mevcut şifre</span><input class="inp" id="p0" type="password" autocomplete="current-password"></label>
    <label class="fld"><span>Yeni şifre (en az 8 karakter)</span><input class="inp" id="p1" type="password" autocomplete="new-password"></label>
    <label class="fld"><span>Yeni şifre tekrar</span><input class="inp" id="p2" type="password" autocomplete="new-password"></label>
    <div class="err" id="pe"></div><button class="btn pri wide">Şifreyi değiştir</button></form>
    <button class="btn wide" id="lo" style="margin-top:28px">${ic('logout')} Çıkış yap</button></div></div>`;
  document.getElementById('pf').onsubmit = async (e) => {
    e.preventDefault();
    const [a, b, c] = ['p0', 'p1', 'p2'].map((id) => document.getElementById(id).value), pe = document.getElementById('pe');
    if (b.length < 8) { pe.textContent = 'Yeni şifre en az 8 karakter olmalı'; return; }
    if (b !== c) { pe.textContent = 'Yeni şifreler aynı değil'; return; }
    try { await api('POST', '/api/password', { old: a, pw: b }); toast('Şifre değişti, yeniden giriş yap'); renderLogin(); } catch (er) { pe.textContent = er.message; }
  };
  document.getElementById('lo').onclick = async () => { try { await api('POST', '/api/logout', {}); } catch { /* yok */ } renderLogin(); };
}

// ───────── Açılış ─────────
async function boot() {
  const b = await api('GET', '/api/balance');
  S.defs = b.defaults; S.saved = { ...b.overrides }; S.draft = { ...b.overrides }; S.meta = b.meta;
  const h = location.hash.slice(1);
  if (PAGES.some((p) => p.id === h)) S.view = h;
  try { S.rooms = await api('GET', '/api/rooms'); } catch { /* yok */ }
  shell();
  if (S.view === 'history') loadHistory();
  if (S.view === 'servers') loadServers();
  if (S.view === 'players') loadPlayers();
  clearInterval(roomTimer);
  roomTimer = setInterval(() => { if (S.view === 'servers' && !document.querySelector('.modal')) loadServers(); else if (S.view === 'rooms' || document.querySelector('.pill.live')) loadRooms(); }, 3000);
}
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== S.view && PAGES.some((p) => p.id === h) && S.defs && Object.keys(S.defs).length) go(h); });
addEventListener('beforeunload', (e) => { if (pending().length) { e.preventDefault(); e.returnValue = ''; } });
boot().catch(() => renderLogin());
