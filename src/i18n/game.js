// Oyun içi metinler (HUD, ölüm ekranı, duraklat, oyun içi ayarlar, skor tablosu, sohbet, oyun bildirimleri) + veri adı yardımcıları.
// Anahtarlar: hud. · death. · pause. · set. · sb. · chat. ; silah / zombi / nişangâh adları Türkçede stats.js'ten gelir (yalnız en sözlüğü yazılı).
import { t, addStrings, lang } from './index.js';
import { WSTATS, ZTYPES, ZBOSS, OPTICS, CLASS_DEFS } from '../game/stats.js';

const tf = (k, fb) => { const s = t(k); return s === k ? fb : s; };          // anahtar yoksa yedek (Türkçe veri adı)
export const wName = (id) => tf(`hud.wpn.${id}`, WSTATS[id]?.name || id);
let byName = null;                                                            // Türkçe silah adı → kimlik (öldürme olayı adı taşır)
export function wLabel(name) {
  if (!name) return '';
  let suf = '';
  const m = /^(.*) · arkadan$/.exec(name); if (m) { name = m[1]; suf = ' · ' + t('hud.kf.back'); }
  if (!byName) { byName = {}; for (const [id, s] of Object.entries(WSTATS)) byName[s.name] = id; }
  const id = WSTATS[name] ? name : byName[name];
  if (id) return wName(id) + suf;
  const sp = { 'İntihar': 'hud.kf.suicide', 'Kuyuya düştü': 'hud.kf.pit', 'Kuyuya düşürdü': 'hud.kf.pushed', 'Düşman üssü': 'hud.kf.base', 'Düştü': 'hud.kf.fell', 'Savaş alanı': 'hud.kf.oob', 'Boğuldu': 'hud.kf.drown' }[name];
  return (sp ? t(sp) : name) + suf;
}
export const classDesc = (id) => tf(`class.${id}.desc`, CLASS_DEFS[id]?.desc || '');
export const ztName = (k) => tf(`hud.zt.${k}`, ZTYPES[k]?.label || k);
export const ztDesc = (k) => tf(`hud.zt.${k}.desc`, ZTYPES[k]?.desc || '');
export const abilName = (ab) => tf(`hud.ab.${ab.id}`, ab.label);
export const opticName = (id) => tf(`hud.opt.${id}`, OPTICS[id]?.label || id);
export const fireName = (m, short) => t(`hud.fire${short ? 'S' : ''}.${m}`);
export const teamName = (team) => t(`hud.team.${team}`);
export const dispName = (s) => (s.name === 'Sen' ? t('hud.kf.you') : s.name);   // çevrimdışı oyuncunun varsayılan adı
// Harita metni (bölge adı, harita etiketi / açıklaması): anahtar varsa çeviri, yoksa Türkçede kendisi, İngilizcede bölge adı aynen, etiket boş
export function mapText(str, key) {
  if (key) { const s = t(key); if (s !== key) return s; return lang() === 'tr' ? str : ''; }
  return placeName(str);
}
// Yer adı (bayrak / bölge): Türkçede aynen; İngilizcede önce tam ad, yoksa kelime kelime (Kuzey Avlu → North Yard), bilinmeyen kelime aynen
const PW = { kuzey: 'North', güney: 'South', doğu: 'East', batı: 'West', k: 'N', g: 'S', kb: 'NW', kd: 'NE', gb: 'SW', gd: 'SE', köşe: 'Corner', kapı: 'Gate', raflar: 'Racks',
  merdivenler: 'Stairs', konteyner: 'Container', sahası: 'Yard', arkası: 'Back', sandıklar: 'Crates', yükleme: 'Loading', kamyon: 'Truck', palet: 'Pallet', yığını: 'Stack', avlu: 'Yard',
  kırmızı: 'Red', mavi: 'Blue', doğuş: 'Spawn', çıkışı: 'Exit', portal: 'Gantry', vinç: 'Crane', kule: 'Tower', rıhtım: 'Dock', tünel: 'Tunnel', çatısı: 'Roof', hattı: 'Lane', orta: 'Mid',
  geçit: 'Pass', turuncu: 'Orange', mor: 'Purple', turkuaz: 'Turquoise', kale: 'Fort', köprüsü: 'Bridge', kanadı: 'Wing', iskelesi: 'Pier', evler: 'Houses', kilise: 'Church', kavşak: 'Crossroads',
  benzinlik: 'Gas Station', pazar: 'Market', ambar: 'Barn', gözetleme: 'Watch', tepesi: 'Hill', köprü: 'Bridge', orman: 'Forest', kampı: 'Camp', değirmen: 'Mill', komuta: 'Command', binası: 'Building',
  kışla: 'Barracks', akaryakıt: 'Fuel Depot', merkez: 'Center', uzun: 'Long', alt: 'Lower', tüneller: 'Tunnels', depo: 'Warehouse' };
const PF = { 'Asma kat': 'Mezzanine' };
export function placeName(str) {
  if (!str || lang() === 'tr') return str;
  const k = t(`hud.loc.${str}`); if (k !== `hud.loc.${str}`) return k;
  if (PF[str]) return PF[str];
  return str.split(' ').map((w) => PW[w.toLocaleLowerCase('tr')] || w).join(' ');
}
// Puan yazıları (#pops; game.js Türkçe yollar): '+100 ÖLDÜRME' · '+150 KAFA ATIŞI' · '+80 CANLANDIRMA' · 'SEVİYE 3/15 · AK-47'
export function popText(s) {
  let m = /^\+(\d+) (ÖLDÜRME|KAFA ATIŞI|CANLANDIRMA)$/.exec(s);
  if (m) return `+${m[1]} ${t({ 'ÖLDÜRME': 'hud.pop.kill', 'KAFA ATIŞI': 'hud.pop.hs', 'CANLANDIRMA': 'hud.pop.revive' }[m[2]])}`;
  m = /^SEVİYE (\d+\/\d+) · (.*)$/.exec(s);
  if (m) return `${t('hud.pop.level')} ${m[1]} · ${wLabel(m[2])}`;
  return s;
}
export { ZBOSS };

addStrings('tr', {
  // üst çubuk, pusula, bayrak
  'hud.blue': 'MAVİ', 'hud.red': 'KIRMIZI', 'hud.you': 'SEN', 'hud.leader': 'LİDER', 'hud.tie': 'BERABERE', 'hud.humans': 'İnsanlar', 'hud.zombies': 'Zombiler',
  'hud.humansUp': 'İNSAN', 'hud.zombiesUp': 'ZOMBİ', 'hud.first': 'İLK {n}', 'hud.cmp': 'K,KD,D,GD,G,GB,B,KB',
  'hud.team.blue': 'Mavi Takım', 'hud.team.red': 'Kırmızı Takım',
  'hud.bleedLose': "Rakip {n} bayrak önde: biletin {s} sn'de {n} azalıyor", 'hud.bleedWin': 'Bayrak üstünlüğün var: rakip bileti azalıyor',
  'hud.flagYours': '{f} · senin', 'hud.flagCapturing': '{f} · ele geçiriliyor',
  'hud.zone.title': 'DÜŞMAN ÜSSÜNE GİRDİN!', 'hud.zone.back': 'GERİ DÖN · {n} sn', 'hud.zone.hurt': 'CAN KAYBEDİYORSUN',
  // öldürme akışı
  'hud.kf.you': 'Sen', 'hud.kf.died': 'öldü', 'hud.kf.suicide': 'İntihar', 'hud.kf.pit': 'Kuyuya düştü', 'hud.kf.pushed': 'Kuyuya düşürdü', 'hud.kf.base': 'Düşman üssü', 'hud.kf.fell': 'Düşerek öldü', 'hud.kf.back': 'arkadan',
  'hud.pop.kill': 'ÖLDÜRME', 'hud.pop.hs': 'KAFA ATIŞI', 'hud.pop.revive': 'CANLANDIRMA', 'hud.pop.level': 'SEVİYE',
  // can / cephane / duruş
  'hud.reloading': 'dolduruluyor…', 'hud.using': 'kullanılıyor…', 'hud.prone': 'Yatıyor', 'hud.crouch': 'Çömelmiş', 'hud.leanR': 'Sağa eğik', 'hud.leanL': 'Sola eğik',
  'hud.fire.semi': 'Tek atış', 'hud.fire.burst': 'Seri (3-5 mermi)', 'hud.fire.auto': 'Otomatik', 'hud.fireS.semi': 'Tek atış', 'hud.fireS.burst': 'Seri', 'hud.fireS.auto': 'Otomatik',
  'hud.revive': 'Canlandır · sol tık', 'hud.emptyR': 'ŞARJÖR BOŞ · {k} ile doldur', 'hud.emptyNone': 'ŞARJÖR BOŞ · mermi kalmadı!',
  'hud.ggLevel': 'Seviye {n}/{m}', 'hud.pbElim': 'Paintball · {n}/{m} eleme', 'hud.rmb': 'SAĞ TIK', 'hud.ready': 'HAZIR',
  'hud.graceZ': 'Hazırlan! Serbest kalmana {n} sn', 'hud.graceH': 'Zombiler {n} sn sonra serbest kalacak — yüksek bir yere çık!',
  // oyun bildirimleri (game.js / player.js / gadgets.js)
  'hud.t.devFly': 'Geliştirici modu: uçuyorsun. W/A/S/D + Boşluk yüksel, Ctrl alçal, Shift hızlı, tekerlek hız',
  'hud.t.torchOn': 'Fener açık', 'hud.t.torchDay': 'Fener (gündüz gerekmez)', 'hud.t.torchOff': 'Fener kapalı',
  'hud.t.roomCopied': 'Oda bağlantısı kopyalandı: {c}', 'hud.t.roomCode': 'Oda kodu: {c}', 'hud.t.roomTip': 'Tıkla: oda bağlantısını kopyala',
  'hud.t.infected': 'ENFEKTE OLDUN — zombi olarak doğuyorsun', 'hud.t.bossDown': 'BOSS DEVRİLDİ — insan oldun', 'hud.t.cured': 'İYİLEŞTİN — yeniden insansın',
  'hud.t.lockRetry': 'Fare kilitlenemedi, bir saniye sonra tekrar tıkla', 'hud.t.lockFail': 'Fare kilitlenemedi · bakmak için ok tuşları, duraklatmak için Esc',
  'hud.t.pitBy': '{k} seni kuyuya düşürdü', 'hud.t.pit': 'Kuyuya düştün', 'hud.t.revivedBy': '{n} seni canlandırdı', 'hud.t.revived': '{n} canlandırıldı',
  'hud.t.ammo': 'Mühimmat dolduruldu', 'hud.t.ammoBox': 'Cephane kutusu kuruldu', 'hud.t.knifed': 'Bıçakla öldürüldün: Seviye {n}/{m}',
  'hud.t.noTeamPb': "Paintball'da takım yok: herkes tek", 'hud.t.noTeamDm': 'Ölüm maçında takım yok: herkes tek', 'hud.t.noTeamInf': 'Enfekte modunda takım seçilmez',
  'hud.t.teamFail': 'Takım değiştirilemedi', 'hud.t.disconnected': 'Sunucu bağlantısı koptu',
  'hud.t.captured': '{f} ele geçirildi', 'hud.t.lost': '{f} düşman tarafından ele geçirildi', 'hud.t.neutral': '{f} tarafsız oldu',
  'hud.t.fireMode': 'Atış modu: {m}', 'hud.t.optic': 'Nişangâh: {o}', 'hud.t.noOptic': '{w}: seçilebilir nişangâh yok',
  'hud.t.leftHand': 'Silah sol elde', 'hud.t.rightHand': 'Silah sağ elde', 'hud.t.thirdOff': 'Bu odada 3. şahıs kamera kapalı',
  'hud.t.third': '3. şahıs kamera · {a} / {b} ile omuz değiştir · {c}: 1. şahıs', 'hud.t.first': '1. şahıs kamera',
  'hud.t.flyOn': 'Uçuş AÇIK · W/A/S/D + Boşluk yüksel · Ctrl alçal · Shift hızlı · tekerlek hız', 'hud.t.flyOff': 'Uçuş kapalı', 'hud.t.flySpeed': 'Uçuş hızı {n} m/sn (Shift ×3)',
  'hud.t.botsOn': 'Botlar AÇIK', 'hud.t.botsOff': 'Botlar DONDURULDU (N: tekrar aç)', 'hud.t.godOn': 'Ölümsüzlük AÇIK', 'hud.t.godOff': 'Ölümsüzlük kapalı',
  'hud.t.workshop': 'Atölye: L uç · J/K silah değiştir (yuva başına) · 1-4 yuva',
  // takım seçimi (çevrimiçi, M)
  'hud.tm.title': 'TAKIM SEÇ', 'hud.tm.players': '{n} / {c} oyuncu', 'hud.tm.bots': '{n} bot', 'hud.tm.hint': 'Takım değiştirmek odaya yeniden bağlanır · M veya Esc: kapat',
  'hud.wheel': 'NİŞANGÂH', 'hud.wheelHint': '{w} · fareyle seç, sol tık', 'hud.zoom': '{n}x yakınlaştırma',
  'hud.tm.mine': 'SENİN TAKIMIN', 'hud.tm.full': 'DOLU', 'hud.tm.join': 'KATIL', 'hud.tm.sending': 'İstek gönderiliyor…', 'hud.tm.switching': 'Geçiliyor…',
  // maç sonu (yalnız metin)
  'end.win': 'ZAFER!', 'end.lose': 'YENİLGİ', 'end.lost': 'BAĞLANTI KOPTU', 'end.lostInfo': 'Sunucuyla bağlantı kesildi.', 'end.won': '{w} kazandı.',
  // moderasyon (12.136): atılma / ban ekranı ve giriş reddi
  'ban.kickTitle': 'ODADAN ATILDIN', 'ban.banTitle': 'BANLANDIN', 'ban.kicked': 'Bir moderatör seni odadan attı.', 'ban.kickedAdmin': 'Yönetici seni odadan çıkardı.',
  'ban.again': '{d} sonra tekrar girebilirsin.', 'ban.perm': 'Bu sunucudan kalıcı olarak banlandın.', 'ban.timed': 'Bu sunucudan banlandın · kalan süre: {d}.',
  'ban.kickJoin': 'Yakın zamanda odadan atıldın · {d} sonra tekrar girebilirsin.', 'ban.reason': 'Sebep: {r}',
  'ban.s': '{n} sn', 'ban.m': '{n} dk', 'ban.h': '{n} sa', 'ban.hm': '{n} sa {m} dk', 'ban.d': '{n} gün', 'ban.dh': '{n} gün {h} sa',
  'end.ggKnife': '{n} son silahla (bıçak) kazandı', 'end.ggTime': 'Süre doldu · {n} seviye {l} ile kazandı', 'end.dmReach': '{n} {k} öldürmeye ulaştı',
  'end.dmTime': 'Süre doldu · {n} {k} öldürmeyle kazandı', 'end.dmTie': ' (eşitlikte puanı yüksek)', 'end.infAll': 'Tüm insanlar enfekte oldu', 'end.infCured': 'Tüm zombiler iyileşti',
  'end.infSurv': '{n} insan hayatta kaldı', 'end.tdmBlue': 'Mavi takım {n} skora ulaştı', 'end.tdmRed': 'Kırmızı takım {n} skora ulaştı', 'end.time': 'Süre doldu',
  'end.blueOut': 'Mavi takımın biletleri tükendi', 'end.redOut': 'Kırmızı takımın biletleri tükendi', 'end.rank': 'Sıralama: {r}', 'end.lv': 'Sv ',
  'end.infScore': 'İnsan {h} – {z} Zombi · Takımın en iyisi: {n} ({s})', 'end.score': 'Mavi {b} – {r} Kırmızı · Takımın en iyisi: {n} ({s})',
  'end.kills': 'Öldürme', 'end.deaths': 'Ölüm', 'end.points': 'Puan',
  // ölüm / doğuş ekranı
  'death.killedBy': 'Seni öldüren', 'death.killedByHs': 'Kafandan vuran', 'death.weapon': 'Silah', 'death.dist': 'Mesafe', 'death.hpLeft': 'Kalan canı', 'death.hs': 'Kafa atışı',
  'death.dead': 'ÖLDÜ', 'death.status': 'Durum', 'death.died': 'Öldün', 'death.respawnIn': 'sn sonra doğuyorsun', 'death.deploying': 'Doğuyorsun…', 'death.deploy': 'Doğuş',
  'death.pickClass': 'Sınıf seç', 'death.spawn': 'Doğma noktası', 'death.base': 'Üs', 'death.baseSafe': 'Ana üs (güvenli)', 'death.flagOwned': 'Ele geçirdiğin bölge', 'death.unavail': 'Kullanılamaz',
  'death.humanClass': 'İnsan sınıfı', 'death.zType': 'Zombi türü', 'death.bossDesc': 'Dev can, çok hızlı, öfkeli. Gölge Sıçrayışı: ışınlan + görünmez ol.',
  'death.ggNext': 'Seviye <b>{n}/{m}</b> · sıradaki: <b>{w}</b>', 'death.bossDown': 'BOSS devrildi: ', 'death.asHuman': 'İNSAN olarak doğacaksın', 'death.livesOut': '(zombi hakkın bitti)',
  'death.asZombie': 'Zombi olarak doğacaksın', 'death.zLives': 'Yeniden doğuyorsun · kalan hakkın: {n}',
  // duraklat
  'pause.ready': 'Hazır mısın?', 'pause.intro': 'Başlamak için tıkla. Fare ekrana kilitlenir, Esc ile duraklatırsın.',
  'pause.introTouch': "Başlamak için BAŞLA'ya dokun. Kontrolleri duraklat menüsündeki Dokunmatik ayarlar'dan değiştirebilirsin.",
  'pause.paused': 'Duraklatıldı', 'pause.clickResume': 'Devam etmek için tıkla', 'pause.escMenu': 'Esc · menü', 'pause.resumeHint': 'Devam etmek için tıkla.', 'pause.start': 'Başla', 'pause.resume': 'Devam', 'pause.kill': 'Kill (yeniden doğ)',
  'pause.killTip': 'Sıkıştıysan kendini öldürüp yeniden doğ', 'pause.settings': 'Ayarlar', 'pause.controls': 'Kontroller', 'pause.menu': 'Ana Menü', 'pause.again': 'Tekrar Oyna', 'pause.touch': 'Dokunmatik ayarlar',
  // skor tablosu
  'sb.player': 'Oyuncu', 'sb.k': 'Öl', 'sb.d': 'Ölüm', 'sb.score': 'Puan', 'sb.level': 'Seviye', 'sb.weapon': 'Silah',
  'sb.ggTitle': 'Silah Yarışı · {n} silah', 'sb.pbTitle': 'Paintball · ilk {n} eleme', 'sb.dmTitle': 'Ölüm Maçı · ilk {n}',
  // sohbet
  'chat.all': 'Herkes', 'chat.team': 'Takım', 'chat.ph': 'Mesaj yaz…', 'chat.hint': 'Enter gönder · Tab kanal · Esc iptal', 'chat.tag': 'TAKIM',
  // oyun içi ayarlar
  'set.settings': 'Ayarlar', 'set.controls': 'Kontroller', 'set.back': 'Geri', 'set.lang': 'Dil / Language',
  'set.mouse': 'Fare ve görüş', 'set.sens': 'Hassasiyet', 'set.fov': 'Görüş açısı', 'set.fovH': 'Görüş açısı (yatay)',
  'set.sound': 'Ses', 'set.vol': 'Ana ses', 'set.sfx': 'Efekt sesleri', 'set.music': 'Müzik', 'set.amb': 'Ortam (yağmur, rüzgâr)', 'set.rain': 'Yağmur sesi', 'set.streak': 'Seri sesleri',
  'set.gfx': 'Grafik', 'set.low': 'Düşük', 'set.mid': 'Orta', 'set.high': 'Yüksek', 'set.shadows': 'Gölgeler', 'set.post': 'Son işleme (Yüksek)', 'set.adaptive': 'Otomatik çözünürlük', 'set.fs': 'Tam ekran + Ctrl+W koruması',
  'set.on': 'Açık', 'set.off': 'Kapalı', 'set.gfxHint': 'Düşük kalite ve kapalı gölge, zayıf bilgisayarlarda ve büyük maçlarda akıcılığı artırır. Tam ekran değişikliği oyuna döndüğünde uygulanır.',
  'set.touch': 'Dokunmatik kontroller', 'set.touchBtn': 'Dokunmatik ayarlar ›', 'set.touchHint': 'Buton düzeni, bakış / nişan hassasiyeti, jiroskop ve nişan yardımı.',
  'set.hand': 'Silahı tutan el', 'set.right': 'Sağ el', 'set.left': 'Sol el', 'set.ads': 'Nişan alma (sağ tık)', 'set.hold': 'Basılı tut', 'set.toggle': 'Bir kez bas (aç-kapa)',
  'set.keys': 'Tuş atama', 'set.keysHint': 'Bir tuşa tıkla, sonra yeni tuşa bas. Her eyleme en çok 2 tuş. Geri tuşu temizler, Esc vazgeçer. Aynı tuş başka eyleme atanmışsa oradan alınır.',
  'set.reset': 'Varsayılana dön', 'set.fixed': 'Sabit tuşlar', 'set.fixedHint': 'Ateş / nişan: sol tık / sağ tık · Silah değiştir: fare tekeri · Duraklat: Esc',
  'set.press': 'Tuşa bas…', 'set.resetDone': 'Tuşlar varsayılana döndü', 'set.cleared': 'Tuş temizlendi', 'set.reserved': 'Bu tuş atanamaz', 'set.taken': '"{k}" tuşu "{a}" eyleminden alındı', 'set.space': 'Boşluk',
});

addStrings('en', {
  'hud.blue': 'BLUE', 'hud.red': 'RED', 'hud.you': 'YOU', 'hud.leader': 'LEADER', 'hud.tie': 'TIED', 'hud.humans': 'Humans', 'hud.zombies': 'Zombies',
  'hud.humansUp': 'HUMANS', 'hud.zombiesUp': 'ZOMBIES', 'hud.first': 'FIRST TO {n}', 'hud.cmp': 'N,NE,E,SE,S,SW,W,NW',
  'hud.team.blue': 'Blue Team', 'hud.team.red': 'Red Team',
  'hud.bleedLose': 'Enemy holds {n} more flag(s): you lose {n} ticket(s) every {s}s', 'hud.bleedWin': 'You hold more flags: enemy tickets are draining',
  'hud.flagYours': '{f} · secured', 'hud.flagCapturing': '{f} · capturing',
  'hud.zone.title': 'ENEMY BASE!', 'hud.zone.back': 'GO BACK · {n} SEC', 'hud.zone.hurt': 'LOSING HEALTH',
  'hud.kf.you': 'You', 'hud.kf.died': 'died', 'hud.kf.suicide': 'Suicide', 'hud.kf.pit': 'Fell into the pit', 'hud.kf.pushed': 'Pushed into the pit', 'hud.kf.base': 'Enemy base', 'hud.kf.fell': 'Fell to death', 'hud.kf.back': 'backstab',
  'hud.pop.kill': 'KILL', 'hud.pop.hs': 'HEADSHOT', 'hud.pop.revive': 'REVIVE', 'hud.pop.level': 'LEVEL',
  'hud.reloading': 'reloading…', 'hud.using': 'using…', 'hud.prone': 'Prone', 'hud.crouch': 'Crouched', 'hud.leanR': 'Leaning right', 'hud.leanL': 'Leaning left',
  'hud.fire.semi': 'Single', 'hud.fire.burst': 'Burst (3-5 rounds)', 'hud.fire.auto': 'Full auto', 'hud.fireS.semi': 'Single', 'hud.fireS.burst': 'Burst', 'hud.fireS.auto': 'Auto',
  'hud.revive': 'Revive · left click', 'hud.emptyR': 'MAGAZINE EMPTY · {k} to reload', 'hud.emptyNone': 'MAGAZINE EMPTY · out of ammo!',
  'hud.ggLevel': 'Level {n}/{m}', 'hud.pbElim': 'Paintball · {n}/{m} eliminations', 'hud.rmb': 'RMB', 'hud.ready': 'READY',
  'hud.graceZ': 'Get ready! Released in {n} sec', 'hud.graceH': 'Zombies are released in {n} sec — get to high ground!',
  'hud.t.devFly': 'Developer mode: flying. W/A/S/D + Space up, Ctrl down, Shift fast, wheel speed',
  'hud.t.torchOn': 'Flashlight on', 'hud.t.torchDay': 'Flashlight (not needed in daylight)', 'hud.t.torchOff': 'Flashlight off',
  'hud.t.roomCopied': 'Room link copied: {c}', 'hud.t.roomCode': 'Room code: {c}', 'hud.t.roomTip': 'Click: copy the room link',
  'hud.t.infected': 'INFECTED — you will respawn as a zombie', 'hud.t.bossDown': 'BOSS DOWN — you are human again', 'hud.t.cured': 'CURED — you are human again',
  'hud.t.lockRetry': 'Could not lock the mouse, click again in a second', 'hud.t.lockFail': 'Could not lock the mouse · arrow keys to look, Esc to pause',
  'hud.t.pitBy': '{k} pushed you into the pit', 'hud.t.pit': 'You fell into the pit', 'hud.t.revivedBy': '{n} revived you', 'hud.t.revived': '{n} revived',
  'hud.t.ammo': 'Ammo refilled', 'hud.t.ammoBox': 'Ammo box deployed', 'hud.t.knifed': 'Knifed: Level {n}/{m}',
  'hud.t.noTeamPb': 'No teams in Paintball: everyone for themselves', 'hud.t.noTeamDm': 'No teams in Deathmatch: everyone for themselves', 'hud.t.noTeamInf': 'Teams cannot be chosen in Infection',
  'hud.t.teamFail': 'Could not switch team', 'hud.t.disconnected': 'Lost connection to the server',
  'hud.t.captured': '{f} captured', 'hud.t.lost': '{f} captured by the enemy', 'hud.t.neutral': '{f} is neutral',
  'hud.t.fireMode': 'Fire mode: {m}', 'hud.t.optic': 'Sight: {o}', 'hud.t.noOptic': '{w}: no sights available',
  'hud.t.leftHand': 'Weapon in left hand', 'hud.t.rightHand': 'Weapon in right hand', 'hud.t.thirdOff': 'Third-person camera is disabled in this room',
  'hud.t.third': 'Third-person camera · {a} / {b} to swap shoulder · {c}: first person', 'hud.t.first': 'First-person camera',
  'hud.t.flyOn': 'Fly ON · W/A/S/D + Space up · Ctrl down · Shift fast · wheel speed', 'hud.t.flyOff': 'Fly off', 'hud.t.flySpeed': 'Fly speed {n} m/s (Shift ×3)',
  'hud.t.botsOn': 'Bots ON', 'hud.t.botsOff': 'Bots FROZEN (N: resume)', 'hud.t.godOn': 'God mode ON', 'hud.t.godOff': 'God mode off',
  'hud.t.workshop': 'Workshop: L fly · J/K cycle weapon (per slot) · 1-4 slots',
  'hud.tm.title': 'CHOOSE TEAM', 'hud.tm.players': '{n} / {c} players', 'hud.tm.bots': '{n} bots', 'hud.tm.hint': 'Switching team reconnects to the room · M or Esc: close',
  'hud.wheel': 'SIGHT', 'hud.wheelHint': '{w} · pick with the mouse, left click', 'hud.zoom': '{n}x zoom',
  'hud.tm.mine': 'YOUR TEAM', 'hud.tm.full': 'FULL', 'hud.tm.join': 'JOIN', 'hud.tm.sending': 'Sending request…', 'hud.tm.switching': 'Switching…',
  'end.win': 'VICTORY!', 'end.lose': 'DEFEAT', 'end.lost': 'DISCONNECTED', 'end.lostInfo': 'The connection to the server was lost.', 'end.won': '{w} won.',
  'ban.kickTitle': 'KICKED FROM ROOM', 'ban.banTitle': 'BANNED', 'ban.kicked': 'A moderator kicked you from the room.', 'ban.kickedAdmin': 'An administrator removed you from the room.',
  'ban.again': 'You can rejoin in {d}.', 'ban.perm': 'You are permanently banned from this server.', 'ban.timed': 'You are banned from this server · time left: {d}.',
  'ban.kickJoin': 'You were recently kicked from a room · you can rejoin in {d}.', 'ban.reason': 'Reason: {r}',
  'ban.s': '{n} s', 'ban.m': '{n} min', 'ban.h': '{n} h', 'ban.hm': '{n} h {m} min', 'ban.d': '{n} d', 'ban.dh': '{n} d {h} h',
  'end.ggKnife': '{n} won with the final weapon (knife)', 'end.ggTime': 'Time is up · {n} won at level {l}', 'end.dmReach': '{n} reached {k} kills',
  'end.dmTime': 'Time is up · {n} won with {k} kills', 'end.dmTie': ' (higher score breaks the tie)', 'end.infAll': 'All humans were infected', 'end.infCured': 'All zombies were cured',
  'end.infSurv': '{n} humans survived', 'end.tdmBlue': 'Blue team reached {n} points', 'end.tdmRed': 'Red team reached {n} points', 'end.time': 'Time is up',
  'end.blueOut': 'Blue team ran out of tickets', 'end.redOut': 'Red team ran out of tickets', 'end.rank': 'Ranking: {r}', 'end.lv': 'Lv ',
  'end.infScore': 'Humans {h} – {z} Zombies · Team best: {n} ({s})', 'end.score': 'Blue {b} – {r} Red · Team best: {n} ({s})',
  'end.kills': 'Kills', 'end.deaths': 'Deaths', 'end.points': 'Score',
  'death.killedBy': 'Killed by', 'death.killedByHs': 'Headshot by', 'death.weapon': 'Weapon', 'death.dist': 'Distance', 'death.hpLeft': 'Their HP', 'death.hs': 'Headshot',
  'death.dead': 'DEAD', 'death.status': 'Status', 'death.died': 'You died', 'death.respawnIn': 'seconds to respawn', 'death.deploying': 'Deploying…', 'death.deploy': 'Deploy',
  'death.pickClass': 'Choose class', 'death.spawn': 'Spawn point', 'death.base': 'Base', 'death.baseSafe': 'Main base (safe)', 'death.flagOwned': 'Held by your team', 'death.unavail': 'Unavailable',
  'death.humanClass': 'Human class', 'death.zType': 'Zombie type', 'death.bossDesc': 'Huge health, very fast, furious. Shadow Leap: teleport + turn invisible.',
  'death.ggNext': 'Level <b>{n}/{m}</b> · next: <b>{w}</b>', 'death.bossDown': 'BOSS down: ', 'death.asHuman': 'you will respawn as a HUMAN', 'death.livesOut': '(no zombie lives left)',
  'death.asZombie': 'You will respawn as a zombie', 'death.zLives': 'Respawning · lives left: {n}',
  'pause.ready': 'Ready?', 'pause.intro': 'Click to start. The mouse locks to the screen; press Esc to pause.',
  'pause.introTouch': 'Tap START to begin. You can change the controls under Touch settings in the pause menu.',
  'pause.paused': 'Paused', 'pause.clickResume': 'Click to continue', 'pause.escMenu': 'Esc · menu', 'pause.resumeHint': 'Click to continue.', 'pause.start': 'Start', 'pause.resume': 'Resume', 'pause.kill': 'Respawn (kill)',
  'pause.killTip': 'Stuck? Kill yourself and respawn', 'pause.settings': 'Settings', 'pause.controls': 'Controls', 'pause.menu': 'Main Menu', 'pause.again': 'Play Again', 'pause.touch': 'Touch settings',
  'sb.player': 'Player', 'sb.k': 'K', 'sb.d': 'D', 'sb.score': 'Score', 'sb.level': 'Level', 'sb.weapon': 'Weapon',
  'sb.ggTitle': 'Gun Game · {n} weapons', 'sb.pbTitle': 'Paintball · first to {n}', 'sb.dmTitle': 'Deathmatch · first to {n}',
  'chat.all': 'All', 'chat.team': 'Team', 'chat.ph': 'Type a message…', 'chat.hint': 'Enter send · Tab channel · Esc cancel', 'chat.tag': 'TEAM',
  'set.settings': 'Settings', 'set.controls': 'Controls', 'set.back': 'Back', 'set.lang': 'Language / Dil',
  'set.mouse': 'Mouse and view', 'set.sens': 'Sensitivity', 'set.fov': 'Field of view', 'set.fovH': 'Field of view (horizontal)',
  'set.sound': 'Sound', 'set.vol': 'Master volume', 'set.sfx': 'Effects', 'set.music': 'Music', 'set.amb': 'Ambience (rain, wind)', 'set.rain': 'Rain sound', 'set.streak': 'Streak sounds',
  'set.gfx': 'Graphics', 'set.low': 'Low', 'set.mid': 'Medium', 'set.high': 'High', 'set.shadows': 'Shadows', 'set.post': 'Post-processing (High)', 'set.adaptive': 'Auto resolution', 'set.fs': 'Fullscreen + Ctrl+W guard',
  'set.on': 'On', 'set.off': 'Off', 'set.gfxHint': 'Low quality and no shadows run smoother on weak computers and in big matches. The fullscreen change applies when you return to the game.',
  'set.touch': 'Touch controls', 'set.touchBtn': 'Touch settings ›', 'set.touchHint': 'Button layout, look / aim sensitivity, gyroscope and aim assist.',
  'set.hand': 'Weapon hand', 'set.right': 'Right hand', 'set.left': 'Left hand', 'set.ads': 'Aim down sights (right click)', 'set.hold': 'Hold', 'set.toggle': 'Toggle',
  'set.keys': 'Key bindings', 'set.keysHint': 'Click a key, then press the new key. Up to 2 keys per action. Backspace clears, Esc cancels. A key already used elsewhere is moved here.',
  'set.reset': 'Reset to defaults', 'set.fixed': 'Fixed keys', 'set.fixedHint': 'Fire / aim: left / right click · Switch weapon: mouse wheel · Pause: Esc',
  'set.press': 'Press a key…', 'set.resetDone': 'Keys reset to defaults', 'set.cleared': 'Key cleared', 'set.reserved': 'This key cannot be bound', 'set.taken': '"{k}" was taken from "{a}"', 'set.space': 'Space',
  'set.grp.0': 'Movement', 'set.grp.1': 'Stance', 'set.grp.2': 'Weapon', 'set.grp.3': 'Camera and interface',
  'set.act.forward': 'Forward', 'set.act.back': 'Back', 'set.act.left': 'Left', 'set.act.right': 'Right', 'set.act.sprint': 'Sprint', 'set.act.jump': 'Jump / stand up',
  'set.act.crouch': 'Crouch', 'set.act.prone': 'Prone', 'set.act.leanLeft': 'Lean left', 'set.act.leanRight': 'Lean right', 'set.act.reload': 'Reload',
  'set.act.slot1': 'Primary weapon', 'set.act.slot2': 'Secondary weapon', 'set.act.slot3': 'Gadget', 'set.act.slot4': 'Knife', 'set.act.fireMode': 'Fire mode (single → burst → auto)',
  'set.act.ability': 'Zombie ability (Infection) · right click works too', 'set.act.optic': 'Cycle sight (quick)', 'set.act.wheel': 'Sight wheel (hold)', 'set.act.holdBreath': 'Hold breath (scoped, hold)', 'set.act.inspect': 'Inspect weapon',
  'set.act.leftHand': 'Left ↔ right hand (weapon hand)', 'set.act.third': 'Third-person camera', 'set.act.flashlight': 'Flashlight', 'set.act.team': 'Team select (online)',
  'set.act.chat': 'Chat (online) · Shift for team', 'set.act.scoreboard': 'Scoreboard (hold)',
  // veri adları (Türkçesi stats.js'te)
  'hud.wpn.shotgun': 'Shotgun', 'hud.wpn.dbl': 'Double Barrel', 'hud.wpn.sniper': 'M24 Sniper', 'hud.wpn.m79': 'M79 Launcher', 'hud.wpn.grenade': 'Frag Grenade',
  'hud.wpn.smoke': 'Smoke Grenade', 'hud.wpn.flash': 'Flashbang', 'hud.wpn.ammobox': 'Ammo Box', 'hud.wpn.medkit': 'First Aid', 'hud.wpn.knife': 'Knife',
  'hud.wpn.machete': 'Machete', 'hud.wpn.claws': 'Claws', 'hud.wpn.pbrifle': 'Paintball Rifle', 'hud.wpn.pbpistol': 'Paintball Pistol',
  'hud.opt.iron': 'Iron Sights', 'hud.opt.reddot': 'Red Dot', 'hud.opt.holo': 'Holographic', 'hud.opt.acog': 'ACOG', 'hud.opt.scope': '4x Scope', 'hud.opt.scope6': '6x Scope', 'hud.opt.ww_peep': 'Peep Sight', 'hud.opt.ww_scout': '1.5x Scout Scope', 'hud.opt.ww_sc25': '2.5x Scope', 'hud.opt.ww_sc4': '4x Scope',
  'hud.zt.walker': 'Walker', 'hud.zt.runner': 'Runner', 'hud.zt.brute': 'Brute', 'hud.zt.ghost': 'Ghost', 'hud.zt.blinker': 'Blinker',
  'hud.zt.walker.desc': 'Balanced. Rage: briefly fast and deadly.', 'hud.zt.runner.desc': 'Very fast, fragile. Dash: a burst of incredible speed.',
  'hud.zt.brute.desc': 'Very tough, hits hard. Armor: heavily reduces damage.', 'hud.zt.ghost.desc': 'Cloak: nobody sees you until you attack.',
  'hud.zt.blinker.desc': 'Blink: teleports 14 m in the direction you look.',
  'hud.ab.shadow': 'Shadow Leap', 'hud.ab.rage': 'Rage', 'hud.ab.burst': 'Dash', 'hud.ab.shield': 'Armor', 'hud.ab.cloak': 'Cloak', 'hud.ab.blink': 'Blink',
  'class.assault.desc': 'Balanced rifle + 2 frag grenades', 'class.medic.desc': 'SMG, medkit, heals nearby allies', 'class.sniper.desc': 'One shot, long-range scope',
  'class.heavy.desc': '100-round LMG, extra health', 'class.engineer.desc': 'Shotgun + rocket launcher', 'class.zombie.desc': 'Clawed infected',
});

// Moderasyon (12.136): sunucunun ban nesnesi { k:'kick'|'ban', ms (kalan; 0 = kalıcı / atmada engel yok), r (sebep) } → okunur metin
export function banDur(ms) {
  const s = Math.max(1, Math.round(ms / 1000));
  if (s < 60) return t('ban.s', { n: s });
  const m = Math.round(s / 60);
  if (m < 60) return t('ban.m', { n: m });
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return mm ? t('ban.hm', { n: h, m: mm }) : t('ban.h', { n: h });
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? t('ban.dh', { n: d, h: hh }) : t('ban.d', { n: d });
}
// join: giriş reddi metni; değilse oyundayken atılma ekranının açıklaması
export function banText(b, join = false) {
  const r = b.r ? ' ' + t('ban.reason', { r: b.r }) : '';
  if (b.k === 'ban') return (b.ms ? t('ban.timed', { d: banDur(b.ms) }) : t('ban.perm')) + r;
  if (join) return t('ban.kickJoin', { d: banDur(b.ms) }) + r;
  return t(b.adm ? 'ban.kickedAdmin' : 'ban.kicked') + (b.ms ? ' ' + t('ban.again', { d: banDur(b.ms) }) : '') + r;
}
