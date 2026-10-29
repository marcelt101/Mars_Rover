/* Minerals chart data: families, elements and an information tablet for every mineral. Real science only.
   Each mineral has: family, a short symbol for its square, a simple formula, the elements it contains, where a
   rover (or astronaut) really found it, the instrument that detects it, and "why scientists care" in three levels
   (kid for Cadets, short for Explorers, full for Specialists). life:true marks the 12 "signs of a living Mars".
   Minerals with future:'...' are not on the current maps yet; the chart shows them as coming with a future map. */
(function () {
const MR = window.MR;

/* New cards. Their science text lives in MR.MINERALS below; fact is the one-line card text. */
Object.assign(MR.CARDS, {
  serpentine: {name:'Serpentine', kid:'Snake-skin rock', rar:'R', color:'#6f9a6a', pts:60, maps:['jezero'],
    fact:'A green mineral that forms when water reacts with olivine. The reaction makes hydrogen, which some microbes on Earth live on.'},
  perchlorate: {name:'Perchlorate salt', kid:'Cold salt', rar:'U', color:'#d9e6f2', pts:40, maps:['jezero'],
    fact:'A salt that keeps water liquid far below freezing. Perseverance found it inside rocks on the floor of Jezero.'},
  leopard: {name:'Leopard spots (vivianite and greigite)', kid:'Spotty rock', rar:'L', color:'#c9915a', pts:150, maps:['jezero'],
    fact:'Tiny dark-ringed spots in a reddish mudstone called Cheyava Falls, found in 2024. NASA calls them a potential sign of ancient life: the best clue yet, not proof.'},
  hematite: {name:'Hematite', kid:'Iron ball', rar:'R', color:'#8c3b32', pts:60, maps:['gusev','meridiani','gale'],
    fact:'An iron oxide that often forms in water. Spirit found it in the Columbia Hills, and Opportunity found it as tiny balls nicknamed "blueberries".'},
  gypsum: {name:'Gypsum', kid:'White vein', rar:'R', color:'#f2efe6', pts:60, maps:['meridiani','gale'],
    fact:'Bright white veins of calcium sulfate. They show water once flowed through cracks in the rock.'},
  jarosite: {name:'Jarosite', kid:'Yellow salt', rar:'R', color:'#c9a646', pts:60, maps:['meridiani'],
    fact:'A yellow-brown mineral that only forms in acidic, salty water. Opportunity found it in 2004.'},
  halite: {name:'Halite (rock salt)', kid:'Table salt', rar:'U', color:'#efe9f4', pts:40, maps:[], future:'a future Mars map',
    fact:'The same salt we put on food. It is left behind when salty lakes dry up.'},
  mn_oxide: {name:'Manganese oxide', kid:'Black crust', rar:'L', color:'#3b3533', pts:120, maps:['meridiani','gale'],
    fact:'A dark coating that needs water with plenty of oxygen to form. On Earth, microbes often help make it.'},
});

MR.FAMILIES = [
  {id:'silicate',  name:'Silicates',       sym:'Si', col:'#5fb7a8', desc:'Made of silicon and oxygen, the most common minerals in rocky planets.'},
  {id:'carbonate', name:'Carbonates',      sym:'C',  col:'#e8dab0', desc:'Made with carbon and oxygen. They form in water.'},
  {id:'sulfate',   name:'Sulfates',        sym:'S',  col:'#7fb2ff', desc:'Salts made with sulfur and oxygen, left by evaporating water.'},
  {id:'chloride',  name:'Chlorides and perchlorates', sym:'Cl', col:'#d9e6f2', desc:'Salts made with chlorine. They mark where salty water was.'},
  {id:'oxide',     name:'Oxides',          sym:'O',  col:'#c06a4f', desc:'Metals joined with oxygen, like rust.'},
  {id:'phosphate', name:'Phosphates and sulfides', sym:'P', col:'#c9915a', desc:'Minerals with phosphorus or sulfur that can form when life is around.'},
  {id:'organic',   name:'Organics',        sym:'Org', col:'#b48ce8', desc:'Carbon-based molecules, the building blocks of life.'},
  {id:'metal',     name:'Metals',          sym:'Fe', col:'#c2c9d1', desc:'Pure metal, almost always from meteorites.'},
  {id:'rock',      name:'Rocks',           sym:'R',  col:'#8a7a70', desc:'Rocks are mixes of several minerals.'},
];

MR.ELEMENTS = {
  O:{name:'Oxygen', n:8, col:'#ff8a7a', note:'The most common element in rocks. Almost every mineral on Mars has it.'},
  Si:{name:'Silicon', n:14, col:'#5fb7a8', note:'With oxygen it builds silicate minerals, the main stuff of rocky planets.'},
  Fe:{name:'Iron', n:26, col:'#c06a4f', note:'Iron oxide (rust) is what makes Mars red.'},
  Mg:{name:'Magnesium', n:12, col:'#9cc35a', note:'A light metal found in olivine, carbonates and salts.'},
  Ca:{name:'Calcium', n:20, col:'#e8dab0', note:'The same element as in our bones. It is in gypsum and many rocks.'},
  Al:{name:'Aluminum', n:13, col:'#b9c0c8', note:'A light metal found in clays and in the Moon\'s bright crust.'},
  Na:{name:'Sodium', n:11, col:'#f2d15c', note:'Half of table salt (sodium chloride).'},
  K:{name:'Potassium', n:19, col:'#d9a6ff', note:'Found in jarosite. Plants need it too.'},
  C:{name:'Carbon', n:6, col:'#7a7a7a', note:'The backbone of every living thing on Earth.'},
  H:{name:'Hydrogen', n:1, col:'#7fb2ff', note:'Half of water (H₂O). Minerals with hydrogen often formed in water.'},
  S:{name:'Sulfur', n:16, col:'#e9d84a', note:'Found in sulfate salts. Some microbes use sulfur for energy.'},
  Cl:{name:'Chlorine', n:17, col:'#8fe0c9', note:'Found in salt and perchlorate.'},
  P:{name:'Phosphorus', n:15, col:'#ff9a4d', note:'Life needs it for DNA and for storing energy.'},
  Mn:{name:'Manganese', n:25, col:'#a68cd6', note:'Its oxides need oxygen-rich water to form.'},
  Ni:{name:'Nickel', n:28, col:'#c2c9d1', note:'A metal found with iron in meteorites.'},
};
MR.ELEMENT_ORDER = ['H','C','O','Na','Mg','Al','Si','P','S','Cl','K','Ca','Mn','Fe','Ni'];

MR.MINERALS = {
  olivine: {family:'silicate', sym:'Ol', formula:'(Mg,Fe)₂SiO₄', elems:['Mg','Fe','Si','O'], life:true,
    found:'Perseverance in Séítah (2021), and every Mars rover', inst:'PIXL and SuperCam on Perseverance',
    why:{kid:'A green crystal from old lava.', short:'Olivine changes into other minerals quickly in water, so fresh olivine is a clock that shows how dry a place stayed.',
      full:'Olivine is a "water clock": it alters to clay and serpentine within a few million years of contact with water. Perseverance found Séítah\'s rocks rich in olivine, so they cooled from magma and saw little water afterward. Olivine is also the starting point for serpentine, which can feed microbes.'}},
  serpentine: {family:'silicate', sym:'Sp', formula:'Mg₃Si₂O₅(OH)₄', elems:['Mg','Si','O','H'], life:true,
    found:'Seen from orbit at Nili Fossae, right next to Jezero Crater', inst:'CRISM on Mars Reconnaissance Orbiter',
    why:{kid:'A green rock made when water touches lava rock.', short:'Forms when water reacts with olivine and gives off hydrogen. Deep underground on Earth, microbes live on that hydrogen.',
      full:'Serpentinization (water + olivine → serpentine + magnetite + H₂) releases hydrogen and can make methane. On Earth, whole microbial ecosystems in the deep crust run on that chemical energy, without sunlight. Finding serpentine means Mars had the same kind of energy source.'}},
  clay: {family:'silicate', sym:'Cy', formula:'Al₂Si₄O₁₀(OH)₂ · water (smectite)', elems:['Al','Si','O','H','Mg','Fe'], life:true,
    found:'Perseverance on the Jezero delta (2022); Curiosity at Gale Crater', inst:'SuperCam and PIXL on Perseverance, CheMin on Curiosity',
    why:{kid:'Mud rock from an old lake.', short:'Clay only forms in long-lasting, gentle water, and it traps organic molecules and protects them for billions of years.',
      full:'Smectite clays form when neutral, not-too-salty water alters rock over a long time, the kind of water life likes. Their layered structure adsorbs organic molecules and shields them from radiation, which is why Jezero\'s clay-rich delta was chosen as Perseverance\'s landing site.'}},
  silica: {family:'silicate', sym:'Op', formula:'SiO₂ · water (opal)', elems:['Si','O','H'], life:true,
    found:'Spirit at Home Plate, Gusev (2007)', inst:'Mini-TES and APXS on Spirit',
    why:{kid:'A white glassy rock from hot springs.', short:'Left by hot springs. On Earth, hot spring silica keeps finger-like shapes made by microbes, and Spirit found very similar shapes.',
      full:'Spirit\'s stuck wheel dug up soil that was about 90% opaline silica, a sign of hot springs or steam vents. In 2015 scientists noticed the nodular, "cauliflower" silica textures at Home Plate look like ones built with help from microbes at El Tatio hot springs in Chile. It is not proof, but a strong reason to look closer.'}},
  anorthosite: {family:'silicate', sym:'An', formula:'CaAl₂Si₂O₈ (plagioclase)', elems:['Ca','Al','Si','O'],
    found:'Apollo 15 astronauts at Spur crater (1971)', inst:'Collected by hand, studied in labs on Earth',
    why:{kid:'A piece of the Moon\'s very first crust.', short:'The Genesis Rock is about 4 billion years old. It shows the early Moon was covered by an ocean of melted rock.',
      full:'Anorthosite is made almost entirely of the light mineral plagioclase, which floated to the top of the Moon\'s early magma ocean and formed the bright highland crust. Sample 15415 is one of the oldest Moon rocks, close to 4 billion years old.'}},
  glass: {family:'silicate', sym:'Gl', formula:'(Mg,Fe) silicate glass', elems:['Mg','Fe','Si','O'],
    found:'Apollo 15 near Hadley Rille (1971)', inst:'Collected by hand, studied in labs on Earth',
    why:{kid:'Tiny green glass beads from Moon volcanoes.', short:'They came from fire fountains of lava. Inside them scientists later found traces of water from deep inside the Moon.',
      full:'The green beads cooled from droplets sprayed in volcanic fire fountains about 3.3 billion years ago. In 2008, new lab instruments found water trapped inside similar beads, showing the Moon\'s interior is not completely dry.'}},
  carbonate: {family:'carbonate', sym:'Cb', formula:'(Mg,Fe)CO₃', elems:['Mg','Fe','C','O'], life:true,
    found:'Perseverance at the Jezero margin; Spirit at Comanche, Gusev (2010)', inst:'SuperCam and PIXL on Perseverance, Mössbauer and Mini-TES on Spirit',
    why:{kid:'Lake rock that can keep traces of life.', short:'Forms from water and carbon dioxide. On Earth, carbonates hold the oldest fossils of microbe mats, called stromatolites.',
      full:'Carbonates form when CO₂ dissolves in water and reacts with rock, so they record a thicker, wetter ancient atmosphere. At lake shores on Earth, microbial mats trap carbonate in layers that become stromatolites, the oldest fossils known (about 3.5 billion years). The carbonate ring at Jezero\'s margin is a top target for the same reason.'}},
  salts: {family:'sulfate', sym:'Mg', formula:'MgSO₄ · water', elems:['Mg','S','O','H'],
    found:'Spirit\'s stuck wheel at Troy, Gusev (2009); Perseverance in Jezero', inst:'APXS on Spirit, PIXL on Perseverance',
    why:{kid:'Salt left when salty water dried up.', short:'Salts form when salty water evaporates, so they mark places that were once wet.',
      full:'Magnesium and iron sulfates crystallize as salty water evaporates. Some hold water molecules inside their crystals. Spirit\'s wheels churned up bright sulfate soil at Troy, showing water once moved through the ground there.'}},
  gypsum: {family:'sulfate', sym:'Gy', formula:'CaSO₄ · 2H₂O', elems:['Ca','S','O','H'], life:true,
    found:'Curiosity at Gale Crater; Opportunity\'s "Homestake" vein (2011)', inst:'ChemCam on Curiosity, APXS on Opportunity',
    why:{kid:'Bright white lines in rocks, made by water.', short:'Bright veins show water flowing through cracks in the rock, long after a lake dried up.',
      full:'Gypsum veins fill fractures that formed after the rock hardened, so groundwater was still moving underground later in Mars history. Opportunity\'s Homestake vein was called "slam-dunk" evidence of water flowing through rock.'}},
  jarosite: {family:'sulfate', sym:'Ja', formula:'KFe₃(SO₄)₂(OH)₆', elems:['K','Fe','S','O','H'], life:true,
    found:'Opportunity at Meridiani Planum (2004)', inst:'Mössbauer spectrometer on Opportunity',
    why:{kid:'A yellow mineral from very sour water.', short:'Forms only in acidic, salty water, so it tells scientists what kind of water was there.',
      full:'Jarosite needs water with a pH below about 4, like lemon juice. Its discovery at Meridiani showed the water there was acidic and briny. Life on Earth survives such water (Rio Tinto in Spain), but it is harder for life to start in it.'}},
  halite: {family:'chloride', sym:'Ha', formula:'NaCl', elems:['Na','Cl'], life:true,
    found:'Chloride deposits seen from orbit across the southern highlands', inst:'THEMIS on Mars Odyssey',
    why:{kid:'Table salt from dried-up lakes.', short:'Salt left when lakes evaporated, marking where water pooled and dried.',
      full:'Orbiters mapped hundreds of chloride deposits in low basins, the last puddles of evaporating lakes. On Earth, tiny bubbles of water trapped in salt crystals can keep microbes alive for a very long time, so salt deposits are good places to look.'}},
  perchlorate: {family:'chloride', sym:'Pc', formula:'Mg(ClO₄)₂', elems:['Mg','Cl','O'], life:true,
    found:'Phoenix lander in the north (2008); Perseverance on the Jezero crater floor', inst:'WCL on Phoenix, PIXL on Perseverance',
    why:{kid:'A salt that keeps water from freezing.', short:'Keeps water liquid far below freezing. But when rocks are heated to test them, it can destroy organic molecules.',
      full:'Perchlorate brines can stay liquid near −70 °C, so small amounts of liquid water may form on Mars today. The catch: in heated instruments, perchlorate reacts with organics and breaks them down, which made finding organics much harder for Viking and Curiosity.'}},
  hematite: {family:'oxide', sym:'Hm', formula:'Fe₂O₃', elems:['Fe','O'], life:true,
    found:'Opportunity\'s "blueberries" at Meridiani (2004); Spirit in the Columbia Hills, Gusev', inst:'Mini-TES and Mössbauer spectrometer',
    why:{kid:'Little iron balls that grew in water.', short:'Hematite "blueberries" grew in groundwater soaking through rock. The first proof of past water that a rover touched.',
      full:'Gray crystalline hematite was seen from orbit, so Opportunity was sent to Meridiani to check. It found millions of BB-sized concretions that grew as groundwater moved through the sediments. Spirit found hematite and goethite (which contains water) in the Columbia Hills.'}},
  mn_oxide: {family:'oxide', sym:'Mn', formula:'MnO₂', elems:['Mn','O'], life:true,
    found:'Curiosity at Gale Crater; Opportunity at Endeavour crater', inst:'ChemCam on Curiosity, APXS on Opportunity',
    why:{kid:'A black crust that needs lots of oxygen.', short:'Needs water with a lot of oxygen. On Earth, microbes often help make it.',
      full:'Manganese oxides form only in strongly oxidizing water. Finding them suggests ancient Mars had more oxygen in its water than expected. On Earth they are often made with help from microbes, so they are interesting, but not proof.'}},
  leopard: {family:'phosphate', sym:'Lp', formula:'Fe₃(PO₄)₂ · 8H₂O and Fe₃S₄', elems:['Fe','P','S','O','H'], life:true,
    found:'Perseverance at Cheyava Falls, Neretva Vallis (2024)', inst:'PIXL and SHERLOC on Perseverance',
    why:{kid:'Spotty rock that might be a clue of ancient life.', short:'Tiny spots in a mudstone with organic matter. On Earth, reactions like these are often run by microbes. A potential biosignature: the best clue yet, not proof.',
      full:'The "leopard spots" have dark rims of vivianite (iron phosphate) and greigite (iron sulfide) in a rock with organic carbon. On Earth, such redox reactions are often powered by microbes. NASA calls it a potential biosignature: it needs more study, ideally in labs on Earth after Mars Sample Return, to rule out non-living chemistry.'}},
  organics: {family:'organic', sym:'Org', formula:'C, H, O (and more)', elems:['C','H','O'],
    found:'Curiosity at Gale (2018); Perseverance on the crater floor and delta', inst:'SAM on Curiosity, SHERLOC on Perseverance',
    why:{kid:'Building blocks of life.', short:'Carbon molecules are the building blocks of life. Not proof of life, but a big clue.',
      full:'Curiosity found thiophenes and other organic molecules in 3-billion-year-old mudstone, and SHERLOC detected organic signals in Jezero rocks. Organics can also form without life (meteorites carry them), so scientists look at where and in what pattern they appear.'}},
  meteorite: {family:'metal', sym:'Fe', formula:'Fe, Ni', elems:['Fe','Ni'],
    found:'Opportunity\'s Heat Shield Rock (2005); Spirit\'s meteorites (2009); Curiosity\'s Lebanon (2014)', inst:'Pancam and Mini-TES on the rovers, ChemCam on Curiosity',
    why:{kid:'Metal that fell from space.', short:'Iron-nickel meteorites survive a long time on Mars. Their rust tells scientists how fast rocks weather there.',
      full:'Iron meteorites are pieces of the cores of broken asteroids. On Mars their weathering rinds record how much water and oxygen the surface has had since they fell, and future explorers could use them as a source of metal.'}},
  basalt: {family:'rock', sym:'Bs', formula:'pyroxene + feldspar + olivine', elems:['Si','O','Fe','Mg','Ca','Al'],
    found:'Everywhere on Mars; Spirit\'s first targets at Gusev (2004)', inst:'Every rover',
    why:{kid:'Plain lava rock.', short:'The most common rock on Mars. It tells scientists about the volcanoes that built the planet.',
      full:'Spirit landed hoping for lake sediments and found volcanic basalt instead, a surprise that sent it driving to the Columbia Hills. Basalt is the "background" that scientists compare every other rock with.'}},
  moon_basalt: {family:'rock', sym:'Mb', formula:'pyroxene + plagioclase + ilmenite', elems:['Si','O','Fe','Mg','Ca'],
    found:'Apollo 15 on the mare plains near Hadley Rille (1971)', inst:'Collected by hand',
    why:{kid:'Dark lava rock from the Moon.', short:'Lava that flooded the Moon\'s basins more than 3 billion years ago. Dating it tells the Moon\'s history.',
      full:'Mare basalts filled the giant impact basins long after the crust formed. Their ages, measured in labs on Earth, are used to date craters on every rocky planet, including Mars.'}},
  breccia: {family:'rock', sym:'Br', formula:'broken rock pieces glued together', elems:['Si','O','Ca','Al'],
    found:'Apollo 15 at the Apennine Front (1971)', inst:'Collected by hand',
    why:{kid:'Rock made of smashed pieces.', short:'Rock smashed by meteorite impacts and glued back together. It records the Moon\'s violent early history.',
      full:'Impact breccias mix fragments from many places and times. Their ages helped show a burst of large impacts about 3.9 billion years ago, which would have hit the early Earth too.'}},
};
MR.LIFE12 = Object.keys(MR.MINERALS).filter(k => MR.MINERALS[k].life);
MR.mineralFound = (p, id) => !!(p && p.cards && p.cards[id] && (p.cards[id].n || p.cards[id].shiny));
/* What a profile has filled in on the chart: signs of life found, elements lit, and complete family rows. */
MR.chartStats = p => {
  const found = Object.keys(MR.MINERALS).filter(id => MR.mineralFound(p, id)), elems = new Set();
  found.forEach(id => MR.MINERALS[id].elems.forEach(e => elems.add(e)));
  const families = MR.FAMILIES.filter(f => { const m = Object.keys(MR.MINERALS).filter(id => MR.MINERALS[id].family === f.id); return m.length && m.every(id => found.includes(id)); });
  return {found, life:MR.LIFE12.filter(id => found.includes(id)).length, elems, families:families.map(f => f.id)};
};
/* Cards that can be found on the current maps (future-map minerals are left out of the collection count). */
MR.CARD_ORDER = Object.keys(MR.CARDS).filter(k => MR.CARDS[k].maps.length);
MR.FOUND_ORDER = Object.keys(MR.CARDS);
})();
