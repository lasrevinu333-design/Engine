(function(root){
  'use strict';
  const DATA=root.MemphisOperationsData;
  const API='https://memphis-zoo-mcp.onrender.com';
  const WEATHER='https://api.open-meteo.com/v1/forecast?latitude=35.1506&longitude=-89.9944&current=temperature_2m,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timeformat=unixtime&timezone=America%2FChicago&forecast_days=2';
  const KINDS=Object.freeze(['activity','tickets','events','schools','spiceworks','city','locations']);
  const ACTIVITY_KINDS=Object.freeze(['tickets']);
  // Close geographic/display neighbors, without changing any approved point.
  function nearby(pins,id){const seed=pins.find(p=>p.id===id);if(!seed)return[];
    return pins.filter(p=>p.id===id||Math.hypot(p.x-seed.x,p.y-seed.y)<=Math.max(22,p.radius)+Math.max(22,seed.radius)+8).map(p=>p.id);}
  function create({document=root.document,window=root,now=()=>Date.now(),audience='manager'}={}){
    const publicRead=audience==='public_readonly';
    const activityKinds=publicRead?['tickets']:ACTIVITY_KINDS;
    if(!DATA||!document?.getElementById('operations-panels'))return null;
    const cleaningView=publicRead?DATA.publicCleaning:DATA.cleaning;
    const el=id=>document.getElementById(id),panel=el('operations-panels'),dialog=el('operations-board'),content=el('operations-board-content');
    const page=document.documentElement||document.querySelector('main');
    const listeners=[],listen=(target,event,fn,options)=>{target?.addEventListener(event,fn,options);listeners.push([target,event,fn,options]);};
    let active=false,closed=false,epoch=0,abort=null,requestTimer=null,map=null,summary=null,ops=null,board=null,opener=null;
    let frame=null,lastFrame=null,hold=false,paused=false,motionPaused=false,mapExpanded=false,fsEpoch=0;
    let boardToken=null,priorHistory=null,boardFingerprint='',lastMinute=null,nearbyIds=null,fallbackInert=null;
    let owner=null,currentRead=null,cleaning=null,lastAttendance=null,lastWeather=null;
    let tickerFrame=null,tickerTime=null,returnedTicker=null,mapScrollSize='';const tickerMotion=new Map();
    const delayedFeeds=new Set();
    const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const txt=(id,value)=>{const node=el(id);if(node&&node.textContent!==String(value))node.textContent=value;};
    const make=(tag,value,klass)=>{const node=document.createElement(tag);if(value!=null)node.textContent=value;if(klass)node.className=klass;return node;};
    function measureTickers(){
      const stage=el('dashboard-map');
      if(stage?.clientWidth>0&&stage.scrollWidth>0){
        const size=stage.clientWidth+'|'+stage.scrollWidth;
        // Start a narrow viewport at the center of the unchanged readable map.
        // Recenter only when its dimensions change; refreshes retain user pan.
        if(size!==mapScrollSize){stage.scrollLeft=Math.max(0,(stage.scrollWidth-stage.clientWidth)/2);mapScrollSize=size;}
      }
      for(const kind of ['activity','tickets','events','schools','spiceworks','city','locations']){
        const track=el('ops-'+kind+'-ticker'),width=track?.parentElement?.clientWidth;
        if(!width||!track.style)continue;
        const distance=Math.max(0,track.getBoundingClientRect().width-width);
        // Restore the approved mockup's reading speeds, independent of feed size.
        const duration=Math.max(20,distance/(kind==='locations'?34:42));
        const signature=distance+'|'+duration;
        if(track.dataset.motionSize===signature)continue;
        track.dataset.motionSize=signature;
        track.style.setProperty('--ticker-distance',distance+'px');
        track.style.setProperty('--ticker-duration',duration+'s');
        const prior=tickerMotion.get(kind);
        tickerMotion.set(kind,{track,viewport:track.parentElement,distance,speed:kind==='locations'?34:42,
          position:Math.min(distance,prior?.position||0)});
      }
      if(active&&!closed&&tickerFrame===null&&tickerMotion.size)tickerFrame=window.requestAnimationFrame(scrollTickers);
    }
    function scrollTickers(time){
      tickerFrame=null;if(!active||closed)return;
      const dt=tickerTime===null?0:Math.max(0,Math.min(100,time-tickerTime));tickerTime=time;
      if(!motionPaused&&!motion?.matches&&!document.hidden&&!board)for(const item of tickerMotion.values()){
        const band=item.viewport.parentElement;
        // Restoring the opener's focus after a modal is navigation, not a new
        // request to pause. Keep keyboard focus without stranding its ticker.
        if(band?.matches?.(':hover')||(band!==returnedTicker&&band?.matches?.(':focus-within')))continue;
        item.position=item.distance>0?(item.position>=item.distance?0:Math.min(item.distance,item.position+item.speed*dt/1000)):0;
        // Scroll the viewport instead of translating an enormous GPU layer.
        // Long City feeds remain painted at every position, including refresh.
        item.viewport.scrollLeft=item.position;
      }
      tickerFrame=window.requestAnimationFrame(scrollTickers);
    }
    function recordTicker(id,rows,empty){
      const track=el(id);if(!track)return;
      const signature=JSON.stringify(rows.length?rows:[empty]);
      if(track.dataset.recordsFingerprint===signature)return;
      track.dataset.recordsFingerprint=signature;
      track.replaceChildren(...(rows.length?rows:[empty]).map(text=>make('span',text,'tickerRecord')));
    }
    function pins(){return Array.from(el('dashboard-map').querySelectorAll('.mzMapPin'));}
    function session(){try{const s=window.MemphisAuth?.readSession?.();
      if(s?.role!=='ops_manager'||!['manager_id','credential_id','token','device_id'].every(k=>typeof s[k]==='string'&&s[k]))return null;
      return{manager_id:s.manager_id,credential_id:s.credential_id,token:s.token,device_id:s.device_id};
    }catch{return null;}}
    const same=(a,b)=>!!a&&!!b&&['manager_id','credential_id','token','device_id'].every(k=>a[k]===b[k]);
    const sameOwner=()=>publicRead||same(owner,session());
    function bound(read=currentRead){try{return active&&!closed&&sameOwner()
      &&(!read||(read.epoch===epoch&&read===currentRead&&read.isCurrent()&&active&&!closed&&read.epoch===epoch&&sameOwner()));
    }catch{return false;}}
    function approved(){return pins().map(p=>({id:p.dataset.locationId,name:p.dataset.approvedLocationName}));}
    function locationBoard(){const v=cleaning||cleaningView(null,approved(),now());
      return{...v,title:nearbyIds?'Nearby locations':v.title,cards:v.cards.filter(p=>!nearbyIds||nearbyIds.includes(p.id))};}
    function view(kind){if(kind==='locations')return locationBoard();
      if(kind==='activity'){const feeds=activityKinds.map(kind=>view(kind));return{title:publicRead?'Open tickets':'Activity',cards:feeds.flatMap((feed,index)=>feed.cards.filter(card=>index!==1||card.active)),note:feeds.map(feed=>feed.note).join('\n')};}
      if(kind==='tickets')return {...DATA.tickets(summary,null),note:!summary?'Internal Custodial tickets unavailable.':publicRead?'Read-only internal Custodial tickets.':'Open the Dashboard to resolve eligible internal Custodial tickets.'};
      if(kind==='events')return ops?DATA.events(ops.events,now()):{title:'Events',cards:[],note:'Structured event feed unavailable.'};
      if(kind==='spiceworks')return DATA.spiceworksActivity(ops?.spiceworks_activity,now());
      if(kind==='city')return DATA.cityWorkOrders(ops?.city);
      return DATA.schools(ops?.schools,now());}
    function renderBoard(force=false){if(!board)return;
      const v=DATA.operationalView(board,view(board));
      if(delayedFeeds.has(board))v.note+=' Update delayed. Showing the last received records.';
      const fingerprint=JSON.stringify(v);if(!force&&fingerprint===boardFingerprint)return;
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
    function renderHighLow(){txt('ops-weather-high-low',lastWeather?.day===DATA.localDate(now())?lastWeather.highLow:'High/low unavailable.');}
    function tick(){if(!active||closed)return;
      if(!bound()){unavailable();return;}
      renderHighLow();
      const at=new Date(now());txt('ops-clock',new Intl.DateTimeFormat('en-US',{timeZone:DATA.ZONE,hour:'numeric',minute:'2-digit',second:'2-digit'}).format(at));
      txt('ops-date',new Intl.DateTimeFormat('en-US',{timeZone:DATA.ZONE,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(at));
      const minute=Math.floor(now()/60000);
      if(minute!==lastMinute){lastMinute=minute;renderFeeds();}
      else renderActivity();

    }
    function renderActivity(){
      const labels={tickets:'TICKETS'};
      const activity=activityKinds.flatMap(kind=>{const feed=view(kind),cards=feed.cards.filter(card=>kind!=='events'||card.active);
        return (cards.length?cards.map(card=>card.title):[summary?'No open tickets':'Tickets unavailable']).map(text=>labels[kind]+': '+text);});
      recordTicker('ops-activity-ticker',activity,'Tickets unavailable');
      const events=ops?DATA.events(ops.events,now(),{labelToday:true}).cards.filter(card=>card.active):[];
      recordTicker('ops-events-ticker',events.map(card=>`${card.title} · ${card.lines[0]} · ${card.lines[1]} · ${card.lines[2]}`),ops?'No upcoming events loaded':'Events unavailable');
      const schoolRows=DATA.orderedSchools(ops?.schools).filter(row=>!['CANCELLED','SUPERSEDED'].includes(row.status)&&row.date>=DATA.localDate(now()));
      const count=value=>DATA.count(value)===null?'Unknown':String(value);
      recordTicker('ops-schools-ticker',schoolRows.map(row=>`${DATA.text(row.name)} · ${DATA.calendarDate(row.date,DATA.localDate(now()))} · Expected ${DATA.clock(row.arrival_at)} · ${count(row.buses)} buses · ${count(DATA.count(row.students)!==null&&DATA.count(row.adults)!==null?row.students+row.adults:null)} planned people`),ops?.schools?.state==='snapshot'||ops?.schools?.state==='current'?'No upcoming school visits loaded':'School visits unavailable');
      const internal=view('tickets');
      recordTicker('ops-tickets-ticker',internal.cards.map(card=>`${card.title} · ${card.lines[0]} · ${card.lines[1]}`),summary?'No open Custodial tickets':'Custodial tickets unavailable');
      const spice=view('spiceworks'),city=view('city');
      recordTicker('ops-spiceworks-ticker',spice.cards.map(card=>`${card.title} · ${card.lines[0]}`),spice.note);
      recordTicker('ops-city-ticker',city.cards.map(card=>`${card.title} · ${card.status} · ${card.lines[1]}`),city.note);
      for(const kind of ['events','schools','spiceworks','city']){
        const track=el('ops-'+kind+'-ticker'),band=track?.parentElement?.parentElement;
        const delayed=delayedFeeds.has(kind);
        if(band){band.dataset.stale=String(delayed);band.title=delayed?'Update delayed. Showing the last received records.':'';}
      }
      measureTickers();
    }
    function renderFeeds(){
      if(el('ops-mod-card'))el('ops-mod-card').hidden=publicRead;
      txt('ops-mod',publicRead?'':DATA.managerOnDuty(ops?.manager_on_duty,now()));
      renderActivity();const locations=view('locations');
      const labels={okay:'Cleaned',in_progress:'In progress',due_soon:'Due soon',overdue:'Overdue',not_cleaned:'Not cleaned',pending_submit:'Saved pending',unknown:'Unavailable'};
      const ticker=el('ops-locations-ticker');
      if(ticker){
        const fingerprint=JSON.stringify(locations.cards.map(card=>[card.id,card.title,card.state,card.lines[0]]));
        if(ticker.dataset.locationsFingerprint!==fingerprint){
          ticker.dataset.locationsFingerprint=fingerprint;
          ticker.replaceChildren(...(locations.cards.length?locations.cards.map(card=>{
            const state=Object.hasOwn(labels,card.state)?card.state:'unknown';
            const currentWorker=state==='in_progress'?card.lines.find(line=>line.startsWith('Cleaning now,')):null;
            const item=make('span',`${card.title} — ${currentWorker||labels[state]}`,'locationTickerItem');
            item.dataset.status=state;return item;
          }):[make('span',locations.note)]));
        }
      }
      measureTickers();
      const counts=new Map();for(const card of (cleaning||cleaningView(null,approved(),now())).cards)
        counts.set(card.state,(counts.get(card.state)||0)+1);
      el('ops-status-counts')?.replaceChildren(...[...counts].map(([status,n])=>{const node=make('span',`${n} ${status.replaceAll('_',' ')}`);node.dataset.status=status;return node;}));
      renderBoard();
    }
    function cancel(){epoch++;abort?.abort();abort=null;if(requestTimer!==null)window.clearTimeout(requestTimer);requestTimer=null;}
    function beginRefresh({isCurrent}){
      cancel();currentRead={epoch,isCurrent};
      if(typeof isCurrent!=='function'||!bound()){unavailable();return false;}
      return true;
    }
    function summaryUnavailable(){summary=null;cleaning=null;renderFeeds();}
    function updateSummary({summary:next,isCurrent}){
      if(typeof isCurrent!=='function'||!isCurrent()||!bound())return false;
      summary=next;cleaning=cleaningView(next,approved(),now());renderFeeds();return true;
    }
    async function refresh({headers,fetchImpl,isCurrent,summary:next,preserveSummary=false}){
      if(!active||closed)return;cancel();const generation=epoch;abort=new AbortController();const signal=abort.signal;
      currentRead={epoch:generation,isCurrent};
      if(typeof isCurrent!=='function'||!bound()){unavailable();return;}
      requestTimer=window.setTimeout(()=>{if(generation===epoch)abort?.abort();},10000);
      // Snapshot the safe record presentation at admission, not from mutable
      // caller rows after an unrelated awaited feed. Never infer from pin text.
      if(!preserveSummary){summary=next;cleaning=cleaningView(next,approved(),now());}
      renderFeeds();
      const load=async(url,privateFeed=true)=>{const response=await fetchImpl(url,{method:'GET',cache:'no-store',redirect:'error',signal,...(publicRead?{credentials:'omit'}:privateFeed?{headers}:{})});
        if(!response.ok)throw new Error('feed_unavailable');return response.json();};
      const publish=()=>{
        if(closed||!active||generation!==epoch)return false;
        if(!bound()){unavailable();return false;}return true;
      };
      // Each independent source publishes when it settles. A database failure
      // must not suppress an available forecast or turn unknown facts into zero.
      const tasks=[
        load(`${API}/dashboard-api/current-attendance`).catch(()=>null).then(value=>{
          if(!publish())return;const attendance=DATA.attendance(value);
          if(attendance.value!=='Unavailable')lastAttendance=attendance;
          txt('ops-attendance',attendance.value==='Unavailable'&&lastAttendance?lastAttendance.value:attendance.value);
          txt('ops-attendance-note',attendance.value==='Unavailable'&&lastAttendance?`${lastAttendance.note} · Update delayed`:attendance.note);el('ops-attendance-note').dataset.stale=String(attendance.stale);
        }),
        load(WEATHER,false).catch(()=>null).then(value=>{
          if(!publish())return;const weather=DATA.weather(value,now());
          if(weather.value!=='Unavailable')lastWeather=weather;renderHighLow();
          txt('ops-weather',weather.value==='Unavailable'&&lastWeather?lastWeather.value:weather.value);
          txt('ops-weather-note',weather.value==='Unavailable'&&lastWeather?`${lastWeather.note} · Update delayed`:weather.note);el('ops-weather-note').dataset.stale=String(weather.stale);txt('ops-hour',weather.value==='Unavailable'&&lastWeather?lastWeather.hour:weather.hour);
        })
      ];
      // Public tickers use only the existing sanitized viewer projection.
      // No manager headers, source mail, or schedule reads are used there.
      tasks.push(load(`${API}/${publicRead?'viewer-api':'dashboard-api'}/operations`).catch(()=>null).then(value=>{
        if(!publish())return;let replacement=null;try{replacement=DATA.operations(value);}catch{}
        delayedFeeds.clear();
        if(replacement){
          for(const [field,kind] of [['schools','schools'],['spiceworks_activity','spiceworks'],['city','city']]){
            if(replacement[field]?.state==='unavailable'&&ops?.[field]?.state!=='unavailable'&&ops?.[field]){
              replacement[field]=ops[field];delayedFeeds.add(kind);
            }
          }
          ops=replacement;
        }else if(ops){ops.manager_on_duty=null;for(const kind of ['events','schools','spiceworks','city'])delayedFeeds.add(kind);}
        renderFeeds();
      }));
      await Promise.allSettled(tasks);
      if(generation===epoch&&requestTimer!==null){window.clearTimeout(requestTimer);requestTimer=null;}
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
      returnedTicker=focus&&active?opener?.closest?.('.tickerBand')||null:null;
      if(focus&&active)opener?.focus?.({preventScroll:true});opener=null;
      tickerTime=null;measureTickers();
    }
    function openBoard(kind,trigger,ids=null){
      if(!active||closed)return;if(!bound()){unavailable();return;}
      if(publicRead&&!['activity','tickets','events','schools','spiceworks','city','locations'].includes(kind))return;
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
      if(target===page&&mapExpanded){await exitMap();return;}
      try{if(!document.fullscreenEnabled||!target.requestFullscreen)throw new Error('fallback');await target.requestFullscreen();}
      catch{if(!active||closed||expected!==fsEpoch)return;
        if(target===dialog)txt('operations-board-note',`${view(board).note}\nNative fullscreen unavailable; this board fills the browser window.`);
        else {target.classList.add('dashboard-expanded');el('operations-map-fullscreen').title='Browser fullscreen is unavailable. The dashboard fills the page.';}}
      if(!active||closed||expected!==fsEpoch){if(document.fullscreenElement===target)void document.exitFullscreen?.().catch(()=>{});return;}
      if(target===page){mapExpanded=true;el('operations-map-fullscreen').setAttribute('aria-pressed','true');txt('operations-map-fullscreen',document.fullscreenElement===page?'Exit full screen':'Exit expanded view');}
    }
    async function exitMap(){const target=page;fsEpoch++;mapExpanded=false;target.classList.remove('dashboard-expanded');
      if(document.fullscreenElement===target)await document.exitFullscreen?.().catch(()=>{});
      el('operations-map-fullscreen').setAttribute('aria-pressed','false');el('operations-map-fullscreen').title='';txt('operations-map-fullscreen','⛶ Full screen');}
    function unavailable({preserveBoard=false,preserveMap=false}={}){cancel();currentRead=null;summary=null;cleaning=null;ops=null;delayedFeeds.clear();lastAttendance=null;lastWeather=null;
      const preserveOwner=active&&!closed&&sameOwner();
      if(!preserveBoard||!preserveOwner)closeBoard({history:false,focus:false});
      if(!preserveMap||!preserveOwner)void exitMap();
      txt('ops-attendance','Unavailable');txt('ops-attendance-note','Current gate count unavailable.');txt('ops-weather','Unavailable');txt('ops-weather-note','Current weather unavailable.');txt('ops-hour','Next-hour forecast unavailable.');renderHighLow();renderFeeds();}
    function suspend(){active=false;if(tickerFrame!==null)window.cancelAnimationFrame(tickerFrame);tickerFrame=null;tickerTime=null;unavailable();panel.hidden=true;el('ops-locations-button').hidden=true;}
    function activate(renderer){if(closed)return;map=renderer;owner=publicRead?null:session();active=publicRead||!!owner;
      panel.hidden=!active;el('ops-locations-button').hidden=!active;if(active)tick();else unavailable();}
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
    listen(panel,'focusin',event=>{if(event.target!==returnedTicker)returnedTicker=null;});
    listen(panel,'pointerdown',()=>{returnedTicker=null;});
    listen(el('operations-motion'),'click',()=>{motionPaused=!motionPaused;document.body.classList.toggle('motionPaused',motionPaused);
      el('operations-motion').setAttribute('aria-pressed',String(motionPaused));txt('operations-motion',motionPaused?'Resume motion':'Pause motion');});
    listen(el('operations-board-fullscreen'),'click',()=>void fullscreen(dialog));
    listen(el('operations-map-fullscreen'),'click',()=>void fullscreen(page));
    listen(document,'fullscreenchange',()=>{if(mapExpanded&&document.fullscreenElement!==page&&!page.classList.contains('dashboard-expanded'))void exitMap();});
    listen(document,'keydown',event=>{if(event.key==='Escape'&&!board&&mapExpanded){event.preventDefault();void exitMap();}});
    listen(window,'popstate',()=>{if(board)closeBoard({history:false});});
    listen(window,'resize',measureTickers);
    listen(motion,'change',()=>{if(motion.matches){paused=true;syncPause();}});
    const viewport=el('dashboard-map').querySelector('[data-map-viewport]');
    listen(viewport,'click',event=>{const pin=event.target.closest?.('.mzMapPin');if(!pin||!active)return;
      const candidates=nearby(pins().map(p=>{const r=p.getBoundingClientRect();return{id:p.dataset.locationId,x:r.left+r.width/2,y:r.top+r.height/2,radius:Math.max(r.width,r.height)/2};}),pin.dataset.locationId);
      if(candidates.length>1){event.preventDefault();event.stopPropagation();openBoard('locations',pin,candidates);}},true);
    return Object.freeze({activate,beginRefresh,refresh,updateSummary,summaryUnavailable,tick,unavailable,suspend,stop,openBoard,closeBoard});
  }
  root.MemphisOperationsDashboard=Object.freeze({create,nearby,WEATHER});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisOperationsDashboard;
})(typeof globalThis!=='undefined'?globalThis:this);
