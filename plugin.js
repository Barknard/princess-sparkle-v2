
function ensureCookieSliderTickCss(){
  if (document.getElementById('__cookie_ticks_css__')) return;
  const st = document.createElement('style');
  st.id = '__cookie_ticks_css__';
  st.textContent = `
    /* Hash marks along the cookie slider track */
    #cookieMinRange{
      --tick-step: 24px;           /* JS updates this per width & step */
      --tick-height: 8px;
      background-image: repeating-linear-gradient(
        to right,
        rgba(255,255,255,.35) 0 1px,
        transparent 1px var(--tick-step)
      );
      background-repeat: no-repeat;
      background-size: 100% var(--tick-height);
      background-position: left calc(50% + 10px); /* float inside track */
    }
  `;
  document.head.appendChild(st);
}


/* --- global app namespace + state (prevents ReferenceError on early calls) --- */
window.App = window.App || {};
let state = window.App.state || null;
/* Nighttime Activity Planner — Plugin.js v1.10 (clean)
   - No workflow remnants
   - All debugger buttons mapped to real functions via AppControls
   - Robust cookie helpers (+/- all, clear, by name)
   - Smoke actions: Hard Reset, init, +cookies Color, place Color@0
*/
;(function(){
  // handle to the currently-dragged cookie token for instant visual removal
  let __dragCookieEl = null;
  let __fogOverlay = null; // timeline-wide cloud overlay (reused)
  let __marqTimer = null;
  let __marqLastIdx = -1;   // last focused index within the current open list

// Demo artifact refs for cleanup/cancel paths
let __demoCarryClone = null;
let __demoCookieNode = null;

function ensureDemoCss(){
  if (document.getElementById('__demo_carry_css__')) return;
  const st = document.createElement('style');
  st.id = '__demo_carry_css__';
  st.textContent = `
    /* Keep card labels horizontal and readable while carrying/placing */
    .card .label{
      writing-mode: horizontal-tb !important;
      white-space: nowrap;          /* avoid the 1-char-per-line wrap */
      text-align: center;
    }
    /* On the shelf we can allow wrap if you prefer: */
    #shelf .card .label{ white-space: normal; }

    /* Make sure carried clones don't shrink */
    #demoHand .cookieToken{ transform:none !important; }
  `;
  document.head.appendChild(st);
}


  // Prevent double-boot
  if (window.__PLANNER_BOOTED__) { try { DBG && DBG.warn('planner already booted — skipping'); } catch {} return; }
  window.__PLANNER_BOOTED__ = true;
  window.__PLANNER_VERSION__ = '1.15.3'

  const dbgInit = DBG && DBG.channel ? DBG.channel('init') : console;
  try {
    if (DBG && DBG.modules && typeof DBG.modules.register === 'function'){
      DBG.modules.register('planner', {version:'1.10', author:'you'});
    } else if (DBG && DBG.ok) {
      DBG.ok('[module] planner (no registry, skipped)');
    }
  } catch (e) { try{ DBG.warn('module register skipped:', e.message); }catch{} }

  // -------- State --------
  const COOKIE_MIN = 5;
  const ELECTIVE = [
    {id:'color',  label:'Color',  icon:'fa-palette'},
    {id:'puzzle', label:'Puzzle', icon:'fa-puzzle-piece'},
    {id:'story',  label:'Story',  icon:'fa-book-open'},
    {id:'blocks', label:'Blocks', icon:'fa-cubes'},
    {id:'breathe',label:'Breathe',icon:'fa-wind'},
    {id:'dance',  label:'Dance',  icon:'fa-music'},
    {id:'tv',     label:'TV',     icon:'fa-tv'}  ];
  const PARENTS = [
    {id:'self_care', label:'Self-Care', icon:'fa-heart'},
    {id:'tuck_in',   label:'Tuck In',   icon:'fa-bed'}
  ];

  // Optional parent-only cards (visible/usable only in Parent Mode; NOT auto-placed)
  const PARENT_EXTRA = [
    {id:'gratitude', label:'Gratitude', icon:'fa-seedling'},
    {id:'feelings',  label:'Feelings',  icon:'fa-face-smile'}
  ];
  const ALL = [...ELECTIVE, ...PARENTS, ...PARENT_EXTRA];

  const state = {
    mode: 'editing',
    parentMode: false,
    totalMins: 90,
    cookie: { bank: 0, counts: Object.create(null) },
    timeline: [], // array of {type:'elective'|'parent', id, fixed?}
    fogOverlay: null
  };


// -------- Seeded RNG for deterministic cookie scatter --------
let __cookieSeed = 0;
try {
  const key = 'cookieSeed';
  const s = localStorage.getItem(key);
  if (s) {
    __cookieSeed = parseInt(s, 10) >>> 0;
  } else {
    // create a new seed and persist it so scatter is stable this session
    __cookieSeed = (Date.now() ^ (Math.random()*0xffffffff)) >>> 0;
    localStorage.setItem(key, String(__cookieSeed));
  }
} catch {}
function rand32() {
  // xorshift32
  __cookieSeed ^= __cookieSeed << 13; __cookieSeed &= 0xffffffff;
  __cookieSeed ^= __cookieSeed >> 17; __cookieSeed &= 0xffffffff;
  __cookieSeed ^= __cookieSeed << 5;  __cookieSeed &= 0xffffffff;
  // convert to [0,1)
  return ((__cookieSeed >>> 0) / 0x100000000);
}



  // -------- Debugger snapshot --------
  if (DBG && typeof DBG.registerSnapshot === 'function'){
    DBG.registerSnapshot(()=> ({
      mode: state.mode,
      parentMode: state.parentMode,
      totalMins: state.totalMins,
      bank: state.cookie.bank,
      counts: {...state.cookie.counts},
      timeline: state.timeline.map(x=> x? {type:x.type, id:x.id, fixed:!!x.fixed}: null)
    }));
  }

  // Pub/Sub
  const bus = (()=>{
    const m = Object.create(null);
    return {
      on(t, f){ (m[t]||(m[t]=[])).push(f); return ()=> m[t]= (m[t]||[]).filter(x=>x!==f); },
      emit(t, p){ (m[t]||[]).forEach(f=>{ try{ f(p);}catch(e){ DBG && DBG.err && DBG.err('listener error', e.message); } }); }
    };
  })();

  bus.on('go:start', freezeUI);
  bus.on('go:done',  finishUI);
  // -------- DOM --------
  const dom = {
    timeline: document.getElementById('timeline'),
    shelf: document.getElementById('shelf'),
    goBtn: document.getElementById('goBtn'),
    parentToggle: document.getElementById('parentToggle'),
    parentExtrasWrap: document.getElementById('parentExtrasWrap'),
    demoToggle: document.getElementById('demoToggle'),
    demoState: document.getElementById('demoState'),
    parentLockToggle: document.getElementById('parentLockToggle'),
    lockState: document.getElementById('lockState'),
    parentState: document.getElementById('parentState'),
    durationWrap: document.getElementById('durationWrap'),
    durationRange: document.getElementById('durationRange'),
    durationValue: document.getElementById('durationValue'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    direction: document.getElementById('direction'),
    cookiePile: document.getElementById('cookiePile'),
    cookieCount: document.getElementById('cookieCount'),
    cookieMinWrap: document.getElementById('cookieMinWrap'),
    cookieMinRange: document.getElementById('cookieMinRange'),
    cookieMinValue: document.getElementById('cookieMinValue')
  };

// Build the cookie slider inline in the cookie header (Option B)
ensureCookieHeaderControls();
wireCookieMinControls();

// Ensure the "Minutes per cookie" controls live inline in the cookie-bank header
function ensureCookieHeaderControls(){
  const header  = document.getElementById('cookieHeader');
  if (!header) return;

  // reuse if it already exists anywhere
  let wrap  = document.getElementById('cookieMinWrap');
  let range = document.getElementById('cookieMinRange');
  let value = document.getElementById('cookieMinValue');

  if (!wrap){
    wrap = document.createElement('div');
    wrap.id = 'cookieMinWrap';

    const label = document.createElement('label');
    label.htmlFor = 'cookieMinRange';
    label.textContent = 'Minutes per cookie';
    label.style.whiteSpace = 'nowrap';

    range = document.createElement('input');
    range.type = 'range';
    range.id   = 'cookieMinRange';
    range.min  = '5';
    range.max  = '60';
    range.step = '5';

    value = document.createElement('span');
    value.id = 'cookieMinValue';

    wrap.append(label, range, value);
  }

  // inline layout so it doesn’t add vertical height
  Object.assign(wrap.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    marginLeft: '16px',
    background: 'none',
    padding: '0',
    boxShadow: 'none'
  });
  range && (range.style.width = 'clamp(140px, 24vw, 320px)');

  // move (or insert) directly into the header, before the summary
  const summary = document.getElementById('cookieSummary');
  if (wrap.parentNode !== header){
    summary ? header.insertBefore(wrap, summary) : header.appendChild(wrap);
  }

  // refresh dom refs so existing code keeps working
  if (typeof dom === 'object'){
    dom.cookieMinWrap  = wrap;
    dom.cookieMinRange = range;
    dom.cookieMinValue = value;
  }
}


// ===== Demo (single source of truth) =====
// near the top
const DEMO_CFG = {
  // LOWER = SLOWER
  speedPxPerSec: 320,  // was 520

  dwell: {
    atBank: 1100,           // was 650
    afterGrab: 500,         // was 280
    atShelfBeforeDrop: 900, // was 520
    afterCookie: 800,       // was 450
    atSlotBeforePlace: 900, // was 520
    afterPlace: 1100,       // was 650
    beforeExit: 600         // was 200
  },
  ease: 'quadInOut'
};


function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

const EASE = {
  linear: t => t,
  quadInOut: t => (t < .5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2),
  cubicInOut: t => (t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2),
};

let __demoRan = false;
let __demoRunning = false;
let __demoCancel = false;

function getDemoEnabled(){
  try {
    const v = localStorage.getItem('demoEnabled');
    if (v === null) {
      // default ON for desktop, OFF for touch
      const def = IS_TOUCH ? '0' : '1';
      localStorage.setItem('demoEnabled', def);
      return def === '1';
    }
    return v === '1';
  } catch { return !IS_TOUCH; }
}

function setDemoEnabled(on){
  try { localStorage.setItem('demoEnabled', on ? '1' : '0'); } catch {}
}

function ensureDemoHand(){
  let hand = document.getElementById('demoHand');
  if (!hand){
    hand = document.createElement('div');
    hand.id = 'demoHand';
    hand.className = 'hand hidden';
    document.body.appendChild(hand);
  }
  return hand;
}

// Wait 2 frames (layout-safe)
function nextFrame(){ return new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r))); }


// NOTE: If `carry` is already appended inside the hand, we DO NOT re-position it each frame.
function animHandTo(target, {
  speed = DEMO_CFG.speedPxPerSec,
  ease  = DEMO_CFG.ease,
  carry = null,
  carryOffset = { x: 8, y: 8 }
} = {}) {
  const hand = ensureDemoHand();
  const rect = (target && target.getBoundingClientRect) ? target.getBoundingClientRect() : null;
  const tx = rect ? (rect.left + rect.width/2) : (target && target.x);
  const ty = rect ? (rect.top  + rect.height/2) : (target && target.y);

  const hb = hand.getBoundingClientRect();
  let x0 = hb.width ? hb.left + hb.width/2 : -64;
  let y0 = hb.height ? hb.top  + hb.height/2 : (ty || window.innerHeight/2);

  hand.style.left = (x0 - 32) + 'px';
  hand.style.top  = (y0 - 32) + 'px';
  hand.classList.remove('hidden');

  const dx = tx - x0, dy = ty - y0;
  const dist = Math.hypot(dx, dy);
  const dur  = Math.max(500, Math.min(2200, (dist / Math.max(50, speed)) * 1000));
  const easeFn = (EASE[ease] || EASE.quadInOut);

  return new Promise(resolve=>{
    const t0 = performance.now();
    (function step(t){
      if (__demoCancel) return resolve();
      const k = Math.min(1, (t - t0) / dur);
      const e = easeFn(k);
      const x = x0 + dx * e;
      const y = y0 + dy * e;
      hand.style.left = (x - 12) + 'px';
      hand.style.top  = (y - 12) + 'px';
      if (carry && carry.parentNode !== hand){
        carry.style.position = 'fixed';
        carry.style.left = (x + carryOffset.x) + 'px';
        carry.style.top  = (y + carryOffset.y) + 'px';
        carry.style.pointerEvents = 'none';
      }
      if (k < 1) requestAnimationFrame(step); else resolve();
    })(t0);
  });
}

// Build a faux DataTransfer your handlers expect
function makeDT(text){
  return {
    getData: (type) => (type === 'text/plain' ? text : ''),
    setData: ()=>{}, clearData: ()=>{},
    effectAllowed: 'move',
    dropEffect: 'move',
    types: ['text/plain']
  };
}

// Fade helpers for demo cleanup
function __fadeAndRemove(node, ms=260){
  if(!node) return;
  try{
    node.style.transition = `opacity ${ms}ms ease`;
    // force a paint
    void node.offsetHeight;
    node.style.opacity = '0';
    setTimeout(()=>{ try{ node.remove(); }catch{} }, ms+40);
  }catch{}
}
function cancelDemoVisuals(){
  try{
    const hand = document.getElementById('demoHand');
    if(hand){ hand.classList.remove('closed'); __fadeAndRemove(hand, 320); }
    if(typeof __demoCarryClone !== 'undefined' && __demoCarryClone){ __fadeAndRemove(__demoCarryClone, 220); __demoCarryClone=null; }
    if(typeof __demoCookieNode !== 'undefined' && __demoCookieNode){ __fadeAndRemove(__demoCookieNode, 200); __demoCookieNode=null; }
    // any straggler demo cookies by class
    document.querySelectorAll('.demoCookie').forEach(n=>__fadeAndRemove(n,200));
  }catch{}
}

// --- BLOCK mobile long-press menus robustly (iOS + Android) ---
function ensureNoLongPressGuard(){
  // CSS: kill callouts & selection basically everywhere (except editables)
  if (!document.getElementById('__no_longpress_css__')){
    const st = document.createElement('style');
    st.id = '__no_longpress_css__';
    st.textContent = `
      /* Blanket: no callout / selection across the app */
      html, body,
      *:not(input):not(textarea):not([contenteditable]),
      *:not(input):not(textarea):not([contenteditable])::before,
      *:not(input):not(textarea):not([contenteditable])::after{
        -webkit-touch-callout: none !important;  /* iOS link/image menu */
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-tap-highlight-color: transparent;
      }

      /* Elements that can still trigger callouts on some builds */
      a, button { -webkit-touch-callout: none !important; }
      img { -webkit-user-drag: none !important; }

      /* Allow normal behavior where typing is expected */
      input, textarea, [contenteditable="true"], [contenteditable=""]{
        -webkit-touch-callout: default !important;
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-user-drag: auto !important;
      }

      /* Our interactive surfaces behave like buttons (no double-tap zoom) */
      #timeline, #shelf, #cookiePile, #timelineSection, .card, .cookieToken, .hand{
        touch-action: manipulation;
        -ms-touch-action: manipulation;
      }
    `;
    document.head.appendChild(st);
  }

  const isEditable = (el) =>
    !!el?.closest?.('input, textarea, [contenteditable="true"], [contenteditable=""]');

  // JS: cancel the context menu route (fires on both iOS & Android)
  const killCtx = (e) => { if (!isEditable(e.target)) e.preventDefault(); };
  window.addEventListener('contextmenu', killCtx, { capture: true });
  document.addEventListener('contextmenu', killCtx, { capture: true });

  // iOS: sometimes selection/gesture paths still trigger the callout
  const kill = (e) => { if (!isEditable(e.target)) e.preventDefault(); };
  document.addEventListener('selectstart',  kill, { capture: true });
  document.addEventListener('gesturestart', kill, { capture: true });

  // Android Chrome fallback: on some devices the long-press menu still sneaks in
  // if there’s *no* handler on the element. This captures it app-wide.
  document.body.oncontextmenu = (e) => (isEditable(e.target) ? true : false);
}



// Cancel handler: any tap/click or Esc interrupts the demo immediately
function enableDemoCancel(){
  __demoCancel = false;
  const onDown = (e)=>{ __demoCancel = true; e.preventDefault(); e.stopPropagation(); try{ cancelDemoVisuals(); }catch{} };
  const onKey  = (e)=>{ if (e.key === 'Escape'){ __demoCancel = true; e.preventDefault(); e.stopPropagation(); try{ cancelDemoVisuals(); }catch{} } };

  // capture so we beat other handlers; once so it auto-cleans
  document.addEventListener('pointerdown', onDown, {capture:true, once:true});
  document.addEventListener('keydown', onKey, {capture:true, once:true});

  // return disposer just in case
  return ()=>{
    try{ document.removeEventListener('pointerdown', onDown, {capture:true}); }catch{}
    try{ document.removeEventListener('keydown', onKey, {capture:true}); }catch{}
  };
}

function isParentLockOn(){
  try { return localStorage.getItem('parentLock') === '1'; } catch { return false; }
}

// ---- PREFERENCES PERSISTENCE (Parent Mode) ----
const PREFS_KEY = 'preferences_saved_v2';

function savePrefsIfParentMode() {
  // Only persist while Parent Mode is ON (your requirement)
  if (!state?.parentMode) return;

  const prefs = {
    // UI toggles
    demoEnabled: (typeof getDemoEnabled === 'function') ? getDemoEnabled() : true,
    parentLock:  (typeof isParentLockOn === 'function') ? isParentLockOn() : false,
    parentMode:  !!state.parentMode,

    // timing + cookies
    totalMins: state.totalMins,
    minutesPerCookie: (typeof cookieMinutes === 'function') ? cookieMinutes() : (state.cookieMin||5),

    // schedule + promotions
    cookieCounts: {...(state.cookie?.counts || {})},
    timeline: (state.timeline || []).map(e => e ? { id:e.id, type:e.type, fixed:!!e.fixed } : null),
    parentPromoted: state.parentPromoted || {}
  };

  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

function loadPrefs() {
  let raw = null;
  try { raw = localStorage.getItem(PREFS_KEY); } catch {}
  if (!raw) return;

  const p = JSON.parse(raw);

  // Re-apply toggles BEFORE demo auto-boot so it respects them
  if ('demoEnabled' in p && typeof setDemoEnabled === 'function') {
    setDemoEnabled(!!p.demoEnabled);
  }
  try { localStorage.setItem('parentLock', p.parentLock ? '1' : '0'); } catch {}

  // Core state
  if (Number.isFinite(p.totalMins)) state.totalMins = p.totalMins;
  if (Number.isFinite(p.minutesPerCookie)) state.cookieMin = p.minutesPerCookie;
  state.parentMode = !!p.parentMode;

  // Cookies / promotions
  state.cookie = state.cookie || {};
  state.cookie.counts = Object.assign(Object.create(null), p.cookieCounts || {});
  state.parentPromoted = p.parentPromoted || {};

  // Timeline
  if (Array.isArray(p.timeline)) {
    state.timeline = p.timeline.map(e => e ? { id:e.id, type:(e.type || (isParentId(e.id)?'parent':'elective')), fixed:!!e.fixed } : null);
  }

  rebuildBank && rebuildBank();
}


// helper: wait one paint
function nextFrame(){ return new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r))); }

// Attach a REAL cookie token to the hand at its actual on-screen size.
function attachDemoCookieToHand(){
  // make sure the hand exists (and stays top-most)
  ensureDemoHand();

  // clone real token if present, else build one at CSS size
  let token = document.querySelector('#cookiePile .cookieToken')?.cloneNode(true);
  if (!token){
    const css  = getComputedStyle(document.documentElement);
    const size = parseInt((css.getPropertyValue('--cookieTokenSize') || '26').trim(), 10) || 26;
    token = document.createElement('div');
    token.className = 'cookieToken';
    token.style.width  = size + 'px';
    token.style.height = size + 'px';
  }

  // IMPORTANT: sibling of the hand, not a child — so glove paints above it
  Object.assign(token.style, {
    position: 'fixed',
    left: '-9999px',
    top:  '-9999px',
    pointerEvents: 'none',
    zIndex: 2147482000,   // just below the hand (hand is 2147483647)
    transform: 'none'
  });
  token.classList.add('demoCookie');

  document.body.appendChild(token);
  try{ __demoCookieNode = token; }catch{}
  return token;
}


// drop-in replacement
function detachDemoCookie(token){
  try{
    if (token && token.remove) {
      token.remove();          // remove the exact node we created
    } else {
      document.querySelectorAll('.demoCookie').forEach(n => n.remove());
    }
  }catch{}
}

// pick a shelf card that is visible and currently has 0 cookies (fallback: any visible)
function pickShelfTargetWithZeroCookies(){
  const used = new Set((state.timeline || []).filter(Boolean).map(x => x.id));
  const src  = state.parentMode ? ALL : ELECTIVE;
  const zero = src.filter(it => !used.has(it.id) && ((state.cookie.counts[it.id] || 0) === 0));
  if (zero.length) return zero[Math.floor(Math.random() * zero.length)];
  const visible = src.filter(it => !used.has(it.id));
  return visible.length ? visible[Math.floor(Math.random() * visible.length)] : null;
}
function nextFrame(){ return new Promise(r => requestAnimationFrame(()=>r())); }

function ensureDemoHand(){
  let hand = document.getElementById('demoHand');
  if (!hand){
    hand = document.createElement('div');
    hand.id = 'demoHand';
    hand.className = 'hand hidden';
    document.body.appendChild(hand);
  }
  // always enforce top-most + inert on reuse
  hand.style.position = 'fixed';
  hand.style.pointerEvents = 'none';
  hand.style.zIndex = '2147483647'; // max-ish
  hand.style.willChange = 'left, top, opacity';
  hand.style.transform = 'translateZ(0)';
  return hand;
}



async function runOpeningDemo(){
  if (__demoRunning || __demoRan) return;
  __demoRunning = true;

  const hand = ensureDemoHand();
  try { primeAudio && primeAudio(); } catch {}

  const disposeCancel = enableDemoCancel && enableDemoCancel();

  try{
    // make sure UI is painted
    renderAll && renderAll();
    await nextFrame();

    // choose shelf target with zero cookies
    const pick  = pickShelfTargetWithZeroCookies && pickShelfTargetWithZeroCookies();
    const shelfId = pick && pick.id;
    const bankEl  = dom.cookiePile;
    if (!bankEl || !shelfId) throw new Error('demo: prerequisites missing');

    renderShelf && renderShelf();
    await nextFrame();
    let shelfCardEl = dom.shelf && dom.shelf.querySelector(`.shelfCard[data-id="${shelfId}"]`);
    if (!shelfCardEl) throw new Error('demo: shelf card not found');

    // If bank is empty, loan 1 so we can demonstrate
    if ((state.cookie.bank || 0) < 1){
      state.cookie.bank = 1;
      renderCookieBank && renderCookieBank();
      renderProgress && renderProgress();
      await nextFrame();
    }

    // Start hand near bank and go pick up a cookie
    const br = bankEl.getBoundingClientRect();
    hand.style.left = (-64) + 'px';
    hand.style.top  = (br.top + br.height/2 - 32) + 'px';
    hand.classList.remove('hidden');

    await animHandTo(bankEl);
    if (__demoCancel) return;
    await sleep(DEMO_CFG.dwell.atBank);
    hand.classList.add('closed');
    const heldCookie = attachDemoCookieToHand && attachDemoCookieToHand(); try{ __demoCookieNode = heldCookie; }catch{}
    await sleep(DEMO_CFG.dwell.afterGrab);
    if (__demoCancel) return;

    // → shelf card (cookie rides inside the hand)
    shelfCardEl = dom.shelf.querySelector(`.shelfCard[data-id="${shelfId}"]`) || shelfCardEl;
    // carry the cookie while moving to the shelf
    await animHandTo(shelfCardEl, {
      carry: heldCookie,
      carryOffset: { x: 8, y: 8 }  // tweak this to position the token relative to the hand
    });

    if (__demoCancel) return;
    await sleep(DEMO_CFG.dwell.atShelfBeforeDrop);

    // REAL drop on the shelf card, exactly like the user would
    await withDemoUnfrozen(async ()=>{
      fireDragOver(shelfCardEl);
      fireDrop(shelfCardEl, 'COOKIE_TOKEN');
    })

    // remove the visual cookie clone immediately
    detachDemoCookie(heldCookie);
    try{ __demoCookieNode = null; }catch{}

    // visual cookie leaves the hand
    detachDemoCookie && detachDemoCookie();

    // let UI update
    adjustSlotsForCookies && adjustSlotsForCookies();
    renderShelf && renderShelf();
    renderTimeline && renderTimeline();
    renderCookieBank && renderCookieBank();
    renderProgress && renderProgress();
    await nextFrame();
    await sleep(DEMO_CFG.dwell.afterCookie);
    if (__demoCancel) return;

    // Reacquire a DOM reference to the (now badged) shelf card
    shelfCardEl = dom.shelf.querySelector(`.shelfCard[data-id="${shelfId}"]`) || shelfCardEl;

    // Clone the card and place clone INSIDE the hand so it rides with it
    const carry = (function cloneForCarry(cardEl){
      const clone = cardEl.cloneNode(true);
      Object.assign(clone.style, {
        position: 'fixed',
        left: '-9999px',
        top:  '-9999px',
        width: cardEl.getBoundingClientRect().width + 'px',
        height: cardEl.getBoundingClientRect().height + 'px',
        pointerEvents: 'none',
        zIndex: 2147482000    // below the hand
      });
      document.body.appendChild(clone);
      return clone;
    })(shelfCardEl);

    try{ __demoCarryClone = carry; }catch{}
// Find the first open timeline slot (after re-render)
    await nextFrame();
    let targetIdx = state.timeline.findIndex(e => !e);
    if (targetIdx < 0){
      ensureSlots && ensureSlots((state.timeline || []).length + 1);
      renderTimeline && renderTimeline();
      await nextFrame();
      targetIdx = state.timeline.findIndex(e => !e);
    }
    const slotEl = dom.timeline.querySelector(`.slot[data-idx="${targetIdx}"]`);
    if (!slotEl) throw new Error('demo: open slot not found');

    // → carry card to that slot
    await animHandTo(slotEl, {
      carry,
      carryOffset: { x: -86, y: -80 }   // tweak to taste
    });
    if (__demoCancel) return;
    await sleep(DEMO_CFG.dwell.atSlotBeforePlace);
    // 1) Open the hand NOW (regular hand icon)…
    hand.classList.remove('closed');

    // …and at that exact moment, fade the carried card (the visual clone) out
    if (carry && carry.style) {
      carry.style.transition = 'opacity 200ms ease';
      // force a paint so the transition takes effect
      void carry.offsetHeight;
      carry.style.opacity = '0';
      // hard cleanup in case transitionend doesn't fire
      const removeCarry = () => { try { carry.remove(); } catch {} };
      carry.addEventListener('transitionend', removeCarry, { once: true });
      setTimeout(removeCarry, 260);
    }

    // 2) Half a second later, perform the real drop so app state updates
    await sleep(500);
    await withDemoUnfrozen(async ()=>{
      fireDragOver && fireDragOver(slotEl);
      fireDrop && fireDrop(slotEl, JSON.stringify({ src:'shelf', id: shelfId }));
    });

    // Standard re-render + dwell
    renderTimeline && renderTimeline();
    renderProgress && renderProgress();
    ensureMarqueeCycle && ensureMarqueeCycle();
    await nextFrame();
    await sleep(DEMO_CFG.dwell.afterPlace);

    // 3) Finally, slow fade the hand away, then mark demo as done for this load
    hand.style.transition = 'opacity 900ms ease';
    hand.style.opacity = '0';
    setTimeout(() => {
      hand.classList.add('hidden');
      hand.style.transition = '';
      hand.style.opacity = '';
    }, 920);

    __demoRan = true;  // <- demo plays once until the user refreshes

  } catch (e){
    try { DBG && DBG.warn && DBG.warn('demo aborted:', e.message); } catch {}
  } finally {
    try { disposeCancel && disposeCancel(); } catch {}
    __demoRunning = false;
  }
}



// Temporarily unfreeze so your normal handlers can run
async function withDemoUnfrozen(fn){
  const wasMode = state.mode;
  const hadFrozen = document.documentElement.classList.contains('frozen');
  state.mode = 'editing';
  document.documentElement.classList.remove('frozen');
  try { return await fn(); }
  finally {
    state.mode = wasMode;
    if (hadFrozen) document.documentElement.classList.add('frozen');
  }
}

// Build a faux DataTransfer your handlers expect (text/plain only)
function makeDT(text){
  return {
    getData: (type) => (type === 'text/plain' ? text : ''),
    setData: ()=>{}, clearData: ()=>{},
    effectAllowed: 'move',
    dropEffect: 'move',
    types: ['text/plain']
  };
}
function fireDragOver(target){
  const ev = new Event('dragover', { bubbles:true, cancelable:true });
  Object.defineProperty(ev, 'dataTransfer', { value: makeDT('') });
  target.dispatchEvent(ev);
}
function fireDrop(target, text){
  const ev = new Event('drop', { bubbles:true, cancelable:true });
  Object.defineProperty(ev, 'dataTransfer', { value: makeDT(text) });
  target.dispatchEvent(ev);
}

// Persisted Demo Toggle (re-use your pill button)
(function wireDemoToggle(){
  if (!dom || !dom.demoToggle) return;
  const enabled = getDemoEnabled();
  dom.demoToggle.setAttribute('aria-pressed', String(enabled));
  if (dom.demoState) dom.demoState.textContent = enabled ? 'ON' : 'OFF';

  dom.demoToggle.addEventListener('click', ()=>{
    const next = !(dom.demoToggle.getAttribute('aria-pressed') === 'true');
    dom.demoToggle.setAttribute('aria-pressed', String(next));
    if (dom.demoState) dom.demoState.textContent = next ? 'ON' : 'OFF';
    setDemoEnabled(next);
  });
})();



  (function wireParentExtraToggles(){
  if (!dom) return;

  // Reflect persisted Demo state only; clicks are owned by wireDemoToggle()
  if (dom.demoToggle){
    const saved = (localStorage.getItem('demoEnabled') ?? '1') === '1';
    dom.demoToggle.setAttribute('aria-pressed', String(saved));
    if (dom.demoState) dom.demoState.textContent = saved ? 'ON' : 'OFF';
  }

  // Parent lock pill remains self-contained
  if (dom.parentLockToggle){
    dom.parentLockToggle.addEventListener('click', ()=>{
      const pressed = dom.parentLockToggle.getAttribute('aria-pressed') === 'true';
      const next = !pressed;
      dom.parentLockToggle.setAttribute('aria-pressed', String(next));
      if (dom.lockState) dom.lockState.textContent = next ? 'ON' : 'OFF';
      try { localStorage.setItem('parentLock', next ? '1' : '0'); } catch {}
    });
    const lockSaved = (localStorage.getItem('parentLock') === '1');
    dom.parentLockToggle.setAttribute('aria-pressed', String(lockSaved));
    if (dom.lockState) dom.lockState.textContent = lockSaved ? 'ON' : 'OFF';
  }
})();

  if (!dom.timeline || !dom.shelf || !dom.goBtn){
    throw new Error('Required DOM is missing');
  }

  
  // -------- Utils --------
  const U = {
    minutesFor(id){ return (state.cookie.counts[id]||0) * cookieMinutes(); },
    totalAccounted(){ return (state.timeline||[]).reduce((m,e)=> m + (e?U.minutesFor(e.id):0), 0); },
    iconClass(id){ const map = Object.fromEntries(ALL.map(x=>[x.id, x.icon])); return 'fa-solid ' + (map[id] || 'fa-star') + ' ico-' + id; },
    label(id){ const map = Object.fromEntries(ALL.map(x=>[x.id, x.label])); return map[id] || id; },
    summary(){
      const filled = state.timeline.filter(Boolean).length;
      return `mode=${state.mode} • parent=${state.parentMode?'on':'off'} • total=${state.totalMins} • slots=${state.timeline.length} • filled=${filled} • bank=${state.cookie.bank}`;
    }
  };
  // --- Freeze helpers ---
  // TOP LEVEL (not inside startCardTouchDrag or any other function)
  function isFrozen(){ return state.mode !== 'editing'; }   // 'editing' | 'running' | 'done'

  function freezeUI(){
    state.mode = 'running';
    document.documentElement.classList.add('frozen');
    bus.emit('state');
  }

  function finishUI(){
    state.mode = 'done';
    document.documentElement.classList.add('frozen');
    bus.emit('state');
  }


  function wireCookieMinControls(){
  if (!dom) return;
  ensureCookieSliderTickCss();

  // If the slider block isn't in the DOM yet, safely no-op.
  if (!dom.cookieMinWrap) return;

  // Keep block visible only in Parent Mode
  const syncVisibility = () => {
    dom.cookieMinWrap.classList.toggle('hidden', !state.parentMode);
  };
  syncVisibility();
  bus.on('state', syncVisibility);

  // helpers
  const clamp5 = v => Math.max(5, Math.min(60, Math.round(v / 5) * 5));
  const floor5 = v => Math.max(5, Math.floor(v / 5) * 5);

  function computeCookieMax(){
    // Max minutes-per-cookie such that current allocated cookies fill <= totalMins
    let allocated = 0;
    try{
      const counts = state && state.cookie && state.cookie.counts || {};
      for (const k in counts){ allocated += (counts[k]||0); }
    }catch{}
    if (allocated <= 0) return 60; // no cookies yet -> allow full range
    const raw = Math.floor((state.totalMins || 0) / allocated);
    return Math.max(5, Math.min(60, floor5(raw)));
  }

  function refreshLimitsAndTicks(){
    if (!dom.cookieMinRange) return;
    const max = computeCookieMax();
    dom.cookieMinRange.max = String(max);

    // Clamp current value to max if needed (and persist)
    const cur = Number(dom.cookieMinRange.value || cookieMinutes() || 5);
    if (cur > max){
      dom.cookieMinRange.value = String(max);
      if (state.cookieMin !== max){
        state.cookieMin = max;
        try { localStorage.setItem('cookieMin', String(max)); } catch {}
        rebuildBank(); renderCookieBank(); renderTimeline(); renderProgress();
      }
    }

    // Update ticks: step-px depends on width and step
    try{
      const min = Number(dom.cookieMinRange.min || 5);
      const step = Number(dom.cookieMinRange.step || 5);
      const w = dom.cookieMinRange.clientWidth || dom.cookieMinRange.getBoundingClientRect().width || 0;
      const span = Math.max(1, (max - min));
      const stepPx = w * (step / span);
      dom.cookieMinRange.style.setProperty('--tick-step', stepPx + 'px');
    }catch{}
  }

  // Initialize slider/value to current minutes-per-cookie
  if (dom.cookieMinRange) {
    dom.cookieMinRange.value = String(cookieMinutes());
    if (dom.cookieMinValue) dom.cookieMinValue.textContent = dom.cookieMinRange.value;

    dom.cookieMinRange.addEventListener('input', (e) => {
      const v = clamp5(parseInt(e.target.value || '5', 10));
      if (state.cookieMin !== v) {
        state.cookieMin = v;
        try { localStorage.setItem('cookieMin', String(v)); } catch {}
        if (dom.cookieMinValue) dom.cookieMinValue.textContent = String(v);

        // Recalculate cookie bank to keep total-minutes consistent
        const used = (state.timeline || []).reduce((m, entry) => {
          if (!entry) return m;
          const c = state.cookie.counts[entry.id] || 0;
          return m + c * cookieMinutes();
        }, 0);
        const remaining = Math.max(0, state.totalMins - used);
        state.cookie.bank = Math.max(0, Math.floor(remaining / cookieMinutes()));

        // Re-render affected areas
        renderCookieBank();
        renderTimeline();
        renderProgress();
      }
      // live-refresh ticks in case thumb/width changed
      refreshLimitsAndTicks();
    });
  }

  // Keep limits/ticks in sync with app state & window size
  bus.on('state', refreshLimitsAndTicks);
  window.addEventListener('resize', () => { refreshLimitsAndTicks(); }, { passive:true });

  // First draw
  refreshLimitsAndTicks();
}
function cookieMinutes(){ return Number(state.cookieMin) || 5; }

  // Detect touch/coarse pointers
  const IS_TOUCH = window.matchMedia?.('(pointer: coarse)')?.matches || 'ontouchstart' in window;

function startCardTouchDrag(cardEl, payload, downEvent){
  if (typeof isFrozen === 'function' && isFrozen()) return;
  // ignore taps on built-in controls
  if (downEvent.target.closest && downEvent.target.closest('.remove, .minus, button')) return;

  downEvent.preventDefault();


  // floating clone that follows the finger (inline styles so no CSS dependency)
  const ghost = cardEl.cloneNode(true);
  Object.assign(ghost.style, {
    position: 'fixed',
    pointerEvents: 'none',
    opacity: '.9',
    transform: 'scale(1.04)',
    zIndex: '2147482000',
    width: cardEl.getBoundingClientRect().width + 'px',
    height: cardEl.getBoundingClientRect().height + 'px'
  });
  document.body.appendChild(ghost);
  document.body.classList.add('dragging');

  const r = cardEl.getBoundingClientRect();
  let lastHot = null;

  const move = (e) => {
    const x = e.clientX, y = e.clientY;
    ghost.style.left = (x - r.width/2) + 'px';
    ghost.style.top  = (y - r.height/2) + 'px';

    // highlight slot under finger
    const target = document.elementFromPoint(x, y);
    const slot = target && target.closest && target.closest('.slot');
    if (slot !== lastHot){
      if (lastHot) lastHot.classList.remove('hot');
      if (slot)    slot.classList.add('hot');
      lastHot = slot;
    }
  };

  const end = (e) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);

    try { ghost.remove(); } catch {}
    document.body.classList.remove('dragging');
    if (lastHot){ lastHot.classList.remove('hot'); lastHot = null; }

    const x = e.clientX, y = e.clientY;
    const target = document.elementFromPoint(x, y);
    const slot = target && target.closest && target.closest('.slot');
    const toIdx = slot ? parseInt(slot.dataset.idx, 10) : NaN;
    if (!Number.isFinite(toIdx)) return;

    const from = payload && payload.from; // 'shelf' | 'timeline'

    if (from === 'timeline'){
      const fromIdx = Number.isFinite(payload.idx) ? payload.idx : -1;
      if (fromIdx !== -1 && fromIdx !== toIdx && typeof reorderTimeline === 'function'){
        reorderTimeline(fromIdx, toIdx);
      }
      return;
    }

    if (from === 'shelf'){
      const id = cardEl.dataset.id;
      if (!id) return;

      // respect your rule: electives need >=1 cookie when not in parent mode
      if (!state.parentMode && (state.cookie.counts[id] || 0) < 1) return;

      const beforeId = (state.timeline[toIdx] && state.timeline[toIdx].id) || null;
      if (typeof addCardToSlot === 'function') addCardToSlot({ id }, toIdx);
      const afterId  = (state.timeline[toIdx] && state.timeline[toIdx].id) || null;

      // optional: book-place SFX on successful shelf -> timeline drop
      if (afterId === id && afterId !== beforeId && typeof playBookPlaceSfx === 'function'){
        playBookPlaceSfx();
      }
      return;
    }
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', end, { once:true });
  document.addEventListener('pointercancel', end, { once:true });

  // start immediately
  move(downEvent);
}

// Track touch-only cookie drag
let __touchDrag = null;

function startCookieTouchDrag(tokenEl, downEvent){
  if (typeof isFrozen === 'function' && isFrozen()) return;
  downEvent.preventDefault();

  const ghost = tokenEl.cloneNode(true);
  ghost.classList.add('dragGhost');
  const r = tokenEl.getBoundingClientRect();
  ghost.style.width = r.width + 'px';
  ghost.style.height = r.height + 'px';
  document.body.appendChild(ghost);
  document.body.classList.add('dragging');

  let lastHover = null;

  const move = (e) => {
    const x=e.clientX, y=e.clientY;
    ghost.style.left = (x - r.width/2) + 'px';
    ghost.style.top  = (y - r.height/2) + 'px';

    const target = document.elementFromPoint(x,y);
    const host = target && target.closest('.shelfCard, .card');
    if (host !== lastHover){
      if (lastHover){ lastHover.classList.remove('cookieHover','cookieReady'); }
      if (host){ host.classList.add('cookieHover','cookieReady'); }
      lastHover = host;
    }
  };

  const end = (e) => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);

    try{ ghost.remove(); }catch{}
    document.body.classList.remove('dragging');

    const x=e.clientX, y=e.clientY;
    const target = document.elementFromPoint(x,y);
    const host = target && target.closest('.shelfCard, .card');
    if (host){
      const id = host.dataset.id;
      if (id && typeof allocateCookieTo === 'function'){
        const before = (state.cookie.counts[id] || 0);
        allocateCookieTo(id, +1);
        const after  = (state.cookie.counts[id] || 0);

        // SFX only when dropped on SHELF and count actually increased
        if (after > before && typeof playCookieSfx === 'function'){
          playCookieSfx();
        }
      }
      host.classList.remove('cookieHover','cookieReady');
    }
  };

  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', end, { once:true });
  document.addEventListener('pointercancel', end, { once:true });

  move(downEvent);
  __touchDrag = { ghost };
}



  // --- Alarm playback ---
  const ALARM_URL = 'audio/Magic_alarm_sound.wav'; // relative path in your project

  function playSoundNTimes(url = ALARM_URL, times = 10, { volume = 1.0, gapMs = 60 } = {}){
    let count = 0;
    const a = new Audio(url);
    a.preload = 'auto';
    a.volume = Math.max(0, Math.min(1, volume));
    a.loop = false;

    const playNext = () => {
      if (count >= times) { a.removeEventListener('ended', onEnded); return; }
      count++;
      a.currentTime = 0;
      // start; if it fails (autoplay policy), it will be because we didn't prime—see primeAudio() below
      a.play().catch(()=>{ /* ignore; we prime before GO */ });
    };

    const onEnded = () => {
      if (gapMs > 0) setTimeout(playNext, gapMs);
      else playNext();
    };

    a.addEventListener('ended', onEnded);
    playNext();
    return a; // return in case you want to stop it externally
  }



// --- Responsive knobs for icon/label/badge tied to cell width
function applyResponsiveVars(container, cellMinWidth){
  try{
    const icon = Math.max(84, Math.min(120, Math.round(cellMinWidth * 0.72)));
    const label = Math.max(12, Math.min(16, Math.round(cellMinWidth * 0.12)));
    const badgeScale = Math.max(0.82, Math.min(1.0, icon / 120));
    const badgeOffset = Math.round(icon * 0.14);
    container.style.setProperty('--iconSize',  icon + 'px');
    container.style.setProperty('--labelSize', label + 'px');
    container.style.setProperty('--badgeScale', String(badgeScale));
    container.style.setProperty('--badgeTop',   (-badgeOffset) + 'px');
    container.style.setProperty('--badgeRight', (-badgeOffset) + 'px');
  }catch{}
}


// Ready to GO when there are NO cookies left in the bank
function canGoNow(){ return state.cookie && state.cookie.bank === 0 && allTimelineSlotsFilled(); }

function shouldShowOpenMarquee(idx){
  const empty = !state.timeline[idx];
  if (!empty) return false;
  if (state.parentMode) return true;       // Parent Mode: always hint
  return !canGoNow();
}



function ensureMarqueeCycle(){
  // Clear any previous focus/pulse
  dom.timeline.querySelectorAll('.slot.focus').forEach(n => n.classList.remove('focus'));
  dom.timeline.querySelectorAll('.slot.pulse').forEach(n => n.classList.remove('pulse'));

  const openNow = Array.from(dom.timeline.querySelectorAll('.slot.open'));

  // 0 open → stop everything
  if (openNow.length === 0){
    if (__marqTimer){ clearInterval(__marqTimer); __marqTimer = null; }
    __marqLastIdx = -1;
    return;
  }

  // 1 open → no timer; give that one a pulsing emphasis
  if (openNow.length === 1){
    if (__marqTimer){ clearInterval(__marqTimer); __marqTimer = null; }
    const only = openNow[0];
    only.classList.add('pulse');     // CSS will animate the pulse
    only.classList.add('focus');     // optional: stronger ring while pulsing
    __marqLastIdx = 0;
    return;
  }

  // 2+ open → ping-pong focus back and forth
  if (__marqTimer){ clearInterval(__marqTimer); __marqTimer = null; }

  const base = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 2200 : 1200;
  let dir = 1;                                 // 1 forward, -1 backward
  let idx = Math.max(0, __marqLastIdx);        // resume from last, or 0

  function tick(){
    const open = Array.from(dom.timeline.querySelectorAll('.slot.open'));
    if (open.length < 2){
      // Fall back to 0/1-open cases
      dom.timeline.querySelectorAll('.slot.focus').forEach(n => n.classList.remove('focus'));
      dom.timeline.querySelectorAll('.slot.pulse').forEach(n => n.classList.remove('pulse'));
      if (__marqTimer){ clearInterval(__marqTimer); __marqTimer = null; }
      if (open.length === 1){ open[0].classList.add('pulse'); open[0].classList.add('focus'); __marqLastIdx = 0; }
      else { __marqLastIdx = -1; }
      return;
    }

    if (idx >= open.length) idx = open.length - 1;
    if (idx < 0) idx = 0;

    // Apply focus to current; remove everywhere else
    dom.timeline.querySelectorAll('.slot.focus').forEach(n => n.classList.remove('focus'));
    dom.timeline.querySelectorAll('.slot.pulse').forEach(n => n.classList.remove('pulse'));
    open[idx].classList.add('focus');

    __marqLastIdx = idx;

    // Advance ping-pong
    idx += dir;
    if (idx >= open.length - 1){ idx = open.length - 1; dir = -1; }
    else if (idx <= 0){ idx = 0; dir = 1; }
  }

  tick(); // start immediately
  __marqTimer = setInterval(tick, base);
}


function allTimelineSlotsFilled(){
  // every slot must be occupied (no nulls)
  return state.timeline.length > 0 && state.timeline.every(Boolean);
}

// ---- Cookie drag/drop helper ----
// --- SFX: book placed on the timeline ---
const BOOK_PLACE_SFX_URL = 'audio/place_book.wav';

// Create a fresh Audio each time so overlapping drops don't cut off
function playBookPlaceSfx(){
  try {
    const a = new Audio(BOOK_PLACE_SFX_URL);
    a.preload = 'auto';
    a.volume = 0.95;      // tweak loudness
    a.play().catch(()=>{}); // will succeed if you've primed audio once
  } catch {}
}

// --- UI SFX (cookie on shelf) ---
const COOKIE_SFX_URL = (typeof asset === 'function'
  ? asset('audio/magic_twinkle.mp3')
  : 'audio/magic_twinkle.mp3');

function playCookieSfx(){
  try{ const a=new Audio(COOKIE_SFX_URL); a.preload='auto'; a.volume=0.95; a.play().catch(()=>{}); }catch{}
}

// Autoplay primer: run once in any user gesture so later .play() always works
let __audioPrimed=false;
function primeAudio(){
  if(__audioPrimed) return;
  const s=new Audio(); s.muted=true;
  s.play().catch(()=>{}).finally(()=>{ try{s.pause();s.remove();}catch{} __audioPrimed=true; });
}
document.addEventListener('pointerdown', primeAudio, { once:true });

// Play a short UI sound; creates a fresh Audio each time so notes don't cut off
function playCookieSfx(){
  try {
    const a = new Audio(COOKIE_SFX_URL);
    a.preload = 'auto';
    a.volume = 0.95;
    a.play().catch(()=>{ /* silently ignore if blocked */ });
  } catch {}
}

// REPLACE your existing enableCookieDrop with this version
function enableCookieDrop(el, id){
  if (!el) return;

  // Drag over: show ready state and keep cursor feedback stable
  el.addEventListener('dragover', (e) => {
    if (typeof isFrozen === 'function' && isFrozen()) return;
    try {
      if (e.dataTransfer) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move'; // consistent visual feedback
      }
    } catch {}
    el.classList.add('cookieReady');
    el.classList.add('cookieHover'); // force wand cursor on nested children
  });

  // Leave: clear hover markers
  el.addEventListener('dragleave', () => {
    el.classList.remove('cookieReady');
    el.classList.remove('cookieHover');
  });

  // Drop: handle cookie token → add 1, optionally play shelf SFX
  el.addEventListener('drop', (e) => {
    if (typeof isFrozen === 'function' && isFrozen()) return;
    try { e.preventDefault(); } catch {}
    el.classList.remove('cookieReady');
    el.classList.remove('cookieHover');

    let tag = '';
    try { tag = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || ''; } catch {}

    if (tag === 'COOKIE_TOKEN'){
      // Identify shelf targets only
      const isShelf = el.classList.contains('shelfCard') || !!el.closest?.('#shelf');

      // Only play if allocation actually succeeded (bank/limits can block)
      const before = (state && state.cookie && state.cookie.counts && state.cookie.counts[id]) || 0;
      if (typeof allocateCookieTo === 'function') allocateCookieTo(id, +1);
      const after  = (state && state.cookie && state.cookie.counts && state.cookie.counts[id]) || 0;

      if (isShelf && after > before){
        // Play twinkle for shelf drops only (helper defined elsewhere)
        if (typeof playCookieSfx === 'function') playCookieSfx();
      }
    }
  });
}

  function ensureCookieStore(){
    if (!state.cookie) state.cookie = {};
    if (!state.cookie.counts || typeof state.cookie.counts !== 'object'){
      state.cookie.counts = Object.create(null);
    }
  }
  function allActivities(){ return ALL.slice(); }

  // -------- Actions --------

// ---- Initial parent setup: 3 cookies each, parents visible on the right ----
function initParentsWithCookies(){
  const BOOT_KEY = 'NTAP_FIRST_BOOT_DONE';
  ensureCookieStore();

  let firstBoot = false;
  try { firstBoot = !localStorage.getItem(BOOT_KEY); } catch { firstBoot = true; }

  // also seed if we have no timeline content AND no cookie counts persisted
  const noTimeline = !(state.timeline || []).some(Boolean);
  const noCookies  = !Object.values(state.cookie.counts || {}).some(v => (v|0) > 0);
  const needSeed   = firstBoot || (noTimeline && noCookies);

  if (needSeed){
    for (const p of PARENTS){
      if (state.cookie.counts[p.id] == null) state.cookie.counts[p.id] = 3;
    }
    rebuildBank();

    state.timeline = [];
    ensureSlots(2);
    state.timeline[0] = { type:'parent', id:PARENTS[0].id, fixed:true };
    state.timeline[1] = { type:'parent', id:PARENTS[1].id, fixed:true };

    try { localStorage.setItem(BOOT_KEY, '1'); } catch {}
  } else {
    rebuildBank();
  }
}

// ---- Slot sizing based on cookies, anchored parents, and promoted parents ----
function desiredSlotCount(){
  // Slots exist ONLY for activities that currently have cookies (>0).
  // No special-casing for parents or promotions.
  ensureCookieStore();
  const ids = new Set();
  for (const a of ALL){
    if ((state.cookie.counts[a.id] || 0) > 0) ids.add(a.id);
  }
  return ids.size;
}


// REPLACE: anchorParentsRight  (preserves existing indices; no left-packing)
function anchorParentsRight(){
  // No-op: do NOT force the two required parents back onto the timeline.
  // Removal in Parent Mode should keep them off the timeline until cookies are assigned again.
  return;
}

// NEW — move a placed card to a new timeline position (Excel-style column reorder)
function reorderTimeline(fromIdx, toIdx){
  if (isFrozen()) return;
  if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx) || fromIdx === toIdx) return;

  const src = state.timeline[fromIdx];
  const dst = state.timeline[toIdx] || null;   // may be empty
  if (!src) return;

  const isParentLike = e => e && (typeof isParentId === 'function' ? isParentId(e.id) : false);
  const lockOn = (typeof isParentLockOn === 'function') ? isParentLockOn() : true;

  // When Parent-Lock is OFF, parents can move anywhere (swap or into empty).
  // When Parent-Lock is ON, parents may swap with an occupied slot, but cannot move into an empty slot.
  if (!dst){
    if (lockOn && isParentLike(src)) return;    // locked: no move into empty
    state.timeline[toIdx]   = src;              // move
    state.timeline[fromIdx] = null;
  } else {
    // swap always allowed
    state.timeline[fromIdx] = dst;
    state.timeline[toIdx]   = src;
  }

  stamp && stamp('reorder', { from: fromIdx, to: toIdx, src: src.id, dst: dst && dst.id });
  bus && bus.emit && bus.emit('state');
}



// Position-preserving: do NOT left-pack; keep cards where the user placed them.
function adjustSlotsForCookies(){
  ensureCookieStore();

  // 1) Clear any entries that no longer have cookies, IN PLACE (no reordering)
  for (let i = 0; i < state.timeline.length; i++){
    const e = state.timeline[i];
    if (e && ((state.cookie.counts[e.id] || 0) <= 0)) {
      state.timeline[i] = null;
    }
  }

  // 2) Desired count = number of activities with cookies (>0)
  const want = desiredSlotCount();

  // 3) Compute the last occupied index (after clearing)
  let lastIdx = -1;
  for (let i = state.timeline.length - 1; i >= 0; i--){
    if (state.timeline[i]) { lastIdx = i; break; }
  }

  // 4) New length should preserve positions:
  //    - at least 'want' (so we have room for all cookie-bearing cards)
  //    - at least last occupied index + 1 (so placed cards don't shift)
  const newLen = Math.max(want, lastIdx + 1, 0);

  // 5) Resize without moving elements
  if (state.timeline.length < newLen){
    // grow with nulls
    state.timeline = state.timeline.concat(new Array(newLen - state.timeline.length).fill(null));
  } else if (state.timeline.length > newLen){
    // shrink only trailing nulls beyond newLen
    state.timeline.length = newLen;
  }
}


// NEW: promotion store + helpers
function ensurePromotionStore(){
  if (!state.parentPromoted || typeof state.parentPromoted !== 'object'){
    state.parentPromoted = Object.create(null);
  }
}

// NEW: centralized hard reset used by both the debug dock and refresh-detect
function hardReset(){
  try { localStorage.clear(); } catch(_){}
  try { sessionStorage.setItem('__HARD_RESET_ONCE__', '1'); } catch(_){}
  location.reload();
}

function isRequiredParentId(id){ return PARENTS.some(p => p.id === id); }
function isPromotedParentId(id){ return !!(state.parentPromoted && state.parentPromoted[id]); }
function isParentId(id){
  // Treat as parent if it's a required parent OR it has been promoted while in Parent Mode
  // (If you also have PARENT_EXTRA defined, promotion still governs locking/behavior)
  return isRequiredParentId(id) || isPromotedParentId(id);
}

  const A = DBG && DBG.channel ? DBG.channel('actions') : console;

  function setTotalMinutes(v){
    state.totalMins = Math.max(0, parseInt(v,10)||0);
    rebuildBank();
    stamp('setTotalMinutes', {v: state.totalMins});
    bus.emit('state');
  }
  function toggleParentMode(){
    state.parentMode = !state.parentMode;
    if (dom.parentState) dom.parentState.textContent = state.parentMode ? 'ON' : 'OFF';
    if (dom.parentToggle) dom.parentToggle.setAttribute('aria-pressed', String(state.parentMode));

    if (dom.durationWrap)     dom.durationWrap.classList.toggle('hidden', !state.parentMode);
    if (dom.parentExtrasWrap) dom.parentExtrasWrap.classList.toggle('hidden', !state.parentMode);
    if (dom.cookieMinWrap) dom.cookieMinWrap.classList.toggle('hidden', !state.parentMode);
    if (state.parentMode){
      ensureParentsRight();
      PARENTS.forEach(p=>{ if (state.cookie.counts[p.id] == null) state.cookie.counts[p.id] = Math.min(3, state.cookie.bank); });
      rebuildBank();
    }
    stamp('toggleParentMode', {on: state.parentMode});
    bus.emit('state');
  }
  function ensureParentsRight(){
    // No-op: do NOT auto-insert parents when toggling Parent Mode.
    return;
  }

  // UPDATED: addCardToSlot — promote on placement in Parent Mode
  function addCardToSlot(entry, idx){
    if (isFrozen()) return;
    ensurePromotionStore();
    ensureSlots(Math.max(idx+1, state.timeline.length));

    const id = entry.id;
    if (!state.parentMode && (state.cookie.counts[id]||0) < 1) return;

    // If Parent Mode is ON, anything placed becomes a parent (until removed)
    const promoteNow = !!state.parentMode && !isRequiredParentId(id);
    if (promoteNow) state.parentPromoted[id] = true;

    const willBeParent = isParentId(id) || !!state.parentMode;
    const item = {
      type: willBeParent ? 'parent' : 'elective',
      id,
      // Fixed means: cannot be removed/moved when Parent Mode is OFF.
      // Required parents are always fixed; promoted parents are fixed until removed.
      fixed: willBeParent
    };

    const existing = state.timeline[idx];
    if (existing && existing.fixed && !state.parentMode) return;

    state.timeline[idx] = item;
    stamp('addCard', {id, idx});
    bus.emit('state');
  }

  // UPDATED: removeCardAt — clear promotion flag when you remove a promoted parent
  function removeCardAt(idx){
    if (isFrozen()) return;
    ensurePromotionStore();
    const item = state.timeline[idx];
    if (!item) return;

    // Parent cards are removable in Parent Mode; locked otherwise.
    const isParentLike = isParentId(item.id);
    if (!state.parentMode && isParentLike) return;

    // Return ALL cookies to the bank for THIS card only
    const had = state.cookie.counts[item.id] || 0;
    if (had > 0) state.cookie.counts[item.id] = 0;

    // If this was a promoted parent (not one of the two canonical parents), clear that promotion
    if (item.type === 'parent' && !isRequiredParentId(item.id)) {
      delete state.parentPromoted[item.id];
    }

    // Remove JUST this card from the timeline
    state.timeline[idx] = null;

    // Recompute bank/slots strictly from cookie-bearing cards
    rebuildBank();
    bus.emit('state');
  }


  // UPDATED: allocateCookieTo — lock cookie edits for anything treated as parent when Parent Mode is OFF
  function allocateCookieTo(id, delta){
    if (isFrozen()) return;
    ensurePromotionStore();

    // Parent-like cards (required or promoted) are locked when Parent Mode is OFF
    const parentLike = isParentId(id);
    if (!state.parentMode && parentLike) return;

    // Bounds & bank checks
    if (delta > 0 && state.cookie.bank < delta) return;
    const cur = state.cookie.counts[id] || 0;
    const next = cur + delta;
    if (next < 0) return;

    // Apply cookie change
    state.cookie.counts[id] = next;

    // If cookies for this activity drop to zero, remove any instance from the timeline
    if (next === 0){
      for (let i = 0; i < state.timeline.length; i++){
        const e = state.timeline[i];
        if (e && e.id === id){
          state.timeline[i] = null;
          break;
        }
      }
    }

    // If this activity just gained its FIRST cookie:
    // - Electives always create a new timeline slot
    // - Parent cards (required or extras) also create a slot, but only when Parent Mode is ON
    if (cur === 0 && next > 0){
      if (!parentLike || (parentLike && state.parentMode)){
        const want = desiredSlotCount();  // counts all activities with cookies > 0
        ensureSlots(want);                // grow timeline to reflect the new cookie-bearing card
      }
    }

    // Recompute bank from authoritative totals and sanitize counts
    rebuildBank();

    stamp('cookie', { id, delta, next });
    bus.emit('state');
  }

  function addCookiesByName(name, delta){
    const act = ALL.find(a=>a.id===name || a.label===name);
    if (!act){ DBG && DBG.warn && DBG.warn('addCookiesByName: not found', name); return; }
    allocateCookieTo(act.id, delta||0);
  }

  // Give +1 cookie to each VISIBLE shelf card, respecting Parent Mode and the bank.
  function addCookiesToVisibleShelf() {
    ensureCookieStore();

    // What’s visible on the shelf right now?
    const used = new Set((state.timeline || []).filter(Boolean).map(x => x.id));
    const visible = (state.parentMode ? ALL : ELECTIVE).filter(it => !used.has(it.id));

    // One pass: add 1 cookie to each visible item, but stop if the bank hits 0.
    for (const it of visible) {
      if ((state.cookie.bank || 0) < 1) break;       // bank guard
      allocateCookieTo(it.id, +1);                   // allocateCookieTo already enforces bank bounds
    }
  }


  function addCookiesAll(delta){
    ensureCookieStore();
    for (const a of ALL){
      const id = a.id;
      const cur = state.cookie.counts[id]||0;
      const next = Math.max(0, cur + (delta||0));
      // Respect parent locking when not in parent mode
      const isParent = PARENTS.some(p=>p.id===id);
      if (!state.parentMode && isParent) continue;
      state.cookie.counts[id] = next;
    }
    rebuildBank();
    bus.emit('state');
    DBG && DBG.ok && DBG.ok('cookies bulk', JSON.stringify({delta, size: ALL.length}));
  }
  function inspectActivities(){
    ensureCookieStore();
    const rows = ALL.map(a=>({id:a.id, name:a.label, cookies: state.cookie.counts[a.id]||0}));
    DBG && DBG.log && DBG.log('[inspect] activities', JSON.stringify(rows));
  }

  function ensureSlots(n){
    if (state.timeline.length >= n) return;
    state.timeline = state.timeline.concat(new Array(n - state.timeline.length).fill(null));
  }
  function rebuildBank(){
    ensureCookieStore();

    // sanitize counts to known activity IDs
    const valid = new Set(ALL.map(a=>a.id));
    for (const k of Object.keys(state.cookie.counts)){
      const v = state.cookie.counts[k];
      if (!valid.has(k) || !Number.isFinite(v) || v < 0){
        delete state.cookie.counts[k];
      }
    }

    // bank = floor(totalMinutes / minutesPerCookie) - sum(allocated cookies)
    const total = Math.floor((state.totalMins || 0) / cookieMinutes());
    let used = 0;
    for (const a of ALL){ used += (state.cookie.counts[a.id] || 0); }
    state.cookie.bank = Math.max(0, total - used);
  }

  function stamp(name, payload){ if (DBG && DBG.logEvent) DBG.logEvent(name, {...payload, summary: U.summary()}); }

  // -------- Render --------
  const R = DBG && DBG.channel ? DBG.channel('render') : console;

  function renderAll(){
    R.time ? R.time('render') : null;
    renderTimeline();
    renderShelf();
    renderCookieBank();
    renderProgress();
    R.timeEnd ? R.timeEnd('render') : null;
    DBG && DBG.setState && DBG.setState(U.summary());
  }
  function renderTimeline(){
  if (!state || !state.timeline) return;

    const el = dom.timeline;
    el.innerHTML = '';

    // Even spacing that always fits in one row
    const slotCount = Math.max(1, state.timeline.length);
    const BASE_MIN = 140;         // your normal min width
    const HARD_MIN = 96;          // smallest we’ll allow
    const MAX_GAP  = 28;
    const MIN_GAP  = 8;

    const W = el.clientWidth || el.getBoundingClientRect().width;
    const GUTTER = Math.max(10, Math.min(28, Math.round(window.innerWidth * 0.03)));

    // 1) choose gap based on available room (same as now, but uses BASE_MIN)
    let gap = MAX_GAP;
    if (slotCount > 1) {
      const room = W - (slotCount * BASE_MIN);
      gap = Math.max(MIN_GAP, Math.min(MAX_GAP, Math.floor(room / (slotCount - 1))));
    }
    el.style.gap = `${gap}px`;

    // 2) compute a dynamic column min width so everything fits
    const minWidth = Math.max(
      HARD_MIN,
      Math.floor((W - (slotCount - 1) * gap) / slotCount)
    );

    // 3) apply the grid
    el.style.display = 'grid';
    el.style.paddingInline = GUTTER + 'px';
    el.style.gridTemplateColumns = `repeat(${slotCount}, minmax(${minWidth}px, 1fr))`;
    el.style.justifyContent = 'center';
    el.style.alignItems = 'start';

    applyResponsiveVars(el, minWidth);

    for (let i = 0; i < slotCount; i++){
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.idx = String(i);

      // NEW: idle marquee for open slots
      if (shouldShowOpenMarquee(i)) slot.classList.add('open');

      const plus = document.createElement('div');
      plus.className = 'plus';
      plus.textContent = '+';
      slot.appendChild(plus);

      enableDropOnSlot(slot);

      const data = state.timeline[i];
      if (data){ slot.appendChild(makeCard(data)); }

      el.appendChild(slot);
    }

    // NEW: start/refresh the auto-cycler after slots are in the DOM
    ensureMarqueeCycle();

  }
  // UPDATED: makeCard — minus shows only in Parent Mode for anything treated as parent
  function makeCard(entry){
    const card = document.createElement('div');
    const locked = entry.fixed && (typeof isParentLockOn === 'function' ? isParentLockOn() : !state.parentMode);
    card.className = 'card ' + entry.type + (locked ? ' fixed' : '');
    card.tabIndex = 0;
    card.dataset.id = entry.id;

    const iconFrame = document.createElement('div'); iconFrame.className = 'icon';
    const fa = document.createElement('i'); fa.className = U.iconClass(entry.id) + ' card-icon';
    const baseSize = Math.min(window.innerWidth * 0.05, 42); fa.style.fontSize = baseSize + "px";

    const label = document.createElement('div'); label.className = 'label';
    label.innerHTML = U.label(entry.id) + '<br><span class="subtext">' + U.minutesFor(entry.id) + ' min</span>';

    // Remove (X)
    const remove = document.createElement('button');
    remove.className = 'remove'; remove.textContent = '×'; remove.title = 'Remove';
    remove.addEventListener('click', (e)=>{ if (!isFrozen()) removeCardAt(findSlotIndexOf(entry)); });

    // Cookie badge
    const badge = document.createElement('div'); badge.className = 'cookieBadge';
    const dot   = document.createElement('span'); dot.className = 'dot';
    const count = document.createElement('span'); count.className = 'count';
    const minus = document.createElement('button'); minus.className = 'minus'; minus.textContent = '−';
    minus.title = 'Remove 1 cookie';
    minus.addEventListener('click', (e)=>{ e.stopPropagation(); if (!isFrozen()) allocateCookieTo(entry.id,-1); });
    badge.append(dot, count, minus);

    // keep FA icon responsive
    function resizeIcons(){
      document.querySelectorAll('.card-icon').forEach(icon=>{
        const base = Math.min(window.innerWidth * 0.05, 42);
        icon.style.fontSize = base + "px";
      });
    }
    window.addEventListener('resize', resizeIcons);

    // reflect state → hide badge when count is zero
    function refreshBadge(){
      const c = state.cookie.counts[entry.id] || 0;
      count.textContent = String(c);
      badge.style.display = (c > 0 ? '' : 'none');                // <— hide whole badge
      label.innerHTML = U.label(entry.id) + '<br><span class="subtext">' + U.minutesFor(entry.id) + ' min</span>';

      // parent lock: minus only when not frozen, not locked, and c>0
      const parentLocked = (!state.parentMode) && isParentId(entry.id);
      const showMinus = !isFrozen() && !parentLocked && c > 0;
      badge.classList.toggle('showMinus', showMinus);
      minus.disabled = !showMinus;
    }

    iconFrame.appendChild(badge);
    card.append(iconFrame, fa, label, remove);

    if (!isFrozen()){
      card.draggable = true;
      enableDrag && enableDrag(card, { from:'timeline', idx: findSlotIndexOf(entry) });
      enableCookieDrop && enableCookieDrop(card, entry.id);
    } else {
      card.draggable = false;
    }

    refreshBadge();
    bus.on('state', refreshBadge);
    return card;
  }



  // UPDATED: renderShelf — minus respects parent lock (required + promoted) when Parent Mode is OFF
  function renderShelf(){
    if (!state || !dom || !dom.shelf) return;

    // (optional) keep whatever promo/seeding you already use
    if (typeof ensurePromotionStore === 'function') ensurePromotionStore();

    // Don't show cards that are already on the timeline
    const usedIds = new Set((state.timeline || []).filter(Boolean).map(x => x.id));
    const source  = state.parentMode ? ALL : ELECTIVE;
    const items   = source.filter(it => !usedIds.has(it.id));

    // Clear shelf
    dom.shelf.innerHTML = '';

    // Layout: single responsive row
    const row = document.createElement('div');
    row.className = 'shelfRow';

    // Grid sizing (same spirit as before)
    const n        = Math.max(1, items.length);
    const BASE_MIN = 140, HARD_MIN = 96, MAX_GAP = 22, MIN_GAP = 8;
    const W        = dom.shelf.clientWidth || dom.shelf.getBoundingClientRect().width;
    const GUTTER   = Math.max(10, Math.min(28, Math.round(window.innerWidth * 0.03)));

    let gap = MAX_GAP;
    if (n > 1){
      const room = W - (n * BASE_MIN);
      gap = Math.max(MIN_GAP, Math.min(MAX_GAP, Math.floor(room / (n - 1))));
    }

    row.style.display = 'grid';
    row.style.paddingInline = GUTTER + 'px';
    row.style.gap = `${gap}px`;

    const minWidth = Math.max(HARD_MIN, Math.floor((W - (n - 1) * gap) / n));
    row.style.gridTemplateColumns = `repeat(${n}, minmax(${minWidth}px, 1fr))`;
    row.style.justifyContent = 'center';
    row.style.alignItems = 'start';

    if (typeof applyResponsiveVars === 'function') applyResponsiveVars(row, minWidth);

    // Build each shelf card
    for (const it of items){
      const card  = document.createElement('div');
      card.className = 'card shelfCard';
      card.dataset.id = it.id;

      const iconWrap = document.createElement('div');
      iconWrap.className = 'icon';

      const fa = document.createElement('i');
      fa.className = U.iconClass(it.id) + ' card-icon';

      const label = document.createElement('div');
      label.className = 'label';
      label.innerHTML = it.label + '<br><span class="subtext">' + U.minutesFor(it.id) + ' min</span>';

      // ---- Cookie badge (hide when zero) ----
      const badge = document.createElement('div'); badge.className = 'cookieBadge';
      const dot   = document.createElement('span'); dot.className   = 'dot';
      const count = document.createElement('span'); count.className = 'count';
      const minus = document.createElement('button'); minus.className = 'minus'; minus.textContent = '−'; minus.title = 'Remove 1 cookie';

      const c = state.cookie.counts[it.id] || 0;
      count.textContent = String(c);

      // Completely hide the badge when count is 0
      const parentLocked = (!state.parentMode) && (typeof isParentId === 'function' ? isParentId(it.id) : false);
      const showMinus    = !isFrozen() && !parentLocked && c > 0;

      badge.style.display = (c > 0 ? '' : 'none');       // ← hide whole badge at zero
      badge.classList.toggle('showMinus', showMinus);
      minus.disabled = !showMinus;

      minus.addEventListener('click', (e)=>{
        e.stopPropagation();
        if (isFrozen()) return;
        allocateCookieTo(it.id, -1);
      });

      badge.append(dot, count, minus);
      iconWrap.appendChild(badge);

      // ---- Drag/drop wiring ----
      if (!isFrozen()){
        if (typeof enableDrag === 'function')      enableDrag(card, { from:'shelf', id: it.id });
        if (typeof enableCookieDrop === 'function') enableCookieDrop(card, it.id);
      }

      // Assemble card
      card.append(iconWrap, fa, label);
      row.appendChild(card);
    }

    dom.shelf.appendChild(row);
  }



  // REPLACE ENTIRE FUNCTION
  function renderCookieBank(){
    if (!state) return;

    const el = dom.cookiePile;
    el.innerHTML = '';

    // counters
    dom.cookieCount.textContent = String(state.cookie.bank);
    const summaryEl = document.getElementById('cookieSummary');
    if (summaryEl) summaryEl.innerHTML = '<b>' + state.cookie.bank + '</b> × ' + cookieMinutes() + ' min';

    const count = state.cookie.bank;
    if (count <= 0) return;

    const rect = el.getBoundingClientRect();
    const W = el.clientWidth || rect.width || 1;
    const H = Math.max(1, rect.height);

    const css = getComputedStyle(document.documentElement);
    const sizeVar = (css.getPropertyValue('--cookieTokenSize') || '').trim();
    const SIZE = parseInt(sizeVar || '26', 10) || 26;
    const R = Math.round(SIZE / 2);

    const PAD = Math.max(4, Math.ceil(R * 0.25));
    let   MIN_DIST = Math.max(SIZE + 4, 2 * R + 4);

    const Xmin = PAD + R, Xmax = Math.max(Xmin, W - (PAD + R));
    const Ymin = PAD + R, Ymax = Math.max(Ymin, H - (PAD + R));

    const pts = [];
    function ok(x,y){
      for (let k=0;k<pts.length;k++){
        const dx=x-pts[k][0], dy=y-pts[k][1];
        if ((dx*dx + dy*dy) < (MIN_DIST*MIN_DIST)) return false;
      }
      return true;
    }

    let tries=0, maxTries=Math.max(200, count*250);
    while (pts.length < count && tries++ < maxTries){
      const x = Xmin + Math.random()*(Xmax-Xmin);
      const y = Ymin + Math.random()*(Ymax-Ymin);
      if (ok(x,y)) pts.push([x,y]);
      if (tries % 200 === 0 && pts.length < count){
        MIN_DIST = Math.max(R*1.1, MIN_DIST*0.92);
      }
    }

    for (let i=0;i<pts.length;i++){
      const t = document.createElement('div');
      t.className = 'cookieToken';
      t.style.width  = SIZE + 'px';
      t.style.height = SIZE + 'px';
      t.style.left   = (pts[i][0] - R) + 'px';
      t.style.top    = (pts[i][1] - R) + 'px';

      if (IS_TOUCH){
        t.draggable = false;
        t.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse') return;
          startCookieTouchDrag(t, e);   // plays SFX on shelf drop (see above)
        });
      } else {
        t.draggable = true;
        t.addEventListener('dragstart', e => {
          __dragCookieEl = t;
          try {
            e.dataTransfer.setData('text/plain', 'COOKIE_TOKEN');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.dropEffect = 'move';
          } catch(_){}
          t.style.opacity = '0.5';
          document.body.classList.add('dragging');
        });
        t.addEventListener('dragend', () => {
          t.style.opacity = '1';
          document.body.classList.remove('dragging');
        });
      }

      el.appendChild(t);
    }
  }


  function renderProgress(){
    const accounted = U.totalAccounted();
    if (dom.progressText) dom.progressText.textContent = accounted + ' mins accounted for / ' + state.totalMins + ' total mins';
    const pct = Math.max(0, Math.min(1, accounted / state.totalMins));
    if (dom.progressFill) dom.progressFill.style.width = (pct * 100).toFixed(1) + '%';

    const ready = canGoNow();
    if (dom.goBtn){
      dom.goBtn.disabled = !ready;
      dom.goBtn.classList.toggle('ready', ready);
    }
  }

  // -------- DnD --------
  function enableDrag(card, payload){
    // payload: { from: 'shelf' | 'timeline', idx?: number }

    if (typeof isFrozen === 'function' && isFrozen()){
      card.draggable = false;
      return;
    }

    if (IS_TOUCH){
      // Touch: instant pointer drag (no long-press)
      card.draggable = false;

      card.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse') return; // mouse uses native path below
        // block if shelf card has no cookies in non-parent mode (your rule)
        if (payload?.from === 'shelf' && !state.parentMode){
          const id = card.dataset.id;
          if ((state.cookie.counts[id] || 0) < 1) return;
        }
        startCardTouchDrag(card, payload, e);
      });

    } else {
      // Mouse/trackpad: keep native HTML5 drag & drop
      card.draggable = true;

      card.addEventListener('dragstart', e => {
        if (typeof isFrozen === 'function' && isFrozen()) { e.preventDefault(); return; }

        // same cookie rule for shelf cards on desktop
        if (payload?.from === 'shelf' && !state.parentMode){
          const id = card.dataset.id;
          if ((state.cookie.counts[id] || 0) < 1){ e.preventDefault(); return; }
        }

        card.classList.add('dragging');
        try {
          e.dataTransfer.setData('text/plain', JSON.stringify({
            src: payload?.from || 'timeline',
            id: card.dataset.id,
            idx: payload?.idx ?? -1
          }));
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.dropEffect = 'move';
        } catch {}
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
      });
    }
  }

// UPDATED — only the 'drop' handler inside enableDropOnSlot
function enableDropOnSlot(slot){
  slot.addEventListener('dragover', e => {
    if (isFrozen()) return;
    try { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; } catch {}
    slot.classList.add('hot');
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('hot');
  });

  slot.addEventListener('drop', e => {
    if (isFrozen()) return;
    try { e.preventDefault(); } catch {}
    slot.classList.remove('hot');

    let data;
    try { data = JSON.parse(e.dataTransfer.getData('text/plain') || '{}'); }
    catch { data = {}; }

    const idx = parseInt(slot.dataset.idx, 10);
    if (!Number.isFinite(idx)) return;

    // timeline → timeline reorders (no sound)
    if (data.src === 'timeline'){
      reorderTimeline(data.idx, idx);
      return;
    }

    if (data.src === 'shelf'){
      const beforeId = (state.timeline[idx] && state.timeline[idx].id) || null;

      // NEW: if this slot holds a parent-like card and Parent Lock is OFF,
      // move that parent to the next open slot (create one if needed).
      const occupant = state.timeline[idx];
      if (occupant && typeof isParentId === 'function' && isParentId(occupant.id) && !isParentLockOn()){
        // find or make an empty slot
        let dest = state.timeline.findIndex(e => !e);
        if (dest < 0){
          ensureSlots(state.timeline.length + 1);
          dest = state.timeline.findIndex(e => !e);
        }
        // move parent card to the empty slot and free current slot
        state.timeline[dest] = occupant;
        state.timeline[idx]  = null;
      }

      // place the incoming shelf card into this (now free) slot
      addCardToSlot({ id: data.id }, idx);

      const afterId  = (state.timeline[idx] && state.timeline[idx].id) || null;
      if (afterId === data.id && afterId !== beforeId){
        playBookPlaceSfx();
      }

      // optional: immediate visual refresh (keeps things snappy)
      renderTimeline && renderTimeline();
      renderProgress && renderProgress();
      bus && bus.emit && bus.emit('state');
    }

  });
}

  function findSlotIndexOf(entry){ return state.timeline.findIndex(e=>e && e.id===entry.id); }

  // -------- UI Wiring --------
  function wireUI(){
    let taps=0, timer=null;
    if (dom.parentToggle){
      dom.parentToggle.addEventListener('click', ()=>{
        taps++;
        if (!timer) timer = setTimeout(()=>{ taps=0; timer=null; }, 900);
        if (taps >= 5){ taps=0; clearTimeout(timer); timer=null; toggleParentMode(); }
      });
    }
    if (dom.durationRange){
      dom.durationRange.addEventListener('input', ()=>{
        const v = parseInt(dom.durationRange.value,10);
        if (dom.durationValue) dom.durationValue.textContent = String(v);
        setTotalMinutes(v);
      });
    }
    if (dom.goBtn){
      dom.goBtn.addEventListener('click', async ()=>{
        if (!canGoNow()) { bus.emit('go:not-ready'); return; }
        try {
          dom.goBtn.disabled = true;
          freezeUI();                 // << freeze immediately
          bus.emit('go:start');       // events still emitted for anything else listening
          await playSparkles();
          await runCloudAnimation();
          playSoundNTimes(ALARM_URL, 5, { volume: 0.9, gapMs: 60 });
          bus.emit('go:done');        // stays frozen (finishUI keeps it locked)
        } catch (e){ DBG && DBG.err && DBG.err('GO failed', e.message); }
      });
    }
  }

function playSparkles(){ bus.emit('go:sparkles'); return new Promise(res=>setTimeout(res,700)); }

// === Clouds: progress per slot based on each card's allotted time ===
// Constant-density puffs; animate the reveal width; feather all edges
// === Clouds: progress per slot based on each card's allotted time ===
function runCloudAnimation(opts = {}){
  // msPerMinute = 1000 → “1 min = 1 second” for testing. Use 60000 later.
  const { persist = true, msPerMinute = 1000 } = opts;

  ensureFogCss();

  // Position against the timeline container
  const container = document.getElementById('timelineSection') || dom.timeline;
  const cs = window.getComputedStyle(container);
  if (cs.position === 'static') container.style.position = 'relative';

  // Build/reuse the reveal mask
  let reveal = document.getElementById('__fog_reveal__');
  if (!reveal || !reveal.isConnected) {
    reveal = document.createElement('div');
    reveal.id = '__fog_reveal__';
    reveal.className = 'fogReveal';
    reveal.style.width = '0%'; // we animate THIS
    container.appendChild(reveal);
  }

  // Build/reuse the full-bleed fog field (seed once for constant density)
  let fog = __fogOverlay;
  if (!fog || !fog.isConnected) {
    fog = document.createElement('div');
    fog.className = 'fog';   // full bleed via CSS (inset:-10%)
    reveal.appendChild(fog);
    __fogOverlay = fog;

    const PUFFS = 1000;
    for (let i = 0; i < PUFFS; i++) {
      const p = document.createElement('div');
      p.className = 'p';
      const w = 12 + Math.random() * 48;
      const h = w * (0.6 + Math.random() * 0.7);
      p.style.width  = w + 'px';
      p.style.height = h + 'px';
      // allow organic bleed on every side
      p.style.top  = (Math.random() * 120 - 10) + '%';
      p.style.left = (Math.random() * 120 - 10) + '%';
      const dur = (4 + Math.random() * 6).toFixed(2);
      const del = (Math.random() * 2).toFixed(2);
      p.style.animation = `fogDrift ${dur}s ease-in-out ${del}s infinite alternate`;
      fog.appendChild(p);
    }
  } else {
    if (fog.parentNode !== reveal) reveal.appendChild(fog);
  }

  // Build segments: grow to each slot’s RIGHT edge
  const slots = Array.from(dom.timeline.querySelectorAll('.slot'));
  const cRect = container.getBoundingClientRect();
  const cW = Math.max(1, cRect.width);

  const segments = [];
  for (let i = 0; i < slots.length; i++) {
    const entry = state.timeline[i];
    if (!entry) continue;                                 // << only filled slots
    const mins = U.minutesFor(entry.id) || 0;
    if (mins <= 0) continue;

    const r = slots[i].getBoundingClientRect();
    const rightPct = Math.min(100, ((r.right - cRect.left) / cW) * 100);
    segments.push({ targetPct: rightPct, durationMs: Math.max(0, mins * msPerMinute) });
  }

  // If there were any segments at all, finish at 100% so fog covers empty trailing slots.
  if (segments.length) {
    const last = segments[segments.length - 1];
    if (last.targetPct < 100) segments.push({ targetPct: 100, durationMs: 0 });
  } else {
    // nothing to animate
    return Promise.resolve();
  }

  // Animate the REVEAL width; keep a soft right edge while moving
  function animateTo(pct, duration) {
    const startW = parseFloat(reveal.style.width) || 0;
    const endW   = Math.max(startW, Math.min(100, pct));

    // add soft trailing edge while growing
    reveal.classList.add('feather-right');

    if (duration <= 0 || endW <= startW) {
      reveal.style.width = endW + '%';
      if (endW >= 99.6) reveal.classList.remove('feather-right'); // full width -> remove right feather
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const t0 = performance.now();
      (function step(t){
        const k = Math.min(1, (t - t0) / duration);
        const w = startW + (endW - startW) * k;
        reveal.style.width = w.toFixed(4) + '%';
        if (k < 1) requestAnimationFrame(step);
        else {
          if (w >= 99.6) reveal.classList.remove('feather-right');
          resolve();
        }
      })(t0);
    });
  }

  const run = segments.reduce((p, seg) => p.then(() => animateTo(seg.targetPct, seg.durationMs)), Promise.resolve());
  return run.then(() => { if (!persist) { try { reveal.remove(); } catch {} __fogOverlay = null; } });
}

// inject minimal CSS once (overlay + drift keyframes)
// Inject fog CSS once: full-bleed fog + reveal with soft edges on all sides
// Inject fog CSS once: full-bleed fog + reveal with soft edges on all sides
function ensureFogCss(){
  // Remove any older, incorrect style tag, then add ours
  const old = document.getElementById('__fog_css__');
  if (old && old.parentNode) old.parentNode.removeChild(old);

  const st = document.createElement('style');
  st.id = '__fog_css__';
  st.textContent = `
    /* The reveal is the animated mask; the fog lives inside it */
    .fogReveal{
      position:absolute;
      inset:0;                 /* align with container */
      width:0%;                /* JS animates 0 -> 100 */
      overflow:hidden;
      pointer-events:none;
      z-index:var(--fogZ, 5);

      /* --- Soft edges on ALL sides ---
         1) Static: left/top/bottom feather
         2) Dynamic: right feather (added via .feather-right class)
      */
      --fog-feather: 48px;

      /* STATIC: left + top/bottom feather (right stays opaque here) */
      -webkit-mask-image:
        linear-gradient(to right,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 100%),
        linear-gradient(to bottom,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 calc(100% - var(--fog-feather)),
          rgba(0,0,0,0) 100%);
      -webkit-mask-composite: source-in;
              mask-image:
        linear-gradient(to right,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 100%),
        linear-gradient(to bottom,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 calc(100% - var(--fog-feather)),
          rgba(0,0,0,0) 100%);
              mask-composite: intersect;
    }

    /* While animating: add a feather on the RIGHT edge too */
    .fogReveal.feather-right{
      -webkit-mask-image:
        linear-gradient(to right,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 100%),
        linear-gradient(to bottom,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 calc(100% - var(--fog-feather)),
          rgba(0,0,0,0) 100%),
        linear-gradient(to right,
          #000 0,
          #000 calc(100% - var(--fog-feather)),
          rgba(0,0,0,0) 100%);
      -webkit-mask-composite: source-in, source-in;
              mask-image:
        linear-gradient(to right,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 100%),
        linear-gradient(to bottom,
          rgba(0,0,0,0) 0,
          #000 var(--fog-feather),
          #000 calc(100% - var(--fog-feather)),
          rgba(0,0,0,0) 100%),
        linear-gradient(to right,
          #000 0,
          #000 calc(100% - var(--fog-feather)),
          rgba(0,0,0,0) 100%);
    }

    /* The actual cloud field: make it larger than the mask on ALL sides */
    .fog{
      position:absolute;
      inset:-10%;             /* bleed 10% past every edge for soft edges */
      pointer-events:none;
      background:none;
      overflow:visible;
      z-index:inherit;
    }

    @keyframes fogDrift {
      0%   { transform: translate(0, 0); }
      100% { transform: translate(24px, -6px); }
    }
    .fog .p { will-change: transform, opacity; }
  `;
  document.head.appendChild(st);
}


  // -------- Smoke actions (safe) --------
  function addSmokeTests(){
    DBG.addAction && DBG.addAction('Hard Reset', ()=>{
      try { localStorage.clear(); location.reload(); }
      catch(e){ DBG.err && DBG.err('reset failed', e.message); }
    });
    DBG.addAction && DBG.addAction('Smoke: init', ()=>{
      try {
        ensureCookieStore();
        setTotalMinutes(90);
        state.timeline = [null,null,null,null];
        state.cookie.counts = Object.create(null);
        rebuildBank();
        bus.emit('state');
        DBG.ok && DBG.ok('Smoke init complete');
      } catch (e){ DBG.err && DBG.err('Smoke init failed:', e.message); }
    });
    DBG.addAction && DBG.addAction('Smoke: +cookies Color', ()=>{
      try { addCookiesByName('Color', +3); }
      catch(e){ DBG.err && DBG.err('Smoke +cookies failed', e.message); }
    });
    DBG.addAction && DBG.addAction('Smoke: place Color@0', ()=>{
      try { addCardToSlot({id:'color'}, 0); bus.emit('state'); }
      catch(e){ DBG.err && DBG.err('Smoke place failed', e.message); }
    });
  }

  // -------- Controls adapter for debugger --------
  try {
    DBG && DBG.controls && DBG.controls.use && DBG.controls.use({
      toggleParent: () => toggleParentMode(),
      cookiesPlusAll: () => addCookiesToVisibleShelf(),   // <-- change this line
      cookiesMinusAll: () => addCookiesAll(-1),
      cookiesClear: () => { ensureCookieStore(); state.cookie.counts = Object.create(null); rebuildBank(); bus.emit('state'); },
      inspectActivities: () => inspectActivities()
    });
  } catch(e) { DBG && DBG.warn && DBG.warn('controls adapter bind failed', e && e.message ? e.message : String(e)); }

// --- bind responsive re-render on window/container size changes (idempotent)
function bindResponsiveRerender(){
  if (window.__rzBound) return;
  window.__rzBound = true;

  let __rzT = null;
  const kick = () => {
    clearTimeout(__rzT);
    __rzT = setTimeout(() => {
      try { renderAll(); } catch (e) { console.warn('renderAll after resize failed', e); }
    }, 80); // tweak debounce if you want snappier/slower
  };

  // Window resize
  window.addEventListener('resize', kick, { passive: true });

  // Container resize (timeline / shelf / cookie bank)
  try{
    const ro = new ResizeObserver(kick);
    if (dom.timeline)   ro.observe(dom.timeline);
    if (dom.shelf)      ro.observe(dom.shelf);
    if (dom.cookiePile) ro.observe(dom.cookiePile);
  }catch(_){}
}

// HARD KILL long-press menus on touch (Android Chrome, etc.)
(function hardenLongPressForTouch(){
  const isTouch = window.matchMedia?.('(pointer:coarse)').matches || 'ontouchstart' in window;
  if (!isTouch) return;

  // 1) Block the browser’s context menu everywhere (images, links, background)
  const blockMenu = (e) => { e.preventDefault(); e.stopImmediatePropagation(); return false; };
  window.addEventListener('contextmenu', blockMenu, { capture: true });
  document.addEventListener('contextmenu', blockMenu, { capture: true });

  // 2) Disable “drag to save image/open link” paths
  const blockDrag = (e) => { e.preventDefault(); };
  document.addEventListener('dragstart', blockDrag, { capture: true });

  // 3) Keep selection off (safety net; CSS already does most of this)
  const blockSelect = (e) => {
    if (!e.target.closest('input, textarea, [contenteditable="true"], [contenteditable=""]')) {
      e.preventDefault();
    }
  };
  document.addEventListener('selectstart', blockSelect, { capture: true });

  // 4) Make common elements non-draggable (covers images, SVG, canvas, etc.)
  const applyNoDrag = (root) => {
    root.querySelectorAll('img, a, svg, canvas, video, picture, iframe, i, .card, .cookieToken')
      .forEach(el => {
        try { el.setAttribute('draggable', 'false'); } catch {}
        try { el.style.webkitUserDrag = 'none'; } catch {}
      });
  };
  applyNoDrag(document);

  // If your UI creates elements later, keep them non-draggable too.
  try {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType === 1) applyNoDrag(n);
        });
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch {}
})();


  // -------- Boot --------
  function boot(){
    // Make sure cookie store exists
    ensureCookieStore();
    // inside boot(), near the top
    try {
      localStorage.removeItem('__DEMO_HAS_PLAYED__');
      sessionStorage.removeItem('__SKIP_DEMO_ONCE__');
    } catch {}

    // React to state changes BEFORE anything can emit
    bus.on('state', ()=>{ adjustSlotsForCookies(); renderAll(); });

    DBG && DBG.ok && DBG.ok('Booting…');

    // 1) Hydrate saved prefs/toggles/timeline FIRST
    loadPrefs();                         // <- restores demo toggle, parentLock, totalMins, cookieMin, counts, timeline, etc.

    // 2) Normalize totals/bank now that prefs are loaded
    setTotalMinutes(state.totalMins);    // emits 'state' (handler already wired)
    rebuildBank();

    // 3) Seed required parents ONLY on true first boot (keeps existing timelines intact)
    initParentsWithCookies();            // does nothing after BOOT_KEY is set

    // 4) Make derived layout consistent
    adjustSlotsForCookies();

    // 5) Wire UI and helpers
    wireUI();
    addSmokeTests();
    bindResponsiveRerender();
    ensureNoLongPressGuard();
    ensureDemoCss();

    // 6) First paint
    renderAll();
    bus.emit('state');

    // Kick the demo after first paint (tablet-safe, DOM is ready)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // sanity: only run if the essential nodes exist
      const ready = dom && dom.shelf && dom.cookiePile && dom.timeline;
      if (ready && getDemoEnabled() && !__demoRan && !__demoRunning) {
        runOpeningDemo().catch(()=>{});
      }
    }));

    DBG && DBG.ok && DBG.ok('Ready');
  }



  function bootstrapDebugDock(){
    try{ if (window.DBG) return; }catch(e){}
    if (document.getElementById('debugDock')) return;
    const dock = document.createElement('div');
    dock.id = 'debugDock';
    dock.style.cssText = 'position:fixed;right:10px;bottom:12px;background:#111c;border:1px solid #333;border-radius:10px;padding:8px 10px;color:#eee;font:12px system-ui;z-index:20000;backdrop-filter:blur(2px)';
    dock.innerHTML = "<div style=\"display:flex;gap:6px;flex-wrap:wrap\">" +
      "<button data-act=\"parentToggle\">Parent: Toggle</button>" +
      "<button data-act=\"cookiesPlusAll\">Cookies: +1 all</button>" +
      "<button data-act=\"cookiesClear\">Cookies: Clear</button>" +
      "<button data-act=\"inspect\">Inspect</button>" +
      "<button data-act=\"hardReset\">Hard Reset</button>" +
      "</div>";
    dock.querySelectorAll('button').forEach(b=>{
      b.style.cssText='background:#2b2b2b;border:1px solid #444;color:#eee;border-radius:8px;padding:6px 10px;cursor:pointer';
      b.addEventListener('click', e=>{
        const act = e.currentTarget.dataset.act;
        if (act==='parentToggle'){ toggleParentMode(); }
        if (act==='cookiesPlusAll'){ ALL.forEach(a=> allocateCookieTo(a.id, +1)); }
        if (act==='cookiesClear'){ state.cookie.counts = {}; state.cookie.bank = 0; bus.emit('state'); }
        if (act==='inspect'){ console.log('[inspect]', JSON.parse(JSON.stringify(state))); }
        if (act==='hardReset'){ try{ localStorage.clear(); location.reload(); }catch(_){ location.reload(); } }
      });
    });
    document.body.appendChild(dock);
  }
  document.addEventListener('DOMContentLoaded', bootstrapDebugDock);


// Prevent text selection globally (except in inputs/editables)
// --- Touch long-press guards (Android/iOS) + keep text unselectable ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// close the IIFE
})();

