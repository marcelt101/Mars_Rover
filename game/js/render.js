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
  } else if (innerWidth <= 760 && document.body.classList.contains('ui-phone')) R.VH = Math.round(Math.max(260, Math.min(520, innerHeight*.42)));
  else R.VH = Math.round(Math.max(300, Math.min(640, R.VW*.62)));
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
/* A Navcam-style photo: a crop of the map around a rover, with a caption strip. Returns a small JPEG. */
R.snapshot = (pid, label) => { const a = R.anim[pid], cv = R.canvas; if (!a || !cv) return null;
  const k = cv.width / Math.max(1, cv.getBoundingClientRect().width), ts = R.cam.ts * k, cx = (a.px + .5 - R.cam.x) * ts, cy = (a.py + .5 - R.cam.y) * ts, w = 7.5 * ts, h = 5 * ts;
  const out = document.createElement('canvas'); out.width = 240; out.height = 160; const g = out.getContext('2d');
  g.fillStyle = '#1a0d08'; g.fillRect(0, 0, 240, 160); g.drawImage(cv, cx - w/2, cy - h/2, w, h, 0, 0, 240, 160);
  const v = g.createRadialGradient(120, 80, 50, 120, 80, 150); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = v; g.fillRect(0, 0, 240, 160);
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 142, 240, 18); g.fillStyle = '#e6ecf1'; g.font = '10px monospace'; g.fillText(label, 6, 155);
  try { return out.toDataURL('image/jpeg', .72); } catch (e) { return null; } };
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
/* Perseverance-style rover seen from above, front at the top. Modeled on NASA's top views: a white body (the
   "warm electronics box"), six aluminum wheels on a dark titanium rocker-bogie, the finned power unit (MMRTG)
   sticking out at the back, the hexagonal high-gain antenna, the camera mast on the front right and the robotic
   arm folded across the front. The player's color is a stripe along each side of the deck and the pennant. */
const WHEEL_Y = [-.36, 0, .36], WHEEL_X = .4;
function metalWheel(c, x, y, w, h, lod, steer, dark){
  const g = c.createLinearGradient(x - w/2, 0, x + w/2, 0);
  if (dark) { g.addColorStop(0, '#3b4047'); g.addColorStop(.25, '#6a7178'); g.addColorStop(.75, '#5f666d'); g.addColorStop(1, '#353a40'); }
  else { g.addColorStop(0, '#80878f'); g.addColorStop(.2, '#b3b9bf'); g.addColorStop(.8, '#a9afb5'); g.addColorStop(1, '#757c84'); }
  c.fillStyle = g; rr(c, x - w/2, y - h/2, w, h, Math.min(w, h)*.12); c.fill();
  c.strokeStyle = '#4a5057'; c.lineWidth = Math.max(.6, w*.06); c.stroke();
  if (lod >= 2) { /* curved grousers across the tread, like the real wheels */
    c.strokeStyle = dark ? 'rgba(150,158,166,.55)' : 'rgba(70,76,83,.7)'; c.lineWidth = Math.max(.5, w*.05);
    for (let k = 1; k < 9; k++) { const yy = y - h/2 + k*h/9; c.beginPath(); c.moveTo(x - w/2 + w*.06, yy); c.quadraticCurveTo(x, yy + h*.035, x + w/2 - w*.06, yy); c.stroke(); } }
  else if (lod >= 1) { c.fillStyle = 'rgba(70,76,83,.45)'; c.fillRect(x - w/2 + w*.15, y - h*.04, w*.7, h*.08); }
  if (steer && lod >= 1) { c.fillStyle = '#2b2f34'; c.beginPath(); c.arc(x + (x > 0 ? -1 : 1)*w*.62, y, w*.26, 0, Math.PI*2); c.fill(); }
}
function roverShadow(c, r, s){
  c.fillStyle = 'rgba(30,10,3,.34)';
  if (r.job === 'scout' || r.job === 'hauler') { merPath(c, s); c.fill(); [[-.41], [.41]].forEach(([y]) => [-1, 1].forEach(sd => { rr(c, sd*.36*s - .08*s, y*s - .11*s, .16*s, .22*s, .04*s); c.fill(); })); return; }
  rr(c, -.3*s, -.32*s, .6*s, .62*s, .05*s); c.fill();
  WHEEL_Y.forEach(y => [-1, 1].forEach(sd => { rr(c, sd*WHEEL_X*s - .09*s, y*s - .12*s, .18*s, .24*s, .04*s); c.fill(); }));
  rr(c, .06*s, -.42*s, .22*s, .12*s, .03*s); c.fill();
  rr(c, -.08*s, .24*s, .16*s, .24*s, .04*s); c.fill();
}
/* Spirit / Opportunity (Mars Exploration Rover) seen from above, front at the top, from NASA's pictures: the big
   dark winged solar array covers the body, the wheels peek out under it, the Pancam mast with its wide camera bar
   and gold collar stands at the front, the round high-gain dish sits at the back right, and the low-gain antenna
   is a thin black pole. The player's color is the rim of the solar array and the pennant. */
/* The solar array is six separate panels like the real one: the deck over the body, two front wings, two back
   wings and the tail. MER_OUTLINE is their outer edge (for the colored rim and the shadow). */
const MER_PANELS = [
  [[-.22,-.33],[.22,-.33],[.22,.2],[-.22,.2]],
  [[-.245,-.31],[-.53,-.19],[-.53,.065],[-.245,.065]], [[.245,-.31],[.53,-.19],[.53,.065],[.245,.065]],
  [[-.245,.09],[-.52,.09],[-.35,.33],[-.245,.33]], [[.245,.09],[.52,.09],[.35,.33],[.245,.33]],
  [[-.2,.225],[.2,.225],[.12,.44],[-.12,.44]]];
const MER_OUTLINE = [[-.22,-.33],[.22,-.33],[.245,-.31],[.53,-.19],[.53,.09],[.35,.33],[.2,.33],[.12,.44],[-.12,.44],[-.2,.33],[-.35,.33],[-.53,.09],[-.53,-.19],[-.245,-.31]];
const poly = (c, pts, s, k = 1, ox = 0, oy = 0) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo((x*k + ox)*s, (y*k + oy)*s) : c.moveTo((x*k + ox)*s, (y*k + oy)*s)); c.closePath(); };
const merPath = (c, s) => poly(c, MER_OUTLINE, s);
/* A tall mast casts a long shadow; drawn on the ground before the rover, offset further than the body shadow. */
function mastShadow(c, r, s, dx, dy){
  const mer = r.job === 'scout' || r.job === 'hauler', mx = (mer ? .1 : .16)*s, my = (mer ? -.22 : -.21)*s, up = (r.job === 'scout' ? .1 : .08)*s;
  c.strokeStyle = 'rgba(20,8,3,.22)'; c.lineWidth = s*.04; c.lineCap = 'round'; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + dx, my - up + dy); c.stroke(); c.lineCap = 'butt';
  c.fillStyle = 'rgba(20,8,3,.24)'; rr(c, mx + dx - (mer ? .18 : .1)*s, my - up + dy - .06*s, (mer ? .36 : .2)*s, .11*s, .02*s); c.fill();
}
function drawMER(c, r, a, t, s, lod){
  const col = MR.colorHex(r.color), P = k => (r.perks || []).includes(k);
  const ww = (P('wide_wheels') ? .17 : .13)*s, wh = .2*s;
  // rocker-bogie and the six wheels (front and back wheels stick out past the array)
  c.strokeStyle = '#2c3035'; c.lineWidth = s*.045; c.lineCap = 'round';
  [-1, 1].forEach(sd => { c.beginPath(); c.moveTo(sd*.36*s, -.4*s); c.lineTo(sd*.34*s, -.05*s); c.lineTo(sd*.4*s, .02*s); c.moveTo(sd*.34*s, -.05*s); c.lineTo(sd*.36*s, .4*s); c.stroke(); });
  c.lineCap = 'butt';
  [[-.41], [.02], [.41]].forEach(([y], i) => [-1, 1].forEach(sd => metalWheel(c, sd*(i === 1 ? .43 : .36)*s, y*s, ww, wh, lod, i !== 1)));
  // the arm (IDD) tucked under the front, with its instrument turret
  c.strokeStyle = '#5a6067'; c.lineWidth = s*.045; c.beginPath(); c.moveTo(.12*s, -.32*s); c.lineTo(-.08*s, -.43*s); c.stroke();
  c.strokeStyle = '#d5d8dc'; c.lineWidth = s*.026; c.beginPath(); c.moveTo(.12*s, -.32*s); c.lineTo(-.08*s, -.43*s); c.stroke();
  c.fillStyle = '#4a5057'; c.beginPath(); c.arc(-.11*s, -.44*s, s*.055, 0, Math.PI*2); c.fill();
  if (lod >= 1) { c.fillStyle = '#b9bec4'; c.beginPath(); c.arc(-.11*s, -.44*s, s*.032, 0, Math.PI*2); c.fill(); c.fillStyle = '#e2c06a'; c.fillRect(-.16*s, -.46*s, .03*s, .04*s); }
  if (a.busy === 'drill') { c.strokeStyle = '#f0bf5a'; c.lineWidth = s*.04; c.beginPath(); c.arc(-.11*s, -.44*s, s*.09, t/60, t/60 + 4); c.stroke(); }
  // colored rim around the whole array, then each panel in its own silver frame
  c.strokeStyle = col; c.lineWidth = s*.032; c.lineJoin = 'round'; merPath(c, s); c.stroke(); c.lineJoin = 'miter';
  const tints = [['#2a3240', '#161c26'], ['#3a4658', '#1b222d'], ['#252c38', '#151a22'], ['#232a35', '#141921'], ['#34404f', '#19202a'], ['#282f3b', '#151a22']];
  MER_PANELS.forEach((pts, i) => {
    const xs = pts.map(p2 => p2[0]), ys = pts.map(p2 => p2[1]);
    const g = c.createLinearGradient(Math.min(...xs)*s, Math.min(...ys)*s, Math.max(...xs)*s, Math.max(...ys)*s); g.addColorStop(0, tints[i][0]); g.addColorStop(1, tints[i][1]);
    c.fillStyle = '#b4bac1'; poly(c, pts, s); c.fill();
    const cx = xs.reduce((q, v) => q + v, 0)/xs.length, cy = ys.reduce((q, v) => q + v, 0)/ys.length;
    c.fillStyle = g; poly(c, pts, s, .9, cx*.1, cy*.1); c.fill();
    if (lod >= 2) { c.save(); poly(c, pts, s, .9, cx*.1, cy*.1); c.clip(); c.strokeStyle = 'rgba(160,176,198,.22)'; c.lineWidth = Math.max(.5, s*.005);
      for (let k = -14; k <= 14; k++) { c.beginPath(); c.moveTo(k*.038*s, -.45*s); c.lineTo(k*.038*s, .46*s); c.stroke(); }
      for (let k = -12; k <= 12; k++) { c.beginPath(); c.moveTo(-.55*s, k*.038*s); c.lineTo(.55*s, k*.038*s); c.stroke(); }
      if (i === 1 || i === 4) { c.fillStyle = 'rgba(255,240,220,.10)'; c.fillRect(-.6*s, -.5*s, 1.2*s, 1*s); }
      c.restore(); }
  });
  if (lod >= 1) { // hinges between the deck and the wings
    c.fillStyle = '#d5d9dd'; [[-.233,-.2],[.233,-.2],[-.233,-.02],[.233,-.02],[-.233,.21],[.233,.21],[-.09,.212],[.09,.212]].forEach(([x, y]) => { c.fillRect(x*s - .012*s, y*s - .012*s, .024*s, .024*s); });
    // equipment on the deck: the warm electronics box lid and the calibration sundial
    c.fillStyle = '#6b665e'; rr(c, -.1*s, -.1*s, .2*s, .2*s, .02*s); c.fill();
    c.strokeStyle = 'rgba(226,192,106,.7)'; c.lineWidth = s*.008; c.stroke();
    if (lod >= 2) { c.strokeStyle = 'rgba(30,32,36,.5)'; c.lineWidth = s*.006; c.beginPath(); c.moveTo(-.1*s, 0); c.lineTo(.1*s, 0); c.moveTo(0, -.1*s); c.lineTo(0, .1*s); c.stroke(); }
    c.fillStyle = '#c9ced4'; c.beginPath(); c.arc(.05*s, .05*s, s*.026, 0, Math.PI*2); c.fill(); c.fillStyle = '#2a2e33'; c.fillRect(.047*s, .01*s, .006*s, .04*s);
    if (P('big_battery')) { c.fillStyle = '#3d4a42'; rr(c, -.4*s, -.1*s, .12*s, .055*s, .01*s); c.fill(); c.fillStyle = '#86d48f'; c.fillRect(-.385*s, -.08*s, .08*s, .015*s); }
    if (r.job === 'hauler') { c.fillStyle = '#3a3f45'; rr(c, -.13*s, .27*s, .26*s, .1*s, .015*s); c.fill();
      for (let k = 0; k < 8; k++) { const id = (r.tubes || [])[k]; c.fillStyle = id ? MR.CARDS[id].color : '#9aa1a8'; rr(c, -.115*s + k*.03*s, .285*s, .02*s, .07*s, .006*s); c.fill(); } }
  }
  // high-gain antenna: a round dish on a gimbal at the back right (gold and bigger when upgraded)
  const hga = P('hg_antenna'), hr = (hga ? .12 : .095)*s, hx = .3*s, hy = .14*s;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(hx + s*.03, hy + s*.035, hr, 0, Math.PI*2); c.fill();
  c.fillStyle = '#8e959c'; c.fillRect(hx - .015*s, hy, .03*s, .08*s);
  const dg = c.createRadialGradient(hx - hr*.3, hy - hr*.3, hr*.1, hx, hy, hr); dg.addColorStop(0, hga ? '#f3dc98' : '#c4b196'); dg.addColorStop(1, hga ? '#a8812f' : '#7a6a58');
  c.fillStyle = dg; c.beginPath(); c.arc(hx, hy, hr, 0, Math.PI*2); c.fill();
  if (lod >= 1) { c.strokeStyle = hga ? '#8a6a24' : '#5e5244'; c.lineWidth = Math.max(.5, s*.01); c.stroke(); c.beginPath(); c.arc(hx, hy, hr*.55, 0, Math.PI*2); c.stroke(); }
  // low-gain antenna pole (taller Better radio) with the team pennant
  const L = (P('better_radio') ? .18 : .12)*s, lx = -.22*s, ly = .2*s;
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = s*.02; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + L*.5, ly + L*.6); c.stroke();
  c.fillStyle = '#15181c'; c.beginPath(); c.arc(lx, ly, s*.024, 0, Math.PI*2); c.fill();
  c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.moveTo(lx + .02*s, ly + .03*s); c.lineTo(lx - .14*s, ly + .1*s); c.lineTo(lx + .01*s, ly + .13*s); c.closePath(); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx - .16*s, ly + .06*s); c.lineTo(lx - .01*s, ly + .1*s); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = Math.max(.5, s*.006); c.stroke();
  // Pancam mast: gold collar, white mast, and the head seen a little from the front so its "face" shows:
  // the two Pancam eyes at the ends and the two Navcams in the middle. The Scout's mast stands a bit taller.
  const mx = .1*s, my = -.22*s, up = (r.job === 'scout' ? .1 : .075)*s, sc = P('supercam');
  c.fillStyle = '#b08a3e'; c.beginPath(); c.arc(mx, my, s*.05, 0, Math.PI*2); c.fill();
  if (lod >= 1) { c.strokeStyle = '#7d6229'; c.lineWidth = s*.01; c.stroke(); }
  c.strokeStyle = '#e1e4e7'; c.lineWidth = s*.045; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx, my - up); c.stroke();
  c.save(); c.translate(mx, my - up);
  const hw2 = .36*s, top = .07*s, face = .05*s;
  const tg = c.createLinearGradient(0, -top, 0, 0); tg.addColorStop(0, '#eef0f2'); tg.addColorStop(1, '#b3b9bf');
  c.fillStyle = tg; rr(c, -hw2/2, -top*.5, hw2, top, s*.012); c.fill();
  c.fillStyle = '#5a6067'; rr(c, -hw2/2, -top*.5 - face, hw2, face + s*.01, s*.012); c.fill();
  c.strokeStyle = '#3a3f45'; c.lineWidth = Math.max(.5, s*.008); rr(c, -hw2/2, -top*.5 - face, hw2, face + top, s*.012); c.stroke();
  if (lod >= 1) {
    const ey = -top*.5 - face*.5;
    [-1, 1].forEach(sd => { // Pancam eyes
      c.fillStyle = '#d5d9dd'; c.beginPath(); c.arc(sd*hw2*.38, ey, s*.03, 0, Math.PI*2); c.fill();
      c.fillStyle = '#0d1116'; c.beginPath(); c.arc(sd*hw2*.38, ey, s*.021, 0, Math.PI*2); c.fill();
      if (lod >= 2) { c.fillStyle = 'rgba(140,190,255,.8)'; c.beginPath(); c.arc(sd*hw2*.38 - s*.007, ey - s*.007, s*.006, 0, Math.PI*2); c.fill(); }
      c.fillStyle = '#0d1116'; c.beginPath(); c.arc(sd*hw2*.13, ey, s*.012, 0, Math.PI*2); c.fill(); }); // Navcams
    if (sc) { c.fillStyle = '#ff5a4f'; c.beginPath(); c.arc(0, ey, s*.016, 0, Math.PI*2); c.fill(); }
    if (P('sharp_eyes') && lod >= 2) { c.fillStyle = '#0d1116'; [-1, 1].forEach(sd => { c.beginPath(); c.arc(sd*hw2*.25, s*.005, s*.009, 0, Math.PI*2); c.fill(); }); }
  }
  c.restore();
}
function drawGroundRover(c, r, a, t, s, lod){
  if (r.job === 'scout' || r.job === 'hauler') return drawMER(c, r, a, t, s, lod);
  const col = MR.colorHex(r.color), P = k => (r.perks || []).includes(k), sci = r.job === 'science';
  const ww = (P('wide_wheels') ? .19 : .14)*s, wh = .22*s;
  // rocker-bogie suspension (dark titanium tubes)
  c.lineCap = 'round'; c.lineJoin = 'round';
  [-1, 1].forEach(sd => { const X = sd*WHEEL_X*s;
    c.strokeStyle = '#2c3035'; c.lineWidth = s*.05;
    c.beginPath(); c.moveTo(X, WHEEL_Y[0]*s); c.lineTo(sd*.33*s, -.12*s); c.lineTo(sd*.37*s, .17*s); c.stroke();
    c.beginPath(); c.moveTo(X, 0); c.lineTo(sd*.37*s, .17*s); c.lineTo(X, WHEEL_Y[2]*s); c.stroke();
    if (lod >= 1) { c.strokeStyle = 'rgba(150,158,166,.5)'; c.lineWidth = s*.014;
      c.beginPath(); c.moveTo(X, WHEEL_Y[0]*s); c.lineTo(sd*.33*s, -.12*s); c.lineTo(sd*.37*s, .17*s); c.lineTo(X, WHEEL_Y[2]*s); c.stroke();
      c.fillStyle = '#4a5057'; [[.33, -.12], [.37, .17]].forEach(([px, py]) => { c.beginPath(); c.arc(sd*px*s, py*s, s*.032, 0, Math.PI*2); c.fill(); }); } });
  WHEEL_Y.forEach((y, i) => [-1, 1].forEach(sd => metalWheel(c, sd*WHEEL_X*s, y*s, ww, wh, lod, i !== 1, true)));
  // power unit (MMRTG) at the back: dark core with cooling fins
  c.save(); c.translate(0, .36*s);
  c.fillStyle = '#2a2e33'; rr(c, -.05*s, -.12*s, .1*s, .24*s, .03*s); c.fill();
  if (lod >= 1) { c.strokeStyle = '#7c838b'; c.lineWidth = s*.016;
    for (let k = -2; k <= 2; k++) { const y = k*.045*s; c.beginPath(); c.moveTo(-.11*s, y); c.lineTo(.11*s, y); c.stroke(); }
    c.fillStyle = '#3a3f45'; rr(c, -.05*s, -.12*s, .1*s, .24*s, .03*s); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(-.035*s, -.11*s, .02*s, .22*s); }
  c.restore();
  if (r.job === 'excavator') { // dozer blade on short arms
    c.strokeStyle = '#4a5057'; c.lineWidth = s*.04; c.beginPath(); c.moveTo(-.16*s, -.3*s); c.lineTo(-.18*s, -.5*s); c.moveTo(.16*s, -.3*s); c.lineTo(.18*s, -.5*s); c.stroke();
    const bg = c.createLinearGradient(0, -.62*s, 0, -.5*s); bg.addColorStop(0, '#d3d7db'); bg.addColorStop(1, '#8a9097');
    c.fillStyle = bg; rr(c, -.34*s, -.62*s, .68*s, .12*s, .025*s); c.fill(); c.strokeStyle = '#4a5057'; c.lineWidth = s*.012; c.stroke();
    if (lod >= 1) { c.fillStyle = col; c.fillRect(-.3*s, -.535*s, .6*s, .025*s); } }
  // body: white box with a slightly darker rim (its sides), deck panels and a little gold foil
  const bx = -.27*s, by = -.3*s, bw = .54*s, bh = .56*s;
  c.fillStyle = '#9ea4ab'; rr(c, bx, by, bw, bh, .035*s); c.fill();
  const g = c.createLinearGradient(bx, by, bx + bw, by + bh); g.addColorStop(0, '#f3f4f5'); g.addColorStop(1, '#c9cdd2');
  c.fillStyle = g; rr(c, bx + .025*s, by + .025*s, bw - .05*s, bh - .05*s, .025*s); c.fill();
  c.fillStyle = col; c.fillRect(bx + .028*s, by + .06*s, .03*s, bh - .12*s); c.fillRect(bx + bw - .058*s, by + .06*s, .03*s, bh - .12*s);
  if (lod >= 1) {
    c.strokeStyle = 'rgba(90,98,108,.35)'; c.lineWidth = Math.max(.5, s*.008);
    c.beginPath(); c.moveTo(bx + .07*s, -.02*s); c.lineTo(bx + bw - .07*s, -.02*s); c.moveTo(0, -.02*s); c.lineTo(0, by + bh - .04*s); c.stroke();
    c.fillStyle = 'rgba(120,128,138,.18)'; c.fillRect(bx + .03*s, .02*s, bw - .06*s, by + bh - .045*s - .02*s);
    const gold = c.createLinearGradient(.02*s, -.2*s, .14*s, -.08*s); gold.addColorStop(0, '#e2c06a'); gold.addColorStop(1, '#a8812f');
    c.fillStyle = gold; rr(c, -.04*s, -.25*s, .13*s, .08*s, .01*s); c.fill();
    c.fillStyle = '#30353b'; rr(c, .03*s, .05*s, .09*s, .06*s, .008*s); c.fill();
    c.fillStyle = '#5d646c'; rr(c, .03*s, .14*s, .14*s, .035*s, .008*s); c.fill();
    if (lod >= 2) { c.fillStyle = '#9aa1a8'; [[-.2, -.24], [.2, -.03], [-.03, .2]].forEach(([qx, qy]) => { c.beginPath(); c.arc(qx*s, qy*s, s*.012, 0, Math.PI*2); c.fill(); });
      c.strokeStyle = 'rgba(60,66,72,.45)'; c.lineWidth = s*.006; c.beginPath(); c.moveTo(-.2*s, -.06*s); c.quadraticCurveTo(-.05*s, .0, .03*s, .08*s); c.stroke(); }
    // copper-colored cable harnesses, like on the real deck
    c.strokeStyle = '#b8643a'; c.lineWidth = s*.012; c.beginPath(); c.moveTo(-.22*s, -.2*s); c.quadraticCurveTo(-.05*s, -.15*s, .1*s, -.2*s); c.moveTo(.2*s, .02*s); c.quadraticCurveTo(.12*s, .12*s, .2*s, .2*s); c.stroke();
    // differential bar across the deck that links the two rockers
    c.strokeStyle = '#2c3035'; c.lineWidth = s*.03; c.beginPath(); c.moveTo(-.33*s, -.12*s); c.lineTo(-.2*s, -.1*s); c.lineTo(.2*s, -.1*s); c.lineTo(.33*s, -.12*s); c.stroke();
    c.fillStyle = '#4a5057'; c.beginPath(); c.arc(0, -.1*s, s*.028, 0, Math.PI*2); c.fill();
  }
  // high-gain antenna: hexagonal dish on a gimbal (gold when upgraded)
  if (lod >= 1) {
    const hga = P('hg_antenna'), hr = (hga ? .11 : .085)*s, hx = -.12*s, hy = .13*s;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); for (let k = 0; k < 6; k++) { const an = k/6*Math.PI*2 + .5; c.lineTo(hx + s*.02 + Math.cos(an)*hr, hy + s*.025 + Math.sin(an)*hr); } c.closePath(); c.fill();
    const hg = c.createLinearGradient(hx - hr, hy - hr, hx + hr, hy + hr); hg.addColorStop(0, hga ? '#f0d488' : '#d5d9dd'); hg.addColorStop(1, hga ? '#a8812f' : '#8e959c');
    c.fillStyle = hg; c.beginPath(); for (let k = 0; k < 6; k++) { const an = k/6*Math.PI*2 + .5; c.lineTo(hx + Math.cos(an)*hr, hy + Math.sin(an)*hr); } c.closePath(); c.fill();
    c.strokeStyle = hga ? '#8a6a24' : '#646b72'; c.lineWidth = Math.max(.5, s*.01); c.stroke();
    if (lod >= 2) { c.beginPath(); for (let k = 0; k < 6; k++) { const an = k/6*Math.PI*2 + .5; c.lineTo(hx + Math.cos(an)*hr*.55, hy + Math.sin(an)*hr*.55); } c.closePath(); c.stroke(); }
    // UHF antenna (or the taller Better radio mast) with the team pennant
    const ux = .2*s, uy = .2*s, L = (P('better_radio') ? .2 : .15)*s;
    c.fillStyle = '#7d848b'; c.beginPath(); c.arc(ux, uy, s*(P('better_radio') ? .03 : .024), 0, Math.PI*2); c.fill();
    c.strokeStyle = '#4a5057'; c.lineWidth = s*.014; c.beginPath(); c.moveTo(ux, uy); c.lineTo(ux + .03*s, uy + L); c.stroke();
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(ux + .05*s, uy + L + .02*s); c.lineTo(ux + .2*s, uy + L - .02*s); c.lineTo(ux + .05*s, uy + L - .08*s); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(ux + .03*s, uy + L); c.lineTo(ux + .18*s, uy + L - .04*s); c.lineTo(ux + .03*s, uy + L - .1*s); c.closePath(); c.fill();
    if (P('big_battery')) { c.fillStyle = '#3d4a42'; rr(c, -.21*s, -.05*s, .12*s, .055*s, .01*s); c.fill(); c.fillStyle = '#86d48f'; c.fillRect(-.195*s, -.03*s, .08*s, .015*s); }
    if (r.job === 'hauler') { // sample tube rack: each tube shows the color of its sample
      c.fillStyle = '#3a3f45'; rr(c, -.03*s, -.13*s, .23*s, .1*s, .015*s); c.fill();
      for (let k = 0; k < 8; k++) { const id = (r.tubes || [])[k]; c.fillStyle = id ? MR.CARDS[id].color : '#9aa1a8'; rr(c, -.015*s + k*.026*s, -.115*s, .018*s, .07*s, .006*s); c.fill(); } }
  } else { c.fillStyle = col; c.fillRect(-.27*s, .22*s, .54*s, .05*s); }
  // robotic arm folded across the front, with the turret (coring drill and instruments). Science stretches it out.
  { const ex = sci ? .03*s : .1*s, ey = sci ? -.62*s : -.38*s, sh = [-.21*s, -.3*s], el = sci ? [-.14*s, -.48*s] : [-.17*s, -.4*s];
    c.strokeStyle = '#5a6067'; c.lineWidth = s*.055; c.beginPath(); c.moveTo(...sh); c.lineTo(...el); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = '#e4e6e9'; c.lineWidth = s*.036; c.beginPath(); c.moveTo(...sh); c.lineTo(...el); c.lineTo(ex, ey); c.stroke();
    if (lod >= 1) { c.strokeStyle = '#c0703f'; c.lineWidth = s*.012; c.beginPath(); c.moveTo(...sh); c.lineTo(...el); c.lineTo(ex, ey); c.stroke();
      c.fillStyle = '#3a3f45'; [sh, el].forEach(([jx, jy]) => { c.beginPath(); c.arc(jx, jy, s*.032, 0, Math.PI*2); c.fill(); }); }
    // turret: a dark cluster of instruments (PIXL, SHERLOC with WATSON, the coring drill)
    const tr = s*(sci ? .1 : .085);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(ex + s*.02, ey + s*.025, tr, 0, Math.PI*2); c.fill();
    c.fillStyle = '#2e3238'; c.beginPath(); c.arc(ex, ey, tr, 0, Math.PI*2); c.fill();
    c.fillStyle = '#545b62'; c.beginPath(); c.arc(ex, ey, tr*.55, 0, Math.PI*2); c.fill();
    if (lod >= 1) { c.fillStyle = '#9aa1a8'; rr(c, ex + tr*.3, ey - tr*1.05, tr*.42, tr*.75, tr*.08); c.fill(); // coring drill
      c.fillStyle = '#c9b48a'; rr(c, ex - tr*1.05, ey - tr*.35, tr*.5, tr*.7, tr*.08); c.fill(); // PIXL
      c.fillStyle = '#7fa6c9'; c.beginPath(); c.arc(ex - tr*.15, ey + tr*.55, tr*.2, 0, Math.PI*2); c.fill(); // SHERLOC window
      c.fillStyle = '#15181c'; c.beginPath(); c.arc(ex, ey, tr*.2, 0, Math.PI*2); c.fill(); }
    if (a.busy === 'drill') { c.strokeStyle = '#f0bf5a'; c.lineWidth = s*.04; c.beginPath(); c.arc(ex, ey, s*.11, t/60, t/60 + 4); c.stroke(); } }
  if (lod >= 1 && P('sharp_eyes')) { c.fillStyle = '#1b222b'; [-.12, -.06, .06, .12].forEach(x => { c.beginPath(); c.arc(x*s, -.285*s, s*.014, 0, Math.PI*2); c.fill(); }); }
  // remote sensing mast and its head (Mastcam-Z eyes and the SuperCam window)
  const mx = .16*s, my = -.21*s, up = r.job === 'scout' ? .13*s : .09*s, sc = P('supercam');
  c.fillStyle = '#8e959c'; c.beginPath(); c.arc(mx, my, s*.035, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#b9bec4'; c.lineWidth = s*.035; c.beginPath(); c.moveTo(mx, my); c.lineTo(mx, my - up); c.stroke();
  c.save(); c.translate(mx, my - up);
  // the head: a big white box seen a little from the front, so its face shows SuperCam's big round window
  // and the two Mastcam-Z eyes below it (like the real head in NASA's pictures)
  const hw = .26*s, top = .12*s, face = .085*s;
  const tg = c.createLinearGradient(0, -top*.5, 0, top*.5); tg.addColorStop(0, '#f7f8f9'); tg.addColorStop(1, '#c6cbd0');
  c.fillStyle = tg; rr(c, -hw/2, -top*.5, hw, top, s*.014); c.fill();
  c.fillStyle = '#dfe2e5'; rr(c, -hw/2, -top*.5 - face, hw, face + s*.012, s*.014); c.fill();
  c.strokeStyle = '#7d848b'; c.lineWidth = Math.max(.5, s*.008); rr(c, -hw/2, -top*.5 - face, hw, face + top, s*.014); c.stroke();
  if (lod >= 1) {
    const fy = -top*.5 - face*.55;
    c.fillStyle = '#9aa1a8'; c.beginPath(); c.arc(hw*.18, fy, s*.036, 0, Math.PI*2); c.fill();      // SuperCam window
    c.fillStyle = '#0d1116'; c.beginPath(); c.arc(hw*.18, fy, s*.027, 0, Math.PI*2); c.fill();
    c.fillStyle = sc ? '#ff5a4f' : 'rgba(140,190,255,.85)'; c.beginPath(); c.arc(hw*.18 - s*.008, fy - s*.008, s*(sc ? .011 : .007), 0, Math.PI*2); c.fill();
    c.fillStyle = '#2a2f36'; rr(c, -hw*.46, fy - s*.02, hw*.38, s*.04, s*.008); c.fill();             // Mastcam-Z pair
    c.fillStyle = '#0d1116'; [-.38, -.18].forEach(x => { c.beginPath(); c.arc(x*hw, fy, s*.014, 0, Math.PI*2); c.fill(); });
    if (lod >= 2) { c.fillStyle = 'rgba(140,190,255,.7)'; [-.38, -.18].forEach(x => { c.beginPath(); c.arc(x*hw - s*.004, fy - s*.004, s*.004, 0, Math.PI*2); c.fill(); }); }
    if (P('sharp_eyes') && lod >= 2) { c.fillStyle = '#0d1116'; [-1, 1].forEach(sd => { c.beginPath(); c.arc(sd*hw*.3, top*.15, s*.01, 0, Math.PI*2); c.fill(); }); }
  }
  c.restore();
  c.lineCap = 'butt'; c.lineJoin = 'miter';
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
/* The Cadet's rover, styled on Sojourner (Mars Pathfinder, 1997): a small six-wheeled rover with a flat solar
   panel on top, cameras at the front and a whip antenna. The solar panel frame is the player's color. */
function drawBuggy(c, r, a, t, s, lod){
  const col = MR.colorHex(r.color), ys = [-.28, 0, .28];
  c.strokeStyle = '#2c3035'; c.lineWidth = s*.045; c.lineCap = 'round';
  [-1, 1].forEach(sd => { c.beginPath(); c.moveTo(sd*.34*s, ys[0]*s); c.lineTo(sd*.3*s, -.06*s); c.lineTo(sd*.34*s, ys[2]*s); c.moveTo(sd*.3*s, .1*s); c.lineTo(sd*.34*s, 0); c.stroke(); });
  c.lineCap = 'butt';
  ys.forEach(y => [-1, 1].forEach(sd => metalWheel(c, sd*.34*s, y*s, .14*s, .19*s, lod, false)));
  // body under the panel, with the front camera pair
  c.fillStyle = '#9ea4ab'; rr(c, -.2*s, -.3*s, .4*s, .58*s, .03*s); c.fill();
  c.fillStyle = '#d9dcdf'; rr(c, -.14*s, -.4*s, .28*s, .1*s, .02*s); c.fill();
  c.fillStyle = '#11161c'; [-1, 1].forEach(sd => { c.beginPath(); c.arc(sd*.07*s, -.37*s, s*.022, 0, Math.PI*2); c.fill(); });
  // solar panel: dark blue cells inside a frame in the player's color
  c.fillStyle = col; rr(c, -.27*s, -.29*s, .54*s, .52*s, .04*s); c.fill();
  const pg = c.createLinearGradient(-.24*s, -.26*s, .24*s, .2*s); pg.addColorStop(0, '#2d4a78'); pg.addColorStop(.5, '#1c2f52'); pg.addColorStop(1, '#253f69');
  c.fillStyle = pg; c.fillRect(-.235*s, -.255*s, .47*s, .45*s);
  if (lod >= 1) { c.strokeStyle = 'rgba(150,180,230,.35)'; c.lineWidth = Math.max(.5, s*.008);
    for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(-.235*s + k*.47*s/4, -.255*s); c.lineTo(-.235*s + k*.47*s/4, .195*s); c.stroke(); }
    for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(-.235*s, -.255*s + k*.45*s/5); c.lineTo(.235*s, -.255*s + k*.45*s/5); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.moveTo(-.235*s, -.255*s); c.lineTo(-.05*s, -.255*s); c.lineTo(-.235*s, -.02*s); c.closePath(); c.fill(); }
  // whip antenna with a star on top (Cadets love the star)
  c.strokeStyle = '#c9ced4'; c.lineWidth = s*.025; c.beginPath(); c.moveTo(.16*s, .2*s); c.lineTo(.2*s, .44*s); c.stroke();
  c.fillStyle = '#f2d15c'; c.beginPath(); for (let k = 0; k < 10; k++) { const rad = (k % 2 ? .028 : .065)*s, an = k/10*Math.PI*2 - Math.PI/2; c.lineTo(.2*s + Math.cos(an)*rad, .46*s + Math.sin(an)*rad); } c.closePath(); c.fill();
  if (a.busy === 'drill') { c.strokeStyle = '#f0bf5a'; c.lineWidth = s*.05; c.beginPath(); c.arc(0, -.44*s, s*.1, t/60, t/60 + 4); c.stroke(); }
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
R.drawPreview = (cv, r, moonPic) => {
  const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
  const g = c.createRadialGradient(cv.width/2, cv.height/2, 10, cv.width/2, cv.height/2, cv.width*.7); g.addColorStop(0, '#b5603d'); g.addColorStop(1, '#5a2a1a');
  c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  const s = cv.width*.62; c.save(); c.translate(cv.width/2, cv.height/2);
  const moon = moonPic != null ? moonPic : R.view && MR.MAPS[R.view.map].airless;
  if (r.job === 'heli') drawHeli(c, r, {}, performance.now(), s, 2); else if (r.job === 'buggy') drawBuggy(c, r, {}, 0, s, 2); else if (r.job === 'lab') drawLab(c, r, s, 2); else if (moon) drawLRV(c, r, {}, 0, s, 2); else { c.save(); c.translate(s*.05, s*.06); roverShadow(c, r, s); c.restore(); drawGroundRover(c, r, {}, 0, s, 2); mastShadow(c, r, s, .16*s, .2*s); }
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
  if (ghost) c.globalAlpha = .35; else if (R.offline && R.offline.has(r.pid)) c.globalAlpha = .45;
  if (heli) { c.fillStyle='rgba(40,12,4,0.28)'; c.beginPath(); c.ellipse(s*.12, s*.25, s*.32, s*.17, 0, 0, Math.PI*2); c.fill(); c.translate(0, -s*.12); }
  const moon0 = R.view && MR.MAPS[R.view.map].airless, perse = !heli && r.job !== 'buggy' && r.job !== 'lab' && !moon0;
  if (perse) { c.save(); c.translate(s*.07, s*.09); c.rotate(a.ang*Math.PI/180); roverShadow(c, r, s); c.restore();
 }
  else if (r.job === 'buggy') { c.save(); c.translate(s*.06, s*.08); c.rotate(a.ang*Math.PI/180); c.fillStyle = 'rgba(30,10,3,.34)'; rr(c, -.42*s, -.4*s, .84*s, .72*s, .06*s); c.fill(); c.restore(); }
  else if (!heli) { c.fillStyle='rgba(40,12,4,0.32)'; c.beginPath(); c.ellipse(s*.06,s*.08,s*.5,s*.5,0,0,Math.PI*2); c.fill(); }
  c.rotate(a.ang*Math.PI/180);
  if (a.busy || a.wob > 0) c.translate((Math.random()-.5)*s*.03, (Math.random()-.5)*s*.03);
  const moon = R.view && MR.MAPS[R.view.map].airless;
  if (heli) drawHeli(c, r, a, t, s, lod); else if (r.job === 'buggy') drawBuggy(c, r, a, t, s, lod); else if (r.job === 'lab') drawLab(c, r, s, lod); else if (moon) drawLRV(c, r, a, t, s, lod); else drawGroundRover(c, r, a, t, s, lod);
  if (perse && lod >= 1) { const an = -a.ang*Math.PI/180, ox = .2*s, oy = .25*s; mastShadow(c, r, s, ox*Math.cos(an) - oy*Math.sin(an), ox*Math.sin(an) + oy*Math.cos(an)); }
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
