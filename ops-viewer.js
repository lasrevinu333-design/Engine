(function(root){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com';
  function create({window=root,document=root.document,fetchImpl=root.fetch.bind(root),renderer=root.MemphisDashboardMapRenderer,boards=root.MemphisOperationsDashboard,data=root.MemphisOperationsData,now=()=>Date.now()}={}){
    const el=id=>document.getElementById(id),section=el('dashboard-map'),status=el('map-page-status');
    const requests=new Set(),listeners=[];
    let state='new',generation=0,timer=null,clock=null,map=null,refreshJob=null;
    const operations=boards.create({window,document,audience:'public_readonly'});
    const listen=(target,event,fn)=>{target.addEventListener(event,fn);listeners.push([target,event,fn]);};
    const current=attempt=>state==='active'&&attempt===generation;
    function selectView(){
      const mapView=window.location?.hash==='#map';
      section.hidden=state!=='active'||!mapView;
      el('public-dashboard').hidden=state!=='active'||mapView;
      el('ops-locations-button').hidden=state!=='active'||!mapView;
      for(const name of ['dashboard','map']){
        const link=el('public-'+name+'-link');
        if((name==='map')===mapView)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
      }
    }
    const make=(tag,value)=>{const node=document.createElement(tag);if(value!=null)node.textContent=value;return node;};
    function showSummary(summary){
      const approved=Array.from(section.querySelectorAll('.mzMapPin')).map(pin=>({id:pin.dataset.locationId,name:pin.dataset.approvedLocationName}));
      const cards=data.publicCleaning(summary,approved,now()).cards;
      const labels={okay:'Clean / okay',not_cleaned:'Not cleaned',in_progress:'Cleaning',due_soon:'Due soon',overdue:'Overdue',pending_submit:'Saved pending',unknown:'Unknown'};
      const counts=Object.fromEntries(Object.keys(labels).map(key=>[key,cards.filter(card=>card.state===key).length]));
      const tickets=summary?data.tickets(summary,null).cards:[];
      const metrics=Object.entries(labels).map(([key,label])=>[label,summary?counts[key]:'—']);metrics.push(['Open tickets',summary?tickets.length:'—']);
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
          const worker=card.lines.find(line=>line.startsWith('Current worker:'))||card.lines.find(line=>line.startsWith('Recorded worker:'))||'Unavailable';
          const details=make('div');for(const line of card.lines.filter(line=>!line.startsWith('Current worker:')&&!line.startsWith('Recorded worker:')))details.append(make('p',line));
          return[card.title,status,worker.replace(/^(Current|Recorded) worker: /,''),details];
        });
        table('public-'+kind,['Location','Status','Employee','Cleaning record'],rows,summary?'No current location rows supplied.':'Current cleaning status unavailable.');
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
    function refresh(){
      if(state!=='active')return Promise.resolve(false);if(refreshJob)return refreshJob;
      const job=refreshSources().finally(()=>{if(refreshJob===job)refreshJob=null;});refreshJob=job;return job;
    }
    async function refreshSources(){
      const attempt=++generation,ticket=map.beginRefresh();
      const feeds=operations.refresh({fetchImpl,preserveSummary:true,isCurrent:()=>current(attempt)}).catch(()=>{});
      try{
        const data=await read('/viewer-api/summary');
        if(!current(attempt))return false;
        if(data?.meta?.audience!=='public_readonly'||data.meta.contracts?.dashboard!=='dashboard.v1'
          ||!Number.isFinite(Date.parse(data.meta.generated_at))||!Array.isArray(data.restrooms)||!Array.isArray(data.exhibits)||!Array.isArray(data.open_tickets))throw Error('public_source_contract');
        if(!map.accept(ticket,data))return false;
        status.textContent='Read-only operations · updated '+new Date(data.meta.generated_at).toLocaleString('en-US',{timeZone:'America/Chicago'})+' Central';
        operations.updateSummary({summary:data,isCurrent:()=>current(attempt)});showSummary(data);
        return true;
      }catch{
        if(current(attempt)){map.fail(ticket);operations.summaryUnavailable?.();showSummary(null);status.textContent='Cleaning status unavailable. Please try again.';}
        return false;
      }finally{await feeds;}
    }
    function suspend(){
      if(state==='closed'||state==='suspended')return;state='suspended';generation++;refreshJob=null;
      for(const request of requests)request.abort();requests.clear();
      window.clearInterval(timer);window.clearInterval(clock);timer=null;clock=null;
      operations.suspend();map?.suspend();showSummary(null);selectView();
    }
    function stop(){if(state==='closed')return;suspend();state='closed';map?.stop();operations.stop();for(const [target,event,fn]of listeners)target.removeEventListener(event,fn);}
    function activate(){state='active';operations.activate(map);selectView();
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
      listen(window,'hashchange',()=>{operations.closeBoard({history:false});selectView();});
      listen(window,'pagehide',event=>event.persisted?suspend():stop());listen(window,'pageshow',event=>{if(event.persisted)void resume();});
      listen(window,'offline',()=>{generation++;refreshJob=null;for(const request of requests)request.abort();map?.invalidate();operations.unavailable();showSummary(null);status.textContent='Offline. Current operations unavailable.';});
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
