(function(root){
  'use strict';
  const MAP=root.MemphisDashboardMapStaging;
  // Full literal paths keep the approved closed asset graph visible to the
  // existing runtime scanner as well as to the browser; no dynamic directory
  // expansion, coordinate change, or alternative artwork selection.
  const ASSETS=Object.freeze({
    artwork:'./dashboard-map-assets/Memphis-Zoo-Transparent-Framed-Clean-Base-20261003.png',
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
  function create({section,auth,fetchImpl:fetch=root.fetch.bind(root),document=root.document,window=root}){
    if(!MAP||!section||!auth?.readSession)throw new Error('Map staging requires the exact manager source bridge');
    const viewport=section.querySelector('[data-map-viewport]');
    const surface=section.querySelector('[data-map-surface]');
    const artwork=section.querySelector('[data-map-artwork]');
    const layer=section.querySelector('[data-map-layer]');
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
    const gate=createRefreshGate({readSession:()=>auth.readSession(),onState:(kind,summary)=>{
      if(!anchors||closed)return;
      if(kind==='principal_changed')interaction=MAP.initialInteraction();
      markers=MAP.project({anchors,summary,transport:kind==='current'?'CURRENT_AUTHENTICATED_RESPONSE':kind.toUpperCase()});
      interaction=MAP.reconcileUrgency(interaction,markers);
      status.textContent=kind==='current'?'Current authenticated dashboard response':'Map cleaning status unavailable until a current authenticated response';
      render();
    }});
    function render(){
      if(!anchors||closed)return;
      // A hidden, suspended page has no layout. The first visible refresh or
      // resize observation fits it; never manufacture a scroll-sized surface.
      if(viewport.clientWidth<=0||viewport.clientHeight<=0)return;
      const fit=MAP.fitViewport({width:viewport.clientWidth,height:viewport.clientHeight,
        canvasWidth:anchors.width,canvasHeight:anchors.height});
      surface.style.width=`${fit.width}px`;
      surface.style.height=`${fit.height}px`;
      artwork.src=ASSETS.artwork;
      const urgent=[];
      for(const marker of markers){
        const button=buttons.get(marker.locationId),view=MAP.presentation(marker,{interaction,
          reducedMotion:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true});
        if(!button)continue;
        const point=MAP.screenPoint(marker.canvasPoint,{fitScale:fit.fitScale,zoom:1});
        button.style.left=`${point.x}px`;button.style.top=`${point.y}px`;
        button.style.width=`${view.sizePx}px`;button.style.height=`${view.sizePx}px`;
        button.dataset.status=marker.status;button.dataset.pulse=view.pulse;
        button.dataset.details=String(view.detailsVisible);
        // Only the text bubble flips at an edge. Pin centers and artwork
        // always share the exact approved transform; no collision offsets.
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
      // All automatic alerts also appear in a normal-flow list. Dense pins
      // may overlap, but their names/statuses are never silently hidden or
      // "decluttered" by moving approved coordinates.
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
      const image=document.createElement('img');image.src=ASSETS.icons[anchor.iconKind];image.alt='';
      image.setAttribute('aria-hidden','true');
      const callout=document.createElement('span');callout.className='mzMapCallout';callout.dataset.mapCallout='';
      button.append(image,callout);layer.append(button);buttons.set(anchor.locationId,button);
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
      anchors=parsed;
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
    return Object.freeze({init,selectLocation,beginRefresh:gate.begin,accept:gate.commit,fail:gate.fail,
      invalidate:gate.invalidate,checkSession:gate.checkSession,suspend,resume,stop});
  }
  root.MemphisDashboardMapRenderer=Object.freeze({create,createRefreshGate});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisDashboardMapRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
