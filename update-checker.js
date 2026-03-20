// Auto-update checker for Princess Sparkle
// Registers service worker and checks for new versions on launch + periodically
(function() {
  if (!('serviceWorker' in navigator)) return;

  // Register the service worker
  navigator.serviceWorker.register('./sw.js').then(reg => {
    console.log('[update] Service worker registered');

    // Check for updates on launch
    reg.update();

    // Check for updates every 5 minutes while playing
    setInterval(() => {
      reg.update();
    }, 5 * 60 * 1000);

    // When a new service worker is waiting, notify the user gently
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated') {
          showUpdateBanner();
        }
      });
    });

  }).catch(err => {
    console.warn('[update] SW registration failed:', err);
  });

  // When the new SW takes over, show a gentle refresh prompt
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    showUpdateBanner();
  });

  function showUpdateBanner() {
    // Don't interrupt if one is already showing
    if (document.getElementById('update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
      <div style="
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ffb6ff, #ffd166);
        color: #231942;
        padding: 14px 24px;
        border-radius: 999px;
        font-family: system-ui, sans-serif;
        font-size: 16px;
        font-weight: 700;
        box-shadow: 0 8px 24px rgba(255,182,255,0.4);
        z-index: 999999;
        cursor: pointer;
        opacity: 0;
        transition: opacity 800ms ease-in-out, transform 800ms ease-in-out;
        text-align: center;
      " onclick="window.location.reload()">
        New adventure ready! Tap here~
      </div>
    `;
    document.body.appendChild(banner);

    // Gentle fade-in (no flash)
    requestAnimationFrame(() => {
      const inner = banner.firstElementChild;
      inner.style.opacity = '1';
    });

    // Auto-reload after 30 seconds if she doesn't tap
    // (only if not mid-interaction)
    setTimeout(() => {
      if (document.getElementById('update-banner')) {
        window.location.reload();
      }
    }, 30000);
  }
})();
