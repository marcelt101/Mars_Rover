/* Webb mission data: real targets with their real positions, the real Webb pictures, and facts at kid level.
   Positions are in degrees (right ascension, declination). w and h are the picture's size on the sky in degrees.
   cam: the instrument Webb really used. need: minutes of exposure for a sharp picture (the First Deep Field took
   12.5 hours, WASP-96 b was watched for 6.4 hours). Pictures: NASA, ESA, CSA, STScI (credits in img/webb/CREDITS.md). */
(function (root) {
const W = root.WEBB = root.WEBB || {};
W.TARGETS = [
  {id:'carina', name:'Cosmic Cliffs', where:'Carina Nebula (NGC 3324)', kind:'Star nursery', ra:159.33, dec:-58.63, w:.27, h:.155,
    img:{NIRCam:'t_carina.jpg'}, cam:'NIRCam', need:60, when:'June 2022', far:'7,600 light-years',
    kid:'The edge of a giant bubble of gas. Hot young stars blew it open, and Webb sees hundreds of baby stars hiding in the dust.',
    more:'Webb\'s infrared light passes through dust, so it shows stars that were hidden from Hubble. The "mountains" are walls of gas lit by very hot, young stars just above the picture.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'ring', name:'Southern Ring Nebula', where:'NGC 3132', kind:'Dying star', ra:151.76, dec:-40.44, w:.12, h:.11,
    img:{NIRCam:'t_ring_nircam.jpg', MIRI:'t_ring_miri.jpg'}, cam:'MIRI', need:40, when:'June 2022', far:'2,500 light-years',
    kid:'A dying star puffed its outer layers into space like a giant smoke ring. Try both cameras: MIRI shows something NIRCam can\'t!',
    more:'MIRI\'s view revealed that the star making this nebula is the dimmer one in the middle, wrapped in dust. Stars like our Sun end their lives like this, billions of years from now.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'deep', name:'First Deep Field', where:'Galaxy cluster SMACS 0723', kind:'Faraway galaxies', ra:110.83, dec:-73.45, w:.045, h:.046,
    img:{NIRCam:'t_deepfield.jpg'}, cam:'NIRCam', need:750, when:'June 2022', far:'4.6 billion light-years',
    kid:'Thousands of galaxies in a patch of sky the size of a grain of sand held at arm\'s length. Some of this light traveled for more than 13 billion years!',
    more:'The cluster\'s gravity bends and magnifies light from galaxies far behind it, like a lens. That is called gravitational lensing. Webb took 12.5 hours of pictures for this one.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'stephan', name:'Stephan\'s Quintet', where:'5 galaxies in Pegasus', kind:'Galaxies and a black hole', ra:339.0, dec:33.96, w:.106, h:.101,
    img:{NIRCam:'t_stephan.jpg'}, cam:'NIRCam', need:120, when:'June 2022', far:'290 million light-years',
    kid:'Galaxies in a cosmic dance, pulling on each other with gravity. The one at the top has a giant black hole in its middle.',
    more:'That black hole is about 24 million times the mass of the Sun and is pulling in gas, which glows brightly. Fun fact: the galaxy on the left is much closer to us than the other four.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'wasp96', name:'WASP-96 b', where:'A giant planet around another star', kind:'Planet', ra:1.05, dec:-47.36, w:0, h:0, spectrum:true,
    img:{NIRISS:'t_wasp96.jpg'}, cam:'NIRISS', need:385, when:'June 2022', far:'1,150 light-years',
    kid:'You can\'t see this planet, but Webb watched its star\'s light shine through the planet\'s air, and found water!',
    more:'When the planet passes in front of its star, some starlight goes through its atmosphere. Each gas soaks up its own colors of light. Webb watched for 6.4 hours with its NIRISS instrument.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'cartwheel', name:'Cartwheel Galaxy', where:'In Sculptor', kind:'Galaxy crash', ra:9.42, dec:-33.71, w:.039, h:.036,
    img:{NIRCam:'t_cartwheel.jpg'}, cam:'NIRCam', need:60, when:'August 2022', far:'500 million light-years',
    kid:'A smaller galaxy crashed right through this one, and made rings like a stone thrown in a pond.',
    more:'The crash sent waves of new star birth spreading outward. The inner ring and the outer ring are those waves.',
    credit:'NASA, ESA, CSA, STScI'},
  {id:'pillars', name:'Pillars of Creation', where:'Eagle Nebula (M16)', kind:'Star nursery', ra:274.73, dec:-13.85, w:.07, h:.12,
    img:{NIRCam:'t_pillars.jpg'}, cam:'NIRCam', need:120, when:'October 2022', far:'6,500 light-years',
    kid:'Giant towers of gas and dust where new stars are born. The red glowing spots are baby stars blowing out jets.',
    more:'Each pillar is several light-years tall. Webb sees through the dust to the young stars inside.',
    credit:'NASA, ESA, CSA, STScI; J. DePasquale, A. Koekemoer, A. Pagan (STScI)'},
  {id:'phantom', name:'Phantom Galaxy', where:'M74 in Pisces', kind:'Spiral galaxy', ra:24.17, dec:15.78, w:.061, h:.035,
    img:{MIRI:'t_phantom.jpg'}, cam:'MIRI', need:40, when:'July 2022', far:'32 million light-years',
    kid:'A beautiful spiral galaxy seen from the top. MIRI shows the glowing dust in its arms.',
    more:'Astronomers study galaxies like this one to learn how stars form across a whole galaxy.',
    credit:'ESA/Webb, NASA & CSA, J. Lee and the PHANGS-JWST Team'},
  {id:'crab', name:'Crab Nebula', where:'In Taurus', kind:'Exploded star', ra:83.64, dec:22.02, w:.1, h:.087,
    img:{NIRCam:'t_crab.jpg'}, cam:'NIRCam', need:60, when:'2023', far:'6,500 light-years',
    kid:'What is left of a star that exploded. People on Earth saw the explosion in the year 1054, and wrote it down!',
    more:'In the middle spins a neutron star, a city-sized ball spinning 30 times every second, left over from the explosion.',
    credit:'NASA, ESA, CSA, STScI, T. Temim (Princeton University)'},
  {id:'rhooph', name:'Rho Ophiuchi', where:'Cloud of gas in Ophiuchus', kind:'Star nursery', ra:246.63, dec:-24.39, w:.111, h:.104,
    img:{NIRCam:'t_rhooph.jpg'}, cam:'NIRCam', need:60, when:'2023', far:'390 light-years',
    kid:'The closest place to Earth where stars are being born. About 50 young stars live here, some like our Sun.',
    more:'The red streaks are jets of gas shooting out of very young stars. Webb took this picture for its first birthday.',
    credit:'NASA, ESA, CSA, STScI, K. Pontoppidan (STScI), A. Pagan (STScI)'},
];
W.byId = id => W.TARGETS.find(t => t.id === id || t.name.toLowerCase() === String(id).toLowerCase());
/* Observing weeks with real dates: the Sun decides what Webb may look at that week. */
W.WEEKS = [
  {id:'first', name:'First Light', date:Date.UTC(2022, 5, 15), note:'June 2022. Webb takes its very first science pictures, the ones the whole world saw.'},
  {id:'summer', name:'Summer Week', date:Date.UTC(2022, 7, 25), note:'August 2022. The sky has turned: the Pillars of Creation come into view.'},
  {id:'spring', name:'Spring Week', date:Date.UTC(2023, 2, 15), note:'March 2023. A star that exploded in 1054 is waiting.'},
];
/* The instruments and filters kids can pick. GB per hour of pictures fill the recorder. */
W.CAMS = {
  NIRCam:{name:'NIRCam', what:'Near-infrared camera: sees stars and galaxies through dust', filters:['F090W','F200W','F444W'], gbh:4},
  MIRI:{name:'MIRI', what:'Mid-infrared camera: sees glowing dust and cool things', filters:['F770W','F1130W','F2100W'], gbh:2},
  NIRISS:{name:'NIRISS', what:'Splits light into colors to find gases in a planet\'s air', filters:['SOSS'], gbh:3},
};
})(typeof window !== 'undefined' ? window : self);
