/* Smart Debugger v4.44 — slim + inspectors
   - Spawns above 🐞 (from v4.43 behavior assumed by host)
   - Control buttons (single row): Parent Toggle / Cookies +1 all / Cookies -1 all / Cookies Clear / Inspect
   - Console bridge, levels/channels, export, snapshot
*/
;(function(){
  try{ const d=document.getElementById('debugDock'); if(d) d.remove(); const b=document.getElementById('dbgSummon'); if(b) b.remove(); }catch{}
  window.__DBG_VERSION__ = 'v4.44';
  const DOCK_ID='debugDock', BUG_ID='dbgSummon', STY_ID='dbgStyle';
  const LS={POS:'dbg.pos',VIS:'dbg.visible',GHOST:'dbg.ghost',COMPACT:'dbg.compact',
            FILTER_LEVELS:'dbg.filter.levels',FILTER_CHANNELS:'dbg.filter.channels',
            CONSOLE:'dbg.console',EVENTS:'dbg.events'};
  const PREBOOT = window.__DBG_QUEUE__ || []; window.__DBG_QUEUE__ = PREBOOT;

  const U={
    lsGet(k,d){ try{const v=localStorage.getItem(k); return v==null?d:JSON.parse(v);}catch{return d;} },
    lsSet(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch{} },
    cls(el,map){ for(const k in map){ el.classList.toggle(k,!!map[k]); } },
    nowISO(){ return new Date().toISOString(); },
    dlJSON(name,obj){ const b=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
  };

function cssOnce(){
  if (document.getElementById(STY_ID)) return;
  const st = document.createElement('style');
  st.id = STY_ID;
  st.textContent = `
#${DOCK_ID}{
  position:fixed;right:12px;bottom:56px;
  width:min(560px,52vw);max-height:30vh;
  display:flex;flex-direction:column;
  border:1px solid #2a2a33;border-radius:12px;
  background:rgba(18,19,24,.96);color:#cfd3ff;
  box-shadow:0 8px 28px rgba(0,0,0,.45);
  z-index:2147483000;overflow:hidden;
  backdrop-filter:saturate(120%) blur(3px);
  font:12px ui-monospace,Menlo,Consolas,monospace
}
#${DOCK_ID}[data-visible="false"]{display:none}
#${DOCK_ID}.ghost{pointer-events:none;opacity:.55}
#${DOCK_ID}.compact{width:min(360px,36vw);max-height:44vh}
#${DOCK_ID} .dbg-head{
  display:flex;align-items:center;gap:8px;justify-content:space-between;
  padding:6px 8px;border-bottom:1px solid #2a2a33;
  background:rgba(255,255,255,.03);font-weight:700;cursor:move
}
#${DOCK_ID} .dbg-head .left{display:flex;align-items:center;gap:4px}
#${DOCK_ID} .dbg-actions{display:flex;gap:4px;flex-wrap:wrap;scrollbar-gutter:stable}
#${DOCK_ID} .dbg-actions button{
  border:1px solid #2a2a33;background:#191a1f;color:#cfd3ff;
  padding:4px 8px;border-radius:8px;cursor:pointer;font-size:12px
}
#${DOCK_ID} .dbg-body{padding:8px;overflow:auto;display:flex;flex-direction:column-reverse;gap:6px}
#${DOCK_ID} .dbg-row{white-space:pre-wrap}
#${DOCK_ID} .dbg-row.ok{color:#8ef39f}
#${DOCK_ID} .dbg-row.warn{color:#ffd479}
#${DOCK_ID} .dbg-row.err{color:#ff8692}
#${DOCK_ID} .dbg-foot{
  display:flex;align-items:center;gap:8px;justify-content:space-between;
  padding:6px 8px;border-top:1px solid #2a2a33;opacity:.9
}
#${DOCK_ID} .dbg-foot .filters{display:flex;align-items:center;gap:4px;flex-wrap:wrap}

#${BUG_ID}{
  position:fixed;right:12px;bottom:12px;
  z-index:2147483001;border:1px solid #2a2a33;border-radius:999px;
  padding:8px 12px;font-size:16px;
  background:linear-gradient(180deg,#1b1c22,#121318);
  color:#cfd3ff;box-shadow:0 6px 18px rgba(0,0,0,.6);
  cursor:pointer;opacity:.95
}

/* NEW: keep debugger interactive even when the app is frozen */
html.frozen #${DOCK_ID},
html.frozen #${DOCK_ID} *,
html.frozen #${BUG_ID}{
  pointer-events:auto !important;
  cursor:pointer !important;
}
`;
  document.head.appendChild(st);
}


  function callControl(name,payload){
    try{
      if (window.AppControls && typeof window.AppControls[name] === 'function'){
        window.AppControls[name](payload); Smart.ok('[control] '+name+' via AppControls');
      } else {
        window.dispatchEvent(new CustomEvent('DBG_CONTROL',{detail:{name,payload}})); Smart.warn('[control] '+name+' dispatched (no AppControls)');
      }
    }catch(e){ Smart.err('[control] '+name+' failed '+e.message); }
  }

  function ensureDock(){
    cssOnce();
    let dock=document.getElementById(DOCK_ID);
    if(!dock){
      dock=document.createElement('aside'); dock.id=DOCK_ID;
      dock.setAttribute('data-visible', String(U.lsGet(LS.VIS,false)));
      dock.innerHTML=`
        <header class="dbg-head">
          <div class="left"><span>Debug <em style="opacity:.7">v4.44</em></span><small id="dbgMiniState" style="opacity:.8"></small></div>
          <div class="dbg-actions">
            <button id="dbgClear">Clear</button>
            <button id="dbgGhost">Ghost</button>
            <button id="dbgCompact">Compact</button>
            <button id="dbgConsole">Console</button>
            <button id="dbgSnapshot">Snapshot</button>
            <button id="dbgExport">Export</button>
            <button id="ctrlParent">Parent: Toggle</button>
            <button id="ctrlPlusAll">Cookies: +1 all</button>
            <button id="ctrlMinusAll">Cookies: -1 all</button>
            <button id="ctrlClear">Cookies: Clear</button>
            <button id="ctrlInspect">Inspect</button>
          </div>
        </header>
        <section class="dbg-body" id="dbgBody"></section>
        <footer class="dbg-foot">
          <div id="dbgState">—</div>
          <div class="filters">
            <label>Levels:
              <select id="dbgLevels" multiple size="3">
                <option value="log" selected>log</option>
                <option value="ok" selected>ok</option>
                <option value="warn" selected>warn</option>
                <option value="err" selected>err</option>
              </select>
            </label>
            <label>Channels:
              <input id="dbgChannels" type="text" placeholder="comma list (empty=all)" />
            </label>
          </div>
        </footer>`;
      document.body.appendChild(dock);

      const persistedGhost = !!U.lsGet(LS.GHOST, false);
      U.cls(dock, {ghost: persistedGhost, compact: !!U.lsGet(LS.COMPACT,false)});
      if (!persistedGhost){ dock.classList.remove('ghost'); U.lsSet(LS.GHOST,false); }

      dock.querySelector('#dbgClear').addEventListener('click', ()=> dock.querySelector('#dbgBody').innerHTML='');
      dock.querySelector('#dbgGhost').addEventListener('click', ()=> DBG.ghost(!(dock.classList.contains('ghost'))));
      dock.querySelector('#dbgCompact').addEventListener('click', ()=>{ const c=!dock.classList.contains('compact'); U.cls(dock,{compact:c}); U.lsSet(LS.COMPACT,c); });
      dock.querySelector('#dbgConsole').addEventListener('click', ()=> DBG.consoleBridge.toggle());
      dock.querySelector('#dbgSnapshot').addEventListener('click', ()=> DBG.captureSnapshot('manual'));
      dock.querySelector('#dbgExport').addEventListener('click', ()=> DBG.events.export());
      dock.querySelector('#ctrlParent').addEventListener('click', ()=> callControl('toggleParent'));
      dock.querySelector('#ctrlPlusAll').addEventListener('click', ()=> callControl('cookiesPlusAll'));
      dock.querySelector('#ctrlMinusAll').addEventListener('click', ()=> callControl('cookiesMinusAll'));
      dock.querySelector('#ctrlClear').addEventListener('click', ()=> callControl('cookiesClear'));
      dock.querySelector('#ctrlInspect').addEventListener('click', ()=> callControl('inspectActivities'));

      const lvlSel=dock.querySelector('#dbgLevels'); const chIn=dock.querySelector('#dbgChannels');
      const savedLevels = U.lsGet(LS.FILTER_LEVELS, ['log','ok','warn','err']);
      for (const opt of lvlSel.options){ opt.selected = savedLevels.includes(opt.value); }
      chIn.value = (U.lsGet(LS.FILTER_CHANNELS, [])||[]).join(',');
      lvlSel.addEventListener('change', ()=>{ const vals=Array.from(lvlSel.selectedOptions).map(o=>o.value); U.lsSet(LS.FILTER_LEVELS,vals); DBG.setFilter({levels:vals}); });
      chIn.addEventListener('change', ()=>{ const ch=chIn.value.split(',').map(s=>s.trim()).filter(Boolean); U.lsSet(LS.FILTER_CHANNELS,ch); DBG.setFilter({channels:ch}); });

      const head=dock.querySelector('.dbg-head'); let drag=false,sx=0,sy=0,startLeft=0,startTop=0;
      head.addEventListener('mousedown',e=>{drag=true;sx=e.clientX;sy=e.clientY;const r=dock.getBoundingClientRect();startLeft=r.left;startTop=r.top;e.preventDefault();});
      window.addEventListener('mousemove',e=>{if(!drag) return; const dx=e.clientX-sx, dy=e.clientY-sy; dock.style.left=(startLeft+dx)+'px'; dock.style.top=(startTop+dy)+'px'; dock.style.right='auto'; dock.style.bottom='auto';});
      window.addEventListener('mouseup',()=>{ if(drag){ drag=false; U.lsSet(LS.POS,{left:dock.style.left, top:dock.style.top}); }});
    }
    return dock;
  }

  function ensureBug(){
    cssOnce();
    let b=document.getElementById(BUG_ID);
    if(!b){
      b=document.createElement('button');
      b.id=BUG_ID;
      b.textContent='🐞';
      b.title='Tap 5× to open';
      document.body.appendChild(b);

      const OPEN_CLICKS = 5;
      const OPEN_WINDOW_MS = 1500; // time window for the multi-clicks
      let tapCount = 0;
      let firstTs = 0;

      b.addEventListener('click', ()=>{
        const dock = ensureDock();
        const visible = dock.getAttribute('data-visible') !== 'false';
        const now = Date.now();

        if (!visible){
          // gated open: 5 taps within the window
          if (!firstTs || (now - firstTs) > OPEN_WINDOW_MS){ firstTs = now; tapCount = 0; }
          tapCount++;
          b.title = `Tap ${Math.max(0, OPEN_CLICKS - tapCount)}× more to open…`;
          if (tapCount >= OPEN_CLICKS){
            dock.setAttribute('data-visible','true'); U.lsSet(LS.VIS, true);
            tapCount = 0; firstTs = 0; b.title = 'Click to hide';
          }
        } else {
          // visible → single click hides
          dock.setAttribute('data-visible','false'); U.lsSet(LS.VIS, false);
          b.title = 'Tap 5× to open';
        }
      });

      // keep your existing dblclick “un-ghost”
      b.addEventListener('dblclick', ()=>{ try{ DBG.ghost(false); }catch{} });
    }
    return b;
  }


  const filters={levels:new Set(U.lsGet(LS.FILTER_LEVELS,['log','ok','warn','err'])), channels:new Set(U.lsGet(LS.FILTER_CHANNELS,[]))};
  function passFilter(level,channel){ if(!filters.levels.has(level)) return false; if(filters.channels.size===0) return true; return channel && filters.channels.has(channel); }

  const Smart={
    _dock:null,_body:null,_state:null,_mini:null,_actions:null,_timers:Object.create(null),_console:null,_snapshotFn:null,
    boot(){
      this._dock=ensureDock(); this._body=this._dock.querySelector('#dbgBody'); this._state=this._dock.querySelector('#dbgState');
      this._mini=this._dock.querySelector('#dbgMiniState'); this._actions=this._dock.querySelector('.dbg-actions');
      ensureBug();
      this._installTraps();
      this.ok('Debugger ready');
      if (Array.isArray(PREBOOT) && PREBOOT.length){ this.warn('Flushing preboot logs:', PREBOOT.length); PREBOOT.forEach(args=>this._emitRow(...args)); PREBOOT.length=0; }
      if (U.lsGet(LS.CONSOLE,false)) this.consoleBridge.enable();
      return this;
    },
    _installTraps(){
      window.addEventListener('error', e=>{ this.err('Uncaught:', (e&&e.message)?e.message:String(e)); });
      window.addEventListener('unhandledrejection', e=>{ const r=e&&(e.reason&&e.reason.message?e.reason.message:e.reason); this.err('Promise rejection:', String(r)); });
    },
    _emitRow(level,channel,msg){ if(!passFilter(level,channel)) return; const d=document.createElement('div'); d.className='dbg-row '+(level||'log'); const prefix=channel?`[${channel}] `:''; d.textContent=prefix+msg; this._body.prepend(d); },
    _row(level,channel,args){ const txt=Array.from(args).map(a=>(a&&a.stack)?(a.message||String(a)):(typeof a==='object'?JSON.stringify(a):String(a))).join(' '); this._emitRow(level,channel,txt); },
    log(){ this._row('log','',arguments); }, ok(){ this._row('ok','',arguments); }, warn(){ this._row('warn','',arguments); }, err(){ this._row('err','',arguments); },
    setState(t){ if(this._state) this._state.textContent=t; if(this._mini) this._mini.textContent=t; },
    addAction(lbl,fn){ const b=document.createElement('button'); b.textContent=lbl; b.addEventListener('click',fn); this._actions.appendChild(b); return b; },
    time(k){ this._timers[k]=performance.now(); }, timeEnd(k,l){ const t0=this._timers[k]; if(t0==null) return; const dt=performance.now()-t0; this.ok((l||k)+' '+dt.toFixed(1)+'ms'); delete this._timers[k]; },
    assert(c,m){ if(!c){ const t='ASSERT: '+(m||'failed'); this.err(t); throw new Error(t);} return true; },
    channel(name){ const prefix='['+name+']'; return { log:(...a)=>Smart._row('log',name,a), ok:(...a)=>Smart._row('ok',name,a), warn:(...a)=>Smart._row('warn',name,a), err:(...a)=>Smart._row('err',name,a),
      time:(k)=>Smart.time(name+':'+k), timeEnd:(k,l)=>Smart.timeEnd(name+':'+k,l||(name+':'+k)), assert:(c,m)=>Smart.assert(c, prefix+' '+(m||'')) }; },
    setFilter({levels,channels}){ if(levels){filters.levels=new Set(levels); U.lsSet(LS.FILTER_LEVELS,Array.from(filters.levels));} if(channels){filters.channels=new Set(channels); U.lsSet(LS.FILTER_CHANNELS,Array.from(filters.channels));} },
    ghost(v){ const dock=ensureDock(); U.cls(dock,{ghost:!!v}); U.lsSet(LS.GHOST,!!v); },
    consoleBridge:{ enable(){ if(Smart._console) return; Smart._console={...console}; U.lsSet(LS.CONSOLE,true);
        console.log=(...a)=>{Smart._row('log','console',a); Smart._console.log.apply(console,a);};
        console.info=(...a)=>{Smart._row('ok','console',a); Smart._console.info.apply(console,a);};
        console.warn=(...a)=>{Smart._row('warn','console',a); Smart._console.warn.apply(console,a);};
        console.error=(...a)=>{Smart._row('err','console',a); Smart._console.error.apply(console,a);};
        Smart.ok('[console] bridged'); },
      disable(){ if(!Smart._console) return; console.log=Smart._console.log; console.info=Smart._console.info; console.warn=Smart._console.warn; console.error=Smart._console.error; Smart._console=null; U.lsSet(LS.CONSOLE,false); Smart.warn('[console] restored'); },
      toggle(){ (Smart._console?this.disable:this.enable)(); } },
    registerSnapshot(fn){ this._snapshotFn=fn; },
    captureSnapshot(label){ try{ const snap=this._snapshotFn?this._snapshotFn():{note:'no snapshot fn'}; Events.add('snapshot',{label,at:U.nowISO(),snap}); this.ok('[snapshot] captured'); }catch(e){ this.err('[snapshot] failed '+e.message); } }
  };

  const Events={ max:300, buf:U.lsGet(LS.EVENTS,[]),
    add(name,payload){ const rec={name,at:U.nowISO(),payload}; this.buf.push(rec); if(this.buf.length>this.max) this.buf.shift(); U.lsSet(LS.EVENTS,this.buf); if(name!=='snapshot'){ Smart._row('log','event',[name+' '+JSON.stringify(payload)]); } },
    export(){ U.dlJSON('debug-events.json', this.buf); }
  };
  function logEvent(name,data){ Events.add(name,data); }

  const DBG=Smart.boot(); DBG.events=Events; DBG.logEvent=logEvent; window.DBG=DBG;
  DBG.controls = { use(adapter){ try{ window.AppControls=adapter; Smart.ok('[controls] adapter bound'); }catch(e){ Smart.err('[controls] bind failed '+e.message); } } };

  window.__DBG_PUSH__ = function(level,channel,msg){ if(window.DBG){ window.DBG._emitRow(level,channel,msg); } else { (window.__DBG_QUEUE__=window.__DBG_QUEUE__||[]).push([level,channel,msg]); } };
})();