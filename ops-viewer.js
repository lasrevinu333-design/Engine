(function(root){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com';
  function create({window=root,document=root.document,fetchImpl=root.fetch.bind(root),renderer=root.MemphisDashboardMapRenderer,boards=root.MemphisOperationsDashboard}={}){
    const el=id=>document.getElementById(id),section=el('dashboard-map'),status=el('map-page-status');
    const requests=new Set(),listeners=[];
    let state='new',generation=0,timer=null,clock=null,map=null;
    const operations=boards.create({window,document,audience:'public_readonly'});
    const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push([target,event,fn]);};
    const current=attempt=>state==='active'&&attempt===generation;
    async function read(path){
      const request=new AbortController();requests.add(request);
      const timeout=window.setTimeout(()=>request.abort(),15000);
      try{
        const response=await fetchImpl(API+path,{method:'GET',credentials:'omit',cache:'no-store',redirect:'error',signal:request.signal});
        const body=await response.json();
        if(!response.ok||body?.ok!==true)throw Error('public_source_unavailable');
        return body.data;
      }finally{window.clearTimeout(timeout);requests.delete(request);}
    }
    async function refresh(){
      if(state!=='active')return false;const attempt=++generation,ticket=map.beginRefresh();
      operations.unavailable({preserveBoard:true,preserveMap:true});status.textContent='Refreshing read-only operations…';
      try{
        const data=await read('/viewer-api/summary');
        if(!current(attempt))return false;
        if(data?.meta?.audience!=='public_readonly'||data.meta.contracts?.dashboard!=='dashboard.v1'
          ||!Number.isFinite(Date.parse(data.meta.generated_at))||!Array.isArray(data.restrooms)||!Array.isArray(data.exhibits)||!Array.isArray(data.open_tickets))throw Error('public_source_contract');
        if(!map.accept(ticket,data))return false;
        status.textContent='Read-only operations · updated '+new Date(data.meta.generated_at).toLocaleString('en-US',{timeZone:'America/Chicago'})+' Central';
        void operations.refresh({fetchImpl,summary:data,isCurrent:()=>current(attempt)}).catch(()=>{});
        return true;
      }catch{
        if(current(attempt)){map.fail(ticket);operations.unavailable();status.textContent='Current operations unavailable. Refresh to read the source again.';}
        return false;
      }
    }
    function suspend(){
      if(state==='closed'||state==='suspended')return;state='suspended';generation++;
      for(const request of requests)request.abort();requests.clear();
      window.clearInterval(timer);window.clearInterval(clock);timer=null;clock=null;
      operations.suspend();map?.suspend();section.hidden=true;
    }
    function stop(){if(state==='closed')return;suspend();state='closed';map?.stop();operations.stop();for(const [target,event,fn]of listeners)target.removeEventListener(event,fn);}
    function activate(){state='active';section.hidden=false;operations.activate(map);
      timer=window.setInterval(()=>{if(!document.hidden){void refresh();}},30000);
      clock=window.setInterval(()=>operations.tick(),1000);void refresh();}
    async function resume(){
      if(state!=='suspended')return false;state='resuming';const attempt=generation;
      try{const ready=await map.resume();if(state!=='resuming'||generation!==attempt)return false;if(!ready)throw Error('map_resume');activate();return true;}
      catch{if(state==='resuming'){state='suspended';status.textContent='Map unavailable. Reload to retry.';}return false;}
    }
    async function init(){
      if(state!=='new')return false;state='initializing';
      listen(el('refresh-dashboard'),'click',()=>void refresh());
      listen(window,'pagehide',event=>event.persisted?suspend():stop());listen(window,'pageshow',event=>{if(event.persisted)void resume();});
      listen(window,'offline',()=>{generation++;map?.invalidate();operations.unavailable();status.textContent='Offline. Current operations unavailable.';});
      listen(window,'online',()=>{void refresh();});
      try{map=renderer.create({section,audience:'public_readonly',fetchImpl,window,document});
        if(!await map.init())throw Error('map_assets');if(state!=='initializing')return false;activate();return true;
      }catch{if(state==='initializing'){status.textContent='Approved map assets unavailable. Reload to retry.';stop();}return false;}
    }
    return Object.freeze({init,refresh,suspend,resume,stop});
  }
  root.MemphisPublicViewer=Object.freeze({create});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisPublicViewer;
  if(root.document?.getElementById('refresh-dashboard'))void create().init();
})(typeof globalThis!=='undefined'?globalThis:this);
