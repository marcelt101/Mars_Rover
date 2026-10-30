/* The game controller: lobby, hosting/joining, planning, playback and rewards. */
(function () {
const MR = window.MR, UI = MR.UI, R = MR.Render, $ = UI.$, esc = UI.esc;
const {MW} = MR;

const G = MR.Game = {
  mode:null, net:null, code:null, myPid:null, phase:'home',
  lobby:{players:[], map:'jezero', unlocked:['jezero']},
  state:null, plan:[], ready:false, readyPids:[], plans:{}, drafts:{}, cid2pid:{},
  planInfo:null, contAfterWin:false, showCode:false, pending:[], lastPing:null, wake:null, lastSeen:{}, lastPong:0, chain:Promise.resolve(), markers:{},
  planSum:{}, replays:[], replaying:false, sessionMins:0,
  arrive:{}, left:{}, autoAt:null, autoLeft:null,
};
const me = () => MR.Store.current();
const myRover = () => G.state && G.state.rovers.find(r => r.pid === G.myPid);
const myRole = () => (myRover() || me() || {role:'explorer'}).role;
const isHostish = () => G.mode === 'solo' || G.mode === 'host';
const team = () => G.mode !== 'solo';
/* Code mode: Specialists always write Python; Explorers can switch to it from the Python tab ("Write my own"),
   and the choice is kept in their profile. */
const isCode = r => !!r && (r.role === 'specialist' || (r.role === 'explorer' && r.pid === G.myPid && !!(me() || {}).pyMode));

/* ---------- start-up ---------- */
$('fast').checked = MR.Store.settings.fast; $('sound').checked = MR.Store.settings.sound;
$('fast').onchange = e => { MR.Store.settings.fast = e.target.checked; MR.Store.save(); };
$('sound').onchange = e => { MR.Store.settings.sound = e.target.checked; MR.Store.save(); };
$('music').checked = MR.Store.settings.music !== false; $('musicVol').value = MR.Store.settings.musicVol ?? 35; $('musicVol').disabled = !$('music').checked;
$('music').onchange = e => { MR.Store.settings.music = e.target.checked; $('musicVol').disabled = !e.target.checked; MR.Store.save(); MR.music.start(); MR.music.refresh(); };
$('musicVol').oninput = e => { MR.Store.settings.musicVol = +e.target.value; MR.Store.save(); MR.music.refresh(); };
R.init($('map'), $('mini'), $('mapbox'));
const q = new URLSearchParams(location.search);
if (q.get('join')) $('joinCode').value = 'MARS-' + MR.cleanCode(q.get('join'));
UI.renderHome(); UI.show('scrHome');
/* First visit: the title screen shows a big "Create your crew member" button instead of opening the window. */
if (!MR.netAvailable()) { $('joinErr').hidden = false; $('joinErr').textContent = 'Team games need an internet connection to find each other. Solo play works offline.'; }
G.onProfileChanged = () => { if (G.phase === 'lobby') { refreshMyLobbyEntry(); } UI.renderMe(); };

$('homeBtn').onclick = () => { if (G.phase === 'lobby') leave(); };
$('soloBtn').onclick = () => { if (!me()) return; G.resume = null; G.noSave = false; G.lostCode = null; G.planSum = {}; G.mode = 'solo'; G.myPid = me().id; G.lobby = {players:[{...MR.playerSummary(me()), connected:true, host:true}], map:MR.Store.unlocked().slice(-1)[0], unlocked:MR.Store.unlocked()}; enterLobby(); };
$('hostBtn').onclick = () => { G.resume = null; G.noSave = false; startHost(); };
$('logBtn').onclick = () => MR.LogUI.calendar();
G.keepExploring = () => { G.contAfterWin = true; $('win').hidden = true; G.phase = 'plan'; renderGame(); saveExpedition(); };
/* Start a Mission Log day: solo goes to the lobby with the day's map; host opens a room for the day. */
G.startDay = (d, mode) => { const m = MR.missionOf(d), p = me(); if (!m || !p || !MR.edDayOk(d)) return;
  G.resume = null; G.noSave = false; G.lostCode = null;
  if (mode === 'host') { startHost(); G.lobby.map = m.map; G.lobby.day = d; broadcast(lobbyMsg()); renderLobby(); return; }
  G.mode = 'solo'; G.myPid = p.id; G.lobby = {players:[{...MR.playerSummary(p), connected:true, host:true}], map:m.map, day:d, unlocked:MR.Store.unlocked()}; enterLobby(); };
/* Continue a saved expedition. Solo goes straight back in; a team game opens a new room, and players who join
   with the same profile get their own rover back. */
$('resumeBtn').onclick = () => {
  const ex = MR.Store.expedition(), p = me(); if (!ex || !p) return;
  let st; try { st = MR.stateFromWire(ex.state); } catch (e) { UI.toast('!', '#ff7b6c', 'That save could not be loaded', 'Starting a new expedition is the only option.'); MR.Store.clearExpedition(); UI.renderHome(); return; }
  G.noSave = false;
  if (ex.mode === 'host') { G.resume = ex; startHost(); G.lobby.map = ex.map; renderLobby(); return; }
  G.resume = null; G.lostCode = null; G.mode = 'solo'; G.myPid = p.id;
  G.lobby = {players:[{...MR.playerSummary(p), connected:true, host:true}], map:ex.map, unlocked:MR.Store.unlocked()};
  if (!st.rovers.some(r => r.pid === p.id)) MR.addRover(st, G.lobby.players[0]);
  enterGame(st); G.contAfterWin = !!ex.keep; if (st.won && ex.keep) { G.phase = 'plan'; renderGame(); }
  log('good', `Welcome back! Your expedition continues on sol ${st.sol}.`);
};
let discardArmed = 0;
$('discardBtn').onclick = () => {
  if (Date.now() - discardArmed > 3000) { discardArmed = Date.now(); $('discardBtn').textContent = 'Tap again to delete the save'; setTimeout(() => $('discardBtn').textContent = 'Start over', 3000); return; }
  MR.Store.clearExpedition(); UI.renderHome();
};
function saveExpedition(){
  if (!isHostish() || !G.state || G.noSave) return;
  const st = G.state;
  MR.Store.saveExpedition({v:MR.VERSION, mode:G.mode, pid:G.myPid, map:st.map, sol:st.sol, won:!!st.won, keep:!!G.contAfterWin,
    names:st.rovers.map(r => r.name), at:Date.now(), state:MR.stateToWire(st)});
}
/* Tutorial: a normal solo game on a fixed, safe Jezero layout with a find 3 squares west of the rover. */
G.startTutorial = () => {
  const p = me(); if (!p) return;
  G.lostCode = null; G.mode = 'solo'; G.myPid = p.id; G.resume = null; G.noSave = true;
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
G.api = {toHost:m => toHost(m), msgRules:() => msgRules(), log:(kind, text) => log(kind, text), players:() => (G.lobby && G.lobby.players) || [], isTeam:() => G.mode === 'host' || G.mode === 'client',
  rulesChanged:() => { if (G.mode === 'host') { broadcast(lobbyMsg()); if (G.phase === 'plan') sendReady(); if (G.phase === 'lobby') renderLobby(); else { renderTeam(); $('chatRow').hidden = !team() || !msgRules().chat; } } },
  myRover:() => myRover(), planActions:() => planActions(), applyPlan:(a, rep) => applyPlan(a, rep), phase:() => G.phase, sol:() => G.state ? G.state.sol : 0, plan:() => G.plan,
  team:() => team(), me:() => me(), replay:k => replaySol(k), canReplay:() => G.phase === 'plan' && !G.ready && G.replays.length > 0};
$('joinBtn').onclick = () => joinGame($('joinCode').value);
$('joinCode').onkeydown = e => { if (e.key === 'Enter') joinGame($('joinCode').value); };

function leave(){
  if (G.net) { try { G.net.close(); } catch (e) {} }
  if (G.wake) { try { G.wake.release(); } catch (e) {} G.wake = null; }
  clearInterval(G.pingTimer);
  G.gen = (G.gen || 0) + 1;
  if (MR.Tutorial) MR.Tutorial.stop();
  Object.assign(G, {resume:null, chain:Promise.resolve(), mode:null, net:null, code:null, phase:'home', state:null, plan:[], ready:false, readyPids:[], plans:{}, drafts:{}, cid2pid:{}, pending:[]});
  document.body.classList.remove('bigmap');
  $('win').hidden = true; $('joinBtn').disabled = false; $('joinBtn').textContent = 'Join'; UI.renderHome(); UI.show('scrHome');
}

/* ---------- hosting ---------- */
function startHost(){
  const p = me(); if (!p) return;
  G.mode = 'host'; G.myPid = p.id; G.kicked = new Set(); G.code = MR.makeRoomCode(); G.hostErrShown = false; G.lostCode = null;
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
/* To one player: over the network, or straight to this device when it is the host's own player. */
const replyTo = (pid, m) => { if (pid === G.myPid) clientMessage(m); else send(pid, m); };
/* Message rules are the host's choice (Settings > Messages) and travel with the lobby. */
const msgRules = () => G.mode === 'client' ? {dm:!!G.lobby && G.lobby.dm !== false, chat:!!G.lobby && G.lobby.chat !== false} : {dm:MR.Store.settings.dmAllow !== false, chat:MR.Store.settings.chatAllow !== false};
const lobbyMsg = () => { const r = msgRules(); G.lobby.dm = r.dm; G.lobby.chat = r.chat; G.lobby.auto = MR.Store.settings.autoStart ?? 60; return {type:'lobby', lobby:G.lobby, code:G.code}; };
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
    stopReplay();
    const known = G.lobby.players.find(x => x.pid === pl.pid);
    if (G.kicked && G.kicked.has(pl.pid)) { G.net.send(cid, {type:'kicked'}); setTimeout(() => G.net.drop(cid), 300); return; }
    if (!known && G.lobby.players.length >= MR.MAX_PLAYERS) { G.net.send(cid, {type:'error', text:`This game already has ${MR.MAX_PLAYERS} players.`}); return; }
    G.cid2pid[cid] = pl.pid;
    if (known) Object.assign(known, {...pl, color:uniqueColor(pl), connected:true, host:known.host});
    else G.lobby.players.push({...pl, color:uniqueColor(pl), connected:true, host:false});
    MR.sfx.join();
    if (G.phase === 'lobby') { broadcast(lobbyMsg()); renderLobby(); return; }
    // joining or rejoining a running game
    const lp = G.lobby.players.find(x => x.pid === pl.pid);
    if (!G.state.rovers.some(r => r.pid === pl.pid)) { MR.addRover(G.state, lp); broadcast({type:'state', state:MR.stateToWire(G.state)}); setGameState(G.state); log('info', `${lp.name} joined the expedition.`); saveExpedition(); }
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
      G.plans[pid] = {actions:Array.isArray(m.actions) ? m.actions.slice(0, 60) : [], program:MR.validProgram(m.program) ? m.program : null, cancel:!!m.cancel, loop:!!m.loop};
      G.planSum[pid] = G.plans[pid].program ? ['program'] : G.plans[pid].actions.slice(0, 40).map(a => String(a.type).slice(0, 12));
      if (!G.readyPids.includes(pid)) G.readyPids.push(pid);
      { const r = G.state && G.state.rovers.find(q => q.pid === pid); G.arrive[pid] = Date.now() + (r && team() ? MR.uplinkMs(G.state, r) : 0); }
      sendReady(); renderTeam(); maybeRun(); break;
    case 'unready': G.readyPids = G.readyPids.filter(x => x !== pid); delete G.plans[pid]; delete G.planSum[pid]; delete G.arrive[pid]; sendReady(); renderTeam(); break;
    case 'claim': case 'rename': { const site = G.state && G.state.sites && G.state.sites[m.i]; if (!site || !lp) return;
      if (m.type === 'claim') site.claim = m.on ? pid : (site.claim === pid ? null : site.claim);
      else if (site.by === pid) site.name = String(m.name || '').replace(/[<>]/g, '').trim().slice(0, 22) || site.name;
      broadcast({type:'sites', sites:G.state.sites}); renderFinds(); break; }
    case 'marker': { if (!lp || !MR.inb(m.x|0, m.y|0)) return; const key = (m.x|0) + ',' + (m.y|0);
      if (m.kind && MARKS[m.kind]) G.markers[key] = {x:m.x|0, y:m.y|0, kind:m.kind, pid, name:lp.name, color:lp.color}; else delete G.markers[key];
      broadcast({type:'markers', markers:G.markers}); onMarkers(m.kind ? G.markers[key] : null, pid); break; }
    case 'draft': G.drafts[pid] = Array.isArray(m.path) ? m.path.slice(0, 60) : []; R.drafts = G.drafts; broadcast({type:'drafts', drafts:G.drafts}); break;
    case 'dm': {
      if (!lp || !msgRules().dm) { replyTo(pid, {type:'dmFail', text:'The host has turned messages off.'}); return; }
      const to = G.lobby.players.find(x => x.pid === m.to && x.connected && x.pid !== pid), text = String(m.text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, MR.DM_MAX).trim();
      if (!to || !text) return;
      const now = Date.now(); G.dmLast = G.dmLast || {};
      if (now - (G.dmLast[pid] || 0) < 1500) { replyTo(pid, {type:'dmFail', text:'Wait a moment before sending another message.'}); return; }
      G.dmLast[pid] = now;
      const d = {type:'dm', from:pid, to:to.pid, name:lp.name, color:lp.color, avatar:lp.avatar ?? null, toName:to.name, text};
      replyTo(to.pid, d); replyTo(pid, {...d, type:'dmSent'}); break; }
    case 'chat': { if (!msgRules().chat) return; const text = String(m.text||'').slice(0,120).trim(); if (!text || !lp) return; const c = {type:'chat', pid, name:lp.name, color:lp.color, text}; broadcast(c); showChat(c); break; }
  }
}
function playerGone(pid){
  const lp = G.lobby.players.find(x => x.pid === pid); if (!lp) return;
  if (G.phase === 'lobby') { G.lobby.players = G.lobby.players.filter(x => x.pid !== pid); broadcast(lobbyMsg()); renderLobby(); return; }
  lp.connected = false; broadcast(lobbyMsg()); log('warn', `${lp.name} lost connection. Their rover will wait.`); renderTeam(); maybeRun();
}
/* The host removes a player: they are told, disconnected and can not rejoin this room. In a running game their
   rover stays parked where it is, like an offline player's. */
function kickPlayer(pid){
  if (G.mode !== 'host' || pid === G.myPid) return;
  const lp = G.lobby.players.find(x => x.pid === pid); if (!lp) return;
  G.kicked.add(pid);
  Object.entries(G.cid2pid).forEach(([cid, p]) => { if (p === pid) { G.net.send(cid, {type:'kicked'}); delete G.cid2pid[cid]; setTimeout(() => G.net.drop(cid), 300); } });
  delete G.plans[pid]; G.readyPids = G.readyPids.filter(x => x !== pid);
  if (G.phase === 'lobby') { G.lobby.players = G.lobby.players.filter(x => x.pid !== pid); broadcast(lobbyMsg()); renderLobby(); }
  else { lp.connected = false; lp.kicked = true; broadcast(lobbyMsg()); broadcast({type:'ready', pids:G.readyPids, sums:G.planSum}); log('warn', `${lp.name} was removed from the game by the host.`); renderTeam(); maybeRun(); }
  UI.toast('✕', '#ff7b6c', `${lp.name} was removed`, 'They can not join this room again.', 3500);
}
/* Every player has their own transmitter: a plan leaves when its player presses Send and reaches Mars after that
   rover's signal delay. The sol starts when every plan has arrived, or (team games) when the host's auto-start
   time is up, counted from the first plan that arrived. */
const autoSecs = () => G.mode === 'client' ? (G.lobby.auto ?? 60) : (MR.Store.settings.autoStart ?? 60);
function sendReady(){
  if (G.mode !== 'host') return;
  const now = Date.now(), left = {};
  G.readyPids.forEach(pid => { left[pid] = Math.max(0, (G.arrive[pid] || 0) - now); });
  const firstArr = Math.min(...G.readyPids.map(pid => G.arrive[pid] || now));
  G.autoAt = autoSecs() && G.readyPids.length && G.state && G.state.rovers.length > 1 ? firstArr + autoSecs() * 1000 : null;
  G.left = left; G.leftAt = now; G.autoLeft = G.autoAt ? G.autoAt - now : null;
  broadcast({type:'ready', pids:G.readyPids, sums:G.planSum, left, auto:G.autoLeft});
}
setInterval(() => {
  if (!G.state || G.phase !== 'plan' || !team()) return;
  if (G.mode === 'host') { if (G.autoAt && Date.now() >= G.autoAt && G.readyPids.length) { log('info', 'Time is up: the sol starts. Rovers without a plan stay put.'); maybeRun(true); return; } maybeRun(); }
  renderTeam();
}, 500);
function maybeRun(force){
  if (!isHostish() || (G.phase !== 'plan' && !G.replaying)) return;
  const need = G.state.rovers.filter(r => { const lp = G.lobby.players.find(x => x.pid === r.pid); return lp && lp.connected; }).map(r => r.pid);
  const now = Date.now(), arrived = pid => G.readyPids.includes(pid) && (G.arrive[pid] || 0) <= now;
  if (!force && (!need.length || !need.every(arrived))) return;
  stopReplay();
  /* A forced or auto start also takes plans still on their way, so nobody loses a plan they sent. */
  const plans = G.plans; G.plans = {}; G.readyPids = []; G.drafts = {}; R.drafts = {}; G.planSum = {}; G.arrive = {}; G.autoAt = null;
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
    case 'state': stopReplay(); G.chain = G.chain.then(() => setGameState(MR.stateFromWire(m.state, G.state && G.state.world))).catch(e => console.error(e)); break;
    case 'sol': stopReplay(); G.chain = G.chain.then(() => playSol(m.timeline, MR.stateFromWire(m.state))).catch(e => console.error(e)); break;
    case 'ready': G.readyPids = m.pids || []; G.planSum = m.sums || {}; G.left = m.left || {}; G.leftAt = Date.now(); G.autoLeft = m.auto ?? null; renderTeam(); break;
    case 'drafts': G.drafts = m.drafts || {}; R.drafts = G.drafts; break;
    case 'sites': if (G.state) { G.state.sites = m.sites || {}; R.view && (R.view.sites = G.state.sites); renderFinds(); } break;
    case 'markers': { const before = Object.keys(G.markers).length; G.markers = m.markers || {}; const added = Object.values(G.markers).find(x => !G.lastMarkerKeys || !G.lastMarkerKeys.includes(x.x + ',' + x.y)); onMarkers(Object.keys(G.markers).length > before ? added : null, added && added.pid); break; }
    case 'chat': showChat(m); break;
    case 'kicked': G.lostCode = null; leave(); UI.toast('✕', '#ff7b6c', 'You left the game', 'The host removed you from this game.', 8000); break;
    case 'dm': MR.Msg.receive(m); break;
    case 'dmSent': MR.Msg.sent(m); break;
    case 'dmFail': UI.toast('✉', '#f0bf5a', 'Message not sent', m.text, 4000); break;
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
    $('qr').hidden = !host || !MR.ED.qr;
    $('roomHelp').innerHTML = host ? 'On the other devices, open this game, pick a profile, tap <b>Join</b> and type the code.' + (MR.ED.qr ? ' Or scan the QR code with the camera.' : '') : 'You are in! The host picks the map and starts the expedition.';
  }
  renderNet();
  const players = G.lobby.players;
  $('crewCount').textContent = `${players.length} / ${MR.MAX_PLAYERS}`;
  $('crewList').innerHTML = players.map(x => `<li>${UI.avatar(x)}<span class="who"><b>${esc(x.name)}${x.pid === G.myPid ? ' (you)' : ''}</b><small>${MR.ROLES[x.role].label} · ${MR.JOBS[x.job] ? MR.JOBS[x.job].label : ''} · ${MR.RANKS[x.rank|0].name}</small></span>${MR.Msg.can(x.pid) ? `<button class="btn dmb" data-dm="${esc(x.pid)}" aria-label="Send a message to ${esc(x.name)}">✉</button>` : ''}${host && !x.host ? `<button class="btn dmb kick" data-kick="${esc(x.pid)}" aria-label="Remove ${esc(x.name)} from the game" title="Remove from the game">✕</button>` : ''}${x.host ? '<span class="tag">Host</span>' : ''}<span class="dot ${x.connected ? '' : 'off'}" title="${x.connected ? 'Connected' : 'Offline'}"></span></li>`).join('');
  const mine = players.find(x => x.pid === G.myPid) || (p && MR.playerSummary(p));
  const airless = MR.MAPS[G.lobby.map] && MR.MAPS[G.lobby.map].airless;
  if (mine) $('jobPick').innerHTML = Object.entries(MR.JOBS).filter(([k, j]) => j.roles.includes(mine.role) && !(k === 'lab' && G.mode === 'solo')).map(([k, j]) => `<div class="jobw"><button class="job" data-job="${k}" aria-pressed="${k === mine.job}"><b>${j.label}</b><small>${esc(airless && k === 'heli' ? 'There is no air on the Moon, so helicopters can not fly there. On this map you drive the Buggy.' : j.desc)}</small></button><button class="jinfo" data-info="${k}" aria-label="About the ${j.label} rover" title="About this rover">i</button></div>`).join('');
  const unlocked = G.mode === 'client' ? G.lobby.unlocked : MR.Store.unlocked();
  if (G.mode !== 'client') G.lobby.unlocked = unlocked;
  $('mapPick').innerHTML = MR.MAP_ORDER.map(k => { const m = MR.MAPS[k], open = unlocked.includes(k);
    return `<button class="mapcard" data-map="${k}" aria-pressed="${k === G.lobby.map}" ${open && G.mode !== 'client' ? '' : 'disabled'}><b>${m.name}</b><small>${m.rover} · ${m.year}</small><p>${open ? esc(m.blurb) : !MR.edMapOk(k) ? 'In the full game.' : `Locked. Finish a ${MR.MAPS[m.unlock].name} expedition to unlock.`}</p></button>`; }).join('');
  const dm = G.lobby.day && MR.missionOf(G.lobby.day);
  $('mapNote').textContent = dm ? `Mission Log, day ${dm.day}: ${dm.title} (${MR.MAPS[dm.map].name}).` : G.mode === 'client' ? 'The host picks the map' : G.resume ? `Continuing your ${MR.MAPS[G.resume.map].name} expedition on sol ${G.resume.sol}. Rovers of players who don't join wait where they are.` : '';
  if (G.resume || dm) document.querySelectorAll('#mapPick .mapcard').forEach(b => b.disabled = true);
  $('startBtn').hidden = G.mode === 'client';
  $('startBtn').textContent = G.resume ? 'Continue expedition' : 'Start expedition';
  $('lobbyWait').textContent = G.mode === 'client' ? 'Waiting for the host to start…' : (host && players.length < 2 ? 'Waiting for players to join (you can also start alone).' : '');
}
function renderNet(){
  const t = G.mode === 'host' ? `Hosting · ${G.lobby.players.filter(x => x.connected).length} connected` : G.mode === 'client' ? (G.lastPing != null ? `Connected · ${G.lastPing} ms` : 'Connecting…') : 'Solo';
  $('netStatus').textContent = G.mode === 'host' && !G.net ? '' : t; $('gameNet').textContent = t;
}
$('crewList').onclick = e => { const b = e.target.closest('[data-dm]'); if (b) MR.Msg.compose(b.dataset.dm);
  const k = e.target.closest('[data-kick]'); if (k) { if (k.dataset.armed) kickPlayer(k.dataset.kick); else { k.dataset.armed = '1'; k.textContent = 'Remove?'; k.classList.add('danger'); setTimeout(() => { if (k.isConnected) { delete k.dataset.armed; k.textContent = '✕'; k.classList.remove('danger'); } }, 3000); } } };
$('jobPick').onclick = e => { const inf = e.target.closest('.jinfo'); if (inf) { UI.roverInfo(inf.dataset.info, MR.MAPS[G.lobby.map] && MR.MAPS[G.lobby.map].airless, null, G.lobby.map); MR.sfx.click(); return; }
  const b = e.target.closest('.job'); if (!b) return; const p = me(); p.job = b.dataset.job; MR.Store.save();
  if (G.mode === 'client') G.net.send({type:'job', job:p.job}); else hostHandle(G.myPid, {type:'job', job:p.job}); MR.sfx.click();
  if (G.mode === 'client') { const lp = G.lobby.players.find(x => x.pid === G.myPid); if (lp) lp.job = p.job; renderLobby(); } };
$('mapPick').onclick = e => { const b = e.target.closest('.mapcard'); if (!b || b.disabled || G.mode === 'client') return; G.lobby.map = b.dataset.map; broadcast(lobbyMsg()); renderLobby(); MR.sfx.click(); };
$('startBtn').onclick = () => {
  if (G.mode === 'client') return;
  const players = G.lobby.players.filter(x => x.connected), ex = G.resume;
  let st;
  if (ex) { st = MR.stateFromWire(ex.state); players.forEach(p => { if (!st.rovers.some(r => r.pid === p.pid)) MR.addRover(st, p); }); }
  else st = MR.newGame({map:G.lobby.map, seed:Math.floor(Math.random()*1e9), players, day:G.lobby.day || undefined});
  G.resume = null;
  G.plans = {}; G.readyPids = []; G.drafts = {}; G.arrive = {}; G.autoAt = null; G.left = {}; G.autoLeft = null;
  broadcast({type:'start', state:MR.stateToWire(st), lobby:G.lobby, code:G.code});
  enterGame(st);
  if (ex) { G.contAfterWin = !!ex.keep; log('good', `Welcome back! The expedition continues on sol ${st.sol}.`); }
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
  if (isCode(myRover()) && !$('editor').dataset.touched) $('editor').value = `from mars import rover\n\n# Scan around, then head out.\nrover.scan()\nfor i in range(2):\n    rover.forward(3)\nrover.analyze()\n`;
  R.resize(); R.cam.follow = true; setTimeout(() => R.focus(G.myPid, true), 30);
  renderGame(); updateGhost(); saveExpedition();
  if (st.camp && st.camp.i === 0 && st.sol === 1 && !G.noSave && myRole() !== 'cadet' && q.get('brief') !== '0') setTimeout(() => { if (!UI.modalOpen()) briefingModal(); }, 500);
}
function setGameState(st){
  G.state = st; MR.music.setWorld(st.map); MR.music.setStorm(st.wx && st.wx.storm);
  const r = myRover();
  R.setView(st, G.myPid, r ? r.role : 'explorer');
  if (G.phase === 'plan' || G.phase === 'won') renderGame();
}
function renderGame(){
  if (!G.state) return;
  const r = myRover(), role = r ? r.role : 'explorer', cadet = role === 'cadet', code = isCode(r);
  $('cadetPanel').hidden = !cadet; $('planPanel').hidden = cadet;
  $('tabs').hidden = code; $('editor').hidden = !code; $('prog').hidden = code || G.showCode; $('code').hidden = code || !G.showCode;
  $('planTitle').textContent = code ? "Today's program" : "Today's plan";
  $('howList').innerHTML = MR.HOW[role].map(h => `<li>${esc(h)}</li>`).join('');
  $('chatRow').hidden = !team() || !msgRules().chat;
  renderPyBar();
  renderPalette(); renderPlan(); renderHud(); renderSide(); renderCrewBar(); renderTeam(); renderLock(); renderNet(); computeHints(); renderNudges(); renderFinds(); renderWeather(); renderLab(); renderRelay();
}
/* Explorers: write Python instead of blocks, and back. Switching to Python starts from the blocks' own code. */
function renderPyBar(){
  const r = myRover(), p = me(), box = $('pyBar'); if (!r || r.role !== 'explorer' || r.job === 'lab' || !p) { box.hidden = true; return; }
  if (p.pyMode) box.innerHTML = `<span><b>You are writing Python.</b> The blocks below the editor still add lines for you.</span><button class="btn" id="pyBack">Back to blocks</button>`;
  else if (G.showCode) box.innerHTML = `<span>This is your plan in Python. Want to write it yourself?</span><button class="btn primary" id="pyGo">✎ Write my own Python</button>`;
  else { box.hidden = true; return; }
  box.hidden = false;
  if ($('pyGo')) $('pyGo').onclick = () => setPyMode(true);
  if ($('pyBack')) $('pyBack').onclick = () => setPyMode(false);
}
function setPyMode(on){
  const p = me(); if (!p || G.ready || G.phase !== 'plan') return;
  const start = on ? ($('code').textContent || '').replace(/^# Sol \d+ plan\n/, '').trim() : '';
  p.pyMode = on; p.tips = p.tips || {}; p.tips.py = true; MR.Store.save(); G.undo = [];
  if (on) { $('editor').value = (start.startsWith('from mars') ? start : 'from mars import rover\n\n' + start) + '\n'; $('editor').dataset.touched = '1'; G.plan = []; MR.sfx.click(); }
  else { G.showCode = false; $('tabBlocks').setAttribute('aria-selected', true); $('tabCode').setAttribute('aria-selected', false); }
  renderGame(); if (on) setTimeout(() => $('editor').focus(), 50);
}
/* Tips that point Explorers to programming at the right moment, a few times at most. */
function repeatTip(body){
  const p = me(), r = myRover(); if (!p || !r || r.role !== 'explorer' || p.pyMode) return;
  const t = body.map(c => c.type), n = t.length;
  const triple = n >= 3 && t[n-1] === t[n-2] && t[n-2] === t[n-3], pair = n >= 4 && t[n-1] === t[n-3] && t[n-2] === t[n-4] && t[n-1] !== t[n-2];
  if (!triple && !pair) return;
  p.tips = p.tips || {}; if ((p.tips.rep || 0) >= 3 || Date.now() - (G.lastRepTip || 0) < 60000) return;
  p.tips.rep = (p.tips.rep || 0) + 1; G.lastRepTip = Date.now(); MR.Store.save();
  UI.toast('⟲', '#b48ce8', 'Tip: use a Repeat block', 'Your plan repeats itself. A Repeat block (under Smart) does the same in one step. Programmers call it a loop.', 7000);
  const b = document.querySelector('.pal[data-b=repeat]'); if (b) { b.classList.add('coachring'); setTimeout(() => b.classList.remove('coachring'), 4000); }
}
function offerPython(){
  const p = me(), r = myRover(); if (!p || !r || r.role !== 'explorer' || p.pyMode || (p.tips && p.tips.py)) return;
  p.tips = p.tips || {}; p.tips.py = true; MR.Store.save();
  UI.openModal(`<div class="sh"><h2>Ready for Python?</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
    <p style="margin:0">You finished a whole map with blocks. Real rover teams write their plans as code. Want to try writing yours in <b>Python</b>, a real programming language?</p>
    <pre class="code" style="margin:0">from mars import rover\n\nfor i in range(3):\n    rover.forward(2)\n    rover.scan()</pre>
    <p class="muted" style="margin:0">This drives 2 squares and scans, 3 times. You can switch back to blocks any time from the plan panel.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Maybe later</button><button class="btn primary" id="pyYes">Try Python</button></div></div>`, true);
  $('pyYes').onclick = () => { UI.closeModal(); setPyMode(true); };
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
    <div class="row" style="justify-content:space-between;align-items:center"><p class="muted" style="margin:0;font-size:13px;flex:1">Tap a gauge to learn about it. Docking at the station charges the battery, cleans the panels and repairs the wheels for free.</p><button class="btn" id="healthAbout">About this rover</button></div></div>`);
  $('healthAbout').onclick = () => UI.roverInfo(r.job, MR.MAPS[st.map].airless, () => healthModal(), st.map);
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
  if (MR.Ops && power) { const lv = MR.Ops.levels(r); ['cBat','cTubes'].forEach((id, k) => { const l = lv[k ? 'tubes' : 'bat']; $(id).classList.toggle('alwarn', !!l && l.lvl === 'warn'); $(id).classList.toggle('albad', !!l && l.lvl === 'bad'); }); }
}
function renderSide(){
  const st = G.state, r = myRover(); if (!r) return;
  const C = MR.campaignOf(st), cadet = r.role === 'cadet';
  $('objTitle').textContent = C ? C.name : 'Objectives';
  $('goals').innerHTML = MR.goalProgress(st).map(g => { const o = MR.objectiveInfo(st, g);
    return `<li class="${g.done ? 'done' : ''} ${g.bonus ? 'bonus' : ''}"><span class="box">${g.done ? '✓' : ''}</span><span class="gt"><span class="t">${esc(cadet && o.kid ? o.kid : g.t)}</span>${!g.done && !cadet && o.what ? `<small class="what">${esc(o.what)}</small>` : ''}${g.done ? '' : goalHint(g, r)}${C && !cadet ? `<button class="whyb" data-why="${g.k}">Why?</button>` : ''}</span><span class="cnt">${Math.min(g.n, g.of)}/${g.of}</span></li>`; }).join('');
  $('solCount').textContent = `${C ? `${campLabel(st)} · ` : ''}Sol ${st.sol} · 3 stars by sol ${MR.parOf(st)}`;
  renderMission();
  if (r.role === 'cadet') $('tubes').innerHTML = `<span class="lbl">Team treasures: ${st.team.treasures}</span>`;
  else $('tubes').innerHTML = [...Array(MR.tubesOf(r))].map((_, i) => { const id = r.tubes[i]; return `<span class="tube" title="${id ? esc(MR.CARDS[id].name) : 'Empty tube'}">${id ? `<i style="background:${MR.CARDS[id].color}"></i>` : ''}</span>`; }).join('')
    + `<span class="lbl">${r.tubes.length ? `${r.tubes.length} on board` : 'Sample tubes'} · team delivered ${st.team.delivered}</span>`;
}
const COMPASS = ['east','south-east','south','south-west','west','north-west','north','north-east'];
const dirWord = (r, x, y) => COMPASS[(Math.round(Math.atan2(y - r.y, x - r.x) / (Math.PI/4)) + 8) % 8];
function goalHint(g, r){
  const st = G.state;
  if (g.kind === 'col' || g.kind === 'ident') {
    const a = MR.searchArea(st, g.res, r); if (!a) return '';
    const dist = Math.hypot(a.x - r.x, a.y - r.y), reg = MR.regionAt(st, Math.round(a.x), Math.round(a.y));
    const where = dist < 5 ? 'Scan around here' : `Try ${reg.startsWith('the ') ? reg : 'the ' + reg}, ${Math.round(dist)} squares ${dirWord(r, a.x, a.y)}`;
    return `<span class="hint">${esc(where)}<button class="showb" data-show="${g.res}">Show</button></span>`;
  }
  if (g.kind === 'deliver') return `<span class="hint">Drive onto the station with full tubes</span>`;
  if (g.kind === 'sites') return `<span class="hint">Scan to find signals. Each one gets a flag.</span>`;
  const H2 = {reach:`Drive to ${g.region}`, photos:'Add Photo (P) to your plan', smart:'Use an If block, or a sensor in Python', relay:'Turn on Run for 2 sols (or rover.mission(2))', loop:'Use a Repeat block, or a for loop in Python', free:'Add Back 1 to your plan', squares:'Every square driven counts', scans:'Add Scan (Q) to your plan'}[g.kind];
  if (H2) return `<span class="hint">${esc(H2)}</span>`;
  if (g.kind === 'treasure') return `<span class="hint">Look for the sparkly gems</span>`;
  return '';
}
/* Mission bar: the campaign and the objective to work on now, always at the top of the side panel. */
/* "Campaign 2 of 3", or "Mission Log day 5" for a day mission. */
const campLabel = st => st.camp && st.camp.day ? `Mission Log day ${st.camp.day}` : `Campaign ${st.camp.i + 1} of ${MR.campaignCount(st)}`;
function renderMission(){
  const st = G.state, r = myRover(), box = $('missionBar'); if (!st || !r) { box.innerHTML = ''; return; }
  const C = MR.campaignOf(st), cadet = r.role === 'cadet', gp = MR.goalProgress(st), cur = gp.find(g => !g.done && !g.bonus) || gp.find(g => !g.done);
  if (!cur) { box.innerHTML = ''; return; }
  const o = MR.objectiveInfo(st, cur), card = cur.res && MR.CARDS[cur.res];
  const pic = card ? `<span class="mgem" style="background:${card.color}"></span>` : `<span class="mgem ico">${cur.kind === 'deliver' ? '⌂' : cur.kind === 'sites' ? '?' : '★'}</span>`;
  box.innerHTML = `<div class="mb">${pic}<span class="mt">${C ? `<small>${campLabel(st)} · ${esc(C.name)}</small>` : '<small>Mission</small>'}<b>${esc(cadet && o.kid ? o.kid : cur.t)}</b>${!cadet && o.what ? `<span class="mw">${esc(o.what)}</span>` : ''}</span><span class="mp">${Math.min(cur.n, cur.of)}/${cur.of}</span>${C && !cadet ? '<button class="btn" id="briefBtn">Briefing</button>' : ''}</div>`;
  if ($('briefBtn')) $('briefBtn').onclick = () => briefingModal();
}
/* Briefing: the campaign story, the real mission it follows, and each objective with what, why and when it is done.
   After a campaign ends it opens with the debrief of the one just finished. */
function briefingModal(prev){
  const st = G.state, C = MR.campaignOf(st), r = myRover(); if (!C || !r || r.role === 'cadet') return;
  const spec = isCode(r), list = MR.CAMPAIGNS[st.map];
  const crit = g => g.kind === 'col' ? `Done when the team drills ${g.of} ${MR.CARDS[g.res].name.toLowerCase()}.` : g.kind === 'ident' ? `Done when Analyze (or a drill sample) identifies ${MR.CARDS[g.res].name.toLowerCase()}.`
    : g.kind === 'sites' ? `Done when ${g.of} new signals are flagged.` : g.kind === 'deliver' ? `Done when ${g.of} samples are delivered.` : '';
  const objs = MR.goalProgress(st).map(g => { const o = MR.objectiveInfo(st, g);
    return `<li class="${g.done ? 'done' : ''}"><b>${g.done ? '✓ ' : ''}${esc(g.t)}${g.bonus ? ' <i class="bonus">bonus</i>' : ''}</b><span>${esc(o.what || '')}</span><span class="why"><b>Why scientists want it:</b> ${esc(spec ? o.whyFull || o.why : o.why || '')}</span><small>${esc(crit(g))}</small>${g.res && MR.MINERALS[g.res] ? `<button class="mini-b wide" data-tablet="${g.res}">Mineral tablet</button>` : ''}</li>`; }).join('');
  modal(prev ? `Campaign complete: ${prev.name}` : C.name,
    (prev ? `<div class="debrief"><p>${esc(prev.debrief)}</p><small>Based on ${esc(prev.real)}.</small></div><h3 class="t">Next: ${esc(C.name)}</h3>` : '')
    + `<p class="real">${campLabel(st)} · based on ${esc(C.real)}</p><p>${esc(C.brief)}</p><ol class="brieflist">${objs}</ol>`
    + `<div class="row" style="justify-content:flex-end"><button class="btn primary" data-close>Let's go</button></div>`);
  document.querySelectorAll('[data-tablet]').forEach(b => b.onclick = () => UI.mineralTablet(b.dataset.tablet));
}
function objectiveModal(k){
  const st = G.state, g = MR.goalProgress(st).find(x => x.k === k), r = myRover(); if (!g || !r) return;
  const o = MR.objectiveInfo(st, g), spec = isCode(r);
  modal(g.t, `<p>${esc(o.what || '')}</p><p class="why"><b>Why scientists want it:</b> ${esc(spec ? o.whyFull || o.why : o.why || '')}</p>${g.res && MR.MINERALS[g.res] ? `<button class="btn" data-tablet="${g.res}">Open the ${esc(MR.CARDS[g.res].name)} tablet</button>` : ''}`);
  document.querySelectorAll('[data-tablet]').forEach(b => b.onclick = () => UI.mineralTablet(b.dataset.tablet));
}
$('goals').addEventListener('click', e => { const w = e.target.closest('[data-why]'); if (w) { objectiveModal(+w.dataset.why); return; } });
$('goals').addEventListener('click', e => { const b = e.target.closest('[data-show]'); if (!b) return;
  G.hintRes = b.dataset.show; computeHints(); const a = MR.searchArea(G.state, G.hintRes, myRover());
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
    if (g) { const a = MR.searchArea(st, g.res, myRover()); if (a) H.push({x:a.x, y:a.y, label:MR.CARDS[g.res].name, color:MR.CARDS[g.res].color, area:true, near:Math.hypot(a.x - r.x, a.y - r.y) < 5}); }
  }
  R.hints = H;
}
/* Where to go for the current objectives: a signal already identified as a needed mineral, or else an
   unidentified signal inside a needed mineral's search area (it never reveals what a "?" is). */
function objectiveTarget(st, r){
  const W = st.world, need = MR.goalProgress(st).filter(g => !g.done && g.res && (g.kind === 'col' || g.kind === 'ident')).sort((a, b) => a.bonus - b.bonus);
  let best = null;
  const consider = (i, res, known, bonus) => { const x = i % MW, y = (i / MW) | 0, d = Math.hypot(x - r.x, y - r.y);
    if (d > 18) return; const c = {x, y, d, res, known, objective:!bonus};
    if (!best || (best.objective !== c.objective ? c.objective : best.known !== known ? known : d < best.d)) best = c; };
  need.forEach(g => { const area = MR.searchArea(st, g.res, r);
    for (let i = 0; i < W.res.length; i++) { if (!W.sig[i] || W.drilled[i] || W.kid[i] || !W.res[i] || MR.CARDS[W.res[i]].artifact) continue;
      if (W.known[i]) { if (W.res[i] === g.res) consider(i, g.res, true, g.bonus); }
      else if (area && Math.hypot(i % MW - area.x, ((i / MW) | 0) - area.y) <= 4) consider(i, g.res, false, g.bonus); } });
  return best;
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
    // the current objective's mineral has already been spotted: offer a route there
    const tg = objectiveTarget(st, r);
    if (tg && tg.d > 0) out.push([tg.known ? `${MR.CARDS[tg.res].name} found ${Math.round(tg.d)} squares ${dirWord(r, tg.x, tg.y)}${tg.objective ? ', just what your objective needs' : ''}!` : `A mystery signal ${Math.round(tg.d)} squares ${dirWord(r, tg.x, tg.y)}, in the search area for ${MR.CARDS[tg.res].name.toLowerCase()}.`, tg.known ? 'Plan the route there' : 'Go and check it', 'target']);
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
  if (isCode(r)) {
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
    case 'target': { const tg = objectiveTarget(st, r); if (!tg) break; const i = tg.y*MW + tg.x;
      const p = MR.findPath(st, r, (x, y) => x === tg.x && y === tg.y);
      if (!p) { UI.toast('!', '#f0bf5a', 'No route found yet', 'Explore a bit more so the rover can see a way there.'); break; }
      const tail = (st.world.known[i] ? [] : [{type:'analyze'}]).concat([{type:'drill'}]);
      applyPlan(MR.pathToPlan(r, p, Math.max(1, Math.min(maxPlan(), 12) - tail.length)).concat(p.length <= 20 ? tail : []), true); break; }
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
    const acts = MR.pathToPlan(from, path, Math.max(1, maxPlan() - (isCode(myRover()) ? 0 : G.plan.length) - 2));
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
/* How long until a player's signal reaches Mars, from the host's last report. */
const sigLeft = pid => G.mode === 'host' ? Math.max(0, (G.arrive[pid] || 0) - Date.now()) : Math.max(0, ((G.left || {})[pid] || 0) - (Date.now() - (G.leftAt || 0)));
const autoLeftNow = () => G.mode === 'host' ? (G.autoAt ? G.autoAt - Date.now() : null) : G.autoLeft == null ? null : G.autoLeft - (Date.now() - (G.leftAt || 0));
function renderCrewBar(){
  if (!G.state) return;
  $('crewBar').innerHTML = G.state.rovers.map(r => {
    const lp = G.lobby.players.find(x => x.pid === r.pid), on = !lp || lp.connected, rd = G.readyPids.includes(r.pid);
    const ms = sigLeft(r.pid), status = lp && lp.kicked ? 'removed' : !on ? 'offline' : G.phase === 'run' ? 'driving' : rd ? (ms > 0 ? `📡 ${Math.ceil(ms / 1000)} s` : '✓ on Mars') : 'planning';
    return `<button class="cchip ${r.pid === G.myPid ? 'me' : ''}" data-pid="${r.pid}">${UI.avatar(r)}<span><b>${esc(r.name)}</b><small>${MR.JOBS[r.job].label}${r.role !== 'cadet' ? ` · ${r.bat}%` : ''}</small></span>${team() ? `<span class="rd ${rd ? 'ok' : ''}">${status}</span>` : ''}</button>`; }).join('');
}
$('crewBar').onclick = e => { const b = e.target.closest('.cchip'); if (!b) return; R.focus(b.dataset.pid, b.dataset.pid === G.myPid); showTip(b.dataset.pid);
  if (MR.Msg.can(b.dataset.pid) || canKick(b.dataset.pid)) { const rc = b.getBoundingClientRect(); roverMenu(b.dataset.pid, rc.left, rc.bottom - 8); } };
function renderTeam(){
  renderCrewBar(); $('chatRow').hidden = !team() || !msgRules().chat;
  if (!G.state) return;
  R.offline = new Set(team() ? G.lobby.players.filter(x => !x.connected).map(x => x.pid) : []);
  let t = '';
  if (G.phase === 'run') t = 'The rovers are carrying out their plans…';
  else if (G.phase === 'won' && !G.contAfterWin) t = 'Expedition complete!';
  else if (team()) {
    const waiting = G.state.rovers.filter(r => { const lp = G.lobby.players.find(x => x.pid === r.pid); return lp && lp.connected && !G.readyPids.includes(r.pid); });
    const flying = G.state.rovers.filter(r => G.readyPids.includes(r.pid) && sigLeft(r.pid) > 0), al = autoLeftNow();
    t = waiting.length ? `Waiting for: <b>${waiting.map(r => esc(r.name)).join(', ')}</b>` : flying.length ? 'Everyone has sent. Waiting for the signals to reach Mars…' : 'All plans are on Mars. Starting the sol…';
    if (waiting.length && al != null && al > 0) t += ` · the sol starts in <b>${Math.ceil(al / 1000)} s</b>`;
    if (G.ready) t = `<b>${sigLeft(G.myPid) > 0 ? 'Your signal is on its way.' : 'Your plan is on Mars.'}</b> ` + t;
  } else t = 'Plan your moves, then send them to Mars.';
  $('teamLine').innerHTML = t;
  $('forceBtn').hidden = !(G.mode === 'host' && G.phase === 'plan' && G.ready && G.state.rovers.length > 1);
  renderLock(); renderNudges();
}

/* palette + plans */
function cmdsForMe(){ const r = myRover(); return r ? MR.cmdsFor(r.role, r.job) : []; }
function maxPlan(){ const r = myRover(); if (!r) return 12; return r.role === 'cadet' ? MR.CADET_LEN(r.rank) : MR.ROLES[r.role].maxCmd; }
const KEYCAP = {forward:'W', left:'A', back:'S', right:'D', scan:'Q', analyze:'R', drill:'Space', dig:'G', charge:'C', photo:'P', catalog:'Q', make_water:'1', make_metal:'2', make_bricks:'3', make_glass:'4', build_solar_farm:'5', build_radio_tower:'6', build_garage:'7', build_greenhouse:'8'};
function renderPalette(){
  const have = cmdsForMe(), btn = (k, cls = '') => { const d = MR.CMDS[k];
    return `<button class="pal cat-${d.cat} ${cls}" data-c="${k}" aria-label="${d.label}${KEYCAP[k] ? ` (${KEYCAP[k]})` : ''}"><span class="ic" aria-hidden="true">${d.icon}</span><span class="lb">${d.label}</span><small>${d.cost}</small>${KEYCAP[k] ? `<span class="key">${KEYCAP[k]}</span>` : ''}</button>`; };
  const group = (label, keys, cls) => { const ks = keys.filter(k => have.includes(k)); return ks.length ? `<div class="pgroup ${cls||''}"><span class="pgl">${label}</span><div class="pbtns">${ks.map(k => btn(k)).join('')}</div></div>` : ''; };
  if (have.includes('catalog')) { $('palette').innerHTML = group('Lab', ['catalog','make_water','make_metal','make_bricks','make_glass']) + group('Build', ['build_solar_farm','build_radio_tower','build_garage','build_greenhouse']); return; }
  const relay = relayOK(), r = myRover(), code = r && isCode(r);
  const blk = k => { const b = MR.BLOCKS[k]; return `<button class="pal blk ${b.relay && !relay ? 'locked' : ''}" data-b="${k}" aria-label="${b.label}" title="${esc(b.desc)}${b.relay && !relay ? ' (needs the satellite relay kit)' : ''}" ${b.relay && !relay ? 'disabled' : ''}><span class="ic" aria-hidden="true">${b.icon}</span><span class="lb">${b.label}</span><small>${code ? 'Python' : 'holds blocks'}</small></button>`; };
  $('palette').innerHTML = `<div class="pgroup drive"><span class="pgl">Drive</span><div class="dpad">${btn('forward','up')}${btn('left','lf')}${btn('back','dn')}${btn('right','rt')}</div></div>`
    + group('Science', ['scan','analyze','drill','photo']) + group('Tools', ['dig']) + group('Power', ['charge'])
    + (relay ? group('Relay', ['go_signal','go_home']) : '')
    + `<div class="pgroup smart"><span class="pgl">${code ? 'Sensors' : 'Smart'}</span><div class="pbtns">${Object.keys(MR.BLOCKS).filter(k => relay || code ? true : k === 'repeat').map(blk).join('')}</div></div>`;
}
/* The satellite relay kit unlocks at the second rank (uses the live profile, so it works mid-expedition). */
function relayOK(){ const r = myRover(), p = me(), m = G.state && G.state.day && MR.missionOf(G.state.day);
  /* Unlocks at Rover Driver, or as soon as the first campaign of a map is done (so it shows up in normal play). */
  const camp = G.state && !G.state.day && G.state.camp && G.state.camp.i >= 1, exp = p && Object.values((p.stats || {}).exp || {}).some(v => v > 0);
  return !!r && r.role !== 'cadet' && r.job !== 'lab' && !!p && (MR.rankOf(p.xp) >= 1 || camp || exp || !!(m && m.week >= 4)); }
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
  const ok = relayOK(), canEdit = G.phase === 'plan' && !G.ready, P = r.prog, code = isCode(r);
  let h = '';
  if (P) h += `<div class="progcard"><span class="pi">⌁</span><span><b>Program running</b><small>Sol ${P.sols - P.solsLeft + 1} of ${P.sols}${P.name ? ' · ' + esc(P.name) : ''}. ${G.cancelProg ? 'It will be cancelled when you send.' : 'Send an empty plan to let it keep going, or make a new plan to replace it.'}</small></span><button class="btn" id="cancelProg" ${canEdit ? '' : 'disabled'}>${G.cancelProg ? 'Keep it' : 'Cancel program'}</button></div>`;
  h += `<div class="relayrow">`;
  if (ok && !code) h += `<button class="btn sol2 ${G.relaySols > 1 ? 'on' : ''}" id="sols2" ${canEdit ? '' : 'disabled'} aria-pressed="${G.relaySols > 1}" title="The relay satellite keeps your plan running the next sol too">⌁ Run for 2 sols${G.relaySols > 1 ? ' ✓' : ''}</button>`;
  h += `<button class="btn" id="recipesBtn" ${canEdit ? '' : 'disabled'}>Recipes</button>`;
  if (code) h += `<button class="btn" id="sensorsBtn">Sensors</button>`;
  if (!ok) { const p = me(); h += `<span class="relaylock">⌁ Satellite relay kit unlocks after this campaign, or at ${esc(MR.RANKS[1].name)}${p ? ` (${Math.max(0, MR.RANKS[1].xp - p.xp)} XP to go)` : ''}</span>`; }
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
  const r = myRover(); if (!r) return; const ok = relayOK(), code = isCode(r);
  modal('Mission recipes', `<p class="muted">Ready-made programs to start from. Pick one, then change it however you like.</p><div class="recipes">${MR.RECIPES.map(x => {
    const lock = x.relay && !ok;
    return `<button class="recipe" data-rec="${x.id}" ${lock ? 'disabled' : ''}><span class="ri">${x.icon}</span><span><b>${esc(x.name)}</b>${x.sols > 1 ? ' <i>2 sols</i>' : ''}<small>${esc(x.desc)}${lock ? ' Needs the satellite relay kit.' : ''}</small></span></button>`; }).join('')}</div>`
    + (code ? '' : `<p class="muted">Recipes replace today's plan. Undo brings it back.</p>`));
  document.querySelectorAll('[data-rec]').forEach(b => b.onclick = () => { const x = MR.RECIPES.find(q => q.id === b.dataset.rec); UI.closeModal(); useRecipe(x); });
}
function useRecipe(x){
  const r = myRover(); if (!r || G.ready || G.phase !== 'plan') return;
  pushUndo();
  if (isCode(r)) { $('editor').value = x.py; $('editor').dataset.touched = '1'; $('err').hidden = true; }
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
const FACE = ['north ↑', 'east →', 'south ↓', 'west ←'];
/* A plain sentence for each block, so a plan reads like instructions. */
function cmdText(c){
  const n = c.arg || 1, sq = n === 1 ? 'square' : 'squares';
  switch (c.type) {
    case 'forward': return `Drive ${n} ${sq} forward`;
    case 'back': return `Back up ${n} ${sq}`;
    case 'left': return 'Turn left';
    case 'right': return 'Turn right';
    case 'scan': return 'Scan for signals';
    case 'analyze': return 'Analyze the rock here';
    case 'drill': return 'Drill a sample';
    case 'dig': return 'Dig in front';
    case 'charge': return 'Charge the battery';
    case 'go_signal': return 'Drive to the nearest signal';
    case 'go_home': return 'Drive home to the station';
    case 'repeat': return `Repeat ${n} times`;
  }
  return MR.BLOCKS[c.type] ? MR.BLOCKS[c.type].label : (MR.CMDS[c.type] || {}).label || c.type;
}
/* The picture on a card: an arrow with the number of squares, a curved arrow for turns, or the tool icon. */
function cmdPic(c, d){
  if (c.type === 'forward' || c.type === 'back') return `<span class="mv">${c.type === 'forward' ? '↑' : '↓'}</span><b class="cnt">${c.arg || 1}</b>`;
  if (c.type === 'repeat') return `<span class="mv">⟲</span><b class="cnt">${c.arg}×</b>`;
  return d.icon;
}
/* Walk through the plan before it is sent: which way the rover will face and how much battery is left after
   each block, and warnings for known rocks, cliffs, sand traps or an empty battery. Smart blocks (If, Until,
   Go to signal) depend on what the rover finds, so everything after them is "decided on Mars". */
function planPreview(r){
  const st = G.state, W = st.world, out = {}, power = MR.usesPower(r), wide = (r.perks || []).includes('wide_wheels');
  let x = r.x, y = r.y, d = r.dir, bat = r.bat, unknown = false, halted = false;
  const cost = i => { const t = MR.TER[W.ter[i]]; let c = t.cost || 2; if (wide && (t.sandy || t.hilly)) c = Math.max(2, c - 2); return c; };
  const run = c => { let warn = null, use = 0;
    if (c.type === 'forward' || c.type === 'back') { const sg = c.type === 'forward' ? 1 : -1;
      for (let k = 0; k < (c.arg || 1); k++) { const nx = x + MR.DIRS[d][0]*sg, ny = y + MR.DIRS[d][1]*sg;
        if (!MR.inb(nx, ny)) { warn = 'The edge of the map is in the way'; halted = true; break; }
        const i = ny*MW + nx;
        if (r.job !== 'heli' && W.seen[i] && (MR.TER[W.ter[i]].block || W.obs[i])) { warn = MR.TER[W.ter[i]].block ? 'A cliff or the crater rim is in the way' : 'A rock is in the way'; halted = true; break; }
        use += r.job === 'heli' ? 2 : cost(i); x = nx; y = ny;
        if (W.trapSeen[i] && r.job !== 'heli' && r.job !== 'buggy' && r.job !== 'excavator') { warn = 'Drives into a known sand trap'; halted = true; break; } } }
    else if (c.type === 'left' || c.type === 'right') { d = (d + (c.type === 'right' ? 1 : 3)) % 4; use = 1; }
    else use = {scan:5, analyze:2, drill:8, dig:6, charge:-15}[c.type] || 0;
    if (power) { bat = Math.min(r.batMax, bat - use); if (bat < 0 && !warn) { warn = 'The battery runs out here'; halted = true; } }
    if (MR.onStation(st.map, x, y) && power) bat = r.batMax;
    return warn; };
  const walk = (list, prefix, record) => list.forEach((c, i) => { const key = prefix + i;
    if (unknown) { if (record) out[key] = {unknown:true}; if (c.body) walk(c.body, key + '.', record); return; }
    if (halted) { if (record) out[key] = {halted:true}; if (c.body) walk(c.body, key + '.', record); return; }
    const b = MR.BLOCKS[c.type];
    if (b && c.type === 'repeat') { for (let k = 0; k < c.arg && !halted; k++) walk(c.body, key + '.', record && k === 0); if (record) out[key] = {dir:d, bat:Math.max(0, Math.round(bat))}; return; }
    if (b || (MR.CMDS[c.type] && MR.CMDS[c.type].macro)) { unknown = true; if (record) out[key] = {unknown:true}; if (c.body) walk(c.body, key + '.', record); return; }
    const warn = run(c); if (record) out[key] = {dir:d, bat:Math.max(0, Math.round(bat)), warn}; });
  walk(G.plan, '', true);
  return out;
}
function renderPlan(){
  const r = myRover(); if (!r) return;
  if (r.role === 'cadet') {
    const n = maxPlan();
    $('seq').innerHTML = G.plan.map((c, i) => `<button class="pic ${c.state||''}" data-i="${i}" aria-label="Remove this step">${PIC[c.type]}</button>`).join('')
      + [...Array(Math.max(0, n - G.plan.length))].map(() => `<span class="pic slot"></span>`).join('');
    $('cadetCount').textContent = `${G.plan.length} / ${n}`;
    return;
  }
  if (isCode(r)) { $('count').textContent = `max ${MR.ROLES.specialist.maxCmd} moves`; return; }
  $('count').textContent = `${planCount()} / ${maxPlan()}`;
  const dis = G.ready || G.phase !== 'plan' ? 'disabled' : '';
  const pv = planPreview(r);
  const row = (c, key, n, depth) => { const b = MR.BLOCKS[c.type], d = b || MR.CMDS[c.type], open = b && G.cursor === key, info = pv[key] || {};
    const pad = depth ? ` style="--depth:${depth}"` : '';
    const argBtns = d.arg ? `<span class="arg"><button class="mini-b big" data-a="dec" aria-label="${b ? 'Fewer times' : 'Fewer squares'}" ${dis}>−</button><b>${c.arg}</b><button class="mini-b big" data-a="inc" aria-label="${b ? 'More times' : 'More squares'}" ${dis}>+</button></span>` : '';
    const sub = info.unknown ? 'Decided on Mars' : info.halted ? 'May not run (stops before this)' : `faces ${FACE[info.dir]}${MR.usesPower(r) ? ` · ${info.bat}% left` : ''}`;
    const num = c.state === 'done' ? '✓' : depth ? '' : n;
    return `<li class="cmd pstep ${b ? 'blk' : 'cat-' + d.cat} ${depth ? 'inb' : ''} ${open ? 'open' : ''} ${info.warn ? 'warn' : ''} ${info.halted ? 'halted' : ''} ${c.state||''}" data-i="${key}"${pad}>`
      + `<span class="drag" title="Drag to move" aria-hidden="true">⋮⋮</span><span class="num">${num}</span><span class="pic ic">${cmdPic(c, d)}</span>`
      + `<span class="ct">${b ? `<button class="lb blb" data-a="open" ${dis} title="${open ? 'Close this block' : 'Put new blocks inside'}">${esc(cmdText(c))}${open ? ' ▾' : ' ▸'}</button>` : `<span class="lb">${esc(cmdText(c))}</span>`}`
      + `<small class="${info.warn ? 'wtxt' : ''}">${esc(info.warn ? '⚠ ' + info.warn : sub)}</small></span>`
      + `${argBtns}<button class="mini-b big" data-a="del" aria-label="Remove" ${dis}>×</button></li>`; };
  const rows = [];
  const walk = (list, prefix, depth) => list.forEach((c, i) => { const key = prefix + i; rows.push(row(c, key, i + 1, depth));
    if (!c.body) return; walk(c.body, key + '.', depth + 1);
    const pad = ` style="--depth:${depth + 1}"`;
    if (G.cursor === key) rows.push(`<li class="drop inb"${pad}>${c.body.length ? 'New blocks go inside here.' : 'Now add blocks to go inside.'} <button class="mini-b wide" data-a="close" data-i="${key}" ${dis}>Done</button></li>`);
    else if (!c.body.length) rows.push(`<li class="drop inb"${pad}>Empty. Click ${esc(MR.BLOCKS[c.type].label)} to add blocks inside.</li>`);
    rows.push(`<li class="bend" style="--depth:${depth + 1}"><span>end of ${esc(cmdText(c).toLowerCase())}</span></li>`); });
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
  const keep = r.prog && !G.cancelProg && (isCode(r) ? !progTouched() : !G.plan.length);
  const label = G.phase === 'run' ? 'Rovers driving…' : G.phase === 'won' && !G.contAfterWin ? 'Done' : G.ready ? 'Change plan' : keep ? 'Keep program running' : empty ? 'Wait this sol' : team() ? 'Ready' : 'Send to Mars';
  $('sendBtn').textContent = label; $('sendBtn').disabled = G.phase !== 'plan' || (!G.ready && !hasPlan);
  $('goBtn').textContent = G.phase === 'run' ? '…' : G.ready ? 'WAITING' : 'GO!';
  $('goBtn').disabled = G.phase !== 'plan' || (!G.ready && !G.plan.length);
}
function planActions(){
  const r = myRover(); if (!r) return {actions:[]};
  if (isCode(r)) {
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
function pushUndo(){ const r = myRover(); G.undo = G.undo || []; G.undo.push(r && isCode(r) ? {code:$('editor').value} : {plan:JSON.parse(JSON.stringify(G.plan))}); if (G.undo.length > 40) G.undo.shift(); }
function undo(){ if (G.ready || G.phase !== 'plan' || !G.undo || !G.undo.length) return; const u = G.undo.pop();
  if (u.code != null) $('editor').value = u.code; else { G.plan = u.plan; G.cursor = null; } MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); renderNudges(); }
function addCmd(k){
  const r = myRover(); if (!r || G.phase !== 'plan' || G.ready) return;
  pushUndo();
  if (isCode(r)) return insertPy(k);
  const body = r.role === 'cadet' ? G.plan : curBody(), last = body[body.length - 1];
  if (r.role !== 'cadet' && last && last.type === k && (k === 'forward' || k === 'back') && last.arg < 20) {
    last.arg++; G.plan.forEach(c => c.state = ''); MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); return;
  }
  if ((r.role === 'cadet' ? G.plan.length : planCount()) >= maxPlan()) { MR.sfx.bump(); return; }
  G.plan.forEach(c => c.state = '');
  body.push({type:k, arg: MR.CMDS[k] && MR.CMDS[k].arg ? 1 : undefined});
  MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); repeatTip(body);
}
function addBlock(k){
  const r = myRover(), b = MR.BLOCKS[k]; if (!r || !b || G.phase !== 'plan' || G.ready || (b.relay && !relayOK())) return;
  pushUndo();
  if (isCode(r)) return insertPyLine(b.py(b.def || 3), true);
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
/* Drag a card by its ⋮⋮ handle to move it (within the same list: the plan, or inside one smart block). */
let dragKey = null;
$('prog').addEventListener('pointerdown', e => { const h = e.target.closest('.drag'), li = h && h.closest('.cmd'); if (!li || G.ready || G.phase !== 'plan') return;
  e.preventDefault(); dragKey = li.dataset.i; li.classList.add('dragging'); $('prog').setPointerCapture(e.pointerId); });
const parentOf = k => k.includes('.') ? k.slice(0, k.lastIndexOf('.')) : '';
$('prog').addEventListener('pointermove', e => { if (dragKey == null) return;
  document.querySelectorAll('#prog .dropover').forEach(x => x.classList.remove('dropover'));
  const el = document.elementFromPoint(e.clientX, e.clientY), li = el && el.closest('#prog .cmd');
  if (li && li.dataset.i !== dragKey && parentOf(li.dataset.i) === parentOf(dragKey)) li.classList.add('dropover'); });
$('prog').addEventListener('pointerup', e => { if (dragKey == null) return;
  const over = document.querySelector('#prog .dropover'), from = dragKey; dragKey = null;
  document.querySelectorAll('#prog .dragging').forEach(x => x.classList.remove('dragging'));
  if (!over) return; const a = locate(from), b = locate(over.dataset.i); if (!a || !b || a.list !== b.list) return;
  pushUndo(); const [c] = a.list.splice(a.i, 1); a.list.splice(b.i, 0, c); G.cursor = null; G.plan.forEach(p => p.state = ''); MR.sfx.click(); renderPlan(); renderLock(); updateGhost(); });
$('prog').addEventListener('pointercancel', () => { dragKey = null; renderPlan(); });
$('editor').addEventListener('keydown', e => {
  if (e.key === 'Tab') { e.preventDefault(); const ta = e.target, s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(ta.selectionEnd); ta.setSelectionRange(s+4, s+4); }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendPlan(); }
});
let pyTimer = null;
$('editor').addEventListener('input', e => { e.target.dataset.touched = '1'; $('err').hidden = true; clearTimeout(pyTimer); pyTimer = setTimeout(updateGhost, 250); });
$('clearBtn').onclick = () => { if (G.ready || G.phase !== 'plan') return; pushUndo(); if (isCode(myRover())) { $('editor').value = 'from mars import rover\n\n'; $('editor').dataset.touched = '1'; } else { G.plan = []; G.cursor = null; } renderPlan(); renderLock(); updateGhost(); };
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
  toHost({type:'plan', actions:pa.actions, program:pa.program || null, cancel:!!G.cancelProg && !pa.program, loop:!!(pa.info && pa.info.loops)});
  if (team()) uplink(true);
  if (pa.program && isCode(myRover())) $('editor').dataset.touched = '';
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
  if (isCode(r)) { if (idx != null && !skipped) { $('runLine').hidden = false; $('runLine').textContent = `Running line ${idx}`; } return; }
  G.plan.forEach((c, i) => { if (skipped) { if (i > idx) c.state = 'skipped'; } else c.state = i < idx ? 'done' : i === idx ? 'active' : (c.state === 'skipped' ? 'skipped' : ''); });
  renderPlan();
}
async function playEvent(ev){
  if (!G.state) return;
  const st = G.state, W = st.world, r = st.rovers.find(x => x.pid === ev.pid), a = r && R.anim[r.pid], mine = ev.pid === G.myPid;
  if (ev.msg && !G.replaying) log(ev.msg.k, ev.msg.text);
  if (mine && ev.idx != null && ev.t !== 'skip' && !G.replaying) markPlan(ev.idx);
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
      if (mine && ev.res !== 'basalt') MR.music.find();
      if (ev.treasure) st.team.treasures++;
      if (mine) MR.sfx.good(); break; }
    case 'nothing': if (ev.dust) R.addFx({type:'dust', x:r.x, y:r.y, dur:600, parts:MR.dustParts()}); if (ev.bat != null) r.bat = ev.bat; await wait(300); break;
    case 'dig': if (ev.i != null) { const [x, y] = cell(ev.i); R.addFx({type:'dust', x, y, dur:1100, parts:MR.dustParts()}); await wait(1000);
      if (ev.what === 'rock') W.obs[ev.i] = ''; if (ev.what === 'trap') { W.trap[ev.i] = 0; W.trapSeen[ev.i] = 0; } } r.bat = ev.bat; break;
    case 'charge': R.addFx({type:'sun', x:r.x, y:r.y, dur:1300}); await wait(1200); r.bat = ev.bat; break;
    case 'dock': r.bat = ev.bat; r.tubes = []; if (ev.wheels != null) r.wheels = ev.wheels; if (ev.dust != null) r.dust = ev.dust; if (mine && ev.n) MR.sfx.good(); break;
    case 'artifact': { const [x, y] = cell(ev.i); W.drilled[ev.i] = 1; W.known[ev.i] = 1; R.addFx({type:'confetti', x, y, dur:1600, parts:MR.confetti()}); MR.sfx.good(); await wait(500); break; }
    case 'skip': if (mine) markPlan(ev.idx, true); if (mine) log('warn', `${ev.n} remaining step${ev.n > 1 ? 's were' : ' was'} skipped for safety.`); break;
    case 'night': ev.charges.forEach(c => { const q2 = st.rovers.find(x => x.pid === c.pid); if (q2) { q2.bat = c.bat; if (c.dust != null) q2.dust = c.dust; } }); st.sol = ev.sol; if (ev.wx) { st.wx = ev.wx; MR.music.setStorm(ev.wx.storm); } R.view.wx = st.wx; await wait(250); break;
    case 'gust': case 'wx': break;
    case 'progstart': seen(ev.seen); if (r) r.prog = r.prog || {sols:ev.sols, solsLeft:ev.sols};
      if (ev.sols > 1) { R.addFx({type:'ring', x:r.x, y:r.y, dur:1800, r:7.5}); if (mine) MR.sfx.scan(); await wait(900); } break;
    case 'progstop': if (mine) MR.sfx.bump(); await wait(300); break;
    case 'progcont': case 'progend': case 'proginfo': break;
    case 'photo': r.bat = ev.bat; R.addFx({type:'ring', x:r.x, y:r.y, dur:500, r:1.2}); MR.sfx.click(); await wait(250);
      if (mine && !G.replaying) { const img = R.snapshot(r.pid, `NAVCAM · ${MR.MAPS[st.map].name.toUpperCase()} · SOL ${st.sol} · ${ev.place.toUpperCase()}`);
        const p = me(); if (img && p) { const ph = MR.Photos.add({data:img, map:st.map, sol:st.sol, place:ev.place, rover:r.name}); MR.Notebook.add(p, {kind:'photo', text:`Photo of ${ev.place}`, map:st.map, sol:st.sol, photo:ph && ph.id}); } }
      break;
    case 'campaign': if (!G.replaying) G.campDone = {i:ev.i, last:ev.last, map:st.map}; MR.sfx.good(); R.addFx({type:'confetti', x:r ? r.x + .5 : MR.MAPS[st.map].station.x, y:r ? r.y + .5 : MR.MAPS[st.map].station.y, dur:1600, parts:MR.confetti()}); await wait(500); break;
    case 'campnext': st.goals = ev.goals; st.camp = ev.camp; renderSide(); break;
    case 'catalog': if (st.lab) { st.lab.inbox = []; st.lab.catalog.push(...ev.entries); } MR.sfx.click(); await wait(500); break;
    case 'make': if (st.lab) st.lab.mat = ev.mats; await wait(600); break;
    case 'build': if (st.lab) { st.lab.mat = ev.mats; st.lab.built[ev.up] = true; } R.addFx({type:'confetti', x:MR.MAPS[st.map].station.x + .5, y:MR.MAPS[st.map].station.y + .5, dur:1600, parts:MR.confetti()}); MR.sfx.good(); await wait(800); break;
    case 'win': MR.sfx.win(); break;
    case 'spawn': ev.cells.forEach(c => { W.res[c.i] = c.res; W.kid[c.i] = 1; W.sig[c.i] = 1; W.known[c.i] = 1; seen(c.seen); W.seen[c.i] = 1; }); await wait(300); break;
    default: await wait(150);
  }
  renderHud();
}
/* Sol replay (like Open MCT's time conductor): play an earlier sol again on the map, then come back to now. */
/* A real sol arriving (or the host starting one) ends a replay at once, so play always continues from the live state. */
function stopReplay(){
  if (!G.replaying) return;
  G.replayAbort = true; G.replaying = false; G.state = G.replayCur; G.replayCur = null; R.running = false; $('runLine').hidden = true;
  G.phase = 'plan'; R.setView(G.state, G.myPid, myRole());
}
async function replaySol(k){
  const rp = G.replays[k]; if (!rp || G.phase !== 'plan' || G.ready) return;
  const gen = G.gen, cur = G.state; G.phase = 'replay'; G.replaying = true; G.replayAbort = false; G.replayCur = cur; renderLock();
  G.state = MR.stateFromWire(JSON.parse(JSON.stringify(rp.before))); R.running = false; R.setView(G.state, G.myPid, myRole()); R.running = true;
  $('runLine').hidden = false; $('runLine').textContent = `Replaying sol ${rp.sol}…`;
  try { for (const tick of rp.timeline) { await Promise.all(tick.map(playEvent)); if (gen !== G.gen || G.replayAbort) return; } } catch (e) { console.error(e); }
  if (gen !== G.gen || G.replayAbort) return;
  G.replaying = false; G.replayCur = null; R.running = false; $('runLine').hidden = true; G.state = cur; G.phase = 'plan';
  R.setView(cur, G.myPid, myRole()); renderGame(); updateGhost();
  if (isHostish()) maybeRun();
}
function uplink(own){
  if (!G.state) return Promise.resolve();
  const gen = G.gen;
  const r = myRover(), ms = MR.uplinkMs(G.state, r);
  $('uplink').hidden = false;
  $('ulSub').textContent = `${r ? MR.antennaName(r) : 'Stock antenna'}. Real signals take 4 to 24 minutes.` + (r && r.role !== 'cadet' && !(r.perks||[]).includes('hg_antenna') ? ' Radio and antenna perks make it faster.' : '');
  return new Promise(res => { const t0 = performance.now();
    (function step(t){ const k = ms ? Math.min(1, (t - t0) / ms) : 1;
      $('ulBar').style.width = (k*100) + '%';
      $('ulTitle').textContent = `Signal on its way to Mars… ${Math.max(0, Math.ceil((ms - (t - t0)) / 1000))} s`;
      if (own && (gen !== G.gen || !G.ready || G.phase !== 'plan')) { $('uplink').hidden = true; $('ulBar').style.width = '0'; res(); return; }
      if (k < 1) requestAnimationFrame(step); else { $('uplink').hidden = true; $('ulBar').style.width = '0'; if (own) MR.sfx.click(); res(); } })(t0); });
}
async function playSol(timeline, newState){
  const gen = G.gen;
  try { G.replays = (G.replays || []).concat([{sol:G.state.sol, before:MR.stateToWire(G.state), timeline}]).slice(-3); } catch (e) {}
  G.solPlayed = G.state.sol; G.solStorm = !!(G.state.wx && G.state.wx.storm); G.phase = 'run'; G.ready = false; if (!isHostish()) G.readyPids = []; R.running = true; R.ghost = []; R.drafts = {}; G.drafts = {};
  renderTeam(); renderPlan();
  if (!team()) await uplink();
  if (gen !== G.gen) return;
  MR.music.setMode('drive');
  R.cam.follow = true;
  for (const tick of timeline) { await Promise.all(tick.map(playEvent)); if (gen !== G.gen) return; renderSide(); renderCrewBar(); }
  R.running = false; $('runLine').hidden = true; MR.music.setMode('plan');
  setGameState(newState); saveExpedition();
  const won = timeline.some(t => t.some(e => e.t === 'win'));
  if (won && !newState.day) setTimeout(() => { if (!UI.modalOpen()) offerPython(); else G.pyOfferLater = true; }, 4000);
  const p = me();
  if (p) {
    const code = myRole() === 'cadet' ? null : codeReview(timeline.flat().filter(e => e.pid === G.myPid), G.planInfo, newState);
    const notices = MR.applyRewards(p, G.myPid, timeline.flat(), {map:newState.map, players:newState.rovers.length, planInfo:G.planInfo, code, storm:G.solStorm, greenhouse:!!(newState.lab && newState.lab.built.greenhouse), day:newState.day});
    renderSolCard(timeline.flat().filter(e => e.pid === G.myPid), newState, code);
    UI.notify(notices, myRole() === 'cadet');
    notices.filter(n => (n.k === 'card' || n.k === 'shiny') && MR.CARDS[n.id]).forEach(n => MR.Notebook.add(p, {kind:'find', text:`Found ${MR.CARDS[n.id].name}${n.k === 'shiny' ? ' (shiny!)' : ''}`, map:newState.map, sol:G.solPlayed, card:n.id}));
    if (G.campDone) { const C = MR.campaignOf({...newState, camp:{...newState.camp, i:G.campDone.i}}) || null; if (C) MR.Notebook.add(p, {kind:'campaign', text:`Campaign complete: ${C.name}`, map:newState.map, sol:G.solPlayed}); }
  }
  G.planInfo = null;
  const mineEv = timeline.flat().filter(e => e.pid === G.myPid);
  const found = mineEv.some(e => e.t === 'drill' || e.t === 'artifact' || (e.t === 'scan' && e.sigs.length) || (e.t === 'analyze' && e.cells.length) || (e.t === 'dock' && e.n) || (e.t === 'move' && e.sigs && e.sigs.length));
  G.dull = found ? 0 : (G.dull || 0) + 1;
  if (won && !newState.day) {
    const next = MR.MAP_ORDER.filter(k => MR.MAPS[k].unlock === newState.map);
    if (MR.Store.unlock(next)) next.filter(MR.edMapOk).forEach(k => UI.toast('★', '#58cfbe', `New map unlocked: ${MR.MAPS[k].name}`, 'The whole team can explore it now.', 7000));
    if (isHostish()) G.lobby.unlocked = MR.Store.unlocked();
  }
  G.plan.forEach(c => c.state = '');
  if (myRole() !== 'specialist' && G.plan.length) { G.undo = G.undo || []; G.undo.push({plan:JSON.parse(JSON.stringify(G.plan.map(c => ({type:c.type, arg:c.arg, body:c.body}))))}); G.plan = []; }
  G.cursor = null; G.relaySols = 1; G.cancelProg = false;
  G.phase = newState.won && !G.contAfterWin ? 'won' : 'plan';
  renderGame(); updateGhost();
  if (won) showWin(newState);
  else if (G.campDone && !G.campDone.last && q.get('brief') === '0') G.campDone = null;
  else if (G.campDone && !G.campDone.last) { const prev = MR.CAMPAIGNS[newState.map][G.campDone.i]; G.campDone = null; if (myRole() !== 'cadet') setTimeout(() => { if (!UI.modalOpen()) briefingModal(prev); }, 400); }
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
  if (st.day && MR.LogUI) { $('win').hidden = true; G.campDone = null; MR.LogUI.dayDone(st); return; }
  const par = MR.parOf(st), s = st.sol <= par ? 3 : st.sol <= Math.ceil(par*1.5) ? 2 : 1;
  $('winStars').innerHTML = '★'.repeat(s) + `<i>${'★'.repeat(3-s)}</i>`;
  const lastC = st.camp && MR.CAMPAIGNS[st.map][st.camp.i]; G.campDone = null;
  $('winText').textContent = (lastC && myRole() !== 'cadet' ? lastC.debrief + ' ' : '') + `${MR.MAPS[st.map].name} explored on sol ${st.sol} with ${st.team.score} science points${st.team.treasures ? ` and ${st.team.treasures} treasures` : ''}. Press I to see what you collected.`;
  $('againBtn').hidden = G.mode === 'client';
  $('againBtn').textContent = 'New expedition';
  $('win').hidden = false;
}
$('keepBtn').onclick = () => { G.contAfterWin = true; $('win').hidden = true; G.phase = 'plan'; renderGame(); saveExpedition(); };
$('againBtn').onclick = () => { if (G.mode === 'client') return; if (!G.noSave) MR.Store.clearExpedition(); G.state = null; broadcast({type:'toLobby', lobby:G.lobby}); enterLobby(); };
let leaveArmed = 0;
$('leaveGameBtn').onclick = () => {
  if (Date.now() - leaveArmed > 3000) { leaveArmed = Date.now(); $('leaveGameBtn').textContent = G.noSave ? 'Tap again to leave' : G.mode === 'host' ? 'Tap again: ends the game for everyone (it is saved)' : G.mode === 'solo' ? 'Tap again to leave (it is saved)' : 'Tap again to leave'; setTimeout(() => $('leaveGameBtn').textContent = 'Leave game', 3000); return; }
  leave();
};

/* Play time for the parent page, and a gentle break reminder after the chosen number of minutes. */
setInterval(() => {
  const p = me(); if (!p || document.hidden || $('scrGame').hidden) return;
  p.stats.minutes = (p.stats.minutes || 0) + 1; const d = new Date().toISOString().slice(0, 10);
  p.daily = p.daily || {}; p.daily[d] = (p.daily[d] || 0) + 1; G.sessionMins++;
  const brk = MR.Store.settings.breakMins ?? 60;
  if (brk && G.sessionMins === brk) UI.toast('☕', '#f0bf5a', 'Time for a break', `You have played for ${brk} minutes. Mission Control says: stretch, rest your eyes, and come back later. Your expedition is saved.`, 12000);
  MR.Store.save();
}, 60000);
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
    + (MR.Msg.can(pid) ? '<small style="color:var(--signal)">✉ Tap or right-click to send a message</small>' : '') + (r.stuck ? '<small style="color:var(--bad)">Stuck in sand</small>' : '') + (lp && !lp.connected ? '<small style="color:var(--bad)">Offline</small>' : '');
  $('tip').style.left = Math.max(90, Math.min(innerWidth - 90, pos.x)) + 'px'; $('tip').style.top = Math.max(70, pos.y) + 'px'; $('tip').hidden = false;
  clearTimeout(tipTimer); tipTimer = setTimeout(() => $('tip').hidden = true, 3500);
}
R.onTapRover = (pid, x, y) => { $('tapMenu').hidden = true; if (pid) { showTip(pid, x, y); if (MR.Msg.can(pid) || canKick(pid)) roverMenu(pid, x, y); } else $('tip').hidden = true; };
/* Right-click (or tap) on another player's rover: send them a message. */
R.onRoverMenu = (pid, x, y) => { if (MR.Msg.can(pid) || canKick(pid)) { showTip(pid, x, y); roverMenu(pid, x, y); } };
const canKick = pid => G.mode === 'host' && pid !== G.myPid && G.lobby.players.some(x => x.pid === pid && !x.kicked);
function roverMenu(pid, x, y){
  const lp = G.lobby.players.find(q => q.pid === pid), menu = $('tapMenu'); if (!lp) return;
  menu.innerHTML = (MR.Msg.can(pid) ? `<button data-dm="${esc(pid)}">✉ Send a message to ${esc(lp.name)}</button>` : '')
    + (G.mode === 'host' && pid !== G.myPid && !lp.kicked ? `<button data-kick="${esc(pid)}">✕ Remove ${esc(lp.name)} from the game</button>` : '');
  if (!menu.innerHTML) return;
  menu.hidden = false; menu.style.left = Math.min(innerWidth - menu.offsetWidth - 10, x + 8) + 'px'; menu.style.top = Math.min(innerHeight - menu.offsetHeight - 10, y + 16) + 'px';
}
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
  const kb = e.target.closest('[data-kick]');
  if (kb) { if (kb.dataset.armed) { $('tapMenu').hidden = true; kickPlayer(kb.dataset.kick); } else { kb.dataset.armed = '1'; kb.textContent = 'Tap again to remove for good'; kb.classList.add('danger'); } return; }
  const dm = e.target.closest('[data-dm]'); if (dm) { $('tapMenu').hidden = true; $('tip').hidden = true; MR.Msg.compose(dm.dataset.dm); return; }
  const b = e.target.closest('[data-tap]'); if (!b) return; const m = $('tapMenu'), x = +m.dataset.x, y = +m.dataset.y, a = b.dataset.tap; m.hidden = true;
  if (a.startsWith('mark:')) { toHost({type:'marker', x, y, kind:a.slice(5) || null}); return; }
  const st = G.state, from = planEnd(); if (!from) return;
  const path = MR.findPath(st, from, a === 'home' ? (px, py) => MR.onStation(st.map, px, py) : (px, py) => px === x && py === y);
  if (!path) { UI.toast('!', '#f0bf5a', 'No route found', 'The rover can not see a safe way there yet.'); return; }
  const room = maxPlan() - (isCode(myRover()) ? 0 : G.plan.length);
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
$('opsBtn').onclick = () => MR.Ops.open();

/* After clicking a control on the game screen, give focus back so Enter sends the plan instead of re-clicking. */
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#palette button, #opsBtn, #tabs button, #relayBar button, #goals button, #missionBar button, .mapbtns button, .cadet button, #prog button, #seq button, #nudges button, #finds button, #tapMenu button, #crewBar button');
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
  if (lk === 'o' && MR.Ops) { MR.Ops.open(); return; }
  if (k === '+' || k === '=') { R.zoom(1.2); return; } if (k === '-' || k === '_') { R.zoom(.83); return; }
  if (k === 'Enter') { e.preventDefault(); sendPlan(); return; }
  if (k === 'Backspace' && role !== 'specialist') { e.preventDefault(); if (!G.ready && G.phase === 'plan' && G.plan.length) { pushUndo(); const body = role === 'cadet' ? G.plan : curBody(), last = body[body.length-1];
    if (!last) { const f = locate(G.cursor); if (f) f.list.splice(f.i, 1); G.cursor = null; } else if (last.arg > 1 && !MR.BLOCKS[last.type]) last.arg--; else { body.pop(); if (G.cursor != null && !locate(G.cursor)) G.cursor = null; }
    renderPlan(); renderLock(); updateGhost(); } return; }
  const move = {w:'forward', ArrowUp:'forward', a:'left', ArrowLeft:'left', d:'right', ArrowRight:'right', s:'back', ArrowDown:'back', ' ':'drill'}[lk];
  const labKeys = {q:'catalog', 1:'make_water', 2:'make_metal', 3:'make_bricks', 4:'make_glass', 5:'build_solar_farm', 6:'build_radio_tower', 7:'build_garage', 8:'build_greenhouse'};
  const tool = (myRover() && myRover().job === 'lab') ? labKeys[lk] : {q:'scan', r:'analyze', g:'dig', c:'charge', p:'photo'}[lk];
  const cmd = move || tool;
  if (!cmd || !cmdsForMe().includes(cmd)) return;
  e.preventDefault(); addCmd(cmd);
});
})();
