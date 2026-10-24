// 12.157 Uzay modu sesleri — atış sesi taslağı A diliyle (audio.js katmanlı sentez: _noise / _tone, mesafe kısması + boğukluk + yankı payı ortak _voice'tan).
// Dosya / telif yok. Enerji silahı = kısa "zap" (perdesi düşen ton) + gövde (süzgeçli gürültü) + alçak gümbürtü; ray tüfeğinde çatlama + uzun kuyruk.
// Atıştan sonra ray tüfeği yeniden şarj olur: yükselen vızıltı + "hazır" tıkı (yalnız kendi silahın, konumsuz). Kask içi: efekt yoluna hafif alçak geçiren (setHelmet).
const SP = {
  //            zap ton [kazanç, süre, f0, f1, dalga]      gövde gürültüsü [kazanç, süre, f0, f1, tür]   gümbürtü [kazanç, süre, f0, f1]   yankı
  splaser: { z: [0.26, 0.1, 2600, 520, 'sawtooth'], b: [0.34, 0.07, 5200, 1400, 'bandpass'], t: [0.3, 0.08, 190, 70], r: 0.22 },
  spplasma: { z: [0.2, 0.07, 1300, 260, 'square'], b: [0.32, 0.08, 3000, 500, 'lowpass'], t: [0.26, 0.07, 240, 90], r: 0.18, w: [0.12, 0.06, 620, 180] },
  spistol: { z: [0.22, 0.08, 1900, 480, 'square'], b: [0.3, 0.06, 4200, 1200, 'bandpass'], t: [0.28, 0.07, 210, 80], r: 0.2 },
  sprail: { z: [0.34, 0.38, 3400, 70, 'sawtooth'], b: [0.6, 0.05, 9000, 3000, 'highpass'], t: [0.75, 0.5, 95, 28], r: 0.42, k: [0.32, 0.9, 1400, 110] },
  spscatter: { z: [0.24, 0.2, 900, 110, 'square'], b: [0.7, 0.24, 3200, 220, 'lowpass'], t: [0.6, 0.2, 120, 40], r: 0.32, c: [0.3, 0.05, 7000, 2500] },
  spelmg: { z: [0.24, 0.09, 1800, 380, 'sawtooth'], b: [0.36, 0.08, 4200, 900, 'bandpass'], t: [0.36, 0.09, 150, 55], r: 0.26 },
};
export const isSpaceShot = (kind) => !!SP[kind];

export function spaceShot(sfx, kind, pos) {
  const P = SP[kind], j = 0.95 + Math.random() * 0.1;
  const v = sfx._voice(pos, 1, { ref: kind === 'sprail' ? 34 : 26, rv: P.r });
  if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
  sfx._tone({ v, gain: P.z[0], dur: P.z[1], f0: P.z[2] * j, f1: P.z[3], type: P.z[4], att: 0.002 });
  sfx._noise({ v, gain: P.b[0], dur: P.b[1] * j, f0: P.b[2], f1: P.b[3], type: P.b[4], q: P.b[4] === 'bandpass' ? 1.4 : 0.7, att: 0.0015 });
  sfx._tone({ v, gain: P.t[0], dur: P.t[1], f0: P.t[2] * j, f1: P.t[3], att: 0.003 });
  if (P.w) sfx._tone({ v, gain: P.w[0], dur: P.w[1], f0: P.w[2] * j, f1: P.w[3], type: 'triangle', delay: 0.012, att: 0.004 });      // plazma: kabarcıklı ikinci ton
  if (P.k) sfx._noise({ v, gain: P.k[0], dur: P.k[1], f0: P.k[2], f1: P.k[3], att: 0.03, delay: 0.02 });                           // ray tüfeği: uzun boğuk kuyruk
  if (P.c && v.d < 50) sfx._noise({ v, gain: P.c[0], dur: P.c[1], f0: P.c[2], f1: P.c[3], type: 'highpass', att: 0.001 });          // dağıtıcı: çıtırtı
}

// Ray tüfeği yeniden şarj: t sn içinde yükselen vızıltı + sonunda kısa "hazır" tıkı (kendi silahın)
export function railCharge(sfx, t = 1.25) {
  if (!sfx.ctx) return;
  const v = sfx._voice(null, 1);
  sfx._tone({ v, gain: 0.07, dur: t * 0.92, f0: 180, f1: 1500, type: 'triangle', delay: 0.18, att: t * 0.8 });
  sfx._tone({ v, gain: 0.035, dur: t * 0.92, f0: 360, f1: 3000, type: 'sine', delay: 0.18, att: t * 0.8 });
  sfx._tone({ v, gain: 0.12, dur: 0.06, f0: 2100, f1: 2050, type: 'triangle', delay: t, att: 0.002 });
}

// 12.160: başkasının ray tüfeği doldu — kısa, çok kısık, konumlu "hazır" tıkı (space.js spaceTp yalnız ≤ 15 m'de çağırır)
export function railReady(sfx, pos) {
  if (!sfx?.ctx) return;
  const v = sfx._voice(pos, 0.28, { ref: 6 });
  if (v.gain < 0.003) { for (const x of v.nodes) x.disconnect(); return; }
  sfx._tone({ v, gain: 0.12, dur: 0.06, f0: 2100, f1: 2050, type: 'triangle', att: 0.002 });
}

// Kask içi: efekt yolu (sfxBus → master) arasına hafif alçak geçiren; müzik / arayüz sesi etkilenmez
export function setHelmet(sfx, on) {
  if (!sfx.ctx || !sfx.sfxBus || !!sfx._helmet === !!on) return;
  sfx.sfxBus.disconnect();
  if (on) { const f = sfx.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 5600; f.Q.value = 0.4; sfx.sfxBus.connect(f); f.connect(sfx.master); sfx._helmet = f; }
  else { sfx._helmet.disconnect(); sfx._helmet = null; sfx.sfxBus.connect(sfx.master); }
}
