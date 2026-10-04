// Tuş özelleştirme: eylem → en çok 2 tuş (KeyboardEvent.code). Menüde (Kontroller) değiştirilir, localStorage'da (prefs.keys) saklanır,
// oyunda Player / Game bu modül üzerinden okur. Fare tuşları (ateş / nişan), Esc ve sunucu geliştirici tuşları sabittir.

export const GROUPS = ['Hareket', 'Duruş', 'Silah', 'Kamera ve arayüz'];

// id, etiket, grup, varsayılan tuşlar
export const ACTIONS = [
  ['forward', 'İleri', 0, ['KeyW']],
  ['back', 'Geri', 0, ['KeyS']],
  ['left', 'Sola', 0, ['KeyA']],
  ['right', 'Sağa', 0, ['KeyD']],
  ['sprint', 'Koş', 0, ['ShiftLeft']],
  ['jump', 'Zıpla / kalk', 0, ['Space']],
  ['crouch', 'Çömel', 1, ['KeyC', 'ControlLeft']],
  ['prone', 'Yat', 1, ['KeyZ']],
  ['leanLeft', 'Sola eğil', 1, ['KeyQ']],
  ['leanRight', 'Sağa eğil', 1, ['KeyE']],
  ['reload', 'Şarjör değiştir', 2, ['KeyR']],
  ['slot1', 'Ana silah', 2, ['Digit1']],
  ['slot2', 'Yedek silah', 2, ['Digit2']],
  ['slot3', 'Gadget', 2, ['Digit3', 'KeyG']],
  ['slot4', 'Bıçak', 2, ['Digit4', 'KeyV']],
  ['fireMode', 'Ateş modu (tek → seri → otomatik)', 2, ['KeyX']],
  ['ability', 'Zombi özel gücü (Enfekte) · sağ tık da çalışır', 2, ['KeyF']],
  ['optic', 'Nişangâh değiştir (hızlı)', 2, ['KeyB']],
  ['wheel', 'Nişangâh çarkı (basılı tut)', 2, ['KeyT']],
  ['inspect', 'Silahı incele', 2, ['KeyY']],
  ['leftHand', 'Sol el ↔ sağ el (silahı tutan el)', 2, ['KeyU']],
  ['third', '3. şahıs kamera', 3, ['KeyH']],
  ['flashlight', 'Fener', 3, ['KeyF']],
  ['team', 'Takım seçimi (çevrimiçi)', 3, ['KeyM']],
  ['scoreboard', 'Skor tablosu (basılı tut)', 3, ['Tab']],
].map(([id, label, group, def]) => ({ id, label, group, def }));

// Sağ/sol modifier tuşları aynı sayılır (Ctrl, Shift, Alt)
export const norm = (code) => (code === 'ControlRight' ? 'ControlLeft' : code === 'ShiftRight' ? 'ShiftLeft' : code === 'AltRight' ? 'AltLeft' : code);

// Atanamayan tuşlar
export const RESERVED = new Set(['Escape', 'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'ContextMenu']);

export class Binds {
  constructor(saved = {}) {
    this.map = {};
    for (const a of ACTIONS) {
      const s = saved && saved[a.id];
      this.map[a.id] = Array.isArray(s) ? s.filter((c) => typeof c === 'string' && c && !RESERVED.has(c)).map(norm).slice(0, 2) : a.def.slice();
    }
  }
  codes(action) { return this.map[action] || []; }
  is(action, code) { return this.codes(action).includes(norm(code)); }
  held(action, keys) { return this.codes(action).some((c) => keys.has(c)); }
  // bu tuş hangi eylemlere atanmış
  actionsOf(code) { code = norm(code); return ACTIONS.filter((a) => this.map[a.id].includes(code)).map((a) => a.id); }
  // 0-3: silah yuvası eylemi (slot1..slot4); yoksa -1
  slotOf(code) { for (let i = 0; i < 4; i++) if (this.is('slot' + (i + 1), code)) return i; return -1; }
  // slot: 0 ya da 1. Başka eylemdeki aynı tuş oradan alınır; döner: alınan eylemin id'si ya da null
  set(action, slot, code) {
    code = norm(code);
    let taken = null;
    for (const a of ACTIONS) {
      if (a.id === action) continue;
      const i = this.map[a.id].indexOf(code);
      if (i >= 0) { this.map[a.id].splice(i, 1); taken = a.id; }
    }
    const cur = this.map[action];
    const dup = cur.indexOf(code);
    if (dup >= 0 && dup !== slot) cur.splice(dup, 1);
    cur[Math.min(slot, cur.length)] = code;
    this.map[action] = cur.filter(Boolean).slice(0, 2);
    return taken;
  }
  clear(action, slot) { this.map[action].splice(slot, 1); }
  reset() { for (const a of ACTIONS) this.map[a.id] = a.def.slice(); }
  // yalnızca varsayılandan farklı olanlar (kayıt için)
  toJSON() {
    const out = {};
    for (const a of ACTIONS) if (this.map[a.id].join() !== a.def.join()) out[a.id] = this.map[a.id];
    return out;
  }
}

const NAMES = {
  Space: 'Boşluk', ShiftLeft: 'Shift', ControlLeft: 'Ctrl', AltLeft: 'Alt', Tab: 'Tab', CapsLock: 'Caps', Enter: 'Enter', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', IntlBackslash: '<', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn',
};
export function codeLabel(code) {
  if (!code) return '—';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

