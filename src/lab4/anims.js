import { reloadAnim, meleePose, smooth } from '../game/anim.js';

// Elsiz silah animasyonları (lab4): her animasyon sample(t, c) → { p:[dx,dy,dz], r:[rx,ry,rz] (kamera uzayı, bel duruşuna eklenir), fx:{...} }
// fx: magOut / magVis / magFade (şarjör alt grubu) · charge (kurma kolu +Z) · bolt / boltBack (sürgü) · pump (pompa −Z) · slide (tabanca sürgüsü +Z)
//     shell {k, vis} (fişek yuvaya girer) · flash (namlu alevi) · hideW · camRoll / camPitch · sprint / ads (sprint2ads karışımı)
// Eğriler oyunun reloadAnim / meleePose'undan: üçüncü şahıs ve sunucu zamanlaması değişmez, yalnız silah ofsetleri elsiz görünüme göre.
const seg = (k, a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
const sm = (k, a, b) => smooth(seg(k, a, b));
const bump = (k, a, b) => Math.sin(Math.PI * seg(k, a, b));
const Z = () => ({ p: [0, 0, 0], r: [0, 0, 0], fx: {} });
const add = (o, p, r, k = 1) => { for (let i = 0; i < 3; i++) { o.p[i] += p[i] * k; o.r[i] += r[i] * k; } return o; };

export const ANIMS = {
  idle: { sample: () => Z() },
  // ── şarjör: silah sola-aşağı yatar (şarjör yuvası görünür), şarjör düşer + solar, yenisi alttan girer, oturma darbesi, kurma kolu (boş)
  reload: { sample: (t, c) => {
    const r = reloadAnim(c.style === 'bolt' ? 'bolt' : 'mag', t, true), o = Z();
    add(o, [-0.15, 0.18, -0.04], [0.0, 0.25, -0.95], r.tilt);                   // silah yukarı-ortaya gelir, sola yatar: şarjör yuvası kameraya döner
    add(o, [0, -0.012, 0.03], [-0.06, 0, 0.04], r.slap);                         // şarjör oturma darbesi
    add(o, [0, 0.006, 0.04], [0.05, 0, 0], r.charge);                            // kurma kolu çekilirken silah geri sarsılır
    const fade = t < 0.26 ? r.magOut * 0.9 : 0;                                  // düşen şarjör solar; yenisi opak
    o.fx = { magOut: r.magOut, magVis: r.magVis, magFade: fade, charge: r.charge, bolt: r.bolt, slide: c.hold === 'pistol' ? (t < 0.78 ? 1 : 1 - sm(t, 0.78, 0.86)) : 0 };
    return o;
  } },
  // ── fişek (pompalı): silah sola yatar, her fişek sol alttan yuvaya kayar; sonunda pompa
  shell: { sample: (t) => {
    const ph = ((t * 4) % 1 + 1) % 1, r = reloadAnim('shell', t, true, ph), o = Z();
    add(o, [-0.15, 0.2, -0.04], [-0.05, 0.3, -1.15], r.tilt);                      // silah yukarı-ortaya, alt yüz (fişek yuvası) kameraya döner
    add(o, [0, 0.004, 0.012], [0, 0, 0], r.slap);
    const inK = sm(ph, 0.05, 0.55), vis = r.tilt > 0.3 && ph < 0.62;
    o.fx = { shell: { k: inK, vis }, pump: 0 };
    return o;
  } },
  // ── sürgü (keskin nişancı): silah sola yatar, sürgü kalkar → geri → ileri → iner
  bolt: { sample: (t) => {
    const to = sm(t, 0, 0.18) * (1 - sm(t, 0.86, 1)), lift = sm(t, 0.2, 0.32) * (1 - sm(t, 0.74, 0.86)), back = sm(t, 0.36, 0.52) * (1 - sm(t, 0.56, 0.72)), o = Z();
    add(o, [-0.1, 0.13, -0.04], [0.1, 0.25, 1.0], to);                            // sağ yan (sürgü kolu) yukarı döner, kamera üstten görür                        // sağ yan (sürgü kolu) kameraya döner
    add(o, [0, 0.004, 0.015], [0.03, 0, 0], back);
    o.fx = { bolt: lift, boltBack: back };
    return o;
  } },
  // ── pompa: pompa 8 cm geri-ileri, silah hafif sarsılır
  pump: { sample: (t) => { const b = bump(t, 0.1, 0.9), o = add(Z(), [0, 0.003, 0.015], [0.06, 0, 0], b); o.fx = { pump: 0.08 * b }; return o; } },
  // ── ateş: geri tepme + namlu alevi (tabancada sürgü geri gelir)
  fire: { sample: (t, c) => { const k = (1 - t) ** 3, o = add(Z(), [0.004, 0.01, 0.07], [0.11, 0.02, -0.03], k); o.fx = { flash: t < 0.18, slide: c.hold === 'pistol' ? bump(t, 0, 0.35) : 0 }; return o; } },
  // ── bıçak savurma / saplama: oyunun meleePose eğrisi, oyundaki çarpanlar; hafif kamera yalpası
  slash: { sample: (t) => melee('rl', t) },
  stab: { sample: (t) => melee('stab', t) },
  // ── bomba: geri çekiş + fırlatma (oyunun throwT eğrisi), bomba t>0,72'de gizlenir
  throw: { sample: (t) => {
    const back = sm(t, 0, 0.35) * (1 - sm(t, 0.38, 0.6)), th = seg(t, 0.4, 1), o = Z();
    add(o, [0.06, 0.03, 0.12], [0.35, 0.1, 0.1], back);
    add(o, [0, -Math.sin(th * Math.PI) * 0.06, Math.sin(th * Math.PI) * 0.12], [Math.sin(Math.min(1, th * 1.4) * Math.PI) * -0.5, 0, 0], 1);
    o.fx = { hideW: t > 0.66, camPitch: -Math.sin(th * Math.PI) * 0.01 };
    return o;
  } },
  // ── koşu → nişan: sprint ağırlığı iner, nişan ağırlığı çıkar (rig bel / koşu / nişan karışımı)
  sprint2ads: { sample: (t) => { const o = Z(); o.fx = { sprint: 1 - sm(t, 0.05, 0.45), ads: sm(t, 0.55, 0.95) }; return o; } },
  // ── inceleme: oyunun eğrisi (öne-ortaya al, yandan göster, ters çevir)
  inspect: { sample: (t) => {
    const sm2 = (x) => x * x * (3 - 2 * x), insp = sm2(seg(t, 0, 0.12)) * sm2(seg(1 - t, 0, 0.14)), pl = (x) => Math.sin(seg(x, 0, 1) * Math.PI);
    const a = pl((t - 0.1) / 0.36), b = pl((t - 0.42) / 0.3), cc = pl((t - 0.66) / 0.24);
    return add(Z(), [-0.19 * insp, 0.05 * insp, -0.14 * insp], [-0.2 * a + 0.5 * cc, 0.95 * a + 0.25 * b, -0.95 * b + 0.3 * cc], 1);
  } },
};
function melee(kind, t) {
  const m = meleePose(kind, t), o = Z();
  o.p = [m.x * 1.2, m.y * 1.3, m.z * 0.9];                                      // elsiz: oyundaki çarpanlardan küçük (bıçak ekranda kalsın) o.r = [m.rx, m.ry, m.rz];
  o.fx = { camRoll: -m.ry * 0.025, camPitch: m.rx * 0.012 };
  return o;
}
