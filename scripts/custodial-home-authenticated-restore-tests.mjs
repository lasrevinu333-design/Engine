import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import './synthetic-schedule-locks.mjs';
import {installHomeFacts} from '../mobile/src/custodial/home-facts-dom.js';
import {installHourlyForecastKeyboard} from '../mobile/src/custodial/hourly-forecast-keyboard.js';
import {classifyReadiness,createReadinessObservation} from '../mobile/src/custodial/readiness.js';
import {principalIdentity,profileMatchesPrincipal,protectedPrincipal} from '../mobile/src/custodial/protected-principal.js';
import {zooServiceDate} from '../mobile/src/custodial/home-facts.js';
import * as keys from '../mobile/src/custodial/security-keys.js';
import {getCustodialBridgeSecurityRuntime} from '../mobile/src/custodial/security-runtime.js';
import {credentialRecoveryReasonForResponse,reconcileEnrollmentConfirmationRequired} from '../mobile/src/custodial/transport-policy.js';

// Every child executes the real store/runtime and app/controller, with only
// platform/HTTP/DOM adapters synthetic. No browser, device, native vault, real
// credential, external request, or runtime permission is created by this test.
const cases=['fresh-browser','fresh-native-status-refresh','optional-cache-write-failure','protected-open-finish',
  'http401-canonical','http403-operational','http500-cached','network-cached','malformed-profile-cached',
  'response-generation-change','response-principal-rotation','response-revocation',
  'cache-generation-change','cache-principal-rotation','cache-revocation','cache-unavailable','cache-profile-mutation',
  'startup-recovery-failure','startup-manager-required',
  'handshake-stale-generation','handshake-wrong-principal','handshake-missing-proof','handshake-reentry','handshake-exception'];
if(!process.argv.includes('--case')){
  const results=cases.map(name=>{
    const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--case',name],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
    return {name,passed:child.status===0,receipt:child.stdout.trim(),error:child.status===0?null:child.stderr.trim()};
  });
  console.log(JSON.stringify({scope:'Actual app, credential store, material security events, authenticated bridge transport/cache, and Home controller; synthetic memory/HTTP/DOM only',passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results},null,2));
  if(results.some(r=>!r.passed))process.exitCode=1;
}else{
  const name=process.argv[process.argv.indexOf('--case')+1];assert.ok(cases.includes(name));
  await run(name);
}

async function run(name){
  let checks=0;const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
  const uuid=n=>`a9000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const P={schema_version:'custodial-protected-principal.v1',device_id:'KIOSK_08',employee_id:uuid(1),credential_id:uuid(2),credential_operation_id:uuid(3),assignment_epoch:1,installation_seal:'synthetic-home-auth-seal',enrolled_at:'2026-08-01T00:00:00.000Z'};
  const Q={...P,employee_id:uuid(4),credential_id:uuid(5),credential_operation_id:uuid(6),assignment_epoch:2};
  const profileFor=p=>({authenticated:true,canonical_device_id:p.device_id,device_id:p.device_id,employee_id:p.employee_id,credential_id:p.credential_id,assignment_epoch:p.assignment_epoch,employee_name:'Synthetic Custodian',employee_role:'CUSTODIAL_EMPLOYEE'});
  const record=p=>JSON.stringify({schema_version:1,credential:'synthetic-not-a-live-credential',device_id:p.device_id,installation_seal:p.installation_seal,enrolled_at:p.enrolled_at,migrated_from_credential_only_state:false,credential_operation_id:p.credential_operation_id,principal:p});
  class MemoryStorage{
    constructor(entries=[]){this.data=new Map(entries);}get length(){return this.data.size;}key(n){return [...this.data.keys()][n]??null;}
    getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}clear(){this.data.clear();}
  }
  const retained=[['mz_scan_completion_draft:synthetic','{"original":"finish-draft"}'],['mz_native_notification_outbox:synthetic','{"original":"uncertain-receipt"}']];
  const local=new MemoryStorage([...keys.CUSTODIAL_DEVICE_KEYS.map(k=>[k,P.device_id]),[keys.CUSTODIAL_INSTALLATION_MARKER_KEY,P.installation_seal],...retained]);
  const secure=new Map([[keys.CUSTODIAL_INSTALLATION_RECORD_KEY,record(P)]]);
  let secureUnavailable=false,authCount=0,rotated=false,changed=false,controller,inHandshake=false;
  const handshakes=[],saveGenerations=[];
  if(name.endsWith('-cached'))local.data.set(`mz_custodial_home_cache:${encodeURIComponent(principalIdentity(P))}`,JSON.stringify({schema_version:'custodial-home-cache.v4',device_id:P.device_id,principal:P,cached_at:new Date().toISOString(),profile:profileFor(P)}));
  const events=new EventTarget(),documentEvents=new EventTarget(),elements=new Map(),calls=[],material=[];
  const element=id=>{if(!elements.has(id))elements.set(id,{hidden:id!=='boot',textContent:'',innerHTML:'',dataset:{},className:'',addEventListener(){}});return elements.get(id);};
  globalThis.localStorage=local;globalThis.sessionStorage=new MemoryStorage();
  globalThis.document={getElementById:element,hidden:false,addEventListener:documentEvents.addEventListener.bind(documentEvents)};
  globalThis.addEventListener=events.addEventListener.bind(events);globalThis.dispatchEvent=events.dispatchEvent.bind(events);
  globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};
  globalThis.fetch=async url=>{calls.push({kind:'public',path:String(url)});return new Response(JSON.stringify(String(url).includes('current-attendance')?{ok:true,data:{attendance:0,source_timestamp:new Date().toISOString()}}:{}));};
  events.addEventListener('memphis:custodial-security-state',e=>material.push({state:e.detail.state,generation:e.detail.generation,principal:principalIdentity(e.detail.principal)}));
  const {security,credentialStore}=getCustodialBridgeSecurityRuntime({secureStorage:{get:async k=>{if(secureUnavailable)throw Error('Synthetic protected store unavailable');return secure.get(k)??null;},set:async(k,v)=>secure.set(k,v),remove:async k=>secure.delete(k)},storage:local,cryptoApi:webcrypto,indexedDb:{databases:async()=>[],open(){throw Error('Unexpected synthetic database open');}}});
  const rotate=async()=>{rotated=true;secure.set(keys.CUSTODIAL_INSTALLATION_RECORD_KEY,record(Q));await security.ensureSecurityState();};
  const revoke=async()=>{try{await credentialStore.requireManagerRecovery('server_credential_rejected');}catch{};eq(security.getStatus().quarantined,true,'real store entered quarantine');};
  const source=readFileSync(new URL('../mobile/src/custodial/app.js',import.meta.url),'utf8');
  const bridgeSource=readFileSync(new URL('../mobile/src/custodial/bridge.js',import.meta.url),'utf8');
  const slice=(start,end)=>{const a=bridgeSource.indexOf(start),b=bridgeSource.indexOf(end,a);assert.ok(a>=0&&b>a,'exact current bridge function boundaries');return bridgeSource.slice(a,b);};
  const API='https://synthetic.invalid';
  const bridgeContext={security,credentialStore,localStorage:globalThis.localStorage,bridgeReady:Promise.resolve(),principalIdentity,profileMatchesPrincipal,protectedPrincipal,
    deviceId:()=>security.getStatus().deviceId,API,API_ORIGIN:API,URL,Headers,Request,Response,FormData,Blob,Date,Error,
    target:input=>new URL(input instanceof Request?input.url:input),rawFetch:()=>{throw Error('Unmocked transport denied');},nativeVault:name==='fresh-native-status-refresh',browserTestBuild:true,
    browserCredentialTransport:{authorizedFetch:async input=>{
      const path=new URL(input).pathname;calls.push({kind:'authenticated',path,generation:security.getStatus().generation});
      const p=security.getStatus().principal;
      if(path==='/device-auth/status'){
        authCount++;
        if(rotated)throw Error('No second synthetic assignment authorization was supplied');
        if(name==='network-cached')throw Error('Synthetic connection unavailable');
        if(name==='http401-canonical')return new Response(JSON.stringify({ok:false,code:'device_credential_recovery_required'}),{status:401});
        if(name==='http403-operational'||name==='http500-cached')return new Response(JSON.stringify({ok:false}),{status:name==='http403-operational'?403:500});
        if(name==='response-generation-change')await security.ensureSecurityState();
        if(name==='response-principal-rotation'&&!changed){changed=true;await rotate();}
        if(name==='response-revocation'&&!changed){changed=true;await revoke();}
      }
      const data=path==='/device-auth/status'?profileFor(p):path==='/schedule-api/my-day-summary'?{
        ...profileFor(p),schedule_delivery_mode:'LEGACY_REGISTERED',service_date:zooServiceDate(),publication_id:uuid(10),projection_id:uuid(11),
        home_facts:{service_date:zooServiceDate(),employee_id:p.employee_id,employee_name:'Synthetic Custodian',publication_id:uuid(10),projection_id:uuid(11),projection_status:'current',shift:{start:'08:00',end:'17:00'},lunch:{start:'13:00',end:'14:00'}}}:null;
      if(name==='malformed-profile-cached'&&path==='/device-auth/status')delete data.assignment_epoch;
      return new Response(JSON.stringify({ok:true,data}));
    }},
    // This suite concerns the authenticated profile fence, not provider effects.
    scheduleNotificationAuthority:{beginResponse:async()=>null,observe:async()=>true,unavailable:async()=>{}},reconcileScheduleNotifications:async()=>{},
    responsePayload:r=>r.clone().json(),responseError:(r)=>Object.assign(new Error('Synthetic HTTP rejection'),{status:r.status}),
    credentialRecoveryReasonForResponse,reconcileEnrollmentConfirmationRequired,
  };
  bridgeContext.nativeCustodialAuthorizedFetch=({input})=>bridgeContext.browserCredentialTransport.authorizedFetch(input);
  vm.createContext(bridgeContext);
  vm.runInContext(slice('  function currentPrincipal()','  function readScanEntryAttestation(')
    +slice('  async function requireRecoveryForRejectedCredential(','  async function confirmPendingEnrollment(')
    +'\nglobalThis.exactBridge={requestEnvelope,saveCustodialHomeCache,readCustodialHomeCache,currentPrincipalIdentity};',bridgeContext);
  const actualBridge=bridgeContext.exactBridge;
  globalThis.window={MemphisCustodialSecurity:security,addEventListener:events.addEventListener.bind(events),
    setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){},
    MemphisUI:{resolveOpenScanSession:()=>name==='protected-open-finish'?{state:'open',session:{location_name:'Original protected Place'}}:{state:'none'}},
    MemphisScanSync:{ready:Promise.resolve(true),listActions:async()=>[],recoverLocalCompletionIntents:async()=>{if(name==='startup-recovery-failure')throw Error('Original Finish requires recovery');},reconcileStartupRecovery:async()=>({state:name==='startup-manager-required'?'manager_required':'none'})},
    MemphisMobile:{whenReady:async()=>{},resumePendingSecurityWorkflow:async()=>{},
      principalIdentity:actualBridge.currentPrincipalIdentity,profileMatchesPrincipal:p=>{
        if(inHandshake&&name==='handshake-reentry')controller.stop();
        if(inHandshake&&name==='handshake-exception')throw Error('Synthetic current principal read failed');
        return profileMatchesPrincipal(p,security.getStatus().principal);
      },
      saveCustodialHomeCache:async value=>{
        const before=security.getStatus().generation;
        if(name==='optional-cache-write-failure')throw Error('Optional cache unavailable');
        const result=await actualBridge.saveCustodialHomeCache(value);
        if(name==='cache-generation-change')await security.ensureSecurityState();
        if(name==='cache-principal-rotation'&&!changed){changed=true;await rotate();}
        if(name==='cache-revocation'&&!changed){changed=true;await revoke();}
        if(name==='cache-unavailable'&&!changed){changed=true;secureUnavailable=true;await security.ensureSecurityState().catch(()=>{});}
        if(name==='cache-profile-mutation')value.profile.assignment_epoch++;
        saveGenerations.push({before,after:security.getStatus().generation});return result;
      },readCustodialHomeCache:actualBridge.readCustodialHomeCache,
      requestJson:async(path,options)=>(await actualBridge.requestEnvelope(path,options)).data},
  };
  const context={window,document,navigator:{onLine:false},sessionStorage,console,Date,Error,Promise,classifyReadiness,createReadinessObservation,installHourlyForecastKeyboard,
    installHomeFacts:options=>{
      controller=installHomeFacts(options);
      // Observe the actual local method; only hostile boundary cases alter its
      // caller-supplied argument or synchronously invalidate the invocation.
      return {...controller,authenticatedProfileRestored(profile,proof){
        let supplied=proof;
        if(name==='handshake-stale-generation')supplied={...proof,generation:proof.generation-1};
        if(name==='handshake-wrong-principal')supplied={...proof,principal:principalIdentity(Q)};
        if(name==='handshake-missing-proof')supplied=null;
        inHandshake=true;
        try{const accepted=controller.authenticatedProfileRestored(profile,supplied);handshakes.push({accepted,generation:proof.generation});return accepted;}
        finally{inHandshake=false;}
      }};
    },App:{addListener:async()=>{}},Network:{addListener:async()=>{}},StatusBar:{hide:async()=>{}}};
  vm.createContext(context);
  const executable=source.replace(/^import .*;\s*$/gm,'').replace('void (async () => {','globalThis.__startup = (async () => {');
  vm.runInContext(executable+'\nglobalThis.__restore=restore;',context);
  await context.__startup;for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  try{
    const success=['fresh-browser','fresh-native-status-refresh','optional-cache-write-failure','protected-open-finish'].includes(name);
    if(success){
      eq(material.filter(e=>e.state==='enrolled').length,1,'real runtime emits one material-ready event');
      eq(security.getStatus().generation>material[0].generation,true,'real repeated ready checks advance generation without a new event');
      eq(element('home').hidden,false,'fresh authenticated current profile reaches Home');
      eq(element('home-shift').textContent,'8:00 AM–5:00 PM','actual runtime/app sequence must start and render Home facts');
      eq(element('home-lunch').textContent,'1:00 PM–2:00 PM','current lunch rendered');
      eq(calls.some(c=>c.path==='/schedule-api/my-day-summary'),true,'actual authenticated schedule request runs');
      eq(handshakes.some(h=>h.accepted),true,'app invoked required authenticated handoff');
      if(name==='protected-open-finish'){eq(element('active-cleaning').hidden,false,'original Finish stays visible');eq(element('active-cleaning-text').textContent,'You are cleaning Original protected Place. Tap the same physical tag when you are done.','original protected Place retained');}
    }else{
      eq(handshakes.some(h=>h.accepted),false,'invalid/late/cached response cannot mint recovery');
      eq(calls.some(c=>c.path==='/schedule-api/my-day-summary'),false,'no authenticated schedule effect');
      eq(calls.some(c=>c.kind==='public'),false,'no informational effects');
      eq(element('home-shift').textContent,'Schedule unavailable','no stale schedule rendered');
      if(name.startsWith('handshake-'))eq(handshakes.length>0,true,'hostile local boundary was actually exercised');
      if(name.startsWith('cache-'))eq(saveGenerations.length>0,true,'actual cache await was reached');
      if(['response-generation-change','response-principal-rotation','response-revocation'].includes(name))eq(authCount>0,true,'response crossed actual dispatch capability');
      if(['http403-operational','http500-cached','network-cached','malformed-profile-cached'].includes(name))eq(security.getStatus().quarantined,false,'noncanonical rejection does not invent revocation');
      if(name==='http401-canonical')eq(security.getStatus().quarantined,true,'only canonical credential denial enters actual quarantine');
      // Neither a page timer nor healthy status polling can manufacture the
      // absent authenticated handoff after a failed or cached restore.
      await controller.update(true);
      eq(calls.some(c=>c.path==='/schedule-api/my-day-summary'),false,'ordinary update remains fail-closed');
    }
    for(const [key,value] of retained)eq(local.data.get(key),value,'protected original bytes remain intact');
    eq(secure.get(keys.CUSTODIAL_INSTALLATION_RECORD_KEY),record(rotated?Q:P),'no installation authority mutation except explicit synthetic rotation input');
    console.log(JSON.stringify({name,checks,material_generations:material.map(e=>e.generation),current_generation:security.getStatus().generation,handshakes,saveGenerations,authenticated_requests:calls.filter(c=>c.kind==='authenticated').map(c=>({path:c.path,generation:c.generation}))}));
  }finally{controller.stop();}
}
