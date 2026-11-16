/* Apollo 15 at Hadley-Apennine, July 30 - August 2, 1971: Commander David Scott and Lunar Module Pilot James Irwin
   explored with the first Lunar Roving Vehicle, while Alfred Worden orbited in the command module Endeavour.
   Three moonwalks (EVAs). Times are the real EVA lengths; station numbers and names follow NASA's Apollo 15 traverse.
   Map positions are in kilometers from the Lunar Module Falcon (x east, y north), approximate and simplified for the game.
   Tools: rake (small rocks out of the soil), scoop (soil), tongs (pick up a rock), hammer (chip a boulder),
   core (a drive tube pushed into the ground keeps the soil's layers), camera (photograph from a distance). */
(function (root) {
const M = root.MOON = root.MOON || {};
M.DELAY = 1.3;              // seconds for a radio signal from Earth to the Moon
M.SPEED = 8;                // km per hour, a typical driving speed of the rover
M.WALKBACK = 6;             // km: the game's walk-back circle around Falcon
M.EVAS = [
  {id:1, name:'EVA 1', date:'July 31, 1971', minutes:393, title:'To the Elbow and St. George',
    note:'Unload the rover, drive south along Hadley Rille, then set up the science station back at Falcon.',
    start:[{t:'lrv', name:'Unload the rover', min:45, say:'Scott and Irwin unfold the Lunar Roving Vehicle from the side of Falcon. It traveled folded up like a lawn chair.'}],
    stops:[1, 2], end:[{t:'alsep', name:'Set up ALSEP', min:90, say:'The crew sets up the Apollo Lunar Surface Experiments Package: a seismometer to feel moonquakes, a magnetometer, a solar wind experiment and a laser mirror.'}]},
  {id:2, name:'EVA 2', date:'August 1, 1971', minutes:432, title:'The front of Mount Hadley Delta',
    note:'The longest drive: up the slope of the mountain to look for very old rock from the Moon\'s early crust.',
    start:[], stops:[6, '6a', 7, 4], end:[{t:'drill', name:'Drill for the heat-flow experiment', min:60, say:'Back at Falcon, Scott drills holes for an experiment that measures heat flowing out of the Moon\'s inside. The hard ground makes drilling slow and tiring.'}]},
  {id:3, name:'EVA 3', date:'August 2, 1971', minutes:290, title:'The edge of Hadley Rille',
    note:'A shorter last moonwalk to the rim of the great lava canyon. At the end: a famous experiment for TV.',
    start:[{t:'core', name:'Pull out the deep core', min:45, say:'The deep drill core is stuck in the ground. It takes both astronauts and a lot of time to pull it out. Because of this, there won\'t be time for the North Complex.'}], stops:[9, '9a', 10], end:[{t:'feather', name:'The hammer and the feather', min:5, say:'Scott holds a hammer and a falcon feather and drops them together, live on TV.'}]},
];
M.STATIONS = {
  1:{name:'Elbow', lab:'r', x:-1.0, y:-3.1, min:30, where:'A bend of Hadley Rille', tool:'rake', tv:true,
    task:'Rake small rocks out of the soil at the rim of the rille.',
    sample:{name:'Mare basalt pebbles', icon:'🪨', fact:'The plain where Falcon landed is mare basalt: lava that flooded this basin billions of years ago and cooled into dark rock.'}},
  2:{name:'St. George crater', lab:'l', x:-1.9, y:-4.9, min:45, where:'On the slope of Mount Hadley Delta', tool:'hammer', tv:true,
    task:'Chip a piece off a big boulder near the rim of St. George crater.',
    sample:{name:'Breccia', icon:'🪨', fact:'A breccia is made of broken rock pieces welded together by the heat and pressure of huge impacts.'}},
  6:{name:'Station 6', lab:'l', x:-0.2, y:-5.0, min:40, where:'High on the front of Mount Hadley Delta', tool:'core', tv:true,
    task:'Push a core tube into the ground to keep the soil\'s layers in order.',
    sample:{name:'Core of mountain soil', icon:'🧪', fact:'Each layer in a core is like a page in a diary: the bottom layers were laid down long before the top ones.'}},
  '6a':{name:'Station 6a', lab:'b', x:0.3, y:-5.4, min:25, where:'A boulder further up the slope', tool:'hammer', tv:false,
    task:'Take a chip from a boulder that rolled down from higher up the mountain.',
    sample:{name:'Boulder chip', icon:'🪨', fact:'Boulders on a mountainside can come from far above, so they carry rock from places the rover can\'t reach.'}},
  7:{name:'Spur crater', lab:'r', x:0.6, y:-4.5, min:50, where:'A small crater on the mountain front', tool:'tongs', tv:true, star:true,
    task:'A white rock is sitting on top of a dusty rock. Pick it up carefully.',
    sample:{name:'The Genesis Rock (sample 15415)', icon:'💎', fact:'An anorthosite, a white rock from the Moon\'s first crust, about 4 billion years old. It was nicknamed the Genesis Rock. Spur crater also gave the famous green glass beads from ancient volcanic fountains.'}},
  4:{name:'Dune crater', lab:'r', x:0.4, y:-2.4, min:25, where:'On the plain, on the way home', tool:'tongs', tv:false,
    task:'Grab a rock with little holes in it near the rim of Dune crater.',
    sample:{name:'Basalt with gas bubbles', icon:'🪨', fact:'The little holes were gas bubbles in the lava, frozen in place when the lava cooled.'}},
  9:{name:'Scarp crater', lab:'r', x:-1.1, y:0.2, min:30, where:'A fresh crater on the plain', tool:'scoop', tv:true,
    task:'Scoop up soil thrown out of a young crater.',
    sample:{name:'Fresh crater soil', icon:'🧪', fact:'Lunar soil (regolith) is rock smashed into powder by billions of years of tiny meteorite hits.'}},
  '9a':{name:'Rille rim', lab:'l', x:-1.6, y:0.5, min:45, where:'The edge of Hadley Rille', tool:'hammer', tv:true,
    task:'Hammer a sample from the lava rock at the very edge of the canyon.',
    sample:{name:'Rille-rim basalt', icon:'🪨', fact:'The rille wall shows layers of lava, one flow on top of another, like a stack of pancakes.'}},
  10:{name:'Station 10', lab:'l', x:-1.7, y:1.2, min:25, where:'Along the rille, looking across', tool:'camera', tv:false,
    task:'Photograph the far wall of the rille with the long telephoto lens.',
    sample:{name:'Photos of the rille wall', icon:'📸', fact:'Some science is done with a camera: the photos showed the rock layers in the far wall of Hadley Rille.'}},
};
/* The plan the crew never got to: the North Complex was dropped on EVA 3 because the drilling for the heat-flow
   experiment took longer than planned. */
M.NORTH = {name:'North Complex', x:0.6, y:4.3, note:'Planned for EVA 3, but cancelled: drilling holes for an experiment took longer than planned, so there wasn\'t enough time left.'};
M.TOOLS = {
  rake:{name:'Rake', what:'Sifts small rocks out of the soil'},
  scoop:{name:'Scoop', what:'Picks up loose soil'},
  tongs:{name:'Tongs', what:'Grabs a single rock without bending over'},
  hammer:{name:'Hammer', what:'Chips a piece off a boulder'},
  core:{name:'Core tube', what:'Keeps the soil\'s layers in order'},
  camera:{name:'Telephoto camera', what:'Photographs things far away'},
};
/* Real words from the mission, used where they happened. */
M.QUOTES = {
  step:'"Man must explore. And this is exploration at its greatest." (Dave Scott, stepping onto the Moon)',
  feather:'"How about that! Mr. Galileo was correct in his findings." (Dave Scott, after the hammer and feather fell together)',
};
})(window);
