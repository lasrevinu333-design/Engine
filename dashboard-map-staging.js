(function(root){
  'use strict';
  // Presentation-only staging contract. The approved PNG is already framed;
  // anchors are final canvas pixels, never GPS or another matrix input.
  const ANCHOR_SHA='3bf0761cb42f1e5f9b435ae3774ea3c018c749daf261de44357880ae3841ebef';
  const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
  const COLORS={not_cleaned:'black',in_progress:'blue',okay:'green',due_soon:'yellow',overdue:'red'};
  const LABELS={not_cleaned:'Not cleaned today',in_progress:'Cleaning in progress',
    okay:'Cleaning complete',due_soon:'Due soon',overdue:'Overdue',unconfirmed:'Status unconfirmed',unknown:'Status unavailable'};
  const ICON_KINDS=new Set(['men','women','building']);
  const hex=buffer=>Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  const own=(object,key)=>object&&Object.prototype.hasOwnProperty.call(object,key);
  function fail(message){throw new Error(`Map staging: ${message}`);}
  async function parseApprovedAnchors(bytes,{subtle=root.crypto?.subtle}={}){
    if(!(bytes instanceof Uint8Array)||!subtle)fail('exact bytes and digest implementation required');
    const copy=bytes.slice(),digest=hex(await subtle.digest('SHA-256',copy));
    if(digest!==ANCHOR_SHA)fail('approved 47-placement bytes changed');
    const data=JSON.parse(new TextDecoder().decode(copy));
    if(data.schemaVersion!==1||data.kind!=='approved-memphis-zoo-dashboard-map-overlay-anchors'
      ||data.locationCount!==47||data.ownerAdjustedLocationCount!==34
      ||data.presentation?.width!==1282||data.presentation?.height!==550
      ||!Array.isArray(data.locations)||data.locations.length!==47)fail('approved anchor shape changed');
    const seen=new Set();let adjusted=0;
    for(const item of data.locations){
      if(!UUID.test(item.locationId)||seen.has(item.locationId))fail('missing or duplicate stable location ID');
      seen.add(item.locationId);
      if(!ICON_KINDS.has(item.iconKind)||typeof item.name!=='string'||!item.name.trim())fail('missing approved icon/name');
      const point=item.approvedOverlayCanvasPoint,offset=item.ownerSelectedDisplayOffset;
      if(!finite(point?.x)||!finite(point?.y)||point.x<0||point.x>1282||point.y<0||point.y>550
        ||!finite(offset?.dx)||!finite(offset?.dy))fail('missing approved canvas point/offset');
      if(offset.dx!==0||offset.dy!==0)adjusted++;
      if(own(item,'status')||own(item,'status_code')||own(item,'gps'))fail('status/GPS must not be read from placement data');
    }
    if(adjusted!==34)fail('approved adjustment count changed');
    return Object.freeze({digest,width:1282,height:550,locations:Object.freeze(data.locations.map(item=>Object.freeze({
      locationId:item.locationId,entityCode:item.entityCode,name:item.name,iconKind:item.iconKind,
      canvasPoint:Object.freeze({x:item.approvedOverlayCanvasPoint.x,y:item.approvedOverlayCanvasPoint.y})
    })))});
  }
  function statusForRow(row){
    if(!row)return 'unknown';
    const code=typeof row.status_code==='string'?row.status_code.toLowerCase():'';
    const color=typeof row.status_color==='string'?row.status_color.toLowerCase():'';
    const open=String(row.open_session_status||'').toLowerCase();
    if(open&&open!=='active')return 'unconfirmed';
    if(!own(COLORS,code)||COLORS[code]!==color)return 'unknown';
    if(code==='in_progress')return open==='active'&&!!row.open_session_uuid?'in_progress':'unconfirmed';
    // The current SQL view checks due/overdue thresholds before the later
    // active-session branch when a completion baseline exists. Preserve that
    // server status; active work is disclosed separately, never made blue here.
    if(code==='due_soon'||code==='overdue')return code;
    if(open==='active')return 'unconfirmed';
    if(code==='not_cleaned')return 'not_cleaned';
    return row.latest_completed_at&&Number.isFinite(Date.parse(row.latest_completed_at))?code:'unconfirmed';
  }
  function project({anchors,summary,transport}){
    if(!anchors||anchors.digest!==ANCHOR_SHA||!Array.isArray(anchors.locations)||anchors.locations.length!==47)
      fail('exact approved anchors required');
    // Only the authenticated live-fetch adapter may explicitly supply this
    // classification. generated_at is syntax/source binding, not a TTL.
    const valid=transport==='CURRENT_AUTHENTICATED_RESPONSE'
      &&summary?.meta?.contracts?.dashboard==='dashboard.v1'
      &&Number.isFinite(Date.parse(summary?.meta?.generated_at||''))
      &&Array.isArray(summary?.restrooms)&&Array.isArray(summary?.exhibits);
    const rows=valid?[...summary.restrooms,...summary.exhibits]:[];
    const byId=new Map(),duplicates=new Set();
    for(const row of rows){const id=String(row?.location_id||'').toLowerCase();if(!UUID.test(id))continue;
      if(byId.has(id))duplicates.add(id);else byId.set(id,row);}
    return anchors.locations.map(anchor=>{
      const id=anchor.locationId.toLowerCase();const row=duplicates.has(id)?null:byId.get(id);
      const status=valid?statusForRow(row):'unknown';
      const activeWork=valid&&row?.open_session_status==='active'
        ?row.open_session_uuid?'Dashboard reports active cleaning':'Active work identity incomplete':null;
      // The approved saved name/point stay stable; an authenticated response
      // contributes only cleaning state. Tickets and demo colors never enter.
      return Object.freeze({...anchor,status,statusLabel:LABELS[status],
        activeWork,
        statusSource:status==='unknown'||status==='unconfirmed'?'UNCONFIRMED':'AUTHENTICATED_DASHBOARD_SUMMARY'});
    });
  }
  function initialInteraction(){return Object.freeze({hoveredId:null,focusedId:null,tappedId:null,urgentIds:Object.freeze([])});}
  function reconcileUrgency(previous,markers){
    const ids=new Set(previous.urgentIds||[]);
    for(const marker of markers){
      if(marker.status==='due_soon'||marker.status==='overdue')ids.add(marker.locationId);
      // No loading/unknown/black transition silently erases an urgent label.
      // Only an authoritative blue/green cleaning change clears it.
      if(marker.statusSource==='AUTHENTICATED_DASHBOARD_SUMMARY'
        &&(marker.status==='in_progress'||marker.status==='okay'))ids.delete(marker.locationId);
    }
    return Object.freeze({...previous,urgentIds:Object.freeze([...ids])});
  }
  function interact(previous,event,validIds){
    const state={...previous};
    if(!['hover','leave','focus','blur','tap','clearTap'].includes(event?.type))fail('unsupported interaction');
    if(!validIds.has(event.locationId))fail('unknown stable location ID');
    if(event.type==='hover')state.hoveredId=event.locationId;
    if(event.type==='leave'&&state.hoveredId===event.locationId)state.hoveredId=null;
    if(event.type==='focus')state.focusedId=event.locationId;
    if(event.type==='blur'&&state.focusedId===event.locationId)state.focusedId=null;
    if(event.type==='tap')state.tappedId=state.tappedId===event.locationId?null:event.locationId;
    if(event.type==='clearTap'&&state.tappedId===event.locationId)state.tappedId=null;
    return Object.freeze(state);
  }
  function presentation(marker,{interaction=initialInteraction(),reducedMotion=false}={}){
    const manual=[interaction.hoveredId,interaction.focusedId,interaction.tappedId].includes(marker.locationId);
    const urgent=marker.status==='due_soon'||marker.status==='overdue'
      ||interaction.urgentIds?.includes(marker.locationId);
    const pulse=reducedMotion?'none':marker.status==='overdue'?'highest':marker.status==='due_soon'?'urgent':
      marker.status==='in_progress'||marker.status==='okay'?'gentle':'none';
    return Object.freeze({sizePx:urgent||manual?42:24,detailsVisible:urgent||manual,
      statusLabel:marker.statusLabel,activeWork:marker.activeWork,pulse,automatic:urgent,iconKind:marker.iconKind,
      canvasPoint:marker.canvasPoint});
  }
  function screenPoint(canvasPoint,{originX=0,originY=0,panX=0,panY=0,fitScale,zoom}){
    if(![originX,originY,panX,panY,fitScale,zoom,canvasPoint?.x,canvasPoint?.y].every(finite)
      ||fitScale<=0||zoom<=0)fail('finite positive shared viewport required');
    return Object.freeze({x:originX+panX+fitScale*zoom*canvasPoint.x,
      y:originY+panY+fitScale*zoom*canvasPoint.y});
  }
  function fitViewport({width,height,canvasWidth=1282,canvasHeight=550}){
    if(![width,height,canvasWidth,canvasHeight].every(finite)
      ||width<=0||height<=0||canvasWidth<=0||canvasHeight<=0)
      fail('finite positive whole-map viewport required');
    // One uniform scale, limited by BOTH dimensions. No lower scale floor,
    // zoom, crop, second presentation matrix or changes to approved points.
    const fitScale=Math.min(width/canvasWidth,height/canvasHeight);
    return Object.freeze({fitScale,width:canvasWidth*fitScale,height:canvasHeight*fitScale});
  }
  const api=Object.freeze({ANCHOR_SHA,parseApprovedAnchors,project,initialInteraction,reconcileUrgency,
    interact,presentation,screenPoint,fitViewport});
  root.MemphisDashboardMapStaging=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
