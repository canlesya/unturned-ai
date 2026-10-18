// Ortak AudioContext: menü müziği, arayüz tıklamaları ve maç sesleri TEK bağlamı paylaşır (eskiden her maç yeni bağlam açıyordu, kapatılmıyordu → sızıntı / tarayıcı sınırı).
// Tarayıcılar sesi ilk kullanıcı hareketine kadar askıda tutar: ilk pointerdown / keydown / touchend'de resume() edilir (iOS bunu olay işleyicisinin İÇİNDE ister).
let ctx = null;
const waiters = new Set();
const NOISE = new WeakMap();
export const isMobile = () => !!globalThis.matchMedia?.('(pointer:coarse)').matches;

export function getCtx() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return null; }
  return ctx;
}
export const unlocked = () => !!ctx && ctx.state === 'running';
// ses açılınca (ilk hareketten sonra) bir kez çağrılır; zaten açıksa hemen
export function onUnlock(f) { if (unlocked()) f(ctx); else waiters.add(f); }
function unlock() {
  const c = getCtx(); if (!c) return;
  const done = () => { if (c.state !== 'running') return; for (const f of waiters) { try { f(c); } catch (e) { console.error(e); } } waiters.clear(); };
  if (c.state !== 'running') c.resume?.().then(done, () => {}); else done();
}
if (globalThis.addEventListener) for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, unlock, { capture: true, passive: true });

// beyaz gürültü tamponu (bağlam başına bir kez; 1,5 sn döngü)
export function noiseBuf(c) {
  let b = NOISE.get(c); if (b) return b;
  const len = Math.floor(c.sampleRate * 1.5);
  b = c.createBuffer(1, len, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  NOISE.set(c, b); return b;
}
// prosedürel yankı dürtüsü: üstel sönen stereo gürültü, ilk yansımalar biraz seyrek; telefonda kısa (evrişim maliyeti uzunlukla artar)
export function makeIR(c, sec = 1.2, decay = 3.2) {
  const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < n; i++) { const t = i / n, er = i < n * 0.06 ? (Math.random() < 0.08 ? 2.2 : 0.3) : 1; d[i] = (Math.random() * 2 - 1) * er * Math.pow(1 - t, decay) * 0.5; }
  }
  return b;
}

// Arayüz sesleri (menü düğmeleri): kısa, yumuşak "tık" — click / back / confirm / tab / hover; ses seviyesi uiVol (Ana ses × Efekt) ile
let uiOut = null, uiVol = 0.5, uiLast = 0;
export function setUiVolume(v) { uiVol = Math.max(0, Math.min(1, v)); if (uiOut) uiOut.gain.value = uiVol * 0.9; }
const prefVol = () => { try { const p = JSON.parse(localStorage.getItem('warbyte.v2') || '{}'); return (p.volume ?? 0.6) * (p.vSfx ?? 0.9); } catch (e) { return uiVol; } };   // menü ayarı: Ana ses × Efekt
export function uiSound(kind = 'click') {
  const c = ctx; if (!c || c.state !== 'running') return;
  setUiVolume(prefVol()); if (uiVol <= 0) return;
  const t = c.currentTime;
  if (t - uiLast < 0.035) return; uiLast = t;                              // art arda patlama yok
  if (!uiOut) { uiOut = c.createGain(); uiOut.gain.value = uiVol * 0.9; uiOut.connect(c.destination); }
  const P = { click: [1250, 1650, 0.055, 0.16], tab: [980, 1180, 0.05, 0.13], back: [900, 620, 0.07, 0.15], confirm: [700, 1400, 0.12, 0.2], hover: [2200, 2300, 0.02, 0.035] }[kind] || [1250, 1650, 0.055, 0.16];
  const o = c.createOscillator(), e = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2] * 0.6);
  e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(P[3], t + 0.003); e.gain.exponentialRampToValueAtTime(0.0001, t + P[2]);
  o.connect(e); e.connect(uiOut); o.start(t); o.stop(t + P[2] + 0.02);
  o.onended = () => { o.disconnect(); e.disconnect(); };
  if (kind === 'confirm') { const o2 = c.createOscillator(), e2 = c.createGain(); o2.type = 'sine'; o2.frequency.value = 2100; e2.gain.setValueAtTime(0.0001, t + 0.05); e2.gain.exponentialRampToValueAtTime(0.08, t + 0.055); e2.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o2.connect(e2); e2.connect(uiOut); o2.start(t + 0.05); o2.stop(t + 0.22); o2.onended = () => { o2.disconnect(); e2.disconnect(); }; }
}
// Tek yerden: tıklanan düğme türüne göre ses (menü / oyun içi duraklatma; menu.js'e dokunmadan, belge düzeyinde dinler). Tuval (oyun) tıklamaları sessiz.
const UI_SEL = 'button,.btn,[data-a],[data-act],[data-v],.cc,.slot,.tab,a[href],input[type=checkbox],select';
if (globalThis.document) document.addEventListener('click', (e) => {
  const el = e.target?.closest?.(UI_SEL); if (!el || el.disabled) return;
  const txt = (el.textContent || '').trim().toLowerCase(), id = (el.id || '') + ' ' + (el.dataset?.a || '');
  const kind = /back|geri|quit|menu|kapat|close|iptal|cancel|←/.test(id + ' ' + txt) ? 'back' : /start|play|başla|oyna|resume|again|join|katıl|create|kur/.test(id + ' ' + txt) ? 'confirm' : el.dataset?.v != null || el.classList.contains('tab') ? 'tab' : 'click';
  uiSound(kind);
}, true);
