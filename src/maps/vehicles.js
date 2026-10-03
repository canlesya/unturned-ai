// Detaylı araçlar (+X ileri). Hepsi MapBuilder (b) üzerine kutu/silindirle çizilir; çarpışma yalnızca vcollide ile (tek kutu, ayak izi kaydı).
// Ortak parçalar: lastik+jant, tampon, ızgara, far/stop, ayna, kapı çizgileri, camlar (eğik ön cam), plaka.
const GL = { glow: true };
const GLASS = '#22333f';
const BLACK = '#1c1c1e';
const mix = (hex, k) => {                                    // rengi koyulaştır (k<1) / aç (k>1)
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('');
};

// Tekerlek: lastik + jant + göbek (eksen Z)
function wheel(b, x, z, r, w, o = {}) {
  const side = Math.sign(z) || 1;
  b.cyl(x, r, z, r, r, w, o.tire || BLACK, { rx: Math.PI / 2, center: true, seg: 12, collide: false });
  b.cyl(x, r, z + side * (w / 2 + 0.005), r * 0.62, r * 0.62, 0.04, o.rim || '#9aa0a8', { rx: Math.PI / 2, center: true, seg: 10, collide: false });
  b.cyl(x, r, z + side * (w / 2 + 0.03), r * 0.22, r * 0.22, 0.04, '#4a4d52', { rx: Math.PI / 2, center: true, seg: 6, collide: false });
}
const tread = (b, x, z, r, w) => b.cyl(x, r, z, r * 1.005, r * 1.005, w * 0.6, '#101012', { rx: Math.PI / 2, center: true, seg: 12, collide: false });

// ───────── Otomobil ─────────
function car_(b, { x, z, ry = 0, color = '#b33a2a', wreck = false }) {
  b.with(x, 0, z, ry, () => {
    const c = wreck ? '#6e5a4a' : color, dk = mix(c, 0.72), lt = mix(c, 1.18);
    const N = { collide: false };
    // şasi + alt etek
    b.box(0, 0.18, 0, 4.3, 0.22, 1.76, '#26282b', N);
    b.box(0, 0.32, 0, 4.3, 0.55, 1.8, c, N);                       // ana gövde
    b.box(1.45, 0.82, 0, 1.3, 0.1, 1.72, c, N);                    // kaput
    b.box(-1.7, 0.82, 0, 0.9, 0.1, 1.72, c, N);                    // bagaj kapağı
    // kabin: yan duvarlar + tavan + eğik camlar
    b.box(-0.3, 0.87, 0, 2.0, 0.08, 1.7, dk, N);                   // kabin tabanı
    b.box(-0.35, 1.5, 0, 1.45, 0.08, 1.6, lt, N);                  // tavan
    b.box(0.62, 0.9, 0, 0.1, 0.62, 1.58, GLASS, { collide: false, rz: 0.62, o: { roughness: 0.15 } });    // ön cam (eğik)
    b.box(-1.28, 0.9, 0, 0.1, 0.62, 1.58, GLASS, { collide: false, rz: -0.55, o: { roughness: 0.15 } });    // arka cam
    for (const sz of [-1, 1]) {
      b.box(-0.32, 0.92, sz * 0.8, 1.55, 0.56, 0.05, GLASS, { collide: false, o: { roughness: 0.15 } });  // yan camlar
      b.box(-0.32, 0.9, sz * 0.82, 0.07, 0.6, 0.06, dk, N);                                            // B sütunu
      b.box(-0.32, 0.6, sz * 0.91, 0.05, 0.3, 0.02, '#14161a', N);                                     // kapı çizgisi
      b.box(0.35, 0.62, sz * 0.91, 0.18, 0.04, 0.03, '#9aa0a8', N);                                    // kapı kolu
      b.box(-1.0, 0.62, sz * 0.91, 0.18, 0.04, 0.03, '#9aa0a8', N);
      b.box(0.55, 0.95, sz * 0.98, 0.16, 0.12, 0.14, dk, N);                                           // ayna
      b.box(1.7, 0.4, sz * 0.5, 0.06, 0.2, 0.34, wreck ? '#555' : '#fff2b0', wreck ? N : { collide: false, o: GL });   // far
      b.box(-2.17, 0.5, sz * 0.62, 0.06, 0.16, 0.34, wreck ? '#4a2a2a' : '#c0261b', wreck ? N : { collide: false, o: GL });  // stop
      // tekerlek yuvası (çamurluk)
      for (const wx of [-1.4, 1.4]) b.box(wx, 0.05, sz * 0.9, 0.85, 0.5, 0.05, '#101012', N);
    }
    // ızgara + tamponlar + plaka
    b.box(2.16, 0.34, 0, 0.06, 0.26, 1.0, '#14161a', N);
    b.box(2.18, 0.2, 0, 0.1, 0.12, 1.78, '#8c9096', N);
    b.box(-2.18, 0.2, 0, 0.1, 0.12, 1.78, '#8c9096', N);
    b.box(-2.19, 0.42, 0, 0.03, 0.14, 0.4, '#eeeee0', N);
    // egzoz
    b.cyl(-2.1, 0.12, 0.55, 0.045, 0.045, 0.2, '#555', { rz: Math.PI / 2, center: true, seg: 6, collide: false });
    for (const wx of [-1.4, 1.4]) for (const wz of [-0.92, 0.92]) { if (wreck && wx < 0 && wz > 0) continue; wheel(b, wx, wz, 0.34, 0.26); }
    if (wreck) { b.box(1.45, 0.9, 0.3, 1.0, 0.05, 0.7, '#2a2420', { collide: false, rz: 0.12 }); b.box(-0.3, 1.58, -0.3, 0.9, 0.04, 0.6, '#3a3027', N); }
    else b.box(-0.4, 1.58, 0, 0.9, 0.04, 0.6, mix(c, 1.3), N);          // tavan parlaması
    b.vcollide(0, 0, 0, 4.4, 1.62, 1.85, 'car');
  });
}

// ───────── Otobüs ─────────
function bus_(b, { x, z, ry = 0, color = '#d9a921' }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false }, dk = mix(color, 0.7);
    b.box(0, 0.25, 0, 10, 0.3, 2.46, '#26282b', N);
    b.box(0, 0.5, 0, 10, 1.0, 2.5, color, N);                              // alt gövde
    b.box(0, 1.5, 0, 10, 1.0, 2.5, GLASS, { collide: false, o: { roughness: 0.2 } });   // cam bandı
    for (let i = -4; i <= 4; i++) for (const sz of [-1, 1]) b.box(i * 1.12, 1.5, sz * 1.26, 0.1, 1.02, 0.04, color, N);   // pencere sütunları
    b.box(0, 2.5, 0, 10.04, 0.14, 2.54, '#d8d8d2', N);                      // tavan
    b.box(-2.2, 2.64, 0, 1.4, 0.2, 1.4, '#c9c9c3', N);                      // klima
    b.box(2.4, 2.64, 0, 1.4, 0.2, 1.4, '#c9c9c3', N);
    b.box(0, 1.0, 0, 10.02, 0.08, 2.52, dk, N);                             // kemer şeridi
    b.box(5.02, 0.5, 0, 0.08, 1.0, 2.4, dk, N);                             // ön panel
    b.box(5.05, 1.5, 0, 0.06, 1.0, 2.3, GLASS, { collide: false, o: { roughness: 0.15 } });  // ön cam
    b.box(5.06, 2.1, 0, 0.05, 0.28, 1.4, '#14161a', N);                     // hedef tabelası
    b.box(5.06, 2.12, 0, 0.04, 0.12, 1.1, '#ffb347', { collide: false, o: GL });
    b.box(-5.05, 1.5, 0, 0.06, 0.8, 2.2, GLASS, N);
    for (const sz of [-1, 1]) {
      b.box(5.06, 0.45, sz * 0.8, 0.06, 0.2, 0.35, '#fff2b0', { collide: false, o: GL });
      b.box(-5.06, 0.55, sz * 0.9, 0.06, 0.2, 0.3, '#c0261b', { collide: false, o: GL });
      b.box(1.8, 0.5, sz * 1.26, 1.1, 1.15, 0.05, '#14161a', N);            // kapı
      b.box(1.8, 0.5, sz * 1.27, 0.03, 1.15, 0.05, color, N);
      b.box(4.7, 1.4, sz * 1.5, 0.14, 0.5, 0.14, '#14161a', N);             // ayna
    }
    b.box(5.1, 0.12, 0, 0.14, 0.18, 2.5, '#8c9096', N); b.box(-5.1, 0.12, 0, 0.14, 0.18, 2.5, '#8c9096', N);
    b.box(-5.06, 0.7, 0, 0.03, 0.14, 0.4, '#eeeee0', N);
    for (const wx of [-3.2, 3.2]) for (const wz of [-1.2, 1.2]) { b.box(wx, 0.05, wz * 1.02, 1.3, 0.8, 0.05, '#101012', N); wheel(b, wx, wz, 0.5, 0.34); }
    b.vcollide(0, 0, 0, 10, 2.8, 2.55, 'bus');
  });
}

// ───────── Kamyon ─────────
function truck_(b, { x, z, ry = 0, color = '#c0392b', cargo = '#cfd3d8' }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false }, dk = mix(color, 0.7);
    b.box(0, 0.3, 0, 8.8, 0.3, 2.2, '#26282b', N);                               // şasi
    b.box(3.0, 0.6, 0, 2.2, 1.5, 2.4, color, N);                                  // kabin alt
    b.box(3.45, 1.6, 0, 1.4, 0.85, 2.42, GLASS, { collide: false, o: { roughness: 0.15 } });  // kabin camı
    b.box(2.55, 2.1, 0, 0.9, 0.55, 2.4, color, N);                                // kabin üstü
    b.box(2.2, 2.65, 0, 0.9, 0.12, 2.0, dk, N);                                   // rüzgar kıran
    b.box(4.12, 0.9, 0, 0.06, 0.55, 1.3, '#14161a', N);                           // ızgara
    b.box(4.15, 0.25, 0, 0.12, 0.2, 2.4, '#8c9096', N);                           // tampon
    for (const sz of [-1, 1]) {
      b.box(4.12, 0.9, sz * 0.9, 0.05, 0.25, 0.3, '#fff2b0', { collide: false, o: GL });
      b.box(3.0, 1.5, sz * 1.22, 0.9, 0.05, 0.03, dk, N);                          // kapı çizgisi
      b.box(3.7, 1.3, sz * 1.35, 0.12, 0.45, 0.14, '#14161a', N);                  // ayna
      b.box(-1.0, 0.95, sz * 1.27, 6.6, 0.14, 0.04, '#8c9096', N);                 // kasa alt şerit
      b.box(-4.38, 0.55, sz * 0.9, 0.05, 0.18, 0.3, '#c0261b', { collide: false, o: GL });
    }
    b.box(-1.0, 0.85, 0, 6.6, 0.15, 2.4, '#4a4d52', N);                            // kasa zemin
    b.box(-1.0, 1.0, 0, 6.6, 2.3, 2.5, cargo, N);                                  // kasa
    for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) b.box(-1.0 + i * 1.0, 1.0, sz * 1.26, 0.1, 2.3, 0.04, mix(cargo, 0.82), N);
    b.box(-4.33, 1.0, 0, 0.05, 2.3, 2.5, mix(cargo, 0.88), N);
    for (const wx of [-3.4, -1.9, 3.0]) for (const wz of [-1.1, 1.1]) { b.box(wx, 0.1, wz * 1.07, 1.2, 0.6, 0.05, '#101012', N); wheel(b, wx, wz, 0.5, 0.42); }
    b.vcollide(0.25, 0, 0, 8.8, 3.6, 2.55, 'truck');
  });
}

// ───────── Tanker ─────────
function tanker_(b, { x, z, ry = 0, color = '#a8aaa4', cab = '#2f4f7a' }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false };
    b.box(0, 0.3, 0, 8.6, 0.3, 2.2, '#26282b', N);
    b.box(3.4, 0.6, 0, 2.0, 1.4, 2.4, cab, N);
    b.box(3.9, 1.5, 0, 1.1, 0.8, 2.42, GLASS, { collide: false, o: { roughness: 0.15 } });
    b.box(3.0, 2.0, 0, 0.9, 0.45, 2.4, cab, N);
    b.box(4.35, 0.9, 0, 0.06, 0.5, 1.2, '#14161a', N); b.box(4.4, 0.25, 0, 0.12, 0.2, 2.4, '#8c9096', N);
    b.cyl(-0.7, 1.55, 0, 1.25, 1.25, 7.4, color, { rz: Math.PI / 2, center: true, seg: 14, collide: false });
    b.cyl(-0.7, 1.55, 0, 1.3, 1.3, 0.35, '#c0392b', { rz: Math.PI / 2, center: true, seg: 14, collide: false });
    b.cyl(-3.2, 1.55, 0, 1.3, 1.3, 0.35, '#c0392b', { rz: Math.PI / 2, center: true, seg: 14, collide: false });
    b.cyl(1.8, 1.55, 0, 1.3, 1.3, 0.35, '#c0392b', { rz: Math.PI / 2, center: true, seg: 14, collide: false });
    b.box(-0.7, 2.7, 0, 0.9, 0.25, 0.9, '#8c9096', N);
    b.box(-0.7, 2.95, 0, 0.5, 0.1, 0.5, '#4a4d52', N);
    b.box(-0.7, 2.62, -0.9, 7.0, 0.05, 0.05, '#8c9096', N);                          // korkuluk/ray
    b.box(-4.38, 0.55, 0.9, 0.05, 0.18, 0.3, '#c0261b', { collide: false, o: GL }); b.box(-4.38, 0.55, -0.9, 0.05, 0.18, 0.3, '#c0261b', { collide: false, o: GL });
    for (const wx of [-3.5, -2.2, 3.2]) for (const wz of [-1.1, 1.1]) wheel(b, wx, wz, 0.5, 0.42);
    b.vcollide(0.1, 0, 0, 8.6, 2.9, 2.5, 'truck');
  });
}

// ───────── Zırhlı personel taşıyıcı ─────────
function apc_(b, { x, z, ry = 0, color = '#566246', wreck = false }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false }, c = wreck ? '#4d4338' : color, dk = mix(c, 0.72), lt = mix(c, 1.15);
    b.box(0, 0.3, 0, 5.2, 0.4, 2.5, dk, N);                                      // taban
    b.box(0, 0.7, 0, 5.2, 1.1, 2.6, c, N);                                        // ana zırh
    b.box(2.5, 0.85, 0, 0.9, 0.8, 2.4, c, { collide: false, rz: 0.35 });          // eğimli burun
    b.box(-0.2, 1.8, 0, 2.2, 0.6, 1.7, lt, N);                                    // taret gövdesi
    b.box(-0.2, 2.4, 0, 1.6, 0.12, 1.2, dk, N);                                   // taret tavanı
    b.box(0.9, 2.05, 0, 0.14, 0.2, 1.2, GLASS, N);                                // gözetleme camı
    b.box(1.5, 2.0, 0, 2.2, 0.14, 0.14, '#2a2d30', N);                            // namlu
    b.box(2.65, 1.98, 0, 0.3, 0.2, 0.2, '#14161a', N);                            // namlu ucu
    b.box(-1.2, 2.45, 0.6, 0.6, 0.18, 0.5, dk, N);                                // kapak
    b.box(-0.4, 2.3, -0.9, 0.05, 0.9, 0.05, '#2a2d30', { collide: false, rz: 0.2 });   // anten
    b.box(2.5, 1.35, 0, 0.5, 0.15, 1.3, lt, N);                                    // far kapağı
    for (const sz of [-1, 1]) {
      b.box(2.2, 1.0, sz * 1.31, 0.35, 0.18, 0.04, wreck ? '#555' : '#fff2b0', wreck ? N : { collide: false, o: GL });
      b.box(-0.5, 1.15, sz * 1.31, 0.05, 0.05, 2.8, '#26282b', N);                // dikiş çizgisi
      b.box(0, 0.1, sz * 1.38, 4.8, 0.55, 0.3, '#26282b', N);                     // palet etek
      b.box(-0.2, 0.7, sz * 1.32, 1.0, 0.7, 0.04, dk, N);                         // yan kapı
      for (let i = 0; i < 5; i++) wheel(b, -1.9 + i * 0.95, sz * 1.45, 0.38, 0.22, { tire: '#14161a', rim: '#3a3d42' });
    }
    if (wreck) { b.box(-1.2, 1.85, 0.3, 1.2, 0.12, 1.0, '#2a2420', { collide: false, rz: 0.15 }); b.box(0.3, 2.3, -0.5, 0.8, 0.1, 0.5, '#2a2420', N); }
    b.vcollide(0, 0, 0, 5.4, 2.4, 2.8, 'apc');
  });
}

// ───────── Tank (hurda/dekor siperi): +X namlu ─────────
function tank_(b, { x, z, ry = 0, color = '#566246', wreck = true }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false }, c = wreck ? '#51493c' : color, dk = mix(c, 0.7), lt = mix(c, 1.15);
    b.box(0, 0.25, 0, 6.2, 0.4, 3.0, dk, N);
    b.box(0, 0.6, 0, 6.2, 0.9, 3.0, c, N);                                          // gövde
    b.box(3.2, 0.8, 0, 0.8, 0.8, 2.8, c, { collide: false, rz: 0.55 });             // alın zırhı
    b.box(-3.15, 0.7, 0, 0.1, 0.8, 2.6, dk, N);                                      // arka panel
    for (const sz of [-1, 1]) {
      b.box(0, 0.1, sz * 1.62, 6.4, 0.9, 0.5, '#26282b', N);                           // palet
      b.box(0, 0.95, sz * 1.62, 6.0, 0.1, 0.55, dk, N);                               // çamurluk
      for (let i = 0; i < 7; i++) wheel(b, -2.55 + i * 0.85, sz * 1.62, 0.4, 0.3, { tire: '#14161a', rim: '#3a3d42' });
      b.box(-2.9, 0.78, sz * 1.62, 0.7, 0.2, 0.1, '#14161a', N);
    }
    b.box(-0.3, 1.5, 0, 2.8, 0.55, 2.4, c, N);                                       // taret
    b.box(-0.3, 2.05, 0, 2.0, 0.25, 1.9, lt, N);
    b.box(1.2, 1.7, 0, 0.5, 0.5, 1.2, dk, N);                                        // mantlet
    b.box(2.4, 2.0, 0, 3.8, 0.24, 0.24, '#2a2d30', N);                                // namlu
    b.box(4.4, 1.96, 0, 0.5, 0.32, 0.32, '#1c1e20', N);                               // ağız freni
    b.cyl(-0.9, 2.2, 0.5, 0.3, 0.3, 0.2, dk, { seg: 8, collide: false });              // kapak
    b.box(-0.9, 2.45, -0.5, 0.5, 0.12, 0.5, '#2a2d30', N);
    b.box(-1.9, 2.15, 0, 0.6, 0.3, 1.7, dk, N);                                       // bagaj sandığı
    if (wreck) { b.box(-0.8, 2.7, 0.4, 1.0, 0.25, 0.9, '#2a2420', { collide: false, rz: 0.2 }); b.box(0.8, 0.0, 1.9, 1.0, 0.7, 0.6, '#3d352c', N); }
    b.vcollide(0, 0, 0, 6.4, 2.6, 3.4, 'tank');
  });
}

// ───────── Ambulans ─────────
function ambulance_(b, { x, z, ry = 0 }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false }, W = '#f2f2ee';
    b.box(0.4, 0.28, 0, 6.0, 0.3, 2.3, '#26282b', N);
    b.box(2.0, 0.55, 0, 1.8, 1.0, 2.3, W, N);                                         // motor bölümü
    b.box(2.5, 1.35, 0, 0.9, 0.85, 2.32, GLASS, { collide: false, o: { roughness: 0.15 } });  // cam
    b.box(1.6, 1.35, 0, 0.9, 0.85, 2.3, W, N);                                         // kabin üstü
    b.box(-0.6, 0.55, 0, 3.8, 2.4, 2.4, W, N);                                         // kasa
    b.box(-0.6, 1.1, 0, 3.82, 0.12, 2.42, '#c0392b', N);                                // kırmızı şerit
    b.box(-2.52, 1.3, 0, 0.05, 1.4, 2.2, '#e4e4de', N);                                 // arka kapı
    b.box(-2.54, 1.3, 0, 0.03, 1.4, 0.04, '#9aa0a8', N);
    for (const sz of [-1, 1]) {
      b.box(-0.6, 1.5, sz * 1.21, 0.9, 0.9, 0.04, '#c0392b', N);
      b.box(-0.6, 1.5, sz * 1.23, 0.3, 0.9, 0.04, '#fff', N); b.box(-0.6, 1.5, sz * 1.23, 0.9, 0.3, 0.04, '#fff', N);
      b.box(-1.7, 1.7, sz * 1.21, 0.7, 0.5, 0.04, GLASS, N);                             // yan pencere
      b.box(2.0, 1.45, sz * 1.18, 0.9, 0.05, 0.03, '#9aa0a8', N);
      b.box(3.0, 0.55, sz * 0.9, 0.06, 0.2, 0.3, '#fff2b0', { collide: false, o: GL });
      b.box(-2.52, 0.6, sz * 0.9, 0.05, 0.2, 0.3, '#c0261b', { collide: false, o: GL });
      b.box(2.7, 1.25, sz * 1.3, 0.12, 0.4, 0.14, '#14161a', N);                          // ayna
    }
    b.box(3.0, 0.4, 0, 0.06, 0.26, 1.2, '#14161a', N);
    b.box(3.05, 0.2, 0, 0.12, 0.14, 2.3, '#8c9096', N); b.box(-2.55, 0.2, 0, 0.12, 0.14, 2.3, '#8c9096', N);
    b.box(2.0, 2.05, 0, 0.3, 0.18, 1.0, '#ff3b2b', { collide: false, o: GL });
    b.box(2.0, 2.05, 0.5, 0.3, 0.18, 0.3, '#3b8bff', { collide: false, o: GL });
    b.box(2.0, 2.05, -0.5, 0.3, 0.18, 0.3, '#3b8bff', { collide: false, o: GL });
    b.box(-0.6, 2.95, 0, 1.0, 0.1, 0.5, '#9aa0a8', N);                                  // çatı klima
    for (const wx of [-1.4, 2.2]) for (const wz of [-1.1, 1.1]) { b.box(wx, 0.05, wz * 1.02, 1.0, 0.7, 0.05, '#101012', N); wheel(b, wx, wz, 0.4, 0.3); }
    b.vcollide(0.4, 0, 0, 6.0, 2.9, 2.5, 'truck');
  });
}

// ───────── Cip ─────────
function jeep_(b, { x, z, ry = 0, color = '#5e6b4a' }) {
  b.with(x, 0, z, ry, () => {
    const N = { collide: false }, dk = mix(color, 0.7), lt = mix(color, 1.15);
    b.box(0, 0.22, 0, 3.6, 0.2, 1.7, '#26282b', N);
    b.box(0, 0.4, 0, 3.6, 0.5, 1.8, color, N);                                          // gövde
    b.box(1.45, 0.88, 0, 0.9, 0.1, 1.7, color, N);                                     // kaput
    b.box(1.45, 0.98, 0.4, 0.4, 0.06, 0.2, dk, N);                                     // yedek lastik izi
    b.box(-0.2, 0.9, 0, 1.4, 0.06, 1.7, dk, N);                                         // kabin tabanı
    b.box(0.5, 1.0, 0, 0.08, 0.7, 1.6, GLASS, { collide: false, rz: 0.25, o: { roughness: 0.15 } });  // ön cam (dik, yatık)
    b.box(0.5, 1.7, 0, 0.1, 0.06, 1.7, dk, N);                                          // cam çerçevesi üstü
    for (const sz of [-1, 1]) {
      b.box(0.5, 0.95, sz * 0.84, 0.08, 0.8, 0.06, dk, N);                              // A sütunu
      b.box(-0.2, 0.95, sz * 0.88, 1.5, 0.35, 0.05, color, N);                          // yan panel
      b.box(1.8, 0.7, sz * 0.55, 0.06, 0.2, 0.3, '#fff2b0', { collide: false, o: GL });
      b.box(1.82, 0.7, sz * 0.55, 0.04, 0.26, 0.36, '#14161a', N);
      b.box(-1.82, 0.55, sz * 0.6, 0.05, 0.16, 0.26, '#c0261b', { collide: false, o: GL });
      b.box(0.2, 1.3, sz * 0.9, 0.08, 0.3, 0.06, '#14161a', N);                          // ayna
    }
    b.box(-0.6, 1.0, 0, 0.8, 0.35, 1.5, dk, N);                                          // arka koltuk sırtı
    b.box(1.85, 0.5, 0, 0.1, 0.3, 1.0, '#14161a', N);                                    // ızgara
    b.box(1.9, 0.25, 0, 0.14, 0.14, 1.8, '#8c9096', N); b.box(-1.85, 0.25, 0, 0.14, 0.14, 1.8, '#8c9096', N);
    b.box(-1.8, 0.8, 0, 0.12, 0.6, 0.5, dk, N);                                          // yedek lastik
    b.cyl(-1.9, 0.82, 0, 0.3, 0.3, 0.2, BLACK, { rz: Math.PI / 2, center: true, seg: 10, collide: false });
    b.box(-0.2, 1.74, 0, 0.1, 0.1, 0.1, dk, N);
    for (const wx of [-1.2, 1.2]) for (const wz of [-0.95, 0.95]) { b.box(wx, 0.08, wz * 0.98, 0.9, 0.55, 0.05, '#101012', N); wheel(b, wx, wz, 0.38, 0.3); }
    b.vcollide(0, 0, 0, 3.9, 1.8, 1.9, 'car');
  });
}

// Dışa açık sürümler: harita builder'ında autoPlace açıksa yerleşim çakışma denetiminden geçer (bkz. MapBuilder.flushVehicles)
const wrap = (kind, fn) => (b, o) => b.defer(kind, fn, o);
export const car = wrap('car', car_), bus = wrap('bus', bus_), truck = wrap('truck', truck_), tanker = wrap('tanker', tanker_);
export const apc = wrap('apc', apc_), tank = wrap('tank', tank_), ambulance = wrap('ambulance', ambulance_), jeep = wrap('jeep', jeep_);
