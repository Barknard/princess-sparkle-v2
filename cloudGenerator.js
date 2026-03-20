// Fog engine that seeds puff elements (.p) the CSS will style as clouds
(function(){
  function initFog(container, opts={}){
    const fog = document.createElement('div');
    fog.className = 'fog';
    container.appendChild(fog);

    // Seed cloud puffs once
    if (!fog.__seeded){
      fog.__seeded = true;
      const count = opts.count || 220; // tweak density
      for (let i=0;i<count;i++){
        const p = document.createElement('div');
        p.className = 'p';
        const w = 16 + Math.random()*36;        // 16–52px
        const h = w * (0.7 + Math.random()*0.6);
        p.style.width  = w + 'px';
        p.style.height = h + 'px';
        p.style.top  = (Math.random()*120 - 10) + '%'; // extend beyond edges
        p.style.left = (Math.random()*120 - 10) + '%';
        fog.appendChild(p);
      }
    }
    return fog;
  }
  function setFogProgress(fog, pct){
    const p = Math.max(0, Math.min(100, pct)) / 100;
    fog.style.transform = 'scaleX(' + p + ')';
    fog.style.transformOrigin = 'left center';
  }
  function destroyFog(fog){
    if (fog && fog.parentNode) fog.parentNode.removeChild(fog);
  }
  window.Fog = { initFog, setFogProgress, destroyFog };
})();
