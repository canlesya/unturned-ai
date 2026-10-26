// Vadi kaya çarpışma kutuları tablosu (12.169): rockShape biçimleri değişirse yeniden üret, nature.js'teki ROCK_BOXES'a yapıştır.
//   node scripts/vadirocks.mjs   → JSON (köşeler içe yuvarlanmış: min yukarı, max aşağı → kutu gövdenin dışına taşmaz)
import * as N from '../src/maps/assets/vadi/nature.js';
const out = [];
for (let v = 0; v < 6; v++) {
  N.ROCK_BOXES[v] = null;                                          // tabloyu yok say: rockShape kutuları yeniden arar
  const R = N.rockShape(v);
  out.push(R.boxes.map((q) => [...q.min.map((a) => Math.ceil(a * 1e4) / 1e4), ...q.max.map((a) => Math.floor(a * 1e4) / 1e4)]));
}
console.log(JSON.stringify(out));
