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
  const p = me(); if (p && p.webb && p.webb[k] != null) return p.webb[k];
  // progress from playing the test page before Webb was a level: the first player to open Webb keeps it
  let old = null; try { old = JSON.parse(localStorage.getItem('webb.' + k) || 'null'); } catch (e) {}
  if (p) { if (old != null && !localStorage.getItem('webb.moved.' + k)) { try { localStorage.setItem('webb.moved.' + k, '1'); } catch (e) {} W.save(k, old); return old; } return d; }
  return old == null ? d : old;
};
W.save = (k, v) => {
  const db = readDb(), p = db && Array.isArray(db.list) ? db.list.find(q => q.id === db.current) : null;   // read fresh, so nothing else in the save is lost
  try { if (p) { p.webb = p.webb || {}; p.webb[k] = v; localStorage.setItem(KEY, JSON.stringify(db)); } else localStorage.setItem('webb.' + k, JSON.stringify(v)); } catch (e) {}
};
/* The game's music (js/music.js) reads its settings from here: the same music on/off and volume as the rest of
   Crater Crew, and the dashboard's SOUND switch mutes it too. */
const MR = root.MR = root.MR || {};
if (!MR.Store) MR.Store = { get settings(){ let st = {}; try { st = JSON.parse(localStorage.getItem('mr2.settings' + SLOT) || '{}') || {}; } catch (e) {}
  return {...st, music:st.music !== false && !(root.DOC && !root.DOC.sound)}; } };
})(window);
