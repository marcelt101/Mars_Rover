/* Run with: node tools/playtest-bots.js  (prints pacing and stuck metrics for robot players) */
/* Robot playtesters for Mars Rover Ops. Uses the real game rules (data, world, sim, profile). */
global.window = global; global.location = {search:''};
const mem = {}; global.localStorage = {getItem:k => mem[k] ?? null, setItem:(k,v) => { mem[k] = v; }};
global.btoa = s => Buffer.from(s, 'binary').toString('base64'); global.atob = s => Buffer.from(s, 'base64').toString('binary');
const fs = require('fs');
for (const f of ['data','world','sim','profile']) eval(fs.readFileSync(require('path').join(__dirname, '../game/js', f + '.js'),'utf8'));
const MR = window.MR, {MW, MH, DIRS} = MR;
MR.Store.save = () => {};

/* Time model in seconds, with improvement 5 (driving at half speed). */
const PLAN = {cadet:18, novice:40, guided:40, good:30}, UPLINK = 7.5;
const DUR = {move:.76, slow:1.1, turn:.56, bump:.4, stuck:.4, scan:1.0, analyze:1.0, drill:1.3, nothing:.3, dig:1.0, charge:1.2, dock:.1, artifact:.5, skip:0, night:.25, win:0, free:0, lowpower:.2, spawn:.3};

function passable(st, r, x, y, assumeUnseen){
  if (!MR.inb(x,y)) return false; const i = y*MW+x, W = st.world;
  if (r.job === 'heli') return true;
  if (!W.seen[i]) return assumeUnseen;
  if (MR.TER[W.ter[i]].block || W.obs[i]) return false;
  if (W.trapSeen[i]) return false;
  return true;
}
function bfs(st, r, goal){ // goal(x,y) -> bool; returns path of [x,y]
  const prev = new Map(), start = r.y*MW+r.x, q = [start]; prev.set(start, -1);
  while (q.length) { const c = q.shift(), x = c % MW, y = (c/MW)|0;
    if (c !== start && goal(x,y)) { const p = []; let k = c; while (k !== start) { p.unshift([k % MW, (k/MW)|0]); k = prev.get(k); } return p; }
    for (const [dx,dy] of DIRS) { const nx = x+dx, ny = y+dy, n = ny*MW+nx;
      if (!prev.has(n) && passable(st, r, nx, ny, true)) { prev.set(n, c); q.push(n); } } }
  return null;
}
function pathToActions(r, path, maxCmd, single){
  const acts = []; let d = r.dir, x = r.x, y = r.y;
  for (const [nx, ny] of path) {
    const want = DIRS.findIndex(([dx,dy]) => dx === nx-x && dy === ny-y);
    const diff = (want - d + 4) % 4;
    if (diff === 1) acts.push({type:'right'}); else if (diff === 3) acts.push({type:'left'}); else if (diff === 2) { acts.push({type:'right'}); acts.push({type:'right'}); }
    d = want; x = nx; y = ny;
    const last = acts[acts.length-1];
    if (!single && last && last.type === 'forward') last.arg++; else acts.push({type:'forward', arg:1});
    if (acts.length >= maxCmd) break;
  }
  return acts.slice(0, maxCmd);
}
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

/* Cadet: aims for the nearest visible gem but makes mistakes like a 5-year-old (20% wrong taps). */
function cadetPlan(st, r){
  const W = st.world, max = MR.CADET_LEN(r.rank);
  const here = r.y*MW+r.x;
  if (W.res[here] && W.sig[here] && !W.drilled[here]) return [{type:'drill'}];
  const path = bfs(st, r, (x,y) => { const i = y*MW+x; return W.res[i] && W.sig[i] && W.seen[i] && !W.drilled[i] && !MR.CARDS[W.res[i]].artifact; });
  let acts = path ? pathToActions(r, path, max - 1, true) : [];
  if (!path) acts = [...Array(max)].map(() => ({type:['forward','forward','left','right'][Math.floor(rnd()*4)]}));
  acts = acts.map(a => rnd() < .2 ? {type:['forward','left','right'][Math.floor(rnd()*3)]} : a);
  if (path && path.length <= acts.filter(a => a.type === 'forward').length) acts.push({type:'drill'});
  return acts.slice(0, max);
}
/* Beginner Explorer: drives in a direction, scans, drills when something is under it, sometimes forgets things. */
let GUIDED = false;
function novicePlan(st, r){
  const W = st.world, here = r.y*MW+r.x, acts = [];
  if (r.stuck) return [{type:'back', arg:1}];
  if (W.res[here] && W.sig[here] && !W.drilled[here]) { if (!W.known[here]) acts.push({type:'analyze'}); acts.push({type:'drill'}); }
  if (r.tubes.length >= 3 || r.bat < 30) { const p = bfs(st, r, (x,y) => MR.onStation(st.map, x, y)); if (p) return acts.concat(pathToActions(r, p, 10)); }
  const sig = bfs(st, r, (x,y) => { const i = y*MW+x; return W.sig[i] && !W.drilled[i] && W.res[i] && !MR.CARDS[W.res[i]].artifact; });
  if (sig && rnd() < .6) return acts.concat(pathToActions(r, sig.slice(0, 8), 8));
  if (GUIDED) { const g = MR.goalProgress(st).find(q => !q.done && q.kind === 'col'), a = g && MR.searchArea(st, g.res);
    if (a && Math.hypot(a.x - r.x, a.y - r.y) > 3 && rnd() < .8) { const p = bfs(st, r, (x, y) => Math.hypot(x - a.x, y - a.y) < 3); if (p) return acts.concat(pathToActions(r, p.slice(0, 9), 8), [{type:'scan'}]); } }
  acts.push({type:'scan'});
  acts.push({type: rnd() < .5 ? 'left' : 'right'}, {type:'forward', arg:2 + Math.floor(rnd()*5)});
  if (rnd() < .5) acts.push({type:'scan'});
  return acts;
}
/* Good Explorer: targets the most valuable known signals, analyzes first, skips basalt, goes home when full or low. */
function goodPlan(st, r){
  const W = st.world, here = r.y*MW+r.x, acts = [], max = 12;
  if (r.stuck) return [{type:'back', arg:1}, {type:'scan'}];
  if (W.res[here] && W.sig[here] && !W.drilled[here] && !MR.CARDS[W.res[here]].artifact) {
    if (!W.known[here]) return [{type:'analyze'}, {type:'drill'}];
    if (W.res[here] !== 'basalt') acts.push({type:'drill'});
  }
  const need = new Set(MR.goalProgress(st).filter(g => !g.done && g.kind === 'col').map(g => g.res));
  if (r.tubes.length >= MR.tubesOf(r) - 1 || r.bat < 35 || (r.tubes.length && !need.size)) { const p = bfs(st, r, (x,y) => MR.onStation(st.map, x, y)); if (p) return acts.concat(pathToActions(r, p, max - acts.length)); }
  const want = (x,y) => { const i = y*MW+x; if (!W.sig[i] || W.drilled[i] || !W.res[i] || MR.CARDS[W.res[i]].artifact) return false; if (W.known[i]) return W.res[i] !== 'basalt' && (need.has(W.res[i]) || need.size === 0 || MR.CARDS[W.res[i]].rar !== 'C'); return true; };
  const sig = bfs(st, r, want);
  if (sig && sig.length < 25) { const a = acts.concat(pathToActions(r, sig, max - 3 - acts.length)); a.push({type:'analyze'}, {type:'drill'}); return a; }
  // explore toward the region with the needed minerals (delta is west, Séítah south-west)
  const unseen = bfs(st, r, (x,y) => { let c = 0; for (let dy=-2;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) if (MR.inb(x+dx,y+dy) && !W.seen[(y+dy)*MW+x+dx]) c++; return c > 12; });
  if (unseen) return acts.concat(pathToActions(r, unseen.slice(0, 10), max - 2 - acts.length), [{type:'scan'}]);
  return acts.concat([{type:'scan'}, {type:'forward', arg:4}]);
}

const freshProfile = (role) => ({id:'bot', name:'Bot', color:'teal', role, job:MR.defaultJob(role), xp:0, cards:{}, patches:{}, perks:[], stats:{squares:0, flown:0, samples:0, delivered:0, scans:0, identified:0, stuck:0, freed:0, bumps:0, treasures:0, cleared:0, loops:0, clean:0, shinies:0, artifacts:0, organics:0, exp:{}, crew3:0, teamWins:0, xpFrac:0}});

function playGame(kind, profile, map, seed, clock, log){
  const role = kind === 'cadet' ? 'cadet' : 'explorer';
  const job = kind === 'cadet' ? 'buggy' : 'scout';
  let st = MR.newGame({map, seed, players:[{pid:'bot', name:'Bot', color:'teal', role, job, rank:MR.rankOf(profile.xp), perks:MR.equippedPerks(profile)}]});
  const out = {firstReward:null, win:null, sols:0, boring:0, stuck:0, lowpower:0, bumps:0, halts:0, rewardsPerSol:[]};
  for (let sol = 0; sol < 40; sol++) {
    const r = st.rovers[0];
    GUIDED = kind === 'guided';
    const plan = (kind === 'cadet' ? cadetPlan : (kind === 'novice' || kind === 'guided') ? novicePlan : goodPlan)(st, r).map((a, i) => ({...a, arg:a.arg || 1, idx:i}));
    const {timeline, state} = MR.simulateSol(st, {bot:plan}); st = state;
    let secs = PLAN[kind] + UPLINK; timeline.forEach(t => { secs += Math.max(.1, ...t.map(e => (e.slow ? DUR.slow : DUR[e.t]) || .3)); });
    clock.t += secs; out.sols++;
    const evs = timeline.flat();
    const notices = MR.applyRewards(profile, 'bot', evs, {map, players:1});
    const interesting = evs.some(e => ['drill','artifact','dock','analyze'].includes(e.t) && (e.t !== 'dock' || e.n) && (e.t !== 'analyze' || e.cells.length)) || evs.some(e => e.t === 'scan' && e.sigs.length) || notices.length;
    if (!interesting) out.boring++;
    if (evs.some(e => e.t === 'drill' || e.t === 'artifact') && out.firstReward == null) out.firstReward = clock.t - clock.start;
    out.stuck += evs.filter(e => e.t === 'stuck').length; out.lowpower += evs.filter(e => e.t === 'lowpower').length; out.bumps += evs.filter(e => e.t === 'bump').length;
    out.halts += evs.filter(e => e.t === 'skip').length;
    notices.forEach(n => log.push({t:clock.t, k:n.k, id:n.id ?? n.rank, isNew:n.isNew}));
    if (state.won) { out.win = clock.t - clock.start; break; }
  }
  return out;
}

const median = a => { const s = a.filter(x => x != null).sort((x,y) => x-y); return s.length ? s[Math.floor(s.length/2)] : null; };
const pct = (a, n) => Math.round(100 * a / n);
const mins = s => s == null ? 'never' : (s/60).toFixed(1) + ' min';
for (const kind of ['cadet','novice','guided','good']) {
  for (const map of ['jezero','gusev']) {
    const games = [];
    for (let g = 0; g < 40; g++) { const clock = {t:0, start:0}; games.push(playGame(kind, freshProfile(kind === 'cadet' ? 'cadet' : 'explorer'), map, 1000 + g*37, clock, [])); }
    const sols = games.reduce((s,x) => s + x.sols, 0);
    console.log(`${kind.padEnd(6)} ${map.padEnd(6)} | first reward ${mins(median(games.map(x => x.firstReward)))} | win ${pct(games.filter(x => x.win != null).length, games.length)}% in ${mins(median(games.map(x => x.win)))}, ${median(games.filter(x=>x.win!=null).map(x => x.sols))} sols | boring sols ${pct(games.reduce((s,x)=>s+x.boring,0), sols)}% | stuck/game ${(games.reduce((s,x)=>s+x.stuck,0)/games.length).toFixed(1)} | low power/game ${(games.reduce((s,x)=>s+x.lowpower,0)/games.length).toFixed(1)} | stops/sol ${(games.reduce((s,x)=>s+x.halts,0)/sols).toFixed(2)}`);
  }
}
/* Progress over a 2-hour session: back-to-back Jezero games. */
for (const kind of ['cadet','novice','guided','good']) {
  const prof = freshProfile(kind === 'cadet' ? 'cadet' : 'explorer'), clock = {t:0, start:0}, log = []; let n = 0;
  while (clock.t < 7200) { clock.start = clock.t; playGame(kind, prof, n % 2 && MR.Store.unlocked().includes('gusev') ? 'gusev' : 'jezero', 5000 + n*11, clock, log); n++; }
  const at = m => { const xs = log.filter(e => e.t <= m*60); return `${MR.RANKS[MR.rankOf(prof.xp)].name}`; };
  const rankAt = m => { let xp = 0; return null; };
  const ranks = log.filter(e => e.k === 'rank').map(e => `${MR.RANKS[e.id].name} @${(e.t/60).toFixed(0)}m`).join(', ');
  const patchesBy = m => log.filter(e => e.k === 'patch' && e.t <= m*60).length;
  const cardsBy = m => log.filter(e => e.k === 'card' && e.t <= m*60).length;
  const gaps = []; let last = 0; log.filter(e => ['card','shiny','patch','rank','perk'].includes(e.k) || (e.k === 'sticker' && e.isNew)).forEach(e => { gaps.push(e.t - last); last = e.t; });
  console.log(`\n${kind}: ${n} games in 2 h | ranks: ${ranks || 'none'}\n   patches by 15/30/60/120 min: ${patchesBy(15)}/${patchesBy(30)}/${patchesBy(60)}/${patchesBy(120)} of ${MR.PATCHES.length} | new cards by 15/30/60/120: ${cardsBy(15)}/${cardsBy(30)}/${cardsBy(60)}/${cardsBy(120)} of ${MR.CARD_ORDER.length} | longest wait between rewards ${mins(Math.max(...gaps, 7200 - last))}`);
}
{ const prof = freshProfile('cadet'), clock = {t:0, start:0}, log = []; let n = 0;
  while (clock.t < 7200) { clock.start = clock.t; playGame('cadet', prof, 'jezero', 5000 + n*11, clock, log); n++; }
  const ev = log.filter(e => ['card','shiny','patch','rank','perk'].includes(e.k) || (e.k === 'sticker' && e.isNew));
  let last = 0; const big = []; ev.forEach(e => { if (e.t - last > 480) big.push(`${(last/60).toFixed(0)}–${(e.t/60).toFixed(0)} min`); last = e.t; });
  console.log('cadet gaps over 8 min:', big.join(', ') || 'none', '| new stickers by 30/60/120 min:', [30,60,120].map(m => log.filter(e => e.k === 'sticker' && e.isNew && e.t <= m*60).length).join('/'), 'of', MR.STICKERS.length); }
