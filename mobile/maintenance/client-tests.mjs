import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {API,CLIENT,PACKAGE,RECEIVER,ADB,sha,privateRead,privateWrite,withWorkstationLock,validatePolicy,preflight,broadcastInput,apiRequest,validateSession,validateStatus,activateOperation} from './client.mjs';
const op='11000000-0000-4000-8000-000000000030',employee='11000000-0000-4000-8000-000000000006';
const station='CUSTODIAL-MAINTENANCE-11000000-0000-4000-8000-000000000003';
const serial='ZT4223BDKT',token='s'.repeat(43),apk=Buffer.from('Synthetic admitted APK only');
const policy={schema:'custodial.maintenance-policy.v1',client_version:CLIENT,package_name:PACKAGE,receiver:RECEIVER,
 apk_sha256:sha(apk),signer_sha256:'a'.repeat(64),version_code:53,recipients:{KIOSK_08:{serial,serial_sha256:sha(serial),uid:10487,first_install_time:'2026-07-31 21:52:04'}}};
const session={trusted_device:true,auth_mode:'trusted_device',access_level:'full_access',roles:['CUSTODIAL_MANAGER'],manager_id:employee,
 credential_id:'11000000-0000-4000-8000-000000000003',device_id:station,token:'synthetic-session',expires_at:new Date(Date.now()+60000).toISOString()};
const manifest=`E: manifest\n  E: application\n    E: receiver\n      A: android:name(0x1010003)="${RECEIVER}"\n      A: android:permission(0x1010006)="android.permission.DUMP"\n      A: android:exported(0x1010010)=(type 0x12)0xffffffff\n      E: intent-filter\n        E: action\n          A: android:name="org.memphiszoo.custodial.ACTIVATE_ASSIGNED_DEVICE"\n        E: action\n          A: android:name="org.memphiszoo.custodial.ASSIGNED_ACTIVATION_STATUS"\n`;
const commands=[];
function run(binary,args,options={}){
 commands.push({binary,args,options});const cmd=args.join(' ');
 assert.ok(!args.includes(token),'secret absent from host process argv');
 assert.doesNotMatch(cmd,/org\.memphiszoo\.infrastructure|\b(?:install|uninstall|clear|reboot|reset)\b/);
 if(cmd==='devices -l')return `List of devices attached\n${serial} device usb:1-5 model:moto_g___2025\nunrelated device\n`;
 if(cmd.includes('am get-current-user'))return '0\n';
 if(cmd.includes('dumpsys package'))return `Package [${PACKAGE}] (synthetic):\n appId=10487\n firstInstallTime=2026-07-31 21:52:04\n`;
 if(cmd.includes('dumpsys device_policy'))return 'Device Owner: \n admin=ComponentInfo{de.ozerov.fully/de.ozerov.fully.DeviceOwnerReceiver}';
 if(cmd.includes('dumpsys activity'))return 'mLockTaskModeState=LOCKED';
 if(cmd.includes('pm path'))return `package:/data/app/~~synthetic==/${PACKAGE}-abc==/base.apk\n`;
 if(args[2]==='pull'){fs.writeFileSync(args[4],apk);return '1 file pulled';}
 if(binary.endsWith('/apksigner'))return `Verified\nSigner #1 certificate SHA-256 digest: ${policy.signer_sha256}\n`;
 if(cmd.startsWith('dump badging'))return `package: name='${PACKAGE}' versionCode='53' versionName='synthetic'\n`;
 if(cmd.startsWith('dump xmltree'))return manifest;
 if(args.at(-1)==='-T'){assert.ok(options.input.includes(token));return 'Broadcast completed: result=-1';}
 throw Error('Unexpected synthetic command: '+cmd);
}
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS',name);};
check('admitted identity and retained phone state before claim',()=>assert.equal(preflight(policy,'KIOSK_08',{run}).uid,10487));
for(const [label,mutate] of [
 ['wrong serial',p=>p.recipients.KIOSK_08.serial='other-device'],['wrong package',p=>p.package_name='org.memphiszoo.infrastructure'],
 ['wrong UID',p=>p.recipients.KIOSK_08.uid=1],['missing release',p=>delete p.apk_sha256]])
 check(label,()=>{const p=structuredClone(policy);mutate(p);assert.throws(()=>validatePolicy(p));});
for(const [label,intercept] of [
 ['unauthorized USB',(bin,args)=>args[0]==='devices'?`${serial} unauthorized`:null],
 ['traversal APK path',(bin,args)=>args.includes('path')?'package:/data/app/../private/base.apk':null],
 ['shell APK path',(bin,args)=>args.includes('path')?'package:/data/app/$(bad)/base.apk':null],
 ['wrong installed hash',()=>null],
 ['wrong signer',(bin)=>bin.endsWith('/apksigner')?'Signer #1 certificate SHA-256 digest: '+'b'.repeat(64):null],
 ['unlocked',(bin,args)=>args.includes('activities')?'mLockTaskModeState=NONE':null],
 ['missing receiver permission',(bin,args)=>args.includes('xmltree')?manifest.replace('android.permission.DUMP','android.permission.INTERNET'):null]])
 check(label,()=>{const p=structuredClone(policy);if(label==='wrong installed hash')p.apk_sha256='b'.repeat(64);assert.throws(()=>preflight(p,'KIOSK_08',{run:(bin,args,options)=>intercept(bin,args)??run(bin,args,options)}));});
check('dispatch input rejects shell metacharacters',()=>assert.throws(()=>broadcastInput(op,'KIOSK_08',';'.repeat(43))));
check('session must have actual expiry',()=>assert.throws(()=>validateSession({...session,expires_at:'bad'},station)));
const messages=[],calls=[];let checked=false,final='prepared',unknown=false;
const base={operation_id:op,device_id:'KIOSK_08',employee_id:employee,assignment_epoch:2,state:'prepared',state_version:2,attempts:0};
check('terminal word without native receipt is not success',()=>assert.throws(()=>validateStatus({...base,state:'native_active'},op)));
check('changed final recipient rejected',()=>assert.throws(()=>validateStatus({...base,assignment_epoch:3},op,base)));
check('regressed final version rejected',()=>assert.throws(()=>validateStatus({...base,state_version:1},op,base)));
for(const state of ['not_required','native_active']){
 const receipt={journal_schema:'native-assigned-activation-legacy.v1',operation_id:op,device_id:base.device_id,
  credential_id:session.credential_id,outcome:state==='native_active'?'active':'not_required',changed:state==='native_active',
  transition:state==='native_active'?'confirmed_recovery':'healthy_no_change',journal_binding_sha256:'a'.repeat(64),
  legacy_binding_id:'11000000-0000-4000-8000-000000000031',legacy_binding_kind:'authenticated_legacy_installation_observation',
  installation_binding_sha256:'b'.repeat(64)};
 check(`strict legacy ${state} terminal accepted`,()=>assert.equal(validateStatus({...base,state,native_receipt:receipt},op).state,state));
 for(const field of Object.keys(receipt)){
  check(`legacy ${state} rejects missing ${field}`,()=>{const r={...receipt};delete r[field];assert.throws(()=>validateStatus({...base,state,native_receipt:r},op));});
  check(`legacy ${state} rejects invalid ${field}`,()=>{const r={...receipt,[field]:'invalid'};assert.throws(()=>validateStatus({...base,state,native_receipt:r},op));});
 }
 check(`legacy ${state} rejects mixed v1 lineage`,()=>assert.throws(()=>validateStatus({...base,state,native_receipt:{...receipt,lineage_operation_id:op}},op)));
}
async function request(url,opts){calls.push({url,opts});
 if(url.endsWith('/claim')){assert.ok(checked,'preflight before secret retrieval');return {data:{status:{...base,attempts:1},activation_token:token}};}
 if(url.endsWith('/delivery'))return {data:{...base,state:opts.body.outcome}};
 return {data:{...base,state:final}};
}
const dependencies={policy,session,device:station,request,run:(...args)=>{if(unknown&&args[1].at(-1)==='-T')throw Error('Synthetic USB loss');return run(...args);},
 preflightFn:(...args)=>{const p=preflight(...args);checked=true;return p;},output:m=>messages.push(m)};
let result=await activateOperation(op,dependencies);
check('ADB success cannot fabricate native success',()=>assert.equal(result.state,'prepared'));
check('transport report is delivered only',()=>assert.equal(calls.find(c=>c.url.endsWith('/delivery')).opts.body.outcome,'delivered'));
check('no output secret or cookie',()=>assert.ok(!messages.join('\n').includes(token)));
unknown=true;checked=false;calls.length=0;await activateOperation(op,dependencies);
check('USB loss reports unknown without a new operation',()=>{assert.equal(calls.find(c=>c.url.endsWith('/delivery')).opts.body.outcome,'delivery_unknown');assert.ok(calls.every(c=>c.url.includes(op)));});
let sends=0;await assert.rejects(()=>activateOperation(op,{...dependencies,preflightFn:()=>{throw Error('preflight fails');},request:async(...args)=>{if(args[0].endsWith('/claim'))sends++;return request(...args);}}));
check('failed preflight never claims secret',()=>assert.equal(sends,0));
const httpCalls=[];const fetcher=async(url,options)=>{httpCalls.push({url,options});return{ok:true,text:async()=>JSON.stringify({ok:true,data:{session}}),headers:{getSetCookie:()=>[]}};};
await apiRequest('/auth-api/session?access_level=full_access',{device:station,trust:`memphis_ops_trust=${session.credential_id}.${token}`,fetcher});
await apiRequest('/custodial-admin-api/assigned-activation-operations/'+op+'/claim',{device:station,session,body:{client_version:CLIENT},fetcher});
check('cookie only to fixed HTTPS session route',()=>{assert.equal(httpCalls[0].url,API+'/auth-api/session?access_level=full_access');assert.equal(httpCalls[0].options.redirect,'error');});
check('claim sends bearer but no browser origin or cookie',()=>{assert.equal(httpCalls[1].options.headers.Origin,undefined);assert.equal(httpCalls[1].options.headers.Cookie,undefined);assert.equal(httpCalls[1].options.headers.Authorization,'Bearer synthetic-session');});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'custodial-maintenance-store-test-'));console.log('OWNED_STORE_TEST',temp);
try{fs.chmodSync(temp,0o700);const file=path.join(temp,'private.json');privateWrite(file,{synthetic:true});
 check('private trust state roundtrip',()=>assert.deepEqual(privateRead(file),{synthetic:true}));
 fs.chmodSync(file,0o644);check('unsafe state permissions denied',()=>assert.throws(()=>privateRead(file)));fs.chmodSync(file,0o600);
 fs.symlinkSync(file,path.join(temp,'link'));check('symlink state denied',()=>assert.throws(()=>privateRead(path.join(temp,'link'))));
 await withWorkstationLock(temp,async()=>{
  await assert.rejects(()=>withWorkstationLock(temp,async()=>assert.fail('competing writer admitted')),/busy/);checks++;console.log('PASS concurrent workstation invocation denied by kernel lock');
 });
 await withWorkstationLock(temp,async()=>{checks++;console.log('PASS kernel lease released after first invocation');});
}finally{fs.rmSync(temp,{recursive:true,force:true});console.log('OWNED_STORE_TEST_REMOVED',temp);}
console.log(JSON.stringify({status:'PASS',checks,syntheticAdbAndHttp:true,realDeviceMutation:false,releasePolicyProvisioned:false}));
