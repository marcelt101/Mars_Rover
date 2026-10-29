/* "What the game teaches": the first page of the tutorial, for teachers and parents. It describes the game world
   and, subject by subject, what children learn and where in the game they meet it. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const SUBJECTS = [
  {id:'eng', icon:'⚙', col:'#e8844f', name:'Engineering and robotics',
    learn:'How a real rover is built and kept alive: power, wheels, antennas and tools. Every action costs battery, dust weakens the solar panels, sharp rocks wear the wheels, and the cold nights need heaters.',
    where:'The About this rover pages (the i on every rover), the Health window with its gauges, the battery planner under the plan, and the base upgrades the Lab builds (solar farm, radio tower, garage, greenhouse).'},
  {id:'code', icon:'{ }', col:'#b48ce8', name:'Programming and computational thinking',
    learn:'Planning a sequence, then loops, conditions, sensors and programs that run for several days. Children debug by replaying a sol and fixing the plan.',
    where:'Cadets line up picture buttons. Explorers use blocks with Repeat and If. Specialists write real Python (for loops, if, while, def, sensors like rover.battery()). The Mission Log gives each week one coding idea.'},
  {id:'geo', icon:'◆', col:'#9cc35a', name:'Rocks and minerals (geology)',
    learn:`${Object.keys(MR.MINERALS || {}).length || 20} real Mars and Moon minerals and rocks, how they form and what they tell scientists, especially about ancient water.`,
    where:'Scan, Analyze and Drill on the map, the mineral info tablet, mineral cards, and the Minerals chart in the Inventory, sorted into families like silicates, sulfates and carbonates.'},
  {id:'chem', icon:'⚗', col:'#5fb7a8', name:'Chemistry',
    learn:'Chemical elements (oxygen, silicon, iron and more) and how the same few elements build every mineral. How explorers could make water, metal, bricks and glass from what they find, and oxygen from air (like MOXIE).',
    where:'The elements chart in the Minerals chart, the PIXL and APXS instruments, and the Lab recipes.'},
  {id:'wx', icon:'☁', col:'#7fb2e6', name:'Weather and climate (meteorology)',
    learn:'Mars weather: very cold nights, wind, dust and dust storms that block sunlight, and why that matters for a solar rover.',
    where:'The weather station card and forecast every sol, dust storm days in the Mission Log, and the MEDA and REMS weather stations in the rover pages.'},
  {id:'space', icon:'☾', col:'#b9c0c8', name:'Space science and astronomy',
    learn:'Real places on Mars and the Moon, a sol (a Mars day), why radio signals take 4 to 24 minutes to reach Mars, why helicopters can\'t fly on the airless Moon, low gravity, and Earth seen from the Moon. The game covers planetary science (Mars and the Moon) rather than cosmology, the study of the whole universe.',
    where:'The five maps, the signal delay every time a plan is sent, the Moon week of the Mission Log (Earth in the sky, hammer and feather).'},
  {id:'life', icon:'❦', col:'#86d48f', name:'Life science (astrobiology)',
    learn:'What life needs (water, the right chemistry and energy) and how scientists search for signs of past life without finding living things.',
    where:`The ${(MR.LIFE12 || []).length || 12} "life clue" minerals, Cheyava Falls in Jezero Crater, and the sample tubes saved for Mars Sample Return.`},
  {id:'hist', icon:'★', col:'#f0bf5a', name:'History of space exploration',
    learn:'The real missions from Apollo 15 (1971) and Sojourner (1997) to Spirit, Opportunity, Curiosity, Perseverance and Ingenuity, with real dates and real discoveries.',
    where:'Mission briefings, the 30 days of the Mission Log, history finds on the maps, and the rover pages.'},
  {id:'math', icon:'±', col:'#58cfbe', name:'Math',
    learn:'Percentages (battery), counting and distance (squares), directions and turns, budgets (how many commands fit), and reading charts.',
    where:'The plan estimate ("uses about 9% battery"), the battery and the stars for finishing under par, and the Mission Control charts.'},
  {id:'sci', icon:'✎', col:'#ff9f8a', name:'The scientific method',
    learn:'Observe, ask why, test, record and explain: the way real mission scientists work.',
    where:'Scan to observe, Why? on every objective, Analyze to test, photos and the science notebook to record, and the daily quiz and journal in the Mission Log.'},
  {id:'team', icon:'☍', col:'#c3ced8', name:'Teamwork and communication',
    learn:'Sharing jobs, planning together and helping each other, like a real mission team.',
    where:'Team games for up to 32 players (a whole class), rover jobs (Scout finds, Science identifies, Hauler carries, Lab builds), team chat and shared objectives.'},
];
let tab = 'teach';
UI.guide = t => {
  tab = t || tab;
  const tabs = [['teach','What it teaches'],['world','The game world'],['day','A typical day'],['adults','For teachers and parents']];
  let body = '';
  if (tab === 'teach') {
    body = `<p class="glede">Mars Rover Ops is a co-op game where children run real NASA rovers on real places on Mars and the Moon. Everything in it is real science. Here is what it teaches and where children meet it.</p>
      <div class="subjects">${SUBJECTS.map(s => `<div class="subj" style="--sc:${s.col}"><div class="subh"><span class="subi">${esc(s.icon)}</span><b>${esc(s.name)}</b></div><p>${esc(s.learn)}</p><p class="subw"><b>In the game:</b> ${esc(s.where)}</p></div>`).join('')}</div>`;
  } else if (tab === 'world') {
    body = `<p class="glede">The players are the mission team on Earth. Each sol (a Mars day) they plan what their rover should do, send the plan to Mars, wait for the signal to arrive, and watch the rover carry it out. Then they plan again.</p>
      <h3 class="t">Three ways to play, by age</h3><div class="groles">${Object.values(MR.ROLES).map(r => `<div><b>${esc(r.label)}</b><small>${esc(r.ages)}</small><p>${esc(r.desc)}</p></div>`).join('')}</div>
      <p class="muted" style="margin:0;font-size:13px">A 5-year-old, a 12-year-old and a 15-year-old can play the same map together, each at their own level.</p>
      <h3 class="t">Real places</h3><ul class="gmaps">${MR.MAP_ORDER.map(k => { const m = MR.MAPS[k]; return `<li><b>${esc(m.name)}</b> <small>${esc(m.rover)} · ${esc(m.year)}</small><span>${esc(m.blurb)}</span></li>`; }).join('')}</ul>
      <h3 class="t">Rovers</h3><p style="margin:0">Each player drives one rover with its own job: Scout, Science, Hauler, Excavator or Lab, and for Cadets the Buggy or the Helicopter. Each is based on a real rover; tap the <b>i</b> on a rover to learn how the real one works.</p>
      <h3 class="t">Goals</h3><p style="margin:0">Each map has 3 campaigns that follow the real mission, with clear objectives: find signals, identify minerals, drill samples and bring them home. The <b>30-day Mission Log</b> gives one mission a day for a month, about an hour each.</p>
      <h3 class="t">Solo or team</h3><p style="margin:0">Play alone, or one device hosts and up to 31 more join with a room code or QR code, in the same room or far away. A whole class can play in one room, or in small teams of 4 to 6, each team in its own room.</p>`;
  } else if (tab === 'day') {
    body = `<p class="glede">A Mission Log day takes about an hour.</p>
      <ol class="gsteps">
        <li><b>Briefing (5 min).</b> Read the real story behind today's mission: what NASA did, when and why.</li>
        <li><b>Mission (30 to 45 min).</b> Plan, send and explore until the objectives are done. Stars for finishing in fewer sols.</li>
        <li><b>Quiz (5 min).</b> Three questions about what they just saw.</li>
        <li><b>Journal (5 to 10 min).</b> Write or tell what the rover found and why it matters.</li>
        <li><b>Talk about it.</b> Ask: What surprised you? What would you do differently next sol? Why do scientists care about this rock?</li>
      </ol>
      <h3 class="t">The four weeks</h3><ul class="gmaps">${Object.values(MR.LOG_WEEKS).map(w => `<li><b>${esc(w.name)}</b><span>Coding idea: ${esc(w.idea)}</span></li>`).join('')}</ul>`;
  } else {
    body = `<ul class="gsteps">
        <li><b>Start with the tutorial.</b> It takes about 3 minutes and has steps for each age level.</li>
        <li><b>Use the Mission Log.</b> Its 30 days build on each other: real history, one coding idea per week, a quiz and a journal every day, and a printable certificate at the end.</li>
        <li><b>Follow progress.</b> Parents and saves on the start screen shows days done, stars, quiz scores and minutes played for each child.</li>
        <li><b>Breaks.</b> A break reminder can be set in Parents and saves (after 30 to 90 minutes).</li>
        <li><b>Whole class or small teams.</b> One room holds up to 32 players. Small teams of 4 to 6, each with its own room code, usually move faster and give everyone more to do. The host can remove a player with the ✕ in the crew list or by tapping their rover.</li>
        <li><b>Mix ages.</b> Older children can host and help younger ones. The Cadet level needs no reading, and the steps can be read aloud.</li>
        <li><b>Safe and private.</b> No accounts and no ads. Progress is saved on this device. Team games only connect devices that use the same room code.</li>
      </ul>`;
  }
  UI.openModal(`<div class="sh"><h2>About the game</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div>
    <div class="sb"><div class="tabs" id="gTabs">${tabs.map(([k, l]) => `<button class="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>${body}
    <div class="row" style="justify-content:flex-end">${MR.Store.current() ? '<button class="btn primary" id="gTut">Start the tutorial</button>' : ''}</div></div>`);
  $('gTabs').onclick = e => { const b = e.target.closest('.tab'); if (b) UI.guide(b.dataset.tab); };
  if ($('gTut')) $('gTut').onclick = () => { UI.closeModal(); MR.Game.startTutorial(); };
};
})();
