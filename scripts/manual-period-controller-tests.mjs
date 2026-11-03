import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';
const path=process.argv[2]||new URL('../memphis-scheduler-actions.js',import.meta.url),context={URL,TextEncoder,console};
vm.runInNewContext(fs.readFileSync(path,'utf8'),context);const A=context.MemphisSchedulerActions;
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,H='a'.repeat(64),cases=[];
const body={command_kind:'absence',employee_id:id(9),start_date:'2026-11-02',end_date:'2026-11-02',absence_kind:'pto',client_prepare_key:id(10),expected_revision:7},
 binding={weekStart:'2026-10-30',publicationId:id(2),versionId:id(3),authorityRevision:7};
async function test(name,fn){try{await fn();cases.push({name,status:'PASS'});}catch(e){cases.push({name,status:'FAIL',error:e.message});}}
await test('F02 actual controller accepts source period and persists original before authenticated BEGIN',async()=>{
 const values=new Map(),calls=[],sentinel=Error('Synthetic original BEGIN boundary reached');
 const auth={readSession:()=>({role:'ops_manager',manager_id:id(1),credential_id:id(11),device_id:id(12),token:'synthetic',expires_at:'2099-01-01T00:00:00Z',read_only:false,permissions:{schema:'custodial.manager-permissions.v1',read:true,manage_absences:true}})};
 const actions=A.create({auth,baseUrl:'https://fixture.invalid',storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},api:async(path,options)=>{calls.push({path,options});throw sentinel;}});
 await assert.rejects(()=>actions.prepareStaffing(body,{...binding,weeks:[binding]}),e=>e===sentinel);
 assert.equal(calls.length,1);assert.equal(calls[0].path,A.staffingCommandPath);assert.equal(calls[0].options.body,JSON.stringify(body));
 assert.equal(actions.pending().weekBindings[0].weekStart,'2026-10-30');assert.equal(actions.pending().command.confirmationAttempted,false);
});
const record={path:A.staffingCommandPath,body,managerId:id(1),weekBindings:[binding],command:{operationId:id(4),semanticDigest:H}},
 options={schema:'custodial.approved-manual-coverall-options.v1',operationId:id(4),semanticDigest:H,expectedRevision:7,state:'PREPARING',originalCommandPreserved:true,vendorBooked:false,choice:null,days:[{
 serviceDate:body.start_date,sourceId:id(5),publicationId:id(2),retainedProjectionId:id(6),retainedEnvelopeIdentity:H,retainedPlanDigest:H,
 capacities:[{capacityId:id(7),label:'Synthetic capacity',shift:{start:'05:00',end:'14:00'},lunch:{start:'09:30',end:'10:30'}}],
 lunchCoverers:[{slotId:id(8),label:'Synthetic helper',shift:{start:'08:00',end:'17:00'},lunch:{start:'12:30',end:'13:30'}}]}]};
await test('F02 third-absence options retain actual Friday source period',()=>A.validateCoverAllOptions(options,record));
await test('F02 unrelated publication cannot claim accepted retained day',()=>{const x=structuredClone(options);x.days[0].publicationId=id(99);assert.throws(()=>A.validateCoverAllOptions(x,record));});
await test('F02 day outside exact original absence cannot be selected',()=>{const x=structuredClone(options);x.days[0].serviceDate='2026-11-06';assert.throws(()=>A.validateCoverAllOptions(x,record));});
console.log(JSON.stringify({scope:'actual controller/validator, synthetic transport boundary; no SQL',cases},null,2));if(cases.some(c=>c.status==='FAIL'))process.exitCode=1;
