// WarByte admin paneli: denge ayarları (3D önizlemeli), odalar, duyuru, sürüm geçmişi.
// Değerler: S.defs (koddaki varsayılan) ← S.saved (sunucudaki geçersiz kılmalar) ← S.draft (kaydedilmemiş taslak)
import { balanceSections, registerOfficial, GROUP_LABELS, WEAPON_GROUPS } from '../src/game/balance.js';
import { WSTATS, CLASS_DEFS, DIFFICULTY } from '../src/game/stats.js';
import { OFFICIAL } from '../server/official.js';
import { Preview, thumb } from './preview.js';

registerOfficial(OFFICIAL);
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
  { id: 'rooms', label: 'Odalar', icon: 'door' },
  { id: 'announce', label: 'Duyuru', icon: 'speaker' },
  { id: 'history', label: 'Geçmiş', icon: 'history' },
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
  else if (S.view === 'rooms') renderRooms(main);
  else if (S.view === 'announce') renderAnnounce(main);
  else if (S.view === 'history') renderHistory(main);
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
function go(v) { S.view = v; if (location.hash !== '#' + v) history.pushState(null, '', '#' + v); shell(); if (v === 'rooms' || v === 'announce') loadRooms(); if (v === 'history') loadHistory(); }

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
const MAP = { kasaba: 'Kasaba', vadi: 'Vadi', us: 'Askeri Üs', colgecidi: 'Çöl Geçidi', newyork: 'New York', dev: 'Geliştirme' };
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
      ${r.players.length ? r.players.map((p) => `<div class="pl"><i class="tm" style="background:${p.team === 'blue' ? 'var(--blue)' : 'var(--red)'}"></i><span class="n">${esc(p.name)} <span style="color:var(--tx3);font-size:12px">${esc(CLS(p.cls))}</span></span><span class="k">${p.kills}/${p.deaths}</span><button class="btn sm dan" data-kick="${esc(r.code)}:${p.id}" data-nm="${esc(p.name)}">At</button></div>`).join('') : '<div class="empty">Oyuncu yok</div>'}
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
  clearInterval(roomTimer);
  roomTimer = setInterval(() => { if (S.view === 'rooms' || document.querySelector('.pill.live')) loadRooms(); }, 3000);
}
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== S.view && PAGES.some((p) => p.id === h) && S.defs && Object.keys(S.defs).length) go(h); });
addEventListener('beforeunload', (e) => { if (pending().length) { e.preventDefault(); e.returnValue = ''; } });
boot().catch(() => renderLogin());
