/* Dr. Orbit: the mission scientist who calls in from a little screen. A chime says a message is coming, then
   the text types out with little blips while his mouth moves.
   Usage: DOC.say('text', {mood:'happy' | 'wow' | 'worried' | 'think'}). Messages queue up. */
(function (root) {
const $ = id => document.getElementById(id);
let soundOn = true; try { soundOn = localStorage.getItem('webb.voice') !== 'off'; } catch (e) {}
const box = document.createElement('div'); box.id = 'doc'; box.className = 'hidden';
box.innerHTML = `
  <div class="dscreen" id="dHead" title="Dr. Orbit">
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <defs><radialGradient id="dBg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#1d3a4f"/><stop offset="1" stop-color="#07121b"/></radialGradient>
        <radialGradient id="dSkin" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#ffd9b8"/><stop offset="1" stop-color="#e9b48c"/></radialGradient></defs>
      <rect width="120" height="120" fill="url(#dBg)"/>
      <g id="dStars" fill="#fff" opacity=".55"><circle cx="12" cy="14" r="1"/><circle cx="104" cy="22" r="1.3"/><circle cx="96" cy="8" r=".8"/><circle cx="20" cy="40" r=".8"/><circle cx="110" cy="48" r=".9"/></g>
      <g id="dBody">
        <path d="M8 122 Q14 96 60 93 Q106 96 112 122 Z" fill="#eef2f5" stroke="#b9c4cc" stroke-width="1.5"/>
        <path d="M46 94 L60 112 L74 94 Z" fill="#3b6f9e"/>
        <path d="M60 104 L48 98 L48 110 Z M60 104 L72 98 L72 110 Z" fill="#e0483e"/><circle cx="60" cy="104" r="3" fill="#b8322b"/>
        <rect x="88" y="100" width="12" height="9" rx="2" fill="#f0bf5a"/><text x="94" y="107" font-size="6" text-anchor="middle" fill="#3b2a07" font-family="sans-serif">★</text>
        <rect x="52" y="84" width="16" height="12" fill="#e9b48c"/>
      </g>
      <g id="dHeadG">
        <g id="dHairL"><circle cx="27" cy="52" r="10" fill="#f4f6f8"/><circle cx="23" cy="64" r="9" fill="#e9edf0"/><circle cx="29" cy="40" r="8" fill="#f4f6f8"/></g>
        <g id="dHairR"><circle cx="93" cy="52" r="10" fill="#f4f6f8"/><circle cx="97" cy="64" r="9" fill="#e9edf0"/><circle cx="91" cy="40" r="8" fill="#f4f6f8"/></g>
        <ellipse cx="31" cy="62" rx="6" ry="8" fill="#e9b48c"/><ellipse cx="89" cy="62" rx="6" ry="8" fill="#e9b48c"/>
        <ellipse cx="60" cy="58" rx="29" ry="33" fill="url(#dSkin)"/>
        <g id="dSprigs" stroke="#e9edf0" stroke-width="2.6" fill="none" stroke-linecap="round">
          <path d="M56 26 Q50 14 56 8"/><path d="M61 25 Q64 12 72 10"/><path d="M58 26 Q58 16 62 12"/></g>
        <g id="dBrows" fill="#d6dbe0"><rect x="38" y="40" width="18" height="5" rx="2.5" transform="rotate(-8 47 42)"/><rect x="64" y="40" width="18" height="5" rx="2.5" transform="rotate(8 73 42)"/></g>
        <g id="dEyes" fill="#1b2630"><circle cx="48" cy="55" r="3.6"/><circle cx="72" cy="55" r="3.6"/>
          <circle cx="49.3" cy="53.8" r="1.1" fill="#fff"/><circle cx="73.3" cy="53.8" r="1.1" fill="#fff"/></g>
        <g fill="rgba(190,225,255,.25)" stroke="#2a2f36" stroke-width="2.6"><circle cx="48" cy="55" r="11"/><circle cx="72" cy="55" r="11"/></g>
        <path d="M59 54 Q60 51 61 54" stroke="#2a2f36" stroke-width="2.6" fill="none"/>
        <ellipse cx="60" cy="69" rx="6.5" ry="5.5" fill="#e59b78"/><ellipse cx="58" cy="67.5" rx="2" ry="1.4" fill="#f6c3a6"/>
        <ellipse id="dMouth" cx="60" cy="82" rx="7" ry="1.2" fill="#6b1f24"/>
        <path id="dStache" d="M60 75 Q52 72 45 76 Q40 79 37 75 Q40 83 49 80 Q55 78 60 77 Q65 78 71 80 Q80 83 83 75 Q80 79 75 76 Q68 72 60 75 Z" fill="#d6dbe0" stroke="#b8bfc6" stroke-width=".8"/>
        <ellipse cx="40" cy="70" rx="4" ry="2.4" fill="#f2a08a" opacity=".45"/><ellipse cx="80" cy="70" rx="4" ry="2.4" fill="#f2a08a" opacity=".45"/>
      </g>
    </svg>
    <div class="dlive"><span></span>LIVE</div>
  </div>
  <div class="dtalk">
    <div class="dname">DR. ORBIT <small>Mission scientist</small></div>
    <div class="dtext" id="dText"></div>
    <div class="dbtns"><button id="dVoice" title="Message beeps on or off"></button><button id="dNext">OK ▸</button></div>
  </div>`;
document.body.appendChild(box);
const css = document.createElement('style'); css.textContent = `
#doc{position:fixed;left:50%;top:16px;transform:translateX(-50%);display:flex;gap:12px;align-items:stretch;width:min(560px,calc(100vw - 32px));
  background:var(--panel,rgba(6,10,16,.85));border:1px solid rgba(240,191,90,.55);border-radius:14px;padding:10px;z-index:5;box-shadow:0 8px 30px rgba(0,0,0,.45);
  transition:opacity .25s, transform .25s}
#doc.hidden{display:none}
#doc.small{width:auto;padding:6px;cursor:pointer}
#doc.small .dtalk{display:none}
#doc.small .dscreen{width:64px;height:64px}
#doc .dscreen{position:relative;flex:none;width:110px;height:110px;border-radius:10px;overflow:hidden;border:3px solid #39424c;box-shadow:inset 0 0 0 2px #11171d}
#doc .dscreen svg{width:100%;height:100%;display:block}
#doc .dscreen:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 1px,transparent 1px 3px);pointer-events:none}
#doc .dlive{position:absolute;left:5px;top:5px;font:700 9px 'IBM Plex Mono',monospace;color:#fff;background:rgba(0,0,0,.45);padding:1px 4px;border-radius:4px;display:flex;gap:3px;align-items:center}
#doc .dlive span{width:6px;height:6px;border-radius:50%;background:#ff5a4e;animation:dl 1.2s infinite}
@keyframes dl{50%{opacity:.25}}
#doc.small .dlive{display:none}
#doc .dtalk{flex:1;display:flex;flex-direction:column;min-width:0}
#doc .dname{font:700 14px 'Chakra Petch',sans-serif;color:var(--gold,#f0bf5a);letter-spacing:.05em}
#doc .dname small{font:400 11px 'IBM Plex Sans',sans-serif;color:var(--muted,#9fb0c0);letter-spacing:0;margin-left:6px}
#doc .dtext{flex:1;font-size:16px;line-height:1.4;margin:4px 0 6px;min-height:46px}
@keyframes dfoc{0%,100%{box-shadow:0 0 0 3px rgba(240,191,90,.95),0 0 18px 6px rgba(240,191,90,.55)}50%{box-shadow:0 0 0 6px rgba(240,191,90,.5),0 0 28px 12px rgba(240,191,90,.3)}}
.docfocus{animation:dfoc 1s ease-in-out infinite!important;border-radius:12px;position:relative;z-index:3}
#lknob.docfocus,#shoot.docfocus{border-radius:50%}
#doc .dbtns{display:flex;gap:6px;justify-content:flex-end}
#doc .dbtns button{font:600 13px 'Chakra Petch',sans-serif;background:rgba(255,255,255,.08);color:var(--fg,#e6ecf1);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:4px 10px;cursor:pointer}
#doc #dNext{background:var(--gold,#f0bf5a);color:#140c02;border-color:var(--gold,#f0bf5a)}
@media (max-width:760px){#doc{top:196px}#doc .dscreen{width:76px;height:76px}#doc .dtext{font-size:14px}}`;
document.head.appendChild(css);

/* --- the face --- */
const mouth = $('dMouth'), eyes = $('dEyes'), brows = $('dBrows'), head = $('dHeadG'), sprigs = $('dSprigs');
let open = 0, talking = false, mood = 'happy', blinkAt = 0, browUp = 0, t0 = performance.now();
function face(t){
  const k = (t - t0) / 1000;
  const target = talking ? .35 + .65 * Math.abs(Math.sin(k * 13)) * (.6 + .4 * Math.sin(k * 3.1)) : (mood === 'wow' ? .9 : 0);
  open += (target - open) * .35;
  mouth.setAttribute('ry', (1.2 + open * 5.2).toFixed(2)); mouth.setAttribute('rx', (mood === 'wow' && !talking ? 5 : 7 - open * 1.5).toFixed(2));
  if (t > blinkAt) blinkAt = t + 2500 + Math.random() * 3000;
  const bl = blinkAt - t < 130 ? .1 : 1; eyes.setAttribute('transform', `translate(0 ${55 * (1 - bl)}) scale(1 ${bl})`);
  const by = mood === 'wow' ? -5 : mood === 'worried' ? -2 : mood === 'think' ? -3 + Math.sin(k * 2) * 2 : talking ? -1.5 * Math.abs(Math.sin(k * 2.3)) : 0; browUp += (by - browUp) * .2;
  brows.setAttribute('transform', `translate(0 ${browUp.toFixed(2)})` + (mood === 'worried' ? ' rotate(0)' : ''));
  head.setAttribute('transform', `rotate(${(talking ? Math.sin(k * 2.7) * 3 : Math.sin(k * .8) * 1.2).toFixed(2)} 60 90)`);
  sprigs.setAttribute('transform', `rotate(${(Math.sin(k * 4) * (talking ? 6 : 2)).toFixed(2)} 58 26)`);
  requestAnimationFrame(face);
}
requestAnimationFrame(face);

/* --- talking --- */
const queue = []; let busy = false, typing = null, startT = null, full = '', onDone = null;
const stopTyping = () => { clearTimeout(startT); startT = null; clearInterval(typing); typing = null; };
/* Sound: no voice, just pleasant beeps (Web Audio, made in code). A soft two-note chime says "message coming",
   then little blips while the text types, like a radio from space. */
let ac = null;
const audio = () => { if (!soundOn) return null; try { ac = ac || new (root.AudioContext || root.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } return ac; };
addEventListener('pointerdown', () => { if (ac && ac.state === 'suspended') ac.resume(); else audio(); }, {once:true});   // browsers allow sound after the first tap
function tone(freq, at, dur, vol, type = 'sine'){ const a = audio(); if (!a || a.state !== 'running') return;
  const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at; o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02); }
/* A camera shutter: two short clicks of filtered noise ("ka-chick") over a soft thump. */
function shutter(){ const a = audio(); if (!a || a.state !== 'running') return;
  const n = a.createBuffer(1, Math.floor(a.sampleRate * .05), a.sampleRate), d = n.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  [[0, 3200, .32], [.075, 2200, .24]].forEach(([at, f, v]) => { const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + at;
    src.buffer = n; bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 1.2; g.gain.value = v; src.connect(bp).connect(g).connect(a.destination); src.start(t); });
  tone(140, 0, .09, .08, 'sine'); }
const chime = () => { tone(659.3, 0, .32, .07, 'triangle'); tone(987.8, .12, .45, .07, 'triangle'); tone(1975.5, .12, .3, .012); };   // E5 then B5, with a soft sparkle
let bn = 0; const SCALE = [523.3, 587.3, 659.3, 784, 880, 1046.5];   // a happy pentatonic scale (C D E G A C), so blips never sound wrong
const blip = (ch, mood) => { const lift = mood === 'wow' ? 1 : mood === 'worried' ? -1 : 0, i = Math.max(0, Math.min(SCALE.length - 1, (ch.toLowerCase().charCodeAt(0) * 7 + bn++) % 5 + lift));
  tone(SCALE[i] * (mood === 'worried' ? .75 : 1), 0, .07, .035, 'sine'); };
/* A line can point at a control (focus: a CSS selector): it glows until the next line, or for 12 seconds. */
let focusT = null;
const unfocus = () => { clearTimeout(focusT); document.querySelectorAll('.docfocus').forEach(el => el.classList.remove('docfocus')); };
const focusOn = sel => { unfocus(); if (!sel) return; document.querySelectorAll(sel).forEach(el => el.classList.add('docfocus')); focusT = setTimeout(unfocus, 12000); };
function next(){
  if (typing || startT) { stopTyping(); $('dText').textContent = full; talking = false; return; }   // a tap shows the whole message at once
  if (!queue.length) { busy = false; box.classList.add('small'); talking = false; const f = onDone; onDone = null; if (f) f(); return; }
  const m = queue.shift(); busy = true; full = m.text; mood = m.mood || 'happy'; box.classList.remove('hidden', 'small'); focusOn(m.focus);
  $('dNext').textContent = queue.length ? 'Next ▸' : 'OK ✓';
  chime(); talking = false; let i = 0, n = 0; $('dText').textContent = '';
  startT = setTimeout(() => { startT = null; talking = true;
    typing = setInterval(() => { const ch = full[i]; i += 1; $('dText').textContent = full.slice(0, i);
      if (ch && /[a-z0-9]/i.test(ch) && (n++ % 2 === 0)) blip(ch, mood);          // a blip every other letter
      if (i >= full.length) { clearInterval(typing); typing = null; talking = false; } }, 34); }, 380);
}
$('dNext').onclick = e => { e.stopPropagation(); next(); };
box.onclick = () => { if (box.classList.contains('small')) { box.classList.remove('small'); if (!busy && full) { queue.push({text:full, mood}); next(); } } };
const setVoiceBtn = () => { $('dVoice').textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off'; };
$('dVoice').onclick = e => { e.stopPropagation(); soundOn = !soundOn; try { localStorage.setItem('webb.voice', soundOn ? 'on' : 'off'); } catch (er) {} setVoiceBtn(); if (soundOn) chime(); };
setVoiceBtn();

root.DOC = {
  /* Say one or more lines. A new say() replaces whatever was waiting, so the newest news always wins. */
  say(lines, opts = {}){ const arr = (Array.isArray(lines) ? lines : [lines]).map(l => typeof l === 'string' ? {text:l, mood:opts.mood} : l);
    queue.length = 0; queue.push(...arr); onDone = opts.done || null; stopTyping(); next(); },
  hide(){ queue.length = 0; stopTyping(); unfocus(); talking = false; box.classList.add('hidden'); },
  get busy(){ return busy; },
  shutter(){ shutter(); },
  get sound(){ return soundOn; },
  set sound(v){ soundOn = !!v; try { localStorage.setItem('webb.voice', soundOn ? 'on' : 'off'); } catch (er) {} setVoiceBtn(); if (soundOn) chime(); },
  /* still typing, or more lines waiting: don't interrupt with a new hint */
  get pending(){ return !!(typing || startT || queue.length); },
};
})(window);
