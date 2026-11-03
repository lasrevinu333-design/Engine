const {test,expect}=require('./helpers/isolated-browser-test.cjs');
const {createHash}=require('node:crypto');
const digest=value=>createHash('sha256').update(value).digest('hex');
const fixedId=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ENTRY='/build/batch-0b-shell-browser/custodial/index.html';
const fixtureStates=new WeakMap();
const EMPLOYEE='00000000-0000-4000-8000-000000000809';
function serviceDate(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');}
async function fixture(context,{slow=false,unknown=false}={}){
  const state={offline:false,weatherFailed:false,count:unknown?null:0,time:new Date().toISOString(),calls:[],release:null};
  fixtureStates.set(context,state);
  const blocked=new Promise(resolve=>{state.release=resolve;});
  await context.addInitScript(()=>{
    const key='capacitor-storage_memphis_zoo_custodial_installation_record_v1';
    if(!localStorage.getItem(key)){
      const record=JSON.stringify({schema_version:1,credential:'home-facts-fixture-device-credential',device_id:'KIOSK_08',installation_seal:'home-facts-fixture-seal',enrolled_at:'2026-08-01T00:00:00.000Z',migrated_from_credential_only_state:false,principal:{schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:'00000000-0000-4000-8000-000000000809',credential_id:'00000000-0000-4000-8000-000000000810',credential_operation_id:'00000000-0000-4000-8000-000000000811',assignment_epoch:1,installation_seal:'home-facts-fixture-seal',enrolled_at:'2026-08-01T00:00:00.000Z'}});
      localStorage.setItem(key,JSON.stringify(record));localStorage.setItem('memphisZooCustodialInstallationSeal','home-facts-fixture-seal');
      for(const name of ['memphisAssignedDeviceId','mz_scan_device_id','mz_employee_hub_device_id'])localStorage.setItem(name,'KIOSK_08');
    }
  });
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',employee_id:EMPLOYEE,employee_name:'Fixture Custodian',employee_role:'staff',credential_id:'00000000-0000-4000-8000-000000000810',assignment_epoch:1};
  await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
    const path=new URL(route.request().url()).pathname;state.calls.push(path);
    if(state.offline)return route.abort('internetdisconnected');
    let data={};
    if(path==='/device-auth/status')data=profile;
    if(path==='/schedule-api/my-day-summary'){
      if(slow)await blocked;
      // Explicit synthetic current server projection; browser facts are not a native ACK.
      const date=serviceDate(),view={schema:'static-weekly.recurring-render-view.v1',service_date:date,employee_id:EMPLOYEE,
        employee_name:profile.employee_name,publication_id:fixedId(804),projection_id:fixedId(805),projection_status:'current',
        full_day:true,shift:{start:'08:00',end:'17:00'},raw_items:[{name:'Fixture Area',coverage_start:'08:00',coverage_end:'17:00'}]};
      const viewJsonText=JSON.stringify(view),target={schema:'static-weekly.recurring-application-target.v1',targetType:'SCHEDULE',operationId:fixedId(806),
        publicationId:fixedId(804),serviceDate:date,authorityRevision:1,deviceId:fixedId(808),employeeId:EMPLOYEE,
        credentialId:profile.credential_id,assignmentEpoch:1,projectionId:fixedId(805),lunchDocumentIdentity:'a'.repeat(64),viewDigest:digest(viewJsonText)};
      const targetText='{'+Object.keys(target).sort((a,b)=>a.length-b.length||(a<b?-1:a>b?1:0)).map(key=>JSON.stringify(key)+': '+JSON.stringify(target[key])).join(', ')+'}';
      data={...view,...profile,canonical_device_pk:fixedId(808),schedule_delivery_mode:'RECURRING_SCHEDULE',
        recurring_delivery:{intentId:fixedId(807),target,targetDigest:digest(targetText),applicationStatus:'DEVICE_REPORTED_APPLIED',view,viewJsonText,viewDigest:target.viewDigest},
        home_facts:{service_date:date,employee_id:EMPLOYEE,publication_id:fixedId(804),projection_id:fixedId(805),projection_status:'current',shift:view.shift,lunch:{start:'13:00',end:'14:00'}}};
    }
    if(path==='/dashboard-api/current-attendance')data={attendance:state.count,source_timestamp:state.time,stale:false};
    if(path==='/schedule-api/my-day-summary')state.day=data;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
  await context.route('https://api.open-meteo.com/**',async route=>{
    state.calls.push('weather');if(state.offline||state.weatherFailed)return route.abort('internetdisconnected');
    if(slow)await blocked;
    const now=Date.now()/1000;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({current_units:{time:'unixtime',temperature_2m:'°F'},current:{time:now,temperature_2m:70,weather_code:0},hourly_units:{time:'unixtime',temperature_2m:'°F',precipitation_probability:'%'},hourly:{time:[0,1,2,3].map(n=>now+n*3600),temperature_2m:[70,71,72,73],precipitation_probability:[0,10,20,30]}})});
  });
  return state;
}
async function openHome(page){await page.goto(ENTRY);await expect(page.locator('#phone-lock')).toBeVisible();await page.getByRole('button',{name:'Unlock',exact:true}).click();await expect(page.locator('#home')).toBeVisible();}
test('compiled Home renders authoritative shift, changed lunch, genuine zero attendance and hourly weather',async({page,context})=>{
  await fixture(context);await page.setViewportSize({width:390,height:844});await openHome(page);
  await expect(page.locator('#home-shift')).toHaveText('8:00 AM–5:00 PM');
  await expect(page.locator('#home-lunch')).toHaveText('1:00 PM–2:00 PM');
  await expect(page.locator('#home-guest-count')).toHaveText('0');
  await expect(page.locator('#home-weather-hours li')).toHaveCount(4);
  await expect(page.locator('#home-weather-hours strong').first()).toHaveText('70°F');
  await expect(page.locator('.homeMenu .homeButton')).toHaveText(['Memphis Messenger','My Schedule','Upcoming Events','💬Program Feedback','Supplies']);
  await expect(page.locator('#employee-role')).toHaveText('Custodian');
  await expect(page.locator('#time-attendance')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:test.info().outputPath('home-phone-preview.png'),fullPage:true});
});
test('optional fact requests do not hold the employee on a loading screen',async({page,context})=>{
  const state=await fixture(context,{slow:true,unknown:true});await openHome(page);
  await expect(page.locator('.homeMenu .homeButton')).toHaveCount(5);
  await expect(page.locator('#home-guest-count')).toHaveText('Unavailable');
  await expect(page.locator('#home-shift')).toHaveText('Schedule unavailable');
  state.release();await expect(page.locator('#home-shift')).toHaveText('8:00 AM–5:00 PM');
});
test('saved Home facts survive a document reload offline without pretending they were just updated',async({page,context})=>{
  const state=await fixture(context);state.count=321;
  await openHome(page);await expect(page.locator('#home-guest-count')).toHaveText('321');
  await expect(page.locator('#home-shift')).toHaveText('8:00 AM–5:00 PM');
  await expect.poll(()=>page.evaluate(()=>{
    const keys=Object.keys(localStorage).filter(key=>key.startsWith('mz_custodial_home_cache:')&&key.endsWith(':facts'));
    const raw=keys.length===1?localStorage.getItem(keys[0]):null;
    return raw&&JSON.parse(raw).records?.weather?.data?.hourly?.time?.length;
  })).toBe(4);
  state.offline=true;await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  if(await page.locator('#phone-lock').isVisible())await page.getByRole('button',{name:'Unlock',exact:true}).click();
  await expect(page.locator('#home-guest-count')).toHaveText('321');
  await expect(page.locator('#home-attendance-freshness')).toHaveAttribute('data-stale','true');
  await expect(page.locator('#home-schedule-freshness')).toHaveAttribute('data-stale','true');
  await expect(page.locator('.homeMenu .homeButton')).toHaveCount(5);
});
test('stale guest data and weather loss remain explicit while navigation stays usable',async({page,context})=>{
  const state=await fixture(context);state.count=50;state.time=new Date(Date.now()-2*3600000).toISOString();state.weatherFailed=true;
  await openHome(page);await expect(page.locator('#home-guest-count')).toHaveText('50');
  await expect(page.locator('#home-attendance-freshness')).toHaveAttribute('data-stale','true');
  await expect(page.locator('#home-weather-freshness')).toHaveText('Weather feed unavailable.');
  await expect(page.locator('#home-weather-hours li')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'My Schedule',exact:true})).toBeVisible();
});

test.afterEach(async({page,context},info)=>{if(info.status===info.expectedStatus)return;const state=fixtureStates.get(context);await info.attach('synthetic-home-fixture-diagnostics',{contentType:'application/json',body:JSON.stringify({fixture:state,browser:await page.evaluate(()=>({rows:Object.fromEntries(Object.keys(localStorage).filter(key=>/mz_custodial_home_cache|mz_employee_schedule_snapshot/.test(key)).map(key=>[key,localStorage.getItem(key)])),schedule:document.getElementById('home-schedule-freshness')?.textContent,shift:[...document.querySelectorAll('#home-shift')].map(x=>x.textContent),lunch:[...document.querySelectorAll('#home-lunch')].map(x=>x.textContent),profile:window.MemphisMobile?.readCustodialHomeCache?.()})).catch(error=>({error:String(error)}))},null,2)});});
