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
  if (r) return {...r, perks, zh:st.map === 'utopia' && !['heli','buggy','lab'].includes(r.job)};
  return {job:p.job || MR.defaultJob(p.role), role:p.role, color:p.color || 'teal', perks, rank:MR.rankOf(p.xp), tubes:[]};
}

/* ---------- the garage ---------- */
let pick = null;
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
        <div class="row">${on ? '<span class="pill ok">✓ Fitted on your rover</span>' : `<button class="btn primary" id="gFit" data-part="${selPart}">Fit this part</button>`}${kid ? '<button class="btn" id="gSay" aria-label="Read it to me">🔊</button>' : ''}</div></div></div>`
      : `<div class="gdet"><span class="gbig locked">?</span><div><h3>A part you haven't found yet</h3><p>${kid ? 'It comes in a supply crate. Keep exploring!' : 'It comes in a supply crate. You get one when you rank up and the first time you finish an expedition on each map.'}</p></div></div>`; }
  else detail = `<div class="gdet"><span class="gbig locked">${MR.SLOTS[selSlot].icon}</span><div><h3>${esc(MR.SLOTS[selSlot].name)}: empty</h3><p>Find a part for this slot in a supply crate.</p></div></div>`;
  const n = all.filter(k => g.own[k]).length;
  UI.openModal(`<div class="sh"><h2>Rover Garage</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb garage">
    <div class="gtop"><div class="gview"><canvas id="gCv" width="320" height="320" aria-label="Your rover with its parts"></canvas>
        <div class="gmeta"><span class="pill">${n} of ${all.length} parts</span><span class="pill">${G.barsHtml({perks:MR.equippedPerks(p), role:p.role, rank:MR.rankOf(p.xp)})} Signal</span></div>
        <p class="muted gnote">${inGame ? 'Changes are fitted on your rover from the next sol.' : 'Your rover takes these parts on every expedition.'}</p></div>
      <div class="gslots">${slots.map(slotRow).join('')}</div></div>
    <h3 class="t">${esc(MR.SLOTS[selSlot].name)}</h3><div class="gparts">${partsFor(selSlot, p.role).map(opt).join('')}</div>
    ${detail}</div>`);
  const cv = $('gCv'); if (cv && MR.Render && MR.Render.drawPreview) { const pr = previewRover(p); MR.Render.drawPreview(cv, pr, false); callouts(cv, pr, selSlot); }
  document.querySelectorAll('.gslot').forEach(b => b.onclick = () => { MR.sfx.click(); pick = b.dataset.slot; UI.garage(); });
  document.querySelectorAll('.gpart').forEach(b => b.onclick = () => { MR.sfx.click(); pick = b.dataset.part; UI.garage(); if (kid && g.own[pick]) say(pick); });
  if ($('gFit')) $('gFit').onclick = () => { const k = $('gFit').dataset.part; g.eq[MR.PARTS[k].slot] = k; p.perks = MR.equippedPerks(p); MR.Store.save(); MR.sfx.good(); UI.garage(); if (G.onChange) G.onChange(); };
  if ($('gSay')) $('gSay').onclick = () => say(selPart, true);
};
/* Labels around the picture: each fitted part's icon, with a line to where it sits on the rover. */
const SPOT = {wide_wheels:[.43,.41], sharp_eyes:[.22,-.36], big_battery:[-.22,.09], dust_wiper:[-.13,-.11], better_radio:[-.36,.02], hg_antenna:[.27,.24],
  supercam:[0,-.4], scoop:[-.44,-.47], memory_1:[0,.24], memory_2:[0,.24], memory_3:[0,.24]};
function callouts(cv, r, sel){
  const c = cv.getContext('2d'), W = cv.width, s = W*.62, cx = W/2, cy = W/2;
  (r.perks || []).forEach(k => { const at = SPOT[k]; if (!at) return;
    const big = k === 'better_radio' && r.job !== 'heli' && r.job !== 'buggy' && !r.zh ? [.2, .3] : k === 'hg_antenna' && r.job !== 'heli' && r.job !== 'buggy' && !r.zh ? [-.12, .13] : at;
    const px = cx + big[0]*s, py = cy + big[1]*s, len = Math.hypot(big[0], big[1]) || 1, bx = Math.max(24, Math.min(W - 24, cx + big[0]/len*W*.43)), by = Math.max(24, Math.min(W - 24, cy + big[1]/len*W*.43));
    const on = MR.PARTS[k].slot === sel;
    c.strokeStyle = on ? '#f0bf5a' : 'rgba(255,255,255,.75)'; c.lineWidth = on ? 3 : 1.5; c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke();
    c.fillStyle = on ? '#f0bf5a' : '#fff'; c.beginPath(); c.arc(px, py, 4, 0, Math.PI*2); c.fill();
    c.fillStyle = 'rgba(14,19,25,.9)'; c.beginPath(); c.arc(bx, by, 20, 0, Math.PI*2); c.fill(); c.strokeStyle = on ? '#f0bf5a' : '#58cfbe'; c.lineWidth = on ? 3 : 2; c.stroke();
    c.font = '20px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(MR.PARTS[k].icon, bx, by + 1);
  });
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
  const done = garage => { box.hidden = true; box.innerHTML = ''; if (garage) { pick = it.id; UI.garage(); } next(); };
  $('crOk').onclick = () => done(false);
  if ($('crGarage')) $('crGarage').onclick = () => done(true);
}

/* ---------- the transmission: Earth's big dish sends dots to Mars ----------
   Stock: the rover's small antenna, slow and few dots. Better radio: through an orbiter overhead.
   High-gain dish: straight to the rover's gold dish, fast. Each upgrade looks and moves differently. */
const STARS = Array.from({length:40}, (_, i) => [(i * 137) % 600, (i * 71) % 150, (i % 3) * .4 + .4]);
G.mode = r => MR.hasPart(r, 'hg_antenna') ? 'dish' : MR.hasPart(r, 'better_radio') ? 'relay' : 'stock';
const E = [92, 62], M = [512, 66], ORB = [300, 30];
function at(mode, u){
  if (mode === 'relay') { const l1 = Math.hypot(ORB[0]-E[0], ORB[1]-E[1]), l2 = Math.hypot(M[0]-ORB[0], M[1]-ORB[1]), d = u * (l1 + l2);
    return d < l1 ? [E[0] + (ORB[0]-E[0])*d/l1, E[1] + (ORB[1]-E[1])*d/l1] : [ORB[0] + (M[0]-ORB[0])*(d-l1)/l2, ORB[1] + (M[1]-ORB[1])*(d-l1)/l2]; }
  const b = [300, mode === 'dish' ? 20 : 44], v = 1 - u; return [v*v*E[0] + 2*v*u*b[0] + u*u*M[0], v*v*E[1] + 2*v*u*b[1] + u*u*M[1]];
}
G.drawUplink = (cv, k, r, t) => {
  const c = cv.getContext('2d'), W = 600, H = 150, mode = G.mode(r);
  c.clearRect(0, 0, W, H);
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05080d'); bg.addColorStop(1, '#0d1420'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
  STARS.forEach(([x, y, a]) => { c.fillStyle = `rgba(255,255,255,${a})`; c.fillRect(x, y, 1.5, 1.5); });
  // Earth with the Deep Space Network dish
  const eg = c.createRadialGradient(40, 112, 6, 56, 128, 66); eg.addColorStop(0, '#7fc4ff'); eg.addColorStop(.6, '#2f6fb3'); eg.addColorStop(1, '#16365a');
  c.fillStyle = eg; c.beginPath(); c.arc(56, 140, 66, 0, Math.PI*2); c.fill();
  c.fillStyle = 'rgba(110,190,120,.75)'; c.beginPath(); c.ellipse(36, 110, 20, 11, -.4, 0, Math.PI*2); c.fill(); c.beginPath(); c.ellipse(84, 128, 13, 16, .3, 0, Math.PI*2); c.fill();
  c.save(); c.translate(74, 86); c.scale(1.7, 1.7); c.strokeStyle = '#c9ced4'; c.lineWidth = 3; c.beginPath(); c.moveTo(-5, 6); c.lineTo(0, -4); c.lineTo(5, 6); c.stroke();
  c.rotate(-.6); c.fillStyle = '#eef2f5'; c.beginPath(); c.ellipse(0, -8, 16, 6, 0, Math.PI, 0); c.fill(); c.strokeStyle = '#9aa3ab'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -8); c.lineTo(0, -18); c.stroke(); c.restore();
  // Mars with the rover and its antenna (each upgrade looks different)
  const mg = c.createRadialGradient(530, 118, 6, 546, 132, 64); mg.addColorStop(0, '#f2a271'); mg.addColorStop(.7, '#b4532f'); mg.addColorStop(1, '#6d2c18');
  c.fillStyle = mg; c.beginPath(); c.arc(546, 146, 64, 0, Math.PI*2); c.fill();
  c.save(); c.translate(506, 96); c.scale(2, 2);
  c.fillStyle = '#d5d9dd'; c.fillRect(-2, -6, 24, 9); c.fillStyle = '#58cfbe'; c.fillRect(-2, -1, 24, 2); c.fillStyle = '#3a3f45'; [0, 10, 20].forEach(x => { c.beginPath(); c.arc(x, 4, 3.2, 0, Math.PI*2); c.fill(); });
  if (mode === 'dish') { c.save(); c.translate(14, -8); c.rotate(-.75); const g = c.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, '#f6dc94'); g.addColorStop(1, '#a8812f'); c.fillStyle = g; c.beginPath(); c.ellipse(0, -2, 11, 5, 0, Math.PI, 0); c.fill(); c.restore(); }
  if (mode !== 'stock') { c.strokeStyle = '#8d949c'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(2, -6); c.lineTo(-1, -20); c.stroke(); c.fillStyle = '#ff6b5a'; c.beginPath(); c.arc(-1, -21, 2.2, 0, Math.PI*2); c.fill(); }
  else { c.strokeStyle = '#8d949c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(2, -6); c.lineTo(2, -13); c.stroke(); }
  c.restore();
  // the orbiter for the radio relay
  if (mode === 'relay') { c.save(); c.translate(ORB[0], ORB[1] + Math.sin(t / 600) * 2); c.scale(1.5, 1.5); c.fillStyle = '#c9a23a'; c.fillRect(-5, -4, 10, 8); c.fillStyle = '#24456a'; c.fillRect(-20, -2, 13, 4); c.fillRect(7, -2, 13, 4); c.restore(); }
  // the dotted path, then the signal's dots: more and faster with better gear
  c.setLineDash([4, 7]); c.strokeStyle = 'rgba(88,207,190,.35)'; c.lineWidth = 2; c.beginPath();
  for (let u = 0; u <= 1.001; u += .02) { const [x, y] = at(mode, u); u ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
  const n = mode === 'dish' ? 14 : mode === 'relay' ? 9 : 5, speed = mode === 'dish' ? 1.6 : mode === 'relay' ? 1 : .55, col = mode === 'dish' ? '#f6dc94' : '#58cfbe';
  for (let i = 0; i < n; i++) { const u = ((t / 1000 * speed) + i / n) % 1; if (u > k + .02) continue; const [x, y] = at(mode, u);
    c.fillStyle = col; c.globalAlpha = .45 + .55 * (1 - Math.abs(u - k)); c.beginPath(); c.arc(x, y, mode === 'dish' ? 4 : 3.5, 0, Math.PI*2); c.fill(); }
  c.globalAlpha = 1; const [hx, hy] = at(mode, Math.min(1, k));
  const hg = c.createRadialGradient(hx, hy, 0, hx, hy, 16); hg.addColorStop(0, 'rgba(255,255,255,.95)'); hg.addColorStop(1, 'rgba(88,207,190,0)'); c.fillStyle = hg; c.beginPath(); c.arc(hx, hy, 16, 0, Math.PI*2); c.fill();
  if (k >= 1) { c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.beginPath(); c.arc(M[0], M[1] + 18, 12 + (t / 40) % 16, 0, Math.PI*2); c.stroke(); }
  c.font = '600 14px "IBM Plex Mono", monospace'; c.fillStyle = '#c3ced8'; c.textAlign = 'left'; c.fillText('EARTH', 10, 20);
  c.textAlign = 'right'; c.fillText('MARS', W - 10, 20);
  c.textAlign = 'center'; c.fillStyle = mode === 'dish' ? '#f6dc94' : '#58cfbe'; c.font = '700 15px "IBM Plex Mono", monospace';
  c.fillText(mode === 'dish' ? 'BIG DISH: STRAIGHT TO MARS' : mode === 'relay' ? 'RADIO: VIA AN ORBITER' : 'SMALL ANTENNA: SLOW', W / 2, H - 12);
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
