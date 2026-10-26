// Exact hash-pinned input transport, not compatibility/build/install authority.
import {createHash,randomBytes} from 'node:crypto';
import {constants,openSync,closeSync,readSync,writeSync,fsyncSync,fstatSync,lstatSync,realpathSync,mkdirSync,fchmodSync} from 'node:fs';
import {dirname,join,resolve,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {parseDeterministicJson} from './custodial-capacitor-runtime-policy.mjs';
import {inspectForwardTransitionSourceAdmission} from './custodial-forward-transition-admission-adapter.mjs';
const SHA=/^[a-f0-9]{64}$/,OID=/^[a-f0-9]{40}$/;
const FILE_CAP=4*1024*1024,TOTAL_CAP=10*FILE_CAP,WORK_MS=60000;
const EVIDENCE=Object.freeze({baseline_receipt_sha256:'baseline-receipt.json',candidate_source_receipt_sha256:'candidate-source-receipt.json',recovery_source_receipt_sha256:'recovery-source-receipt.json',retained_data_plan_sha256:'retained-data-plan.json',enrollment:'enrollment.json',protected_pending:'protected-pending.json',history:'history.json',crypto:'crypto.json'});
const FILES=Object.freeze(['source-input.json','reviewed-pins.json',...Object.values(EVIDENCE)]);
const ORIGINS=Object.freeze(['https://github.com/lasrevinu333-design/Engine.git','https://github.com/lasrevinu333-design/Engine','git@github.com:lasrevinu333-design/Engine.git']);
function fail(message){throw new Error('Custodial forward input transport: '+message);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function keys(v,expected,label){if(!v||typeof v!=='object'||Array.isArray(v)||!same(Object.keys(v).sort(),[...expected].sort()))fail(label+' fields');}
function hash(b){return createHash('sha256').update(b).digest('hex');}
function nine(s){return [s.dev,s.ino,s.mode,s.uid,s.gid,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String);}
function directory(path){if(!isAbsolute(path)||resolve(path)!==path||realpathSync(path)!==path)fail('directory path');const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077)!==0)fail('directory ownership');return s;}
function readFixed(path,expected=null){
 if(!isAbsolute(path)||resolve(path)!==path||realpathSync(path)!==path)fail('file path');
 const before=lstatSync(path,{bigint:true});if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.uid!==BigInt(process.getuid())||before.size>BigInt(FILE_CAP))fail('file ownership/size');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{if(!same(nine(before),nine(fstatSync(fd,{bigint:true}))))fail('open identity');const buf=Buffer.alloc(Number(before.size)+1);let n=0;while(n<buf.length){const r=readSync(fd,buf,n,buf.length-n,null);if(r===0)break;n+=r;if(n>Number(before.size))fail('file growth');}if(n!==Number(before.size)||!same(nine(before),nine(fstatSync(fd,{bigint:true})))||!same(nine(before),nine(lstatSync(path,{bigint:true}))))fail('file changed');const raw=Buffer.from(buf.subarray(0,n));if(expected!==null&&hash(raw)!==expected)fail('file digest');return{raw,identity9:nine(before)};}finally{closeSync(fd);}
}
function createFixed(path,raw){
 if(!Buffer.isBuffer(raw)||raw.length>FILE_CAP)fail('output bound');const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{
  let n=0;while(n<raw.length){const wrote=writeSync(fd,raw,n,raw.length-n);if(wrote<=0)fail('short write');n+=wrote;}
  fchmodSync(fd,0o400);fsyncSync(fd);const born=fstatSync(fd,{bigint:true});
  if(!born.isFile()||born.nlink!==1n||born.uid!==BigInt(process.getuid())||born.size!==BigInt(raw.length)||(born.mode&0o777n)!==0o400n||!same(nine(born),nine(lstatSync(path,{bigint:true}))))fail('created file identity');
  const out=readFixed(path,hash(raw));if(!out.raw.equals(raw)||!same(out.identity9,nine(born))||!same(nine(born),nine(fstatSync(fd,{bigint:true})))||!same(nine(born),nine(lstatSync(path,{bigint:true}))))fail('birth descriptor readback');return out.identity9;
 }finally{closeSync(fd);}
}
// Legacy absolute evidence paths retain their existing caller checks. New
// portable records accept ONLY the eight fixed basenames, never arbitrary
// relative paths. Hash authority remains the independently reviewed pins SHA.
export function resolveCustodialForwardEvidenceFiles(pinsPath,evidence){
 keys(evidence,Object.keys(EVIDENCE),'evidence');
 const values=Object.values(evidence);if(values.every(v=>typeof v==='string'&&isAbsolute(v)))return{...evidence};
 for(const [key,name]of Object.entries(EVIDENCE))if(evidence[key]!==name)fail('portable evidence basename');
 const parent=dirname(pinsPath);directory(parent);const before=lstatSync(parent,{bigint:true});const out={};
 for(const [key,name]of Object.entries(EVIDENCE)){const path=join(parent,name);readFixed(path);out[key]=path;}
 if(!same(nine(before),nine(lstatSync(parent,{bigint:true}))))fail('evidence directory changed');return out;
}
function absence(pid){
 if(!Number.isSafeInteger(pid)||pid<=0)fail('child identity');
 for(const value of [pid,-pid]){try{process.kill(value,0);}catch(error){if(error?.code==='ESRCH')continue;throw error;}fail('child or group remains; no output adoption');}
}
function privateGitEnvironment(){const out={...process.env,GIT_TERMINAL_PROMPT:'0'};for(const key of ['CODEMAGIC_API_TOKEN','CM_KEYSTORE_PATH','CM_KEYSTORE_PASSWORD','CM_KEY_ALIAS','CM_KEY_PASSWORD'])delete out[key];return out;}
async function gitRun(root,args,cap,deadline){
 // This fixed Git role retains its child and streams. TERM/KILL are attempted
 // only before the actual exit/reap event; an uncertain group is never reused.
 const started=process.hrtime.bigint(),remaining=deadline-started;if(remaining<=0n)fail('common work deadline');
 const commandEnd=started+(remaining<10000000000n?remaining:10000000000n);
 const milliseconds=Number((commandEnd-started)/1000000n);if(milliseconds<1000)fail('insufficient remaining settlement budget');
 return await new Promise((resolveCommand,rejectCommand)=>{
  let child=null,pid=null,reaped=false,closed=false,finished=false,code=null,signal=null,primary=null;
  let stdoutBytes=0,stderrBytes=0;const chunks=[],timers=[];
  const finish=(error,bytes=null)=>{if(finished)return;finished=true;for(const timer of timers)clearTimeout(timer);if(error){error.transport_child=Object.freeze({pid,pgid:pid,actual_reaped:reaped,actual_close:closed,custody_unknown:true,output_adopted:false});rejectCommand(error);}else resolveCommand(bytes);};
  const mark=(message)=>{if(primary===null)primary=new Error('Custodial forward input transport: '+message);};
  const signalOwned=(kind)=>{if(finished||reaped||!Number.isSafeInteger(pid))return;try{process.kill(-pid,kind);}catch(error){if(error?.code!=='ESRCH'){mark('owned Git signal failed');}}};
  const stop=(message)=>{mark(message);signalOwned('SIGTERM');};
  try{child=spawn('git',['--no-optional-locks','-c','core.fsmonitor=false','-c','core.untrackedCache=false','-c','core.hooksPath=/dev/null','-C',root,...args],{env:privateGitEnvironment(),detached:true,stdio:['ignore','pipe','pipe']});pid=child.pid;}catch(error){finish(error);return;}
  child.on('error',error=>{mark('owned Git spawn/stream error');if(!Number.isSafeInteger(pid)){finish(error);return;}stop('owned Git error');});
  child.stdout.on('data',chunk=>{if(finished)return;stdoutBytes+=chunk.length;if(stdoutBytes>cap){stop('Git output bound');return;}chunks.push(Buffer.from(chunk));});
  child.stderr.on('data',chunk=>{if(finished)return;stderrBytes+=chunk.length;if(stderrBytes>1024*1024)stop('Git diagnostic output bound');});
  for(const stream of [child.stdout,child.stderr])stream.on('error',()=>stop('owned Git stream error'));
  child.on('exit',(actualCode,actualSignal)=>{reaped=true;code=actualCode;signal=actualSignal;});
  child.on('close',(actualCode,actualSignal)=>{
   closed=true;if(finished)return;
   try{if(!reaped||code!==actualCode||signal!==actualSignal)fail('actual Git exit/close mismatch');absence(pid);if(primary!==null)throw primary;if(signal!==null||!Number.isSafeInteger(code)||code!==0)fail('owned Git command refused');if(process.hrtime.bigint()>commandEnd||process.hrtime.bigint()>deadline)fail('common work deadline');finish(null,Buffer.concat(chunks,stdoutBytes));}catch(error){finish(error);}
  });
  timers.push(setTimeout(()=>stop('owned Git command deadline'),milliseconds-750));
  timers.push(setTimeout(()=>{mark('owned Git termination settlement');signalOwned('SIGKILL');},milliseconds-250));
  timers.push(setTimeout(()=>{
   if(finished)return;mark('owned Git settlement UNKNOWN at fixed deadline');
   // No positive signal follows a reap event. If a descendant retains a pipe,
   // close only our handles, retain the intent, and refuse all publication.
   signalOwned('SIGKILL');for(const stream of [child.stdout,child.stderr]){stream.destroy();stream.unref?.();}child.unref();finish(primary);
  },milliseconds));
 });
}
function utf8(raw){const out=raw.toString('utf8');if(!Buffer.from(out).equals(raw)||out.includes('\0'))fail('UTF8 metadata');return out;}
async function snapshot(root,deadline){return{head:utf8(await gitRun(root,['rev-parse','HEAD'],128,deadline)).trim(),tree:utf8(await gitRun(root,['rev-parse','HEAD^{tree}'],128,deadline)).trim(),ref:utf8(await gitRun(root,['symbolic-ref','HEAD'],1024,deadline)).trim(),status:utf8(await gitRun(root,['status','--porcelain=v1','--untracked-files=all'],1024*1024,deadline))};}
function validateBodies(rawByName,pinsSha,role){
 if(rawByName.size!==10||FILES.some(name=>!rawByName.has(name)))fail('exact ten files');
 let bytes=0;for(const raw of rawByName.values()){if(!Buffer.isBuffer(raw)||raw.length>FILE_CAP)fail('input size');bytes+=raw.length;}if(bytes>TOTAL_CAP)fail('total input bound');
 const pRaw=rawByName.get('reviewed-pins.json');if(hash(pRaw)!==pinsSha)fail('independent pins SHA');
 const pins=parseDeterministicJson(pRaw,'Transport reviewed pins');keys(pins,['schema_version','kind','external_trusted_pins','evidence_files'],'pins envelope');if(pins.schema_version!==1||pins.kind!=='custodial.forward-build-reviewed-pins.v1')fail('pins envelope kind');
 keys(pins.evidence_files,Object.keys(EVIDENCE),'evidence map');for(const [key,name]of Object.entries(EVIDENCE))if(pins.evidence_files[key]!==name)fail('exact portable evidence filenames');
 const input=parseDeterministicJson(rawByName.get('source-input.json'),'Transport inactive Source input');keys(input,['schema_version','kind','source_only','activation','adapter_input'],'Source input');if(input.schema_version!==1||input.kind!=='custodial.forward-source-admission-input.v1'||input.source_only!==true||input.activation!==false||input.adapter_input?.purpose!=='build_preparation')fail('inactive build preparation only');
 const checked=inspectForwardTransitionSourceAdmission(input.adapter_input,pins.external_trusted_pins);if(checked.accepted!==true)fail('exact forward Source shape');
 const trusted=pins.external_trusted_pins;if(trusted.candidate.source.ref!=='refs/heads/main'||trusted.candidate.source.ref===trusted.recovery.source.ref||!trusted.recovery.source.ref.startsWith('refs/heads/'))fail('Source role refs');
 if(trusted.retained_store_compatibility.source_pair.frontend_commit!==trusted.candidate.source.commit||trusted.retained_store_compatibility.source_pair.frontend_tree!==trusted.candidate.source.tree)fail('Source pair');
 for(const [key,name]of Object.entries(EVIDENCE)){
  const expected=trusted.evidence_refs[key]??trusted.retained_store_compatibility[key]?.provenance_sha256;if(!SHA.test(expected??'')||hash(rawByName.get(name))!==expected)fail('evidence bytes');
  const parsed=parseDeterministicJson(rawByName.get(name),'Transport evidence JSON');
  if(key==='retained_data_plan_sha256'&&!same(parsed,trusted.retained_store_compatibility))fail('retained plan exact bytes/value');
 }
 return{role,version_code:trusted[role].version_code,source:trusted[role].source,bytes,pins};
}
function appendEnvironment(path,lines){
 // CM_ENV is provider-supplied. Canonicalize parent aliases, reject a final
 // symlink, and bind both provider pathname and canonical held descriptor.
 const named=lstatSync(path,{bigint:true});if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1n||named.uid!==BigInt(process.getuid()))fail('CM_ENV identity');const canonical=realpathSync(path);if(!same(nine(named),nine(lstatSync(canonical,{bigint:true}))))fail('CM_ENV alias');
 const fd=openSync(canonical,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);const raw=Buffer.from(lines.join('\n')+'\n');
 try{if(!same(nine(named),nine(fstatSync(fd,{bigint:true}))))fail('CM_ENV open');let n=0;while(n<raw.length){const wrote=writeSync(fd,raw,n,raw.length-n);if(wrote<=0)fail('CM_ENV short write');n+=wrote;}fsyncSync(fd);const after=fstatSync(fd,{bigint:true});if(after.dev!==named.dev||after.ino!==named.ino||after.size!==named.size+BigInt(raw.length)||!same(nine(after),nine(lstatSync(canonical,{bigint:true})))||!same(nine(after),nine(lstatSync(path,{bigint:true}))))fail('CM_ENV changed');}finally{closeSync(fd);}
}
export async function provisionCustodialForwardBuildInputs({root,pinsSha256,role,environmentOutput}={}){
 if(!SHA.test(pinsSha256??'')||!['candidate','recovery'].includes(role)||typeof root!=='string'||typeof environmentOutput!=='string')fail('primitive inputs');
 root=realpathSync(root);const deadline=process.hrtime.bigint()+BigInt(WORK_MS)*1000000n;
 const origin=utf8(await gitRun(root,['remote','get-url','origin'],1024,deadline)).trim();if(!ORIGINS.includes(origin))fail('existing Engine origin');
 const before=await snapshot(root,deadline);if(!OID.test(before.head)||!OID.test(before.tree)||before.status!==''||!before.ref.startsWith('refs/heads/'))fail('clean named Source before transport');
 const remoteRef='refs/heads/custodial-forward-inputs/sha256-'+pinsSha256;
 const ownedRef='refs/custodial-forward-inputs/'+randomBytes(16).toString('hex');
 const ownedEmpty=await gitRun(root,['for-each-ref','--format=%(refname)',ownedRef],1024,deadline);if(ownedEmpty.length!==0)fail('owned temporary ref collision');
 const parent=realpathSync(tmpdir());const staging=join(parent,'custodial-forward-inputs-'+randomBytes(16).toString('hex'));if(staging===root||staging.startsWith(root+'/')||/[\r\n\0]/.test(staging))fail('staging path');mkdirSync(staging,{mode:0o700});directory(staging);
 createFixed(join(staging,'transport-intent.json'),Buffer.from(JSON.stringify({kind:'custodial.forward-input-transport-intent.v1',root,owned_ref:ownedRef,remote_ref:remoteRef,Source_before:before,trusted_pins_sha256:pinsSha256,role,application_or_artifact_admission:false})+'\n'));
 const intentDir=openSync(staging,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(intentDir);}finally{closeSync(intentDir);}
 let fetched=null,primary=null,rawByName=null;
 try{
  await gitRun(root,['fetch','--no-tags','--no-write-fetch-head','--no-recurse-submodules','--no-auto-maintenance','--depth=1','origin',remoteRef+':'+ownedRef],1024*1024,deadline);
  fetched=utf8(await gitRun(root,['rev-parse','--verify',ownedRef+'^{commit}'],128,deadline)).trim();if(!OID.test(fetched))fail('fetched commit');
  const tree=await gitRun(root,['ls-tree','-rz','--full-tree',fetched],16384,deadline);const records=tree.toString('utf8').split('\0');if(records.pop()!=='')fail('tree termination');if(records.length!==10)fail('ten exact metadata blobs');const names=[];
  for(const row of records){const match=/^100644 blob ([a-f0-9]{40})\t([^\0]+)$/.exec(row);if(!match||!FILES.includes(match[2])||names.includes(match[2]))fail('tree mode/type/path');names.push(match[2]);}
  if(!same([...names].sort(),[...FILES].sort()))fail('tree namespace');rawByName=new Map();
  for(const name of FILES)rawByName.set(name,await gitRun(root,['show',fetched+':'+name],FILE_CAP,deadline));
  validateBodies(rawByName,pinsSha256,role);
 }catch(error){primary=error;}
 // No adoption/publication until exact temporary-ref removal and unchanged
 // application Source HEAD/tree/ref/worktree are positively observed.
 if(fetched!==null&&primary?.transport_child?.custody_unknown!==true){try{await gitRun(root,['update-ref','-d',ownedRef,fetched],1024,deadline);if((await gitRun(root,['for-each-ref','--format=%(refname)',ownedRef],1024,deadline)).length!==0)fail('owned ref cleanup');}catch(error){primary=primary??error;}}
 if(primary!==null){createFixed(join(staging,'transport-refusal.json'),Buffer.from(JSON.stringify({kind:'custodial.forward-input-transport-refused.v1',owned_ref:ownedRef,fetched_commit:fetched,temporary_ref_cleanup_proven:fetched!==null&&primary===null,publication:false,custody_unknown:true})+'\n'));primary.transport_custody=Object.freeze({staging,owned_ref:ownedRef,Source_root:root,publication:false});throw primary;}
 if(!same(await snapshot(root,deadline),before))fail('application Source changed');
 const checked=validateBodies(rawByName,pinsSha256,role);if(before.head!==checked.source.commit||before.tree!==checked.source.tree||before.ref!==checked.source.ref)fail('selected role Source mismatch');directory(staging);const rows={};
 for(const name of FILES){const raw=rawByName.get(name);const path=join(staging,name);rows[name]={path,sha256:hash(raw),bytes:raw.length,identity9:createFixed(path,raw)};}
 const dirFD=openSync(staging,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(dirFD);}finally{closeSync(dirFD);}
 for(const name of FILES){const final=readFixed(rows[name].path,rows[name].sha256);if(!same(final.identity9,rows[name].identity9))fail('staged created file replaced');}
 if(!same(await snapshot(root,deadline),before))fail('Source changed after staging');if(process.hrtime.bigint()>deadline)fail('common work deadline');
 appendEnvironment(environmentOutput,['MZ_CUSTODIAL_FORWARD_SOURCE_INPUT='+rows['source-input.json'].path,'MZ_CUSTODIAL_FORWARD_TRUSTED_PINS='+rows['reviewed-pins.json'].path]);
 return Object.freeze({kind:'custodial.forward-input-transport-bytes-only.v1',trusted_pins_sha256:pinsSha256,role,version_code:checked.version_code,source:checked.source,transport_commit:fetched,transport_ref:remoteRef,temporary_ref_removed:true,Source_unchanged:true,files:Object.freeze(rows),work_ms_limit:WORK_MS,source_qualified:false,retained_qualified:false,artifact_accepted:false,install_ready:false});
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 const args=process.argv.slice(2);if(args.length!==8||args[0]!=='--root'||args[2]!=='--pins-sha256'||args[4]!=='--role'||args[6]!=='--environment-output')fail('exact CLI');
 const result=await provisionCustodialForwardBuildInputs({root:args[1],pinsSha256:args[3],role:args[5],environmentOutput:args[7]});
 // Paths and primitive identifiers only, never evidence bodies or credentials.
 process.stdout.write('MZ_CUSTODIAL_FORWARD_SOURCE_INPUT='+result.files['source-input.json'].path+'\nMZ_CUSTODIAL_FORWARD_TRUSTED_PINS='+result.files['reviewed-pins.json'].path+'\n');
}
