// 12.211 V8 gizli sınıf (hidden class) kararlılığı. Bot beyni / asker / araç sürücü durumu (vd) özelliklerinin çoğunu kurucudan SONRA, duruma göre
// farklı sırayla ekliyordu (b.guard, b.empScan, vd.post, s.veh …). Her farklı ekleme sırası ayrı bir biçim: 128v128'de 60 sn sonra 97 ayrı beyin,
// 26 asker, 21 vd biçimi → bot.update / soldier.update / vbDrive içindeki her özellik erişimi "megamorfik" (önbelleksiz karma arama) oluyordu.
// Çözüm: sonradan eklenen özellikler kurucuda SABİT sırayla undefined olarak açılır (değerleri / anlamı değişmez: ??, ||=, === undefined aynı
// çalışır; hiçbir kod bu nesnelerin anahtarlarını saymaz / silmez). Liste ölçümle çıkarıldı (7 harita / mod); listede olmayan yeni bir özellik
// yalnız biraz yavaşlatır, hata vermez. Beyin / vd ADLI atamayla açılır: hesaplanan anahtarla (o[k] = …) 12'den fazla özellik eklenen nesne
// V8'de sözlük kipine düşüyor (ölçüldü: %HasFastProperties false).
export const SOLDIER_LATE = ['_modelWeapon', 'brain', 'squad', 'spawnN', 'burstLeft', 'backT', 'backTo', 'protNet', 'air', 'drownAcc', 'swim', 'under', 'wDepth', 'zoneT',
  'landH', 'wY', 'onCollider', 'fallTop', 'oobT', 'fallSafe', 'veh', 'seat', 'vcd', 'vheat', 'gunAim', 'firedSprinting', 'spottedT', 'revivable',
  'dmgLog', '_ga', 'vw', '_botNade', 'rlSeated', 'rlSeatK', 'useItem', 'throwUnder', 'reviveTarget', 'humanCls', 'humanChoice', 'infectNext', 'flashOn',
  'human', 'vacant', '_parked', 'devGod', 'suicideT'];
// nesnede (ya da prototipinde: getter / yöntem) olmayan anahtarları sırayla undefined açar (asker: bu yolla hızlı kalıyor, ölçüldü)
export function preShape(o, keys) {
  for (let i = 0; i < keys.length; i++) if (!(keys[i] in o)) o[keys[i]] = undefined;
  return o;
}
// BotBrain kurucusundan sonra (bu anahtarların hiçbiri kurucu / reset() tarafından atanmaz)
export function brainLate(b) {
  b._tAcc = b.redir = b.boardT = b.empScan = b.vScanT = b.hopN = b.foeD = b._bHead = b.vRes = b.rideGoal = b.rideTo = b.vstopT = b.rodeMoved = b.seatT = b._seatMoved = b.dmgT = b.hopping = b.empGo = b.guard = b.guardPost = b.guardT = b._losNo = b.frHead = b.empT = b.empTv = b.empOut = b.lagX = b.lagZ = b.aoY = b.aoP = b.jY = b.jP = b.jT = b.jTY = b.jTP = b.atErrT = b.atErr = b.atCd = b.holdBudget = b.guardSwapT = b.mgT = b.grdPeek = b.respond = b.grdUp = b.nadeSpotT = b.empCD = b.followT = b.retacT = b.spotShots = b.lastSpot = b.spotT = b.quietT = b.quietMax = b.torchT = b.packT = b.tDist = b.packHold = undefined;
}
// araç sürücü botu durumu: bütün anahtarlar tek nesne değişmezinde, sonra başlangıç değerleri
export function makeVd(init) {
  const o = { state: undefined, t: undefined, kind: undefined, stuck: undefined, prog: undefined, progT: undefined, inp: undefined, odo: undefined, horn: undefined, scanT: undefined, tg: undefined, comingT: undefined, coming: undefined, route: undefined, ri: undefined, dest: undefined, postIn: undefined, stuckT: undefined, revT: undefined, end: undefined, fk: undefined, fdt: undefined, fRoute: undefined, ff: undefined, fr: undefined, fb: undefined, role: undefined, post: undefined, escT: undefined, esc: undefined, goalO: undefined, goalAt: undefined, front: undefined, frontT: undefined, strikeAt: undefined, mode: undefined, rcT: undefined, holdT: undefined, parkT: undefined, tOff: undefined, evChk: undefined, dir: undefined, atkNext: undefined, revR: undefined, strikeO: undefined, dives: undefined, strikeT0: undefined, orbitT0: undefined, orbitFor: undefined, moveOn: undefined, postHp: undefined, postUntil: undefined, atk: undefined, _nd: undefined, _ra: undefined, rkT: undefined, evT: undefined, evX: undefined, evZ: undefined, evSide: undefined, react: undefined, err: undefined, pNext: undefined, pIdx: undefined, fire: undefined, cdT: undefined, postFor: undefined, landFor: undefined, landT: undefined, holdFor: undefined, reloc: undefined, vreloc: undefined };
  return Object.assign(o, init);
}
