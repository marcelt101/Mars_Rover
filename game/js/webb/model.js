/* Webb mission model: the rules a plan runs against, the same for cards, JavaScript plans and hand steering.
   Real behavior it follows (simplified for kids):
   - Webb may only point 85 to 135 degrees from the Sun, so the sunshield always shades the mirror.
   - Turning (a slew) uses reaction wheels; sunlight pushing on the sunshield slowly spins them up ("momentum").
     When momentum is full, Webb can't hold steady and must fire its thrusters to "unload" it.
   - Before a sharp picture, the Fine Guidance Sensor locks onto a guide star (ID, ACQ, TRACK, FINE GUIDE).
   - Pictures go onto a 65 GB recorder and come home through the Deep Space Network at about 28 megabits per second
     (12.6 GB per hour).
   - Plans are event-driven, like Webb's onboard scripts: when a step fails, that observation is skipped and the plan
     goes on to the next one. A week has 168 hours. */
(function (root) {
const W = root.WEBB = root.WEBB || {};
const D2R = Math.PI / 180;
W.REC_GB = 65; W.DSN_GBH = 12.6; W.WEEK_H = 168;
W.vec = (ra, dec) => [Math.cos(dec * D2R) * Math.cos(ra * D2R), Math.cos(dec * D2R) * Math.sin(ra * D2R), Math.sin(dec * D2R)];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
W.sep = (ra1, dec1, ra2, dec2) => Math.acos(Math.max(-1, Math.min(1, dot(W.vec(ra1, dec1), W.vec(ra2, dec2))))) / D2R;
W.sunDir = ms => { const n = (ms - Date.UTC(2000, 0, 1, 12)) / 864e5, L = 280.46 + .9856474 * n, g = (357.528 + .9856003 * n) * D2R;
  const lam = (L + 1.915 * Math.sin(g) + .02 * Math.sin(2 * g)) * D2R, e = 23.439 * D2R; return [Math.cos(lam), Math.cos(e) * Math.sin(lam), Math.sin(e) * Math.sin(lam)]; };
W.sunAngle = (ra, dec, ms) => Math.acos(Math.max(-1, Math.min(1, dot(W.vec(ra, dec), W.sunDir(ms))))) / D2R;
W.inField = (ra, dec, ms) => { const a = W.sunAngle(ra, dec, ms); return a >= 85 && a <= 135; };
/* Sun-centered coordinates: th = angle from the Sun (the allowed band is 85-135), ph = the angle around the Sun.
   Webb can turn freely around the Sun inside that band, so paths between targets go around the ring. */
const sunFrame = ms => { const S = W.sunDir(ms), t = Math.abs(S[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
  let X = [t[1]*S[2] - t[2]*S[1], t[2]*S[0] - t[0]*S[2], t[0]*S[1] - t[1]*S[0]]; const l = Math.hypot(...X); X = X.map(v => v / l);
  return {S, X, Y:[S[1]*X[2] - S[2]*X[1], S[2]*X[0] - S[0]*X[2], S[0]*X[1] - S[1]*X[0]]}; };
W.toSun = (ra, dec, ms) => { const f = sunFrame(ms), v = W.vec(ra, dec); return [Math.acos(Math.max(-1, Math.min(1, dot(v, f.S)))) / D2R, Math.atan2(dot(v, f.Y), dot(v, f.X))]; };
W.fromSun = (th, ph, ms) => { const f = sunFrame(ms), ct = Math.cos(th * D2R), st = Math.sin(th * D2R), c = Math.cos(ph), sn = Math.sin(ph);
  const v = [0, 1, 2].map(i => f.S[i] * ct + (f.X[i] * c + f.Y[i] * sn) * st);
  return [((Math.atan2(v[1], v[0]) / D2R) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, v[2]))) / D2R]; };
W.slerp = (a, b, k) => { const va = W.vec(a[0], a[1]), vb = W.vec(b[0], b[1]), om = Math.acos(Math.max(-1, Math.min(1, dot(va, vb))));
  if (om < 1e-6) return [b[0], b[1]]; const s = Math.sin(om), p = va.map((v, i) => (Math.sin((1 - k) * om) * v + Math.sin(k * om) * vb[i]) / s);
  return [((Math.atan2(p[1], p[0]) / D2R) + 360) % 360, Math.asin(Math.max(-1, Math.min(1, p[2]))) / D2R]; };
/* The way Webb turns from a to b ([ra, dec]): straight if that stays out of the Sun, otherwise around the Sun inside the band.
   Returns a function of k (0 to 1) giving [ra, dec]. */
W.route = (a, b, ms) => {
  const straight = k => W.slerp(a, b, k); let ok = true;
  for (let i = 1; i < 24 && ok; i++) { const p = straight(i / 24), x = W.sunAngle(p[0], p[1], ms); ok = x >= 84.5 && x <= 135.5; }
  if (ok) return straight;
  const A = W.toSun(a[0], a[1], ms), B = W.toSun(b[0], b[1], ms), dph = ((B[1] - A[1] + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return k => k >= 1 ? [b[0], b[1]] : W.fromSun(A[0] + (B[0] - A[0]) * k, A[1] + dph * k, ms);
};
/* Keep a pointing inside the band: slide along the edge instead of stopping. */
W.clampToBand = (ra, dec, ms) => { const [th, ph] = W.toSun(ra, dec, ms); return th >= 85 && th <= 135 ? [ra, dec] : W.fromSun(Math.max(85.02, Math.min(134.98, th)), ph, ms); };
/* The next date (from ms) when a target can be seen, to tell kids when to come back. */
W.nextVisible = (t, ms) => { for (let d = 0; d < 400; d++) { const m = ms + d * 864e5; if (W.inField(t.ra, t.dec, m)) return m; } return null; };
class Stop extends Error {}
/* A fresh week. The telescope starts pointed at a safe spot in the middle of the allowed band. */
W.newState = week => {
  const s = {week:week.id, date:week.date, h:0, mom:15, rec:0, cam:'NIRCam', filter:'F200W', obs:null, recorder:[], home:[], events:[], steps:0};
  let best = null;
  for (let ra = 0; ra < 360; ra += 10) for (let dec = -60; dec <= 60; dec += 10) { const a = W.sunAngle(ra, dec, week.date); if (!best || Math.abs(a - 110) < best.d) best = {ra, dec, d:Math.abs(a - 110)}; }
  s.ra = best.ra; s.dec = best.dec; return s;
};
/* Score a picture: 3 stars from four checks. */
W.grade = p => { const t = W.byId(p.id), checks = [
    {ok:p.locked, label:'Locked on a guide star (sharp, not blurry)'},
    {ok:p.minutes >= t.need, label:`Long enough exposure (${t.need >= 120 ? (t.need / 60).toFixed(1) + ' hours' : t.need + ' minutes'} for this one)`},
    {ok:p.cam === t.cam || (t.ok || []).includes(p.cam), label:`A good instrument for it (Webb used ${(t.ok || [t.cam]).join(' and ')})`},
    {ok:p.dither >= 4, label:'Dithered 4 times (fills the gaps between detectors)'},
    ...(t.spectrum ? [] : [{ok:W.inColor(p), label:'3 or more filters (each filter becomes a color)'}])];
  const n = checks.filter(c => c.ok).length; return {checks, stars:Math.max(p.locked || p.minutes ? 1 : 0, Math.round(n * 3 / checks.length))}; };
/* A color picture needs 3 or more filters; with fewer it comes out black and white. */
W.inColor = p => !!p && (p.filters || [p.filter]).filter(Boolean).length >= 3;
/* The plan's commands. Each one moves the clock, adds momentum and records an event for the animation. */
W.api = s => {
  const ev = e => { s.events.push({...e, h:+s.h.toFixed(2), mom:Math.round(s.mom), rec:+s.rec.toFixed(1), ra:s.ra, dec:s.dec}); };
  const tick = hours => { s.steps++; if (s.steps > 400) { ev({type:'error', text:'The plan has too many steps (more than 400).'}); throw new Stop(); }
    s.h += hours; s.mom = Math.min(100, s.mom + hours * 1.1);
    if (s.h > W.WEEK_H) { ev({type:'weekover'}); throw new Stop(); } };
  const need = () => { if (!s.obs) { ev({type:'error', text:'Turn to a target first: webb.slew("name")'}); return false; } return true; };
  const webb = {
    targets: W.TARGETS.map(t => t.id),
    visible: name => { const t = W.byId(name); return !!t && W.inField(t.ra, t.dec, s.date); },
    momentum: () => Math.round(s.mom),
    recorder: () => +s.rec.toFixed(1),
    hours: () => +s.h.toFixed(1),
    log: text => ev({type:'log', text:String(text).slice(0, 120)}),
    slew(name) {
      const t = W.byId(name);
      if (!t) { ev({type:'error', text:`There is no target called "${name}".`}); s.obs = null; return false; }
      if (!W.inField(t.ra, t.dec, s.date)) { const nv = W.nextVisible(t, s.date); ev({type:'skip', why:'sun', id:t.id, next:nv}); s.obs = null; return false; }
      const a = W.sep(s.ra, s.dec, t.ra, t.dec), from = [s.ra, s.dec];
      s.mom = Math.min(100, s.mom + a * .12); tick(.2 + a / 90);
      s.ra = t.ra; s.dec = t.dec; s.obs = {id:t.id, locked:false, minutes:0, dither:1, cam:s.cam, filter:s.filter};
      ev({type:'slew', id:t.id, from, deg:Math.round(a)}); return true;
    },
    guideStar() {
      if (!need()) return false; tick(.1);
      if (s.mom >= 100) { ev({type:'guide', ok:false, why:'momentum', id:s.obs.id}); s.obs.locked = false; return false; }
      s.obs.locked = true; ev({type:'guide', ok:true, id:s.obs.id}); return true;
    },
    camera(name, filter) {
      const c = W.CAMS[name]; if (!c) { ev({type:'error', text:`Webb has no instrument called "${name}". Try NIRCam, MIRI or NIRISS.`}); return false; }
      s.cam = name; s.filter = c.filters.includes(filter) ? filter : c.filters[0];
      if (s.obs) { s.obs.cam = s.cam; s.obs.filter = s.filter; }
      tick(.05); ev({type:'camera', cam:s.cam, filter:s.filter}); return true;
    },
    dither(n) { if (!need()) return false; s.obs.dither = Math.max(1, Math.min(8, n | 0)); tick(s.obs.dither * .03);
      const p = s.recorder.find(q => q.id === s.obs.id && q.cam === s.obs.cam); if (p) p.dither = Math.max(p.dither, s.obs.dither);
      ev({type:'dither', n:s.obs.dither}); return true; },
    expose(minutes) {
      if (!need()) return false; minutes = Math.max(1, Math.min(900, +minutes || 0));
      const gb = minutes / 60 * W.CAMS[s.obs.cam].gbh;
      if (s.rec + gb > W.REC_GB) { ev({type:'full', id:s.obs.id}); return false; }
      if (s.mom >= 100) s.obs.locked = false;
      tick(minutes / 60); s.rec += gb; s.mom = Math.min(100, s.mom + minutes / 60 * .4);
      s.obs.minutes += minutes;
      const p = s.recorder.find(q => q.id === s.obs.id && q.cam === s.obs.cam);
      if (p) Object.assign(p, {minutes:p.minutes + minutes, locked:p.locked || s.obs.locked, dither:Math.max(p.dither, s.obs.dither), gb:p.gb + gb, filters:[...new Set([...(p.filters || []), s.obs.filter])]});
      else s.recorder.push({id:s.obs.id, cam:s.obs.cam, filter:s.obs.filter, filters:[s.obs.filter], minutes, locked:s.obs.locked, dither:s.obs.dither, gb});
      ev({type:'expose', id:s.obs.id, minutes, gb:+gb.toFixed(1), locked:s.obs.locked, cam:s.obs.cam}); return true;
    },
    downlink() {
      const gb = s.rec; if (!gb) { ev({type:'log', text:'Nothing on the recorder to send home.'}); return false; }
      tick(Math.max(.25, gb / W.DSN_GBH)); const sent = s.recorder.splice(0); s.home.push(...sent); s.rec = 0;
      ev({type:'downlink', gb:+gb.toFixed(1), pics:sent.map(p => p.id)}); return true;
    },
    unload() { tick(.5); s.mom = 8; ev({type:'unload'}); return true; },
    skip() { if (s.obs) ev({type:'skip', why:'plan', id:s.obs.id}); s.obs = null; return true; },
  };
  return webb;
};
/* Run a plan written as JavaScript against a week. Used inside the worker, so a never-ending loop can't freeze the game. */
W.runCode = (code, week) => {
  const s = W.newState(week), webb = W.api(s);
  try { new Function('webb', '"use strict";\n' + code)(webb); }
  catch (e) { if (!(e instanceof Stop)) s.events.push({type:'error', text:String(e && e.message || e).slice(0, 160), h:s.h}); }
  return {events:s.events, home:s.home, recorder:s.recorder, h:s.h, start:[...W.newStart(week)]};
};
W.newStart = week => { const s = W.newState(week); return [s.ra, s.dec]; };
/* Observation cards (the way astronomers fill in Webb's planning forms) turned into JavaScript. */
W.cardsToCode = cards => cards.map(c => {
  if (c.type === 'downlink') return 'webb.downlink();           // send the pictures home through the Deep Space Network';
  if (c.type === 'unload') return 'webb.unload();             // fire the thrusters to unload momentum';
  const fl = c.filters && c.filters.length ? c.filters : [c.filter], per = Math.max(1, Math.ceil(c.minutes / fl.length));
  return [`// ${W.byId(c.id).name} (${W.byId(c.id).cat})`, `if (webb.slew("${c.id}")) {`, `  webb.camera("${c.cam}", "${fl[0]}");`,
    `  if (webb.guideStar()) {`, ...(c.dither > 1 ? [`    webb.dither(${c.dither});`] : []),
    ...(fl.length > 1 ? [`    for (const f of ${JSON.stringify(fl)}) {   // one exposure per filter: each filter becomes a color`, `      webb.camera("${c.cam}", f);`, `      webb.expose(${per});`, `    }`] : [`    webb.expose(${c.minutes});`]),
    `  } else webb.skip();       // no guide star: skip it, like the real Webb`, `}`].join('\n');
}).join('\n');
})(typeof window !== 'undefined' ? window : self);
