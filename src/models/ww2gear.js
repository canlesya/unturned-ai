import * as THREE from 'three';
import { box, taperBox, cylY } from '../core/geo.js';

// 1940'lar üniformaları (Cephe modu, 12.158): iki genel / kurgusal ordu — GERÇEK nişan, sembol, bayrak YOK. Takımı sol koldaki renkli bant (Mavi / Kırmızı) ayırır.
// Mavi: yeşil-haki ceket + yuvarlak çelik miğfer, kanvas tozluk + kahve bot, haki kemer / fişeklik, sırtta çanta + kürek.
// Kırmızı: gri ceket + kenarlı (etekli) çelik miğfer, uzun siyah çizme, siyah deri kemer + Y askı + fişeklikler, sırtta silindir gaz maskesi kutusu + ekmek torbası.
// Gövde / kol / bacak kutuları character.js'den (renkler buradan): shirt = ceket, pants = pantolon, gloves = koyu deri eldiven (birinci şahısta da), boots = bot.
const LOOK = {
  blue: { shirt: '#5f6142', pants: '#585a3d', vest: '#857857', helmet: '#4b5036', gloves: '#3a2e24', boots: '#3d2c1f', accent: '#4aa3ff',
    belt: '#857857', pouch: '#7a6e50', strap: '#7c704f', metal: '#6a6a62', legging: '#958763', pack: '#6e6648', cuff: '#4f5137' },
  red: { shirt: '#5c5f58', pants: '#53564f', vest: '#26221f', helmet: '#474b48', gloves: '#262220', boots: '#1d1b19', accent: '#ff5a43',
    belt: '#26221f', pouch: '#2b2622', strap: '#2b2622', metal: '#5e605c', legging: '#1d1b19', pack: '#4f513f', cuff: '#4b4e48' },
};
export const ww2Look = (team) => ({ ...(LOOK[team] || LOOK.blue), ww2: true });

const dk = (c, k) => new THREE.Color(c).multiplyScalar(k).getStyle();

// torso merkezi y = 0 (gövde kutusu 0,46 × 0,58 × 0,26); baş grubu torso + 0,47; bacak grupları kalça / diz / ayak
export function ww2Gear(parts, c, team, cls, skin, face) {
  const { torso, head, legs } = parts, blue = team !== 'red';
  // ── ceket: etek, yaka, göğüs cepleri, düğmeler, omuz apoletleri (düz), dirsek yamaları yok
  box(torso, [0.5, 0.17, 0.3], dk(c.shirt, 0.94), [0, -0.27, 0]);                                   // ceket eteği (kemerin altı)
  box(torso, [0.21, 0.07, 0.19], dk(c.shirt, 0.86), [0, 0.31, 0]);                                   // yaka
  for (const sx of [-1, 1]) {
    box(torso, [0.12, 0.1, 0.014], dk(c.shirt, 0.88), [sx * 0.115, 0.12, -0.134]);                 // göğüs cebi
    box(torso, [0.125, 0.035, 0.018], dk(c.shirt, 0.78), [sx * 0.115, 0.17, -0.136]);              // cep kapağı
    box(torso, [0.13, 0.11, 0.016], dk(c.shirt, 0.9), [sx * 0.12, -0.27, -0.152]);                  // etek cebi
    box(torso, [0.17, 0.035, 0.17], dk(c.shirt, 0.82), [sx * 0.3, 0.29, 0]);                       // apolet / omuz dikişi
  }
  for (let i = 0; i < 4; i++) box(torso, [0.022, 0.022, 0.012], c.metal, [0, 0.22 - i * 0.11, -0.137]);   // düğmeler
  // ── kemer + fişeklikler + askılar
  box(torso, [0.48, 0.06, 0.29], c.belt, [0, -0.17, 0]);
  box(torso, [0.07, 0.05, 0.016], c.metal, [0, -0.17, -0.152]);                                      // toka
  const pn = blue ? 2 : 3;
  for (const sx of [-1, 1]) for (let i = 0; i < pn; i++) {
    const x = sx * (0.085 + i * (blue ? 0.085 : 0.06));
    box(torso, [blue ? 0.075 : 0.052, blue ? 0.085 : 0.07, 0.05], c.pouch, [x, -0.14, -0.163]);
    box(torso, [blue ? 0.077 : 0.054, 0.022, 0.054], dk(c.pouch, 0.82), [x, -0.103, -0.163]);
  }
  for (const sx of [-1, 1]) {
    box(torso, [0.045, 0.34, 0.012], c.strap, [sx * 0.12, 0.08, -0.137], [0, 0, sx * 0.08]);        // ön askılar
    box(torso, [0.045, 0.06, 0.29], c.strap, [sx * 0.15, 0.27, 0]);                                  // omuz üstü
  }
  if (blue) box(torso, [0.045, 0.36, 0.012], c.strap, [0, 0.08, 0.137], [0, 0, 0]);                  // arkada tek askı (X)
  else for (const sx of [-1, 1]) box(torso, [0.045, 0.36, 0.012], c.strap, [sx * 0.07, 0.08, 0.137], [0, 0, -sx * 0.32]);   // arkada Y askı
  // ── sırt: Mavi çanta + battaniye rulosu + kürek · Kırmızı gaz maskesi kutusu (oluklu) + ekmek torbası + matara
  if (blue) {
    box(torso, [0.3, 0.26, 0.11], c.pack, [0, 0.05, 0.19]);
    box(torso, [0.31, 0.06, 0.12], dk(c.pack, 0.85), [0, 0.16, 0.19]);
    cylY(torso, 0.06, 0.06, 0.34, '#7d7356', [0, 0.23, 0.2], 8, [0, 0, Math.PI / 2]);
    box(torso, [0.025, 0.28, 0.025], '#6b5137', [0.09, -0.07, 0.255], [0.1, 0, 0]);                   // kürek sapı
    box(torso, [0.13, 0.16, 0.02], c.metal, [0.09, -0.27, 0.27]);                                      // kürek ağzı (kılıflı)
    cylY(torso, 0.05, 0.05, 0.14, '#6a6a55', [0.2, -0.24, 0.1], 8);                                    // matara
  } else {
    cylY(torso, 0.062, 0.062, 0.3, c.metal, [-0.14, -0.06, 0.2], 10);                                  // gaz maskesi kutusu
    for (let i = 0; i < 4; i++) cylY(torso, 0.065, 0.065, 0.012, dk(c.metal, 0.8), [-0.14, -0.15 + i * 0.06, 0.2], 10);
    cylY(torso, 0.066, 0.066, 0.02, dk(c.metal, 0.7), [-0.14, 0.095, 0.2], 10);
    box(torso, [0.2, 0.16, 0.08], '#5d5a48', [0.14, -0.28, 0.17]);                                     // ekmek torbası
    cylY(torso, 0.048, 0.048, 0.13, '#3b3a33', [0.22, -0.2, 0.1], 8);                                  // matara
  }
  // ── sınıf ayrıntısı
  if (cls === 'medic') {
    box(torso, [0.22, 0.17, 0.09], '#b8b19a', [-0.16, -0.27, -0.06]);                                  // sağlık çantası (işaretsiz)
    box(torso, [0.155, 0.06, 0.155], '#e8e4d6', [-0.3, 0.14, 0]);                                      // beyaz kol bandı (işaretsiz)
  } else if (cls === 'heavy') {
    for (let i = 0; i < 6; i++) box(torso, [0.07, 0.11, 0.06], dk(c.pouch, 0.95), [-0.21 + i * 0.084, -0.13, -0.17]);   // ağır fişeklik kuşağı
    box(torso, [0.05, 0.62, 0.014], c.strap, [0.02, 0.0, -0.14], [0, 0, 0.62]);
  } else if (cls === 'engineer') {
    box(torso, [0.06, 0.14, 0.04], '#3e3b35', [0.22, -0.26, -0.1]);                                    // tel makası
    box(torso, [0.18, 0.12, 0.08], dk(c.pack, 0.9), [0.16, -0.27, 0.12]);
  } else if (cls === 'assault') {
    if (blue) for (const sx of [-1, 1]) cylY(torso, 0.032, 0.032, 0.07, '#4a4d3a', [sx * 0.2, 0.0, -0.15], 8);   // askıda bombalar
    else box(torso, [0.025, 0.3, 0.025], '#8a6a44', [-0.06, -0.13, -0.16], [0, 0, 0.35]);              // kemerde saplı bomba
  }
  // ── baş: yüz (saçsız) + miğfer
  face(head, skin, { noHair: true });
  box(head, [0.31, 0.06, 0.31], '#3a2a1c', [0, 0.12, 0.01]);                                           // kısa saç (miğfer altında)
  if (cls === 'sniper' && !blue) {                                                                     // Kırmızı keskin nişancı: siperlikli kumaş kep
    taperBox(head, [0.33, 0.12, 0.34], c.shirt, [0, 0.17, 0.0], null, [0.92, 0.92], [1, 1]);
    box(head, [0.3, 0.02, 0.1], dk(c.shirt, 0.7), [0, 0.12, -0.2], [-0.12, 0, 0]);
  } else if (blue) {                                                                                   // yuvarlak çelik miğfer (kubbe + dar siperlik) + çene kayışı
    taperBox(head, [0.37, 0.15, 0.39], c.helmet, [0, 0.16, 0.0], null, [0.74, 0.74], [1, 1]);
    taperBox(head, [0.26, 0.05, 0.27], c.helmet, [0, 0.255, 0.0], null, [0.7, 0.7], [1, 1]);
    box(head, [0.41, 0.025, 0.43], dk(c.helmet, 0.85), [0, 0.085, 0.0]);
    if (cls === 'sniper') for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; box(head, [0.07, 0.02, 0.05], i % 2 ? '#7a6a48' : '#5d5a3a', [Math.cos(a) * 0.17, 0.2, Math.sin(a) * 0.17], [0, -a, 0.35]); }   // çuval bezi ağ
  } else {                                                                                             // kenarlı (etekli) çelik miğfer: kubbe + yanda / arkada aşağı açılan etek
    taperBox(head, [0.35, 0.16, 0.37], c.helmet, [0, 0.165, -0.005], null, [0.78, 0.78], [1, 1]);
    taperBox(head, [0.24, 0.05, 0.25], c.helmet, [0, 0.265, -0.005], null, [0.72, 0.72], [1, 1]);
    taperBox(head, [0.37, 0.07, 0.36], dk(c.helmet, 0.9), [0, 0.065, 0.025], null, [0.95, 0.95], [1.1, 1.12]);
    box(head, [0.34, 0.025, 0.06], dk(c.helmet, 0.85), [0, 0.085, -0.19], [0.25, 0, 0]);                // kısa ön siperlik
  }
  for (const sx of [-1, 1]) box(head, [0.018, 0.14, 0.018], '#2a2420', [sx * 0.162, -0.03, -0.04]);    // çene kayışı
  // ── bacaklar: Mavi kanvas tozluk + kahve bot · Kırmızı uzun deri çizme
  for (const s of ['L', 'R']) {
    const kn = legs[s].knee, ft = legs[s].foot;
    if (blue) {
      box(kn, [0.175, 0.22, 0.205], c.legging, [0, -0.29, 0]);
      for (let i = 0; i < 3; i++) box(kn, [0.18, 0.012, 0.21], dk(c.legging, 0.8), [0, -0.21 - i * 0.065, 0]);
    } else {
      box(kn, [0.18, 0.33, 0.21], c.boots, [0, -0.235, 0]);
      box(kn, [0.19, 0.03, 0.22], dk(c.boots, 1.6), [0, -0.075, 0]);
    }
    box(ft, [0.175, 0.025, 0.31], '#151311', [0, -0.0475, -0.045]);                                     // taban
    box(legs[s].thigh, [0.04, 0.12, 0.11], dk(c.pants, 0.86), [s === 'R' ? 0.1 : -0.1, -0.22, 0]);    // pantolon cebi
  }
}
