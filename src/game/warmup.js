import * as THREE from 'three';
import { WSTATS } from './stats.js';

// Gölgelendirici ön ısıtma (12.151): oyunun ilk karesinden ÖNCE (yükleme ekranı hâlâ açıkken) maç içinde ilk kez gerekecek WebGL programları derlenir.
// Neden: Firefox'ta KHR_parallel_shader_compile yok ve WebGL ayrı GPU sürecinde çalışır; three.js her yeni programı ilk kullanıldığı karede eşzamanlı
// derleyip bağlar (getProgramParameter → süreçler arası bekleme). Ölçüm (M4 Pro, Firefox 157): ACOG ilk nişan 9 program = 508 ms donma, ilk nişan
// (silah saydamlaşır → "opaque" anahtarı değişir) 70 + 195 ms, her silahın ilk çekilişi 15–45 ms. Chromium aynı işi ~8 ms/program ile yapıyor.
//   1) Ana sahne, render hedefi varyantlarıyla (ACOG PiP merceği ve "Yüksek" son işleme sahneyi hedefe çizer → doğrusal çıktı / ton eşlemesiz programlar)
//   2) Birinci şahıs silah sahnesi: donanımdaki her eşya (+ ana silahın takılabilir nişangâhları), opak ve saydam (nişan alma solması) hâliyle
//   3) Sürücü düzeyi gecikmeli derleme (macOS GL / ANGLE D3D11 programı ilk çizimde tamamlar) için küçük bir hedefe gerçekten bir kez çizilir
// Hiçbiri görünmez: yükleme ekranı kanvasın üstünde, ilk gerçek kare tamponu temizler. Mevcut silah / nişangâh sonunda geri yüklenir.
export function warmup(game) {
  const r = game.renderer, p = game.player, s = game.playerSoldier;
  if (!r || !p || !s) return null;
  const t0 = performance.now(), n0 = r.info.programs.length;
  const rt = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType, samples: Math.min(4, r.capabilities.maxSamples || 0) });
  const prevRT = r.getRenderTarget(), vm = p.vm;
  const both = (scene, cam) => {                                    // ekran (null hedef) + render hedefi varyantları; derle, sonra hedefe bir kez çiz
    r.compile(scene, cam);
    r.setRenderTarget(rt); r.compile(scene, cam); r.clear(); r.render(scene, cam);
    r.setRenderTarget(prevRT);
  };
  try {
    game.scene.updateMatrixWorld(true);
    both(game.scene, game.camera);
    // 12.210 geliştirici araçları (J/K ile her silah elde denenebilir): her yuvadaki bütün eşyaların programları da derlenir. Donanım döngüsünden ÖNCE: önbellekte
    // sonuncular (donanımdakiler, GPU'ya yüklenmiş) kalsın. Önbellekten düşen model malzemesini atmadığı için program canlı kalır → J/K ile ilk kez gelen silahta derleme donması yok (paintball / pençe / uzay: 75–235 ms ölçüldü)
    if (p.devTools?.()) {
      const cur = s.cur, slots = ['primary', 'secondary', 'gadget', 'melee'];
      for (let i = 0; i < Math.min(4, s.items.length); i++) {
        const keep = s.items[i]; s.cur = i;
        for (const id of Object.keys(WSTATS)) {
          if (WSTATS[id].slot !== slots[i] || id === keep?.id) continue;
          s.items[i] = { id, mag: 1, reserve: 0 };
          p.refreshWeapon();
          vm.scene.updateMatrixWorld(true);
          r.compile(vm.scene, vm.cam);
          vm.setFade(0.5, 0); r.compile(vm.scene, vm.cam); vm.setFade(0, 1);      // nişan solması varyantı
        }
        s.items[i] = keep;
      }
      s.cur = cur;
    }
    // birinci şahıs: her yuvadaki eşya; ana silahta izin verilen her nişangâh (ACOG / PSO merceği: saydam disk + geçiş camı, 12.162)
    const cur = s.cur, optic = s.optic, om = s.optics, seen = new Set();
    s.optics = {};      // 12.174: silaha özgü nişangâh seçimi ön ısıtmada geçici kapalı (s.optic ile her nişangâh denenir)
    vm.cam.aspect = innerWidth / innerHeight; vm.cam.updateProjectionMatrix();
    for (let i = 0; i < s.items.length; i++) {
      if (!s.items[i]) continue;
      s.cur = i;
      const optics = s.stat.kind === 'gun' ? [optic, ...p.opticList()] : [optic];
      for (const o of optics) {
        s.optic = o;
        const key = s.item.id + ':' + s.opticId; if (seen.has(key)) continue; seen.add(key);
        p.refreshWeapon();
        if (vm.flash) vm.flash.visible = true;                      // namlu alevi
        if (vm.lensDisc) vm.lensDisc.visible = true;                // ACOG / PSO merceği
        vm.scene.updateMatrixWorld(true);
        both(vm.scene, vm.cam);
        vm.setFade(0.5, 0); both(vm.scene, vm.cam);                 // nişan alırken silah yarı saydam: "opaque" varyantı
        vm.setFade(0, 1);
      }
    }
    s.cur = cur; s.optic = optic; s.optics = om;
    p.refreshWeapon();
  } catch (e) {
    console.warn('[ön ısıtma]', e);
  } finally {
    r.setRenderTarget(prevRT);
    rt.dispose();
  }
  return { ms: Math.round(performance.now() - t0), programs: r.info.programs.length - n0 };
}
