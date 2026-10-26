import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const script=readFileSync(new URL('../mobile/src/custodial/native-recurring-application.js',import.meta.url),'utf8');
const wait=()=>new Promise(r=>setImmediate(r));
// The actual private sink, with EXPLICIT synthetic owner callbacks. This is
// a hostile-copy unit boundary, not the separate normal29-factory qualification
// and not a native receipt/OS/effect/currentness admission.
async function fixture(source) {
 const listeners=new Map(),posts=[];
 const context=vm.createContext({console,URL,document:{readyState:'complete',addEventListener(){}},
  location:{href:'https://localhost/employee-schedule.html'},
  addEventListener:(name,fn)=>listeners.set(name,fn),
  custodialRecurringScheduleApplication:{postMessage:raw=>posts.push(JSON.parse(raw)),addEventListener:(name,fn)=>listeners.set('port:'+name,fn)}});
 context.retire=()=>listeners.get('pagehide')?.();
 vm.runInContext('globalThis.top=globalThis;globalThis.window=globalThis;globalThis.getterCalls=0;'+source,context);
 const bridge=new vm.SourceTextModule(`export function installCustodialBridge({nativeApplicationSource:s}) {
  const present=()=>{};
  s.bindNotificationOwners({presenter:{registerBrowser(){},observeNativeSourceData:()=>({receipt_eligible:false})},
   scheduler:{observeNativeSourceData:()=>({receipt_eligible:false})},security:{},principal:()=>''});
  s.bindEmployeeOwner({current:()=>null,snapshot:()=>null,observeNativeSourceData:()=>{
   const copied=s.copyOriginalTypedRenderData(globalThis.original);
   return {receipt_eligible:false,copied,frozen:Object.isFrozen(copied)&&Object.isFrozen(copied.original_source),
    sameIdentity:copied===globalThis.original};}});
  s.bindReminderOwner({present,provider:{show:present,stopAndReadback(){}},snapshot:()=>({receipt_eligible:false})});
 }`,{context,identifier:'explicit-synthetic-copy-owner-ports'});
 await bridge.link(()=>{});await bridge.evaluate();
 const entry=new vm.SourceTextModule(script,{context,identifier:'actual-private-native-source',
  importModuleDynamically:async spec=>{assert.equal(spec,'./bridge.js');return bridge;}});
 await entry.link(()=>{});await entry.evaluate();
 entry.namespace.installNativeRecurringApplication({grantToken:'a'.repeat(64),replyToken:'b'.repeat(64)});await wait();await wait();
 let phase=1;
 return {context,posts,observe(){const before=posts.length;listeners.get('port:message')({data:JSON.stringify({
  schema:'custodial.native-recurring-document-command.v1',command:'OBSERVE_RAW_DATA',grant_token:'a'.repeat(64),phase:(phase++).toString(16).padStart(64,'0')})});
  return posts.length>before?posts.at(-1).data:null;}};
}
const good=await fixture("globalThis.original={schema:'custodial.native-recurring-original-render-data.v1',receipt_eligible:false,original_source:{schedule_delivery_mode:'RECURRING_SCHEDULE',recurring_delivery:{target:{authorityRevision:7},viewJsonText:'exact native view text'}}};");
const first=good.observe();assert.equal(first.receipt_eligible,false);assert.equal(first.employee.frozen,true);assert.equal(first.employee.sameIdentity,false);
assert.equal(first.employee.copied.original_source.recurring_delivery.viewJsonText,'exact native view text');
vm.runInContext('original.original_source.recurring_delivery.target.authorityRevision=8',good.context);
assert.equal(first.employee.copied.original_source.recurring_delivery.target.authorityRevision,7,'Original copy is immutable DATA, never late alias');
assert.equal(good.observe().employee.copied.original_source.recurring_delivery.target.authorityRevision,8);
const negatives=[
 ['accessor',"original={original_source:{}};Object.defineProperty(original.original_source,'trap',{enumerable:true,get(){getterCalls++;return true;}});"],
 ['opaque',"original={original_source:{pending:Promise.resolve(true)}};"],
 ['function',"original={original_source:{pending(){getterCalls++;return true;}}};"],
 ['unsafe integer',"original={original_source:{revision:Number.MAX_SAFE_INTEGER+1}};"],
 ['symbol key',"original={original_source:{[Symbol('unowned')]:true}};"],
 ['overbound',"original={original_source:{raw:'x'.repeat(196609)}};"],
 ['proxy retirement',"original={original_source:new Proxy({revision:7},{getOwnPropertyDescriptor(t,k){retire();return Reflect.getOwnPropertyDescriptor(t,k);}})};"],
 ['prototype retirement',"original={original_source:new Proxy({revision:7},{getPrototypeOf(t){retire();return Reflect.getPrototypeOf(t);}})};"],
];
for(const [name,source] of negatives){const f=await fixture('globalThis.'+source);assert.equal(f.observe(),null,name+' must remain unresolved');assert.equal(f.context.getterCalls,0,name+' cannot invoke a source getter/body');}
// toJSON is DATA-ineligible (function), never executed to claim provenance.
const serializer=await fixture("globalThis.original={original_source:{toJSON(){getterCalls++;return {};}}};");
assert.equal(serializer.observe(),null);assert.equal(serializer.context.getterCalls,0);
assert.equal(good.context.copyOriginalTypedRenderData,undefined);assert.equal(good.context.bindEmployeeOwner,undefined);
const result={status:'PASS_SOURCE_PRIVATE_COPY_BOUNDARY_ONLY',checks:12,source_sha256:createHash('sha256').update(script).digest('hex'),
 receipt:false,OS_settlement:false,currentness_grant:false,scope:'Exact private Source sink with explicit synthetic owner ports; actual normal factories qualified separately.'};
console.log(JSON.stringify(result));
