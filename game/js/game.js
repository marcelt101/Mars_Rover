/* The game controller: lobby, hosting/joining, planning, playback and rewards. */
(function () {
const MR = window.MR, UI = MR.UI, R = MR.Render, $ = UI.$, esc = UI.esc;
const {MW} = MR;

const G = MR.Game = {
  mode:null, net:null, code:null, myPid:null, phase:'home',
  lobby:{players:[], map:'jezero', unlocked:['jezero']},
  state:null, plan:[], ready:false, readyPids:[], plans:{}, drafts:{}, cid2pid:{},
  planInfo:null, contAfterWin:false, showCode:false, pending:[], lastPing:null, wake:null, lastSeen:{}, lastPong:0, chain:Promise.resolve(),
};
const me = () => MR.Store.current();
const myRover = () => G.state && G.state.rovers.find(r => r.pid === G.myPid);
const myRole = () => (myRover() || me() || {role:'explorer'}).role;
const isHostish = () => G.mode === 'solo' || G.mode === 'host';
const team = () => G.mode !== 'solo';

/* ---------- start-up ---------- */
$('fast').checked = MR.Store.settings.fast; $('sound').checked = MR.Store.settings.sound;
$('fast').onchange = e => { MR.Store.settings.fast = e.target.checked; MR.Store.save(); };
$('sound').onchange = e => { MR.Store.settings.sound = e.target.checked; MR.Store.save(); };
R.init($('map'), $('mini'), $('mapbox'));
const q = new URLSearchParams(location.search);
if (q.get('join')) $('joinCode').value = 'MARS-' + MR.cleanCode(q.get('join'));
UI.renderHome(); UI.show('scrHome');
if (!MR.Store.profiles().length) UI.profileModal(null);
if (!MR.netAvailable()) { $('joinErr').hidden = false; $('joinErr').textContent = 'Team games need an internet connection to find each other. Solo play works offline.'; }
G.onProfileChanged = () => { if (G.phase === 'lobby') { refreshMyLobbyEntry(); } UI.renderMe(); };

$('homeBtn').onclick = () => { if (G.phase === 'lobby') leave(); };
$('soloBtn').onclick = () => { if (!me()) return; G.lostCode = null; G.mode = 'solo'; G.myPid = me().id; G.lobby = {players:[{...MR.playerSummary(me()), connected:true, host:true}], map:MR.Store.unlocked().slice(-1)[0], unlocked:MR.Store.unlocked()}; enterLobby(); };
$('hostBtn').onclick = () => startHost();
/* Tutorial: a normal solo game on a fixed, safe Jezero layout with a find 3 squares west of the rover. */
G.startTutorial = () => {
  const p = me(); if (!p) return;
  G.lostCode = null; G.mode = 'solo'; G.myPid = p.id;
  const pl = {...MR.playerSummary(p), connected:true, host:true};
  G.lobby = {players:[pl], map:'jezero', unlocked:MR.Store.unlocked()};
  const st = MR.newGame({map:'jezero', seed:424242, players:[pl]}), W = st.world, r = st.rovers[0];
  r.x = 33; r.y = 22; r.dir = 3;
  for (let x = 28; x <= 33; x++) for (let y = 21; y <= 23; y++) { const i = y*MW + x; W.obs[i] = ''; W.trap[i] = 0; W.trapSeen[i] = 0; if (y === 22) { W.res[i] = ''; W.kid[i] = 0; } if (MR.TER[W.ter[i]].block) W.ter[i] = 0; }
  const t = 22*MW + 30;
  if (p.role === 'cadet') { W.res[t] = 'olivine'; W.kid[t] = 1; W.sig[t] = 1; W.known[t] = 1; W.seen[t] = 1; }
  else { W.res[t] = 'clay'; W.sig[t] = 0; W.known[t] = 0; }
  if (p.role === 'specialist') { $('editor').value = 'from mars import rover\n\n'; $('editor').dataset.touched = '1'; }
  enterGame(st);
  MR.Tutorial.start(p.role);
};
G.api = {myRover:() => myRover(), planActions:() => planActions(), applyPlan:(a, rep) => applyPlan(a, rep), phase:() => G.phase, sol:() => G.state ? G.state.sol : 0, plan:() => G.plan};
$('joinBtn').onclick = () => joinGame($('joinCode').value);
$('joinCode').onkeydown = e => { if (e.key === 'Enter') joinGame($('joinCode').value); };

function leave(){
  if (G.net) { try { G.net.close(); } catch (e) {} }
  if (G.wake) { try { G.wake.release(); } catch (e) {} G.wake = null; }
  clearInterval(G.pingTimer);
  G.gen = (G.gen || 0) + 1;
  if (MR.Tutorial) MR.Tutorial.stop();
  Object.assign(G, {chain:Promise.resolve(), mode:null, net:null, code:null, phase:'home', state:null, plan:[], ready:false, readyPids:[], plans:{}, drafts:{}, cid2pid:{}, pending:[]});
  document.body.classList.remove('bigmap');
  $('win').hidden = true; $('joinBtn').disabled = false; $('joinBtn').textContent = 'Join'; UI.renderHome(); UI.show('scrHome');
}

/* ---------- hosting ---------- */
function startHost(){
  const p = me(); if (!p) return;
  G.mode = 'host'; G.myPid = p.id; G.code = MR.makeRoomCode(); G.hostErrShown = false; G.lostCode = null;
  G.lobby = {players:[{...MR.playerSummary(p), connected:true, host:true}], map:MR.Store.unlocked().slice(-1)[0], unlocked:MR.Store.unlocked()};
  $('netStatus').textContent = 'Opening room…';
  G.net = MR.Net.host(G.code, {
    onOpen:() => { $('netStatus').textContent = 'Room open'; renderLobby(); },
    onError:e => { if (e === 'taken') { G.net.close(); startHost(); return; }
      $('netStatus').textContent = 'Not connected';
      if (G.hostErrShown) return; G.hostErrShown = true; UI.toast('!', '#ff7b6c', 'Could not open the room', MR.Net.errorText(e), 8000); },
    onConnect:cid => {},
    onDisconnect:cid => { const pid = G.cid2pid[cid]; delete G.cid2pid[cid]; if (pid) playerGone(pid); },
    onMessage:(cid, m) => hostMessage(cid, m),
  });
  keepAwake();
  enterLobby();
}
async function keepAwake(){
  try { if ('wakeLock' in navigator) { G.wake = await navigator.wakeLock.request('screen'); } } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (G.mode === 'host' && document.visibilityState === 'visible') keepAwake(); });

const send = (pid, m) => { if (G.mode !== 'host') return; Object.entries(G.cid2pid).forEach(([cid, p]) => { if (p === pid) G.net.send(cid, m); }); };
const broadcast = m => { if (G.mode === 'host' && G.net) G.net.broadcast(m); };
const lobbyMsg = () => ({type:'lobby', lobby:G.lobby, code:G.code});
function uniqueColor(p){
  const used = G.lobby.players.filter(x => x.pid !== p.pid).map(x => x.color);
  if (!used.includes(p.color)) return p.color;
  return (MR.COLORS.find(c => !used.includes(c.id)) || MR.COLORS[0]).id;
}
setInterval(() => {
  if (G.mode !== 'host' || !G.net) return;
  const now = Date.now();
  Object.keys(G.cid2pid).forEach(cid => { if (now - (G.lastSeen[cid] || now) > 12000) G.net.drop(cid); });
}, 3000);
function hostMessage(cid, m){
  if (!m || typeof m !== 'object') return;
  G.lastSeen[cid] = Date.now();
  if (m.type === 'ping') { G.net.send(cid, {type:'pong', t:m.t}); return; }
  if (m.type === 'hello') {
    if (m.v !== MR.VERSION) { G.net.send(cid, {type:'error', text:'This device has a different version of the game. Reload the page on both devices.'}); return; }
    const pl = {...m.player, name:String(m.player.name||'Rover').slice(0,16)};
    if (G.phase === 'run') { G.pending.push(() => hostMessage(cid, m)); return; }
    const known = G.lobby.players.find(x => x.pid === pl.pid);
    if (!known && G.lobby.players.length >= MR.MAX_PLAYERS) { G.net.send(cid, {type:'error', text:'This game already has 6 players.'}); return; }
    G.cid2pid[cid] = pl.pid;
    if (known) Object.assign(known, {...pl, color:uniqueColor(pl), connected:true, host:known.host});
    else G.lobby.players.push({...pl, color:uniqueColor(pl), connected:true, host:false});
    MR.sfx.join();
    if (G.phase === 'lobby') { broadcast(lobbyMsg()); renderLobby(); return; }
    // joining or rejoining a running game
    const lp = G.lobby.players.find(x => x.pid === pl.pid);
    if (!G.state.rovers.some(r => r.pid === pl.pid)) { MR.addRover(G.state, lp); broadcast({type:'state', state:MR.stateToWire(G.state)}); setGameState(G.state); log('info', `${lp.name} joined the expedition.`); }
    else { G.net.send(cid, {type:'start', state:MR.stateToWire(G.state), lobby:G.lobby, code:G.code}); log('info', `${lp.name} reconnected.`); }
    G.net.send(cid, {type:'ready', pids:G.readyPids}); G.net.send(cid, {type:'drafts', drafts:G.drafts});
    broadcast(lobbyMsg()); renderGame(); return;
  }
  const pid = G.cid2pid[cid]; if (!pid) return;
  hostHandle(pid, m);
}
/* Messages from any player, including the host itself. */
function hostHandle(pid, m){
  const lp = G.lobby.players.find(x => x.pid === pid);
  switch (m.type) {
    case 'job': if (lp && MR.JOBS[m.job] && MR.JOBS[m.job].roles.includes(lp.role)) { lp.job = m.job; broadcast(lobbyMsg()); renderLobby(); } break;
    case 'plan':
      if (G.phase !== 'plan' && G.phase !== 'run') return;
      G.plans[pid] = Array.isArray(m.actions) ? m.actions.slice(0, 60) : [];
      if (!G.readyPids.includes(pid)) G.readyPids.push(pid);
      broadcast({type:'ready', pids:G.readyPids}); renderTeam(); maybeRun(); break;
    case 'unready': G.readyPids = G.readyPids.filter(x => x !== pid); delete G.plans[pid]; broadcast({type:'ready', pids:G.readyPids}); renderTeam(); break;
    case 'draft': G.drafts[pid] = Array.isArray(m.path) ? m.path.slice(0, 60) : []; R.drafts = G.drafts; broadcast({type:'drafts', drafts:G.drafts}); break;
    case 'chat': { const text = String(m.text||'').slice(0,120).trim(); if (!text || !lp) return; const c = {type:'chat', pid, name:lp.name, color:lp.color, text}; broadcast(c); showChat(c); break; }
  }
}
function playerGone(pid){
  const lp = G.lobby.players.find(x => x.pid === pid); if (!lp) return;
  if (G.phase === 'lobby') { G.lobby.players = G.lobby.players.filter(x => x.pid !== pid); broadcast(lobbyMsg()); renderLobby(); return; }
  lp.connected = false; broadcast(lobbyMsg()); log('warn', `${lp.name} lost connection. Their rover will wait.`); renderTeam(); maybeRun();
}
function maybeRun(force){
  if (!isHostish() || G.phase !== 'plan') return;
  const need = G.state.rovers.filter(r => { const lp = G.lobby.players.find(x => x.pid === r.pid); return lp && lp.connected; }).map(r => r.pid);
  if (!force && (!need.length || !need.every(pid => G.readyPids.includes(pid)))) return;
  const plans = G.plans; G.plans = {}; G.readyPids = []; G.drafts = {}; R.drafts = {};
  const {timeline, state} = MR.simulateSol(G.state, plans);
  broadcast({type:'sol', timeline, state:MR.stateToWire(state)});
  playSol(timeline, state);
}

/* ---------- joining ---------- */
function joinGame(raw){
  const p = me(); if (!p) return;
  const code = MR.cleanCode(raw);
  if (code.length !== 4) { $('joinErr').hidden = false; $('joinErr').textContent = 'Room codes have 4 letters or numbers, like MARS-K7QF.'; return; }
  $('joinErr').hidden = true; $('joinBtn').disabled = true; $('joinBtn').textContent = 'Joining…';
  G.mode = 'client'; G.myPid = p.id; G.code = code;
  G.net = MR.Net.join(code, {
    onOpen:() => { G.net.send({type:'hello', v:MR.VERSION, player:MR.playerSummary(p)}); startPing(); },
    onError:e => { joinFailed(MR.Net.errorText(e)); },
    onClose:() => lostConnection(),
    onMessage:m => clientMessage(m),
  });
}
function lostConnection(){
  if (G.mode !== 'client') return;
  const c = G.code, wasPlaying = G.phase !== 'lobby';
  leave(); $('joinCode').value = 'MARS-' + c; $('joinErr').hidden = false;
  $('joinErr').textContent = `Lost connection to MARS-${c}. Trying to reconnect… You can also tap Join.`;
  G.lostCode = c; G.lostTries = (G.lostTries || 0) + 1;
  if (G.lostTries <= 3) setTimeout(() => { if (!G.mode && G.lostCode === c) joinGame(c); }, 1500 * G.lostTries);
  if (wasPlaying) UI.toast('!', '#f0bf5a', 'Connection lost', 'Reconnecting to the team game…');
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !G.mode && G.lostCode && MR.Store.current()) { G.lostTries = 0; joinGame(G.lostCode); } });
function joinFailed(text){
  if (G.mode !== 'client') return;
  leave(); $('joinErr').hidden = false; $('joinErr').textContent = text;
  $('joinBtn').disabled = false; $('joinBtn').textContent = 'Join';
}
function startPing(){
  clearInterval(G.pingTimer);
  G.lastPong = Date.now();
  G.pingTimer = setInterval(() => {
    if (!G.net) return;
    if (Date.now() - G.lastPong > 15000) { lostConnection(); return; }
    G.net.send({type:'ping', t:performance.now()}); }, 4000);
  G.net.send({type:'ping', t:performance.now()});
}
function clientMessage(m){
  if (!m || typeof m !== 'object') return;
  G.lastPong = Date.now();
  $('joinBtn').disabled = false; $('joinBtn').textContent = 'Join';
  switch (m.type) {
    case 'pong': G.lastPing = Math.round(performance.now() - m.t); renderNet(); break;
    case 'error': joinFailed(m.text); break;
    case 'lobby': G.lostCode = null; G.lostTries = 0; G.lobby = m.lobby; MR.Store.unlock(m.lobby.unlocked); if (G.phase === 'home' || G.phase === 'lobby') enterLobby(); else { renderTeam(); renderCrewBar(); } break;
    case 'toLobby': G.lobby = m.lobby; MR.Store.unlock(m.lobby.unlocked); enterLobby(); break;
    case 'start': G.lobby = m.lobby || G.lobby; G.lostCode = null; G.lostTries = 0; enterGame(MR.stateFromWire(m.state)); break;
    case 'state': G.chain = G.chain.then(() => setGameState(MR.stateFromWire(m.state, G.state && G.state.world))).catch(e => console.error(e)); break;
    case 'sol': G.chain = G.chain.then(() => playSol(m.timeline, MR.stateFromWire(m.state))).catch(e => console.error(e)); break;
    case 'ready': G.readyPids = m.pids || []; renderTeam(); break;
    case 'drafts': G.drafts = m.drafts || {}; R.drafts = G.drafts; break;
    case 'chat': showChat(m); break;
  }
}
const toHost = m => { if (G.mode === 'client') G.net.send(m); else hostHandle(G.myPid, m); };

/* ---------- lobby ---------- */
function enterLobby(){
  G.phase = 'lobby'; UI.show('scrLobby'); $('win').hidden = true;
  const p = me(); if (p && G.mode !== 'client') refreshMyLobbyEntry(true);
  renderLobby();
}
function refreshMyLobbyEntry(silent){
  const p = me(); if (!p) return;
  const lp = G.lobby.players.find(x => x.pid === G.myPid);
  if (lp && G.mode !== 'client') { Object.assign(lp, MR.playerSummary(p), {color:uniqueColor({...MR.playerSummary(p)})}); broadcast(lobbyMsg()); }
  if (G.mode === 'client' && !silent) G.net.send({type:'hello', v:MR.VERSION, player:MR.playerSummary(p)});
  if (!silent) renderLobby();
}
function renderLobby(){
  if (G.phase !== 'lobby') return;
  const host = G.mode === 'host', solo = G.mode === 'solo', p = me();
  $('roomPanel').hidden = solo; $('soloPanel').hidden = !solo;
  if (!solo) {
    $('roomCode').textContent = 'MARS-' + (G.code || '····');
    const url = location.origin + location.pathname + '?join=' + G.code + (/[?&]net=local\b/.test(location.search) ? '&net=local' : '');
    if (host && window.qrcode && G.qrFor !== url) { try { const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make(); $('qr').innerHTML = qr.createSvgTag({cellSize:4, margin:2, scalable:true}); G.qrFor = url; } catch (e) { $('qr').hidden = true; } }
    $('qr').hidden = !host;
    $('roomHelp').innerHTML = host ? 'On the other devices, open this game, pick a profile, tap <b>Join</b> and type the code. Or scan the QR code with the camera.' : 'You are in! The host picks the map and starts the expedition.';
  }
  renderNet();
  const players = G.lobby.players;
  $('crewCount').textContent = `${players.length} / ${MR.MAX_PLAYERS}`;
  $('crewList').innerHTML = players.map(x => `<li>${UI.avatar(x)}<span class="who"><b>${esc(x.name)}${x.pid === G.myPid ? ' (you)' : ''}</b><small>${MR.ROLES[x.role].label} · ${MR.JOBS[x.job] ? MR.JOBS[x.job].label : ''} · ${MR.RANKS[x.rank|0].name}</small></span>${x.host ? '<span class="tag">Host</span>' : ''}<span class="dot ${x.connected ? '' : 'off'}" title="${x.connected ? 'Connected' : 'Offline'}"></span></li>`).join('');
  const mine = players.find(x => x.pid === G.myPid) || (p && MR.playerSummary(p));
  if (mine) $('jobPick').innerHTML = Object.entries(MR.JOBS).filter(([, j]) => j.roles.includes(mine.role)).map(([k, j]) => `<button class="job" data-job="${k}" aria-pressed="${k === mine.job}"><b>${j.label}</b><small>${esc(j.desc)}</small></button>`).join('');
  const unlocked = G.mode === 'client' ? G.lobby.unlocked : MR.Store.unlocked();
  if (G.mode !== 'client') G.lobby.unlocked = unlocked;
  $('mapPick').innerHTML = MR.MAP_ORDER.map(k => { const m = MR.MAPS[k], open = unlocked.includes(k);
    return `<button class="mapcard" data-map="${k}" aria-pressed="${k === G.lobby.map}" ${open && G.mode !== 'client' ? '' : 'disabled'}><b>${m.name}</b><small>${m.rover} · ${m.year}</small><p>${open ? esc(m.blurb) : `Locked. Finish a ${MR.MAPS[m.unlock].name} expedition to unlock.`}</p></button>`; }).join('');
  $('mapNote').textContent = G.mode === 'client' ? 'The host picks the map' : '';
  $('startBtn').hidden = G.mode === 'client';
  $('lobbyWait').textContent = G.mode === 'client' ? 'Waiting for the host to start…' : (host && players.length < 2 ? 'Waiting for players to join (you can also start alone).' : '');
}
function renderNet(){
  const t = G.mode === 'host' ? `Hosting · ${G.lobby.players.filter(x => x.connected).length} connected` : G.mode === 'client' ? (G.lastPing != null ? `Connected · ${G.lastPing} ms` : 'Connecting…') : 'Solo';
  $('netStatus').textContent = G.mode === 'host' && !G.net ? '' : t; $('gameNet').textContent = t;
}
$('jobPick').onclick = e => { const b = e.target.closest('.job'); if (!b) return; const p = me(); p.job = b.dataset.job; MR.Store.save();
  if (G.mode === 'client') G.net.send({type:'job', job:p.job}); else hostHandle(G.myPid, {type:'job', job:p.job}); MR.sfx.click();
  if (G.mode === 'client') { const lp = G.lobby.players.find(x => x.pid === G.myPid); if (lp) lp.job = p.job; renderLobby(); } };
$('mapPick').onclick = e => { const b = e.target.closest('.mapcard'); if (!b || b.disabled || G.mode === 'client') return; G.lobby.map = b.dataset.map; broadcast(lobbyMsg()); renderLobby(); MR.sfx.click(); };
$('startBtn').onclick = () => {
  if (G.mode === 'client') return;
  const players = G.lobby.players.filter(x => x.connected);
  const st = MR.newGame({map:G.lobby.map, seed:Math.floor(Math.random()*1e9), players});
  G.plans = {}; G.readyPids = []; G.drafts = {};
  broadcast({type:'start', state:MR.stateToWire(st), lobby:G.lobby, code:G.code});
  enterGame(st);
};
$('leaveLobbyBtn').onclick = () => leave();

/* ---------- game screen ---------- */
function enterGame(st){
  G.contAfterWin = false; G.ready = false; G.plan = []; G.phase = 'plan'; G.dull = 0; G.hintRes = null;
  R.resetTracks(); setGameState(st);
  UI.show('scrGame'); $('win').hidden = true; $('log').innerHTML = '';
  const M = MR.MAPS[st.map];
  log('info', `Welcome to ${M.name}! ${M.blurb}`);
  if (myRole() === 'cadet') log('info', 'Tap the pictures to plan, then press GO!');
  if (myRole() === 'specialist' && !$('editor').dataset.touched) $('editor').value = `from mars import rover\n\n# Scan around, then head out.\nrover.scan()\nfor i in range(2):\n    rover.forward(3)\nrover.analyze()\n`;
  R.resize(); R.cam.follow = true; setTimeout(() => R.focus(G.myPid, true), 30);
  renderGame(); updateGhost();
}
function setGameState(st){
  G.state = st;
  const r = myRover();
  R.setView(st, G.myPid, r ? r.role : 'explorer');
  if (G.phase === 'plan' || G.phase === 'won') renderGame();
}
function renderGame(){
  if (!G.state) return;
  const r = myRover(), role = r ? r.role : 'explorer', cadet = role === 'cadet', code = role === 'specialist';
  $('cadetPanel').hidden = !cadet; $('planPanel').hidden = cadet;
  $('tabs').hidden = code; $('editor').hidden = !code; $('prog').hidden = code || G.showCode; $('code').hidden = code || !G.showCode;
  $('planTitle').textContent = code ? "Today's program" : "Today's plan";
  $('howList').innerHTML = MR.HOW[role].map(h => `<li>${esc(h)}</li>`).join('');
  $('chatRow').hidden = !team();
  renderPalette(); renderPlan(); renderHud(); renderSide(); renderCrewBar(); renderTeam(); renderLock(); renderNet(); computeHints(); renderNudges();
}
function renderHud(){
  const r = myRover(); if (!r) return;
  const power = r.role !== 'cadet';
  $('cSol').hidden = false; $('hSol').textContent = G.state.sol;
  $('cBat').hidden = !power; $('cTubes').hidden = !power;
  $('hBatTxt').textContent = r.bat + '%'; $('hBat').style.width = Math.min(100, r.bat / r.batMax * 100) + '%'; $('hBat').classList.toggle('low', r.bat < 25);
  $('hTubes').textContent = `${r.tubes.length}/${MR.tubesOf(r)}`;
  $('hScoreK').textContent = r.role === 'cadet' ? 'Treasures' : 'Team science';
  $('hScore').textContent = r.role === 'cadet' ? G.state.team.treasures : G.state.team.score;
  $('hRegion').textContent = MR.regionAt(G.state, r.x, r.y) + (r.stuck ? ' · STUCK' : '');
}
function renderSide(){
  const st = G.state, r = myRover(); if (!r) return;
  $('goals').innerHTML = MR.goalProgress(st).map(g => `<li class="${g.done ? 'done' : ''}"><span class="box">${g.done ? '✓' : ''}</span><span class="gt"><span class="t">${esc(g.t)}</span>${g.done ? '' : goalHint(g, r)}</span><span class="cnt">${Math.min(g.n, g.of)}/${g.of}</span></li>`).join('');
  $('solCount').textContent = `Sol ${st.sol} · 3 stars by sol ${MR.parOf(st)}`;
  if (r.role === 'cadet') $('tubes').innerHTML = `<span class="lbl">Team treasures: ${st.team.treasures}</span>`;
  else $('tubes').innerHTML = [...Array(MR.tubesOf(r))].map((_, i) => { const id = r.tubes[i]; return `<span class="tube" title="${id ? esc(MR.CARDS[id].name) : 'Empty tube'}">${id ? `<i style="background:${MR.CARDS[id].color}"></i>` : ''}</span>`; }).join('')
    + `<span class="lbl">${r.tubes.length ? `${r.tubes.length} on board` : 'Sample tubes'} · team delivered ${st.team.delivered}</span>`;
}
const COMPASS = ['east','south-east','south','south-west','west','north-west','north','north-east'];
const dirWord = (r, x, y) => COMPASS[(Math.round(Math.atan2(y - r.y, x - r.x) / (Math.PI/4)) + 8) % 8];
function goalHint(g, r){
  const st = G.state;
  if (g.kind === 'col') {
    const a = MR.searchArea(st, g.res); if (!a) return '';
    const dist = Math.hypot(a.x - r.x, a.y - r.y), reg = MR.regionAt(st, Math.round(a.x), Math.round(a.y));
    const where = dist < 5 ? 'Scan around here' : `Try ${reg.startsWith('the ') ? reg : 'the ' + reg}, ${Math.round(dist)} squares ${dirWord(r, a.x, a.y)}`;
    return `<span class="hint">${esc(where)}<button class="showb" data-show="${g.res}">Show</button></span>`;
  }
  if (g.kind === 'deliver') return `<span class="hint">Drive onto the station with full tubes</span>`;
  if (g.kind === 'treasure') return `<span class="hint">Look for the sparkly gems</span>`;
  return '';
}
$('goals').addEventListener('click', e => { const b = e.target.closest('[data-show]'); if (!b) return;
  G.hintRes = b.dataset.show; computeHints(); const a = MR.searchArea(G.state, G.hintRes);
  if (a) { const [vw, vh] = R.viewTiles(); R.cam.follow = false; R.cam.x = a.x + .5 - vw/2; R.cam.y = a.y + .5 - vh/2; R.clamp(); } });
function computeHints(){
  const r = myRover(); if (!r || !G.state) { R.hints = []; return; }
  const st = G.state, W = st.world, H = [];
  if (r.role === 'cadet') {
    const p = MR.findPath(st, r, (x, y) => { const i = y*MW+x; return W.res[i] && W.sig[i] && W.seen[i] && !W.drilled[i] && !MR.CARDS[W.res[i]].artifact; });
    if (p && p.length) { const [x, y] = p[p.length-1]; H.push({x, y, label:'Gem', color:'#f0bf5a'}); }
  } else {
    const S = MR.MAPS[st.map].station;
    if (r.tubes.length) H.push({x:S.x + .5, y:S.y + .5, label:'Station', color:'#e6ecf1'});
    const open = MR.goalProgress(st).filter(g => !g.done && g.kind === 'col');
    const g = open.find(q2 => q2.res === G.hintRes) || open[0];
    if (g) { const a = MR.searchArea(st, g.res); if (a) H.push({x:a.x, y:a.y, label:MR.CARDS[g.res].name, color:MR.CARDS[g.res].color, area:true, near:Math.hypot(a.x - r.x, a.y - r.y) < 5}); }
  }
  R.hints = H;
}
function renderNudges(){
  const r = myRover(), box = $('nudges');
  if (!r || !G.state || G.phase !== 'plan' || G.ready || r.role === 'cadet') { box.innerHTML = ''; return; }
  const st = G.state, W = st.world, i = r.y*MW + r.x, out = [];
  if (r.stuck) out.push(['Your rover is stuck in soft sand.', 'Plan: Back 1', 'back1']);
  else {
    if (W.res[i] && W.sig[i] && !W.drilled[i] && !MR.CARDS[W.res[i]].artifact) {
      if (!W.known[i]) out.push(['There is a mystery signal under your rover.', 'Add Analyze + Drill', 'andrill']);
      else if (W.res[i] !== 'basalt') out.push([`You are on ${MR.CARDS[W.res[i]].name}!`, 'Add Drill', 'drill']);
      else out.push(['Just basalt here. Probably not worth a tube.', null, null]);
    }
    if (r.tubes.length >= MR.tubesOf(r)) out.push(['Your sample tubes are full.', 'Plan route home', 'home']);
    else if (r.bat < 30) out.push([`Battery is low (${r.bat}%).`, 'Plan route home', 'home'], ['Or charge with the solar panels.', 'Add Charge', 'charge']);
    else if (r.tubes.length && MR.goalProgress(st).filter(g => g.kind === 'col').every(g => g.done)) out.push(['All the finds are done. Bring your samples home!', 'Plan route home', 'home']);
    if ((G.dull || 0) >= 2 && out.length < 2) out.push(['Nothing found lately. Scan finds mystery signals. Tap Show next to an objective to see where to look.', 'Add Scan', 'scan']);
  }
  box.innerHTML = out.slice(0, 2).map(([t, b, a]) => `<div class="nudge"><span>${esc(t)}</span>${b ? `<button class="btn" data-nudge="${a}">${esc(b)}</button>` : ''}</div>`).join('');
}
const planToPy = acts => acts.map(a => `rover.${MR.CMDS[a.type].py}(${MR.CMDS[a.type].arg ? a.arg : ''})`).join('\n');
function applyPlan(acts, replace){
  const r = myRover(); if (!r || G.ready || G.phase !== 'plan') return;
  if (r.role === 'specialist') {
    const ta = $('editor'), code = planToPy(acts);
    ta.value = replace ? `from mars import rover\n\n${code}\n` : ta.value.replace(/\s*$/, '\n') + code + '\n'; ta.dataset.touched = '1';
  } else {
    if (replace) G.plan = [];
    acts.forEach(a => { if (G.plan.length < maxPlan()) G.plan.push({type:a.type, arg:MR.CMDS[a.type].arg ? (a.arg || 1) : undefined}); });
  }
  MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); renderNudges();
}
$('nudges').addEventListener('click', e => {
  const b = e.target.closest('[data-nudge]'); if (!b) return; const r = myRover(), st = G.state;
  switch (b.dataset.nudge) {
    case 'back1': applyPlan([{type:'back', arg:1}], true); break;
    case 'drill': applyPlan([{type:'drill'}]); break;
    case 'andrill': applyPlan([{type:'analyze'}, {type:'drill'}]); break;
    case 'scan': applyPlan([{type:'scan'}]); break;
    case 'charge': applyPlan([{type:'charge'}]); break;
    case 'home': { const p = MR.findPath(st, r, (x, y) => MR.onStation(st.map, x, y));
      if (p) applyPlan(MR.pathToPlan(r, p, Math.min(maxPlan(), 12)), true); else UI.toast('!', '#f0bf5a', 'No route found yet', 'Explore a bit more so the rover can see a way back.'); break; }
  }
});
function renderCrewBar(){
  if (!G.state) return;
  $('crewBar').innerHTML = G.state.rovers.map(r => {
    const lp = G.lobby.players.find(x => x.pid === r.pid), on = !lp || lp.connected, rd = G.readyPids.includes(r.pid);
    const status = !on ? 'offline' : G.phase === 'run' ? 'driving' : rd ? '✓ ready' : 'planning';
    return `<button class="cchip ${r.pid === G.myPid ? 'me' : ''}" data-pid="${r.pid}">${UI.avatar(r)}<span><b>${esc(r.name)}</b><small>${MR.JOBS[r.job].label}${r.role !== 'cadet' ? ` · ${r.bat}%` : ''}</small></span>${team() ? `<span class="rd ${rd ? 'ok' : ''}">${status}</span>` : ''}</button>`; }).join('');
}
$('crewBar').onclick = e => { const b = e.target.closest('.cchip'); if (!b) return; R.focus(b.dataset.pid, b.dataset.pid === G.myPid); showTip(b.dataset.pid); };
function renderTeam(){
  renderCrewBar();
  if (!G.state) return;
  let t = '';
  if (G.phase === 'run') t = 'The rovers are carrying out their plans…';
  else if (G.phase === 'won' && !G.contAfterWin) t = 'Expedition complete!';
  else if (team()) {
    const waiting = G.state.rovers.filter(r => { const lp = G.lobby.players.find(x => x.pid === r.pid); return lp && lp.connected && !G.readyPids.includes(r.pid); });
    t = waiting.length ? `Waiting for: <b>${waiting.map(r => esc(r.name)).join(', ')}</b>` : 'Everyone is ready. Uplinking…';
    if (G.ready) t = `<b>You're ready.</b> ` + t;
  } else t = 'Plan your moves, then send them to Mars.';
  $('teamLine').innerHTML = t;
  $('forceBtn').hidden = !(G.mode === 'host' && G.phase === 'plan' && G.ready && G.state.rovers.length > 1);
  renderLock(); renderNudges();
}

/* palette + plans */
function cmdsForMe(){ const r = myRover(); return r ? MR.cmdsFor(r.role, r.job) : []; }
function maxPlan(){ const r = myRover(); if (!r) return 12; return r.role === 'cadet' ? MR.CADET_LEN(r.rank) : MR.ROLES[r.role].maxCmd; }
const KEYCAP = {forward:'W', left:'A', back:'S', right:'D', scan:'Q', analyze:'R', drill:'Space', dig:'G', charge:'C'};
function renderPalette(){
  const have = cmdsForMe(), btn = (k, cls = '') => { const d = MR.CMDS[k];
    return `<button class="pal cat-${d.cat} ${cls}" data-c="${k}" aria-label="${d.label} (${KEYCAP[k]})"><span class="ic" aria-hidden="true">${d.icon}</span><span class="lb">${d.label}</span><small>${d.cost}</small><span class="key">${KEYCAP[k]}</span></button>`; };
  const group = (label, keys, cls) => { const ks = keys.filter(k => have.includes(k)); return ks.length ? `<div class="pgroup ${cls||''}"><span class="pgl">${label}</span><div class="pbtns">${ks.map(k => btn(k)).join('')}</div></div>` : ''; };
  $('palette').innerHTML = `<div class="pgroup drive"><span class="pgl">Drive</span><div class="dpad">${btn('forward','up')}${btn('left','lf')}${btn('back','dn')}${btn('right','rt')}</div></div>`
    + group('Science', ['scan','analyze','drill']) + group('Tools', ['dig']) + group('Power', ['charge']);
}
const PIC = {forward:'↑', left:'↶', right:'↷', drill:'⛏'};
function renderPlan(){
  const r = myRover(); if (!r) return;
  if (r.role === 'cadet') {
    const n = maxPlan();
    $('seq').innerHTML = G.plan.map((c, i) => `<button class="pic ${c.state||''}" data-i="${i}" aria-label="Remove this step">${PIC[c.type]}</button>`).join('')
      + [...Array(Math.max(0, n - G.plan.length))].map(() => `<span class="pic slot"></span>`).join('');
    $('cadetCount').textContent = `${G.plan.length} / ${n}`;
    return;
  }
  if (r.role === 'specialist') { $('count').textContent = `max ${MR.ROLES.specialist.maxCmd} moves`; return; }
  $('count').textContent = `${G.plan.length} / ${maxPlan()}`;
  if (!G.plan.length) $('prog').innerHTML = `<li class="empty">Tap a command above (or use W A S D, Q, R, Space) to add it to today's plan.</li>`;
  else $('prog').innerHTML = G.plan.map((c, i) => { const d = MR.CMDS[c.type], dis = G.ready || G.phase !== 'plan' ? 'disabled' : '';
    return `<li class="cmd cat-${d.cat} ${c.state||''}" data-i="${i}"><span class="num">${i+1}</span><span class="ic" aria-hidden="true">${d.icon}</span><span class="lb">${d.label}</span>
      ${d.arg ? `<span class="arg"><button class="mini-b" data-a="dec" aria-label="Fewer squares" ${dis}>−</button><b>${c.arg}</b><button class="mini-b" data-a="inc" aria-label="More squares" ${dis}>+</button></span>` : ''}
      <button class="mini-b" data-a="up" aria-label="Move up" ${dis || (i === 0 ? 'disabled' : '')}>⌃</button><button class="mini-b" data-a="del" aria-label="Remove" ${dis}>×</button></li>`; }).join('');
  $('code').innerHTML = [`<span class="c"># Sol ${G.state.sol} plan</span>`, `<span class="f">from</span> mars <span class="f">import</span> rover`, '']
    .concat(G.plan.length ? G.plan.map(c => `rover.<span class="f">${MR.CMDS[c.type].py}</span>(${c.arg ? `<span class="n">${c.arg}</span>` : ''})`) : ['<span class="c"># (empty) add commands in Blocks</span>']).join('\n');
}
function renderLock(){
  const r = myRover(); if (!r) return;
  const canEdit = G.phase === 'plan' && !G.ready, full = G.plan.length >= maxPlan();
  document.querySelectorAll('.pal').forEach(b => b.disabled = !canEdit || (r.role !== 'specialist' && full));
  document.querySelectorAll('.cbtn').forEach(b => b.disabled = !canEdit || full);
  $('editor').readOnly = !canEdit;
  $('clearBtn').disabled = !canEdit;
  $('trashBtn').disabled = !canEdit;
  const hasPlan = r.role === 'specialist' ? true : G.plan.length > 0;
  const label = G.phase === 'run' ? 'Rovers driving…' : G.phase === 'won' && !G.contAfterWin ? 'Done' : G.ready ? 'Change plan' : team() ? 'Ready' : 'Send to Mars';
  $('sendBtn').textContent = label; $('sendBtn').disabled = G.phase !== 'plan' || (!G.ready && !hasPlan);
  $('goBtn').textContent = G.phase === 'run' ? '…' : G.ready ? 'WAITING' : 'GO!';
  $('goBtn').disabled = G.phase !== 'plan' || (!G.ready && !G.plan.length);
}
function planActions(){
  const r = myRover(); if (!r) return {actions:[]};
  if (r.role === 'specialist') {
    const res = MR.parsePy($('editor').value, MR.ROLES.specialist.maxCmd);
    if (res.error) return {error:res.error};
    return {actions:res.actions, info:{loops:res.loops, clean:res.lines <= 5 && res.actions.reduce((s, a) => s + (MR.CMDS[a.type].arg ? a.arg : 1), 0) >= 10}};
  }
  return {actions:G.plan.map((c, i) => ({type:c.type, arg:c.arg || 1, idx:i}))};
}
let draftTimer = null;
function updateGhost(){
  const r = myRover(); if (!r || !G.state) { R.ghost = []; return; }
  const pa = planActions();
  R.ghost = pa.error ? [] : MR.ghostPath(G.state, r, pa.actions);
  if (!team()) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => toHost({type:'draft', path:R.ghost.map(p => [p[0], p[1]])}), 250);
}
function addCmd(k){
  const r = myRover(); if (!r || G.phase !== 'plan' || G.ready) return;
  if (r.role === 'specialist') return insertPy(k);
  const last = G.plan[G.plan.length - 1];
  if (r.role !== 'cadet' && last && last.type === k && (k === 'forward' || k === 'back') && last.arg < 20) {
    last.arg++; G.plan.forEach(c => c.state = ''); MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); return;
  }
  if (G.plan.length >= maxPlan()) { MR.sfx.bump(); return; }
  G.plan.forEach(c => c.state = '');
  G.plan.push({type:k, arg: MR.CMDS[k] && MR.CMDS[k].arg ? 1 : undefined});
  MR.sfx.click(); renderPlan(); renderLock(); updateGhost();
}
function insertPy(k){
  const ta = $('editor'), v = ta.value, pos = ta.selectionStart ?? v.length;
  const lineEnd = v.indexOf('\n', pos), end = lineEnd === -1 ? v.length : lineEnd;
  const lineStart = v.lastIndexOf('\n', pos - 1) + 1, cur = v.slice(lineStart, end);
  const ind = (cur.match(/^\s*/) || [''])[0] + (/:\s*$/.test(cur) ? '    ' : '');
  const text = `${ind}rover.${MR.CMDS[k].py}(${MR.CMDS[k].arg ? 1 : ''})`;
  const before = v.slice(0, end), after = v.slice(end);
  const sep = before.length && !before.endsWith('\n') ? '\n' : '';
  ta.value = before + sep + text + (after.startsWith('\n') || !after ? after : '\n' + after);
  if (!ta.value.endsWith('\n')) ta.value += '\n';
  ta.dataset.touched = '1';
  const caret = before.length + sep.length + text.length; ta.focus(); ta.setSelectionRange(caret, caret);
  $('err').hidden = true; updateGhost();
}
$('palette').onclick = e => { const b = e.target.closest('.pal'); if (b && !b.disabled) addCmd(b.dataset.c); };
document.querySelectorAll('.cbtn').forEach(b => b.onclick = () => addCmd(b.dataset.pic));
$('seq').onclick = e => { const b = e.target.closest('.pic'); if (!b || b.classList.contains('slot') || G.ready || G.phase !== 'plan') return; G.plan.splice(+b.dataset.i, 1); G.plan.forEach(c => c.state = ''); MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); };
$('trashBtn').onclick = () => { if (G.ready || G.phase !== 'plan') return; G.plan = []; renderPlan(); renderLock(); updateGhost(); };
$('prog').onclick = e => {
  const b = e.target.closest('button'), item = e.target.closest('.cmd'); if (!b || !item || G.ready || G.phase !== 'plan') return;
  const i = +item.dataset.i, c = G.plan[i]; G.plan.forEach(p => p.state = '');
  if (b.dataset.a === 'inc') c.arg = Math.min(20, c.arg + 1);
  if (b.dataset.a === 'dec') c.arg = Math.max(1, c.arg - 1);
  if (b.dataset.a === 'del') G.plan.splice(i, 1);
  if (b.dataset.a === 'up' && i > 0) [G.plan[i-1], G.plan[i]] = [G.plan[i], G.plan[i-1]];
  renderPlan(); renderLock(); updateGhost();
};
$('editor').addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); const ta = e.target, s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.setSelectionRange(s+4, s+4); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendPlan(); }
});
let pyTimer = null;
$('editor').addEventListener('input', e => { e.target.dataset.touched = '1'; $('err').hidden = true; clearTimeout(pyTimer); pyTimer = setTimeout(updateGhost, 250); });
$('clearBtn').onclick = () => { if (G.ready || G.phase !== 'plan') return; if (myRole() === 'specialist') { $('editor').value = 'from mars import rover\n\n'; $('editor').dataset.touched = '1'; } else G.plan = []; renderPlan(); renderLock(); updateGhost(); };
$('tabBlocks').onclick = () => { G.showCode = false; $('tabBlocks').setAttribute('aria-selected', true); $('tabCode').setAttribute('aria-selected', false); renderGame(); };
$('tabCode').onclick = () => { G.showCode = true; $('tabBlocks').setAttribute('aria-selected', false); $('tabCode').setAttribute('aria-selected', true); renderGame(); };
$('sendBtn').onclick = () => sendPlan();
$('goBtn').onclick = () => sendPlan();

function sendPlan(){
  if (G.phase !== 'plan') return;
  if (G.ready) { G.ready = false; toHost({type:'unready'}); G.plan.forEach(c => c.state = ''); renderPlan(); renderTeam(); return; }
  const pa = planActions();
  if (pa.error) { $('err').hidden = false; $('err').textContent = pa.error; MR.sfx.bump(); return; }
  if (!pa.actions.length && myRole() !== 'specialist') return;
  if (!pa.actions.length) { $('err').hidden = false; $('err').textContent = 'No rover commands found. Try rover.forward(2).'; return; }
  G.planInfo = pa.info || null; G.ready = true; MR.sfx.click();
  G.plan.forEach(c => c.state = '');
  toHost({type:'plan', actions:pa.actions});
  renderPlan(); renderTeam();
}

/* ---------- playback ---------- */
function tween(ms, f){
  ms *= MR.speed();
  return new Promise(res => { const t0 = performance.now();
    (function step(t){ const k = Math.min(1, (t - t0)/ms); f(k < .5 ? 2*k*k : 1 - ((-2*k+2)**2)/2); if (k < 1) requestAnimationFrame(step); else res(); })(t0); });
}
const wait = ms => new Promise(r => setTimeout(r, ms * MR.speed()));
function markPlan(idx, skipped){
  const r = myRover(); if (!r) return;
  if (r.role === 'specialist') { if (idx != null && !skipped) { $('runLine').hidden = false; $('runLine').textContent = `Running line ${idx}`; } return; }
  G.plan.forEach((c, i) => { if (skipped) { if (i > idx) c.state = 'skipped'; } else c.state = i < idx ? 'done' : i === idx ? 'active' : (c.state === 'skipped' ? 'skipped' : ''); });
  renderPlan();
}
async function playEvent(ev){
  if (!G.state) return;
  const st = G.state, W = st.world, r = st.rovers.find(x => x.pid === ev.pid), a = r && R.anim[r.pid], mine = ev.pid === G.myPid;
  if (ev.msg) log(ev.msg.k, ev.msg.text);
  if (mine && ev.idx != null && ev.t !== 'skip') markPlan(ev.idx);
  const cell = i => [i % MW, (i / MW) | 0];
  const seen = list => (list || []).forEach(i => W.seen[i] = 1);
  switch (ev.t) {
    case 'move': {
      const [fx, fy] = ev.from, [tx, ty] = ev.to;
      await tween(ev.slow ? 1100 : 760, k => { a.px = fx + (tx-fx)*k; a.py = fy + (ty-fy)*k; });
      a.px = tx; a.py = ty; r.x = tx; r.y = ty; r.bat = ev.bat;
      if (!ev.fly) R.tracks.push([fx, fy, tx, ty]);
      seen(ev.seen); (ev.sigs || []).forEach(i => W.sig[i] = 1);
      if (mine) MR.sfx.move();
      break;
    }
    case 'turn': { const a0 = a.ang; await tween(560, k => a.ang = a0 + 90*ev.sgn*k); a.ang = a0 + 90*ev.sgn; r.dir = ev.dir; r.bat = ev.bat; break; }
    case 'bump': seen(ev.seen); R.addFx({type:'hazard', x:ev.at[0], y:ev.at[1], dur:1300}); a.wob = 1; if (mine) MR.sfx.bump(); await wait(380); a.wob = 0; break;
    case 'stuck': r.stuck = true; W.trapSeen[ev.at[1]*MW + ev.at[0]] = 1; R.addFx({type:'hazard', x:ev.at[0], y:ev.at[1], dur:1500}); if (mine) MR.sfx.bump(); await wait(400); break;
    case 'free': r.stuck = false; break;
    case 'scan': R.addFx({type:'ring', x:r.x, y:r.y, dur:1400, r:ev.rad + .5}); if (mine) MR.sfx.scan(); await wait(950); seen(ev.seen); ev.sigs.forEach(i => W.sig[i] = 1); ev.traps.forEach(i => W.trapSeen[i] = 1); r.bat = ev.bat; break;
    case 'analyze': R.addFx({type:'beam', x:r.x, y:r.y, dur:1000}); await wait(1000); ev.cells.forEach(c => { W.sig[c.i] = 1; W.known[c.i] = 1; }); r.bat = ev.bat; break;
    case 'drill': { const [x, y] = cell(ev.i); a.busy = 'drill'; R.addFx({type:'dust', x, y, dur:1300, parts:MR.dustParts()}); await wait(ev.treasure ? 1000 : 1300); a.busy = null;
      W.drilled[ev.i] = 1; W.known[ev.i] = 1; W.sig[ev.i] = 1; if (ev.tubes) r.tubes = ev.tubes; if (ev.bat != null) r.bat = ev.bat;
      if (ev.treasure || ev.shiny) R.addFx({type:'confetti', x, y, dur:1400, parts:MR.confetti()});
      if (ev.treasure) st.team.treasures++;
      if (mine) MR.sfx.good(); break; }
    case 'nothing': if (ev.dust) R.addFx({type:'dust', x:r.x, y:r.y, dur:600, parts:MR.dustParts()}); if (ev.bat != null) r.bat = ev.bat; await wait(300); break;
    case 'dig': if (ev.i != null) { const [x, y] = cell(ev.i); R.addFx({type:'dust', x, y, dur:1100, parts:MR.dustParts()}); await wait(1000);
      if (ev.what === 'rock') W.obs[ev.i] = ''; if (ev.what === 'trap') { W.trap[ev.i] = 0; W.trapSeen[ev.i] = 0; } } r.bat = ev.bat; break;
    case 'charge': R.addFx({type:'sun', x:r.x, y:r.y, dur:1300}); await wait(1200); r.bat = ev.bat; break;
    case 'dock': r.bat = ev.bat; r.tubes = []; if (mine && ev.n) MR.sfx.good(); break;
    case 'artifact': { const [x, y] = cell(ev.i); W.drilled[ev.i] = 1; W.known[ev.i] = 1; R.addFx({type:'confetti', x, y, dur:1600, parts:MR.confetti()}); MR.sfx.good(); await wait(500); break; }
    case 'skip': if (mine) markPlan(ev.idx, true); if (mine) log('warn', `${ev.n} remaining step${ev.n > 1 ? 's were' : ' was'} skipped for safety.`); break;
    case 'night': ev.charges.forEach(c => { const q2 = st.rovers.find(x => x.pid === c.pid); if (q2) q2.bat = c.bat; }); st.sol = ev.sol; await wait(250); break;
    case 'win': MR.sfx.win(); break;
    case 'spawn': ev.cells.forEach(c => { W.res[c.i] = c.res; W.kid[c.i] = 1; W.sig[c.i] = 1; W.known[c.i] = 1; seen(c.seen); W.seen[c.i] = 1; }); await wait(300); break;
    default: await wait(150);
  }
  renderHud();
}
function uplink(){
  if (!G.state) return Promise.resolve();
  const r = myRover(), ms = MR.uplinkMs(G.state, r);
  $('uplink').hidden = false;
  $('ulSub').textContent = `${r ? MR.antennaName(r) : 'Stock antenna'}. Real signals take 4 to 24 minutes.` + (r && r.role !== 'cadet' && !(r.perks||[]).includes('hg_antenna') ? ' Radio and antenna perks make it faster.' : '');
  return new Promise(res => { const t0 = performance.now();
    (function step(t){ const k = ms ? Math.min(1, (t - t0) / ms) : 1;
      $('ulBar').style.width = (k*100) + '%';
      $('ulTitle').textContent = `Signal on its way to Mars… ${Math.max(0, Math.ceil((ms - (t - t0)) / 1000))} s`;
      if (k < 1) requestAnimationFrame(step); else { $('uplink').hidden = true; $('ulBar').style.width = '0'; res(); } })(t0); });
}
async function playSol(timeline, newState){
  const gen = G.gen;
  G.phase = 'run'; G.ready = false; if (!isHostish()) G.readyPids = []; R.running = true; R.ghost = []; R.drafts = {}; G.drafts = {};
  renderTeam(); renderPlan();
  await uplink();
  if (gen !== G.gen) return;
  R.cam.follow = true;
  for (const tick of timeline) { await Promise.all(tick.map(playEvent)); if (gen !== G.gen) return; renderSide(); renderCrewBar(); }
  R.running = false; $('runLine').hidden = true;
  setGameState(newState);
  const won = timeline.some(t => t.some(e => e.t === 'win'));
  const p = me();
  if (p) {
    const notices = MR.applyRewards(p, G.myPid, timeline.flat(), {map:newState.map, players:newState.rovers.length, planInfo:G.planInfo});
    UI.notify(notices, myRole() === 'cadet');
  }
  G.planInfo = null;
  const mineEv = timeline.flat().filter(e => e.pid === G.myPid);
  const found = mineEv.some(e => e.t === 'drill' || e.t === 'artifact' || (e.t === 'scan' && e.sigs.length) || (e.t === 'analyze' && e.cells.length) || (e.t === 'dock' && e.n) || (e.t === 'move' && e.sigs && e.sigs.length));
  G.dull = found ? 0 : (G.dull || 0) + 1;
  if (won) {
    const next = MR.MAP_ORDER.filter(k => MR.MAPS[k].unlock === newState.map);
    if (MR.Store.unlock(next)) next.forEach(k => UI.toast('★', '#58cfbe', `New map unlocked: ${MR.MAPS[k].name}`, 'The whole team can explore it now.', 7000));
    if (isHostish()) G.lobby.unlocked = MR.Store.unlocked();
  }
  G.plan.forEach(c => c.state = '');
  if (myRole() === 'cadet') G.plan = [];
  G.phase = newState.won && !G.contAfterWin ? 'won' : 'plan';
  renderGame(); updateGhost();
  if (won) showWin(newState);
  const pend = G.pending; G.pending = []; pend.forEach(f => f());
  if (isHostish()) { broadcast({type:'ready', pids:G.readyPids}); renderTeam(); maybeRun(); }
}
function showWin(st){
  const par = MR.parOf(st), s = st.sol <= par ? 3 : st.sol <= Math.ceil(par*1.5) ? 2 : 1;
  $('winStars').innerHTML = '★'.repeat(s) + `<i>${'★'.repeat(3-s)}</i>`;
  $('winText').textContent = `${MR.MAPS[st.map].name} explored on sol ${st.sol} with ${st.team.score} science points${st.team.treasures ? ` and ${st.team.treasures} treasures` : ''}. Press I to see what you collected.`;
  $('againBtn').hidden = G.mode === 'client';
  $('againBtn').textContent = 'New expedition';
  $('win').hidden = false;
}
$('keepBtn').onclick = () => { G.contAfterWin = true; $('win').hidden = true; G.phase = 'plan'; renderGame(); };
$('againBtn').onclick = () => { if (G.mode === 'client') return; G.state = null; broadcast({type:'toLobby', lobby:G.lobby}); enterLobby(); };
let leaveArmed = 0;
$('leaveGameBtn').onclick = () => {
  if (Date.now() - leaveArmed > 3000) { leaveArmed = Date.now(); $('leaveGameBtn').textContent = G.mode === 'host' ? 'Tap again: ends the game for everyone' : 'Tap again to leave'; setTimeout(() => $('leaveGameBtn').textContent = 'Leave game', 3000); return; }
  leave();
};

/* ---------- log, chat, tooltip ---------- */
function log(kind, text){
  const el = document.createElement('li');
  el.innerHTML = `<span class="tg">SOL ${G.state ? G.state.sol : 1}</span><span class="${kind}">${esc(text)}</span>`;
  const lg = $('log'); lg.prepend(el); while (lg.children.length > 120) lg.lastChild.remove();
}
function showChat(c){
  const el = document.createElement('li');
  el.innerHTML = `<span class="tg">CHAT</span><span class="chat"><b style="color:${MR.colorHex(c.color)}">${esc(c.name)}:</b> ${esc(c.text)}</span>`;
  $('log').prepend(el); if (c.pid !== G.myPid) MR.sfx.click();
}
function sendChat(){ const t = $('chatIn').value.trim(); if (!t) return; $('chatIn').value = ''; $('chatIn').blur(); toHost({type:'chat', text:t}); }
$('chatSend').onclick = sendChat;
$('chatIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } };

let tipTimer = null;
function showTip(pid, x, y){
  const r = G.state && G.state.rovers.find(q2 => q2.pid === pid); if (!r) { $('tip').hidden = true; return; }
  const pos = x != null ? {x, y:y - 14} : R.screenOf(pid); if (!pos) return;
  const lp = G.lobby.players.find(q2 => q2.pid === pid);
  $('tip').innerHTML = `<b style="color:${MR.colorHex(r.color)}">${esc(r.name)}</b>${r.pid === G.myPid ? ' (you)' : ''}<small>${MR.ROLES[r.role].label} · ${MR.JOBS[r.job].label} · ${MR.RANKS[r.rank|0].name}</small>`
    + (r.role !== 'cadet' ? `<small>Battery ${r.bat}% · Tubes ${r.tubes.length}/${MR.tubesOf(r)}</small>` : '')
    + (r.perks.length ? `<small>Perks: ${r.perks.map(k => MR.PERKS[k].name).join(', ')}</small>` : '')
    + (r.stuck ? '<small style="color:var(--bad)">Stuck in sand</small>' : '') + (lp && !lp.connected ? '<small style="color:var(--bad)">Offline</small>' : '');
  $('tip').style.left = Math.max(90, Math.min(innerWidth - 90, pos.x)) + 'px'; $('tip').style.top = Math.max(70, pos.y) + 'px'; $('tip').hidden = false;
  clearTimeout(tipTimer); tipTimer = setTimeout(() => $('tip').hidden = true, 3500);
}
R.onTapRover = (pid, x, y) => { if (pid) showTip(pid, x, y); else $('tip').hidden = true; };
let lastHover = null;
setInterval(() => { if (R.hoverPid !== lastHover) { lastHover = R.hoverPid; if (lastHover) { const s = R.screenOf(lastHover); if (s) showTip(lastHover, s.x, s.y); } else $('tip').hidden = true; } }, 120);

$('forceBtn').onclick = () => { if (G.mode === 'host' && G.ready) { log('warn', 'The host started the sol without waiting. Rovers without a plan stay put.'); maybeRun(true); } };
$('zoomIn').onclick = () => R.zoom(1.25);
$('zoomOut').onclick = () => R.zoom(.8);
$('centerBtn').onclick = () => { R.cam.follow = true; };
G.toggleBig = () => { document.body.classList.toggle('bigmap'); requestAnimationFrame(() => R.resize()); };
$('bigBtn').onclick = () => G.toggleBig();

/* ---------- keyboard (game) ---------- */
let tabIdx = 0;
document.addEventListener('keydown', e => {
  if (G.phase === 'home' || G.phase === 'lobby' || $('scrGame').hidden || UI.modalOpen()) return;
  const typing = e.target.closest && e.target.closest('input,textarea,select');
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const role = myRole(), k = e.key;
  if ((k === 'Enter' || k === ' ') && e.target.closest && e.target.closest('button')) return;
  if (k === 't' || k === 'T') { if (team()) { e.preventDefault(); $('chatIn').focus(); } return; }
  if (k === 'Tab' && (e.target === document.body || !e.target.closest)) { e.preventDefault(); const rs = G.state.rovers; tabIdx = (tabIdx + 1) % rs.length; R.focus(rs[tabIdx].pid, rs[tabIdx].pid === G.myPid); showTip(rs[tabIdx].pid); return; }
  const lk = k.length === 1 ? k.toLowerCase() : k;
  if (e.shiftKey) {
    const pan = {w:[0,-2], a:[-2,0], s:[0,2], d:[2,0], ArrowUp:[0,-2], ArrowLeft:[-2,0], ArrowDown:[0,2], ArrowRight:[2,0]}[lk];
    if (pan) { e.preventDefault(); R.cam.follow = false; R.cam.x += pan[0]; R.cam.y += pan[1]; R.clamp(); }
    return;
  }
  if (lk === 'f') { R.cam.follow = true; return; }
  if (lk === 'm') { G.toggleBig(); return; }
  if (k === '+' || k === '=') { R.zoom(1.2); return; } if (k === '-' || k === '_') { R.zoom(.83); return; }
  if (k === 'Enter') { e.preventDefault(); sendPlan(); return; }
  if (k === 'Backspace' && role !== 'specialist') { e.preventDefault(); if (!G.ready && G.phase === 'plan' && G.plan.length) { const last = G.plan[G.plan.length-1]; if (last.arg > 1) last.arg--; else G.plan.pop(); renderPlan(); renderLock(); updateGhost(); } return; }
  const move = {w:'forward', ArrowUp:'forward', a:'left', ArrowLeft:'left', d:'right', ArrowRight:'right', s:'back', ArrowDown:'back', ' ':'drill'}[lk];
  const tool = {q:'scan', r:'analyze', g:'dig', c:'charge'}[lk];
  const cmd = move || tool;
  if (!cmd || !cmdsForMe().includes(cmd)) return;
  e.preventDefault(); addCmd(cmd);
});
})();
