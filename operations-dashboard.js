(function(root){
  'use strict';
  const DATA=root.MemphisOperationsData;
  const API='https://memphis-zoo-mcp.onrender.com';
  const WEATHER='https://api.open-meteo.com/v1/forecast?latitude=35.1506&longitude=-89.9944&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability&temperature_unit=fahrenheit&timeformat=unixtime&timezone=America%2FChicago&forecast_days=2';
  const KINDS=Object.freeze(['tickets','events','schools','locations']);
  // Close geographic/display neighbors, without changing any approved point.
  function nearby(pins,id){const seed=pins.find(p=>p.id===id);if(!seed)return[];
    return pins.filter(p=>p.id===id||Math.hypot(p.x-seed.x,p.y-seed.y)<=Math.max(22,p.radius)+Math.max(22,seed.radius)+8).map(p=>p.id);}
  function create({document=root.document,window=root,now=()=>Date.now()}={}){
    if(!DATA||!document?.getElementById('operations-panels'))return null;
    const el=id=>document.getElementById(id),panel=el('operations-panels'),dialog=el('operations-board'),content=el('operations-board-content');
    const listeners=[],listen=(target,event,fn,options)=>{target?.addEventListener(event,fn,options);listeners.push([target,event,fn,options]);};
    let active=false,closed=false,epoch=0,abort=null,requestTimer=null,map=null,summary=null,ops=null,board=null,opener=null;
    let frame=null,lastFrame=null,hold=false,paused=false,motionPaused=false,mapExpanded=false,fsEpoch=0;
    let boardToken=null,priorHistory=null,boardFingerprint='',lastMinute=null,nearbyIds=null,fallbackInert=null;
    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const txt=(id,value)=>{el(id).textContent=value;};
    const make=(tag,value,klass)=>{const node=document.createElement(tag);if(value!=null)node.textContent=value;if(klass)node.className=klass;return node;};
    function pins(){return Array.from(el('dashboard-map').querySelectorAll('.mzMapPin'));}
    function locationBoard(){return{title:nearbyIds?'Nearby locations':'All 47 locations',note:'Authoritative cleaning states from the existing Dashboard. Pins are fixed approved locations, not phone GPS.',
      cards:pins().filter(p=>!nearbyIds||nearbyIds.includes(p.dataset.locationId)).map(p=>({id:p.dataset.locationId,source:'Cleaning location',title:p.getAttribute('aria-label'),state:p.dataset.status,lines:[],location:true}))};}
    function view(kind){if(kind==='locations')return locationBoard();
      if(kind==='tickets')return DATA.tickets(summary,ops?.spiceworks);
      if(kind==='events')return ops?DATA.events(ops.events,now()):{title:'Events',cards:[],note:'Structured event feed unavailable.'};
      return DATA.schools(ops?.schools,now());}
    function renderBoard(force=false){if(!board)return;
      const v=view(board),fingerprint=JSON.stringify(v);if(!force&&fingerprint===boardFingerprint)return;
      boardFingerprint=fingerprint;const top=content.scrollTop,focused=document.activeElement?.dataset?.locationSelect;
      txt('operations-board-title',v.title);txt('operations-board-note',v.note);
      const cardNode=card=>{
        const article=make('article',null,'boardCard');article.dataset.state=card.state;
        article.append(make('span',card.source,'sourceTag'),make('h3',card.title));
        for(const line of card.lines)article.append(make('p',line));
        if(card.location){const button=make('button','Show on map');button.type='button';button.dataset.locationSelect=card.id;article.append(button);}
        return article;
      };
      const nodes=v.cards.length?v.cards.map(cardNode):[make('p','No active rows to display. Check the source status above.','boardCard')];
      if(v.history?.length){const history=make('details');history.append(make('summary',`${board==='schools'?'Daily visit history':'Event history'} · ${v.history.length} records (not active)`),...v.history.map(cardNode));nodes.push(history);}
      content.replaceChildren(...nodes);
      content.scrollTop=top;
      if(focused)Array.from(content.querySelectorAll('[data-location-select]')).find(n=>n.dataset.locationSelect===focused)?.focus({preventScroll:true});
    }
    function tick(){if(!active||closed)return;
      const at=new Date(now());txt('ops-clock',new Intl.DateTimeFormat('en-US',{timeZone:DATA.ZONE,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(at));
      txt('ops-date',new Intl.DateTimeFormat('en-US',{timeZone:DATA.ZONE,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(at));
      const minute=Math.floor(now()/60000);
      if(minute!==lastMinute){lastMinute=minute;renderFeeds();}
      else{const events=view('events'),text=events.cards.filter(c=>c.active).map(c=>c.title).join('   •   ')||'No active upcoming events.';
        if(el('ops-events-ticker').textContent!==text)txt('ops-events-ticker',text);}

    }
    function renderFeeds(){
      for(const kind of KINDS){const v=view(kind);txt(`ops-${kind}-ticker`,v.cards.length?v.cards.filter(c=>kind!=='events'||c.active).map(c=>c.title).join('   •   ')||'No active upcoming events.':v.note);}
      const counts=new Map();for(const pin of pins())counts.set(pin.dataset.status,(counts.get(pin.dataset.status)||0)+1);
      el('ops-status-counts').replaceChildren(...[...counts].map(([status,n])=>{const node=make('span',`${n} ${status.replaceAll('_',' ')}`);node.dataset.status=status;return node;}));
      renderBoard();
    }
    function cancel(){epoch++;abort?.abort();abort=null;if(requestTimer!==null)window.clearTimeout(requestTimer);requestTimer=null;}
    async function refresh({headers,fetchImpl,isCurrent,summary:next}){
      if(!active||closed)return;cancel();const generation=epoch;abort=new AbortController();const signal=abort.signal;
      requestTimer=window.setTimeout(()=>{if(generation===epoch)abort?.abort();},10000);
      summary=next;ops=null;renderFeeds();
      const load=async(url,privateFeed=true)=>{const response=await fetchImpl(url,{method:'GET',cache:'no-store',redirect:'error',signal,...(privateFeed?{headers}:{})});
        if(!response.ok)throw new Error('feed_unavailable');return response.json();};
      const results=await Promise.allSettled([load(`${API}/dashboard-api/operations`),load(`${API}/dashboard-api/current-attendance`),load(WEATHER,false)]);
      if(closed||!active||generation!==epoch||!isCurrent())return;
      if(requestTimer!==null)window.clearTimeout(requestTimer);requestTimer=null;
      try{ops=results[0].status==='fulfilled'?DATA.operations(results[0].value):null;}catch{ops=null;}
      const attendance=DATA.attendance(results[1].status==='fulfilled'?results[1].value:null),weather=DATA.weather(results[2].status==='fulfilled'?results[2].value:null,now());
      txt('ops-attendance',attendance.value);txt('ops-attendance-note',attendance.note);el('ops-attendance-note').dataset.stale=String(attendance.stale);
      txt('ops-weather',weather.value);txt('ops-weather-note',weather.note);el('ops-weather-note').dataset.stale=String(weather.stale);txt('ops-hour',weather.hour);
      renderFeeds();
    }
    function animate(time){frame=null;if(!board||!active||closed)return;
      const dt=lastFrame==null?0:Math.min(100,time-lastFrame);lastFrame=time;
      if(!paused&&!hold&&!motionPaused&&!motion?.matches&&!document.hidden){
        const bottom=Math.max(0,content.scrollHeight-content.clientHeight);
        if(bottom>0){const step=Number(el('operations-board-speed').value)*dt/1000;
          content.scrollTop=content.scrollTop>=bottom-1?0:Math.min(bottom,content.scrollTop+step);}
      }
      frame=window.requestAnimationFrame(animate);
    }
    function syncPause(){el('operations-board-pause').setAttribute('aria-pressed',String(paused));txt('operations-board-pause',paused?'Resume scrolling':'Pause scrolling');}
    function closeBoard({history=true,focus=true}={}){
      if(!board)return;board=null;nearbyIds=null;boardFingerprint='';lastFrame=null;fsEpoch++;
      if(frame!==null)window.cancelAnimationFrame(frame);frame=null;
      if(document.fullscreenElement===dialog)void document.exitFullscreen?.().catch(()=>{});
      if(dialog.open&&dialog.close)dialog.close();else dialog.removeAttribute('open');
      if(fallbackInert!==null){document.querySelector('main').inert=fallbackInert;fallbackInert=null;}
      if(history&&boardToken&&window.history?.state?.operationsBoard===boardToken)window.history.back();
      else if(boardToken&&window.history?.state?.operationsBoard===boardToken)window.history.replaceState(priorHistory,'');
      boardToken=null;priorHistory=null;content.replaceChildren();txt('operations-board-note','');
      if(focus&&active)opener?.focus?.({preventScroll:true});opener=null;
    }
    function openBoard(kind,trigger,ids=null){
      if(kind==='events'){
        if(!active||closed)return;const session=window.MemphisAuth?.readSession?.();
        if(session?.role!=='ops_manager'||!session.manager_id||!session.credential_id)return;
        const target=new URL('./events.html',window.location.href);target.searchParams.set('hub','manager');
        if(session.device_id)target.searchParams.set('device',session.device_id);
        window.location.assign(target.toString());return;
      }
      if(!active||closed||!KINDS.includes(kind))return;
      if(board)closeBoard({history:false,focus:false});
      board=kind;opener=trigger||document.activeElement;nearbyIds=ids;paused=motion?.matches===true;hold=false;syncPause();
      renderBoard(true);content.scrollTop=0;
      if(dialog.showModal)dialog.showModal();else {fallbackInert=document.querySelector('main').inert;document.querySelector('main').inert=true;dialog.setAttribute('open','');}
      priorHistory=window.history?.state;boardToken=`operations-${epoch}-${now()}`;
      window.history?.pushState?.({operationsBoard:boardToken},'');
      el('operations-board-close').focus();lastFrame=null;frame=window.requestAnimationFrame(animate);
    }
    async function fullscreen(target){
      if(!active||closed)return;const expected=++fsEpoch;
      if(target===el('dashboard-map')&&mapExpanded){await exitMap();return;}
      try{if(!document.fullscreenEnabled||!target.requestFullscreen)throw new Error('fallback');await target.requestFullscreen();}
      catch{if(!active||closed||expected!==fsEpoch)return;
        if(target===dialog)txt('operations-board-note',`${view(board).note}\nNative fullscreen unavailable; this board fills the browser window.`);
        else target.classList.add('is-expanded');}
      if(!active||closed||expected!==fsEpoch){if(document.fullscreenElement===target)void document.exitFullscreen?.().catch(()=>{});return;}
      if(target===el('dashboard-map')){mapExpanded=true;el('operations-map-fullscreen').setAttribute('aria-pressed','true');txt('operations-map-fullscreen','Exit map full screen');}
    }
    async function exitMap(){const target=el('dashboard-map');fsEpoch++;mapExpanded=false;target.classList.remove('is-expanded');
      if(document.fullscreenElement===target)await document.exitFullscreen?.().catch(()=>{});
      el('operations-map-fullscreen').setAttribute('aria-pressed','false');txt('operations-map-fullscreen','⛶ Map full screen');}
    function unavailable(){cancel();summary=null;ops=null;closeBoard({history:false,focus:false});void exitMap();
      txt('ops-attendance','Unavailable');txt('ops-attendance-note','Current gate count unavailable.');txt('ops-weather','Unavailable');txt('ops-weather-note','Current weather unavailable.');txt('ops-hour','Next-hour forecast unavailable.');renderFeeds();}
    function suspend(){active=false;unavailable();panel.hidden=true;el('ops-locations-button').hidden=true;}
    function activate(renderer){if(closed)return;map=renderer;active=true;panel.hidden=false;el('ops-locations-button').hidden=false;tick();}
    function stop(){if(closed)return;suspend();closed=true;for(const [target,event,fn,options]of listeners)target?.removeEventListener(event,fn,options);listeners.length=0;map=null;}
    for(const trigger of document.querySelectorAll('[data-board]'))listen(trigger,'click',()=>openBoard(trigger.dataset.board,trigger));
    listen(el('operations-board-close'),'click',()=>closeBoard());
    listen(dialog,'cancel',event=>{event.preventDefault();closeBoard();});
    listen(dialog,'keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();closeBoard();return;}
      if(event.key!=='Tab')return;const focusable=Array.from(dialog.querySelectorAll('button,select,[tabindex="0"]')).filter(n=>!n.hidden&&!n.disabled);
      const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    });
    listen(content,'click',event=>{const button=event.target.closest?.('[data-location-select]');if(!button)return;
      const id=button.dataset.locationSelect;closeBoard();map?.selectLocation?.(id);pins().find(p=>p.dataset.locationId===id)?.focus({preventScroll:true});});
    listen(content,'mouseenter',()=>{hold=true;});listen(content,'mouseleave',()=>{hold=false;});
    listen(content,'focusin',()=>{paused=true;syncPause();});listen(content,'wheel',()=>{paused=true;syncPause();},{passive:true});
    listen(content,'touchstart',()=>{paused=true;syncPause();},{passive:true});
    listen(el('operations-board-pause'),'click',()=>{paused=!paused;syncPause();});
    listen(el('operations-motion'),'click',()=>{motionPaused=!motionPaused;document.body.classList.toggle('motionPaused',motionPaused);
      el('operations-motion').setAttribute('aria-pressed',String(motionPaused));txt('operations-motion',motionPaused?'Resume motion':'Pause motion');});
    listen(el('operations-board-fullscreen'),'click',()=>void fullscreen(dialog));
    listen(el('operations-map-fullscreen'),'click',()=>void fullscreen(el('dashboard-map')));
    listen(document,'fullscreenchange',()=>{if(mapExpanded&&document.fullscreenElement!==el('dashboard-map')&&!el('dashboard-map').classList.contains('is-expanded'))void exitMap();});
    listen(document,'keydown',event=>{if(event.key==='Escape'&&!board&&mapExpanded){event.preventDefault();void exitMap();}});
    listen(window,'popstate',()=>{if(board)closeBoard({history:false});});
    listen(motion,'change',()=>{if(motion.matches){paused=true;syncPause();}});
    const viewport=el('dashboard-map').querySelector('[data-map-viewport]');
    listen(viewport,'click',event=>{const pin=event.target.closest?.('.mzMapPin');if(!pin||!active)return;
      const candidates=nearby(pins().map(p=>{const r=p.getBoundingClientRect();return{id:p.dataset.locationId,x:r.left+r.width/2,y:r.top+r.height/2,radius:Math.max(r.width,r.height)/2};}),pin.dataset.locationId);
      if(candidates.length>1){event.preventDefault();event.stopPropagation();openBoard('locations',pin,candidates);}},true);
    return Object.freeze({activate,refresh,tick,unavailable,suspend,stop,openBoard,closeBoard});
  }
  root.MemphisOperationsDashboard=Object.freeze({create,nearby,WEATHER});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisOperationsDashboard;
})(typeof globalThis!=='undefined'?globalThis:this);
