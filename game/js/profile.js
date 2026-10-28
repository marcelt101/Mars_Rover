/* Profiles, collections, XP, patches and saves. Everything is stored in this browser. */
(function () {
const MR = window.MR;
const SLOT = (new URLSearchParams(location.search).get('slot') || '').replace(/[^a-z0-9]/gi, '');
const KEY = 'mr2.profiles' + SLOT, TEAM = 'mr2.team' + SLOT, SET = 'mr2.settings' + SLOT, EXP = 'mr2.expedition' + SLOT;
const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

const blankStats = () => ({squares:0, flown:0, samples:0, delivered:0, scans:0, identified:0, stuck:0, freed:0, bumps:0, treasures:0,
  cleared:0, loops:0, clean:0, shinies:0, artifacts:0, organics:0, exp:{}, crew3:0, teamWins:0, xpFrac:0, stickerKinds:0, cardKinds:0, tutorial:0, programs:0, nested:0, stars3:0, sitesFound:0, sitesShared:0, stormSols:0, cleaned:0, cataloged:0, builds:0, missions:0, sensors:0});

MR.Store = {
  db: load(KEY, {list:[], current:null}),
  team: load(TEAM, {unlocked:['jezero'], allMaps:false}),
  settings: load(SET, {fast:false, sound:true}),
  save(){ save(KEY, this.db); save(TEAM, this.team); save(SET, this.settings); },
  /* The running expedition, saved by the device that runs it (solo, or the host) after every sol. */
  expedition(){ return load(EXP, null); },
  saveExpedition(x){ save(EXP, x); },
  clearExpedition(){ try { localStorage.removeItem(EXP); } catch (e) {} },
  profiles(){ return this.db.list; },
  current(){ return this.db.list.find(p => p.id === this.db.current) || null; },
  select(id){ this.db.current = id; this.save(); },
  create({name, color, role}){
    const p = {id:'p' + Date.now().toString(36) + Math.random().toString(36).slice(2,6), name:String(name).trim().slice(0,16) || 'Rover',
      color, role, job:MR.defaultJob(role), xp:0, cards:{}, stickers:{}, patches:{}, perks:[], stats:blankStats(), created:Date.now()};
    this.db.list.push(p); this.db.current = p.id; this.save(); return p;
  },
  remove(id){ this.db.list = this.db.list.filter(p => p.id !== id); if (this.db.current === id) this.db.current = null; this.save(); },
  unlocked(){ return this.team.allMaps ? MR.MAP_ORDER.slice() : MR.MAP_ORDER.filter(m => this.team.unlocked.includes(m)); },
  unlock(maps){ let changed = false; (maps||[]).forEach(m => { if (MR.MAPS[m] && !this.team.unlocked.includes(m)) { this.team.unlocked.push(m); changed = true; } }); if (changed) this.save(); return changed; },
  exportCode(){ const json = JSON.stringify({v:2, profiles:this.db.list, team:this.team}); return 'MR2:' + btoa(unescape(encodeURIComponent(json))); },
  importCode(code){
    const raw = String(code).trim().replace(/^MR2:/, '');
    const data = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (!data || !Array.isArray(data.profiles)) throw new Error('bad');
    data.profiles.forEach(p => { p.stats = {...blankStats(), ...(p.stats||{})}; const i = this.db.list.findIndex(q => q.id === p.id); if (i >= 0) this.db.list[i] = p; else this.db.list.push(p); });
    if (data.team) this.unlock(data.team.unlocked);
    this.save(); return data.profiles.length;
  },
};
MR.Store.db.list.forEach(p => { p.stats = {...blankStats(), ...(p.stats||{})}; p.cards = p.cards || {}; p.stickers = p.stickers || {}; p.patches = p.patches || {}; p.perks = p.perks || []; });

MR.rankInfo = p => { const r = MR.rankOf(p.xp), cur = MR.RANKS[r], next = MR.RANKS[r+1];
  return {rank:r, name:cur.name, next: next ? next.name : null, frac: next ? (p.xp - cur.xp)/(next.xp - cur.xp) : 1, toNext: next ? next.xp - p.xp : 0}; };
MR.ownedPerks = p => p.role === 'cadet' ? [] : Object.keys(MR.PERKS).filter(k => MR.rankOf(p.xp) >= MR.PERKS[k].rank);
MR.equippedPerks = p => { const own = MR.ownedPerks(p), slots = MR.ROLES[p.role].slots; return (p.perks||[]).filter(k => own.includes(k)).slice(0, slots); };
MR.playerSummary = p => ({pid:p.id, name:p.name, color:p.color, role:p.role, job:p.job, rank:MR.rankOf(p.xp), perks:MR.equippedPerks(p)});

/* Turn the events of one sol into rewards for this player. Returns a list of notices. */
MR.applyRewards = (p, myPid, events, ctx) => {
  const s = p.stats, out = [], rank0 = MR.rankOf(p.xp), xp0 = p.xp;
  const addXp = n => { p.xp += n; };
  const addCard = (id, shiny) => {
    const c = p.cards[id] || (p.cards[id] = {n:0, shiny:0});
    const isNew = c.n === 0 && !shiny, newShiny = shiny && !c.shiny;
    if (shiny) c.shiny++; else c.n++;
    if (isNew) out.push({k:'card', id}); if (newShiny) out.push({k:'shiny', id});
  };
  p.stickers = p.stickers || {};
  const sticker = boost => {
    const roll = Math.random(), tier = roll < .04 + (boost||0) ? 'G' : roll < .26 + (boost||0) ? 'S' : 'C';
    const pool = MR.STICKERS.filter(x => x.tier === tier), fresh = pool.filter(x => !p.stickers[x.id]), useFresh = fresh.length && Math.random() < .45;
    const pick = (useFresh ? fresh : pool)[Math.floor(Math.random() * (useFresh ? fresh : pool).length)] || pool[0];
    const isNew = !p.stickers[pick.id]; p.stickers[pick.id] = (p.stickers[pick.id] || 0) + 1;
    out.push({k:'sticker', id:pick.id, isNew});
  };
  events.forEach(e => {
    const me = e.pid === myPid;
    switch (e.t) {
      case 'move': if (me) { if (e.fly) s.flown++; else s.squares++; s.xpFrac += .5; s.sitesFound += (e.sigs || []).length; } break;
      case 'bump': if (me) s.bumps++; break;
      case 'night': (e.charges || []).forEach(c => { if (c.pid === myPid && c.cleaned) s.cleaned++; }); break;
      case 'stuck': if (me) s.stuck++; break;
      case 'free': if (me) { s.freed++; addXp(10); } break;
      case 'scan': if (me) { s.scans++; addXp(2); s.sitesFound += (e.sigs || []).length; } break;
      case 'analyze': if (me) { const n = e.cells.filter(c => c.res !== 'basalt').length; s.identified += n; addXp(4*n); } break;
      case 'drill':
        addCard(e.res, false);
        if (me) {
          addXp(MR.RARITY[MR.CARDS[e.res].rar].xp + (e.treasure ? 15 : 0));
          if (e.treasure) { s.treasures++; sticker(); } else s.samples++;
          if (e.res === 'organics') s.organics++;
          if (e.res === 'anorthosite') s.genesis = (s.genesis || 0) + 1;
          if (e.shiny) { addCard(e.res, true); s.shinies++; }
          if (e.site && p.cards[e.res]) p.cards[e.res].where = `${e.site}, ${MR.MAPS[ctx.map] ? MR.MAPS[ctx.map].name : ''}`;
        } else if (e.res === 'organics') s.organics++;
        if (!me && e.by === myPid) { s.sitesShared++; addXp(15); out.push({k:'credit', res:e.res, site:e.site}); }
        break;
      case 'artifact': addCard(e.res, false); s.artifacts++; addXp(me ? 80 : 30); sticker(.1); break;
      case 'dock': if (me && e.n) { s.delivered += e.n; addXp(10*e.n); sticker(); } break;
      case 'dig': if (me && e.what !== 'none') { s.cleared++; addXp(5); } break;
      case 'catalog': if (me) { s.cataloged += e.entries.length; addXp(8 * e.entries.length); }
        else e.entries.forEach(x => { if (x.by === myPid || x.driller === myPid) addXp(3); }); break;
      case 'build': addXp(20); if (me) s.builds++; break;
      case 'win':
        s.exp[ctx.map] = (s.exp[ctx.map]||0) + 1; addXp(120);
        if (ctx.players > 1) s.teamWins++;
        if (ctx.players >= 3) s.crew3++;
        out.push({k:'win'}); sticker(.15);
        break;
    }
  });
  if (ctx.storm && events.some(e => e.pid === myPid && (e.t === 'move' || e.t === 'scan' || e.t === 'drill'))) s.stormSols++;
  if (ctx.planInfo) { if (ctx.planInfo.loops) s.loops++; if (ctx.planInfo.clean) s.clean++; if (ctx.planInfo.python) s.programs++; if (ctx.planInfo.nested) s.nested++; if (ctx.planInfo.sols >= 2) s.missions++; if (ctx.planInfo.sensors) s.sensors++; }
  if (ctx.code) { addXp(5 * ctx.code.stars); if (ctx.code.stars === 3) s.stars3++; if (ctx.code.stars) out.push({k:'stars', n:ctx.code.stars}); }
  if (s.xpFrac >= 1) { addXp(Math.floor(s.xpFrac)); s.xpFrac -= Math.floor(s.xpFrac); }
  if (ctx.greenhouse && p.xp > xp0) p.xp += Math.round((p.xp - xp0) * .1);
  s.stickerKinds = Object.keys(p.stickers).length;
  s.cardKinds = MR.CARD_ORDER.filter(id => p.cards[id] && (p.cards[id].n || p.cards[id].shiny)).length;
  MR.PATCHES.forEach(pt => { if (!p.patches[pt.id] && pt.test(s)) { p.patches[pt.id] = Date.now(); addXp(25); out.push({k:'patch', id:pt.id}); } });
  const rank1 = MR.rankOf(p.xp);
  if (rank1 > rank0) {
    out.push({k:'rank', rank:rank1});
    if (p.role !== 'cadet' && rank0 < 1 && rank1 >= 1) out.push({k:'relay'});
    Object.entries(MR.PERKS).forEach(([k, pk]) => { if (p.role !== 'cadet' && pk.rank > rank0 && pk.rank <= rank1) {
      out.push({k:'perk', id:k});
      if ((p.perks||[]).length < MR.ROLES[p.role].slots) p.perks = [...(p.perks||[]), k];
    } });
  }
  MR.Store.save();
  return out;
};
})();
