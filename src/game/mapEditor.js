// Harita editörü (geliştirici modu, çevrimdışı). I: aç / kapa. Nişangâhla bak → sol tık: seç. Seçili nesne: Delete sil · ok tuşları taşı (bakış yönüne göre)
// · PageUp / PageDown yukarı / aşağı · Shift: 1 m adım (yoksa 0,25 m) · + / − büyüt / küçült · ] / [ yalnız yükseklik · Backspace geri al
// · Home: seçili nesnenin kimliğini kopyala · End: tüm düzenlemeleri kopyala.
// Nesneler MapBuilder'ın kimlikleridir (bina:12, kasa:40, kenar:7, kapı:Mid Doors, köprü:tabliye, pencere:3:1 …). Düzenlemeler canlı uygulanır
// (birleşik ağın köşeleri + çarpışma kutuları), tarayıcıya kaydedilir (yeniden yüklemede de görünür) ve "Düzenlemeleri kopyala" ile bana gönderilir:
// ben de harita dosyasına (ör. src/maps/colgecidiEdits.js) işleyip kalıcı yaparım. Botların yol ızgarası canlı güncellenmez (kalıcılaşınca güncellenir).
import * as THREE from 'three';
import { MapBuilder } from '../maps/builder.js';

const KEY = (map) => 'warbyte.harita-duzenleme.' + map;
const KINDS = { bina: 'Bina', kasa: 'Kasa / konteyner', kenar: 'Kat kenarı (istinat duvarı)', 'kenar-ç': 'Kat kenarı', kapı: 'Kapı', köprü: 'Köprü parçası', çatı: 'Çatı', sandık: 'Sandık', araç: 'Araç',
  pencere: 'Pencere (süs)', 'süs-kapı': 'Kapı (süs)', cephe: 'Cephe süsü (korniş / kiriş)', pano: 'Pano', tabela: 'Saha tabelası', palmiye: 'Palmiye', çanak: 'Uydu çanağı', çevre: 'Çevre duvarı',
  'B-penceresi': 'B penceresi', 'tünel-ağzı': 'Tünel ağzı', 'dış-çevre': 'Uzak manzara', parça: 'Parça', çarpışma: 'Görünmez çarpışma' };

export function loadEdits(map) { try { return JSON.parse(localStorage.getItem(KEY(map)) || '[]'); } catch { return []; } }

const CSS = `
#med{position:absolute;right:14px;top:120px;width:330px;background:rgba(9,12,18,.9);border:1px solid rgba(255,174,58,.5);color:#e8edf5;font:600 13px Bahnschrift,Rajdhani,'Segoe UI',sans-serif;padding:10px 12px;z-index:25;pointer-events:auto;display:none}
#med h4{margin:0 0 6px;font-size:13px;letter-spacing:3px;color:#ffb347;text-transform:uppercase}
#med .sel{background:rgba(255,255,255,.05);padding:6px 8px;margin:6px 0;line-height:1.45;word-break:break-all}
#med .sel b{color:#ffd27a}
#med .k{font-size:11.5px;opacity:.72;line-height:1.55}
#med kbd{background:#2c3646;padding:0 4px;border-radius:2px;font:inherit}
#med .row{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
#med button{cursor:pointer;background:#2c3646;color:#e8edf5;border:0;padding:5px 9px;font:inherit;font-size:12px}
#med button.hot{background:linear-gradient(100deg,#ffb347,#ff7a12);color:#160a02}
#med textarea{width:100%;height:70px;margin-top:6px;background:#0d1219;color:#cfe6ff;border:1px solid rgba(255,255,255,.15);font:11px Consolas,monospace;display:none}
#med .w{color:#ff9a88;font-size:11.5px}
`;

export class MapEditor {
  constructor(game) {
    this.g = game; this.active = false; this.sel = null; this.hover = null;
    this.mapId = game.mapDef?.id || game.opts.map;
    this.edits = new Map(loadEdits(this.mapId).filter((e) => e && e.id).map((e) => [e.id, { ...e, d: e.d || [0, 0, 0], s: e.s || [1, 1, 1] }]));   // kayıtta yalnız değişen alanlar var: eksikleri tamamla
    this.undo = [];
    this.index();
    const st = (this.st = document.createElement('style')); st.textContent = CSS; document.head.appendChild(st);
    const el = (this.el = document.createElement('div')); el.id = 'med'; game.hud.root.appendChild(el);
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.cmd(b.dataset.c); });
    this.boxSel = new THREE.Box3Helper(new THREE.Box3(), 0xffa62b); this.boxHov = new THREE.Box3Helper(new THREE.Box3(), 0x9fd0ff);
    for (const h of [this.boxSel, this.boxHov]) { h.visible = false; h.material.depthTest = false; h.renderOrder = 999; game.scene.add(h); }
    this._k = (e) => this.onKey(e); this._m = (e) => this.onMouse(e);
    window.addEventListener('keydown', this._k, true); window.addEventListener('mousedown', this._m, true);
    this._t = setInterval(() => this.active && this.updateHover(), 120);
    const sk = game.map.editSkipped || [];
    this.warn = sk.length ? `Uygulanamayan düzenleme: ${sk.join(', ')}` : '';
  }

  // birleşik ağlarda kimlik → [{mesh, start, count}]
  index() {
    this.meshes = []; this.ranges = new Map();
    this.g.map.group.traverse((o) => { if (o.isMesh && o.userData.ranges) { this.meshes.push(o); for (const r of o.userData.ranges) { let a = this.ranges.get(r.oid); if (!a) this.ranges.set(r.oid, (a = [])); a.push({ mesh: o, start: r.start, count: r.count }); } } });
    for (const m of this.meshes) { const R = m.userData.ranges; m.userData.starts = R.map((r) => r.start); }
  }
  oidAt(mesh, vi) { const S = mesh.userData.starts; let lo = 0, hi = S.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid] <= vi) lo = mid; else hi = mid - 1; } return mesh.userData.ranges[lo].oid; }
  colsOf(id) { return this.g.world.colliders.filter((c) => c.oid === id); }

  pick() {
    const cam = this.g.camera, rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), cam); rc.far = 250;
    const hit = rc.intersectObjects(this.meshes, false).find((h) => h.faceIndex != null);
    if (!hit) return null;
    const id = this.oidAt(hit.object, hit.faceIndex * 3);
    return this.edits.get(id)?.del ? null : id;
  }
  bbox(id) {
    const b = new THREE.Box3(), v = new THREE.Vector3();
    for (const { mesh, start, count } of this.ranges.get(id) || []) { const P = mesh.geometry.attributes.position; for (let i = start; i < start + count; i++) b.expandByPoint(v.fromBufferAttribute(P, i)); }
    for (const c of this.colsOf(id)) { b.expandByPoint(v.set(...c.min)); b.expandByPoint(v.set(...c.max)); }
    return b;
  }
  pivot(id) {                                                             // MapBuilder.pivotOf ile aynı kural (çarpışma varsa ondan)
    const cs = this.colsOf(id);
    if (cs.length) return MapBuilder.pivotOf(cs, []);
    const b = this.bbox(id); return [+((b.min.x + b.max.x) / 2).toFixed(3), +b.min.y.toFixed(3), +((b.min.z + b.max.z) / 2).toFixed(3)];
  }

  toggle() {
    this.active = !this.active; this.el.style.display = this.active ? 'block' : 'none';
    if (!this.active) { this.boxSel.visible = this.boxHov.visible = false; this.sel = null; }
    this.g.hud.toast(this.active ? 'HARİTA EDİTÖRÜ AÇIK · nişangâhla bak, sol tıkla seç' : 'Harita editörü kapalı', '#ffd27a');
    this.render();
  }
  updateHover() { const id = this.pick(); const ch = id !== this.hover; this.hover = id; if (ch) this.render(); if (id && id !== this.sel) { this.boxHov.box.copy(this.bbox(id)); this.boxHov.visible = true; } else this.boxHov.visible = false; }
  select(id) { this.sel = id; if (id) { this.boxSel.box.copy(this.bbox(id)); this.boxSel.visible = true; } else this.boxSel.visible = false; this.render(); }

  // ── işlemler ──
  snapshot(id) {
    return { id, verts: (this.ranges.get(id) || []).map(({ mesh, start, count }) => ({ mesh, start, a: mesh.geometry.attributes.position.array.slice(start * 3, (start + count) * 3) })),
      cols: this.colsOf(id).map((c) => ({ c, min: c.min.slice(), max: c.max.slice() })), edit: this.edits.has(id) ? JSON.parse(JSON.stringify(this.edits.get(id))) : null };
  }
  restore(sn) {
    for (const { mesh, start, a } of sn.verts) { mesh.geometry.attributes.position.array.set(a, start * 3); this.dirty(mesh); }
    for (const { c, min, max } of sn.cols) { c.min = min; c.max = max; }
    if (sn.edit) this.edits.set(sn.id, sn.edit); else this.edits.delete(sn.id);
    this.g.world.reindex(); this.save();
  }
  dirty(mesh) { const P = mesh.geometry.attributes.position; P.needsUpdate = true; mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox(); }
  entry(id) { let e = this.edits.get(id); if (!e) { e = { id, at: this.pivot(id), d: [0, 0, 0], s: [1, 1, 1] }; this.edits.set(id, e); } return e; }

  apply(id, fn) {                                                         // fn(p): yeni konum; köşeler + çarpışma kutuları
    for (const { mesh, start, count } of this.ranges.get(id) || []) { const P = mesh.geometry.attributes.position, v = new THREE.Vector3(); for (let i = start; i < start + count; i++) { fn(v.fromBufferAttribute(P, i)); P.setXYZ(i, v.x, v.y, v.z); } this.dirty(mesh); }
  }
  del(id) {
    if (!id) return; this.undo.push(this.snapshot(id));
    const e = this.entry(id); e.del = true;
    this.apply(id, (v) => v.set(0, -500, 0));
    for (const c of this.colsOf(id)) { c.min = [1e6, -1e6, 1e6]; c.max = [1e6, -1e6, 1e6]; }
    this.g.world.reindex(); this.save(); this.select(null); this.g.hud.toast('Silindi: ' + id + ' (Backspace: geri al)', '#ffd27a');
  }
  move(id, d) {
    if (!id) return; this.undo.push(this.snapshot(id));
    const e = this.entry(id); for (let a = 0; a < 3; a++) e.d[a] = +(e.d[a] + d[a]).toFixed(3);
    this.apply(id, (v) => v.add(new THREE.Vector3(...d)));
    for (const c of this.colsOf(id)) for (let a = 0; a < 3; a++) { c.min[a] += d[a]; c.max[a] += d[a]; }
    this.g.world.reindex(); this.save(); this.select(id);
  }
  scale(id, f) {
    if (!id) return; this.undo.push(this.snapshot(id));
    const e = this.entry(id), p = [e.at[0] + e.d[0], e.at[1] + e.d[1], e.at[2] + e.d[2]];
    for (let a = 0; a < 3; a++) e.s[a] = +(e.s[a] * f[a]).toFixed(4);
    this.apply(id, (v) => v.set(p[0] + (v.x - p[0]) * f[0], p[1] + (v.y - p[1]) * f[1], p[2] + (v.z - p[2]) * f[2]));
    for (const c of this.colsOf(id)) MapBuilder.editBox(c, p, [0, 0, 0], f);
    this.g.world.reindex(); this.save(); this.select(id);
  }
  undoLast() { const sn = this.undo.pop(); if (!sn) { this.g.hud.toast('Geri alınacak bir şey yok'); return; } this.restore(sn); this.select(this.edits.get(sn.id)?.del ? null : sn.id); this.g.hud.toast('Geri alındı: ' + sn.id, '#cfe6ff'); }

  list() { return [...this.edits.values()].map((e) => { const o = { id: e.id, at: e.at }; if (e.del) o.del = true; else { if (e.d.some((x) => x)) o.d = e.d; if (e.s.some((x) => x !== 1)) o.s = e.s; } return o; }).filter((o) => o.del || o.d || o.s); }
  save() { try { localStorage.setItem(KEY(this.mapId), JSON.stringify(this.list())); } catch { /* yer yok */ } this.render(); }
  info(id) {
    const b = this.bbox(id), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()), kind = KINDS[id.split(':')[0]] || id.split(':')[0];
    return `${id} · ${kind} · merkez x ${c.x.toFixed(1)} y ${c.y.toFixed(1)} z ${c.z.toFixed(1)} · boyut ${s.x.toFixed(1)}×${s.y.toFixed(1)}×${s.z.toFixed(1)} m · çarpışma ${this.colsOf(id).length}`;
  }
  exportText() { return `HARİTA DÜZENLEMESİ ${this.mapId} (${this.list().length})\n` + JSON.stringify(this.list()); }
  copy(text, what) {
    this.copyText = text; this.render(); const ta = this.el.querySelector('textarea'); if (ta) ta.select();
    (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => this.g.hud.toast(what + ' kopyalandı · bana yapıştır', '#9be07f'), () => { try { document.execCommand('copy'); this.g.hud.toast(what + ' kopyalandı', '#9be07f'); } catch { this.g.hud.toast('Kopyalanamadı: paneldeki metni seçip Ctrl+C', '#ffd27a'); } });
  }
  cmd(c) {
    if (c === 'del') this.del(this.sel);
    else if (c === 'undo') this.undoLast();
    else if (c === 'id' && this.sel) this.copy(this.info(this.sel), 'Kimlik');
    else if (c === 'all') this.copy(this.exportText(), 'Düzenlemeler');
    else if (c === 'reset') { if (!confirm('Bu haritadaki tüm düzenlemeleri sil? (Sayfa yenilenince eski hâline döner)')) return; localStorage.removeItem(KEY(this.mapId)); this.edits.clear(); this.undo = []; this.g.hud.toast('Düzenlemeler silindi · haritayı yeniden başlat', '#ffd27a'); this.render(); }
  }
  render() {
    if (!this.active) return;
    try { this._render(); } catch (err) { console.error('[harita editörü]', err); this.el.innerHTML = `<h4>Harita editörü</h4><div class="w">Panel hatası: ${String(err.message || err)}</div><div class="row"><button data-c="reset">Tümünü sıfırla</button></div>`; }
  }
  _render() {
    const n = this.list().length, sel = this.sel;
    this.el.innerHTML = `<h4>Harita editörü <span style="opacity:.6">(I)</span></h4>
      <div class="sel">${sel ? '<b>Seçili:</b> ' + this.info(sel) : 'Nesne seçilmedi · nişangâhla bak, <b>sol tık</b>'}${this.hover && this.hover !== sel ? `<br><span style="opacity:.6">İmleç: ${this.hover}</span>` : ''}</div>
      <div class="row"><button data-c="del" ${sel ? '' : 'disabled'}>Sil</button><button data-c="undo">Geri al</button><button data-c="id" ${sel ? '' : 'disabled'}>Kimliği kopyala</button><button class="hot" data-c="all">Düzenlemeleri kopyala (${n})</button><button data-c="reset">Tümünü sıfırla</button></div>
      <div class="k" style="margin-top:6px"><kbd>Sol tık</kbd> seç · <kbd>Delete</kbd> sil · <kbd>Backspace</kbd> geri al<br><kbd>Ok tuşları</kbd> taşı (bakış yönü) · <kbd>PgUp</kbd>/<kbd>PgDn</kbd> yukarı/aşağı · <kbd>Shift</kbd> 1 m adım<br><kbd>+</kbd>/<kbd>−</kbd> büyüt/küçült · <kbd>]</kbd>/<kbd>[</kbd> yükseklik · <kbd>Home</kbd> kimliği kopyala · <kbd>End</kbd> hepsini kopyala<br>Esc ile duraklatınca düğmelere tıklayabilirsin.</div>
      ${this.warn ? `<div class="w">${this.warn}</div>` : ''}<textarea readonly style="display:${this.copyText ? 'block' : 'none'}"></textarea>`;
    if (this.copyText) this.el.querySelector('textarea').value = this.copyText;
  }

  // ── girdi ──
  onMouse(e) {
    if (!this.active || e.button !== 0 || !this.g.player.locked || e.target.closest?.('#med')) return;
    if (e.target !== this.g.canvas) return;
    e.preventDefault(); e.stopPropagation();
    this.select(this.pick());
  }
  onKey(e) {
    if (e.code === 'KeyI' && !e.repeat && this.g.player.locked && !this.g.chatOpen) { e.preventDefault(); e.stopPropagation(); this.toggle(); return; }
    if (!this.active || !this.g.player.locked || this.g.chatOpen) return;
    const st = e.shiftKey ? 1 : 0.25, id = this.sel, yaw = this.g.playerSoldier.yaw;
    const fw = [-Math.sin(yaw), -Math.cos(yaw)], ax = Math.abs(fw[0]) > Math.abs(fw[1]) ? [Math.sign(fw[0]), 0] : [0, Math.sign(fw[1])], rt = [-ax[1], ax[0]];
    const map = {
      Delete: () => this.del(id), Backspace: () => this.undoLast(), Home: () => id && this.copy(this.info(id), 'Kimlik'), End: () => this.copy(this.exportText(), 'Düzenlemeler'),
      ArrowUp: () => this.move(id, [ax[0] * st, 0, ax[1] * st]), ArrowDown: () => this.move(id, [-ax[0] * st, 0, -ax[1] * st]),
      ArrowRight: () => this.move(id, [-rt[0] * st, 0, -rt[1] * st]), ArrowLeft: () => this.move(id, [rt[0] * st, 0, rt[1] * st]),
      PageUp: () => this.move(id, [0, st, 0]), PageDown: () => this.move(id, [0, -st, 0]),
      Equal: () => this.scale(id, [1.1, 1.1, 1.1]), NumpadAdd: () => this.scale(id, [1.1, 1.1, 1.1]), Minus: () => this.scale(id, [1 / 1.1, 1 / 1.1, 1 / 1.1]), NumpadSubtract: () => this.scale(id, [1 / 1.1, 1 / 1.1, 1 / 1.1]),
      BracketRight: () => this.scale(id, [1, 1.1, 1]), BracketLeft: () => this.scale(id, [1, 1 / 1.1, 1]),
    };
    const f = map[e.code]; if (!f) return;
    e.preventDefault(); e.stopPropagation(); f();
  }
  dispose() { clearInterval(this._t); window.removeEventListener('keydown', this._k, true); window.removeEventListener('mousedown', this._m, true); this.el.remove(); this.st.remove(); this.boxSel.removeFromParent(); this.boxHov.removeFromParent(); }
}
