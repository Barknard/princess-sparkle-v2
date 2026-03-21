const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const failed = [];
  page.on('requestfailed', req => failed.push(req.url()));
  page.on('console', msg => {
    if (msg.text().includes('404') || msg.text().includes('Failed')) console.log('CONSOLE:', msg.text());
  });
  await page.goto('http://localhost:8081');
  await page.waitForTimeout(10000);
  console.log('Failed requests:', JSON.stringify(failed, null, 2));
  await browser.close();
})().catch(e => console.error(e));
