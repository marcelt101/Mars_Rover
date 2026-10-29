/* Campaigns: each map is split into the campaigns NASA's science teams really ran, each with science
   objectives. An objective has a short title (t), a picture title for Cadets (kid), what to do (what),
   why scientists want it (why for Explorers, whyFull for Specialists, both taken from the mineral
   tablet when the objective is about a mineral), and success criteria (kind, res, of).
   Kinds: col = drill the mineral, ident = identify it with Analyze, sites = flag signals during this
   campaign, deliver = bring samples to the station during this campaign. bonus:true is optional. */
(function () {
const MR = window.MR;
const why = (res, extra) => ({why:MR.MINERALS[res].why.short + (extra ? ' ' + extra : ''), whyFull:MR.MINERALS[res].why.full, card:res});

MR.CAMPAIGNS = {
  jezero: [
    {id:'floor', name:'Crater Floor Campaign', real:'Perseverance, 2021–2022',
      brief:'Perseverance landed on the floor of Jezero Crater in February 2021. Before driving to the famous delta, the team studied the rocks under its wheels. Were they lake mud, or lava? The answer surprised everyone.',
      debrief:'The crater floor turned out to be volcanic rock that water later soaked and changed. The salts inside it proved water had seeped through. Next stop: the delta.',
      obj:n => [
        {t:'Flag 3 mystery signals', kid:'Find 3 sparkles', kind:'sites', of:3,
          what:'Scan around the landing site and flag 3 signals for the team.',
          why:'Rover teams choose their targets from what the cameras and scans show. Every flagged site is a possible sample.',
          whyFull:'Each sol, the science team picks targets from Navcam, Mastcam-Z and SuperCam images. Marking and naming targets (like "Rochette") lets the whole team plan around them.'},
        {t:'Drill olivine in Séítah', kid:'Find a green crystal', kind:'col', res:'olivine', of:1,
          what:'Drive into the Séítah dunes south-west of the station, analyze, and drill an olivine-rich rock.', ...why('olivine')},
        {t:'Identify perchlorate salt', kid:'Find a frosty salt', kind:'ident', res:'perchlorate', of:1,
          what:'Analyze rocks on the Máaz crater floor until the spectrometer finds perchlorate.', ...why('perchlorate')},
      ]},
    {id:'delta', name:'Delta Front Campaign', real:'Perseverance, 2022',
      brief:'A river once poured into Jezero\'s lake here, dropping mud and sand in layers. If anything ever lived in the lake, its traces would be buried in this delta.',
      debrief:'In 2022 Perseverance sealed delta samples full of clay and organic molecules. They are some of the most important rock samples ever collected.',
      obj:n => [
        {t:'Drill clay on the delta', kid:'Find mud rock', kind:'col', res:'clay', of:1,
          what:'Drive north-west to the delta, analyze the layered rocks and drill one with clay.', ...why('clay')},
        {t:'Find organic molecules', kid:'Find a life clue', kind:'col', res:'organics', of:1,
          what:'Analyze delta rocks with the spectrometer and drill the one with organic molecules.', ...why('organics')},
        {t:'Bonus: identify serpentine', kid:'Find a snake-skin rock', kind:'ident', res:'serpentine', of:1, bonus:true,
          what:'Look toward the crater rim in the south-west, next to Nili Fossae, and analyze rocks for serpentine.', ...why('serpentine')},
      ]},
    {id:'neretva', name:'Margin and Neretva Vallis', real:'Perseverance, 2023–2024',
      brief:'Along the old lake shore the team looked for carbonates. Then, in the dry river valley of Neretva Vallis, Perseverance found a rock that made headlines around the world.',
      debrief:'Cheyava Falls, July 2024. The project scientist called it "the most puzzling, complex, and potentially important rock yet investigated by Perseverance." Your samples are ready for the trip to Earth.',
      obj:n => [
        {t:'Drill carbonate at the lake margin', kid:'Find lake rock', kind:'col', res:'carbonate', of:1,
          what:'Search the outer edge of the delta, where the old shoreline was, and drill carbonate.', ...why('carbonate')},
        {t:'Drill the leopard spots at Cheyava Falls', kid:'Find a spotty rock', kind:'col', res:'leopard', of:1,
          what:'Drive north-west to where the dry river channel of Neretva Vallis meets the delta, and drill the spotted rock.', ...why('leopard')},
        {t:`Bring ${2+n} samples home`, kid:'Go home with treasure', kind:'deliver', of:2+n,
          what:`Deliver ${2+n} samples to the station during this campaign.`,
          why:'Perseverance seals its best samples in tubes. A future mission is planned to bring them to Earth, where labs can study them far better than any rover.',
          whyFull:'Mars Sample Return would carry the sealed tubes to Earth. Earth labs can date rocks precisely and search for microscopic fossils with instruments far too big to fly to Mars.'},
      ]},
  ],
  gusev: [
    {id:'plains', name:'Gusev Plains', real:'Spirit, 2004',
      brief:'Spirit landed in Gusev Crater in January 2004, hoping to find an old lake bed. Instead it found plains covered in volcanic rock, so the team pointed it at hills on the horizon.',
      debrief:'Spirit\'s first months showed the plains are lava rock with very little water damage. It set off on a drive of almost 3 km to the Columbia Hills to look for older rocks.',
      obj:n => [
        {t:'Identify olivine basalt', kid:'Find a green crystal', kind:'ident', res:'olivine', of:1,
          what:'Analyze rocks on the plains until the spectrometer finds olivine.', ...why('olivine', 'At Gusev, fresh olivine told Spirit\'s team the plains had stayed dry.')},
        {t:'Flag 3 signals on the plains', kid:'Find 3 sparkles', kind:'sites', of:3,
          what:'Scan the plains and flag 3 signals for the team.',
          why:'Spirit\'s team picked targets from its panoramic camera pictures, one rock at a time.',
          whyFull:'Spirit\'s Pancam and Mini-TES surveyed the plains so the team could pick targets for the rock abrasion tool and the spectrometers on its arm.'},
        {t:'Bonus: find an iron meteorite', kid:'Find space metal', kind:'col', res:'meteorite', of:1, bonus:true,
          what:'Look on the flat crater floor for a shiny metal rock.', ...why('meteorite')},
      ]},
    {id:'hills', name:'Columbia Hills', real:'Spirit, 2004–2006',
      brief:'The Columbia Hills are older than the plains. Spirit spent more than a year climbing Husband Hill and found rocks that water had changed.',
      debrief:'In the hills Spirit found hematite and carbonate: water once soaked these rocks. The carbonate at a rock called Comanche hinted at a wetter, thicker ancient atmosphere.',
      obj:n => [
        {t:'Drill hematite in the Columbia Hills', kid:'Find an iron ball', kind:'col', res:'hematite', of:1,
          what:'Climb into the Columbia Hills east of the station, analyze and drill hematite.', ...why('hematite')},
        {t:'Drill carbonate in the hills', kid:'Find lake rock', kind:'col', res:'carbonate', of:1,
          what:'Search the hills for carbonate, like the rock Spirit named Comanche.', ...why('carbonate')},
      ]},
    {id:'homeplate', name:'Home Plate', real:'Spirit, 2006–2009',
      brief:'Home Plate is a flat, layered plateau left by an explosive volcano. Here a broken wheel turned into a lucky break.',
      debrief:'Spirit\'s dragging wheel dug up nearly pure silica in 2007, a sign of ancient hot springs. In 2009 it got stuck at Troy and kept working as a science station until its last message in March 2010.',
      obj:n => [
        {t:'Drill silica near Home Plate', kid:'Find a glass rock', kind:'col', res:'silica', of:1,
          what:'Search the ground right around Home Plate, south-east of the hills, and drill silica.', ...why('silica')},
        {t:'Drill sulfate salts near Troy', kid:'Find a water salt', kind:'col', res:'salts', of:1,
          what:'Look near Troy, just south-west of Home Plate, where Spirit got stuck. Watch out for soft sand!', ...why('salts')},
        {t:`Bring ${2+n} samples home`, kid:'Go home with treasure', kind:'deliver', of:2+n,
          what:`Deliver ${2+n} samples to the station during this campaign.`,
          why:'Spirit could not bring samples home, but your rover can. Every delivery adds to the team\'s science.',
          whyFull:'Spirit and Opportunity studied rocks on the spot with their arm instruments. Perseverance is the first rover that collects samples for a return to Earth.'},
      ]},
  ],
  moon: [
    {id:'rille', name:'Hadley Rille', real:'Apollo 15, 1971',
      brief:'Apollo 15 was the first mission with the Lunar Roving Vehicle. Dave Scott and Jim Irwin drove to the edge of Hadley Rille, a winding canyon cut by flowing lava.',
      debrief:'The basalts from Hadley showed the lava plain is about 3.3 billion years old, and the green glass came from ancient fire fountains.',
      obj:n => [
        {t:'Collect mare basalt', kid:'Find a dark Moon rock', kind:'col', res:'moon_basalt', of:1,
          what:'Pick up a dark lava rock on the plain around the Lunar Module.', ...why('moon_basalt')},
        {t:'Collect green glass beads near the rille', kid:'Find green glass', kind:'col', res:'glass', of:1,
          what:'Drive west to the edge of Hadley Rille (not into it!) and collect the green glass.', ...why('glass')},
      ]},
    {id:'front', name:'Apennine Front', real:'Apollo 15, 1971',
      brief:'On their second drive the astronauts climbed the slope of Mount Hadley Delta, part of the Apennine Mountains, looking for the Moon\'s original crust.',
      debrief:'At Spur crater Scott and Irwin found a white rock sitting on a pedestal of dust: the Genesis Rock, a piece of the Moon\'s ancient crust.',
      obj:n => [
        {t:'Collect the Genesis Rock at Spur crater', kid:'Find the Moon crystal', kind:'col', res:'anorthosite', of:1,
          what:'Drive south-east to Spur crater on the slope of Mount Hadley Delta and collect anorthosite.', ...why('anorthosite')},
        {t:'Collect breccia on the Apennine Front', kid:'Find a smashed rock', kind:'col', res:'breccia', of:1,
          what:'Search the hills and bright rock for breccia.', ...why('breccia')},
      ]},
    {id:'falcon', name:'Back to Falcon', real:'Apollo 15, 1971',
      brief:'Apollo 15 brought home 77 kilograms of Moon rock. Bring your samples back to the Lunar Module, Falcon.',
      debrief:'Apollo 15 was called the most successful crewed exploration flight of its time. Its samples are still studied in labs today.',
      obj:n => [
        {t:`Bring ${2+n} samples to Falcon`, kid:'Go home with treasure', kind:'deliver', of:2+n,
          what:`Deliver ${2+n} samples to the Lunar Module during this campaign.`,
          why:'Moon rocks brought to Earth can be dated and studied with the best instruments in the world.',
          whyFull:'Apollo samples are still being opened and studied with new instruments, decades later. That is the same idea behind Mars Sample Return.'},
      ]},
  ],
};
})();
