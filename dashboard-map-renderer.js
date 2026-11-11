(function(root){
  'use strict';
  const MAP=root.MemphisDashboardMapStaging;
  const FIT=root.MemphisCustodialGpsApprovedOverallFit;
  const PATH=root.MemphisCustodialGpsPathModel;
  // Full literal paths keep the approved closed asset graph visible to the
  // existing runtime scanner as well as to the browser; no dynamic directory
  // expansion, coordinate change, or alternative artwork selection.
  const ASSETS=Object.freeze({
    artwork:'./dashboard-map-assets/Memphis-Zoo-Approved-Overall-Fit-Art-Only-20261010.png',
    horizontalArtwork:'./dashboard-map-assets/Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png',
    icons:Object.freeze({
      men:'./dashboard-map-assets/custodial-men-icon.svg',
      women:'./dashboard-map-assets/custodial-women-icon.svg',
      building:'./dashboard-map-assets/custodial-building-icon.svg'
    })
  });
  const principal=session=>session?.manager_id&&session?.credential_id&&session?.token
    ?{managerId:session.manager_id,credentialId:session.credential_id,token:session.token,deviceId:session.device_id}:null;
  const same=(a,b)=>!!a&&!!b&&a.managerId===b.managerId&&a.credentialId===b.credentialId
    &&a.token===b.token&&a.deviceId===b.deviceId;
  // Presentation only: keep each approved anchor and search a small screen-pixel
  // neighborhood for an exposed icon. A leader ends at the unchanged anchor.
  // Reserve the largest 42px interactive size, so hover and status refreshes
  // do not move other icons. Narrow screens pan the same readable map.
  function separatePins(points,{width,top=0,bottom}){
    const placed=[],result=new Map(),gap=42,maxOffset=150;
    const inside=p=>p.x>=21&&p.x<=width-21&&p.y>=top+21&&p.y<=bottom-21;
    const collision=p=>placed.reduce((sum,q)=>sum+Math.max(0,gap-Math.hypot(p.x-q.x,p.y-q.y))**2,0);
    for(const point of [...points].sort((a,b)=>a.id.localeCompare(b.id))){
      let best={x:point.x,y:point.y},score=Infinity,found=false;
      for(let radius=0;radius<=maxOffset&&!found;radius+=4){
        const count=radius?Math.ceil(2*Math.PI*radius/4):1;
        for(let i=0;i<count;i++){
          const angle=2*Math.PI*i/count,p={x:point.x+radius*Math.cos(angle),y:point.y+radius*Math.sin(angle)};
          if(!inside(p))continue;
          const overlap=collision(p),cost=overlap*100+radius;
          if(cost<score){best=p;score=cost;}
          if(overlap===0){best=p;found=true;break;}
        }
      }
      placed.push(best);result.set(point.id,best);
    }
    return result;
  }
  function createRefreshGate({readSession,onState}){
    const owner=principal(readSession());
    if(!owner)throw new Error('Map staging requires an active named manager session');
    let generation=0,closed=false,suspended=false;
    function checkSession(){
      if(closed||suspended)return false;
      if(same(owner,principal(readSession())))return true;
      generation++;onState('principal_changed',null);return false;
    }
    return Object.freeze({
      begin(){if(!checkSession())return null;const ticket={generation:++generation,principal:owner};
        onState('loading',null);return ticket;},
      commit(ticket,summary){if(closed||suspended||!ticket||ticket.generation!==generation)return false;
        if(!same(owner,ticket.principal)||!checkSession())return false;
        onState('current',summary);return true;},
      isCurrent(ticket){return !closed&&!suspended&&!!ticket&&ticket.generation===generation
        &&same(owner,ticket.principal)&&checkSession();},
      fail(ticket){if(closed||suspended||!ticket||ticket.generation!==generation||!checkSession())return false;
        onState('unknown',null);return true;},
      checkSession,
      invalidate(){if(closed)return;generation++;onState('unknown',null);},
      suspend(){if(closed||suspended)return false;suspended=true;generation++;onState('unknown',null);return true;},
      resume(){if(closed||!suspended)return false;
        if(!same(owner,principal(readSession()))){generation++;onState('principal_changed',null);return false;}
        suspended=false;generation++;onState('unknown',null);return true;},
      close(){closed=true;generation++;onState('unknown',null);}
    });
  }
  // Public reads have page/request ownership, never a fabricated manager identity.
  function createPublicRefreshGate({onState}){
    let generation=0,closed=false,suspended=false;
    const current=ticket=>!closed&&!suspended&&!!ticket&&ticket.generation===generation;
    return Object.freeze({
      begin(){if(closed||suspended)return null;onState('loading',null);return{generation:++generation};},
      commit(ticket,summary){if(!current(ticket))return false;onState('current',summary);return true;},
      isCurrent:current,checkSession:()=>!closed&&!suspended,
      fail(ticket){if(!current(ticket))return false;onState('unknown',null);return true;},
      invalidate(){generation++;onState('unknown',null);},
      suspend(){if(closed||suspended)return false;suspended=true;generation++;onState('unknown',null);return true;},
      resume(){if(closed||!suspended)return false;suspended=false;generation++;onState('unknown',null);return true;},
      close(){closed=true;generation++;onState('unknown',null);}
    });
  }
  function create({section,auth,audience='manager',fetchImpl:fetch=root.fetch.bind(root),document=root.document,window=root}){
    const publicRead=audience==='public_readonly';
    const horizontal=section?.dataset?.mapPresentation==='original-horizontal';
    const displayPoint=point=>horizontal?FIT.rasterToNative(point):point;
    const displayWidth=horizontal?1282:FIT.WIDTH,displayHeight=horizontal?550:FIT.HEIGHT;
    if(!MAP||!FIT?.transformAnchors||!section||(!publicRead&&!auth?.readSession))throw new Error('Map staging requires the exact source bridge and accepted overall fit');
    const viewport=section.querySelector('[data-map-viewport]');
    const surface=section.querySelector('[data-map-surface]');
    const artwork=section.querySelector('[data-map-artwork]');
    const layer=section.querySelector('[data-map-layer]');
    const gpsLayer=section.querySelector('[data-map-gps-layer]');
    const gpsStatus=section.querySelector('[data-map-gps-status]');
    const status=section.querySelector('[data-map-status]');
    const alerts=section.querySelector('[data-map-alerts]');
    const selection=section.querySelector('[data-map-selection]');
    const locations=section.querySelector('[data-map-locations]');
    const alertCount=section.querySelector('[data-map-alert-count]');
    let anchors=null,markers=[],interaction=MAP.initialInteraction(),closed=false,suspended=false;
    let initialized=false,lifecycleGeneration=0,resizeBound=false,resizeObserver=null;
    const controls=[];
    const buttons=new Map();
    const options=new Map();
    const gpsUnavailable='Advisory GPS unavailable: measured active-work history is required. Owner-accepted visual fit; absolute map accuracy and walking domain are unverified.';
    function clearGps(message=gpsUnavailable){gpsLayer?.replaceChildren();if(gpsStatus)gpsStatus.textContent=message;}
    const gate=(publicRead?createPublicRefreshGate:createRefreshGate)({readSession:()=>auth.readSession(),onState:(kind,summary)=>{
      if(!anchors||closed)return;
      if(kind!=='current')clearGps();
      if(kind==='principal_changed')interaction=MAP.initialInteraction();
      markers=MAP.project({anchors,summary,transport:kind==='current'?(publicRead?'CURRENT_PUBLIC_READONLY_RESPONSE':'CURRENT_AUTHENTICATED_RESPONSE'):kind.toUpperCase()});
      interaction=MAP.reconcileUrgency(interaction,markers);
      status.textContent=kind==='current'?(publicRead?'Current read-only dashboard response':'Current authenticated dashboard response'):'Map cleaning status unavailable until a current response';
      render();
    }});
    function render(){
      if(!anchors||closed)return;
      // A hidden, suspended page has no layout. The first visible refresh or
      // resize observation fits it; never manufacture a scroll-sized surface.
      if(viewport.clientWidth<=0||viewport.clientHeight<=0)return;
      const fit=MAP.fitViewport({width:viewport.clientWidth,height:viewport.clientHeight,
        canvasWidth:displayWidth,canvasHeight:displayHeight});
      surface.style.width=`${fit.width}px`;
      surface.style.height=`${fit.height}px`;
      artwork.src=horizontal?ASSETS.horizontalArtwork:ASSETS.artwork;
      artwork.setAttribute?.('width',String(displayWidth));artwork.setAttribute?.('height',String(displayHeight));
      gpsLayer?.setAttribute('viewBox',`0 0 ${displayWidth} ${displayHeight}`);
      const urgent=[];
      const screenPoints=markers.map(marker=>({id:marker.locationId,...MAP.screenPoint(displayPoint(marker.canvasPoint),{fitScale:fit.fitScale,zoom:1})}));
      const spaced=horizontal?separatePins(screenPoints,{width:fit.width,top:55*fit.fitScale,bottom:431*fit.fitScale}):null;
      for(const marker of markers){
        const button=buttons.get(marker.locationId),view=MAP.presentation(marker,{interaction,
          reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true});
        if(!button)continue;
        const anchor=MAP.screenPoint(displayPoint(marker.canvasPoint),{fitScale:fit.fitScale,zoom:1});
        const point=spaced?.get(marker.locationId)||anchor;
        button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;
        button.dataset.anchorX=String(anchor.x);button.dataset.anchorY=String(anchor.y);
        const dx=anchor.x-point.x,dy=anchor.y-point.y;
        button.style.setProperty('--map-leader-length',`${Math.hypot(dx,dy)}px`);
        button.style.setProperty('--map-leader-angle',`${Math.atan2(dy,dx)}rad`);
        button.dataset.offset=String(Math.hypot(dx,dy)>.5);
        button.style.width=`${view.sizePx}px`;button.style.height=`${view.sizePx}px`;
        button.dataset.status=marker.status;button.dataset.pulse=view.pulse;
        button.dataset.details=String(view.detailsVisible);
        // Labels follow the visual icon; the leader retains geographic meaning.
        const viewportX=(viewport.clientWidth-fit.width)/2+point.x;
        const leftSpace=viewportX-view.sizePx/2-5,rightSpace=viewport.clientWidth-viewportX-view.sizePx/2-5;
        const labelRight=rightSpace>=240||rightSpace>=leftSpace;
        button.dataset.labelSide=labelRight?'right':'left';
        button.style.setProperty('--map-label-width',`${Math.max(1,Math.min(240,labelRight?rightSpace:leftSpace))}px`);
        button.dataset.labelAbove=String(viewport.clientHeight-((viewport.clientHeight-fit.height)/2+point.y)<70);
        button.dataset.selected=String(interaction.tappedId===marker.locationId
          ||interaction.focusedId===marker.locationId||interaction.hoveredId===marker.locationId);
        button.setAttribute('aria-label',`${marker.name}: ${view.statusLabel}${view.activeWork?`; ${view.activeWork}`:''}`);
        button.setAttribute('aria-pressed',String(interaction.tappedId===marker.locationId));
        button.querySelector('[data-map-callout]').textContent=`${marker.name} — ${view.statusLabel}${view.activeWork?` · ${view.activeWork}`:''}`;
        if(options.has(marker.locationId))options.get(marker.locationId).textContent=`${marker.name} — ${view.statusLabel}`;
        if(view.automatic)urgent.push(marker);
      }
      // Automatic alerts and the location chooser retain every name/status,
      // with unchanged approved anchors and location identities.
      alerts.replaceChildren(...urgent.map(marker=>{
        const item=document.createElement('li'),strong=document.createElement('strong');
        strong.textContent=marker.name;item.append(strong,document.createTextNode(
          `${marker.statusLabel}${marker.activeWork?` · ${marker.activeWork}`:''}`));return item;
      }));
      if(alertCount)alertCount.textContent=String(urgent.length);
      const selected=markers.find(marker=>marker.locationId===interaction.tappedId||marker.locationId===interaction.focusedId);
      selection.textContent=selected?`${selected.name}: ${selected.statusLabel}${selected.activeWork?` · ${selected.activeWork}`:''}`:'Choose a pin or location for details.';
      if(locations)locations.value=selected?.locationId||'';
    }
    function acceptGps(ticket,context){
      if(!gate.isCurrent(ticket)||!anchors||!gpsLayer||!gpsStatus||!FIT?.admit||!PATH?.path)return false;
      try{
        const registration=FIT.admit({anchors});
        if(!Array.isArray(context?.work))throw new Error('session-bound GPS history unavailable');
        const now=Date.now(),svg='http://www.w3.org/2000/svg',nodes=[];
        let tracks=0,current=0,discarded=0,unknownChronology=0;
        for(const work of context.work){
          if(work?.truncated || work?.incomplete){discarded++;continue;}
          const result=PATH.path({registration,observations:work.observations,session:work.session,now});
          discarded+=result.rejected.length;
          if(result.chronologyUnknown)unknownChronology++;
          for(const segment of result.segments){
            if(segment.length<2)continue;
            const line=document.createElementNS(svg,'polyline');
            line.setAttribute('points',segment.map(sample=>`${sample.canvas.x},${sample.canvas.y}`).join(' '));
            line.setAttribute('fill','none');line.setAttribute('stroke','#075e96');
            line.setAttribute('stroke-width','3');line.setAttribute('stroke-linecap','round');
            line.setAttribute('stroke-linejoin','round');nodes.push(line);tracks++;
          }
          if(result.current){
            const ring=document.createElementNS(svg,'circle');
            ring.setAttribute('cx',String(result.current.canvas.x));
            ring.setAttribute('cy',String(result.current.canvas.y));
            ring.setAttribute('r',String(result.current.uncertaintyCanvasPx));
            ring.setAttribute('fill','#075e9622');ring.setAttribute('stroke','#075e96');
            ring.setAttribute('stroke-dasharray','4 3');nodes.push(ring);
            const dot=document.createElementNS(svg,'circle');
            dot.setAttribute('cx',String(result.current.canvas.x));
            dot.setAttribute('cy',String(result.current.canvas.y));
            dot.setAttribute('r','4');dot.setAttribute('fill','#075e96');nodes.push(dot);current++;
          }
        }
        if(!gate.isCurrent(ticket))return false;
        if(horizontal&&nodes.length){
          // The same inverse display transform carries every GPS point, path,
          // and accuracy ring. The sealed geographic registration is unchanged.
          const zero=FIT.rasterToNative({x:0,y:0}),x=FIT.rasterToNative({x:1,y:0}),y=FIT.rasterToNative({x:0,y:1});
          const group=document.createElementNS(svg,'g');
          group.setAttribute('transform',`matrix(${x.x-zero.x} ${x.y-zero.y} ${y.x-zero.x} ${y.y-zero.y} ${zero.x} ${zero.y})`);
          group.append(...nodes);gpsLayer.replaceChildren(group);
        }else gpsLayer.replaceChildren(...nodes);
        gpsStatus.textContent=`Advisory GPS on owner-accepted overall visual fit: ${current} recent measured position${current===1?'':'s'}, ${tracks} path segment${tracks===1?'':'s'}. Dashed rings show reported device accuracy ONLY; map/absolute error is unknown and the walking domain is unverified. Gaps are not inferred.${discarded?` ${discarded} readings or incomplete paths withheld.`:''}${unknownChronology?` ${unknownChronology} work path${unknownChronology===1?'':'s'} withheld because capture chronology is unknown.`:''}`;
        return true;
      }catch{if(gate.isCurrent(ticket))clearGps('Advisory GPS unavailable: accepted reference or measured active-work history did not pass source checks. Absolute map accuracy remains unverified.');return false;}
    }
    function unavailableGps(ticket){if(!gate.isCurrent(ticket))return false;
      clearGps();return true;}
    function selectLocation(locationId){
      if(closed||suspended)return;
      const id=typeof locationId==='string'?locationId:locations?.value,ids=new Set(buttons.keys());
      if(id&&!ids.has(id))return;
      if(interaction.tappedId)interaction=MAP.interact(interaction,{type:'clearTap',locationId:interaction.tappedId},ids);
      if(id)interaction=MAP.interact(interaction,{type:'tap',locationId:id},ids);
      render();
    }
    function addPin(anchor){
      const button=document.createElement('button');button.type='button';button.className='mzMapPin';
      button.dataset.locationId=anchor.locationId;
      button.dataset.approvedLocationName=anchor.name;
      const image=document.createElement('img');image.src=ASSETS.icons[anchor.iconKind];image.alt='';
      image.setAttribute('aria-hidden','true');
      const callout=document.createElement('span');callout.className='mzMapCallout';callout.dataset.mapCallout='';
      const leader=document.createElement('span');leader.className='mzMapLeader';leader.setAttribute('aria-hidden','true');
      button.append(leader,image,callout);layer.append(button);buttons.set(anchor.locationId,button);
      for(const [event,type] of [['mouseenter','hover'],['mouseleave','leave'],['focus','focus'],['blur','blur'],['click','tap']])
        button.addEventListener(event,()=>{if(closed||suspended)return;
          interaction=MAP.interact(interaction,{type,locationId:anchor.locationId},new Set(buttons.keys()));render();});
    }
    async function init(){
      if(closed||suspended)return false;
      if(initialized)return true;
      const expected=lifecycleGeneration;
      const response=await fetch('./dashboard-map-assets/approved-map-47-placement-anchors.json',{cache:'no-store'});
      if(!response.ok)throw new Error('Approved map anchors unavailable');
      const parsed=await MAP.parseApprovedAnchors(new Uint8Array(await response.arrayBuffer()),{subtle:window.crypto?.subtle});
      if(closed||suspended||expected!==lifecycleGeneration)return false;
      anchors=FIT.transformAnchors(parsed);
      for(const anchor of anchors.locations)addPin(anchor);
      if(locations){
        for(const anchor of anchors.locations){
          const option=document.createElement('option');option.value=anchor.locationId;option.textContent=anchor.name;
          locations.append(option);options.set(anchor.locationId,option);
        }
        locations.addEventListener('change',selectLocation);controls.push([locations,'change',selectLocation]);
      }
      markers=MAP.project({anchors,summary:null,transport:'LOADING'});render();
      if(window.ResizeObserver){resizeObserver=new window.ResizeObserver(render);resizeObserver.observe(viewport);}
      window.addEventListener('resize',render);resizeBound=true;initialized=true;
      status.textContent='Map cleaning status unavailable until a current authenticated response';
      return true;
    }
    function suspend(){
      if(closed||suspended)return false;
      suspended=true;lifecycleGeneration++;gate.suspend();return true;
    }
    function rollbackFailedResume(expected){
      // A later pagehide/resume owns the renderer once the generation changes.
      // An obsolete anchor rejection must never suspend that newer attempt.
      if(closed||expected!==lifecycleGeneration)return;
      if(!initialized){
        if(resizeBound){window.removeEventListener('resize',render);resizeBound=false;}
        resizeObserver?.disconnect();resizeObserver=null;
        for(const [element,event,fn] of controls)element.removeEventListener?.(event,fn);
        controls.length=0;layer.replaceChildren();buttons.clear();markers=[];anchors=null;
        for(const option of options.values())option.remove();options.clear();
        alerts.replaceChildren();selection.textContent='';
      }
      suspended=true;lifecycleGeneration++;gate.suspend();
    }
    async function resume(){
      if(closed||!suspended||!gate.resume())return false;
      suspended=false;const expected=++lifecycleGeneration;
      try{
        const ready=initialized?(render(),true):await init();
        if(!ready){rollbackFailedResume(expected);return false;}
        return !closed&&!suspended&&expected===lifecycleGeneration;
      }catch(error){rollbackFailedResume(expected);throw error;}
    }
    function stop(){
      if(closed)return;
      closed=true;lifecycleGeneration++;gate.close();
      if(resizeBound){window.removeEventListener('resize',render);resizeBound=false;}
      resizeObserver?.disconnect();resizeObserver=null;
      for(const [element,event,fn] of controls)element.removeEventListener?.(event,fn);
      controls.length=0;layer.replaceChildren();buttons.clear();markers=[];anchors=null;
      for(const option of options.values())option.remove();options.clear();
      if(locations)locations.value='';if(alertCount)alertCount.textContent='0';
      alerts.replaceChildren();selection.textContent='';initialized=false;
    }
    return Object.freeze({init,selectLocation,beginRefresh:gate.begin,accept:gate.commit,acceptGps,unavailableGps,clearGps,fail:gate.fail,
      invalidate:gate.invalidate,checkSession:gate.checkSession,suspend,resume,stop});
  }
  root.MemphisDashboardMapRenderer=Object.freeze({create,createRefreshGate,createPublicRefreshGate,separatePins});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisDashboardMapRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
