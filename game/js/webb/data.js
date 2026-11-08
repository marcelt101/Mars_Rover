/* Webb mission data: real targets with their real positions, the real Webb pictures, and facts at kid level.
   Positions are in degrees (right ascension, declination). w and h are the picture's size on the sky in degrees.
   cam: the instrument Webb really used. need: minutes of exposure for a sharp picture (the First Deep Field took
   12.5 hours, WASP-96 b was watched for 6.4 hours). Pictures: NASA, ESA, CSA, STScI (credits in img/webb/CREDITS.md). */
(function (root) {
const W = root.WEBB = root.WEBB || {};
W.TARGETS = [
  {id:'carina', cat:"NGC 3324", quiz:{e:"Webb's infrared light sees through dust. What is hiding in the dusty cliffs?", ea:["Hundreds of baby stars", "A black hole", "A planet with water"], s:"The cliffs' edge glows because ultraviolet light from very hot young stars is eating away the gas. Where are those stars?", sa:["Just above the top of the picture", "Inside the dark cliffs", "Behind Webb, in our Solar System"]}, clue:["A giant wall of gas and dust that looks like mountains and cliffs, with baby stars hiding inside.", "It's in a star nursery 7,600 light-years away, in the constellation Carina, the keel of a ship."], name:'Cosmic Cliffs', where:'Carina Nebula (NGC 3324)', kind:'Star nursery', ra:159.33, dec:-58.63, w:.27, h:.155,
    img:{NIRCam:'t_carina.jpg'}, cam:'NIRCam', need:60, when:'June 2022', far:'7,600 light-years',
    kid:'The edge of a giant bubble of gas. Hot young stars blew it open, and Webb sees hundreds of baby stars hiding in the dust.',
    more:'Webb\'s infrared light passes through dust, so it shows stars that were hidden from Hubble. The "mountains" are walls of gas lit by very hot, young stars just above the picture.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'ring', cat:"NGC 3132", quiz:{e:"What made the Southern Ring Nebula?", ea:["A dying star puffing off its gas", "Two galaxies crashing", "A comet"], s:"MIRI showed something new in the middle. What?", sa:["The dimmer star, wrapped in dust, is the one making the nebula", "A planet orbiting the bright star", "A black hole eating the gas"]}, clue:["A dying star puffed out its outer layers, like a giant smoke ring in space.", "It's 2,500 light-years away. One day, billions of years from now, our Sun will end like this."], name:'Southern Ring Nebula', where:'NGC 3132', kind:'Dying star', ra:151.76, dec:-40.44, w:.12, h:.11,
    img:{NIRCam:'t_ring_nircam.jpg', MIRI:'t_ring_miri.jpg'}, cam:'MIRI', ok:['NIRCam', 'MIRI'], need:40, when:'June 2022', far:'2,500 light-years',
    kid:'A dying star puffed its outer layers into space like a giant smoke ring. Try both cameras: MIRI shows something NIRCam can\'t!',
    more:'MIRI\'s view revealed that the star making this nebula is the dimmer one in the middle, wrapped in dust. Stars like our Sun end their lives like this, billions of years from now.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'deep', cat:"SMACS J0723.3-7327", quiz:{e:"Why do some galaxies look like stretched arcs?", ea:["The cluster's gravity bends their light", "They spin very fast", "Webb's mirror is bent"], s:"The arcs are galaxies far behind SMACS 0723. What is this effect?", sa:["Gravitational lensing: it magnifies and stretches them", "Redshift: it makes them look closer", "Diffraction: it adds spikes to stars"]}, clue:["Thousands of faraway galaxies in a tiny patch of sky, as small as a grain of sand held at arm's length.", "A huge cluster of galaxies bends their light like a magnifying glass."], name:'First Deep Field', where:'Galaxy cluster SMACS 0723', kind:'Faraway galaxies', ra:110.83, dec:-73.45, w:.045, h:.046,
    img:{NIRCam:'t_deepfield.jpg'}, cam:'NIRCam', need:750, when:'June 2022', far:'4.6 billion light-years',
    kid:'Thousands of galaxies in a patch of sky the size of a grain of sand held at arm\'s length. Some of this light traveled for more than 13 billion years!',
    more:'The cluster\'s gravity bends and magnifies light from galaxies far behind it, like a lens. That is called gravitational lensing. Webb took 12.5 hours of pictures for this one.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'stephan', cat:"HCG 92", quiz:{e:"What are the five galaxies doing?", ea:["Pulling on each other with gravity", "Exploding", "Orbiting the Sun"], s:"The top galaxy, NGC 7319, hides an active black hole. About how heavy is it?", sa:["About 24 million times the Sun", "About 10 times the Sun", "About as heavy as Earth"]}, clue:["Five galaxies dancing together, pulling on each other with gravity.", "One of them hides a giant black hole, 24 million times heavier than the Sun."], name:'Stephan\'s Quintet', where:'5 galaxies in Pegasus', kind:'Galaxies and a black hole', ra:339.0, dec:33.96, w:.106, h:.101,
    img:{NIRCam:'t_stephan.jpg'}, cam:'NIRCam', need:120, when:'June 2022', far:'290 million light-years',
    kid:'Galaxies in a cosmic dance, pulling on each other with gravity. The one at the top has a giant black hole in its middle.',
    more:'That black hole is about 24 million times the mass of the Sun and is pulling in gas, which glows brightly. Fun fact: the galaxy on the left is much closer to us than the other four.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'wasp96', cat:"WASP-96 b", quiz:{e:"What did Webb find in the air of the planet WASP-96 b?", ea:["Water", "Oxygen from trees", "Nothing at all"], s:"How does a transmission spectrum find gases in a planet's air?", sa:["Each gas absorbs its own colors of the starlight passing through", "The planet glows in the color of its gases", "The gases bounce radio waves back to Webb"]}, clue:["A giant planet around another star. You can't see it, but Webb found water in its air.", "Only one instrument can split the light into colors to find it: NIRISS."], name:'WASP-96 b', where:'A giant planet around another star', kind:'Planet', ra:1.05, dec:-47.36, w:0, h:0, spectrum:true,
    img:{NIRISS:'t_wasp96.jpg'}, cam:'NIRISS', need:385, when:'June 2022', far:'1,150 light-years',
    kid:'You can\'t see this planet, but Webb watched its star\'s light shine through the planet\'s air, and found water!',
    more:'When the planet passes in front of its star, some starlight goes through its atmosphere. Each gas soaks up its own colors of light. Webb watched for 6.4 hours with its NIRISS instrument.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'cartwheel', cat:"ESO 350-40", quiz:{e:"How did the Cartwheel Galaxy get its rings?", ea:["A smaller galaxy crashed through it", "They are rings like Saturn's", "Two stars exploded"], s:"What are the two rings, really?", sa:["Waves of new star birth spreading out from the crash", "Belts of asteroids", "Clouds of ice around a black hole"]}, clue:["A galaxy that looks like a wagon wheel.", "A smaller galaxy crashed right through it and made rings, like a stone thrown in a pond."], name:'Cartwheel Galaxy', where:'In Sculptor', kind:'Galaxy crash', ra:9.42, dec:-33.71, w:.039, h:.036,
    img:{NIRCam:'t_cartwheel.jpg'}, cam:'NIRCam', need:60, when:'August 2022', far:'500 million light-years',
    kid:'A smaller galaxy crashed right through this one, and made rings like a stone thrown in a pond.',
    more:'The crash sent waves of new star birth spreading outward. The inner ring and the outer ring are those waves.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'pillars', cat:"M16", quiz:{e:"What is happening inside the Pillars of Creation?", ea:["New stars are being born", "Stars are dying", "Planets are crashing"], s:"The red, lava-like spots at the pillars' edges are\u2026", sa:["Jets from stars that are still forming", "Hot planets", "Galaxies far behind the pillars"]}, clue:["Tall towers of gas and dust where new stars are being born. One of the most famous space pictures ever!", "They're in the Eagle Nebula, 6,500 light-years away."], name:'Pillars of Creation', where:'Eagle Nebula (M16)', kind:'Star nursery', ra:274.73, dec:-13.85, w:.07, h:.12,
    img:{NIRCam:'t_pillars.jpg'}, cam:'NIRCam', need:120, when:'October 2022', far:'6,500 light-years',
    kid:'Giant towers of gas and dust where new stars are born. The red glowing spots are baby stars blowing out jets.',
    more:'Each pillar is several light-years tall. Webb sees through the dust to the young stars inside.',
    credit:'NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI)'},
  {id:'phantom', cat:"M74 (NGC 628)", quiz:{e:"What kind of galaxy is the Phantom Galaxy?", ea:["A spiral galaxy seen from the top", "A galaxy crash", "A star nursery in our Milky Way"], s:"MIRI's mid-infrared view of M74 mostly shows\u2026", sa:["Glowing dust and gas in the spiral arms", "Only old stars in the center", "A jet from its black hole"]}, clue:["A spiral galaxy we see from the top, like looking down on a whirlpool.", "Its dusty arms glow in MIRI, the mid-infrared camera. It's 32 million light-years away."], name:'Phantom Galaxy', where:'M74 in Pisces', kind:'Spiral galaxy', ra:24.17, dec:15.78, w:.061, h:.035,
    img:{MIRI:'t_phantom.jpg'}, cam:'MIRI', need:40, when:'July 2022', far:'32 million light-years',
    kid:'A beautiful spiral galaxy seen from the top. MIRI shows the glowing dust in its arms.',
    more:'Astronomers study galaxies like this one to learn how stars form across a whole galaxy.',
    credit:'ESA/Webb, NASA & CSA, J. Lee and the PHANGS-JWST Team'},
  {id:'crab', cat:"M1", quiz:{e:"What is the Crab Nebula?", ea:["What's left of a star that exploded", "A baby galaxy", "A cloud where planets form"], s:"What spins in its center, 30 times every second?", sa:["A neutron star (a pulsar)", "A black hole", "A planet"]}, clue:["What's left of a star that exploded. People on Earth saw the explosion almost 1,000 years ago!", "In its middle spins a tiny, super heavy star, 30 times every second."], name:'Crab Nebula', where:'In Taurus', kind:'Exploded star', ra:83.64, dec:22.02, w:.1, h:.087,
    img:{NIRCam:'t_crab.jpg'}, cam:'NIRCam', need:60, when:'2023', far:'6,500 light-years',
    kid:'What is left of a star that exploded. People on Earth saw the explosion in the year 1054, and wrote it down!',
    more:'In the middle spins a neutron star, a city-sized ball spinning 30 times every second, left over from the explosion.',
    credit:'NASA, ESA, CSA, STScI, T. Temim (Princeton University)'},
  {id:'rhooph', cat:"Rho Ophiuchi cloud", quiz:{e:"What makes Rho Ophiuchi special?", ea:["It's the closest star nursery to Earth", "It's the biggest galaxy", "It's a dying star"], s:"The red streaks in the picture are\u2026", sa:["Jets of hydrogen gas from young stars", "Cosmic rays hitting the detector", "Lava flows"]}, clue:["The closest place to Earth where stars are being born, only 390 light-years away.", "A cloud of gas with about 50 young stars. Look for red jets shooting out of them."], name:'Rho Ophiuchi', where:'Cloud of gas in Ophiuchus', kind:'Star nursery', ra:246.63, dec:-24.39, w:.111, h:.104,
    img:{NIRCam:'t_rhooph.jpg'}, cam:'NIRCam', need:60, when:'2023', far:'390 light-years',
    kid:'The closest place to Earth where stars are being born. About 50 young stars live here, some like our Sun.',
    more:'The red streaks are jets of gas shooting out of very young stars. Webb took this picture for its first birthday.',
    credit:'NASA, ESA, CSA, STScI, K. Pontoppidan (STScI), A. Pagan (STScI)'},
  {id:'sgrc', cat:"Sgr C", quiz:{e:"Where is Sagittarius C?", ea:["Near the center of our own galaxy", "On Mars", "In a galaxy far away"], s:"Sagittarius C is about 300 light-years from Sagittarius A*. What is Sagittarius A*?", sa:["The giant black hole in the middle of the Milky Way", "A bright young star", "A comet"]}, clue:["A busy cloud near the very heart of our own galaxy, the Milky Way.", "It's only about 300 light-years from the giant black hole in the middle of the Milky Way."], name:'Sagittarius C', where:'Near the center of our Milky Way', kind:'Star nursery near a black hole', ra:266.17, dec:-29.45, w:.1, h:.038,
    img:{NIRCam:'t_sgrc.jpg'}, cam:'NIRCam', need:60, when:'November 2023', far:'25,000 light-years',
    kid:'The very heart of our own galaxy! This cloud is about 300 light-years from Sagittarius A*, the giant black hole in the middle of the Milky Way. About 500,000 stars are in this picture.',
    more:'Baby stars are being born inside the dark cloud. The blue-green glowing gas has needle-like shapes that scientists still can\'t explain.',
    credit:'NASA, ESA, CSA, STScI, S. Crowe (UVA)'},
  {id:'m106', cat:"NGC 4258", quiz:{e:"What is in the middle of Messier 106?", ea:["A hungry black hole", "A star nursery", "A planet"], s:"M106 has two extra arms seen in X-rays and radio waves. What are they made of?", sa:["Hot gas pushed around by the black hole", "Old stars", "Ice"]}, clue:["A spiral galaxy with a hungry black hole that makes two extra arms of hot gas.", "It's 23 million light-years away, and Webb used two cameras on it."], name:'Messier 106', where:'NGC 4258 in Canes Venatici', kind:'Galaxy with a hungry black hole', ra:184.72, dec:47.31, w:.064, h:.081,
    img:{MIRI:'t_m106.jpg'}, cam:'MIRI', ok:['NIRCam', 'MIRI'], need:60, when:'July 2024', far:'23 million light-years',
    kid:'The middle of this spiral galaxy has a giant black hole that is gobbling up gas. It is so busy that it makes two extra arms of hot gas!',
    more:'The black hole is about 40 million times the mass of the Sun. Webb used both NIRCam (stars, in blue) and MIRI (dust, in red and orange). Fun fact: Messier didn\'t find it, his helper Pierre Méchain did.',
    credit:'ESA/Webb, NASA & CSA, J. Glenn'},
  {id:'quasar', cat:"RX J1131-1231", quiz:{e:"What is a quasar?", ea:["A galaxy center where a giant black hole makes gas glow brightly", "A very big planet", "A nearby star"], s:"Why do we see several copies of this quasar?", sa:["A galaxy in front bends its light (gravitational lensing)", "Webb took several pictures", "There are really three quasars"]}, clue:["A super bright galaxy center, where a giant black hole gobbles gas.", "It's 6 billion light-years away, and a galaxy in front bends its light into a ring."], name:'Jewelled Ring', where:'Quasar RX J1131-1231 in Crater', kind:'Quasar', ra:172.96, dec:-12.53, w:.011, h:.011,
    img:{MIRI:'t_quasar.jpg'}, cam:'MIRI', need:120, when:'July 2024', far:'6 billion light-years',
    kid:'A quasar is the bright middle of a faraway galaxy, where a giant black hole swallows gas so fast that the gas glows brighter than all the galaxy\'s stars together. A galaxy in front bends its light into a ring.',
    more:'The three bright dots at the top are copies of the same quasar, made by the bending of light (gravitational lensing). Its black hole spins at more than half the speed of light!',
    credit:'ESA/Webb, NASA & CSA, A. Nierenberg'},
];
W.byId = id => { const k = String(id).toLowerCase(); return W.TARGETS.find(t => t.id === id || t.name.toLowerCase() === k || (t.cat && (t.cat.toLowerCase() === k || t.cat.toLowerCase().split(' (')[0] === k))); };   // by id, nickname or real catalog name
/* Observing weeks with real dates: the Sun decides what Webb may look at that week. */
W.WEEKS = [
  {id:'first', name:'First Light', date:Date.UTC(2022, 5, 15), note:'June 2022. Webb takes its very first science pictures, the ones the whole world saw.',
    goal:'Recreate the 5 pictures NASA showed the world on July 12, 2022', ids:['carina', 'ring', 'deep', 'stephan', 'wasp96']},
  {id:'summer', name:'Summer Week', date:Date.UTC(2022, 7, 25), note:'August 2022. The sky has turned: the Pillars of Creation come into view.',
    goal:'Photograph the Pillars of Creation and the Phantom Galaxy', ids:['pillars', 'phantom']},
  {id:'spring', name:'Spring Week', date:Date.UTC(2023, 2, 15), note:'March 2023. A star that exploded in 1054 is waiting.',
    goal:'Photograph the Crab Nebula, the closest star nursery (Rho Ophiuchi) and the heart of the Milky Way', ids:['crab', 'rhooph', 'sgrc']},
  {id:'black', name:'Black Hole Week', date:Date.UTC(2024, 0, 10), note:'January 2024. Two hungry black holes are in view: one nearby, one 6 billion light-years away.',
    goal:'Photograph a quasar (the Jewelled Ring) and the black hole galaxy Messier 106', ids:['quasar', 'm106']},
];
/* Webb Academy: Dr. Orbit's campaign. He helps a lot at first, then less, then lets you fly on your own. */
W.ACADEMY = [
  {id:'train', name:'Training day', week:'first', ids:['carina', 'ring', 'stephan'], guided:true,
    what:'Dr. Orbit shows you how to fly Webb: the Sun gauge, the gold arrow, zoom, picture.',
       intro:["Hello, cadet! I'm Dr. Orbit. Can I tell you a secret? I'm a one-man team! I run Webb's whole science office all by myself.",
      "There are amazing things out in space that I need to find, and I can't do it alone. I need a cadet. I need YOU!",
      "Find all three for me today, and I'll make you a Junior Space Surveyor, with a real badge!",
      "First, the gauge in the corner. Webb must keep its back to the Sun. Keep the needle in the green, between 85 and 135 degrees.",
      "But you can spin all the way around the Sun! Follow the gold arrow to each target. Let's go, cadet!"],
    done:["You found everything I needed, cadet! You flew Webb like a pro.", "I hereby name you a Junior Space Surveyor! Next time I won't even tell you the names: mystery targets!"]},
  {id:'clues', name:'Mystery targets', week:'summer', ids:['rhooph', 'pillars', 'phantom'], clue:true,
    what:'No names and no arrow: find each target from Dr. Orbit\'s clues, like a detective.',
       intro:["Cadet! Am I glad to see you. I'm still a one-man team, and my list of things to find keeps growing!",
      "Today is harder: I won't tell you the names. I'll give you clues, like a detective. Find all three and you'll earn the Star Detective badge!",
      "Look for the gold question marks in the sky. Zoom in on one to see what it is. Stuck? Press the hint button."],
    done:["Detective work, done! You found every mystery target.", "That earns you the Star Detective badge! Next time, we plan a whole week together."]},
  {id:'plan', name:'Plan a week', soon:true, what:'Dr. Orbit teaches the planning cards and checks your plan.'},
  {id:'alone', name:'You\'re in charge', soon:true, what:'Dr. Orbit goes to a conference. Requests come by message, and breaking news!'},
  {id:'pi', name:'Graduation', soon:true, what:'Become a Principal Investigator. The whole sky is yours.'},
];
/* The ranks, from Cadet to Chief Scientist. Each Academy session earns the next one; Chief Scientist needs every
   Webb picture in the album, too. */
W.RANKS = [
  {name:'Cadet', icon:'🚀', how:'Join Webb Academy'},
  {name:'Junior Space Surveyor', icon:'🔭', how:'Finish Training day'},
  {name:'Star Detective', icon:'🕵️', how:'Finish Mystery targets'},
  {name:'Mission Planner', icon:'🗂️', how:'Finish Plan a week'},
  {name:'Deep Space Duty Officer', icon:'🛰️', how:'Finish You\'re in charge'},
  {name:'Principal Investigator', icon:'🎓', how:'Graduate from Webb Academy'},
  {name:'Chief Scientist', icon:'⭐', how:'Graduate, and collect every Webb picture in the album'},
];
/* The instruments and filters kids can pick. GB per hour of pictures fill the recorder. */
/* Real Webb filters: the number is the wavelength in hundredths of a micron (F200W lets in light around 2 microns, "W" = wide).
   A color picture needs 3 or more filters: each one becomes a color, shortest blue, longest red. */
W.CAMS = {
  NIRCam:{name:'NIRCam', what:'Near-infrared camera: sees stars and galaxies through dust', filters:['F090W','F150W','F200W','F277W','F356W','F444W'], gbh:4},
  MIRI:{name:'MIRI', what:'Mid-infrared camera: sees glowing dust and cool things', filters:['F770W','F1000W','F1130W','F1500W','F1800W','F2100W'], gbh:2},
  NIRISS:{name:'NIRISS', what:'Splits light into colors to find gases in a planet\'s air', filters:['SOSS'], gbh:3},
};
})(typeof window !== 'undefined' ? window : self);
