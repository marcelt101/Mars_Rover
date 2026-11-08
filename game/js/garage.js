/* Rover Garage (waiting for approval: ?preview=garage). A big picture of your rover with a slot for each part,
   the supply-crate opening when a new part arrives, and the parts strip on the game screen's dashboard.
   Parts are owned in the profile (MR.garageOf) and fitted on the rover from the next sol. */
(function () {
const MR = window.MR, UI = MR.UI, $ = id => document.getElementById(id);
if (!MR.GARAGE) return;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const G = MR.Garage = {};
const me = () => MR.Store.current();
const kidOf = p => p && p.role === 'cadet';
const nameOf = (k, p) => kidOf(p) ? MR.PARTS[k].kid : MR.PARTS[k].name;
const gameOf = (k, p) => kidOf(p) && MR.PARTS[k].kidGame ? MR.PARTS[k].kidGame : MR.PARTS[k].game;
const partsFor = (slot, role) => Object.keys(MR.PARTS).filter(k => MR.PARTS[k].slot === slot && MR.partOK(k, role));

/* Signal strength from the comms parts: 1 bar stock, 2 with the radio, 4 with the dish. */
G.bars = r => 1 + (MR.hasPart(r, 'better_radio') ? 1 : 0) + (MR.hasPart(r, 'hg_antenna') ? 2 : 0);
G.barsHtml = r => { const n = G.bars(r); return `<span class="sigbars" aria-label="Signal ${n} of 4 bars">${[1, 2, 3, 4].map(i => `<i class="${i <= n ? 'on' : ''}" style="height:${i * 25}%"></i>`).join('')}</span>`; };

/* The rover in the picture: the one on the map during a game, or the profile's rover at home. */
function previewRover(p){
  const st = MR.Game && MR.Game.state, r = st && st.rovers && MR.Game.api && MR.Game.api.myRover && MR.Game.api.myRover();
  const perks = MR.equippedPerks(p);
  if (r) return {...r, perks, zh:st.map === 'utopia' && !['heli','buggy','lab'].includes(r.job), moon:!!MR.MAPS[st.map].airless && !['heli','buggy','lab'].includes(r.job)};
  return {job:p.job || MR.defaultJob(p.role), role:p.role, color:p.color || 'teal', perks, rank:MR.rankOf(p.xp), tubes:[]};
}

/* ---------- the garage ---------- */
let pick = null, fitAnim = null;
UI.garage = slot => {
  const p = me(); if (!p) return;
  const g = MR.garageOf(p), kid = kidOf(p), slots = MR.slotsFor(p.role), all = MR.PART_ORDER[kid ? 'cadet' : 'other'];
  pick = slot || pick && slots.includes(MR.PARTS[pick] ? MR.PARTS[pick].slot : pick) && pick || slots.find(s => g.eq[s]) || slots[0];
  const selSlot = MR.PARTS[pick] ? MR.PARTS[pick].slot : pick, selPart = MR.PARTS[pick] ? pick : g.eq[selSlot] || null;
  const inGame = !!(MR.Game && MR.Game.state);
  const slotRow = s => { const k = g.eq[s], P = k && MR.PARTS[k];
    return `<button class="gslot ${s === selSlot ? 'sel' : ''} ${k ? '' : 'empty'}" data-slot="${s}"><span class="gi">${P ? P.icon : MR.SLOTS[s].icon}</span><span><small>${esc(MR.SLOTS[s].name)}</small><b>${P ? esc(nameOf(k, p)) : 'Empty'}</b>${P ? `<small class="ge">${esc(gameOf(k, p))}</small>` : ''}</span></button>`; };
  const opt = k => { const own = !!g.own[k], on = g.eq[MR.PARTS[k].slot] === k;
    return `<button class="gpart ${own ? '' : 'locked'} ${k === selPart ? 'sel' : ''}" data-part="${k}" aria-label="${own ? esc(nameOf(k, p)) : 'Locked part'}"><span class="gi">${own ? MR.PARTS[k].icon : '?'}</span><small>${own ? esc(nameOf(k, p)) : 'In a crate'}</small>${on ? '<em>Fitted</em>' : ''}</button>`; };
  let detail = '';
  if (selPart) { const P = MR.PARTS[selPart], own = !!g.own[selPart], on = g.eq[P.slot] === selPart;
    detail = own ? `<div class="gdet"><span class="gbig">${P.icon}</span><div><h3>${esc(nameOf(selPart, p))}</h3>
        <p><b>In the game:</b> ${esc(gameOf(selPart, p))}</p><p><b>In real life:</b> ${esc(P.real)}</p>
        <div class="row">${on ? '<span class="pill ok">✓ Fitted on your rover</span>' : `<button class="btn primary" id="gFit" data-part="${selPart}">Fit this part</button>`}${kid ? '<button class="btn" id="gSay" aria-label="Read it to me">🔊</button>' : ''}${P.slot === 'comms' ? '<button class="btn" id="gSci">How the signal works</button>' : ''}</div></div></div>`
      : `<div class="gdet"><span class="gbig locked">?</span><div><h3>A part you haven't found yet</h3><p>${kid ? 'It comes in a supply crate. Keep exploring!' : 'It comes in a supply crate. You get one when you rank up and the first time you finish an expedition on each map.'}</p></div></div>`; }
  else detail = `<div class="gdet"><span class="gbig locked">${MR.SLOTS[selSlot].icon}</span><div><h3>${esc(MR.SLOTS[selSlot].name)}: empty</h3><p>Find a part for this slot in a supply crate.</p></div></div>`;
  const n = all.filter(k => g.own[k]).length;
  UI.openModal(`<div class="sh"><h2>Rover Garage</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb garage">
    <div class="gtop"><div class="gview"><canvas id="gCv" width="1280" height="800" aria-label="Your rover with its parts"></canvas>
        <div class="gmeta"><span class="pill">${n} of ${all.length} parts</span><span class="pill">${G.barsHtml({perks:MR.equippedPerks(p), role:p.role, rank:MR.rankOf(p.xp)})} Signal</span></div>
        <p class="muted gnote">${inGame ? 'Changes are fitted on your rover from the next sol.' : 'Your rover takes these parts on every expedition.'}</p></div>
      <div class="gslots">${slots.map(slotRow).join('')}</div></div>
    <h3 class="t">${esc(MR.SLOTS[selSlot].name)}</h3><div class="gparts">${partsFor(selSlot, p.role).map(opt).join('')}</div>
    ${detail}</div>`);
  const cv = $('gCv'); if (cv) picture(cv, previewRover(p), selSlot, fitAnim && fitAnim.until > performance.now() ? fitAnim : null, p);
  document.querySelectorAll('.gslot').forEach(b => b.onclick = () => { MR.sfx.click(); pick = b.dataset.slot; UI.garage(); });
  document.querySelectorAll('.gpart').forEach(b => b.onclick = () => { MR.sfx.click(); pick = b.dataset.part; UI.garage(); if (kid && g.own[pick]) say(pick); });
  if ($('gFit')) $('gFit').onclick = () => { const k = $('gFit').dataset.part; g.eq[MR.PARTS[k].slot] = k; fitAnim = {k, t0:performance.now(), until:performance.now() + 1400}; p.perks = MR.equippedPerks(p); MR.Store.save(); MR.sfx.good(); UI.garage(); if (G.onChange) G.onChange(); };
  if ($('gSay')) $('gSay').onclick = () => say(selPart, true);
  if ($('gSci')) $('gSci').onclick = () => UI.signalScience(() => UI.garage());
};
/* ---------- the garage picture ----------
   Photos: the Explorer rover (the player's own picture), and NASA's photos of Sojourner, Ingenuity and Apollo 15's
   Lunar Roving Vehicle. Zhurong has no free photo, so it is drawn (garage-art.js). On a photo, each fitted part
   glows with its label; empty slots show a dim "?", so the rover fills up as parts are collected. Some parts also
   change the picture: the gold dish, the laser, the glowing wheel rims. Spots are in the 1280 x 800 picture. */
const PHOTO = {
  mer:  {src:'img/garage/mer.jpg', credit:'Image: NASA, Mars Exploration Rover', spots:{sharp_eyes:[556, 40], supercam:[628, 30], hg_antenna:[885, 252], better_radio:[718, 104], big_battery:[560, 505], dust_wiper:[760, 398], wide_wheels:[660, 712]},
         wheels:[[205, 640, 70], [420, 600, 62], [660, 712, 78], [870, 636, 66], [1015, 566, 56]]},
  lrv:  {src:'img/garage/lrv.jpg', credit:'Photo: NASA, Apollo 15 (1971)', spots:{hg_antenna:[350, 165], better_radio:[685, 212], sharp_eyes:[412, 226], supercam:[650, 410], big_battery:[300, 548], dust_wiper:[545, 522], wide_wheels:[520, 625]},
         wheels:[[520, 625, 108], [1120, 598, 98]]},
  buggy:{src:'img/garage/buggy.jpg', credit:'Photo: NASA/JPL, Sojourner on Mars (1997)', spots:{sharp_eyes:[446, 424], scoop:[420, 482], better_radio:[432, 268], hg_antenna:[820, 220], memory_1:[560, 420], memory_2:[560, 420], memory_3:[560, 420]}},
  heli: {src:'img/garage/heli.jpg', credit:'Photo: NASA/JPL-Caltech/ASU/MSSS, Ingenuity on Mars (2023)', spots:{sharp_eyes:[612, 562], better_radio:[630, 186], hg_antenna:[708, 470], scoop:[560, 610], memory_1:[612, 500], memory_2:[612, 500], memory_3:[612, 500]}},
};
const imgs = {};
const photoOf = kind => { const P = PHOTO[kind]; if (!P) return null; let im = imgs[kind];
  if (!im) { im = imgs[kind] = new Image(); im.onload = () => { const cv = $('gCv'); if (cv && cv.isConnected) UI.garage(); }; im.src = P.src; }
  return im.complete && im.naturalWidth ? im : null; };
function picture(cv, r, sel, fit, p){
  const kind = MR.GarageArt.kind(r, {moon:r.moon}), P = PHOTO[kind], im = photoOf(kind), c = cv.getContext('2d');
  const draw = () => {
    if (!cv.isConnected) return;
    const t = performance.now(), live = fit && t < fit.until;
    let spots = {};
    if (P && im) {
      c.drawImage(im, 0, 0, 1280, 800);
      spots = Object.fromEntries(Object.entries(P.spots).filter(([k]) => MR.partOK(k, p.role)));
      photoParts(c, kind, r, t);
    } else { spots = MR.GarageArt.draw(cv, r, {t, fit:live ? fit : null, moon:r.moon});
      Object.keys(spots).forEach(k => spots[k] = [spots[k][0] * 1280 / cv.width, spots[k][1] * 800 / cv.height]); }
    labels(c, r, p, spots, sel, live ? fit : null, t);
    if (P && P.credit) { c.font = '500 18px "IBM Plex Sans", sans-serif'; c.textAlign = 'right'; c.fillStyle = 'rgba(0,0,0,.55)'; const w = c.measureText(P.credit).width; c.fillRect(1268 - w - 12, 766, w + 12, 26); c.fillStyle = '#c3ced8'; c.fillText(P.credit, 1262, 786); }
    requestAnimationFrame(draw);
  };
  draw();
}
/* Changes painted on the photos for upgraded parts. */
function photoParts(c, kind, r, t){
  const has = k => (r.perks || []).includes(k);
  if (kind === 'mer' && has('hg_antenna')) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#e8b54a'; c.beginPath(); c.ellipse(885, 252, 70, 58, -.25, 0, Math.PI*2); c.fill(); c.restore();
    c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(255,215,120,.35)'; c.beginPath(); c.ellipse(870, 240, 40, 30, -.25, 0, Math.PI*2); c.fill(); c.restore(); }
  if (kind === 'mer' && has('supercam')) { const a = .25 + .2 * Math.sin(t / 220); c.fillStyle = `rgba(255,60,40,${a})`; c.beginPath(); c.moveTo(640, 26); c.lineTo(1280, 120); c.lineTo(1280, 150); c.lineTo(640, 34); c.fill(); circle(c, 640, 30, 9, 'rgba(255,80,60,.9)'); }
  if (has('wide_wheels') && PHOTO[kind].wheels) PHOTO[kind].wheels.forEach(([x, y, rr]) => { c.strokeStyle = `rgba(240,191,90,${.55 + .25 * Math.sin(t / 300)})`; c.lineWidth = 6; c.beginPath(); c.ellipse(x, y, rr * .62, rr, 0, 0, Math.PI*2); c.stroke(); });
  if (has('better_radio') || has('hg_antenna')) { const sp = PHOTO[kind].spots.better_radio; if (sp) { const g = c.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 26); g.addColorStop(0, 'rgba(255,110,90,.95)'); g.addColorStop(1, 'rgba(255,110,90,0)'); c.fillStyle = g; c.beginPath(); c.arc(sp[0], sp[1], 26, 0, Math.PI*2); c.fill(); } }
}
const circle = (c, x, y, r, fill) => { c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); };
/* A glowing marker on each fitted part with its icon in a badge; a dim "?" where a slot is still empty. */
function labels(c, r, p, spots, sel, fit, t){
  const own = r.perks || [], used = [];
  Object.entries(spots).forEach(([k, [px, py]]) => {
    const on = own.includes(k), slot = MR.PARTS[k] && MR.PARTS[k].slot; if (!slot) return;
    if (!on && own.some(o => MR.PARTS[o] && MR.PARTS[o].slot === slot)) return;   // another part fills this slot
    if (used.some(([x, y]) => Math.hypot(x - px, y - py) < 30)) return; used.push([px, py]);
    const hi = slot === sel, len = Math.hypot(px - 640, py - 400) || 1;
    let bx = px + (px - 640) / len * 150, by = py + (py - 400) / len * 110; bx = Math.max(46, Math.min(1234, bx)); by = Math.max(46, Math.min(740, by));
    const drop = fit && fit.k === k ? Math.max(0, 1 - (t - fit.t0) / 700) : 0;
    if (on) { const pulse = 16 + 6 * Math.sin(t / 260), g = c.createRadialGradient(px, py, 0, px, py, pulse * 2.4); g.addColorStop(0, hi ? 'rgba(240,191,90,.75)' : 'rgba(88,207,190,.6)'); g.addColorStop(1, 'rgba(88,207,190,0)');
      c.fillStyle = g; c.beginPath(); c.arc(px, py, pulse * 2.4, 0, Math.PI*2); c.fill(); }
    c.setLineDash(on ? [] : [6, 8]); c.strokeStyle = on ? (hi ? '#f0bf5a' : 'rgba(255,255,255,.85)') : 'rgba(255,255,255,.35)'; c.lineWidth = on ? (hi ? 4 : 2.5) : 2;
    c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by - drop * 120); c.stroke(); c.setLineDash([]);
    circle(c, px, py, on ? 7 : 5, on ? (hi ? '#f0bf5a' : '#fff') : 'rgba(255,255,255,.4)');
    c.save(); c.translate(bx, by - drop * 120); c.globalAlpha = on ? 1 - drop * .6 : .55;
    circle(c, 0, 0, 34, 'rgba(10,14,19,.88)'); c.strokeStyle = on ? (hi ? '#f0bf5a' : '#58cfbe') : 'rgba(255,255,255,.35)'; c.lineWidth = on ? 4 : 2; c.setLineDash(on ? [] : [5, 6]); c.beginPath(); c.arc(0, 0, 34, 0, Math.PI*2); c.stroke(); c.setLineDash([]);
    c.font = on ? '34px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif' : '700 30px "Chakra Petch", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#c3ced8'; c.fillText(on ? MR.PARTS[k].icon : '?', 0, 2);
    c.restore();
    if (fit && fit.k === k) { const g2 = Math.min(1, (t - fit.t0) / 1300); if (g2 < 1) { c.strokeStyle = `rgba(255,236,190,${1 - g2})`; c.lineWidth = 5; c.beginPath(); c.arc(px, py, 14 + g2 * 90, 0, Math.PI*2); c.stroke(); } }
  });
  c.textBaseline = 'alphabetic';
}
function say(k, force){
  const s = MR.Store.settings; if ((!s.sound && !force) || !window.speechSynthesis || !k) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(`${MR.PARTS[k].kid}. ${MR.PARTS[k].kidGame || MR.PARTS[k].game}`); u.rate = .92; speechSynthesis.speak(u); } catch (e) {}
}

/* ---------- the supply crate ---------- */
const queue = []; let busy = false;
UI.crate = (id, from) => { queue.push({id, from}); if (!busy) next(); };
const FROM = {rank:'for your new rank', win:'for finishing this map'};
function next(){
  const it = queue.shift(); if (!it) { busy = false; return; }
  busy = true; const p = me(), kid = kidOf(p), P = it.id && MR.PARTS[it.id];
  const box = $('crate') || document.body.appendChild(Object.assign(document.createElement('div'), {id:'crate', className:'crateov'}));
  box.innerHTML = `<div class="crbox"><div class="rays"></div><div class="crpart">${P ? P.icon : '★'}</div>
      <div class="crlid"><span>SPARE PARTS</span></div><div class="crbase"><span>SUPPLY CRATE</span></div></div>
    <div class="crcard"><small>Supply crate${FROM[it.from] ? ' ' + FROM[it.from] : ''}</small>
      ${P ? `<h2>New part: ${esc(nameOf(it.id, p))}</h2><p class="slotname">${MR.SLOTS[P.slot].icon} ${esc(MR.SLOTS[P.slot].name)}</p>
        <p><b>In the game:</b> ${esc(gameOf(it.id, p))}</p><p><b>In real life:</b> ${esc(P.real)}</p>`
      : `<h2>You have every part!</h2><p>This crate held 25 XP and a sticker instead.</p>`}
      <div class="row">${P ? '<button class="btn primary" id="crGarage">See it in the garage</button>' : ''}<button class="btn" id="crOk">${P ? 'Great!' : 'OK'}</button></div></div>`;
  box.hidden = false; MR.sfx.chest();
  if (P && kid) setTimeout(() => say(it.id), 1300);
  const done = garage => { box.hidden = true; box.innerHTML = ''; if (garage) { pick = it.id; fitAnim = {k:it.id, t0:performance.now(), until:performance.now() + 1400}; UI.garage(); } next(); };
  $('crOk').onclick = () => done(false);
  if ($('crGarage')) $('crGarage').onclick = () => done(true);
}

/* ---------- the transmission: Earth's big dish sends dots to Mars ----------
   Stock: the rover's small antenna, slow and few dots. Better radio: through an orbiter overhead.
   High-gain dish: straight to the rover's gold dish, fast. Each upgrade looks and moves differently. */
G.mode = r => MR.hasPart(r, 'hg_antenna') ? 'dish' : MR.hasPart(r, 'better_radio') ? 'relay' : 'stock';
/* The picture (1200 x 300): NASA's Goldstone 70-meter dish aimed at Mars on the left, Mars from Viking on the right,
   and a close-up of the rover's antennas. The signal leaves the dish's receiver and lands on the antenna in use:
   the low-gain antenna (stock), the UHF radio through Mars Odyssey, or the high-gain dish (gold). */
const BG = new Image(); BG.src = 'img/garage/uplink.jpg';
const ROV = new Image(); ROV.src = 'img/garage/mer.jpg';
const S = [292, 124], ORB = [640, 44], INSET = [930, 14, 250, 160], CROP = [460, 40, 540, 345];
const ant = (x, y) => [INSET[0] + (x - CROP[0]) * INSET[2] / CROP[2], INSET[1] + (y - CROP[1]) * INSET[3] / CROP[3]];
const ANT = {stock:ant(700, 258), relay:ant(718, 100), dish:ant(885, 252)};
function at(mode, u){
  const M = ANT[mode];
  if (mode === 'relay') { const l1 = Math.hypot(ORB[0]-S[0], ORB[1]-S[1]), l2 = Math.hypot(M[0]-ORB[0], M[1]-ORB[1]), d = u * (l1 + l2);
    return d < l1 ? [S[0] + (ORB[0]-S[0])*d/l1, S[1] + (ORB[1]-S[1])*d/l1] : [ORB[0] + (M[0]-ORB[0])*(d-l1)/l2, ORB[1] + (M[1]-ORB[1])*(d-l1)/l2]; }
  const b = [650, mode === 'dish' ? 10 : 70], v = 1 - u; return [v*v*S[0] + 2*v*u*b[0] + u*u*M[0], v*v*S[1] + 2*v*u*b[1] + u*u*M[1]];
}
G.drawUplink = (cv, k, r, t, beep) => {
  const c = cv.getContext('2d'), W = 1200, H = 300, mode = G.mode(r);
  c.fillStyle = '#04060a'; c.fillRect(0, 0, W, H);
  if (BG.complete && BG.naturalWidth) c.drawImage(BG, 0, 0, W, H);
  // the rover's antennas, close up, with the one in use lit
  const [ix, iy, iw, ih] = INSET;
  if (ROV.complete && ROV.naturalWidth) c.drawImage(ROV, CROP[0] * ROV.naturalWidth / 1280, CROP[1] * ROV.naturalHeight / 800, CROP[2] * ROV.naturalWidth / 1280, CROP[3] * ROV.naturalHeight / 800, ix, iy, iw, ih);
  if (mode === 'dish') { const [dx, dy] = ANT.dish; c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip(); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#e8b54a'; c.beginPath(); c.ellipse(dx, dy, 32, 27, -.25, 0, Math.PI*2); c.fill(); c.restore(); }
  c.strokeStyle = 'rgba(195,206,216,.6)'; c.lineWidth = 2; c.strokeRect(ix, iy, iw, ih);
  c.fillStyle = 'rgba(4,6,10,.75)'; c.fillRect(ix, iy + ih - 24, iw, 24); c.font = '600 15px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#c3ced8'; c.fillText('YOUR ROVER', ix + iw / 2, iy + ih - 7);
  const [ax, ay] = ANT[mode], gl = 14 + 4 * Math.sin(t / 200), g = c.createRadialGradient(ax, ay, 0, ax, ay, gl * 1.8);
  g.addColorStop(0, mode === 'dish' ? 'rgba(255,215,120,.9)' : 'rgba(88,207,190,.9)'); g.addColorStop(1, 'rgba(88,207,190,0)'); c.fillStyle = g; c.beginPath(); c.arc(ax, ay, gl * 1.8, 0, Math.PI*2); c.fill();
  // Mars Odyssey for the radio relay
  if (mode === 'relay') { c.save(); c.translate(ORB[0], ORB[1] + Math.sin(t / 700) * 3);
    c.fillStyle = '#2b4a72'; c.fillRect(-58, -6, 40, 12); c.strokeStyle = 'rgba(150,190,235,.5)'; c.lineWidth = 1; for (let x = -54; x < -18; x += 8) { c.beginPath(); c.moveTo(x, -6); c.lineTo(x, 6); c.stroke(); }
    c.fillStyle = '#7d858c'; c.fillRect(-18, -1.5, 6, 3);
    const gb = c.createLinearGradient(-12, -14, 14, 14); gb.addColorStop(0, '#f2d58a'); gb.addColorStop(1, '#a8812f'); c.fillStyle = gb; c.fillRect(-12, -12, 26, 24);
    c.strokeStyle = '#c9ced4'; c.lineWidth = 2; c.beginPath(); c.moveTo(14, 0); c.lineTo(30, -16); c.stroke(); c.fillStyle = '#d5d9dd'; c.beginPath(); c.ellipse(32, -18, 9, 4, -.8, 0, Math.PI*2); c.fill();
    c.restore(); c.font = '600 15px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#e8cf7a'; c.fillText('MARS ODYSSEY', ORB[0], ORB[1] + 34); }
  // the path and the dots: more and faster with better gear
  c.setLineDash([6, 10]); c.strokeStyle = 'rgba(88,207,190,.4)'; c.lineWidth = 2.5; c.beginPath();
  for (let u = 0; u <= 1.001; u += .02) { const [x, y] = at(mode, u); u ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
  const n = mode === 'dish' ? 16 : mode === 'relay' ? 10 : 5, speed = mode === 'dish' ? 1.6 : mode === 'relay' ? 1 : .5, col = mode === 'dish' ? '#f6dc94' : '#58cfbe';
  for (let i = 0; i < n; i++) { const u = ((t / 1000 * speed) + i / n) % 1; if (u > k + .02) continue; const [x, y] = at(mode, u);
    c.fillStyle = col; c.globalAlpha = .45 + .55 * (1 - Math.abs(u - k)); c.beginPath(); c.arc(x, y, mode === 'dish' ? 6 : 5, 0, Math.PI*2); c.fill(); }
  c.globalAlpha = 1; const [hx, hy] = at(mode, Math.min(1, k));
  const hg = c.createRadialGradient(hx, hy, 0, hx, hy, 26); hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(1, 'rgba(88,207,190,0)'); c.fillStyle = hg; c.beginPath(); c.arc(hx, hy, 26, 0, Math.PI*2); c.fill();
  // the rover's "beep" back to Earth: it got the plan
  if (beep != null) { const [bx, by] = at(mode === 'relay' ? 'stock' : mode, 1 - Math.min(1, beep));
    c.fillStyle = '#ff9f6b'; c.beginPath(); c.arc(bx, by, 9, 0, Math.PI*2); c.fill(); c.strokeStyle = 'rgba(255,159,107,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(bx, by, 16 + (t / 50) % 12, 0, Math.PI*2); c.stroke();
    c.font = '700 26px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = '#ff9f6b'; c.fillText('BEEP! THE ROVER GOT THE PLAN', 620, 160); }
  c.font = '600 17px "IBM Plex Mono", monospace'; c.textAlign = 'left'; c.fillStyle = '#e6ecf1'; c.fillText('EARTH · NASA DEEP SPACE NETWORK', 14, 26);
  c.font = '700 24px "IBM Plex Mono", monospace'; c.textAlign = 'center'; c.fillStyle = mode === 'dish' ? '#f6dc94' : '#58cfbe';
  c.fillText(mode === 'dish' ? 'HIGH-GAIN ANTENNA: STRAIGHT TO MARS' : mode === 'relay' ? 'UHF RADIO: THROUGH AN ORBITER' : 'LOW-GAIN ANTENNA: SLOW', 620, H - 22);
  c.font = '500 12px "IBM Plex Sans", sans-serif'; c.textAlign = 'right'; c.fillStyle = 'rgba(195,206,216,.7)'; c.fillText('Goldstone dish: NASA/JPL-Caltech · Mars: NASA/JPL/USGS', W - 10, H - 8);
};
/* ---------- How the signal works: five ideas at kid level, from JPL's report on the Mars rovers' radios ---------- */
UI.signalScience = back => {
  const box = (ic, h, body) => `<div class="sci"><span class="sic">${ic}</span><div><h3>${h}</h3>${body}</div></div>`;
  UI.openModal(`<div class="sh"><h2>How the signal works</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb sciw">
    ${box('⚡', 'Radio waves are light you can\'t see', '<p>Your plan travels as radio waves. They are a kind of light, so they fly at the speed of light: 300,000 kilometers every second. Around the Earth more than 7 times in one second!</p>')}
    ${box('🪐', 'Mars is far away, and the distance changes', `<p>Earth and Mars both go around the Sun, so sometimes they are close and sometimes far apart. Move the slider:</p>
      <input type="range" id="sciKm" min="55" max="401" value="225" aria-label="Distance from Earth to Mars in millions of kilometers">
      <p class="scibig" id="sciOut"></p><p class="muted">The game makes the wait much shorter, so you don't sit for 20 minutes!</p>`)}
    ${box('🔦', 'A dish is like a flashlight', '<p>A light bulb shines everywhere, so only a little light reaches far away. A flashlight squeezes its light into a beam that reaches much farther. A <b>low-gain antenna</b> is like the bulb: slow, but it works whichever way the rover faces. A <b>high-gain antenna</b> is like the flashlight: much faster, but it has to point right at Earth.</p>')}
    ${box('🛰️', 'Orbiters carry messages', '<p>An orbiter like Mars Odyssey flies close over the rover a few times a day. It catches the rover\'s data with a small radio and sends it to Earth with its big antenna. Spirit and Opportunity sent about 9 of every 10 pieces of their data home this way.</p>')}
    ${box('📡', 'Earth\'s three big ears, and the beep', '<p>NASA listens with huge dishes in California, Spain and Australia. As the Earth spins, one of them can always see Mars. Each morning the team sent the rover its plan, and the rover answered with a short <b>beep</b> to say "got it!"</p>')}
    <p class="muted" style="margin:0;font-size:12.5px">From JPL's report on the Mars Exploration Rovers' radios (DESCANSO series, 2005).</p>
    ${back ? '<div class="row"><button class="btn" id="sciBack">Back to the garage</button></div>' : ''}</div>`);
  const out = () => { const km = +$('sciKm').value, min = km * 1e6 / 299792 / 60; $('sciOut').textContent = `${km} million km: your plan takes ${min < 10 ? min.toFixed(1) : Math.round(min)} minutes to reach Mars.`; };
  $('sciKm').oninput = out; out();
  if ($('sciBack')) $('sciBack').onclick = back;
};

/* The next comms part to look forward to, so kids see where the upgrades lead. */
G.nextComms = r => { const p = me(); if (!p) return null; const g = MR.garageOf(p);
  const k = ['better_radio','hg_antenna'].find(x => !g.own[x] && MR.partOK(x, p.role)); return k ? `Next upgrade: ${kidOf(p) ? MR.PARTS[k].kid : MR.PARTS[k].name} (${k === 'hg_antenna' ? 'about 3 times as fast' : '30% faster'}). It comes in a supply crate.` : null; };

/* ---------- the top bar button and the dashboard ---------- */
const btn = document.createElement('button'); btn.className = 'btn'; btn.id = 'garageBtn'; btn.hidden = true;
btn.innerHTML = '<span aria-hidden="true">🔧</span> Garage'; btn.onclick = () => { MR.sfx.click(); UI.garage(); };
$('invBtn').before(btn);
const sync = () => { btn.hidden = $('invBtn').hidden; };
new MutationObserver(sync).observe($('invBtn'), {attributes:true, attributeFilter:['hidden']}); sync();
/* The parts chip on the map's dashboard: every fitted part, the signal bars, and a tap opens the garage. */
let lastFit = null;
G.hud = r => {
  const el = $('cParts'); if (!el) return;
  station();
  /* A part fitted since last time: sparkles on the rover and a note, so the change is easy to notice. */
  const key = r ? r.pid + ':' + (r.perks || []).join(',') : null;
  if (r && lastFit && lastFit.pid === r.pid && lastFit.key !== key) { const added = (r.perks || []).filter(k => !lastFit.perks.includes(k));
    if (added.length && MR.Render) { MR.Render.addFx({type:'confetti', x:r.x + .5, y:r.y + .5, dur:1600, parts:MR.confetti()}); MR.sfx.chest();
      UI.toast(MR.PARTS[added[0]].icon, '#f0bf5a', `New part fitted: ${nameOf(added[0], me())}`, gameOf(added[0], me()), 5000); } }
  lastFit = r ? {pid:r.pid, key, perks:(r.perks || []).slice()} : null;
  if (!r || r.job === 'lab') { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="k">Rover parts</span><span class="v">${(r.perks || []).map(k => `<span title="${esc(MR.PARTS[k] ? MR.PARTS[k].name : k)}">${MR.PARTS[k] ? MR.PARTS[k].icon : ''}</span>`).join('') || '<small>stock</small>'} ${G.barsHtml(r)}</span>`;
};
$('cParts') && ($('cParts').onclick = () => UI.garage());
/* The station strip: the modules the team has built this expedition. One more comes with each finished campaign. */
function station(){
  const st = MR.Game && MR.Game.state; let el = $('cStation');
  if (!el) { el = document.createElement('button'); el.className = 'chip parts'; el.id = 'cStation'; el.setAttribute('aria-label', 'Station modules'); $('cParts').after(el); el.onclick = stationInfo; }
  if (!st || !st.lab || MR.MAPS[st.map].airless || st.day) { el.hidden = true; return; }
  const b = st.lab.built || {}, n = MR.STATION_ORDER.filter(k => b[k]).length;
  el.hidden = false;
  el.innerHTML = `<span class="k">Station ${n}/${MR.STATION_ORDER.length}</span><span class="v">${MR.STATION_ORDER.map(k => `<span class="mod ${b[k] ? 'on' : ''}" title="${esc(MR.UPGRADES[k].name)}">${MR.UPGRADES[k].icon}</span>`).join('')}</span>`;
}
function stationInfo(){
  const st = MR.Game && MR.Game.state; if (!st || !st.lab) return; const b = st.lab.built || {}, i = st.camp ? st.camp.i : 0;
  let nextAt = i + 1;
  UI.openModal(`<div class="sh"><h2>The station</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
    <p class="muted" style="margin:0">The whole team shares the station. Each finished campaign adds the next module for this expedition. A Lab player can build them sooner.</p>
    <div class="perks">${MR.STATION_ORDER.map(k => { const on = !!b[k], when = on ? 'Built!' : `Comes after campaign ${nextAt++}.`;
      return `<div class="perk ${on ? '' : 'locked'}" aria-pressed="${on}"><span class="pi">${MR.UPGRADES[k].icon}</span><span><b>${esc(MR.UPGRADES[k].name)}</b><small>${esc(MR.UPGRADES[k].desc)}</small><small>${when}</small></span></div>`; }).join('')}</div></div>`, true);
}
})();
