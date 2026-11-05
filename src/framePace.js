// 12.232 Kare temposu: menü / duraklatma / maç sonu ~30 FPS, gizli pencerede çizim yok, masaüstünde isteğe bağlı FPS sınırı (60 / 144 / 240).
// Neden: sınır yoksa ekran kartı kareyi olabildiğince hızlı çizer → sahne ne kadar basit olursa olsun GPU %100 meşgul (masaüstünde VSync kapalı
// menüde 500–600 FPS: GPU süreci %137 CPU, fan). Tarayıcıda da menü sahnesi ekran hızında (120 Hz) boşuna dönüyordu, arka plandaki pencere de çiziyordu.
//
// FramePacer: rAF zincirini tek yerden yönetir. fps() her karede hedefi verir: 0 = her ekran karesi (sınır yok), > 0 = en çok o kadar, HIDDEN = çizme.
//  - Sınır varken kare "zamanı geldiyse" çizilir; sonraki hedef `next += aralık` (kayma birikmez, VSync'te 120 Hz → 60 tam her ikinci kare).
//    Hedefe çok varsa setTimeout ile uyunur, sonra rAF (sınırsız Chromium'da rAF hemen döner: boş rAF selinde ana iş parçacığı dönmesin).
//  - HIDDEN: rAF yok; tick isteyen sahibine (çevrim içi oyun: sim + ağ sürsün) her 100 ms'de fn(now, false) — tarayıcı gizli sekmede zamanlayıcıyı
//    kendisi daha da kısabilir (1 sn), oyun bunu gerçek dt ile telafi eder.
//  - Sınırsız Chromium'da (masaüstü VSync kapalı) sınırlı kareler zamanlayıcıdan çizilir (timerMode).
// Pencere odağı (blur) ve masaüstü (Electron) durumu (__desktop.onState: odak, simge durumu / gizli, pil, ekran hızı, FPS sınırı) buraya akar.
// Electron'da simge durumuna küçültülen / gizlenen pencerede document.hidden değişmiyor (ölçüldü: rAF 30 FPS sürüyordu) → ana süreç "shown" bildirir.
export const HIDDEN = -1;
export const IDLE_FPS = 30;                       // menü, duraklatma, maç sonu, odaksız pencere
const HIDDEN_TICK = 100;                          // gizliyken çevrim içi sim adımı aralığı (ms)

const DOM = typeof document !== 'undefined' && typeof addEventListener === 'function';      // sunucu / başsız Node: game.js bu dosyayı içe aktarır ama FramePacer kurulmaz
const desk = globalThis.__desktop || null;
const st = { focused: true, shown: true, battery: !!desk?.battery, fpsCap: +desk?.fpsCap || 0, hz: +desk?.hz || 0 };
const live = new Set();                           // betikler / F3 paneli için: window.__pace.list() → { ad, çizilen / atlanan / gizli kare, ekran karesi ms }
if (DOM) {
  try { st.focused = document.hasFocus(); } catch { /* yok */ }
  addEventListener('focus', () => { st.focused = true; });
  addEventListener('blur', () => { st.focused = false; });
}
desk?.onState?.((s) => {
  if (!s || typeof s !== 'object') return;
  const was = st.shown; Object.assign(st, s);
  if (st.shown && !was) for (const p of live) p._vis();                          // pencere geri geldi: gizliyken duran rAF zincirleri yeniden
});
export const isHidden = () => (DOM && document.hidden) || st.shown === false;

// Masaüstü FPS sınırı (oyun içi): 0 = yok (VSync ya da sınırsız). Pil + "Sınırsız": ekran hızına (Chromium VSync anahtarı açılışta belirlenir; burada döngü sınırlar).
export function playCap() {
  if (!desk) return 0;
  const cap = +st.fpsCap || 0;
  if (st.battery && desk.uncapped) { const hz = +st.hz || 60; return cap ? Math.min(cap, hz) : hz; }
  return cap;
}
// Odaksız pencere (başka uygulamaya geçildi): oyun da menü gibi 30 FPS. Test kipi (__desktop.inactive: pencere hiç odak almaz) sayılmaz.
export function unfocused() { return !st.focused && !desk?.inactive; }
export const paceState = st;
globalThis.__pace = { state: st, list: () => [...live].map((p) => ({ name: p.name, on: p.on, fps: p.fps(), P: +p.P.toFixed(2), ...p.stats })) };

function mkChannel() {
  const ch = new MessageChannel(), q = [];
  ch.port1.onmessage = () => { const f = q.shift(); f?.(); };
  return { post: (f) => { q.push(f); ch.port2.postMessage(0); } };
}

export class FramePacer {
  // owner.raf: bekleyen rAF kimliği yazılır (eski betikler cancelAnimationFrame(game.raf) ile durdurabiliyordu)
  constructor(owner, fn, fps, { hiddenTicks = false, name = '' } = {}) {
    this.o = owner; this.fn = fn; this.fps = fps; this.hiddenTicks = hiddenTicks; this.name = name;
    this.next = 0; this.tm = 0; this.on = false;
    this.P = 0; this._cal = []; this._direct = false; this._lastRaf = 0;            // ekran karesi süresi (doğrudan art arda gelen rAF'lerden, ortanca)
    this._tick = (t) => this._frame(t);
    this._vis = () => { if (!this.on) return; this._clear(); this.next = 0; this._raf(); };
    document.addEventListener('visibilitychange', this._vis);
    this.stats = { drawn: 0, skipped: 0, hidden: 0 };
  }
  start() { if (this.on) return; this.on = true; live.add(this); this._raf(true); }
  stop() { this.on = false; this._clear(); }
  dispose() { this.stop(); live.delete(this); document.removeEventListener('visibilitychange', this._vis); }
  _clear() { if (this.o.raf) cancelAnimationFrame(this.o.raf); this.o.raf = 0; if (this.tm > 0) clearTimeout(this.tm); this.tm = 0; }
  _raf(direct = false) { this._direct = direct; this.o.raf = requestAnimationFrame(this._tick); }
  _later(ms, fn) {
    clearTimeout(this.tm);
    const go = () => { this.tm = setTimeout(() => { this.tm = 0; this._direct = false; if (this.on) fn(); }, ms); };
    // zamanlayıcıdan kurulan kısa zamanlayıcı (iç içe 5+) tarayıcıda en az 4 ms'ye yuvarlanır (240 sınırı 200'de kalıyordu): ileti kanalından sıçrayıp kur
    if (ms < 4 && this.timerMode) { this.tm = -1; (this._mc ||= mkChannel()).post(() => { if (this.tm === -1 && this.on) go(); }); } else go();
  }
  // Sınırsız Chromium (masaüstü disable-frame-rate-limit): rAF ekrana kilitli değil (P ≈ 1 ms) ve zamanlayıcıdan sonra istenen ilk rAF 5–15 ms geç geliyor
  // (ölçüm: 144 sınırında 76 FPS, kare aralığı sd 7 ms). Bu kipte sınırlı kareler doğrudan zamanlayıcıdan çizilir (tuval değişince bileşikleyici hemen sunar).
  get timerMode() { return !!desk?.uncapped || (this.P > 0 && this.P < 3); }

  _frame(now) {
    this.o.raf = 0;
    if (!this.on) return;
    if (this._direct && this._lastRaf) {                                            // ekran hızı ölçümü: bir rAF'ten doğrudan istenen sonrakine aralık
      const d = now - this._lastRaf;
      if (d > 0.3 && d < 60) { this._cal.push(d); if (this._cal.length > 15) this._cal.shift(); if (this._cal.length >= 5) { const a = [...this._cal].sort((x, y) => x - y); this.P = a[a.length >> 1]; } }
    }
    this._lastRaf = now;
    const want = isHidden() ? HIDDEN : this.fps();
    if (want === HIDDEN) {                                                          // gizli: çizim yok
      this.stats.hidden++;
      if (this.hiddenTicks) { this._later(HIDDEN_TICK, () => this._frame(performance.now())); this.fn(now, false); }
      return;                                                                       // görünür olunca visibilitychange zinciri yeniden başlatır
    }
    if (want > 0) {
      const iv = 1000 / want, tol = this.P ? Math.min(4, Math.max(0.5, this.P * 0.5)) : 2;
      const tm = this.timerMode;
      if (this.next && now < this.next - (tm ? 0.5 : tol)) {                       // zamanı gelmedi: çizme
        this.stats.skipped++;
        if (tm) { this._later(Math.max(0, this.next - now - 0.5), () => this._frame(performance.now())); return; }
        const wait = this.next - now - Math.max(2, this.P || 2) - 1;
        if (wait > 1 && this._cal.length >= 5) this._later(wait, () => this._raf(false));
        else this._raf(true);
        return;
      }
      this.next = this.next && now - this.next < iv ? this.next + iv : now + iv;    // düzenli tempo (geç kaldıysa yeniden başla)
      this.stats.drawn++;
      // önce sonraki kare istenir (fn hata atsa da döngü sürer; eski davranış)
      if (tm) this._later(Math.max(0, this.next - performance.now() - 0.5), () => this._frame(performance.now())); else this._raf(true);
      this.fn(now, true);
      return;
    }
    this.next = 0;
    this.stats.drawn++;
    this._raf(true);
    this.fn(now, true);
  }
}
