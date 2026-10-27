// Evidence acquisition only. No release, installation, store or callback verdict is minted here.
import {createHash} from 'node:crypto';
import {closeSync,constants,fstatSync,lstatSync,openSync,readSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {assertReviewedForwardBuild} from './configure-native-release.mjs';
import {parseDeterministicJson} from './custodial-capacitor-runtime-policy.mjs';
import {custodialAndroidToolchainPolicyForPlatform} from './custodial-android-toolchain-policy.mjs';

const POLICY_SHA='a3ecf7e0828942c75460586de5156e72980c24cc5c23bd4597a05f52edeeedc2';
const CONFIG_SHA='5518512605b7d9508d09a844aaf90fe9013115065cfd954469a95ca4048b91b9';
const configPath=fileURLToPath(new URL('../release-policies/custodial-callback-reference-workflow.json',import.meta.url));
const BOUNDARY_SHA='55e49c6d0003592daf05e405b5eaf4ce4921207dfdabc30bb686f89cc71f514a';
const policyPath=fileURLToPath(new URL('../release-policies/custodial-callback-reference.json',import.meta.url));
const boundaryPath=fileURLToPath(new URL('../release-policies/custodial-callback-reference-source.json',import.meta.url));
const admitted=new WeakMap();
const nativeFetch=globalThis.fetch.bind(globalThis);
const HASH=/^[a-f0-9]{64}$/;
const MAX_APK=250*1024*1024, MAX_BUNDLE=25*1024*1024, MAX_JSON=2*1024*1024;
const FLEET_CERT='dd2e0b44abee02b4d9e1be74edaa05587a93f5e4c502716df99639bc96e7a0bf';
const FLEET_KEY='5bbf30c71444534f189f75cfa3e65779285a4e8e25ff3fd7cbfa1cbc86de1d4c';
const API=Object.freeze({api_origin:'https://codemagic.io',artifact_origin:'https://api.codemagic.io',artifact_redirect_origins:['https://api.codemagic.io','https://storage.googleapis.com'],apk_artifact_name:'app-release.apk'});
function fail(message){throw new Error('Callback reference: '+message);}
function sha(b){return createHash('sha256').update(b).digest('hex');}
function equal(a,b){const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function keys(v,names){if(!v||typeof v!=='object'||Array.isArray(v)||!equal(Object.keys(v).sort(),[...names].sort()))fail('unexpected object fields');}
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function nine(s){return [s.dev,s.ino,s.mode,s.uid,s.gid,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String);}
function sourceBytes(path,expected,max){
 const before=lstatSync(path,{bigint:true});
 if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1n||before.size>BigInt(max))fail('Source type/size');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);let out;
 try{
  if(!equal(nine(fstatSync(fd,{bigint:true})),nine(before)))fail('Source open identity');
  const count=Number(before.size),b=Buffer.alloc(count+1);let n=0;
  while(n<b.length){const r=readSync(fd,b,n,b.length-n,null);if(!r)break;n+=r;if(n>count)fail('Source growth');}
  if(n!==count||!equal(nine(fstatSync(fd,{bigint:true})),nine(before))||!equal(nine(lstatSync(path,{bigint:true})),nine(before)))fail('Source changed');
  out=Buffer.from(b.subarray(0,n));
 }finally{closeSync(fd);}
 if(sha(out)!==expected)fail('Source hash');return out;
}
function governing(){
 const policy=parseDeterministicJson(sourceBytes(policyPath,POLICY_SHA,1024*1024),'Reference policy');
 const boundary=parseDeterministicJson(sourceBytes(boundaryPath,BOUNDARY_SHA,1024*1024),'Reference Source boundary');
 if(policy.source_boundary_sha256!==BOUNDARY_SHA||policy.evidence_only!==true||policy.installable!==false||policy.release_admission!==false)fail('reference-only policy');
 const workflow=parseDeterministicJson(sourceBytes(configPath,CONFIG_SHA,1024*1024),'Expanded reference Source workflow');
 return {policy,boundary,workflow};
}
function profile(value){if(!['full-system','cleaning-first-retained-continuity-v1'].includes(value))fail('Source scope profile');return value;}
function assertRawUrlPathIsCanonical(raw, label) {
  const pathSource = raw.split(/[?#]/, 1)[0];
  if (
    /[\u0000-\u0020\u007f]/.test(raw)
    || pathSource.includes('\\')
    || pathSource.startsWith('//')
    || /%(?:2e|2f|5c)/i.test(pathSource)
    || pathSource.split('/').some((segment) => segment === '.' || segment === '..')
  ) throw new Error(`${label} violates the reviewed HTTPS origin policy`);
}

function isReviewedCodemagicArtifactPath(pathname) {
  return /^\/\/artifacts\/\.[A-Za-z0-9_-]{256,512}\.[A-Za-z0-9_-]{27}$/.test(pathname);
}

function isReviewedStorageArtifactPath(pathname, expectedArtifactName) {
  const match = pathname.match(
    /^\/codemagic-build-artifacts\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([A-Za-z0-9._-]+)$/,
  );
  return Boolean(match && match[3] === expectedArtifactName);
}

function hasReviewedStorageQuery(url, raw) {
  const queryIndex = raw.indexOf('?');
  if (queryIndex < 0 || raw.indexOf('?', queryIndex + 1) >= 0 || raw.includes('#')) return false;
  const rawQuery = raw.slice(queryIndex + 1);
  const match = rawQuery.match(
    /^Expires=([1-9]\d*)&GoogleAccessId=((?:[A-Za-z0-9._~!$'()*+,;=:@\/-]|%[0-9A-F]{2})+)&Signature=((?:[A-Za-z0-9._~!$'()*+,;=:@\/-]|%[0-9A-F]{2})+)$/,
  );
  if (!match || url.search !== `?${rawQuery}`) return false;
  const expires = Number(match[1]);
  if (!Number.isSafeInteger(expires) || expires < 1) return false;
  let googleAccessId;
  let signature;
  try {
    googleAccessId = decodeURIComponent(match[2]);
    signature = decodeURIComponent(match[3]);
  } catch {
    return false;
  }
  if (
    encodeURIComponent(googleAccessId) !== match[2]
    || encodeURIComponent(signature) !== match[3]
    || googleAccessId.length > 320
    || !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/.test(googleAccessId)
    || signature.length > 2048
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature)
    || Buffer.from(signature, 'base64').toString('base64') !== signature
  ) return false;
  const entries = [...url.searchParams.entries()];
  return JSON.stringify(entries) === JSON.stringify([
    ['Expires', match[1]],
    ['GoogleAccessId', googleAccessId],
    ['Signature', signature],
  ]);
}

function safeArtifactUrl(value, expectedOrigin) {
  const raw = value instanceof URL ? value.href : value;
  if (typeof raw !== 'string' || !raw || raw.includes('?') || raw.includes('#')) {
    throw new Error('Codemagic artifact URL violates the reviewed HTTPS origin policy');
  }
  assertRawUrlPathIsCanonical(raw, 'Codemagic artifact URL');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Codemagic artifact URL is malformed');
  }
  if (
    url.protocol !== 'https:'
    || url.origin !== expectedOrigin
    || url.username
    || url.password
    || url.hash
    || url.port
    || url.search
    || url.href !== raw
    || !isReviewedCodemagicArtifactPath(url.pathname)
    || /%(?:2e|2f|5c)/i.test(url.pathname)
  ) throw new Error('Codemagic artifact URL violates the reviewed HTTPS origin policy');
  return url;
}

function safeRedirectUrl(value, expectedArtifactName) {
  const raw = value;
  if (typeof raw !== 'string' || !raw || raw.includes('#')) {
    throw new Error('Codemagic artifact redirect violates HTTPS policy');
  }
  try {
    assertRawUrlPathIsCanonical(raw, 'Codemagic artifact redirect');
  } catch {
    throw new Error('Codemagic artifact redirect violates HTTPS policy');
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Codemagic artifact redirect is malformed');
  }
  const reviewedApiRedirect = url.origin === API.artifact_origin
    && !raw.includes('?')
    && isReviewedCodemagicArtifactPath(url.pathname);
  const reviewedStorageRedirect = url.origin === 'https://storage.googleapis.com'
    && isReviewedStorageArtifactPath(url.pathname, expectedArtifactName)
    && hasReviewedStorageQuery(url, raw);
  if (
    url.protocol !== 'https:'
    || !API.artifact_redirect_origins.includes(url.origin)
    || url.username
    || url.password
    || url.hash
    || url.port
    || url.href !== raw
    || /%(?:2e|2f|5c)/i.test(url.pathname)
    || (!reviewedApiRedirect && !reviewedStorageRedirect)
  ) {
    throw new Error('Codemagic artifact redirect violates HTTPS policy');
  }
  return url;
}

async function responseBytes(response,maximum,label){
 const declared=response.headers.get('content-length');
 if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maximum)) {await response.body?.cancel();fail(label+' size');}
 if(!response.body?.getReader)fail(label+' streamed response unavailable');
 const reader=response.body.getReader();const chunks=[];let n=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>maximum)fail(label+' size');chunks.push(Buffer.from(value));}}
 catch(e){try{await reader.cancel();}catch{}throw e;}
 return Buffer.concat(chunks,n);
}
async function metadata(buildId,token,policy,descriptor,forwardBuild,workflow){
 const response=await nativeFetch(API.api_origin+'/api/v3/builds/'+buildId,{method:'GET',headers:{accept:'application/json','x-auth-token':token},credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
 if(response.status!==200||!String(response.headers.get('content-type')).toLowerCase().startsWith('application/json')){try{await response.body?.cancel();}catch{}fail('provider metadata response');}
 const raw=await responseBytes(response,MAX_JSON,'metadata');const parsed=parseDeterministicJson(raw,'Reference authoritative provider response');keys(parsed,['data']);const d=parsed.data;
 keys(d,['app_id','app_store_connect_status','artifacts','branch','build_inputs','commit','config','created_at','finished_at','id','index','instance_type','labels','pull_request','release_notes','remote_access_enabled','started_at','status','tag','workflow']);
 keys(d.workflow,['id','name','source']);keys(d.commit,['author_email','author_name','avatar_url','hash','message','url']);
 // Exact complete expanded Source configuration: no command/env/dependency/tool override is ignored.
 if(!equal(d.config,workflow))fail('authoritative provider configuration differs from exact reviewed Source workflow');
 if(d.id!==buildId||d.app_id!==policy.app_id||d.status!=='finished'||d.branch!==descriptor.source.ref.slice('refs/heads/'.length)||d.commit.hash!==descriptor.source.commit||d.commit.url!==`https://github.com/${policy.repository}/commit/${descriptor.source.commit}`||!equal(d.workflow,policy.workflow)||d.instance_type!==policy.instance_type||d.tag!==null||d.pull_request!==null||d.remote_access_enabled!==false||d.app_store_connect_status!==null)fail('provider Source/workflow identity');
 keys(d.build_inputs,['custodial_forward_review_pins_sha256','custodial_forward_review_role']);
 if(d.build_inputs.custodial_forward_review_pins_sha256!==forwardBuild.trusted_pins_sha256||d.build_inputs.custodial_forward_review_role!==forwardBuild.role)fail('provider independently reviewed role');
 const times=['created_at','started_at','finished_at'].map(k=>{if(typeof d[k]!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(d[k])||!Number.isFinite(Date.parse(d[k])))fail('provider timestamps');return Date.parse(d[k]);});
 if(times[0]>times[1]||times[1]>times[2]||!Number.isSafeInteger(d.index)||d.index<1||!Array.isArray(d.artifacts)||d.artifacts.length!==2)fail('provider lifecycle/artifact census');
 const expected=[{name:'app-release.apk',type:'apk',maximum:MAX_APK,version_code:String(descriptor.version_code),version_name:'1.0.0'},{name:`Engine_${d.index}_artifacts.zip`,type:'bundle',maximum:MAX_BUNDLE,version_code:null,version_name:null}];
 const artifacts=expected.map(e=>{const matches=d.artifacts.filter(a=>a.name===e.name);if(matches.length!==1)fail('artifact role');const a=matches[0];keys(a,['name','short_lived_download_url','size_in_bytes','type','version_code','version_name']);if(a.type!==e.type||a.version_code!==e.version_code||a.version_name!==e.version_name||!Number.isSafeInteger(a.size_in_bytes)||a.size_in_bytes<1||a.size_in_bytes>e.maximum)fail('artifact fields');return {name:a.name,type:a.type,size:a.size_in_bytes,url:safeArtifactUrl(a.short_lived_download_url,API.artifact_origin)};});
 return {raw,artifacts,stable:{build_id:buildId,app_id:d.app_id,commit:d.commit.hash,branch:d.branch,index:d.index,workflow:d.workflow,instance_type:d.instance_type,created_at:d.created_at,started_at:d.started_at,finished_at:d.finished_at,artifacts:artifacts.map(a=>({name:a.name,type:a.type,size:a.size}))}};
}
async function artifact(a){
 let url=a.url;
 for(let n=0;n<=4;n++){
  const r=await nativeFetch(url,{method:'GET',headers:{accept:'application/octet-stream'},credentials:'omit',redirect:'manual',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(300000)});
  if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');await r.body?.cancel();if(n===4)fail('redirect count');url=safeRedirectUrl(location,a.name);continue;}
  if(r.status!==200){await r.body?.cancel();fail('artifact response');}
  const b=await responseBytes(r,a.type==='apk'?MAX_APK:MAX_BUNDLE,'artifact');if(b.length!==a.size)fail('artifact exact length');return b;
 }
 fail('artifact transfer');
}
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
// Strict ordinary APK/ZIP32 grammar. Unsupported ZIP64/encryption/links fail closed.
function zip(bytes,maximumTotal){
 if(!Buffer.isBuffer(bytes)||bytes.length<22)fail('ZIP bytes');
 let e=-1;for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){if(bytes.readUInt32LE(p)===0x06054b50&&p+22+bytes.readUInt16LE(p+20)===bytes.length){e=p;break;}}
 if(e<0||bytes.readUInt16LE(e+4)!==0||bytes.readUInt16LE(e+6)!==0||bytes.readUInt16LE(e+8)!==bytes.readUInt16LE(e+10))fail('ZIP central directory');
 const count=bytes.readUInt16LE(e+10),size=bytes.readUInt32LE(e+12),offset=bytes.readUInt32LE(e+16);
 if(count===0xffff||count>16384||size===0xffffffff||offset===0xffffffff||offset+size!==e)fail('ZIP32 limits');
 const entries=new Map(),ranges=[];let p=offset,total=0;
 for(let i=0;i<count;i++){
  if(p+46>e||bytes.readUInt32LE(p)!==0x02014b50)fail('ZIP entry header');
  const flags=bytes.readUInt16LE(p+8),method=bytes.readUInt16LE(p+10),crc=bytes.readUInt32LE(p+16),compressed=bytes.readUInt32LE(p+20),length=bytes.readUInt32LE(p+24),nl=bytes.readUInt16LE(p+28),xl=bytes.readUInt16LE(p+30),cl=bytes.readUInt16LE(p+32),disk=bytes.readUInt16LE(p+34),attrs=bytes.readUInt32LE(p+38),local=bytes.readUInt32LE(p+42);
  if(flags&~0x808||![0,8].includes(method)||disk||length===0xffffffff||compressed===0xffffffff||local===0xffffffff||p+46+nl+xl+cl>e)fail('ZIP unsupported entry');
  const nb=bytes.subarray(p+46,p+46+nl),name=nb.toString('utf8');
  if(!Buffer.from(name,'utf8').equals(nb)||!name||name.length>1024||/[^\x20-\x7e]/.test(name)||name.startsWith('/')||name.includes('\\')||name.split('/').some((x,i,a)=>x==='.'||x==='..'||(x===''&&i!==a.length-1))||entries.has(name)||((attrs>>>16)&0xf000)===0xa000)fail('ZIP namespace');
  if(length>64*1024*1024||(total+=length)>maximumTotal||local+30>offset||bytes.readUInt32LE(local)!==0x04034b50)fail('ZIP expansion/local header');
  const lnl=bytes.readUInt16LE(local+26),lxl=bytes.readUInt16LE(local+28),start=local+30+lnl+lxl;
  if(bytes.readUInt16LE(local+6)!==flags||bytes.readUInt16LE(local+8)!==method||!bytes.subarray(local+30,local+30+lnl).equals(nb)||start+compressed>offset)fail('ZIP local identity');
  if(!(flags&8)&&(bytes.readUInt32LE(local+14)!==crc||bytes.readUInt32LE(local+18)!==compressed||bytes.readUInt32LE(local+22)!==length))fail('ZIP local sizes');
  let end=start+compressed;
  if(flags&8){let d=end;if(d+4<=offset&&bytes.readUInt32LE(d)===0x08074b50)d+=4;if(d+12>offset||bytes.readUInt32LE(d)!==crc||bytes.readUInt32LE(d+4)!==compressed||bytes.readUInt32LE(d+8)!==length)fail('ZIP descriptor');end=d+12;}
  ranges.push([local,end]);const compressedBytes=bytes.subarray(start,start+compressed);
  const b=method===0?Buffer.from(compressedBytes):inflateRawSync(compressedBytes,{maxOutputLength:Math.max(1,length)});
  if(b.length!==length||crc32(b)!==crc||(name.endsWith('/')&&length!==0))fail('ZIP CRC/length');entries.set(name,b);p+=46+nl+xl+cl;
 }
 if(p!==e)fail('ZIP census');ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])fail('ZIP overlapping entries');return entries;
}
function record(ticket){const r=admitted.get(ticket);if(!r)fail('reference was not acquired by this module');return r;}
export function assertCustodialCallbackReference(ticket,{profile:expectedProfile,policySha256,candidateSourceCommit,versionCode}={}){
 const r=record(ticket);profile(expectedProfile);if(r.evidence.profile!==expectedProfile||r.evidence.policy_sha256!==policySha256||r.evidence.source.commit!==candidateSourceCommit||r.evidence.version_code!==versionCode||r.evidence.reference_policy_sha256!==POLICY_SHA||r.evidence.source_boundary_sha256!==BOUNDARY_SHA)fail('reference/candidate binding');return r.evidence;
}
export function custodialCallbackReferenceEvidence(ticket){return record(ticket).evidence;}
export function custodialCallbackReferenceApkBytes(ticket){return Buffer.from(record(ticket).apk);}
export function custodialCallbackReferenceDexEntries(ticket){
 const all=zip(record(ticket).apk,512*1024*1024);const result=new Map();
 for(const [name,b] of all){if(/^classes(?:[2-9]|[1-9][0-9]+)?\.dex$/.test(name))result.set(name,Buffer.from(b));else if(name.endsWith('.dex'))fail('unexpected DEX path');}
 if(!result.has('classes.dex')||result.size>16)fail('DEX census');const names=[...result.keys()];for(let i=1;i<=names.length;i++)if(!result.has(i===1?'classes.dex':`classes${i}.dex`))fail('DEX numbering');return result;
}
export async function acquireCustodialCallbackReference({buildId,token,forwardBuild,profile:expectedProfile,policySha256,referencePolicyPath=policyPath,referencePolicySha256=POLICY_SHA}={}){
 if(typeof buildId!=='string'||!/^[a-f0-9]{24}$/.test(buildId)||typeof token!=='string'||token.length<16||token.length>2048||/\s/.test(token)||referencePolicyPath!==policyPath||referencePolicySha256!==POLICY_SHA||!HASH.test(policySha256))fail('acquisition input');profile(expectedProfile);
 const descriptor=assertReviewedForwardBuild(forwardBuild,{buildNumber:forwardBuild?.descriptor?.version_code});
 const {policy,boundary,workflow}=governing();
 const first=await metadata(buildId,token,policy,descriptor,forwardBuild,workflow);
 const apk=await artifact(first.artifacts[0]),bundle=await artifact(first.artifacts[1]);
 const contents=zip(bundle,64*1024*1024),manifestBytes=contents.get('build/provenance/custodial-callback-reference.json');
 if(!manifestBytes||manifestBytes.length>1024*1024)fail('manifest role');const m=parseDeterministicJson(manifestBytes,'Reference evidence manifest');
 keys(m,['schema_version','kind','evidence_only','installable','release_admission','source','role','trusted_pins_sha256','build','reference_policy_sha256','source_boundary_sha256','locked_inputs','toolchain','apk','application','signature','gradle','source_census']);
 const source={commit:descriptor.source.commit,tree:descriptor.source.tree,ref:descriptor.source.ref};
 const build={provider:'codemagic',app_id:policy.app_id,build_id:buildId,workflow:policy.workflow.id,instance_type:policy.instance_type,version_code:descriptor.version_code,profile:expectedProfile,policy_sha256:policySha256};
 if(m.schema_version!==1||m.kind!=='custodial.callback-reference-raw-compiled-evidence.v1'||m.evidence_only!==true||m.installable!==false||m.release_admission!==false||!equal(m.source,source)||m.role!==forwardBuild.role||m.trusted_pins_sha256!==forwardBuild.trusted_pins_sha256||!equal(m.build,build)||m.reference_policy_sha256!==POLICY_SHA||m.source_boundary_sha256!==BOUNDARY_SHA||!equal(m.locked_inputs,policy.locked_inputs)||!equal(m.apk,{name:'app-release.apk',bytes:apk.length,sha256:sha(apk)})||!equal(m.source_census,{files:boundary.source_files.length,source_boundary_sha256:BOUNDARY_SHA}))fail('manifest Source/build/dependency/artifact binding');
 if(!equal(m.application,{package_name:policy.package_name,version_code:descriptor.version_code,version_name:'1.0.0'}))fail('actual reference APK application identity');
 const tools=custodialAndroidToolchainPolicyForPlatform('darwin');
 keys(m.toolchain,['schema_version','codemagic_xcode_image','android_build_tools_version','toolchain_policy_sha256','files_sha256']);
 if(m.toolchain.schema_version!==1||m.toolchain.codemagic_xcode_image!=='26.2'||m.toolchain.android_build_tools_version!=='35.0.1'||m.toolchain.toolchain_policy_sha256!==tools.sha256||!equal(m.toolchain.files_sha256,tools.installed_files_sha256))fail('locked actual toolchain');
 keys(m.signature,['verified','certificate_sha256','public_key_sha256','stdout_sha256']);if(m.signature.verified!==true||m.signature.certificate_sha256!==FLEET_CERT||m.signature.public_key_sha256!==FLEET_KEY||!HASH.test(m.signature.stdout_sha256))fail('reference signature tool evidence');
 keys(m.gradle,['arguments','init_sha256']);if(!equal(m.gradle.arguments,['--no-daemon','--dependency-verification','strict','assembleRelease','--no-build-cache','--rerun-tasks'])||!HASH.test(m.gradle.init_sha256))fail('reference compiler invocation');
 // Validate actual DEX ZIP/CRC closure before creating the private ticket.
 const dex=zip(apk,512*1024*1024);if(!dex.has('classes.dex'))fail('reference has no actual DEX');
 const second=await metadata(buildId,token,policy,descriptor,forwardBuild,workflow);if(!equal(first.stable,second.stable))fail('provider changed during acquisition');
 const evidence=freeze({schema_version:1,kind:'custodial.callback-reference-admitted-raw-evidence.v1',evidence_only:true,installable:false,release_admission:false,source,version_code:descriptor.version_code,profile:expectedProfile,policy_sha256:policySha256,reference_policy_sha256:POLICY_SHA,source_boundary_sha256:BOUNDARY_SHA,provider_build:first.stable,apk_sha256:sha(apk),apk_bytes:apk.length,manifest_sha256:sha(manifestBytes),toolchain:m.toolchain,locked_inputs:m.locked_inputs,signature:m.signature,provider_configuration_source_sha256:CONFIG_SHA,metadata_before_sha256:sha(first.raw),metadata_after_sha256:sha(second.raw)});
 const ticket=Object.freeze({kind:'custodial.private-callback-reference-ticket.v1'});admitted.set(ticket,{apk:Buffer.from(apk),evidence});return ticket;
}
