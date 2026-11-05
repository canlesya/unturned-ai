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
// 12.234 snap kipi (menü arka planı): hedef ekran hızının TAM BÖLENİNE yuvarlanır (120 Hz → 60 = her 2. kare, 144 → 72, 60 → 60, 240 → 60).
//   12.232'nin 30 FPS'i 144 Hz ekranda 4,8 karede bir = 4 / 5 kare dönüşümlü (dönen kamera tökezliyor); 60 Hz'de de 30 FPS dönen kamera kesik görünüyordu.
//   Karar ekran karesi sayılarak verilir (ölçülen ekran karesi P; zaman damgası oynasa da her k. kare), aradaki kareler rAF'le geçilir (uyku yok).
// İş parçacığı (Worker, OffscreenCanvas) içinde de çalışır: document yoksa görünürlük / odak setPaceState() ile ana iş parçacığından gelir.
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
const subs = new Set();                           // 12.234 durum değişimi dinleyicileri (menü arka planı iş parçacığına iletir)
const changed = () => { for (const f of subs) { try { f(); } catch (e) { console.error(e); } } };
export const onPaceChange = (f) => { subs.add(f); return () => subs.delete(f); };
if (DOM) {
  addEventListener('focus', changed); addEventListener('blur', changed);
  document.addEventListener('visibilitychange', changed);
}
// Durum güncelle (masaüstü ana süreci ya da iş parçacığında ana iş parçacığından gelen { focused, shown, hz, … })
export function setPaceState(s) {
  if (!s || typeof s !== 'object') return;
  const was = st.shown; Object.assign(st, s);
  if (st.shown && !was) for (const p of live) p._vis();                          // pencere geri geldi: gizliyken duran rAF zincirleri yeniden
  changed();
}
desk?.onState?.(setPaceState);
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
globalThis.__pace = { state: st, list: () => [...live].map((p) => ({ name: p.name, on: p.on, fps: p.fps(), P: +p.P.toFixed(2), k: p.k, ...p.stats })) };

function mkChannel() {
  const ch = new MessageChannel(), q = [];
  ch.port1.onmessage = () => { const f = q.shift(); f?.(); };
  return { post: (f) => { q.push(f); ch.port2.postMessage(0); } };
}

export class FramePacer {
  // owner.raf: bekleyen rAF kimliği yazılır (eski betikler cancelAnimationFrame(game.raf) ile durdurabiliyordu)
  // snap: hedef ekran hızının tam bölenine yuvarlanır (12.234, bkz. üst açıklama); this.k = o an çizilen kare aralığı (ekran karesi), this.dtFix(ham) = kare adımı
  constructor(owner, fn, fps, { hiddenTicks = false, name = '', snap = false } = {}) {
    this.o = owner; this.fn = fn; this.fps = fps; this.hiddenTicks = hiddenTicks; this.name = name; this.snap = snap; this.k = 1; this._lastDraw = 0;
    this.next = 0; this.tm = 0; this.on = false;
    this.P = 0; this._cal = []; this._direct = false; this._lastRaf = 0;            // ekran karesi süresi (doğrudan art arda gelen rAF'lerden, ortanca)
    this._tick = (t) => this._frame(t);
    this._vis = () => { if (!this.on) return; this._clear(); this.next = 0; this._raf(); };
    if (DOM) document.addEventListener('visibilitychange', this._vis);
    this.stats = { drawn: 0, skipped: 0, hidden: 0 };
  }
  // Ekran karesine oturtulmuş kare adımı (sn): rAF zaman damgası kareden kareye oynasa da (Electron 120 Hz VSync: 6,7–10,3 ms) adım tam ekran karesi
  // katı → dönen kamera her çizilen karede aynı açı kadar ilerler. Ekran karesi bilinmiyorsa / gerçek takılmada ham süre.
  // Ekran karesi burada ayrıca yavaş ortalanır (ortanca P kareden kareye 8,2 / 8,4 / 8,7 oynayabiliyor → adım da %2–4 oynardı).
  dtFix(raw) {
    const P = this.P;
    if (!(raw > 0)) return 0;
    if (!P || P < 3 || this.timerMode || raw > 250) { this._Pd = 0; return Math.min(raw, 100) / 1000; }
    if (!this._Pd || Math.abs(this._Pd - P) > P * 0.2) this._Pd = P;                 // ilk ölçüm / ekran hızı değişti
    const slots = Math.max(1, Math.round(raw / this._Pd)), per = raw / slots;
    if (Math.abs(per - this._Pd) < this._Pd * 0.25) this._Pd += (per - this._Pd) * 0.02;
    return slots * this._Pd / 1000;
  }
  start() { if (this.on) return; this.on = true; live.add(this); this._raf(true); }
  stop() { this.on = false; this._clear(); }
  dispose() { this.stop(); live.delete(this); if (DOM) document.removeEventListener('visibilitychange', this._vis); }
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
    let want = isHidden() ? HIDDEN : this.fps();
    if (want === HIDDEN) {                                                          // gizli: çizim yok
      this.stats.hidden++;
      if (this.hiddenTicks) { this._later(HIDDEN_TICK, () => this._frame(performance.now())); this.fn(now, false); }
      return;                                                                       // görünür olunca visibilitychange zinciri yeniden başlatır
    }
    if (want > 0 && this.snap && this.P >= 3 && !this.timerMode && this._cal.length >= 5) {     // 12.234 ekran karesi sayarak: her k. karede çiz
      const P = this._Pd && Math.abs(this._Pd - this.P) < this.P * 0.2 ? this._Pd : this.P, k = (this.k = Math.max(1, Math.floor(1000 / want / P + 0.25)));
      const slots = this._lastDraw ? Math.round((now - this._lastDraw) / P) : k;
      if (slots < k) {
        this.stats.skipped++;
        const wait = (k - slots - 1.5) * P - 2;                                       // uzun aralık (odaksız 10 FPS): uyu, hedeften ~1,5 kare önce rAF'e dön
        if (wait > 4) this._later(wait, () => this._raf(false)); else this._raf(true);
        return;
      }
      this._lastDraw = now; this.next = 0;
      this.stats.drawn++;
      this._raf(true);
      this.fn(now, true);
      return;
    }
    if (want > 0) {
      if (this.snap && this.timerMode) want = (+st.hz || 60) / Math.max(1, Math.floor((+st.hz || 60) / want + 0.25));   // sınırsız Chromium: ekran hızının böleni, zamanlayıcıyla
      this._lastDraw = now;
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
    this.next = 0; this._lastDraw = now; this.k = 1;
    this.stats.drawn++;
    this._raf(true);
    this.fn(now, true);
  }
}
