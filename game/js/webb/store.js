/* Where the Webb mission keeps its progress (album, Webb Academy). Inside Crater Crew it belongs to the player
   who is picked in the main game (each kid has their own album and badges, and it travels with the save codes
   under "Parents and saves"). Opened on its own, it uses this browser. */
(function (root) {
const W = root.WEBB = root.WEBB || {};
const SLOT = (new URLSearchParams(location.search).get('slot') || '').replace(/[^a-z0-9]/gi, '');
const KEY = 'mr2.profiles' + SLOT;
const readDb = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
const me = () => { const db = readDb(); return db && Array.isArray(db.list) ? db.list.find(p => p.id === db.current) || null : null; };
W.player = me();   // {name, color, ...} or null
W.slot = SLOT;
W.load = (k, d) => {
  const p = me(); if (p) return p.webb && p.webb[k] != null ? p.webb[k] : d;
  try { const v = localStorage.getItem('webb.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
};
W.save = (k, v) => {
  const db = readDb(), p = db && Array.isArray(db.list) ? db.list.find(q => q.id === db.current) : null;   // read fresh, so nothing else in the save is lost
  try { if (p) { p.webb = p.webb || {}; p.webb[k] = v; localStorage.setItem(KEY, JSON.stringify(db)); } else localStorage.setItem('webb.' + k, JSON.stringify(v)); } catch (e) {}
};
})(window);
