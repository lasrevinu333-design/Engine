const { test, expect } = require('@playwright/test');
const version = 'release-2026.07.19.custodial-v3.12';
const at = '2026-09-18T18:00:00.000Z';
async function setup(context) {
  const state = { fail:false, result:'near', session:'session-A', captured:at };
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const reply = data => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    if(path === '/auth-api/session') return reply({ok:true,data:{session:{token:'gps-browser-local-fixture',manager_display_name:'GPS Fixture Manager',manager_job_title:'Custodial Manager',role:'ops_manager',roles:['CUSTODIAL_MANAGER','SECURITY_ADMIN'],manager_id:'00000000-0000-4000-8000-000000000901',credential_id:'00000000-0000-4000-8000-000000000902',device_id:'gps-browser',access_level:'full_access',read_only:false,trusted_device:true,expires_at:'2036-01-01T00:00:00Z'}}});
    if(state.fail) return route.abort('internetdisconnected');
    if(path === '/version') return reply({ok:true,version,contracts:{dashboard:'dashboard.v1'}});
    if(path === '/dashboard-api/current-attendance') return reply({ok:true,data:{attendance:100}});
    if(path === '/dashboard-api/summary') return reply({ok:true,data:{restrooms:[],exhibits:[{location_code:'NOCX',location_name:'Nocturnal',status_code:'overdue',open_session_status:'active',open_session_uuid:'session-A',open_session_device_identifier:'KIOSK_08',open_session_employee_name:'Karen Robinson',services_performed:[]}],open_tickets:[]}});
    if(path === '/dashboard-api/work-session-alerts') return reply({ok:true,data:[{session_uuid:state.session,session_status:'active',location_code:'NOCX',device_identifier:'KIOSK_08',result:state.result,scanned_at:at,payload_json:{observed_at:state.captured,authoritative:true,authority_scope:'surveyed_location_radius'}}]});
    return reply({ok:true,data:{}});
  });
  return state;
}
test('GPS changes green/red/green only for the exact active cleaning; dashboard has no inspection controls', async ({page,context}) => {
  await page.clock.install({time:new Date(at)});
  const state = await setup(context);
  await page.goto(`/dashboard.html?build=${version}&backend_version=${version}`);
  const dot = page.locator('#exhibit-wrap .workSignalDot');
  await expect(dot).toHaveClass(/workSignal-near/);
  await expect(dot).toHaveAttribute('role','img');
  await expect(dot).toHaveAccessibleName(/Within the scanned cleaning area/);
  state.result='away'; await page.evaluate(()=>refreshData());
  await expect(dot).toHaveClass(/workSignal-away/);
  state.result='near'; await page.evaluate(()=>refreshData());
  await expect(dot).toHaveClass(/workSignal-near/);
  state.session='other-session'; await page.evaluate(()=>refreshData());
  await expect(dot).toHaveClass(/workSignal-warn/);
  await expect(page.locator('.sectionTitle')).toHaveText(['Restroom Status Report','Exhibit Status Report','Open Tickets']);
  await expect(page.getByRole('button',{name:/inspect/i})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/inspect/i})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:/inspection|inspection score/i})).toHaveCount(0);
});
test('GPS ages to unknown even when a dashboard refresh cannot reach the server', async ({page,context}) => {
  await page.clock.install({time:new Date(at)});
  const state = await setup(context);
  await page.goto(`/dashboard.html?build=${version}&backend_version=${version}`);
  const dot=page.locator('#exhibit-wrap .workSignalDot');
  await expect(dot).toHaveClass(/workSignal-near/);
  state.fail=true;
  await page.clock.fastForward(125000);
  await expect(dot).toHaveClass(/workSignal-warn/);
  await expect(dot).not.toHaveClass(/workSignal-near|workSignal-away/);
  await expect(dot).toHaveAccessibleName(/GPS is stale; last capture/);
});
test('a freshly uploaded old capture is not displayed as live proximity', async ({page,context}) => {
  await page.clock.install({time:new Date(at)});
  const state=await setup(context);
  state.captured='2026-09-18T16:00:00.000Z';
  await page.goto(`/dashboard.html?build=${version}&backend_version=${version}`);
  const dot=page.locator('#exhibit-wrap .workSignalDot');
  await expect(dot).toHaveClass(/workSignal-warn/);
  await expect(dot).toHaveAccessibleName(/GPS is stale; last capture/);
});
