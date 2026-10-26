(function(root){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com/dashboard-api/summary';
  const REFRESH_MS=30000;
  const named=session=>session?.role==='ops_manager'&&typeof session.token==='string'&&session.token
    &&typeof session.manager_id==='string'&&session.manager_id
    &&typeof session.credential_id==='string'&&session.credential_id;
  const dashboardData=data=>data?.meta?.contracts?.dashboard==='dashboard.v1'
    &&Number.isFinite(Date.parse(data?.meta?.generated_at||''))
    &&Array.isArray(data.restrooms)&&Array.isArray(data.exhibits);

  function create({auth,renderer,section,status,operations=null,gpsSource=root.MemphisCustodialGpsPathSource,
    fetchImpl=root.fetch?.bind(root),window=root,
    setIntervalImpl=root.setInterval?.bind(root),clearIntervalImpl=root.clearInterval?.bind(root)}={}){
    if(!auth?.requireOpsManagerSession||!auth?.opsManagerAuthHeaders||!auth?.readSession||!auth?.hasPermission
      ||!renderer?.create||!section||!status||!fetchImpl||!setIntervalImpl||!clearIntervalImpl)
      throw new Error('Dashboard Map requires existing manager authentication and renderer');
    let owner=null,map=null,refreshTimer=null,sessionTimer=null,state='new',generation=0;
    let ownerBinding=null;
    let readEpoch=0;
    let activeListeners=false,lifecycleListeners=false;
    function currentSession(){try{return auth.readSession();}catch{return null;}}
    function sessionBinding(session){
      if(!named(session)||session.permissions?.schema!=='custodial.manager-permissions.v1'
        ||auth.hasPermission('read',session)!==true)return null;
      const typed=value=>[typeof value,value===undefined?'':value];
      let permissions,roles,fingerprint;
      try{
        permissions=Object.entries(session.permissions).sort(([a],[b])=>a.localeCompare(b))
          .map(([key,value])=>[key,...typed(value)]);
        roles=Array.isArray(session.roles)?['array',session.roles.map(typed)]:typed(session.roles);
        fingerprint=JSON.stringify([session.role,session.manager_id,session.credential_id,session.token,
          session.device_id,typed(session.expires_at),typed(session.access_level),typed(session.read_only),roles,permissions]);
      }catch{return null;}
      return Object.freeze({session,manager_id:session.manager_id,credential_id:session.credential_id,
        device_id:session.device_id,token:session.token,fingerprint});
    }
    function sameBinding(original,current){
      const next=sessionBinding(current);
      return !!original&&!!next&&original.session===next.session&&original.fingerprint===next.fingerprint;
    }
    function updateNavigation(){
      if(!window.location?.href||!window.document?.getElementById)return;
      const current=new URL(window.location.href);
      let fromAnnie=String(current.searchParams.get('origin')||'').trim().toLowerCase()==='annie';
      try{fromAnnie=fromAnnie||window.sessionStorage?.getItem('mz_annie_origin_session')==='1';}catch{}
      // Use the accepted session's canonical device, not an obsolete incoming
      // device hint. These remain fixed same-origin routes, never return URLs.
      let device=String(owner?.device_id||'').trim();
      if(!device){try{device=String(auth.getDeviceId?.()||'').trim();}catch{}}
      for(const [id,path]of [['map-hub-link','./start_page1.html'],['map-dashboard-link','./dashboard.html']]){
        const link=window.document.getElementById(id);if(!link)continue;
        const target=new URL(path,current);
        target.searchParams.set('hub','manager');
        if(device)target.searchParams.set('device',device);
        if(fromAnnie)target.searchParams.set('origin','annie');
        link.href=target.toString();
      }
    }
    function invalidate(message){readEpoch++;map?.invalidate();operations?.unavailable();status.textContent=message;}
    function checkPrincipal(){
      if(state!=='active')return false;
      if(!sameBinding(ownerBinding,currentSession())||!map?.checkSession()){
        state='suspended';generation++;detachActive();section.hidden=true;
        invalidate('Manager access changed. Reopen the Dashboard Map from your signed-in manager session.');
        map?.suspend?.();operations?.suspend();
        return false;
      }
      return true;
    }
    async function refresh(){
      if(!checkPrincipal())return false;
      const ticket=map.beginRefresh();
      if(!ticket)return false;
      const requestGeneration=generation;
      const requestEpoch=++readEpoch;
      const currentRead=()=>requestGeneration===generation&&requestEpoch===readEpoch&&checkPrincipal()
        &&requestGeneration===generation&&requestEpoch===readEpoch;
      // Withdraw old feed/GPS work now, without discarding an empty same-owner
      // board. An older failure must never clear a newer successful summary.
      operations?.unavailable({preserveBoard:true});
      status.textContent='Refreshing current cleaning status…';
      try{
        const headers=await auth.opsManagerAuthHeaders({expectedManagerId:owner.manager_id});
        if(!currentRead())return false;
        const response=await fetchImpl(API,{method:'GET',cache:'no-store',headers});
        const payload=await response.json().catch(()=>null);
        if(!currentRead())return false;
        if(!response.ok||payload?.ok!==true||!dashboardData(payload.data))
          throw new Error('The authenticated Dashboard summary is unavailable or changed');
        if(!map.accept(ticket,payload.data))return false;
        status.textContent='Current authenticated Dashboard cleaning status';
        // GPS is advisory. Its separate read can fail or be absent without
        // changing the authenticated cleaning state or NFC workflow.
        if(gpsSource?.read){
          void gpsSource.read({headers,fetchImpl}).then(context=>{
            if(currentRead())map?.acceptGps?.(ticket,context);
          }).catch(()=>{if(currentRead())map?.unavailableGps?.(ticket);});
        }else map.unavailableGps?.(ticket);
        void operations?.refresh({headers,fetchImpl,summary:payload.data,
          isCurrent:currentRead}).catch(()=>{});
        return true;
      }catch{
        if(requestGeneration!==generation||requestEpoch!==readEpoch)return false;
        map.fail(ticket);operations?.unavailable();
        if(checkPrincipal())status.textContent='Current cleaning status unavailable. Approved locations remain visible without a claimed state.';
        return false;
      }
    }
    function onOffline(){invalidate('Offline. Current cleaning status unavailable.');}
    function onOnline(){void refresh();}
    function onFocus(){if(checkPrincipal())void refresh();}
    function onVisibility(){if(window.document?.hidden)invalidate('Map status paused while hidden.');else onFocus();}
    function detachActive(){
      if(refreshTimer!==null)clearIntervalImpl(refreshTimer);
      if(sessionTimer!==null)clearIntervalImpl(sessionTimer);
      refreshTimer=null;sessionTimer=null;
      if(!activeListeners)return;activeListeners=false;
      window.removeEventListener?.('offline',onOffline);window.removeEventListener?.('online',onOnline);
      window.removeEventListener?.('focus',onFocus);
      window.document?.removeEventListener?.('visibilitychange',onVisibility);
    }
    function attachActive(){
      if(activeListeners)return;activeListeners=true;
      window.addEventListener?.('offline',onOffline);window.addEventListener?.('online',onOnline);
      window.addEventListener?.('focus',onFocus);window.document?.addEventListener?.('visibilitychange',onVisibility);
      refreshTimer=setIntervalImpl(()=>{void refresh();},REFRESH_MS);
      sessionTimer=setIntervalImpl(()=>{if(checkPrincipal())operations?.tick();},1000);
    }
    function suspend(){
      if(state==='closed'||state==='suspended')return;
      state='suspended';generation++;detachActive();section.hidden=true;
      map?.suspend?.();operations?.suspend();status.textContent='Map status paused. Rechecking manager access on return.';
    }
    function stop(){
      if(state==='closed')return;
      state='closed';generation++;detachActive();section.hidden=true;
      if(lifecycleListeners){lifecycleListeners=false;
        window.removeEventListener?.('pagehide',onPageHide);window.removeEventListener?.('pageshow',onPageShow);}
      map?.stop?.();operations?.stop();map=null;owner=null;ownerBinding=null;
      status.textContent='Dashboard Map closed.';
    }
    function onPageHide(event){if(event?.persisted)suspend();else stop();}
    function onPageShow(event){if(event?.persisted&&state==='suspended')void resume();}
    function bindLifecycle(){if(lifecycleListeners)return;lifecycleListeners=true;
      window.addEventListener?.('pagehide',onPageHide);window.addEventListener?.('pageshow',onPageShow);}
    async function validatedSession(){
      let session;
      try{session=await auth.requireOpsManagerSession({interactive:false,redirect:true});}
      catch{return null;}
      return named(session)&&sameBinding(sessionBinding(session),currentSession())?session:null;
    }
    function failedResume(expected,attemptMap,message,{preserveMap=false}={}){
      // Only the still-current restoration may discard its renderer. A late
      // rejection from an older attempt cannot close the newly restored map.
      if(state!=='resuming'||expected!==generation)return false;
      generation++;state='suspended';detachActive();section.hidden=true;
      if(!preserveMap){attemptMap?.stop?.();if(map===attemptMap)map=null;}
      status.textContent=message;return false;
    }
    async function resume(){
      if(state!=='suspended')return false;
      state='resuming';const expected=generation;
      const session=await validatedSession();
      if(state!=='resuming'||expected!==generation)return false;
      if(!session||(ownerBinding&&!sameBinding(ownerBinding,session))){
        return failedResume(expected,map,'Manager access changed. Reopen the Dashboard Map from your signed-in manager session.');
      }
      if(!ownerBinding)ownerBinding=sessionBinding(session);
      owner=session;updateNavigation();
      let attemptMap=map;
      const reusedMap=!!attemptMap;
      try{
        if(!attemptMap){attemptMap=renderer.create({section,auth});map=attemptMap;
          if(!await attemptMap.init())return failedResume(expected,attemptMap,'Approved map assets unavailable; no cleaning status shown.');}
        else if(!await attemptMap.resume())
          return failedResume(expected,attemptMap,'Approved map assets unavailable; no cleaning status shown.',{preserveMap:true});
        if(state!=='resuming'||expected!==generation)return false;
        if(!sameBinding(ownerBinding,currentSession())||!attemptMap.checkSession())
          return failedResume(expected,attemptMap,'Manager access changed. Reopen the Dashboard Map from your signed-in manager session.');
        state='active';section.hidden=false;operations?.activate(attemptMap);attachActive();void refresh();return true;
      }catch{
        return failedResume(expected,attemptMap,'Approved map assets unavailable; no cleaning status shown.',
          {preserveMap:reusedMap});
      }
    }
    async function init(){
      if(state==='suspended')return resume();
      if(state!=='new')return false;
      state='initializing';bindLifecycle();const expected=generation;
      const session=await validatedSession();
      if(state!=='initializing'||expected!==generation)return false;
      if(!session){state='new';section.hidden=true;status.textContent='Manager sign-in required for Dashboard Map.';return false;}
      owner=session;ownerBinding=sessionBinding(session);updateNavigation();
      try{
        map=renderer.create({section,auth});
        if(!await map.init()){
          if(state==='initializing'&&expected===generation){state='new';map.stop?.();map=null;}
          return false;
        }
        if(state!=='initializing'||expected!==generation||!sameBinding(ownerBinding,currentSession())||!map.checkSession())return false;
        state='active';section.hidden=false;operations?.activate(map);attachActive();void refresh();return true;
      }catch{
        if(state==='initializing'&&expected===generation){state='new';section.hidden=true;
          map?.stop?.();map=null;status.textContent='Approved map assets unavailable; no cleaning status shown.';}
        return false;
      }
    }
    return Object.freeze({init,refresh,resume,suspend,stop,checkPrincipal});
  }
  const api=Object.freeze({create,dashboardData});
  root.MemphisDashboardMapPage=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document?.getElementById&&root.document.getElementById('dashboard-map')){
    const section=root.document.getElementById('dashboard-map');
    const status=root.document.getElementById('map-page-status');
    const operations=root.MemphisOperationsDashboard?.create();
    void create({auth:root.MemphisAuth,renderer:root.MemphisDashboardMapRenderer,section,status,operations}).init();
  }
})(typeof globalThis!=='undefined'?globalThis:this);
