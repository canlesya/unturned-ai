// Prosedürel atış sesi sentezi (12.141). Dosya yok, telif yok: her silah sınıfının sesi bir kez örnek örnek hesaplanır (AudioBuffer), maçta yalnız çalınır
// (atış başına 1–3 kaynak; eski katmanlı sentez atış başına 5–7 düğüm kuruyordu). Yakın 2 çeşit + uzak 1 çeşit + kendi silahın mekanik sesi ayrı tampon.
// Katmanlar: çatlama (yüksek geçiren gürültü + ses üstü mermide N-dalgası) · gövde (taranan alçak geçiren gürültü) · havlama (bant geçiren, silahın "rengi")
//            · gümbürtü (perdesi düşen sinüs, yumuşak doyum → tok) · kuyruk (boğuk uzun gürültü) · yansıma (gecikmeli boğuk kopya, açık hava) · tıslama (gaz / roket)
// Uzak tampon: çatlama yok (ses üstü mermide hafif), gövde boğuk, kuyruk ve yansıma uzun. İç / dış mekân farkı audio.js'in ortak yankısında (verbOut) kalır.
//
// TASLAK SEÇİMİ: SHOT_DRAFT = 'A' (eski katmanlı sentez, audio.js) · 'B' (tok, arcade) · 'C' (açık hava, gerçekçi). Oyunda ?sfx=A|B|C ile denenir.
export const SHOT_DRAFT = 'A';                       // 12.156: kullanıcı eski sesleri istedi (A); B / C ?sfx=B|C ile denenebilir

// Sınıf tablosu (B ve C aynı tabloyu kullanır, DRAFTS çarpanlarıyla farklılaşır). Süreler ms, frekanslar Hz.
// c = çatlama [kazanç, sönüm, yüksek geçiren] · nw = N-dalgası (ses üstü) · b = gövde [kazanç, sönüm, f0, f1] · k = havlama [kazanç, sönüm, f, Q]
// t = gümbürtü [kazanç, sönüm, f0, f1] · tl = kuyruk [kazanç, sönüm, f0, f1] · sl = yansıma [gecikme, kazanç] · hs = tıslama [kazanç, sönüm, yüksek geçiren, atak]
// m = mekanik (yalnız kendi silahın): pistol | rifle | smg | revolver | m79 · r = yankı payı (audio.js ortak yankı) · g = sınıf ses düzeyi
export const SYN = {
  pistol: { c: [0.55, 2.2, 2600], b: [0.5, 26, 5200, 900], k: [0.42, 18, 950, 1.6], t: [0.5, 55, 170, 62], tl: [0.13, 160, 1600, 300], sl: [95, 0.16], m: 'pistol', r: 0.25, g: 0.95 },
  pistol45: { c: [0.5, 2.4, 2300], b: [0.58, 32, 4300, 700], k: [0.45, 22, 720, 1.4], t: [0.62, 70, 140, 52], tl: [0.15, 190, 1400, 260], sl: [100, 0.18], m: 'pistol', r: 0.27, g: 1 },
  magnum: { c: [0.75, 3, 2000], nw: 0.5, b: [0.8, 50, 3600, 420], k: [0.55, 30, 540, 1.2], t: [0.85, 110, 105, 38], tl: [0.26, 380, 1200, 170], sl: [110, 0.26], m: 'pistol', r: 0.35, g: 1.12 },
  revolver: { c: [0.7, 2.8, 2100], nw: 0.4, b: [0.75, 46, 3800, 450], k: [0.55, 34, 600, 2.2], t: [0.8, 100, 115, 40], tl: [0.24, 340, 1300, 180], sl: [110, 0.24], m: 'revolver', r: 0.32, g: 1.1 },
  smg: { c: [0.42, 1.6, 3000], b: [0.42, 20, 6200, 1100], k: [0.36, 13, 1150, 1.6], t: [0.34, 40, 200, 80], tl: [0.09, 120, 2000, 340], sl: [90, 0.12], m: 'smg', r: 0.2, g: 0.82 },
  vector: { c: [0.36, 1.5, 3200], b: [0.42, 22, 5200, 900], k: [0.38, 15, 820, 1.4], t: [0.4, 46, 160, 64], tl: [0.08, 110, 1800, 300], sl: [90, 0.1], m: 'smg', r: 0.18, g: 0.8 },
  p90: { c: [0.42, 1.3, 4000], nw: 0.3, b: [0.32, 16, 8000, 1800], k: [0.36, 11, 1700, 2], t: [0.26, 32, 260, 110], tl: [0.08, 110, 2400, 380], sl: [90, 0.1], m: 'smg', r: 0.18, g: 0.78 },
  mac10: { c: [0.4, 1.4, 3000], b: [0.42, 17, 6000, 1000], k: [0.42, 12, 900, 2.4], t: [0.3, 34, 230, 100], tl: [0.07, 100, 2000, 320], sl: [90, 0.1], m: 'smg', r: 0.18, g: 0.8 },
  rifle: { c: [0.62, 2.4, 2400], nw: 0.6, b: [0.62, 34, 4400, 520], k: [0.48, 22, 700, 1.3], t: [0.62, 75, 120, 44], tl: [0.2, 300, 1500, 200], sl: [105, 0.22], m: 'rifle', r: 0.3, g: 1 },
  carbine: { c: [0.6, 2, 2700], nw: 0.55, b: [0.55, 28, 5200, 700], k: [0.44, 18, 1000, 1.5], t: [0.52, 62, 145, 50], tl: [0.17, 260, 1700, 230], sl: [100, 0.2], m: 'rifle', r: 0.28, g: 0.95 },
  battle: { c: [0.7, 2.6, 2200], nw: 0.7, b: [0.72, 40, 4000, 420], k: [0.5, 26, 620, 1.2], t: [0.72, 90, 108, 38], tl: [0.24, 360, 1400, 180], sl: [110, 0.24], m: 'rifle', r: 0.32, g: 1.05 },
  shotgun: { c: [0.6, 2.4, 1800], b: [0.95, 70, 4200, 300], k: [0.45, 40, 420, 0.8], t: [0.95, 130, 100, 32], tl: [0.3, 420, 1100, 150], sl: [115, 0.28], r: 0.36, g: 1.1 },
  aa12: { c: [0.55, 2.2, 2000], b: [0.85, 55, 4200, 320], k: [0.42, 32, 460, 0.9], t: [0.8, 100, 105, 36], tl: [0.22, 300, 1200, 160], sl: [110, 0.22], m: 'rifle', r: 0.3, g: 1.02 },
  dbl: { c: [0.65, 2.6, 1700], b: [1.0, 80, 4200, 260], k: [0.48, 46, 380, 0.8], t: [1.0, 150, 92, 30], tl: [0.34, 480, 1050, 140], sl: [120, 0.3], r: 0.38, g: 1.3 },
  sniper: { c: [0.9, 3.2, 1900], nw: 1, b: [0.9, 60, 4600, 260], k: [0.5, 34, 520, 1], t: [0.95, 150, 90, 28], tl: [0.38, 700, 1200, 120], sl: [130, 0.32], r: 0.42, g: 1.45 },
  dmr: { c: [0.8, 2.8, 2000], nw: 0.85, b: [0.82, 48, 4300, 330], k: [0.5, 30, 560, 1.1], t: [0.85, 120, 100, 34], tl: [0.3, 520, 1300, 140], sl: [120, 0.28], m: 'rifle', r: 0.38, g: 1.12 },
  barrett: { c: [1.0, 3.8, 1500], nw: 1.2, b: [1.1, 85, 3400, 180], k: [0.65, 50, 430, 0.8], t: [1.15, 200, 70, 24], tl: [0.48, 1000, 1000, 100], sl: [140, 0.36], r: 0.45, g: 1.6 },
  lmg: { c: [0.6, 2.2, 2500], nw: 0.55, b: [0.62, 32, 4000, 560], k: [0.5, 20, 760, 1.3], t: [0.6, 70, 112, 42], tl: [0.2, 280, 1500, 200], sl: [105, 0.22], m: 'rifle', r: 0.3, g: 0.98 },
  pkm: { c: [0.66, 2.4, 2300], nw: 0.65, b: [0.7, 38, 3800, 480], k: [0.52, 24, 640, 1.2], t: [0.7, 85, 96, 36], tl: [0.24, 330, 1400, 180], sl: [110, 0.24], m: 'rifle', r: 0.32, g: 1.02 },
  rpg: { c: [0.35, 4, 1500], b: [0.85, 140, 2600, 200], k: [0.4, 60, 300, 0.8], t: [1.0, 220, 75, 28], tl: [0.34, 800, 900, 110], sl: [130, 0.3], hs: [0.32, 520, 2600, 40], r: 0.35, g: 1.3 },
  m79: { c: [0.18, 2, 1800], b: [0.4, 40, 1600, 280], k: [0.35, 28, 480, 1], t: [0.95, 80, 190, 64], tl: [0.12, 200, 900, 180], sl: [100, 0.12], m: 'm79', r: 0.2, g: 0.95 },
  marker: { b: [0.35, 16, 3200, 800], k: [0.62, 12, 1900, 1.3], t: [0.36, 26, 270, 110], hs: [0.16, 55, 6000, 2], r: 0.12, g: 1.05 },
  pbpistol: { b: [0.3, 14, 3500, 900], k: [0.56, 10, 2300, 1.4], t: [0.3, 22, 330, 140], hs: [0.12, 45, 6500, 2], r: 0.1, g: 0.95 },
  suppressed: { b: [0.4, 22, 2600, 500], k: [0.5, 16, 850, 0.9], t: [0.3, 30, 150, 64], tl: [0.03, 80, 1200, 300], hs: [0.08, 30, 5000, 1], m: 'pistol', r: 0.1, g: 0.7 },      // susturucu: oyunda henüz silah yok (taslak / ileride)
};
SYN.def = SYN.rifle;

// Taslak çarpanları: B = tok / arcade (gümbürtü ve doyum yüksek, kuyruk kısa, mekanik belirgin) · C = açık hava / gerçekçi (çatlama + N-dalgası parlak, doyum az, uzun kuyruk + çift yansıma)
export const DRAFTS = {
  B: { c: 1, nw: 0.8, b: 1, k: 1.1, t: 1.45, drive: 2.4, tl: 0.8, tlT: 0.8, sl: 0.7, sl2: 0, mech: 1.15, bright: 1, gain: 0.32 },
  C: { c: 1.3, nw: 1.35, b: 1.1, k: 0.9, t: 0.85, drive: 1.25, tl: 1.3, tlT: 1.4, sl: 1.4, sl2: 0.55, mech: 0.8, bright: 1.15, gain: 0.41 },
};

// ── sayısal yardımcılar ──
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// TPT durum değişkenli süzgeç (ikinci derece); f(i) = örnek başına kesim frekansı (8 örnekte bir yenilenir)
function svf(x, sr, f, Q, mode) {
  const N = x.length, y = new Float32Array(N); let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0; const k = 1 / Q;
  for (let i = 0; i < N; i++) {
    if ((i & 7) === 0) { const g = Math.tan(Math.PI * Math.min(0.45 * sr, Math.max(20, f(i))) / sr); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; }
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    y[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 * k : x[i] - k * v1 - v2;
  }
  return y;
}
const env = (t, att, tau) => (t < 0 ? 0 : (att > 0 ? Math.min(1, t / att) : 1) * Math.exp(-Math.max(0, t - att) / tau));

// Tek atış tamponu (mono Float32Array). far: uzak sürüm · seed: çeşit. Her katman yalnız etkin olduğu süre boyunca hesaplanır (zarf özyinelemeli: örnek başına exp yok)
export function synthShot(kind, draft, sr, seed = 1, far = false) {
  const P = SYN[kind] || SYN.def, D = DRAFTS[draft] || DRAFTS.B, R = rng(seed * 7919 + 13);
  const ms = 0.001, tlT = P.tl ? P.tl[1] * D.tlT * (far ? 1.6 : 1) : 0;
  const slD = P.sl ? P.sl[0] * (far ? 1.3 : 1) : 0;
  const coreT = Math.max(P.t ? P.t[1] * (far ? 1.3 : 1) : 0, P.b ? P.b[1] * (far ? 1.4 : 1) : 0, P.k ? P.k[1] : 0) * 6;
  const len = Math.min(2.2, Math.max(0.25, (Math.max(tlT * 4.2, coreT, P.hs ? P.hs[1] * 6 + P.hs[3] : 0) + (P.sl ? slD * (1 + (D.sl2 ? 1.25 : 0)) : 0)) * ms + 0.03));
  const N = Math.ceil(len * sr), noise = new Float32Array(N);
  for (let i = 0; i < N; i++) noise[i] = R() * 2 - 1;
  const out = new Float32Array(N), core = new Float32Array(N);
  // zarf: doğrusal atak (att sn) + üstel sönüm (tau sn), t0 gecikme; n = etkin örnek sayısı
  const span = (t0, att, tau, k = 7) => Math.min(N, Math.ceil((t0 + att + tau * k) * sr));
  const fillEnv = (x, n, src, off, G, t0, att, tau) => {
    const i0 = Math.round(t0 * sr), na = Math.max(1, Math.round(att * sr)), dk = Math.exp(-1 / (tau * sr));
    let e = 1;
    for (let i = i0; i < n; i++) { const j = i - i0; let a; if (j < na) a = j / na; else { a = e; e *= dk; } x[i] = noise[(i * src + off) % N] * G * a; }
  };
  // çatlama + N-dalgası
  if (P.c && !far) {
    const [g, tau, hp] = P.c, n = span(0, 0.00012, tau * ms, 8), x = new Float32Array(n);
    fillEnv(x, n, 1, 0, g * D.c, 0, 0.00012, tau * ms);
    const nwG = (P.nw || 0) * D.nw * 0.9, nwN = Math.min(n, Math.round(sr * 0.0006));
    for (let i = 0; i < nwN; i++) x[i] += nwG * (1 - (2 * i) / nwN);
    const y = svf(x, sr, () => hp * D.bright, 0.7, 'hp');
    for (let i = 0; i < n; i++) out[i] += y[i];
  } else if (far && P.nw) {                                                         // uzakta ses üstü mermi: kısa, boğuk çatlama
    const nwN = Math.round(sr * 0.0012), G = P.nw * D.nw * 0.35;
    for (let i = 0; i < nwN; i++) out[i] += G * (1 - (2 * i) / nwN);
  }
  // gövde (alçak geçiren gürültü, kesim aşağı taranır)
  if (P.b) {
    const [g, tau, f0, f1] = P.b, T = tau * ms * (far ? 1.4 : 1), F0 = far ? Math.min(1500, f0 * 0.3) : f0 * D.bright, F1 = far ? f1 * 0.6 : f1;
    const n = span(0, 0.0006, T), x = new Float32Array(n);
    fillEnv(x, n, 3, 101, g * D.b * (far ? 0.75 : 1), 0, 0.0006, T);
    const y = svf(x, sr, (i) => F1 + (F0 - F1) * Math.exp(-i / sr / (T * 0.8)), 0.8, 'lp');
    for (let i = 0; i < n; i++) core[i] += y[i];
  }
  // havlama (silahın rengi)
  if (P.k) {
    const [g, tau, f, Q] = P.k, F = far ? f * 0.7 : f, n = span(0, 0.0004, tau * ms), x = new Float32Array(n);
    fillEnv(x, n, 5, 333, g * D.k * (far ? 0.5 : 1) * 2.2, 0, 0.0004, tau * ms);
    const y = svf(x, sr, (i) => F * (1 + 0.25 * Math.exp(-i / sr / 0.01)), Q, 'bp');
    for (let i = 0; i < n; i++) core[i] += y[i];
  }
  // gümbürtü (perdesi düşen sinüs)
  if (P.t) {
    const [g, tau, f0, f1] = P.t, G = g * D.t * (far ? 1.15 : 1), T = tau * ms * (far ? 1.3 : 1), j = 0.97 + R() * 0.06;
    const n = span(0, 0.0015, T), na = Math.round(0.0015 * sr), dk = Math.exp(-1 / (T * sr)), dp = Math.exp(-1 / (T * 0.45 * sr));
    let ph = 0, e = 1, pf = 1;
    for (let i = 0; i < n; i++) { const f = (f1 + (f0 - f1) * pf) * j; pf *= dp; ph += (2 * Math.PI * f) / sr; let a; if (i < na) a = i / na; else { a = e; e *= dk; } core[i] += Math.sin(ph) * G * a; }
  }
  // doyum: gövde + havlama + gümbürtü tek kütle (tok), küçük sinyalde kazanç 1
  const d = D.drive, nC = Math.min(N, Math.ceil(coreT * ms * sr));
  for (let i = 0; i < nC; i++) core[i] = Math.tanh(core[i] * d) / d;
  for (let i = 0; i < nC; i++) out[i] += core[i];
  // yansıma (açık hava: yer / duvar geri dönüşü) — çekirdeğin boğuk kopyası
  if (P.sl) {
    const lp = svf(core.subarray(0, nC), sr, () => (far ? 700 : 1400), 0.7, 'lp');
    const echo = (dl, g) => { const off = Math.round(dl * ms * sr); for (let i = 0; i < nC && i + off < N; i++) out[i + off] += lp[i] * g; };
    echo(slD, P.sl[1] * D.sl * (far ? 1.5 : 1));
    if (D.sl2) echo(slD * 2.25, P.sl[1] * D.sl2 * (far ? 1.3 : 1));
  }
  // kuyruk (boğuk uzun gürültü; yavaş atak)
  if (P.tl) {
    const [g, , f0, f1] = P.tl, T = tlT * ms, n = span(0.004, 0.012, T, 5), x = new Float32Array(n), fk = far ? 0.6 : 1;
    fillEnv(x, n, 7, 777, g * D.tl * (far ? 1.8 : 1), 0.004, 0.012, T);
    const y = svf(x, sr, (i) => fk * (f1 + (f0 - f1) * Math.exp(-i / sr / (T * 0.6))), 0.7, 'lp');
    for (let i = 0; i < n; i++) out[i] += y[i];
  }
  // tıslama (gaz / roket)
  if (P.hs) {
    const [g, tau, hp, att] = P.hs, n = span(0.003, att * ms, tau * ms, 5), x = new Float32Array(n);
    fillEnv(x, n, 11, 59, g * (far ? 0.5 : 1), 0.003, att * ms, tau * ms);
    const y = svf(x, sr, () => (far ? hp * 0.5 : hp), 0.7, 'hp');
    for (let i = 0; i < n; i++) out[i] += y[i];
  }
  const G = (P.g || 1) * D.gain * 0.5 * (far ? (P.tl ? 2.0 : 1.2) : 1);      // uzak: boğuk ama duyulur (yakına göre ≈ eski taslaktaki fark)
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * G * 1.1) / 1.1;      // güvenlik tavanı (≤ 0,91)
  const fade = Math.min(N, Math.round(sr * 0.015)); for (let i = 0; i < fade; i++) out[N - 1 - i] *= i / fade;      // son 15 ms yumuşak bitiş
  return out;
}

// Kendi silahının mekanik sesi (sürgü / kurma kolu / silindir + yere düşen kovan); tek atıştan bağımsız tampon
export function synthMech(type, draft, sr, seed = 1) {
  const D = DRAFTS[draft] || DRAFTS.B, R = rng(seed * 104729 + 7), N = Math.ceil(sr * 0.62), out = new Float32Array(N);
  const click = (t0, f, g) => {
    const i0 = Math.round(t0 * sr), n = Math.min(N - i0, Math.round(sr * 0.06)), x = new Float32Array(n);
    for (let i = 0; i < n; i++) x[i] = (R() * 2 - 1) * Math.exp(-i / sr / 0.0025);
    const y = svf(x, sr, () => f, 4, 'bp');
    for (let i = 0; i < n; i++) { const t = i / sr; out[i0 + i] += g * (y[i] * 2.2 + 0.4 * Math.sin(2 * Math.PI * f * 1.5 * t) * Math.exp(-t / 0.018) + 0.25 * Math.sin(2 * Math.PI * f * 2.37 * t) * Math.exp(-t / 0.009)); }
  };
  const tone = (t0, f, g, tau) => { const i0 = Math.round(t0 * sr); for (let i = 0; i0 + i < N && i < sr * tau * 6; i++) { const t = i / sr; out[i0 + i] += g * Math.sin(2 * Math.PI * f * t) * Math.exp(-t / tau); } };
  const brass = (t0, k = 1) => { for (const [dt, f, g0] of [[0, 5200 + R() * 900, 0.05], [0.055 + R() * 0.03, 6900 + R() * 900, 0.035], [0.1 + R() * 0.04, 4800 + R() * 600, 0.02]]) { const g = g0 * k; tone(t0 + dt, f, g, 0.022); tone(t0 + dt, f * 1.53, g * 0.6, 0.012); } };
  if (type === 'pistol') { click(0.016, 2400, 0.5); click(0.048, 3100, 0.42); tone(0.048, 330, 0.22, 0.012); brass(0.36 + R() * 0.08); }
  else if (type === 'rifle') { click(0.014, 1700, 0.38); click(0.042, 2300, 0.3); tone(0.042, 260, 0.14, 0.014); brass(0.4 + R() * 0.1, 0.45); }      // otomatikte her atışta aynı şıngırtı tekdüze olmasın: kısık
  else if (type === 'smg') { click(0.011, 2100, 0.32); click(0.03, 2800, 0.24); brass(0.38 + R() * 0.1, 0.4); }
  else if (type === 'revolver') { click(0.05, 3600, 0.3); click(0.07, 2600, 0.18); }
  else if (type === 'm79') { click(0.03, 900, 0.3); tone(0.03, 180, 0.2, 0.02); }
  const G = D.mech * 0.55;
  for (let i = 0; i < N; i++) out[i] = Math.tanh(out[i] * G);
  return out;
}

// Önbellek: bağlam başına; taslak / sınıf / çeşit
const CACHE = new WeakMap();
export function shotBuffers(ctx, kind, draft) {
  let M = CACHE.get(ctx); if (!M) CACHE.set(ctx, (M = new Map()));
  const key = draft + ':' + kind; let e = M.get(key);
  if (e) return e;
  const sr = ctx.sampleRate, mk = (a, rate = sr) => { const b = ctx.createBuffer(1, a.length, rate); b.getChannelData(0).set(a); return b; };
  const farSr = Math.min(sr, 32000);
  e = { near: [mk(synthShot(kind, draft, sr, 1)), mk(synthShot(kind, draft, sr, 2))], far: mk(synthShot(kind, draft, farSr, 3, true), farSr), mech: null };
  const mt = (SYN[kind] || SYN.def).m;
  if (mt) { const mk2 = 'mech:' + draft + ':' + mt; let mb = M.get(mk2); if (!mb) M.set(mk2, (mb = mk(synthMech(mt, draft, sr, 5)))); e.mech = mb; }
  M.set(key, e);
  return e;
}
