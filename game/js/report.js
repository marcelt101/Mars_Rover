/* Bug reports: a "Report a problem" window (Settings, Parents page, the Beta badge) and an error catcher that offers
   to send a report when something breaks. Nothing is ever sent without a tap on Send, and reports carry no names:
   player names are replaced, chat and messages are left out. Reports go to the Google Form set in edition.js
   (MR.REPORT); without one the report can be copied instead. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const errors = [];
let lastPopup = 0;
function remember(msg, where, stack){
  msg = String(msg || 'Unknown error').slice(0, 300);
  if (errors.some(e => e.msg === msg)) return;
  errors.push({msg, where:String(where || '').replace(/^.*\/(js\/)?/, '').slice(0, 80), stack:String(stack || '').split('\n').slice(0, 4).map(s => s.trim().replace(/\(?https?:\/\/[^)\s]*\/([^/)\s]+)\)?/g, '$1')).join(' | ').slice(0, 400), t:Date.now()});
  if (errors.length > 8) errors.shift();
  /* One offer every two minutes at most, and never over another window. */
  if (Date.now() - lastPopup > 120000 && !UI.modalOpen()) { lastPopup = Date.now(); setTimeout(offer, 600); }
}
addEventListener('error', e => { if (e.message) remember(e.message, `${e.filename || ''}:${e.lineno || ''}`, e.error && e.error.stack); });
addEventListener('unhandledrejection', e => { const r = e.reason || {}; remember(r.message || r, '', r.stack); });
function offer(){
  const box = document.createElement('div'); box.className = 'dmpop errpop'; box.setAttribute('role', 'alert');
  box.innerHTML = `<span class="ei">!</span><div class="dmb"><small>Something went wrong</small><p>The game hit a problem. Sending a report helps us fix it.</p>
    <div class="row"><button class="btn primary" data-s>Send a report</button><button class="btn" data-x>Not now</button></div></div>`;
  $('dmPops').prepend(box);
  const t = setTimeout(() => box.remove(), 20000);
  box.onclick = e => { if (e.target.closest('[data-s]')) { clearTimeout(t); box.remove(); MR.Report.open(true); } else if (e.target.closest('[data-x]')) { clearTimeout(t); box.remove(); } };
}
/* Game details for the report, with every player name swapped for "Player 1", "Player 2"... */
function details(){
  const g = MR.Game || {}, st = g.state, p = MR.Store.current(), lobby = g.lobby || {}, names = new Map();
  (lobby.players || []).forEach((x, i) => names.set(x.name, `Player ${i + 1}`));
  MR.Store.profiles().forEach(x => { if (!names.has(x.name)) names.set(x.name, 'Player'); });
  const scrub = s => { let out = String(s); [...names.keys()].filter(n => n && n.length > 1).sort((a, b) => b.length - a.length).forEach(n => { out = out.split(n).join(names.get(n)); }); return out; };
  const logs = [...document.querySelectorAll('#log li')].filter(li => !li.querySelector('.chat, .dm')).slice(0, 8).map(li => scrub([...li.children].map(c => c.textContent).join(' ').replace(/\s+/g, ' ').trim()));
  const me = st && st.rovers.find(r => r.pid === g.myPid);
  const lines = [
    `Game: Crater Crew ${MR.ED.label} · build ${MR.BUILD} · v${MR.VERSION}${MR.ED.beta ? ' · beta' : ''}`,
    `Device: ${navigator.userAgent}`,
    `Screen: ${innerWidth}×${innerHeight} @${devicePixelRatio || 1}x · look ${(document.body.className.match(/ui-\w+/g) || []).length ? 'game' : 'plain'} · ${navigator.onLine === false ? 'offline' : 'online'}`,
    `Where: ${g.phase || '?'} · ${g.mode || 'no game'}${lobby.players ? ` · ${lobby.players.length} player(s)` : ''}`,
    st ? `Game: ${st.map} · sol ${st.sol}${st.day ? ` · Mission Log day ${st.day}` : ''}${st.camp ? ` · campaign ${st.camp.i + 1}` : ''}` : '',
    me ? `My rover: ${me.role} · ${me.job} · battery ${me.bat}% · tubes ${me.tubes.length}${me.stuck ? ' · stuck' : ''}` : (p ? `Profile role: ${p.role}` : ''),
    errors.length ? 'Errors:\n' + errors.map(e => `- ${e.msg}${e.where ? ` (${e.where})` : ''}${e.stack ? `\n  ${e.stack}` : ''}`).join('\n') : 'Errors: none caught',
    logs.length ? 'Last log lines:\n' + logs.map(l => '- ' + l).join('\n') : '',
  ];
  return lines.filter(Boolean).join('\n').slice(0, 4000);
}
MR.Report = {
  details,
  errors:() => errors.slice(),
  open(fromError){
    const R = MR.REPORT || {}, canSend = !!(R.formUrl && R.fields);
    UI.openModal(`<div class="sh"><h2>Report a problem</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
      <p class="muted" style="margin:0">Thank you! Tell us what went wrong and we will fix it. <b>Please don't type your name, email or where you live.</b></p>
      <label class="field"><span>What happened?</span><textarea class="input rptx" id="rpWhat" maxlength="1000" rows="3" placeholder="${fromError ? 'For example: the screen froze after I pressed Send to Mars' : 'For example: my rover drove through a rock'}"></textarea></label>
      <label class="field"><span>What were you doing? <small class="muted">(optional)</small></span><textarea class="input rptx" id="rpDoing" maxlength="600" rows="2" placeholder="For example: a team game with 3 tablets, day 4 of the Mission Log"></textarea></label>
      <label class="toggle" style="color:var(--fg)"><input type="checkbox" id="rpDet" checked> Add game details (no names, no chat)</label>
      <details class="rpdet"><summary>See what is sent</summary><pre id="rpPre">${esc(details())}</pre></details>
      <p class="err" id="rpErr" hidden></p>
      <div class="row" style="justify-content:flex-end">${canSend ? '<button class="btn primary" id="rpSend">Send report</button>' : '<button class="btn primary" id="rpCopy">Copy report</button>'}</div>
      ${canSend ? '' : `<p class="muted" style="margin:0;font-size:13px">Copy the report and send it to us${R.email ? ` at <b>${esc(R.email)}</b>` : ''}.</p>`}</div>`, true);
    const text = () => ({what:$('rpWhat').value.trim(), doing:$('rpDoing').value.trim(), det:$('rpDet').checked ? details() : ''});
    const need = t => { if (t.what) return true; $('rpErr').hidden = false; $('rpErr').textContent = 'Write a few words about what happened first.'; return false; };
    setTimeout(() => $('rpWhat') && $('rpWhat').focus(), 50);
    [$('rpWhat'), $('rpDoing')].forEach(ta => ta.addEventListener('keydown', e => e.stopPropagation()));
    if ($('rpCopy')) $('rpCopy').onclick = () => { const t = text(); if (!need(t)) return;
      const all = `What happened: ${t.what}\nWhat I was doing: ${t.doing || '-'}\n\n${t.det}`;
      const done = () => { UI.closeModal(); UI.toast('✓', '#58cfbe', 'Report copied', 'Paste it into an email to us. Thank you!', 5000); };
      (navigator.clipboard ? navigator.clipboard.writeText(all) : Promise.reject()).then(done, () => { $('rpPre').textContent = all; document.querySelector('.rpdet').open = true; $('rpErr').hidden = false; $('rpErr').textContent = 'Select the text above and copy it.'; }); };
    if ($('rpSend')) $('rpSend').onclick = async () => { const t = text(); if (!need(t)) return;
      const fd = new FormData(); fd.append(R.fields.what, t.what); fd.append(R.fields.doing, t.doing); fd.append(R.fields.details, t.det);
      $('rpSend').disabled = true; $('rpSend').textContent = 'Sending…';
      try { await fetch(R.formUrl, {method:'POST', mode:'no-cors', body:fd}); UI.closeModal(); UI.toast('✓', '#58cfbe', 'Report sent', 'Thank you! It helps us make the game better.', 5000); }
      catch (e) { $('rpSend').disabled = false; $('rpSend').textContent = 'Send report'; $('rpErr').hidden = false; $('rpErr').textContent = 'Could not send. Check the internet connection and try again.'; } };
  },
};
})();
