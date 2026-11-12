/** Stage 2 visual evidence: 3 representative screenshots at low resolution. */
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');
const fs = require('fs');

(async () => {
  fs.mkdirSync('/tmp/stage2-shots', { recursive: true });
  const browser = await chromium.launch();
  const shots = [
    { path: '/dashboard-home', name: 'dashboard-desktop', vp: { width: 1280, height: 800 } },
    { path: '/workflows', name: 'workflows-desktop', vp: { width: 1280, height: 800 } },
    { path: '/', name: 'home-mobile', vp: { width: 390, height: 844 } },
  ];
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: s.vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3457' + s.path, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: `/tmp/stage2-shots/${s.name}.png` });
    await ctx.close();
    console.log(`saved ${s.name}.png`);
  }
  await browser.close();
})();
