/* Calm space music, made live in the browser (Web Audio): no songs and no music files. Slow soft chords, a
   quiet low hum and an occasional chime. It follows the game: calm while planning, a soft pulse while rovers
   drive, wind during a dust storm, sparser and colder on the Moon, and a little chime on a find.
   Browsers only allow sound after the first tap, so it fades in then. */
(function () {
const MR = window.MR;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = {
  mars: [[50,57,64,65], [46,53,62,69], [48,55,64,67], [43,50,57,62], [45,52,60,64]],
  moon: [[45,52,59,64], [41,48,55,64], [43,50,57,62], [40,47,55,59]],
};
const BELLS = {mars:[74,77,79,81,84,86], moon:[76,79,81,83,88]};
let ctx = null, out = null, wet = null, drone = null, wind = null, started = false;
let mode = 'plan', world = 'mars', storm = false, chord = CHORDS.mars[0], padTimer = null, bellTimer = null, pulseTimer = null;
const S = () => MR.Store.settings;
const vol = () => (S().music === false ? 0 : (S().musicVol ?? 35) / 100) * .55;

function reverb(){
  const len = ctx.sampleRate * 3, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random()*2 - 1) * Math.pow(1 - i/len, 2.6); }
  const cv = ctx.createConvolver(); cv.buffer = b; return cv;
}
function init(){
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  out = ctx.createGain(); out.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); out.connect(comp); comp.connect(ctx.destination);
  const rv = reverb(); wet = ctx.createGain(); wet.gain.value = .45; wet.connect(rv); rv.connect(out);
  // low hum: root and fifth, breathing slowly
  drone = ctx.createGain(); drone.gain.value = .05; drone.connect(out); drone.connect(wet);
  [38, 45].forEach((m, k) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m); const g = ctx.createGain(); g.gain.value = k ? .5 : 1; o.connect(g); g.connect(drone); o.start(); });
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .05; lg.gain.value = .02; lfo.connect(lg); lg.connect(drone.gain); lfo.start();
  // wind for dust storms: filtered noise with a slowly moving filter
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random()*2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = .8;
  const wl = ctx.createOscillator(), wg = ctx.createGain(); wl.frequency.value = .08; wg.gain.value = 250; wl.connect(wg); wg.connect(bp.frequency); wl.start();
  wind = ctx.createGain(); wind.gain.value = 0; ns.connect(bp); bp.connect(wind); wind.connect(out); ns.start();
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (vol() > 0) ctx.resume(); });
}
/* One soft chord: two slightly detuned oscillators per note through a gentle low-pass, slow in and slow out. */
function pad(){
  const list = CHORDS[world]; chord = list[Math.floor(Math.random() * list.length)];
  const t = ctx.currentTime, len = world === 'moon' ? 13 : 11;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = world === 'moon' ? 650 : 900; f.Q.value = .4;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + 3.5); g.gain.setValueAtTime(.06, t + len - 5); g.gain.linearRampToValueAtTime(0, t + len);
  f.connect(g); g.connect(out); g.connect(wet);
  chord.forEach(m => [-6, 6].forEach((cents, k) => { const o = ctx.createOscillator(); o.type = k ? 'triangle' : 'sine'; o.frequency.value = hz(m); o.detune.value = cents;
    const og = ctx.createGain(); og.gain.value = k ? .35 : .6; o.connect(og); og.connect(f); o.start(t); o.stop(t + len + .1); }));
  padTimer = setTimeout(pad, (len - 3.5 + Math.random() * 2) * 1000);
}
function bell(m, when = 0, loud = 1){
  const t = ctx.currentTime + when;
  [1, 2.76].forEach((ratio, k) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(m) * ratio;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime((k ? .012 : .035) * loud, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + (k ? 1.2 : 3));
    o.connect(g); g.connect(out); g.connect(wet); o.start(t); o.stop(t + 3.1); });
}
function bells(){
  const list = BELLS[world]; bell(list[Math.floor(Math.random() * list.length)]);
  if (Math.random() < .35) bell(list[Math.floor(Math.random() * list.length)], .45, .7);
  bellTimer = setTimeout(bells, (world === 'moon' ? 9 + Math.random()*14 : 5 + Math.random()*9) * 1000);
}
/* While the rovers drive: a soft plucked pulse on the notes of the current chord. */
function pulse(){
  let k = 0;
  pulseTimer = setInterval(() => { if (mode !== 'drive') return;
    const m = chord[k++ % chord.length] + 12, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz(m); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
    o.connect(g); g.connect(out); g.connect(wet); o.start(t); o.stop(t + .55); }, 420);
}
function apply(){
  if (!ctx) return; const t = ctx.currentTime, v = vol();
  out.gain.cancelScheduledValues(t); out.gain.setTargetAtTime(v, t, v > out.gain.value ? 2.5 : .4);
  wind.gain.setTargetAtTime(storm && world !== 'moon' ? .09 : 0, t, 1.5);
  drone.gain.setTargetAtTime(world === 'moon' ? .035 : .05, t, 2);
  if (v > 0 && ctx.state === 'suspended' && !document.hidden) ctx.resume();
  if (v === 0) setTimeout(() => { if (vol() === 0 && ctx.state === 'running') ctx.suspend(); }, 1500);
}
MR.music = {
  start(){ if (started) return; try { init(); } catch (e) { return; } started = true; pad(); bellTimer = setTimeout(bells, 4000); pulse(); apply(); },
  setMode(m){ mode = m; },
  setWorld(map){ const w = MR.MAPS[map] && MR.MAPS[map].airless ? 'moon' : 'mars'; if (w !== world) { world = w; apply(); } },
  setStorm(on){ storm = !!on; apply(); },
  find(){ if (!ctx || vol() === 0) return; const list = BELLS[world]; [0, 2, 4].forEach((k, i) => bell(list[Math.min(list.length - 1, k)] + (world === 'moon' ? 0 : 0), i * .12, 1.3)); },
  refresh(){ apply(); },
};
const go = () => { MR.music.start(); document.removeEventListener('pointerdown', go); document.removeEventListener('keydown', go); };
document.addEventListener('pointerdown', go); document.addEventListener('keydown', go);
})();
