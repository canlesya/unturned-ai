// Girdi → hareket (saf mantık; DOM/THREE/ses yok). Offline Player, sunucu ve istemci tahmini aynı fonksiyonu kullanır.
//
// input: { f: −1..1 (ileri/geri), r: −1..1 (sağ/sol; klavye tam sayı, dokunmatik joystick analog — hız itme miktarıyla orantılı), lean: -1|0|1 (Q/E), sprint: bool (Shift basılı), jump: bool,
//         dive: bool (12.180: çömel tuşu BASILI — yüzerken dalma) }
// Etkiler: s.leanDir, s.sprinting, s.crouching/prone (koşarken kalkar), s.vel.x/z (yatay), s.vel.y + s.onGround (zıplama)
// 12.180: yüzerken (s.swim, World.move konumdan hesaplar) hareket sim/swim.js swimInput'a geçer; sığ suda yürüme yavaşlar (wadeMul).
import { TUNE } from '../game/balance.js';
import { swimInput, wadeMul } from './swim.js';

export const JUMP_SPEED = 5.4;      // varsayılanlar (testler); oyun TUNE'u okur (admin panelinden değişebilir)
export const WALK_SPEED = 5.6;          // m/sn yürüme (koşu ×1,5, çömelme ×0,52). Oyuncu, botlar, sunucu ve istemci tahmini aynı sabiti kullanır; eskiden 4,4 idi ('çok yavaş' geri bildirimi)

export function applyInput(s, input, dt) {
  if (s.swim) { swimInput(s, input, dt); return; }
  const { f, r, lean } = input;
  const st = s.stat;
  s.leanDir = lean;
  const wantSprint = input.sprint && f > 0 && !s.ads && s.onGround && !s.prone && lean === 0;
  s.sprinting = wantSprint;                     // yüklerken de koşulabilir
  if (s.sprinting) { s.crouching = false; if (s.prone) s.prone = false; }
  let spd = TUNE.walkSpeed * s.spd * (st.move || 1);
  if (s.def.zombie && s.game.graceLeft > 0) spd = 0;                  // Enfekte hazırlık süresinde zombiler yerinde bekler
  if (s.sprinting) spd *= TUNE.sprintMul;
  if (s.crouching) spd *= TUNE.crouchMul;
  if (s.prone) spd *= TUNE.proneMul;
  if (s.adsT > 0.1) spd *= 1 - 0.4 * s.adsT;
  if (s.wDepth > 0) spd *= wadeMul(s);                                       // 12.180 sığ su: bel derinliğine doğru yavaşlar
  const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
  let wx = fx * f + rx * r, wz = fz * f + rz * r;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { const m = Math.min(1, wl); wx = (wx / wl) * spd * m; wz = (wz / wl) * spd * m; }     // çapraz (klavye) normalize; analog joystick yarım itilirse yarım hız
  const lowG = s.game?.world?.grav < 1;                                    // 12.157 Uzay: düşük yer çekimi → havada biraz daha fazla yön denetimi, zıplama TUNE.spaceJump
  const acc = s.onGround ? 14 : s.launchT > 0 ? 0.1 : lowG ? TUNE.spaceAir : 2.2;             // minderden fırlayan: yay çizer (havada az yön değişimi)
  const a = 1 - Math.exp(-acc * dt);
  s.vel.x += (wx - s.vel.x) * a;
  s.vel.z += (wz - s.vel.z) * a;
  if (input.jump && !(s.def.zombie && s.game.graceLeft > 0) && s.onGround && !s.prone && !s.crouching) { s.vel.y = TUNE.jumpSpeed * (s.jumpMul || 1) * (lowG ? TUNE.spaceJump : 1); s.onGround = false; }
}
