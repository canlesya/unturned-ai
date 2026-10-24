// Tuş atama mantığı testi:  node scripts/bindtest.mjs
import { Binds, ACTIONS, norm, slotOrder } from '../src/core/keybinds.js';
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'OK    ' : 'HATA  ') + msg); if (!ok) fail++; };
const b = new Binds();
check(b.is('forward', 'KeyW') && b.is('crouch', 'KeyC') && b.is('crouch', 'ControlRight'), 'varsayılanlar: W ileri, C ve (sağ/sol) Ctrl çömel');
check(b.slotOf('Digit3') === 2 && b.slotOf('KeyV') === 2 && b.slotOf('Digit4') === 3 && b.slotOf('KeyG') === 3 && b.slotOf('Digit1') === 0, 'silah yuvası tuşları (konum: 1 ana, 2 yedek, 3/V bıçak, 4/G gadget)');
check(slotOrder(4).join() === '0,1,3,2' && slotOrder(3).join() === '0,1,2' && slotOrder(2).join() === '0,1', 'konum → items indeksi (standart: 3 → bıçak items[3], 4 → gadget items[2]; paintball / silah oyunu doğal sıra)');
// 12.140: eski kayıtlı tercihler — hiç değiştirmemiş: yeni varsayılan; kendi ataması: korunur, çakışan yeni varsayılan düşer
check(new Binds({ jump: ['KeyJ'] }).slotOf('Digit3') === 2 && new Binds({}).slotOf('Digit4') === 3, 'tuşları değiştirmemiş eski kayıt → 3 bıçak, 4 gadget');
{ const o = new Binds({ slot3: ['Digit3'] }); check(o.slotOf('Digit3') === 3 && o.codes('slot4').join() === 'KeyV', 'eski kayıt gadget = 3 (özel) → korunur, bıçağın yeni varsayılanından 3 düşer'); }
{ const o = new Binds({ slot4: ['Digit4'] }); check(o.slotOf('Digit4') === 2 && o.codes('slot3').join() === 'KeyG', 'eski kayıt bıçak = 4 (özel) → korunur, gadget varsayılanından 4 düşer'); }
{ const o = new Binds({ inspect: ['Digit4'], slot4: ['KeyV'] }); check(o.is('inspect', 'Digit4') && !o.is('slot3', 'Digit4'), 'başka eyleme verilmiş 4 → gadget varsayılanından düşer'); }
{ const o = new Binds({ ability: ['KeyF', 'KeyK'] }); check(o.is('flashlight', 'KeyF') && o.is('ability', 'KeyF'), 'varsayılan ortak tuşlar (F) değişmez');}
let taken = b.set('crouch', 0, 'ControlLeft');
check(b.codes('crouch').join() === 'ControlLeft' && taken === null && !b.is('crouch', 'KeyC'), 'çömelmeyi yalnızca Ctrl’e al (C artık çömeltmez)');
taken = b.set('prone', 0, 'ControlLeft');
check(taken === 'crouch' && b.codes('crouch').length === 0 && b.is('prone', 'ControlLeft'), 'aynı tuş başka eyleme verilince oradan alınır');
check(JSON.stringify(b.toJSON()) === JSON.stringify({ crouch: [], prone: ['ControlLeft'] }), 'yalnızca varsayılandan farklılar kaydedilir');
const c = new Binds(b.toJSON());
check(c.codes('crouch').length === 0 && c.is('prone', 'ControlLeft') && c.is('forward', 'KeyW'), 'kayıttan geri yükleme (boş atama dahil)');
c.reset(); check(c.is('crouch', 'KeyC') && !c.is('prone', 'ControlLeft'), 'varsayılana dön');
check(new Binds({ forward: ['Escape', 'KeyI'] }).codes('forward').join() === 'KeyI', 'Esc atanamaz');
check(norm('ShiftRight') === 'ShiftLeft', 'sağ/sol Shift aynı');
{ const o = new Binds(); check(o.is('holdBreath', 'ShiftLeft') && o.is('sprint', 'ShiftLeft') && o.is('holdBreath', 'ShiftRight'), 'nefes tut (12.156): varsayılan Shift, koşu ile ortak'); }
{ const o = new Binds({ holdBreath: ['KeyK'] }); check(o.is('holdBreath', 'KeyK') && o.is('sprint', 'ShiftLeft') && o.slotOf('Digit3') === 2 && o.slotOf('Digit4') === 3, 'nefes tut özel tuş → koşu Shift kalır, 3 bıçak / 4 gadget bozulmaz'); }
check(ACTIONS.every((a) => a.def.length >= 1 && a.def.length <= 2), 'her eylemin 1-2 varsayılan tuşu var');
console.log(fail ? 'sonuç: HATA' : 'sonuç: OK'); process.exit(fail ? 1 : 0);
