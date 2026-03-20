
/* PrincessSparkle.js (v3 - arbitrary talk timeline with durations)
   Exposes: window.PrincessSparkle.start(options)
*/
(function () {
  const defaults = {
    mount: null,
    // Audio
    entranceAudioSrc: 'Princess Sparkle - Long.mp3',
    entranceAudioDelayMs: 500,
    entranceAudio: null,

    // Sparkle buildup
    buildupMs: 6000,
    targetSparkles: 100,
    burstMode: 'odds', // 'odds' | 'fibonacci'
    // Talk phase
    images: [],                 // optional base list (e.g., [yawn, talk, hello])
    talkImageCues: [200, 1200, 2200], // legacy: still supported
    talkPaddingMs: 800,
    // NEW: explicit timeline of frames with per-frame durations
    // talkTimeline: [{ image: 'images/ps-talk.png', durationMs: 300 }, ...]
    talkTimeline: null,
    // Geometry
    centerOval: { cx: 0.5, cy: 0.46, rx: 190, ry: 130 },
    princessSize: { w: 220, h: 220 },
    zIndex: 2147483000,
    onDone: null
  };

  function makeEl(tag, styles = {}, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    Object.assign(el.style, styles);
    return el;
  }

  let psAudioArmed = false;
  function armAudioOnce(audioEl) {
    if (psAudioArmed) return;
    const unlock = () => {
      audioEl.play().then(() => {
        audioEl.pause();
        audioEl.currentTime = 0;
        psAudioArmed = true;
      }).catch(() => {});
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }


  // Burst sequences
  function seqOddsUpTo(total) {
    const bursts = [];
    let n = 1, sum = 0;
    while (sum + n < total) { bursts.push(n); sum += n; n += 2; }
    if (sum < total) bursts.push(Math.max(1, total - sum));
    return bursts;
  }
  function seqFibUpTo(total) {
    const bursts = [];
    let a = 1, b = 1, sum = 0;
    while (sum + a < total) { bursts.push(a); sum += a; [a, b] = [b, a + b]; }
    if (sum < total) bursts.push(Math.max(1, total - sum));
    return bursts;
  }

  // Random point INSIDE ellipse
  function sampleInsideOval(cx, cy, rx, ry) {
    const t = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random());
    return { x: cx + Math.cos(t) * rx * r, y: cy + Math.sin(t) * ry * r };
  }

  function createSparkle(x, y, zIndex) {
    const s = makeEl('div', {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 0 10px #fff, 0 0 20px #f7d28a',
      opacity: '0',
      transform: 'scale(0.5)',
      zIndex: String(zIndex)
    }, 'ps-sparkle');
    requestAnimationFrame(() => {
      s.style.transition = 'opacity 140ms ease, transform 200ms ease';
      s.style.opacity = '0.95';
      s.style.transform = 'scale(1)';
    });
    setTimeout(() => {
      s.style.transition = 'opacity 380ms ease';
      s.style.opacity = '0';
      setTimeout(() => s.remove(), 420);
    }, 500 + Math.random() * 300);
    return s;
  }

  function createPrincessSprite(imgUrl, w, h, zIdx) {
    return makeEl('div', {
      position: 'absolute',
      width: `${w}px`,
      height: `${h}px`,
      background: `url("${imgUrl}") center/contain no-repeat`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%) scale(2.5)',
      opacity: '0',
      zIndex: String(zIdx)
    }, 'princess-sprite');
  }

  // Flash element
  function createFlash(cx, cy, zIndex) {
    const el = makeEl('div', {
      position: 'absolute',
      left: `${cx - 40}px`,
      top: `${cy - 40}px`,
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, #fff 0%, #ffe9b8 45%, rgba(255,255,255,0) 72%)',
      boxShadow: '0 0 38px #fff, 0 0 82px #f7b84b',
      opacity: '0',
      transform: 'scale(0.4)',
      zIndex: String(zIndex)
    }, 'ps-flash');
    return el;
  }

  function entranceFlash(stage, cx, cy, zIndex, revealCb) {
    const f = createFlash(cx, cy, zIndex);
    stage.appendChild(f);
    requestAnimationFrame(() => {
      f.style.transition = 'transform 360ms ease, opacity 160ms ease';
      f.style.opacity = '1';
      f.style.transform = 'translate(0,0) scale(5.0)';
    });
    setTimeout(() => { if (typeof revealCb === 'function') revealCb(); }, 140);
    setTimeout(() => {
      f.style.transition = 'opacity 240ms ease';
      f.style.opacity = '0';
      setTimeout(() => f.remove(), 260);
    }, 360);
  }

  function exitFlash(stage, cx, cy, zIndex, coverThen) {
    const f = createFlash(cx, cy, zIndex);
    stage.appendChild(f);
    requestAnimationFrame(() => {
      f.style.transition = 'transform 420ms ease, opacity 200ms ease';
      f.style.opacity = '1';
      f.style.transform = 'translate(0,0) scale(6.0)';
    });
    setTimeout(() => { if (typeof coverThen === 'function') coverThen(); }, 180);
    setTimeout(() => {
      f.style.transition = 'opacity 240ms ease';
      f.style.opacity = '0';
      setTimeout(() => f.remove(), 260);
    }, 180 + 260 + 60);
  }

  // Drive talk by explicit timeline [{image, durationMs}, ...]
  function runTalkTimeline(sprite, timeline, after) {
    let idx = 0;
    function step() {
      if (idx >= timeline.length) return after();
      const frame = timeline[idx++];
      if (frame.image) {
        sprite.style.backgroundImage = `url("${frame.image}")`;
      }
      const dur = Math.max(0, Number(frame.durationMs || 0));
      if (dur === 0) return step(); // skip zero durations safely
      setTimeout(step, dur);
    }
    step();
  }

  function start(opts = {}) {
    const o = { ...defaults, ...opts };
    const root = o.mount || document.getElementById('app') || document.body;

    let entranceAudio = null;
    if (o.entranceAudio && typeof o.entranceAudio.play === 'function') {
      entranceAudio = o.entranceAudio;
    } else if (o.entranceAudioSrc) {
      entranceAudio = new Audio(o.entranceAudioSrc);
      entranceAudio.preload = 'auto';
      armAudioOnce(entranceAudio);
    }

    const stage = makeEl('div', {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: String(o.zIndex)
    }, 'ps-stage');
    root.appendChild(stage);

    // Center geometry
    const rect = root.getBoundingClientRect();
    const cx = rect.left + rect.width * o.centerOval.cx;
    const cy = rect.top  + rect.height * o.centerOval.cy;

    // 1) Progressive sparkles
    const bursts = (o.burstMode === 'fibonacci')
      ? seqFibUpTo(o.targetSparkles)
      : seqOddsUpTo(o.targetSparkles);
    const msPerBurst = o.buildupMs / Math.max(1, bursts.length);

    bursts.forEach((count, i) => {
      const when = Math.floor(i * msPerBurst);
      setTimeout(() => {
        for (let k = 0; k < count; k++) {
          const p = sampleInsideOval(cx, cy, o.centerOval.rx, o.centerOval.ry);
          stage.appendChild(createSparkle(p.x, p.y, o.zIndex + 1));
        }
      }, when);
    });

    // Prepare princess sprite (hidden until entrance flash reveal)
    const defaultImg = (o.images && o.images[0]) || '';
    const sprite = createPrincessSprite(defaultImg, o.princessSize.w, o.princessSize.h, o.zIndex + 2);
    stage.appendChild(sprite);

    // 2) Entrance flash -> reveal
    setTimeout(() => {
      entranceFlash(stage, cx, cy, o.zIndex + 3, () => {
        sprite.style.transition = 'opacity 240ms ease';
        sprite.style.opacity = '1';

  if (entranceAudio) {
    setTimeout(() => {
      try { entranceAudio.currentTime = 0; } catch (e) {}
      entranceAudio.play().catch(err => console.error('Audio play failed:', err));
    }, o.entranceAudioDelayMs);
  }

  });

      // 3) Talk phase
      if (Array.isArray(o.talkTimeline) && o.talkTimeline.length > 0) {
        runTalkTimeline(sprite, o.talkTimeline, scheduleExit);
      } else {
        // legacy cue mode (kept for backward compatibility)
        const frames = o.images.slice(0, 3);
        let cueIdx = 0, currentImg = 0;
        const tStart = performance.now();
        function tick(nowTs) {
          const elapsed = nowTs - tStart;
          while (cueIdx < o.talkImageCues.length && elapsed >= o.talkImageCues[cueIdx]) {
            currentImg = Math.min(currentImg + 1, frames.length - 1);
            sprite.style.backgroundImage = `url("${frames[currentImg]}")`;
            cueIdx++;
          }
          const endAt = (o.talkImageCues[o.talkImageCues.length - 1] || 0) + o.talkPaddingMs;
          if (elapsed < endAt) requestAnimationFrame(tick);
          else scheduleExit();
        }
        requestAnimationFrame(tick);
      }
    }, o.buildupMs);

    // 4) Exit flash and cleanup
    function scheduleExit() {
      exitFlash(stage, cx, cy, o.zIndex + 3, () => {
        sprite.style.transition = 'opacity 260ms ease';
        sprite.style.opacity = '0';
      });
      setTimeout(() => {
        stage.remove();
        if (typeof o.onDone === 'function') o.onDone();
      }, 900);
    }
  }

  window.PrincessSparkle = { start };
})();
