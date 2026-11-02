// Kum Köyü yerleşim planı (12.224) — SABİT VERİ, elle düzenlenir. Terk edilmiş çöl köyü, Uyku Modu (5v5 tur) için küçük rekabetçi harita.
// Yalnız GÜNEY yarısı (z ≥ 0, Mavi taraf) yazılır; kuzey yarısı z → −z aynasıyla kurulur (iki taraf birebir aynı: adil). Izgara 0,5 m, kenarlar 0,5'in katı.
// Sıra: oynanış alanının her hücresi önce DOLGU bina kütlesi → BLOCKS (bina kütlesi, kendi no + tepe) → OPEN (yürünen zemin, kot h) → ISLANDS (açık alan
// içindeki kütle) → dış halka OUTSIDE (köy duvarı, tepe OUT_TOP). Sonuç Çöl Geçidi planıyla aynı biçimde: GRID / FLOORS / MASSES / OUTSIDE
// (assets/colgecidi/layout.js makeLayout bunu hücre ızgarasına çevirir). Kütle tepeleri ≥ 6 m: damdan / pencereden sıçrayan oyuncu (1,45 m) bina üstüne çıkamaz.
//
// Üç hat: BATI = Dar Sokak (Han Sokağı → kıvrımlı 3 m'lik sokak → Fırın Avlusu), ORTA = Meydan (Han Önü adası → Sebil'li meydan, kamyon enkazı),
// DOĞU = Evler (Evler Sokağı, girilen Damlı Ev + dama çıkan merdiven, iki katlı Konak). Kavşaklar: Kemer (Dar Sokak ↔ Meydan), Batı Geçidi (Fırın ↔ Meydan),
// Doğu Geçidi (Meydan ↔ Evler), Konak Önü (Meydan ↔ Konak zemin kat), Arka Geçit (Konak doğusu).
export const PLAY = { minX: -33, maxX: 33, minZ: -37, maxZ: 37 };          // oynanış alanı (dışı köy duvarı)
export const OUT_TOP = 6.5;                                                  // çevre duvarı tepesi
const FILL = [90, 7.0];                                                       // tanımsız dolgu kütlesi

// [no, tepe, x0, z0, x1, z1] — bina kütleleri (güney yarısı). z0 = 0 olan kütle kuzey aynasıyla tek bina (aynı no); diğerlerinin aynası no + 50.
const BLOCKS = [
  [1, 7.5, -33, 14, -30, 37],          // batı kenarı evleri
  [2, 6.5, -30, 33, -13, 37],          // Han Sokağı'nın güneyi
  [3, 7.0, -27, 17, -15, 30],          // Dar Sokak ile Han arası
  [4, 6.5, -22, 12, -15, 17],          // kıvrım ile Kemer arası
  [5, 7.5, -33, 5, -25, 14],           // Dar Sokak'ın batısı
  [6, 7.0, -33, 0, -31, 5],            // Fırın Avlusu batı duvarı (iki yarı tek bina)
  [7, 6.0, -22, 1.5, -12, 9.5],        // Fırın Avlusu ↔ Kemer arası
  [8, 7.0, -15, 12, -8, 27],           // Han Önü batısı
  [9, 6.0, -15, 27, 0, 30],            // Han kuzey duvarı (batı yarı; kapı yok: Han'dan çıkış yalnız batı / doğu kapısı)
  [10, 6.0, -15, 29, -13, 37],         // Han batı duvarı
  [11, 6.0, 0, 27, 15, 30],            // Han kuzey duvarı (doğu yarı)
  [12, 6.0, 13, 29, 15, 37],           // Han doğu duvarı
  [13, 7.0, 8, 13, 17, 27],            // Han Önü doğusu
  [14, 6.5, 12, 9.5, 17, 13],          // Doğu Geçidi kuzeyi
  [15, 7.0, 12, 5, 17, 7],             // Konak Önü ile Doğu Geçidi arası
  [16, 6.5, 15, 33, 33, 37],           // doğu Han sokağının güneyi
  [17, 7.5, 23, 19, 33, 33],           // Damlı Ev'in güneyi (büyük ev)
  [18, 6.5, 30, 0, 33, 5],             // Arka Geçit doğusu (iki yarı tek bina)
  [19, 8.0, 15, 27, 17, 30],           // köşe kulesi
];
// [x0, z0, x1, z1, h] — yürünen zemin (düz, kot h)
const OPEN = [
  [-13, 29, 13, 37, 0.45],             // Han avlusu (doğuş; set 0,45)
  [-15, 30, -13, 33, 0],               // Han batı kapısı → Han Sokağı
  [13, 30, 15, 33, 0],                 // Han doğu kapısı → doğu Han sokağı
  [-30, 30, -15, 33, 0],               // Han Sokağı (batı)
  [-18, 24, -15, 30, 0],               // Batı Han geçidi (Han Sokağı → Han Önü; kıvrımlı)
  [-15, 24, -8, 27, 0],
  [-30, 14, -27, 30, 0],               // Dar Sokak 1
  [-30, 14, -22, 17, 0],               // Dar Sokak kıvrımı
  [-25, 5, -22, 14, 0],                // Dar Sokak 2
  [-31, 0, -19, 5, 0],                 // Fırın Avlusu
  [-19, 0, -12, 1.5, 0],               // Batı Geçidi (Fırın ↔ Meydan; aynayla 3 m)
  [-22, 9.5, -12, 12, 0],              // Kemer (Dar Sokak ↔ Meydan)
  [-8, 13, 8, 27, 0],                  // Han Önü (ortasında ada)
  [-12, 0, 12, 13, 0],                 // Meydan
  [-5, 0, 5, 5, 0.45],                 // Sebil seti
  [12, 0, 16, 5, 0],                   // Konak Önü
  [12, 7, 17, 9.5, 0],                 // Doğu Geçidi (Meydan ↔ Evler)
  [15, 30, 23, 33, 0],                 // doğu Han sokağı
  [15, 24, 18, 30, 0],                 // Doğu Han geçidi (doğu Han sokağı → Han Önü)
  [8, 24, 15, 27, 0],
  [17, 19, 23, 30, 0],                 // Evler Sokağı 1
  [17, 5, 24, 19, 0],                  // Evler Sokağı 2
  [16, 0, 27, 5, 0],                   // Konak (iki katlı ev; iç)
  [24, 5, 33, 11, 0],                  // Avlu
  [24, 11, 33, 19, 0],                 // Damlı Ev (iç)
  [27, 0, 30, 5, 0],                   // Arka Geçit
];
const ISLANDS = [
  [20, 6.5, -4, 16, 4, 22],            // Han Önü adası (doğuş kapısından Meydan'a düz görüşü keser)
];

// girilen evler (tam ayak izi; ikisi de plan zemininde, duvarlar build tarafında): Konak orta çizgide tek bina, Damlı Ev her yarıda bir
export const KONAK = { x0: 16, z0: -5, x1: 27, z1: 5 };
export const DAM = { x0: 24, z0: 11, x1: 33, z1: 19 };
export const SPAWN_ZONE = { x0: -13, z0: 29, x1: 13, z1: 37 };          // güney (Mavi) Han avlusu; kırmızı = ayna

export const GRID = { x0: -35, z0: -39, cell: 0.5, nx: 140, nz: 156 };

// ── derleme (deterministik) ──
const mirror = ([x0, z0, x1, z1]) => [x0, -z1, x1, -z0];
function compile() {
  const { x0: gx, z0: gz, cell: C, nx, nz } = GRID, N = nx * nz;
  const kind = new Uint8Array(N);              // 0 dış, 1 kütle, 2 zemin
  const id = new Int16Array(N), top = new Float32Array(N), h = new Float32Array(N);
  const each = (r, fn) => {
    const i0 = Math.round((r[0] - gx) / C), i1 = Math.round((r[2] - gx) / C), j0 = Math.round((r[1] - gz) / C), j1 = Math.round((r[3] - gz) / C);
    for (let j = Math.max(0, j0); j < Math.min(nz, j1); j++) for (let i = Math.max(0, i0); i < Math.min(nx, i1); i++) fn(j * nx + i);
  };
  each([PLAY.minX, PLAY.minZ, PLAY.maxX, PLAY.maxZ], (k) => { kind[k] = 1; id[k] = FILL[0]; top[k] = FILL[1]; });
  const both = (r) => [r, mirror(r)];
  for (const [n, t, ...r] of BLOCKS) both(r).forEach((q, s) => each(q, (k) => { kind[k] = 1; id[k] = s && r[1] > 0 ? n + 50 : n; top[k] = t; }));
  for (const [x0, z0, x1, z1, hh] of OPEN) both([x0, z0, x1, z1]).forEach((q) => each(q, (k) => { kind[k] = 2; h[k] = hh; }));
  for (const [n, t, ...r] of ISLANDS) both(r).forEach((q, s) => each(q, (k) => { kind[k] = 1; id[k] = s && r[1] > 0 ? n + 50 : n; top[k] = t; }));
  // açgözlü dikdörtgen birleştirme (aynı anahtar)
  const rects = (keyOf) => {
    const out = [], used = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      const key = keyOf(k); if (key === null || used[k]) continue;
      const i = k % nx, j = (k / nx) | 0;
      let i2 = i; while (i2 + 1 < nx && !used[j * nx + i2 + 1] && keyOf(j * nx + i2 + 1) === key) i2++;
      let j2 = j; for (;;) { let ok = j2 + 1 < nz; for (let t = i; t <= i2 && ok; t++) { const m = (j2 + 1) * nx + t; if (used[m] || keyOf(m) !== key) ok = false; } if (!ok) break; j2++; }
      for (let jj = j; jj <= j2; jj++) for (let ii = i; ii <= i2; ii++) used[jj * nx + ii] = 1;
      out.push([key, gx + i * C, gz + j * C, gx + (i2 + 1) * C, gz + (j2 + 1) * C]);
    }
    return out;
  };
  const FLOORS = rects((k) => (kind[k] === 2 ? 'f' + h[k] : null)).map(([, x0, z0, x1, z1]) => [x0, z0, x1, z1, 'f', h[(Math.round((z0 - gz) / C)) * nx + Math.round((x0 - gx) / C)]]);
  const MASSES = rects((k) => (kind[k] === 1 ? id[k] + '|' + top[k] : null)).map(([key, x0, z0, x1, z1]) => { const [n, t] = key.split('|').map(Number); return [n, t, x0, z0, x1, z1]; });
  const OUTSIDE = rects((k) => (kind[k] === 0 ? 'o' : null)).map(([, ...r]) => r);
  return { FLOORS, MASSES, OUTSIDE };
}
export const { FLOORS, MASSES, OUTSIDE } = compile();
