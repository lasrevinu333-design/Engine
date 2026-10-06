import { test, expect } from '@playwright/test';
const manager='22222222-2222-4222-8222-222222222222',credential='33333333-3333-4333-8333-333333333333',employee='11111111-1111-4111-8111-111111111111';
async function configure(page,{staff=false,status=200}={}) {
  await page.route('**/memphis-auth.js',async route=>route.fulfill({contentType:'application/javascript',body:`
    window.__eventFixture={revoked:false};
    ${staff?`window.MemphisCustodialSecurity={native:true,getStatus:()=>({state:'enrolled',ready:!window.__eventFixture.revoked,available:true,deviceId:'KIOSK_08',generation:1}),mutateProtectedWork:async f=>f()};window.MemphisMobile={edition:'custodial',ready:Promise.resolve(),readCustodialHomeCache:()=>({profile:{employee_id:'${employee}',credential_id:'${credential}',assignment_epoch:1}})};`:`window.MemphisAuth={requireOpsManagerSession:async()=>window.MemphisAuth.readSession(),readSession:()=>window.__eventFixture.revoked?null:({role:'ops_manager',manager_id:'${manager}',credential_id:'${credential}',device_id:'fixture-browser',token:'fixture-only',expires_at:new Date(Date.now()+3600000).toISOString()})};`}
  `}));
  await page.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    expect(pathname).toBe(staff?'/employee-events-api':'/dashboard-api/events-feed');
    expect(Boolean(route.request().headers().authorization)).toBe(!staff);
    const feed={schema:'custodial.events-feed.v1',timezone:'America/Chicago',source:'events_app_events',state:'snapshot',coverage:'published_records_only',mailbox_completeness_verified:false,generated_at:new Date().toISOString(),rows:Array.from({length:8},(_,i)=>({id:`44444444-4444-4444-8444-${String(i+1).padStart(12,'0')}`,revision:2,timezone:'America/Chicago',name:'Synthetic event '+(i+1),location:'Fixture venue',date:'2099-10-06',end_date:'2099-10-06',start_time:'18:00:00',end_time:'21:00:00',status:'SCHEDULED',attendees:100,requirements:['Trash boxes requested'],custodial_notes:'Two trash boxes.'}))};
    const meta=staff?{canonical_device_id:'KIOSK_08',employee_id:employee,credential_id:credential,assignment_epoch:1}:{manager_id:manager,credential_id:credential};
    await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:status===200,feed,meta})});
  });
}
for(const staff of [false,true]) for(const viewport of [{width:1440,height:900},{width:412,height:915},{width:915,height:412}]) {
  test(`${staff?'staff':'manager'} shared scrolling page ${viewport.width}x${viewport.height}`,async({page})=>{
    await page.setViewportSize(viewport);await configure(page,{staff});await page.goto('/events.html');
    await expect(page.locator('.boardCard')).toHaveCount(8);await expect(page.locator('#events-back')).toHaveText(staff?'Back to Home':'Back to Map');
    await expect(page.locator('#events-status')).toContainText('Outlook collection completeness is not verified');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('#events-pause').click();await expect(page.locator('#events-pause')).toHaveAttribute('aria-pressed','true');
    await page.locator('#events-content').evaluate(el=>{el.scrollTop=100;});await page.waitForTimeout(150);
    expect(await page.locator('#events-content').evaluate(el=>el.scrollTop)).toBeGreaterThanOrEqual(99);
    await page.evaluate(()=>{window.__eventFixture.revoked=true;window.dispatchEvent(new Event('memphis:custodial-security-state'));});
    await expect(page.locator('.boardCard')).toHaveCount(0);
  });
}
test('unavailable source is not presented as empty events',async({page})=>{await configure(page,{status:503});await page.goto('/events.html');await expect(page.locator('#events-status')).toContainText('Events could not update');await expect(page.locator('#events-content')).toBeEmpty();});
test('reduced motion starts paused',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await configure(page);await page.goto('/events.html');await expect(page.locator('.boardCard')).toHaveCount(8);await expect(page.locator('#events-pause')).toHaveAttribute('aria-pressed','true');});
