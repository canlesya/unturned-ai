// Çöl Geçidi kâğıt üstü yerleşim planı → screenshots/colgecidi-plan.png  (node scripts/cg_plan.mjs)
import { chromium } from 'playwright';
const S = 5, W = 190 * S, H = 130 * S, OX = W / 2, OZ = H / 2;
const X = (x) => OX + x * S, Z = (z) => OZ + z * S;
const R = (x0, z0, x1, z1, cls, label, o = {}) => `<rect class="${cls}" x="${X(x0)}" y="${Z(z0)}" width="${(x1 - x0) * S}" height="${(z1 - z0) * S}" rx="${o.rx ?? 3}"/>` + (label ? `<text class="lb ${o.lc || ''}" x="${X((x0 + x1) / 2)}" y="${Z((z0 + z1) / 2) + (o.dy ?? 4)}" text-anchor="middle">${label}</text>` : '');
const C = (x, z, r, cls, t) => `<circle class="${cls}" cx="${X(x)}" cy="${Z(z)}" r="${r * S}"/>` + (t ? `<text class="ob" x="${X(x)}" y="${Z(z) + 6}" text-anchor="middle">${t}</text>` : '');
const parts = [];
// zeminler (yürünebilir alan)
parts.push(R(-95, -65, 95, 65, 'bg'));
parts.push(R(-95, -24, -68, 24, 'bW', 'BATI KAMPI', { lc: 'big', dy: 4 }), R(68, -24, 95, 24, 'bE', 'DOĞU KAMPI', { lc: 'big', dy: 4 }));
// kuzey: Uzun Koridor
parts.push(R(-66, -56, -6, -44, 'rd', 'UZUN KORİDOR (açık)'), R(-6, -56, 2, -44, 'gate', ''), R(2, -53, 34, -47, 'tn', 'DAR GEÇİT'));
parts.push(R(-68, -56, -62, -20, 'rd', ''));
// güney: döndürülmüş
parts.push(R(6, 44, 66, 56, 'rd', 'GÜNEY MEYDAN (açık)'), R(-2, 44, 6, 56, 'gate', ''), R(-34, 47, -2, 53, 'tn', 'TÜNELLER'));
parts.push(R(62, 20, 68, 56, 'rd', ''));
// orta
parts.push(R(-66, -5, -24, 5, 'rd', 'BATI ORTA YOLU'), R(24, -5, 66, 5, 'rd', 'DOĞU ORTA YOLU'));
parts.push(R(-24, -14, 24, 14, 'mid', ''));
parts.push(R(-26, -4, -22, 4, 'gate', ''), R(22, -4, 26, 4, 'gate', ''));
// ara yollar ve kısa geçitler
parts.push(R(-34, -44, -28, -5, 'tn', ''), R(28, 5, 34, 44, 'tn', ''));
parts.push(R(24, -22, 34, -8, 'tn', 'KISA'), R(-34, 8, -24, 22, 'tn', 'ALT'));
// bölgeler
parts.push(R(34, -58, 66, -18, 'siteA', ''), R(-66, 18, -34, 58, 'siteB', ''));
// teraslar (2. kat)
parts.push(R(50, -58, 66, -48, 'up', 'A TERAS +2,4'), R(-66, 48, -50, 58, 'up', 'B TERAS +2,4'));
parts.push(R(-8, -14, 8, -8, 'up', 'GÖZETLEME +2,4'), R(-8, 8, 8, 14, 'up', 'GÖZETLEME +2,4'));
// hedefler
parts.push(C(52, -34, 5.5, 'cA', 'A'), C(-52, 34, 5.5, 'cB', 'B'), C(0, 0, 5.5, 'cM', 'O'));
// spawn işaretleri
for (const [x, z] of [[-88, -16], [-88, 16], [-80, -10], [-80, 10], [-74, -16], [-74, 16]]) parts.push(`<circle class="sp bs" cx="${X(x)}" cy="${Z(z)}" r="4"/>`, `<circle class="sp rs" cx="${X(-x)}" cy="${Z(-z)}" r="4"/>`);
// kapı okları
const A = (x0, z0, x1, z1) => `<line class="ar" x1="${X(x0)}" y1="${Z(z0)}" x2="${X(x1)}" y2="${Z(z1)}"/>`;
parts.push(A(-68, -18, -64, -24), A(-68, 0, -60, 0), A(-68, 18, -62, 24), A(68, 18, 64, 24), A(68, 0, 60, 0), A(68, -18, 62, -24));
// etiketler
const T = (x, z, t, c = 'lb') => `<text class="${c}" x="${X(x)}" y="${Z(z)}" text-anchor="middle">${t}</text>`;
parts.push(T(50, -44, 'A: PAZAR YERİ', 'big'), T(-50, 44, 'B: AVLU', 'big'), T(0, -18, 'ORTA MEYDAN', 'big'));
parts.push(T(-31, -25, 'KUZEY ARA YOL'), T(31, 25, 'GÜNEY ARA YOL'), T(-2, -58, 'UZUN KAPI'), T(2, 59, 'GÜNEY KAPI'), T(-24, 9.5 * 1, ''), T(-24, -6.5, 'ORTA KAPILAR'), T(24, 8.5, 'ORTA KAPILAR'));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<style>
.bg{fill:#171a22}.bW{fill:#233a5e}.bE{fill:#5e2f2f}.rd{fill:#4b4535}.tn{fill:#3a3a44}.mid{fill:#5a5140}.gate{fill:#2f6fa8}.siteA{fill:#6b4e2e}.siteB{fill:#2e5a58}.up{fill:#8a7440;opacity:.9}
rect{stroke:#0c0e13;stroke-width:1.5}
.lb{font:600 11px 'Segoe UI',Arial;fill:#e9e2cf}.big{font:700 15px 'Segoe UI',Arial;fill:#fff;letter-spacing:1px}
.ob{font:800 20px 'Segoe UI',Arial;fill:#fff}.cA{fill:#e0742b}.cB{fill:#2fa59a}.cM{fill:#c9b24a}circle.cA,circle.cB,circle.cM{stroke:#fff;stroke-width:2;opacity:.95}
.sp{stroke:#fff;stroke-width:1}.bs{fill:#4a9bff}.rs{fill:#ff6a5a}.ar{stroke:#fff;stroke-width:2.5;marker-end:none;stroke-dasharray:5 3}
</style>${parts.join('')}
<text x="12" y="${H - 10}" class="lb" style="font-size:12px">Çöl Geçidi · 190×130 m · 180° dönüşümlü simetri (Batı↔Doğu, A↔B) · mavi/kırmızı nokta = doğuş · 5 px = 1 m</text></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(`<body style="margin:0;background:#0c0e13">${svg}</body>`);
await page.screenshot({ path: 'screenshots/colgecidi-plan.png' });
await browser.close();
