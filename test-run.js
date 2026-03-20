const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Collect ALL console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('http://localhost:8080');

  // Phase 0: Pink (2s)
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-p0-pink.png' });
  console.log('Phase 0: Pink sparkle');

  // Phase 1: Sky (6s)
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'test-p1-sky.png' });
  console.log('Phase 1: Sky + clouds');

  // Phase 2: Rainbow building (15s) — capture mid-build
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-p2-rainbow-early.png' });
  console.log('Phase 2: Rainbow early');

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-p2-rainbow-late.png' });
  console.log('Phase 2: Rainbow late');

  // Phase 3: Village pan (25s)
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-p3-pan-start.png' });
  console.log('Phase 3: Pan start');

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-p3-pan-end.png' });
  console.log('Phase 3: Pan end');

  // Phase 4-5: Princess + narrator (37s)
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'test-p4-princess.png' });
  console.log('Phase 4-5: Princess');

  // Phase 6: Sparkle prompt, then auto-advance (47s)
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'test-p6-sparkle.png' });
  console.log('Phase 6: Sparkle/advancing');

  // Companion select should be showing now (52s)
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-companion-show.png' });
  console.log('Companion select: showing');

  // Wait for auto-cycle to play through (62s)
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'test-companion-cycle.png' });
  console.log('Companion select: after cycle');

  // TAP the unicorn (leftmost) — logical x~96, y~200
  // Viewport scale: 1280/480 = 2.667x, 800/320 = 2.5y
  const scaleX = 1280 / 480;
  const scaleY = 800 / 320;
  const unicornX = 96 * scaleX;  // ~256
  const unicornY = 180 * scaleY; // ~450

  await page.click('canvas', { position: { x: unicornX | 0, y: unicornY | 0 } });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-companion-tap1.png' });
  console.log('Companion: first tap');

  // TAP SAME SPOT to confirm
  await page.click('canvas', { position: { x: unicornX | 0, y: unicornY | 0 } });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-companion-tap2.png' });
  console.log('Companion: second tap (confirm)');

  // Wait for transition to overworld (5s)
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-overworld-1.png' });
  console.log('Overworld: initial');

  // Wait for any auto-walk or dialogue (10s)
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'test-overworld-2.png' });
  console.log('Overworld: after 10s');

  // Tap somewhere to try walking
  await page.click('canvas', { position: { x: 800, y: 300 } });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-overworld-walk.png' });
  console.log('Overworld: after walk tap');

  // Report errors
  console.log('\n=== ERRORS (' + errors.length + ') ===');
  errors.forEach(e => console.log('  ERROR: ' + e));

  await browser.close();
  console.log('\nTest complete');
})().catch(e => console.error('FATAL:', e));
