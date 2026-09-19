const {test,expect}=require('@playwright/test');
const ENTRY='/build/batch-0b-shell-browser/custodial/index.html';
const EMPLOYEE='00000000-0000-4000-8000-000000000809';
function serviceDate(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-');}
async function fixture(context,{slow=false,unknown=false}={}){
  const state={offline:false,weatherFailed:false,count:unknown?null:0,time:new Date().toISOString(),calls:[],release:null};
  const blocked=new Promise(resolve=>{state.release=resolve;});
  await context.addInitScript(()=>{
    const key='capacitor-storage_memphis_zoo_custodial_installation_record_v1';
    if(!localStorage.getItem(key)){
      const record=JSON.stringify({schema_version:1,credential:'home-facts-fixture-device-credential',device_id:'KIOSK_08',installation_seal:'home-facts-fixture-seal',enrolled_at:'2026-08-01T00:00:00.000Z',migrated_from_credential_only_state:false});
      localStorage.setItem(key,JSON.stringify(record));localStorage.setItem('memphisZooCustodialInstallationSeal','home-facts-fixture-seal');
      for(const name of ['memphisAssignedDeviceId','mz_scan_device_id','mz_employee_hub_device_id'])localStorage.setItem(name,'KIOSK_08');
    }
  });
  const profile={authenticated:true,canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',employee_id:EMPLOYEE,employee_name:'Fixture Custodian',employee_role:'staff',credential_id:'00000000-0000-4000-8000-000000000810'};
  await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
    const path=new URL(route.request().url()).pathname;state.calls.push(path);
    if(state.offline)return route.abort('internetdisconnected');
    let data={};
    if(path==='/device-auth/status')data=profile;
    if(path==='/schedule-api/my-day-summary'){
      if(slow)await blocked;
      data={canonical_device_id:'KIOSK_08',device_id:'KIOSK_08',home_facts:{contract_version:'employee-home-time-facts.v1',service_date:serviceDate(),employee_id:EMPLOYEE,employee_name:profile.employee_name,projection_status:'current',shift:{active:true,shift_start:'08:00',shift_end:'17:00'},lunch:{start:'13:00',end:'14:00'}}};
    }
    if(path==='/dashboard-api/current-attendance')data={attendance:state.count,source_timestamp:state.time,stale:false};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,data})});
  });
  await context.route('https://api.open-meteo.com/**',async route=>{
    state.calls.push('weather');if(state.offline||state.weatherFailed)return route.abort('internetdisconnected');
    if(slow)await blocked;
    const now=Date.now()/1000;
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({hourly_units:{temperature_2m:'°F'},hourly:{time:[0,1,2,3].map(n=>now+n*3600),temperature_2m:[70,71,72,73],precipitation_probability:[0,10,20,30]}})});
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
  await expect(page.locator('.homeMenu .homeButton')).toHaveText(['Schedule','Messages','Events','Feedback']);
  await expect(page.locator('#employee-role')).toHaveText('Custodian');
  await expect(page.locator('#time-attendance')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await page.screenshot({path:require('node:path').resolve(__dirname,'../../completion-pass-20260918/home-phone-preview.png'),fullPage:true});
});
test('optional fact requests do not hold the employee on a loading screen',async({page,context})=>{
  const state=await fixture(context,{slow:true,unknown:true});await openHome(page);
  await expect(page.locator('.homeMenu .homeButton')).toHaveCount(4);
  await expect(page.locator('#home-guest-count')).toHaveText('Unavailable');
  await expect(page.locator('#home-shift')).toHaveText('Schedule unavailable');
  state.release();await expect(page.locator('#home-shift')).toHaveText('8:00 AM–5:00 PM');
});
test('saved Home facts survive a document reload offline without pretending they were just updated',async({page,context})=>{
  const state=await fixture(context);state.count=321;
  await openHome(page);await expect(page.locator('#home-guest-count')).toHaveText('321');
  await expect(page.locator('#home-shift')).toHaveText('8:00 AM–5:00 PM');
  await expect.poll(()=>page.evaluate(()=>{
    const raw=localStorage.getItem('mz_custodial_home_cache:KIOSK_08:facts');
    return raw&&JSON.parse(raw).records?.weather?.data?.hourly?.time?.length;
  })).toBe(4);
  state.offline=true;await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  if(await page.locator('#phone-lock').isVisible())await page.getByRole('button',{name:'Unlock',exact:true}).click();
  await expect(page.locator('#home-guest-count')).toHaveText('321');
  await expect(page.locator('#home-attendance-freshness')).toHaveAttribute('data-stale','true');
  await expect(page.locator('#home-schedule-freshness')).toHaveAttribute('data-stale','true');
  await expect(page.locator('.homeMenu .homeButton')).toHaveCount(4);
});
test('stale guest data and weather loss remain explicit while navigation stays usable',async({page,context})=>{
  const state=await fixture(context);state.count=50;state.time=new Date(Date.now()-2*3600000).toISOString();state.weatherFailed=true;
  await openHome(page);await expect(page.locator('#home-guest-count')).toHaveText('50');
  await expect(page.locator('#home-attendance-freshness')).toHaveAttribute('data-stale','true');
  await expect(page.locator('#home-weather-freshness')).toHaveText('Hourly weather unavailable.');
  await expect(page.locator('#home-weather-hours li')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Schedule',exact:true})).toBeVisible();
});
