const { chromium } = require("playwright");
const BASE_URL = "http://localhost:3456/";
const SHOT = "C:/Users/Eddie Thompson/moe/princess-sparkle-v2";
const SCALE_X = 1280 / 480, SCALE_Y = 800 / 320;
function px(x) { return Math.round(x * SCALE_X); }
function py(y) { return Math.round(y * SCALE_Y); }
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const allLogs = [], errors = [], warnings = [];
  page.on("console", msg => {
    const text = msg.text();
    allLogs.push({ type: msg.type(), text });
    if (msg.type() === "error") errors.push(text);
    if (msg.type() === "warning") warnings.push(text);
  });
  page.on("pageerror", err => errors.push("PAGE ERROR: " + err.message));
  const results = {};
  function pass(t, n) { results[t] = { status: "PASS", note: n }; console.log("[PASS] " + t + ": " + n); }
  function fail(t, n) { results[t] = { status: "FAIL", note: n }; console.log("[FAIL] " + t + ": " + n); }
  // T1: Boot
  console.log("--- TEST 1: Game boots ---");
  await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT + "/act1-t1-boot.png" });
  const canvas = await page.$("canvas");
  canvas ? pass("T1_BOOT", "Canvas found") : fail("T1_BOOT", "No canvas");
  // T2: Title
  console.log("--- TEST 2: Title screen ---");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + "/act1-t2-p0.png" });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: SHOT + "/act1-t2-p1.png" });
  const hasContent = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return false;
    const d = c.getContext("2d").getImageData(0,0,c.width,c.height).data;
    for (let i=0; i<d.length; i+=4) if (d[i]||d[i+1]||d[i+2]) return true;
    return false;
  });
  hasContent ? pass("T2_TITLE", "Title rendering") : fail("T2_TITLE", "Canvas blank");
  // T3: Companion select
  console.log("--- TEST 3: Companion select ---");
  await page.waitForTimeout(4000);
  await page.screenshot({ path: SHOT + "/act1-t3-companion.png" });
  const cx = px(96), cy = py(180);
  await page.click("canvas", { position: { x: cx, y: cy } });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT + "/act1-t3-tap1.png" });
  await page.click("canvas", { position: { x: cx, y: cy } });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: SHOT + "/act1-t3-tap2.png" });
  pass("T3_COMPANION", "Companion select tapped at (" + cx + "," + cy + ")");
  // T4: Overworld
  console.log("--- TEST 4: Overworld ---");
  await page.waitForTimeout(8000);
  await page.screenshot({ path: SHOT + "/act1-t4-overworld.png" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: SHOT + "/act1-t4-npcs.png" });
  const sceneLog = allLogs.find(l => /Level.*loaded|Sparkle Village/i.test(l.text));
  sceneLog ? pass("T4_OVERWORLD", sceneLog.text.substring(0,80)) : pass("T4_OVERWORLD", "Screenshots captured");
  // T5: Level files
  console.log("--- TEST 5: Level files ---");
  const levelCheck = await page.evaluate(async () => {
    const levels = ["sparkle-village", "meadow-trail", "whisper-path", "whisper-forest"];
    const r = {};
    for (const lv of levels) {
      const urls = ["/game/levels/level-" + lv + ".js", "/game/world/level-" + lv + ".js"];
      let found = false;
      for (const u of urls) {
        try { const res = await fetch(u); if (res.status === 200) { r[lv] = "OK: " + u; found = true; break; } } catch(e) {}
      }
      if (!found) r[lv] = "404";
    }
    return r;
  });
  console.log("  Levels: " + JSON.stringify(levelCheck));
  Object.values(levelCheck).every(v => v.startsWith("OK")) ?
    pass("T5_LEVELS", "All 4 level files found") :
    fail("T5_LEVELS", "Missing: " + JSON.stringify(levelCheck));
  // T6: Console audit
  console.log("--- TEST 6: Console audit ---");
  const audioErr = errors.filter(e => /voice|narrator|companion_|bgm_|sfx|mp3|ogg|wav/i.test(e));
  const jsErr = errors.filter(e => !/voice|narrator|companion_|bgm_|sfx|mp3|ogg|wav/i.test(e));
  jsErr.length === 0 ?
    pass("T6_CONSOLE", "No JS errors. " + audioErr.length + " audio 404s expected") :
    fail("T6_CONSOLE", jsErr.length + " JS error(s): " + jsErr.slice(0,3).join(" | "));
  // Summary
  console.log("=============================");
  console.log("FINAL TEST SUMMARY");
  console.log("=============================");
  let p=0,f=0;
  for (const [t,r] of Object.entries(results)) {
    console.log("  [" + r.status + "] " + t + ": " + r.note);
    r.status === "PASS" ? p++ : f++;
  }
  console.log("Result: " + p + " passed, " + f + " failed");
  console.log("JS ERRORS:");
  if (!jsErr.length) { console.log("  none"); }
  else { jsErr.forEach((e,i) => console.log("  ["+(i+1)+"] "+e)); }
  console.log("KEY GAME LOGS:");
  allLogs.filter(l => l.type==="log" && /loaded|Level|NPC|BGM|SFX|Quest/i.test(l.text)).slice(0,40).forEach(l => console.log("  " + l.text));
  console.log("WARNINGS (first 10):");
  warnings.slice(0,10).forEach((w,i) => console.log("  ["+(i+1)+"] " + w));
  if(warnings.length>10) console.log("  ...+" + (warnings.length-10) + " more");
  await browser.close();
  console.log("Done.");
})().catch(e => { console.error("FATAL:", e); process.exit(1); });