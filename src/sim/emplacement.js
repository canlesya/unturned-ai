// 12.213 SABİT SİLAH YUVALARI (saf mantık: DOM / THREE / ses yok): ağır makineli (HMG, M2 .50 tripodlu, çelik kalkanlı) ve güdümlü tanksavar
// (TOW benzeri tripod). Hareket etmeyen "araç" türleri (VT.hmg / VT.atgm): tek koltuk (0 = nişancı), binme / inme / ağ / HUD / koltuğa doğuş /
// bot binişi araç sisteminden gelir. Gövde: st.x / y / z = dönme ekseninin tabanı (yuvanın zemini), st.yaw = SİLAHIN yönü (nişancının bakışı
// st.base ± arc içinde kırpılır; gövde / kalkan silahla döner), st.base = yuvanın baktığı yön (doğuştaki yaw). Fizik adımı yok (stepFixed).
// Çarpışma / vuruş kutusu: ana kutu = silah gövdesi (dönme ekseni çevresi), parts = çelik kalkan (HMG) — görünen parçalarla aynı ölçü.

export const EMP = {
  hmg: {
    name: 'Ağır makineli', hp: 300, seats: 1, fixed: true, emp: 'hmg',
    hl: 0.42, hw: 0.13, top: 1.24, clear: 0.98,                       // silah gövdesi (alıcı + namlu kökü) — ileri / geri ±0,42 m, 0,98–1,24 m (model: 0,24 × 0,24 × 0,8)
    parts: [[-0.44, 0.44, 0.62, 1.24, -0.44, -0.38]],                  // çelik kalkan (yerel x sağ, y, z geri): gövdenin 0,38–0,44 m önünde, 0,88 m geniş, 0,62–1,24 m
    wb: 1, tr: 1, wheelR: 0, maxF: 0, maxR: 0, accel: 0, brake: 0, roll: 0, drag: 0, steerMax: 0, steerRate: 0, grip: 0, gripHand: 0, slide: 1, climbK: 0,
    // koltuk: nişancı silahın 0,78 m arkasında oturur (cephane sandığı), göz 1,38 m (kalkanın üstünden bakar)
    seat: [[-0.78, 0, 0.6]],
    arc: 1.22, elev: [-0.26, 0.44],                                    // yatay ±70°, dikey −15°…+25°
    // .50 cal: askere 34 (3 mermi; 90 → 240 m'de × 0,75 = 4 mermi), araca vdmg 40 'hmg' (jip × 0,5 = 20 → ~20 isabet, helikopter × 0,4, tank × 0 = işlemez)
    mg: { seats: [0], name: 'Ağır makineli', dmg: 34, vdmg: 40, vk: 'hmg', rpm: 560, range: [90, 240], minMul: 0.75, hip: 0.009, tracer: '#ffc56a', sound: 'pkm', vmg: true, elev: [-0.26, 0.44], zoom: 1.6, heat: 0.016, cool: 0.4, mz: [1.45, 0.3] },
    blastMul: 1.0, bulletMul: 0.15, hmgMul: 0.4, atMul: 1.3, ramMin: 99, ramMul: 0, mass: 1e6, wade: 9, stepUp: 0,
    burnAt: 0, burnRate: 0, boom: [3, 60],                             // yanmaz; patlayınca küçük patlama (nişancı ölür)
    respawn: 45, wreck: 10, idleRespawn: 1e9,                          // yok edilince 10 sn enkaz, 45 sn sonra onarılır (yeniden kurulur)
  },
  atgm: {
    name: 'Tanksavar', hp: 250, seats: 1, fixed: true, emp: 'atgm',
    hl: 0.78, hw: 0.13, top: 1.42, clear: 1.04,                       // fırlatma tüpü (r 0,12, 1,06–1,30 m) + üstünde nişan dürbünü (1,30–1,42 m), ileri / geri ±0,78 m
    wb: 1, tr: 1, wheelR: 0, maxF: 0, maxR: 0, accel: 0, brake: 0, roll: 0, drag: 0, steerMax: 0, steerRate: 0, grip: 0, gripHand: 0, slide: 1, climbK: 0,
    seat: [[-1.05, 0, 0.62]],                                       // göz 1,40 m (dürbün hizası)
    arc: 1.05, elev: [-0.1, 0.3],                                      // yatay ±60°, dikey −6°…+17° (mevzinin ön duvarı füzenin önünde kalmaz)
    // füze: artının noktasına (atış anında nişancının bakışının çarptığı nokta) düz uçar (yer çekimi yok, 95 m/sn); tanka vdmg 420 'at':
    // tank atMul 1,25 → ön 525 (2 isabet) · yan 709 (2) · arka 1050 (1). Jip / helikopter / motor tek isabet. Askere 140 / 4 m (iç 1 m)
    atgm: { name: 'Tanksavar füzesi', reload: 5, speed: 95, grav: 0, dmg: 140, vdmg: 420, radius: 4, inner: 1, vehInner: 1, prox: 0, zoom: 2.2, minAim: 12, f: 0.8, u: 1.18 },
    blastMul: 1.0, bulletMul: 0.15, hmgMul: 0.4, atMul: 1.3, ramMin: 99, ramMul: 0, mass: 1e6, wade: 9, stepUp: 0,
    burnAt: 0, burnRate: 0, boom: [3, 60],
    respawn: 45, wreck: 10, idleRespawn: 1e9,
  },
};

const wrap = (a) => ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
// silah yaw'ı yuvanın yayında (st.base ± def.arc)
export function arcYaw(st, yaw) {
  const b = st.base ?? st.yaw, A = st.def.arc ?? Math.PI;
  return b + Math.max(-A, Math.min(A, wrap(yaw - b)));
}
export const arcPitch = (def, p) => Math.max(def.elev[0], Math.min(def.elev[1], p));

// "fizik" adımı: yalnız silahın yönü (nişancının bakışı yayda). Sunucu, istemci tahmini ve botlar aynı (Vehicles.drive → stepVehicle)
export function stepFixed(v, inp) {
  if (inp && Number.isFinite(inp.yw)) v.yaw = arcYaw(v, inp.yw);
  if (inp && Number.isFinite(inp.pt)) v.gp = arcPitch(v.def, inp.pt);
  v.vx = v.vy = v.vz = 0; v.air = false; v.hit = 0; v.land = 0; v.thr = 0; v.steer = 0; v.pitch = 0; v.roll = 0;
  return v;
}
