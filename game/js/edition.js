/* Editions: one game, several releases. tools/build.py rewrites the MR.EDITION line for each build; the table
   below decides what each edition includes. A new feature is built once and switched on or off here. */
(function () {
const MR = window.MR = window.MR || {};
MR.EDITION = 'web';
MR.BUILD = 'dev';
MR.EDITIONS = {
  /* GitHub Pages: everything, plus the links to version 1 and the classic missions. */
  web:         {label:'Web', maps:null, logDays:30, oldVersions:true, qr:true},
  /* Free itch.io demo: Jezero Crater and week 1 of the Mission Log. */
  'itch-demo': {label:'Free demo', demo:true, maps:['jezero'], logDays:7, oldVersions:false, qr:false, buyUrl:null},
  /* Paid itch.io game: everything. */
  'itch-full': {label:'Full game', maps:null, logDays:30, oldVersions:false, qr:false},
  /* Desktop app (Electron or Tauri), later. */
  desktop:     {label:'Desktop', maps:null, logDays:30, oldVersions:false, qr:true},
};
MR.ED = MR.EDITIONS[MR.EDITION] || MR.EDITIONS.web;
MR.edMapOk = m => !MR.ED.maps || MR.ED.maps.includes(m);
MR.edDayOk = d => d <= MR.ED.logDays;
})();
