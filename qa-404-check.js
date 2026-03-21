const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const failed = [];
  page.on('response', resp => {
    if (resp.status() >= 400) failed.push(resp.url());
  });
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(5000);
  console.log('Failed URLs:', JSON.stringify(failed, null, 2));
  await browser.close();
})().catch(e => console.error(e));
