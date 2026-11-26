(function(root){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com';
  function create({window=root,document=root.document,fetchImpl=root.fetch.bind(root),renderer=root.MemphisDashboardMapRenderer,boards=root.MemphisOperationsDashboard,data=root.MemphisOperationsData,now=()=>Date.now()}={}){
    const el=id=>document.getElementById(id),section=el('dashboard-map'),status=el('map-page-status');
    const requests=new Set(),listeners=[];
    let state='new',generation=0,timer=null,clock=null,map=null,refreshJob=null;
    let mapJob=null,mapReady=false,mapReadyBeforeSuspend=false,mapError=false;
    let latestSummary=null,summaryError=false,offline=false;
    const operations=boards.create({window,document,audience:'public_readonly'});
    const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push([target,event,fn]);};
    const current=attempt=>state==='active'&&attempt===generation;
    function selectView(){
      const mapView=window.location?.hash==='#map';
      section.hidden=state!=='active'||!mapView||!mapReady;
      el('public-dashboard').hidden=state!=='active'||mapView;
      el('ops-locations-button').hidden=section.hidden;
      for(const name of ['dashboard','map']){
        const link=el('public-'+name+'-link');
        if((name==='map')===mapView)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
      }
    }
    const make=(tag,value)=>{const node=document.createElement(tag);if(value!=null)node.textContent=value;return node;};
    function showSummary(summary){
      const approved=mapReady?Array.from(section.querySelectorAll('.mzMapPin')).map(pin=>({id:pin.dataset.locationId,name:pin.dataset.approvedLocationName})):[];
      const cleaningAvailable=summary&&mapReady;
      const cards=cleaningAvailable?data.publicCleaning(summary,approved,now()).cards:[];
      const labels={okay:'Clean / okay',not_cleaned:'Not cleaned',in_progress:'In progress',due_soon:'Due soon',overdue:'Overdue',pending_submit:'Saved pending',unknown:'Unknown'};
      const counts=Object.fromEntries(Object.keys(labels).map(key=>[key,cards.filter(card=>card.state===key).length]));
      const tickets=summary?data.tickets(summary,null).cards:[];
      const metrics=Object.entries(labels).map(([key,label])=>[label,cleaningAvailable?counts[key]:'—']);metrics.push(['Open tickets',summary?tickets.length:'—']);
      el('public-status-counts').replaceChildren(...metrics.map(([label,value])=>{
        const tile=make('div');tile.className='publicMetric';tile.append(make('span',label),make('strong',String(value)));return tile;
      }));
      function table(target,headings,rows,empty){
        if(!rows.length){el(target).replaceChildren(make('p',empty));return;}
        const table=make('table'),head=make('thead'),headRow=make('tr'),body=make('tbody');
        for(const title of headings){const cell=make('th',title);cell.setAttribute('scope','col');headRow.append(cell);}head.append(headRow);
        for(const values of rows){const row=make('tr');values.forEach((value,index)=>{
          const cell=make('td');cell.dataset.label=headings[index];if(typeof value==='string')cell.textContent=value;else cell.append(value);row.append(cell);
        });body.append(row);}table.append(head,body);el(target).replaceChildren(table);
      }
      for(const kind of ['restrooms','exhibits']){
        const ids=new Set((summary?.[kind]||[]).map(row=>String(row.location_id).toLowerCase()));
        const rows=cards.filter(card=>ids.has(card.id.toLowerCase())).map(card=>{
          const status=make('span',labels[card.state]||'Unknown');status.className='cleaningState';status.dataset.status=card.state;
          const worker=card.lines.find(line=>line.startsWith('Cleaning now,'))||card.lines.find(line=>line.startsWith('Current worker:'))||card.lines.find(line=>line.startsWith('Recorded worker:'))||'Unavailable';
          const details=make('div');for(const line of card.lines.filter(line=>!line.startsWith('Cleaning now,')&&!line.startsWith('Current worker:')&&!line.startsWith('Recorded worker:')))details.append(make('p',line));
          return[card.title,status,worker.replace(/^(Current|Recorded) worker: /,''),details];
        });
        table('public-'+kind,['Location','Status','Employee','Cleaning record'],rows,cleaningAvailable?'No current location rows supplied.':'Current cleaning status unavailable.');
      }
      table('public-tickets',['Location','Issue','Reported'],tickets.map(card=>[card.title,card.lines[0]||'Not provided',card.lines[1]||'Not provided']),summary?'No open tickets reported.':'Open ticket count and details unavailable.');
    }
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
    function showStatus(){
      if(offline){status.textContent='Offline. Current operations unavailable.';return;}
      const summaryStatus=summaryError?'Cleaning status unavailable. Please try again.':latestSummary
        ?'Read-only operations · updated '+new Date(latestSummary.meta.generated_at).toLocaleString('en-US',{timeZone:'America/Chicago'})+' Central'
        :'Loading read-only operations…';
      const mapStatus=mapError?' Approved map assets unavailable. Use Refresh to retry.':!mapReady?' Loading approved map assets…':'';
      status.textContent=summaryStatus+mapStatus;
    }
    function loadMap({resume=false}={}){
      if(mapReady||mapJob||state!=='active'||offline)return;
      const job={};
      mapJob=job;mapError=false;showStatus();
      void Promise.resolve().then(async()=>{
        if(mapJob!==job||state!=='active')return;
        map??=renderer.create({section,audience:'public_readonly',fetchImpl:(url,options)=>
          fetchImpl(url,{...options,signal:AbortSignal.timeout(15000)}),window,document});
        const ready=await (resume?map.resume():map.init());
        if(mapJob!==job||state!=='active')return;
        if(!ready)throw Error('map_assets');
        mapReady=true;
        operations.attachMap?.(map);
        if(latestSummary){
          map.accept(map.beginRefresh(),latestSummary);
          operations.updateSummary({summary:latestSummary,isCurrent:()=>state==='active'&&!offline});
        }
        showSummary(latestSummary);selectView();showStatus();
      }).catch(()=>{
        if(mapJob!==job)return;
        mapError=true;mapReady=false;map?.stop();map=null;
        operations.attachMap?.(null);selectView();showSummary(latestSummary);showStatus();
      }).finally(()=>{if(mapJob===job)mapJob=null;});
    }
    function refresh(){
      if(state!=='active'||offline)return Promise.resolve(false);
      loadMap();
      if(refreshJob)return refreshJob;
      const job=refreshSources().finally(()=>{if(refreshJob===job)refreshJob=null;});refreshJob=job;return job;
    }
    async function refreshSources(){
      const attempt=++generation,verifiedMap=mapReady?map:null;
      const ticket=verifiedMap?.beginRefresh();
      const feeds=operations.refresh({fetchImpl,preserveSummary:true,isCurrent:()=>current(attempt)}).catch(()=>{});
      try{
        const data=await read('/viewer-api/summary');
        if(!current(attempt))return false;
        if(data?.meta?.audience!=='public_readonly'||data.meta.contracts?.dashboard!=='dashboard.v1'
          ||!Number.isFinite(Date.parse(data.meta.generated_at))||!Array.isArray(data.restrooms)||!Array.isArray(data.exhibits)||!Array.isArray(data.open_tickets))throw Error('public_source_contract');
        latestSummary=data;summaryError=false;
        if(mapReady)map.accept(verifiedMap===map?ticket:map.beginRefresh(),data);
        operations.updateSummary({summary:data,isCurrent:()=>current(attempt)});
        showSummary(data);showStatus();
        return true;
      }catch{
        if(current(attempt)){
          latestSummary=null;summaryError=true;
          if(verifiedMap===map&&ticket)map.fail(ticket);else if(mapReady)map.invalidate();
          operations.summaryUnavailable?.();showSummary(null);showStatus();
        }
        return false;
      }finally{await feeds;}
    }
    function suspend(){
      if(state==='closed'||state==='suspended')return;state='suspended';generation++;refreshJob=null;
      for(const request of requests)request.abort();requests.clear();
      window.clearInterval(timer);window.clearInterval(clock);timer=null;clock=null;
      mapReadyBeforeSuspend=mapReady;mapReady=false;mapJob=null;
      latestSummary=null;summaryError=false;
      if(mapReadyBeforeSuspend)map?.suspend();else{map?.stop();map=null;}
      operations.suspend();showSummary(null);selectView();
    }
    function stop(){if(state==='closed')return;suspend();state='closed';map?.stop();operations.stop();for(const [target,event,fn]of listeners)target.removeEventListener(event,fn);}
    function activate({resumeMap=false}={}){
      state='active';operations.activate(null);showSummary(null);selectView();
      loadMap({resume:resumeMap});
      timer=window.setInterval(()=>{if(!document.hidden){void refresh();}},30000);
      clock=window.setInterval(()=>operations.tick(),1000);void refresh();}
    async function resume(){
      if(state!=='suspended')return false;
      offline=window.navigator?.onLine===false;
      if(offline&&mapReadyBeforeSuspend){map?.stop();map=null;mapReadyBeforeSuspend=false;}
      activate({resumeMap:mapReadyBeforeSuspend});return true;
    }
    async function init(){
      if(state!=='new')return false;state='initializing';
      listen(el('refresh-dashboard'),'click',()=>void refresh());
      listen(window,'hashchange',()=>{operations.closeBoard({history:false});selectView();});
      listen(window,'pagehide',event=>event.persisted?suspend():stop());listen(window,'pageshow',event=>{if(event.persisted)void resume();});
      listen(window,'offline',()=>{
        offline=true;generation++;refreshJob=null;latestSummary=null;summaryError=false;
        for(const request of requests)request.abort();
        if(mapJob&&!mapReady){mapJob=null;map?.stop();map=null;}
        map?.invalidate();operations.unavailable();showSummary(null);showStatus();
      });
      listen(window,'online',()=>{offline=false;void refresh();});
      offline=window.navigator?.onLine===false;
      activate();showStatus();return true;
    }
    return Object.freeze({init,refresh,suspend,resume,stop});
  }
  root.MemphisPublicViewer=Object.freeze({create});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisPublicViewer;
  if(root.document?.getElementById('refresh-dashboard'))void create().init();
})(typeof globalThis!=='undefined'?globalThis:this);
