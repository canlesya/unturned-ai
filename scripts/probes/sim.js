(() => { const g=window.__game; let max=0, t0;
for (let i=0;i<30*240;i++){ t0=performance.now(); g.step(1/30); max=Math.max(max,performance.now()-t0); }
const under=g.soldiers.filter(s=>s.alive&&s.pos.y<g.world.heightAt(s.pos.x,s.pos.z)-0.5).length;
return JSON.stringify({maxStep:Math.round(max), under, obj:g.mode.objectives.map(o=>o.name+':'+(o.owner||'-')+':'+o.p.toFixed(2)), tickets:g.mode.tickets}); })()
