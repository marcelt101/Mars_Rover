/* Private messages between players in a team game: up to MR.DM_MAX characters, sent through the host, which can
   turn them off in Settings. Pick a player in the crew list or the crew bar, or tap / right-click their rover. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const api = () => MR.Game.api;
/* Quick messages: one tap, no typing, so Cadets can send them too. */
const QUICK = [['👋','Hi!'],['📍','Come here!'],['💎','I found something!'],['🆘','Help, I am stuck!'],['⭐','Great job!'],['🔋','My battery is low.'],['🏠','Going home.'],['👍','OK!']];
const player = pid => api().players().find(x => x.pid === pid);
MR.Msg = {
  can(pid){
    const g = MR.Game; if (!g || !api().isTeam() || pid === g.myPid) return false;
    const lp = player(pid); return !!lp && lp.connected && api().msgRules().dm;
  },
  compose(pid){
    const lp = player(pid); if (!lp) return;
    if (!MR.Msg.can(pid)) { UI.toast('✉', '#f0bf5a', 'Messages are off', 'The host has turned private messages off.', 4000); return; }
    const p = MR.Store.current(), cadet = p && p.role === 'cadet';
    UI.openModal(`<div class="sh"><h2>Message to ${esc(lp.name)}</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
      <div class="dmto">${UI.avatar(lp)}<span><b>${esc(lp.name)}</b><small>${esc(MR.ROLES[lp.role] ? MR.ROLES[lp.role].label : '')} · only ${esc(lp.name)} sees this</small></span></div>
      <div class="dmquick" id="dmQuick">${QUICK.map(([e, t], i) => `<button class="btn" data-q="${i}"><span class="qe">${e}</span> ${esc(t)}</button>`).join('')}</div>
      ${cadet ? '' : `<label class="field"><span>Or write your own</span><textarea class="input dmtext" id="dmText" maxlength="${MR.DM_MAX}" rows="3" placeholder="A few words for ${esc(lp.name)}"></textarea></label>
      <div class="row" style="justify-content:space-between"><span class="count" id="dmCount">0 / ${MR.DM_MAX}</span><button class="btn primary" id="dmSend" disabled>Send</button></div>`}</div>`, true);
    const go = text => { text = String(text).trim().slice(0, MR.DM_MAX); if (!text) return; api().toHost({type:'dm', to:pid, text}); UI.closeModal(); MR.sfx.click(); };
    $('dmQuick').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { const [em, t] = QUICK[+b.dataset.q]; go(`${em} ${t}`); } };
    if ($('dmText')) {
      const ta = $('dmText'), upd = () => { $('dmCount').textContent = `${ta.value.length} / ${MR.DM_MAX}`; $('dmSend').disabled = !ta.value.trim(); };
      ta.oninput = upd; ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(ta.value); } e.stopPropagation(); };
      $('dmSend').onclick = () => go(ta.value); setTimeout(() => ta.focus(), 50);
    }
  },
  receive(m){
    const box = document.createElement('div'); box.className = 'dmpop'; box.setAttribute('role', 'status');
    box.innerHTML = `${UI.avatar(m)}<div class="dmb"><small>Message from <b style="color:${MR.colorHex(m.color)}">${esc(m.name)}</b></small><p>${esc(m.text)}</p>
      <div class="row">${MR.Msg.can(m.from) ? '<button class="btn" data-r>Reply</button>' : ''}<button class="btn" data-x>OK</button></div></div>`;
    $('dmPops').prepend(box); while ($('dmPops').children.length > 3) $('dmPops').lastChild.remove();
    const close = () => box.remove(), t = setTimeout(close, 15000);
    box.onclick = e => { if (e.target.closest('[data-r]')) { clearTimeout(t); close(); MR.Msg.compose(m.from); } else if (e.target.closest('[data-x]')) { clearTimeout(t); close(); } };
    if (MR.Game.state) api().log('dm', `✉ ${m.name} to you: ${m.text}`);
    MR.sfx.click(); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
  },
  sent(m){
    if (MR.Game.state) api().log('dm', `✉ You to ${m.toName}: ${m.text}`);
    UI.toast('✉', '#58cfbe', `Sent to ${m.toName}`, m.text, 2500);
  },
};
})();
