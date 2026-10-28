/* Map rendering, camera and visual effects. */
(function () {
const MR = window.MR;
const {MW, MH, BASE} = MR;

const R = MR.Render = {
  canvas:null, ctx:null, mini:null, mctx:null, box:null,
  VW:800, VH:500, dpr:1, cam:{x:0, y:0, ts:32, follow:true, init:false},
  view:null, terrain:null, miniImg:null, myPid:null, myRole:'explorer',
  anim:{}, fx:[], tracks:[], ghost:[], drafts:{}, hoverPid:null, onTapRover:null, running:false,
};

R.init = (canvas, mini, box) => {
  R.canvas = canvas; R.ctx = canvas.getContext('2d'); R.mini = mini; R.mctx = mini.getContext('2d'); R.box = box;
  new ResizeObserver(() => R.resize()).observe(box);
  addEventListener('resize', () => R.resize());
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = {x:e.clientX, y:e.clientY, cx:R.cam.x, cy:R.cam.y, moved:false}; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (!drag) { const pid = R.hit(e.clientX, e.clientY); if (pid !== R.hoverPid) { R.hoverPid = pid; canvas.style.cursor = pid ? 'pointer' : 'grab'; } return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; R.cam.follow = false; canvas.style.cursor = 'grabbing'; }
    if (drag.moved) { R.cam.x = drag.cx - dx/R.cam.ts; R.cam.y = drag.cy - dy/R.cam.ts; R.clamp(); }
  });
  const end = e => { if (drag && !drag.moved && e.type === 'pointerup') { const pid = R.hit(e.clientX, e.clientY);
      if (pid) { if (R.onTapRover) R.onTapRover(pid, e.clientX, e.clientY); }
      else if (R.onTapMap) { const b = canvas.getBoundingClientRect(); R.onTapMap(Math.floor((e.clientX - b.left)/R.cam.ts + R.cam.x), Math.floor((e.clientY - b.top)/R.cam.ts + R.cam.y), e.clientX, e.clientY); } }
    drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => { R.hoverPid = null; });
  /* Mouse wheel and trackpad pinch zoom toward the pointer. Small trackpad steps give small zoom steps. */
  canvas.addEventListener('wheel', e => { e.preventDefault(); const b = canvas.getBoundingClientRect();
    const d = Math.max(-1, Math.min(1, e.deltaY / (e.deltaMode ? 3 : 100)));
    R.zoom(Math.pow(1.15, -d), (e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height); }, {passive:false});
  mini.addEventListener('click', e => { const r = mini.getBoundingClientRect(), [vw,vh] = R.viewTiles();
    R.cam.follow = false; R.cam.x = (e.clientX-r.left)/r.width*MW - vw/2; R.cam.y = (e.clientY-r.top)/r.height*MH - vh/2; R.clamp(); });
  requestAnimationFrame(R.frame);
};
R.setView = (view, myPid, myRole) => {
  const fresh = !R.terrain || R.terrainKey !== view.map + view.seed;
  R.view = view; R.myPid = myPid; R.myRole = myRole;
  if (fresh) {
    R.terrain = MR.bakeTerrain(view.world); R.terrainKey = view.map + view.seed;
    const m = document.createElement('canvas'); m.width = MW*4; m.height = MH*4; m.getContext('2d').drawImage(R.terrain, 0, 0, m.width, m.height); R.miniImg = m;
  }
  view.rovers.forEach(r => { const a = R.anim[r.pid]; if (!a || !R.running) R.anim[r.pid] = {px:r.x, py:r.y, ang:r.dir*90, busy:null, wob:0}; });
  Object.keys(R.anim).forEach(pid => { if (!view.rovers.some(r => r.pid === pid)) delete R.anim[pid]; });
};
R.resetTracks = () => { R.tracks = []; R.fx = []; R.ghost = []; R.drafts = {}; };
R.myRover = () => R.view && R.view.rovers.find(r => r.pid === R.myPid);

R.viewTiles = () => [R.VW/R.cam.ts, R.VH/R.cam.ts];
R.minTs = () => Math.max(R.VW/MW, R.VH/MH);
R.clamp = () => { const [vw,vh] = R.viewTiles(); R.cam.x = Math.max(0, Math.min(MW-vw, R.cam.x)); R.cam.y = Math.max(0, Math.min(MH-vh, R.cam.y)); };
/* Zoom by f, keeping the point at (fx, fy) of the view (0..1, default the middle) in place. */
let zoomSave = null;
R.zoom = (f, fx = .5, fy = .5) => { const [vw,vh] = R.viewTiles(), px = R.cam.x + vw*fx, py = R.cam.y + vh*fy;
  R.cam.ts = Math.max(R.minTs(), Math.min(64, R.cam.ts*f)); const [nw,nh] = R.viewTiles(); R.cam.x = px - nw*fx; R.cam.y = py - nh*fy; R.clamp();
  if (fx !== .5 || fy !== .5) R.cam.follow = false;
  clearTimeout(zoomSave); zoomSave = setTimeout(() => { MR.Store.settings.zoom = Math.round(R.cam.ts); MR.Store.save(); }, 400); };
R.focus = (pid, follow) => { const a = R.anim[pid]; if (!a) return; const [vw,vh] = R.viewTiles(); R.cam.x = a.px+.5-vw/2; R.cam.y = a.py+.5-vh/2; R.clamp(); R.cam.follow = !!follow; };
R.resize = () => {
  const box = R.box; R.VW = Math.max(200, box.clientWidth);
  if (innerWidth >= 1100) {
    const top = box.getBoundingClientRect().top + scrollY, big = document.body.classList.contains('bigmap');
    R.VH = Math.round(Math.max(380, Math.min(1600, innerHeight - top - (big ? 52 : 64))));
  } else R.VH = Math.round(Math.max(300, Math.min(640, R.VW*.62)));
  R.dpr = Math.min(window.devicePixelRatio || 1, 2);
  R.canvas.style.width = R.VW+'px'; R.canvas.style.height = R.VH+'px';
  R.canvas.width = Math.round(R.VW*R.dpr); R.canvas.height = Math.round(R.VH*R.dpr);
  const mr = R.mini.getBoundingClientRect(); R.mini.width = Math.max(1, Math.round(mr.width*R.dpr)); R.mini.height = Math.max(1, Math.round(mr.height*R.dpr));
  if (!R.cam.init) { R.cam.ts = (MR.Store.settings.zoom) || (R.VW > 700 ? 32 : 26); R.cam.init = true; }
  R.cam.ts = Math.max(R.minTs(), R.cam.ts); R.clamp();
};
R.hit = (cx, cy) => {
  if (!R.view) return null; const b = R.canvas.getBoundingClientRect(), ts = R.cam.ts;
  const x = (cx - b.left)/ts + R.cam.x, y = (cy - b.top)/ts + R.cam.y; let best = null, bd = .6;
  R.view.rovers.forEach(r => { const a = R.anim[r.pid]; if (!a) return; const d = Math.hypot(a.px+.5-x, a.py+.5-y); if (d < bd) { bd = d; best = r.pid; } });
  return best;
};
R.screenOf = pid => { const a = R.anim[pid], b = R.canvas.getBoundingClientRect(); return a ? {x:b.left + (a.px+.5-R.cam.x)*R.cam.ts, y:b.top + (a.py-R.cam.y)*R.cam.ts} : null; };
R.addFx = o => { o.t0 = performance.now(); o.dur *= MR.speed(); R.fx.push(o); };

function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
function drawRock(c, cx, cy, Rd, pts, shade){
  const path = (ox,oy,rad) => { c.beginPath(); pts.forEach((p,i) => { const a=i/pts.length*Math.PI*2, X=ox+Math.cos(a)*rad*p, Y=oy+Math.sin(a)*rad*p; i?c.lineTo(X,Y):c.moveTo(X,Y); }); c.closePath(); };
  c.fillStyle='rgba(45,15,6,0.38)'; path(cx+Rd*.22, cy+Rd*.3, Rd); c.fill();
  const v = Math.round(88+shade*40), grey = R.view && MR.MAPS[R.view.map].airless;
  c.fillStyle = grey ? `rgb(${v+30},${v+28},${v+24})` : `rgb(${v+22},${Math.round(v*.62)},${Math.round(v*.45)})`; path(cx, cy, Rd); c.fill();
  c.fillStyle='rgba(255,225,200,0.17)'; path(cx-Rd*.2, cy-Rd*.22, Rd*.55); c.fill();
}

function drawLM(c, sx, sy, s){
  const cx = sx + s/2, cy = sy + s/2;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx + s*.08, cy + s*.1, s*.45, s*.4, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#c9ced4'; c.lineWidth = s*.03; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([x, y]) => { c.beginPath(); c.moveTo(cx + x*s*.18, cy + y*s*.18); c.lineTo(cx + x*s*.4, cy + y*s*.4); c.stroke();
    c.fillStyle = '#d8b25a'; c.beginPath(); c.arc(cx + x*s*.4, cy + y*s*.4, s*.05, 0, Math.PI*2); c.fill(); });
  c.fillStyle = '#d8a845'; c.beginPath(); for (let k = 0; k < 8; k++) { const an = k/8*Math.PI*2 + Math.PI/8; c.lineTo(cx + Math.cos(an)*s*.26, cy + Math.sin(an)*s*.26); } c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120,80,20,.6)'; c.lineWidth = s*.01; c.stroke();
  c.fillStyle = '#b9bdc2'; rr(c, cx - s*.14, cy - s*.16, s*.28, s*.28, s*.04); c.fill();
  c.fillStyle = '#2d2f33'; c.beginPath(); c.moveTo(cx - s*.08, cy - s*.16); c.lineTo(cx + s*.08, cy - s*.16); c.lineTo(cx, cy - s*.06); c.closePath(); c.fill();
  c.fillStyle = '#e6e8ea'; c.beginPath(); c.arc(cx + s*.07, cy + s*.04, s*.05, 0, Math.PI*2); c.fill();
}
function drawUpgrades(c, ts){
  const L = R.view.lab; if (!L || !L.built) return; const S = MR.MAPS[R.view.map].station, at = (dx, dy) => [(S.x + dx - R.cam.x)*ts, (S.y + dy - R.cam.y)*ts];
  if (L.built.solar_farm) { const [x, y] = at(-2.6, 2.4); for (let k = 0; k < 3; k++) { c.fillStyle = '#24456a'; c.fillRect(x + k*ts*.55, y, ts*.48, ts*.7); c.strokeStyle = 'rgba(140,190,240,.5)'; c.lineWidth = 1; c.strokeRect(x + k*ts*.55, y, ts*.48, ts*.7); } }
  if (L.built.radio_tower) { const [x, y] = at(2.6, -1.4); c.strokeStyle = '#c9ced4'; c.lineWidth = Math.max(1.5, ts*.06); c.beginPath(); c.moveTo(x, y + ts*.9); c.lineTo(x, y - ts*.2); c.stroke(); c.fillStyle = '#e6ecf1'; c.beginPath(); c.arc(x, y - ts*.25, ts*.18, 0, Math.PI*2); c.fill(); }
  if (L.built.garage) { const [x, y] = at(-1.9, -1.6); c.fillStyle = '#8d949c'; c.fillRect(x, y, ts*1.1, ts*.8); c.fillStyle = '#5d636a'; c.fillRect(x + ts*.25, y + ts*.35, ts*.6, ts*.45); }
  if (L.built.greenhouse) { const [x, y] = at(2.7, 2.7); const g = c.createRadialGradient(x - ts*.15, y - ts*.15, 2, x, y, ts*.6); g.addColorStop(0, 'rgba(210,255,220,.95)'); g.addColorStop(1, 'rgba(90,170,110,.85)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, ts*.55, 0, Math.PI*2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.stroke(); }
}
function drawStation(c, t, ts){
  const S = MR.MAPS[R.view.map].station, sx = (S.x-R.cam.x)*ts, sy = (S.y-R.cam.y)*ts, s = ts*2;
  drawUpgrades(c, ts);
  if (MR.MAPS[R.view.map].airless) return drawLM(c, sx, sy, s);
  c.fillStyle='rgba(40,14,6,0.35)'; c.fillRect(sx+s*.08, sy+s*.1, s*.92, s*.92);
  c.fillStyle='#9aa3ab'; c.fillRect(sx+s*.06, sy+s*.06, s*.88, s*.88);
  c.strokeStyle='rgba(240,191,90,0.9)'; c.lineWidth=Math.max(1.5,ts*.05); c.setLineDash([ts*.14,ts*.1]); c.strokeRect(sx+s*.12, sy+s*.12, s*.76, s*.76); c.setLineDash([]);
  c.fillStyle='#24456a'; c.fillRect(sx+s*.14, sy+s*.18, s*.24, s*.64); c.fillRect(sx+s*.62, sy+s*.18, s*.24, s*.64);
  c.strokeStyle='rgba(140,190,240,0.5)'; c.lineWidth=1;
  for (let k=1;k<4;k++){ c.beginPath(); c.moveTo(sx+s*.14, sy+s*(.18+k*.16)); c.lineTo(sx+s*.38, sy+s*(.18+k*.16)); c.moveTo(sx+s*.62, sy+s*(.18+k*.16)); c.lineTo(sx+s*.86, sy+s*(.18+k*.16)); c.stroke(); }
  const g = c.createRadialGradient(sx+s*.45, sy+s*.42, s*.02, sx+s*.5, sy+s*.5, s*.16); g.addColorStop(0,'#ffffff'); g.addColorStop(1,'#c9ced4');
  c.fillStyle=g; c.beginPath(); c.arc(sx+s*.5, sy+s*.5, s*.15, 0, Math.PI*2); c.fill();
  c.fillStyle = Math.sin(t/400) > 0 ? '#58cfbe' : '#2a6b62'; c.beginPath(); c.arc(sx+s*.5, sy+s*.5, s*.035, 0, Math.PI*2); c.fill();
}
function drawGem(c, cx, cy, r, color, t, seed){
  const bob = Math.sin(t/300 + seed)*r*.15;
  c.fillStyle='rgba(40,14,6,0.3)'; c.beginPath(); c.ellipse(cx, cy+r*.9, r*.8, r*.25, 0, 0, Math.PI*2); c.fill();
  c.save(); c.translate(cx, cy+bob);
  c.fillStyle = color; c.beginPath(); c.moveTo(0,-r); c.lineTo(r*.85,-r*.25); c.lineTo(0,r); c.lineTo(-r*.85,-r*.25); c.closePath(); c.fill();
  c.fillStyle='rgba(255,255,255,0.45)'; c.beginPath(); c.moveTo(0,-r); c.lineTo(r*.85,-r*.25); c.lineTo(0,-r*.1); c.closePath(); c.fill();
  c.fillStyle='rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(0,r); c.lineTo(-r*.85,-r*.25); c.lineTo(0,-r*.1); c.closePath(); c.fill();
  const tw = (Math.sin(t/180 + seed*3) + 1)/2, sp = r*.3*tw + r*.08;
  c.fillStyle=`rgba(255,255,255,${tw})`; c.beginPath(); c.moveTo(r*.7,-r*1.1-sp); c.lineTo(r*.7+sp*.3,-r*1.1); c.lineTo(r*.7,-r*1.1+sp); c.lineTo(r*.7-sp*.3,-r*1.1); c.closePath(); c.fill();
  c.restore();
}
function drawMarker(c, i, t, ts){
  const W = R.view.world, x = i % MW, y = (i/MW)|0, cx = (x-R.cam.x+.5)*ts, cy = (y-R.cam.y+.5)*ts, id = W.res[i], card = MR.CARDS[id];
  if (card.artifact) return drawArtifact(c, id, cx, cy, ts, W.drilled[i]);
  if (W.drilled[i]) {
    c.fillStyle='#2b130b'; c.beginPath(); c.arc(cx,cy,ts*.09,0,Math.PI*2); c.fill();
    c.strokeStyle = card.color; c.globalAlpha=.7; c.lineWidth=Math.max(1.5,ts*.05); c.beginPath(); c.arc(cx,cy,ts*.22,0,Math.PI*2); c.stroke(); c.globalAlpha=1; return;
  }
  if (!W.sig[i]) return;
  if (R.myRole === 'cadet' || W.kid[i]) return drawGem(c, cx, cy, ts*.26, W.known[i] ? card.color : '#ffffff', t, x*7+y);
  const r = ts*.24; c.save(); c.translate(cx, cy); c.rotate(Math.PI/4);
  if (W.known[i]) { c.fillStyle = card.color; c.fillRect(-r*.75,-r*.75,r*1.5,r*1.5); c.strokeStyle='rgba(14,19,25,0.8)'; c.lineWidth=Math.max(1,ts*.04); c.strokeRect(-r*.75,-r*.75,r*1.5,r*1.5); }
  else { const p = .5+.5*Math.sin(t/280 + x + y); c.fillStyle=`rgba(14,19,25,${.55+.2*p})`; c.fillRect(-r*.8,-r*.8,r*1.6,r*1.6);
    c.strokeStyle=`rgba(240,191,90,${.6+.4*p})`; c.lineWidth=Math.max(1.5,ts*.06); c.strokeRect(-r*.8,-r*.8,r*1.6,r*1.6); }
  c.restore();
  if (!W.known[i] && ts >= 20) { c.fillStyle='#f0bf5a'; c.font=`700 ${Math.round(ts*.3)}px 'IBM Plex Mono', monospace`; c.textAlign='center'; c.textBaseline='middle'; c.fillText('?', cx, cy+1); }
}
function drawArtifact(c, id, cx, cy, ts, done){
  c.save(); c.translate(cx, cy); const s = ts*.8;
  c.fillStyle='rgba(40,12,4,0.35)'; c.beginPath(); c.ellipse(s*.08,s*.1,s*.42,s*.3,0,0,Math.PI*2); c.fill();
  if (id === 'art_backshell') {
    c.rotate(.5); c.fillStyle='#e9e4da'; c.beginPath(); c.moveTo(-s*.18,-s*.36); c.lineTo(s*.18,-s*.36); c.lineTo(s*.4,s*.3); c.lineTo(-s*.4,s*.3); c.closePath(); c.fill();
    c.strokeStyle='#a9a29a'; c.lineWidth=s*.03; for (let k=1;k<4;k++){ c.beginPath(); c.moveTo(-s*(.18+k*.055), -s*.36+k*s*.16); c.lineTo(s*(.18+k*.055), -s*.36+k*s*.16); c.stroke(); }
  } else if (id === 'art_ingenuity') {
    c.fillStyle='#8d949c'; c.fillRect(-s*.12,-s*.12,s*.24,s*.24);
    c.strokeStyle='#5e6268'; c.lineWidth=s*.05; c.beginPath(); c.moveTo(-s*.42,-s*.05); c.lineTo(s*.42,s*.05); c.moveTo(-s*.05,-s*.42); c.lineTo(s*.05,s*.42); c.stroke();
    c.strokeStyle='#c9ced4'; c.lineWidth=s*.03; [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b]) => { c.beginPath(); c.moveTo(a*s*.1,b*s*.1); c.lineTo(a*s*.3,b*s*.3); c.stroke(); });
    c.fillStyle='#d8c46a'; c.fillRect(-s*.1,-s*.06,s*.2,s*.08);
  } else {
    c.fillStyle='#2d2f33'; [-.3,0,.3].forEach(wy => [-.34,.34].forEach(wx => { c.fillRect(wx*s-s*.07, wy*s-s*.08, s*.14, s*.16); }));
    c.fillStyle='#c8bba6'; rr(c,-s*.24,-s*.28,s*.48,s*.56,s*.05); c.fill();
    c.fillStyle='#5b5146'; c.fillRect(-s*.4,-s*.1,s*.8,s*.26);
    c.fillStyle='rgba(200,150,110,0.55)'; c.fillRect(-s*.4,-s*.1,s*.8,s*.26);
  }
  c.restore();
  if (done) { c.fillStyle='#86d48f'; c.beginPath(); c.arc(cx+ts*.32, cy-ts*.32, ts*.13, 0, Math.PI*2); c.fill();
    c.strokeStyle='#0e1319'; c.lineWidth=ts*.04; c.beginPath(); c.moveTo(cx+ts*.26,cy-ts*.32); c.lineTo(cx+ts*.31,cy-ts*.27); c.lineTo(cx+ts*.39,cy-ts*.37); c.stroke(); }
  else if (ts >= 20) { const p = .5+.5*Math.sin(performance.now()/300); c.strokeStyle=`rgba(255,154,77,${.5+.5*p})`; c.lineWidth=ts*.05; c.beginPath(); c.arc(cx,cy,ts*.48,0,Math.PI*2); c.stroke(); }
}
function drawFlag(c, i, site, ts){
  const W = R.view.world, x = i % MW, y = (i/MW)|0, X = (x - R.cam.x + .82)*ts, Y = (y - R.cam.y + .62)*ts;
  const finder = R.view.rovers.find(q => q.pid === site.by), col = finder ? MR.colorHex(finder.color) : '#c3ced8';
  const basalt = W.known[i] && W.res[i] === 'basalt';
  c.save(); if (basalt) c.globalAlpha = .35;
  c.strokeStyle = '#e6ecf1'; c.lineWidth = Math.max(1, ts*.035); c.beginPath(); c.moveTo(X, Y); c.lineTo(X, Y - ts*.52); c.stroke();
  c.fillStyle = basalt ? '#9aa7b3' : col; c.beginPath(); c.moveTo(X, Y - ts*.52); c.lineTo(X + ts*.3, Y - ts*.43); c.lineTo(X, Y - ts*.33); c.closePath(); c.fill();
  if (W.known[i] && !basalt) { c.fillStyle = MR.CARDS[W.res[i]].color; c.beginPath(); c.arc(X + ts*.11, Y - ts*.43, ts*.05, 0, Math.PI*2); c.fill(); }
  if (site.claim) { const cl = R.view.rovers.find(q => q.pid === site.claim); if (cl) { c.fillStyle = MR.colorHex(cl.color); c.beginPath(); c.arc(X, Y - ts*.6, ts*.08, 0, Math.PI*2); c.fill(); c.strokeStyle = '#0b1015'; c.lineWidth = 1; c.stroke(); } }
  if (ts >= 40 && !basalt) { c.font = `600 ${Math.round(ts*.2)}px 'IBM Plex Sans', sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(10,14,19,.7)'; c.fillText(site.name, X + ts*.34 + 1, Y - ts*.42 + 1); c.fillStyle = '#f4efe6'; c.fillText(site.name, X + ts*.34, Y - ts*.42); }
  c.restore();
}
function drawTrap(c, i, ts){
  const x = i % MW, y = (i/MW)|0, cx = (x-R.cam.x+.5)*ts, cy = (y-R.cam.y+.5)*ts;
  c.strokeStyle='rgba(70,25,10,0.65)'; c.lineWidth=Math.max(1.5,ts*.05); c.beginPath();
  for (let a=0;a<Math.PI*5;a+=.3) { const q = a/(Math.PI*5)*ts*.36; const X = cx+Math.cos(a)*q, Y = cy+Math.sin(a)*q; a ? c.lineTo(X,Y) : c.moveTo(X,Y); }
  c.stroke();
}

/* Rovers seen from above, facing up. Details appear as you zoom in (ts = pixels per square). */
function wheel(c, x, y, w, h, lod){
  c.fillStyle = '#26292e'; rr(c, x - w/2, y - h/2, w, h, Math.min(w, h)*.28); c.fill();
  if (lod >= 2) { c.strokeStyle = 'rgba(160,166,174,.55)'; c.lineWidth = Math.max(.6, w*.08);
    for (let k = 1; k < 5; k++) { const yy = y - h/2 + k*h/5; c.beginPath(); c.moveTo(x - w/2 + w*.12, yy); c.lineTo(x + w/2 - w*.12, yy); c.stroke(); } }
  c.fillStyle = '#8d949c'; c.beginPath(); c.arc(x, y, Math.min(w, h)*.18, 0, Math.PI*2); c.fill();
}
function drawGroundRover(c, r, a, t, s, lod){
  const col = MR.colorHex(r.color), P = k => (r.perks || []).includes(k);
  const ww = P('wide_wheels') ? .21 : .15, wh = .21;
  // rocker-bogie legs
  c.strokeStyle = '#9aa1a9'; c.lineWidth = s*.045; c.lineCap = 'round';
  [-1, 1].forEach(sd => { const X = sd*.4*s;
    c.beginPath(); c.moveTo(X, -.34*s); c.lineTo(sd*.31*s, -.1*s); c.lineTo(sd*.36*s, .18*s); c.lineTo(X, 0); c.moveTo(sd*.36*s, .18*s); c.lineTo(X, .34*s); c.stroke();
    if (lod >= 1) { c.fillStyle = '#c7ccd2'; c.beginPath(); c.arc(sd*.31*s, -.1*s, s*.035, 0, Math.PI*2); c.fill(); } });
  c.lineCap = 'butt';
  [-.34, 0, .34].forEach(y => [-1, 1].forEach(sd => wheel(c, sd*.4*s, y*s, ww*s, wh*s, lod)));
  // power unit (MMRTG) at the back
  if (lod >= 1) { c.save(); c.translate(0, .33*s); c.rotate(.12); c.fillStyle = '#7f858c'; rr(c, -.1*s, -.07*s, .2*s, .16*s, .03*s); c.fill();
    if (lod >= 2) { c.strokeStyle = '#5d636a'; c.lineWidth = s*.015; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(k*.035*s, -.07*s); c.lineTo(k*.035*s, .09*s); c.stroke(); } }
    c.restore(); }
  if (r.job === 'excavator') { c.fillStyle = '#c9ced4'; rr(c, -.32*s, -.62*s, .64*s, .13*s, .03*s); c.fill(); c.fillStyle = col; c.fillRect(-.32*s, -.62*s, .64*s, .035*s);
    c.strokeStyle = '#8d949c'; c.lineWidth = s*.04; c.beginPath(); c.moveTo(-.18*s, -.5*s); c.lineTo(-.14*s, -.28*s); c.moveTo(.18*s, -.5*s); c.lineTo(.14*s, -.28*s); c.stroke(); }
  // body
  const g = c.createLinearGradient(-.26*s, -.3*s, .26*s, .26*s); g.addColorStop(0, '#f4efe6'); g.addColorStop(1, '#cfc6b6');
  c.fillStyle = g; rr(c, -.26*s, -.3*s, .52*s, .56*s, .06*s); c.fill();
  c.fillStyle = col; c.fillRect(-.26*s, -.3*s, .045*s, .56*s); c.fillRect(.215*s, -.3*s, .045*s, .56*s);
  if (lod >= 1) { c.fillStyle = 'rgba(40,48,58,.18)'; rr(c, -.18*s, -.2*s, .36*s, .38*s, .03*s); c.fill(); }
  // deck gear
  if (lod >= 1) {
    const hga = P('hg_antenna'), hr = (hga ? .11 : .07)*s, hx = -.1*s, hy = .06*s;
    c.fillStyle = hga ? '#e8c46a' : '#aab1b8'; c.beginPath(); for (let k = 0; k < 6; k++) { const an = k/6*Math.PI*2 + .5; c.lineTo(hx + Math.cos(an)*hr, hy + Math.sin(an)*hr); } c.closePath(); c.fill();
    if (lod >= 2) { c.strokeStyle = hga ? '#a7832e' : '#7d848b'; c.lineWidth = s*.012; c.stroke(); c.fillStyle = '#5d636a'; c.beginPath(); c.arc(hx, hy, hr*.25, 0, Math.PI*2); c.fill(); }
    if (P('better_radio')) { c.strokeStyle = '#c9ced4'; c.lineWidth = s*.02; c.beginPath(); c.moveTo(.12*s, .14*s); c.lineTo(.12*s, -.02*s); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(.12*s, -.03*s, s*.03, 0, Math.PI*2); c.fill(); }
    else { c.fillStyle = '#9aa1a9'; c.beginPath(); c.arc(.12*s, .12*s, s*.025, 0, Math.PI*2); c.fill(); }
    if (P('big_battery')) { c.fillStyle = '#4e5e52'; rr(c, -.22*s, .14*s, .14*s, .09*s, .02*s); c.fill(); c.fillStyle = '#86d48f'; c.fillRect(-.2*s, .175*s, .1*s, .02*s); }
    if (r.job === 'hauler') { c.fillStyle = '#8d949c'; rr(c, -.04*s, -.14*s, .2*s, .24*s, .02*s); c.fill();
      for (let k = 0; k < 8; k++) { const id = (r.tubes || [])[k], x = -.02*s + (k % 4)*.045*s, y = -.11*s + Math.floor(k/4)*.11*s;
        c.fillStyle = id ? MR.CARDS[id].color : '#3a4048'; rr(c, x, y, .03*s, .08*s, .01*s); c.fill(); } }
  }
  // robotic arm, folded across the front (Science stretches it out)
  if (lod >= 1) { const sci = r.job === 'science', ex = sci ? .02*s : .12*s, ey = sci ? -.6*s : -.37*s;
    c.strokeStyle = '#a7aeb6'; c.lineWidth = s*.04; c.lineCap = 'round'; c.beginPath(); c.moveTo(-.2*s, -.28*s); c.lineTo(sci ? -.12*s : -.05*s, sci ? -.45*s : -.36*s); c.lineTo(ex, ey); c.stroke(); c.lineCap = 'butt';
    c.fillStyle = '#c9ced4'; c.beginPath(); c.arc(ex, ey, s*(sci ? .08 : .06), 0, Math.PI*2); c.fill();
    if (lod >= 2) { c.fillStyle = '#5d636a'; c.beginPath(); c.arc(ex, ey, s*.025, 0, Math.PI*2); c.fill(); }
    if (a.busy === 'drill') { c.strokeStyle = '#f0bf5a'; c.lineWidth = s*.05; c.beginPath(); c.arc(ex, ey, s*.1, t/60, t/60 + 4); c.stroke(); } }
  // camera mast and head
  const mx = .14*s, my = -.2*s, tall = r.job === 'scout';
  c.fillStyle = '#b8bec5'; c.beginPath(); c.arc(mx, my, s*.04, 0, Math.PI*2); c.fill();
  c.save(); c.translate(mx, my - (tall ? .1 : .06)*s);
  const sc = P('supercam'), hw = (sc ? .22 : .17)*s, hh = (sc ? .1 : .08)*s;
  c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, -hw/2 + s*.02, -hh/2 + s*.03, hw, hh, s*.02); c.fill();
  c.fillStyle = '#e9e4da'; rr(c, -hw/2, -hh/2, hw, hh, s*.02); c.fill();
  if (lod >= 1) { c.fillStyle = '#1d2a38'; [-1, 1].forEach(sd => { c.beginPath(); c.arc(sd*hw*.28, -hh*.1, s*.025, 0, Math.PI*2); c.fill(); });
    if (sc) { c.fillStyle = '#ff5a4f'; c.beginPath(); c.arc(0, -hh*.15, s*.03, 0, Math.PI*2); c.fill(); }
    if (P('sharp_eyes')) { c.fillStyle = '#c9ced4'; [-1, 1].forEach(sd => { rr(c, sd*(hw/2 + s*.01) - (sd < 0 ? s*.05 : 0), -hh*.35, s*.05, s*.045, s*.01); c.fill(); }); } }
  c.restore();
  // team flag on the back corner
  c.strokeStyle = '#8d949c'; c.lineWidth = s*.02; c.beginPath(); c.moveTo(-.21*s, .22*s); c.lineTo(-.21*s, .5*s); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-.21*s, .5*s); c.lineTo(-.03*s, .44*s); c.lineTo(-.21*s, .38*s); c.closePath(); c.fill();
}
/* Apollo Lunar Roving Vehicle, seen from above: open frame, wire-mesh wheels, two astronauts, umbrella antenna. */
function drawLRV(c, r, a, t, s, lod){
  const col = MR.colorHex(r.color);
  [[-.33, -.3], [.33, -.3], [-.33, .32], [.33, .32]].forEach(([x, y]) => {
    c.fillStyle = '#3a3c40'; rr(c, x*s - .09*s, y*s - .13*s, .18*s, .26*s, .07*s); c.fill();
    if (lod >= 1) { c.strokeStyle = 'rgba(200,204,210,.55)'; c.lineWidth = s*.012; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(x*s - .08*s, y*s + k*.045*s); c.lineTo(x*s + .08*s, y*s + k*.045*s); c.stroke(); } }
    c.fillStyle = '#d9822b'; c.fillRect(x*s - .1*s, y*s - .15*s, .2*s, .04*s); });
  c.strokeStyle = '#c0c4c9'; c.lineWidth = s*.035; c.strokeRect(-.27*s, -.36*s, .54*s, .72*s);
  c.beginPath(); c.moveTo(-.27*s, 0); c.lineTo(.27*s, 0); c.stroke();
  c.fillStyle = '#d8b25a'; rr(c, -.2*s, -.42*s, .4*s, .12*s, .02*s); c.fill();
  c.fillStyle = '#d8b25a'; rr(c, -.18*s, .26*s, .36*s, .12*s, .02*s); c.fill();
  [-.11, .11].forEach(x => { c.fillStyle = '#4a4e55'; rr(c, x*s - .08*s, -.08*s, .16*s, .2*s, .03*s); c.fill();
    c.fillStyle = '#f4f4f2'; c.beginPath(); c.arc(x*s, 0, .075*s, 0, Math.PI*2); c.fill();
    c.fillStyle = '#d9a640'; c.beginPath(); c.arc(x*s, -.035*s, .045*s, Math.PI, 0); c.fill(); });
  c.strokeStyle = '#a7aeb6'; c.lineWidth = s*.02; c.beginPath(); c.moveTo(.18*s, -.3*s); c.lineTo(.24*s, -.5*s); c.stroke();
  c.fillStyle = 'rgba(220,222,226,.85)'; c.beginPath(); c.arc(.24*s, -.52*s, .1*s, 0, Math.PI*2); c.fill();
  if (lod >= 1) { c.strokeStyle = 'rgba(120,124,130,.7)'; c.lineWidth = s*.008; for (let k = 0; k < 6; k++) { const an = k/6*Math.PI*2; c.beginPath(); c.moveTo(.24*s, -.52*s); c.lineTo(.24*s + Math.cos(an)*.1*s, -.52*s + Math.sin(an)*.1*s); c.stroke(); } }
  c.fillStyle = '#2d2f33'; rr(c, -.25*s, -.48*s, .1*s, .07*s, .015*s); c.fill();
  if (r.job === 'hauler') { (r.tubes || []).slice(0, 6).forEach((id, k) => { c.fillStyle = MR.CARDS[id].color; c.fillRect(-.15*s + k*.05*s, .28*s, .035*s, .08*s); }); }
  if (r.job === 'excavator') { c.fillStyle = '#c9ced4'; rr(c, -.3*s, -.6*s, .6*s, .1*s, .02*s); c.fill(); }
  c.strokeStyle = '#8d949c'; c.lineWidth = s*.02; c.beginPath(); c.moveTo(-.26*s, .34*s); c.lineTo(-.26*s, .6*s); c.stroke();
  c.fillStyle = col; c.beginPath(); c.moveTo(-.26*s, .6*s); c.lineTo(-.08*s, .54*s); c.lineTo(-.26*s, .48*s); c.closePath(); c.fill();
  if (a.busy === 'drill') { c.strokeStyle = '#f0bf5a'; c.lineWidth = s*.05; c.beginPath(); c.arc(0, -.55*s, s*.09, t/60, t/60 + 4); c.stroke(); }
}
function drawBuggy(c, r, a, t, s, lod){
  const col = MR.colorHex(r.color);
  [[-.31, -.25], [.31, -.25], [-.31, .27], [.31, .27]].forEach(([x, y]) => wheel(c, x*s, y*s, .2*s, .27*s, lod));
  c.strokeStyle = '#9aa1a9'; c.lineWidth = s*.05; c.beginPath(); c.moveTo(-.31*s, -.25*s); c.lineTo(.31*s, -.25*s); c.moveTo(-.31*s, .27*s); c.lineTo(.31*s, .27*s); c.stroke();
  const g = c.createRadialGradient(-.08*s, -.12*s, s*.02, 0, 0, s*.38); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, col); g.addColorStop(1, col);
  c.fillStyle = g; rr(c, -.23*s, -.32*s, .46*s, .62*s, .16*s); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(0, -.14*s, .13*s, .1*s, 0, 0, Math.PI*2); c.fill();
  c.fillStyle = '#1d2a38'; c.beginPath(); c.arc(0, -.14*s, .055*s, 0, Math.PI*2); c.fill();
  if (lod >= 1) { c.fillStyle = '#fff'; c.beginPath(); c.arc(-.02*s, -.16*s, .018*s, 0, Math.PI*2); c.fill(); }
  c.strokeStyle = '#e6ecf1'; c.lineWidth = s*.03; c.beginPath(); c.moveTo(.1*s, .14*s); c.lineTo(.18*s, .44*s); c.stroke();
  c.fillStyle = '#f2d15c'; c.beginPath(); for (let k = 0; k < 10; k++) { const rad = (k % 2 ? .03 : .07)*s, an = k/10*Math.PI*2 - Math.PI/2; c.lineTo(.18*s + Math.cos(an)*rad, .46*s + Math.sin(an)*rad); } c.closePath(); c.fill();
  if (a.busy === 'drill') { c.strokeStyle = '#f0bf5a'; c.lineWidth = s*.05; c.beginPath(); c.arc(0, -.4*s, s*.1, t/60, t/60 + 4); c.stroke(); }
}
function drawHeli(c, r, a, t, s, lod){
  const col = MR.colorHex(r.color);
  c.strokeStyle = '#9aa1a9'; c.lineWidth = s*.03; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, y]) => { c.beginPath(); c.moveTo(x*.07*s, y*.07*s); c.lineTo(x*.27*s, y*.27*s); c.stroke();
    c.fillStyle = '#c9ced4'; c.beginPath(); c.arc(x*.27*s, y*.27*s, s*.03, 0, Math.PI*2); c.fill(); });
  c.fillStyle = '#d8c46a'; rr(c, -.11*s, -.11*s, .22*s, .22*s, .03*s); c.fill();
  c.fillStyle = col; c.fillRect(-.11*s, -.025*s, .22*s, .05*s);
  const spin = t/35;
  for (let k = 0; k < 2; k++) { const an = spin*(k ? 1 : -1) + k*.9; c.strokeStyle = k ? 'rgba(70,74,80,.9)' : 'rgba(95,100,108,.9)'; c.lineWidth = s*.055;
    c.beginPath(); c.moveTo(-Math.cos(an)*s*.52, -Math.sin(an)*s*.52); c.lineTo(Math.cos(an)*s*.52, Math.sin(an)*s*.52); c.stroke(); }
  c.fillStyle = 'rgba(200,206,212,0.12)'; c.beginPath(); c.arc(0, 0, s*.52, 0, Math.PI*2); c.fill();
  c.fillStyle = '#24456a'; rr(c, -.09*s, -.06*s, .18*s, .12*s, .015*s); c.fill();
  if (lod >= 1) { c.strokeStyle = 'rgba(140,190,240,.5)'; c.lineWidth = s*.01; c.beginPath(); c.moveTo(0, -.06*s); c.lineTo(0, .06*s); c.moveTo(-.09*s, 0); c.lineTo(.09*s, 0); c.stroke(); }
}
R.drawPreview = (cv, r) => {
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  const g = c.createRadialGradient(cv.width/2, cv.height/2, 10, cv.width/2, cv.height/2, cv.width*.7); g.addColorStop(0, '#b5603d'); g.addColorStop(1, '#5a2a1a');
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  const s = cv.width*.62; c.save(); c.translate(cv.width/2, cv.height/2);
  const moon = R.view && MR.MAPS[R.view.map].airless;
  if (r.job === 'heli') drawHeli(c, r, {}, performance.now(), s, 2); else if (r.job === 'buggy') drawBuggy(c, r, {}, 0, s, 2); else if (r.job === 'lab') drawLab(c, r, s, 2); else if (moon) drawLRV(c, r, {}, 0, s, 2); else drawGroundRover(c, r, {}, 0, s, 2);
  if ((r.dust || 0) > 10) { c.fillStyle = `rgba(200,140,90,${Math.min(.5, r.dust/200)})`; c.beginPath(); c.arc(0, 0, s*.45, 0, Math.PI*2); c.fill(); }
  c.restore();
};
function drawLab(c, r, s, lod){
  const col = MR.colorHex(r.color);
  c.fillStyle = '#dcd6ca'; rr(c, -.3*s, -.3*s, .6*s, .6*s, .08*s); c.fill();
  c.fillStyle = col; c.fillRect(-.3*s, -.06*s, .6*s, .06*s);
  c.fillStyle = '#9fd3c8'; c.beginPath(); c.arc(-.1*s, -.13*s, .09*s, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#8d949c'; c.lineWidth = .04*s; c.lineCap = 'round'; c.beginPath(); c.moveTo(.12*s, .1*s); c.lineTo(.26*s, -.12*s); c.lineTo(.38*s, -.02*s); c.stroke(); c.lineCap = 'butt';
  c.fillStyle = '#c9ced4'; c.beginPath(); c.arc(.38*s, -.02*s, .05*s, 0, Math.PI*2); c.fill();
  if (lod >= 1) { c.fillStyle = '#5d636a'; for (let k = 0; k < 3; k++) { c.fillRect(-.22*s + k*.1*s, .12*s, .06*s, .1*s); } }
}
function drawRover(c, r, a, t, ts, ghost){
  const s = ts*.92, cx = (a.px-R.cam.x+.5)*ts, cy = (a.py-R.cam.y+.5)*ts, heli = r.job === 'heli', lod = ts < 20 ? 0 : ts < 32 ? 1 : 2;
  c.save(); c.translate(cx, cy);
  if (ghost) c.globalAlpha = .35;
  if (heli) { c.fillStyle='rgba(40,12,4,0.28)'; c.beginPath(); c.ellipse(s*.12, s*.25, s*.32, s*.17, 0, 0, Math.PI*2); c.fill(); c.translate(0, -s*.12); }
  else { c.fillStyle='rgba(40,12,4,0.32)'; c.beginPath(); c.ellipse(s*.06,s*.08,s*.5,s*.5,0,0,Math.PI*2); c.fill(); }
  c.rotate(a.ang*Math.PI/180);
  if (a.busy || a.wob > 0) c.translate((Math.random()-.5)*s*.03, (Math.random()-.5)*s*.03);
  const moon = R.view && MR.MAPS[R.view.map].airless;
  if (heli) drawHeli(c, r, a, t, s, lod); else if (r.job === 'buggy') drawBuggy(c, r, a, t, s, lod); else if (r.job === 'lab') drawLab(c, r, s, lod); else if (moon) drawLRV(c, r, a, t, s, lod); else drawGroundRover(c, r, a, t, s, lod);
  c.restore();
}
/* Guidance: a dashed search circle (or a bouncing marker) when on screen, an arrow at the edge when not. */
function drawHints(c, t, ts){
  (R.hints || []).forEach(h => {
    const sx = (h.x - R.cam.x + .5)*ts, sy = (h.y - R.cam.y + .5)*ts, m = 40;
    const on = sx > m && sy > m && sx < R.VW - m && sy < R.VH - m;
    c.save(); c.font = `600 13px 'IBM Plex Sans', system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const pill = (x, y, text) => { const w = c.measureText(text).width + 14; c.fillStyle = 'rgba(10,14,19,.85)'; rr(c, x - w/2, y - 11, w, 22, 11); c.fill(); c.strokeStyle = h.color; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#e6ecf1'; c.fillText(text, x, y + .5); };
    if (on) {
      if (h.area) {
        c.strokeStyle = h.color; c.globalAlpha = .6 + .25*Math.sin(t/400); c.lineWidth = Math.max(2, ts*.07); c.setLineDash([ts*.3, ts*.2]);
        c.beginPath(); c.arc(sx, sy, ts*4.5, 0, Math.PI*2); c.stroke(); c.setLineDash([]); c.globalAlpha = .1; c.fillStyle = h.color; c.fill(); c.globalAlpha = 1;
        pill(sx, Math.max(14, sy - ts*4.5 - 4), h.near ? `${h.label}: scan around here!` : `Look for ${h.label} here`);
      } else {
        const b = Math.sin(t/180)*ts*.12; c.fillStyle = h.color;
        c.beginPath(); c.moveTo(sx, sy - ts*.55 + b); c.lineTo(sx - ts*.22, sy - ts*.95 + b); c.lineTo(sx + ts*.22, sy - ts*.95 + b); c.closePath(); c.fill();
      }
    } else {
      const cx = R.VW/2, cy = R.VH/2, dx = sx - cx, dy = sy - cy;
      const k = Math.min((R.VW/2 - 46) / Math.max(1e-6, Math.abs(dx)), (R.VH/2 - 46) / Math.max(1e-6, Math.abs(dy)));
      const ax = cx + dx*k, ay = cy + dy*k, ang = Math.atan2(dy, dx), pulse = 1 + .08*Math.sin(t/250);
      c.translate(ax, ay); c.fillStyle = 'rgba(10,14,19,.85)'; c.beginPath(); c.arc(0, 0, 18*pulse, 0, Math.PI*2); c.fill();
      c.strokeStyle = h.color; c.lineWidth = 2; c.stroke(); c.rotate(ang); c.fillStyle = h.color;
      c.beginPath(); c.moveTo(11, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8); c.closePath(); c.fill();
      c.setTransform(R.dpr,0,0,R.dpr,0,0);
      const lx = ax - Math.cos(ang)*58, ly = ay - Math.sin(ang)*30;
      pill(Math.max(60, Math.min(R.VW - 60, lx)), Math.max(16, Math.min(R.VH - 16, ly)), h.label);
    }
    c.restore();
  });
}
function drawNameFlag(c, r, a, ts){
  const cx = (a.px-R.cam.x+.5)*ts, top = (a.py-R.cam.y)*ts - (r.job === 'heli' ? ts*.25 : 0), col = MR.colorHex(r.color);
  const label = ts >= 22 ? r.name : r.name.slice(0,1).toUpperCase();
  c.font = `600 ${Math.max(10, Math.min(14, Math.round(ts*.34)))}px 'IBM Plex Sans', system-ui, sans-serif`;
  const w = c.measureText(label).width + 10, h = Math.max(15, Math.min(20, ts*.48)), y = top - h - 2;
  c.fillStyle = 'rgba(10,14,19,0.75)'; rr(c, cx - w/2 + 1, y + 1.5, w, h, h/2); c.fill();
  c.fillStyle = col; rr(c, cx - w/2, y, w, h, h/2); c.fill();
  if (r.pid === R.myPid) { c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; rr(c, cx - w/2, y, w, h, h/2); c.stroke(); }
  c.fillStyle = '#0b1015'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cx, y + h/2 + .5);
  if (r.stuck) { c.fillStyle = '#ff7b6c'; c.font = `700 ${Math.round(Math.max(10, ts*.28))}px 'IBM Plex Mono', monospace`; c.fillText('STUCK', cx, (a.py-R.cam.y+1.05)*ts); }
}
function drawFx(c, t, ts){
  R.fx = R.fx.filter(f => t - f.t0 < f.dur);
  R.fx.forEach(f => {
    const k = Math.max(0,(t-f.t0)/f.dur), cx = (f.x-R.cam.x+.5)*ts, cy = (f.y-R.cam.y+.5)*ts;
    if (f.type === 'hazard') { const a = .5+.5*Math.sin(k*Math.PI*6); c.strokeStyle=`rgba(255,123,108,${.4+.6*a})`; c.lineWidth=ts*.08; c.strokeRect(cx-ts*.44, cy-ts*.44, ts*.88, ts*.88); }
    else if (f.type === 'ring') { c.strokeStyle=`rgba(88,207,190,${1-k})`; c.lineWidth=ts*.08; c.beginPath(); c.arc(cx,cy,k*f.r*ts,0,Math.PI*2); c.stroke(); c.fillStyle=`rgba(88,207,190,${(1-k)*.08})`; c.fill(); }
    else if (f.type === 'beam') { const o = Math.sin(k*20)*ts*.2; c.strokeStyle=`rgba(255,90,90,${Math.sin(k*Math.PI)})`; c.lineWidth=ts*.04; c.beginPath(); c.moveTo(cx, cy-ts*.5); c.lineTo(cx+o, cy); c.stroke(); }
    else if (f.type === 'dust' || f.type === 'confetti') {
      f.parts.forEach(p => { c.fillStyle = f.type === 'dust' ? `rgba(236,190,150,${(1-k)*.8})` : p.c; c.globalAlpha = f.type === 'confetti' ? 1-k : 1;
        c.beginPath(); c.arc(cx+Math.cos(p.a)*p.v*k*ts, cy+Math.sin(p.a)*p.v*k*ts + (f.type==='confetti'?k*k*ts*.8:0), p.s*ts, 0, Math.PI*2); c.fill(); });
      c.globalAlpha = 1;
    } else if (f.type === 'sun') { const g = c.createRadialGradient(cx,cy,ts*.1,cx,cy,ts*1.4); g.addColorStop(0,`rgba(255,230,140,${.55*Math.sin(k*Math.PI)})`); g.addColorStop(1,'rgba(255,230,140,0)'); c.fillStyle=g; c.fillRect(cx-ts*1.5,cy-ts*1.5,ts*3,ts*3); }
  });
}
MR.dustParts = () => [...Array(16)].map(() => ({a:Math.random()*Math.PI*2, v:.25+Math.random()*.45, s:.03+Math.random()*.04}));
MR.confetti = () => { const cols = ['#58cfbe','#f0bf5a','#b48ce8','#86d48f','#7fb2ff','#ff7b6c']; return [...Array(30)].map(() => ({a:Math.random()*Math.PI*2, v:.6+Math.random()*1.1, s:.05+Math.random()*.05, c:cols[Math.floor(Math.random()*cols.length)]})); };

R.frame = t => {
  requestAnimationFrame(R.frame);
  if (!R.view || !R.terrain || R.canvas.offsetParent === null) return;
  const c = R.ctx, cam = R.cam, me = R.anim[R.myPid];
  if (cam.follow && me) { const [vw,vh] = R.viewTiles(); cam.x += (me.px+.5-vw/2-cam.x)*.12; cam.y += (me.py+.5-vh/2-cam.y)*.12; }
  R.clamp();
  const ts = cam.ts, [vw,vh] = R.viewTiles(), W = R.view.world;
  c.setTransform(R.dpr,0,0,R.dpr,0,0); c.imageSmoothingEnabled = true;
  c.drawImage(R.terrain, cam.x*BASE, cam.y*BASE, vw*BASE, vh*BASE, 0, 0, R.VW, R.VH);
  const x0 = Math.max(0, Math.floor(cam.x)), y0 = Math.max(0, Math.floor(cam.y)), x1 = Math.min(MW-1, Math.ceil(cam.x+vw)), y1 = Math.min(MH-1, Math.ceil(cam.y+vh));
  if (ts >= 22) { c.strokeStyle='rgba(255,230,210,0.07)'; c.lineWidth=1; c.beginPath();
    for (let x=x0;x<=x1+1;x++){ const X = Math.round((x-cam.x)*ts)+.5; c.moveTo(X,0); c.lineTo(X,R.VH); }
    for (let y=y0;y<=y1+1;y++){ const Y = Math.round((y-cam.y)*ts)+.5; c.moveTo(0,Y); c.lineTo(R.VW,Y); } c.stroke(); }
  drawStation(c, t, ts);
  c.lineCap='round'; c.strokeStyle='rgba(70,25,12,0.38)'; c.lineWidth=ts*.09; c.setLineDash([ts*.07,ts*.06]);
  R.tracks.forEach(([ax,ay,bx,by]) => {
    if (Math.max(ax,bx) < x0-1 || Math.min(ax,bx) > x1+1 || Math.max(ay,by) < y0-1 || Math.min(ay,by) > y1+1) return;
    const dx=bx-ax, dy=by-ay, ox=-dy*.28*ts, oy=dx*.28*ts;
    [[ox,oy],[-ox,-oy]].forEach(([a,b]) => { c.beginPath(); c.moveTo((ax-cam.x+.5)*ts+a,(ay-cam.y+.5)*ts+b); c.lineTo((bx-cam.x+.5)*ts+a,(by-cam.y+.5)*ts+b); c.stroke(); });
  });
  c.setLineDash([]); c.lineCap='butt';
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) {
    const i = y*MW+x; if (!W.seen[i]) continue;
    if (W.obs[i] === 'R' && W.rocks[i]) W.rocks[i].forEach(s => drawRock(c, (x-cam.x+s.x)*ts, (y-cam.y+s.y)*ts, s.rad*ts, s.pts, s.shade));
    if (W.trapSeen[i]) drawTrap(c, i, ts);
    if (W.res[i]) { drawMarker(c, i, t, ts); const site = R.view.sites && R.view.sites[i]; if (site && W.sig[i] && !W.drilled[i] && !W.kid[i]) drawFlag(c, i, site, ts); }
  }
  // drafts of teammates (dashed) and my own path (footprints)
  Object.entries(R.drafts).forEach(([pid, path]) => {
    const r = R.view.rovers.find(q => q.pid === pid), a = R.anim[pid]; if (!r || !a || !path || !path.length || pid === R.myPid) return;
    c.strokeStyle = MR.colorHex(r.color); c.globalAlpha = .75; c.lineWidth = Math.max(2, ts*.08); c.setLineDash([ts*.18, ts*.12]);
    c.beginPath(); c.moveTo((a.px-cam.x+.5)*ts, (a.py-cam.y+.5)*ts); path.forEach(p => c.lineTo((p[0]-cam.x+.5)*ts, (p[1]-cam.y+.5)*ts)); c.stroke();
    c.setLineDash([]); c.globalAlpha = 1;
  });
  const mine = R.myRover();
  if (mine && R.ghost.length && !R.running) {
    const col = MR.colorHex(mine.color);
    R.ghost.forEach((p, k) => { const px = (p[0]-cam.x+.5)*ts, py = (p[1]-cam.y+.5)*ts;
      c.fillStyle = col; c.globalAlpha = .55 + .35*Math.sin(t/250 - k*.6);
      if (R.myRole === 'cadet') { c.beginPath(); c.ellipse(px-ts*.1, py, ts*.07, ts*.11, 0, 0, Math.PI*2); c.ellipse(px+ts*.1, py+ts*.06, ts*.07, ts*.11, 0, 0, Math.PI*2); c.fill(); }
      else { c.beginPath(); c.arc(px, py, ts*.09, 0, Math.PI*2); c.fill(); } });
    c.globalAlpha = 1;
    const last = R.ghost[R.ghost.length-1]; drawRover(c, mine, {px:last[0], py:last[1], ang:last[2]*90}, t, ts, true);
  }
  drawFx(c, t, ts);
  const rovers = R.view.rovers.slice().sort((p, q) => (p.job === 'heli') - (q.job === 'heli') || (p.pid === R.myPid) - (q.pid === R.myPid));
  rovers.forEach(r => { const a = R.anim[r.pid]; if (a) drawRover(c, r, a, t, ts, false); });
  c.fillStyle='rgba(16,11,9,0.62)';
  for (let y=y0;y<=y1;y++) for (let x=x0;x<=x1;x++) if (!W.seen[y*MW+x]) c.fillRect(Math.floor((x-cam.x)*ts), Math.floor((y-cam.y)*ts), Math.ceil(ts)+1, Math.ceil(ts)+1);
  (R.markers || []).forEach(m => { const x = (m.x - cam.x + .5)*ts, y = (m.y - cam.y + .5)*ts; if (x < -40 || y < -40 || x > R.VW + 40 || y > R.VH + 40) return;
    const col = MR.colorHex(m.color), icon = {dig:'⛏', danger:'⚠', meet:'★'}[m.kind], rad = Math.max(10, ts*.32);
    c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - rad*1.6); c.stroke();
    c.fillStyle = 'rgba(10,14,19,.9)'; c.beginPath(); c.arc(x, y - rad*1.6 - rad*.4, rad, 0, Math.PI*2); c.fill(); c.lineWidth = 2.5; c.stroke();
    c.fillStyle = m.kind === 'danger' ? '#ff7b6c' : '#f0bf5a'; c.font = `${Math.round(rad*1.15)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(icon, x, y - rad*2 + 1); });
  if (!R.running) drawHints(c, t, ts);
  if (MR.MAPS[R.view.map].airless) {   // Earth hanging in the black sky
    const ex = R.VW - 96, ey = 66, er = 20, g2 = c.createRadialGradient(ex - 6, ey - 6, 2, ex, ey, er);
    g2.addColorStop(0, '#9fd0ff'); g2.addColorStop(.7, '#2f6fbf'); g2.addColorStop(1, '#173a6b');
    c.fillStyle = 'rgba(0,0,0,.6)'; c.beginPath(); c.arc(ex, ey, er + 10, 0, Math.PI*2); c.fill();
    c.fillStyle = g2; c.beginPath(); c.arc(ex, ey, er, 0, Math.PI*2); c.fill();
    c.fillStyle = 'rgba(96,170,90,.85)'; c.beginPath(); c.ellipse(ex - 5, ey + 2, 7, 5, .5, 0, Math.PI*2); c.fill(); c.beginPath(); c.ellipse(ex + 7, ey - 6, 4, 3, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(ex + 3, ey + 9, 9, 2.5, -.2, 0, Math.PI*2); c.fill();
    c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(ex + 8, ey, er, -Math.PI/2, Math.PI/2); c.fill();
    c.font = `600 10px 'IBM Plex Mono', monospace`; c.textAlign = 'center'; c.fillStyle = 'rgba(230,236,241,.8)'; c.fillText('EARTH', ex, ey + er + 14);
  }
  if (R.view.wx && R.view.wx.storm) {   // dusty haze and blowing streaks during a storm
    c.fillStyle = 'rgba(196,120,70,0.28)'; c.fillRect(0, 0, R.VW, R.VH);
    c.strokeStyle = 'rgba(240,190,150,0.22)'; c.lineWidth = 1.5;
    for (let k = 0; k < 60; k++) { const x = ((k*97 + t*.25) % (R.VW + 200)) - 100, y = (k*53) % R.VH; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 60, y + 8); c.stroke(); }
  }
  rovers.forEach(r => { const a = R.anim[r.pid]; if (a) drawNameFlag(c, r, a, ts); });
  c.font = `600 ${Math.max(11, Math.round(ts*.42))}px 'Chakra Petch', sans-serif`; c.textAlign='center'; c.textBaseline='middle';
  MR.MAPS[R.view.map].labels.forEach(l => { const X=(l.x-cam.x)*ts, Y=(l.y-cam.y)*ts; if (X<-200||X>R.VW+200||Y<-40||Y>R.VH+40) return;
    c.fillStyle='rgba(20,8,4,0.55)'; c.fillText(l.t, X+1, Y+1.5); c.fillStyle='rgba(255,240,225,0.78)'; c.fillText(l.t, X, Y); });
  // minimap
  const m = R.mctx, mw = R.mini.width, mh = R.mini.height, sx = mw/MW, sy = mh/MH;
  m.setTransform(1,0,0,1,0,0); m.drawImage(R.miniImg, 0, 0, mw, mh);
  m.fillStyle='rgba(16,11,9,0.4)'; for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) if (!W.seen[y*MW+x]) m.fillRect(x*sx, y*sy, sx+.6, sy+.6);
  const S = MR.MAPS[R.view.map].station; m.fillStyle='#e6ecf1'; m.fillRect(S.x*sx, S.y*sy, 2*sx, 2*sy);
  for (let i=0;i<W.res.length;i++) if (W.sig[i] && !W.drilled[i] && W.res[i] && !MR.CARDS[W.res[i]].artifact) { m.fillStyle = W.known[i] ? MR.CARDS[W.res[i]].color : '#f0bf5a'; m.fillRect((i%MW)*sx, ((i/MW)|0)*sy, Math.max(2,sx), Math.max(2,sy)); }
  m.strokeStyle='rgba(255,255,255,0.85)'; m.lineWidth=1; m.strokeRect(cam.x*sx+.5, cam.y*sy+.5, vw*sx-1, vh*sy-1);
  R.view.rovers.forEach(r => { const a = R.anim[r.pid]; if (!a) return; const big = r.pid === R.myPid ? 3.5 + Math.sin(t/200) : 3;
    m.fillStyle = MR.colorHex(r.color); m.beginPath(); m.arc((a.px+.5)*sx, (a.py+.5)*sy, big*R.dpr*.8, 0, Math.PI*2); m.fill();
    m.strokeStyle='#0b1015'; m.lineWidth=1; m.stroke(); });
};
})();
