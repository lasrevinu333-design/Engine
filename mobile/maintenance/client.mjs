#!/usr/bin/env node
// On-demand source-owned maintenance; no daemon, cloud relay, install, reset,
// WebView secret or automatic dependency download. Never log upstream bodies.
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
export const API='https://memphis-zoo-mcp.onrender.com';
export const CLIENT='custodial-maintenance-v1';
export const PACKAGE='org.memphiszoo.custodial';
export const RECEIVER='org.memphiszoo.custodial.vault.AssignedDeviceActivationReceiver';
export const ADB='/home/eric/.local/bin/adb';
const SDK='/home/eric/Android/Sdk/build-tools/35.0.1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const cookiePattern=/^memphis_ops_trust=[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$/i;
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function fail(code){throw Object.assign(new Error(code),{code});}
export function privateRead(file){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const s=fs.fstatSync(fd);if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0||s.size>65536)fail('maintenance_private_file_required');
  return JSON.parse(fs.readFileSync(fd,'utf8'));}finally{fs.closeSync(fd);}
}
export function privateWrite(file,value){
 const parent=fs.lstatSync(path.dirname(file));
 if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==process.getuid()||(parent.mode&0o077)!==0)fail('maintenance_private_directory_required');
 const temp=file+'.'+randomUUID()+'.tmp';let fd;
 try{fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(value)+'\n');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,file);
  const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
 }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp);}
}
export async function withWorkstationLock(dir,task){
 // Kernel-owned, nonblocking lease. Its child receives EOF and exits even if
 // this parent crashes; no stale PID file, daemon or polling loop remains.
 const file=path.join(dir,'client.lock');
 const fd=fs.openSync(file,fs.constants.O_CREAT|fs.constants.O_RDWR|fs.constants.O_NOFOLLOW,0o600);
 try{const s=fs.fstatSync(fd);if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o077)!==0)fail('maintenance_private_lock_required');}finally{fs.closeSync(fd);}
 const child=spawn('/usr/bin/flock',['--nonblock','--no-fork',file,process.execPath,'-e',
  "process.stdout.write('READY\\n');process.stdin.resume();process.stdin.on('end',()=>process.exit(0));"],{stdio:['pipe','pipe','pipe']});
 let closed=false;const ended=new Promise(resolve=>child.once('close',()=>{closed=true;resolve();}));
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Object.assign(new Error('lock timeout'),{code:'maintenance_workstation_busy'})),5000);
   child.once('error',()=>{clearTimeout(timer);reject(Object.assign(new Error('lock unavailable'),{code:'maintenance_lock_unavailable'}));});
   child.once('close',()=>{clearTimeout(timer);reject(Object.assign(new Error('busy'),{code:'maintenance_workstation_busy'}));});
   child.stdout.once('data',chunk=>{clearTimeout(timer);if(chunk.toString()==='READY\n')resolve();else reject(new Error('lock response'));});
  });
  const result=await task();if(closed)fail('maintenance_lock_lost');return result;
 }finally{child.stdin.end();if(!closed){const timer=setTimeout(()=>child.kill('SIGTERM'),1000);await ended;clearTimeout(timer);}}
}
export function validatePolicy(policy){
 if(policy?.schema!=='custodial.maintenance-policy.v1'||policy.client_version!==CLIENT||policy.package_name!==PACKAGE||policy.receiver!==RECEIVER
  ||!HASH.test(policy.apk_sha256)||!HASH.test(policy.signer_sha256)||!Number.isSafeInteger(policy.version_code)||policy.version_code<53
  ||!policy.recipients||Object.keys(policy.recipients).some(k=>!/^KIOSK_(0[2-9]|10)$/.test(k)))fail('maintenance_release_policy_invalid');
 for(const [device,r] of Object.entries(policy.recipients)){
  if(!/^[A-Za-z0-9_-]{6,80}$/.test(r.serial)||sha(r.serial)!==r.serial_sha256||!Number.isSafeInteger(r.uid)||r.uid<=0
   ||!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(r.first_install_time))fail('maintenance_recipient_policy_invalid');
  if(device==='KIOSK_08'&&(r.serial!=='ZT4223BDKT'||r.uid!==10487))fail('maintenance_karen_identity_mismatch');
 }
 return policy;
}
export function command(binary,args,{input,timeout=20000}={}){
 const result=spawnSync(binary,args,{input,encoding:'utf8',timeout,maxBuffer:2*1024*1024,stdio:['pipe','pipe','pipe'],shell:false});
 if(result.error||result.status!==0)fail('maintenance_command_failed');
 return result.stdout;
}
export function verifyInstalledManifest(text){
 const lines=text.split('\n');let start=-1,end=-1;
 for(let i=0;i<lines.length;i++)if(/E: receiver\b/.test(lines[i])){
  const indent=lines[i].search(/\S/);let j=i+1;while(j<lines.length&&(!/\S/.test(lines[j])||lines[j].search(/\S/)>indent))j++;
  const block=lines.slice(i,j).join('\n');
  if(block.includes(`"${RECEIVER}"`)){if(start!==-1)fail('maintenance_receiver_ambiguous');start=i;end=j;}
 }
 if(start<0)fail('maintenance_receiver_missing');const block=lines.slice(start,end).join('\n');
 if(!/A: android:permission[^\n]*="android.permission.DUMP"/.test(block)
  ||!/A: android:exported[^\n]*(?:0xffffffff|true)/.test(block)
  ||!block.includes('org.memphiszoo.custodial.ACTIVATE_ASSIGNED_DEVICE')||!block.includes('org.memphiszoo.custodial.ASSIGNED_ACTIVATION_STATUS'))fail('maintenance_receiver_policy_mismatch');
}
function phoneState(serial,run){
 if(run(ADB,['-s',serial,'shell','am','get-current-user']).trim()!=='0')fail('maintenance_primary_kiosk_user_required');
 const pkg=run(ADB,['-s',serial,'shell','dumpsys','package',PACKAGE]);
 const exact=pkg.split(`Package [${PACKAGE}]`)[1]||'';
 const uid=Number(exact.match(/\b(?:appId|userId)=(\d+)\b/)?.[1]),first=exact.match(/\bfirstInstallTime=(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/)?.[1];
 const dpc=run(ADB,['-s',serial,'shell','dumpsys','device_policy']);
 const activities=run(ADB,['-s',serial,'shell','dumpsys','activity','activities']);
 if(!/Device Owner[\s\S]{0,600}de\.ozerov\.fully/.test(dpc)||!/mLockTaskModeState=LOCKED/.test(activities))fail('maintenance_fully_lock_required');
 return{uid,first_install_time:first};
}
export function preflight(policy,deviceId,{run=command}={}){
 validatePolicy(policy);const r=policy.recipients[deviceId];if(!r)fail('maintenance_recipient_unconfigured');
 const devices=run(ADB,['devices','-l']).split('\n').filter(line=>line.split(/\s+/)[0]===r.serial);
 if(devices.length!==1||devices[0].split(/\s+/)[1]!=='device')fail('maintenance_exact_usb_device_unavailable');
 const state=phoneState(r.serial,run);if(state.uid!==r.uid||state.first_install_time!==r.first_install_time)fail('maintenance_phone_lineage_mismatch');
 const paths=run(ADB,['-s',r.serial,'shell','pm','path',PACKAGE]).trim().split('\n');
 // Modern Android uses /data/app/~~random/package.name-random/base.apk.
 // Permit those exact path characters, but never traversal or shell syntax.
 if(paths.length!==1||!/^package:\/data\/app\/[A-Za-z0-9_.=+~\/-]+\/base\.apk$/.test(paths[0])
  ||paths[0].split('/').some(part=>part==='.'||part==='..'||part===''))fail('maintenance_installed_apk_path_invalid');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'custodial-maintenance-apk-'));fs.chmodSync(temp,0o700);
 try{
  const apk=path.join(temp,'base.apk');run(ADB,['-s',r.serial,'pull',paths[0].slice(8),apk]);
  if(sha(fs.readFileSync(apk))!==policy.apk_sha256)fail('maintenance_installed_apk_not_admitted');
  const signer=run(path.join(SDK,'apksigner'),['verify','--verbose','--print-certs',apk]);
  const certs=[...signer.matchAll(/^Signer #(\d+) certificate SHA-256 digest: ([a-f0-9]+)$/gm)];
  if(certs.length!==1||certs[0][1]!=='1'||certs[0][2]!==policy.signer_sha256)fail('maintenance_installed_signer_mismatch');
  const badging=run(path.join(SDK,'aapt2'),['dump','badging',apk]);
  if(!badging.startsWith(`package: name='${PACKAGE}' versionCode='${policy.version_code}'`))fail('maintenance_installed_package_version_mismatch');
  verifyInstalledManifest(run(path.join(SDK,'aapt2'),['dump','xmltree','--file','AndroidManifest.xml',apk]));
 }finally{fs.rmSync(temp,{recursive:true,force:true});} // exact directory created by this invocation only
 return{...state,serial:r.serial,serial_sha256:r.serial_sha256};
}
export function broadcastInput(operation,device,token){
 if(!UUID.test(operation)||!/^KIOSK_(0[2-9]|10)$/.test(device)||!/^[A-Za-z0-9_-]{43}$/.test(token))fail('maintenance_dispatch_identity_invalid');
 // Whitelisted alphabet, no host shell, secret only over ADB stdin. Android
 // still transiently sees an Intent extra/process argument; this is not a claim
 // of zero privileged OS exposure. No plaintext is saved by the client.
 return `am broadcast --receiver-foreground -a org.memphiszoo.custodial.ACTIVATE_ASSIGNED_DEVICE -n ${PACKAGE}/${RECEIVER} --es operation_id ${operation} --es device_id ${device} --es activation_token ${token}\n`;
}
export async function apiRequest(pathname,{body,session,trust,device,fetcher=fetch}={}){
 if(!/^\/(?:auth-api|custodial-admin-api)\/[A-Za-z0-9_/?=&.-]+$/.test(pathname))fail('maintenance_api_path_invalid');
 const headers={'X-Device-Id':device,'X-Ops-Access-Level':'full_access','User-Agent':CLIENT};
 if(session)headers.Authorization=`Bearer ${session.token}`;
 if(trust){if(!cookiePattern.test(trust))fail('maintenance_trust_cookie_invalid');headers.Cookie=trust;headers.Origin=API;}
 if(pathname==='/auth-api/ops/manager-codes/consume')headers.Origin=API;
 if(body)headers['Content-Type']='application/json';
 let response,payload;
 try{response=await fetcher(API+pathname,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(20000)});
  const text=await response.text();if(text.length>65536)fail('maintenance_response_too_large');payload=JSON.parse(text);
 }catch{fail('maintenance_network_or_response_unavailable');}
 if(!response.ok||payload?.ok!==true||!payload.data||typeof payload.data!=='object')fail('maintenance_request_rejected');
 return{data:payload.data,cookies:response.headers.getSetCookie?.()||[]};
}
export function validateSession(session,device){
 if(!session?.trusted_device||session.auth_mode!=='trusted_device'||session.access_level!=='full_access'
  ||!session.roles?.includes('CUSTODIAL_MANAGER')||!UUID.test(session.manager_id)||!UUID.test(session.credential_id)
  ||session.device_id!==device||typeof session.token!=='string'||!Number.isFinite(Date.parse(session.expires_at))||Date.parse(session.expires_at)<=Date.now())fail('maintenance_named_manager_required');
 return session;
}
export function validateStatus(s,operation,previous){
 if(!s||s.operation_id!==operation||!/^KIOSK_(0[2-9]|10)$/.test(s.device_id)||!UUID.test(s.employee_id)
  ||!Number.isSafeInteger(s.assignment_epoch)||s.assignment_epoch<1||!Number.isSafeInteger(s.state_version)||s.state_version<1
  ||!Number.isSafeInteger(s.attempts)||s.attempts<0||s.attempts>5
  ||!['requested','prepared','delivered','delivery_unknown','native_active','not_required','expired','cancelled','error'].includes(s.state))fail('maintenance_operation_response_invalid');
 if(previous&&(s.device_id!==previous.device_id||s.employee_id!==previous.employee_id||s.assignment_epoch!==previous.assignment_epoch
  ||s.state_version<previous.state_version))fail('maintenance_operation_recipient_changed');
 if(['native_active','not_required'].includes(s.state)){
  const r=s.native_receipt;
  if(r?.journal_schema==='native-assigned-activation-legacy.v1'){
   const keys=['operation_id','device_id','credential_id','outcome','changed','transition','journal_schema',
    'journal_binding_sha256','legacy_binding_id','legacy_binding_kind','installation_binding_sha256'];
   if(Object.keys(r).sort().join('|')!==keys.sort().join('|')||r.operation_id!==operation||r.device_id!==s.device_id
    ||!UUID.test(r.credential_id)||!UUID.test(r.legacy_binding_id)||!HASH.test(r.installation_binding_sha256)
    ||!HASH.test(r.journal_binding_sha256)||!['confirmed_enrollment_operation','authenticated_legacy_installation_observation'].includes(r.legacy_binding_kind)
    ||r.outcome!==(s.state==='native_active'?'active':'not_required')||r.changed!==(s.state==='native_active')
    ||r.transition!==(s.state==='native_active'?'confirmed_recovery':'healthy_no_change'))fail('maintenance_native_receipt_missing');
  }else if(!r||r.operation_id!==operation||r.device_id!==s.device_id||!UUID.test(r.credential_id)||!UUID.test(r.lineage_operation_id)
   ||r.journal_schema!=='native-assigned-activation.v1'||!HASH.test(r.journal_binding_sha256)
   ||!['enrollment','recovery'].includes(r.flow)||r.outcome!==(s.state==='native_active'?'active':'not_required')
   ||r.changed!==(s.state==='native_active'))fail('maintenance_native_receipt_missing');
 }
 return s;
}
export async function activateOperation(operation,{policy,session,device,request=apiRequest,run=command,preflightFn=preflight,output=console.log}={}){
 if(!UUID.test(operation))fail('maintenance_operation_id_invalid');validatePolicy(policy);validateSession(session,device);
 const base=`/custodial-admin-api/assigned-activation-operations/${operation}`,call=(suffix='',body)=>request(base+suffix,{body,session,device}).then(r=>r.data);
 const status=validateStatus(await call(),operation);
 if(['native_active','not_required','expired','cancelled','error'].includes(status.state))return status;
 if(status.attempts>=5)fail('maintenance_delivery_attempt_limit');
 const before=preflightFn(policy,status.device_id,{run});
 output(`Exact request ${operation}; ${status.device_id}; employee ${status.employee_id}; assignment ${status.assignment_epoch}; USB …${before.serial.slice(-4)}; ${PACKAGE} version ${policy.version_code}.`);
 const claimed=await call('/claim',{adb_serial_sha256:before.serial_sha256,client_version:CLIENT});
 const s=validateStatus(claimed.status,operation,status);
 if(!claimed.activation_token)return s;
 if(!Number.isSafeInteger(s.attempts)||s.attempts<1||s.attempts>5)fail('maintenance_delivery_attempt_limit');
 let outcome='delivery_unknown';
 try{
  const input=broadcastInput(operation,status.device_id,claimed.activation_token);
  const result=run(ADB,['-s',before.serial,'shell','-T'],{input,timeout:20000});
  // Even a native-looking command result is transport evidence only. The
  // following server status, not stdout, determines final activation truth.
  if(/Broadcast completed: result=/.test(result))outcome='delivered';
 }catch{outcome='delivery_unknown';}
 finally{delete claimed.activation_token;}
 try{await call('/delivery',{state_version:s.state_version,outcome,error_code:outcome==='delivered'?null:'adb_delivery_unknown'});}catch{/* A native receipt may have won the version race. Read its actual state. */}
 const after=phoneState(before.serial,run);
 if(after.uid!==before.uid||after.first_install_time!==before.first_install_time)fail('maintenance_post_dispatch_lineage_changed');
 return validateStatus(await call(),operation,s); // bounded exit; retries reuse this operation
}

async function secretPrompt(){
 if(!process.stdin.isTTY||!process.stdout.isTTY)fail('maintenance_enrollment_requires_private_interactive_input');
 process.stdout.write('One-time named-manager code (input hidden): ');process.stdin.setRawMode(true);process.stdin.resume();let value='';
 try{return await new Promise((resolve,reject)=>{const onData=chunk=>{
  for(const ch of chunk.toString()){if(ch==='\u0003'){cleanup();reject(Object.assign(new Error('cancelled'),{code:'maintenance_cancelled'}));return;}
   if(ch==='\r'||ch==='\n'){cleanup();resolve(value);return;}if(ch==='\u007f'){value=value.slice(0,-1);continue;}if(/^\d$/.test(ch)&&value.length<8)value+=ch;
  }};const cleanup=()=>process.stdin.off('data',onData);process.stdin.on('data',onData);});}
 finally{process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}
}
async function main(){
 const [action,argument,...rest]=process.argv.slice(2);if(rest.length||!['enroll','list','status','activate'].includes(action))fail('usage_enroll_or_list_or_status_UUID_or_activate_UUID');
 const dir=path.join(os.homedir(),'.local/state/memphis-zoo-custodial-maintenance');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const stat=fs.lstatSync(dir);if(!stat.isDirectory()||stat.isSymbolicLink()||stat.uid!==process.getuid()||(stat.mode&0o077)!==0)fail('maintenance_private_directory_required');
 return withWorkstationLock(dir,()=>runAction(action,argument,dir));
}
async function runAction(action,argument,dir){
 const identityFile=path.join(dir,'identity.json'),trustFile=path.join(dir,'trust.json');
 if(!fs.existsSync(identityFile))privateWrite(identityFile,{device_id:'CUSTODIAL-MAINTENANCE-'+randomUUID().toUpperCase()});
 const identity=privateRead(identityFile),device=identity.device_id;if(!/^CUSTODIAL-MAINTENANCE-[A-F0-9-]{36}$/.test(device))fail('maintenance_workstation_identity_invalid');
 if(action==='enroll'){
  if(argument||fs.existsSync(trustFile))fail('maintenance_existing_trust_must_not_be_overwritten');
  const code=await secretPrompt();if(!/^\d{8}$/.test(code))fail('maintenance_manager_code_invalid');
  const result=await apiRequest('/auth-api/ops/manager-codes/consume',{device,body:{manager_code:code,device_id:device,device_label:'Custodial USB maintenance',access_level:'full_access'}});
  validateSession(result.data.session,device);
  const cookies=result.cookies.filter(c=>c.startsWith('memphis_ops_trust='));if(cookies.length!==1)fail('maintenance_trust_cookie_missing');
  const cookie=cookies[0].split(';')[0];if(!cookiePattern.test(cookie))fail('maintenance_trust_cookie_invalid');
  privateWrite(trustFile,{cookie,device_id:device});console.log('Named-manager workstation enrolled. No phone changed.');return;
 }
 const trust=privateRead(trustFile);if(trust.device_id!==device)fail('maintenance_workstation_trust_mismatch');
 const {data}=await apiRequest('/auth-api/session?access_level=full_access',{device,trust:trust.cookie});const session=validateSession(data.session,device);
 if(action==='list'){
  if(argument)fail('maintenance_unexpected_argument');const result=await apiRequest('/custodial-admin-api/assigned-activation-operations',{session,device});
  for(const s of result.data.operations||[])console.log(JSON.stringify({operation_id:s.operation_id,device_id:s.device_id,employee_id:s.employee_id,assignment_epoch:s.assignment_epoch,state:s.state}));return;
 }
 if(!UUID.test(argument||''))fail('maintenance_operation_id_invalid');
 const status=action==='activate'?await activateOperation(argument,{policy:privateRead(path.join(dir,'release-policy.json')),session,device}):
  validateStatus((await apiRequest('/custodial-admin-api/assigned-activation-operations/'+argument,{session,device})).data,argument);
 console.log(JSON.stringify({operation_id:status.operation_id,device_id:status.device_id,state:status.state,
  confirmed:['native_active','not_required'].includes(status.state)}));
 if(!['native_active','not_required'].includes(status.state))process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{
 console.error(e?.code?.startsWith('maintenance_')||e?.code?.startsWith('usage_')?e.code:'maintenance_failed');process.exitCode=1;
});
