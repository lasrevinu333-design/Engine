(function(root){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com';
  function create({window=root,document=root.document,fetchImpl=root.fetch.bind(root),renderer=root.MemphisDashboardMapRenderer,boards=root.MemphisOperationsDashboard}={}){
    const el=id=>document.getElementById(id),section=el('dashboard-map'),status=el('map-page-status');
    const requests=new Set(),listeners=[];
    let state='new',generation=0,scheduleGeneration=0,timer=null,clock=null,map=null;
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
    const make=(tag,text,klass)=>{const node=document.createElement(tag);node.textContent=text;if(klass)node.className=klass;return node;};
    const shown=value=>typeof value==='string'&&value.trim()?value:'Not provided';
    function clearSchedule(message){el('schedule-status').textContent=message;el('schedule-roster').replaceChildren();el('schedule-assignments').replaceChildren();}
    async function schedule(){
      if(state!=='active')return false;const attempt=++scheduleGeneration,date=el('schedule-date').value;
      clearSchedule('Reading published schedule…');
      try{
        const data=await read('/viewer-api/schedule?service_date='+encodeURIComponent(date));
        if(state!=='active'||attempt!==scheduleGeneration||el('schedule-date').value!==date)return false;
        if(data?.service_date!==date||data.projection_status!=='current'||!Array.isArray(data.roster)||!Array.isArray(data.assignments)){
          clearSchedule('A current published schedule is unavailable for this date.');return false;
        }
        el('schedule-status').textContent='Published schedule for '+date+' · all times Central';
        el('schedule-roster').replaceChildren(...data.roster.map(row=>{
          const card=make('article','','boardCard');
          card.append(make('h3',shown(row.employee_name||row.slot_label)),make('p','Shift: '+shown(row.shift_start)+' – '+shown(row.shift_end)),
            make('p','Lunch: '+shown(row.lunch_start)+' – '+shown(row.lunch_end)));
          if(row.active===false||row.staffing_state)card.append(make('p',row.active===false?'Not working':shown(row.staffing_state)));
          return card;
        }));
        el('schedule-assignments').replaceChildren(...data.assignments.map(row=>{
          const card=make('article','','boardCard');card.append(make('h3',shown(row.group_name)),
            make('p',shown(row.assigned_employee_name)+' · '+shown(row.coverage_start)+' – '+shown(row.coverage_end)),
            make('p',Array.isArray(row.included_locations)?row.included_locations.join(', '):'Locations unavailable'),
            make('p',[row.coverage_purpose,row.service_mode,row.status].filter(v=>typeof v==='string'&&v).join(' · ')));
          return card;
        }));return true;
      }catch{if(state==='active'&&attempt===scheduleGeneration)clearSchedule('Published schedule unavailable. Refresh to read it again.');return false;}
    }
    function suspend(){
      if(state==='closed'||state==='suspended')return;state='suspended';generation++;scheduleGeneration++;
      for(const request of requests)request.abort();requests.clear();
      window.clearInterval(timer);window.clearInterval(clock);timer=null;clock=null;
      operations.suspend();map?.suspend();section.hidden=true;clearSchedule('Schedule paused. Reopening reads the current source.');
    }
    function stop(){if(state==='closed')return;suspend();state='closed';map?.stop();operations.stop();for(const [target,event,fn]of listeners)target.removeEventListener(event,fn);}
    function activate(){state='active';section.hidden=false;operations.activate(map);
      timer=window.setInterval(()=>{if(!document.hidden){void refresh();void schedule();}},30000);
      clock=window.setInterval(()=>operations.tick(),1000);void refresh();void schedule();}
    async function resume(){
      if(state!=='suspended')return false;state='resuming';const attempt=generation;
      try{const ready=await map.resume();if(state!=='resuming'||generation!==attempt)return false;if(!ready)throw Error('map_resume');activate();return true;}
      catch{if(state==='resuming'){state='suspended';status.textContent='Map unavailable. Reload to retry.';}return false;}
    }
    async function init(){
      if(state!=='new')return false;state='initializing';
      el('schedule-date').value=new Date().toLocaleDateString('en-CA',{timeZone:'America/Chicago'});
      listen(el('refresh-dashboard'),'click',()=>void refresh());listen(el('refresh-schedule'),'click',()=>void schedule());
      listen(el('schedule-date'),'change',()=>void schedule());
      listen(window,'pagehide',event=>event.persisted?suspend():stop());listen(window,'pageshow',event=>{if(event.persisted)void resume();});
      listen(window,'offline',()=>{generation++;scheduleGeneration++;map?.invalidate();operations.unavailable();clearSchedule('Offline. Current schedule unavailable.');status.textContent='Offline. Current operations unavailable.';});
      listen(window,'online',()=>{void refresh();void schedule();});
      try{map=renderer.create({section,audience:'public_readonly',fetchImpl,window,document});
        if(!await map.init())throw Error('map_assets');if(state!=='initializing')return false;activate();return true;
      }catch{if(state==='initializing'){status.textContent='Approved map assets unavailable. Reload to retry.';stop();}return false;}
    }
    return Object.freeze({init,refresh,schedule,suspend,resume,stop});
  }
  root.MemphisPublicViewer=Object.freeze({create});
  if(typeof module!=='undefined'&&module.exports)module.exports=root.MemphisPublicViewer;
  if(root.document?.getElementById('schedule-date'))void create().init();
})(typeof globalThis!=='undefined'?globalThis:this);
