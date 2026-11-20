// Isolated loopback page + synthetic GET fixtures; no account/browser/device action.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname),out=process.env.CUSTODIAL_MAP_EVIDENCE||'/mnt/ai_models/custodial-web-readiness-20261113-r1/evidence/map-messenger-priorities-20261119';
const prior='6fdb19e3252bb829acd025bf0a0142abc46b0eeb',changed=['ops-viewer.html','operations-dashboard.html','operations-dashboard.js','operations-dashboard-data.js','operations-dashboard.css'];
const baselineRoot=process.env.CUSTODIAL_MAP_BASELINE_ROOT||root;
const originals=new Map(changed.map(p=>[p,execFileSync('git',['show',prior+':'+p],{cwd:baselineRoot})]));
const server=createServer((req,res)=>{
 let path=new URL(req.url,'http://localhost').pathname,baseline=path.startsWith('/baseline/');if(baseline)path=path.slice('/baseline'.length);
 const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
 res.end(baseline&&originals.has(path.slice(1))?originals.get(path.slice(1)):readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const at=Date.parse('2026-11-19T14:00:00Z'),stamp=new Date(at).toISOString();
const events=Array.from({length:5},(_,i)=>({id:'synthetic-'+i,name:i===0?'Next <img src=x> event':'Later synthetic event '+i+' with a long readable name',date:'2026-11-19',start_at:new Date(at+(i+1)*3600000).toISOString(),end_at:'2026-11-20T02:00:00Z',location:'Synthetic location',attendees:i===0?42:20,status:'SCHEDULED',needs_review:false}));
const school={id:'school1',name:'Next School',date:'2026-11-19',arrival_at:'2026-11-19T15:15:00Z',status:'SCHEDULED',students:50,adults:10,teachers:2,chaperones:8,unclassified:0,total:60,buses:2};
const results=[];let browser;
async function fixture({width,baseline=false,reduced=false,state='ready',hold=false}){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:reduced?'reduce':'no-preference'});
 await context.addInitScript(value=>{Date.now=()=>value;},at);
 const calls=[],errors=[];let release;const gate=new Promise(r=>{release=r;});if(!hold)release();
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.hostname==='127.0.0.1')return route.continue();
  calls.push({method:req.method(),authorization:!!req.headers().authorization,path:u.pathname});assert.equal(req.method(),'GET');assert.equal(!!req.headers().authorization,false);
  let data;
  if(u.hostname==='api.open-meteo.com')data={current:{time:at/1000,temperature_2m:64},current_units:{temperature_2m:'°F'},hourly:{time:[at/1000+1800],temperature_2m:[65],precipitation_probability:[0]},hourly_units:{temperature_2m:'°F'}};
  else if(u.pathname==='/viewer-api/summary')data={ok:true,data:{meta:{audience:'public_readonly',contracts:{dashboard:'dashboard.v1'},generated_at:stamp},restrooms:[],exhibits:[],open_tickets:[]}};
  else if(u.pathname==='/viewer-api/operations'){
   await gate;if(state==='unavailable')return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
   const schoolRows=state==='empty'?[]:state==='review'?[{...school,arrival_at:null}]:state==='school-review-next'?[{...school,id:'bad-school',name:'School needs review',arrival_at:null},school]:[school];
   const eventRows=state==='empty'?[]:state==='review'?events.map(row=>({...row,needs_review:true})):state==='seconds'?[{...events[0],id:'a-local-later',name:'Local later',start_at:null,start_time:'09:00:50'},{...events[1],id:'z-instant-earlier',name:'Instant earlier',start_at:'2026-11-19T15:00:10Z'}]:events;
   data={ok:true,data:{schema:'custodial.operations-board.v1',generated_at:stamp,timezone:'America/Chicago',events:eventRows,schools:{state:'current',generated_at:stamp,rows:schoolRows},city:{state:'unavailable',rows:[]}}};
  }else if(u.pathname==='/dashboard-api/current-attendance')data={ok:true,data:{attendance:17,source_timestamp:stamp,stale:false}};
  else return route.abort('blockedbyclient');
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/${baseline?'baseline/':''}ops-viewer.html#map`);
 await page.waitForFunction(()=>document.querySelectorAll('.mzMapPin').length===47);
 return {page,context,calls,errors,release};
}
const measure=page=>page.evaluate(()=>{
 const band=document.querySelector('[data-board="events"]'),track=document.querySelector('#ops-events-ticker'),label=band.querySelector('.tickerLabel'),window=band.querySelector('.tickerWindow');
 const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
 return {band:rect(band),label:rect(label),window:rect(window),distance:track.style.getPropertyValue('--ticker-distance'),duration:track.style.getPropertyValue('--ticker-duration'),records:Array.from(track.children).map(n=>n.textContent),pageWidth:document.documentElement.scrollWidth};
});
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,800,412])for(const reduced of [false,true]){
  const old=await fixture({width,baseline:true,reduced});let baseline;
  try{await old.page.waitForFunction(()=>document.querySelectorAll('#ops-events-ticker .tickerRecord').length===5);baseline=await measure(old.page);assert.deepEqual(old.errors,[]);}finally{await old.context.close();}
  const f=await fixture({width,reduced,hold:true});
  try{
   assert.match(await f.page.locator('#ops-events-next-title').textContent(),/Loading events/);assert.match(await f.page.locator('#ops-schools-next-title').textContent(),/Loading school/);
   f.release();await f.page.locator('#ops-events-next-title').getByText('Next <img src=x> event',{exact:true}).waitFor();
   assert.equal(await f.page.locator('#ops-events-next-headcount').textContent(),'42 planned people');assert.match(await f.page.locator('#ops-events-next-when').textContent(),/9:00 AM CST/);
   assert.equal(await f.page.locator('#ops-schools-next-title').textContent(),'Next School');assert.equal(await f.page.locator('#ops-schools-next-headcount').textContent(),'60 planned people');
   assert.equal(await f.page.locator('#ops-events-next img').count(),0);assert.equal(await f.page.locator('.expectedCard').count(),0);
   const current=await measure(f.page);assert.deepEqual(current.records,baseline.records);assert.equal(current.window.width,baseline.window.width);assert.equal(current.label.width,baseline.label.width);assert.equal(current.distance,baseline.distance);assert.equal(current.duration,baseline.duration);assert.equal(current.pageWidth,baseline.pageWidth);
   const fixedBefore=await f.page.locator('#ops-events-next').boundingBox();
   if(reduced)assert.equal(await f.page.locator('#ops-events-ticker').evaluate(n=>n.parentElement.scrollLeft),0);
   else await f.page.waitForFunction(()=>document.querySelector('#ops-events-ticker').parentElement.scrollLeft>8);
   const fixedAfter=await f.page.locator('#ops-events-next').boundingBox();assert.equal(fixedAfter.x,fixedBefore.x);assert.equal(fixedAfter.y,fixedBefore.y);
   await f.page.locator('[data-board="events"]').focus();await f.page.keyboard.press('Enter');await f.page.getByRole('dialog').waitFor({state:'visible'});assert.equal(await f.page.locator('#operations-board-content .boardCard').count(),5);
   await f.page.getByRole('button',{name:'Close / Back',exact:true}).click();await f.page.locator('[data-board="schools"]').click();assert.equal(await f.page.locator('#operations-board-content .boardCard').count(),1);await f.page.getByRole('button',{name:'Close / Back',exact:true}).click();
   await f.page.screenshot({path:out+`/map-next-${width}-${reduced?'reduced':'motion'}.png`,fullPage:true});assert.deepEqual(f.errors,[]);
   results.push({width,reduced,pass:true,recordsUnchanged:true,tickerWidthAndSpeedUnchanged:true,fixedDetailsStill:true,keyboardBoard:true,mapPins:47,requests:f.calls.length});
  }finally{await f.context.close();}
 }
 for(const state of ['empty','unavailable']){
  const f=await fixture({width:1440,state});try{
   await f.page.waitForFunction(()=>document.querySelector('#ops-events-next').dataset.state!=='loading');
   const expected=state==='empty'?'No upcoming events loaded':'Events unavailable';assert.equal(await f.page.locator('#ops-events-next-title').textContent(),expected);
   assert.equal(await f.page.locator('#ops-events-next-headcount').textContent(),'');assert.equal(await f.page.locator('#ops-schools-next').getAttribute('data-state'),state);
   await f.page.locator('[data-board="events"]').click();await f.page.getByRole('dialog').waitFor({state:'visible'});assert.deepEqual(f.errors,[]);results.push({state,pass:true});
  }finally{await f.context.close();}
 }
 for(const state of ['review','school-review-next','seconds']){
  const f=await fixture({width:1440,state});try{
   await f.page.waitForFunction(()=>document.querySelector('#ops-events-next').dataset.state!=='loading');
   if(state==='review'){
    assert.equal(await f.page.locator('#ops-events-next').getAttribute('data-state'),'review');
    assert.equal(await f.page.locator('#ops-schools-next-title').textContent(),'School visits need source review');
    assert.equal(await f.page.locator('#ops-schools-next-headcount').textContent(),'');
   }else if(state==='school-review-next')assert.equal(await f.page.locator('#ops-schools-next-title').textContent(),'Next School');
   else assert.equal(await f.page.locator('#ops-events-next-title').textContent(),'Instant earlier');
   await f.page.locator('[data-board="schools"]').click();await f.page.getByRole('dialog').waitFor({state:'visible'});
   if(state!=='seconds')assert.match(await f.page.locator('#operations-board-content').textContent(),/Visit time needs review/);
   assert.deepEqual(f.errors,[]);results.push({state,pass:true,fixedAndFullListConsistent:true});
  }finally{await f.context.close();}
 }
 writeFileSync(out+'/MAP_RENDERED_RESULTS.json',JSON.stringify({scope:'Headless isolated Chromium; synthetic GETs only; no deployment or real account/device',results},null,2)+'\n');console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
