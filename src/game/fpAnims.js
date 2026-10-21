import { meleePose, smooth } from './anim.js';

// Birinci şahıs kare el duruşları + animasyon ofsetleri (handlab4 V3 → oyun). Eğriler anim.js'ten (reloadAnim / meleePose): üçüncü şahıs ve sunucu zamanlaması değişmez.
// sample(t, c) → { p:[dx,dy,dz], r:[rx,ry,rz] (kamera uzayı, bel duruşuna eklenir), fx:{...} } · c: { ra (reloadAnim sonucu), ph (fişek döngüsü), hold, kind, kindSw (savurma türü) }
// fx: magOut / magVis / magFade (şarjör alt grubu) · charge (kurma kolu +Z) · bolt / boltBack (sürgü) · pump (pompa) · slide (tabanca sürgüsü) · shell {k, vis} · hideW · camRoll / camPitch
const seg = (k, a, b) => Math.min(1, Math.max(0, (k - a) / (b - a)));
const sm = (k, a, b) => smooth(seg(k, a, b));
const bump = (k, a, b) => Math.sin(Math.PI * seg(k, a, b));
const Z = () => ({ p: [0, 0, 0], r: [0, 0, 0], fx: {} });
const add = (o, p, r, k = 1) => { for (let i = 0; i < 3; i++) { o.p[i] += p[i] * k; o.r[i] += r[i] * k; } return o; };

// bel duruşu (kamera uzayı, ölçekli model): p konum, r Euler XYZ, s model ölçeği (nişanda 0,92'ye iner: nişangâh görünümü eskisiyle aynı)
export const POSE = {
  rifle:    { p: [0.25, -0.29, -0.3], r: [0.2, 0.32, -0.28], s: 1.5 },                 // iri, sağ-alt, namlu yukarı-sola, hafif sola yatık (şarjör görünür)
  launcher: { p: [0.25, -0.29, -0.3], r: [0.2, 0.32, -0.28], s: 1.5 },
  pistol:   { p: [0.15, -0.065, -0.38], r: [0.14, 0.18, -0.12] },                    // lab −0,1: kare eller ekranın altında kalıyordu
  melee:    { p: [0.15, -0.12, -0.28], r: [0.55, 0.45, -0.35] },                       // bıçak: sağ altta, ağız öne-yukarı-sola (yumruğun üstünden çıkar)
  grenade:  { p: [0.16, -0.085, -0.36], r: [0.25, 0.1, 0.0] },                       // açık avuç levhası görünsün
  box:      { p: [0.05, -0.17, -0.5], r: [0.35, 0.1, 0.0], s: 1.0 },                  // ilk yardım / cephane kutusu / claymore: iki elle önde, alçakta
};
export const POSE_ID = { sniper: { p: [0.22, -0.26, -0.36], r: [0.12, 0.25, -0.05], s: 1.3 }, rpg: { p: [0.22, -0.2, -0.34], r: [0.12, 0.2, -0.12], s: 1.3 }, claymore: { p: [0.04, -0.14, -0.42], r: [0.4, 0.1, 0.0], s: 1.25 } };   // silaha özel bel duruşu (dürbün / roket üstte kalsın)
export const SCALE = 1.25;                                                             // tabanca / bıçak / bomba; tüfekler POSE.s (1,5)
export const SPRINT = { gun: { p: [-0.02, -0.03, 0.0], r: [-0.25, 0.3, 0.1] }, melee: { p: [-0.04, 0.05, -0.04], r: [0.65, 0.3, -0.1] } };   // koşu: silah iner, namlu sola-aşağı

export const ANIMS = {
  // ── şarjör: silah yukarı-ortaya gelir, sola yatar (şarjör yuvası görünür), şarjör düşer + solar, yenisi alttan girer, oturma darbesi, kurma kolu (boş)
  reload: { sample: (t, c) => {
    const r = c.ra, o = Z();
    if (c.hold === 'pistol') add(o, [-0.05, 0.0, -0.03], [0.05, 0.2, -0.55], r.tilt);   // tabanca: zaten yüksekte, az yatar
    else add(o, [-0.15, 0.18, -0.04], [0.0, 0.25, -0.95], r.tilt);
    add(o, [0, -0.012, 0.03], [-0.06, 0, 0.04], r.slap);
    add(o, [0, 0.006, 0.04], [0.05, 0, 0], r.charge);
    const fade = t < 0.26 ? r.magOut * 0.9 : 0;                                    // düşen şarjör solar; yenisi opak
    o.fx = { magOut: r.magOut, magVis: r.magVis, magFade: fade, charge: r.charge, bolt: r.bolt, slide: c.hold === 'pistol' ? (t < 0.78 ? 1 : 1 - sm(t, 0.78, 0.86)) : 0 };
    return o;
  } },
  // ── fişek (pompalı / çift namlu): silah sola yatar, her fişek sol alttan yuvaya kayar
  shell: { sample: (t, c) => {
    const ph = c.ph ?? 0, r = c.ra, o = Z();
    add(o, [-0.15, 0.2, -0.04], [-0.05, 0.3, -1.15], r.tilt);
    add(o, [0, 0.004, 0.012], [0, 0, 0], r.slap);
    o.fx = { shell: { k: sm(ph, 0.05, 0.55), vis: r.tilt > 0.3 && ph < 0.62 }, pump: 0 };
    return o;
  } },
  // ── sürgü (atıştan sonra): silah hafif iner, sağa yatar (lab 57° → 18°: kutu dürbün ekranı kaplamasın, sağ üstte kalsın), sürgü kalkar → geri → ileri → iner
  bolt: { sample: (t) => {
    const to = sm(t, 0, 0.18) * (1 - sm(t, 0.86, 1)), lift = sm(t, 0.2, 0.32) * (1 - sm(t, 0.74, 0.86)), back = sm(t, 0.36, 0.52) * (1 - sm(t, 0.56, 0.72)), o = Z();
    add(o, [0.01, -0.03, 0.0], [0.1, 0.04, 0.32], to);
    add(o, [0, 0.004, 0.015], [0.03, 0, 0], back);
    o.fx = { bolt: lift, boltBack: back };
    return o;
  } },
  // ── pompa (atıştan sonra): pompa 8 cm geri-ileri, silah hafif sarsılır
  pump: { sample: (t) => { const b = bump(t, 0.1, 0.9), o = add(Z(), [0, 0.003, 0.015], [0.06, 0, 0], b); o.fx = { pump: 0.08 * b }; return o; } },
  // ── bıçak savurma / saplama: oyunun meleePose eğrisi (lab çarpanları), hafif kamera yalpası
  swing: { sample: (t, c) => {
    const m = meleePose(c.kindSw || 'rl', t), o = Z();
    o.p = [m.x * 0.8, m.y * 1.1, m.z * 0.7]; o.r = [m.rx * 0.45, m.ry * 0.45, m.rz * 0.45];   // dönüş yarım: bıçak savurmada ekrandan çıkmasın (lab: dönüşsüz)
    o.fx = { camRoll: -m.ry * 0.025, camPitch: m.rx * 0.012 };
    return o;
  } },
  // ── bomba pimi (kuşanınca): sol el sol alttan pime gelir, çeker, geri döner; bomba hafif kalkar
  pin: { sample: (t) => add(Z(), [-0.025, -0.005, -0.06], [0.1, -0.12, 0.18], sm(t, 0.1, 0.45) * (1 - sm(t, 0.75, 1))) },   // bomba öne-sola uzanır: sol el kameradan uzakta kalır
  // ── fırlatma (bırakış anından): kısa geri çekiş + öne savuruş; bomba t > 0,45'te gizlenir, sağ el açık avuçla ekranda kalır
  throw: { sample: (t) => {
    const back = sm(t, 0, 0.18) * (1 - sm(t, 0.2, 0.42)), th = seg(t, 0.18, 1), o = Z();
    add(o, [0.05, 0.02, 0.05], [0.35, 0.1, 0.1], back);
    add(o, [0, -Math.sin(th * Math.PI) * 0.06, Math.sin(th * Math.PI) * 0.12], [Math.sin(Math.min(1, th * 1.4) * Math.PI) * -0.5, 0, 0], 1);
    o.fx = { hideW: t > 0.45, camPitch: -Math.sin(th * Math.PI) * 0.01 };
    return o;
  } },
  // ── inceleme: öne-ortaya al, yandan göster, ters çevir (eski oyun eğrisi)
  inspect: { sample: (t) => {
    const sm2 = (x) => x * x * (3 - 2 * x), insp = sm2(seg(t, 0, 0.12)) * sm2(seg(1 - t, 0, 0.14)), pl = (x) => Math.sin(seg(x, 0, 1) * Math.PI);
    const a = pl((t - 0.1) / 0.36), b = pl((t - 0.42) / 0.3), cc = pl((t - 0.66) / 0.24);
    const o = add(Z(), [-0.19 * insp, 0.05 * insp, -0.14 * insp], [-0.2 * a + 0.5 * cc, 0.95 * a + 0.25 * b, -0.95 * b + 0.3 * cc], 1); o.insp = insp; return o;
  } },
};
