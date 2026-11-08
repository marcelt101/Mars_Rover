/* Garage art: side views of every rover in a technical-illustration style (metal shading, real proportions),
   standing in a hangar. Parts appear on the rover when fitted, with a short drop-in and a glint.
   Explorer rovers are drawn after Spirit and Opportunity (solar panels, like the game's rovers), the Buggy after
   Sojourner, the Helicopter after Ingenuity, the Moon rover after Apollo's Lunar Roving Vehicle, Utopia's after Zhurong.
   MR.GarageArt.draw(canvas, rover, {fit, t}) returns where each fitted part sits, for the labels. */
(function () {
const MR = window.MR;
const A = MR.GarageArt = {};
const W = 640, H = 400, GY = 334;   // canvas size and the floor line

/* ---------- helpers ---------- */
const lin = (c, x0, y0, x1, y1, stops) => { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; };
const ALU = [[0, '#e9ecee'], [.45, '#b8bfc5'], [.55, '#9aa2a9'], [1, '#d4d9dd']];
const DARK = [[0, '#5a6168'], [.5, '#2f353b'], [1, '#474e55']];
const GOLD = [[0, '#f7e2a3'], [.45, '#d1a74c'], [.6, '#a87f2e'], [1, '#e8c879']];
function rect(c, x, y, w, h, fill, edge){ c.fillStyle = fill; c.fillRect(x, y, w, h); if (edge) { c.strokeStyle = edge; c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1); } }
function boxV(c, x, y, w, h, stops, edge){ rect(c, x, y, w, h, lin(c, x, y, x, y + h, stops), edge); }
function line(c, pts, col, wid, cap){ c.strokeStyle = col; c.lineWidth = wid; c.lineCap = cap || 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
function tube(c, pts, wid){ line(c, pts, '#2a2f34', wid + 2); line(c, pts, '#8e969d', wid); line(c, pts.map(([x, y]) => [x, y - wid*.2]), 'rgba(255,255,255,.35)', Math.max(1, wid*.3)); }
function circle(c, x, y, r, fill){ c.fillStyle = fill; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); }
/* A rover wheel seen from the side. Upgraded wheels are bigger, with a thicker rim and curved treads. */
function wheel(c, x, y, r, big, t){
  const R = big ? r * 1.14 : r;
  circle(c, x + 3, y + 3, R, 'rgba(0,0,0,.35)');
  circle(c, x, y, R, lin(c, x - R, y - R, x + R, y + R, DARK));
  circle(c, x, y, R * (big ? .8 : .86), lin(c, x - R, y - R, x + R, y + R, ALU));
  c.strokeStyle = 'rgba(40,45,50,.55)'; c.lineWidth = 1.5;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + (t || 0); c.beginPath(); c.moveTo(x + Math.cos(a) * R*.18, y + Math.sin(a) * R*.18);
    c.quadraticCurveTo(x + Math.cos(a + .5) * R*.55, y + Math.sin(a + .5) * R*.55, x + Math.cos(a + .2) * R*.8, y + Math.sin(a + .2) * R*.8); c.stroke(); }
  c.fillStyle = '#23282d';
  const n = big ? 22 : 16;
  for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; c.save(); c.translate(x + Math.cos(a) * R*.93, y + Math.sin(a) * R*.93); c.rotate(a + (big ? .35 : 0));
    c.fillRect(-1.5, -R*.07, 3, R*.14); c.restore(); }
  circle(c, x, y, R*.16, lin(c, x - 6, y - 6, x + 6, y + 6, ALU)); circle(c, x, y, R*.06, '#3a4046');
  return R;
}
function dish(c, x, y, r, tilt, gold){
  c.save(); c.translate(x, y); c.rotate(tilt);
  c.fillStyle = lin(c, -r, 0, r, 0, gold ? GOLD : ALU); c.beginPath(); c.ellipse(0, 0, r, r * .32, 0, 0, Math.PI*2); c.fill();
  c.fillStyle = gold ? 'rgba(120,85,25,.55)' : 'rgba(80,88,96,.45)'; c.beginPath(); c.ellipse(0, r*.06, r * .78, r * .2, 0, 0, Math.PI*2); c.fill();
  c.strokeStyle = gold ? '#8a6a24' : '#6c747b'; c.lineWidth = 1.2; c.beginPath(); c.ellipse(0, 0, r, r * .32, 0, 0, Math.PI*2); c.stroke();
  line(c, [[0, 0], [0, -r * .55]], '#5f676e', 1.6); circle(c, 0, -r * .58, 2.6, '#c9ced4');
  c.restore();
}
function solarDeck(c, x, y, w, h, dust){
  rect(c, x, y, w, h, lin(c, x, y, x, y + h, [[0, '#2b4a72'], [1, '#13253d']]));
  c.strokeStyle = 'rgba(150,190,235,.35)'; c.lineWidth = 1; for (let i = x + 14; i < x + w; i += 14) { c.beginPath(); c.moveTo(i, y); c.lineTo(i, y + h); c.stroke(); }
  rect(c, x, y, w, 2, 'rgba(220,235,255,.45)');
  if (dust) rect(c, x, y, w, h, `rgba(190,120,70,${dust})`);
}
function label(c, x, y, text, size, col){ c.font = `600 ${size}px "IBM Plex Mono", monospace`; c.fillStyle = col; c.textAlign = 'center'; c.fillText(text, x, y); }

/* ---------- the hangar ---------- */
function hangar(c){
  rect(c, 0, 0, W, H, lin(c, 0, 0, 0, GY, [[0, '#0a0d11'], [1, '#1b222b']]));
  c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = 1; for (let x = 0; x < W; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, GY); c.stroke(); }
  for (let y = 40; y < GY; y += 70) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  [[180, .16], [460, .16]].forEach(([x, a]) => { const g = c.createRadialGradient(x, 0, 10, x, 120, 300); g.addColorStop(0, `rgba(255,236,200,${a})`); g.addColorStop(1, 'rgba(255,236,200,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(x - 30, 0); c.lineTo(x + 30, 0); c.lineTo(x + 200, GY); c.lineTo(x - 200, GY); c.closePath(); c.fill(); });
  rect(c, 0, GY, W, H - GY, lin(c, 0, GY, 0, H, [[0, '#2a323c'], [1, '#12171d']]));
  c.strokeStyle = 'rgba(255,255,255,.06)'; for (let k = -8; k <= 8; k++) { c.beginPath(); c.moveTo(W/2 + k * 30, GY); c.lineTo(W/2 + k * 110, H); c.stroke(); }
  rect(c, 0, GY, W, 2, 'rgba(240,191,90,.35)');
  const sh = c.createRadialGradient(W/2, GY + 6, 10, W/2, GY + 6, 260); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.beginPath(); c.ellipse(W/2, GY + 6, 260, 26, 0, 0, Math.PI*2); c.fill();
}

/* ---------- the rovers (facing right) ---------- */
function mer(c, r, part, t){
  const big = part.has('wide_wheels'), wr = 30, wy = GY - (big ? 34 : 30), xs = [196, 318, 440];
  // rocker-bogie suspension
  tube(c, [[xs[0], wy], [262, wy - 52], [xs[2], wy]], 6); tube(c, [[xs[1], wy], [380, wy - 26], [xs[2], wy]], 5);
  circle(c, 262, wy - 52, 7, lin(c, 255, wy - 59, 269, wy - 45, ALU));
  part.draw('wide_wheels', () => {}, xs[2] + 26, wy + 10);
  xs.forEach(x => wheel(c, x, wy, wr, big, 0));
  // warm electronics box and the deck of solar panels
  boxV(c, 214, wy - 100, 220, 44, [[0, '#f1ece0'], [.5, '#d8d1bf'], [1, '#a9a28f']], '#7b7564');
  rect(c, 214, wy - 70, 220, 4, 'rgba(201,160,58,.75)');
  solarDeck(c, 128, wy - 112, 384, 12, (r.dust || 0) > 10 ? Math.min(.45, r.dust / 160) : 0);
  // stock low-gain antenna, high-gain dish on its gimbal
  part.draw('better_radio', () => { tube(c, [[164, wy - 112], [160, wy - 196]], 3); for (let k = 0; k < 6; k++) line(c, [[155, wy - 150 - k * 7], [166, wy - 147 - k * 7]], '#9aa3ab', 1.5); circle(c, 160, wy - 199, 4, '#ff6b5a'); }, 160, wy - 196);
  if (!part.has('better_radio')) { tube(c, [[164, wy - 112], [163, wy - 146]], 3); circle(c, 163, wy - 148, 3, '#c9ced4'); }
  tube(c, [[300, wy - 112], [300, wy - 132]], 5);
  if (part.has('hg_antenna')) part.draw('hg_antenna', () => dish(c, 300, wy - 150, 44, -.35, true), 300, wy - 150);
  else dish(c, 300, wy - 140, 26, -.35, false);
  // battery pack and dust wiper
  part.draw('big_battery', () => { boxV(c, 232, wy - 56, 58, 22, DARK, '#1b1f23'); rect(c, 238, wy - 49, 34, 8, '#86d48f'); rect(c, 276, wy - 50, 8, 10, '#c48a3a'); label(c, 261, wy - 37, 'Li-ion', 8, '#d9dde1'); }, 261, wy - 45);
  part.draw('dust_wiper', () => { line(c, [[140, wy - 117], [262, wy - 126]], '#d9dde1', 4); line(c, [[146, wy - 114], [256, wy - 122]], '#23282d', 2); circle(c, 140, wy - 117, 5, lin(c, 135, wy - 122, 145, wy - 112, ALU)); }, 200, wy - 122);
  // mast with the camera head (Scout stands taller); SuperCam and extra cameras
  const mh = r.job === 'scout' ? 190 : 165, mx = 412, top = wy - 112 - mh;
  tube(c, [[mx, wy - 112], [mx, top + 18]], 7);
  boxV(c, mx - 26, top, 52, 22, [[0, '#f4f2ea'], [1, '#b9b6aa']], '#77736a');
  circle(c, mx + 12, top + 11, 6, '#1b222b'); circle(c, mx - 4, top + 11, 6, '#1b222b'); circle(c, mx + 13, top + 9.5, 2, '#7fc4ff'); circle(c, mx - 3, top + 9.5, 2, '#7fc4ff');
  part.draw('supercam', () => { boxV(c, mx + 22, top - 4, 30, 26, [[0, '#e9e6dc'], [1, '#a9a597']], '#6d695f'); circle(c, mx + 46, top + 9, 9, '#16191d'); circle(c, mx + 46, top + 9, 5.5, '#b4231a');
    const pulse = .25 + .2 * Math.sin(t / 220); c.fillStyle = `rgba(255,70,50,${pulse})`; c.beginPath(); c.moveTo(mx + 52, top + 7); c.lineTo(W, top + 40); c.lineTo(W, top + 52); c.lineTo(mx + 52, top + 11); c.fill(); }, mx + 46, top + 9);
  part.draw('sharp_eyes', () => { [[434, wy - 82], [450, wy - 82]].forEach(([x, y]) => { circle(c, x, y, 5.5, '#1b222b'); circle(c, x + 1, y - 1, 2, '#7fc4ff'); });
    boxV(c, mx - 40, top + 4, 14, 12, DARK); circle(c, mx - 33, top + 10, 3.5, '#7fc4ff'); }, 442, wy - 82);
  // the arm in front: folded, or reaching out for Science; Hauler's tube rack, Excavator's blade
  if (r.job === 'science') { tube(c, [[436, wy - 70], [500, wy - 96], [560, wy - 40]], 6); boxV(c, 548, wy - 44, 26, 30, DARK, '#1b1f23'); line(c, [[561, wy - 14], [561, wy - 2]], '#c9ced4', 3); }
  else { tube(c, [[436, wy - 66], [470, wy - 50], [446, wy - 40]], 6); boxV(c, 438, wy - 46, 20, 16, DARK, '#1b1f23'); }
  if (r.job === 'hauler') for (let k = 0; k < 8; k++) { const id = (r.tubes || [])[k]; boxV(c, 230 + k * 12, wy - 132, 8, 20, [[0, '#f2f4f5'], [1, id && MR.CARDS[id] ? MR.CARDS[id].color : '#9aa1a8']], '#5f676e'); }
  if (r.job === 'excavator') { tube(c, [[434, wy - 60], [500, wy - 20]], 6); c.fillStyle = lin(c, 490, wy - 34, 520, wy + 6, ALU); c.beginPath(); c.moveTo(492, wy - 36); c.lineTo(522, wy - 26); c.lineTo(516, wy + 8); c.lineTo(492, wy + 4); c.closePath(); c.fill(); }
  label(c, 324, wy - 82, '', 9, '#000');
}
function sojourner(c, r, part, t){
  c.save(); c.translate(W/2, GY); c.scale(1.9, 1.9); c.translate(-W/2, -GY);
  const wy = GY - 13, xs = [262, 318, 374];
  tube(c, [[xs[0], wy], [300, wy - 24], [xs[2], wy]], 3); tube(c, [[xs[1], wy], [340, wy - 12]], 3);
  xs.forEach(x => wheel(c, x, wy, 13, false, 0));
  for (const x of xs) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; rect(c, x + Math.cos(a) * 13 - 1.5, wy + Math.sin(a) * 13 - 1.5, 3, 3, '#7e868d'); }
  boxV(c, 266, wy - 54, 100, 26, [[0, '#e9e3d2'], [1, '#a59e8a']], '#6f6a5c');
  solarDeck(c, 252, wy - 62, 128, 8, 0);
  // front stereo cameras and the stock whip antenna
  circle(c, 368, wy - 40, 3.5, '#1b222b'); circle(c, 368, wy - 32, 3.5, '#1b222b');
  if (!part.has('better_radio') && !part.has('hg_antenna')) { line(c, [[272, wy - 62], [266, wy - 104]], '#8e969d', 1.5); circle(c, 266, wy - 105, 1.8, '#c9ced4'); }
  part.draw('better_radio', () => { tube(c, [[272, wy - 62], [266, wy - 118]], 2); circle(c, 266, wy - 120, 2.6, '#ff6b5a'); }, 266, wy - 118);
  part.draw('hg_antenna', () => { tube(c, [[300, wy - 62], [300, wy - 78]], 2.5); dish(c, 300, wy - 86, 20, -.35, true); }, 300, wy - 86);
  part.draw('sharp_eyes', () => { tube(c, [[352, wy - 62], [352, wy - 82]], 2); boxV(c, 344, wy - 92, 18, 10, DARK); circle(c, 358, wy - 87, 2.5, '#7fc4ff'); circle(c, 351, wy - 87, 2.5, '#7fc4ff'); }, 354, wy - 87);
  part.draw('scoop', () => { tube(c, [[366, wy - 30], [392, wy - 22], [404, wy - 6]], 2.5); c.fillStyle = lin(c, 396, wy - 8, 414, wy + 4, GOLD); c.beginPath(); c.arc(405, wy - 3, 7, 0, Math.PI); c.fill(); }, 404, wy - 4);
  const mem = ['memory_3','memory_2','memory_1'].find(k => part.has(k));
  if (mem) part.draw(mem, () => { boxV(c, 286, wy - 48, 34, 14, [[0, '#1f6f4a'], [1, '#124430']], '#0b2a1d'); rect(c, 291, wy - 44, 24 * MR.PARTS[mem].lvl / 3, 4, '#9ff0c4');
    for (let k = 0; k < MR.PARTS[mem].lvl; k++) circle(c, 293 + k * 8, wy - 37, 1.6, '#9ff0c4'); }, 303, wy - 41);
  c.restore();
}
function ingenuity(c, r, part, t){
  c.save(); c.translate(W/2, GY); c.scale(1.45, 1.45); c.translate(-W/2, -GY);
  const cx = W/2, by = GY - 70;
  // four legs, the body (a box wrapped in insulating film), the mast and two rotors
  [[-34, -22], [-14, -8], [14, 8], [34, 22]].forEach(([dx, fx]) => line(c, [[cx + dx * .4, by + 18], [cx + dx + fx * .6, GY - 2]], '#8e969d', 2.5));
  boxV(c, cx - 22, by - 6, 44, 30, [[0, '#f0e6c8'], [.5, '#d6c48f'], [1, '#a8955c']], '#7a6a3a');
  tube(c, [[cx, by - 6], [cx, by - 96]], 4);
  const blade = (y, ph) => { c.save(); c.translate(cx, y); const s = Math.cos(t / 90 + ph); c.fillStyle = 'rgba(70,74,80,.85)'; c.beginPath(); c.ellipse(0, 0, 120 * Math.abs(s) + 16, 3, 0, 0, Math.PI*2); c.fill();
    c.fillStyle = 'rgba(200,206,212,.10)'; c.beginPath(); c.ellipse(0, 0, 136, 6, 0, 0, Math.PI*2); c.fill(); c.restore(); };
  blade(by - 52, 0); blade(by - 72, 1.4);
  boxV(c, cx - 30, by - 104, 60, 8, [[0, '#2b4a72'], [1, '#13253d']]);
  circle(c, cx + 18, by + 14, 3.5, '#1b222b');
  part.draw('sharp_eyes', () => { boxV(c, cx + 22, by + 4, 12, 12, DARK); circle(c, cx + 30, by + 10, 3, '#7fc4ff'); }, cx + 28, by + 10);
  if (!part.has('better_radio')) line(c, [[cx - 18, by - 6], [cx - 24, by - 26]], '#8e969d', 1.5);
  part.draw('better_radio', () => { tube(c, [[cx - 18, by - 6], [cx - 30, by - 40]], 2); circle(c, cx - 31, by - 42, 2.5, '#ff6b5a'); }, cx - 30, by - 40);
  part.draw('hg_antenna', () => dish(c, cx - 40, by + 14, 16, -.4, true), cx - 40, by + 14);
  part.draw('scoop', () => { tube(c, [[cx + 10, by + 24], [cx + 24, by + 40]], 2); c.fillStyle = lin(c, cx + 18, by + 38, cx + 32, by + 48, GOLD); c.beginPath(); c.arc(cx + 25, by + 42, 6, 0, Math.PI); c.fill(); }, cx + 25, by + 44);
  const mem = ['memory_3','memory_2','memory_1'].find(k => part.has(k));
  if (mem) part.draw(mem, () => { rect(c, cx - 14, by + 2, 28, 10, '#1f6f4a'); rect(c, cx - 10, by + 5, 20 * MR.PARTS[mem].lvl / 3, 4, '#9ff0c4'); }, cx, by + 7);
  c.restore();
}
function lrv(c, r, part, t){
  const big = part.has('wide_wheels'), wy = GY - 34;
  // chassis, seats, fenders and four wire-mesh wheels
  [176, 466].forEach(x => { const R = wheel(c, x, wy, 32, big, 0); c.strokeStyle = 'rgba(210,214,218,.5)'; c.lineWidth = 1; for (let k = 0; k < 10; k++) { c.beginPath(); c.arc(x, wy, R*.86, k * .63, k * .63 + .4); c.stroke(); } });
  boxV(c, 150, wy - 46, 344, 12, [[0, '#d5d9dd'], [1, '#8e959c']], '#5f676e');
  part.draw('dust_wiper', () => { [176, 466].forEach(x => { c.fillStyle = lin(c, x - 40, wy - 60, x + 40, wy - 40, ALU); c.beginPath(); c.arc(x, wy, 42, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(x + 30, wy - 26); c.arc(x, wy, 32, Math.PI * 1.9, Math.PI * 1.1, true); c.fill(); }); }, 466, wy - 40);
  [[262, '#3c4650'], [330, '#3c4650']].forEach(([x, col]) => { boxV(c, x, wy - 82, 52, 8, DARK); line(c, [[x + 4, wy - 82], [x - 2, wy - 112]], col, 4); });
  tube(c, [[420, wy - 46], [420, wy - 96]], 4); boxV(c, 404, wy - 112, 36, 18, DARK, '#1b1f23');   // control console
  part.draw('big_battery', () => { boxV(c, 438, wy - 70, 40, 24, [[0, '#e9ecee'], [1, '#9aa2a9']], '#5f676e'); boxV(c, 440, wy - 96, 36, 24, [[0, '#e9ecee'], [1, '#9aa2a9']], '#5f676e'); }, 458, wy - 70);
  if (!part.has('better_radio')) line(c, [[450, wy - 46], [452, wy - 130]], '#8e969d', 2);
  part.draw('better_radio', () => { tube(c, [[452, wy - 46], [456, wy - 170]], 3); for (let k = 0; k < 10; k++) line(c, [[450, wy - 120 - k * 5], [462, wy - 118 - k * 5]], '#c9ced4', 1.4); }, 456, wy - 160);
  part.draw('hg_antenna', () => { tube(c, [[222, wy - 46], [222, wy - 150]], 3); c.fillStyle = lin(c, 180, wy - 190, 270, wy - 150, [[0, '#f4f6f7'], [1, '#aeb6bd']]); c.beginPath(); c.moveTo(186, wy - 150); c.quadraticCurveTo(222, wy - 210, 258, wy - 150); c.closePath(); c.fill();
    c.strokeStyle = '#7d858c'; c.lineWidth = 1; for (let k = 0; k <= 6; k++) { c.beginPath(); c.moveTo(222, wy - 156); c.lineTo(186 + k * 12, wy - 150); c.stroke(); } }, 222, wy - 170);
  part.draw('sharp_eyes', () => { tube(c, [[480, wy - 46], [486, wy - 104]], 3); boxV(c, 474, wy - 122, 34, 18, [[0, '#f0f2f3'], [1, '#a7aeb4']], '#5f676e'); circle(c, 506, wy - 113, 6, '#1b222b'); }, 500, wy - 113);
  part.draw('supercam', () => { boxV(c, 488, wy - 40, 20, 14, DARK); circle(c, 507, wy - 33, 4, '#b4231a'); }, 506, wy - 33);
}
function zhurong(c, r, part, t){
  const big = part.has('wide_wheels'), wy = GY - (big ? 34 : 30), xs = [204, 322, 440];
  tube(c, [[xs[0], wy], [270, wy - 46], [xs[2], wy]], 6); tube(c, [[xs[1], wy], [390, wy - 22], [xs[2], wy]], 5);
  xs.forEach(x => wheel(c, x, wy, 30, big, 0));
  boxV(c, 220, wy - 104, 214, 50, [[0, '#f4f4f0'], [.5, '#dcdcd4'], [1, '#a9a99f']], '#6f6f66');
  rect(c, 230, wy - 96, 40, 30, 'rgba(60,70,80,.45)');   // heat-collecting windows
  // the four "butterfly" solar panels, raised like wings
  [[-1, 1], [1, 1]].forEach(([sd]) => { c.save(); c.translate(sd < 0 ? 236 : 418, wy - 104); c.rotate(sd * .55); solarDeck(c, sd < 0 ? -130 : 0, -10, 130, 9, (r.dust || 0) > 10 ? Math.min(.45, r.dust / 160) : 0); c.restore(); });
  const mx = 400, top = wy - 104 - 120; tube(c, [[mx, wy - 104], [mx, top + 16]], 6); boxV(c, mx - 22, top, 44, 18, [[0, '#f4f4f0'], [1, '#a9a99f']], '#6f6f66'); circle(c, mx + 10, top + 9, 4.5, '#1b222b'); circle(c, mx - 4, top + 9, 4.5, '#1b222b');
  if (part.has('hg_antenna')) part.draw('hg_antenna', () => { tube(c, [[310, wy - 104], [310, wy - 126]], 4); dish(c, 310, wy - 140, 40, -.3, true); }, 310, wy - 140);
  else { tube(c, [[310, wy - 104], [310, wy - 118]], 4); dish(c, 310, wy - 126, 24, -.3, false); }
  part.draw('better_radio', () => { tube(c, [[244, wy - 104], [240, wy - 170]], 3); circle(c, 240, wy - 172, 3.5, '#ff6b5a'); }, 240, wy - 170);
  part.draw('big_battery', () => { boxV(c, 300, wy - 54, 58, 20, DARK, '#1b1f23'); rect(c, 306, wy - 48, 34, 7, '#86d48f'); }, 329, wy - 44);
  part.draw('dust_wiper', () => line(c, [[236, wy - 104], [150, wy - 162]], '#d9dde1', 3), 190, wy - 136);
  part.draw('supercam', () => { boxV(c, mx + 18, top - 2, 26, 20, [[0, '#e9e6dc'], [1, '#a9a597']], '#6d695f'); circle(c, mx + 40, top + 8, 7, '#16191d'); circle(c, mx + 40, top + 8, 4, '#b4231a'); }, mx + 40, top + 8);
  part.draw('sharp_eyes', () => { [[436, wy - 84], [436, wy - 70]].forEach(([x, y]) => { circle(c, x, y, 5, '#1b222b'); circle(c, x + 1, y - 1, 1.8, '#7fc4ff'); }); }, 436, wy - 77);
  tube(c, [[434, wy - 60], [466, wy - 46]], 5);
}

/* ---------- drawing with parts, the drop-in and the glint ---------- */
A.kind = (r, opts) => r.job === 'heli' ? 'heli' : r.job === 'buggy' ? 'buggy' : opts && opts.moon ? 'lrv' : r.zh ? 'zhurong' : 'mer';
A.draw = (cv, r, opts = {}) => {
  const c = cv.getContext('2d'), t = opts.t || performance.now(), marks = {};
  c.save(); c.scale(cv.width / W, cv.height / H);
  hangar(c);
  const perks = r.perks || [], fit = opts.fit, k0 = fit ? Math.min(1, (t - fit.t0) / 700) : 1;
  const part = {
    has: k => perks.includes(k),
    draw(k, fn, mx, my){ if (!perks.includes(k)) return; marks[k] = [mx, my];
      if (fit && fit.k === k && k0 < 1) { c.save(); c.globalAlpha = k0; c.translate(0, -60 * (1 - k0) * (1 - k0)); fn(); c.restore(); }
      else fn(); },
  };
  ({mer, buggy:sojourner, heli:ingenuity, lrv, zhurong})[A.kind(r, opts)](c, r, part, t);
  // the glint: a ring and a sweep of light where the new part landed
  if (fit && marks[fit.k]) { const g = Math.min(1, (t - fit.t0) / 1200), [mx, my] = A.toCanvas(A.kind(r, opts), marks[fit.k]);
    if (g < 1) { c.strokeStyle = `rgba(255,236,190,${1 - g})`; c.lineWidth = 3; c.beginPath(); c.arc(mx, my, 10 + g * 50, 0, Math.PI*2); c.stroke();
      c.fillStyle = `rgba(255,255,255,${.6 * (1 - g)})`; c.beginPath(); c.moveTo(mx - 4, my - 30); c.lineTo(mx + 4, my - 30); c.lineTo(mx + 1, my + 30); c.lineTo(mx - 1, my + 30); c.fill();
      c.beginPath(); c.moveTo(mx - 30, my - 4); c.lineTo(mx + 30, my - 1); c.lineTo(mx + 30, my + 1); c.lineTo(mx - 30, my + 4); c.fill(); } }
  c.restore();
  const out = {}; Object.entries(marks).forEach(([k, p]) => { const [x, y] = A.toCanvas(A.kind(r, opts), p); out[k] = [x * cv.width / W, y * cv.height / H]; });
  return out;
};
/* Small rovers are drawn scaled up around the floor's middle; this maps their part spots to the canvas. */
A.toCanvas = (kind, [x, y]) => { const s = kind === 'buggy' ? 1.9 : kind === 'heli' ? 1.45 : 1; return [W/2 + (x - W/2) * s, GY + (y - GY) * s]; };
A.W = W; A.H = H;
})();
