/* Game data: terrain, roles, jobs, commands, cards, patches, perks, ranks, maps. */
(function () {
const MR = window.MR = window.MR || {};

MR.VERSION = 2;
MR.MW = 64; MR.MH = 44; MR.BASE = 32;
MR.MAX_PLAYERS = 6;

MR.T = {FLOOR:0, BED:1, DUNE:2, DELTA:3, CHAN:4, RIM:5, HILL:6, CLIFF:7, PLATE:8};
MR.TER = [
  {name:'Crater floor', cost:2},
  {name:'Bedrock', cost:2},
  {name:'Dunes', cost:4, sandy:true},
  {name:'Delta sediment', cost:2},
  {name:'Dry river channel', cost:2},
  {name:'Crater rim', block:'the crater rim is too steep'},
  {name:'Hills', cost:5, hilly:true},
  {name:'Cliffs', block:'the slope is too steep'},
  {name:'Layered plateau', cost:2},
];

MR.DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
MR.DIRNAME = ['North','East','South','West'];

MR.COLORS = [
  {id:'teal', hex:'#58cfbe', name:'Teal'},
  {id:'orange', hex:'#ff9a4d', name:'Orange'},
  {id:'violet', hex:'#b48ce8', name:'Violet'},
  {id:'yellow', hex:'#f2d15c', name:'Yellow'},
  {id:'blue', hex:'#6aa8ff', name:'Blue'},
  {id:'pink', hex:'#ff7fb0', name:'Pink'},
];
MR.colorHex = id => (MR.COLORS.find(c => c.id === id) || MR.COLORS[0]).hex;

MR.ROLES = {
  cadet:      {label:'Cadet', ages:'Ages 4–7', desc:'Picture buttons. No reading needed.', solar:0, maxCmd:5, tubes:0, slots:0},
  explorer:   {label:'Explorer', ages:'Ages 8–12', desc:'Plan with blocks and numbers.', solar:30, maxCmd:12, tubes:8, slots:3},
  specialist: {label:'Specialist', ages:'Ages 13+', desc:'Write Python with loops.', solar:20, maxCmd:40, tubes:6, slots:2},
};

MR.JOBS = {
  buggy:     {label:'Buggy', roles:['cadet'], desc:'A tough little rover that digs up treasure. It never gets stuck.'},
  heli:      {label:'Helicopter', roles:['cadet'], desc:'Flies over rocks and spots treasure for the team, like Ingenuity.'},
  scout:     {label:'Scout', roles:['explorer','specialist'], desc:'Sees 1 square farther and scans 6 squares wide.'},
  science:   {label:'Science', roles:['explorer','specialist'], desc:'Analyze identifies every signal within 2 squares.'},
  hauler:    {label:'Hauler', roles:['explorer','specialist'], desc:'Carries 4 extra sample tubes.'},
  excavator: {label:'Excavator', roles:['explorer','specialist'], desc:'Dig clears a rock or sand trap in front. It never gets stuck.'},
};
MR.defaultJob = role => role === 'cadet' ? 'buggy' : 'scout';

MR.CMDS = {
  forward: {label:'Forward', icon:'↑', cat:'move', arg:true, cost:'2% / square', py:'forward'},
  back:    {label:'Back', icon:'↓', cat:'move', arg:true, cost:'2% / square', py:'backward'},
  left:    {label:'Turn left', icon:'↶', cat:'move', cost:'1%', py:'turn_left'},
  right:   {label:'Turn right', icon:'↷', cat:'move', cost:'1%', py:'turn_right'},
  scan:    {label:'Scan', icon:'◎', cat:'sci', cost:'5%', py:'scan'},
  analyze: {label:'Analyze', icon:'◈', cat:'sci', cost:'2%', py:'analyze'},
  drill:   {label:'Drill', icon:'⊛', cat:'sci', cost:'8%', py:'drill'},
  dig:     {label:'Dig', icon:'▲', cat:'build', cost:'6%', py:'dig', jobs:['excavator']},
  charge:  {label:'Charge', icon:'ϟ', cat:'power', cost:'+15%', py:'charge'},
};
MR.PY2CMD = Object.fromEntries(Object.entries(MR.CMDS).map(([k, v]) => [v.py, k]));
MR.cmdsFor = (role, job) => role === 'cadet' ? ['left','forward','right','drill']
  : Object.keys(MR.CMDS).filter(k => !MR.CMDS[k].jobs || MR.CMDS[k].jobs.includes(job));

MR.RARITY = {
  C:{name:'Common', xp:5, col:'#9aa7b3'},
  U:{name:'Uncommon', xp:15, col:'#86d48f'},
  R:{name:'Rare', xp:30, col:'#6aa8ff'},
  L:{name:'Legendary', xp:60, col:'#f0bf5a'},
  A:{name:'Artifact', xp:80, col:'#ff9a4d'},
};

MR.CARDS = {
  basalt:    {name:'Basalt', kid:'Rock', rar:'C', color:'#7a645a', pts:5, maps:['jezero','gusev'],
    fact:'Dark volcanic rock, the most common rock on Mars. Lava flows covered much of the planet billions of years ago.'},
  olivine:   {name:'Olivine', kid:'Green crystal', rar:'U', color:'#9cc35a', pts:30, maps:['jezero','gusev'],
    fact:'A green volcanic crystal. It breaks down quickly in water, so finding lots of it tells scientists the rock stayed dry for a long time.'},
  clay:      {name:'Clay', kid:'Mud rock', rar:'U', color:'#5fb7a8', pts:30, maps:['jezero'],
    fact:"Clay forms when water soaks rock for a long time. Jezero's delta is full of it, which is why Perseverance landed there."},
  salts:     {name:'Sulfate salts', kid:'Water salt', rar:'U', color:'#7fb2ff', pts:40, maps:['jezero','gusev'],
    fact:'Salts left behind when salty water dried up. Some hold water inside their crystals. Spirit dug some up by accident with a stuck wheel.'},
  carbonate: {name:'Carbonate', kid:'Lake rock', rar:'R', color:'#e8dab0', pts:50, maps:['jezero','gusev'],
    fact:'Carbonates form in water, often at the edges of lakes. On Earth they can lock away traces of tiny living things.'},
  meteorite: {name:'Iron-nickel meteorite', kid:'Space metal', rar:'R', color:'#c2c9d1', pts:60, maps:['jezero','gusev'],
    fact:'A chunk of metal that fell from space. Rovers have found several on Mars. Future builders could use the metal.'},
  silica:    {name:'Silica', kid:'Glass rock', rar:'R', color:'#f4f1ea', pts:70, maps:['gusev'],
    fact:'Almost pure silica, like glass. On Earth it forms around hot springs, which are great homes for microbes. Spirit found it next to Home Plate.'},
  organics:  {name:'Organic molecules', kid:'Life clue', rar:'L', color:'#b48ce8', pts:120, maps:['jezero'],
    fact:'Carbon-based molecules are building blocks of life. Not proof of life, but a big clue. Perseverance found organics in Jezero rocks.'},
  art_backshell: {name:"Perseverance's backshell", rar:'A', color:'#e6e2da', pts:100, maps:['jezero'], artifact:true,
    fact:"The cone-shaped shell that protected Perseverance as it fell through the Martian air in 2021. Ingenuity photographed it lying in the sand."},
  art_ingenuity: {name:'Ingenuity helicopter', rar:'A', color:'#d0d6dc', pts:100, maps:['jezero'], artifact:true,
    fact:'The first aircraft to fly on another planet. It made 72 flights before a broken rotor blade ended its mission in January 2024. It is still standing where it last landed.'},
  art_spirit: {name:'Spirit rover', rar:'A', color:'#d8d2c4', pts:100, maps:['gusev'], artifact:true,
    fact:'Spirit got stuck in soft sand at a spot called Troy in 2009 and sent its last message in 2010. It is still parked there today.'},
};
MR.CARD_ORDER = Object.keys(MR.CARDS);

/* Patches: test(stats) */
MR.PATCHES = [
  {id:'first_steps', name:'First Steps', icon:'↑', desc:'Drive or fly 10 squares', test:s => s.squares + s.flown >= 10},
  {id:'road_trip', name:'Road Trip', icon:'⇢', desc:'Drive 200 squares', test:s => s.squares >= 200},
  {id:'first_sample', name:'First Sample', icon:'⊛', desc:'Drill your first sample', test:s => s.samples >= 1},
  {id:'rock_collector', name:'Rock Collector', icon:'◆', desc:'Drill 25 samples', test:s => s.samples >= 25},
  {id:'delivery', name:'Special Delivery', icon:'⌂', desc:'Deliver 5 samples to the station', test:s => s.delivered >= 5},
  {id:'hauler_hero', name:'Hauler Hero', icon:'▣', desc:'Deliver 25 samples', test:s => s.delivered >= 25},
  {id:'eagle_eye', name:'Eagle Eye', icon:'◎', desc:'Scan 10 times', test:s => s.scans >= 10},
  {id:'lab_rat', name:'Lab Rat', icon:'◈', desc:'Identify 10 signals', test:s => s.identified >= 10},
  {id:'spirits_luck', name:"Spirit's Luck", icon:'≈', desc:'Get stuck in a sand trap', test:s => s.stuck >= 1},
  {id:'escape', name:'Escape Artist', icon:'↩', desc:'Back out of a sand trap', test:s => s.freed >= 1},
  {id:'bump_buddy', name:'Bump Buddy', icon:'✷', desc:'Bump into things 10 times', test:s => s.bumps >= 10},
  {id:'treasure5', name:'Treasure Hunter', icon:'✦', desc:'Find 5 treasures', test:s => s.treasures >= 5},
  {id:'treasure25', name:'Treasure Master', icon:'✪', desc:'Find 25 treasures', test:s => s.treasures >= 25},
  {id:'heli_ace', name:'Helicopter Ace', icon:'✣', desc:'Fly 50 squares', test:s => s.flown >= 50},
  {id:'bulldozer', name:'Bulldozer', icon:'▲', desc:'Clear 3 rocks or sand traps', test:s => s.cleared >= 3},
  {id:'loop', name:'Loop de Loop', icon:'↻', desc:'Run a program with a for loop', test:s => s.loops >= 1},
  {id:'clean_code', name:'Clean Code', icon:'≡', desc:'Run 10 or more actions from 5 or fewer lines', test:s => s.clean >= 1},
  {id:'shiny', name:'Perfect Specimen', icon:'✧', desc:'Find a shiny sample', test:s => s.shinies >= 1},
  {id:'historian', name:'Historian', icon:'⚑', desc:'Find a piece of Mars history', test:s => s.artifacts >= 1},
  {id:'life_clue', name:'Life Clue', icon:'❋', desc:'Find organic molecules', test:s => s.organics >= 1},
  {id:'jezero', name:'Jezero Expedition', icon:'J', desc:'Complete a Jezero expedition', test:s => (s.exp.jezero||0) >= 1},
  {id:'gusev', name:'Gusev Expedition', icon:'G', desc:'Complete a Gusev expedition', test:s => (s.exp.gusev||0) >= 1},
  {id:'full_crew', name:'Full Crew', icon:'⁂', desc:'Play a team game with 3 or more players', test:s => s.crew3 >= 1},
  {id:'team_player', name:'Team Player', icon:'⇄', desc:'Finish 5 team expeditions', test:s => s.teamWins >= 5},
];

MR.RANKS = [
  {name:'Trainee', xp:0},
  {name:'Rover Driver', xp:100},
  {name:'Field Geologist', xp:300},
  {name:'Science Lead', xp:700},
  {name:'Mission Specialist', xp:1300},
  {name:'Flight Director', xp:2200},
];
MR.rankOf = xp => { let r = 0; MR.RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; };

/* Gameplay perks for Explorer and Specialist, unlocked by rank index. */
MR.PERKS = {
  wide_wheels: {name:'Wide wheels', tier:'Common', rank:1, icon:'◍', desc:'Dunes and hills cost 2% less power per square.', real:'Curiosity\'s wheels wore out on sharp rocks, so Perseverance got wider, thicker wheels.'},
  sharp_eyes:  {name:'Sharp eyes', tier:'Common', rank:2, icon:'◉', desc:'See 1 square farther and scan 1 square wider.', real:'Perseverance has 23 cameras, more than any Mars mission before it.'},
  supercam:    {name:'SuperCam laser', tier:'Rare', rank:3, icon:'✶', desc:'Analyze also zaps signals up to 3 squares straight ahead.', real:'SuperCam zaps rocks with a laser from up to 7 meters away and reads the glow.'},
  big_battery: {name:'Big battery', tier:'Rare', rank:4, icon:'▮', desc:'The battery holds 150% instead of 100%.', real:'Rovers store energy in lithium-ion batteries, like a phone but much tougher.'},
  better_radio: {name:'Better radio', tier:'Common', rank:1, icon:'≋', desc:'Your commands reach the rover 30% faster.', real:'Rovers usually talk to Earth through orbiters like Mars Reconnaissance Orbiter, using a UHF radio.'},
  hg_antenna:  {name:'High-gain antenna', tier:'Rare', rank:3, icon:'⌔', desc:'Your commands reach the rover twice as fast.', real:"Perseverance's high-gain antenna can talk straight to Earth without an orbiter."},
};
/* Cadet perks are automatic. */
MR.CADET_LEN = rank => 5 + Math.min(3, rank);
MR.cadetMagnet = rank => rank >= 2;
/* Signal delay for one sol: 5–10 s with the stock antenna, the same for the whole team that sol
   (like the changing Earth–Mars distance). Radio and antenna perks shorten it. Cadets get them by rank. */
MR.uplinkMs = (st, r) => {
  const h = Math.sin((st.seed % 100000) * 12.9898 + st.sol * 78.233) * 43758.5453, frac = h - Math.floor(h);
  let ms = 5000 + 5000 * frac;
  const radio = r && (r.role === 'cadet' ? r.rank >= 1 : (r.perks || []).includes('better_radio'));
  const antenna = r && (r.role === 'cadet' ? r.rank >= 3 : (r.perks || []).includes('hg_antenna'));
  if (radio) ms *= .7;
  if (antenna) ms *= .5;
  const q = new URLSearchParams(location.search).get('uplink');
  return ms * (q != null ? Math.max(0, +q) : 1);
};
MR.antennaName = r => { const radio = r.role === 'cadet' ? r.rank >= 1 : (r.perks||[]).includes('better_radio'), ant = r.role === 'cadet' ? r.rank >= 3 : (r.perks||[]).includes('hg_antenna');
  return ant && radio ? 'High-gain antenna and better radio' : ant ? 'High-gain antenna' : radio ? 'Better radio' : 'Stock antenna'; };

/* Maps */
MR.MAPS = {
  jezero: {
    name:'Jezero Crater', rover:'Perseverance', year:'2021–today', unlock:null,
    blurb:'An ancient lake with a river delta. Perseverance is searching here for signs of past life.',
    station:{x:34, y:22}, startDir:3,
    labels:[{t:'JEZERO DELTA', x:15, y:12},{t:'NERETVA VALLIS', x:6, y:6.2},{t:'SÉÍTAH', x:23, y:31},{t:'CRATER RIM', x:6, y:24},{t:'MÁAZ PLAINS', x:44, y:30}],
    regions:['Crater floor','Máaz bedrock','Séítah dunes','Jezero delta','Neretva Vallis','Crater rim','Hills','Cliffs','Plateau'],
    goals:(n) => [
      {t:'Drill clay on the delta', kind:'col', res:'clay', of:1},
      {t:'Drill olivine in Séítah', kind:'col', res:'olivine', of:1},
      {t:'Find organic molecules', kind:'col', res:'organics', of:1},
      {t:`Bring ${2+n} samples to the station`, kind:'deliver', of:2+n},
    ],
    par:8,
  },
  gusev: {
    name:'Gusev Crater', rover:'Spirit', year:'2004–2010', unlock:'jezero',
    blurb:'Wide plains, the Columbia Hills and sand traps everywhere. Spirit explored here until it got stuck.',
    station:{x:9, y:21}, startDir:1,
    labels:[{t:'COLUMBIA HILLS', x:33, y:11},{t:'HUSBAND HILL', x:35, y:17.5},{t:'HOME PLATE', x:41, y:26},{t:'TROY', x:36, y:33.2},{t:'BONNEVILLE', x:17, y:9.8},{t:"MA'ADIM VALLIS", x:21, y:40}],
    regions:['Gusev plains','Basalt plains','Sand ripples','Delta sediment',"Ma'adim Vallis",'Crater rim','Columbia Hills','Cliffs','Home Plate'],
    goals:(n) => [
      {t:'Drill silica near Home Plate', kind:'col', res:'silica', of:1},
      {t:'Drill carbonate in the hills', kind:'col', res:'carbonate', of:1},
      {t:'Drill sulfate salts', kind:'col', res:'salts', of:1},
      {t:`Bring ${2+n} samples to the station`, kind:'deliver', of:2+n},
    ],
    par:9,
  },
};
MR.MAP_ORDER = ['jezero','gusev'];
MR.cadetGoals = n => [{t:`Find ${3+2*n} treasures`, kind:'treasure', of:3+2*n}];

const KEYS = 'Keys: I or E opens your inventory, T talks to the team, Tab looks at the next rover, WASD moves the camera, F follows your rover, + and − zoom, Esc closes windows.';
MR.HOW = {
  cadet:['Tap the picture buttons to plan your moves. Each arrow is one square.','Press the big GO button and watch your rover.','Land on a sparkly gem and dig to find treasure!','Press I to open your treasure chest.','Keys: arrow keys add arrows, Space adds dig, Backspace removes, Enter is GO.'],
  explorer:['Build a plan of up to 12 blocks, then press Send (or Ready in a team game).','Scan shows mystery signals (?). Drive onto one, Analyze it, then Drill to fill a sample tube.','Dunes use more power and can hide sand traps. If you get stuck, Back up 1 square.','Drive onto the station to unload samples and recharge. Each night the solar panels add 30%.','1–9 add commands, Backspace removes the last one, Enter sends.', KEYS],
  specialist:['Write your plan in Python. Supports rover commands and for loops, up to 40 moves per sol.','Only 6 sample tubes and weaker solar (20% a night). Analyze before you Drill.','Drive onto the station to unload samples and recharge.','Ctrl+Enter sends your program.', KEYS],
};
})();
