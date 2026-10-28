/* World generation, terrain baking and world serialization. */
(function () {
const MR = window.MR;
const {MW, MH, BASE, T} = MR;
const N = MW * MH;

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeNoise(seed){
  const r = mulberry32(seed), P = 256, g = new Float32Array(P*P);
  for (let i=0;i<P*P;i++) g[i] = r();
  const at = (x,y) => g[(((y%P)+P)%P)*P + (((x%P)+P)%P)];
  const sm = t => t*t*(3-2*t);
  const v = (x,y) => { const xi=Math.floor(x), yi=Math.floor(y), xf=sm(x-xi), yf=sm(y-yi);
    const a=at(xi,yi), b=at(xi+1,yi), c=at(xi,yi+1), d=at(xi+1,yi+1);
    return a+(b-a)*xf+(c-a)*yf+(a-b-c+d)*xf*yf; };
  return (x,y) => v(x,y)*.6 + v(x*2.1+17,y*2.1)*.3 + v(x*4.3,y*4.3+31)*.1;
}
function distSeg(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy))); return Math.hypot(px-ax-t*dx, py-ay-t*dy); }
MR.mulberry32 = mulberry32;
MR.inb = (x,y) => x>=0 && y>=0 && x<MW && y<MH;
MR.idx = (x,y) => y*MW + x;

function blankWorld(map, seed, cadetGems){
  return {map, seed, cadetGems:!!cadetGems,
    ter:new Uint8Array(N), obs:new Array(N).fill(''), res:new Array(N).fill(''), kid:new Uint8Array(N),
    trap:new Uint8Array(N), seen:new Uint8Array(N), sig:new Uint8Array(N), known:new Uint8Array(N),
    drilled:new Uint8Array(N), trapSeen:new Uint8Array(N), extra:[]};
}
MR.onStation = (map, x, y) => { const s = MR.MAPS[map].station; return x>=s.x && x<=s.x+1 && y>=s.y && y<=s.y+1; };
MR.nearStation = (map, x, y, d) => { const s = MR.MAPS[map].station; return Math.abs(x-(s.x+.5))<=d && Math.abs(y-(s.y+.5))<=d; };

function terJezero(w, seed){
  const nA = makeNoise(seed+11), nB = makeNoise(seed+23), APEX = {x:10, y:13};
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) {
    const nr = nA(x/6, y/6), d = Math.hypot((x-56)*.95, (y-40)*1.25);
    const chan = x < 12 && distSeg(x,y,0,5,APEX.x,APEX.y) < 1.1 + nr*.7;
    let t = T.FLOOR;
    if (d > 52 + nr*4 && !chan) t = T.RIM;
    else {
      const ax = x-APEX.x, ay = y-APEX.y, ad = Math.hypot(ax,ay), ang = Math.atan2(ay,ax)*180/Math.PI;
      if (ad < 13 + nr*4 + 3.2*Math.max(0, Math.sin(ang*Math.PI/180*5 + 1)) && ang > -55 && ang < 80) t = T.DELTA;
      if (chan) t = T.CHAN;
      const sx = (x-23)/10.5, sy = (y-31)/6.2;
      if (sx*sx + sy*sy < 1 + (nB(x/4,y/4)-.5)*.7) t = T.DUNE;
      if (t === T.FLOOR && nB(x/5+40, y/5) > .6) t = T.BED;
    }
    w.ter[y*MW+x] = t;
  }
  w.apex = APEX;
}
function terGusev(w, seed){
  const nA = makeNoise(seed+11), nB = makeNoise(seed+23), nS = makeNoise(seed+37);
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) {
    let t = T.FLOOR;
    if (nB(x/5+40, y/5) > .6) t = T.BED;
    if (nS(x/5, y/5) > .64) t = T.DUNE;
    if (distSeg(x,y,20,44,26,33) < 1.2 + nA(x/4,y/4)*.8) t = T.CHAN;
    const hd = ((x-35)/10)**2 + ((y-16)/7)**2 + (nA(x/5,y/5)-.5)*.6;
    if (hd < 1) t = (hd < .75 && nA(x/2.5+9, y/2.5) > .6) ? T.CLIFF : T.HILL;
    const bd = Math.hypot(x-17, y-13);
    if (bd < 3.5 + (nA(x,y)-.5)*.4) t = bd > 2.2 ? T.RIM : T.CHAN;
    if (Math.hypot(x-41, y-28) < 2.5) t = T.PLATE;
    if (((x-36)/3)**2 + ((y-32)/1.8)**2 < 1) t = T.DUNE;
    w.ter[y*MW+x] = t;
  }
}

MR.genWorld = function (map, seed, cadetGems) {
  const w = blankWorld(map, seed, cadetGems), r = mulberry32(seed), M = MR.MAPS[map];
  if (map === 'gusev') terGusev(w, seed); else terJezero(w, seed);
  const S = M.station;
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) {
    const i = y*MW+x, t = w.ter[i];
    if (MR.nearStation(map,x,y,3) || MR.TER[t].block) continue;
    const p = [.03,.06,.008,.045,.01,0,.05,0,.02][t];
    if (r() < p) w.obs[i] = 'R';
    else if ((t === T.FLOOR || t === T.BED) && r() < .009) w.obs[i] = 'C';
  }
  for (let y=S.y-2;y<=S.y+3;y++) for (let x=S.x-2;x<=S.x+3;x++) if (MR.inb(x,y)) { const i=y*MW+x; if (w.ter[i] !== T.BED) w.ter[i] = T.FLOOR; w.obs[i] = ''; }
  const free = i => !w.obs[i] && !w.res[i] && !MR.TER[w.ter[i]].block;
  const place = (id, n, pred) => { let k=0, g=0; while (k<n && g++<8000) {
    const x = Math.floor(r()*MW), y = Math.floor(r()*MH), i = y*MW+x;
    if (!free(i) || MR.nearStation(map,x,y,2) || !pred(x,y,w.ter[i])) continue; w.res[i] = id; k++; } };
  const nearest = (tx, ty, id) => { for (let rad=0; rad<12; rad++) for (let y=ty-rad;y<=ty+rad;y++) for (let x=tx-rad;x<=tx+rad;x++) {
    if (!MR.inb(x,y)) continue; const i=y*MW+x; if (free(i)) { w.res[i] = id; w.obs[i] = 'A'; return i; } } return -1; };
  const isT = (...ts) => (x,y,t) => ts.includes(t);
  if (map === 'gusev') {
    nearest(36, 32, 'art_spirit');
    place('silica', 3, (x,y,t) => Math.hypot(x-41,y-28) < 6.5 && Math.hypot(x-41,y-28) > 2);
    place('carbonate', 3, isT(T.HILL));
    place('salts', 2, (x,y,t) => Math.hypot(x-36,y-32) < 6);
    place('salts', 2, isT(T.HILL));
    place('olivine', 5, isT(T.FLOOR, T.BED));
    place('meteorite', 2, isT(T.FLOOR));
    place('basalt', 14, isT(T.FLOOR, T.BED));
  } else {
    nearest(16, 9, 'art_ingenuity');
    nearest(46, 31, 'art_backshell');
    const ad = (x,y) => Math.hypot(x-w.apex.x, y-w.apex.y);
    place('clay', 6, isT(T.DELTA));
    place('carbonate', 4, (x,y,t) => t === T.DELTA && ad(x,y) > 10);
    place('organics', 4, (x,y,t) => t === T.DELTA && ad(x,y) > 4 && ad(x,y) < 13);
    place('olivine', 5, isT(T.DUNE));
    place('salts', 4, isT(T.FLOOR, T.BED));
    place('meteorite', 3, isT(T.FLOOR));
    place('basalt', 12, isT(T.FLOOR, T.BED));
  }
  if (cadetGems) {
    const kinds = map === 'gusev' ? ['olivine','salts','silica','meteorite','carbonate','basalt'] : ['olivine','clay','salts','meteorite','carbonate','basalt'];
    let k = 0, g = 0;
    while (k < 10 && g++ < 4000) {
      const x = Math.floor(r()*MW), y = Math.floor(r()*MH), i = y*MW+x, d = Math.hypot(x-S.x, y-S.y);
      if (d < 3 || d > 11 || !free(i)) continue;
      w.res[i] = kinds[Math.floor(r()*kinds.length)]; w.kid[i] = 1; w.sig[i] = 1; w.known[i] = 1; k++;
      for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) if (MR.inb(x+dx,y+dy)) w.seen[(y+dy)*MW+x+dx] = 1;
    }
  }
  for (let i=0;i<N;i++) {
    if (w.ter[i] !== T.DUNE || w.res[i] || w.obs[i]) continue;
    const x = i % MW, y = (i / MW) | 0;
    if (MR.nearStation(map,x,y,8)) continue;
    const troy = map === 'gusev' && Math.hypot(x-36, y-32) < 3.5;
    if (r() < (troy ? .35 : .1)) w.trap[i] = 1;
  }
  w.rocks = rockShapes(w, seed);
  return w;
};

function rockShapes(w, seed){
  const r = mulberry32(seed + 777), out = {};
  for (let i=0;i<N;i++) {
    const n = 1 + Math.floor(r()*2.4), stones = [];
    for (let k=0;k<n;k++) stones.push({x:.5+(r()-.5)*(n>1?.42:.16), y:.5+(r()-.5)*(n>1?.42:.16), rad:(n>1?.17:.26)+r()*.1, shade:r(), pts:[...Array(8)].map(()=>.72+r()*.36)});
    if (w.obs[i] === 'R') out[i] = stones;
  }
  return out;
}

/* Only the parts that change during play are sent over the network. */
const BITS = ['trap','seen','sig','known','drilled','trapSeen'];
const packBits = a => { let s = ''; for (let i=0;i<N;i+=8) { let b = 0; for (let k=0;k<8;k++) if (a[i+k]) b |= 1 << k; s += String.fromCharCode(b); } return btoa(s); };
const unpackBits = (str, a) => { const s = atob(str); for (let j=0;j<s.length;j++) { const b = s.charCodeAt(j); for (let k=0;k<8;k++) { const i = j*8+k; if (i < N) a[i] = (b >> k) & 1; } } };
const packObs = obs => { let out = '', i = 0; while (i < N) { const c = obs[i] || '.'; let j = i; while (j < N && (obs[j] || '.') === c) j++; out += c + (j-i) + ','; i = j; } return out; };
const unpackObs = (str, obs) => { let i = 0; str.split(',').forEach(t => { if (!t) return; const c = t[0], n = +t.slice(1); for (let k=0;k<n && i<N;k++) obs[i++] = c === '.' ? '' : c; }); };
MR.worldToWire = w => {
  const o = {map:w.map, seed:w.seed, cadetGems:w.cadetGems, obs:packObs(w.obs), extra:w.extra.slice()};
  BITS.forEach(k => o[k] = packBits(w[k]));
  return o;
};
MR.worldFromWire = (o, base) => {
  const w = base && base.map === o.map && base.seed === o.seed && base.cadetGems === o.cadetGems ? base : MR.genWorld(o.map, o.seed, o.cadetGems);
  unpackObs(o.obs, w.obs);
  w.extra = (o.extra || []).slice(); w.extra.forEach(([i, id]) => { w.res[i] = id; w.kid[i] = 1; });
  BITS.forEach(k => unpackBits(o[k], w[k]));
  return w;
};
MR.cloneWorld = w => {
  const c = {...w};
  ['ter','kid','trap','seen','sig','known','drilled','trapSeen'].forEach(k => c[k] = w[k].slice());
  c.obs = w.obs.slice(); c.res = w.res.slice(); c.extra = (w.extra || []).slice();
  return c;
};

/* Terrain picture (static parts only: ground, textures, craters). */
const COLS = {
  jezero:[[181,96,61],[150,78,51],[210,140,92],[160,104,80],[138,76,54],[108,56,41],[150,92,66],[96,54,40],[196,150,118]],
  gusev: [[166,98,68],[136,80,58],[204,142,98],[160,104,80],[128,74,54],[104,58,44],[156,96,68],[94,56,42],[204,170,140]],
};
/* The terrain picture: a height map lit from the north-west (hillshading), so craters, the delta,
   dunes, hills and the crater rim look like an orbital photo, with soft edges when zoomed out. */
const HEIGHT = [0, .15, .12, .7, -.45, 1.9, 1.1, 2.1, 1.0];
MR.bakeTerrain = function (w) {
  const r = mulberry32(w.seed+99), nz = makeNoise(w.seed+5), nd = makeNoise(w.seed+61), TC = COLS[w.map] || COLS.jezero;
  const S = 10, PW = MW*S, PH = MH*S;
  // tile heights, blurred once so slopes look natural
  const th = new Float32Array(N), tb = new Float32Array(N);
  for (let i=0;i<N;i++) { const x = i % MW, y = (i/MW)|0, t = w.ter[i]; th[i] = HEIGHT[t] + (t === T.RIM || t === T.HILL || t === T.CLIFF ? (nz(x/4+20, y/4)-.5)*1.2 : (nz(x/5, y/5)-.5)*.25); }
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) { let s2 = 0, n2 = 0; for (let dy=-1;dy<=1;dy++) for (let dx=-1;dx<=1;dx++) { if (!MR.inb(x+dx,y+dy)) continue; const wt = dx||dy ? 1 : 2; s2 += th[(y+dy)*MW+x+dx]*wt; n2 += wt; } tb[y*MW+x] = s2/n2; }
  const bil = (arr, fx, fy) => { const x0 = Math.max(0, Math.min(MW-1, Math.floor(fx))), y0 = Math.max(0, Math.min(MH-1, Math.floor(fy))), x1 = Math.min(MW-1, x0+1), y1 = Math.min(MH-1, y0+1), tx = Math.max(0, Math.min(1, fx-x0)), ty = Math.max(0, Math.min(1, fy-y0));
    return (arr[y0*MW+x0]*(1-tx) + arr[y0*MW+x1]*tx)*(1-ty) + (arr[y1*MW+x0]*(1-tx) + arr[y1*MW+x1]*tx)*ty; };
  const dune = new Float32Array(N), delta = new Float32Array(N);
  for (let i=0;i<N;i++) { dune[i] = w.ter[i] === T.DUNE ? 1 : 0; delta[i] = w.ter[i] === T.DELTA ? 1 : 0; }
  const craters = []; for (let i=0;i<N;i++) if (w.obs[i] === 'C') craters.push({x:i % MW + .5, y:((i/MW)|0) + .5, R:.42 + r()*.1, fresh:r() < .6});
  for (let k=0;k<45;k++) { const x = r()*MW, y = r()*MH, t = w.ter[Math.floor(y)*MW + Math.floor(x)]; if (t === T.FLOOR || t === T.BED || t === T.DELTA) craters.push({x, y, R:.06 + r()*.08, fresh:r() < .25, deco:true}); }
  const wind = .6, wc = Math.cos(wind), ws = Math.sin(wind);
  const H = new Float32Array((PW+2)*(PH+2)), at = (px, py) => (py+1)*(PW+2) + px+1;
  for (let py=-1;py<=PH;py++) for (let px=-1;px<=PW;px++) {
    const fx = (px+.5)/S - .5, fy = (py+.5)/S - .5, ux = fx+.5, uy = fy+.5;
    let h = bil(tb, fx, fy) + (nd(ux*1.3, uy*1.3)-.5)*.18 + (nd(ux*4+9, uy*4)-.5)*.05;
    const dw = bil(dune, fx, fy);
    if (dw > 0) { const ph = (ux*wc + uy*ws) * Math.PI*2/1.5 + nd(ux*.22, uy*.22)*1.4, sw = Math.sin(ph);
      h += dw * (.03 + .035*nd(ux*.8+3, uy*.8)) * (sw > 0 ? sw : sw*.4); }
    H[at(px, py)] = h;
  }
  craters.forEach(c => { const R = c.R, x0 = Math.floor((c.x - R*2)*S), x1 = Math.ceil((c.x + R*2)*S), y0 = Math.floor((c.y - R*2)*S), y1 = Math.ceil((c.y + R*2)*S);
    for (let py=Math.max(-1,y0);py<=Math.min(PH,y1);py++) for (let px=Math.max(-1,x0);px<=Math.min(PW,x1);px++) {
      const d = Math.hypot((px+.5)/S - c.x, (py+.5)/S - c.y) / R;
      if (d < 1) H[at(px,py)] -= (c.deco ? .12 : .8) * (1 - d*d);
      H[at(px,py)] += (c.deco ? .05 : .32) * Math.exp(-(((d-1)/.18)**2));
    } });
  const img = new ImageData(PW, PH), D = img.data;
  const colTiles = [0,1,2].map(ch => { const a2 = new Float32Array(N); for (let i=0;i<N;i++) a2[i] = TC[w.ter[i]][ch]; return a2; });
  for (let py=0;py<PH;py++) for (let px=0;px<PW;px++) {
    const fx = (px+.5)/S - .5, fy = (py+.5)/S - .5;
    const slope = (H[at(px-1,py-1)] - H[at(px+1,py+1)]) * S * .55;
    const shade = Math.max(.45, Math.min(1.55, 1 + slope));
    const alb = 1 + (nz(px/14, py/14)-.5)*.16 + (nd(px/3.2, py/3.2)-.5)*.07;
    const dl = bil(delta, fx, fy), strata = dl > 0 ? Math.sin(H[at(px,py)]*38) * 7 * dl : 0;
    const k = (py*PW + px)*4;
    for (let ch=0;ch<3;ch++) D[k+ch] = Math.max(0, Math.min(255, bil(colTiles[ch], fx, fy) * alb * shade + strata * (ch === 2 ? .6 : 1)));
    D[k+3] = 255;
  }
  craters.forEach(c => { if (!c.fresh) return; const R = c.R;   // bright ejecta around fresh craters
    for (let py=Math.floor((c.y-R*2.4)*S);py<=Math.ceil((c.y+R*2.4)*S);py++) for (let px=Math.floor((c.x-R*2.4)*S);px<=Math.ceil((c.x+R*2.4)*S);px++) {
      if (px < 0 || py < 0 || px >= PW || py >= PH) continue; const d = Math.hypot((px+.5)/S - c.x, (py+.5)/S - c.y) / R;
      if (d < 1.05 || d > 2.4) continue; const a2 = (1 - (d-1.05)/1.35) * .22 * (.6 + nd(px/2, py/2)*.8), k = (py*PW+px)*4;
      for (let ch=0;ch<3;ch++) D[k+ch] = Math.min(255, D[k+ch] + (255 - D[k+ch]) * a2 * (ch === 2 ? .75 : 1)); } });
  const small = document.createElement('canvas'); small.width = PW; small.height = PH; small.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = MW*BASE; cv.height = MH*BASE;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(small, 0, 0, cv.width, cv.height);
  // fine grain and a few surface details on top
  for (let y=0;y<MH;y++) for (let x=0;x<MW;x++) {
    const X = x*BASE, Y = y*BASE, t = w.ter[y*MW+x];
    if (t === T.BED && r() < .7) { g.strokeStyle='rgba(60,22,10,0.22)'; g.lineWidth=1; g.beginPath(); let px2=X+r()*32, py2=Y+r()*32; g.moveTo(px2,py2); for (let s2=0;s2<3;s2++){ px2+=(r()-.5)*14; py2+=(r()-.5)*14; g.lineTo(px2,py2);} g.stroke(); }
    if ((t === T.FLOOR || t === T.BED) && r() < .25) { g.fillStyle='rgba(60,25,12,0.35)'; for (let k=0;k<3;k++) { g.beginPath(); g.arc(X+r()*32, Y+r()*32, .8+r()*1.6, 0, Math.PI*2); g.fill(); } }
  }
  for (let i=0;i<26000;i++) { g.fillStyle = r()<.5 ? 'rgba(255,215,190,0.12)' : 'rgba(50,16,6,0.16)'; const s2 = r()*1.6+.4; g.fillRect(r()*cv.width, r()*cv.height, s2, s2); }
  return cv;
};
})();
