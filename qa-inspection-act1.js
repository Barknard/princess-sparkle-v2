const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Starting RPG QA Inspection for Act 1...');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Match iPad PWA viewport at 2x for clarity
  await page.setViewportSize({ width: 960, height: 640 });

  const screenshotDir = path.join(__dirname, 'qa-act1');
  const fs = require('fs');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    // Navigate to game
    console.log('Loading game...');
    await page.goto('http://localhost:3456/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Title Screen - capture the intro sequence
    console.log('Screenshot 1: Title/Intro...');
    await page.screenshot({ path: path.join(screenshotDir, '01-title.png') });
    
    // Wait for intro to progress (it auto-advances)
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotDir, '02-intro-mid.png') });
    
    // Tap to advance intro faster
    await page.click('canvas', { position: { x: 480, y: 320 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '03-intro-late.png') });
    
    // Keep tapping to get through intro
    for (let i = 0; i < 5; i++) {
      await page.click('canvas', { position: { x: 480, y: 320 } });
      await page.waitForTimeout(1500);
    }
    
    // 2. Companion Select screen
    console.log('Screenshot 2: Companion Select...');
    await page.screenshot({ path: path.join(screenshotDir, '04-companion-select.png') });
    
    // Select a companion (tap middle-ish area where companions appear)
    await page.click('canvas', { position: { x: 480, y: 400 } });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '05-companion-chosen.png') });
    
    // Confirm selection if needed
    await page.click('canvas', { position: { x: 480, y: 400 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '06-after-companion.png') });
    
    // 3. Overworld / Sparkle Village
    console.log('Screenshot 3: Sparkle Village Hub...');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '07-sparkle-village-spawn.png') });
    
    // Walk around to explore the village - tap to move
    // Walk right
    await page.click('canvas', { position: { x: 700, y: 320 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '08-village-east.png') });
    
    // Walk down
    await page.click('canvas', { position: { x: 480, y: 500 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '09-village-south.png') });
    
    // 4. Try to reach southern exit for Whisper Path
    console.log('Screenshot 4: Walking South...');
    await page.click('canvas', { position: { x: 480, y: 600 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '10-walking-south.png') });
    
    // Keep walking south
    await page.click('canvas', { position: { x: 480, y: 600 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '11-further-south.png') });
    
    // Check if we hit map edge / transition
    await page.click('canvas', { position: { x: 480, y: 620 } });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(screenshotDir, '12-south-edge.png') });

    // Walk west
    console.log('Screenshot 5: Exploring West...');
    await page.click('canvas', { position: { x: 200, y: 320 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '13-village-west.png') });
    
    // Walk north
    await page.click('canvas', { position: { x: 480, y: 100 } });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, '14-village-north.png') });
    
    // Center view
    await page.click('canvas', { position: { x: 480, y: 320 } });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotDir, '15-village-center.png') });

    console.log('All screenshots captured!');
    console.log(`Screenshots saved to: ${screenshotDir}`);
    
  } catch (error) {
    console.error('Error during inspection:', error);
    await page.screenshot({ path: path.join(screenshotDir, 'error-state.png') });
  } finally {
    await browser.close();
  }
})();
