// Actual manager page/renderer/source, isolated Chromium and synthetic named
// auth/GET responses only. No account, production HTTP, phone or live sample.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,statSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),P=require('../memphis-zoo-perimeter.js'),root=resolve(new URL('..',import.meta.url).pathname);
const out='/mnt/ai_models/custodial-web-readiness-20261113-r1/evidence/gps-week-phone-perimeter-20261119';
const at=Date.parse('2026-11-19T17:00:00Z'),stamp=new Date(at).toISOString();
const ring=P.record.geometry.coordinates[0],phones=Array.from({length:9},(_,i)=>({deviceIdentifier:`KIOSK_${String(i+2).padStart(2,'0')}`,employeeId:`synthetic-${i}`,employeeName:`Synthetic ${i+2}`,assignmentEpoch:1,state:'live',position:{sampleId:`sample-${i}`,observedAt:new Date(at-1000).toISOString(),receivedAt:stamp,longitude:ring[27+i][0],latitude:ring[27+i][1],accuracyM:10}}));
phones.push({...phones[0],deviceIdentifier:'OUTSIDE_SYNTHETIC',employeeName:'Outside synthetic',position:{...phones[0].position,latitude:35.14,longitude:-90}});
const auth=`const s={role:'ops_manager',manager_id:'11000000-0000-4000-8000-000000000001',credential_id:'11000000-0000-4000-8000-000000000002',device_id:'SYNTHETIC_MANAGER',token:'SYNTHETIC_LOCAL_ONLY',permissions:{schema:'custodial.manager-permissions.v1',read:true}};window.MemphisAuth={readSession:()=>s,hasPermission:(p,x)=>x?.permissions?.[p]===true,requireOpsManagerSession:async()=>s,opsManagerAuthHeaders:async()=>({Authorization:'Bearer SYNTHETIC_LOCAL_ONLY'}),getDeviceId:()=>s.device_id};`;
const server=createServer((req,res)=>{const u=new URL(req.url,'http://localhost');const p=resolve(root,'.'+u.pathname);
 if(!p.startsWith(root+'/')||!existsSync(p)||!statSync(p).isFile()){res.writeHead(404).end();return;}
 res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[extname(p)]||'application/octet-stream');res.end(readFileSync(p));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;const results=[];
try{
 browser=await chromium.launch({headless:true});
 for(const width of [1440,800,412]){
  const context=await browser.newContext({viewport:{width,height:1000},timezoneId:'America/Chicago'});const errors=[],calls=[];
  await context.addInitScript(value=>{Date.now=()=>value;},at);
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());assert.equal(req.method(),'GET');
   if(u.hostname==='127.0.0.1'){
    if(u.pathname==='/memphis-auth.js')return route.fulfill({contentType:'text/javascript',body:auth});return route.continue();
   }
   calls.push({method:req.method(),path:u.pathname});let data;
   if(u.pathname==='/dashboard-api/phone-locations')data={ok:true,data:{phones},meta:{contract:'custodial.assigned-phone-location.v1',generated_at:stamp,perimeter_id:P.id}};
   else if(u.pathname==='/dashboard-api/gps-map-context')return route.fulfill({status:503,contentType:'application/json',body:'{"ok":false}'});
   else if(u.pathname==='/dashboard-api/summary')data={ok:true,data:{meta:{contracts:{dashboard:'dashboard.v1'},generated_at:stamp},restrooms:[],exhibits:[],open_tickets:[]}};
   else if(u.pathname==='/dashboard-api/operations')data={ok:true,data:{schema:'custodial.operations-board.v1',generated_at:stamp,timezone:'America/Chicago',events:[],schools:{state:'current',rows:[]},city:{state:'unavailable',rows:[]}}};
   else if(u.pathname==='/dashboard-api/current-attendance')data={ok:true,data:{attendance:0,source_timestamp:stamp,stale:false}};
   else if(u.hostname==='api.open-meteo.com')data={current:{time:at/1000,temperature_2m:60},current_units:{temperature_2m:'°F'}};
   else return route.abort('blockedbyclient');
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(`http://127.0.0.1:${server.address().port}/operations-dashboard.html#map`);
   await page.waitForFunction(()=>document.querySelectorAll('[data-phone-device]').length===9);
   assert.equal(await page.locator('.mzMapPin').count(),47);assert.equal(await page.locator('[data-phone-device="OUTSIDE_SYNTHETIC"]').count(),0);
   assert.equal(await page.locator('[data-zoo-perimeter]').count(),1);
   await page.locator('[data-map-viewport]').scrollIntoViewIfNeeded();
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const svg=await page.locator('[data-map-gps-layer]').boundingBox();assert.ok(svg?.width>0&&svg.height>0);
   const clip=await page.locator('.mapArtworkFrame').boundingBox();assert.ok(clip);
   assert.ok(svg.x>=clip.x-1&&svg.y>=clip.y-1&&svg.x+svg.width<=clip.x+clip.width+1&&svg.y+svg.height<=clip.y+clip.height+1,'the complete geographic surface is inside the actual visible artwork frame');
   for(let n=2;n<=10;n++){
    const dot=page.locator(`[data-phone-device="KIOSK_${String(n).padStart(2,'0')}"]`),box=await dot.boundingBox();assert.ok(box);
    assert.ok(box.x>=svg.x-1&&box.y>=svg.y-1&&box.x+box.width<=svg.x+svg.width+1&&box.y+box.height<=svg.y+svg.height+1,'whole-zoo phone dot remains inside displayed coordinate frame');
    assert.equal(await dot.getAttribute('data-phone-state'),'live');assert.match(await dot.textContent(),new RegExp(`Synthetic ${n}: live`));
   }
   const dimensions=await page.locator('[data-map-artwork]').evaluate(n=>({w:parseFloat(n.style.width),h:parseFloat(n.style.height)}));assert.ok(Math.abs(dimensions.h-dimensions.w*550/1282)<0.001,`artwork retains original aspect ratio within CSS numeric serialization: ${JSON.stringify(dimensions)}`);
   assert.match(await page.locator('[data-map-gps-status]').textContent(),/Assigned phones: 9 live/);assert.match(await page.locator('[data-map-gps-status]').textContent(),/Optional work history unavailable/);
   assert.deepEqual(errors,[]);await page.screenshot({path:out+`/manager-perimeter-${width}.png`,fullPage:true});
   results.push({width,phones:9,offsitePointWithheld:true,mapPins:47,perimeterVisible:true,artworkNotStretched:true,allPhoneDotsInFrame:true,pageErrors:0,requests:calls.length});
  }finally{await context.close();}
 }
 writeFileSync(out+'/MANAGER_PERIMETER_RENDERED_RESULTS.json',JSON.stringify({scope:'Actual local manager page; synthetic named auth and intercepted GETs only; no production/device acceptance',results},null,2)+'\n');console.log(JSON.stringify({pass:true,cases:results.length,results}));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
