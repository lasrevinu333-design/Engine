const { test, expect } = require('@playwright/test');

const USER_ID = '00000000-0000-4000-8000-000000000088';
const THREAD_ID = '00000000-0000-4000-8000-000000000001';
const FIRST_ID = '00000000-0000-4000-8000-000000000091';
const SECOND_ID = '00000000-0000-4000-8000-000000000092';
const DEVICE_ID = 'KIOSK_SYNC_TEST';

const GROUP_ORIGINAL_KEY = `mz_chatscope_group_pending:${USER_ID}`;
const GROUP_MEMBERS = ['00000000-0000-4000-8000-000000000071','00000000-0000-4000-8000-000000000072'];
function groupOriginal() {
  return {created_by_user_id:USER_ID,member_user_ids:[...GROUP_MEMBERS],title:'Original group',
    device_id:DEVICE_ID,client_thread_id:'thread:00000000-0000-4000-8000-000000000073'};
}
function groupResult(body) {
  // Normal new RPC returns its actual row with immutable original creation
  // metadata. This is a synthetic transport fixture, not SQL proof.
  return {id:THREAD_ID,thread_type:'group',created_by_user_id:body.created_by_user_id,
    client_thread_id:body.client_thread_id,title:body.title,is_active:true,deleted_at:null,
    original_group_creation:{schema:'custodial.group-original-creation.v1',created_by_user_id:body.created_by_user_id,
      client_thread_id:body.client_thread_id,title:body.title,member_user_ids:[...body.member_user_ids]}};
}
async function originalGroupFixture(context, {employee=false} = {}) {
  const h={posts:[],directPosts:[],threadList:null,readThreads:null,sessionOverride:null,respond:async(route,body)=>fulfillJson(route,groupResult(body))};
  await context.route('https://memphis-zoo-mcp.onrender.com/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==='/auth-api/session')return fulfillJson(route,{session:{token:'SYNTHETIC-GROUP-MANAGER',role:'ops_manager',roles:['OPS_MANAGER'],
      manager_id:'00000000-0000-4000-8000-000000000070',credential_id:'SYNTHETIC-GROUP-CREDENTIAL',
      device_id:DEVICE_ID,access_level:'full_access',read_only:false,expires_at:'2030-01-01T00:00:00.000Z',
      permissions:{schema:'custodial.manager-permissions.v1',owner:true,read:true},...(h.sessionOverride??{})},trusted_device:{device_id:DEVICE_ID}});
    if(path==='/messaging-api/me/by-device')return fulfillJson(route,{...identity(),role:employee?'employee':'manager'});
    if(path==='/messaging-api/users')return fulfillJson(route,GROUP_MEMBERS.map((id,index)=>({id,display_name:`Recipient ${index+1}`,role:'employee',is_active:true})));
    if(path==='/messaging-api/threads')return h.readThreads?h.readThreads(route):fulfillJson(route,h.threadList??[threadRow()]);
    if(path==='/messaging-api/thread/group'){
      const body=request.postDataJSON();h.posts.push(body);
      h.threadList??=[{...threadRow(),thread_type:'group',thread_title:body.title??'Group'}];
      return h.respond(route,body);
    }
    if(path==='/messaging-api/thread/direct'){
      h.directPosts.push(request.postDataJSON());return fulfillJson(route,{id:THREAD_ID});
    }
    if(path.endsWith('/updates')){
      await new Promise(resolve=>setTimeout(resolve,150));
      return fulfillJson(route,[],{next_cursor:{after:'1970-01-01T00:00:00.000Z',after_id:'00000000-0000-0000-0000-000000000000'}});
    }
    return fulfillJson(route,[]);
  });
  h.open=async page=>{
    await page.goto(`/messages.html?device=${DEVICE_ID}&hub=${employee?'employee':'manager'}`);
    await expect(page.getByRole('button',{name:'New',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'New',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
    await expect(page.locator('.mz-chat-new-list .mz-chat-user')).toHaveCount(2);
  };
  return h;
}

// Existing synthetic protected-mutation fixture, installed AFTER bootstrap.
// Select the actual group callback by its owning source contract, never by a
// counter shared with unrelated initial drafts/reads. Missing source marker
// or an overwritten fixture must fail phase evidence, not count as a pass.
async function observeOriginalGroupEffects(page, phase = null) {
  await page.evaluate(({key,device,phase})=>{
    const remove=Storage.prototype.removeItem,set=Storage.prototype.setItem;
    window.__groupEffectEvidence={removals:[],writes:[],phase:null,entered:false,settled:false};
    Storage.prototype.removeItem=function(k){
      if(k===key)window.__groupEffectEvidence.removals.push(this===localStorage?'local':'session');
      return remove.call(this,k);
    };
    Storage.prototype.setItem=function(k,value){
      if(k===key)window.__groupEffectEvidence.writes.push({area:this===localStorage?'local':'session',raw:String(value)});
      return set.call(this,k,value);
    };
    if(!phase)return;
    const fixture={native:true,ready:Promise.resolve(),getStatus:()=>({initialized:true,ready:true,available:true,deviceId:device,generation:1}),
      mutateProtectedWork:async operation=>{
        const source=String(operation);
        const owning=phase==='cleanup'?source.includes('group cleanup not confirmed'):
          source.includes('group original changed')&&source.includes('client_thread_id')&&source.includes('member_user_ids');
        if(!owning)return operation({generation:1,deviceId:device,assertCurrent:()=>{}});
        if(window.MemphisCustodialSecurity!==fixture)throw new Error('Group fixture replaced');
        if(window.__groupEffectEvidence.entered)throw new Error('Duplicate group-owned mutation before settlement');
        window.__groupEffectEvidence.phase=phase;window.__groupEffectEvidence.entered=true;
        await new Promise(resolve=>{window.__releaseOwnedGroupMutation=resolve;});
        try{return await operation({generation:1,deviceId:device,assertCurrent:()=>{}});}
        finally{window.__groupEffectEvidence.settled=true;}
      }};
    window.MemphisCustodialSecurity=fixture;
    if(window.MemphisCustodialSecurity!==fixture)throw new Error('Group fixture did not install');
  },{key:GROUP_ORIGINAL_KEY,device:DEVICE_ID,phase});
}

async function expectOriginalGroupDenial(page) {
  const held=page.getByText('Group result not confirmed. The original group is saved.',{exact:true});
  const withdrawn=page.getByText('This phone needs a manager. Access changed; saved messages are protected.',{exact:true});
  await expect(held.or(withdrawn)).toBeVisible();
  if(await withdrawn.isVisible())await expect(page.getByRole('dialog',{name:'Start conversation'})).toHaveCount(0);
  else await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
}

test('GROUP_ORIGINAL_NEW lost reply survives tab loss with one durable original group identity',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context);let lost=true;
    h.respond=async(route,body)=>lost?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Synthetic lost reply'})}):fulfillJson(route,groupResult(body));
    let page=await context.newPage();await h.open(page);
    for(const input of await page.locator('.mz-chat-user input').all())await input.check();
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect.poll(()=>h.posts.length).toBe(1);
    await expect(page.getByText('Group result not confirmed. The original group is saved.',{exact:true})).toBeVisible();
    const raw=await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY);
    expect(JSON.parse(raw)).toEqual(h.posts[0]);
    await page.close();page=await context.newPage();await h.open(page);lost=false;
    expect(await page.evaluate(key=>sessionStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBeNull();
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect.poll(()=>h.posts.length).toBe(2);expect(h.posts[1]).toEqual(h.posts[0]);
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toHaveCount(0);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([null,null]);
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW legacy session original is copied byte-for-byte before any group request',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal(),null,2);
    h.respond=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,error:'Synthetic lost reply'})});
    const page=await pageWithStorage(context,[]);
    await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw});
    await h.open(page);
    await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);
    expect(h.posts).toHaveLength(0);
    await page.getByRole('button',{name:'Create',exact:true}).click();await expect.poll(()=>h.posts.length).toBe(1);
    expect(h.posts[0]).toEqual(groupOriginal());
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,raw]);
  }finally{await context.close();}
});

for(const mode of ['malformed','foreign','conflict'])test(`GROUP_ORIGINAL_NEW ${mode} originals remain held without another identity`,async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context);
    const raw=mode==='malformed'?'{original malformed':JSON.stringify({...groupOriginal(),...(mode==='foreign'?{created_by_user_id:GROUP_MEMBERS[0]}:{})});
    const legacy=mode==='conflict'?JSON.stringify({...groupOriginal(),title:'Different original'}):null;
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);
    if(legacy!==null)await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw:legacy});
    await h.open(page);await expect(page.getByRole('button',{name:'Create',exact:true})).toBeDisabled();
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,legacy]);
    expect(h.posts).toHaveLength(0);
  }finally{await context.close();}
});

for(const mode of ['wrong-result','legacy-result','changed-session','changed-bytes'])test(`GROUP_ORIGINAL_NEW ${mode} cannot retire the original after reply`,async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());let release;
    h.respond=async(route,body)=>{
      await new Promise(resolve=>{release=resolve;});
      return fulfillJson(route,mode==='legacy-result'?{id:THREAD_ID}:{...groupResult(body),...(mode==='wrong-result'?{client_thread_id:'thread:00000000-0000-4000-8000-000000000099'}:{})});
    };
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await page.getByRole('button',{name:'Create',exact:true}).click();await expect.poll(()=>typeof release).toBe('function');
    const changed=JSON.stringify({...groupOriginal(),title:'Newer original'});
    if(mode==='changed-session')await page.evaluate(()=>{window.MemphisAuth.readSession().device_id='REPLACEMENT_DEVICE';});
    if(mode==='changed-bytes')await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw:changed});
    release();await expect(page.getByText(mode==='changed-bytes'?'Group save could not be confirmed. Original requests remain held.':
      ['wrong-result','legacy-result'].includes(mode)?'Group identity was returned. The original request remains held until its original creation tuple is confirmed.':
      'Group result not confirmed. The original group is saved.',{exact:true})).toBeVisible();
    expect(await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(mode==='changed-bytes'?changed:raw);
    expect(h.posts).toHaveLength(1);
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW exact bound original retires both byte-identical copies despite current group rename',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal(),null,2);
    h.respond=async(route,body)=>{
      const result={...groupResult(body),title:'Renamed active group'};
      h.threadList=[{...threadRow(),thread_type:'group',thread_title:result.title}];
      return fulfillJson(route,result);
    };
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);
    await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw});
    await h.open(page);await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toHaveCount(0);
    expect(h.posts).toEqual([groupOriginal()]);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([null,null]);
    await expect(page.getByText('Renamed active group',{exact:true}).first()).toBeVisible();
  }finally{await context.close();}
});

for(const mode of ['missing-original','foreign-original','wrong-original-key','wrong-original-title','reordered-original','extra-original','wrong-schema','retired-result'])
test(`GROUP_ORIGINAL_NEW ${mode} remains saved without callback or a new group identity`,async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());
    h.respond=async(route,body)=>{
      const result=groupResult(body),o=result.original_group_creation;
      if(mode==='missing-original')delete result.original_group_creation;
      if(mode==='foreign-original')o.created_by_user_id=GROUP_MEMBERS[0];
      if(mode==='wrong-original-key')o.client_thread_id='thread:00000000-0000-4000-8000-000000000099';
      if(mode==='wrong-original-title')o.title='Other original';
      if(mode==='reordered-original')o.member_user_ids.reverse();
      if(mode==='extra-original')o.unbound_current_members=true;
      if(mode==='wrong-schema')o.schema='custodial.group-original-creation.v0';
      if(mode==='retired-result'){result.is_active=false;result.deleted_at='2026-10-13T12:00:00.000Z';}
      return fulfillJson(route,result);
    };
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByText('Group identity was returned. The original request remains held until its original creation tuple is confirmed.',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Create',exact:true})).toBeDisabled();
    expect(await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);expect(h.posts).toEqual([groupOriginal()]);
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW purged original RPC refusal retains one original and never calls a successful continuation',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());
    h.threadList=[];
    h.respond=route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({ok:false,error:'Original group was retired; its original operation remains held and cannot create a replacement'})});
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByText('Group result not confirmed. The original group is saved.',{exact:true})).toBeVisible();
    expect(h.posts).toEqual([groupOriginal()]);expect(await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW current list absence cannot erase an exact accepted original',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());h.threadList=[];
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByText('Group result not confirmed. The original group is saved.',{exact:true})).toBeVisible();
    expect(h.posts).toEqual([groupOriginal()]);expect(await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
  }finally{await context.close();}
});

for(const mode of ['device-change','expired-session','read-permission-loss'])
test(`GROUP_ORIGINAL_NEW ${mode} during current thread readback preserves the original before cleanup`,async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());let release;
    h.readThreads=async route=>{
      if(h.posts.length===1)await new Promise(resolve=>{release=resolve;});
      return fulfillJson(route,h.threadList??[threadRow()]);
    };
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await page.getByRole('button',{name:'Create',exact:true}).click();await expect.poll(()=>typeof release).toBe('function');
    await page.evaluate(mode=>{
      const session=window.MemphisAuth.readSession();
      if(mode==='device-change')session.device_id='REPLACEMENT_DEVICE';
      if(mode==='expired-session')session.expires_at='2000-01-01T00:00:00.000Z';
      if(mode==='read-permission-loss')session.permissions.read=false;
    },mode);
    release();await expect(page.getByText('Group result not confirmed. The original group is saved.',{exact:true})).toBeVisible();
    expect(await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);expect(h.posts).toHaveLength(1);
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW changed legacy bytes before reply cannot clean either conflicting original',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal()),changed=JSON.stringify({...groupOriginal(),title:'Different legacy original'});let release;
    h.respond=async(route,body)=>{await new Promise(resolve=>{release=resolve;});return fulfillJson(route,groupResult(body));};
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);
    await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw});
    await h.open(page);await page.getByRole('button',{name:'Create',exact:true}).click();await expect.poll(()=>typeof release).toBe('function');
    await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw:changed});
    release();await expect(page.getByText('Group result not confirmed. The original group is saved.',{exact:true})).toBeVisible();
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,changed]);
    expect(h.posts).toHaveLength(1);await expect(page.getByRole('dialog',{name:'Start conversation'})).toBeVisible();
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW owner change in deferred cleanup preserves exact matched original',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());
    let currentGroupReads=0;
    h.readThreads=route=>{
      if(h.posts.length===1)currentGroupReads++;
      return fulfillJson(route,h.threadList??[threadRow()]);
    };
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await observeOriginalGroupEffects(page,'cleanup');
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>typeof window.__releaseOwnedGroupMutation)).toBe('function');
    expect(h.posts).toEqual([groupOriginal()]);expect(currentGroupReads).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.__groupEffectEvidence)).toEqual({removals:[],writes:[],phase:'cleanup',entered:true,settled:false});
    h.sessionOverride={device_id:'REPLACEMENT_DEVICE'};
    await page.evaluate(()=>{window.MemphisAuth.readSession().device_id='REPLACEMENT_DEVICE';window.__releaseOwnedGroupMutation();});
    await expect.poll(()=>page.evaluate(()=>window.__groupEffectEvidence.settled)).toBe(true);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,null]);
    expect(await page.evaluate(()=>window.__groupEffectEvidence.removals)).toEqual([]);expect(h.posts).toEqual([groupOriginal()]);
    await expectOriginalGroupDenial(page);
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW direct success preserves a pending legacy group',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context,{employee:true}),raw=JSON.stringify(groupOriginal());
    const page=await pageWithStorage(context,[]);
    await page.evaluate(({key,raw})=>sessionStorage.setItem(key,raw),{key:GROUP_ORIGINAL_KEY,raw});
    await h.open(page);await expect.poll(()=>page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);
    await page.locator('.mz-chat-new-list .mz-chat-user').first().click();
    await expect.poll(()=>h.directPosts.length).toBe(1);
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toHaveCount(0);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,raw]);
    expect(h.posts).toHaveLength(0);
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW permission changes during header admission send no group request',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await observeOriginalGroupEffects(page);
    await page.evaluate(()=>{
      const normal=window.MemphisAuth.requireOpsManagerSession;
      window.__groupHeaderHeld=true;window.__groupHeaderReleases=[];
      window.MemphisAuth.requireOpsManagerSession=async options=>{
        const session=await normal(options);
        if(window.__groupHeaderHeld)await new Promise(resolve=>{window.__groupHeaderReleases.push(resolve);});
        return session;
      };
      window.__releaseOriginalGroupAuth=()=>{
        window.__groupHeaderHeld=false;window.MemphisAuth.requireOpsManagerSession=normal;
        for(const resolve of window.__groupHeaderReleases.splice(0))resolve();
      };
    });
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect(page.getByText('Creating conversation…',{exact:true})).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>window.__groupHeaderReleases.length)).toBeGreaterThan(0);
    expect(h.posts).toHaveLength(0);
    h.sessionOverride={read_only:true,access_level:'read_only',permissions:{schema:'custodial.manager-permissions.v1',owner:false,read:true}};
    await page.evaluate(()=>{window.MemphisAuth.readSession().read_only=true;window.__releaseOriginalGroupAuth();});
    await expect.poll(()=>page.evaluate(()=>window.__groupHeaderReleases.length)).toBe(0);
    expect(h.posts).toHaveLength(0);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,null]);
    expect(await page.evaluate(()=>window.__groupEffectEvidence.removals)).toEqual([]);
    await expectOriginalGroupDenial(page);
    expect(h.posts).toHaveLength(0);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,null]);
    expect(await page.evaluate(()=>window.__groupEffectEvidence.removals)).toEqual([]);
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW retired dialog cannot clean the original after a late response',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());let release;
    h.respond=async(route,body)=>{
      await new Promise(resolve=>{release=resolve;});
      await fulfillJson(route,groupResult(body)).catch(()=>{}); // The normal withdrawal aborts the request.
    };
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await page.getByRole('button',{name:'Create',exact:true}).click();await expect.poll(()=>typeof release).toBe('function');
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('memphis:messenger-access-denied')));
    await expect(page.getByRole('dialog',{name:'Start conversation'})).toHaveCount(0);release();
    expect(await page.evaluate(key=>localStorage.getItem(key),GROUP_ORIGINAL_KEY)).toBe(raw);expect(h.posts).toHaveLength(1);
  }finally{await context.close();}
});

test('GROUP_ORIGINAL_NEW deferred group admission rechecks its named owner inside the protected mutation',async({browser})=>{
  const context=await browser.newContext();
  try{
    const h=await originalGroupFixture(context),raw=JSON.stringify(groupOriginal());
    const page=await pageWithStorage(context,[[GROUP_ORIGINAL_KEY,raw]]);await h.open(page);
    await observeOriginalGroupEffects(page,'admission');
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>typeof window.__releaseOwnedGroupMutation)).toBe('function');
    expect(await page.evaluate(()=>window.__groupEffectEvidence)).toEqual({removals:[],writes:[],phase:'admission',entered:true,settled:false});
    expect(h.posts).toHaveLength(0);
    h.sessionOverride={device_id:'REPLACEMENT_DEVICE'};
    await page.evaluate(()=>{window.MemphisAuth.readSession().device_id='REPLACEMENT_DEVICE';window.__releaseOwnedGroupMutation();});
    await expect.poll(()=>page.evaluate(()=>window.__groupEffectEvidence.settled)).toBe(true);
    expect(h.posts).toHaveLength(0);
    expect(await page.evaluate(key=>[localStorage.getItem(key),sessionStorage.getItem(key)],GROUP_ORIGINAL_KEY)).toEqual([raw,null]);
    expect(await page.evaluate(()=>window.__groupEffectEvidence.removals)).toEqual([]);expect(await page.evaluate(()=>window.__groupEffectEvidence.writes)).toEqual([]);
    await expectOriginalGroupDenial(page);
  }finally{await context.close();}
});

function identity() {
  return { msg_user_id: USER_ID, display_name: 'Sync Tester', role: 'employee', canonical_device_id: DEVICE_ID };
}

function threadRow(preview = 'Initial message', lastId = FIRST_ID, lastAt = '2026-07-18T12:00:00.000Z') {
  return {
    thread_id: THREAD_ID,
    thread_type: 'direct',
    thread_title: 'Operations',
    unread_count: preview === 'Live inbox update' ? 1 : 0,
    last_message_id: lastId,
    last_message_body: preview,
    last_message_at: lastAt,
    updated_at: lastAt,
    participant_names: 'Sync Tester, Operations',
    viewer_can_send: true,
  };
}

function message(id, body, sentAt, sender = USER_ID) {
  return {
    id,
    thread_id: THREAD_ID,
    sender_user_id: sender,
    sender_display_name: sender === USER_ID ? 'Sync Tester' : 'Operations',
    message_type: 'text',
    body,
    metadata_json: {},
    sent_at: sentAt,
    created_at: sentAt,
  };
}

function sendReceipt(body, threadId = THREAD_ID, serverId = String(body.client_message_id || '').replace(/^msg:/, '') || SECOND_ID) {
  return { ...message(serverId, String(body.body || '').replace(/^ +| +$/g, ''), new Date().toISOString(), body.sender_user_id || USER_ID), thread_id: threadId, client_message_id: body.client_message_id, metadata_json: { client_message_id: body.client_message_id } };
}

async function fulfillJson(route, data, meta = {}) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, data, meta }),
  });
}

async function pageWithStorage(context, entries) {
  const page = await context.newPage();
  await page.goto('/tests/storage-seed.html');
  await page.evaluate((rows) => {
    for (const [key, value] of rows) localStorage.setItem(key, value);
  }, entries);
  return page;
}

test('open thread reconciles a concurrent reply through the cursor long poll', async ({ browser }) => {
  const context = await browser.newContext();
  let liveAvailable = false;
  let updateCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      const rows = [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')];
      if (liveAvailable) rows.push(message(SECOND_ID, 'Live concurrent reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        liveAvailable = true;
        return fulfillJson(route, [message(SECOND_ID, 'Live concurrent reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          transport: 'cursor_long_poll',
          request_sequence: Number(url.searchParams.get('request_seq')),
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return fulfillJson(route, [], {
        transport: 'cursor_long_poll',
        request_sequence: Number(url.searchParams.get('request_seq')),
        next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
      });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/thread.html?thread_id=${THREAD_ID}&user_id=${USER_ID}&device=${DEVICE_ID}&hub=employee`);
  const messageList = page.locator('.cs-message-list');
  await expect(messageList.locator('.cs-message__content').getByText('Initial message', { exact: true })).toBeVisible();
  await expect(messageList.locator('.cs-message__content').getByText('Live concurrent reply', { exact: true })).toBeVisible();
  expect(updateCalls).toBeGreaterThanOrEqual(1);
  const cursorRequest = await page.evaluate(() => ({
    cursorAt: window.state?.updateCursorAt,
    cursorId: window.state?.updateCursorId,
  })).catch(() => ({}));
  expect(JSON.stringify(cursorRequest)).not.toContain('undefined error');
  await context.close();
});

test('employee thread selection loads once and background refresh stays unobtrusive', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let messageCalls = 0;
  let updateCalls = 0;
  let releaseUpdate;
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      messageCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 600));
      const rows = [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')];
      if (messageCalls > 1) rows.push(message(SECOND_ID, 'Quiet background reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        await updateGate;
        return fulfillJson(route, [message(SECOND_ID, 'Quiet background reply', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          transport: 'cursor_long_poll',
          request_sequence: Number(url.searchParams.get('request_seq')),
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], {
        transport: 'cursor_long_poll',
        request_sequence: Number(url.searchParams.get('request_seq')),
        next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
      });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) return fulfillJson(route, { marked: true });
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  const conversation = page.locator('.cs-conversation').filter({ hasText: 'Operations' });
  await expect(conversation).toBeVisible();
  await page.waitForTimeout(100);
  expect(messageCalls).toBe(0);

  await conversation.click();
  await expect.poll(() => messageCalls).toBe(1);
  await expect(page.locator('.cs-loader')).toHaveCount(1);
  const messageList = page.locator('.cs-message-list');
  await expect(messageList.getByText('Initial message', { exact: true })).toBeVisible();

  releaseUpdate();
  await expect.poll(() => messageCalls).toBe(2);
  await expect(messageList.getByText('Initial message', { exact: true })).toBeVisible();
  await expect(page.locator('.cs-loader')).toHaveCount(0);
  await expect(messageList.getByText('Quiet background reply', { exact: true })).toBeVisible();
  await context.close();
});

test('rapid composer sends reach the backend in the order they were entered', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const posted = [];
  const completed = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      const body = request.postDataJSON();
      posted.push(body.body);
      if (posted.length === 1) await firstGate;
      completed.push(body.body);
      return fulfillJson(route, sendReceipt(body));
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${DEVICE_ID}&hub=employee`);
  const editor = page.locator('.cs-message-input__content-editor');
  await expect(editor).toBeVisible();
  await editor.fill('First ordered message');
  await editor.press('Enter');
  await editor.fill('Second ordered message');
  await editor.press('Enter');

  await expect.poll(() => posted.length).toBe(1);
  await page.waitForTimeout(150);
  expect(posted).toEqual(['First ordered message']);
  releaseFirst();
  await expect.poll(() => completed.length).toBe(2);
  expect(completed).toEqual(['First ordered message', 'Second ordered message']);
  await context.close();
});

test('composer rejects 2001 and 4001 character messages before enqueueing, then sends a later valid message', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const posted = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      posted.push(request.postDataJSON());
      return fulfillJson(route, sendReceipt(request.postDataJSON()));
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${DEVICE_ID}&hub=employee`);
  const editor = page.locator('.cs-message-input__content-editor');
  await expect(editor).toBeVisible();
  for (const length of [2001, 4001]) {
    await editor.fill('x'.repeat(length));
    await editor.press('Enter');
    await expect(page.getByText('Messages can be up to 2,000 characters.', { exact: true })).toBeVisible();
    expect(posted).toHaveLength(0);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('mz_chatscope_outbox:')))).toEqual([]);
  }

  await editor.fill('later <valid> message & same thread');
  await editor.press('Enter');
  await expect.poll(() => posted.length).toBe(1);
  expect(posted[0].body).toBe('later <valid> message & same thread');
  await context.close();
});

test('a legacy invalid saved message is preserved, does not block a later same-thread send, and can be discarded', async ({ browser }) => {
  const context = await browser.newContext();
  const legacyId = 'msg:00000000-0000-4000-8000-000000000111';
  const validId = 'msg:00000000-0000-4000-8000-000000000112';
  const legacyKey = `mz_chatscope_outbox:${legacyId}`;
  const validKey = `mz_chatscope_outbox:${validId}`;
  const legacyBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v1',
    id: legacyId,
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    body: 'legacy message that must not replay',
    memphis: false,
    created_at: 1,
  });
  const validBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    id: validId,
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    body: 'later valid queued message',
    memphis: false,
    security_generation: null,
    created_at: 2,
  });
  const attempts = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      const body = request.postDataJSON();
      attempts.push(body.client_message_id);
      return fulfillJson(route, sendReceipt(body));
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[legacyKey, legacyBytes], [validKey, validBytes]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => attempts).toEqual([validId]);
  await expect(page.getByRole('alert', { name: 'Saved message recovery' })).toContainText('Saved message needs manager recovery.');
  expect(await page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBe(legacyBytes);
  expect(await page.evaluate((key) => localStorage.getItem(key), validKey)).toBeNull();
  await page.getByRole('button', { name: /Discard saved message/ }).click();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), legacyKey)).toBeNull();
  await context.close();
});

test('read-only conversations still acknowledge reads', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readBodies = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [{ ...threadRow(), viewer_can_send: false, unread_count: 1 }]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Read-only update', '2026-07-18T12:00:00.000Z', '00000000-0000-4000-8000-000000000077')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(route.request().postDataJSON());
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${DEVICE_ID}&hub=employee`);
  await expect(page.locator('.cs-message-list').getByText('Read-only update', { exact: true })).toBeVisible();
  await expect.poll(() => readBodies.length).toBeGreaterThan(0);
  expect(readBodies.at(-1).through_message_id).toBe(FIRST_ID);
  await expect(page.locator('.cs-message-input__content-editor')).toHaveAttribute('contenteditable', 'false');
  await context.close();
});

test('a saved read acknowledgement replays even when no messages are queued', async ({ browser }) => {
  const context = await browser.newContext();
  const key = `mz_chatscope_read_outbox:${USER_ID}:${THREAD_ID}`;
  const queuedRead = JSON.stringify({
    schema_version: 'chatscope-read-outbox.v2',
    id: key.slice('mz_chatscope_read_outbox:'.length),
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    through_message_id: FIRST_ID,
    through_at: '2026-07-18T12:00:00.000Z',
    created_at: 1,
  });
  const readBodies = [];
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(route.request().postDataJSON());
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[key, queuedRead]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => readBodies.length).toBe(1);
  expect(readBodies[0].through_message_id).toBe(FIRST_ID);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBeNull();
  await context.close();
});

test('READ_ORIGINAL_NEW an unsafe legacy read acknowledgement remains held without marking unseen messages', async ({ browser }) => {
  const context = await browser.newContext();
  const key = `mz_chatscope_read_outbox:${USER_ID}:${THREAD_ID}`;
  const legacyRead = JSON.stringify({
    schema_version: 'chatscope-read-outbox.v1',
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    created_at: 1,
  });
  let readCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readCalls += 1;
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[key, legacyRead]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect(page.getByText('A saved read acknowledgement cannot be verified.', { exact: false })).toBeVisible();
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(legacyRead);
  expect(readCalls).toBe(0);
  await context.close();
});

test('READ_ORIGINAL_NEW corrupt, unknown and missing-horizon rows remain byte-identical through selection', async ({ browser }) => {
  const context = await browser.newContext();
  const currentKey = `mz_chatscope_read_outbox:${USER_ID}:${THREAD_ID}`;
  const corruptKey = 'mz_chatscope_read_outbox:corrupt';
  const unknownKey = 'mz_chatscope_read_outbox:unknown';
  const corrupt = '{"schema_version":"chatscope-read-outbox.v2",';
  const unknown = JSON.stringify({ schema_version: 'future-read.v7', original_payload: 'retain exactly' });
  const missing = JSON.stringify({ schema_version: 'chatscope-read-outbox.v2', user_id: USER_ID,
    device_id: DEVICE_ID, thread_id: THREAD_ID, created_at: 1 });
  let readCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Existing unseen message', '2026-07-18T12:00:00.000Z', '00000000-0000-4000-8000-000000000077')]);
    }
    if (url.pathname.endsWith('/read')) { readCalls += 1; return fulfillJson(route, { marked: true }); }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, []);
    }
    return fulfillJson(route, {});
  });
  const page = await pageWithStorage(context, [[currentKey, missing], [corruptKey, corrupt], [unknownKey, unknown]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect(page.getByText('A saved read acknowledgement cannot be verified.', { exact: false })).toBeVisible();
  await page.locator('.cs-conversation').filter({ hasText: 'Operations' }).click();
  await expect(page.locator('.cs-message-list').getByText('Existing unseen message', { exact: true })).toBeVisible();
  expect(readCalls).toBe(0);
  expect(await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), [currentKey, corruptKey, unknownKey]))
    .toEqual([missing, corrupt, unknown]);
  await context.close();
});

test('READ_ORIGINAL_NEW a foreign saved horizon cannot be replaced by the current user', async ({ browser }) => {
  const context = await browser.newContext();
  const key = `mz_chatscope_read_outbox:${USER_ID}:${THREAD_ID}`;
  const foreign = JSON.stringify({ schema_version: 'chatscope-read-outbox.v2', id: `${USER_ID}:${THREAD_ID}`,
    thread_id: THREAD_ID, user_id: '00000000-0000-4000-8000-000000000099', device_id: DEVICE_ID,
    through_message_id: FIRST_ID, through_at: '2026-07-18T12:00:00.000Z', created_at: 1 });
  let readCalls = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(SECOND_ID, 'Current message', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')]);
    }
    if (url.pathname.endsWith('/read')) { readCalls += 1; return fulfillJson(route, { marked: true }); }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, []);
    }
    return fulfillJson(route, {});
  });
  const page = await pageWithStorage(context, [[key, foreign]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await page.locator('.cs-conversation').filter({ hasText: 'Operations' }).click();
  await expect(page.locator('.cs-message-list').getByText('Current message', { exact: true })).toBeVisible();
  expect(readCalls).toBe(0);
  expect(await page.evaluate((storageKey) => localStorage.getItem(storageKey), key)).toBe(foreign);
  await context.close();
});

test('a newer read horizon survives while the previous acknowledgement is in flight', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readBodies = [];
  let messagesIncludeSecond = false;
  let releaseUpdate;
  let releaseFirstRead;
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });
  const firstReadGate = new Promise((resolve) => { releaseFirstRead = resolve; });
  let updateCalls = 0;

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      const rows = [message(FIRST_ID, 'First visible horizon', '2026-07-18T12:00:00.000Z')];
      if (messagesIncludeSecond) rows.push(message(SECOND_ID, 'Second visible horizon', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(request.postDataJSON());
      if (readBodies.length === 1) await firstReadGate;
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        await updateGate;
        messagesIncludeSecond = true;
        return fulfillJson(route, [message(SECOND_ID, 'Second visible horizon', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID } });
    }
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await page.locator('.cs-conversation').filter({ hasText: 'Operations' }).click();
  await expect.poll(() => readBodies.length).toBe(1);
  expect(readBodies[0].through_message_id).toBe(FIRST_ID);
  releaseUpdate();
  await expect(page.locator('.cs-message-list').getByText('Second visible horizon', { exact: true })).toBeVisible();
  expect(readBodies).toHaveLength(1);
  releaseFirstRead();
  await expect.poll(() => readBodies.length).toBe(2);
  expect(readBodies.map((row) => row.through_message_id)).toEqual([FIRST_ID, SECOND_ID]);
  await context.close();
});

test('a message fetch that finishes after Chats does not mark the hidden conversation read', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const readBodies = [];
  let releaseUpdate;
  let releaseHiddenFetch;
  const updateGate = new Promise((resolve) => { releaseUpdate = resolve; });
  const hiddenFetchGate = new Promise((resolve) => { releaseHiddenFetch = resolve; });
  let messageCalls = 0;
  let updateCalls = 0;

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow('Hidden arrival', SECOND_ID, '2026-07-18T12:00:01.000Z')]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      messageCalls += 1;
      if (messageCalls === 2) await hiddenFetchGate;
      const rows = [message(FIRST_ID, 'Visible before backing out', '2026-07-18T12:00:00.000Z')];
      if (messageCalls >= 2) rows.push(message(SECOND_ID, 'Arrived while leaving', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077'));
      return fulfillJson(route, rows);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/read`) {
      readBodies.push(request.postDataJSON());
      return fulfillJson(route, { marked: true });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/updates`) {
      updateCalls += 1;
      if (updateCalls === 1) {
        await updateGate;
        return fulfillJson(route, [message(SECOND_ID, 'Arrived while leaving', '2026-07-18T12:00:01.000Z', '00000000-0000-4000-8000-000000000077')], {
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: SECOND_ID } });
    }
    if (url.pathname === '/messaging-api/threads/updates') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  const conversation = page.locator('.cs-conversation').filter({ hasText: 'Operations' });
  await conversation.click();
  await expect.poll(() => readBodies.length).toBeGreaterThan(0);
  const visibleReadCount = readBodies.length;
  releaseUpdate();
  await expect.poll(() => messageCalls).toBe(2);
  await page.getByRole('button', { name: 'Back to conversations' }).click();
  releaseHiddenFetch();
  await page.waitForTimeout(250);
  expect(readBodies).toHaveLength(visibleReadCount);
  await conversation.click();
  await expect.poll(() => readBodies.some((row) => row.through_message_id === SECOND_ID)).toBe(true);
  await context.close();
});

test('SELECTED_THREAD_NEW late A error cannot publish an error on B', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const otherThreadId = '00000000-0000-4000-8000-000000000002';
  let releaseA;
  const delayedA = new Promise((resolve) => { releaseA = resolve; });
  let aRequests = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [
      threadRow('Thread A'),
      { ...threadRow('Thread B'), thread_id: otherThreadId, thread_title: 'Thread B' },
    ]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      aRequests += 1;
      await delayedA;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'STALE_A_FAILURE' }) });
    }
    if (url.pathname === `/messaging-api/thread/${otherThreadId}/messages`) {
      return fulfillJson(route, [{ ...message(SECOND_ID, 'B remains visible', '2026-07-18T12:00:01.000Z'), thread_id: otherThreadId }]);
    }
    if (url.pathname === '/messaging-api/threads/updates' || url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, []);
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });
  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await page.locator('.cs-conversation').filter({ hasText: 'Thread A' }).click();
  await expect.poll(() => aRequests).toBe(1);
  await page.locator('.cs-conversation').filter({ hasText: 'Thread B' }).click();
  await expect(page.locator('.cs-message-list').getByText('B remains visible', { exact: true })).toBeVisible();
  const oldResponse = page.waitForResponse((response) => response.url().includes(`/thread/${THREAD_ID}/messages`) && response.status() === 503);
  releaseA();
  await oldResponse;
  await page.waitForTimeout(100);
  await expect(page.locator('.mz-chat-status.error')).toHaveCount(0);
  await expect(page.locator('.cs-message-list').getByText('B remains visible', { exact: true })).toBeVisible();
  await context.close();
});

test('SELECTED_THREAD_NEW old A completion cannot clear the newer A loading state', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const otherThreadId = '00000000-0000-4000-8000-000000000002';
  let releaseFirstA;
  let releaseSecondA;
  const firstA = new Promise((resolve) => { releaseFirstA = resolve; });
  const secondA = new Promise((resolve) => { releaseSecondA = resolve; });
  let aRequests = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [
      threadRow('Thread A'),
      { ...threadRow('Thread B'), thread_id: otherThreadId, thread_title: 'Thread B' },
    ]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      aRequests += 1;
      await (aRequests === 1 ? firstA : secondA);
      return fulfillJson(route, [message(FIRST_ID, 'A loaded', '2026-07-18T12:00:00.000Z')]);
    }
    if (url.pathname === `/messaging-api/thread/${otherThreadId}/messages`) {
      return fulfillJson(route, [{ ...message(SECOND_ID, 'B loaded', '2026-07-18T12:00:01.000Z'), thread_id: otherThreadId }]);
    }
    if (url.pathname === '/messaging-api/threads/updates' || url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, []);
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });
  const page = await context.newPage();
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  const a = page.locator('.cs-conversation').filter({ hasText: 'Thread A' });
  const b = page.locator('.cs-conversation').filter({ hasText: 'Thread B' });
  await a.click();
  await expect.poll(() => aRequests).toBe(1);
  await b.click();
  await expect(page.locator('.cs-message-list').getByText('B loaded', { exact: true })).toBeVisible();
  await a.click();
  await expect.poll(() => aRequests).toBe(2);
  await expect(page.locator('.cs-loader')).toHaveCount(1);
  const firstResponse = page.waitForResponse((response) => response.url().includes(`/thread/${THREAD_ID}/messages`));
  releaseFirstA();
  await firstResponse;
  await page.waitForTimeout(100);
  await expect(page.locator('.cs-loader')).toHaveCount(1);
  releaseSecondA();
  await expect(page.locator('.cs-message-list').getByText('A loaded', { exact: true })).toBeVisible();
  await expect(page.locator('.cs-loader')).toHaveCount(0);
  await context.close();
});

test('desktop and mobile inboxes refresh promptly from thread change cursors', async ({ browser }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    let changed = false;
    let updateCalls = 0;
    let identityDeviceId = '';
    await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/messaging-api/me/by-device') {
        identityDeviceId = url.searchParams.get('device_id') || '';
        return fulfillJson(route, identity());
      }
      if (url.pathname === '/messaging-api/threads') {
        return fulfillJson(route, [changed
          ? threadRow('Live inbox update', SECOND_ID, '2026-07-18T12:00:01.000Z')
          : threadRow()]);
      }
      if (url.pathname === '/messaging-api/threads/updates') {
        updateCalls += 1;
        if (updateCalls === 1) {
          changed = true;
          return fulfillJson(route, [{ thread_id: THREAD_ID, changed_at: '2026-07-18T12:00:01.000Z' }], {
            transport: 'cursor_long_poll',
            next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: THREAD_ID },
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return fulfillJson(route, [], {
          transport: 'cursor_long_poll',
          next_cursor: { after: '2026-07-18T12:00:01.000Z', after_id: THREAD_ID },
        });
      }
      return fulfillJson(route, {});
    });

    const page = await context.newPage();
    await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
    await expect(page.getByText('Live inbox update')).toBeVisible();
    expect(identityDeviceId).toBe(DEVICE_ID);
    expect(updateCalls).toBeGreaterThanOrEqual(1);
    await context.close();
  }
});

test('one permanently failing outbox entry does not block the next queued message', async ({ browser }) => {
  const context = await browser.newContext();
  const poisonThreadId = '00000000-0000-4000-8000-000000000002';
  const poisonMessageId = 'msg:00000000-0000-4000-8000-000000000201';
  const validMessageId = 'msg:00000000-0000-4000-8000-000000000202';
  const delivered = [];
  let poisonAttempts = 0;
  const poisonBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    id: poisonMessageId, thread_id: poisonThreadId, user_id: USER_ID,
    device_id: DEVICE_ID, body: 'stale queued message', memphis: false, security_generation: null, created_at: 1,
  });
  const validBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    id: validMessageId, thread_id: THREAD_ID, user_id: USER_ID,
    device_id: DEVICE_ID, body: 'deliver after poison entry', memphis: false, security_generation: null, created_at: 2,
  });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${poisonThreadId}/message`) {
      poisonAttempts += 1;
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Thread no longer exists' }) });
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      delivered.push(request.postDataJSON());
      return fulfillJson(route, sendReceipt(request.postDataJSON(), THREAD_ID, SECOND_ID));
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [
    [`mz_chatscope_outbox:${poisonMessageId}`, poisonBytes],
    [`mz_chatscope_outbox:${validMessageId}`, validBytes],
  ]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => delivered.length).toBe(1);
  expect(delivered[0].client_message_id).toBe(validMessageId);
  const outbox = await page.evaluate(({ badId, goodId }) => ({
    poison: JSON.parse(localStorage.getItem(`mz_chatscope_outbox:${badId}`) || 'null'),
    valid: localStorage.getItem(`mz_chatscope_outbox:${goodId}`),
  }), { badId: poisonMessageId, goodId: validMessageId });
  expect(outbox.poison.recovery_state).toBe('permanent');
  expect(outbox.poison.last_error).toContain('Thread no longer exists');
  expect(outbox.valid).toBeNull();
  await expect(page.getByRole('alert', { name: 'Saved message recovery' })).toContainText('Saved message needs manager recovery.');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(100);
  expect(poisonAttempts).toBe(1);
  await context.close();
});

test('a failed message blocks only later messages in the same conversation', async ({ browser }) => {
  const context = await browser.newContext();
  const otherThreadId = '00000000-0000-4000-8000-000000000003';
  const firstId = 'msg:00000000-0000-4000-8000-000000000301';
  const secondId = 'msg:00000000-0000-4000-8000-000000000302';
  const otherId = 'msg:00000000-0000-4000-8000-000000000303';
  let failFirst = true;
  const attempts = [];
  const queuedRows = [
    { id: firstId, thread_id: THREAD_ID, body: 'first in thread', created_at: 1 },
    { id: secondId, thread_id: THREAD_ID, body: 'second in thread', created_at: 2 },
    { id: otherId, thread_id: otherThreadId, body: 'other thread', created_at: 3 },
  ].map((row) => [`mz_chatscope_outbox:${row.id}`, JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    ...row,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    memphis: false,
    security_generation: null,
  })]);

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (request.method() === 'POST' && url.pathname.endsWith('/message')) {
      const body = request.postDataJSON();
      attempts.push(body.client_message_id);
      if (body.client_message_id === firstId && failFirst) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'temporary first-message failure' }) });
      }
      return fulfillJson(route, sendReceipt(body));
    }
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, queuedRows);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect.poll(() => attempts.includes(otherId)).toBe(true);
  expect(attempts).toEqual([firstId, otherId]);
  expect(await page.evaluate((id) => localStorage.getItem(`mz_chatscope_outbox:${id}`), secondId)).not.toBeNull();

  failFirst = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => attempts.filter((id) => id === secondId).length).toBe(1);
  expect(attempts).toEqual([firstId, otherId, firstId, secondId]);
  const remaining = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('mz_chatscope_outbox:')));
  expect(remaining).toEqual([]);
  await context.close();
});

test('a queued message owned by another signed-in user is preserved byte for byte', async ({ browser }) => {
  const context = await browser.newContext();
  const foreignId = 'msg:00000000-0000-4000-8000-000000000401';
  const foreignBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    id: foreignId,
    thread_id: THREAD_ID,
    user_id: '00000000-0000-4000-8000-000000000999',
    device_id: DEVICE_ID,
    body: 'do not erase another account message',
    memphis: false,
    security_generation: null,
    created_at: 1,
  });
  let messagePosts = 0;

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (request.method() === 'POST' && url.pathname.endsWith('/message')) messagePosts += 1;
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: '00000000-0000-0000-0000-000000000000' } });
    }
    return fulfillJson(route, {});
  });

  const page = await pageWithStorage(context, [[`mz_chatscope_outbox:${foreignId}`, foreignBytes]]);
  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await expect(page.getByText('A saved message belongs to another signed-in user. Sign in as that user to send it.', { exact: true })).toBeVisible();
  expect(messagePosts).toBe(0);
  expect(await page.evaluate((id) => localStorage.getItem(`mz_chatscope_outbox:${id}`), foreignId)).toBe(foreignBytes);
  await context.close();
});

test('a delivered message survives a security-generation transition and retries with one stable id', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const nativeDeviceId = 'KIOSK_08';
  const page = await pageWithStorage(context, []);
  await page.addInitScript(({ deviceId: authoritativeDeviceId }) => {
    window.__messagingSecurityGeneration = 1;
    window.MemphisCustodialSecurity = {
      native: true,
      ready: Promise.resolve(),
      waitForStableState: async () => ({ generation: window.__messagingSecurityGeneration }),
      getStatus: () => ({
        ready: true,
        initialized: true,
        available: true,
        quarantined: false,
        deviceId: authoritativeDeviceId,
        generation: window.__messagingSecurityGeneration,
      }),
      mutateProtectedWork: async (operation, options = {}) => {
        const current = window.__messagingSecurityGeneration;
        if (options.expectedGeneration != null && Number(options.expectedGeneration) !== current) {
          const error = new Error('security generation changed');
          error.code = 'custodial_security_generation_changed';
          throw error;
        }
        return operation({ generation: current });
      },
    };
    window.MemphisMobile = {
      edition: 'custodial',
      ready: Promise.resolve(),
      deviceId: () => authoritativeDeviceId,
      authoritativeDeviceId: async () => authoritativeDeviceId,
      employeeDeviceAuthority: true,
      requestEnvelope: async (path, { method = 'GET', body, signal } = {}) => {
        const response = await fetch(`https://memphis-zoo-mcp.onrender.com${path}`, {
          method,
          signal,
          headers: {
            'X-Device-Id': authoritativeDeviceId,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
        return payload;
      },
    };
    window.MemphisMobileBuildIdentity = { edition: 'custodial' };
  }, { deviceId: nativeDeviceId });

  const attempts = [];
  const committed = new Set();
  let releaseFirstResponse;
  const firstResponseGate = new Promise((resolve) => { releaseFirstResponse = resolve; });

  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/auth-api/session') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'No manager session' }) });
    }
    if (url.pathname === '/scan-api/rpc') return fulfillJson(route, []);
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, { ...identity(), canonical_device_id: nativeDeviceId });
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/messages`) {
      return fulfillJson(route, [message(FIRST_ID, 'Initial message', '2026-07-18T12:00:00.000Z')]);
    }
    if (url.pathname === `/messaging-api/thread/${THREAD_ID}/message` && request.method() === 'POST') {
      const body = request.postDataJSON();
      attempts.push(body.client_message_id);
      committed.add(body.client_message_id);
      if (attempts.length === 1) await firstResponseGate;
      return fulfillJson(route, sendReceipt(body));
    }
    if (url.pathname.endsWith('/read')) return fulfillJson(route, { marked: true });
    if (url.pathname.endsWith('/updates')) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return fulfillJson(route, [], { next_cursor: { after: '2026-07-18T12:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  await page.goto(`/messages.html?thread_id=${THREAD_ID}&device=${nativeDeviceId}&hub=employee`);
  const editor = page.locator('.cs-message-input__content-editor');
  await expect(editor).toBeVisible();
  await editor.fill('survive the generation transition');
  await editor.press('Enter');
  await expect.poll(() => attempts.length).toBe(1);
  await page.evaluate(() => { window.__messagingSecurityGeneration = 2; });
  releaseFirstResponse();
  await expect(page.getByText('Your message is saved. Server confirmation is still pending.', { exact: true })).toBeVisible();
  const queuedKey = await page.evaluate(() => Object.keys(localStorage).find((key) => key.startsWith('mz_chatscope_outbox:')) || '');
  expect(queuedKey).not.toBe('');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).security_generation, queuedKey)).toBe(1);

  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toBe(attempts[0]);
  expect(committed.size).toBe(1);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), queuedKey)).toBeNull();
  await context.close();
});

test('custodial restore quarantine freezes the message outbox across retry events', async ({ browser }) => {
  const context = await browser.newContext();
  const queuedId = 'msg:00000000-0000-4000-8000-000000000299';
  const queuedBytes = JSON.stringify({
    schema_version: 'chatscope-message-outbox.v2',
    id: queuedId,
    thread_id: THREAD_ID,
    user_id: USER_ID,
    device_id: DEVICE_ID,
    body: 'preserve without retry mutation',
    memphis: false,
    security_generation: null,
    created_at: 3,
    retry_count: 7,
    last_error: 'original failure',
  });
  const page = await pageWithStorage(context, [[`mz_chatscope_outbox:${queuedId}`, queuedBytes]]);
  await page.addInitScript(() => {
    window.MemphisCustodialSecurity = {
      ensureSecurityState: async () => {},
      getStatus: () => ({ initialized: true, available: true, quarantined: true, reason: 'restored_operational_state' }),
    };
  });

  let messagePosts = 0;
  await context.route('https://memphis-zoo-mcp.onrender.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.endsWith('/message')) messagePosts += 1;
    if (url.pathname === '/messaging-api/me/by-device') return fulfillJson(route, identity());
    if (url.pathname === '/messaging-api/threads') return fulfillJson(route, [threadRow()]);
    if (url.pathname.endsWith('/updates')) {
      return fulfillJson(route, [], { next_cursor: { after: '1970-01-01T00:00:00.000Z', after_id: FIRST_ID } });
    }
    return fulfillJson(route, {});
  });

  await page.goto(`/messages.html?device=${DEVICE_ID}&hub=employee`);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new CustomEvent('memphis:messenger-resume'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate((id) => localStorage.getItem(`mz_chatscope_outbox:${id}`), queuedId)).toBe(queuedBytes);
  expect(messagePosts).toBe(0);
  await context.close();
});
