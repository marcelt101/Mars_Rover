/* Apollo 15 Mission Control. The player is Houston: the astronauts drive the rover; Houston radios where to go
   (1.3 seconds to the Moon, 1.3 back), watches the oxygen, steers the TV camera from Earth, and helps pick tools.
   Cadet: next stop highlighted, 2 tool choices, a camera with a short delay. Explorer: time estimates, 4 tools,
   the full round-trip delay. Specialist: no highlight, all 6 tools, a moving astronaut, the cancelled North Complex. */
(function () {
const MR = window.MR = window.MR || {}, M = window.MOON, $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[c]));
const q = new URLSearchParams(location.search), SLOT = (q.get('slot') || '').replace(/[^a-z0-9]/gi, '');
/* ---------- the player and saves (in their Crater Crew profile, like the Webb level) ---------- */
const PKEY = 'mr2.profiles' + SLOT, TKEY = 'mr2.team' + SLOT;
const readJ = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
const db = () => readJ(PKEY, null), me = () => { const d = db(); return d && Array.isArray(d.list) ? d.list.find(p => p.id === d.current) || null : null; };
const P = me(), TIER = ['cadet', 'explorer', 'specialist'].includes(q.get('tier')) ? q.get('tier') : (P && P.role) || 'explorer';
const FREE = q.get('free') === '1';
const loadSave = () => (me() && me().moon) || readJ('moon.save', {evas:{}, samples:{}});
const save = data => { const d = db(), p = d && Array.isArray(d.list) ? d.list.find(x => x.id === d.current) : null;
  try { if (p) { p.moon = data; localStorage.setItem(PKEY, JSON.stringify(d)); } else localStorage.setItem('moon.save', JSON.stringify(data)); } catch (e) {} };
let SAVE = loadSave(); SAVE.evas = SAVE.evas || {}; SAVE.samples = SAVE.samples || {};
/* music: the game's Moon mood, with Crater Crew's music settings */
MR.MAPS = MR.MAPS || {moon:{airless:true}};
if (!MR.Store) MR.Store = {get settings(){ return readJ('mr2.settings' + SLOT, {}) || {}; }};
const back = 'index.html' + (SLOT ? '?slot=' + SLOT : '') + '#levels-moon';
$('leave').onclick = () => { saveResume(); location.href = back; };
if (MR.ED && MR.ED.demo) { document.body.innerHTML = `<div class="ov"><div class="box"><h2>The Moon is in the full game</h2><p class="sub">The free demo has Jezero Crater and the James Webb Space Telescope.</p><div class="row end"><a class="btn gold" href="${back}">◀ Back</a></div></div></div>`; return; }

/* ---------- state ---------- */
const S = {eva:null, used:0, pos:{x:0, y:0}, head:Math.PI, driven:0, visited:[], phase:'pick', target:null, route:null, toolTries:0, tvScores:[], toolFirst:0, warned:0, sending:0};
const evaDef = () => M.EVAS[S.eva - 1];
const left = () => evaDef().minutes - S.used;
const st = k => M.STATIONS[k];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const driveMin = km => km / M.SPEED * 60;
const LM = {x:0, y:0, name:'Falcon (the Lunar Module)'};
const endMin = () => evaDef().end.reduce((s, t) => s + t.min, 0);
const homeNeed = () => driveMin(dist(S.pos, LM)) + endMin();
const fmt = m => { m = Math.max(0, Math.round(m)); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

/* ---------- the radio: Houston talks, the signal takes 1.3 s each way ---------- */
const sigs = [];   // {t0, dir:+1 up to the Moon / -1 down}
const logLine = (who, text, cls) => { const p = document.createElement('p'); p.className = cls; p.innerHTML = who ? `<b>${esc(who)}</b>${esc(text)}` : esc(text); $('log').append(p); $('log').scrollTop = 1e9;
  while ($('log').children.length > 40) $('log').firstChild.remove(); };
const ms = s => s * 1000;
/* Houston says something; it reaches the Moon after the delay, then the crew answers (and that takes the delay back). */
function radio(text, reply, onArrive){
  logLine('HOUSTON (CAPCOM)', text, 'h'); sigs.push({t0:performance.now(), dir:1}); S.sending++;
  setTimeout(() => { S.sending--; onArrive && onArrive();
    if (reply) { sigs.push({t0:performance.now(), dir:-1}); setTimeout(() => logLine('FALCON CREW', reply, 'c'), ms(M.DELAY)); } }, ms(M.DELAY));
}
const crew = text => { sigs.push({t0:performance.now(), dir:-1}); setTimeout(() => logLine('FALCON CREW', text, 'c'), ms(M.DELAY)); };
const note = text => logLine('', text, 's');

/* ---------- the map (km, x east, y north). Drawn once per size into an offscreen canvas. ---------- */
const cv = $('map'), cx = cv.getContext('2d'); let VIEW = null, terrain = null;
const rover = new Image(); rover.src = 'img/rovers/lrv-top-256.webp';
const lm = new Image(); lm.src = 'img/rovers/lm-top-256.webp';
function rng(seed){ return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
const RILLE = [[-1.0, 6.5], [-1.4, 4.2], [-1.75, 2.2], [-1.85, 0.3], [-1.7, -1.6], [-1.3, -2.9], [-1.55, -3.6], [-2.4, -4.2], [-3.6, -4.9], [-5.2, -5.6], [-7.5, -6.2]];
function layout(){
  const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = r.width * dpr; cv.height = r.height * dpr;
  const box = {x0:-4.4, x1:3.6, y0:-6.3, y1:2.4}, k = Math.min(cv.width / (box.x1 - box.x0), cv.height / (box.y1 - box.y0)) * .96;
  VIEW = {k, ox:cv.width / 2 - (box.x0 + box.x1) / 2 * k, oy:cv.height / 2 + (box.y0 + box.y1) / 2 * k, dpr};
  terrain = drawTerrain();
}
const P2 = (x, y) => [VIEW.ox + x * VIEW.k, VIEW.oy - y * VIEW.k];
function drawTerrain(){
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'), k = VIEW.k, R = rng(1971);
  g.fillStyle = '#5d5e5c'; g.fillRect(0, 0, c.width, c.height);
  // the mare plain is darker; the mountains brighter
  const mtn = (x, y, rx, ry, a) => { const [px, py] = P2(x, y); const gr = g.createRadialGradient(px - rx * k * .3, py - ry * k * .3, 0, px, py, Math.max(rx, ry) * k);
    gr.addColorStop(0, `rgba(205,203,196,${a})`); gr.addColorStop(.6, `rgba(150,148,142,${a * .7})`); gr.addColorStop(1, 'rgba(90,90,88,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(px, py, rx * k, ry * k, 0, 0, 7); g.fill(); };
  mtn(-0.5, -9.5, 9, 4.6, .95);    // Mount Hadley Delta (south)
  mtn(6.5, 6.8, 5.5, 4.5, .9);     // Mount Hadley (north-east)
  mtn(9.5, -1.0, 3.5, 7, .7);      // the Apennine front (east)
  for (let i = 0; i < 9000; i++) { const x = R() * c.width, y = R() * c.height, v = R(); g.fillStyle = v < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.05)'; g.fillRect(x, y, 1.5, 1.5); }
  // craters
  const crater = (x, y, r) => { const [px, py] = P2(x, y), rr = r * k; if (rr < 1) return;
    g.fillStyle = 'rgba(30,30,30,.32)'; g.beginPath(); g.arc(px + rr * .12, py + rr * .12, rr, 0, 7); g.fill();
    g.fillStyle = 'rgba(80,80,78,.9)'; g.beginPath(); g.arc(px, py, rr * .92, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,218,210,.35)'; g.lineWidth = Math.max(1, rr * .12); g.beginPath(); g.arc(px, py, rr, Math.PI * .9, Math.PI * 1.9); g.stroke(); };
  for (let i = 0; i < 260; i++) crater(R() * 15 - 7.5, R() * 15 - 7.5, Math.pow(R(), 3) * .35 + .02);
  crater(-2.3, -5.3, .85); crater(0.4, -2.5, .22); crater(0.65, -4.55, .08); crater(-1.05, 0.15, .07);   // St. George, Dune, Spur, Scarp
  // Hadley Rille: a winding lava channel
  const line = (w, col) => { g.strokeStyle = col; g.lineWidth = w * k; g.lineJoin = g.lineCap = 'round'; g.beginPath(); RILLE.forEach(([x, y], i) => { const [px, py] = P2(x, y); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); };
  line(1.25, 'rgba(200,198,190,.35)'); line(1.0, '#2b2c2c'); line(.55, '#151616');
  // labels
  g.font = `600 ${Math.max(11, k * .2)}px Chakra Petch, sans-serif`; g.fillStyle = 'rgba(240,238,230,.6)'; g.textAlign = 'center';
  [['HADLEY RILLE', -3.1, 1.7], ['MOUNT HADLEY DELTA', 2.4, -5.35], ['APENNINE FRONT', 2.6, 1.9]].forEach(([t, x, y]) => { const [px, py] = P2(x, y); g.fillText(t, px, py); });
  return c;
}
function drawMap(t){
  if (!VIEW) return; const g = cx, k = VIEW.k; g.drawImage(terrain, 0, 0);
  // walk-back circle
  const [lx, ly] = P2(0, 0); g.setLineDash([k * .2, k * .14]); g.strokeStyle = 'rgba(240,191,90,.55)'; g.lineWidth = Math.max(1.5, k * .04); g.beginPath(); g.arc(lx, ly, M.WALKBACK * k, 0, 7); g.stroke(); g.setLineDash([]);
  g.font = `600 ${Math.max(10, k * .24)}px IBM Plex Mono, monospace`; g.fillStyle = 'rgba(240,191,90,.8)'; g.textAlign = 'center'; g.fillText('WALK-BACK LIMIT', lx + M.WALKBACK * k * .26, ly + M.WALKBACK * k * .97 - 8);
  // North Complex (the plan that was cancelled)
  if (false) { const [nx, ny] = P2(M.NORTH.x, M.NORTH.y); g.strokeStyle = 'rgba(200,200,200,.5)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(nx, ny, k * .3, 0, 7); g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(220,220,220,.7)'; g.fillText('NORTH COMPLEX (CANCELLED)', nx, ny - k * .4); }
  // stations of this EVA (and the ones done before, faded)
  const ids = S.eva ? evaDef().stops : [];
  Object.keys(M.STATIONS).forEach(id => { const s = M.STATIONS[id], mine = ids.map(String).includes(String(id)), done = S.visited.map(String).includes(String(id)) || Object.values(SAVE.evas).some(e => (e.visited || []).map(String).includes(String(id)));
    const [px, py] = P2(s.x, s.y), r = Math.max(9, k * .26);
    g.globalAlpha = mine ? 1 : .35; g.fillStyle = done ? '#7fe0a8' : mine ? '#58cfbe' : '#9fb0c0'; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill();
    if (mine && S.target === id) { g.strokeStyle = '#f0bf5a'; g.lineWidth = 3; g.beginPath(); g.arc(px, py, r + 5 + Math.sin(t / 200) * 2, 0, 7); g.stroke(); }
    g.fillStyle = '#05201b'; g.font = `700 ${r}px Chakra Petch, sans-serif`; g.textBaseline = 'middle'; g.fillText(done ? '✓' : id, px, py + 1); g.textBaseline = 'alphabetic';
    if (mine) { g.fillStyle = '#e6ecf1'; g.font = `600 ${Math.max(11, k * .24)}px Chakra Petch, sans-serif`; const L = s.lab || 't';
      g.textAlign = L === 'l' ? 'right' : L === 'r' ? 'left' : 'center'; g.fillText(s.name, px + (L === 'l' ? -r - 6 : L === 'r' ? r + 6 : 0), py + (L === 't' ? -r - 6 : L === 'b' ? r + 16 : 5)); g.textAlign = 'center'; }
    g.globalAlpha = 1; });
  // the Lunar Module
  const lw = Math.max(34, k * 1.1); if (lm.complete && lm.naturalWidth) g.drawImage(lm, lx - lw / 2, ly - lw / 2, lw, lw); else { g.fillStyle = '#f0bf5a'; g.fillRect(lx - 8, ly - 8, 16, 16); }
  g.fillStyle = '#f0bf5a'; g.font = `700 ${Math.max(11, k * .26)}px Chakra Petch, sans-serif`; g.textAlign = 'left'; g.fillText('FALCON', lx + lw / 2 + 4, ly + 4); g.textAlign = 'center';
  // route and rover
  if (S.route) { const [ax, ay] = P2(S.pos.x, S.pos.y), [bx, by] = P2(S.route.to.x, S.route.to.y); g.strokeStyle = 'rgba(88,207,190,.8)'; g.lineWidth = 2.5; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]); }
  if (S.eva) { const [rx, ry] = P2(S.pos.x, S.pos.y), rw = Math.max(26, k * .62); g.save(); g.translate(rx, ry); g.rotate(S.head);
    if (rover.complete && rover.naturalWidth) g.drawImage(rover, -rw / 2, -rw / 2, rw, rw); else { g.fillStyle = '#ddd'; g.fillRect(-6, -9, 12, 18); } g.restore();
    if (S.phase === 'drive') { g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(rx, ry, rw * .7 + (t / 30) % 10, 0, 7); g.stroke(); } }
}

/* ---------- the console ---------- */
function renderConsole(){
  const E = S.eva && evaDef(); if (!E) return;
  $('cEva').innerHTML = `${E.name}<small>${esc(E.date.toUpperCase())}</small>`; $('cClock').innerHTML = `${fmt(S.used)}<small>EVA TIME</small>`; $('cDist').innerHTML = `${S.driven.toFixed(1)} km<small>DRIVEN</small>`;
  const L = left(), pct = Math.max(0, L / E.minutes), need = homeNeed();
  $('o2t').textContent = fmt(L); $('o2i').style.width = (pct * 100) + '%'; $('o2pct').textContent = Math.round(pct * 100) + '%';
  $('o2u').style.left = Math.min(100, need / E.minutes * 100) + '%'; $('o2bar').classList.toggle('low', L < need + 30);
  $('o2note').textContent = S.phase === 'home' ? 'Back at Falcon.' : `Getting home and finishing up takes about ${fmt(need)}. The gold mark shows it.`;
  const drv = S.phase === 'drive'; $('ant').className = 'ant' + (drv ? '' : ' tv');
  $('ant').querySelector('span').textContent = drv ? 'Driving: voice on the low-gain antenna (no TV while moving)' : S.phase === 'station' ? 'Parked: the crew aims the high-gain dish at Earth for TV' : 'Parked: voice and TV';
  const stops = E.stops, next = stops.find(id => !S.visited.map(String).includes(String(id)));
  $('stations').innerHTML = stops.map(id => { const s = st(id), done = S.visited.map(String).includes(String(id)), d = dist(S.pos, s), est = driveMin(d) + s.min;
    return `<button class="st ${done ? 'done' : ''} ${S.target === id ? 'here' : ''} ${TIER === 'cadet' && id === next && S.phase === 'idle' ? 'next' : ''}" data-id="${id}" ${done || S.phase !== 'idle' ? 'disabled' : ''}>
      <span class="n">${done ? '✓' : esc(id)}</span><span><b>${esc(s.name)}</b><small>${esc(s.where)}</small></span><span class="t">${TIER === 'cadet' ? '' : `${d.toFixed(1)} km<br>~${fmt(est)}`}</span></button>`; }).join('')
    + `<button class="st lm" data-id="lm" ${S.phase !== 'idle' ? 'disabled' : ''}><span class="n">⌂</span><span><b>Return to Falcon</b><small>${E.end.length ? 'Then: ' + E.end.map(t => t.name).join(', ') : 'End the moonwalk'}</small></span><span class="t">${TIER === 'cadet' ? '' : `${dist(S.pos, LM).toFixed(1)} km`}</span></button>`;
  $('planNote').textContent = `${S.visited.length}/${stops.length} stations`;
  document.querySelectorAll('.st').forEach(b => b.onclick = () => b.dataset.id === 'lm' ? goHome() : goTo(isNaN(b.dataset.id) ? b.dataset.id : +b.dataset.id));
}

/* ---------- driving ---------- */
function goTo(id){
  if (S.phase !== 'idle') return; const s = st(id), need = driveMin(dist(S.pos, s)) + s.min + driveMin(dist(s, LM)) + endMin();
  if (need > left()) { radio(`Falcon, Houston. We don't have the oxygen for ${s.name} and a safe trip home. Let's pick a closer stop.`, 'Roger, Houston. Understood.'); return; }
  S.target = id; S.phase = 'wait'; renderConsole();
  radio(`Falcon, Houston. Drive to ${s.name}, ${s.where.toLowerCase()}.`, TIER === 'cadet' ? `On our way to ${s.name}!` : `Roger, Houston. Heading for ${s.name}. About ${dist(S.pos, s).toFixed(1)} kilometers.`,
    () => startDrive(s, () => arrive(id)));
}
function goHome(){
  if (S.phase !== 'idle') return; S.target = 'lm'; S.phase = 'wait'; renderConsole();
  radio('Falcon, Houston. Time to head home to the LM.', 'Roger, heading back to Falcon.', () => startDrive(LM, atHome));
}
function startDrive(to, done){ S.phase = 'drive'; S.route = {to, done}; S.head = Math.atan2(to.x - S.pos.x, to.y - S.pos.y); renderConsole(); }
function driveStep(dtMin){
  const R = S.route, d = dist(S.pos, R.to), step = M.SPEED / 60 * dtMin;
  if (step >= d) { S.driven += d; S.pos = {x:R.to.x, y:R.to.y}; S.route = null; S.phase = 'idle'; R.done(); return; }
  S.pos.x += (R.to.x - S.pos.x) / d * step; S.pos.y += (R.to.y - S.pos.y) / d * step; S.driven += step;
}
function arrive(id){
  const s = st(id); S.phase = 'station'; renderConsole();
  crew(TIER === 'cadet' ? `We're at ${s.name}! Getting off the rover.` : `Houston, Falcon. We're parked at ${s.name}. Aiming the high-gain antenna at Earth for you.`);
  setTimeout(() => stationWork(id), ms(M.DELAY * 2) + 400);
}

/* ---------- at a station: TV camera from Earth, the right tool, the sample ---------- */
function stationWork(id){
  const s = st(id), steps = [];
  if (s.tv) steps.push(done => tvJob(`TV at ${s.name}`, `Ed Fendell steered this camera from Houston. Keep the astronaut in the gold box while they work.`, done));
  steps.push(done => toolJob(id, done));
  const next = () => { const f = steps.shift(); if (f) f(next); else finishStation(id); }; next();
}
function finishStation(id){
  const s = st(id); S.used += s.min; S.visited.push(id); S.target = null; S.phase = 'idle'; SAVE.samples[id] = 1; save(SAVE);
  note(`${s.name}: ${s.min} minutes of work. ${s.sample.name} bagged.`); renderConsole(); checkO2();
  if (S.visited.length === evaDef().stops.length) radio(`Falcon, Houston. That's every station on the plan. Great work. Head home whenever you're ready.`, 'Copy, Houston!');
}
const toolSvg = k => ({
  rake:'<path d="M32 4v38" stroke="#c9d1d8" stroke-width="4"/><path d="M14 42h36M16 42v14M22 42v14M28 42v14M34 42v14M40 42v14M46 42v14" stroke="#c9d1d8" stroke-width="3"/>',
  scoop:'<path d="M32 4v30" stroke="#c9d1d8" stroke-width="4"/><path d="M18 34h28l-4 20H22z" fill="#9aa4ad"/>',
  tongs:'<path d="M26 4l4 50M38 4l-4 50" stroke="#c9d1d8" stroke-width="4"/><path d="M26 56l4-2 4 2" stroke="#f0bf5a" stroke-width="3" fill="none"/>',
  hammer:'<path d="M34 18v42" stroke="#b07a3a" stroke-width="6"/><rect x="18" y="8" width="30" height="12" rx="3" fill="#c9d1d8"/>',
  core:'<rect x="26" y="4" width="12" height="52" rx="3" fill="#9aa4ad"/><path d="M26 56l6 6 6-6" fill="#c9d1d8"/><path d="M28 14h8M28 26h8M28 38h8" stroke="#5d666f" stroke-width="2"/>',
  camera:'<rect x="8" y="18" width="34" height="26" rx="5" fill="#c9d1d8"/><rect x="40" y="22" width="18" height="18" rx="3" fill="#5d666f"/><circle cx="25" cy="31" r="7" fill="#3b4a58"/>',
}[k]);
function toolJob(id, done){
  const s = st(id), all = Object.keys(M.TOOLS), n = TIER === 'cadet' ? 2 : TIER === 'explorer' ? 4 : 6;
  let pick = [s.tool, ...all.filter(k => k !== s.tool).sort(() => Math.random() - .5).slice(0, n - 1)].sort(() => Math.random() - .5), tries = 0;
  open(`<h2>${esc(s.name)}</h2><p class="sub">${esc(s.where)}</p>
    <p><b>The task:</b> ${esc(s.task)}</p><p>${TIER === 'cadet' ? 'Which tool should the astronauts use?' : 'Radio the crew: which tool is right for this job?'}</p>
    <div class="tools">${pick.map(k => `<button class="tool" data-k="${k}"><svg viewBox="0 0 64 64">${toolSvg(k)}</svg><b>${esc(M.TOOLS[k].name)}</b>${TIER === 'specialist' ? '' : `<small>${esc(M.TOOLS[k].what)}</small>`}</button>`).join('')}</div>
    <div id="tmsg"></div>`);
  document.querySelectorAll('.tool').forEach(b => b.onclick = () => {
    if (b.dataset.k !== s.tool) { tries++; b.classList.add('wrong'); b.disabled = true; $('tmsg').innerHTML = `<p style="color:var(--warn)">The ${esc(M.TOOLS[b.dataset.k].name.toLowerCase())} won't work here. ${TIER === 'cadet' ? 'Try the other one!' : 'Think about what the task needs.'}</p>`; return; }
    b.classList.add('right'); if (!tries) S.toolFirst++; document.querySelectorAll('.tool').forEach(x => x.disabled = true);
    radio(`Falcon, Houston. Use the ${M.TOOLS[s.tool].name.toLowerCase()}.`, s.star ? 'Guess what we just found! I think we found what we came for!' : `Copy. ${s.tool === 'camera' ? 'Taking the pictures now.' : 'Got it, bagging the sample.'}`);
    $('tmsg').innerHTML = `<div class="sample"><div class="rock">${s.sample.icon}</div><div><b>${esc(s.sample.name)}</b><p>${esc(s.sample.fact)}</p></div></div><div class="row end"><button class="btn gold" id="tok">Continue ▸</button></div>`;
    $('tok').onclick = () => { close(); done(); }; });
}

/* The TV camera, steered from Earth: a command takes 1.3 s to reach the Moon, and the picture takes 1.3 s to come back. */
function tvJob(title, text, done, feather){
  const lagUp = M.DELAY, lagDown = TIER === 'cadet' ? 0 : M.DELAY, moving = TIER === 'specialist' ? 1 : TIER === 'explorer' ? .45 : 0;
  open(`<h2>📺 ${esc(title)}</h2><p class="sub">${esc(text)}</p><canvas id="tv" width="960" height="540"></canvas>
    <div class="tvbar"><div class="pad"><button class="u" data-d="0,-1">▲</button><button class="l" data-d="-1,0">◀</button><button class="d" data-d="0,1">▼</button><button class="r" data-d="1,0">▶</button></div>
    <div><div class="meter"><i id="tvm"></i></div><div class="lag">Your command reaches the Moon in <b>${lagUp} s</b>${lagDown ? `, and the picture takes <b>${lagDown} s</b> to come back` : ''}. Move early!</div></div>
    <button class="btn" id="tvSkip">${feather ? 'Skip' : 'Skip TV'}</button></div>`);
  const c = $('tv'), g = c.getContext('2d'), W = 960, H = 540, PANO = 2400, hist = [], cmd = {x:0, y:0};
  let pan = {x:250, y:0}, cmdPan = {x:250, y:0}, held = {x:0, y:0}, score = 0, t0 = performance.now(), last = t0, alive = true;
  const pressed = new Set();
  document.querySelectorAll('.pad button').forEach(b => { const [dx, dy] = b.dataset.d.split(',').map(Number);
    b.onpointerdown = e => { e.preventDefault(); held = {x:dx, y:dy}; }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => { held = {x:0, y:0}; }; });
  const key = e => { const d = {ArrowLeft:[-1, 0], ArrowRight:[1, 0], ArrowUp:[0, -1], ArrowDown:[0, 1]}[e.key]; if (!d) return; e.preventDefault(); if (e.type === 'keydown') held = {x:d[0], y:d[1]}; else held = {x:0, y:0}; };
  addEventListener('keydown', key); addEventListener('keyup', key);
  const stop = ok => { if (!alive) return; alive = false; removeEventListener('keydown', key); removeEventListener('keyup', key); close(); S.tvScores.push(Math.min(1, score)); done(); };
  $('tvSkip').onclick = () => { score = Math.min(score, .2); stop(); };
  const astro = tt => ({x:1150 + Math.sin(tt / 2.2) * 260 * moving + (feather ? 0 : 0), y:0});
  function frame(now){
    if (!alive) return; const dt = Math.min(.05, (now - last) / 1000); last = now; const tt = (now - t0) / 1000;
    cmdPan.x = Math.max(0, Math.min(PANO - W, cmdPan.x + held.x * 420 * dt)); cmdPan.y = Math.max(-140, Math.min(140, cmdPan.y + held.y * 220 * dt));
    hist.push({t:tt, x:cmdPan.x, y:cmdPan.y}); const at = tt - lagUp; let real = hist[0]; for (const h of hist) { if (h.t <= at) real = h; else break; }
    while (hist.length > 2 && hist[1].t < tt - lagUp - lagDown - 1) hist.shift();
    pan = {x:real.x, y:real.y};
    // what Houston sees: the camera as it was lagDown seconds ago
    const seenT = tt - lagDown; let seen = pan; if (lagDown) { const at2 = seenT - lagUp; for (const h of hist) { if (h.t <= at2) seen = h; else break; } }
    drawTV(g, W, H, seen, astro(seenT), feather ? tt : null);
    const a = astro(seenT), sx = a.x - seen.x, sy = H * .62 - seen.y, inBox = sx > W * .36 && sx < W * .64 && sy > H * .32 && sy < H * .82;
    if (!feather) { score += (inBox ? 1 : 0) * dt / (TIER === 'cadet' ? 6 : 8); $('tvm').style.width = Math.min(100, score * 100) + '%'; if (score >= 1) { setTimeout(() => stop(true), 500); score = 1.01; } }
    else if (tt > 2.4 && !feather.done) { feather.done = true; setTimeout(() => stop(true), 3800); crew(M.QUOTES.feather.split(' (')[0]); }
    if (!feather && tt > 30) stop(false);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function drawTV(g, W, H, cam, a, feather){
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const hz = H * .5 - cam.y * .5;
  // Earth in the black sky, far away mountains, the grey ground
  g.fillStyle = '#4a7bd0'; g.beginPath(); g.arc(1700 - cam.x, hz - 170, 26, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(1694 - cam.x, hz - 176, 10, 0, 7); g.fill();
  g.fillStyle = '#8c8a84'; g.beginPath(); g.moveTo(-cam.x, hz); for (let x = 0; x <= 2400; x += 60) g.lineTo(x - cam.x, hz - 60 - Math.sin(x / 260) * 45 - Math.sin(x / 90) * 10); g.lineTo(2400 - cam.x, hz); g.fill();
  const gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#77756f'); gr.addColorStop(1, '#4d4c49'); g.fillStyle = gr; g.fillRect(0, hz, W, H);
  for (let i = 0; i < 40; i++) { const x = (i * 197) % 2400 - cam.x, y = hz + 20 + (i * 53) % (H - hz); g.fillStyle = 'rgba(40,40,38,.5)'; g.beginPath(); g.ellipse(x, y, 14 + i % 5 * 6, 5 + i % 3 * 2, 0, 0, 7); g.fill(); }
  // the rover parked, the astronaut
  const rx = 900 - cam.x, ry = H * .66 - cam.y * .5; g.fillStyle = '#b8b6ae'; g.fillRect(rx - 70, ry - 20, 140, 22); g.fillStyle = '#333'; [rx - 55, rx + 55].forEach(x => { g.beginPath(); g.arc(x, ry + 6, 16, 0, 7); g.fill(); });
  g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(rx + 30, ry - 20); g.lineTo(rx + 30, ry - 70); g.stroke(); g.fillStyle = '#e8e6df'; g.beginPath(); g.ellipse(rx + 30, ry - 76, 22, 8, 0, 0, 7); g.fill();
  const ax = a.x - cam.x, ay = H * .62 - cam.y; g.fillStyle = '#f2f1ec';
  g.beginPath(); g.ellipse(ax, ay - 30, 18, 26, 0, 0, 7); g.fill(); g.beginPath(); g.arc(ax, ay - 66, 14, 0, 7); g.fill(); g.fillStyle = '#c9a33a'; g.beginPath(); g.arc(ax + 3, ay - 66, 8, 0, 7); g.fill();
  g.fillStyle = '#f2f1ec'; g.fillRect(ax - 14, ay - 8, 10, 30); g.fillRect(ax + 4, ay - 8, 10, 30); g.fillStyle = '#d0cec6'; g.fillRect(ax - 26, ay - 50, 12, 26);
  if (feather != null) { const k = Math.max(0, feather - 1), fall = Math.min(1, .5 * 1.62 * k * k / 1.2), y = ay - 60 + fall * 78;
    g.fillStyle = '#9aa4ad'; g.fillRect(ax + 26, y - 6, 22, 8); g.fillStyle = '#7a5a30'; g.fillRect(ax + 34, y, 5, 18);
    g.strokeStyle = '#eee'; g.lineWidth = 3; g.beginPath(); g.moveTo(ax - 34, y - 10); g.quadraticCurveTo(ax - 44, y + 4, ax - 34, y + 16); g.stroke(); }
  // gold target box, scan lines, a timestamp
  if (feather == null) { g.strokeStyle = 'rgba(240,191,90,.9)'; g.lineWidth = 3; g.strokeRect(W * .36, H * .32, W * .28, H * .5); }
  g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  g.fillStyle = '#fff'; g.font = '600 18px IBM Plex Mono, monospace'; g.fillText('LIVE · HADLEY BASE · TV CAMERA (GCTA)', 18, 30);
}

/* ---------- the start and end of an EVA ---------- */
function lmTasks(list, done){
  const next = () => { const t = list.shift(); if (!t) return done();
    if (t.t === 'feather') return tvJob('The hammer and the feather', 'In the vacuum of the Moon there is no air to slow the feather down. Watch what happens!', () => { S.used += t.min; note(M.QUOTES.feather); next(); }, {});
    open(`<h2>${esc(t.name)}</h2><p>${esc(t.say)}</p>${t.t === 'alsep' ? '<p class="sub">The laser mirror is still on the Moon. Observatories on Earth still bounce laser beams off mirrors like it to measure the distance to the Moon.</p>' : ''}<p class="sub">Takes ${t.min} minutes of oxygen.</p><div class="row end"><button class="btn gold" id="tok">Go ▸</button></div>`);
    $('tok').onclick = () => { close(); S.used += t.min; note(`${t.name}: done (${t.min} min).`); renderConsole(); next(); }; };
  next();
}
function atHome(){
  S.phase = 'lmend'; S.target = null; renderConsole();
  crew(TIER === 'cadet' ? 'We\'re back at Falcon!' : 'Houston, Falcon. We\'re back at the LM.');
  setTimeout(() => lmTasks(evaDef().end.slice(), endEva), ms(M.DELAY * 2));
}
function endEva(){
  const E = evaDef(), L = left(), safe = L >= 0, stations = S.visited.length / E.stops.length, tools = S.visited.length ? S.toolFirst / S.visited.length : 0,
    tv = S.tvScores.length ? S.tvScores.reduce((a, b) => a + b, 0) / S.tvScores.length : 1;
  const stars = !safe ? 0 : Math.max(1, Math.round((stations * 1.4 + tools * .8 + tv * .8)));
  const prev = SAVE.evas[E.id] || {}; SAVE.evas[E.id] = {stars:Math.max(prev.stars || 0, Math.min(3, stars)), visited:[...new Set([...(prev.visited || []), ...S.visited])]};
  let unlocked = '';
  if (E.id === 3 && !FREE && safe) { const tm = readJ(TKEY, {unlocked:['jezero'], allMaps:false}); if (!tm.unlocked.includes('meridiani')) { tm.unlocked.push('meridiani'); try { localStorage.setItem(TKEY, JSON.stringify(tm)); } catch (e) {} unlocked = '<p style="color:var(--ok)">🔓 New map unlocked: Meridiani Planum, with Opportunity!</p>'; } }
  S.phase = 'home'; clearResume(); save(SAVE);
  open(`<h2>${esc(E.name)} complete</h2><p class="sub">${esc(E.title)} · ${esc(E.date)}</p><div class="big">${'★'.repeat(SAVE.evas[E.id].stars ? Math.min(3, stars) : 0)}${'☆'.repeat(3 - Math.min(3, stars))}</div>
    <div class="res"><div><span>Stations visited</span><b>${S.visited.length} of ${E.stops.length}</b></div><div><span>Right tool on the first try</span><b>${S.toolFirst} of ${S.visited.length}</b></div>
    <div><span>TV coverage</span><b>${Math.round(tv * 100)}%</b></div><div><span>Oxygen left at the end</span><b>${fmt(L)}</b></div><div><span>Distance driven</span><b>${S.driven.toFixed(1)} km</b></div></div>
    ${E.id === 3 ? `<p>Apollo 15's crew drove about 28 km in three moonwalks and brought home 77 kg of Moon rocks. The next day, Falcon lifted off to meet Endeavour in orbit.</p>` : ''}${unlocked}
    <div class="row end"><button class="btn" id="again">Play this EVA again</button><button class="btn gold" id="nextE">${E.id < 3 ? `Next: EVA ${E.id + 1} ▸` : 'Mission overview ▸'}</button></div>`);
  $('again').onclick = () => { close(); startEva(E.id); }; $('nextE').onclick = () => { close(); if (E.id < 3) startEva(E.id + 1); else pickEva(); };
}
function checkO2(){
  if (S.phase === 'home' || S.phase === 'lmend') return; const L = left(), need = homeNeed();
  if (L <= 0) { S.phase = 'idle'; note('Out of oxygen time!'); outOfO2(); return; }
  if (L < need + 10 && S.warned < 2 && S.phase === 'idle') { S.warned = 2; radio('Falcon, Houston. You\'re at your limit on consumables. Head straight back to the LM, please.', 'Roger, coming home now.', () => startDrive(LM, atHome)); S.target = 'lm'; S.phase = 'wait'; }
  else if (L < need + 30 && !S.warned) { S.warned = 1; radio('Falcon, Houston. Heads up: about 30 minutes of margin left before you need to start back.', 'Copy, Houston. We\'ll keep it short.'); }
}
function outOfO2(){
  open(`<h2>Too close!</h2><p>The crew ran out of oxygen margin far from Falcon. On the real Moon, Mission Control watched the oxygen all the time, so this never happened.</p><p class="sub">Try again: plan fewer stops, or go to the far ones first and pick up the near ones on the way home.</p><div class="row end"><button class="btn gold" id="again">Try again</button></div>`);
  $('again').onclick = () => { close(); startEva(S.eva); };
}

/* ---------- the EVA picker ---------- */
function pickEva(){
  const open1 = id => FREE || id === 1 || (SAVE.evas[id - 1] && SAVE.evas[id - 1].stars > 0);
  open(`<h2>🌕 Apollo 15 · Hadley-Apennine</h2><p class="sub">July 30 – August 2, 1971. You are Mission Control in Houston. Dave Scott and Jim Irwin drive the first Lunar Roving Vehicle. Your radio takes 1.3 seconds to reach them.</p>
    <p>${TIER === 'cadet' ? 'Tell the astronauts where to go, help them pick tools, and point the TV camera at them. Get them home before the oxygen runs low!' : 'Plan each moonwalk: which geology stations, in what order, before the oxygen runs low and inside the walk-back limit. Steer the rover\'s TV camera from Earth, and radio the right sample tools.'}</p>
    <div class="evas">${M.EVAS.map(E => { const s = SAVE.evas[E.id]; return `<button class="eva" data-e="${E.id}" ${open1(E.id) ? '' : 'disabled'}><b>${E.name}</b><small>${esc(E.date)} · ${fmt(E.minutes)} of oxygen</small><small><b style="font:600 14px var(--display);color:var(--fg)">${esc(E.title)}</b><br>${esc(E.note)}</small><span class="stars">${s ? '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars) : open1(E.id) ? '' : '🔒 Finish the one before'}</span></button>`; }).join('')}</div>
    <div class="row end"><a class="btn" href="${back}">◀ Back to the levels</a></div>`);
  document.querySelectorAll('.eva').forEach(b => b.onclick = () => { close(); startEva(+b.dataset.e); });
}
function startEva(id){
  Object.assign(S, {eva:id, used:0, pos:{x:0, y:0}, head:Math.PI, driven:0, visited:[], phase:'lmstart', target:null, route:null, toolFirst:0, tvScores:[], warned:0});
  $('log').innerHTML = ''; renderConsole(); MR.music && MR.music.setWorld('moon');
  note(`${evaDef().name} begins. The crew climbs down Falcon's ladder.`); if (id === 1) note(M.QUOTES.step);
  radio(`Falcon, Houston. Good morning! ${evaDef().title} today. Your oxygen is good for ${fmt(evaDef().minutes)}.`, TIER === 'cadet' ? 'Good morning, Houston! Ready to explore!' : 'Morning, Houston. Ready to go.', () => {
    setTimeout(() => lmTasks(evaDef().start.slice(), () => { S.phase = 'idle'; renderConsole(); if (TIER === 'cadet') note('Tap a station in the plan to send the crew there.'); }), ms(M.DELAY) + 300); });
}

/* ---------- resume where you were ---------- */
function saveResume(){ if (!S.eva || S.phase === 'home') return; SAVE.resume = {eva:S.eva, used:S.used, pos:S.pos, driven:S.driven, visited:S.visited, toolFirst:S.toolFirst, tvScores:S.tvScores}; save(SAVE); }
function clearResume(){ delete SAVE.resume; }
addEventListener('pagehide', saveResume);

/* ---------- overlays ---------- */
function open(html){ $('box').innerHTML = html; $('ov').classList.remove('hidden'); }
function close(){ $('ov').classList.add('hidden'); }

/* ---------- the loop: while driving, 1 second = 2 minutes on the Moon ---------- */
let last = performance.now(), tick = 0;
function loop(now){
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (S.phase === 'drive' && S.route) { const dm = dt * (TIER === 'cadet' ? 2.5 : 2) * (+q.get('fast') || 1); S.used += dm; driveStep(dm); if ((tick += dt) > .25) { tick = 0; renderConsole(); checkO2(); } }
  drawMap(now); drawSig(now); requestAnimationFrame(loop);
}
function drawSig(now){
  const c = $('sig'), g = c.getContext('2d'), W = c.width, H = c.height; g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(159,176,192,.35)'; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(6, H / 2); g.lineTo(W - 6, H / 2); g.stroke(); g.setLineDash([]);
  for (let i = sigs.length - 1; i >= 0; i--) { const s = sigs[i], k = (now - s.t0) / ms(M.DELAY); if (k > 1) { sigs.splice(i, 1); continue; }
    const x = s.dir > 0 ? 6 + k * (W - 12) : W - 6 - k * (W - 12); g.fillStyle = s.dir > 0 ? '#58cfbe' : '#f0bf5a'; g.beginPath(); g.arc(x, H / 2, 7, 0, 7); g.fill(); }
  g.fillStyle = '#9fb0c0'; g.font = '600 18px IBM Plex Mono, monospace'; g.textAlign = 'center'; g.fillText('384,000 km · 1.3 s', W / 2, 16);
}
addEventListener('resize', () => { layout(); });
layout(); requestAnimationFrame(loop);
/* start: resume an EVA in progress, or pick one */
if (SAVE.resume && M.EVAS[SAVE.resume.eva - 1]) { const r = SAVE.resume; Object.assign(S, {eva:r.eva, used:r.used, pos:r.pos, driven:r.driven, visited:r.visited, toolFirst:r.toolFirst || 0, tvScores:r.tvScores || [], phase:'idle', warned:0});
  renderConsole(); note(`Welcome back, Houston. ${evaDef().name} continues.`); MR.music && MR.music.setWorld('moon'); }
else pickEva();
window.MOONDBG = {S, startEva, goTo, goHome};   // for tests
})();
