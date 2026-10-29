/* Batch 6 game-style look (approved): title screen, console panels, in-game HUD with a settings menu, launch
   button, phone tab bar, lobby picture cards and motion. All are on by default. For testing, ?ui=off turns them
   off, ?ui=title,console picks some and ?ui=all goes back to all; the choice is remembered on this device. */
(function () {
const MR = window.MR, UI = MR.UI, $ = UI.$;
const ALL = ['title','console','hud','launch','phone','cards','motion'];
const parse = v => v === 'off' ? [] : v === 'all' || v == null ? ALL : v.split(',').filter(k => ALL.includes(k));
let pick = ALL;
try {
  const q = new URLSearchParams(location.search).get('ui');
  if (q != null) { pick = parse(q); localStorage.setItem('mr2.look', q); }
  else pick = parse(localStorage.getItem('mr2.look'));
} catch (e) { pick = ALL; }
const on = k => pick.includes(k);
pick.forEach(k => document.body.classList.add('ui-' + k));
const svg = (d, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON = {
  rover:svg('<rect x="5" y="8" width="14" height="6" rx="1.5"/><path d="M9 8V5h3"/><circle cx="12" cy="4" r="1.2"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="12" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>'),
  dish:svg('<path d="M4 10a8 8 0 0 0 10 10L4 10z"/><path d="M9 15l5-5"/><path d="M15 4a5 5 0 0 1 5 5"/><path d="M15 8a1 1 0 0 1 1 1"/><path d="M7 20h6"/>'),
  key:svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l2 2"/><path d="M15 8l2 2"/>'),
  plan:svg('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>'),
  flag:svg('<path d="M6 21V4"/><path d="M6 4h11l-2 4 2 4H6"/>'),
  log:svg('<path d="M5 4h11l3 3v13H5z"/><path d="M9 10h6M9 14h6"/>'),
  gear:svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
};
MR.UI2 = {on, pick, reveal(){}};

/* Which screen is showing, so the styles can change per screen. */
const show0 = UI.show;
UI.show = name => { show0(name); document.body.dataset.scr = name; if (on('phone') && name === 'scrGame') setTab(document.body.dataset.ptab || 'plan'); };
document.body.dataset.scr = 'scrHome';

/* 1. Title screen: a hero with the planet and big mode tiles with icons. */
if (on('title')) {
  const hero = document.createElement('div'); hero.className = 'hero';
  hero.innerHTML = '<div class="planet" aria-hidden="true"></div><div class="htxt"><h2 class="htitle">Mars Rover Ops</h2><p>Plan. Send. Explore. Real places on Mars and the Moon, played together.</p></div>';
  $('scrHome').prepend(hero);
  [['soloBtn','rover'],['hostBtn','dish'],['joinBtn','key']].forEach(([id, ic]) => { const m = $(id).closest('.mode'); if (m) { const i = document.createElement('span'); i.className = 'micon'; i.innerHTML = ICON[ic]; m.prepend(i); } });
}

/* 3. In-game HUD: a small top bar and a gear menu for the settings under the map. */
if (on('hud')) {
  const g = document.createElement('button'); g.className = 'btn gearbtn'; g.id = 'gearBtn'; g.title = 'Settings'; g.setAttribute('aria-label', 'Settings'); g.innerHTML = ICON.gear;
  $('invBtn').before(g);
  const tools = document.querySelector('.maptools'), how = document.querySelector('details.how');
  tools.classList.add('gearmenu'); tools.insertAdjacentHTML('afterbegin', '<b class="gmt">Settings</b>'); if (how) tools.append(how);
  g.onclick = e => { e.stopPropagation(); document.body.classList.toggle('toolsopen'); };
  document.addEventListener('click', e => { if (!e.target.closest('.maptools') && !e.target.closest('#gearBtn')) document.body.classList.remove('toolsopen'); });
}

/* 5. Phone: the map stays on top and a tab bar at the bottom switches Plan / Mission / Log. */
const TABS = [['plan','Plan','plan'],['mission','Mission','flag'],['log','Log','log']];
function setTab(t){ document.body.dataset.ptab = t; document.querySelectorAll('#ptabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t)); if (t === 'log') { const b = document.querySelector('#ptabs [data-t=log]'); b && b.classList.remove('new'); } }
if (on('phone')) {
  const side = document.querySelector('.side');
  const tabOf = el => el.id === 'missionBar' ? 'both' : el.id === 'cadetPanel' || el.id === 'planPanel' || el.id === 'statusPanel' ? 'plan' : el.querySelector('#log') ? 'log' : 'mission';
  [...side.children].forEach(el => el.dataset.ptab = tabOf(el));
  const bar = document.createElement('nav'); bar.id = 'ptabs'; bar.className = 'ptabs';
  bar.innerHTML = TABS.map(([k, l, ic]) => `<button data-t="${k}" aria-selected="${k === 'plan'}">${ICON[ic]}<span>${l}</span></button>`).join('');
  document.body.append(bar); document.body.dataset.ptab = 'plan';
  bar.onclick = e => { const b = e.target.closest('button'); if (b) { setTab(b.dataset.t); MR.sfx && MR.sfx.click(); scrollTo({top:0}); } };
  new MutationObserver(() => { if (document.body.dataset.ptab !== 'log' && MR.Game.state && MR.Game.state.sol > 1) { const b = bar.querySelector('[data-t=log]'); b && b.classList.add('new'); } }).observe($('log'), {childList:true});
  MR.UI2.reveal = el => { if (!el || innerWidth > 760) return; const p = el.closest('[data-ptab]'); if (p && p.dataset.ptab !== 'both' && p.dataset.ptab !== document.body.dataset.ptab) setTab(p.dataset.ptab); };
}

/* 6. Lobby cards with pictures: each rover drawn by the game, each map with its own landscape colors. */
if (on('cards')) {
  const deco = () => {
    const moon = MR.MAPS[MR.Game.lobby && MR.Game.lobby.map] && MR.MAPS[MR.Game.lobby.map].airless, p = MR.Store.current();
    document.querySelectorAll('#jobPick .job').forEach(b => { if (b.querySelector('canvas')) return; const c = document.createElement('canvas'); c.width = c.height = 120; c.className = 'jpic'; b.prepend(c);
      const job = b.dataset.job; MR.Render.drawPreview(c, {job, role:job === 'buggy' || job === 'heli' ? 'cadet' : 'explorer', color:(p && p.color) || 'teal', perks:[], tubes:job === 'hauler' ? ['clay','olivine','salts'] : [], dust:0}, moon && job !== 'heli' && job !== 'lab'); });
    document.querySelectorAll('#mapPick .mapcard').forEach(b => { if (b.querySelector('.mart')) return; const a = document.createElement('span'); a.className = 'mart'; a.dataset.m = b.dataset.map; a.setAttribute('aria-hidden', 'true'); if (!(MR.Game.lobby && MR.Game.lobby.unlocked || MR.Store.unlocked()).includes(b.dataset.map)) a.innerHTML = '<i>LOCKED</i>'; b.prepend(a); });
  };
  new MutationObserver(deco).observe($('jobPick'), {childList:true});
  new MutationObserver(deco).observe($('mapPick'), {childList:true});
}
})();
