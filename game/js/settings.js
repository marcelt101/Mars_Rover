/* Settings: every setting of the game on one page, from the gear button on any screen. Sound, music and fast
   mode drive the same controls as the in-game menu; messages are the host's choice for team games. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const S = () => MR.Store.settings;
const tog = (id, on, label, sub, dis) => `<label class="sset ${dis ? 'dis' : ''}"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><input type="checkbox" class="swi" id="${id}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}></label>`;
/* Change a setting through the existing control, so everything that listens to it updates too. */
const viaControl = (id, val) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = val; else el.value = val; (el.type === 'checkbox' ? el.onchange : el.oninput || el.onchange)({target:el}); };
UI.settings = () => {
  const s = S(), g = MR.Game, api = g.api, inTeam = api.isTeam(), host = g.mode !== 'client', rules = api.msgRules(), p = MR.Store.current();
  const look = (() => { try { return localStorage.getItem('mr2.look') !== 'off'; } catch (e) { return true; } })();
  UI.openModal(`<div class="sh"><h2>Settings</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb settings">
    <section><h3 class="t">Sound and music</h3>
      ${tog('stSound', s.sound, 'Sound effects', 'Beeps, clicks and the Cadet read-aloud.')}
      ${tog('stMusic', s.music !== false, 'Space music', 'Calm background music.')}
      <label class="sset"><span><b>Music volume</b></span><input type="range" id="stVol" min="0" max="100" step="5" value="${s.musicVol ?? 35}" ${s.music === false ? 'disabled' : ''} aria-label="Music volume"></label></section>
    <section><h3 class="t">Game</h3>
      ${tog('stFast', s.fast, 'Fast mode', 'Rovers drive faster when a plan runs.')}
      ${tog('stLook', look, 'Game-style look', 'Turn off for the plain look. The page reloads.')}
      <div class="sset"><span><b>Tutorial</b><small>Show the tutorial bar on the start screen again.</small></span><button class="btn" id="stTut" ${p ? '' : 'disabled'}>Show again</button></div></section>
    <section><h3 class="t">Messages in team games</h3>
      ${host ? `<p class="muted">${g.mode === 'host' ? 'You are the host of this game, so you decide for everyone.' : 'When this device hosts a team game, these choices apply to everyone in it.'}</p>` : '<p class="muted">The host of this game decides. Ask them to change it.</p>'}
      ${tog('stDm', rules.dm, 'Private messages', `Players can send each other short messages (up to ${MR.DM_MAX} characters) from the crew list or by tapping a rover.`, !host)}
      ${tog('stChat', rules.chat, 'Team chat', 'Messages everyone on the team sees, in the Mission log.', !host)}
      ${inTeam && host ? '<p class="muted" style="font-size:13px">Changes apply right away for everyone in this game.</p>' : ''}</section>
    <section><h3 class="t">Parents</h3>
      <label class="sset"><span><b>Break reminder</b><small>A friendly reminder to take a break.</small></span><select class="input" id="stBrk">${[0, 30, 45, 60, 90].map(v => `<option value="${v}" ${v === (s.breakMins ?? 60) ? 'selected' : ''}>${v ? `After ${v} min` : 'Off'}</option>`).join('')}</select></label>
      <div class="sset"><span><b>Parents and saves</b><small>Progress, saves and backups for each child.</small></span><button class="btn" id="stParents">Open</button></div>
      <div class="sset"><span><b>What the game teaches</b><small>For teachers and parents.</small></span><button class="btn" id="stGuide">Open</button></div></section>
    <p class="muted" style="margin:0;font-size:12px">Crater Crew · ${esc(MR.ED.label)} · build ${esc(MR.BUILD)}</p>
    ${g.phase !== 'home' && g.phase !== 'lobby' && g.state ? '<div class="row" style="justify-content:flex-end"><button class="btn danger" id="stLeave">Leave game</button></div>' : ''}</div>`);
  $('stSound').onchange = e => viaControl('sound', e.target.checked);
  $('stMusic').onchange = e => { viaControl('music', e.target.checked); $('stVol').disabled = !e.target.checked; };
  $('stVol').oninput = e => viaControl('musicVol', +e.target.value);
  $('stFast').onchange = e => viaControl('fast', e.target.checked);
  $('stLook').onchange = e => { try { localStorage.setItem('mr2.look', e.target.checked ? 'all' : 'off'); } catch (er) {} const u = new URL(location.href); u.searchParams.delete('ui'); location.href = u.toString(); };
  $('stTut').onclick = () => { if (p) { p.tutHide = false; p.tutShow = true; MR.Store.save(); UI.renderHome(); UI.toast('✎', '#58cfbe', 'Tutorial bar is back', 'Find it on the start screen.', 3000); } };
  if (host) {
    $('stDm').onchange = e => { s.dmAllow = e.target.checked; MR.Store.save(); api.rulesChanged(); };
    $('stChat').onchange = e => { s.chatAllow = e.target.checked; MR.Store.save(); api.rulesChanged(); };
  }
  $('stBrk').onchange = e => { s.breakMins = +e.target.value; MR.Store.save(); };
  $('stParents').onclick = () => UI.parents();
  $('stGuide').onclick = () => UI.guide('adults');
  if ($('stLeave')) $('stLeave').onclick = () => { $('leaveGameBtn').click(); $('stLeave').textContent = $('leaveGameBtn').textContent; if ($('scrGame').hidden) UI.closeModal(); };
};
})();
