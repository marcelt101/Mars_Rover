/* Makes the title picture game/img/title.jpg (hand-drawn letters, cratered and lit, over Mars seen from orbit).
   The drawing is in tools/title-render.html. Needs the repo served on http://localhost:8765 and Playwright.
   Run: node tools/make-title.js */
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport:{width:1800, height:1040}});
  await p.goto('http://localhost:8765/tools/title-render.html');
  await p.evaluate(() => { make('marsmoon'); backdrop('marsmoon'); });
  const url = await p.evaluate(() => document.getElementById('out').toDataURL('image/png'));
  const tmp = path.join(__dirname, 'title-full.png'); fs.writeFileSync(tmp, Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
  console.log('wrote', tmp, '- convert to game/img/title.jpg, 1500 px wide (for example with Pillow)');
})();
