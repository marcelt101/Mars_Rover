/* Optional tutorial: a coach bubble that points at the real controls, with steps for each role. */
(function () {
const MR = window.MR, UI = MR.UI, $ = UI.$, esc = UI.esc;
const api = () => MR.Game.api;

const planHas = (type, min = 1) => api().plan().some(c => c.type === type && (c.arg || 1) >= min);
const py = () => { const r = MR.parsePy($('editor').value, 40); return r.error ? [] : r.actions; };
const pyHas = (type, min = 1) => py().some(a => a.type === type && (a.arg || 1) >= min);
const pyLoop = () => { const r = MR.parsePy($('editor').value, 40); return !r.error && r.loops; };
const running = () => api().phase() === 'run';
const solAtLeast = n => () => api().sol() >= n && api().phase() !== 'run';
const insert = code => { const ta = $('editor'); ta.value = ta.value.replace(/\s*$/, '\n') + code + '\n'; ta.dataset.touched = '1'; ta.dispatchEvent(new Event('input')); };

const TOUR = [
  {text:'The mission bar shows what to do right now. Tap Briefing to read the story of this campaign and why scientists care.', target:'#missionBar', next:true},
  {text:'The Objectives list shows the whole campaign, with a hint for each. Tap Show to see where to look, or Why? to learn why scientists want it.', target:'#goals', next:true},
  {text:'The Mission log tells you what your rover did and found.', target:'#log', next:true},
  {text:'Tap Health (or press H) to check your rover: battery, dust, wheels and tubes.', target:'#healthBtn', next:true},
  {text:'Mission Control (O) is like the real control room: charts for every sol, alarms you can set, and a replay button to watch a sol again.', target:'#opsBtn', next:true},
  {text:'Press I (or the Inventory button) for your cards, minerals chart, notebook, photos, stickers and patches.', target:'#invBtn', done:() => Date.now() - UI.invOpenedAt < 4000},
];
const STEPS = {
  cadet:[
    {text:'This bar shows your mission. Let\'s find a sparkly gem!', target:'#missionBar', next:true},
    {text:'Tap the ↑ arrow 3 times.', target:'.cbtn.up', done:() => api().plan().filter(c => c.type === 'forward').length >= 3},
    {text:'Now tap the dig button ⛏.', target:'.cbtn.dig', done:() => planHas('drill')},
    {text:'Press GO!', target:'#goBtn', done:running},
    {text:'Watch your rover drive to the sparkly gem…', target:'#mapbox', done:solAtLeast(2)},
    {text:'You found treasure! Tap Inventory to see it.', target:'#invBtn', done:() => Date.now() - UI.invOpenedAt < 4000},
    {text:'Great job! Now find more sparkly gems on your own.', target:'#mapbox', next:true, final:true},
  ],
  explorer:[
    {text:'This is your rover, next to the base station. You plan once per sol (a Mars day), then send the plan to Mars.', target:'#mapbox', next:true},
    {text:'Add Scan (or press Q). It looks for mystery signals nearby.', target:'.pal[data-c=scan]', done:() => planHas('scan')},
    {text:'Each command is a card in your plan. Tap a card to change it, or drag it to change the order.', target:'#prog', next:true},
    {text:'Press Send to Mars (or Enter). The signal takes a few seconds to arrive.', target:'#sendBtn', done:running},
    {text:'Watch the scan…', target:'#mapbox', done:solAtLeast(2)},
    {text:'The scan found a ? signal 3 squares west. Add Forward (W) and make it 3 squares: tap + or press W again.', target:'.pal[data-c=forward]', done:() => planHas('forward', 3), clear:true},
    {text:'Now add Analyze (R) to see what it is, then Drill (Space) to collect it.', target:'.pal[data-c=analyze]', done:() => planHas('analyze') && planHas('drill')},
    {text:'Send it to Mars.', target:'#sendBtn', done:running},
    {text:'Watch your rover drive, analyze and drill…', target:'#mapbox', done:solAtLeast(3)},
    {text:'A sample is sealed in a tube! Bring it home: add Back (S) and make it 4 squares, then Send.', target:'.pal[data-c=back]', done:() => running(), clear:true},
    {text:'Driving home…', target:'#mapbox', done:solAtLeast(4)},
    ...TOUR,
    {text:'Add Photo (P) to a plan to take a picture. Photos go to your album and your notebook.', target:'.pal[data-c=photo]', next:true},
    {text:'You are ready, explorer! Tip: when you are far away, the helper under the plan can build the route home for you. On the start screen, the Mission Log has a new mission for every day.', target:'#mapbox', next:true, final:true},
  ],
  specialist:[
    {text:'This is your rover, next to the base station. You write one program per sol (a Mars day) and send it to Mars.', target:'#mapbox', next:true},
    {text:'Write rover.scan() in the editor. It looks for mystery signals nearby.', target:'#editor', done:() => pyHas('scan'), code:'rover.scan()'},
    {text:'Send it (Ctrl+Enter or the Ready button). The signal takes a few seconds to arrive.', target:'#sendBtn', done:running},
    {text:'Watch the scan…', target:'#mapbox', done:solAtLeast(2)},
    {text:'The scan found a ? signal 3 squares west. Write three lines: rover.forward(3), rover.analyze() and rover.drill().', target:'#editor', done:() => pyHas('forward', 3) && pyHas('analyze') && pyHas('drill'), code:'rover.forward(3)\nrover.analyze()\nrover.drill()', clearCode:true},
    {text:'Send it.', target:'#sendBtn', done:running},
    {text:'Watch your rover drive, analyze and drill…', target:'#mapbox', done:solAtLeast(3)},
    {text:'Now drive home with a loop. The indented line repeats 4 times:\nfor i in range(4):\n    rover.backward(1)', target:'#editor', done:() => pyLoop() && py().filter(a => a.type === 'back').length >= 4, code:'for i in range(4):\n    rover.backward(1)', clearCode:true},
    {text:'Send it.', target:'#sendBtn', done:running},
    {text:'Driving home…', target:'#mapbox', done:solAtLeast(4)},
    ...TOUR,
    {text:'Nice coding! Loops make long plans short, and rover.photo() takes a picture. Watch the "Running line" display to see which line the rover is on. On the start screen, the Mission Log has a new mission for every day.', target:'#mapbox', next:true, final:true},
  ],
};

let T = null, timer = null, ring = null;
const say = text => {
  if (!T || T.role !== 'cadet' || !MR.Store.settings.sound || !window.speechSynthesis) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[↑⛏…]/g, '')); u.rate = .92; speechSynthesis.speak(u); } catch (e) {}
};
function show(){
  const s = T.steps[T.i], el = s.target ? document.querySelector(s.target) : null;
  if (ring) ring.classList.remove('coachring');
  ring = el && s.target !== '#mapbox' ? el : null;
  if (ring) { ring.classList.add('coachring'); ring.scrollIntoView({block:'nearest', behavior:'smooth'}); }
  const c = $('coach');
  c.innerHTML = `<span class="cs"><span class="grip" aria-hidden="true">⠿</span>Tutorial · step ${T.i + 1}/${T.steps.length} <small>${T.moved ? 'double-tap to snap back' : 'drag to move'}</small></span>
    <p class="ct ${T.role === 'cadet' ? 'big' : ''}">${esc(s.text).replace(/\n/g, '<br>').replace(/ {4}/g, '&nbsp;&nbsp;&nbsp;&nbsp;')}</p>
    <div class="row">${T.role === 'cadet' ? '<button class="btn" data-c="say" aria-label="Read it again">🔊</button>' : ''}
      ${s.code ? '<button class="btn" data-c="code">Write it for me</button>' : ''}
      <button class="btn" data-c="skip">${s.final ? 'Close' : 'Skip tutorial'}</button>
      ${s.next ? `<button class="btn primary" data-c="next">${s.final ? 'Finish' : 'Next'}</button>` : ''}</div>`;
  c.hidden = false; place(el); say(s.text);
  if (s.clear && !T.cleared) { T.cleared = true; }
}
function place(el){
  const c = $('coach'), cw = c.offsetWidth, ch = c.offsetHeight, pad = 12;
  let x = innerWidth - cw - pad, y = innerHeight - ch - pad;
  if (T && T.moved) { x = T.moved.x; y = T.moved.y; }
  else if (el) {
    const r = el.getBoundingClientRect();
    const side = el.closest('.side');
    if (el.id === 'mapbox') { x = r.left + (r.width - cw)/2; y = r.top + 70; }
    else if (side && innerWidth >= 1100) { x = side.getBoundingClientRect().left - cw - 16; y = r.top + r.height/2 - ch/2; }
    else { x = r.left + r.width/2 - cw/2; y = r.bottom + 12; if (y + ch > innerHeight - pad) y = r.top - ch - 12; if (y < pad) { y = pad; x = r.left - cw - 14; if (x < pad) x = r.right + 14; } }
  }
  c.style.left = Math.max(pad, Math.min(innerWidth - cw - pad, x)) + 'px';
  c.style.top = Math.max(pad, Math.min(innerHeight - ch - pad, y)) + 'px';
}
function advance(){
  const s = T.steps[T.i];
  if (s.final) return finish();
  T.i++; T.cleared = false;
  const n = T.steps[T.i];
  if (n.clear) api().applyPlan([], true);
  if (n.clearCode) { $('editor').value = 'from mars import rover\n\n'; $('editor').dataset.touched = '1'; }
  MR.sfx.click(); show();
}
function finish(){
  const p = MR.Store.current();
  if (p) {
    p.tutDone = true; p.stats.tutorial = 1;
    const notices = MR.applyRewards(p, MR.Game.myPid, [], {map:'jezero', players:1});
    UI.notify(notices, p.role === 'cadet');
  }
  MR.Tutorial.stop();
  UI.toast('✎', '#58cfbe', 'Tutorial complete!', 'Keep exploring this map, or go back to the start screen for a new expedition.', 6000);
}
$('coach').addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b || !T) return;
  const s = T.steps[T.i];
  if (b.dataset.c === 'next') advance();
  else if (b.dataset.c === 'skip') { if (s.final) finish(); else MR.Tutorial.stop(); }
  else if (b.dataset.c === 'say') say(s.text);
  else if (b.dataset.c === 'code' && s.code) insert(s.code);
});
/* The bubble can be dragged anywhere (finger or mouse), so it never hides what the player needs to tap.
   Once moved it stays put, step after step; a double-tap puts it back next to the control it points at. */
let drag = null;
$('coach').addEventListener('pointerdown', e => {
  if (!T || e.target.closest('button') || e.button > 0) return;
  const r = $('coach').getBoundingClientRect();
  drag = {id:e.pointerId, dx:e.clientX - r.left, dy:e.clientY - r.top, sx:e.clientX, sy:e.clientY, on:false};
  $('coach').setPointerCapture(e.pointerId);
});
$('coach').addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  if (!drag.on && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
  if (!drag.on) { drag.on = true; $('coach').classList.add('dragging'); }
  T.moved = {x:e.clientX - drag.dx, y:e.clientY - drag.dy}; place(null); e.preventDefault();
});
let lastTap = 0;
const endDrag = e => { if (!drag || e.pointerId !== drag.id) return; const was = drag.on; drag = null; $('coach').classList.remove('dragging');
  if (!T) return;
  if (was) { lastTap = 0; const sm = $('coach').querySelector('.cs small'); if (sm) sm.textContent = 'double-tap to snap back'; }
  else if (e.type === 'pointerup') { const now = Date.now(); if (now - lastTap < 400 && T.moved) { T.moved = null; lastTap = 0; show(); } else lastTap = now; } };
$('coach').addEventListener('pointerup', endDrag); $('coach').addEventListener('pointercancel', endDrag);
addEventListener('resize', () => { if (T) place(document.querySelector(T.steps[T.i].target)); });

MR.Tutorial = {
  start(role){
    T = {role, steps:STEPS[role] || STEPS.explorer, i:0};
    clearInterval(timer);
    setTimeout(show, 400);
    timer = setInterval(() => {
      if (!T || $('coach').hidden) return;
      const s = T.steps[T.i];
      if (!s.next && s.done && s.done()) advance();
      else place(document.querySelector(s.target));
    }, 300);
  },
  stop(){ T = null; clearInterval(timer); $('coach').hidden = true; if (ring) ring.classList.remove('coachring'); ring = null; try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} },
  active:() => !!T,
};
})();
