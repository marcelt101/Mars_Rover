/* Screens and popups that are not the map: home, profiles, inventory, parents, toasts, treasure chest. */
(function () {
const MR = window.MR;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const UI = MR.UI = {$, esc};

MR.speed = () => MR.Store.settings.fast ? .33 : 1;
let actx = null;
function beep(f, d = .08, type = 'sine', v = .06){
  if (!MR.Store.settings.sound) return;
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, actx.currentTime); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + d);
    o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + d); } catch (e) {}
}
MR.sfx = {
  move:() => beep(200,.05,'triangle',.025), bump:() => beep(110,.2,'square',.04), scan:() => beep(520,.3,'sine',.04),
  good:() => { beep(660,.1); setTimeout(() => beep(880,.16), 90); }, click:() => beep(440,.04,'triangle',.03),
  chest:() => [392,523,659,784].forEach((f,i) => setTimeout(() => beep(f,.14), 260 + i*90)),
  win:() => [523,659,784,1047].forEach((f,i) => setTimeout(() => beep(f,.2), i*120)), join:() => beep(740,.12,'sine',.05),
};

UI.avatar = (p, cls = '') => p.avatar != null && MR.avatarsOn && MR.avatarsOn() && MR.AVATARS[p.avatar]
  ? `<span class="av pic ${cls}" style="background:${MR.colorHex(p.color)}" title="${esc(MR.AVATARS[p.avatar].name)}">${MR.avatarSvg(p.avatar)}</span>`
  : `<span class="av ${cls}" style="background:${MR.colorHex(p.color)}">${esc((p.name || '?').slice(0,1).toUpperCase())}</span>`;
UI.show = name => {
  ['scrHome','scrLobby','scrGame'].forEach(s => $(s).hidden = s !== name);
  scrollTo(0, 0);
  UI.renderMe();
  if (MR.LogUI) MR.LogUI.renderHome();
};
UI.renderMe = () => {
  const p = MR.Store.current();
  $('meBtn').hidden = !p; $('invBtn').hidden = !p;
  if (!p) return;
  const ri = MR.rankInfo(p);
  $('meBtn').innerHTML = `${UI.avatar(p)}<span><b>${esc(p.name)}</b><small>${ri.name} · ${MR.ROLES[p.role].label}</small></span>`;
};

/* ---------- home ---------- */
UI.renderHome = () => {
  const list = MR.Store.profiles(), cur = MR.Store.current();
  $('profiles').innerHTML = list.map(p => { const ri = MR.rankInfo(p);
    return `<button class="pcard" data-id="${p.id}" aria-pressed="${cur && cur.id === p.id}">${UI.avatar(p)}<span style="min-width:0;flex:1"><b>${esc(p.name)}</b><small>${MR.ROLES[p.role].label} · ${ri.name}</small><div class="xpbar"><span style="width:${Math.round(ri.frac*100)}%"></span></div></span></button>`; }).join('')
    + (list.length ? `<button class="pcard new" id="newProfile">+ New crew member</button>` : `<button class="pcard new first" id="newProfile"><b>+ Create your crew member</b><small>Pick a name, a color and your level to start</small></button>`);
  $('modes').style.opacity = cur ? 1 : .4;
  $('tutBar').hidden = !cur || (cur.tutDone && !cur.tutShow) || cur.tutHide;
  ['soloBtn','hostBtn','joinBtn'].forEach(id => $(id).disabled = !cur);
  const ex = MR.Store.expedition(), canResume = !!(ex && cur && ex.pid === cur.id && (!ex.won || ex.keep) && MR.MAPS[ex.map]);
  $('resumePanel').hidden = !canResume;
  if (canResume) { const ago = Math.round((Date.now() - ex.at) / 60000);
    $('resumeText').textContent = `${MR.MAPS[ex.map].name}, sol ${ex.sol}. ${ex.mode === 'host' ? `Team game with ${ex.names.filter(n => n !== cur.name).join(', ') || 'your crew'}. Everyone joins again with the new room code and gets their own rover back.` : 'Solo.'} Saved ${ago < 1 ? 'just now' : ago < 60 ? ago + ' min ago' : ago < 2880 ? Math.round(ago/60) + ' h ago' : Math.round(ago/1440) + ' days ago'}.`;
    $('resumeBtn').disabled = ex.mode === 'host' && !MR.netAvailable(); }
  $('hostBtn').disabled = !cur || !MR.netAvailable();
  $('joinBtn').disabled = !cur || !MR.netAvailable();
  UI.renderMe();
  if (MR.LogUI) MR.LogUI.renderHome();
};
$('profiles').addEventListener('click', e => {
  const b = e.target.closest('.pcard'); if (!b) return;
  if (b.id === 'newProfile') return UI.profileModal(null);
  MR.Store.select(b.dataset.id); UI.renderHome(); MR.sfx.click();
});

/* ---------- modal helpers ---------- */
let modalClose = null;
UI.openModal = (html, narrow, onClose) => { $('tapMenu').hidden = true; $('tip').hidden = true; $('sheet').className = 'sheet' + (narrow ? ' narrow' : ''); $('sheet').innerHTML = html; $('modal').hidden = false; modalClose = onClose || null; };
UI.closeModal = () => { if ($('modal').hidden) return; $('modal').hidden = true; $('sheet').innerHTML = ''; const f = modalClose; modalClose = null; if (f) f(); };
UI.modalOpen = () => !$('modal').hidden;
$('modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) UI.closeModal(); });

/* ---------- profile editor ---------- */
UI.profileModal = existing => {
  const p = existing || {name:'', color:MR.COLORS[MR.Store.profiles().length % MR.COLORS.length].id, role:'explorer'};
  let color = p.color, role = p.role, avatar = p.avatar ?? null;
  const avPick = MR.avatarsOn && MR.avatarsOn();
  UI.openModal(`
    <div class="sh"><h2>${existing ? 'Edit profile' : 'New crew member'}</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    <div class="sb">
      <label class="field"><span>Name</span><input class="input" id="pfName" maxlength="16" value="${esc(p.name)}" placeholder="Your name" autocomplete="off"></label>
      <div class="field"><span>Rover color</span><div class="swatches" id="pfColors">${MR.COLORS.map(c => `<button class="sw" data-c="${c.id}" aria-label="${c.name}" aria-pressed="${c.id === color}" style="background:${c.hex}"></button>`).join('')}</div></div>
      ${avPick ? `<div class="field"><span>Avatar <small class="muted" id="pfAvName">${avatar != null ? esc(MR.AVATARS[avatar].name) : 'Your first letter'}</small></span><div class="avpick" id="pfAvs" style="--pc:${MR.colorHex(color)}">
        <button class="avo" data-a="" aria-pressed="${avatar == null}" aria-label="Your first letter"><span class="avl" id="pfLetter">${esc((p.name || '?').slice(0, 1).toUpperCase())}</span></button>
        ${MR.AVATARS.map(a => `<button class="avo" data-a="${a.id}" aria-pressed="${a.id === avatar}" aria-label="${esc(a.name)}" title="${esc(a.name)}">${MR.avatarSvg(a.id)}</button>`).join('')}</div></div>` : ''}
      <div class="field"><span>Crew role</span><div class="roles" id="pfRoles">${Object.entries(MR.ROLES).map(([k, r]) => `<button class="role" data-r="${k}" aria-pressed="${k === role}"><b>${r.label}</b><small>${r.ages}</small><small>${r.desc}</small></button>`).join('')}</div></div>
      <p class="err" id="pfErr" hidden></p>
      <div class="row"><button class="btn primary" id="pfSave">${existing ? 'Save' : 'Create'}</button>${existing ? `<button class="btn danger" id="pfDel">Delete profile</button>` : ''}</div>
    </div>`, true);
  $('pfName').focus();
  $('pfColors').onclick = e => { const b = e.target.closest('.sw'); if (!b) return; color = b.dataset.c; if ($('pfAvs')) $('pfAvs').style.setProperty('--pc', MR.colorHex(color)); $('pfColors').querySelectorAll('.sw').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  if ($('pfAvs')) { $('pfAvs').onclick = e => { const b = e.target.closest('.avo'); if (!b) return; avatar = b.dataset.a === '' ? null : +b.dataset.a;
      $('pfAvs').querySelectorAll('.avo').forEach(x => x.setAttribute('aria-pressed', x === b)); $('pfAvName').textContent = avatar != null ? MR.AVATARS[avatar].name : 'Your first letter'; };
    $('pfName').addEventListener('input', () => { $('pfLetter').textContent = ($('pfName').value.trim() || '?').slice(0, 1).toUpperCase(); }); }
  $('pfRoles').onclick = e => { const b = e.target.closest('.role'); if (!b) return; role = b.dataset.r; $('pfRoles').querySelectorAll('.role').forEach(x => x.setAttribute('aria-pressed', x === b)); };
  const saveIt = () => {
    const name = $('pfName').value.trim();
    if (!name) { $('pfErr').hidden = false; $('pfErr').textContent = 'Type a name first.'; return; }
    if (existing) { existing.name = name.slice(0,16); existing.color = color; if (avPick) existing.avatar = avatar;
      if (existing.role !== role) { existing.role = role; existing.job = MR.defaultJob(role); existing.perks = []; }
      MR.Store.save(); }
    else { const np = MR.Store.create({name, color, role}); if (avPick && np) { np.avatar = avatar; MR.Store.save(); } }
    UI.closeModal(); UI.renderHome(); if (MR.Game && MR.Game.onProfileChanged) MR.Game.onProfileChanged();
  };
  $('pfSave').onclick = saveIt;
  $('pfName').onkeydown = e => { if (e.key === 'Enter') saveIt(); };
  if (existing) {
    let armed = false;
    $('pfDel').onclick = () => { if (!armed) { armed = true; $('pfDel').textContent = 'Tap again to delete for good'; return; } MR.Store.remove(existing.id); UI.closeModal(); UI.renderHome(); };
  }
};

/* ---------- inventory (I) ---------- */
let invTab = 'cards', invSel = null;
UI.inventory = tab => {
  const p = MR.Store.current(); if (!p) return;
  if (tab) invTab = tab;
  UI.invOpenedAt = Date.now();
  const tabs = [['cards','Cards'],['chart','Minerals chart'],['notebook','Notebook'],['photos','Photos'],['stickers','Stickers'],['patches','Patches'],['rover','Rover'],['stats','Stats']];
  const ri = MR.rankInfo(p);
  const owned = MR.CARD_ORDER.filter(id => p.cards[id] && p.cards[id].n);
  const shinies = MR.CARD_ORDER.filter(id => p.cards[id] && p.cards[id].shiny).length;
  const gotPatches = MR.PATCHES.filter(pt => p.patches[pt.id]).length;
  let body = '';
  if (invTab === 'cards') {
    const sel = invSel && MR.CARDS[invSel] && p.cards[invSel] ? invSel : null;
    body = `<p class="muted" style="margin:0">${owned.length} of ${MR.CARD_ORDER.length} cards found · ${shinies} shiny. Tap a card to read about it.</p>
      ${sel ? `<div class="cardfact"><b>${esc(MR.CARDS[sel].name)}</b> · <span style="color:${MR.RARITY[MR.CARDS[sel].rar].col}">${MR.RARITY[MR.CARDS[sel].rar].name}</span><br>${esc(MR.CARDS[sel].fact)}${p.cards[sel].where ? `<br><small class="muted">Last found at ${esc(p.cards[sel].where)}.</small>` : ''}</div>` : ''}
      <div class="cards">${MR.CARD_ORDER.map(id => { const c = MR.CARDS[id], have = p.cards[id] && p.cards[id].n, sh = p.cards[id] && p.cards[id].shiny, rar = MR.RARITY[c.rar];
        if (!have) return `<div class="card locked"><div class="gm"></div><b>???</b><span class="rar" style="color:${rar.col}">${rar.name}</span><small class="muted">Found at ${c.maps.map(m => MR.MAPS[m].name).join(' or ')}</small></div>`;
        return `<button class="card ${sh ? 'shiny' : ''} ${sel === id ? 'sel' : ''}" data-card="${id}">${sh ? '<span class="shn" title="Shiny">✦</span>' : ''}<span class="n">×${p.cards[id].n + (p.cards[id].shiny||0)}</span><div class="gm" style="background:${c.color}"></div><b>${esc(p.role === 'cadet' && c.kid ? c.kid : c.name)}</b><span class="rar" style="color:${rar.col}">${rar.name}</span></button>`; }).join('')}</div>`;
  } else if (invTab === 'chart') {
    body = chartHtml(p);
  } else if (invTab === 'notebook') {
    body = MR.LogUI.notebookHtml(p);
  } else if (invTab === 'photos') {
    body = MR.LogUI.photosHtml();
  } else if (invTab === 'stickers') {
    const st = p.stickers || {}, got = MR.STICKERS.filter(x => st[x.id]).length;
    body = `<p class="muted" style="margin:0">${got} of ${MR.STICKERS.length} stickers. ${p.role === 'cadet' ? 'Every treasure gives a sticker!' : 'You get a sticker for every delivery and every find from Mars history.'}</p>
      <div class="stickers">${MR.STICKERS.map(x => { const n = st[x.id] || 0, t = MR.STICKER_TIER[x.tier];
        return `<div class="stk ${n ? 'got' : ''} tier-${x.tier}" title="${esc(x.name)}">${n ? `<span class="se">${x.e}</span>` : '<span class="se q">?</span>'}<b>${n ? esc(x.name) : '???'}</b><small style="color:${t.col}">${t.name}${n > 1 ? ` ×${n}` : ''}</small></div>`; }).join('')}</div>`;
  } else if (invTab === 'patches') {
    body = `<p class="muted" style="margin:0">${gotPatches} of ${MR.PATCHES.length} mission patches earned.</p>
      <div class="patches">${MR.PATCHES.map((pt, i) => { const got = !!p.patches[pt.id], col = MR.COLORS[i % MR.COLORS.length].hex;
        return `<div class="patch ${got ? '' : 'locked'}"><div class="pt" style="background:${col}">${esc(pt.icon)}</div><b>${esc(pt.name)}</b><small>${esc(pt.desc)}</small></div>`; }).join('')}</div>`;
  } else if (invTab === 'rover') {
    const eq = MR.equippedPerks(p), own = MR.ownedPerks(p), slots = MR.ROLES[p.role].slots;
    body = `<div class="row" style="gap:14px">${UI.avatar(p)}<div style="flex:1;min-width:200px"><b style="font-family:var(--display);font-size:20px">${esc(ri.name)}</b><div class="xpbar"><span style="width:${Math.round(ri.frac*100)}%"></span></div><small class="muted">${p.xp} XP${ri.next ? ` · ${ri.toNext} XP to ${ri.next}` : ' · top rank!'}</small></div><button class="btn" id="invEdit">Edit name, color or role</button></div>
      <div class="statgrid">${MR.RANKS.map((r, i) => `<div class="stat" style="${i <= ri.rank ? 'border-color:#4a5b6b' : 'opacity:.5'}"><div class="k">${r.xp} XP</div><div class="v" style="font-size:15px">${r.name}</div></div>`).join('')}</div>`;
    if (p.role === 'cadet') {
      body += `<h3 class="t">Cadet powers</h3><div class="perks">
        <div class="perk" aria-pressed="true"><span class="pi">↑</span><span><b>${MR.CADET_LEN(ri.rank)} pictures per plan</b><small>Rank up to plan longer trips (up to 8).</small></span></div>
        <div class="perk ${MR.cadetMagnet(ri.rank) ? '' : 'locked'}" aria-pressed="${MR.cadetMagnet(ri.rank)}"><span class="pi">✦</span><span><b>Gem magnet</b><small>Dig grabs gems right next to you. ${MR.cadetMagnet(ri.rank) ? 'Unlocked!' : 'Unlocks at Field Geologist.'}</small></span></div>
        <div class="perk ${ri.rank >= 1 ? '' : 'locked'}" aria-pressed="${ri.rank >= 1}"><span class="pi">≋</span><span><b>Better radio</b><small>Your GO reaches Mars faster. ${ri.rank >= 1 ? 'Unlocked!' : 'Unlocks at Rover Driver.'}</small></span></div>
        <div class="perk ${ri.rank >= 3 ? '' : 'locked'}" aria-pressed="${ri.rank >= 3}"><span class="pi">⌔</span><span><b>High-gain antenna</b><small>Twice as fast again. ${ri.rank >= 3 ? 'Unlocked!' : 'Unlocks at Science Lead.'}</small></span></div></div>`;
    } else {
      body += `<div class="ph"><h3 class="t">Perks</h3><span class="count">${eq.length} of ${slots} slots used · changes apply to your next expedition</span></div>
        <div class="perks" id="perkList">${Object.entries(MR.PERKS).map(([k, pk]) => { const has = own.includes(k), on = eq.includes(k);
          return `<button class="perk ${has ? '' : 'locked'}" data-perk="${k}" aria-pressed="${on}" ${has ? '' : 'disabled'}><span class="pi">${pk.icon}</span><span><b>${esc(pk.name)} <small style="display:inline;color:var(--sci)">${pk.tier}</small></b><small>${esc(pk.desc)}</small><small>${has ? (on ? 'Equipped. Tap to remove.' : 'Tap to equip.') : `Unlocks at ${MR.RANKS[pk.rank].name}.`}</small></span></button>`; }).join('')}</div>
        <p class="muted" style="margin:0;font-size:13px">${p.role === 'specialist' ? 'Specialists get 2 perk slots. Your real power is your code.' : 'Explorers get 3 perk slots.'}</p>`;
    }
    const jobs = Object.entries(MR.JOBS).filter(([k, j]) => j.roles.includes(p.role));
    body += `<h3 class="t">About the rovers</h3><p class="muted" style="margin:0;font-size:13px">Every rover in the game is based on a real one. Tap to see how it works and its science tools.</p>
      <div class="row" id="rovAbout">${jobs.map(([k, j]) => `<button class="btn" data-info="${k}">${esc(j.label)}</button>`).join('')}${p.role === 'cadet' ? '' : '<button class="btn" data-info="curiosity">Curiosity</button><button class="btn" data-info="lrv">Moon buggy</button>'}</div>`;
  } else {
    const s = p.stats;
    const rows = [['Squares driven', s.squares],['Squares flown', s.flown],['Samples drilled', s.samples],['Samples delivered', s.delivered],['Treasures found', s.treasures],['Scans', s.scans],['Signals identified', s.identified],['Sand traps escaped', s.freed],['Bumps', s.bumps],['Rocks and traps cleared', s.cleared],['Shiny finds', s.shinies],['History found', s.artifacts],['Jezero expeditions', s.exp.jezero||0],['Gusev expeditions', s.exp.gusev||0],['Team wins', s.teamWins]];
    body = `<div class="statgrid">${rows.map(([k, v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}</div>`;
  }
  UI.openModal(`<div class="sh"><h2>${esc(p.name)}'s inventory</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div>
    <div class="sb"><div class="tabs" id="invTabs">${tabs.map(([k, l]) => `<button class="tab" data-tab="${k}" aria-selected="${k === invTab}">${l}</button>`).join('')}</div>${body}</div>`);
  $('invTabs').onclick = e => { const b = e.target.closest('.tab'); if (b) UI.inventory(b.dataset.tab); };
  $('sheet').querySelectorAll('[data-card]').forEach(b => b.onclick = () => { invSel = b.dataset.card; UI.inventory(); });
  $('sheet').querySelectorAll('[data-min]').forEach(b => b.onclick = () => UI.mineralTablet(b.dataset.min, () => UI.inventory('chart')));
  if (invTab === 'notebook' || invTab === 'photos') MR.LogUI.wireInventory(p, () => UI.inventory());
  $('sheet').querySelectorAll('[data-el]').forEach(b => b.onclick = () => elementModal(b.dataset.el, p));
  if ($('invEdit')) $('invEdit').onclick = () => UI.profileModal(p);
  if ($('rovAbout')) $('rovAbout').onclick = e => { const b = e.target.closest('[data-info]'); if (b) UI.roverInfo(b.dataset.info, false, () => UI.inventory('rover')); };
  if ($('perkList')) $('perkList').onclick = e => { const b = e.target.closest('.perk'); if (!b || b.disabled) return;
    const k = b.dataset.perk, eq = MR.equippedPerks(p);
    if (eq.includes(k)) p.perks = eq.filter(x => x !== k);
    else if (eq.length < MR.ROLES[p.role].slots) p.perks = [...eq, k];
    else { UI.toast('!', '#f0bf5a', 'All perk slots are full', 'Remove a perk first.'); return; }
    MR.Store.save(); UI.inventory(); };
};
UI.invOpenedAt = 0;
/* Minerals chart: one row per family like the periodic table, then an element strip that lights up
   as minerals containing each element are found. Cadets see colors and names only. */
function chartHtml(p){
  const cs = MR.chartStats(p), cadet = p.role === 'cadet';
  const sq = id => { const m = MR.MINERALS[id], c = MR.CARDS[id], have = MR.mineralFound(p, id);
    return `<button class="msq ${have ? 'got' : ''} ${m.life ? 'life' : ''} ${c.future ? 'future' : ''}" data-min="${id}" style="--mc:${c.color}" aria-label="${esc(have ? c.name : 'Unknown mineral')}">
      ${m.life ? '<span class="lf" title="Sign of a living Mars">❋</span>' : ''}<span class="sy">${have || !cadet ? m.sym : '?'}</span><span class="nm">${have ? esc(cadet && c.kid ? c.kid : c.name.replace(/ \(.*\)$/, '')) : c.future ? 'Future map' : '???'}</span></button>`; };
  const rows = MR.FAMILIES.map(f => { const ids = Object.keys(MR.MINERALS).filter(id => MR.MINERALS[id].family === f.id);
    return `<div class="frow ${cs.families.includes(f.id) ? 'full' : ''}"><div class="fl" style="--fc:${f.col}"><b>${esc(f.name)}</b>${cadet ? '' : `<small>${esc(f.desc)}</small>`}</div><div class="fsq">${ids.map(sq).join('')}</div></div>`; }).join('');
  const els = MR.ELEMENT_ORDER.map(e => { const E = MR.ELEMENTS[e], on = cs.elems.has(e);
    return `<button class="el ${on ? 'on' : ''}" data-el="${e}" style="--ec:${E.col}" aria-label="${E.name}${on ? '' : ' (not found yet)'}"><small>${E.n}</small><b>${e}</b><span>${E.name}</span></button>`; }).join('');
  return `<p class="muted" style="margin:0">${cs.found.length} of ${Object.keys(MR.MINERALS).length} minerals · ${cs.life} of ${MR.LIFE12.length} signs of a living Mars <span class="lf">❋</span> · ${cs.elems.size} of ${MR.ELEMENT_ORDER.length} elements. Tap a square to open its information tablet.</p>
    <div class="chart">${rows}</div>${cadet ? '' : `<h3 class="t">Elements inside your minerals</h3><div class="elements">${els}</div>`}`;
}
function elementModal(e, p){
  const E = MR.ELEMENTS[e], ids = Object.keys(MR.MINERALS).filter(id => MR.MINERALS[id].elems.includes(e));
  UI.openModal(`<div class="sh"><h2>${E.name} (${e})</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
    <p>Element number ${E.n}. ${esc(E.note)}</p><p class="muted" style="margin:0">Minerals that contain ${E.name.toLowerCase()}:</p>
    <div class="fsq">${ids.map(id => { const have = MR.mineralFound(p, id), c = MR.CARDS[id];
      return `<button class="msq ${have ? 'got' : ''}" data-min="${id}" style="--mc:${c.color}"><span class="sy">${MR.MINERALS[id].sym}</span><span class="nm">${have ? esc(c.name.replace(/ \(.*\)$/, '')) : '???'}</span></button>`; }).join('')}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="elBack">Back to the chart</button></div></div>`);
  $('sheet').querySelectorAll('[data-min]').forEach(b => b.onclick = () => UI.mineralTablet(b.dataset.min, () => elementModal(e, p)));
  $('elBack').onclick = () => UI.inventory('chart');
}
/* Information tablet: picture, family, what it is made of, where it was really found, the instrument that
   detects it and why scientists care. The text depends on the player's role. */
UI.mineralTablet = (id, back) => {
  const p = MR.Store.current(), m = MR.MINERALS[id], c = MR.CARDS[id]; if (!m || !c) return;
  const role = p ? p.role : 'explorer', have = MR.mineralFound(p, id), fam = MR.FAMILIES.find(f => f.id === m.family);
  const where = c.future ? `Not on these maps yet. It comes with ${c.future}.` : have ? `You found it${p.cards[id].where ? ` at ${p.cards[id].where}` : ''}${p.cards[id].n > 1 ? ` (${p.cards[id].n} times)` : ''}${p.cards[id].shiny ? ', including a shiny one' : ''}.` : `Not found yet. Look on ${c.maps.map(k => MR.MAPS[k].name).join(' or ')}.`;
  const why = role === 'cadet' ? m.why.kid : role === 'specialist' ? m.why.full : m.why.short;
  const chips = m.elems.map(e => `<span class="echip" style="--ec:${MR.ELEMENTS[e].col}"><b>${e}</b> ${MR.ELEMENTS[e].name}</span>`).join('');
  UI.openModal(`<div class="sh"><h2>${esc(role === 'cadet' && c.kid ? c.kid : c.name)}</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
    <div class="tablet"><div class="tpic ${have ? '' : 'dim'}" style="--mc:${c.color}"><span>${m.sym}</span>${m.life ? '<i title="Sign of a living Mars">❋</i>' : ''}</div>
      <div class="tinfo"><small class="fam" style="color:${fam.col}">${esc(fam.name)}${m.life ? ' · one of the 12 signs of a living Mars' : ''}</small>
        ${role === 'cadet' ? '' : `<div class="trow"><b>Made of</b><span>${role === 'specialist' ? `<code>${esc(m.formula)}</code><br>` : ''}${chips}</span></div>`}
        <div class="trow"><b>Found by</b><span>${esc(m.found)}</span></div>
        ${role === 'cadet' ? '' : `<div class="trow"><b>Detected with</b><span>${esc(m.inst)}</span></div>`}
        <div class="trow"><b>${role === 'cadet' ? 'What is it?' : 'Why scientists care'}</b><span>${esc(why)}</span></div>
        <p class="tstat ${have ? 'ok' : ''}">${esc(where)}</p></div></div>
    ${back ? '<div class="row" style="justify-content:flex-end"><button class="btn" id="tabBack">Back</button></div>' : ''}</div>`);
  if (back) $('tabBack').onclick = back;
};
UI.toggleInventory = () => { if (UI.modalOpen()) UI.closeModal(); else UI.inventory(); };
$('invBtn').addEventListener('click', () => UI.inventory());
$('meBtn').addEventListener('click', () => UI.inventory('rover'));

/* ---------- parents ---------- */
UI.parents = () => {
  UI.openModal(`<div class="sh"><h2>Parents and saves</h2><button class="xbtn" data-close aria-label="Close">×</button></div>
    <div class="sb">
      <label class="toggle" style="color:var(--fg)"><input type="checkbox" id="allMaps" ${MR.Store.team.allMaps ? 'checked' : ''}> Unlock all maps on this device (normally the team unlocks Gusev by finishing Jezero)</label>
      <div class="field"><span>Back up every profile on this device. Copy this code somewhere safe, or paste it on another device to move profiles there.</span>
        <textarea class="input" id="expCode" rows="3" readonly style="font-family:var(--mono);font-size:12px">${esc(MR.Store.exportCode())}</textarea>
        <div class="row"><button class="btn" id="copyCode">Copy code</button><span class="muted" id="copyMsg"></span></div></div>
      <div class="field"><span>Restore from a backup code</span>
        <textarea class="input" id="impCode" rows="3" placeholder="MR2:..." style="font-family:var(--mono);font-size:12px"></textarea>
        <div class="row"><button class="btn" id="impBtn">Restore</button><span class="muted" id="impMsg"></span></div></div>
      ${MR.LogUI ? MR.LogUI.parentHtml() : ''}
      <div class="row" style="justify-content:space-between;align-items:center"><span class="muted">Something not working?</span><button class="btn" id="parRep">Report a problem</button></div>
    </div>`, true);
  $('parRep').onclick = () => MR.Report.open();
  if ($('brkSel')) $('brkSel').onchange = e => { MR.Store.settings.breakMins = +e.target.value; MR.Store.save(); };
  $('allMaps').onchange = e => { MR.Store.team.allMaps = e.target.checked; MR.Store.save(); };
  $('copyCode').onclick = () => { const t = $('expCode'); navigator.clipboard && navigator.clipboard.writeText(t.value).then(() => $('copyMsg').textContent = 'Copied.', () => { t.select(); $('copyMsg').textContent = 'Press Ctrl+C to copy.'; }); if (!navigator.clipboard) { t.select(); $('copyMsg').textContent = 'Press Ctrl+C to copy.'; } };
  $('impBtn').onclick = () => { try { const n = MR.Store.importCode($('impCode').value); $('impMsg').textContent = `Restored ${n} profile${n === 1 ? '' : 's'}.`; UI.renderHome(); } catch (e) { $('impMsg').textContent = 'That code did not work. Check that it was copied completely.'; } };
};
$('parentsBtn').addEventListener('click', () => UI.parents());
$('tutBtn').addEventListener('click', () => MR.Game.startTutorial());
$('guideBtn').addEventListener('click', () => UI.guide('teach'));
$('guideLink').addEventListener('click', () => UI.guide('teach'));
$('setLink').addEventListener('click', () => UI.settings());
/* Edition: the demo banner and buy button, and the links to the old versions only on the web edition. */
$('demoBar').hidden = !MR.ED.demo;
if (MR.ED.buyUrl) $('buyBtn').href = MR.ED.buyUrl; else $('buyBtn').hidden = true;
if (!MR.ED.oldVersions) document.querySelectorAll('.links .oldv').forEach(a => a.remove());
if (MR.ED.beta) { const bb = document.createElement('button'); bb.className = 'betab'; bb.id = 'betaBtn'; bb.textContent = 'BETA'; bb.title = 'This is a test version. Tap to report a problem.'; $('invBtn').parentNode.prepend(bb); bb.onclick = () => MR.Report.open(); }
if (!MR.ED.qr) { const jp = $('joinBtn').closest('.mode').querySelector('p'); if (jp) jp.textContent = "Type the code from the host's screen."; }
$('tutLink').addEventListener('click', () => { if (MR.Store.current()) MR.Game.startTutorial(); });
$('tutNo').addEventListener('click', () => { const p = MR.Store.current(); if (p) { p.tutHide = true; MR.Store.save(); } UI.renderHome(); });

/* ---------- toasts and treasure chest ---------- */
UI.toast = (icon, color, title, sub, ms = 4200) => {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<span class="ti" style="background:${color}">${esc(icon)}</span><span><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>`;
  $('toasts').appendChild(el); while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  $('toasts').classList.toggle('low', UI.modalOpen());   // keep toasts off the window the player is reading
  setTimeout(() => el.remove(), ms);
};
const chestQueue = []; let chestBusy = false;
UI.chest = (id, shiny) => { chestQueue.push({id, shiny}); if (!chestBusy) nextChest(); };
function nextChest(){
  const it = chestQueue.shift(); if (!it) { chestBusy = false; return; }
  chestBusy = true; const c = MR.CARDS[it.id], p = MR.Store.current();
  $('chest').innerHTML = `<div class="chestbox"><div class="name" style="color:${c.color}">${esc((p && p.role === 'cadet' && c.kid) ? c.kid : c.name)}${it.shiny ? ' ✦' : ''}</div><div class="gem" style="background:${c.color}"></div><div class="lid"></div><div class="base"></div></div>`;
  $('chest').hidden = false; MR.sfx.chest();
  setTimeout(() => { $('chest').hidden = true; nextChest(); }, 2300);
}
UI.notify = (notices, cadet) => {
  notices.forEach(n => {
    const p0relay = () => (MR.Store.current() || {}).role === 'specialist' ? 'New in Python: rover.go_to_signal(), rover.go_home() and for sol in rover.mission(2):' : 'New smart blocks: If…, Until full or low battery, Go to signal, Go home, and plans that run for 2 sols.';
    if (n.k === 'card' || n.k === 'shiny') {
      const c = MR.CARDS[n.id];
      if (cadet) UI.chest(n.id, n.k === 'shiny');
      else UI.toast('◆', c.color, n.k === 'shiny' ? `Shiny card: ${c.name}!` : `New card: ${c.name}`, `${MR.RARITY[c.rar].name}. ${MR.MINERALS && MR.MINERALS[n.id] ? 'Added to your minerals chart. Press I to read its tablet.' : 'Press I to see your collection.'}`);
    } else if (n.k === 'sticker') { const x = MR.STICKERS.find(q => q.id === n.id); if (n.isNew || x.tier !== 'C') UI.toast(x.e, MR.STICKER_TIER[x.tier].col, n.isNew ? `New sticker: ${x.name}!` : `${MR.STICKER_TIER[x.tier].name}: ${x.name}`, 'Press I and open Stickers.'); }
    else if (n.k === 'credit') UI.toast('⚑', '#58cfbe', 'Discovery credit!', `A teammate drilled ${n.site || 'a site'} you found. +15 XP`);
    else if (n.k === 'patch') { const pt = MR.PATCHES.find(x => x.id === n.id); UI.toast(pt.icon, '#f0bf5a', `Patch earned: ${pt.name}`, pt.desc); }
    else if (n.k === 'rank') UI.toast('★', '#58cfbe', `Rank up: ${MR.RANKS[n.rank].name}!`, cadet ? `Next expedition you can plan ${MR.CADET_LEN(n.rank)} pictures.` : 'Check your inventory (I) for new perks.', 6000);
    else if (n.k === 'relay') UI.toast('⌁', '#58cfbe', 'Satellite relay kit unlocked!', p0relay(), 8000);
    else if (n.k === 'perk') { const pk = MR.PERKS[n.id]; UI.toast(pk.icon, '#f0bf5a', `New perk: ${pk.name}`, pk.desc, 6000); }
  });
  UI.renderMe();
};

/* ---------- global keys (like Minecraft/Minetest) ---------- */
document.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input,textarea,select');
  if (e.key === 'Escape') { if (UI.modalOpen()) { UI.closeModal(); e.preventDefault(); } else if (typing) e.target.blur(); return; }
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'i' || e.key === 'I' || e.key === 'e' || e.key === 'E') && MR.Store.current()) { e.preventDefault(); UI.toggleInventory(); }
  if ((e.key === 'l' || e.key === 'L') && MR.Store.current() && MR.LogUI && !$('scrHome').hidden) { e.preventDefault(); if (UI.modalOpen()) UI.closeModal(); else MR.LogUI.calendar(); }
});
})();
