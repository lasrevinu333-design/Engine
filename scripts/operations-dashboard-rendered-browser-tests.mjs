// Real page, styles, renderer and ticker code; synthetic GET responses only.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer((req,res)=>{
  const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+'/')||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;const results=[];
try{
  browser=await chromium.launch({headless:true});
  for(const reducedMotion of ['no-preference','reduce']){
    const context=await browser.newContext({viewport:{width:1905,height:851},deviceScaleFactor:2,reducedMotion});
    try{
      const page=await context.newPage();page.setDefaultTimeout(7000);
      const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
      const at=Date.now(),stamp=new Date(at).toISOString();
      let weatherRelease;const weatherGate=new Promise(r=>{weatherRelease=r;});
      const events=Array.from({length:5},(_,n)=>{
        const start=new Date(at+(n+1)*86400000),end=new Date(+start+7200000);
        return{id:'synthetic-event-'+n,name:'Synthetic upcoming event '+n+' with a complete readable record',date:start.toISOString().slice(0,10),
          start_at:start.toISOString(),end_at:end.toISOString(),location:'Synthetic venue',attendees:20+n,status:'SCHEDULED',needs_review:false};
      });
      await context.route('**/*',async route=>{
        const request=route.request(),u=new URL(request.url());
        if(u.hostname==='127.0.0.1')return route.continue();
        calls.push({url:request.url(),method:request.method(),authorization:request.headers().authorization});
        let data;
        if(u.hostname==='api.open-meteo.com'){
          await weatherGate;
          data={current:{time:Math.floor(at/1000),temperature_2m:64},current_units:{temperature_2m:'°F'},
            hourly:{time:[Math.floor((at+1800000)/1000)],temperature_2m:[63],precipitation_probability:[10]},hourly_units:{temperature_2m:'°F'}};
        }else if(u.origin==='https://memphis-zoo-mcp.onrender.com'){
          if(u.pathname==='/viewer-api/summary')data={ok:true,data:{meta:{audience:'public_readonly',contracts:{dashboard:'dashboard.v1'},generated_at:stamp},restrooms:[],exhibits:[],open_tickets:[]}};
          else if(u.pathname==='/viewer-api/operations')data={ok:true,data:{schema:'custodial.operations-board.v1',generated_at:stamp,timezone:'America/Chicago',events,
            schools:{state:'current',rows:[],generated_at:stamp},city:{state:'unavailable',rows:[]}}};
          else if(u.pathname==='/dashboard-api/current-attendance')data={ok:true,data:{attendance:17,source_timestamp:stamp,stale:false}};
          else return route.abort('blockedbyclient');
        }else return route.abort('blockedbyclient');
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/ops-viewer.html#map`);
      await page.waitForFunction(()=>document.querySelectorAll('.mzMapPin').length===47);
      await page.getByText('17',{exact:true}).waitFor({state:'visible'});
      assert.notEqual(await page.locator('#ops-clock').textContent(),'—','clock runs while optional forecast is delayed');
      assert.equal(await page.locator('#ops-weather').textContent(),'Unavailable');
      await page.waitForFunction(()=>document.querySelectorAll('#ops-events-ticker .tickerRecord').length===5);
      weatherRelease();await page.getByText('64°F',{exact:true}).waitFor({state:'visible'});
      const band=page.locator('.tickerBand[data-board="events"]'),viewport=band.locator('.tickerWindow');
      await page.mouse.move(1,1);
      if(reducedMotion==='no-preference')await page.waitForFunction(()=>document.querySelector('#ops-events-ticker').parentElement.scrollLeft>4);
      else{
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        assert.equal(await viewport.evaluate(el=>el.scrollLeft),0,'reduced motion remains still');
      }
      await band.click();
      const board=page.getByRole('dialog');await board.waitFor({state:'visible'});
      assert.equal(await board.locator('.boardCard').count(),5,'all records remain available in the readable board');
      await page.getByRole('button',{name:'Close / Back',exact:true}).click();await page.mouse.move(1,1);
      if(reducedMotion==='no-preference'){
        const before=await viewport.evaluate(el=>el.scrollLeft);
        await page.waitForFunction(before=>document.querySelector('#ops-events-ticker').parentElement.scrollLeft>before+4,before);
      }
      await page.evaluate(()=>document.documentElement.classList.add('dashboard-expanded'));
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.waitForFunction(()=>{const image=document.querySelector('[data-map-artwork]');return image?.complete&&image.naturalWidth>0;});
      const layout=await page.evaluate(()=>({height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,
        viewportHeight:innerHeight,viewportWidth:innerWidth,rootClass:document.documentElement.className,artworkReady:document.querySelector('[data-map-artwork]').naturalWidth>0,
        cards:[...document.querySelectorAll('.separateTelemetry>section')].map(el=>el.getBoundingClientRect().height)}));
      console.log(JSON.stringify({case:reducedMotion,layout}));
      if(process.env.MZ_RENDERED_DASHBOARD_SCREENSHOT)await page.screenshot({path:process.env.MZ_RENDERED_DASHBOARD_SCREENSHOT.replace('.png','-'+reducedMotion+'.png')});
      assert.ok(layout.artworkReady,'actual approved artwork loaded');
      assert.ok(layout.height<=layout.viewportHeight,'wide expanded map view fits measured desktop height');
      assert.ok(layout.width<=layout.viewportWidth,'no horizontal page overflow');
      assert.ok(layout.cards.every(h=>h<150),'metric cards remain compact');
      assert.deepEqual(errors,[]);
      assert.ok(calls.every(c=>c.method==='GET'&&!c.authorization),'anonymous GET fixture only');
      results.push({reducedMotion,records:5,sourceDelayDidNotBlock:true,layout,errors});
    }finally{await context.close();}
  }
  if(process.env.MZ_RENDERED_DASHBOARD_RECEIPT)writeFileSync(process.env.MZ_RENDERED_DASHBOARD_RECEIPT,JSON.stringify({status:'PASS',scope:'isolated actual-page Chromium; synthetic GETs, no real API/user browser/device',results},null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',scope:'isolated actual-page Chromium with synthetic GETs',results}));
}finally{await browser?.close();await new Promise(r=>server.close(r));console.log('OWNED_SYNTHETIC_BROWSER_AND_SERVER_CLOSED');}
