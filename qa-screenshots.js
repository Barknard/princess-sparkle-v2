const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  // Collect console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  
  await page.goto('http://localhost:8081');

  // Intro sky (4s)
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'qa-01-sky.png' });
  console.log('Screenshot 1: sky taken');

  // Rainbow phase (14s)
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'qa-02-rainbow.png' });
  console.log('Screenshot 2: rainbow taken');

  // Village pan (24s)
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'qa-03-pan.png' });
  console.log('Screenshot 3: pan taken');

  // Wait for companion select (58s)
  await page.waitForTimeout(34000);
  await page.screenshot({ path: 'qa-04-companion.png' });
  console.log('Screenshot 4: companion taken');

  // Select unicorn and confirm
  const positions = await page.evaluate(() => {
    const game = window.__game;
    const scene = game?.sceneManager?._stack?.[game.sceneManager._stack.length - 1];
    return scene?._companions?.map(c => ({ x: c.x, y: c.y })) || [];
  });
  
  const sx = 1280/480, sy = 800/320;
  const cx = positions.length > 0 ? (positions[0].x * sx)|0 : 256;
  const cy = positions.length > 0 ? (positions[0].y * sy)|0 : 450;
  
  await page.click('canvas', { position: { x: cx, y: cy } });
  await page.waitForTimeout(2000);
  await page.click('canvas', { position: { x: cx, y: cy } });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'qa-05-overworld-spawn.png' });
  console.log('Screenshot 5: overworld spawn taken');

  // Tutorial (8s more)
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'qa-06-tutorial.png' });
  console.log('Screenshot 6: tutorial taken');

  // Walk in 4 directions to see the map
  await page.click('canvas', { position: { x: 1000, y: 400 } });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'qa-07-east.png' });
  console.log('Screenshot 7: east taken');

  await page.click('canvas', { position: { x: 640, y: 700 } });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'qa-08-south.png' });
  console.log('Screenshot 8: south taken');

  await page.click('canvas', { position: { x: 200, y: 400 } });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'qa-09-west.png' });
  console.log('Screenshot 9: west taken');

  await page.click('canvas', { position: { x: 640, y: 200 } });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'qa-10-north.png' });
  console.log('Screenshot 10: north taken');

  console.log('Console errors:', JSON.stringify(errors));
  await browser.close();
})().catch(e => console.error(e));
