/* Game data: terrain, roles, jobs, commands, cards, patches, perks, ranks, maps. */
(function () {
const MR = window.MR = window.MR || {};

MR.VERSION = 4;
MR.MW = 64; MR.MH = 44; MR.BASE = 32;
MR.MAX_PLAYERS = 6;

MR.T = {FLOOR:0, BED:1, DUNE:2, DELTA:3, CHAN:4, RIM:5, HILL:6, CLIFF:7, PLATE:8, RILLE:9};
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
  {name:'Rille canyon', block:'the rille is a deep canyon'},
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
  buggy:     {label:'Buggy', roles:['cadet'], desc:'A tough little rover like Sojourner, the first rover on Mars. It digs up treasure and never gets stuck.'},
  heli:      {label:'Helicopter', roles:['cadet'], desc:'Flies over rocks and spots treasure for the team, like Ingenuity.'},
  scout:     {label:'Scout', roles:['explorer','specialist'], desc:'Sees 1 square farther and scans 6 squares wide. Flags finds for the team. In team games it carries 2 fewer tubes.'},
  science:   {label:'Science', roles:['explorer','specialist'], desc:'Analyze identifies every signal within 2 squares.'},
  hauler:    {label:'Hauler', roles:['explorer','specialist'], desc:'Carries 4 extra sample tubes.'},
  excavator: {label:'Excavator', roles:['explorer','specialist'], desc:'Dig clears a rock or sand trap in front. It never gets stuck.'},
  lab:       {label:'Lab', roles:['explorer','specialist'], desc:"Stays at the station. Catalogs the team's samples and turns them into water, metal, bricks and glass to build base upgrades."},
};
MR.defaultJob = role => role === 'cadet' ? 'buggy' : 'scout';

/* A small sample vial, drawn in the icon's text color. */
MR.ICON_VIAL = '<svg class="svgic" viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(28 12 12)"><path d="M7 3h10M8.6 3v13a3.4 3.4 0 0 0 6.8 0V3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.6 10.5h6.8V16a3.4 3.4 0 0 1-6.8 0z" fill="currentColor"/></g></svg>';
MR.CMDS = {
  forward: {label:'Forward', icon:'↑', cat:'move', arg:true, cost:'2% / square', py:'forward'},
  back:    {label:'Back', icon:'↓', cat:'move', arg:true, cost:'2% / square', py:'backward'},
  left:    {label:'Turn left', icon:'↶', cat:'move', cost:'1%', py:'turn_left'},
  right:   {label:'Turn right', icon:'↷', cat:'move', cost:'1%', py:'turn_right'},
  scan:    {label:'Scan', icon:'◎', cat:'sci', cost:'5%', py:'scan'},
  analyze: {label:'Analyze', icon:MR.ICON_VIAL, cat:'sci', cost:'2%', py:'analyze'},
  drill:   {label:'Drill', icon:'⊛', cat:'sci', cost:'8%', py:'drill'},
  dig:     {label:'Dig', icon:'▲', cat:'build', cost:'6%', py:'dig', jobs:['excavator']},
  charge:  {label:'Charge', icon:'ϟ', cat:'power', cost:'+15%', py:'charge'},
  photo:   {label:'Photo', icon:'▣', cat:'sci', cost:'1%', py:'photo'},
  go_signal: {label:'Go to signal', icon:'⌖', cat:'move', cost:'2% / square', py:'go_to_signal', macro:'go_signal', relay:true},
  go_home:   {label:'Go home', icon:'⌂', cat:'move', cost:'2% / square', py:'go_home', macro:'go_home', relay:true},
  catalog: {label:'Catalog samples', icon:'▤', cat:'sci', cost:'free', lab:'catalog', jobs:['lab']},
  make_water:  {label:'Make water', icon:'≈', cat:'build', cost:'from salts', lab:'make', mat:'water', jobs:['lab']},
  make_metal:  {label:'Make metal', icon:'⚙', cat:'build', cost:'from meteorites, hematite', lab:'make', mat:'metal', jobs:['lab']},
  make_bricks: {label:'Make bricks', icon:'▦', cat:'build', cost:'from clay, basalt', lab:'make', mat:'bricks', jobs:['lab']},
  make_glass:  {label:'Make glass', icon:'◇', cat:'build', cost:'from silica, basalt', lab:'make', mat:'glass', jobs:['lab']},
  build_solar_farm:  {label:'Build solar farm', icon:'☼', cat:'power', cost:'2 glass, 2 metal', lab:'build', up:'solar_farm', jobs:['lab']},
  build_radio_tower: {label:'Build radio tower', icon:'⌁', cat:'power', cost:'3 metal', lab:'build', up:'radio_tower', jobs:['lab']},
  build_garage:      {label:'Build garage', icon:'⌂', cat:'power', cost:'3 bricks, 1 metal', lab:'build', up:'garage', jobs:['lab']},
  build_greenhouse:  {label:'Build greenhouse', icon:'❦', cat:'power', cost:'3 water, 2 bricks', lab:'build', up:'greenhouse', jobs:['lab']},
};
/* Satellite relay kit: smart blocks and programs that run for more than one sol. Unlocks at the second rank. */
MR.relayOK = r => !!r && r.role !== 'cadet' && r.job !== 'lab' && (r.rank|0) >= 1;
MR.BLOCKS = {
  repeat:     {label:'Repeat', icon:'⟲', arg:true, def:3, max:10, py:n => `for i in range(${n}):`, desc:'Repeat the blocks inside'},
  if_signal:  {label:'If on a signal', icon:'?', cond:{c:'signal_here'}, py:() => 'if rover.signal_here():', desc:'Only if the rover is on a mystery signal'},
  if_worth:   {label:'If worth drilling', icon:MR.ICON_VIAL, cond:{c:'worth'}, py:() => 'if rover.worth_drilling():', desc:'Only if Analyze found something good here'},
  if_clear:   {label:'If path clear', icon:'⇡', cond:{c:'ahead', op:'==', v:'clear'}, py:() => 'if rover.sense_ahead() == "clear":', desc:'Only if the square ahead is safe'},
  until_full: {label:'Until full or low battery', icon:'⧗', cond:{c:'and', a:{c:'not', a:{c:'tubes_full'}}, b:{c:'bat', op:'>', v:40}}, loop:true, relay:true, py:() => 'while not rover.tubes_full() and rover.battery() > 40:', desc:'Keep going until the tubes are full or the battery is down to 40% (at most 30 times)'},
};
/* Ready-made programs. Blocks for Explorers, Python for Specialists. */
MR.RECIPES = [
  {id:'hunter', name:'Signal hunter', icon:'⌖', desc:'Scan, visit each signal, analyze it, drill the good ones, then go home. Runs again the next sol.', relay:true, sols:2,
    blocks:[{type:'scan'}, {type:'until_full', body:[{type:'go_signal'},{type:'analyze'},{type:'if_worth', body:[{type:'drill'}]}]}, {type:'go_home'}],
    py:'from mars import rover\n\nfor sol in rover.mission(2):\n    rover.scan()\n    while not rover.tubes_full() and rover.battery() > 40:\n        rover.go_to_signal()\n        rover.analyze()\n        if rover.worth_drilling():\n            rover.drill()\n    rover.go_home()\n'},
  {id:'survey', name:'Survey square', icon:'▢', desc:'Drive a big square and scan at every corner.', sols:1,
    blocks:[{type:'repeat', arg:4, body:[{type:'forward', arg:4},{type:'scan'},{type:'right'}]}],
    py:'from mars import rover\n\nfor i in range(4):\n    rover.forward(4)\n    rover.scan()\n    rover.turn_right()\n'},
  {id:'careful', name:'Careful driver', icon:'⇡', desc:'Drive ahead only while the way is clear. Turns at rocks.', sols:1,
    blocks:[{type:'repeat', arg:8, body:[{type:'if_clear', body:[{type:'forward', arg:1}]}]}, {type:'scan'}],
    py:'from mars import rover\n\nfor i in range(10):\n    if rover.sense_ahead() == "clear":\n        rover.forward(1)\n    else:\n        rover.turn_right()\nrover.scan()\n'},
  {id:'homerun', name:'Home run', icon:'⌂', desc:'Find the way back to the station and unload.', relay:true, sols:1,
    blocks:[{type:'go_home'}], py:'from mars import rover\n\nrover.go_home()\n'},
];
MR.PY2CMD = Object.fromEntries(Object.entries(MR.CMDS).filter(([, v]) => v.py).map(([k, v]) => [v.py, k]));
/* The Python line for a command (rover.forward(3), lab.make("water"), ...). */
MR.pyOf = (type, arg) => { const c = MR.CMDS[type]; if (!c) return '';
  if (c.lab === 'catalog') return 'lab.catalog()'; if (c.lab === 'make') return `lab.make("${c.mat}")`; if (c.lab === 'build') return `lab.build("${c.up}")`;
  return `rover.${c.py}(${c.arg ? (arg || 1) : ''})`; };
/* Lab: which samples make which material (science-only finds are never processed), and the base upgrades. */
MR.MATS = {water:{name:'Water', from:{salts:2, clay:1, serpentine:1}}, metal:{name:'Metal', from:{meteorite:2, hematite:2, olivine:1}},
  bricks:{name:'Bricks', from:{clay:1, basalt:1, carbonate:1, breccia:1, moon_basalt:1}}, glass:{name:'Glass', from:{silica:2, glass:2, basalt:1}}};
MR.UPGRADES = {
  solar_farm:  {name:'Solar farm', icon:'☼', cost:{glass:2, metal:2}, desc:'Every rover charges 10% more each night.'},
  radio_tower: {name:'Radio tower', icon:'⌁', cost:{metal:3}, desc:'Signals reach the rovers 25% faster.'},
  garage:      {name:'Garage', icon:'⌂', cost:{bricks:3, metal:1}, desc:'Wheels and solar panels wear half as fast.'},
  greenhouse:  {name:'Greenhouse', icon:'❦', cost:{water:3, bricks:2}, desc:'Everyone earns 10% more XP.'},
};
MR.cmdsFor = (role, job) => role === 'cadet' ? ['left','forward','right','drill'] : job === 'lab' ? Object.keys(MR.CMDS).filter(k => MR.CMDS[k].lab)
  : Object.keys(MR.CMDS).filter(k => !MR.CMDS[k].jobs || MR.CMDS[k].jobs.includes(job));

MR.RARITY = {
  C:{name:'Common', xp:5, col:'#9aa7b3'},
  U:{name:'Uncommon', xp:15, col:'#86d48f'},
  R:{name:'Rare', xp:30, col:'#6aa8ff'},
  L:{name:'Legendary', xp:60, col:'#f0bf5a'},
  A:{name:'Artifact', xp:80, col:'#ff9a4d'},
};

MR.CARDS = {
  basalt:    {name:'Basalt', kid:'Rock', rar:'C', color:'#7a645a', pts:5, maps:['jezero','gusev','meridiani','gale'],
    fact:'Dark volcanic rock, the most common rock on Mars. Lava flows covered much of the planet billions of years ago.'},
  olivine:   {name:'Olivine', kid:'Green crystal', rar:'U', color:'#9cc35a', pts:30, maps:['jezero','gusev','gale'],
    fact:'A green volcanic crystal. It breaks down quickly in water, so finding lots of it tells scientists the rock stayed dry for a long time.'},
  clay:      {name:'Clay', kid:'Mud rock', rar:'U', color:'#5fb7a8', pts:30, maps:['jezero','meridiani','gale'],
    fact:"Clay forms when water soaks rock for a long time. Jezero's delta is full of it, which is why Perseverance landed there."},
  salts:     {name:'Sulfate salts', kid:'Water salt', rar:'U', color:'#7fb2ff', pts:40, maps:['jezero','gusev','meridiani','gale'],
    fact:'Salts left behind when salty water dried up. Some hold water inside their crystals. Spirit dug some up by accident with a stuck wheel.'},
  carbonate: {name:'Carbonate', kid:'Lake rock', rar:'R', color:'#e8dab0', pts:50, maps:['jezero','gusev'],
    fact:'Carbonates form in water, often at the edges of lakes. On Earth they can lock away traces of tiny living things.'},
  meteorite: {name:'Iron-nickel meteorite', kid:'Space metal', rar:'R', color:'#c2c9d1', pts:60, maps:['jezero','gusev','meridiani','gale'],
    fact:'A chunk of metal that fell from space. Rovers have found several on Mars. Future builders could use the metal.'},
  silica:    {name:'Silica', kid:'Glass rock', rar:'R', color:'#f4f1ea', pts:70, maps:['gusev'],
    fact:'Almost pure silica, like glass. On Earth it forms around hot springs, which are great homes for microbes. Spirit found it next to Home Plate.'},
  organics:  {name:'Organic molecules', kid:'Life clue', rar:'L', color:'#b48ce8', pts:120, maps:['jezero','gale'],
    fact:'Carbon-based molecules are building blocks of life. Not proof of life, but a big clue. Perseverance found organics in Jezero rocks.'},
  art_backshell: {name:"Perseverance's backshell", rar:'A', color:'#e6e2da', pts:100, maps:['jezero'], artifact:true,
    fact:"The cone-shaped shell that protected Perseverance as it fell through the Martian air in 2021. Ingenuity photographed it lying in the sand."},
  art_ingenuity: {name:'Ingenuity helicopter', rar:'A', color:'#d0d6dc', pts:100, maps:['jezero'], artifact:true,
    fact:'The first aircraft to fly on another planet. It made 72 flights before a broken rotor blade ended its mission in January 2024. It is still standing where it last landed.'},
  moon_basalt: {name:'Mare basalt', kid:'Moon lava rock', rar:'C', color:'#5f6066', pts:5, maps:['moon'],
    fact:"Dark lava rock that flooded the Moon's giant basins more than 3 billion years ago. The dark patches you can see on the Moon are basalt."},
  breccia: {name:'Breccia', kid:'Smashed rock', rar:'U', color:'#a9a39a', pts:30, maps:['moon'],
    fact:'Rock made of broken pieces glued back together by meteorite impacts. Most of the Moon is covered in it.'},
  glass: {name:'Green glass beads', kid:'Green glass', rar:'R', color:'#7ccf8a', pts:70, maps:['moon'],
    fact:'Tiny green glass beads from volcanic fire fountains. The Apollo 15 astronauts found them near Hadley Rille in 1971.'},
  anorthosite: {name:'Genesis Rock (anorthosite)', kid:'Moon crystal', rar:'L', color:'#f1efe8', pts:120, maps:['moon'],
    fact:"Apollo 15's most famous find: a piece of the Moon's ancient crust, about 4 billion years old, picked up at Spur crater."},
  art_retro: {name:'Laser retroreflector', rar:'A', color:'#c9ced4', pts:100, maps:['moon'], artifact:true,
    fact:'Apollo astronauts left mirrors on the Moon. Scientists still bounce lasers off them today to measure the distance to the Moon to within a few millimeters.'},
  art_feather: {name:'Hammer and feather', rar:'A', color:'#e6e2da', pts:100, maps:['moon'], artifact:true,
    fact:'Commander Dave Scott dropped a hammer and a falcon feather at the same moment. With no air, they hit the ground together, just as Galileo predicted.'},
  art_opportunity: {name:'Opportunity rover', rar:'A', color:'#d8d2c4', pts:100, maps:['meridiani'], artifact:true,
    fact:'Opportunity was planned to last 90 sols and kept going for almost 15 years, driving more than 45 kilometers. Its last signal came in June 2018, during a dust storm that covered the whole planet. It rests in Perseverance Valley.'},
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
  {id:'meridiani', name:'Meridiani Expedition', icon:'M', desc:'Complete a Meridiani expedition', test:s => (s.exp.meridiani||0) >= 1},
  {id:'gale', name:'Gale Expedition', icon:'⛰', desc:'Complete a Gale expedition', test:s => (s.exp.gale||0) >= 1},
  {id:'moonwalker', name:'Moonwalker', icon:'☾', desc:'Complete an expedition on the Moon', test:s => (s.exp.moon||0) >= 1},
  {id:'genesis', name:'Genesis', icon:'◇', desc:'Find the Genesis Rock', test:s => s.genesis >= 1},
  {id:'full_crew', name:'Full Crew', icon:'⁂', desc:'Play a team game with 3 or more players', test:s => s.crew3 >= 1},
  {id:'team_player', name:'Team Player', icon:'⇄', desc:'Finish 5 team expeditions', test:s => s.teamWins >= 5},
  {id:'hello_mars', name:'Hello, Mars', icon:'›', desc:'Send your first Python program', test:s => s.programs >= 1},
  {id:'perfect_plan', name:'Perfect Plan', icon:'★', desc:'Get 3 plan stars in one sol', test:s => s.stars3 >= 1},
  {id:'master_planner', name:'Master Planner', icon:'✬', desc:'Get 3 plan stars 10 times', test:s => s.stars3 >= 10},
  {id:'loop_in_loop', name:'Loop in a Loop', icon:'⟲', desc:'Run a for loop inside another for loop', test:s => s.nested >= 1},
  {id:'mission_control', name:'Mission Control', icon:'⌁', desc:'Run a program for 2 or more sols with the relay satellite', test:s => s.missions >= 1},
  {id:'smart_rover', name:'Smart Rover', icon:'◇', desc:'Send a program that uses a sensor', test:s => s.sensors >= 1},
  {id:'life_hunter', name:'Life Hunter', icon:'❋', desc:'Find 6 of the 12 signs of a living Mars', test:s => s.life12 >= 6},
  {id:'element_explorer', name:'Element Explorer', icon:'⚛', desc:'Light up 10 elements on the minerals chart', test:s => s.elements >= 10},
  {id:'family_row', name:'Mineral Family', icon:'▦', desc:'Complete a whole family row on the minerals chart', test:s => s.familyRows >= 1},
  {id:'pathfinder', name:'Pathfinder', icon:'⚐', desc:'Flag 10 sites for the team', test:s => s.sitesFound >= 10},
  {id:'trailblazer', name:'Trailblazer', icon:'⚑', desc:'Teammates drill 5 sites you found', test:s => s.sitesShared >= 5},
  {id:'archivist', name:'Archivist', icon:'▤', desc:'Catalog 10 samples in the Lab', test:s => s.cataloged >= 10},
  {id:'builder', name:'Base Builder', icon:'⌂', desc:'Build a base upgrade', test:s => s.builds >= 1},
  {id:'storm_survivor', name:'Storm Survivor', icon:'≋', desc:'Keep working through a dust storm', test:s => s.stormSols >= 1},
  {id:'lucky_gust', name:'Lucky Gust', icon:'∿', desc:'Have your solar panels cleaned by the wind', test:s => s.cleaned >= 1},
  {id:'log_week1', name:'Jezero Week', icon:'1', desc:'Finish week 1 of the Mission Log', test:s => s.logWeeks >= 1},
  {id:'log_week2', name:'Gusev Week', icon:'2', desc:'Finish week 2 of the Mission Log', test:s => s.logWeeks >= 2},
  {id:'log_week3', name:'Moon Week', icon:'3', desc:'Finish week 3 of the Mission Log', test:s => s.logWeeks >= 3},
  {id:'log_week4', name:'Meridiani and Gale Week', icon:'4', desc:'Finish week 4 of the Mission Log', test:s => s.logWeeks >= 4},
  {id:'log_done', name:'Mission Log Complete', icon:'✪', desc:'Finish all 30 days of the Mission Log', test:s => s.logDays >= 30},
  {id:'graduate', name:'Mission Trainee', icon:'✎', desc:'Finish the tutorial', test:s => s.tutorial >= 1},
  {id:'marathon', name:'Marathon', icon:'∞', desc:'Drive or fly 500 squares', test:s => s.squares + s.flown >= 500},
  {id:'treasure100', name:'Treasure Legend', icon:'♛', desc:'Find 100 treasures', test:s => s.treasures >= 100},
  {id:'hauler_100', name:'Supply Chain', icon:'⇉', desc:'Deliver 100 samples', test:s => s.delivered >= 100},
  {id:'shiny5', name:'Shiny Hunter', icon:'✧', desc:'Find 5 shiny samples', test:s => s.shinies >= 5},
  {id:'veteran', name:'Mars Veteran', icon:'✺', desc:'Complete 10 expeditions', test:s => Object.values(s.exp).reduce((a,b) => a+b, 0) >= 10},
  {id:'sticker10', name:'Sticker Fan', icon:'❀', desc:'Collect 10 different stickers', test:s => s.stickerKinds >= 10},
  {id:'sticker_all', name:'Sticker Master', icon:'✿', desc:'Collect every sticker', test:s => s.stickerKinds >= MR.STICKERS.length},
  {id:'all_cards', name:'Full Catalog', icon:'▤', desc:'Find every card', test:s => s.cardKinds >= MR.CARD_ORDER.length},
];

MR.RANKS = [
  {name:'Trainee', xp:0},
  {name:'Rover Driver', xp:150},
  {name:'Field Geologist', xp:450},
  {name:'Science Lead', xp:1000},
  {name:'Rover Planner', xp:1800},
  {name:'Mission Specialist', xp:3000},
  {name:'Principal Investigator', xp:4600},
  {name:'Mission Manager', xp:6800},
  {name:'Flight Director', xp:9500},
  {name:'Mars Legend', xp:13000},
];
/* Stickers: a big, easy collection for everyone (one per treasure for Cadets, one per delivery or find for others). */
MR.STICKERS = [
  ['rocket','🚀','Rocket','C'],['moon','🌙','Moon','C'],['star','⭐','Star','C'],['planet','🪐','Ringed planet','C'],['earth','🌍','Earth','C'],['sun','☀️','Sun','C'],
  ['comet','☄️','Comet','C'],['satellite','🛰️','Satellite','C'],['telescope','🔭','Telescope','C'],['rock','🪨','Moon rock','C'],['gem','💎','Gem','C'],['magnet','🧲','Magnet','C'],
  ['battery','🔋','Battery','C'],['antenna','📡','Dish antenna','C'],['mountain','🏔️','Mountain','C'],['volcano','🌋','Volcano','C'],['ice','🧊','Ice','C'],['shooting','🌠','Shooting star','C'],
  ['astronaut','🧑‍🚀','Astronaut','S'],['ufo','🛸','Flying saucer','S'],['alien','👽','Friendly alien','S'],['galaxy','🌌','Galaxy','S'],['microbe','🦠','Tiny microbe','S'],['robot','🤖','Robot','S'],
  ['dust','🌪️','Dust devil','S'],['trophy','🏆','Trophy','G'],['crown','👑','Crown','G'],['medal','🏅','Medal','G'],
  ['heli','🚁','Helicopter','C'],['parachute','🪂','Parachute','C'],['camera','📷','Camera','C'],['wrench','🔧','Wrench','C'],['gear','⚙️','Gear','C'],['toolbox','🧰','Toolbox','C'],
  ['compass','🧭','Compass','C'],['map','🗺️','Map','C'],['thermo','🌡️','Thermometer','C'],['wind','🌬️','Wind','C'],['desert','🏜️','Desert','C'],['peak','⛰️','Peak','C'],
  ['drop','💧','Water drop','C'],['sprout','🌱','Sprout','C'],['brick','🧱','Brick','C'],['bulb','💡','Bright idea','C'],['fullmoon','🌕','Full moon','C'],['halfmoon','🌓','Half moon','C'],
  ['microscope','🔬','Microscope','S'],['testtube','🧪','Test tube','S'],['scientist','🧑‍🔬','Scientist','S'],['sparkle','🌟','Glowing star','S'],['dizzy','💫','Star swirl','S'],['shell','🐚','Lake shell','S'],
  ['gold1','🥇','Gold medal','G'],['ribbon','🎖️','Honor ribbon','G'],
].map(([id, e, name, tier]) => ({id, e, name, tier}));
MR.STICKER_TIER = {C:{name:'Sticker', col:'#9aa7b3'}, S:{name:'Shiny sticker', col:'#6aa8ff'}, G:{name:'Gold sticker', col:'#f0bf5a'}};
MR.rankOf = xp => { let r = 0; MR.RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; };

/* Gameplay perks for Explorer and Specialist, unlocked by rank index. */
MR.PERKS = {
  wide_wheels: {name:'Wide wheels', tier:'Common', rank:1, icon:'◍', desc:'Dunes and hills cost 2% less power per square.', real:'Curiosity\'s wheels wore out on sharp rocks, so Perseverance got wider, thicker wheels.'},
  sharp_eyes:  {name:'Sharp eyes', tier:'Common', rank:2, icon:'◉', desc:'See 1 square farther and scan 1 square wider.', real:'Perseverance has 23 cameras, more than any Mars mission before it.'},
  supercam:    {name:'SuperCam laser', tier:'Rare', rank:3, icon:'✶', desc:'Analyze also zaps signals up to 3 squares straight ahead.', real:'SuperCam zaps rocks with a laser from up to 7 meters away and reads the glow.'},
  big_battery: {name:'Big battery', tier:'Rare', rank:4, icon:'▮', desc:'The battery holds 150% instead of 100%.', real:'Rovers store energy in lithium-ion batteries, like a phone but much tougher.'},
  dust_wiper:  {name:'Dust wiper', tier:'Common', rank:5, icon:'⌇', desc:'Dust builds up on your solar panels half as fast.', real:'Opportunity lasted 15 years partly because Martian winds kept cleaning its panels.'},
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
  if (st.lab && st.lab.built && st.lab.built.radio_tower) ms *= .75;
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
    par:36, parCadet:14,
  },
  gusev: {
    name:'Gusev Crater', rover:'Spirit', year:'2004–2010', unlock:'jezero',
    blurb:'Wide plains, the Columbia Hills and sand traps everywhere. Spirit explored here until it got stuck.',
    station:{x:9, y:21}, startDir:1,
    labels:[{t:'COLUMBIA HILLS', x:33, y:11},{t:'HUSBAND HILL', x:35, y:17.5},{t:'HOME PLATE', x:41, y:26},{t:'TROY', x:36, y:33.2},{t:'BONNEVILLE', x:17, y:9.8},{t:"MA'ADIM VALLIS", x:21, y:40}],
    regions:['Gusev plains','Basalt plains','Sand ripples','Delta sediment',"Ma'adim Vallis",'Crater rim','Columbia Hills','Cliffs','Home Plate'],
    par:40, parCadet:14,
  },
};
MR.MAPS.moon = {
  name:'Moon: Hadley Rille', rover:'Apollo 15 Lunar Roving Vehicle', year:'1971', unlock:'gusev', airless:true,
  blurb:'Drive the Apollo Lunar Roving Vehicle beside a winding canyon. Grey dust, sharp craters, Earth in the sky, and no air at all.',
  station:{x:30, y:20}, startDir:1,
  labels:[{t:'HADLEY RILLE', x:19, y:9},{t:'MOUNT HADLEY DELTA', x:35, y:40.5},{t:'SPUR CRATER', x:39, y:33.2},{t:'ST. GEORGE', x:24, y:33.5},{t:'APENNINE MOUNTAINS', x:57, y:22},{t:'FALCON (LUNAR MODULE)', x:31, y:17.5}],
  regions:['Mare plains','Bright highland rock','Soft regolith','Mare plains','Rille floor','Apennine Mountains','Mount Hadley Delta','Cliffs','Ejecta','Hadley Rille'],
  par:30, parCadet:14,
};
MR.MAPS.meridiani = {
  name:'Meridiani Planum', rover:'Opportunity', year:'2004–2018', unlock:'moon',
  blurb:'Flat dark plains full of tiny hematite "blueberries", and the craters Opportunity explored on its 45-kilometer journey.',
  station:{x:9, y:23}, startDir:1,
  labels:[{t:'EAGLE CRATER', x:4, y:20.6},{t:'ENDURANCE', x:20, y:13.2},{t:'PURGATORY', x:27, y:21.4},{t:'VICTORIA CRATER', x:34, y:25.6},{t:'CAPE YORK', x:45, y:9.4},{t:'ENDEAVOUR CRATER', x:56, y:23},{t:'PERSEVERANCE VALLEY', x:46, y:39.5}],
  regions:['Meridiani plains','Burns outcrop','Sand ripples','Plains','Crater floor','Crater rim','Endeavour rim hills','Cliffs','Bright outcrop','Crater rim'],
  par:44, parCadet:14,
};
MR.MAPS.gale = {
  name:'Gale Crater', rover:'Curiosity', year:'2012–today', unlock:'meridiani',
  blurb:'Curiosity\'s home: an old lake bed at the foot of Mount Sharp, a mountain of rock layers that record Mars drying out.',
  station:{x:12, y:9}, startDir:1,
  labels:[{t:'BRADBURY LANDING', x:12, y:6.6},{t:'YELLOWKNIFE BAY', x:22, y:11.8},{t:'THE KIMBERLEY', x:22, y:22.2},{t:'BAGNOLD DUNES', x:24, y:30.4},{t:'VERA RUBIN RIDGE', x:38, y:15.4},{t:'MOUNT SHARP', x:50, y:38},{t:'PAHRUMP HILLS', x:31, y:34.4}],
  regions:['Aeolis Palus','Mudstone','Bagnold Dunes','Plains','Yellowknife Bay','Crater wall','Mount Sharp slopes','Cliffs','Layered rock','Crater wall'],
  par:38, parCadet:14,
};
MR.MAPS.jezero.regions.push('Crater rim'); MR.MAPS.gusev.regions.push('Crater rim');
MR.MAP_ORDER = ['jezero','gusev','moon','meridiani','gale'];
MR.parOf = st => st.day && MR.missionOf && MR.missionOf(st.day) ? MR.missionOf(st.day).par : st.goals.some(g => g.kind === 'treasure') ? MR.MAPS[st.map].parCadet : MR.MAPS[st.map].par;
MR.cadetGoals = n => [{t:`Find ${3+2*n} treasures`, kind:'treasure', of:3+2*n}];

const KEYS = 'More keys: I or E opens your inventory, T talks to the team, Tab looks at the next rover, Shift + WASD moves the camera, F follows your rover, M makes the map big, + and − zoom, Esc closes windows.';
MR.HOW = {
  cadet:['Tap the picture buttons to plan your moves. Each arrow is one square.','Press the big GO button and watch your rover.','Land on a sparkly gem and dig to find treasure!','Press I to open your treasure chest.','Keys: W or ↑ goes forward, A and D turn, Space digs, Backspace removes, Enter is GO. M makes the map big.'],
  explorer:['Build a plan of up to 12 blocks, then press Send (or Ready in a team game).','Scan shows mystery signals (?). Drive onto one, Analyze it, then Drill to fill a sample tube.','Dunes use more power and can hide sand traps. If you get stuck, Back up 1 square.','Drive onto the station to unload samples and recharge. Each night the solar panels add 30%.','Smart blocks hold other blocks: click Repeat to put new blocks inside it. At the second rank the satellite relay kit adds If blocks, Until full or low battery, Go to signal, Go home, and plans that run for 2 sols.','Keys like a PC game: W A S D (or arrows) drive, Q scan, R analyze, Space drill, G dig, C charge. Pressing W again adds a square. Backspace removes, Enter sends.', KEYS],
  specialist:['Write your plan in Python. Supports rover commands and for loops, up to 40 moves per sol. while, if, elif, else and def work with the rover sensors (see the sensor list).','At the second rank the satellite relay kit adds rover.go_to_signal(), rover.go_home() and for sol in rover.mission(2): for programs that run for several sols.','Only 6 sample tubes and weaker solar (20% a night). Analyze before you Drill.','Drive onto the station to unload samples and recharge.','Ctrl+Enter sends your program. Click outside the editor to use W A S D, Q, R, Space, G and C to add lines.', KEYS],
};
})();
