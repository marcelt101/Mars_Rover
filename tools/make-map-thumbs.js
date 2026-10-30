/* Makes the lobby's map pictures (game/img/maps/<map>.jpg) from the game's own map drawing.
   Needs the game served on http://localhost:8765 (python3 -m http.server 8765 in the repo) and Playwright.
   Run: node tools/make-map-thumbs.js */
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('http://localhost:8765/game/?nomenu=1&preview=zhurong&slot=thumbs'); await p.waitForFunction(() => window.MR && MR.UI2 && MR.UI2.mapThumb);
  const out = path.join(__dirname, '..', 'game', 'img', 'maps');
  for (const k of await p.evaluate(() => MR.MAP_ORDER)) {
    const url = await p.evaluate(k => MR.UI2.mapThumb(k), k);
    fs.writeFileSync(path.join(out, k + '.jpg'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(k, fs.statSync(path.join(out, k + '.jpg')).size >> 10, 'KB');
  }
  await b.close();
})();
