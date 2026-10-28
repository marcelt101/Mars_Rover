/* The game controller: lobby, hosting/joining, planning, playback and rewards. */
(function () {
const MR = window.MR, UI = MR.UI, R = MR.Render, $ = UI.$, esc = UI.esc;
const {MW} = MR;

const G = MR.Game = {
  mode:null, net:null, code:null, myPid:null, phase:'home',
  lobby:{players:[], map:'jezero', unlocked:['jezero']},
  state:null, plan:[], ready:false, readyPids:[], plans:{}, drafts:{}, cid2pid:{},
  planInfo:null, contAfterWin:false, showCode:false, pending:[], lastPing:null, wake:null, lastSeen:{}, lastPong:0, chain:Promise.resolve(), markers:{},
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
      G.plans[pid] = {actions:Array.isArray(m.actions) ? m.actions.slice(0, 60) : [], program:MR.validProgram(m.program) ? m.program : null, cancel:!!m.cancel};
      if (!G.readyPids.includes(pid)) G.readyPids.push(pid);
      broadcast({type:'ready', pids:G.readyPids}); renderTeam(); maybeRun(); break;
    case 'unready': G.readyPids = G.readyPids.filter(x => x !== pid); delete G.plans[pid]; broadcast({type:'ready', pids:G.readyPids}); renderTeam(); break;
    case 'claim': case 'rename': { const site = G.state && G.state.sites && G.state.sites[m.i]; if (!site || !lp) return;
      if (m.type === 'claim') site.claim = m.on ? pid : (site.claim === pid ? null : site.claim);
      else if (site.by === pid) site.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 22) || site.name;
      broadcast({type:'sites', sites:G.state.sites}); renderFinds(); break; }
    case 'marker': { if (!lp || !MR.inb(m.x|0, m.y|0)) return; const key = (m.x|0) + ',' + (m.y|0);
      if (m.kind && MARKS[m.kind]) G.markers[key] = {x:m.x|0, y:m.y|0, kind:m.kind, pid, name:lp.name, color:lp.color}; else delete G.markers[key];
      broadcast({type:'markers', markers:G.markers}); onMarkers(m.kind ? G.markers[key] : null, pid); break; }
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
    case 'sites': if (G.state) { G.state.sites = m.sites || {}; R.view && (R.view.sites = G.state.sites); renderFinds(); } break;
    case 'markers': { const before = Object.keys(G.markers).length; G.markers = m.markers || {}; const added = Object.values(G.markers).find(x => !G.lastMarkerKeys || !G.lastMarkerKeys.includes(x.x + ',' + x.y)); onMarkers(Object.keys(G.markers).length > before ? added : null, added && added.pid); break; }
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
  const airless = MR.MAPS[G.lobby.map] && MR.MAPS[G.lobby.map].airless;
  if (mine) $('jobPick').innerHTML = Object.entries(MR.JOBS).filter(([k, j]) => j.roles.includes(mine.role) && !(k === 'lab' && G.mode === 'solo')).map(([k, j]) => `<button class="job" data-job="${k}" aria-pressed="${k === mine.job}"><b>${j.label}</b><small>${esc(airless && k === 'heli' ? 'There is no air on the Moon, so helicopters can not fly there. On this map you drive the Buggy.' : j.desc)}</small></button>`).join('');
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
  G.contAfterWin = false; G.ready = false; G.plan = []; G.phase = 'plan'; G.dull = 0; G.hintRes = null; G.undo = []; G.markers = {}; renderMarkers();
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
  renderPalette(); renderPlan(); renderHud(); renderSide(); renderCrewBar(); renderTeam(); renderLock(); renderNet(); computeHints(); renderNudges(); renderFinds(); renderWeather(); renderLab(); renderRelay();
}
const WX_ICON = {clear:'☀', hazy:'⛅', storm:'🌪', none:'☾'};
function renderWeather(){
  const st = G.state, wx = st && st.wx; if (!wx) { $('wxCard').innerHTML = ''; $('cWx').hidden = true; return; }
  $('cWx').hidden = false;
  if (wx.airless) { $('hWx').textContent = 'No air'; $('wxCard').innerHTML = `<div class="wxcard"><span class="wi">☾</span><span><b>No weather on the Moon</b><small>There is no air, so there is no wind, rain or dust storms. In sunlight the ground heats to about 120 °C and drops to −170 °C at night.</small></span></div>`; return; }
  $('hWx').textContent = `${WX_ICON[wx.dust]} ${wx.hi}°C`;
  const f = (wx.forecast || []).map(x => `Sol ${x.sol}: ${x.storm ? 'dust storm likely' : 'clear'}`).join(' · ');
  const say = wx.storm ? 'Dust storm today! Rovers see 1 square less and solar panels charge only half tonight.' : wx.dust === 'hazy' ? 'A little dust in the air.' : 'Clear skies.';
  $('wxCard').innerHTML = `<div class="wxcard ${wx.storm ? 'storm' : ''}"><span class="wi">${WX_ICON[wx.dust]}</span><span><b>Weather station · Sol ${wx.sol}</b><small>High ${wx.hi}°C, low ${wx.lo}°C, wind ${wx.wind} km/h. ${say}</small><small>Forecast: ${f}</small></span></div>`;
  R.view && (R.view.wx = wx);
}
/* Rover health dashboard (H). Wear is gentle and the station repairs everything for free. */
const lvl = v => v >= 60 ? '#86d48f' : v >= 25 ? '#f0bf5a' : '#ff7b6c';
function healthModal(){
  const r = myRover(); if (!r || !G.state) return;
  const st = G.state, wx = st.wx || {}, cadet = r.role === 'cadet';
  if (cadet) {
    const ok = r.job === 'heli' ? 100 : 100, face = r.stuck ? '😵' : '😄';
    UI.openModal(`<div class="sh"><h2>${esc(r.name)}'s ${MR.JOBS[r.job].label}</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
      <div class="sb"><div class="face">${face}</div><div class="hearts">♥♥♥</div><p class="muted" style="text-align:center;margin:0">${r.stuck ? 'Oops, stuck! Back up to get free.' : 'Your rover feels great and is ready to explore!'}</p></div>`, true);
    return;
  }
  const P = k => (r.perks || []).includes(k), bat = Math.round(r.bat / r.batMax * 100), dust = Math.round(r.dust || 0), wheels = Math.round(r.wheels ?? 100);
  const delay = (MR.uplinkMs(st, r) / 1000).toFixed(1);
  const parts = [
    ['Battery', `${r.bat}% of ${r.batMax}%`, bat, 'Rovers store solar power in lithium-ion batteries. Charge, or dock at the station to fill up.', bat + '%'],
    ['Solar panels', dust ? `${dust}% dusty` : 'Clean', 100 - dust, dust ? `Dust makes the panels charge ${Math.round(dust/3)}% less at night. Docking at the station cleans them, and sometimes a gust of wind does too.` : 'Clean panels charge fully at night.', (100 - dust) + '%'],
    ['Wheels', `${wheels}%`, wheels, wheels < 25 ? 'Worn wheels use a little more power on every square. Dock at the station for a free repair.' : 'Sharp rocks wear the wheels a little. Curiosity got holes in its wheels, so Perseverance got tougher ones.' + (P('wide_wheels') ? ' Your wide wheels wear half as fast.' : ''), wheels + '%'],
    ['Sample tubes', `${r.tubes.length} of ${MR.tubesOf(r)} full`, 100 - r.tubes.length / Math.max(1, MR.tubesOf(r)) * 60, 'Perseverance seals its samples in tubes so a future mission can bring them to Earth.', `${r.tubes.length}/${MR.tubesOf(r)}`, r.tubes.length / Math.max(1, MR.tubesOf(r)) * 100],
    ['Heaters', wx.lo != null ? `Tonight ${wx.lo}°C` : '–', 80, 'Nights on Mars are colder than Antarctica, so heaters use a little battery to keep the electronics warm.', wx.lo != null ? wx.lo + '°' : '–'],
    ['Radio', `${MR.antennaName(r)}`, P('hg_antenna') ? 100 : P('better_radio') ? 80 : 60, `Commands take ${delay} s to arrive. Real signals travel at the speed of light, which still takes 4 to 24 minutes. Your scan reaches ${MR.scanOf(r)} squares${P('supercam') ? ' and the SuperCam laser checks 3 squares ahead' : ''}.`, delay + 's'],
  ];
  if (r.stuck) parts.unshift(['Stuck', 'In soft sand', 10, 'Spirit got stuck in soft sand in 2009. Back up 1 square, the way you came, to escape.', '!', 100]);
  /* Pie-style gauges: a ring that fills up, with the reading in the middle. */
  const gauge = (pct, col, label) => { const rr = 15.5, c = 2 * Math.PI * rr, f = Math.max(2, Math.min(100, pct));
    return `<svg class="gauge" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${rr}" fill="none" stroke="#0b1015" stroke-width="4"/><circle cx="18" cy="18" r="${rr}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(c * f / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/><text x="18" y="18" dy=".35em" text-anchor="middle">${esc(label)}</text></svg>`; };
  const worst = parts.reduce((w, p2, i) => p2[2] < parts[w][2] ? i : w, 0);
  UI.openModal(`<div class="sh"><h2>${esc(r.name)}'s rover health</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div>
    <div class="sb"><div class="health"><canvas id="healthPic" width="440" height="440"></canvas><div><div class="gauges">${parts.map(([n, v, h, f, lab, fill], i) =>
      `<button class="gtile ${i === worst ? 'on' : ''}" data-g="${i}" aria-label="${esc(n)}: ${esc(v)}">${gauge(fill ?? h, lvl(h), lab)}<b>${esc(n)}</b><small>${esc(v)}</small></button>`).join('')}</div>
      <p class="gfact" id="gFact"><b>${esc(parts[worst][0])}:</b> ${esc(parts[worst][3])}</p></div></div>
    <p class="muted" style="margin:0;font-size:13px">Tap a gauge to learn about it. Docking at the station charges the battery, cleans the panels and repairs the wheels for free.</p></div>`);
  document.querySelectorAll('.gtile').forEach(b => b.onclick = () => { const p2 = parts[+b.dataset.g];
    document.querySelectorAll('.gtile').forEach(x => x.classList.toggle('on', x === b)); $('gFact').innerHTML = `<b>${esc(p2[0])}:</b> ${esc(p2[3])}`; });
  R.drawPreview($('healthPic'), r);
}
$('healthBtn').onclick = () => healthModal();
function renderHud(){
  const r = myRover(); if (!r) return;
  const power = MR.usesPower(r);
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
  if (r.job === 'lab') {
    const L = st.lab || {inbox:[], catalog:[], mat:{}, built:{}};
    if (L.inbox.length) out.push([`${L.inbox.length} new sample${L.inbox.length > 1 ? 's' : ''} arrived at the lab!`, 'Add Catalog', 'catalog']);
    const can = Object.entries(MR.UPGRADES).find(([k, u]) => !L.built[k] && Object.entries(u.cost).every(([m, n]) => (L.mat[m] || 0) >= n));
    if (can) out.push([`You have enough materials to build the ${can[1].name.toLowerCase()}!`, `Add Build ${can[1].name}`, 'build_' + can[0]]);
    box.innerHTML = out.slice(0, 2).map(([t, b, a]) => `<div class="nudge"><span>${esc(t)}</span>${b ? `<button class="btn" data-nudge="${a}">${esc(b)}</button>` : ''}</div>`).join(''); return;
  }
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
    const fc = st.wx && (st.wx.forecast || []).find(x => x.storm);
    if (fc && out.length < 2 && r.bat < 80) out.push([`A dust storm is likely on sol ${fc.sol}. Charge up or head home before it arrives.`, 'Plan route home', 'home']);
    if ((r.wheels ?? 100) < 25 && out.length < 2) out.push(['Your wheels are worn. The station repairs them for free.', 'Plan route home', 'home']);
    if ((G.dull || 0) >= 2 && out.length < 2) out.push(['Nothing found lately. Scan finds mystery signals. Tap Show next to an objective to see where to look.', 'Add Scan', 'scan']);
  }
  box.innerHTML = out.slice(0, 2).map(([t, b, a]) => `<div class="nudge"><span>${esc(t)}</span>${b ? `<button class="btn" data-nudge="${a}">${esc(b)}</button>` : ''}</div>`).join('');
}
const planToPy = acts => acts.map(a => MR.pyOf(a.type, a.arg)).join('\n');
function applyPlan(acts, replace){
  const r = myRover(); if (!r || G.ready || G.phase !== 'plan') return;
  pushUndo();
  if (r.role === 'specialist') {
    const ta = $('editor'), code = planToPy(acts);
    ta.value = replace ? `from mars import rover\n\n${code}\n` : ta.value.replace(/\s*$/, '\n') + code + '\n'; ta.dataset.touched = '1';
  } else {
    if (replace) G.plan = [];
    acts.forEach(a => { const last = G.plan[G.plan.length - 1];
      if (r.role !== 'cadet' && last && last.type === a.type && (a.type === 'forward' || a.type === 'back') && last.arg + (a.arg || 1) <= 20) { last.arg += a.arg || 1; return; }
      if (G.plan.length < maxPlan()) G.plan.push({type:a.type, arg:MR.CMDS[a.type].arg ? (a.arg || 1) : undefined}); });
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
    case 'catalog': applyPlan([{type:'catalog'}]); break;
    default: if (b.dataset.nudge.startsWith('build_')) applyPlan([{type:b.dataset.nudge}]); break;
    case 'home': { const p = MR.findPath(st, r, (x, y) => MR.onStation(st.map, x, y));
      if (p) applyPlan(MR.pathToPlan(r, p, Math.min(maxPlan(), 12)), true); else UI.toast('!', '#f0bf5a', 'No route found yet', 'Explore a bit more so the rover can see a way back.'); break; }
  }
});
/* The Finds list: every flagged site that is still worth a look, best first. */
function renderFinds(){
  const st = G.state, r = myRover(), box = $('finds'); if (!st || !r) { box.innerHTML = ''; return; }
  const W = st.world, sites = st.sites || {}, rank = {C:1, U:2, R:3, L:4};
  const rows = Object.entries(sites).map(([i, s2]) => ({i:+i, ...s2})).filter(s2 => W.sig[s2.i] && !W.drilled[s2.i] && W.res[s2.i] && !(W.known[s2.i] && W.res[s2.i] === 'basalt'))
    .map(s2 => ({...s2, known:!!W.known[s2.i], res:W.res[s2.i], d:Math.hypot(s2.i % MW - r.x, ((s2.i/MW)|0) - r.y)}))
    .sort((a, b) => (b.known ? rank[MR.CARDS[b.res].rar] || 0 : 0) - (a.known ? rank[MR.CARDS[a.res].rar] || 0 : 0) || a.d - b.d);
  $('findsPanel').hidden = !rows.length || r.role === 'cadet';
  const who = pid => { const x = st.rovers.find(q2 => q2.pid === pid); return x ? x.name : 'Someone'; };
  box.innerHTML = rows.slice(0, 12).map(s2 => { const c = MR.CARDS[s2.res], finder = st.rovers.find(q2 => q2.pid === s2.by);
    const what = s2.known ? `${c.name} · <span style="color:${MR.RARITY[c.rar].col}">${MR.RARITY[c.rar].name}</span>` : 'Mystery signal';
    const claim = s2.claim === G.myPid ? `<button class="mini-b wide" data-claim="${s2.i}" data-on="0">Unclaim</button>` : s2.claim ? `<span class="muted">${esc(who(s2.claim))} is coming</span>` : `<button class="mini-b wide" data-claim="${s2.i}" data-on="1">I'll drill this</button>`;
    return `<li><span class="fd" style="background:${finder ? MR.colorHex(finder.color) : '#888'}"></span><span class="fn"><b>${esc(s2.name)}</b>${s2.by === G.myPid ? ` <button class="ren" data-ren="${s2.i}" aria-label="Rename">✎</button>` : ''}<small>${what} · ${Math.round(s2.d)} sq · found by ${esc(finder ? finder.name : '?')}</small></span><span class="fa">${team() ? claim : ''}<button class="mini-b wide" data-go="${s2.i}" ${G.phase !== 'plan' || G.ready ? 'disabled' : ''}>Go</button></span></li>`; }).join('');
}
$('finds').addEventListener('click', e => {
  const c = e.target.closest('[data-claim]'), go = e.target.closest('[data-go]'), ren = e.target.closest('[data-ren]');
  if (c) toHost({type:'claim', i:+c.dataset.claim, on:c.dataset.on === '1'});
  if (go) { const i = +go.dataset.go, st = G.state, from = planEnd(), x = i % MW, y = (i/MW)|0; if (!from) return;
    const path = MR.findPath(st, from, (px, py) => px === x && py === y);
    if (!path) { UI.toast('!', '#f0bf5a', 'No route found', 'The rover can not see a safe way there yet.'); return; }
    const acts = MR.pathToPlan(from, path, Math.max(1, maxPlan() - (myRole() === 'specialist' ? 0 : G.plan.length) - 2));
    if (!st.world.known[i]) acts.push({type:'analyze'}); acts.push({type:'drill'}); applyPlan(acts, false);
    if (team() && !(st.sites[i] || {}).claim) toHost({type:'claim', i, on:true}); }
  if (ren) { const li = ren.closest('li'), b = li.querySelector('b'), old = b.textContent;
    b.outerHTML = `<input class="input renin" maxlength="22" value="${esc(old)}" aria-label="Site name">`; const inp = li.querySelector('.renin'); inp.focus(); inp.select();
    const done = ok => { if (ok && inp.value.trim() && inp.value.trim() !== old) toHost({type:'rename', i:+ren.dataset.ren, name:inp.value.trim()}); else renderFinds(); };
    inp.onkeydown = ev => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); }; inp.onblur = () => done(true); }
});
/* Lab panel and the Mars Catalog. */
function renderLab(){
  const st = G.state, r = myRover(), L = st && st.lab; const show = L && st.rovers.some(x => x.job === 'lab');
  $('labPanel').hidden = !show; if (!show) return;
  const who = pid => pid === 'auto' ? 'Auto' : ((st.rovers.find(x => x.pid === pid) || {}).name || '?');
  $('labBody').innerHTML = `<div class="labrow"><span><b>${L.inbox.length}</b> waiting</span><span><b>${L.catalog.length}</b> cataloged</span>${Object.entries(MR.MATS).map(([k, m]) => `<span><b>${L.mat[k] || 0}</b> ${m.name.toLowerCase()}</span>`).join('')}</div>
    <div class="ups">${Object.entries(MR.UPGRADES).map(([k, u]) => { const done = L.built[k], cost = Object.entries(u.cost).map(([m, n]) => `${n} ${MR.MATS[m].name.toLowerCase()}`).join(', ');
      return `<div class="upg ${done ? 'done' : ''}"><span class="ui">${u.icon}</span><span><b>${u.name}</b><small>${done ? 'Built! ' + u.desc : `Needs ${cost}. ${u.desc}`}</small></span></div>`; }).join('')}</div>
    <button class="btn" id="catBtn">Mars Catalog (${L.catalog.length})</button>`;
  $('catBtn').onclick = () => catalogModal();
  G._who = who;
}
function catalogModal(){
  const st = G.state, L = st.lab, who = G._who || (x => x);
  UI.openModal(`<div class="sh"><h2>Mars Catalog</h2><button class="xbtn" data-close aria-label="Close">×</button></div><div class="sb">
    <p class="muted" style="margin:0">Every sample the team brought home on this expedition, with everyone who helped.</p>
    ${L.catalog.length ? `<ul class="catalog">${L.catalog.slice().reverse().map(e => { const c = MR.CARDS[e.res];
      return `<li><span class="fd" style="background:${c.color}"></span><span><b>${esc(c.name)}</b>${e.site ? ` · ${esc(e.site)}` : ''}<small>Found by ${esc(who(e.by))} · Drilled by ${esc(who(e.driller))} · Cataloged by ${esc(who(e.cataloger))} · Sol ${e.catSol || e.sol}${e.used ? ' · used in the lab' : ''}</small></span></li>`; }).join('')}</ul>` : '<p class="muted">Nothing cataloged yet.</p>'}
  </div>`);
}
function onMarkers(added, pid){
  G.lastMarkerKeys = Object.keys(G.markers); renderMarkers();
  if (added && pid !== G.myPid) { MR.sfx.join(); log('info', `${added.name} placed a marker: ${MARKS[added.kind].icon} ${MARKS[added.kind].name}.`); }
}
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
const KEYCAP = {forward:'W', left:'A', back:'S', right:'D', scan:'Q', analyze:'R', drill:'Space', dig:'G', charge:'C', catalog:'Q', make_water:'1', make_metal:'2', make_bricks:'3', make_glass:'4', build_solar_farm:'5', build_radio_tower:'6', build_garage:'7', build_greenhouse:'8'};
function renderPalette(){
  const have = cmdsForMe(), btn = (k, cls = '') => { const d = MR.CMDS[k];
    return `<button class="pal cat-${d.cat} ${cls}" data-c="${k}" aria-label="${d.label}${KEYCAP[k] ? ` (${KEYCAP[k]})` : ''}"><span class="ic" aria-hidden="true">${d.icon}</span><span class="lb">${d.label}</span><small>${d.cost}</small>${KEYCAP[k] ? `<span class="key">${KEYCAP[k]}</span>` : ''}</button>`; };
  const group = (label, keys, cls) => { const ks = keys.filter(k => have.includes(k)); return ks.length ? `<div class="pgroup ${cls||''}"><span class="pgl">${label}</span><div class="pbtns">${ks.map(k => btn(k)).join('')}</div></div>` : ''; };
  if (have.includes('catalog')) { $('palette').innerHTML = group('Lab', ['catalog','make_water','make_metal','make_bricks','make_glass']) + group('Build', ['build_solar_farm','build_radio_tower','build_garage','build_greenhouse']); return; }
  const relay = relayOK(), r = myRover(), code = r && r.role === 'specialist';
  const blk = k => { const b = MR.BLOCKS[k]; return `<button class="pal blk ${b.relay && !relay ? 'locked' : ''}" data-b="${k}" aria-label="${b.label}" title="${esc(b.desc)}${b.relay && !relay ? ' (needs the satellite relay kit)' : ''}" ${b.relay && !relay ? 'disabled' : ''}><span class="ic" aria-hidden="true">${b.icon}</span><span class="lb">${b.label}</span><small>${code ? 'Python' : 'holds blocks'}</small></button>`; };
  $('palette').innerHTML = `<div class="pgroup drive"><span class="pgl">Drive</span><div class="dpad">${btn('forward','up')}${btn('left','lf')}${btn('back','dn')}${btn('right','rt')}</div></div>`
    + group('Science', ['scan','analyze','drill']) + group('Tools', ['dig']) + group('Power', ['charge'])
    + (relay ? group('Relay', ['go_signal','go_home']) : '')
    + `<div class="pgroup smart"><span class="pgl">${code ? 'Sensors' : 'Smart'}</span><div class="pbtns">${Object.keys(MR.BLOCKS).filter(k => relay || code ? true : k === 'repeat').map(blk).join('')}</div></div>`;
}
/* The satellite relay kit unlocks at the second rank (uses the live profile, so it works mid-expedition). */
function relayOK(){ const r = myRover(), p = me(); return !!r && r.role !== 'cadet' && r.job !== 'lab' && !!p && MR.rankOf(p.xp) >= 1; }
const isBlk = c => !!(c && MR.BLOCKS[c.type]);
const countIn = list => list.reduce((n, c) => n + 1 + (c.body ? countIn(c.body) : 0), 0);
function planCount(){ return countIn(G.plan); }
/* Blocks are addressed by a path like "2" or "2.0". Returns the list holding it, its index and the block. */
function locate(key){ const ix = String(key).split('.').map(Number); let list = G.plan;
  for (let d = 0; d < ix.length - 1; d++) { const c = list[ix[d]]; if (!c || !c.body) return null; list = c.body; }
  const i = ix[ix.length - 1]; return list[i] ? {list, i, c:list[i]} : null; }
function curBody(){ const f = G.cursor != null ? locate(G.cursor) : null; return f && f.c.body ? f.c.body : G.plan; }
const MAX_DEPTH = 2;
function renderRelay(){
  const r = myRover(), box = $('relayBar'); if (!r || !G.state || r.role === 'cadet' || r.job === 'lab') { box.innerHTML = ''; return; }
  const ok = relayOK(), canEdit = G.phase === 'plan' && !G.ready, P = r.prog, code = r.role === 'specialist';
  let h = '';
  if (P) h += `<div class="progcard"><span class="pi">⌁</span><span><b>Program running</b><small>Sol ${P.sols - P.solsLeft + 1} of ${P.sols}${P.name ? ' · ' + esc(P.name) : ''}. ${G.cancelProg ? 'It will be cancelled when you send.' : 'Send an empty plan to let it keep going, or make a new plan to replace it.'}</small></span><button class="btn" id="cancelProg" ${canEdit ? '' : 'disabled'}>${G.cancelProg ? 'Keep it' : 'Cancel program'}</button></div>`;
  h += `<div class="relayrow">`;
  if (ok && !code) h += `<button class="btn sol2 ${G.relaySols > 1 ? 'on' : ''}" id="sols2" ${canEdit ? '' : 'disabled'} aria-pressed="${G.relaySols > 1}" title="The relay satellite keeps your plan running the next sol too">⌁ Run for 2 sols${G.relaySols > 1 ? ' ✓' : ''}</button>`;
  h += `<button class="btn" id="recipesBtn" ${canEdit ? '' : 'disabled'}>Recipes</button>`;
  if (code) h += `<button class="btn" id="sensorsBtn">Sensors</button>`;
  if (!ok) { const p = me(); h += `<span class="relaylock">⌁ Satellite relay kit unlocks at ${esc(MR.RANKS[1].name)}${p ? ` (${Math.max(0, MR.RANKS[1].xp - p.xp)} XP to go)` : ''}</span>`; }
  h += `</div>`;
  box.innerHTML = h;
}
$('relayBar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'cancelProg') { G.cancelProg = !G.cancelProg; renderRelay(); renderLock(); }
  if (b.id === 'sols2') { G.relaySols = G.relaySols > 1 ? 1 : 2; MR.sfx.click(); renderRelay(); renderPlan(); }
  if (b.id === 'recipesBtn') recipesModal();
  if (b.id === 'sensorsBtn') sensorsModal();
  b.blur();
});
const modal = (title, body) => UI.openModal(`<div class="sh"><h2>${esc(title)}</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">${body}</div>`);
function recipesModal(){
  const r = myRover(); if (!r) return; const ok = relayOK(), code = r.role === 'specialist';
  modal('Mission recipes', `<p class="muted">Ready-made programs to start from. Pick one, then change it however you like.</p><div class="recipes">${MR.RECIPES.map(x => {
    const lock = x.relay && !ok;
    return `<button class="recipe" data-rec="${x.id}" ${lock ? 'disabled' : ''}><span class="ri">${x.icon}</span><span><b>${esc(x.name)}</b>${x.sols > 1 ? ' <i>2 sols</i>' : ''}<small>${esc(x.desc)}${lock ? ' Needs the satellite relay kit.' : ''}</small></span></button>`; }).join('')}</div>`
    + (code ? '' : `<p class="muted">Recipes replace today's plan. Undo brings it back.</p>`));
  document.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { const x = MR.RECIPES.find(q => q.id === b.dataset.rec); UI.closeModal(); useRecipe(x); });
}
function useRecipe(x){
  const r = myRover(); if (!r || G.ready || G.phase !== 'plan') return;
  pushUndo();
  if (r.role === 'specialist') { $('editor').value = x.py; $('editor').dataset.touched = '1'; $('err').hidden = true; }
  else { G.plan = JSON.parse(JSON.stringify(x.blocks)).map(fillBlock); G.cursor = null; G.relaySols = relayOK() ? x.sols : 1; }
  MR.sfx.click(); renderPlan(); renderRelay(); renderLock(); updateGhost();
}
function fillBlock(c){ if (MR.BLOCKS[c.type]) { c.body = (c.body || []).map(fillBlock); if (MR.BLOCKS[c.type].arg && !c.arg) c.arg = MR.BLOCKS[c.type].def; } else if (MR.CMDS[c.type] && MR.CMDS[c.type].arg && !c.arg) c.arg = 1; return c; }
function sensorsModal(){
  const ok = relayOK();
  const rows = [['rover.sense_ahead() == "rock"', 'What is on the square ahead: "rock", "clear", "sand", "signal" or "edge". Looking ahead is free.'],
    ['rover.signal_here()', 'True when the rover is on a mystery signal.'], ['rover.signal_nearby()', 'True when a known signal is within 3 squares.'],
    ['rover.worth_drilling()', 'True when Analyze found something good under the rover.'], ['rover.tubes_full()', 'True when every sample tube is full.'],
    ['rover.battery() < 30', 'The battery level. Compare it with < > <= >= =='], ['rover.storm()', 'True during a dust storm.'], ['rover.at_home()', 'True when the rover is on the station.']];
  const relay = [['rover.go_to_signal()', 'Drive to the nearest known signal that is not just basalt.'], ['rover.go_home()', 'Drive back to the station by the safest known route.'],
    ['for sol in rover.mission(2):', 'Run the indented program on this sol and the next one (1 to 3 sols). The relay satellite also maps the area.']];
  modal('Rover sensors', `<p class="muted">Use sensors in <code>if</code>, <code>elif</code> and <code>while</code>. Join them with <code>and</code>, <code>or</code>, <code>not</code>. A while loop stops after 30 rounds, and AutoNav stops the program before the rover hits something.</p>
    <table class="sens">${rows.map(([c, d]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(d)}</td></tr>`).join('')}</table>
    <h4>Satellite relay kit${ok ? '' : ' (locked)'}</h4><table class="sens">${relay.map(([c, d]) => `<tr><td><code>${esc(c)}</code></td><td>${esc(d)}</td></tr>`).join('')}</table>
    <h4>Example</h4><pre class="code">def check():
    rover.analyze()
    if rover.worth_drilling():
        rover.drill()

while rover.sense_ahead() == "clear":
    rover.forward(1)
    if rover.signal_here():
        check()</pre>`);
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
  $('count').textContent = `${planCount()} / ${maxPlan()}`;
  const dis = G.ready || G.phase !== 'plan' ? 'disabled' : '';
  const row = (c, key, n, first, depth) => { const b = MR.BLOCKS[c.type], d = b || MR.CMDS[c.type], open = b && G.cursor === key, pad = depth ? ` style="margin-left:${depth * 26}px"` : '';
    const argBtns = (d.arg) ? `<span class="arg"><button class="mini-b" data-a="dec" aria-label="${b ? 'Fewer times' : 'Fewer squares'}" ${dis}>−</button><b>${c.arg}${b ? '×' : ''}</b><button class="mini-b" data-a="inc" aria-label="${b ? 'More times' : 'More squares'}" ${dis}>+</button></span>` : '';
    return `<li class="cmd ${b ? 'blk' : 'cat-' + d.cat} ${open ? 'open' : ''} ${c.state||''}" data-i="${key}"${pad}><span class="num">${depth ? '' : n}</span><span class="ic" aria-hidden="true">${d.icon}</span>`
      + (b ? `<button class="lb blb" data-a="open" ${dis} title="${open ? 'Close this block' : 'Put new blocks inside'}">${d.label}${open ? ' ▾' : ' ▸'}</button>` : `<span class="lb">${d.label}</span>`)
      + `${argBtns}<button class="mini-b" data-a="up" aria-label="Move up" ${dis || (first ? 'disabled' : '')}>⌃</button><button class="mini-b" data-a="del" aria-label="Remove" ${dis}>×</button></li>`; };
  const rows = [];
  const walk = (list, prefix, depth) => list.forEach((c, i) => { const key = prefix + i; rows.push(row(c, key, i + 1, i === 0, depth));
    if (!c.body) return; walk(c.body, key + '.', depth + 1);
    const pad = ` style="margin-left:${(depth + 1) * 26}px"`;
    if (G.cursor === key) rows.push(`<li class="drop"${pad}>${c.body.length ? 'New blocks go inside here.' : 'Now add blocks to go inside.'} <button class="mini-b wide" data-a="close" data-i="${key}" ${dis}>Done</button></li>`);
    else if (!c.body.length) rows.push(`<li class="drop"${pad}>Empty. Click ${esc(MR.BLOCKS[c.type].label)} to add blocks inside.</li>`); });
  walk(G.plan, '', 0);
  if (G.relaySols > 1 && relayOK()) rows.push(`<li class="drop">⌁ The relay satellite runs this plan again next sol.</li>`);
  $('prog').innerHTML = G.plan.length ? rows.join('') : `<li class="empty">Tap a command above (or use W A S D, Q, R, Space) to add it to today's plan.</li>`;
  const hl = t => esc(t).replace(/^(\s*)(rover|lab)\.(\w+)\((\d*)/, (m0, s0, o, f, n) => `${s0}${o}.<span class="f">${f}</span>(${n ? `<span class="n">${n}</span>` : ''}`).replace(/^(\s*)(for|if|while|not)\b/, '$1<span class="f">$2</span>');
  $('code').innerHTML = [`<span class="c"># Sol ${G.state.sol} plan</span>`, `<span class="f">from</span> mars <span class="f">import</span> rover`, '']
    .concat(G.plan.length ? blocksToPy(G.plan).map(hl) : ['<span class="c"># (empty) add commands in Blocks</span>']).join('\n');
}
function blocksToPy(plan){
  const lines = [], two = G.relaySols > 1 && relayOK(), base = two ? '    ' : '';
  if (two) lines.push('for sol in rover.mission(2):');
  const one = (c, ind) => { const b = MR.BLOCKS[c.type];
    if (b) { lines.push(ind + b.py(c.arg)); if (c.body.length) c.body.forEach(k => one(k, ind + '    ')); else lines.push(ind + '    pass'); }
    else lines.push(ind + MR.pyOf(c.type, c.arg)); };
  plan.forEach(c => one(c, base));
  return lines;
}
function renderLock(){
  const r = myRover(); if (!r) return;
  const canEdit = G.phase === 'plan' && !G.ready, full = planCount() >= maxPlan();
  document.querySelectorAll('.pal').forEach(b => b.disabled = !canEdit || (r.role !== 'specialist' && full) || b.classList.contains('locked'));
  document.querySelectorAll('.cbtn').forEach(b => b.disabled = !canEdit || full);
  $('editor').readOnly = !canEdit;
  $('clearBtn').disabled = !canEdit;
  $('trashBtn').disabled = !canEdit;
  const empty = r.role !== 'specialist' && !G.plan.length, hasPlan = true;
  const keep = r.prog && !G.cancelProg && (r.role === 'specialist' ? !progTouched() : !G.plan.length);
  const label = G.phase === 'run' ? 'Rovers driving…' : G.phase === 'won' && !G.contAfterWin ? 'Done' : G.ready ? 'Change plan' : keep ? 'Keep program running' : empty ? 'Wait this sol' : team() ? 'Ready' : 'Send to Mars';
  $('sendBtn').textContent = label; $('sendBtn').disabled = G.phase !== 'plan' || (!G.ready && !hasPlan);
  $('goBtn').textContent = G.phase === 'run' ? '…' : G.ready ? 'WAITING' : 'GO!';
  $('goBtn').disabled = G.phase !== 'plan' || (!G.ready && !G.plan.length);
}
function planActions(){
  const r = myRover(); if (!r) return {actions:[]};
  if (r.role === 'specialist') {
    if (r.prog && !progTouched()) return {actions:[], keep:true};
    const res = MR.parsePy($('editor').value, MR.ROLES.specialist.maxCmd, {relay:relayOK()});
    if (res.error) return {error:res.error};
    if (res.program) return {actions:res.actions, program:{...res.program, name:null}, info:{python:true, loops:res.loops, nested:res.nested, maxRepeat:res.maxRepeat, blocks:res.lines, sensors:true, sols:res.program.sols, program:true}};
    return {actions:res.actions, info:{python:true, loops:res.loops, nested:res.nested, maxRepeat:res.maxRepeat, blocks:res.lines, clean:res.lines <= 5 && res.actions.reduce((s, a) => s + (MR.CMDS[a.type].arg ? a.arg : 1), 0) >= 10}};
  }
  const two = G.relaySols > 1 && relayOK();
  const plain = c => !isBlk(c) && !(MR.CMDS[c.type] && MR.CMDS[c.type].macro);
  if (!two && G.plan.every(c => plain(c) || (c.type === 'repeat' && c.body.every(plain)))) {
    /* only commands and Repeat blocks: unroll into a normal plan (full preview, battery estimate) */
    const acts = []; G.plan.forEach((c, i) => { if (c.type !== 'repeat') acts.push({type:c.type, arg:c.arg || 1, idx:i}); else for (let k = 0; k < c.arg; k++) c.body.forEach(q => acts.push({type:q.type, arg:q.arg || 1, idx:i})); });
    if (acts.length > maxPlan() * 4) return {error:`That plan makes ${acts.length} moves. Try fewer repeats.`};
    return {actions:acts, info:{python:false, blocks:planCount(), loops:G.plan.some(c => c.type === 'repeat')}};
  }
  if (two || G.plan.some(c => isBlk(c) || (MR.CMDS[c.type] && MR.CMDS[c.type].macro))) {
    const node = (c, idx) => { const b = MR.BLOCKS[c.type];
      if (!b) return MR.CMDS[c.type].macro ? {n:'macro', kind:MR.CMDS[c.type].macro, idx} : {n:'cmd', type:c.type, arg:c.arg || 1, idx};
      const body = c.body.map(k => node(k, idx));
      return c.type === 'repeat' ? {n:'repeat', times:c.arg, body, idx} : b.loop ? {n:'while', cond:b.cond, body, idx} : {n:'if', cond:b.cond, body, idx}; };
    const lead = []; for (let i = 0; i < G.plan.length && !isBlk(G.plan[i]) && !MR.CMDS[G.plan[i].type].macro; i++) lead.push({type:G.plan[i].type, arg:G.plan[i].arg || 1, idx:i});
    return {actions:lead, program:{sols:two ? 2 : 1, perSol:true, body:G.plan.map((c, i) => node(c, i)), defs:{}},
      info:{python:false, blocks:planCount(), loops:G.plan.some(c => c.type === 'repeat' || c.type === 'until_full'), sensors:G.plan.some(c => isBlk(c) && c.type !== 'repeat'), sols:two ? 2 : 1, program:true}};
  }
  return {actions:G.plan.map((c, i) => ({type:c.type, arg:c.arg || 1, idx:i})), info:{python:false, blocks:G.plan.length}};
}
/* Specialists: has the editor changed since the program started? If not, sending keeps the running program. */
function progTouched(){ return $('editor').dataset.touched === '1'; }
let draftTimer = null;
function updateGhost(){
  const r = myRover(); if (!r || !G.state) { R.ghost = []; return; }
  const pa = planActions();
  R.ghost = pa.error ? [] : MR.ghostPath(G.state, r, pa.actions);
  if (!team()) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => toHost({type:'draft', path:R.ghost.map(p => [p[0], p[1]])}), 250);
}
const _ug = updateGhost; updateGhost = function(){ _ug(); planEstimate(); };
function pushUndo(){ const r = myRover(); G.undo = G.undo || []; G.undo.push(r && r.role === 'specialist' ? {code:$('editor').value} : {plan:JSON.parse(JSON.stringify(G.plan))}); if (G.undo.length > 40) G.undo.shift(); }
function undo(){ if (G.ready || G.phase !== 'plan' || !G.undo || !G.undo.length) return; const u = G.undo.pop();
  if (u.code != null) $('editor').value = u.code; else { G.plan = u.plan; G.cursor = null; } MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); renderNudges(); }
function addCmd(k){
  const r = myRover(); if (!r || G.phase !== 'plan' || G.ready) return;
  pushUndo();
  if (r.role === 'specialist') return insertPy(k);
  const body = r.role === 'cadet' ? G.plan : curBody(), last = body[body.length - 1];
  if (r.role !== 'cadet' && last && last.type === k && (k === 'forward' || k === 'back') && last.arg < 20) {
    last.arg++; G.plan.forEach(c => c.state = ''); MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); return;
  }
  if ((r.role === 'cadet' ? G.plan.length : planCount()) >= maxPlan()) { MR.sfx.bump(); return; }
  G.plan.forEach(c => c.state = '');
  body.push({type:k, arg: MR.CMDS[k] && MR.CMDS[k].arg ? 1 : undefined});
  MR.sfx.click(); renderPlan(); renderLock(); updateGhost();
}
function addBlock(k){
  const r = myRover(), b = MR.BLOCKS[k]; if (!r || !b || G.phase !== 'plan' || G.ready || (b.relay && !relayOK())) return;
  pushUndo();
  if (r.role === 'specialist') return insertPyLine(b.py(b.def || 3), true);
  if (planCount() >= maxPlan() - 1) { MR.sfx.bump(); return; }
  G.plan.forEach(c => c.state = '');
  const depth = G.cursor != null ? String(G.cursor).split('.').length : 0;
  if (depth >= MAX_DEPTH) G.cursor = String(G.cursor).split('.').slice(0, MAX_DEPTH - 1).join('.');
  const body = curBody(); body.push({type:k, arg:b.arg ? b.def : undefined, body:[]});
  G.cursor = (body === G.plan ? '' : G.cursor + '.') + (body.length - 1);
  MR.sfx.click(); renderPlan(); renderLock(); updateGhost();
}
function insertPy(k){ insertPyLine(MR.pyOf(k, 1)); }
function insertPyLine(line, header){
  const ta = $('editor'), v = ta.value, pos = ta.selectionStart ?? v.length;
  const lineEnd = v.indexOf('\n', pos), end = lineEnd === -1 ? v.length : lineEnd;
  const lineStart = v.lastIndexOf('\n', pos - 1) + 1, cur = v.slice(lineStart, end);
  const ind = (cur.match(/^\s*/) || [''])[0] + (/:\s*$/.test(cur) ? '    ' : '');
  const text = `${ind}${line}` + (header ? `\n${ind}    ` : '');
  const before = v.slice(0, end), after = v.slice(end);
  const sep = before.length && !before.endsWith('\n') ? '\n' : '';
  ta.value = before + sep + text + (after.startsWith('\n') || !after ? after : '\n' + after);
  if (!ta.value.endsWith('\n')) ta.value += '\n';
  ta.dataset.touched = '1';
  const caret = before.length + sep.length + text.length; ta.focus(); ta.setSelectionRange(caret, caret);
  $('err').hidden = true; updateGhost(); renderLock();
}
$('palette').onclick = e => { const b = e.target.closest('.pal'); if (b && !b.disabled) { if (b.dataset.b) addBlock(b.dataset.b); else addCmd(b.dataset.c); } };
document.querySelectorAll('.cbtn').forEach(b => b.onclick = () => addCmd(b.dataset.pic));
$('seq').onclick = e => { const b = e.target.closest('.pic'); if (!b || b.classList.contains('slot') || G.ready || G.phase !== 'plan') return; pushUndo(); G.plan.splice(+b.dataset.i, 1); G.plan.forEach(c => c.state = ''); MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); };
$('undoBtn').onclick = () => undo();
$('trashBtn').onclick = () => { if (G.ready || G.phase !== 'plan') return; pushUndo(); G.plan = []; G.cursor = null; renderPlan(); renderLock(); updateGhost(); };
$('prog').onclick = e => {
  const b = e.target.closest('button'), item = e.target.closest('.cmd, .drop'); if (!b || !item || G.ready || G.phase !== 'plan') return;
  const key = String(b.dataset.i ?? item.dataset.i), a = b.dataset.a, f = locate(key);
  if (a === 'close') { G.cursor = null; renderPlan(); return; }
  if (!f) return; const {list, i, c} = f;
  if (a === 'open') { G.cursor = G.cursor === key ? null : key; MR.sfx.click(); renderPlan(); return; }
  pushUndo(); G.plan.forEach(p => p.state = '');
  const mx = MR.BLOCKS[c.type] ? MR.BLOCKS[c.type].max : 20, mn = MR.BLOCKS[c.type] ? 2 : 1;
  if (a === 'inc') c.arg = Math.min(mx, c.arg + 1);
  if (a === 'dec') c.arg = Math.max(mn, c.arg - 1);
  if (a === 'del') { list.splice(i, 1); if (c.body) G.cursor = null; else if (G.cursor != null && !locate(G.cursor)) G.cursor = null; }
  if (a === 'up' && i > 0) { [list[i-1], list[i]] = [list[i], list[i-1]]; if (G.cursor != null) G.cursor = null; }
  renderPlan(); renderLock(); updateGhost();
};
$('editor').addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); const ta = e.target, s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.setSelectionRange(s+4, s+4); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendPlan(); }
});
let pyTimer = null;
$('editor').addEventListener('input', e => { e.target.dataset.touched = '1'; $('err').hidden = true; clearTimeout(pyTimer); pyTimer = setTimeout(updateGhost, 250); });
$('clearBtn').onclick = () => { if (G.ready || G.phase !== 'plan') return; pushUndo(); if (myRole() === 'specialist') { $('editor').value = 'from mars import rover\n\n'; $('editor').dataset.touched = '1'; } else { G.plan = []; G.cursor = null; } renderPlan(); renderLock(); updateGhost(); };
$('tabBlocks').onclick = () => { G.showCode = false; $('tabBlocks').setAttribute('aria-selected', true); $('tabCode').setAttribute('aria-selected', false); renderGame(); };
$('tabCode').onclick = () => { G.showCode = true; $('tabBlocks').setAttribute('aria-selected', false); $('tabCode').setAttribute('aria-selected', true); renderGame(); };
$('sendBtn').onclick = () => sendPlan();
$('goBtn').onclick = () => sendPlan();

function sendPlan(){
  if (G.phase !== 'plan') return;
  if (G.ready) { G.ready = false; toHost({type:'unready'}); G.plan.forEach(c => c.state = ''); renderPlan(); renderTeam(); return; }
  const pa = planActions();
  if (pa.error) { $('err').hidden = false; $('err').textContent = pa.error; MR.sfx.bump(); return; }
  if (!pa.actions.length && myRole() === 'cadet') return;
  G.planInfo = pa.info || null; G.ready = true; MR.sfx.click(); $('solCard').innerHTML = '';
  G.plan.forEach(c => c.state = ''); G.cursor = null;
  toHost({type:'plan', actions:pa.actions, program:pa.program || null, cancel:!!G.cancelProg && !pa.program});
  if (pa.program && myRole() === 'specialist') $('editor').dataset.touched = '';
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
      a.px = tx; a.py = ty; r.x = tx; r.y = ty; r.bat = ev.bat; if (ev.wheels != null) r.wheels = ev.wheels;
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
    case 'dock': r.bat = ev.bat; r.tubes = []; if (ev.wheels != null) r.wheels = ev.wheels; if (ev.dust != null) r.dust = ev.dust; if (mine && ev.n) MR.sfx.good(); break;
    case 'artifact': { const [x, y] = cell(ev.i); W.drilled[ev.i] = 1; W.known[ev.i] = 1; R.addFx({type:'confetti', x, y, dur:1600, parts:MR.confetti()}); MR.sfx.good(); await wait(500); break; }
    case 'skip': if (mine) markPlan(ev.idx, true); if (mine) log('warn', `${ev.n} remaining step${ev.n > 1 ? 's were' : ' was'} skipped for safety.`); break;
    case 'night': ev.charges.forEach(c => { const q2 = st.rovers.find(x => x.pid === c.pid); if (q2) { q2.bat = c.bat; if (c.dust != null) q2.dust = c.dust; } }); st.sol = ev.sol; if (ev.wx) st.wx = ev.wx; R.view.wx = st.wx; await wait(250); break;
    case 'gust': case 'wx': break;
    case 'progstart': seen(ev.seen); if (r) r.prog = r.prog || {sols:ev.sols, solsLeft:ev.sols};
      if (ev.sols > 1) { R.addFx({type:'ring', x:r.x, y:r.y, dur:1800, r:7.5}); if (mine) MR.sfx.scan(); await wait(900); } break;
    case 'progstop': if (mine) MR.sfx.bump(); await wait(300); break;
    case 'progcont': case 'progend': case 'proginfo': break;
    case 'catalog': if (st.lab) { st.lab.inbox = []; st.lab.catalog.push(...ev.entries); } MR.sfx.click(); await wait(500); break;
    case 'make': if (st.lab) st.lab.mat = ev.mats; await wait(600); break;
    case 'build': if (st.lab) { st.lab.mat = ev.mats; st.lab.built[ev.up] = true; } R.addFx({type:'confetti', x:MR.MAPS[st.map].station.x + .5, y:MR.MAPS[st.map].station.y + .5, dur:1600, parts:MR.confetti()}); MR.sfx.good(); await wait(800); break;
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
  G.solPlayed = G.state.sol; G.solStorm = !!(G.state.wx && G.state.wx.storm); G.phase = 'run'; G.ready = false; if (!isHostish()) G.readyPids = []; R.running = true; R.ghost = []; R.drafts = {}; G.drafts = {};
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
    const code = myRole() === 'cadet' ? null : codeReview(timeline.flat().filter(e => e.pid === G.myPid), G.planInfo, newState);
    const notices = MR.applyRewards(p, G.myPid, timeline.flat(), {map:newState.map, players:newState.rovers.length, planInfo:G.planInfo, code, storm:G.solStorm, greenhouse:!!(newState.lab && newState.lab.built.greenhouse)});
    renderSolCard(timeline.flat().filter(e => e.pid === G.myPid), newState, code);
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
  if (myRole() !== 'specialist' && G.plan.length) { G.undo = G.undo || []; G.undo.push({plan:JSON.parse(JSON.stringify(G.plan.map(c => ({type:c.type, arg:c.arg, body:c.body}))))}); G.plan = []; }
  G.cursor = null; G.relaySols = 1; G.cancelProg = false;
  G.phase = newState.won && !G.contAfterWin ? 'won' : 'plan';
  renderGame(); updateGhost();
  if (won) showWin(newState);
  const pend = G.pending; G.pending = []; pend.forEach(f => f());
  if (isHostish()) { broadcast({type:'ready', pids:G.readyPids}); renderTeam(); maybeRun(); }
}
/* Code stars: did the plan work, was it efficient, did it use a smart tool. Plus one friendly tip. */
function codeReview(mine, info, st){
  if (!info || !mine.length) return null;
  const halted = mine.some(e => e.t === 'skip' || e.t === 'bump' || e.t === 'stuck' || e.t === 'lowpower');
  const steps = mine.filter(e => ['move','turn','scan','analyze','drill','dig','charge'].includes(e.t)).length;
  const goodDrill = mine.some(e => e.t === 'drill' && e.res !== 'basalt'), basalt = mine.some(e => e.t === 'drill' && e.res === 'basalt');
  const found = mine.some(e => (e.t === 'scan' && e.sigs.length) || (e.t === 'dock' && e.n) || (e.t === 'analyze' && e.cells.length));
  const worked = !halted && steps > 0, efficient = steps / Math.max(1, info.blocks) >= (info.program ? 1 : 1.5);
  const smart = info.python ? !!(info.loops || info.sensors) : (goodDrill || found || !!info.sensors);
  const stars = (worked ? 1 : 0) + (efficient ? 1 : 0) + (smart ? 1 : 0);
  let tip;
  if (mine.some(e => e.t === 'progstop') && !mine.some(e => e.t === 'bump')) tip = 'Your program stopped early. Check the mission log to see why.';
  else if (mine.some(e => e.t === 'bump')) tip = 'A hazard stopped your rover. Scan first, or tap the map to plan a route around rocks.';
  else if (mine.some(e => e.t === 'lowpower')) tip = 'The battery ran low. Add Charge, or plan a trip home to the station.';
  else if (basalt) tip = 'That was just basalt. Analyze before you Drill to save your sample tubes.';
  else if (info.python && info.maxRepeat >= 3) tip = `You wrote the same line ${info.maxRepeat} times in a row. A for loop does that in 2 lines.`;
  else if (info.python && !info.loops) tip = 'Try a for loop: for i in range(3): repeats the indented lines.';
  else if (info.program && info.sols < 2 && !info.python && relayOK()) tip = 'Smart blocks keep working while you sleep: try Run for 2 sols.';
  else if (!efficient) tip = info.python ? 'Tip: rover.forward(5) drives 5 squares in one line.' : 'Tip: press W again to add squares to the same Forward block.';
  else if (!smart) tip = 'Scan finds mystery signals, and Analyze tells you if they are worth drilling.';
  else tip = stars === 3 ? 'Perfect plan!' : 'Nice plan!';
  return {stars, worked, efficient, smart, tip, nested:!!info.nested, python:!!info.python};
}
function renderSolCard(mine, st, code){
  const r = st.rovers.find(x => x.pid === G.myPid); if (!r) { $('solCard').innerHTML = ''; return; }
  const sq = mine.filter(e => e.t === 'move').length, sigs = mine.reduce((n, e) => n + (e.t === 'scan' ? e.sigs.length : e.t === 'move' && e.sigs ? e.sigs.length : 0), 0);
  const samples = mine.filter(e => e.t === 'drill').length, delivered = mine.reduce((n, e) => n + (e.t === 'dock' ? e.n : 0), 0);
  const bits = [`${sq} square${sq === 1 ? '' : 's'}`];
  if (sigs) bits.push(`${sigs} signal${sigs === 1 ? '' : 's'} found`);
  if (samples) bits.push(`${samples} ${r.role === 'cadet' ? 'treasure' : 'sample'}${samples === 1 ? '' : 's'}`);
  if (delivered) bits.push(`${delivered} delivered`);
  if (r.role !== 'cadet') bits.push(`battery ${r.bat}%`);
  const starHtml = code ? `<span class="stars3" title="Plan stars: worked, efficient, smart">${'★'.repeat(code.stars)}<i>${'★'.repeat(3 - code.stars)}</i></span>` : '';
  $('solCard').innerHTML = `<div class="solcard"><div class="ph"><b>Sol ${G.solPlayed || st.sol} report</b>${starHtml}</div><span>${bits.join(' · ')}</span>${code ? `<small>${esc(code.tip)}</small>` : ''}</div>`;
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
R.onTapRover = (pid, x, y) => { $('tapMenu').hidden = true; if (pid) showTip(pid, x, y); else $('tip').hidden = true; };
/* Tap the map: build plan steps for you, or drop a team marker. */
const MARKS = {dig:{icon:'⛏', name:'Dig here'}, danger:{icon:'⚠', name:'Danger'}, meet:{icon:'★', name:'Meet here'}};
function planEnd(){ const r = myRover(); if (!r) return null; const g = R.ghost[R.ghost.length-1]; return g ? {...r, x:g[0], y:g[1], dir:g[2]} : r; }
R.onTapMap = (x, y, cx, cy) => {
  $('tip').hidden = true; const r = myRover(), st = G.state; if (!r || !st || !MR.inb(x, y)) return;
  const W = st.world, i = y*MW + x, opts = [], canPlan = r.role !== 'cadet' && G.phase === 'plan' && !G.ready;
  if (canPlan) {
    if (MR.onStation(st.map, x, y)) opts.push(['home', '⌂ Go home (unload and recharge)']);
    else if (W.res[i] && W.sig[i] && !W.drilled[i] && !MR.CARDS[W.res[i]].artifact) opts.push(['check', W.known[i] ? `⊛ Go and drill ${MR.CARDS[W.res[i]].name}` : '◈ Go and check it (drive, analyze, drill)']);
    if (!MR.onStation(st.map, x, y)) { opts.push(['drive', '↑ Drive here']); opts.push(['drivescan', '◎ Drive here and scan']); }
  }
  if (team() || r.role !== 'cadet') { const mk = G.markers[x + ',' + y];
    Object.entries(MARKS).forEach(([k, m]) => opts.push(['mark:' + k, `${m.icon} Marker: ${m.name}`]));
    if (mk) opts.push(['mark:', '✕ Remove marker']); }
  if (!opts.length) return;
  const menu = $('tapMenu'); menu.dataset.x = x; menu.dataset.y = y;
  menu.innerHTML = opts.map(([a, l]) => `<button data-tap="${a}">${esc(l).replace('◈', MR.ICON_VIAL)}</button>`).join('');
  menu.hidden = false; menu.style.left = Math.min(innerWidth - menu.offsetWidth - 10, cx + 8) + 'px'; menu.style.top = Math.min(innerHeight - menu.offsetHeight - 10, cy + 8) + 'px';
};
$('tapMenu').addEventListener('click', e => {
  const b = e.target.closest('[data-tap]'); if (!b) return; const m = $('tapMenu'), x = +m.dataset.x, y = +m.dataset.y, a = b.dataset.tap; m.hidden = true;
  if (a.startsWith('mark:')) { toHost({type:'marker', x, y, kind:a.slice(5) || null}); return; }
  const st = G.state, from = planEnd(); if (!from) return;
  const path = MR.findPath(st, from, a === 'home' ? (px, py) => MR.onStation(st.map, px, py) : (px, py) => px === x && py === y);
  if (!path) { UI.toast('!', '#f0bf5a', 'No route found', 'The rover can not see a safe way there yet.'); return; }
  const room = maxPlan() - (myRole() === 'specialist' ? 0 : G.plan.length);
  const acts = MR.pathToPlan(from, path, Math.max(1, room - (a === 'check' ? 2 : a === 'drivescan' ? 1 : 0)));
  if (a === 'check') { const i = y*MW + x; if (!st.world.known[i]) acts.push({type:'analyze'}); acts.push({type:'drill'}); }
  if (a === 'drivescan') acts.push({type:'scan'});
  applyPlan(acts, false);
});
document.addEventListener('pointerdown', e => { if (!e.target.closest('#tapMenu') && e.target.id !== 'map') $('tapMenu').hidden = true; });
function renderMarkers(){ R.markers = Object.values(G.markers || {}); }
function planEstimate(){
  const r = myRover(), el = $('planEst'); if (!r || r.role === 'cadet' || G.phase !== 'plan') { el.textContent = ''; return; }
  const pa = planActions();
  if (pa.keep) { el.className = 'est'; el.textContent = `Your program keeps running (sol ${r.prog.sols - r.prog.solsLeft + 1} of ${r.prog.sols}).`; return; }
  if (pa.program) { el.className = 'est'; el.textContent = `Smart program: the rover decides as it drives${pa.program.sols > 1 ? `, for ${pa.program.sols} sols` : ''}. The dotted line shows only the first moves. Safety stop below 10% battery.`; return; }
  if (pa.error || !pa.actions.length) { el.textContent = ''; return; }
  const W = G.state.world, cost = {turn:1, scan:5, analyze:2, drill:8, dig:6, charge:-15};
  let use = 0; R.ghost.forEach(([x, y]) => { const t = MR.TER[W.ter[y*MW + x]]; let c2 = t.cost || 2; if ((r.perks||[]).includes('wide_wheels') && (t.sandy || t.hilly)) c2 = Math.max(2, c2 - 2); use += c2; });
  pa.actions.forEach(a => { if (a.type === 'left' || a.type === 'right') use += 1; else if (cost[a.type] != null) use += cost[a.type]; });
  const left = r.bat - use, end = planEnd(), home = end && !MR.onStation(G.state.map, end.x, end.y) ? MR.findPath(G.state, end, (x, y) => MR.onStation(G.state.map, x, y)) : [];
  const need = home ? home.length * 2 : 0;
  el.className = 'est' + (left < 0 ? ' bad' : left < need ? ' warn' : '');
  el.textContent = `Uses about ${Math.max(0, use)}% battery · ${R.ghost.length} square${R.ghost.length === 1 ? '' : 's'} · about ${Math.max(0, left)}% left` + (left < 0 ? '. Not enough power for all of it!' : left < need ? '. Not enough left to drive home after this.' : '');
}
let lastHover = null;
setInterval(() => { if (R.hoverPid !== lastHover) { lastHover = R.hoverPid; if (lastHover) { const s = R.screenOf(lastHover); if (s) showTip(lastHover, s.x, s.y); } else $('tip').hidden = true; } }, 120);

$('forceBtn').onclick = () => { if (G.mode === 'host' && G.ready) { log('warn', 'The host started the sol without waiting. Rovers without a plan stay put.'); maybeRun(true); } };
$('zoomIn').onclick = () => R.zoom(1.25);
$('zoomOut').onclick = () => R.zoom(.8);
$('centerBtn').onclick = () => { R.cam.follow = true; };
G.toggleBig = () => { document.body.classList.toggle('bigmap'); requestAnimationFrame(() => R.resize()); };
$('bigBtn').onclick = () => G.toggleBig();

/* After clicking a control on the game screen, give focus back so Enter sends the plan instead of re-clicking. */
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#palette button, #tabs button, #relayBar button, .mapbtns button, .cadet button, #prog button, #seq button, #nudges button, #finds button, #tapMenu button, #crewBar button');
  if (b && e.detail > 0) b.blur(); });
/* ---------- keyboard (game) ---------- */
let tabIdx = 0;
document.addEventListener('keydown', e => {
  if (G.phase === 'home' || G.phase === 'lobby' || $('scrGame').hidden || UI.modalOpen()) return;
  const typing = e.target.closest && e.target.closest('input,textarea,select');
  if (!typing && (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo(); return; }
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
  if (lk === 'h') { healthModal(); return; }
  if (k === '+' || k === '=') { R.zoom(1.2); return; } if (k === '-' || k === '_') { R.zoom(.83); return; }
  if (k === 'Enter') { e.preventDefault(); sendPlan(); return; }
  if (k === 'Backspace' && role !== 'specialist') { e.preventDefault(); if (!G.ready && G.phase === 'plan' && G.plan.length) { pushUndo(); const body = role === 'cadet' ? G.plan : curBody(), last = body[body.length-1];
    if (!last) { const f = locate(G.cursor); if (f) f.list.splice(f.i, 1); G.cursor = null; } else if (last.arg > 1 && !MR.BLOCKS[last.type]) last.arg--; else { body.pop(); if (G.cursor != null && !locate(G.cursor)) G.cursor = null; }
    renderPlan(); renderLock(); updateGhost(); } return; }
  const move = {w:'forward', ArrowUp:'forward', a:'left', ArrowLeft:'left', d:'right', ArrowRight:'right', s:'back', ArrowDown:'back', ' ':'drill'}[lk];
  const labKeys = {q:'catalog', 1:'make_water', 2:'make_metal', 3:'make_bricks', 4:'make_glass', 5:'build_solar_farm', 6:'build_radio_tower', 7:'build_garage', 8:'build_greenhouse'};
  const tool = (myRover() && myRover().job === 'lab') ? labKeys[lk] : {q:'scan', r:'analyze', g:'dig', c:'charge'}[lk];
  const cmd = move || tool;
  if (!cmd || !cmdsForMe().includes(cmd)) return;
  e.preventDefault(); addCmd(cmd);
});
})();
