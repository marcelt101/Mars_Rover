/* "About this rover": what each rover in the game is based on, how it works, its main parts and the science
   instruments it uses, written for kids. Real NASA facts; where the game adds something (the Hauler's tube rack,
   the Excavator's blade, the Lab), the text says so. */
(function () {
const MR = window.MR, UI = MR.UI, {$, esc} = UI;
const PERSEVERANCE = {
  real:'Perseverance', when:'NASA, landed in Jezero Crater in February 2021 and still exploring',
  how:'Perseverance is about as big as a small car. Its six wheels sit on bendy legs called a rocker-bogie, so it can roll over rocks without tipping. It does not use solar panels: a nuclear power pack at the back turns heat into electricity, day and night.',
  parts:[
    ['Legs and wheels: rocker-bogie', 'The legs bend up and down so all six wheels stay on the ground, even on bumpy rock.'],
    ['Tail: the power pack (MMRTG)', 'A warm, finned cylinder at the back that makes electricity from heat, like a long-lasting battery.'],
    ['Arm and hand', 'About 2 meters long, with a shoulder, elbow and wrist like your arm. Its "hand" holds tools and instruments.'],
    ['Neck and head: the mast', 'The rover\'s neck and head, with cameras and a laser on top.'],
    ['Voice: the high-gain antenna', 'A flat, six-sided dish that talks straight to Earth.'],
    ['Sample tubes', '43 tubes. The rover seals pieces of rock inside them so they can one day be brought to Earth.'],
  ],
  science:[
    ['Mastcam-Z', 'Two zoom cameras on the head, like a pair of eyes. They take color and 3D pictures.'],
    ['SuperCam', 'Zaps rocks with a laser from up to 7 meters away and studies the light of the tiny spark to find out what the rock is made of. A microphone even hears the zap!'],
    ['PIXL', 'On the arm. It shines X-rays on a spot as small as a grain of salt to find which chemical elements are inside the rock.'],
    ['SHERLOC and WATSON', 'An ultraviolet light that makes some molecules glow, to look for organic molecules, plus a close-up camera.'],
    ['Coring drill', 'Drills out a rock core about the size of a piece of chalk and puts it in a tube.'],
    ['RIMFAX', 'A radar that "sees" layers of rock under the ground, like an X-ray of the soil.'],
    ['MEDA', 'A weather station that measures wind, temperature and dust.'],
    ['MOXIE', 'A test machine that made oxygen from the carbon dioxide in Mars air, for future astronauts.'],
  ],
  fact:'Perseverance carried the Ingenuity helicopter to Mars, tucked under its belly.',
  img:['img/perseverance-instruments.jpg', 'Where the science tools sit on Perseverance. Picture: NASA/JPL-Caltech'],
};
const MER = {
  real:'Spirit and Opportunity', when:'NASA\'s twin Mars Exploration Rovers, landed in January 2004',
  how:'The twins were about the size of a golf cart. Big solar panels, shaped like wings, charged their batteries every day. They were planned to work for 90 sols. Spirit kept going for 6 years and Opportunity for almost 15!',
  parts:[
    ['Solar panels', 'The big dark "wings" turn sunlight into electricity. Dust on them made the rovers weaker, until a gust of wind cleaned them.'],
    ['Six wheels and rocker-bogie legs', 'The same clever legs as later rovers, so the wheels stay on the ground.'],
    ['Neck and head: the Pancam mast', 'The neck and head, with the cameras that make the rover look like it has a face.'],
    ['Robotic arm', 'Folded under the front. Its "hand" has four tools.'],
    ['Ears and voice: antennas', 'A round dish to talk to Earth, and a thin pole antenna for orbiters.'],
  ],
  science:[
    ['Pancam', 'Two color cameras on the head, for big panoramas of the land.'],
    ['Navcam and Hazcams', 'Black-and-white cameras for driving: Navcams on the head look far, Hazcams low on the body spot rocks right in front.'],
    ['Mini-TES', 'Feels the heat glow of rocks from far away to tell which minerals they are. It hides in the body and looks out through a mirror at the top of the mast.'],
    ['APXS', 'Held against a rock to measure which chemical elements it contains.'],
    ['Mössbauer spectrometer', 'Finds iron minerals. It discovered hematite "blueberries" and jarosite.'],
    ['Microscopic Imager', 'A camera that works like a magnifying glass.'],
    ['Rock Abrasion Tool (RAT)', 'Grinds away the dusty outside of a rock to see the fresh inside.'],
    ['Magnet arrays', 'Small magnets on the rover catch the dust that blows by. The dust stuck to them, which showed it has iron minerals in it.'],
    ['Pancam calibration target', 'A sundial on the deck with colored corners. The cameras photograph it to check that their colors are right. It says "Two worlds, one sun".'],
  ],
  fact:'Opportunity drove more than 45 kilometers, longer than a marathon.',
  img:['img/mer-instruments.jpg', 'Where the science tools sit on Spirit and Opportunity. MB is the Mössbauer spectrometer and MI the Microscopic Imager. Picture: NASA/JPL'],
};
MR.ROVER_INFO = {
  science:{...PERSEVERANCE, game:'In the game, the Science rover\'s Analyze identifies every signal within 2 squares, like SuperCam and PIXL working together.'},
  excavator:{...PERSEVERANCE, game:'The real Perseverance has no blade. In the game the Excavator gets one to push rocks and fill sand traps, like the digging robots NASA tests for future Moon bases.'},
  scout:{...MER, game:'In the game the Scout sees farther and scans 6 squares wide, like a rover with a tall mast and sharp cameras.'},
  hauler:{...MER, game:'The real twins studied rocks on the spot and had no sample tubes. In the game the Hauler carries a rack of 4 extra tubes.'},
  buggy:{real:'Sojourner', when:'NASA\'s Mars Pathfinder mission, 1997: the first rover on Mars',
    how:'Sojourner was tiny: about as long as a skateboard and lighter than a big dog. A solar panel on its back gave it power. It rolled off its lander, Pathfinder, and explored the rocks nearby. Its brain sat in a warm box, because Mars nights are colder than Antarctica.',
    img:['img/sojourner-parts.jpg', 'The parts of Sojourner. Drawing: NASA/JPL'],
    parts:[['Solar panel', 'The flat top that charged the rover with sunlight.'], ['Legs and wheels: rocker-bogie', 'Six small metal wheels with cleats, on bendy legs. Every later Mars rover copied this idea.'],
      ['Warm Electronics Box', 'The body. It kept the computer and batteries warm through the freezing nights, like a lunch cooler.'],
      ['Antenna', 'A thin pole that sent messages to the lander, Pathfinder, which passed them on to Earth.']],
    science:[['APXS (Alpha Proton X-ray Spectrometer)', 'At the back. The rover backed up to a rock and held it there to find which chemical elements were inside.'],
      ['Cameras and lasers', 'Two cameras in front to see where to go, and little lasers that spotted rocks and holes so it would not bump into them. A color camera at the back took pictures of the APXS at work.'],
      ['Material Adherence Experiment', 'A small test on the solar panel that measured how fast Mars dust piles up. Dust is a big problem for solar power.']],
    fact:'Sojourner was planned to work for 7 sols. It worked for 83.', game:'In the game the Buggy digs up treasure and never gets stuck.'},
  heli:{real:'Ingenuity', when:'NASA\'s Mars helicopter, flew from 2021 to 2024',
    how:'Ingenuity weighed about as much as a bag of sugar. Its two rotors, each longer than a grown-up\'s arms spread wide, spun about 2,400 times a minute in opposite directions, because the Mars air is so thin. It flew itself: commands from Earth take minutes to arrive, too slow to steer.',
    parts:[['Two rotors', 'Spinning blades, one above the other, turning in opposite directions.'], ['Solar panel', 'On top of the rotors, it charged the battery between flights.'], ['Four thin legs', 'For landing softly.']],
    science:[['Navigation camera', 'Looks straight down to see how fast the helicopter moves.'], ['Color camera', 'Takes pictures of the land ahead, to help choose the rover\'s route.']],
    fact:'It was planned for 5 test flights. It flew 72 times.', game:'In the game the helicopter flies over everything and spots treasure from the air.'},
  lrv:{real:'Lunar Roving Vehicle (Moon buggy)', when:'NASA\'s Apollo 15, 16 and 17 missions, 1971–1972',
    how:'Two astronauts sat side by side and drove it. It folded up to fit on the side of the Lunar Module, then unfolded on the Moon. Two batteries powered an electric motor in each of its four wheels, up to about 13 km per hour.',
    parts:[['Wire-mesh wheels', 'Wheels woven from wire, because rubber tires would not survive the Moon\'s heat and cold.'], ['Batteries', 'Two batteries, not rechargeable, enough for each mission\'s drives.'], ['Umbrella antenna', 'A dish that sent TV pictures straight to Earth.'], ['Seats and controls', 'Two seats and a joystick, used by astronauts in spacesuits.']],
    science:[['TV camera', 'Controlled from Earth, it filmed the astronauts at work and even the launch away from the Moon.'], ['Geology tools', 'Rakes, scoops, tongs, hammers and core tubes for collecting rocks and soil.'], ['Sample bags', 'Numbered bags so scientists knew exactly where each rock came from.']],
    fact:'Three Moon buggies are still parked on the Moon.', game:'On the Moon map, every ground rover drives as a Moon buggy.'},
  curiosity:{real:'Curiosity', when:'NASA, landed in Gale Crater in August 2012 and still exploring',
    how:'Curiosity is a science lab on wheels, about as big and as heavy as a small car (899 kg). NASA engineers describe it like a body: it has eyes, a neck, a brain, ears and a voice, a hand, legs, and even a tail that gives it power. Its job is to find out if Mars ever had water, the right chemicals and energy: three things life needs.',
    parts:[['Brain', 'Computers inside the body that run the rover and keep it safe.'], ['Neck and head: the mast', 'Holds cameras about as high as the eyes of a very tall basketball player.'], ['Eyes: 17 cameras', 'Cameras on the head look far away, and cameras low on the body watch for rocks while driving.'], ['Ears and voice: antennas', 'Radios that talk to Earth directly, or send big messages through orbiters flying above, like walkie-talkies.'], ['Hand: the turret', 'At the end of the arm: a drill, a brush to sweep away dust, a scoop for soil, a close-up camera and two science tools.'], ['Legs and wheels', 'Six tough wheels on rocker-bogie legs that keep every wheel on the ground.'], ['Tail: the power pack', 'A nuclear power pack at the back. Without power it could not move, stay warm or talk with Earth.']],
    science:[['ChemCam', 'A laser on the rover\'s "forehead" zaps rocks from far away. The flash of light tells scientists what the rock is made of.'], ['MAHLI', 'A close-up camera on the hand, like a magnifying glass.'], ['APXS', 'On the hand. It measures which chemical elements are in a rock.'], ['Drill', 'Drills into rock and makes powder for the labs inside the body.'], ['CheMin', 'A lab inside the body. It shines X-rays through rock powder to find the minerals, like the clay that forms in water.'], ['SAM', 'Another lab inside. It bakes rock powder and sniffs the gas to find organic molecules, the carbon building blocks of life.'], ['REMS', 'The weather station on the neck: wind, temperature, air pressure.'], ['RAD', 'Measures the space radiation on Mars, to help keep future astronauts safe.'], ['DAN', 'Looks for water hidden in the ground under the wheels.']],
    fact:'Curiosity found that Gale Crater once had a lake with fresh water that tiny life could have lived in.', game:'On the Gale Crater map, the team explores the same crater as Curiosity, near Mount Sharp.'},
  lab:{real:'A Mars lab (not built yet)', when:'There is no lab on Mars yet',
    how:'Today, rovers carry small labs inside their bodies, and the best studies happen in labs on Earth. In the game, the Lab stays at the station and studies what the team brings home.',
    parts:[['Sample inbox', 'Where samples from the rovers arrive.'], ['Workbench', 'Where samples become water, metal, bricks or glass for base upgrades.']],
    science:[['CheMin (on Curiosity)', 'Shines X-rays through rock powder to find out which minerals it contains.'], ['SAM (on Curiosity)', 'Bakes tiny amounts of rock powder and sniffs the gases, to find organic molecules.'], ['Labs on Earth', 'Scientists study meteorites and Moon rocks in super-clean labs. Mars Sample Return would bring Mars rocks to them.']],
    fact:'Apollo Moon rocks are still being studied, more than 50 years later.', game:'In the game, the Lab catalogs samples and builds base upgrades.'},
};
/* The info window, with a picture of the rover drawn by the game. */
UI.roverInfo = (job, moon, back, gale) => {
  key = moon && job !== 'heli' && job !== 'lab' ? 'lrv' : gale && (job === 'science' || job === 'excavator') ? 'curiosity' : job, I = MR.ROVER_INFO[key]; if (!I) return;
  const p = MR.Store.current(), cadet = p && p.role === 'cadet', list = rows => rows.map(([n, t]) => `<li><b>${esc(n)}</b><span>${esc(t)}</span></li>`).join('');
  UI.openModal(`<div class="sh"><h2>${esc(I.real)}</h2><button class="xbtn" data-close aria-label="Close (Esc)">×</button></div><div class="sb">
    <div class="rinfo"><canvas id="riPic" width="360" height="360"></canvas><div><p class="real">${esc(I.when)}</p><p>${esc(I.how)}</p><p class="rfact">★ ${esc(I.fact)}</p></div></div>
    ${I.img ? `<figure class="rimg"><img src="${I.img[0]}" alt="${esc(I.real)} with its science instruments labeled" loading="lazy"><figcaption>${esc(I.img[1])}</figcaption></figure>` : ''}
    <h3 class="t">Science tools</h3><ul class="rparts sci">${list(cadet ? I.science.slice(0, 3) : I.science)}</ul>
    <h3 class="t">Main parts</h3><ul class="rparts">${list(cadet ? I.parts.slice(0, 3) : I.parts)}</ul>
    <p class="muted" style="margin:0;font-size:13px">${esc(I.game)}</p>
    ${back ? '<div class="row" style="justify-content:flex-end"><button class="btn" id="riBack">Back</button></div>' : ''}</div>`);
  const r = {job:key === 'lrv' ? 'scout' : key === 'curiosity' ? 'science' : key, role:job === 'buggy' || job === 'heli' ? 'cadet' : 'explorer', color:(p && p.color) || 'teal', perks:[], tubes:job === 'hauler' ? ['clay','olivine','salts'] : [], dust:0};
  MR.Render.drawPreview($('riPic'), r, key === 'lrv');
  if (back) $('riBack').onclick = back;
};
})();
