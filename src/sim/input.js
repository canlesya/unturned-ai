// Girdi → hareket (saf mantık; DOM/THREE/ses yok). Offline Player, sunucu ve istemci tahmini aynı fonksiyonu kullanır.
//
// input: { f: -1|0|1 (ileri/geri), r: -1|0|1 (sağ/sol), lean: -1|0|1 (Q/E), sprint: bool (Shift basılı), jump: bool }
// Etkiler: s.leanDir, s.sprinting, s.crouching/prone (koşarken kalkar), s.vel.x/z (yatay), s.vel.y + s.onGround (zıplama)
export const JUMP_SPEED = 5.4;
export const WALK_SPEED = 4.4;

export function applyInput(s, input, dt) {
  const { f, r, lean } = input;
  const st = s.stat;
  s.leanDir = lean;
  const wantSprint = input.sprint && f > 0 && !s.ads && s.onGround && !s.prone && lean === 0;
  s.sprinting = wantSprint;                     // yüklerken de koşulabilir
  if (s.sprinting) { s.crouching = false; if (s.prone) s.prone = false; }
  let spd = WALK_SPEED * s.spd * (st.move || 1);
  if (s.sprinting) spd *= 1.5;
  if (s.crouching) spd *= 0.52;
  if (s.prone) spd *= 0.27;
  if (s.adsT > 0.1) spd *= 1 - 0.4 * s.adsT;
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  let wx = fx * f + rx * r, wz = fz * f + rz * r;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx = (wx / wl) * spd; wz = (wz / wl) * spd; }
  const acc = s.onGround ? 14 : 2.2;
  const a = 1 - Math.exp(-acc * dt);
  s.vel.x += (wx - s.vel.x) * a;
  s.vel.z += (wz - s.vel.z) * a;
  if (input.jump && s.onGround && !s.prone && !s.crouching) { s.vel.y = JUMP_SPEED; s.onGround = false; }
}
