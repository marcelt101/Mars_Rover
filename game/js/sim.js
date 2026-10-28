/* Game state and the sol simulation. The host runs simulateSol; every device plays back the timeline. */
(function () {
const MR = window.MR;
const {MW, MH, DIRS, T} = MR;

const isPower = r => r.role !== 'cadet';
const has = (r, p) => (r.perks || []).includes(p);
MR.sightOf = r => (r.job === 'heli' || r.job === 'scout' ? 4 : 3) + (has(r,'sharp_eyes') ? 1 : 0);
MR.scanOf = r => (r.job === 'scout' ? 6 : 4) + (has(r,'sharp_eyes') ? 1 : 0);
MR.tubesOf = r => MR.ROLES[r.role].tubes + (r.job === 'hauler' ? 4 : 0);
MR.regionAt = (st, x, y) => MR.nearStation(st.map, x, y, 2) ? 'Base station' : MR.MAPS[st.map].regions[st.world.ter[y*MW+x]];

function spawnCells(map){
  const S = MR.MAPS[map].station;
  return [[S.x-1,S.y],[S.x+2,S.y],[S.x-1,S.y+1],[S.x+2,S.y+1],[S.x,S.y-1],[S.x+1,S.y+2],[S.x+1,S.y-1],[S.x,S.y+2]];
}
function cleanPerks(p){
  if (p.role === 'cadet') return [];
  const slots = MR.ROLES[p.role].slots;
  return (p.perks || []).filter(k => MR.PERKS[k] && (p.rank|0) >= MR.PERKS[k].rank).slice(0, slots);
}
MR.makeRover = (p, cell, map) => {
  const r = {pid:p.pid, name:String(p.name||'Rover').slice(0,16), color:p.color, role:p.role, job:p.job, rank:p.rank|0,
    perks:[], x:cell[0], y:cell[1], dir:MR.MAPS[map].startDir, bat:100, batMax:100, stuck:false, tubes:[]};
  if (!MR.JOBS[r.job] || !MR.JOBS[r.job].roles.includes(r.role)) r.job = MR.defaultJob(r.role);
  r.perks = cleanPerks(p);
  if (r.perks.includes('big_battery')) r.batMax = r.bat = 150;
  return r;
};

MR.newGame = ({map, seed, players}) => {
  const cadets = players.filter(p => p.role === 'cadet').length, others = players.length - cadets;
  const world = MR.genWorld(map, seed, cadets > 0);
  const cells = spawnCells(map);
  const st = {v:MR.VERSION, map, seed, sol:1, won:false, rng:(seed ^ 0x5bd1e995) | 0,
    team:{score:0, delivered:0, treasures:0, col:{}}, rovers:[], world,
    goals: others ? MR.MAPS[map].goals(others) : MR.cadetGoals(cadets)};
  players.forEach((p, i) => { const r = MR.makeRover(p, cells[i % cells.length], map); st.rovers.push(r); reveal(world, r.x, r.y, MR.sightOf(r)); });
  return st;
};
MR.addRover = (st, p) => {
  const cells = spawnCells(st.map), used = new Set(st.rovers.map(r => r.x+','+r.y));
  const c = cells.find(c => !used.has(c[0]+','+c[1])) || cells[0];
  const r = MR.makeRover(p, c, st.map); st.rovers.push(r); reveal(st.world, r.x, r.y, MR.sightOf(r)); return r;
};

MR.stateToWire = st => ({...st, world:MR.worldToWire(st.world)});
MR.stateFromWire = (o, prevWorld) => ({...o, world:MR.worldFromWire(o.world, prevWorld)});
MR.cloneState = st => ({...JSON.parse(JSON.stringify({...st, world:null})), world:MR.cloneWorld(st.world)});

MR.goalProgress = st => st.goals.map(g => {
  const n = g.kind === 'col' ? (st.team.col[g.res] || 0) : g.kind === 'deliver' ? st.team.delivered : st.team.treasures;
  return {...g, n, done: n >= g.of};
});

function reveal(W, cx, cy, rad){
  const out = [];
  for (let y=cy-rad;y<=cy+rad;y++) for (let x=cx-rad;x<=cx+rad;x++) {
    if (!MR.inb(x,y) || (x-cx)**2 + (y-cy)**2 > rad*rad+1) continue;
    const i = y*MW+x; if (!W.seen[i]) { W.seen[i] = 1; out.push(i); }
  }
  return out;
}
function markSignals(W, cx, cy, rad, traps){
  const sigs = [], tr = [];
  for (let y=cy-rad;y<=cy+rad;y++) for (let x=cx-rad;x<=cx+rad;x++) {
    if (!MR.inb(x,y) || (x-cx)**2 + (y-cy)**2 > rad*rad+1) continue;
    const i = y*MW+x;
    if (W.res[i] && !W.sig[i] && !W.drilled[i] && W.obs[i] !== 'A') { W.sig[i] = 1; sigs.push(i); }
    if (traps && W.trap[i] && !W.trapSeen[i]) { W.trapSeen[i] = 1; tr.push(i); }
  }
  return {sigs, traps:tr};
}
function rnd(st){ st.rng = (st.rng + 0x6D2B79F5) | 0; let t = st.rng; t = Math.imul(t ^ t >>> 15, 1 | t); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

function blockReason(st, r, nx, ny){
  if (!MR.inb(nx,ny)) return 'the edge of the map';
  if (r.job === 'heli') return null;
  const i = ny*MW+nx, t = MR.TER[st.world.ter[i]];
  if (t.block) return t.block;
  const o = st.world.obs[i];
  if (o === 'R') return 'a rock'; if (o === 'C') return 'a crater'; if (o === 'A') return 'a piece of Mars history';
  const other = st.rovers.find(o2 => o2 !== r && o2.job !== 'heli' && o2.x === nx && o2.y === ny);
  if (other) return `${other.name}'s rover`;
  return null;
}
function moveCost(r, W, i){
  const t = MR.TER[W.ter[i]];
  let c = t.cost || 2;
  if (has(r,'wide_wheels') && (t.sandy || t.hilly)) c = Math.max(2, c-2);
  return c;
}
const canStick = r => r.job !== 'buggy' && r.job !== 'heli' && r.job !== 'excavator';

function act(st, r, a, E){
  const W = st.world, power = isPower(r), cadet = r.role === 'cadet', nm = r.name;
  const spend = (n, what) => { if (!power) return true;
    if (r.bat < n) { E({t:'lowpower', msg:{k:'bad', text:`${nm}: not enough power to ${what}. Charge, or wait for tonight's sunlight.`}}); return false; }
    r.bat -= n; return true; };
  const docArtifacts = () => {
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy]) => { const x = r.x+dx, y = r.y+dy; if (!MR.inb(x,y)) return;
      const i = y*MW+x, id = W.res[i];
      if (id && MR.CARDS[id].artifact && !W.drilled[i] && W.seen[i]) {
        W.drilled[i] = 1; W.known[i] = 1; st.team.col[id] = (st.team.col[id]||0) + 1; st.team.score += MR.CARDS[id].pts;
        E({t:'artifact', i, res:id, msg:{k:'good', text:`${nm} found ${MR.CARDS[id].name}! A real piece of Mars history.`}});
      } });
  };
  switch (a.k) {
    case 'step': {
      if (r.stuck && a.sgn > 0) { E({t:'bump', at:[r.x,r.y], msg:{k:'bad', text:`${nm} is stuck in soft sand. Back up 1 square to get free.`}}); return false; }
      const nx = r.x + DIRS[r.dir][0]*a.sgn, ny = r.y + DIRS[r.dir][1]*a.sgn;
      const why = blockReason(st, r, nx, ny);
      if (why) {
        const seen = MR.inb(nx,ny) && !W.seen[ny*MW+nx] ? [ny*MW+nx] : [];
        seen.forEach(i => W.seen[i] = 1);
        E({t:'bump', at:[nx,ny], seen, msg:{k: cadet ? 'warn' : 'bad', text: cadet ? `Oops! ${nm} bumped into ${why}. Make a new plan.` : `Hazard avoidance: ${why} ${a.sgn>0?'ahead':'behind'}. ${nm}'s rover stopped itself.`}});
        return false;
      }
      const i = ny*MW+nx;
      if (power && !spend(moveCost(r, W, i), 'drive')) return false;
      const from = [r.x, r.y], reg0 = MR.regionAt(st, r.x, r.y);
      r.x = nx; r.y = ny;
      const seen = reveal(W, nx, ny, MR.sightOf(r));
      const sigs = r.job === 'heli' ? markSignals(W, nx, ny, 2, false).sigs : [];
      const reg = MR.regionAt(st, nx, ny);
      E({t:'move', from, to:[nx,ny], fly:r.job === 'heli', slow:!!MR.TER[W.ter[i]].sandy && r.job !== 'heli', seen, sigs, bat:r.bat,
        msg: reg !== reg0 && !cadet ? {k:'info', text:`${nm} is entering ${reg}.`} : (sigs.length ? {k:'good', text:`${nm} spotted ${sigs.length} treasure${sigs.length>1?'s':''} from the air!`} : null)});
      if (r.stuck && a.sgn < 0) { r.stuck = false; E({t:'free', msg:{k:'good', text:`${nm} backed out of the sand trap. Free!`}}); }
      docArtifacts();
      if (W.trap[i] && canStick(r)) {
        r.stuck = true; W.trapSeen[i] = 1;
        E({t:'stuck', at:[nx,ny], msg:{k:'bad', text:`Soft sand! ${nm}'s wheels dug in, just like Spirit in 2009. Back up 1 square to escape.`}});
        return false;
      }
      if (MR.onStation(st.map, nx, ny)) dock(st, r, E);
      return true;
    }
    case 'turn': {
      if (r.stuck) { E({t:'bump', at:[r.x,r.y], msg:{k:'bad', text:`${nm} can't turn while stuck. Back up 1 square first.`}}); return false; }
      if (!spend(1, 'turn')) return false;
      r.dir = (r.dir + a.sgn + 4) % 4;
      E({t:'turn', sgn:a.sgn, dir:r.dir, bat:r.bat}); return true;
    }
    case 'scan': {
      if (cadet) return true;
      if (!spend(5, 'scan')) return false;
      const rad = MR.scanOf(r), seen = reveal(W, r.x, r.y, rad), m = markSignals(W, r.x, r.y, rad, true);
      const parts = [];
      if (m.sigs.length) parts.push(`${m.sigs.length} mystery signal${m.sigs.length>1?'s':''}`);
      if (m.traps.length) parts.push(`${m.traps.length} sand trap${m.traps.length>1?'s':''}`);
      E({t:'scan', rad, seen, sigs:m.sigs, traps:m.traps, bat:r.bat,
        msg:{k: m.sigs.length ? 'good' : 'info', text: parts.length ? `${nm}'s scan found ${parts.join(' and ')}.` : `${nm}'s scan found nothing new within ${rad} squares.`}});
      docArtifacts(); return true;
    }
    case 'analyze': {
      if (cadet) return true;
      if (!spend(2, 'analyze')) return false;
      const cells = [], add = i => { const id = W.res[i]; if (id && !W.drilled[i] && !MR.CARDS[id].artifact && !W.known[i] && !cells.some(c => c.i === i)) { W.sig[i] = 1; W.known[i] = 1; cells.push({i, res:id}); } };
      const here = r.y*MW+r.x;
      if (W.res[here] && !W.drilled[here]) add(here);
      if (r.job === 'science') for (let y=r.y-2;y<=r.y+2;y++) for (let x=r.x-2;x<=r.x+2;x++) { if (MR.inb(x,y) && W.sig[y*MW+x]) add(y*MW+x); }
      if (has(r,'supercam')) for (let k=1;k<=3;k++) { const x = r.x+DIRS[r.dir][0]*k, y = r.y+DIRS[r.dir][1]*k; if (MR.inb(x,y) && W.sig[y*MW+x]) add(y*MW+x); }
      const names = cells.filter(c => c.res !== 'basalt').map(c => MR.CARDS[c.res].name);
      E({t:'analyze', cells, bat:r.bat, msg: cells.length
        ? {k: names.length ? 'good' : 'warn', text: names.length ? `${nm}'s spectrometer: ${names.join(', ')}!` : `${nm}'s spectrometer: just basalt. Probably not worth a sample tube.`}
        : {k:'info', text:`${nm}'s spectrometer: ordinary bedrock here.`}});
      return true;
    }
    case 'drill': {
      if (cadet) {
        const opts = [[0,0]].concat(MR.cadetMagnet(r.rank) ? [[1,0],[-1,0],[0,1],[0,-1]] : []);
        let i = -1;
        for (const [dx,dy] of opts) { const x = r.x+dx, y = r.y+dy; if (!MR.inb(x,y)) continue; const j = y*MW+x;
          if (W.res[j] && !W.drilled[j] && !MR.CARDS[W.res[j]].artifact && W.sig[j] && W.seen[j]) { i = j; break; } }
        if (i < 0) { E({t:'nothing', msg:{k:'info', text:`${nm} dug a hole. Nothing here. Look for a sparkly gem!`}}); return true; }
        const id = W.res[i], shiny = rnd(st) < .1;
        W.drilled[i] = 1; W.known[i] = 1; st.team.col[id] = (st.team.col[id]||0) + 1; st.team.treasures++; st.team.score += MR.CARDS[id].pts;
        E({t:'drill', i, res:id, shiny, treasure:true, msg:{k:'good', text:`${nm} found treasure: ${MR.CARDS[id].kid}${shiny ? ' (shiny!)' : ''}!`}});
        return true;
      }
      const i = r.y*MW+r.x, id = W.res[i];
      if (W.drilled[i]) { E({t:'nothing', msg:{k:'warn', text:`${nm}: already drilled here.`}}); return true; }
      if (!id || MR.CARDS[id].artifact) { if (!spend(2, 'drill')) return false; E({t:'nothing', dust:true, bat:r.bat, msg:{k:'info', text:`${nm} drilled ordinary rock. Nothing worth keeping.`}}); return true; }
      if (r.tubes.length >= MR.tubesOf(r)) { E({t:'nothing', msg:{k:'warn', text:`${nm}'s sample tubes are full. Drive onto the station to unload.`}}); return true; }
      if (!spend(8, 'drill')) return false;
      const shiny = rnd(st) < .08;
      W.drilled[i] = 1; W.known[i] = 1; W.sig[i] = 1; r.tubes.push(id); st.team.col[id] = (st.team.col[id]||0) + 1;
      E({t:'drill', i, res:id, shiny, bat:r.bat, tubes:r.tubes.slice(), msg:{k: id === 'basalt' ? 'warn' : 'good', text:`${nm} sealed a sample: ${MR.CARDS[id].name}${shiny ? ' (shiny!)' : ''}. Tubes: ${r.tubes.length}/${MR.tubesOf(r)}.`}});
      return true;
    }
    case 'dig': {
      if (r.job !== 'excavator') return true;
      if (!spend(6, 'dig')) return false;
      const x = r.x+DIRS[r.dir][0], y = r.y+DIRS[r.dir][1];
      if (!MR.inb(x,y)) { E({t:'dig', what:'none', bat:r.bat, msg:{k:'info', text:`${nm} dug at the edge of the map. Nothing to clear.`}}); return true; }
      const i = y*MW+x;
      if (W.obs[i] === 'R') { W.obs[i] = ''; W.seen[i] = 1; E({t:'dig', i, what:'rock', bat:r.bat, msg:{k:'good', text:`${nm} pushed a rock out of the way.`}}); return true; }
      if (W.trap[i]) { W.trap[i] = 0; W.trapSeen[i] = 0; W.seen[i] = 1; E({t:'dig', i, what:'trap', bat:r.bat, msg:{k:'good', text:`${nm} packed down a sand trap. It's safe now.`}}); return true; }
      E({t:'dig', i, what:'none', bat:r.bat, msg:{k:'info', text:`${nm} dug, but there was nothing to clear in front.`}}); return true;
    }
    case 'charge': {
      if (!power) return true;
      const before = r.bat; r.bat = Math.min(r.batMax, r.bat + 15);
      E({t:'charge', before, bat:r.bat, msg:{k:'good', text:`${nm} charged from ${before}% to ${r.bat}%.`}}); return true;
    }
  }
  return true;
}
function dock(st, r, E){
  if (!isPower(r)) return;
  const n = r.tubes.length, pts = r.tubes.reduce((s,id) => s + MR.CARDS[id].pts, 0), b = r.bat;
  st.team.delivered += n; st.team.score += pts; r.tubes = []; r.bat = r.batMax;
  if (n || b < r.batMax) E({t:'dock', n, pts, bat:r.bat, tubes:[], msg: n ? {k:'good', text:`${r.name} docked and unloaded ${n} sample${n>1?'s':''} for ${pts} science points. Battery full.`} : b <= r.batMax - 10 ? {k:'good', text:`${r.name} docked. Battery recharged to ${r.batMax}%.`} : null});
}

function expand(r, actions){
  const out = [], role = MR.ROLES[r.role], max = r.role === 'cadet' ? MR.CADET_LEN(r.rank) : r.role === 'explorer' ? role.maxCmd : 999;
  (actions || []).slice(0, max).forEach(a => {
    const idx = a.idx, n = Math.max(1, Math.min(20, a.arg|0 || 1));
    if (a.type === 'forward') for (let k=0;k<n;k++) out.push({k:'step', sgn:1, idx});
    else if (a.type === 'back') for (let k=0;k<n;k++) out.push({k:'step', sgn:-1, idx});
    else if (a.type === 'left') out.push({k:'turn', sgn:-1, idx});
    else if (a.type === 'right') out.push({k:'turn', sgn:1, idx});
    else if (MR.CMDS[a.type]) out.push({k:a.type, idx});
  });
  return out.slice(0, r.role === 'specialist' ? 200 : 400);
}

MR.simulateSol = (prev, plans) => {
  const st = MR.cloneState(prev), timeline = [], q = {};
  st.rovers.forEach(r => q[r.pid] = expand(r, plans[r.pid]));
  let guard = 0;
  while (st.rovers.some(r => q[r.pid].length) && guard++ < 220 && !st.won) {
    const evs = [];
    for (const r of st.rovers) {
      const a = q[r.pid].shift(); if (!a) continue;
      const E = o => { const e = {pid:r.pid, idx:a.idx, ...o}; evs.push(e); return e; };
      const ok = act(st, r, a, E);
      if (ok === false) { const left = q[r.pid].length; q[r.pid] = []; if (left) evs.push({t:'skip', pid:r.pid, idx:a.idx, n:left}); }
    }
    if (!st.won && MR.goalProgress(st).every(g => g.done)) { st.won = true; evs.push({t:'win', msg:{k:'good', text:'Expedition complete! Every objective is done.'}}); }
    timeline.push(evs);
  }
  if (!st.won) {
    const charges = [];
    st.rovers.forEach(r => { if (!isPower(r)) return; const before = r.bat; r.bat = Math.min(r.batMax, r.bat + MR.ROLES[r.role].solar); charges.push({pid:r.pid, before, bat:r.bat}); });
    st.sol++;
    timeline.push([{t:'night', charges, sol:st.sol, msg:{k:'info', text:`Night falls. Solar panels recharge the rovers. Sol ${st.sol} begins.`}}]);
  }
  return {timeline, state:st};
};

/* Where a plan would take the rover, for the dotted preview. Stops at known obstacles. */
MR.ghostPath = (st, r, actions) => {
  const path = [], W = st.world; let x = r.x, y = r.y, d = r.dir;
  for (const a of expand(r, actions)) {
    if (a.k === 'turn') { d = (d + a.sgn + 4) % 4; continue; }
    if (a.k !== 'step') continue;
    const nx = x + DIRS[d][0]*a.sgn, ny = y + DIRS[d][1]*a.sgn;
    if (!MR.inb(nx,ny)) break;
    const i = ny*MW+nx;
    if (r.job !== 'heli' && W.seen[i] && (MR.TER[W.ter[i]].block || W.obs[i])) break;
    x = nx; y = ny; path.push([x,y,d]);
    if (path.length > 60) break;
  }
  return path;
};

/* Tiny Python interpreter: rover commands and for loops. */
MR.parsePy = (src, maxCmd) => {
  const lines = src.replace(/\t/g,'    ').split('\n');
  const root = [], stack = [{ind:0, body:root}]; let pending = null, used = 0, hasLoop = false;
  for (let i=0;i<lines.length;i++) {
    const n = i+1, raw = lines[i].replace(/#.*$/, ''), text = raw.trim();
    if (!text) continue;
    const ind = raw.length - raw.trimStart().length;
    if (pending) {
      if (ind <= pending.hdr) return {error:`Line ${n}: the lines inside a for loop must be indented.`};
      pending.ind = ind; stack.push(pending); pending = null;
    } else {
      while (stack.length > 1 && ind < stack[stack.length-1].ind) stack.pop();
      if (ind !== stack[stack.length-1].ind) return {error:`Line ${n}: the indentation does not line up.`};
    }
    if (/^(from|import)\b/.test(text)) continue;
    used++;
    let m = text.match(/^for\s+\w+\s+in\s+range\(\s*(\d+)\s*\)\s*:$/);
    if (m) { const node = {loop:+m[1], body:[]}; if (node.loop > 20) return {error:`Line ${n}: loops can repeat at most 20 times.`};
      stack[stack.length-1].body.push(node); pending = {hdr:ind, body:node.body}; hasLoop = true; continue; }
    if (/^for\b/.test(text)) return {error:`Line ${n}: write loops like this: for i in range(3):`};
    m = text.match(/^rover\.(\w+)\(\s*(\d*)\s*\)$/);
    if (!m) return {error:`Line ${n}: I don't understand "${text}". Try rover.forward(2).`};
    const type = MR.PY2CMD[m[1]];
    if (!type) return {error:`Line ${n}: the rover has no command called ${m[1]}(). Try: ${Object.values(MR.CMDS).map(c=>c.py).join(', ')}.`};
    if (MR.CMDS[type].arg) { if (!m[2]) return {error:`Line ${n}: ${m[1]}() needs a number of squares, like rover.${m[1]}(3).`}; if (+m[2] < 1 || +m[2] > 20) return {error:`Line ${n}: use a number from 1 to 20.`}; }
    else if (m[2]) return {error:`Line ${n}: ${m[1]}() does not take a number.`};
    stack[stack.length-1].body.push({type, arg: MR.CMDS[type].arg ? +m[2] : undefined, idx:n});
  }
  if (pending) return {error:'The last for loop has nothing inside it.'};
  const out = [];
  const run = body => { for (const s of body) { if (out.length > maxCmd) return; if (s.loop) { for (let k=0;k<s.loop;k++) run(s.body); } else out.push({...s}); } };
  run(root);
  if (out.length > maxCmd) return {error:`That program makes more than ${maxCmd} moves. The rover can only do ${maxCmd} per sol.`};
  return {actions:out, loops:hasLoop, lines:used};
};
})();
