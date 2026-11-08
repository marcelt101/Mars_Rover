/* Webb mission app: the sky, the week picker, the planner (cards or JavaScript), the animated run with Webb's
   systems, hand steering, and the album. Webb's rules live in model.js; the targets in data.js. */
(function () {
const W = window.WEBB, $ = id => document.getElementById(id), D2R = Math.PI / 180, IMG = 'img/webb/';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'})[c]);
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const fmtDate = ms => new Date(ms).toLocaleDateString('en-US', {day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ================= the sky: one shader looks up NASA's star map in the direction of each pixel ================= */
const cv = $('gl'), gl = cv.getContext('webgl'), hud = $('hud'), hc = hud.getContext('2d');
const V = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
const F = `precision highp float;
uniform sampler2D sky, noise; uniform vec2 res, cen; uniform vec3 fw, rt, up, sun; uniform float tanF, expo, zone, deep;
vec4 rnd(vec2 cell){ return texture2D(noise, (mod(cell, 256.) + .5) / 256.); }
void main(){
  vec2 q = (gl_FragCoord.xy * 2. - res) / res.y;
  vec3 d = normalize(fw + q.x * tanF * rt + q.y * tanF * up);
  float ra = atan(d.y, d.x), dec = asin(clamp(d.z, -1., 1.));
  vec3 c = texture2D(sky, vec2(fract(.5 - ra / 6.2831853), .5 - dec / 3.1415927)).rgb * expo;
  if (deep > 0.) {   /* zoomed in past what the star map shows: fine stars fixed to the sky, placed from the view center */
    c *= 1. - deep * .93;
    float z = dot(d, fw), px = 60. * tanF * 2. / res.y * 57.29578; vec2 g = cen + vec2(-dot(d, rt), dot(d, up)) / z * 3437.747;
    for (int k = 0; k < 4; k++) { vec2 cell = floor(g - .5) + vec2(float(k - (k / 2) * 2), float(k / 2)); vec4 n = rnd(cell);
      if (n.x > .78) { float r = length(g - cell - n.yz), size = px * (1.1 + 2.6 * pow(n.w, 10.)), b = pow(n.w, 7.) * 2.2 + .12;
        c += deep * b * smoothstep(size, 0., r) * mix(vec3(1., .85, .7), vec3(.75, .85, 1.), fract(n.x * 7.)); } }
  }
  float a = degrees(acos(clamp(dot(d, sun), -1., 1.)));
  c += zone * (smoothstep(88., 80., a) * vec3(.42, .2, .05) + smoothstep(132., 140., a) * vec3(.22, .1, .03));
  gl_FragColor = vec4(c, 1.);
}`;
const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, V)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, F)); gl.linkProgram(pr); gl.useProgram(pr);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = n => gl.getUniformLocation(pr, n);
const tex = (unit, w, h, data, nearest) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, nearest ? gl.NEAREST : gl.LINEAR));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, nearest ? gl.REPEAT : gl.CLAMP_TO_EDGE); return t; };
const skyTex = tex(0, 1, 1, new Uint8Array([0, 0, 0, 255]));
{ const a = new Uint8Array(256 * 256 * 4); let sd = 12345; for (let i = 0; i < a.length; i++) { sd = (sd * 1103515245 + 12345) >>> 0; a[i] = sd >>> 24; } tex(1, 256, 256, a, true); }
gl.uniform1i(U('sky'), 0); gl.uniform1i(U('noise'), 1);
const big = gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 8192 && !matchMedia('(pointer:coarse)').matches;   // phones get the 4K sky
const loadSky = src => { const im = new Image(); im.onload = () => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, skyTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); }; im.src = src; };
loadSky(IMG + 'sky4k.jpg'); if (big) setTimeout(() => loadSky(IMG + 'sky8k.jpg'), 500);
function resize(){ const s = Math.min(2, devicePixelRatio || 1); cv.width = hud.width = innerWidth * s; cv.height = hud.height = innerHeight * s; gl.viewport(0, 0, cv.width, cv.height); }
addEventListener('resize', resize); resize();

/* where the telescope looks */
const view = {ra:250, dec:-20, fov:70, upv:null}; let sunMs = W.WEEKS[0].date, zone = 0;
/* The camera keeps its own "up" as it turns (like a real telescope), so it can turn any way, even over the sky's poles.
   view.upv is null for north-up. */
const cross = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]], norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
function basis(){ const f = W.vec(view.ra, view.dec), e = norm([-f[1], f[0], 0]), north = cross(f, e);   // east is to the left on the sky
  let u = north; if (view.upv) { const k = dot(view.upv, f), p = view.upv.map((v, i) => v - f[i] * k); if (Math.hypot(...p) > .2) u = norm(p); }
  view.upv = u; return {f, r:cross(f, u), u}; }
function levelUp(k){ if (!view.upv) return; const f = W.vec(view.ra, view.dec), e = norm([-f[1], f[0], 0]), n = cross(f, e); view.upv = norm(view.upv.map((v, i) => v * (1 - k) + n[i] * k)); }
function project(d, b, tanF){ const z = dot(d, b.f); if (z <= 0) return null; const H = hud.height; return [hud.width/2 + dot(d, b.r) / z / tanF * H/2, H/2 - dot(d, b.u) / z / tanF * H/2]; }
function drawSky(){ const b = basis(), tanF = Math.tan(view.fov / 2 * D2R);
  gl.uniform2f(U('res'), cv.width, cv.height); gl.uniform3fv(U('fw'), b.f); gl.uniform3fv(U('rt'), b.r); gl.uniform3fv(U('up'), b.u); gl.uniform3fv(U('sun'), W.sunDir(sunMs));
  gl.uniform1f(U('tanF'), tanF); gl.uniform2f(U('cen'), ((view.ra * Math.cos(view.dec * D2R) * 60) % 256 + 256) % 256, ((view.dec * 60) % 256 + 256) % 256);
  gl.uniform1f(U('deep'), Math.max(0, Math.min(1, (8 - view.fov) / 6))); gl.uniform1f(U('expo'), 1.4); gl.uniform1f(U('zone'), zone);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return {b, tanF, ppd:hud.height / (2 * tanF) * D2R}; }

/* the real Webb pictures, with soft edges so they melt into the sky */
const pics = {};
function pic(id, cam){ const t = W.byId(id), file = t.img[cam] || Object.values(t.img)[0], key = file;
  if (pics[key]) return pics[key].soft;
  const p = pics[key] = {im:new Image(), soft:null}; p.im.onload = () => { const c = document.createElement('canvas'); c.width = p.im.width; c.height = p.im.height; const x = c.getContext('2d');
    x.drawImage(p.im, 0, 0); x.globalCompositeOperation = 'destination-in'; const e = Math.min(c.width, c.height) * .1;
    const gv = x.createLinearGradient(0, 0, 0, c.height); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(e / c.height, '#000'); gv.addColorStop(1 - e / c.height, '#000'); gv.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gv; x.fillRect(0, 0, c.width, c.height);
    const gh = x.createLinearGradient(0, 0, c.width, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(e / c.width, '#000'); gh.addColorStop(1 - e / c.width, '#000'); gh.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gh; x.fillRect(0, 0, c.width, c.height); p.soft = c; }; p.im.src = IMG + file; return null; }
const thumb = (t, cam) => IMG + (t.img[cam] || Object.values(t.img)[0]);
const noiseCv = (() => { const c = document.createElement('canvas'); c.width = c.height = 160; const x = c.getContext('2d'), d = x.createImageData(160, 160);
  for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255; } x.putImageData(d, 0, 0); return c; })();

/* ================= the screens ================= */
let screen = 'title', week = W.WEEKS[0], cards = [], codeMode = false, codeText = '', run = null, steer = null;
const show0 = (...ids) => ['title', 'weeks', 'plan', 'sys', 'log', 'runbar', 'result', 'album', 'photo', 'card', 'read', 'warn', 'console', 'next', 'mini', 'toCC']
  .forEach(id => $(id).classList.toggle('hidden', !ids.includes(id))) || ($('webb').style.opacity = ids.includes('title') ? 1 : 0);
const show = (...ids) => { if (window.DOC && !ids.includes('card') && !ids.includes('result')) DOC.hide(); show0(...ids); };
const album = W.load('album', {});
const saveAlbum = () => W.save('album', album);

/* a week's goal: which of its pictures are already in the album */
const goalDone = w => w.ids.filter(id => Object.values(album).some(a => a.id === id && (id !== 'wasp96' || a.cam === 'NIRISS')));
const goalHtml = w => { const d = goalDone(w); return `<div style="font-size:12.5px;margin-top:6px">🎯 ${esc(w.goal)}: <b style="color:${d.length === w.ids.length ? '#8fe3a0' : 'var(--gold)'}">${d.length}/${w.ids.length}</b>${d.length === w.ids.length ? ' ✅' : ''}</div>`; };

/* Inside Crater Crew: the way back to the main game, and the free demo's limits (First Light week, Training day). */
const DEMO = !!(window.MR && MR.ED && MR.ED.demo), ccHome = 'index.html' + (W.slot ? '?slot=' + W.slot : '') + '#levels';   // back to Crater Crew's level list
if (DEMO) W.WEEKS = W.WEEKS.filter(w => w.id === 'first');
$('toCC').href = ccHome;
/* Dr. Orbit greets the player by name when Webb is opened from Crater Crew. */
const hi = t => W.player && W.player.name ? t.replace('Hello, cadet!', `Hello, cadet ${W.player.name}!`) : t;
/* --- Webb Academy: Dr. Orbit's campaign --- */
let acad = null;   // the session being played: {s, i, hints, wrong:Set, said:{}}
const acadData = W.load('academy', {}); acadData.done = acadData.done || 0; acadData.at = acadData.at || {};   // at: where you are in each session
const acadSave = () => W.save('academy', acadData);
const acadHtml = () => { const A = W.ACADEMY, n = Math.min(acadData.done, A.length - 1), cur = A[n];
  return `<div class="acad"><div class="acadHead"><b>🎓 Webb Academy</b><small>with Dr. Orbit</small></div>
    <div class="acadRank">Your rank: <b>${W.RANKS[rankNow()].icon} ${esc(W.RANKS[rankNow()].name)}</b></div>
    <div class="acadBadges">${W.RANKS.map((r, i) => `<div title="${esc(r.name)}: ${esc(r.how)}">${badgeSvg(r, i <= rankNow(), 58)}<small>${i <= rankNow() ? esc(r.name) : esc(r.how)}</small></div>`).join('')}</div>
    <div class="acadDots">${A.map((a, i) => `<span class="${i < acadData.done ? 'ok' : i === n ? 'cur' : ''}" title="${esc(a.name)}">${i < acadData.done ? '✓' : i + 1}</span>`).join('<i></i>')}</div>
    <div class="acadNow"><div><b>Session ${n + 1}: ${esc(cur.name)}</b><small>${esc(cur.what)}</small></div>
    ${DEMO && n > 0 ? '<button class="btn" disabled>🔒 Full game</button>' : cur.soon ? '<button class="btn" disabled>Coming soon</button>' : `<button class="btn gold" id="acadGo">▶ ${acadData.at[cur.id] ? `Continue (${acadData.at[cur.id] + 1} of ${cur.ids.length})` : 'Start'}</button>`}</div>
    ${acadData.done ? `<div class="acadAgain">Play again: ${A.slice(0, acadData.done).filter(a => !a.soon).map(a => `<button class="btn small" data-s="${A.indexOf(a)}">${esc(a.name)}</button>`).join('')}</div>` : ''}</div>`; };
function startSession(si){
  const S = W.ACADEMY[si], cur = acadData.at[S.id] || 0;   // pick up where you left off
  acad = {s:si, i:cur, hints:0, wrong:new Set(), said:{}};
  if (cur > 0) { week = W.WEEKS.find(w => w.id === S.week); sunMs = week.date; docMet = true; startSteer(); DOC.say([{text:`Welcome back, ${W.RANKS[rankNow()].name}! Let's keep going.`, mood:'wow'}, {text:acadAsk(), mood:'think'}]); return; }
  week = W.WEEKS.find(w => w.id === S.week); sunMs = week.date; docMet = true;
  startSteer(); DOC.say([...S.intro.map((text, i) => ({text:hi(text), mood:i === 0 ? 'wow' : 'happy', focus:/gauge/.test(text) ? '#read' : null})), {text:acadAsk(), mood:'think'}, ...(S.clue ? [] : [arrowsLine()].filter(Boolean))]);
}
const acadT = () => acad && W.byId(W.ACADEMY[acad.s].ids[acad.i]);
const acadAsk = () => { const S = W.ACADEMY[acad.s], t = acadT(), who = W.RANKS[rankNow()].name;
  return S.clue ? `${who}, here's mystery target ${acad.i + 1}: ${t.clue[0]}` : `Target ${acad.i + 1}: ${t.name}! ${t.kind}, ${t.far} away. Follow the gold arrow.`; };
function acadNext(){
  const S = W.ACADEMY[acad.s], acad_s = acad.s; acad.i++; acad.hints = 0; acad.wrong = new Set(); acad.said = {};
  if (acad.i < S.ids.length) { acadData.at[S.id] = acad.i; acadSave(); startSteer(); DOC.say({text:acadAsk(), mood:'think'}); return; }
  acadData.done = Math.max(acadData.done, acad.s + 1); delete acadData.at[S.id]; acadSave(); acad = null;
  weeks(); showBadge(W.RANKS[acad_s + 1]); DOC.say(S.done.map((text, i) => ({text, mood:'wow'})));
}

/* Your rank: one per finished Academy session; Chief Scientist also needs every picture in the album. */
const allPics = () => W.TARGETS.every(t => Object.keys(t.img).every(cam => album[t.id + '|' + cam]));
const rankNow = () => Math.min(acadData.done, W.ACADEMY.length) + (acadData.done >= W.ACADEMY.length && allPics() ? 1 : 0);
/* Badges: each one is Webb's own mirror, 18 gold hexagons around a medallion, in the rank's own metal.
   Cadet is bronze, then silver, gold, emerald, sapphire, amethyst, and a cosmic one for Chief Scientist. */
const TIERS = [['#ffd9b0', '#c9803f', '#6e3b17', 'Bronze'], ['#ffffff', '#b8c4cf', '#5d6975', 'Silver'], ['#fff3c0', '#f0bf5a', '#9a6516', 'Gold'],
  ['#d2ffe9', '#3fd193', '#11704a', 'Emerald'], ['#d9ecff', '#5aa6ff', '#1b4a96', 'Sapphire'], ['#f3dcff', '#b774ff', '#55248f', 'Amethyst'], ['#fff3c0', '#ff7ad9', '#5a4dff', 'Cosmic']];
const HEXES = (() => { const out = [], r = 9.2, s3 = Math.sqrt(3);
  for (let q = -2; q <= 2; q++) for (let k = -2; k <= 2; k++) { const d = Math.max(Math.abs(q), Math.abs(k), Math.abs(-q - k)); if (d !== 2) continue;
    const x = 60 + r * s3 * (q + k / 2), y = 56 + r * 1.5 * k; out.push(Array.from({length:6}, (_, a) => { const t = Math.PI / 180 * (60 * a - 30); return (x + (r - .9) * Math.cos(t)).toFixed(1) + ',' + (y + (r - .9) * Math.sin(t)).toFixed(1); }).join(' ')); }
  return out; })();
const badgeSvg = (b, got, size = 64) => { const idx = Math.max(0, W.RANKS.indexOf(b)), T = TIERS[Math.min(idx, TIERS.length - 1)], id = 'b' + idx + '_' + size + (got ? 'g' : 'o');
  const [hi, mid, lo] = got ? T : ['#5b6670', '#353d45', '#1d2329'];
  return `<svg class="bsvg${got ? '' : ' off'}" viewBox="0 0 120 134" width="${size}" height="${(size * 134 / 120).toFixed(0)}" aria-hidden="true">
  <defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    <radialGradient id="${id}c" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="${got ? '#24476a' : '#2a3036'}"/><stop offset="1" stop-color="${got ? '#08131f' : '#14181c'}"/></radialGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="${id}k"><circle cx="60" cy="56" r="41"/></clipPath></defs>
  <path d="M40 92 L28 128 L44 119 L52 132 L58 98 Z M80 92 L92 128 L76 119 L68 132 L62 98 Z" fill="${got ? lo : '#2a3036'}" stroke="${got ? mid : '#3a434b'}" stroke-width="1.5"/>
  ${got && idx === 6 ? '<circle cx="60" cy="56" r="56" fill="none" stroke="url(#' + id + 'm)" stroke-width="2" stroke-dasharray="2 5" opacity=".9"/>' : ''}
  <g>${HEXES.map(h => `<polygon points="${h}" fill="url(#${id}m)" stroke="${got ? lo : '#14181c'}" stroke-width="1"/>`).join('')}</g>
  <circle cx="60" cy="56" r="25.5" fill="url(#${id}c)" stroke="url(#${id}m)" stroke-width="4"/>
  <text x="60" y="${got ? 66 : 65}" text-anchor="middle" font-size="${got ? 27 : 24}" ${got ? '' : 'fill="#7c8791" font-weight="700" font-family="sans-serif"'}>${got ? b.icon : '?'}</text>
  ${got ? `<g clip-path="url(#${id}k)"><rect class="glint" x="-60" y="-10" width="40" height="140" fill="url(#${id}s)" transform="skewX(-20)"/></g>` : ''}
  ${got ? Array.from({length:Math.min(idx + 1, 7)}, (_, k) => `<text x="${60 + (k - Math.min(idx, 6) / 2) * 9}" y="104" text-anchor="middle" font-size="9" fill="${hi}">★</text>`).join('') : ''}
  </svg>`; };
function showBadge(b){
  let el = $('badgePop'); if (!el) { el = document.createElement('div'); el.id = 'badgePop'; el.className = 'panel'; document.body.appendChild(el); }
  el.innerHTML = `<div class="bglow">${badgeSvg(b, true, 150)}</div><small>NEW RANK · ${TIERS[Math.min(W.RANKS.indexOf(b), 6)][3].toUpperCase()} BADGE</small><h2>${esc(b.name)}</h2><p>Awarded by Dr. Orbit, Webb Academy</p><button class="btn gold" id="badgeOk">Hooray! ✓</button>`;
  el.classList.remove('hidden'); $('badgeOk').onclick = () => el.classList.add('hidden');
  try { const a = new (window.AudioContext || window.webkitAudioContext)(); [523.3, 659.3, 784, 1046.5].forEach((f, i) => { const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + i * .13;
    o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.08, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .6); o.connect(g).connect(a.destination); o.start(t); o.stop(t + .65); }); } catch (e) {}
}

/* --- the week picker --- */
function weeks(){
  acad = null; screen = 'weeks'; zone = 0; $('webb').style.opacity = 0;
  $('weeks').innerHTML = `${acadHtml()}<h2>Or choose your own observing week</h2><p class="est" style="margin:4px 0 0">Webb's sunshield must always face the Sun, so each week only part of the sky can be seen. These are real dates.</p>
    <div class="grid">${W.WEEKS.map(w => { const vis = W.TARGETS.filter(t => W.inField(t.ra, t.dec, w.date));
      return `<button class="week ${w === week ? 'sel' : ''}" data-w="${w.id}"><b>${esc(w.name)}</b><small>${fmtDate(w.date)}</small><div style="font-size:13px;margin-top:4px">${esc(w.note)}</div>
        <div class="thumbs">${vis.map(t => `<img src="${thumb(t, t.cam)}" alt="${esc(t.name)}" title="${esc(t.name)}">`).join('')}</div><small>${vis.length} targets in view</small>${goalHtml(w)}</button>`; }).join('')}</div>
    <h3 style="margin-top:6px">How do you want to fly Webb?</h3>
    <div class="modes" style="margin-top:8px">
      <button class="mode" data-m="steer"><b>🕹️ Steer it yourself</b><small>Turn the telescope with the arrows, find the target, take the picture. Great for younger crew.</small></button>
      <button class="mode" data-m="cards"><b>🗂️ Plan the week with cards</b><small>Fill in observation cards like real astronomers do in NASA's planning tool, then watch Webb run them.</small></button>
      <button class="mode" data-m="code"><b>💻 Write the script</b><small>Webb really runs JavaScript scripts on board. Write your own plan with loops and ifs.</small></button>
    </div>
    <div class="row" style="margin-top:12px;display:flex;gap:8px"><button class="btn small" id="toAlbum">📔 Album (${Object.keys(album).length})</button><button class="btn small" id="toHow">🛠 How Webb works</button><a class="btn small" href="${ccHome}" style="text-decoration:none;margin-left:auto">◀ Back to the levels</a></div>
    ${DEMO ? `<p class="est" style="margin-top:10px">Free demo: First Light week and Training day. The full game adds every week, Mystery targets and more Academy sessions. <a href="${esc(MR.ED.buyUrl || '#')}" target="_blank" rel="noopener" style="color:var(--gold)">Get the full game</a></p>` : ''}`;
  show('weeks');
  document.querySelectorAll('.week').forEach(b => b.onclick = () => { week = W.WEEKS.find(w => w.id === b.dataset.w); sunMs = week.date; weeks(); });
  document.querySelectorAll('.mode').forEach(b => b.onclick = () => { if (b.dataset.m === 'steer') startSteer(); else { codeMode = b.dataset.m === 'code'; startPlan(); } });
  $('toAlbum').onclick = () => openAlbum(weeks); $('toHow').onclick = () => openHow(weeks);
  if ($('acadGo')) $('acadGo').onclick = () => startSession(Math.min(acadData.done, W.ACADEMY.length - 1));
  document.querySelectorAll('.acadAgain button').forEach(b => b.onclick = () => startSession(+b.dataset.s));
}

/* --- the planner --- */
const visible = t => W.inField(t.ra, t.dec, week.date);
function startPlan(){
  screen = 'plan'; sunMs = week.date; zone = 1;
  const s0 = W.newState(week); view.ra = s0.ra; view.dec = s0.dec; view.fov = 100; view.upv = null;
  if (!cards.length || cards.week !== week.id) { cards = []; cards.week = week.id; }
  if (codeMode && !codeText) codeText = starterCode();
  renderPlan(); show('plan', 'mini');
}
function starterCode(){ const vis = W.TARGETS.filter(visible).slice(0, 3);
  return `// Your plan for the ${week.name} (${fmtDate(week.date)}).
// Webb runs JavaScript on board, too! Commands:
//   webb.slew("id")  webb.camera("NIRCam" | "MIRI" | "NIRISS", "filter")
//   webb.guideStar()  webb.dither(4)  webb.expose(minutes)
//   webb.downlink()  webb.unload()  webb.skip()  webb.log("text")
//   webb.visible("id")  webb.momentum()  webb.recorder()  webb.hours()
// Targets this week: ${W.TARGETS.filter(visible).map(t => t.id).join(', ')}

const plan = ${JSON.stringify(vis.map(t => t.id))};
for (const id of plan) {
  if (!webb.slew(id)) continue;          // not in view this week: try the next one
  if (webb.momentum() > 80) webb.unload();
  webb.camera("NIRCam", "F200W");
  if (webb.guideStar()) {
    webb.dither(4);
    webb.expose(60);
  } else {
    webb.skip();                         // event-driven, like the real Webb
  }
  if (webb.recorder() > 40) webb.downlink();
}
webb.downlink();
`; }
function cardCode(){ return W.cardsToCode(cards); }
function renderPlan(){
  const est = codeMode ? null : W.runCode(cardCode(), week);
  const homeN = est ? new Set(est.home.map(p => p.id)).size : 0;
  $('plan').innerHTML = `<div class="row" style="justify-content:space-between"><div><h2 style="font-size:20px">${esc(week.name)}</h2><span class="est">${fmtDate(week.date)} · 168 hours</span>${goalHtml(week)}</div>
      <div class="row"><button class="btn small" id="back">◀ Weeks</button><button class="btn small" id="howBtn" title="How Webb works">🛠</button><button class="btn small" id="toCode">${codeMode ? '🗂️ Cards' : '💻 JavaScript'}</button></div></div>
    <div><div class="est" style="margin-bottom:4px">${codeMode ? 'Target ids for your script (tap to copy):' : 'Tap a target to add an observation card. Grey ones are behind the Sun this week.'}</div>
      <div id="tlist">${W.TARGETS.map(t => { const v = visible(t), nv = v ? null : W.nextVisible(t, week.date);
        return `<button class="tchip ${v ? '' : 'off'}" data-t="${t.id}" title="${v ? esc(t.kind) : 'In the Sun zone this week' + (nv ? '. Back in view ' + fmtDate(nv) : '')}"><img src="${thumb(t, t.cam)}" alt="">${esc(codeMode ? t.id : t.name)}</button>`; }).join('')}</div></div>
    ${codeMode ? `<textarea id="code" spellcheck="false" aria-label="Your JavaScript plan">${esc(codeText)}</textarea>`
      : `<div id="cards">${cards.length ? cards.map(cardHtml).join('') : '<p class="est">No observations yet. Tap a target above.</p>'}</div>
         <div class="row"><button class="btn small" id="addDL">📡 + Send pictures home</button><button class="btn small" id="addUL">🔥 + Unload momentum</button></div>
         <div class="est">${est ? `This plan uses about <b>${Math.round(est.h)}</b> of 168 hours. ${homeN} picture${homeN === 1 ? '' : 's'} would reach Earth.${est.recorder.length ? ' ⚠ ' + est.recorder.length + ' picture(s) still on the recorder at the end: add "Send pictures home".' : ''}${est.events.some(e => e.type === 'full') ? ' ⚠ The recorder fills up: send pictures home in between.' : ''}${est.events.some(e => e.type === 'guide' && !e.ok) ? ' ⚠ Momentum gets too high: add "Unload momentum".' : ''}` : ''}</div>`}
    <div class="row"><button class="btn gold" id="runBtn" style="flex:1">▶ RUN THE PLAN</button></div>`;
  $('back').onclick = weeks; $('howBtn').onclick = () => openHow(startPlan);
  $('toCode').onclick = () => { if (!codeMode) { codeText = cards.length ? '// Made from your cards. Change anything you like!\n' + cardCode() + '\n' : starterCode(); codeMode = true; }
    else codeMode = false; renderPlan(); };
  document.querySelectorAll('.tchip').forEach(b => b.onclick = () => { const t = W.byId(b.dataset.t);
    if (!visible(t)) { const nv = W.nextVisible(t, week.date); logLine(`☀ ${t.name} is in the Sun zone this week.${nv ? ' It comes back into view on ' + fmtDate(nv) + '.' : ''}`, 'sun'); show('plan', 'mini', 'log'); return; }
    if (codeMode) { const ta = $('code'), at = ta.selectionStart; ta.setRangeText(`"${t.id}"`, at, ta.selectionEnd, 'end'); codeText = ta.value; ta.focus(); return; }
    cards.push({type:'obs', id:t.id, cam:t.cam, filter:W.CAMS[t.cam].filters[t.cam === 'MIRI' ? 1 : t.cam === 'NIRCam' ? 1 : 0], minutes:t.need, dither:4}); renderPlan(); aim(t); });
  if (codeMode) $('code').oninput = e => { codeText = e.target.value; };
  else {
    $('addDL').onclick = () => { cards.push({type:'downlink'}); renderPlan(); };
    $('addUL').onclick = () => { cards.push({type:'unload'}); renderPlan(); };
    document.querySelectorAll('.card').forEach(el => { const i = +el.dataset.i, c = cards[i];
      el.querySelectorAll('[data-k]').forEach(inp => inp.onchange = () => { const k = inp.dataset.k; c[k] = k === 'minutes' || k === 'dither' ? +inp.value : inp.value;
        if (k === 'cam') c.filter = W.CAMS[c.cam].filters[0]; renderPlan(); });
      el.querySelector('.x').onclick = () => { cards.splice(i, 1); renderPlan(); };
      const up = el.querySelector('.up'); if (up) up.onclick = () => { if (i) { [cards[i - 1], cards[i]] = [cards[i], cards[i - 1]]; renderPlan(); } };
      if (c.type === 'obs') el.onmouseenter = () => aim(W.byId(c.id)); });
  }
  $('runBtn').onclick = runPlan;
}
function cardHtml(c, i){
  if (c.type !== 'obs') return `<div class="card op" data-i="${i}"><div class="ct"><span>${c.type === 'downlink' ? '📡 Send pictures home (Deep Space Network)' : '🔥 Unload momentum (fire thrusters)'}</span><span><button class="x up" aria-label="Move up">↑</button><button class="x" aria-label="Remove">×</button></span></div></div>`;
  const t = W.byId(c.id), cam = W.CAMS[c.cam];
  return `<div class="card" data-i="${i}"><div class="ct"><span>🔭 ${esc(t.name)} <small class="est">${esc(t.kind)}</small></span><span><button class="x up" aria-label="Move up">↑</button><button class="x" aria-label="Remove">×</button></span></div>
    <div class="f"><label>Camera <select data-k="cam">${Object.keys(W.CAMS).map(k => `<option ${k === c.cam ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label>Filter <select data-k="filter">${cam.filters.map(f => `<option ${f === c.filter ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
      <label>Minutes <input data-k="minutes" type="number" min="5" max="900" step="5" value="${c.minutes}" style="width:64px"></label>
      <label>Dithers <select data-k="dither">${[1, 2, 4, 8].map(n => `<option ${n === c.dither ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div></div>`;
}
/* while planning, glide the view toward a target so kids see where it is on the sky */
let aimTo = null; const aim = t => { aimTo = t; };

/* --- run a plan: JavaScript in a worker (so a loop that never ends can't freeze the page), then animate it --- */
function runPlan(){
  const code = codeMode ? codeText : cardCode();
  if (!code.trim()) { logLine('Add an observation first.', 'bad'); show('plan', 'mini', 'log'); return; }
  const wk = new Worker('js/webb/worker.js?v=20'); let done = false;
  const timer = setTimeout(() => { if (done) return; wk.terminate(); logLine('Your script ran too long. Is there a loop that never ends?', 'bad'); show('plan', 'mini', 'log'); }, 2500);
  wk.onmessage = e => { done = true; clearTimeout(timer); wk.terminate(); play(e.data, 'plan'); };
  wk.onerror = e => { done = true; clearTimeout(timer); wk.terminate(); logLine('Script error: ' + e.message, 'bad'); show('plan', 'mini', 'log'); e.preventDefault(); };
  wk.postMessage({code, week});
}

/* ================= the run: Webb's systems at work ================= */
const sys = {h:0, mom:15, rec:0, fgs:-1, fgsBad:false, wheels:0, dsn:'Idle', cam:'NIRCam', filter:'F200W', fsm:0};
let speed = 1, toEnd = false, logs = [];
function logLine(text, cls){ logs.push({text, cls}); logs = logs.slice(-4); $('log').innerHTML = logs.map(l => `<div class="${l.cls || ''}">${esc(l.text)}</div>`).join(''); }
function renderSys(){
  const d = Math.floor(sys.h / 24) + 1, hh = Math.floor(sys.h % 24), mm = Math.floor(sys.h * 60 % 60);
  $('sys').innerHTML = `<div class="lab">MISSION CLOCK</div><div class="val">Day ${d} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}</div>
    <div class="lab">REACTION WHEELS</div><canvas id="sysCv" width="500" height="112"></canvas>
    <div class="lab">FINE GUIDANCE SENSOR</div><div class="fgs ${sys.fgsBad ? 'bad' : ''}">${['ID', 'ACQ', 'TRACK', 'FINE'].map((n, i) => `<span class="${i <= sys.fgs ? 'on' : ''}">${n}</span>`).join('')}</div>
    <div class="lab">INSTRUMENT</div><div class="val">${esc(sys.cam)} · ${esc(sys.filter)}</div>
    <div class="lab">MOMENTUM ${Math.round(sys.mom)}%</div><div class="bar mom"><span style="width:${sys.mom}%"></span></div>
    <div class="lab">RECORDER ${sys.rec.toFixed(1)} / ${W.REC_GB} GB</div><div class="bar"><span style="width:${sys.rec / W.REC_GB * 100}%"></span></div>
    <div class="lab">DEEP SPACE NETWORK</div><div class="val" style="font-size:12.5px">${esc(sys.dsn)}</div>`;
}
/* the wheels and the fine steering mirror, drawn every frame */
let wheelAng = 0;
function drawSysCanvas(dt){
  const c = $('sysCv'); if (!c) return; const x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h);
  wheelAng += dt * (2 + sys.wheels * 22 + sys.mom / 10);
  for (let i = 0; i < 6; i++) { const cx = 36 + i * 62, cy = h / 2, r = 24; x.strokeStyle = '#5f6b78'; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    x.strokeStyle = '#c3ced8'; x.lineWidth = 3; for (let k = 0; k < 3; k++) { const a = wheelAng * (i % 2 ? 1 : -1.2) + k * 2.094; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke(); } }
  // fine steering mirror: the guide star's dot held in the middle while locked
  const bx = w - 92, by = 10, bs = h - 20; x.strokeStyle = 'rgba(88,207,190,.6)'; x.lineWidth = 2; x.strokeRect(bx, by, bs, bs);
  x.beginPath(); x.moveTo(bx + bs/2, by + 6); x.lineTo(bx + bs/2, by + bs - 6); x.moveTo(bx + 6, by + bs/2); x.lineTo(bx + bs - 6, by + bs/2); x.strokeStyle = 'rgba(88,207,190,.25)'; x.stroke();
  const j = sys.fgs >= 3 ? 1.5 : 14, t = performance.now(); x.fillStyle = sys.fgsBad ? '#ff7b6c' : '#ffe6a0';
  x.beginPath(); x.arc(bx + bs/2 + Math.sin(t / 97) * j, by + bs/2 + Math.cos(t / 131) * j, 5, 0, 7); x.fill();
  x.font = '600 18px IBM Plex Mono'; x.fillStyle = '#9fb0c0'; x.textAlign = 'center'; x.fillText('MIRROR', bx + bs/2, h - 2);
}
/* run overlay: what the HUD draws during a run */
const ov = {pic:null, exp:0, blurry:false, guide:null, dither:[0, 0], spectrum:null};
/* animations advance by the current speed every frame, so the speed button and pausing work at once */
let paused = false;
const tween = (ms, fn) => new Promise(res => { if (toEnd) { fn(1); return res(); } let k = 0, last = performance.now();
  (function f(){ const now = performance.now(); if (!paused) k = Math.min(1, k + (now - last) * speed / ms); last = now; fn(k);
    if (k < 1 && !toEnd) requestAnimationFrame(f); else { fn(1); res(); } })(); });
const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const slerp = W.slerp;
const fovFor = t => t.spectrum ? .3 : Math.max(t.w, t.h * hud.width / hud.height) * 1.5;
async function play(res, from){
  run = {res, from}; screen = 'run'; speed = 1; toEnd = false; logs = []; $('spd').textContent = 'Speed ×1';
  Object.assign(sys, {h:0, mom:15, rec:0, fgs:-1, fgsBad:false, wheels:0, dsn:'Idle'}); Object.assign(ov, {pic:null, exp:0, blurry:false, guide:null, dither:[0, 0], spectrum:null});
  view.ra = res.start[0]; view.dec = res.start[1]; view.upv = null; view.fov = res.fov || 40; renderSys(); show('sys', 'log', 'runbar', 'mini');
  logLine(`▶ Running your plan for the ${week.name}.`);
  for (const e of res.events) {
    const t = e.id && W.byId(e.id);
    switch (e.type) {
      case 'slew': { ov.pic = null; ov.exp = 0; ov.spectrum = null; sys.fgs = -1; sys.fgsBad = false; logLine(`🛰️ Turning ${e.deg}° to ${t.name} with the reaction wheels…`);
        const a = [view.ra, view.dec], b = [t.ra, t.dec], f0 = view.fov, mid = Math.min(60, Math.max(f0, e.deg * .9 + 10)), f1 = fovFor(t);
        sys.wheels = 1; await tween(1200 + Math.min(2600, e.deg * 30), (rt => k => { const p = rt(ease(k)); view.ra = p[0]; view.dec = p[1]; view.fov = k < .5 ? f0 + (mid - f0) * ease(k * 2) : mid + (f1 - mid) * ease(k * 2 - 1);
          sys.h = lerpH(sys.h, e.h, k); sys.mom = lerpH(sys.mom, e.mom, k); })(W.route(a, b, sunMs)));
        sys.wheels = 0; ov.pic = t; ov.cam = sys.cam; break; }
      case 'camera': sys.cam = e.cam; sys.filter = e.filter; if (ov.pic) ov.cam = e.cam; logLine(`🔧 Instrument: ${e.cam}, filter ${e.filter}.`); await tween(350, () => {}); break;
      case 'guide': { logLine(`⭐ Fine Guidance Sensor looking for a guide star…`); sys.fgsBad = false;
        for (let st = 0; st < 4; st++) { sys.fgs = st; ov.guide = st; renderSys(); if (!e.ok && st === 2) break; await tween(420, () => {}); }
        if (e.ok) logLine('🔒 FINE GUIDE: locked! The fine steering mirror holds Webb perfectly still.', 'good');
        else { sys.fgsBad = true; logLine('⚠ Guide star lost: the reaction wheels are too full of momentum to hold steady. Unload momentum first!', 'bad'); }
        ov.guide = null; break; }
      case 'dither': logLine(`↔ Dither pattern: ${e.n} small shifts, so no star falls into a gap between detectors.`); await tween(500, k => { ov.dither = [Math.sin(k * e.n * Math.PI) * 6, Math.cos(k * e.n * Math.PI * .7) * 4]; }); ov.dither = [0, 0]; break;
      case 'expose': { const tt = W.byId(e.id); ov.blurry = !e.locked; ov.cam = e.cam;
        logLine(`📸 Exposing ${e.minutes >= 120 ? (e.minutes / 60).toFixed(1) + ' hours' : e.minutes + ' minutes'}${e.locked ? '' : ' WITHOUT a guide star (it will be blurry)'}…`, e.locked ? '' : 'bad');
        const r0 = sys.rec, h0 = sys.h, m0 = sys.mom, e0 = ov.exp; await tween(1800 + Math.min(2600, e.minutes * 6), k => { ov.exp = Math.min(1, e0 + (1 - e0) * k * Math.min(1, e.minutes / tt.need)); sys.rec = r0 + (e.rec - r0) * k; sys.h = h0 + (e.h - h0) * k; sys.mom = m0 + (e.mom - m0) * k; });
        if (tt.spectrum) ov.spectrum = e.cam === 'NIRISS' ? tt : 'star';
        break; }
      case 'downlink': { logLine(`📡 Sending ${e.gb} GB home to Goldstone, Madrid or Canberra at 28 megabits per second…`); const r0 = sys.rec, h0 = sys.h;
        await tween(1600, k => { sys.dsn = `Sending… ${Math.round(k * 100)}%`; sys.rec = r0 * (1 - k); sys.h = h0 + (e.h - h0) * k; });
        sys.dsn = 'Idle'; logLine(`✅ ${e.pics.length} picture${e.pics.length === 1 ? '' : 's'} reached Earth!`, 'good'); break; }
      case 'unload': { logLine('🔥 Firing thrusters to unload momentum. The wheels slow down.'); const m0 = sys.mom; await tween(1000, k => { sys.mom = m0 + (e.mom - m0) * k; puff = k < 1; }); puff = false; break; }
      case 'skip': if (e.why === 'sun') logLine(`☀ ${t.name} is in the Sun zone this week: skipped.${e.next ? ' Back in view ' + fmtDate(e.next) + '.' : ''}`, 'sun'); else logLine(`⏭ ${t ? t.name : 'Observation'} skipped.`); await tween(700, () => {}); break;
      case 'full': logLine('⚠ The recorder is full! Send pictures home before taking more.', 'bad'); await tween(900, () => {}); break;
      case 'weekover': logLine('⏰ The week is over (168 hours). The rest of the plan waits for next week.', 'bad'); break;
      case 'error': logLine('⚠ ' + e.text, 'bad'); await tween(900, () => {}); break;
      case 'log': logLine('💬 ' + e.text); await tween(500, () => {}); break;
    }
    if (e.h != null) sys.h = e.h; if (e.mom != null) sys.mom = e.mom; if (e.rec != null) sys.rec = e.rec; renderSys();
  }
  await sleep(toEnd ? 50 : 700); results(res, from);
}
const lerpH = (a, b, k) => a + (b - a) * k; let puff = false;
$('spd').onclick = () => { speed = speed === 1 ? 3 : speed === 3 ? 8 : 1; $('spd').textContent = 'Speed ×' + speed; };
$('toEnd').onclick = () => { toEnd = true; };

/* --- results and the album --- */
function results(res, from){
  screen = 'result'; ov.pic = null; ov.spectrum = null;
  const got = res.home.map(p => ({p, t:W.byId(p.id), g:W.grade(p)}));
  got.forEach(({p, g}) => { const k = p.id + '|' + p.cam, old = album[k]; if (!old || old.stars < g.stars) album[k] = {id:p.id, cam:p.cam, filter:p.filter, stars:g.stars, minutes:p.minutes, dither:p.dither, locked:p.locked, week:week.id}; });
  saveAlbum();
  const skipped = res.events.filter(e => e.type === 'skip' && e.why === 'sun').length, left = res.recorder.length, gd = goalDone(week);
  $('result').innerHTML = `<h2>${got.length ? 'Pictures from Webb!' : 'No pictures reached Earth'}</h2>
    <p class="est">The plan took ${Math.round(res.h)} of 168 hours.${skipped ? ` ${skipped} target(s) were in the Sun zone.` : ''}${left ? ` ⚠ ${left} picture(s) stayed on the recorder: they never reached Earth. Add "Send pictures home" at the end.` : ''}</p>
    ${gd.length === week.ids.length ? `<p style="color:#8fe3a0;font-weight:600">🎯 Week goal complete: ${esc(week.goal)}! ✅</p>` : `<p class="est">🎯 Week goal: ${esc(week.goal)} (${gd.length}/${week.ids.length}).</p>`}
    <div class="pics">${got.map(({p, t, g}) => `<button class="pic" data-k="${p.id}|${p.cam}"><img src="${thumb(t, p.cam)}" alt=""><b>${esc(t.name)}</b><small class="stars">${'★'.repeat(g.stars)}${'☆'.repeat(3 - g.stars)}</small></button>`).join('')}</div>
    <div class="row" style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${from === 'plan' ? '<button class="btn gold" id="again">◀ Change the plan</button>' : '<button class="btn gold" id="again">🕹️ Steer to another target</button>'}<button class="btn" id="other">Other week</button><button class="btn" id="alb">📔 Album</button></div>`;
  show('result', 'mini');
  { const best = got[0], tip = best && best.g.checks.find(c => !c.ok);
    if (!got.length) DOC.say({text:left ? 'Oh no! The pictures are still on Webb\'s recorder. Send them home through the Deep Space Network!' : 'Hmm, no pictures came home this time. Let\'s try again!', mood:'worried'});
    else if (gd.length === week.ids.length) DOC.say([{text:`You did it! The whole week goal is done. Real astronomers would be proud of you!`, mood:'wow'}, {text:`Did you know? ${best.t.more}`}]);
    else if (tip) DOC.say([{text:`Nice, a picture of ${best.t.name}! To make it even better: ${tip.label.toLowerCase()}.`, mood:'think'}]);
    else DOC.say([{text:`Wow, look at ${best.t.name}! Three stars!`, mood:'wow'}, {text:`Did you know? ${best.t.more}`}]); }
  document.querySelectorAll('#result .pic').forEach(b => b.onclick = () => openPhoto(b.dataset.k, () => results(res, from)));
  $('again').onclick = () => from === 'plan' ? startPlan() : acad ? acadNext() : startSteer();
  if (acad && from === 'steer') { const S = W.ACADEMY[acad.s]; $('again').textContent = acad.i + 1 < S.ids.length ? '▶ Next target' : '🎓 Finish the session'; $('other').textContent = '◀ Academy'; }
  $('other').onclick = weeks; $('alb').onclick = () => openAlbum(() => results(res, from));
}
function openAlbum(back){
  $('album').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2>📔 Your Webb Album</h2><button class="btn small" id="albBack">◀ Back</button></div>
    <p class="est">${Object.keys(album).length} of ${W.TARGETS.length + 1} pictures. Some targets can only be seen in certain weeks, and the Southern Ring looks different with each camera.</p>
    <div class="pics">${[...W.TARGETS.flatMap(t => Object.keys(t.img).map(cam => [t, cam]))].map(([t, cam]) => { const a = album[t.id + '|' + cam];
      return a ? `<button class="pic" data-k="${t.id}|${cam}"><img src="${thumb(t, cam)}" alt=""><b>${esc(t.name)}${Object.keys(t.img).length > 1 ? ' · ' + cam : ''}</b><small class="stars">${'★'.repeat(a.stars)}${'☆'.repeat(3 - a.stars)}</small></button>`
        : `<div class="pic lock"><div style="aspect-ratio:4/3;border-radius:7px;background:#0b1015;display:grid;place-items:center;font-size:30px">?</div><b>${esc(t.kind)}</b><small style="color:var(--muted)">${esc(t.when)}</small></div>`; }).join('')}</div>`;
  show('album', 'mini'); $('albBack').onclick = back;
  document.querySelectorAll('#album .pic[data-k]').forEach(b => b.onclick = () => openPhoto(b.dataset.k, () => openAlbum(back)));
}
function openPhoto(key, back){
  const a = album[key] || {}, [id, cam] = key.split('|'), t = W.byId(id), g = a.id ? W.grade(a) : {checks:[], stars:0};
  const noWater = t.spectrum && cam !== 'NIRISS';
  $('photo').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2>${esc(t.name)}</h2><button class="btn small" id="phBack">◀ Back</button></div>
    <img class="big" src="${IMG + (t.img[cam] || Object.values(t.img)[0])}" alt="${esc(t.name)}">
    <p><b>${esc(t.where)}</b> · ${esc(t.kind)} · ${esc(t.far)} away · Webb took it in ${esc(t.when)} with ${esc(t.cam)}.</p>
    ${noWater ? '<p style="color:var(--warn)">You photographed the star, but to find water in the planet\'s air you need NIRISS, which splits the light into its colors.</p>' : ''}
    <p>${esc(t.kid)}</p><p class="est">${esc(t.more)}</p>
    <div class="checks"><span class="stars">${'★'.repeat(g.stars)}${'☆'.repeat(3 - g.stars)}</span>${g.checks.map(c => `<div>${c.ok ? '✅' : '⬜'} ${esc(c.label)}</div>`).join('')}</div>
    <p class="credit">Image: ${esc(t.credit)}</p>`;
  show('photo', 'mini'); $('phBack').onclick = back;
}

/* ================= How Webb works: the parts in the systems panel, at kid level ================= */
const HOW = [
  ['🛡️', 'Sunshield', 'Five thin layers as big as a tennis court. The side facing the Sun gets hotter than boiling water; the telescope side is colder than −230 °C. That cold lets Webb see faint heat (infrared) light. This is why Webb must never point toward the Sun.'],
  ['🟡', 'Gold mirror', '18 six-sided mirror pieces, 6.5 meters across, coated with a very thin layer of real gold. Gold reflects infrared light very well.'],
  ['⚙️', 'Reaction wheels', 'Six heavy wheels spin inside Webb. Spin one faster and the whole telescope turns the other way, slowly, with no fuel at all.'],
  ['🧭', 'Star trackers and gyroscopes', 'Small cameras recognize star patterns, like a map, and gyroscopes feel every turn. Together they tell Webb which way it is facing.'],
  ['🎯', 'Fine Guidance Sensor', 'Built by Canada. It finds a guide star in 4 steps: IDENTIFY, ACQUIRE, TRACK, FINE GUIDE. Then it checks the star 16 times every second.'],
  ['🪞', 'Fine steering mirror', 'A small mirror that tilts by tiny amounts many times a second, so the picture stays perfectly still, even during hours-long exposures.'],
  ['🔥', 'Momentum and thrusters', 'Sunlight gently pushes on the huge sunshield, so the wheels slowly spin faster and faster. Every so often Webb fires small thrusters to "unload" that spin.'],
  ['📷', 'Instruments', 'NIRCam is the main camera (near-infrared). MIRI sees longer infrared light and is cooled to −266 °C. NIRISS, from Canada, splits light into colors to read the air of planets. NIRSpec measures the light of up to 100 objects at once.'],
  ['💻', 'Electronics', 'Each detector is read by special chips (SIDECAR ASICs) that engineers can reprogram from Earth. A computer runs all the instruments and packs every picture into data. The observation plan runs as JavaScript scripts on board: if a step fails, Webb skips that observation and goes on.'],
  ['💾', 'Recorder', 'About 65 GB of memory hold the pictures until they can be sent home.'],
  ['📡', 'Deep Space Network', 'Big dishes in California, Spain and Australia. About twice a day, Webb sends its pictures home at 28 megabits per second, in contacts of about 4 hours.'],
  ['🌍', 'Where Webb lives', '1.5 million kilometers from Earth, at a spot called L2, where it circles slowly with the Sun and Earth always behind its sunshield.'],
];
function openHow(back){
  $('photo').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><h2>🛠 How Webb works</h2><button class="btn small" id="phBack">◀ Back</button></div>
    <p class="est">The parts you see in the systems panel, and what they really do.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;margin-top:8px">${HOW.map(([ic, h, txt]) => `<div class="card" style="border-left-color:var(--gold)"><div style="font-size:24px">${ic}</div><b style="font-size:15px">${esc(h)}</b><div style="margin-top:4px">${esc(txt)}</div></div>`).join('')}</div>
    <p class="est" style="margin-top:10px">From NASA, STScI and JPL documents about Webb's attitude control, guidance sensor, recorder, communications and onboard scripts.</p>`;
  const was = [...document.querySelectorAll('body > .panel, body > div, body > button')].filter(el => !el.classList.contains('hidden')).map(el => el.id);
  show('photo', 'mini'); $('phBack').onclick = () => back ? back() : show(...was.filter(id => id !== 'photo'));
}
$('sys').style.cursor = 'pointer'; $('sys').title = 'How Webb works';
$('sys').onclick = () => { if (screen === 'run') { paused = true; openHow(() => { paused = false; show('sys', 'log', 'runbar', 'mini'); }); } };

/* ================= hand steering ================= */
let keys = {x:0, y:0}, vra = 0, vdec = 0, held = 0, step = {x:0, y:0}, fine = false, warnT = -1e9;
/* Dr. Orbit's lines */
let docMet = false, readyOnce = false, zoomSaid = false, docWarnT = -1e9;
const docLine = t => `Can you find ${t.name} for me? ${t.kind}, ${t.far} away. ${t.kid}`;
const docTarget = () => DOC.say({text:docLine(steer)});
function startSteer(){
  screen = 'steer'; sunMs = week.date; zone = 1;
  const vis = W.TARGETS.filter(visible); steer = acad ? acadT() : steer && vis.includes(steer) ? steer : vis.find(t => week.ids.includes(t.id)) || vis[0];   // start with a target from the week's goal
  const s0 = W.newState(week); view.ra = s0.ra; view.dec = s0.dec; view.fov = 60; view.upv = null; vra = vdec = 0;
  $('card').innerHTML = `<h3>Find: <select id="tsel">${vis.map(t => `<option value="${t.id}" ${t === steer ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></h3>
    <p>${esc(fmtDate(week.date))}. Follow the gold arrow, zoom in, then take the picture.</p><div class="row" style="display:flex;gap:6px;margin-top:8px"><button class="btn small" id="sBack">◀ Weeks</button><button class="btn small" id="sAlb">📔 Album</button></div>`;
  readyOnce = false; zoomSaid = false;
  if (acad) { acadCard(); show('card', 'read', 'console', 'mini'); return; }
  $('tsel').onchange = e => { steer = W.byId(e.target.value); docTarget(); readyOnce = false; zoomSaid = false; };
  if (!docMet) { docMet = true; DOC.say([{text:hi(`Hello, cadet! I'm Dr. Orbit, Webb's one-man science team. I need your help to find things in space!`), mood:'wow'}, {text:docLine(steer)},
    ...[arrowsLine()].filter(Boolean), {text:`Keep the Sun angle in the green, or the Sun would shine on Webb's mirror!`, mood:'think', focus:'#read'}]); }
  else docTarget();
  $('sBack').onclick = weeks; $('sAlb').onclick = () => openAlbum(startSteer);
  show('card', 'read', 'console', 'mini');
}
function acadCard(){
  const S = W.ACADEMY[acad.s], t = steer, n = S.ids.length;
  $('card').innerHTML = S.clue
    ? `<h3>🎓 Mystery target ${acad.i + 1} of ${n}</h3><p>🕵️ ${esc(t.clue[0])}</p>${acad.hints ? `<p>💡 ${esc(t.clue[1])}</p>` : ''}${acad.hints > 1 ? '<p>💡 The gold mark on your gauge shows where it is.</p>' : ''}${acad.hints > 2 ? '<p>💡 The gold arrow points to it.</p>' : ''}
      <div class="row" style="display:flex;gap:6px;margin-top:8px"><button class="btn small" id="sBack">◀ Academy</button>${acad.hints < 3 ? `<button class="btn small" id="hint">💡 Hint (${3 - acad.hints} left)</button>` : ''}</div>`
    : `<h3>🎓 ${esc(S.name)} · ${acad.i + 1} of ${n}</h3><p><b style="color:var(--fg)">${esc(t.name)}</b>: ${esc(t.kind)}, ${esc(t.far)} away.</p><div class="row" style="display:flex;gap:6px;margin-top:8px"><button class="btn small" id="sBack">◀ Academy</button></div>`;
  $('sBack').onclick = weeks;
  if ($('hint')) $('hint').onclick = () => { acad.hints++; acadCard();
    DOC.say({text:acad.hints === 1 ? `Here's another clue: ${t.clue[1]}` : acad.hints === 2 ? `Look at your gauge! I put a gold mark on it. The target is at sun ${W.toSun(t.ra, t.dec, sunMs)[0].toFixed(0)} degrees, around ${((W.toSun(t.ra, t.dec, sunMs)[1] / D2R + 360) % 360).toFixed(0)} degrees.` : 'OK, OK! Follow the gold arrow.', mood:'think'}); };
}
const clueMode = () => acad && W.ACADEMY[acad.s].clue;
/* In clue mode, the "aim" is whichever target is near the middle; otherwise it's the one you were asked for. */
function aimTarget(){ if (!clueMode()) return steer; let best = null, bd = 1e9;
  W.TARGETS.filter(visible).forEach(t => { const d = W.sep(view.ra, view.dec, t.ra, t.dec); if (d < bd) { bd = d; best = t; } });
  return bd < view.fov * .14 ? best : null; }
function steerStep(dt, t){
  if (lev) zoomBy(Math.exp(-lev * Math.abs(lev) * dt * 1.6));   // the further you pull the lever, the faster it zooms
  held = keys.x || keys.y ? held + dt : 0;
  const ramp = Math.min(1, Math.max(0, held - .15) / 1.6), sp = view.fov * (.016 + .2 * ramp * ramp);   // a tap is a small step; holding speeds up for long turns
  vra += (keys.x * sp - vra) * Math.min(1, dt * 7); vdec += (keys.y * sp - vdec) * Math.min(1, dt * 7);
  let mra = vra * dt, mdec = vdec * dt; const sx = step.x * Math.min(1, dt * 10), sy = step.y * Math.min(1, dt * 10); step.x -= sx; step.y -= sy; mra += sx; mdec += sy;
  const tsep = W.sep(view.ra, view.dec, steer.ra, steer.dec), aim = aimTarget(), asep = aim ? W.sep(view.ra, view.dec, aim.ra, aim.dec) : 1e9;
  fine = !!aim && !keys.x && !keys.y && asep < view.fov * .14 && asep > .001;
  const b = basis();
  if (fine) { const k = Math.min(1, dt * 1.6), tv = W.vec(aim.ra, aim.dec); mra += dot(tv, b.r) / D2R * k; mdec += dot(tv, b.u) / D2R * k; }
  const nf = norm(b.f.map((v, i) => v + (b.r[i] * mra + b.u[i] * mdec) * D2R)), nra = ((Math.atan2(nf[1], nf[0]) / D2R) + 360) % 360, ndec = Math.asin(Math.max(-1, Math.min(1, nf[2]))) / D2R;
  const out = x => x < 85 ? 85 - x : x > 135 ? x - 135 : 0, a0 = out(W.sunAngle(view.ra, view.dec, sunMs)), a1 = out(W.sunAngle(nra, ndec, sunMs));
  if (a1 > 0 && a1 >= a0) { const p = W.clampToBand(nra, ndec, sunMs); view.ra = p[0]; view.dec = p[1]; warnT = t;  if (t - docWarnT > 20000 && !DOC.pending) { docWarnT = t; DOC.say({text:'Whoa, whoa! Not that way! The Sun would shine on the mirror. Slide along the edge instead.', mood:'worried'}); } }   // slide along the Sun limit: Webb can still spin all the way around the Sun
  else { view.ra = nra; view.dec = ndec; }
  const A = aim || steer, zoomed = view.fov < fovFor(A) * 3, near = !!aim && asep < Math.max(.02, fovFor(A) * .2), centered = near && zoomed;
  const ready = centered && aim === steer;
  if (acad && centered && aim !== steer && !acad.wrong.has(aim.id)) { acad.wrong.add(aim.id);
    DOC.say({text:`That's ${aim.name}: ${aim.kind.toLowerCase()}. Beautiful, but not the one I mean! Remember: ${steer.clue[0]}`, mood:'think'}); }
  if (acad && !clueMode()) acadGuide(tsep, near, zoomed, ready);
  if (near && !zoomed && !zoomSaid && !DOC.pending) { zoomSaid = true; if (tipOnce('zoom')) DOC.say({text:'Great! Now use the red knob on the ZOOM lever: pull it up to zoom in on the spot!', mood:'wow', focus:'#lknob'}); }
  const tip = ready ? '' : (!aim || asep > view.fov * .14) ? (clueMode() ? (acad.hints > 2 ? '<b>Step 1 of 3:</b> follow the gold arrow' : '<b>Step 1 of 3:</b> find a gold <b>?</b> that matches the clue') : '<b>Step 1 of 3:</b> follow the gold arrow to the target') :
    (clueMode() && acad.wrong.has(aim.id)) ? 'Not this one: look for another gold <b>?</b>' :
    !near ? '<b>Step 2 of 3:</b> let go of the arrows, Webb centers it' : !zoomed ? '<b>Step 3 of 3:</b> pull the red <b>ZOOM</b> knob up' : '';
  $('next').innerHTML = tip; $('next').classList.toggle('hidden', !tip || screen !== 'steer'); $('lever').classList.toggle('pulse', near && !zoomed);
  dash(t, a1 > 0 || t - warnT < 600, !!aim && asep < view.fov * .14, centered, ready);
  if (ready && !readyOnce) { readyOnce = true; const show = tipOnce('shoot');
    DOC.say({text:(clueMode() ? `Yes! You found it: ${steer.name}!` : `Perfect! ${steer.name} is right in the middle.`) + (show ? ' Now press the big red TAKE PICTURE button!' : ' Take the picture!'), mood:'wow', focus:show ? '#shoot' : null}); }
  $('shoot').disabled = !ready; $('shoot').classList.toggle('armed', ready); $('warn').classList.toggle('hidden', t - warnT > 2500);
  drawGauge(tsep);
}
/* The first two times a control is needed, Dr. Orbit names it and it glows on the dashboard. Saved per player. */
const tipsSeen = W.load('tips', {});
const tipOnce = k => (tipsSeen[k] || 0) < 2 ? (tipsSeen[k] = (tipsSeen[k] || 0) + 1, W.save('tips', tipsSeen), true) : false;
const arrowsLine = () => tipOnce('arrows') ? {text:'Use the arrow buttons on the dashboard to turn Webb. Follow the gold arrow on the screen!', focus:'#pad8'} : null;
/* Training day: Dr. Orbit explains each step the first time it comes up. */
function acadGuide(tsep, near, zoomed, ready){ const sd = acad.said, once = (k, text, mood) => { if (!sd[k] && !DOC.busy) { sd[k] = 1; DOC.say({text, mood}); } };
  if (acad.i > 0) return;   // he explains it all on the first target only
  if (tsep < view.fov * .45 && !near) once('see', 'There it is, inside the gold circle! Steer toward the middle, then let go of the arrows: Webb\'s fine steering mirror centers it for you.');
}
/* Dashboard lamps, the zoom readout and Webb's six reaction wheels (they spin faster when you turn). */
let wheelA = 0;
function dash(t, sunBad, onT, zoomedIn, ready){
  const L = (id, c) => { $(id).className = c; };
  L('lSun', sunBad ? 'r' : 'g'); L('lTgt', onT ? 'g' : ''); L('lZm', zoomedIn ? 'g' : ''); L('lRdy', ready ? 'g' : '');
  $('zread').textContent = view.fov < 2 ? view.fov.toFixed(2) + '°' : view.fov.toFixed(0) + '°'; $('camName').textContent = steer ? steer.cam : '';
  const c = $('rw'), x = c.getContext('2d'), spd = Math.min(1, (Math.abs(vra) + Math.abs(vdec)) / Math.max(.01, view.fov * .1)); wheelA += .02 + spd * .5;
  x.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < 6; i++) { const cx = 28 + i * 53, cy = 28, r = 22, a = wheelA * (i % 2 ? -1 : 1) + i;
    x.strokeStyle = spd > .05 ? '#7fe0ff' : '#5b6670'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    x.lineWidth = 2.5; for (let k = 0; k < 3; k++) { const b = a + k * 2.094; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(b) * r, cy + Math.sin(b) * r); x.stroke(); } }
}
/* The big Sun gauge: the angle from the Sun must stay 85-135 (green), but Webb may spin all the way around the Sun (0-360). */
let gaugeHtml = '';
function drawGauge(tsep){
  const sa = W.sunAngle(view.ra, view.dec, sunMs), ar = (W.toSun(view.ra, view.dec, sunMs)[1] / D2R + 360) % 360;
  const ts = W.toSun(steer.ra, steer.dec, sunMs), tar = (ts[1] / D2R + 360) % 360;
  if (!$('gauge')) $('read').innerHTML = `<canvas id="gauge" width="480" height="270"></canvas><div class="gl"><span>SUN ANGLE</span><b id="gSun"></b><small>stay in the green (85° to 135°)</small></div>
    <div class="gl"><span>AROUND THE SUN</span><b id="gAr"></b><small>spin all the way (0° to 360°)</small></div><div class="gt" id="gT"></div><div class="gs" id="gS"></div>`;
  const cv2 = $('gauge'), x = cv2.getContext('2d'), cx = 240, cy = 236, R = 190, A = d => Math.PI + d / 180 * Math.PI;
  x.clearRect(0, 0, 480, 270); x.lineWidth = 26;
  [[0, 85, '#a8432f'], [85, 135, '#3fae7a'], [135, 180, '#a8432f']].forEach(([a, b, c]) => { x.strokeStyle = c; x.beginPath(); x.arc(cx, cy, R, A(a), A(b)); x.stroke(); });
  x.fillStyle = '#fff'; x.font = '600 22px "IBM Plex Mono", monospace'; x.textAlign = 'center';
  [0, 85, 135, 180].forEach(d => { const a = A(d); x.fillText(d + '°', cx + Math.cos(a) * (R - 44), cy + Math.sin(a) * (R - 44) + 8); });
  x.font = '30px sans-serif'; x.fillText('☀', cx - R - 2, cy + 36);
  const tick = (d, col, len, w) => { const a = A(Math.max(0, Math.min(180, d))); x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len)); x.lineTo(cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18)); x.stroke(); };
  const secret = clueMode() && acad.hints < 2; if (!secret) tick(ts[0], '#f0bf5a', 30, 8);
  const a = A(sa); x.strokeStyle = '#fff'; x.lineWidth = 7; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8)); x.stroke(); x.lineCap = 'butt';
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 12, 0, 7); x.fill();
  const ok = sa >= 84.5 && sa <= 135.5;
  $('gSun').textContent = sa.toFixed(0) + '°'; $('gSun').style.color = ok ? '#7fe0a8' : '#ff8a6a'; $('gAr').textContent = ar.toFixed(0) + '°';
  $('gT').innerHTML = secret ? '<span style="color:var(--gold)">▮ Mystery target</span>: use the clues!' : `<span style="color:var(--gold)">▮ ${esc(clueMode() && !readyOnce ? 'Mystery target' : steer.name)}</span>: sun ${ts[0].toFixed(0)}°, around ${tar.toFixed(0)}° · ${tsep < 1 ? (tsep * 60).toFixed(0) + "'" : tsep.toFixed(0) + '°'} away`;
  $('gS').textContent = `RA ${(view.ra / 15).toFixed(2)} h · DEC ${view.dec.toFixed(1)}° · VIEW ${view.fov < 2 ? view.fov.toFixed(2) : view.fov.toFixed(0)}°`;
}
$('shoot').onclick = () => { const s = W.newState(week); s.ra = steer.ra; s.dec = steer.dec; const webb = W.api(s);
  webb.slew(steer.id); webb.camera(steer.cam, W.CAMS[steer.cam].filters[steer.cam === 'NIRISS' ? 0 : 1]); if (webb.guideStar()) { webb.dither(4); webb.expose(steer.need); } webb.downlink();
  play({events:s.events.filter(e => e.type !== 'slew'), home:s.home, recorder:s.recorder, h:s.h, start:[steer.ra, steer.dec], fov:fovFor(steer)}, 'steer').then(() => {});
  setTimeout(() => { ov.pic = steer; }, 0); };
const KX = {ArrowLeft:-1, a:-1, ArrowRight:1, d:1}, KY = {ArrowUp:1, w:1, ArrowDown:-1, s:-1};
const nudge = (x, y) => { step.x += x * view.fov * .025; step.y += y * view.fov * .025; };
addEventListener('keydown', e => { if (screen !== 'steer' || e.repeat || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  if (KX[e.key] != null) { keys.x = KX[e.key]; nudge(keys.x, 0); } if (KY[e.key] != null) { keys.y = KY[e.key]; nudge(0, keys.y); }
  if (e.key === '+' || e.key === '=') zoomBy(.8); if (e.key === '-') zoomBy(1.25); });
addEventListener('keyup', e => { if (KX[e.key] != null) keys.x = 0; if (KY[e.key] != null) keys.y = 0; });
/* The dashboard: 8 arrow keys (diagonals too) and STOP in the middle. */
document.querySelectorAll('#pad8 button').forEach(bt => { const [x, y] = bt.dataset.d.split(',').map(Number);
  bt.onpointerdown = e => { e.preventDefault(); if (!x && !y) { keys.x = keys.y = 0; vra = vdec = 0; step.x = step.y = 0; return; }
    const k = x && y ? Math.SQRT1_2 : 1; keys.x = x * k; keys.y = y * k; nudge(x * k, y * k); bt.classList.add('on'); };
  bt.onpointerup = bt.onpointerleave = bt.onpointercancel = () => { keys.x = 0; keys.y = 0; bt.classList.remove('on'); }; });
/* The zoom lever: grab the red knob and pull it up to zoom in, down to zoom out. It springs back to the middle. */
let lev = 0, levDrag = null;
const levSet = d => { lev = Math.max(-1, Math.min(1, d)); $('lknob').style.transform = `translateY(${(-lev * ($('ltrack').clientHeight / 2 - 12)).toFixed(1)}px)`; };
$('ltrack').addEventListener('pointerdown', e => { e.preventDefault(); const r = $('ltrack').getBoundingClientRect(), cy = r.top + r.height / 2;
  levDrag = {cy, h:r.height / 2 - 12, moved:false}; $('ltrack').setPointerCapture(e.pointerId); $('lknob').classList.add('drag');
  if (e.target !== $('lknob')) levDrag.tap = (cy - e.clientY) / levDrag.h; });
$('ltrack').addEventListener('pointermove', e => { if (!levDrag) return; levDrag.moved = true; levSet((levDrag.cy - e.clientY) / levDrag.h); });
const levUp = () => { if (!levDrag) return; if (!levDrag.moved && levDrag.tap != null) zoomBy(levDrag.tap > 0 ? .7 : 1.43);   // a tap above or below the knob is one zoom step
  levDrag = null; $('lknob').classList.remove('drag'); levSet(0); };
$('ltrack').addEventListener('pointerup', levUp); $('ltrack').addEventListener('pointercancel', levUp);
$('tSound').checked = DOC.sound; $('tSound').onchange = e => { DOC.sound = e.target.checked; };
const zoomBy = k => { const lo = steer ? Math.min(.3, fovFor(steer) * .8) : .3; view.fov = Math.max(lo, Math.min(70, view.fov * k)); };   // tiny targets (the quasar) may zoom in further
addEventListener('wheel', e => { if (screen === 'steer') zoomBy(e.deltaY > 0 ? 1.12 : .89); }, {passive:true});
let drag = null; cv.addEventListener('pointerdown', e => { if (screen === 'steer') drag = [e.clientX, e.clientY]; });
addEventListener('pointerup', () => { if (drag) { drag = null; keys.x = keys.y = 0; } });
addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; keys.x = Math.max(-1, Math.min(1, -dx / 60)); keys.y = Math.max(-1, Math.min(1, dy / 60)); });

/* ================= the frame loop ================= */
let last = performance.now(), sysT = 0;
function frame(t){
  const dt = Math.min(.05, (t - last) / 1000); last = t;
  if (screen === 'title' || screen === 'weeks') { view.ra = (view.ra + dt * 1.2) % 360; view.dec = -20 + 8 * Math.sin(t / 9000); view.fov = 70; view.upv = null; }
  if (screen === 'plan' && aimTo) { const p = W.route([view.ra, view.dec], [aimTo.ra, aimTo.dec], sunMs)(Math.min(1, dt * 2)); view.ra = p[0]; view.dec = p[1]; view.fov += (60 - view.fov) * Math.min(1, dt * 2); }
  if (screen === 'steer') steerStep(dt, t);
  if ((screen === 'run' && !sys.wheels) || (screen === 'steer' && steer && W.sep(view.ra, view.dec, steer.ra, steer.dec) < view.fov * .5)) levelUp(Math.min(1, dt * 2));   // near a target, roll gently back to north-up so pictures come out straight
  const g = drawSky(); const W2 = hud.width, H = hud.height, s = H / 900; hc.clearRect(0, 0, W2, H);
  if (screen === 'title') $('webb').style.transform = `translate(-50%,-50%) translate(${Math.sin(t / 3000) * 10}px, ${Math.sin(t / 2300) * 8}px) rotate(${Math.sin(t / 4000) * 1.5}deg)`;
  if (screen === 'plan') markers(g, s);
  if (screen === 'steer') steerHud(g, s, t);
  if (screen === 'run' || screen === 'result') runHud(g, s, t);
  if (!$('mini').classList.contains('hidden')) miniHud(g, s, t);
  if (screen === 'run') { if (t - sysT > 120) { sysT = t; renderSys(); } drawSysCanvas(dt); }   // the clock, bars and lights move during each step
  requestAnimationFrame(frame);
}
/* planning: every target of the week on the sky, gold if in view, grey in the Sun zone */
function markers(g, s){
  W.TARGETS.forEach(t => { const p = project(W.vec(t.ra, t.dec), g.b, g.tanF); if (!p) return; const v = visible(t);
    hc.strokeStyle = v ? 'rgba(240,191,90,.9)' : 'rgba(160,170,180,.5)'; hc.lineWidth = 2 * s; hc.beginPath(); hc.arc(p[0], p[1], 14 * s, 0, 7); hc.stroke();
    hc.font = `600 ${13 * s}px 'IBM Plex Mono', monospace`; hc.textAlign = 'center'; hc.fillStyle = v ? '#f0bf5a' : 'rgba(170,180,190,.7)'; hc.fillText(t.name.toUpperCase(), p[0], p[1] - 22 * s); });
}
function frameBox(s){ const fr = Math.min(hud.width, hud.height) * .16; hc.strokeStyle = 'rgba(88,207,190,.7)'; hc.lineWidth = 2 * s;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sy]) => { const x0 = hud.width/2 + sx*fr, y0 = hud.height/2 + sy*fr*.6; hc.beginPath(); hc.moveTo(x0, y0 - sy*fr*.18); hc.lineTo(x0, y0); hc.lineTo(x0 - sx*fr*.18, y0); hc.stroke(); }); }
function drawTarget(t, cam, g, alpha, blurry, exp){
  const c = project(W.vec(t.ra, t.dec), g.b, g.tanF); if (!c || t.spectrum) return; const im = pic(t.id, cam); if (!im) return;
  const w = t.w * g.ppd * 1.15, h = t.h * g.ppd * 1.15; if (w < 3) return;
  const n = project(W.vec(t.ra, Math.min(89.9, t.dec + .01)), g.b, g.tanF), rot = n ? Math.atan2(n[0] - c[0], c[1] - n[1]) : 0;   // north on the picture follows north on the sky
  hc.save(); hc.translate(c[0] + ov.dither[0], c[1] + ov.dither[1]); hc.rotate(rot); const x = -w/2, y = -h/2;
  if (blurry) { hc.globalAlpha = alpha * .22; for (let k = 0; k < 6; k++) hc.drawImage(im, x + Math.cos(k) * 9, y + Math.sin(k * 1.7) * 7, w, h); }
  else { hc.globalAlpha = alpha; hc.drawImage(im, x, y, w, h); }
  if (exp != null && exp < 1) { hc.globalAlpha = (1 - exp) * .75 * alpha; hc.drawImage(noiseCv, x, y, w, h); }
  hc.restore(); hc.globalAlpha = 1;
}
function runHud(g, s, t){
  frameBox(s);
  if (ov.pic) drawTarget(ov.pic, ov.cam || ov.pic.cam, g, Math.max(.06, ov.exp), ov.blurry, ov.exp);
  if (ov.pic && ov.pic.spectrum) { const c = project(W.vec(ov.pic.ra, ov.pic.dec), g.b, g.tanF); if (c) { const r = 6 * s + ov.exp * 10 * s, gr = hc.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * 3);
    gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(.3, 'rgba(255,210,150,.6)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); hc.fillStyle = gr; hc.beginPath(); hc.arc(c[0], c[1], r * 3, 0, 7); hc.fill(); } }
  if (ov.guide != null) { const gx = hud.width/2 + hud.height * .1, gy = hud.height/2 - hud.height * .07, r = (40 - ov.guide * 7) * s;
    hc.strokeStyle = ov.guide >= 3 ? '#58cfbe' : 'rgba(255,230,160,.9)'; hc.lineWidth = 2 * s; hc.beginPath(); hc.arc(gx, gy, r + Math.sin(t / 90) * 2 * s, 0, 7); hc.stroke();
    hc.beginPath(); hc.moveTo(gx - r * 1.5, gy); hc.lineTo(gx - r * .6, gy); hc.moveTo(gx + r * .6, gy); hc.lineTo(gx + r * 1.5, gy); hc.moveTo(gx, gy - r * 1.5); hc.lineTo(gx, gy - r * .6); hc.moveTo(gx, gy + r * .6); hc.lineTo(gx, gy + r * 1.5); hc.stroke();
    hc.fillStyle = '#fff'; hc.beginPath(); hc.arc(gx, gy, 3 * s, 0, 7); hc.fill();
    hc.font = `600 ${13 * s}px 'IBM Plex Mono', monospace`; hc.textAlign = 'left'; hc.fillStyle = '#ffe6a0'; hc.fillText(['IDENTIFYING', 'ACQUIRING', 'TRACKING', 'FINE GUIDE'][ov.guide], gx + r * 1.7, gy + 4 * s); }
  if (ov.spectrum) { const sp = ov.spectrum; if (sp === 'star') { hc.font = `600 ${15 * s}px 'IBM Plex Mono', monospace`; hc.textAlign = 'center'; hc.fillStyle = '#ff9a5a'; hc.fillText('ONLY A STAR: USE NIRISS TO READ THE PLANET\'S AIR', hud.width/2, hud.height * .25); }
    else { const im = pic(sp.id, 'NIRISS'); if (im) { const w = Math.min(hud.width * .5, 760 * s), h = w * im.height / im.width; hc.drawImage(im, hud.width/2 - w/2, hud.height * .12, w, h); } } }
}
function steerHud(g, s, t){
  frameBox(s); hc.beginPath(); hc.arc(hud.width/2, hud.height/2, 4 * s, 0, 7); hc.stroke();
  if (clueMode()) { clueHud(g, s, t); return; }
  drawTarget(steer, steer.cam, g, .35 * Math.max(0, Math.min(1, (fovFor(steer) * 6 - view.fov) / (fovFor(steer) * 4))), true, null);   // a blurry preview: the sharp picture comes when you take it
  const c = project(W.vec(steer.ra, steer.dec), g.b, g.tanF), on = c && c[0] > 0 && c[0] < hud.width && c[1] > 0 && c[1] < hud.height;
  if (on && view.fov > fovFor(steer) * 6) { hc.strokeStyle = `rgba(240,191,90,${.6 + .3 * Math.sin(t / 300)})`; hc.lineWidth = 3 * s; hc.beginPath(); hc.arc(c[0], c[1], 26 * s, 0, 7); hc.stroke();
    hc.fillStyle = '#f0bf5a'; hc.font = `600 ${15 * s}px 'IBM Plex Mono', monospace`; hc.textAlign = 'center'; hc.fillText(steer.name.toUpperCase(), c[0], c[1] - 36 * s); }
  if (W.debug) W.debug.arrow = null;
  if (!on) steerArrow(g, s);
  if (fine) { hc.font = `600 ${15 * s}px 'IBM Plex Mono', monospace`; hc.textAlign = 'center'; hc.fillStyle = 'rgba(88,207,190,.95)'; hc.fillText('FINE STEERING: CENTERING THE TARGET', hud.width/2, hud.height/2 + Math.min(hud.width, hud.height) * .16 * .6 + 30 * s); }
}
function steerArrow(g, s){ const c = project(W.vec(steer.ra, steer.dec), g.b, g.tanF); if (c && c[0] > 0 && c[0] < hud.width && c[1] > 0 && c[1] < hud.height) return;
  const sep = W.sep(view.ra, view.dec, steer.ra, steer.dec), wp = W.route([view.ra, view.dec], [steer.ra, steer.dec], sunMs)(Math.min(1, Math.max(.5, view.fov * .3) / Math.max(sep, 1e-6))), v = W.vec(wp[0], wp[1]), a = Math.atan2(-dot(v, g.b.u), dot(v, g.b.r)), R = Math.min(hud.width, hud.height) * .36, x = hud.width/2 + Math.cos(a) * R, y = hud.height/2 + Math.sin(a) * R;
    if (W.debug) W.debug.arrow = a; hc.save(); hc.translate(x, y); hc.rotate(a); hc.fillStyle = '#f0bf5a'; hc.beginPath(); hc.moveTo(18*s, 0); hc.lineTo(-12*s, -12*s); hc.lineTo(-6*s, 0); hc.lineTo(-12*s, 12*s); hc.closePath(); hc.fill(); hc.restore(); }
/* Clue mode: every target in view is a gold question mark; ones you've checked show their names. */
function clueHud(g, s, t){
  const aim = aimTarget();
  if (aim) drawTarget(aim, aim.cam, g, .35 * Math.max(0, Math.min(1, (fovFor(aim) * 6 - view.fov) / (fovFor(aim) * 4))), true, null);
  W.TARGETS.filter(visible).forEach(tg => { const c = project(W.vec(tg.ra, tg.dec), g.b, g.tanF); if (!c || c[0] < 0 || c[0] > hud.width || c[1] < 0 || c[1] > hud.height || view.fov < fovFor(tg) * 6) return;
    const wrong = acad.wrong.has(tg.id); hc.strokeStyle = wrong ? 'rgba(160,175,190,.6)' : `rgba(240,191,90,${.6 + .3 * Math.sin(t / 300)})`; hc.lineWidth = 3 * s; hc.beginPath(); hc.arc(c[0], c[1], 22 * s, 0, 7); hc.stroke();
    hc.fillStyle = wrong ? 'rgba(160,175,190,.85)' : '#f0bf5a'; hc.textAlign = 'center';
    if (wrong) { hc.font = `600 ${13 * s}px 'IBM Plex Mono', monospace`; hc.fillText(tg.name.toUpperCase(), c[0], c[1] - 30 * s); }
    else { hc.font = `700 ${22 * s}px 'Chakra Petch', sans-serif`; hc.fillText('?', c[0], c[1] + 8 * s); } });
  if (W.debug) W.debug.arrow = null;
  if (acad.hints > 2) steerArrow(g, s);
  if (fine) { hc.font = `600 ${15 * s}px 'IBM Plex Mono', monospace`; hc.textAlign = 'center'; hc.fillStyle = 'rgba(88,207,190,.95)'; hc.fillText('FINE STEERING: CENTERING', hud.width/2, hud.height/2 + Math.min(hud.width, hud.height) * .16 * .6 + 30 * s); }
}
/* the little Webb in the corner: leans when it turns, looks at the middle, the Sun under its shield */
function miniHud(g, s, t){
  const mimg = $('mini').querySelector('img'), lean = screen === 'steer' ? Math.max(-1, Math.min(1, vra / Math.max(.01, view.fov * .08))) : sys.wheels * Math.sin(t / 400) * .5;
  mimg.style.transform = `translate(-50%,-50%) translate(${-lean * 8}px, 0) rotate(${-lean * 7}deg)`;
  const ib = mimg.getBoundingClientRect(), k = hud.width / innerWidth;
  const mx = (ib.left + ib.width * .66) * k, my = (ib.top + ib.height * .14) * k, ex = hud.width / 2, ey = hud.height / 2, len = Math.hypot(ex - mx, ey - my), n = Math.floor(len / (22 * s));
  if (screen !== 'result') for (let i = 1; i < n; i++) { const u = (i + (t / 400) % 1) / n; if (u > 1) continue; hc.fillStyle = `rgba(255,214,120,${.9 - u * .55})`; hc.beginPath(); hc.arc(mx + (ex - mx) * u, my + (ey - my) * u, (3.2 - u * 1.6) * s, 0, 7); hc.fill(); }
  const px = (ib.left + ib.width * .45) * k, py = (ib.bottom + 6) * k, r = ib.width * .45 * k, gs = hc.createRadialGradient(px, py + r * .55, 0, px, py + r * .55, r);
  gs.addColorStop(0, 'rgba(255,230,170,.75)'); gs.addColorStop(.3, 'rgba(255,170,70,.35)'); gs.addColorStop(1, 'rgba(255,140,50,0)'); hc.fillStyle = gs; hc.beginPath(); hc.arc(px, py + r * .55, r, 0, 7); hc.fill();
  hc.font = `600 ${10 * k}px 'IBM Plex Mono', monospace`; hc.fillStyle = 'rgba(255,214,140,.95)'; hc.textAlign = 'center'; hc.fillText('☀ SUN THIS WAY', px, Math.min(hud.height - 8 * k, py + 4 * k));
  if (puff) { const tx = (ib.left + ib.width * .3) * k, ty = (ib.top + ib.height * .8) * k; for (let i = 0; i < 6; i++) { const a = Math.random() * 6.28, d = Math.random() * 30 * s; hc.fillStyle = 'rgba(220,230,255,.5)'; hc.beginPath(); hc.arc(tx + Math.cos(a) * d, ty + Math.sin(a) * d, 4 * s, 0, 7); hc.fill(); } }
}
$('go').onclick = weeks;
W.debug = {view};   // for tests: lets a test point the telescope directly
/* ?screen=plan|code|steer&week=first jumps straight in (for testing) */
const q = new URLSearchParams(location.search);
if (q.get('week')) { week = W.WEEKS.find(w => w.id === q.get('week')) || week; sunMs = week.date; }
if (q.get('screen') === 'weeks') weeks(); else if (q.get('screen') === 'plan') { startPlan(); } else if (q.get('screen') === 'code') { codeMode = true; startPlan(); } else if (q.get('screen') === 'steer') startSteer();
requestAnimationFrame(frame);
})();
