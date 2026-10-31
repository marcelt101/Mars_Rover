/* Mission Log screens: the 30-day calendar, the day card, the quiz and journal after a day, the certificate,
   the notebook and photo tabs of the inventory, and the Mission Log part of the parent page. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const L = MR.LogUI = {};
const logOf = p => (p && p.log) || {};
const open = d => MR.edDayOk(d) && (d === 1 || !!logOf(MR.Store.current())[d - 1] || !!logOf(MR.Store.current())[d]);
const starsTxt = n => '★'.repeat(n) + `<i>${'★'.repeat(3 - n)}</i>`;
const modal = (title, body, narrow) => UI.openModal(`<div class="sh"><h2>${esc(title)}</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">${body}</div>`, narrow);
const nextDay = p => { const lg = logOf(p); for (const m of MR.MISSIONS) if (!lg[m.day]) return m.day; return null; };

/* Home screen panel */
L.renderHome = () => {
  const p = MR.Store.current(), el = $('logPanel'); if (!el) return;
  if (!p) { el.hidden = true; return; } el.hidden = false;
  const lg = logOf(p), done = Object.keys(lg).length, stars = Object.values(lg).reduce((s, x) => s + (x.stars || 0), 0), nd = nextDay(p), m = nd && MR.missionOf(nd);
  $('logText').innerHTML = done >= 30 ? `All 30 days done, with ${stars} of 90 stars. You can replay any day.` : `${done} of 30 days done${done ? ` · ${stars} stars` : ''}. ${m ? `Next: <b>Day ${m.day}, ${esc(m.title)}</b> (${esc(MR.MAPS[m.map].name)}).` : ''}`;
  $('logBar').style.width = Math.round(done / 30 * 100) + '%';
};

/* The calendar: four weeks and the finale, one tile per day with its stars. */
L.calendar = () => {
  const p = MR.Store.current(); if (!p) return; const lg = logOf(p);
  const weeks = [1, 2, 3, 4, 5].map(w => { const ms = MR.MISSIONS.filter(m => m.week === w), W = MR.LOG_WEEKS[w];
    return `<div class="lweek"><div class="lwh" style="--wc:${W.col}"><b>${esc(W.name)}</b><small>Coding: ${esc(W.idea)}</small></div><div class="ldays">${ms.map(m => { const r = lg[m.day], ok = open(m.day);
      return `<button class="lday ${r ? 'done' : ''} ${ok ? '' : 'locked'}" data-day="${m.day}" ${ok ? '' : 'disabled'} aria-label="Day ${m.day}: ${esc(m.title)}"><span class="dn">${m.day}</span><b>${esc(m.title)}</b><small>${esc(MR.MAPS[m.map].name)}</small><span class="ds">${r ? starsTxt(r.stars) : ok ? 'Ready' : MR.edDayOk(m.day) ? '🔒' : 'Full game'}</span></button>`; }).join('')}</div></div>`; }).join('');
  const done = Object.keys(lg).length;
  modal('30-day Mission Log', `<p class="muted" style="margin:0">About one hour a day. Each day is a real mission with a story, a coding idea, a short quiz and a journal page. Missing a day is fine: just continue where you left off.</p>
    <div class="lcal">${weeks}</div>
    <div class="row" style="justify-content:space-between"><span class="muted">${done} of 30 days done</span>${done ? '<button class="btn" id="certBtn">Certificate</button>' : ''}</div>`);
  document.querySelectorAll('[data-day]').forEach(b => b.onclick = () => L.dayCard(+b.dataset.day));
  if ($('certBtn')) $('certBtn').onclick = () => L.certificate();
};

/* The day card: story, coding idea, objectives, and how to play it. */
L.dayCard = d => {
  const p = MR.Store.current(), m = MR.missionOf(d), C = MR.dayCampaign(d); if (!p || !m || !C) return;
  const cadet = p.role === 'cadet', r = logOf(p)[d], W = MR.LOG_WEEKS[m.week];
  const objs = C.obj(1).map(o => `<li><b>${esc(cadet && o.kid ? o.kid : o.t)}${o.bonus ? ' <i class="bonus">bonus</i>' : ''}</b>${cadet ? '' : `<span>${esc(o.what || '')}</span>`}</li>`).join('');
  const rules = m.rules || {}, notes = [rules.bat ? `Your battery starts at only ${rules.bat}%.` : '', rules.storm ? `A dust storm arrives on sol ${rules.storm[0]}.` : '', rules.stuck ? 'Your rover starts stuck in soft sand.' : ''].filter(Boolean);
  modal(`Day ${d}: ${m.title}`, `<p class="real" style="color:${W.col}">${esc(W.name)} · ${esc(MR.MAPS[m.map].name)} · based on ${esc(C.real)}</p>
    <p>${esc(C.brief)}</p>${notes.length ? `<p class="dnote">${esc(notes.join(' '))}</p>` : ''}
    ${cadet ? '' : `<p class="dcode"><b>Coding idea:</b> ${esc(m.coding)}</p>`}
    <h3 class="t">Today's objectives</h3><ol class="brieflist">${objs}</ol>
    ${r ? `<p class="tstat ok">Done with ${r.stars} star${r.stars === 1 ? '' : 's'}${r.quiz != null ? `, quiz ${r.quiz} of 3` : ''}. You can play it again.</p>` : ''}
    <div class="row" style="justify-content:flex-end;flex-wrap:wrap"><button class="btn" id="dayBack">All days</button>${MR.netAvailable() ? '<button class="btn" id="dayHost">Host a team game</button>' : ''}<button class="btn primary" id="daySolo">Play solo</button></div>`);
  $('dayBack').onclick = () => L.calendar();
  $('daySolo').onclick = () => { UI.closeModal(); MR.Game.startDay(d, 'solo'); };
  if ($('dayHost')) $('dayHost').onclick = () => { UI.closeModal(); MR.Game.startDay(d, 'host'); };
};

/* After the day's mission: debrief, a short quiz, a journal page, then the stars. */
L.dayDone = st => {
  const p = MR.Store.current(), m = MR.missionOf(st.day), C = MR.dayCampaign(st.day); if (!p || !m || !C) return;
  const cadet = p.role === 'cadet', onTime = st.sol <= m.par;
  if (cadet) { L.record(p, m, onTime, null, ''); modal(`Day ${m.day} done!`, `<div class="face">🚀</div><p style="text-align:center">Great job, ${esc(p.name)}! Day ${m.day} is done.</p><div class="row" style="justify-content:center"><button class="btn primary" id="toLog">Mission Log</button></div>`, true); $('toLog').onclick = () => L.calendar(); return; }
  // shuffle answers in a fixed way per question, so every device shows the same order
  const qs = m.quiz.map((q, i) => { const order = q.a.map((_, k) => k).sort((a, b) => ((a * 7 + i * 3 + m.day) % 5) - ((b * 7 + i * 3 + m.day) % 5)); return {...q, order}; });
  modal(`Day ${m.day} complete: ${m.title}`, `<div class="debrief"><p>${esc(C.debrief)}</p><small>Based on ${esc(C.real)}.</small></div>
    <h3 class="t">Quick quiz</h3><div class="quiz">${qs.map((q, i) => `<fieldset class="qz" data-q="${i}"><legend>${i + 1}. ${esc(q.q)}</legend>${q.order.map(k => `<label><input type="radio" name="q${i}" value="${k}"> ${esc(q.a[k])}</label>`).join('')}<p class="qwhy" hidden></p></fieldset>`).join('')}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn primary" id="quizCheck">Check answers</button></div>
    <div id="journalBox" hidden><h3 class="t">Journal</h3><p class="muted" style="margin:0">${esc(m.journal)}</p><textarea class="input" id="journalTxt" rows="4" maxlength="1000" placeholder="Write here. It goes into your science notebook."></textarea>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" id="journalSave">Save and finish</button></div></div>`);
  let score = null;
  $('quizCheck').onclick = () => { score = 0;
    qs.forEach((q, i) => { const sel = document.querySelector(`input[name=q${i}]:checked`), fs = document.querySelector(`[data-q="${i}"]`), ok = sel && +sel.value === q.ok;
      if (ok) score++; fs.classList.add(ok ? 'right' : 'wrong'); const w = fs.querySelector('.qwhy'); w.hidden = false; w.textContent = (ok ? 'Right! ' : `The answer: ${q.a[q.ok]}. `) + q.why;
      fs.querySelectorAll('input').forEach(x => x.disabled = true); });
    $('quizCheck').hidden = true; $('journalBox').hidden = false; MR.sfx[score >= 2 ? 'good' : 'click']();
    UI.toast('✎', '#58cfbe', `Quiz: ${score} of 3`, score === 3 ? 'Perfect!' : 'Nice work. Read the answers to learn more.'); };
  $('journalSave').onclick = () => { const txt = $('journalTxt').value.trim(); const r = L.record(p, m, onTime, score ?? 0, txt); L.stars(m, r); };
};
L.record = (p, m, onTime, quiz, journal) => {
  p.log = p.log || {};
  const stars = 1 + (onTime ? 1 : 0) + (quiz == null || quiz >= 2 ? 1 : 0), old = p.log[m.day];
  p.log[m.day] = {stars:Math.max(stars, old ? old.stars : 0), quiz:quiz == null ? (old && old.quiz) : Math.max(quiz, (old && old.quiz) || 0), at:Date.now(), first:old ? old.first : Date.now()};
  if (quiz != null) { p.stats.quizRight = (p.stats.quizRight || 0) + quiz; p.stats.quizAsked = (p.stats.quizAsked || 0) + 3; }
  if (!old) p.xp += 50 + (quiz || 0) * 10;
  MR.Notebook.add(p, {kind:'journal', text:`Day ${m.day}, ${m.title}: ${journal || '(no journal entry)'}`, map:m.map, day:m.day});
  const notices = MR.awardPatches(p); MR.Store.save(); UI.notify(notices, p.role === 'cadet'); L.renderHome && L.renderHome();
  return {stars, quiz, first:!old};
};
L.stars = (m, r) => {
  const nd = MR.missionOf(m.day + 1);
  modal(`Day ${m.day} done!`, `<div class="big" style="text-align:center;font-size:44px;color:var(--sci)">${starsTxt(r.stars)}</div>
    <p style="text-align:center;margin:0">1 star for finishing, 1 for finishing by sol ${m.par}, 1 for 2 or more quiz answers right.${r.first ? ' +50 XP' : ''}</p>
    ${nd ? `<p style="text-align:center">Tomorrow: <b>Day ${nd.day}, ${esc(nd.title)}</b> on ${esc(MR.MAPS[nd.map].name)}.</p>` : '<p style="text-align:center"><b>You finished the whole Mission Log!</b></p>'}
    <div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn" id="keepExp">Keep exploring</button><button class="btn primary" id="toLog">Mission Log</button>${m.day === 30 ? '<button class="btn primary" id="certNow">Certificate</button>' : ''}</div>`, true);
  $('toLog').onclick = () => L.calendar();
  $('keepExp').onclick = () => { UI.closeModal(); if (MR.Game.state) MR.Game.keepExploring(); };
  if ($('certNow')) $('certNow').onclick = () => L.certificate();
};

/* Printable certificate (all 30 days), or a progress certificate before that. */
L.certificate = () => {
  const p = MR.Store.current(); if (!p) return; const lg = logOf(p), n = Object.keys(lg).length, stars = Object.values(lg).reduce((s, x) => s + (x.stars || 0), 0);
  const full = n >= 30, weeks = [1, 2, 3, 4].filter(w => MR.MISSIONS.filter(m => m.week === w).every(m => lg[m.day])).map(w => MR.LOG_WEEKS[w].name);
  modal('Certificate', `<div class="certificate" id="cert"><div class="cbd"><small>CRATER CREW · 30-DAY MISSION LOG</small>
      <h1>${full ? 'Mission Specialist' : 'Mission Progress'}</h1><p>This certifies that</p><h2>${esc(p.name)}</h2>
      <p>${full ? 'completed all 30 days of the Mission Log' : `completed ${n} of 30 days of the Mission Log`}, exploring real places on Mars and the Moon, with ${stars} stars.</p>
      ${weeks.length ? `<p class="cw">${weeks.map(esc).join(' · ')}</p>` : ''}
      <p class="cl">Coding learned: sequences${n >= 8 ? ', loops' : ''}${n >= 15 ? ', conditions' : ''}${n >= 22 ? ', programs that run for days' : ''}.</p>
      <p class="cd">${new Date().toLocaleDateString()}</p></div></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="certBack">Back</button><button class="btn primary" id="certPrint">Print</button></div>`);
  $('certPrint').onclick = () => { document.body.classList.add('printcert'); window.print(); setTimeout(() => document.body.classList.remove('printcert'), 500); };
  $('certBack').onclick = () => L.calendar();
};

/* Inventory: the science notebook */
L.notebookHtml = p => {
  const list = MR.Notebook.list(p).slice().reverse(), ic = {find:'◆', campaign:'⚑', photo:'▣', journal:'✎', note:'✐'};
  const latest = MR.Photos.list().slice(-1)[0];
  return `<p class="muted" style="margin:0">Your science notebook. Finds, campaigns, photos and Mission Log journal pages are added automatically. Add your own notes too.</p>
    <div class="nbadd"><textarea class="input" id="nbText" rows="2" maxlength="1000" placeholder="Write a note: what did you see, what do you want to try next?"></textarea>
      <div class="row"><label class="toggle"><input type="checkbox" id="nbPhoto" ${latest ? '' : 'disabled'}> Attach my latest photo</label><button class="btn primary" id="nbAdd">Add note</button></div></div>
    <ul class="nb">${list.length ? list.map(e => { const ph = e.photo && MR.Photos.get(e.photo);
      return `<li class="nb-${e.kind}"><span class="ni">${ic[e.kind] || '•'}</span><span class="nt"><small>${new Date(e.t).toLocaleDateString()}${e.map && MR.MAPS[e.map] ? ' · ' + esc(MR.MAPS[e.map].name) : ''}${e.sol ? ' · sol ' + e.sol : ''}</small>${esc(e.text)}${ph ? `<img src="${ph.data}" alt="${esc(ph.place || 'Photo')}">` : ''}</span>${e.kind === 'note' ? `<button class="mini-b" data-del="${e.id}" aria-label="Delete note">×</button>` : ''}</li>`; }).join('') : '<li class="muted">Nothing yet. Go explore!</li>'}</ul>`;
};
L.photosHtml = () => {
  const list = MR.Photos.list().slice().reverse();
  const cur = MR.Store.current(), kid = (MR.PREVIEW || []).includes('helicam') && cur && cur.role === 'cadet';
  return `<p class="muted" style="margin:0">${kid ? 'Your pictures from the helicopter. Fly over a sparkly gem and tap the camera to take one.' : 'Your Navcam photos (the newest 40 are kept on this device). Add Photo to a plan to take one.'}</p>
    <div class="album">${list.length ? list.map(ph => `<figure data-ph="${ph.id}"><img src="${ph.data}" alt="${esc(ph.place || '')}"><figcaption>${esc(ph.place || '')} · sol ${ph.sol}<br><small>${esc(MR.MAPS[ph.map] ? MR.MAPS[ph.map].name : '')}</small></figcaption><button class="mini-b" data-phdel="${ph.id}" aria-label="Delete photo">×</button></figure>`).join('') : '<p class="muted">No photos yet.</p>'}</div>`;
};
L.wireInventory = (p, refresh) => {
  if ($('nbAdd')) $('nbAdd').onclick = () => { const t = $('nbText').value.trim(); if (!t) return; const ph = $('nbPhoto').checked ? MR.Photos.list().slice(-1)[0] : null;
    MR.Notebook.add(p, {kind:'note', text:t, photo:ph && ph.id, map:ph && ph.map, sol:ph && ph.sol}); refresh(); };
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { MR.Notebook.remove(p, b.dataset.del); refresh(); });
  document.querySelectorAll('[data-phdel]').forEach(b => b.onclick = e => { e.stopPropagation(); MR.Photos.remove(b.dataset.phdel); refresh(); });
  document.querySelectorAll('figure[data-ph] img').forEach(img => img.onclick = () => { const ph = MR.Photos.get(img.closest('figure').dataset.ph); if (!ph) return;
    modal(ph.place || 'Photo', `<img class="bigphoto" src="${ph.data}" alt=""><p class="muted">${esc(MR.MAPS[ph.map] ? MR.MAPS[ph.map].name : '')} · sol ${ph.sol} · ${esc(ph.rover || '')}</p><div class="row" style="justify-content:flex-end"><button class="btn" id="phBack">Back</button></div>`);
    $('phBack').onclick = refresh; });
};

/* Parent page: what each child did and learned, and the break reminder setting. */
L.parentHtml = () => {
  const ps = MR.Store.profiles(), today = new Date().toISOString().slice(0, 10), brk = MR.Store.settings.breakMins ?? 60;
  const rows = ps.map(p => { const lg = logOf(p), days = Object.keys(lg).map(Number).sort((a, b) => a - b), stars = days.reduce((s, d) => s + (lg[d].stars || 0), 0);
    const s = p.stats || {}, q = s.quizAsked ? Math.round(100 * (s.quizRight || 0) / s.quizAsked) + '%' : '–';
    const recent = days.slice(-4).reverse().map(d => { const m = MR.missionOf(d); return m ? `<li>Day ${d}: ${esc(m.title)} <small>${esc(MR.MAPS[m.map].name)} · ${esc(MR.LOG_WEEKS[m.week].idea)}</small></li>` : ''; }).join('');
    return `<div class="prow"><b>${esc(p.name)}</b> <small class="muted">${esc(MR.ROLES[p.role].label)} · ${esc(MR.rankInfo(p).name)}</small>
      <div class="pstats"><span><b>${days.length}</b>/30 days</span><span><b>${stars}</b> stars</span><span>quiz <b>${q}</b></span><span><b>${(p.daily || {})[today] || 0}</b> min today</span><span><b>${s.minutes || 0}</b> min total</span></div>
      ${recent ? `<ul class="plearn">${recent}</ul>` : '<p class="muted" style="margin:4px 0 0">No Mission Log days yet.</p>'}</div>`; }).join('');
  return `<h3 class="t">Mission Log progress</h3>${rows || '<p class="muted">No profiles yet.</p>'}
    <label class="field"><span>Break reminder</span><select class="input" id="brkSel">${[0, 30, 45, 60, 90].map(v => `<option value="${v}" ${v === brk ? 'selected' : ''}>${v ? `After ${v} minutes of play` : 'Off'}</option>`).join('')}</select></label>`;
};
})();
