const { chromium } = require('playwright');
const LOOP = process.argv[2] || '1';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const gameLog = [];
  page.on('console', msg => {
    const t = msg.text();
    if (msg.type() === 'error' && !t.includes('favicon')) errors.push(t);
    if (t.includes('[Voice]') || t.includes('Scene') || t.includes('companion') || t.includes('Overworld') || t.includes('switch') || t.includes('Confirm') || t.includes('tapped') || t.includes('phase') || t.includes('Quest') || t.includes('NPC') || t.includes('Tutorial'))
      gameLog.push(t.substring(0, 150));
  });

  await page.goto('http://localhost:8081');
  console.log(`=== LOOP ${LOOP} ===`);

  // Wait for title scene phases to auto-advance
  // Total title duration: ~44.8s + 1.5s burst + 0.6s transition = ~47s
  // Then companion select needs 6s for intro phases
  // Total: ~53s minimum. We wait 58s to be safe.
  console.log('Waiting for title auto-advance + companion select intro (58s)...');
  await page.waitForTimeout(58000);
  await page.screenshot({ path: `loop-${LOOP}-01-companion.png` });

  // Read game state
  const state = await page.evaluate(() => {
    const game = window.__game;
    if (!game) return { error: 'no game object' };
    const sm = game.sceneManager;
    if (!sm) return { error: 'no scene manager' };
    const stack = sm._stack;
    if (!stack || stack.length === 0) return { error: 'empty stack' };
    const scene = stack[stack.length - 1].scene;
    const sceneName = scene.constructor ? scene.constructor.name : 'unknown';
    const result = { sceneName, introPhase: scene._introPhase, selectedIndex: scene._selectedIndex };
    if (scene._positions) {
      result.positions = scene._positions.map((p, i) => ({ index: i, x: p.x, y: p.y }));
    }
    const renderer = game.renderer;
    if (renderer) {
      result.scale = renderer.scale;
      result.offsetX = renderer.offsetX;
      result.offsetY = renderer.offsetY;
    }
    return result;
  });
  console.log('State:', JSON.stringify(state));

  if (state.sceneName !== 'CompanionSelectScene') {
    console.log(`Not at companion select (at ${state.sceneName})`);
    await browser.close();
    return;
  }

  // Click companion 0 (Shimmer/Unicorn)
  const scale = state.scale || 2.5;
  const pos = state.positions[0];
  const clickX = Math.round(pos.x * scale);
  const clickY = Math.round(pos.y * scale);
  console.log(`Clicking companion 0 at canvas (${clickX}, ${clickY})`);

  // First tap
  await page.click('canvas', { position: { x: clickX, y: clickY } });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `loop-${LOOP}-02-selected.png` });

  // Second tap to confirm
  await page.click('canvas', { position: { x: clickX, y: clickY } });
  await page.waitForTimeout(500);

  // Verify confirm triggered
  const confirmState = await page.evaluate(() => {
    const scene = window.__game.sceneManager._stack[window.__game.sceneManager._stack.length - 1].scene;
    return { confirmedIndex: scene._confirmedIndex, confirmAnimating: scene._confirmAnimating };
  });
  console.log('Confirm state:', JSON.stringify(confirmState));

  // Wait for 3s celebration + 0.8s iris transition
  console.log('Waiting for confirm animation + transition...');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `loop-${LOOP}-03-overworld.png` });

  // Check scene
  const currentScene = await page.evaluate(() => {
    const stack = window.__game.sceneManager._stack;
    if (!stack || stack.length === 0) return 'empty';
    return stack[stack.length - 1].scene.constructor.name;
  });
  console.log('Current scene:', currentScene);

  if (currentScene === 'OverworldScene') {
    console.log('SUCCESS: In overworld!');

    // Check overworld state
    const owState = await page.evaluate(() => {
      const scene = window.__game.sceneManager._stack[window.__game.sceneManager._stack.length - 1].scene;
      return {
        hasPlayer: !!scene._player,
        playerX: scene._player ? scene._player.x : 0,
        playerY: scene._player ? scene._player.y : 0,
        hasCompanion: !!scene._companion,
        npcCount: scene._npcs ? scene._npcs.filter(n => n.active).length : 0,
        interactableCount: scene._interactables ? scene._interactables.filter(i => i.active).length : 0,
        animalCount: scene._animals ? scene._animals.filter(a => a.active).length : 0,
      };
    });
    console.log('Overworld state:', JSON.stringify(owState));

    // Walk around
    await page.waitForTimeout(2000);

    // Walk right
    await page.click('canvas', { position: { x: 900, y: 400 } });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `loop-${LOOP}-04-walk-right.png` });

    // Walk down
    await page.click('canvas', { position: { x: 640, y: 650 } });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `loop-${LOOP}-05-walk-down.png` });

    // Walk left
    await page.click('canvas', { position: { x: 300, y: 400 } });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `loop-${LOOP}-06-walk-left.png` });

    // Walk up
    await page.click('canvas', { position: { x: 640, y: 200 } });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `loop-${LOOP}-07-walk-up.png` });
  } else {
    console.log('FAIL: Not in overworld after transition');
  }

  console.log(`\nErrors: ${errors.length}`);
  const criticalErrors = errors.filter(e => !e.includes('404') && !e.includes('Not Found'));
  console.log(`Critical errors (non-404): ${criticalErrors.length}`);
  criticalErrors.slice(0, 5).forEach(e => console.log('  CRITICAL: ' + e.substring(0, 200)));

  console.log(`\nGame log entries: ${gameLog.length}`);
  gameLog.slice(-10).forEach(l => console.log('  LOG: ' + l));

  await browser.close();
  console.log(`\n=== LOOP ${LOOP} COMPLETE ===`);
})().catch(e => console.error('FATAL:', e));
