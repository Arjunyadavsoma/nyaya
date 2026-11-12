/**
 * Stage 2 browser verification: responsive layout + basic a11y checks
 * across all 13 screens, on desktop + mobile viewports.
 *
 * Run with the dev server on :3457 — pages render server-side, so we
 * assert real content markers (headings, nav sections) rather than mocks.
 */
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright');

const BASE = 'http://localhost:3457';
const PAGES = [
  { path: '/', marker: 'Legal help for every Indian' },
  { path: '/dashboard-home', marker: 'legal dashboard' },
  { path: '/chat', marker: 'Nyaya' },
  { path: '/research', marker: 'Legal research' },
  { path: '/documents', marker: 'Document intelligence' },
  { path: '/drafting', marker: 'Legal drafting' },
  { path: '/workflows', marker: 'Guided workflows' },
  { path: '/rights', marker: /Rights/i },
  { path: '/laws', marker: /Laws .amp; acts/i },
  { path: '/emergency', marker: /Emergency/i },
  { path: '/nearby', marker: /Nearby/i },
  { path: '/info', marker: /Info/i },
  { path: '/legal-aid', marker: 'Legal aid' },
  { path: '/my-nyaya', marker: 'My Nyaya' },
  { path: '/profile', marker: /Profile|Sign/i },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

(async () => {
  const browser = await chromium.launch();
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    console.log(`\n=== ${vp.name} (${vp.width}×${vp.height}) ===`);
    for (const p of PAGES) {
      try {
        const res = await page.goto(BASE + p.path, { waitUntil: 'networkidle', timeout: 30000 });
        const status = res.status();
        const body = await page.content();
        const markerOk = typeof p.marker === 'string' ? body.includes(p.marker) : p.marker.test(body);
        // horizontal overflow check (mobile/tablet)
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const icon = status === 200 && markerOk ? '✓' : '✗';
        if (icon === '✗') failures++;
        console.log(`${icon} ${p.path}  status=${status} marker=${markerOk ? 'ok' : 'MISSING'} hOverflow=${overflow}px`);
      } catch (e) {
        failures++;
        console.log(`✗ ${p.path}  ERROR: ${String(e).slice(0, 80)}`);
      }
    }
    // a11y spot-checks on one representative page
    if (vp.name === 'desktop') {
      await page.goto(BASE + '/workflows', { waitUntil: 'networkidle' });
      const h1 = await page.locator('h1').count();
      const landmarks = await page.locator('nav, main, header, aside').count();
      const imgsNoAlt = await page.locator('img:not([alt])').count();
      console.log(`a11y(/workflows): h1=${h1} landmarks=${landmarks} imgs-without-alt=${imgsNoAlt}`);
      // keyboard: tab to first nav link, confirm focus moves
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent?.slice(0, 20)));
      console.log(`keyboard first focus: ${focused}`);
    }
    if (vp.name === 'mobile') {
      // bottom tab bar visible with 5 items
      await page.goto(BASE + '/', { waitUntil: 'networkidle' });
      const tabs = await page.locator('nav[aria-label="Primary navigation"] a').count();
      console.log(`mobile bottom tabs: ${tabs}`);
    }
    await ctx.close();
  }

  // theme toggle check
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('button[aria-label="Toggle dark mode"]');
  await page.waitForTimeout(400);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log(`\ntheme toggle → dark applied: ${isDark}`);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log(`dark-mode body bg: ${bg}`);
  if (!isDark) failures++;

  await browser.close();
  console.log(failures === 0 ? '\nALL BROWSER CHECKS PASSED' : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
})();
