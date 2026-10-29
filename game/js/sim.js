/* Game state and the sol simulation. The host runs simulateSol; every device plays back the timeline. */
(function () {
const MR = window.MR;
const {MW, MH, DIRS, T} = MR;

const isPower = r => r.role !== 'cadet' && r.job !== 'lab';
const storm = st => !!(st.wx && st.wx.storm);
const built = (st, k) => !!(st.lab && st.lab.built && st.lab.built[k]);
const sightNow = (st, r) => Math.max(2, MR.sightOf(r) - (storm(st) && r.role !== 'cadet' ? 1 : 0));
const scanNow = (st, r) => Math.max(2, MR.scanOf(r) - (storm(st) ? 1 : 0));
const has = (r, p) => (r.perks || []).includes(p);
MR.sightOf = r => (r.job === 'heli' || r.job === 'scout' ? 4 : 3) + (has(r,'sharp_eyes') ? 1 : 0);
MR.scanOf = r => (r.job === 'scout' ? 6 : 4) + (has(r,'sharp_eyes') ? 1 : 0);
/* In team games the Scout carries 2 fewer tubes (it finds, others haul); solo Scouts keep the full rack. */
MR.usesPower = r => isPower(r);
MR.tubesOf = r => Math.max(0, MR.ROLES[r.role].tubes + (r.job === 'hauler' ? 4 : 0) + (r.tubeAdj || 0));
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
    perks:[], x:cell[0], y:cell[1], dir:MR.MAPS[map].startDir, bat:100, batMax:100, stuck:false, tubes:[], tubeMeta:[], dust:0, wheels:100};
  if (!MR.JOBS[r.job] || !MR.JOBS[r.job].roles.includes(r.role)) r.job = MR.defaultJob(r.role);
  if (MR.MAPS[map].airless && r.job === 'heli') { r.job = 'buggy'; r.noAir = true; }
  r.perks = cleanPerks(p);
  if (r.perks.includes('big_battery')) r.batMax = r.bat = 150;
  return r;
};

MR.newGame = ({map, seed, players, day}) => {
  const cadets = players.filter(p => p.role === 'cadet').length, others = players.length - cadets;
  const world = MR.genWorld(map, seed, cadets > 0);
  const cells = spawnCells(map);
  const st = {v:MR.VERSION, map, seed, sol:1, won:false, rng:(seed ^ 0x5bd1e995) | 0,
    team:{score:0, delivered:0, treasures:0, col:{}}, rovers:[], world, sites:{}, lab:{inbox:[], catalog:[], mat:{water:0, metal:0, bricks:0, glass:0}, built:{}},
    goals: MR.cadetGoals(cadets)};
  if (day && MR.missionOf(day)) st.day = day;
  if (others) startCampaign(st, 0, others);
  players.forEach((p, i) => { const r = MR.makeRover(p, cells[i % cells.length], map); if (players.length > 1 && r.job === 'scout') r.tubeAdj = -2; st.rovers.push(r); reveal(world, r.x, r.y, MR.sightOf(r)); });
  st.rovers.forEach(r => { if (r.job === 'lab') { const S2 = MR.MAPS[map].station; r.x = S2.x; r.y = S2.y; } });
  if (st.day) applyDayRules(st, MR.missionOf(st.day).rules || {});
  rollWeather(st);
  return st;
};
MR.addRover = (st, p) => {
  const cells = spawnCells(st.map), used = new Set(st.rovers.map(r => r.x+','+r.y));
  const c = cells.find(c => !used.has(c[0]+','+c[1])) || cells[0];
  const r = MR.makeRover(p, c, st.map); if (r.job === 'scout') r.tubeAdj = -2; st.rovers.push(r); reveal(st.world, r.x, r.y, MR.sightOf(r)); return r;
};

/* Weather: the same for the whole team. Storms are rare, short, and scheduled two sols ahead so the forecast can warn. */
function rollWeather(st){
  if (MR.MAPS[st.map].airless) { st.wx = {sol:st.sol, airless:true, hi:120, lo:-170, wind:0, dust:'none', storm:false, forecast:[]}; return; }
  st.stormPlan = st.stormPlan || {};
  for (const target of [st.sol + 1, st.sol + 2]) if (st.stormPlan[target] == null) {
    const recent = [1, 2, 3, 4].some(k => st.stormPlan[target - k]);
    st.stormPlan[target] = target >= 6 && !recent && rnd(st) < 1/12;
    if (st.stormPlan[target] && rnd(st) < .4) st.stormPlan[target + 1] = true;
  }
  const s2 = !!st.stormPlan[st.sol];
  st.wx = {sol:st.sol, storm:s2, hi:Math.round(-14 - rnd(st)*12 - (s2 ? 6 : 0)), lo:Math.round(-74 - rnd(st)*12 + (s2 ? 14 : 0)),
    wind:Math.round(s2 ? 40 + rnd(st)*25 : 4 + rnd(st)*20), dust:s2 ? 'storm' : rnd(st) < .25 ? 'hazy' : 'clear',
    forecast:[st.sol + 1, st.sol + 2].map(x => ({sol:x, storm:!!st.stormPlan[x]}))};
}
MR.stateToWire = st => ({...st, world:MR.worldToWire(st.world)});
MR.stateFromWire = (o, prevWorld) => MR.ensureCampaign({...o, world:MR.worldFromWire(o.world, prevWorld)});
MR.cloneState = st => ({...JSON.parse(JSON.stringify({...st, world:null})), world:MR.cloneWorld(st.world)});

/* Mission Log day rules: a low battery, a dust storm on given sols, or the first rover starting stuck in sand. */
function applyDayRules(st, rules){
  const power = st.rovers.filter(isPower);
  if (rules.bat) power.forEach(r => r.bat = Math.round(r.batMax * rules.bat / 100));
  if (rules.storm) { st.stormPlan = st.stormPlan || {}; rules.storm.forEach(s => st.stormPlan[s] = true); }
  if (rules.stuck && power[0]) { const r = power[0], W = st.world, S = MR.MAPS[st.map].station; let best = -1, bd = 1e9;
    for (let i = 0; i < W.ter.length; i++) { const x = i % MW, y = (i/MW) | 0, d = Math.hypot(x - S.x, y - S.y);
      if (W.ter[i] === T.DUNE && !W.obs[i] && !W.res[i] && d > 6 && d < bd) { bd = d; best = i; } }
    if (best >= 0) { r.x = best % MW; r.y = (best/MW) | 0; r.stuck = true; W.trap[best] = 1; W.trapSeen[best] = 1; reveal(W, r.x, r.y, MR.sightOf(r)); } }
}
/* Campaigns (see campaigns.js). st.camp = {i, n, base}; st.goals holds the current campaign's objectives
   (small: the texts are looked up with MR.objectiveInfo). Cadet-only games keep the treasure goal. */
function startCampaign(st, i, n){
  const C = st.day ? MR.dayCampaign(st.day) : MR.CAMPAIGNS[st.map][i], tm = st.team;
  st.camp = {i, n, started:st.sol, day:st.day || undefined, base:{delivered:tm.delivered, sites:Object.keys(st.sites || {}).length, squares:tm.squares || 0, scans:tm.scans || 0, photos:tm.photos || 0, smart:tm.smart || 0, relay:tm.relay || 0, loops:tm.loops || 0, freed:tm.freed || 0}};
  st.goals = C.obj(n).map((g, k) => ({k, t:g.t, kind:g.kind, res:g.res, region:g.region, of:g.of, bonus:!!g.bonus}));
}
MR.campaignOf = st => !st.camp ? null : st.camp.day ? MR.dayCampaign(st.camp.day) : MR.CAMPAIGNS[st.map] ? MR.CAMPAIGNS[st.map][st.camp.i] : null;
MR.campaignCount = st => st.camp && st.camp.day ? 1 : (MR.CAMPAIGNS[st.map] || []).length;
MR.objectiveInfo = (st, g) => { const C = MR.campaignOf(st); return C ? C.obj(st.camp.n)[g.k] : g; };
/* Older saves had plain goals; give them campaigns (progress already made still counts). */
MR.ensureCampaign = st => {
  if (st.camp || st.day || !MR.CAMPAIGNS[st.map] || st.goals.some(g => g.kind === 'treasure')) return st;
  startCampaign(st, 0, Math.max(1, st.rovers.filter(r => r.role !== 'cadet').length)); return st;
};
MR.goalProgress = st => st.goals.map(g => {
  const b = (st.camp && st.camp.base) || {}, tm = st.team, rel = k => (tm[k] || 0) - (b[k] || 0);
  const n = g.kind === 'col' ? (tm.col[g.res] || 0) : g.kind === 'ident' ? Math.max((tm.ident || {})[g.res] || 0, tm.col[g.res] || 0)
    : g.kind === 'deliver' ? tm.delivered - (b.delivered || 0) : g.kind === 'sites' ? Object.keys(st.sites || {}).length - (b.sites || 0)
    : g.kind === 'reach' ? ((tm.visited || {})[g.region] ? 1 : 0) : ['squares','scans','photos','smart','relay','loops','freed'].includes(g.kind) ? rel(g.kind)
    : g.kind === 'free' ? rel('freed') : g.kind === 'loop' ? rel('loops') : tm.treasures;
  return {...g, n, done: n >= g.of};
});
/* After every tick: when the required objectives are done, the campaign ends; the last one wins the map. */
function campaignStep(st, evs){
  const req = MR.goalProgress(st).filter(g => !g.bonus);
  if (!req.every(g => g.done)) return;
  if (!st.camp) { st.won = true; evs.push({t:'win', msg:{k:'good', text:'Expedition complete! Every objective is done.'}}); return; }
  const list = st.camp.day ? [MR.dayCampaign(st.camp.day)] : MR.CAMPAIGNS[st.map], C = list[st.camp.i], last = st.camp.i >= list.length - 1;
  evs.push({t:'campaign', i:st.camp.i, id:C.id, last, msg:{k:'good', text:`Campaign complete: ${C.name}!`}});
  if (last) { st.won = true; evs.push({t:'win', msg:{k:'good', text: st.camp.day ? `Day ${st.camp.day} complete!` : 'Expedition complete! Every campaign is done.'}}); return; }
  startCampaign(st, st.camp.i + 1, st.camp.n);
  evs.push({t:'campnext', i:st.camp.i, goals:st.goals, camp:st.camp, msg:{k:'info', text:`New campaign: ${list[st.camp.i].name}.`}});
}

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

/* Every signal a rover finds gets a flag with the finder and a site name, like NASA's target names. */
const SITE_NAMES = ['Rochette','Kodiak','Cheyava Falls','Bright Angel','Sapphire Canyon','Wildcat Ridge','Skinner Ridge','Montdenier','Hidden Harbor','Otis Peak','Lake Haiyaha','Roubion','Brac','Quartier','Coulettes','Swift Run','Bunsen Peak','Mageik','Pilot Mountain','Silver Mountain','Kukaklek','Amalik','Bellegarde','Issole','Robine','Malay','Atmo Mountain','Comet Geyser','Dourbes','Sid','Hazeltop','Shuyak','Mount Pilot','Green Gardens','Big Sandy','Tenby','Lefroy Bay','Vermillion','Pelican Point','Bell Island'];
function flagSites(st, r, sigs){
  if (!sigs || !sigs.length) return;
  st.sites = st.sites || {};
  const used = new Set(Object.values(st.sites).map(x => x.name));
  sigs.forEach(i => { if (st.world.kid[i] || st.sites[i]) return;
    let name = SITE_NAMES[Math.floor(rnd(st) * SITE_NAMES.length)], k = 2;
    while (used.has(name)) name = SITE_NAMES[Math.floor(rnd(st) * SITE_NAMES.length)] + (used.size >= SITE_NAMES.length ? ' ' + (k++) : '');
    used.add(name); st.sites[i] = {by:r.pid, name, sol:st.sol, claim:null}; });
}
function blockReason(st, r, nx, ny){
  if (!MR.inb(nx,ny)) return 'the edge of the map';
  if (r.job === 'heli') return null;
  const i = ny*MW+nx, t = MR.TER[st.world.ter[i]];
  if (t.block) return t.block;
  const o = st.world.obs[i];
  if (o === 'R') return 'a rock'; if (o === 'C') return 'a crater'; if (o === 'A') return 'a piece of Mars history';
  const other = st.rovers.find(o2 => o2 !== r && o2.job !== 'heli' && o2.job !== 'lab' && o2.x === nx && o2.y === ny);
  if (other) return `${other.name}'s rover`;
  return null;
}
function moveCost(r, W, i){
  const t = MR.TER[W.ter[i]];
  let c = t.cost || 2;
  if (has(r,'wide_wheels') && (t.sandy || t.hilly)) c = Math.max(2, c-2);
  if (r.wheels != null && r.wheels < 25) c += 1;
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
        E({t:'artifact', i, res:id, msg:{k:'good', text:`${nm} found ${MR.CARDS[id].name}! A real piece of space history.`}});
      } });
  };
  if (MR.CMDS[a.k] && MR.CMDS[a.k].lab) return labAct(st, r, a, E);
  switch (a.k) {
    case 'step': {
      if (r.job === 'lab') { E({t:'bump', at:[r.x, r.y], msg:{k:'info', text:`${nm}'s lab stays at the station. Use the Lab commands instead.`}}); return false; }
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
      r.x = nx; r.y = ny; r.odo = (r.odo || 0) + 1; st.team.squares = (st.team.squares || 0) + 1;
      const seen = reveal(W, nx, ny, sightNow(st, r));
      if (power && r.job !== 'heli') { const t2 = W.ter[i], rough = t2 === T.BED || t2 === T.HILL || t2 === T.PLATE;
        r.wheels = Math.max(0, +(r.wheels - (rough ? .5 : .15) * (has(r,'wide_wheels') ? .5 : 1) * (built(st,'garage') ? .5 : 1)).toFixed(1)); }
      const sigs = r.job === 'heli' ? markSignals(W, nx, ny, 2, false).sigs : [];
      flagSites(st, r, sigs);
      const reg = MR.regionAt(st, nx, ny); (st.team.visited = st.team.visited || {})[reg] = 1;
      E({t:'move', from, to:[nx,ny], fly:r.job === 'heli', slow:!!MR.TER[W.ter[i]].sandy && r.job !== 'heli', seen, sigs, bat:r.bat, wheels:r.wheels,
        msg: reg !== reg0 && !cadet ? {k:'info', text:`${nm} is entering ${reg}.`} : (sigs.length ? {k:'good', text:`${nm} spotted ${sigs.length} treasure${sigs.length>1?'s':''} from the air!`} : null)});
      if (r.stuck && a.sgn < 0) { r.stuck = false; st.team.freed = (st.team.freed || 0) + 1; E({t:'free', msg:{k:'good', text:`${nm} backed out of the sand trap. Free!`}}); }
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
      st.team.scans = (st.team.scans || 0) + 1;
      const rad = scanNow(st, r), seen = reveal(W, r.x, r.y, rad), m = markSignals(W, r.x, r.y, rad, true);
      flagSites(st, r, m.sigs);
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
      st.team.ident = st.team.ident || {}; cells.forEach(c => st.team.ident[c.res] = (st.team.ident[c.res] || 0) + 1);
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
        const site = (st.sites || {})[i];
        E({t:'drill', i, res:id, shiny, treasure:true, by:site && site.by, site:site && site.name, msg:{k:'good', text:`${nm} found treasure: ${MR.CARDS[id].kid}${shiny ? ' (shiny!)' : ''}!`}});
        return true;
      }
      const i = r.y*MW+r.x, id = W.res[i];
      if (W.drilled[i]) { E({t:'nothing', msg:{k:'warn', text:`${nm}: already drilled here.`}}); return true; }
      if (!id || MR.CARDS[id].artifact) { if (!spend(2, 'drill')) return false; E({t:'nothing', dust:true, bat:r.bat, msg:{k:'info', text:`${nm} drilled ordinary rock. Nothing worth keeping.`}}); return true; }
      if (r.tubes.length >= MR.tubesOf(r)) { E({t:'nothing', msg:{k:'warn', text:`${nm}'s sample tubes are full. Drive onto the station to unload.`}}); return true; }
      if (!spend(8, 'drill')) return false;
      const shiny = rnd(st) < .08;
      W.drilled[i] = 1; W.known[i] = 1; W.sig[i] = 1; r.tubes.push(id); st.team.col[id] = (st.team.col[id]||0) + 1;
      (r.tubeMeta = r.tubeMeta || []).push({res:id, site:(st.sites[i] || {}).name || null, by:(st.sites[i] || {}).by || r.pid, driller:r.pid, sol:st.sol});
      const site = (st.sites || {})[i];
      E({t:'drill', i, res:id, shiny, by:site && site.by, site:site && site.name, bat:r.bat, tubes:r.tubes.slice(), msg:{k: id === 'basalt' ? 'warn' : 'good', text:`${nm} sealed a sample: ${MR.CARDS[id].name}${shiny ? ' (shiny!)' : ''}. Tubes: ${r.tubes.length}/${MR.tubesOf(r)}.`}});
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
    case 'photo': {
      if (cadet) return true;
      if (!spend(1, 'take a photo')) return false;
      st.team.photos = (st.team.photos || 0) + 1;
      const where = MR.regionAt(st, r.x, r.y);
      E({t:'photo', at:[r.x, r.y], dir:r.dir, place:where, bat:r.bat, msg:{k:'info', text:`${nm} took a Navcam photo of ${where}.`}}); return true;
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
  const n = r.tubes.length, pts = r.tubes.reduce((s,id) => s + MR.CARDS[id].pts, 0), b = r.bat, fixed = r.wheels < 100 || r.dust > 0;
  st.team.delivered += n; st.team.score += pts; r.bat = r.batMax; r.wheels = 100; r.dust = 0;
  labReceive(st, r); r.tubes = []; r.tubeMeta = [];
  if (n || b < r.batMax || fixed) E({t:'dock', n, pts, bat:r.bat, tubes:[], wheels:100, dust:0, msg: n ? {k:'good', text:`${r.name} docked and unloaded ${n} sample${n>1?'s':''} for ${pts} science points. Battery full.`} : b <= r.batMax - 10 ? {k:'good', text:`${r.name} docked. Battery recharged to ${r.batMax}%.`} : null});
}

const hasLab = st => st.rovers.some(r => r.job === 'lab');
function labReceive(st, r){
  st.lab = st.lab || {inbox:[], catalog:[], mat:{water:0, metal:0, bricks:0, glass:0}, built:{}};
  const meta = (r.tubeMeta && r.tubeMeta.length === r.tubes.length) ? r.tubeMeta : r.tubes.map(res => ({res, by:r.pid, driller:r.pid, site:null, sol:st.sol}));
  meta.forEach(m => { const e = {...m, cataloger:null, used:false};
    if (hasLab(st)) st.lab.inbox.push(e); else { e.cataloger = 'auto'; e.catSol = st.sol; st.lab.catalog.push(e); } });
}
function labAct(st, r, a, E){
  const L = st.lab, cmd = MR.CMDS[a.k], nm = r.name;
  if (cmd.lab === 'catalog') {
    if (!L.inbox.length) { E({t:'nothing', msg:{k:'info', text:`${nm}: no new samples yet. Explorers deliver them by driving onto the station.`}}); return true; }
    const entries = L.inbox.splice(0, L.inbox.length).map(e => ({...e, cataloger:r.pid, catSol:st.sol}));
    L.catalog.push(...entries);
    E({t:'catalog', entries, msg:{k:'good', text:`${nm} cataloged ${entries.length} sample${entries.length > 1 ? 's' : ''}: ${entries.map(e => MR.CARDS[e.res].name).join(', ')}.`}}); return true;
  }
  if (cmd.lab === 'make') {
    const recipe = MR.MATS[cmd.mat].from, use = L.catalog.filter(e => !e.used && recipe[e.res]).slice(0, 3);
    if (!use.length) { E({t:'nothing', msg:{k:'warn', text:`${nm}: no samples for ${MR.MATS[cmd.mat].name.toLowerCase()} yet. It is made from ${Object.keys(recipe).map(k => MR.CARDS[k] ? MR.CARDS[k].name : k).join(', ')}.`}}); return true; }
    let gained = 0; use.forEach(e => { e.used = true; gained += recipe[e.res]; });
    L.mat[cmd.mat] = (L.mat[cmd.mat] || 0) + gained;
    E({t:'make', mat:cmd.mat, gained, mats:{...L.mat}, msg:{k:'good', text:`${nm} made ${gained} ${MR.MATS[cmd.mat].name.toLowerCase()} from ${use.length} sample${use.length > 1 ? 's' : ''}.`}}); return true;
  }
  if (cmd.lab === 'build') {
    const up = MR.UPGRADES[cmd.up];
    if (L.built[cmd.up]) { E({t:'nothing', msg:{k:'info', text:`The ${up.name.toLowerCase()} is already built.`}}); return true; }
    const missing = Object.entries(up.cost).filter(([k, n]) => (L.mat[k] || 0) < n).map(([k, n]) => `${n - (L.mat[k] || 0)} more ${MR.MATS[k].name.toLowerCase()}`);
    if (missing.length) { E({t:'nothing', msg:{k:'warn', text:`${nm}: the ${up.name.toLowerCase()} needs ${missing.join(' and ')}.`}}); return true; }
    Object.entries(up.cost).forEach(([k, n]) => L.mat[k] -= n); L.built[cmd.up] = true;
    E({t:'build', up:cmd.up, mats:{...L.mat}, msg:{k:'good', text:`${nm} built the ${up.name.toLowerCase()}! ${up.desc}`}}); return true;
  }
  return true;
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

/* Cadets never run out of treasure: when few gems are left near a Cadet, a few new ones appear nearby. */
const KID_GEMS = {meridiani:['hematite','salts','meteorite','basalt'], gale:['clay','olivine','salts','basalt'], moon:['moon_basalt','breccia','glass'], jezero:['olivine','clay','salts','meteorite','carbonate','basalt'], gusev:['olivine','salts','silica','meteorite','carbonate','basalt']};
function spawnCadetGems(st, timeline){
  const W = st.world, kinds = KID_GEMS[st.map] || KID_GEMS.jezero, evs = [];
  st.rovers.filter(r => r.role === 'cadet').forEach(r => {
    let near = 0;
    for (let i=0;i<W.res.length;i++) if (W.kid[i] && !W.drilled[i] && Math.hypot(i % MW - r.x, ((i/MW)|0) - r.y) <= 10) near++;
    if (near >= 3) return;
    const cells = []; let g = 0;
    while (cells.length < 3 && g++ < 300) {
      const a = rnd(st)*Math.PI*2, d = 3 + rnd(st)*5, x = Math.round(r.x + Math.cos(a)*d), y = Math.round(r.y + Math.sin(a)*d);
      if (!MR.inb(x,y)) continue; const i = y*MW+x;
      if (W.res[i] || W.obs[i] || MR.TER[W.ter[i]].block || W.trap[i] || MR.onStation(st.map, x, y)) continue;
      const id = kinds[Math.floor(rnd(st)*kinds.length)];
      W.res[i] = id; W.kid[i] = 1; W.sig[i] = 1; W.known[i] = 1; W.extra.push([i, id]);
      cells.push({i, res:id, seen:reveal(W, x, y, 1)});
    }
    if (cells.length) evs.push({t:'spawn', pid:r.pid, cells, msg:{k:'good', text:`New sparkly gems appeared near ${r.name}!`}});
  });
  if (evs.length) timeline.push(evs);
}
/* Satellite relay kit: programs that keep running across sols. The program and its place in the code live on the
   rover (r.prog), so they travel with the game state. Each sol it may do up to PROG_BUDGET actions. */
const PROG_BUDGET = 60, WHILE_CAP = 30;
const isTarget = (W, i) => W.sig[i] && W.res[i] && !W.drilled[i] && !W.kid[i] && !MR.CARDS[W.res[i]].artifact && !(W.known[i] && W.res[i] === 'basalt');
function senseAhead(st, r){
  const W = st.world, x = r.x + DIRS[r.dir][0], y = r.y + DIRS[r.dir][1];
  if (!MR.inb(x, y)) return 'edge';
  const i = y*MW+x; W.seen[i] = 1;
  if (blockReason(st, r, x, y)) return 'rock';
  if (W.trap[i] && canStick(r)) { W.trapSeen[i] = 1; return 'sand'; }
  if (isTarget(W, i)) return 'signal';
  return 'clear';
}
function evalCond(st, r, c){
  const W = st.world, here = r.y*MW + r.x;
  switch (c.c) {
    case 'true': return true;
    case 'not': return !evalCond(st, r, c.a);
    case 'and': return evalCond(st, r, c.a) && evalCond(st, r, c.b);
    case 'or': return evalCond(st, r, c.a) || evalCond(st, r, c.b);
    case 'ahead': return (senseAhead(st, r) === c.v) === (c.op !== '!=');
    case 'signal_here': return isTarget(W, here);
    case 'signal_nearby': for (let y=r.y-3;y<=r.y+3;y++) for (let x=r.x-3;x<=r.x+3;x++) if (MR.inb(x,y) && isTarget(W, y*MW+x)) return true; return false;
    case 'worth': return !!(W.res[here] && W.known[here] && !W.drilled[here] && W.res[here] !== 'basalt' && !MR.CARDS[W.res[here]].artifact);
    case 'tubes_full': return r.tubes.length >= MR.tubesOf(r);
    case 'bat': { const b = r.bat; return c.op === '<' ? b < c.v : c.op === '<=' ? b <= c.v : c.op === '>' ? b > c.v : c.op === '>=' ? b >= c.v : b === c.v; }
    case 'storm': return storm(st);
    case 'home': return MR.onStation(st.map, r.x, r.y);
  }
  return false;
}
/* A route to drive right now, as atomic steps. */
function macroSteps(st, r, kind){
  const W = st.world;
  if (kind === 'go_home' && MR.onStation(st.map, r.x, r.y)) return [];
  if (kind === 'go_signal' && isTarget(W, r.y*MW + r.x)) return [];
  const path = MR.findPath(st, r, kind === 'go_home' ? (x, y) => MR.onStation(st.map, x, y) : (x, y) => isTarget(W, y*MW+x), 120);
  if (!path) return null;
  const out = []; let d = r.dir, x = r.x, y = r.y;
  for (const [nx, ny] of path) {
    const want = DIRS.findIndex(([dx, dy]) => dx === nx-x && dy === ny-y), diff = (want - d + 4) % 4;
    if (diff === 1) out.push({k:'turn', sgn:1}); else if (diff === 3) out.push({k:'turn', sgn:-1}); else if (diff === 2) out.push({k:'turn', sgn:1}, {k:'turn', sgn:1});
    out.push({k:'step', sgn:1}); d = want; x = nx; y = ny;
  }
  return out;
}
MR.startProgram = (r, prog) => {
  r.prog = {sols:prog.sols|0, solsLeft:prog.sols|0, perSol:!!prog.perSol, body:prog.body, defs:prog.defs || {}, name:prog.name || null,
    stack:[{body:prog.body, i:0}], queue:[], used:0};
};
/* The next atomic action of the rover's program, or null when this sol's share is used up or the program ended. */
function progNext(st, r, E){
  const P = r.prog; let guard = 0;
  while (guard++ < 400) {
    if (P.queue.length) { if (P.used >= PROG_BUDGET) return null; P.used++; return P.queue.shift(); }
    const top = P.stack[P.stack.length - 1];
    if (!top) { P.done = true; return null; }
    if (top.i >= top.body.length) {
      if (top.rep > 1) { top.rep--; top.i = 0; continue; }
      if (top.cond && ++top.iter < WHILE_CAP && evalCond(st, r, top.cond)) { top.i = 0; continue; }
      P.stack.pop(); continue;
    }
    const nd = top.body[top.i++], idx = nd.idx;
    if (nd.n === 'cmd') { P.queue = expandRaw([{type:nd.type, arg:nd.arg, idx}]); continue; }
    if (nd.n === 'repeat') { if (nd.times > 0 && nd.body.length) P.stack.push({body:nd.body, i:0, rep:nd.times}); continue; }
    if (nd.n === 'while') { if (nd.body.length && evalCond(st, r, nd.cond)) P.stack.push({body:nd.body, i:0, cond:nd.cond, iter:0}); continue; }
    if (nd.n === 'if') { const b = evalCond(st, r, nd.cond) ? nd.body : (nd.else || []); if (b.length) P.stack.push({body:b, i:0}); continue; }
    if (nd.n === 'call') { const b = P.defs[nd.name]; if (b && P.stack.length < 12) P.stack.push({body:b, i:0}); continue; }
    if (nd.n === 'macro') {
      const steps = macroSteps(st, r, nd.kind);
      if (!steps) { /* nothing to drive to: leave the innermost loop and carry on with the rest of the program */
        E({t:'proginfo', idx, msg:{k:'info', text: nd.kind === 'go_home' ? `${r.name}'s program could not find a safe way home yet.` : `${r.name}'s program: no more known signals to drive to. Scan to find more.`}});
        while (P.stack.length > 1) { const f = P.stack.pop(); if (f.cond || f.rep) break; }
        continue; }
      P.queue = steps.map(s => ({...s, idx, macro:true})); continue;
    }
  }
  E({t:'progstop', msg:{k:'warn', text:`${r.name}'s program was looping without doing anything, so the rover stopped it.`}}); P.halt = true; return null;
}
function expandRaw(actions){
  const out = [];
  actions.forEach(a => { const idx = a.idx, n = Math.max(1, Math.min(20, a.arg|0 || 1));
    if (a.type === 'forward') for (let k=0;k<n;k++) out.push({k:'step', sgn:1, idx});
    else if (a.type === 'back') for (let k=0;k<n;k++) out.push({k:'step', sgn:-1, idx});
    else if (a.type === 'left') out.push({k:'turn', sgn:-1, idx});
    else if (a.type === 'right') out.push({k:'turn', sgn:1, idx});
    else if (MR.CMDS[a.type]) out.push({k:a.type, idx}); });
  return out;
}
/* Is a program small and sane enough to accept from the network? */
MR.validProgram = p => { try { return !!p && Array.isArray(p.body) && JSON.stringify(p).length < 12000 && (p.sols|0) >= 1 && (p.sols|0) <= 3; } catch (e) { return false; } };
MR.simulateSol = (prev, plans) => {
  const st = MR.ensureCampaign(MR.cloneState(prev)), timeline = [], q = {}, starts = [];
  st.rovers.forEach(r => {
    const p = plans[r.pid], plan = Array.isArray(p) ? {actions:p} : (p || {});
    if (plan.loop) st.team.loops = (st.team.loops || 0) + 1;
    if (plan.program && MR.validProgram(plan.program) && r.role !== 'cadet') {
      MR.startProgram(r, plan.program); starts.push(r);
      const walk = list => list.some(nd => nd.n === 'if' || nd.n === 'while' || (nd.body && walk(nd.body)) || (nd.else && walk(nd.else)));
      const loops = list => list.some(nd => nd.n === 'repeat' || nd.n === 'while' || (nd.body && loops(nd.body)));
      if (walk(plan.program.body) || Object.values(plan.program.defs || {}).some(walk)) st.team.smart = (st.team.smart || 0) + 1;
      if ((plan.program.sols|0) >= 2) st.team.relay = (st.team.relay || 0) + 1;
      if (!plan.loop && (loops(plan.program.body) || plan.program.perSol && plan.program.sols > 1)) st.team.loops = (st.team.loops || 0) + 1;
    } else if (r.prog && (plan.cancel || (plan.actions && plan.actions.length))) {
      r.prog = null; if (plan.cancel) starts.push({cancel:r});
    }
    if (r.prog) { r.prog.used = 0; r.prog.replans = 0; }
    q[r.pid] = r.prog ? [] : expand(r, plan.actions);
  });
  const first = [];
  starts.forEach(r => {
    if (r.cancel) { first.push({t:'progend', pid:r.cancel.pid, msg:{k:'info', text:`${r.cancel.name}'s program was cancelled.`}}); return; }
    const many = r.prog.sols > 1;
    let seen = [];
    if (many) { seen = reveal(st.world, r.x, r.y, 7); }
    first.push({t:'progstart', pid:r.pid, sols:r.prog.sols, seen, msg: many ? {k:'info', text:`${r.name}'s program is uploaded through the relay satellite. It will run for ${r.prog.sols} sols. The satellite mapped the area around the rover.`} : null});
  });
  if (first.length) timeline.push(first);
  let guard = 0;
  while (guard++ < 220 && !st.won) {
    const evs = []; let any = false;
    for (const r of st.rovers) {
      const E0 = o => { const e = {pid:r.pid, ...o}; evs.push(e); return e; };
      const a = r.prog ? (r.prog.halt || r.prog.done || r.prog.pause ? null : progNext(st, r, E0)) : q[r.pid].shift(); if (!a) continue;
      any = true;
      const E = o => { const e = {pid:r.pid, idx:a.idx, ...o}; evs.push(e); return e; };
      if (r.prog && isPower(r) && r.bat < 10 && a.k !== 'charge') {
        evs.push({t:'proginfo', pid:r.pid, idx:a.idx, msg:{k:'warn', text:`Low battery: ${r.name}'s rover paused its program to recharge overnight.`}});
        r.prog.queue.unshift(a); r.prog.used--; r.prog.pause = true; continue;
      }
      const ok = act(st, r, a, E);
      const bumped = evs.length && evs[evs.length - 1].t === 'bump' && evs[evs.length - 1].pid === r.pid;
      if (ok === false && r.prog && a.macro && bumped && (r.prog.replans = (r.prog.replans || 0) + 1) <= 6) {
        /* AutoNav: the rover saw a new hazard, so it plans a fresh route around it */
        r.prog.queue = []; r.prog.stack[r.prog.stack.length - 1].i--;
        evs.push({t:'proginfo', pid:r.pid, idx:a.idx, msg:{k:'info', text:`AutoNav: ${r.name}'s rover found a new route around it.`}});
      } else if (ok === false) {
        if (r.prog) { r.prog.halt = true; evs.push({t:'progstop', pid:r.pid, idx:a.idx, msg:{k:'warn', text:`AutoNav stopped ${r.name}'s program to keep the rover safe. Make a new plan.`}}); }
        else { const left = q[r.pid].length; q[r.pid] = []; if (left) evs.push({t:'skip', pid:r.pid, idx:a.idx, n:left}); }
      }
    }
    if (!st.won) campaignStep(st, evs);
    if (evs.length) timeline.push(evs);
    if (!any) break;
  }
  const pe = [];
  st.rovers.forEach(r => { const P = r.prog; if (!P) return;
    if (P.halt) { r.prog = null; pe.push({t:'progend', pid:r.pid, stopped:true}); return; }
    const paused = P.pause; P.pause = false;
    const done = !paused && (P.done || (!P.queue.length && !P.stack.length));
    P.solsLeft--;
    if (done && P.perSol && P.solsLeft > 0 && !st.won) { P.stack = [{body:P.body, i:0}]; P.done = false; pe.push({t:'progcont', pid:r.pid, left:P.solsLeft, msg:{k:'info', text:`${r.name}'s mission runs again next sol (${P.solsLeft} sol${P.solsLeft > 1 ? 's' : ''} left).`}}); return; }
    if (done || P.solsLeft <= 0 || st.won) { r.prog = null; pe.push({t:'progend', pid:r.pid, finished:done, sols:P.sols, msg: P.sols < 2 ? null : {k: done ? 'good' : 'info', text: done ? `${r.name}'s program finished.` : `${r.name}'s program used all ${P.sols} sols and stopped.`}}); }
    else pe.push({t:'progcont', pid:r.pid, left:P.solsLeft, msg:{k:'info', text:`${r.name}'s program will ${paused ? 'continue after recharging, next' : 'keep running next'} sol (${P.solsLeft} sol${P.solsLeft > 1 ? 's' : ''} left).`}});
  });
  if (pe.length) timeline.push(pe);
  spawnCadetGems(st, timeline);
  if (!st.won) {
    const charges = [], wasStorm = storm(st), airless = MR.MAPS[st.map].airless, cold = st.wx && st.wx.lo < -82;
    st.rovers.forEach(r => { if (!isPower(r)) return;
      const before = r.bat, heater = airless ? 3 : wasStorm ? 2 : cold ? 4 : 3;
      let cleaned = false;
      if (!airless) { r.dust = Math.min(100, (r.dust || 0) + (wasStorm ? 8 : 1.5) * (has(r,'dust_wiper') ? .5 : 1) * (built(st,'garage') ? .5 : 1));
        if (r.dust > 20 && rnd(st) < .06) { r.dust = 0; cleaned = true; } }
      const solar = Math.round((MR.ROLES[r.role].solar + (built(st,'solar_farm') ? 10 : 0)) * (wasStorm ? .5 : 1) * (1 - (r.dust || 0)/300));
      r.bat = Math.max(0, Math.min(r.batMax, r.bat + solar - heater));
      charges.push({pid:r.pid, before, bat:r.bat, solar, heater, dust:Math.round(r.dust || 0), cleaned}); });
    st.hist = (st.hist || []).concat([{sol:st.sol, r:Object.fromEntries(st.rovers.filter(isPower).map(r => [r.pid, {b:r.bat, d:Math.round(r.dust || 0), s:r.odo || 0, w:Math.round(r.wheels ?? 100)}]))}]).slice(-80);
    st.sol++;
    rollWeather(st);
    const lucky = charges.filter(c => c.cleaned).map(c => st.rovers.find(q2 => q2.pid === c.pid).name);
    const night = {t:'night', charges, sol:st.sol, wx:st.wx, storm:wasStorm, msg:{k:'info', text:`Night falls. ${wasStorm ? 'Dust blocks the sun, so the panels charge only half. ' : ''}Solar panels recharge the rovers and the heaters keep them warm. Sol ${st.sol} begins.`}};
    const evs = [night];
    if (lucky.length) evs.push({t:'gust', msg:{k:'good', text:`A lucky gust of wind cleaned ${lucky.join(' and ')}'s solar panels! That happened to Opportunity too.`}});
    const f = st.wx.forecast && st.wx.forecast.find(x => x.storm);
    if (st.wx.storm) evs.push({t:'wx', msg:{k:'warn', text:'Dust storm today! Rovers see a little less and the panels will charge only half tonight.'}});
    else if (f) evs.push({t:'wx', msg:{k:'warn', text:`Weather station: a dust storm is likely on sol ${f.sol}. Charge up or plan a trip home.`}});
    timeline.push(evs);
  }
  return {timeline, state:st};
};

/* Shortest route the team knows about (unseen squares are assumed open). Returns squares [x,y]. */
MR.findPath = (st, r, goal, maxLen = 400) => {
  const W = st.world, start = r.y*MW + r.x, prev = new Map([[start, -1]]), q = [start];
  const open = (x, y) => { if (!MR.inb(x,y)) return false; if (r.job === 'heli') return true; const i = y*MW+x;
    if (!W.seen[i]) return true; if (MR.TER[W.ter[i]].block || W.obs[i] || W.trapSeen[i]) return false;
    return !st.rovers.some(o => o !== r && o.job !== 'heli' && o.job !== 'lab' && o.x === x && o.y === y); };
  while (q.length) {
    const c = q.shift(), x = c % MW, y = (c/MW) | 0;
    if (c !== start && goal(x, y)) { const p = []; let k = c; while (k !== start) { p.unshift([k % MW, (k/MW) | 0]); k = prev.get(k); } return p.slice(0, maxLen); }
    for (const [dx, dy] of DIRS) { const nx = x+dx, ny = y+dy, n = ny*MW+nx; if (!prev.has(n) && open(nx, ny)) { prev.set(n, c); q.push(n); } }
  }
  return null;
};
/* Turn a route into plan blocks: turns plus Forward N. */
MR.pathToPlan = (r, path, maxBlocks) => {
  const out = []; let d = r.dir, x = r.x, y = r.y;
  for (const [nx, ny] of path) {
    const want = DIRS.findIndex(([dx, dy]) => dx === nx-x && dy === ny-y), diff = (want - d + 4) % 4;
    if (diff === 1) out.push({type:'right'}); else if (diff === 3) out.push({type:'left'}); else if (diff === 2) out.push({type:'right'}, {type:'right'});
    if (out.length >= maxBlocks) break;
    d = want; x = nx; y = ny;
    const last = out[out.length-1];
    if (last && last.type === 'forward' && last.arg < 20) last.arg++; else { if (out.length >= maxBlocks) break; out.push({type:'forward', arg:1}); }
  }
  return out.slice(0, maxBlocks);
};
/* Rough area to search for a mineral: the middle of where it can be found (not the exact spot). */
/* Search area for a mineral: around the undrilled piece closest to the rover (or the station), shifted by a
   few squares so it is a place to scan, not the exact spot. */
MR.searchArea = (st, res, from) => {
  const W = st.world, f = from || MR.MAPS[st.map].station; let best = -1, bd = 1e9, n = 0;
  for (let i=0;i<W.res.length;i++) if (W.res[i] === res && !W.drilled[i] && !W.kid[i]) { n++; const d = Math.hypot(i % MW - f.x, ((i/MW) | 0) - f.y); if (d < bd) { bd = d; best = i; } }
  if (best < 0) return null;
  const a = (best * 2.39996) % (Math.PI * 2), k = 1.5 + (best % 3) * .5;
  return {x:Math.max(0, Math.min(MW - 1, best % MW + Math.cos(a)*k)), y:Math.max(0, Math.min(MH - 1, ((best/MW) | 0) + Math.sin(a)*k)), n};
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

/* Tiny Python: rover commands, for loops, and (with sensors) while / if / elif / else / def.
   A program with only commands and for loops becomes a plain list of actions. Anything that needs sensors
   becomes a program tree that the rover runs on Mars (see progNext). opts.relay unlocks the relay kit. */
const SENSE = ['rock','clear','sand','signal','edge'];
const SENSORS = {signal_here:'signal_here', signal_nearby:'signal_nearby', worth_drilling:'worth', tubes_full:'tubes_full', storm:'storm', at_home:'home'};
MR.PY_SENSORS = ['sense_ahead() == "rock"', 'signal_here()', 'signal_nearby()', 'worth_drilling()', 'tubes_full()', 'battery() < 30', 'storm()', 'at_home()'];
function parseCond(text, n){
  const toks = [], re = /\s*(\(|\)|==|!=|<=|>=|<|>|"[^"]*"|'[^']*'|\d+|[A-Za-z_][\w.]*\(\s*\)|[A-Za-z_]\w*)/y;
  let m, pos = 0; re.lastIndex = 0;
  while (pos < text.length && (m = re.exec(text))) { toks.push(m[1]); pos = re.lastIndex; }
  if (text.slice(pos).trim()) throw `Line ${n}: I don't understand "${text.slice(pos).trim()}" in this condition.`;
  let k = 0; const peek = () => toks[k], take = () => toks[k++];
  const orE = () => { let a = andE(); while (peek() === 'or') { take(); a = {c:'or', a, b:andE()}; } return a; };
  const andE = () => { let a = notE(); while (peek() === 'and') { take(); a = {c:'and', a, b:notE()}; } return a; };
  const notE = () => { if (peek() === 'not') { take(); return {c:'not', a:notE()}; } return atom(); };
  const atom = () => {
    const t = take();
    if (t == null) throw `Line ${n}: the condition is missing something.`;
    if (t === '(') { const c = orE(); if (take() !== ')') throw `Line ${n}: a ) is missing.`; return c; }
    if (t === 'True') return {c:'true'}; if (t === 'False') return {c:'not', a:{c:'true'}};
    const f = t.match(/^rover\.(\w+)\(\s*\)$/);
    if (!f) throw `Line ${n}: "${t}" is not a sensor. Try one of: ${MR.PY_SENSORS.map(x => 'rover.' + x).join(', ')}.`;
    if (f[1] === 'sense_ahead') { const op = take(), v = (take() || '').replace(/["']/g, '');
      if (op !== '==' && op !== '!=') throw `Line ${n}: compare it like this: rover.sense_ahead() == "rock"`;
      if (!SENSE.includes(v)) throw `Line ${n}: sense_ahead() can be ${SENSE.map(x => '"' + x + '"').join(', ')}.`;
      return {c:'ahead', op, v}; }
    if (f[1] === 'battery') { const op = take(), v = take();
      if (!['<','<=','>','>=','=='].includes(op) || !/^\d+$/.test(v || '')) throw `Line ${n}: compare the battery like this: rover.battery() < 30`;
      return {c:'bat', op, v:+v}; }
    if (SENSORS[f[1]]) return {c:SENSORS[f[1]]};
    throw `Line ${n}: the rover has no sensor called ${f[1]}(). Try: ${MR.PY_SENSORS.map(x => 'rover.' + x).join(', ')}.`;
  };
  const c = orE(); if (k < toks.length) throw `Line ${n}: I don't understand "${toks.slice(k).join(' ')}" here.`;
  return c;
}
MR.parsePy = (src, maxCmd, opts = {}) => {
  try { return parsePy(src, maxCmd, opts); } catch (e) { if (typeof e === 'string') return {error:e}; throw e; }
};
function parsePy(src, maxCmd, opts){
  const lines = src.replace(/\t/g,'    ').split('\n');
  const root = [], defs = {}, calls = [], stack = [{ind:0, body:root}];
  let pending = null, used = 0, hasLoop = false, depth = 0, repeat = 1, maxRepeat = 1, lastKey = '', dynamic = false, sols = 1, perSol = false;
  for (let i=0;i<lines.length;i++) {
    const n = i+1, raw = lines[i].replace(/#.*$/, ''), text = raw.trim();
    if (!text) continue;
    const ind = raw.length - raw.trimStart().length;
    if (pending) {
      if (ind <= pending.hdr) throw `Line ${n}: the lines inside "${pending.what}" must be indented.`;
      pending.ind = ind; stack.push(pending); pending = null;
    } else {
      while (stack.length > 1 && ind < stack[stack.length-1].ind) stack.pop();
      if (ind !== stack[stack.length-1].ind) throw `Line ${n}: the indentation does not line up.`;
    }
    if (/^(from|import)\b/.test(text)) continue;
    used++;
    const top = stack[stack.length-1], body = top.body;
    const open = (node, inner, what) => { pending = {hdr:ind, body:inner, what}; depth = Math.max(depth, stack.length); lastKey = ''; top.lastIf = node && node.n === 'if' ? node : null; };
    let m = text.match(/^for\s+\w+\s+in\s+range\(\s*(\d+)\s*\)\s*:$/);
    if (m) { const node = {n:'repeat', times:+m[1], body:[], idx:n}; if (node.times > 20) throw `Line ${n}: loops can repeat at most 20 times.`;
      body.push(node); hasLoop = true; open(node, node.body, 'for'); continue; }
    m = text.match(/^for\s+\w+\s+in\s+rover\.mission\(\s*(\d+)\s*\)\s*:$/);
    if (m) {
      if (!opts.relay) throw `Line ${n}: rover.mission() needs the satellite relay kit. It unlocks at the next rank.`;
      if (stack.length > 1 || perSol) throw `Line ${n}: write rover.mission() once, at the start of a line with no indent.`;
      if (+m[1] < 1 || +m[1] > 3) throw `Line ${n}: a mission can run for 1 to 3 sols.`;
      sols = +m[1]; perSol = true; dynamic = true; hasLoop = true; open(null, body, 'for'); stack[stack.length-1].lastIf = null; continue; }
    if (/^for\b/.test(text)) throw `Line ${n}: write loops like this: for i in range(3):`;
    m = text.match(/^while\s+(.+):$/);
    if (m) { const node = {n:'while', cond:parseCond(m[1], n), body:[], idx:n}; body.push(node); dynamic = true; hasLoop = true; open(node, node.body, 'while'); continue; }
    m = text.match(/^if\s+(.+):$/);
    if (m) { const node = {n:'if', cond:parseCond(m[1], n), body:[], idx:n}; body.push(node); dynamic = true; open(node, node.body, 'if'); top.lastIf = node; continue; }
    m = text.match(/^elif\s+(.+):$/);
    if (m) { const prev = top.lastIf; if (!prev) throw `Line ${n}: elif must come right after an if block.`;
      const node = {n:'if', cond:parseCond(m[1], n), body:[], idx:n}; prev.else = [node]; open(node, node.body, 'elif'); top.lastIf = node; continue; }
    if (/^else\s*:$/.test(text)) { const prev = top.lastIf; if (!prev) throw `Line ${n}: else must come right after an if block.`;
      prev.else = []; open(null, prev.else, 'else'); top.lastIf = null; continue; }
    m = text.match(/^def\s+([a-z_]\w*)\s*\(\s*\)\s*:$/);
    if (m) { if (stack.length > 1) throw `Line ${n}: write def at the start of a line, with no indent.`;
      if (MR.PY2CMD[m[1]] || SENSORS[m[1]]) throw `Line ${n}: ${m[1]} is already a rover command. Pick another name.`;
      defs[m[1]] = []; dynamic = true; open(null, defs[m[1]], 'def'); top.lastIf = null; continue; }
    if (/^(if|elif|while|def|else)\b/.test(text)) throw `Line ${n}: a line starting with ${text.split(/\W/)[0]} must end with a colon (:).`;
    top.lastIf = null;
    if (text === 'pass') continue;
    m = text.match(/^([a-z_]\w*)\(\s*\)$/);
    if (m) { body.push({n:'call', name:m[1], idx:n}); calls.push([m[1], n]); dynamic = true; continue; }
    const lm = text.match(/^lab\.(catalog|make|build)\(\s*(?:["']([a-z_]+)["'])?\s*\)$/);
    if (lm) { let type = lm[1] === 'catalog' ? 'catalog' : lm[1] + '_' + (lm[2] || '');
      if (!MR.CMDS[type]) throw lm[1] === 'make' ? `Line ${n}: lab.make() needs one of: ${Object.keys(MR.MATS).map(k => '"' + k + '"').join(', ')}.` : `Line ${n}: lab.build() needs one of: ${Object.keys(MR.UPGRADES).map(k => '"' + k + '"').join(', ')}.`;
      body.push({n:'cmd', type, idx:n}); continue; }
    m = text.match(/^rover\.(\w+)\(\s*(\d*)\s*\)$/);
    if (!m) throw `Line ${n}: I don't understand "${text}". Try rover.forward(2).`;
    if (SENSORS[m[1]] || m[1] === 'sense_ahead' || m[1] === 'battery') throw `Line ${n}: ${m[1]}() is a sensor. Use it in an if or while, like: if rover.${m[1]}()${m[1] === 'sense_ahead' ? ' == "clear"' : m[1] === 'battery' ? ' < 30' : ''}:`;
    const type = MR.PY2CMD[m[1]];
    if (!type) throw `Line ${n}: the rover has no command called ${m[1]}(). Try: ${Object.values(MR.CMDS).filter(c => c.py).map(c => c.py).join(', ')}.`;
    if (MR.CMDS[type].macro) { if (!opts.relay) throw `Line ${n}: ${m[1]}() needs the satellite relay kit. It unlocks at the next rank.`;
      body.push({n:'macro', kind:MR.CMDS[type].macro, idx:n}); dynamic = true; continue; }
    if (MR.CMDS[type].arg) { if (!m[2]) throw `Line ${n}: ${m[1]}() needs a number of squares, like rover.${m[1]}(3).`; if (+m[2] < 1 || +m[2] > 20) throw `Line ${n}: use a number from 1 to 20.`; }
    else if (m[2]) throw `Line ${n}: ${m[1]}() does not take a number.`;
    const key = ind + ':' + text; repeat = key === lastKey ? repeat + 1 : 1; maxRepeat = Math.max(maxRepeat, repeat); lastKey = key;
    body.push({n:'cmd', type, arg: MR.CMDS[type].arg ? +m[2] : undefined, idx:n});
  }
  if (pending) throw `The last "${pending.what}" has nothing inside it.`;
  for (const [nm, n] of calls) if (!defs[nm]) throw `Line ${n}: there is no def ${nm}(): in this program.`;
  const info = {loops:hasLoop, lines:used, nested:depth >= 2, maxRepeat};
  const out = [];
  const run = (body, stop) => { for (const s2 of body) { if (out.length > maxCmd) return false;
    if (s2.n === 'repeat') { for (let k=0;k<s2.times;k++) if (run(s2.body, stop) === false) return false; }
    else if (s2.n === 'cmd') out.push({type:s2.type, arg:s2.arg, idx:s2.idx});
    else if (stop) return false; } return true; };
  if (!dynamic) {
    run(root, false);
    if (out.length > maxCmd) throw `That program makes more than ${maxCmd} moves. The rover can only do ${maxCmd} per sol. Try a while loop with a sensor instead.`;
    return {actions:out, ...info};
  }
  run(root, true);
  return {actions:out.slice(0, maxCmd), program:{sols, perSol, body:root, defs}, dynamic:true, ...info};
}
})();
