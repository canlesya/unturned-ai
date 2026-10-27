// 12.195 Yeniden doldurma koreografisi (CS2 / Valorant düzeni): birinci şahıs ViewModel, üçüncü şahıs karakter, ses ve oyun
// mantığı (mermi şarjöre şarjör YERİNE OTURDUĞU anda girer) aynı zaman çizelgesini kullanır. Saf modül: model / THREE yok (sunucu da yükler).
//
// Sol el (L) ve gerekirse sağ el (R) adlandırılmış noktalar arasında anahtar karelerle gezer: [k, ad, dur?]. Noktaların silah yerelindeki
// yerini her tüketici kendisi çözer (reloadGeo.js): fg = ön kundak / tutamak, mG = takılı şarjörün tutma yeri, mO = tam çıkmış şarjör,
// mA = takmaya yaklaşma, mT = avuçla vuruş, vA = şarjörle kundak arası sol dış şerit (el silahın içinden geçmez), pouch = yelek cebi
// (birinci şahısta ekran dışı sol alt), cH / cB = kurma kolu önde / geride, vC = kurma koluna giden yol, gR / bH / bO = sağ el kabza /
// sürgü kolu / sürgü açık, port / pA = fişek ağzı / altı, bA / bP = kırma namlu yatağı yaklaşma / itme, sA / sP = silindir arkası.
// Ara noktalar Hermite eğrisiyle geçilir ("dur" işaretli karelerde hız 0): konum = Σ katsayı × nokta (doğrusal → her uzayda aynı eğri).
//
// Şarjör durumu (mag): 'gun' takılı (silahla) · 'hand' elde (elin tutma noktasına bağlı, havada süzülmez) · 'drop' bırakıldı (düşer, gizli)
// · 'none' görünmez. item: elde taşınan ufak parça ('shell' fişek, 'round' 40 mm, 'loader' hızlı doldurucu, 'pod' boya tüpü).

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const sm = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const seg = (k, a, b) => clamp01((k - a) / (b - a));

// Silah → doldurma biçimi (modelsiz: sunucu da aynı oturma anını kullanır)
const PISTOLS = new Set(['pistol', 'm1911', 'deagle', 'epistol', 'ww_pistol', 'mac10']);
const MODE_ID = { rpg: 'rocket', m79: 'break', revolver: 'cyl', lmg: 'box', pkm: 'box', pbrifle: 'hopper' };
export function reloadMode(id, st) {
  const rs = st?.reloadStyle || 'mag';
  if (rs === 'shell') return 'shell';
  if (rs === 'clip') return 'clip';
  if (MODE_ID[id]) return MODE_ID[id];
  if (PISTOLS.has(id)) return 'pistol';
  return rs === 'bolt' ? 'bolt' : 'mag';
}

// ── Zaman çizelgeleri (k = 0..1, reloadTotal'e göre) ── E = boş şarjör (tam süre), T = taktik (şarjörde mermi var, ×0,65 süre)
// seat: mermi sayacının dolduğu an (şarjör / fişek / roket yerine oturur) · cue: ses anları · tilt: [kalkış başı, sonu, iniş başı, sonu]
const MAG_E = {
  L: [[0, 'fg', 1], [0.045, 'vF'], [0.1, 'mG', 1], [0.19, 'mO', 1], [0.245, 'vP'], [0.3, 'pouch', 1], [0.36, 'pouch', 1], [0.42, 'vP'], [0.47, 'mA'], [0.52, 'mG', 1], [0.555, 'mT', 1], [0.59, 'mG'], [0.63, 'vC'], [0.67, 'cH', 1], [0.73, 'cB', 1], [0.8, 'vC'], [0.87, 'vF'], [0.93, 'fg', 1], [1, 'fg', 1]],
  mag: [[0, 'gun'], [0.1, 'hand'], [0.2, 'drop'], [0.33, 'hand'], [0.52, 'gun']],
  seat: 0.52, ch: [0.67, 0.73, 0.745], tilt: [0, 0.1, 0.86, 1], slap: 0.52,
  cue: { rel: 0.1, out: 0.15, pouch: 0.34, seat: 0.52, ch1: 0.72, ch2: 0.745 },
};
const MAG_T = {
  L: [[0, 'fg', 1], [0.065, 'vF'], [0.14, 'mG', 1], [0.26, 'mO', 1], [0.33, 'vP'], [0.4, 'pouch', 1], [0.46, 'pouch', 1], [0.54, 'vP'], [0.6, 'mA'], [0.65, 'mG', 1], [0.69, 'mT', 1], [0.73, 'mG'], [0.82, 'vF'], [0.9, 'fg', 1], [1, 'fg', 1]],
  mag: [[0, 'gun'], [0.14, 'hand'], [0.27, 'drop'], [0.43, 'hand'], [0.65, 'gun']],
  seat: 0.65, tilt: [0, 0.1, 0.82, 1], slap: 0.65,
  cue: { rel: 0.14, out: 0.2, pouch: 0.44, seat: 0.65 },
};
// sürgülü (M24): şarjör değişir, boşsa sağ el sürgüyü açıp kapatır (sol el kundağa döner)
const BOLT_E = {
  L: [[0, 'fg', 1], [0.045, 'vF'], [0.1, 'mG', 1], [0.19, 'mO', 1], [0.245, 'vP'], [0.3, 'pouch', 1], [0.36, 'pouch', 1], [0.42, 'vP'], [0.47, 'mA'], [0.52, 'mG', 1], [0.555, 'mT', 1], [0.64, 'vF'], [0.72, 'fg', 1], [1, 'fg', 1]],
  R: [[0, 'gR', 1], [0.58, 'gR', 1], [0.61, 'vR'], [0.64, 'bH', 1], [0.72, 'bO', 1], [0.77, 'bO', 1], [0.83, 'bH', 1], [0.87, 'vR'], [0.92, 'gR', 1], [1, 'gR', 1]],
  mag: MAG_E.mag, seat: 0.52, bolt: [0.64, 0.72, 0.77, 0.83], tilt: [0, 0.1, 0.86, 1], slap: 0.52,
  cue: { rel: 0.1, out: 0.15, pouch: 0.34, seat: 0.52, bolt1: 0.64, bolt2: 0.77 },
};
// tabanca: sağ başparmak şarjörü bırakır (kendi düşer), sol el ekran dışından yeni şarjörle gelir, takar, vurur, iner; boşsa sürgü öne fırlar
const PISTOL = {
  L: [[0, 'pouch', 1], [0.22, 'pouch', 1], [0.34, 'vP'], [0.42, 'mA'], [0.5, 'mG', 1], [0.54, 'mT', 1], [0.6, 'mG'], [0.78, 'pouch', 1], [1, 'pouch', 1]],
  mag: [[0, 'gun'], [0.08, 'drop'], [0.2, 'hand'], [0.5, 'gun']],
  seat: 0.5, slide: 0.58, tilt: [0, 0.12, 0.8, 1], slap: 0.5,
  cue: { rel: 0.06, pouch: 0.3, seat: 0.5, ch2: 0.58 },
};
// RPG: roket (mag grubu) elde ağızdan geriye sürülür
const ROCKET = {
  L: [[0, 'fg', 1], [0.22, 'pouch', 1], [0.3, 'pouch', 1], [0.4, 'vP'], [0.46, 'mO', 1], [0.6, 'mG', 1], [0.64, 'mT', 1], [0.74, 'vF'], [0.86, 'fg', 1], [1, 'fg', 1]],
  mag: [[0, 'none'], [0.27, 'hand'], [0.6, 'gun']],
  seat: 0.6, tilt: [0, 0.12, 0.84, 1], slap: 0.6,
  cue: { pouch: 0.3, out: 0.46, seat: 0.6 },
};
// M79: namlu kırılır (sol el namluyu bastırır), boş kovan fırlar, el cepten 40 mm alır, yatağa iter, namluyu kaldırıp kapatır
const BREAK = {
  L: [[0, 'fgB', 1], [0.15, 'fgB', 1], [0.3, 'pouch', 1], [0.38, 'pouch', 1], [0.52, 'bA'], [0.6, 'bP', 1], [0.66, 'bA'], [0.71, 'vB'], [0.77, 'fgB', 1], [0.9, 'fgB', 1], [1, 'fg', 1]],      // fgB: kundak namluyla döner, el üstünde kalır
  item: [[0, null], [0.34, 'round'], [0.6, null]],
  brk: [0.05, 0.15, 0.8, 0.88], eject: 0.16,
  seat: 0.6, tilt: [0, 0.1, 0.86, 1], slap: 0.6,
  cue: { rel: 0.1, pouch: 0.34, seat: 0.6, cls: 0.88 },
};
// Revolver: silindir sola açılır, kovanlar düşer, hızlı doldurucu silindirin arkasına itilir, bilek silindiri kapatır
const CYL = {
  L: [[0, 'pouch', 1], [0.26, 'pouch', 1], [0.44, 'sA'], [0.54, 'sP', 1], [0.6, 'sA'], [0.78, 'pouch', 1], [1, 'pouch', 1]],
  item: [[0, null], [0.28, 'loader'], [0.56, null]],
  cyl: [0.06, 0.16, 0.68, 0.76], eject: 0.2,
  seat: 0.54, tilt: [0, 0.12, 0.82, 1], slap: 0.54,
  cue: { rel: 0.08, out: 0.2, seat: 0.54, cls: 0.76 },
};
// Hafif makineli (M249 / PKM): kutu değişir, kayış üst kapağa yatırılır, kapak vurulup kapanır; boşsa kurma kolu
const BOX_E = {
  L: [[0, 'fg', 1], [0.045, 'vF'], [0.09, 'mG', 1], [0.17, 'mO', 1], [0.22, 'vP'], [0.27, 'pouch', 1], [0.33, 'pouch', 1], [0.38, 'vP'], [0.43, 'mA'], [0.48, 'mG', 1], [0.53, 'vT'], [0.58, 'tF', 1], [0.64, 'tT', 1], [0.68, 'vC'], [0.72, 'cH', 1], [0.78, 'cB', 1], [0.84, 'vC'], [0.89, 'vF'], [0.94, 'fg', 1], [1, 'fg', 1]],
  mag: [[0, 'gun'], [0.09, 'hand'], [0.18, 'drop'], [0.3, 'hand'], [0.48, 'gun']],
  seat: 0.64, ch: [0.72, 0.78, 0.795], tilt: [0, 0.08, 0.88, 1], slap: 0.64,
  cue: { rel: 0.09, out: 0.13, pouch: 0.3, box: 0.48, seat: 0.64, ch1: 0.77, ch2: 0.795 },
};
const BOX_T = {
  L: [[0, 'fg', 1], [0.06, 'vF'], [0.12, 'mG', 1], [0.22, 'mO', 1], [0.28, 'vP'], [0.34, 'pouch', 1], [0.4, 'pouch', 1], [0.46, 'vP'], [0.51, 'mA'], [0.57, 'mG', 1], [0.62, 'vT'], [0.67, 'tF', 1], [0.74, 'tT', 1], [0.8, 'vT'], [0.87, 'vF'], [0.94, 'fg', 1], [1, 'fg', 1]],
  mag: [[0, 'gun'], [0.12, 'hand'], [0.23, 'drop'], [0.37, 'hand'], [0.57, 'gun']],
  seat: 0.74, tilt: [0, 0.08, 0.86, 1], slap: 0.74,
  cue: { rel: 0.12, out: 0.16, pouch: 0.37, box: 0.57, seat: 0.74 },
};
// Şerit / en-bloc klips: sağ el sürgüyü açar ve tutar, sol el cepten klipsi alıp kılavuza oturtur, başparmakla bastırır; sağ el sürgüyü kapatır
const CLIP = {
  L: [[0, 'fg', 1], [0.08, 'vF'], [0.2, 'pouch', 1], [0.25, 'pouch', 1], [0.32, 'vP'], [0.37, 'cA'], [0.42, 'mO', 1], [0.56, 'mG', 1], [0.6, 'mT', 1], [0.66, 'vP'], [0.74, 'vF'], [0.84, 'fg', 1], [1, 'fg', 1]],
  R: [[0, 'gR', 1], [0.025, 'vR'], [0.05, 'bH', 1], [0.14, 'bO', 1], [0.7, 'bO', 1], [0.78, 'bH', 1], [0.83, 'vR'], [0.88, 'gR', 1], [1, 'gR', 1]],
  mag: [[0, 'none'], [0.22, 'hand'], [0.56, 'gun'], [0.61, 'none']],
  seat: 0.56, bolt: [0.05, 0.14, 0.7, 0.78], tilt: [0, 0.1, 0.88, 1], slap: 0.56,
  cue: null,                                                                  // ses: audio.js clipReload (0,1 sürgü · 0,22 cep · 0,4–0,56 klips · 0,74 / 0,82 sürgü kapanır)
};
// Paintball hazne: el kapağı açar, cepten boya tüpü alır, haznenin üstünde boşaltır, tüpü atar, kapağı kapatır
const HOPPER = {
  L: [[0, 'fg', 1], [0.035, 'vF'], [0.065, 'vH'], [0.095, 'lF', 1], [0.15, 'lO'], [0.28, 'pouch', 1], [0.34, 'pouch', 1], [0.41, 'vH'], [0.47, 'pA'], [0.52, 'pP', 1], [0.66, 'pP', 1], [0.72, 'lO'], [0.8, 'lF', 1], [0.84, 'vH'], [0.88, 'vF'], [0.92, 'fg', 1], [1, 'fg', 1]],
  item: [[0, null], [0.3, 'pod'], [0.69, null]], toss: 0.69,
  lid: [0.09, 0.16, 0.74, 0.8],
  seat: 0.66, tilt: [0, 0.1, 0.86, 1], slap: 0.8,
  cue: { rel: 0.1, pouch: 0.32, out: 0.52, seat: 0.66, cls: 0.8 },
};
// Fişek fişek (pompalı / çift namlu): bir fişek döngüsü c = 0..1; fişek c = 0,8'de girer (Soldier.shellT ile aynı an)
const SHELL_C = [[0, 'pouch', 1], [0.14, 'pouch', 1], [0.56, 'pA'], [0.8, 'port', 1], [0.88, 'pA'], [1, 'pouch', 1]];

const TL = { mag: [MAG_E, MAG_T], bolt: [BOLT_E, MAG_T], pistol: [PISTOL, PISTOL], rocket: [ROCKET, ROCKET], break: [BREAK, BREAK], cyl: [CYL, CYL], box: [BOX_E, BOX_T], clip: [CLIP, CLIP], hopper: [HOPPER, HOPPER] };
const tlOf = (mode, empty) => { const t = TL[mode] || TL.mag; return empty ? t[0] : t[1]; };

// Mermi sayacının dolduğu an (0..1). Fişekte (shell) her fişek kendi anında girer → null
export function reloadSeatK(mode, empty) { return mode === 'shell' ? null : tlOf(mode, empty).seat; }
// Ses anları (k)
export function reloadCues(mode, empty) { return mode === 'shell' ? null : tlOf(mode, empty).cue; }

// Hermite karışımı: anahtar kareler [[t, ad, dur]] → [[ad, katsayı], ...] (katsayılar toplamı 1)
export function keyBlend(keys, k) {
  const n = keys.length, out = [];
  const add = (name, c) => { if (!c) return; for (const e of out) if (e[0] === name) { e[1] += c; return; } out.push([name, c]); };
  if (k <= keys[0][0]) { add(keys[0][1], 1); return out; }
  if (k >= keys[n - 1][0]) { add(keys[n - 1][1], 1); return out; }
  let i = 0; while (i < n - 2 && k >= keys[i + 1][0]) i++;
  const t0 = keys[i][0], t1 = keys[i + 1][0], d = t1 - t0, u = d > 0 ? clamp01((k - t0) / d) : 1;
  const u2 = u * u, u3 = u2 * u;
  add(keys[i][1], 2 * u3 - 3 * u2 + 1); add(keys[i + 1][1], -2 * u3 + 3 * u2);
  const tan = (j, c) => {                                                   // m_j = (P_{j+1} − P_{j−1}) / (t_{j+1} − t_{j−1}); dur / uçlarda 0
    if (keys[j][2] || j === 0 || j === n - 1) return;
    const s = c / (keys[j + 1][0] - keys[j - 1][0]); add(keys[j + 1][1], s); add(keys[j - 1][1], -s);
  };
  tan(i, (u3 - 2 * u2 + u) * d); tan(i + 1, (u3 - u2) * d);
  return out;
}
const stateAt = (list, k) => { let v = list[0][1]; for (const [t, s] of list) if (k >= t) v = s; else break; return v; };
const tiltOf = (T, k) => sm(seg(k, T[0], T[1])) * (1 - sm(seg(k, T[2], T[3])));

// k: 0..1 ilerleme · empty: boş şarjör · ph: fişek döngüsü (shell) · shk: bir fişeğin k cinsinden süresi (shell / reloadTotal)
// Dönüş: { mode, act, tilt, lift, slap, L, R, mag, item, ch, bolt, brk, cyl, lid, slide, seat }
export function reloadPlan(mode, k, empty = true, ph = 0, shk = 0.2) {
  k = clamp01(k);
  if (mode === 'shell') {
    // ilk fişeğe kadar el kundaktan cebe iner; son fişekten sonra reload biter (ViewModel son pozdan kundağa yumuşak döner)
    const tilt = sm(seg(k, 0, Math.min(0.3, shk * 0.5)));
    const into = sm(seg(k, 0, Math.min(0.5, shk * 0.6)));
    const L = keyBlend(SHELL_C, ph).map(([n, c]) => [n, c * into]);
    if (into < 1) L.push(['fg', 1 - into]);
    const slap = Math.max(0, 1 - Math.abs(ph - 0.8) * 14) * into;
    return { mode, act: into, tilt: tilt * 0.9, lift: tilt * 0.5, slap, L, R: null, mag: 'gun', item: ph > 0.1 && ph < 0.8 ? 'shell' : null, ch: 0, bolt: 0, brk: sm(seg(k, 0, Math.min(0.25, shk * 0.4))), cyl: 0, lid: 0, slide: 0, seat: null };
  }
  const T = tlOf(mode, empty);
  const tilt = tiltOf(T.tilt, k);
  const L = keyBlend(T.L, k), R = T.R ? keyBlend(T.R, k) : null;
  const fgW = L.reduce((a, [n, c]) => a + (n === 'fg' || n === 'fgB' ? c : 0), 0);
  const act = Math.max(tilt, 1 - clamp01(fgW));
  const slap = Math.max(0, 1 - Math.abs(k - T.slap) * 22);
  const ch = T.ch ? sm(seg(k, T.ch[0], T.ch[1])) * (1 - sm(seg(k, T.ch[1], T.ch[2]))) : 0;
  const bolt = T.bolt ? sm(seg(k, T.bolt[0], T.bolt[1])) * (1 - sm(seg(k, T.bolt[2], T.bolt[3]))) : 0;
  const brk = T.brk ? sm(seg(k, T.brk[0], T.brk[1])) * (1 - sm(seg(k, T.brk[2], T.brk[3]))) : 0;
  const cyl = T.cyl ? sm(seg(k, T.cyl[0], T.cyl[1])) * (1 - sm(seg(k, T.cyl[2], T.cyl[3]))) : 0;
  const lid = T.lid ? sm(seg(k, T.lid[0], T.lid[1])) * (1 - sm(seg(k, T.lid[2], T.lid[3]))) : 0;
  const slide = T.slide != null ? (k < T.slide ? 1 : 1 - seg(k, T.slide, T.slide + 0.03)) : 0;      // tabanca sürgüsü geride (yalnız boşta)
  return {
    mode, act, tilt, lift: tilt, slap, L, R, ch, bolt, brk, cyl, lid, slide,
    mag: T.mag ? stateAt(T.mag, k) : 'gun', item: T.item ? stateAt(T.item, k) : null,
    toss: T.toss ?? null, eject: T.eject ?? null, seat: T.seat,
  };
}
