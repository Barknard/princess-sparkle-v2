const { chromium } = require('playwright');
const LOOP = process.argv[2] || '4';
const COMPANION = parseInt(process.argv[3] || '2'); // default to middle companion

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', msg => {
    const t = msg.text();
    if (msg.type() === 'error' && !t.includes('favicon') && !t.includes('404')) errors.push(t);
  });

  await page.goto('http://localhost:8081');
  console.log(`=== LOOP ${LOOP} (companion ${COMPANION}) ===`);

  // Wait for auto-advance
  await page.waitForTimeout(58000);

  // Get state
  const state = await page.evaluate(() => {
    const game = window.__game;
    const sm = game.sceneManager;
    const stack = sm._stack;
    const scene = stack[stack.length - 1].scene;
    return {
      sceneName: scene.constructor.name,
      introPhase: scene._introPhase,
      positions: scene._positions ? scene._positions.map(p => ({x: p.x, y: p.y})) : [],
      scale: game.renderer.scale,
    };
  });

  if (state.sceneName !== 'CompanionSelectScene') {
    console.log(`FAIL: Not at companion select (${state.sceneName})`);
    await browser.close();
    return;
  }

  const scale = state.scale;
  const pos = state.positions[COMPANION];
  const clickX = Math.round(pos.x * scale);
  const clickY = Math.round(pos.y * scale);
  console.log(`Clicking companion ${COMPANION} at canvas (${clickX}, ${clickY})`);

  // Select + confirm
  await page.click('canvas', { position: { x: clickX, y: clickY } });
  await page.waitForTimeout(1500);
  await page.click('canvas', { position: { x: clickX, y: clickY } });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `loop-${LOOP}-overworld.png` });

  const currentScene = await page.evaluate(() => {
    const stack = window.__game.sceneManager._stack;
    return stack[stack.length - 1].scene.constructor.name;
  });

  if (currentScene === 'OverworldScene') {
    console.log('SUCCESS: In overworld!');

    const owState = await page.evaluate(() => {
      const scene = window.__game.sceneManager._stack[window.__game.sceneManager._stack.length - 1].scene;
      return {
        hasPlayer: !!scene._player,
        hasCompanion: !!scene._companion,
        companionType: scene._companion ? scene._companion.type : 'none',
      };
    });
    console.log('Overworld:', JSON.stringify(owState));

    // Walk around briefly
    await page.click('canvas', { position: { x: 800, y: 300 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `loop-${LOOP}-walk.png` });
  } else {
    console.log(`FAIL: Not in overworld (${currentScene})`);
  }

  console.log(`Critical errors: ${errors.length}`);
  errors.slice(0, 3).forEach(e => console.log('  ERR: ' + e.substring(0, 150)));

  await browser.close();
  console.log(`=== LOOP ${LOOP} COMPLETE ===\n`);
})().catch(e => console.error('FATAL:', e));
