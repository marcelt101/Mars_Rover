/* Mission Control (press O), a kid-sized version of NASA's Open MCT: every rover's status in one table with
   colored alarms, a chart of battery, dust, wheels or distance per sol, the sol timeline of planned activities,
   the player's own alarm rules, a Mars clock, and replay buttons for the last few sols. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const O = MR.Ops = {};
const G = () => MR.Game;
const METRICS = {bat:{name:'Battery', unit:'%'}, wheels:{name:'Wheels', unit:'%'}, dust:{name:'Dust on panels', unit:'%'}, tubes:{name:'Full tubes', unit:''}};
const DEFAULT_RULES = [{m:'bat', op:'<', v:15, lvl:'bad'}, {m:'bat', op:'<', v:30, lvl:'warn'}, {m:'wheels', op:'<', v:25, lvl:'warn'}, {m:'dust', op:'>', v:50, lvl:'warn'}];
let chartMetric = 'b';
const val = (r, m) => m === 'bat' ? Math.round(r.bat / r.batMax * 100) : m === 'wheels' ? Math.round(r.wheels ?? 100) : m === 'dust' ? Math.round(r.dust || 0) : r.tubes.length;
const test = (x, op, v) => op === '<' ? x < v : op === '>' ? x > v : op === '<=' ? x <= v : op === '>=' ? x >= v : x === v;
/* Which alarm level (if any) each metric of a rover is at, using the default rules plus the player's own. */
O.levels = r => { const p = MR.Store.current(), rules = DEFAULT_RULES.concat((p && p.alarms) || []), out = {};
  rules.forEach(ru => { if (!METRICS[ru.m] || !MR.usesPower(r) && ru.m !== 'tubes') return; if (test(val(r, ru.m), ru.op, +ru.v)) { if (ru.lvl === 'bad' || !out[ru.m]) out[ru.m] = {lvl:ru.lvl, rule:ru}; } });
  if (r.tubes.length >= MR.tubesOf(r) && MR.tubesOf(r) > 0 && !out.tubes) out.tubes = {lvl:'warn', rule:{m:'tubes', op:'full'}};
  return out; };
const clock = g => g.phase === 'run' || g.phase === 'replay' ? {t:'about 13:00', d:'midday: the rovers are driving'} : g.phase === 'won' ? {t:'about 16:00', d:'afternoon: the day\'s work is done'} : {t:'about 09:00', d:'morning: time to plan'};
function statusOf(g, r){
  const lp = g.lobby.players.find(x => x.pid === r.pid);
  if (g.mode !== 'solo' && lp && !lp.connected) return {t:'No signal', cls:'stale'};
  if (r.stuck) return {t:'Stuck in sand', cls:'bad'};
  if (g.phase === 'run') return {t:'Driving', cls:''};
  if (r.prog) return {t:`Program running (${r.prog.sols - r.prog.solsLeft + 1}/${r.prog.sols})`, cls:''};
  if (r.job === 'lab') return {t:'At the lab', cls:''};
  if (g.readyPids.includes(r.pid) || (r.pid === g.myPid && g.ready)) return {t:'Ready', cls:'ok'};
  return {t:'Planning', cls:''};
}
/* The planned activities of each rover for this sol, as colored blocks. */
function timeline(g){
  const cat = t => MR.CMDS[t] ? MR.CMDS[t].cat : MR.BLOCKS[t] ? 'blk' : 'prog';
  return g.state.rovers.map(r => { let items = [];
    if (r.pid === g.myPid) { const pa = g.api.planActions(); if (pa.program) items = ['program']; else (pa.actions || []).forEach(a => { const n = MR.CMDS[a.type] && MR.CMDS[a.type].arg ? Math.min(6, a.arg || 1) : 1; for (let k = 0; k < n; k++) items.push(a.type); }); }
    else items = (g.planSum || {})[r.pid] || [];
    if (r.prog && !items.length) items = ['program'];
    const segs = items.slice(0, 40).map(t => `<i class="ts c-${cat(t)}" title="${esc(t === 'program' ? 'Program' : (MR.CMDS[t] || {}).label || t)}"></i>`).join('');
    return `<div class="tl"><span class="tn"><span class="fd" style="background:${MR.colorHex(r.color)}"></span>${esc(r.name)}</span><span class="tbar">${segs || '<small class="muted">no plan yet</small>'}</span></div>`; }).join('');
}
function chart(st){
  const hist = st.hist || [], rovers = st.rovers.filter(MR.usesPower);
  if (hist.length < 2) return '<p class="muted">The chart appears after two sols.</p>';
  const W2 = 600, H2 = 170, pad = 28, xs = hist.map(h => h.sol), x0 = xs[0], x1 = xs[xs.length - 1];
  const vals = hist.flatMap(h => rovers.map(r => h.r[r.pid] ? h.r[r.pid][chartMetric] : null)).filter(v => v != null);
  const max = chartMetric === 's' ? Math.max(10, ...vals) : 150, top = chartMetric === 's' ? max : Math.max(100, ...vals);
  const X = s => pad + (s - x0) / Math.max(1, x1 - x0) * (W2 - pad - 8), Y = v => H2 - 20 - v / top * (H2 - 34);
  const grid = [0, .5, 1].map(f => `<line x1="${pad}" x2="${W2 - 8}" y1="${Y(top*f)}" y2="${Y(top*f)}" class="gl"/><text x="2" y="${Y(top*f) + 4}" class="gt">${Math.round(top*f)}</text>`).join('');
  const lines = rovers.map(r => { const pts = hist.filter(h => h.r[r.pid]).map(h => `${X(h.sol).toFixed(1)},${Y(h.r[r.pid][chartMetric]).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${MR.colorHex(r.color)}" stroke-width="2.5" stroke-linejoin="round"/>`; }).join('');
  return `<svg class="chart" viewBox="0 0 ${W2} ${H2}" role="img" aria-label="Chart per sol">${grid}${lines}<text x="${pad}" y="${H2 - 4}" class="gt">sol ${x0}</text><text x="${W2 - 8}" y="${H2 - 4}" class="gt" text-anchor="end">sol ${x1}</text></svg>`;
}
O.open = () => {
  const g = G(), st = g.state, p = MR.Store.current(); if (!st || !p) return;
  const cadet = p.role === 'cadet', ck = clock(g);
  const rows = st.rovers.map(r => { const lv = O.levels(r), s = statusOf(g, r), power = MR.usesPower(r);
    const cell = (m, txt) => `<td class="${lv[m] ? lv[m].lvl : ''}">${txt}</td>`;
    const bar = v => `<span class="mbar"><i style="width:${Math.max(3, Math.min(100, v))}%"></i></span>`;
    return `<tr class="${s.cls === 'stale' ? 'stale' : ''}"><td><span class="fd" style="background:${MR.colorHex(r.color)}"></span><b>${esc(r.name)}</b>${r.pid === g.myPid ? ' <small>(you)</small>' : ''}<br><small>${esc(MR.JOBS[r.job] ? MR.JOBS[r.job].label : r.job)}</small></td>
      <td class="${s.cls}">${esc(s.t)}</td>${power ? cell('bat', `${bar(val(r, 'bat'))} ${val(r, 'bat')}%`) + cell('wheels', `${val(r, 'wheels')}%`) + cell('dust', `${val(r, 'dust')}%`) : '<td>–</td><td>–</td><td>–</td>'}
      ${cell('tubes', r.role === 'cadet' ? '–' : `${r.tubes.length}/${MR.tubesOf(r)}`)}<td>${esc(MR.regionAt(st, r.x, r.y))}</td></tr>`; }).join('');
  const alerts = [];
  st.rovers.forEach(r => { const lv = O.levels(r), s = statusOf(g, r);
    if (s.cls === 'stale') alerts.push(['stale', `${r.name}: no signal. The player is not connected, so the rover waits.`]);
    if (r.stuck) alerts.push(['bad', `${r.name} is stuck in sand. Back up 1 square.`]);
    Object.entries(lv).forEach(([m, l]) => alerts.push([l.lvl, `${r.name}: ${METRICS[m].name.toLowerCase()} ${m === 'tubes' ? `${r.tubes.length}/${MR.tubesOf(r)}` : val(r, m) + METRICS[m].unit}${l.rule.op === 'full' ? ' (full)' : ` (rule: ${METRICS[m].name.toLowerCase()} ${l.rule.op} ${l.rule.v})`}`])); });
  const wx = st.wx || {}, rules = (p.alarms || []);
  const metricBtns = [['b','Battery'],['d','Dust'],['w','Wheels'],['s','Distance']].map(([k, l]) => `<button class="tab" data-cm="${k}" aria-selected="${k === chartMetric}">${l}</button>`).join('');
  UI.openModal(`<div class="sh"><h2>Mission Control</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
    <div class="mclock"><span><b>Sol ${st.sol}</b> · ${esc(MR.MAPS[st.map].name)}</span><span>Local Mars time ${ck.t}, ${esc(ck.d)}</span><span class="muted">A sol lasts 24 h 39 min · Earth time ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>${wx.airless ? '' : `<span>Weather: ${wx.storm ? 'dust storm' : wx.dust || 'clear'}, low ${wx.lo}°C</span>`}</div>
    <div class="mtablewrap"><table class="mtable"><thead><tr><th>Rover</th><th>Status</th><th>Battery</th><th>Wheels</th><th>Dust</th><th>Tubes</th><th>Place</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="malerts">${alerts.length ? alerts.map(([k, t]) => `<p class="al ${k}">${k === 'bad' ? '●' : k === 'stale' ? '○' : '▲'} ${esc(t)}</p>`).join('') : '<p class="al ok">✓ All systems normal.</p>'}</div>
    <h3 class="t">Charts</h3><div class="tabs" id="cmTabs">${metricBtns}</div><div id="chartBox">${chart(st)}</div>
    <h3 class="t">Sol timeline</h3><p class="muted" style="margin:0;font-size:13px">What each rover plans to do this sol. Teammates' plans appear when they press Ready.</p><div class="tls">${timeline(g)}</div>
    ${cadet ? '' : `<h3 class="t">My alarm rules</h3><p class="muted" style="margin:0;font-size:13px">Like real mission control: if a value crosses your limit, its box turns yellow or red here.</p>
    <ul class="rules">${rules.map((ru, i) => `<li>If <b>${METRICS[ru.m].name.toLowerCase()}</b> ${esc(ru.op)} <b>${ru.v}</b> then <span class="lv ${ru.lvl}">${ru.lvl === 'bad' ? 'red' : 'yellow'}</span> <button class="mini-b" data-rdel="${i}" aria-label="Delete rule">×</button></li>`).join('') || '<li class="muted">No rules of your own yet.</li>'}</ul>
    <div class="row ruleadd">If <select class="input" id="ruM">${Object.entries(METRICS).map(([k, m]) => `<option value="${k}">${m.name}</option>`).join('')}</select><select class="input" id="ruOp"><option>&lt;</option><option>&gt;</option></select><input class="input" id="ruV" type="number" value="40" min="0" max="150"> then <select class="input" id="ruL"><option value="warn">yellow</option><option value="bad">red</option></select><button class="btn" id="ruAdd">Add rule</button></div>`}
    ${g.replays && g.replays.length ? `<h3 class="t">Replay a sol</h3><div class="row">${g.replays.map((rp, i) => `<button class="btn" data-rp="${i}" ${g.api.canReplay() ? '' : 'disabled'}>Sol ${rp.sol}</button>`).join('')}</div>` : ''}
  </div>`);
  document.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { chartMetric = b.dataset.cm; $('chartBox').innerHTML = chart(st); document.querySelectorAll('[data-cm]').forEach(x => x.setAttribute('aria-selected', x === b)); });
  document.querySelectorAll('[data-rdel]').forEach(b => b.onclick = () => { p.alarms.splice(+b.dataset.rdel, 1); MR.Store.save(); O.open(); });
  if ($('ruAdd')) $('ruAdd').onclick = () => { p.alarms = p.alarms || []; if (p.alarms.length >= 8) return; p.alarms.push({m:$('ruM').value, op:$('ruOp').value, v:Math.max(0, Math.min(150, +$('ruV').value || 0)), lvl:$('ruL').value}); MR.Store.save(); O.open(); };
  document.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => { UI.closeModal(); g.api.replay(+b.dataset.rp); });
};
})();
