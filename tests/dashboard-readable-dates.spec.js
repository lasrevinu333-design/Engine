const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
for(const width of [1440,390])test(`readable dashboard dates and City details at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(url.hostname!=='127.0.0.1')return route.abort();
  if(url.pathname==='/operations-dashboard.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync('operations-dashboard.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'')});
  return route.continue();
 });
 await page.goto('/operations-dashboard.html');
 await page.addScriptTag({url:'/operations-dashboard-data.js'});await page.addScriptTag({url:'/operations-dashboard.js'});
 await page.evaluate(async()=>{
  let now=Date.parse('2026-11-12T17:00:00Z');window.fixtureSetNow=value=>{now=Date.parse(value);};
  const controller=MemphisOperationsDashboard.create({audience:'public_readonly',now:()=>now});controller.activate(null);
  const data={schema:'custodial.operations-board.v1',timezone:'America/Chicago',generated_at:new Date(now).toISOString(),events:[{id:'e',name:'Synthetic event',location:'Birdhouse',date:'2026-11-13',start_time:'08:00',end_time:'17:00',attendees:60,status:'SCHEDULED'}],schools:{state:'snapshot',generated_at:new Date(now).toISOString(),coverage:'imported_only',mailbox_completeness_verified:false,rows:[{id:'s',name:'Synthetic school',date:'2026-11-13',arrival_at:'2026-11-13T14:00:00Z',students:40,adults:20}]},city:{state:'current',generated_at:new Date(now).toISOString(),coverage:'city_active_zoo',rows:[{id:'1',work_order_id:'123',facility:'15Z05 Birdhouse at North Parkway and McLean Boulevard',status:'Approved',description:'.5-inch supply pipe leaking; replace fitting. Zoo location: Birdhouse kitchen',requested_at:'2026-11-12T14:00:00Z'}]}};
  await controller.refresh({headers:{},isCurrent:()=>true,summary:{open_tickets:[{ticket_id:'1',location_name:'Birdhouse',maintenance_issue:'Light repair',date_submitted_display:'11/13/2026 08:00 AM Central'}]},fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/operations')?{ok:true,data}:{}})});
  document.getElementById('operations-panels').hidden=false;window.fixtureController=controller;
 });
 await expect(page.locator('#ops-events-ticker')).not.toContainText('Today,');await expect(page.locator('#ops-schools-ticker')).not.toContainText('Today,');
 await page.evaluate(()=>{window.fixtureSetNow('2026-11-13T06:00:00Z');window.fixtureController.tick();});
 await expect(page.locator('#ops-events-ticker')).toContainText('Today, Friday, November 13');await expect(page.locator('#ops-schools-ticker')).toContainText('Today, Friday, November 13');
 await page.screenshot({path:`/tmp/dashboard-today-tickers-${width}.png`});
 for(const kind of ['events','schools','tickets','city']){
  await page.evaluate(kind=>window.fixtureController.openBoard(kind),kind);
  const board=page.locator('#operations-board');await expect(board).toBeVisible();
  await expect(page.locator('#operations-board-content')).toContainText(kind==='city'?'#123 · 15Z05 Birdhouse':'Friday, November 13');
  if(kind==='events'){await expect(board).toContainText('Attendees: 60');await expect(board).toContainText('Birdhouse');}
  if(kind==='city'){await expect(board).not.toContainText('North Parkway');await expect(board).toContainText('Approved');await expect(board).toContainText('.5-inch supply pipe leaking; replace fitting.');await expect(page.locator('#ops-city-ticker')).toContainText('.5-inch supply pipe leaking; replace fitting.');await expect(board).toContainText('Birdhouse kitchen');}
  await page.screenshot({path:`/tmp/dashboard-${kind}-${width}.png`});
  await page.locator('#operations-board-close').click();await expect(board).not.toBeVisible();
 }
 await page.evaluate(()=>window.fixtureController.stop());
});
