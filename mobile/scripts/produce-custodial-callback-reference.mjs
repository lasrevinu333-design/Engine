#!/usr/bin/env node
// Evidence-only compiler route. Never calls release acceptance or produces installation authority.
import {createHash,randomBytes} from 'node:crypto';
import {constants,closeSync,copyFileSync,fstatSync,lstatSync,mkdirSync,openSync,readSync,readdirSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {assertReviewedForwardBuild,loadReviewedForwardBuild,parseForwardBuildArguments,resolveBuildNumber} from './configure-native-release.mjs';
import {readCustodialBuildScope} from './custodial-new-producer-scope-policy.mjs';
import {resolveCustodialAndroidTools,parseApksignerVerification,parseAaptBadgingPackage} from './verify-custodial-android-release.mjs';
import {parseDeterministicJson} from './custodial-capacitor-runtime-policy.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const POLICY_SHA='6a18ff6ad75c77d1f02c284ef550e2277cfb23171727d85da9d2794f1df6b80b';
const BOUNDARY_SHA='55e49c6d0003592daf05e405b5eaf4ce4921207dfdabc30bb686f89cc71f514a';
const hash=b=>createHash('sha256').update(b).digest('hex');
function die(x){throw new Error('Callback reference producer: '+x);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function id(s){return [s.dev,s.ino,s.mode,s.uid,s.gid,s.nlink,s.size,s.mtimeNs,s.ctimeNs].map(String);}
function read(path,max=1048576,expected=null){
 const s=lstatSync(path,{bigint:true});if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1n||s.size>BigInt(max))die('input type/size');const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{if(!same(id(s),id(fstatSync(fd,{bigint:true}))))die('open changed');const out=Buffer.alloc(Number(s.size)+1);let n=0;while(n<out.length){const r=readSync(fd,out,n,out.length-n,null);if(!r)break;n+=r;if(n>Number(s.size))die('growth');}if(n!==Number(s.size)||!same(id(s),id(fstatSync(fd,{bigint:true})))||!same(id(s),id(lstatSync(path,{bigint:true}))))die('input changed');const b=Buffer.from(out.subarray(0,n));if(expected!==null&&hash(b)!==expected)die('hash');return b;}finally{closeSync(fd);}
}
function run(file,args,options={}){const r=spawnSync(file,args,{cwd:root,encoding:'utf8',timeout:options.timeout??10000,maxBuffer:options.maxBuffer??1048576,env:options.env??process.env,...options});if(r.error||r.signal||r.status!==0)die('owned command failed: '+file);return r.stdout;}
function json(path,sha=null){return parseDeterministicJson(read(path,1048576,sha),'Reference Source JSON');}
function output(path,b){mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,b,{flag:'wx',mode:0o600});}
function checkFiles(authority,sources){
 const expected=new Map(authority.source_files.map(x=>[join(sources,x.family,x.name),x]));const actual=[];
 function walk(p){for(const name of readdirSync(p).sort()){const q=join(p,name),s=lstatSync(q);if(s.isSymbolicLink())die('source symlink');if(s.isDirectory())walk(q);else if(s.isFile())actual.push(q);else die('source special');}}
 walk(sources);if(actual.length!==expected.size)die('source count');for(const p of actual){const e=expected.get(p);if(!e)die('source namespace');const b=read(p,1048576,e.sha256);if(b.length!==e.bytes)die('source bytes');}
}
const flags=parseForwardBuildArguments(process.argv.slice(2));const number=resolveBuildNumber(process.env).numeric;
const forward=await loadReviewedForwardBuild(flags,{buildNumber:number,repositoryDirectory:root});
const descriptor=assertReviewedForwardBuild(forward,{buildNumber:number,sourceCommit:process.env.CM_COMMIT,sourceRef:'refs/heads/'+process.env.CM_BRANCH});
if(process.env.CM_WORKFLOW_ID!=='custodial-callback-reference'||!/^[a-f0-9]{24}$/.test(process.env.CM_BUILD_ID??''))die('provider role');
const policy=json(join(root,'mobile/release-policies/custodial-callback-reference.json'),POLICY_SHA);
const authority=json(join(root,'mobile/release-policies/custodial-callback-reference-source.json'),BOUNDARY_SHA);
for(const e of policy.locked_inputs){if(read(join(root,e.path),16*1024*1024,e.sha256).length!==e.bytes)die('locked compilation input');}
const scope=readCustodialBuildScope(join(root,'mobile'));
const work=join(root,'build','callback-reference-private-'+randomBytes(16).toString('hex'));mkdirSync(work,{mode:0o700});
const sources=join(work,'sources');mkdirSync(sources,{mode:0o700});
for(const e of authority.source_files){if(!['vault','local','firebase'].includes(e.family)||!/^[A-Za-z0-9_$/.-]+\.java$/.test(e.name)||e.name.split('/').some(x=>x==='..'||x==='.'||!x))die('frozen Source name');const b=read(join(root,'mobile/callback-reference-source',e.family,e.name),1048576,e.sha256);if(b.length!==e.bytes)die('frozen Source size');output(join(sources,e.family,e.name),b);}
checkFiles(authority,sources);
const projects={':custodial-native-vault':'vault',':capacitor-local-notifications':'local',':capacitor-firebase-messaging':'firebase'};
// All output projects are redirected before evaluation. Source replacement is last, after normal Source configuration.
const init=`def referenceRoot = new File(${JSON.stringify(work)})\ndef referenceSources = new File(referenceRoot, 'sources')\ndef selected = [':custodial-native-vault':'vault', ':capacitor-local-notifications':'local', ':capacitor-firebase-messaging':'firebase']\ngradle.beforeProject { p ->\n  p.layout.buildDirectory.set(new File(referenceRoot, 'projects/' + p.path.replace(':','_')))\n}\ngradle.projectsEvaluated {\n  selected.each { path, family ->\n    def p = gradle.rootProject.findProject(path)\n    if(p == null || !p.plugins.hasPlugin('com.android.library')) throw new GradleException('Reference module missing: '+path)\n    p.android.sourceSets.main.java.setSrcDirs([new File(referenceSources,family)])\n  }\n  if(gradle.rootProject.project(':app').android.buildTypes.release.minifyEnabled) throw new GradleException('Reference minification is unsupported')\n}\n`;
const initPath=join(work,'reference.init.gradle');output(initPath,init);
const cache=join(process.env.TMPDIR??'/tmp','custodial-reference-gradle-'+randomBytes(16).toString('hex'));mkdirSync(cache,{mode:0o700});
if(relative(root,cache)===''||!relative(root,cache).startsWith('..'))die('cache inside checkout');
const args=['--no-daemon','--dependency-verification','strict','assembleRelease','--no-build-cache','--rerun-tasks'];
run(join(root,'mobile/android/gradlew'),['--init-script',initPath,...args],{cwd:join(root,'mobile/android'),timeout:55*60*1000,maxBuffer:16*1024*1024,env:{...process.env,GRADLE_USER_HOME:cache}});
checkFiles(authority,sources);read(initPath,1048576,hash(Buffer.from(init)));
for(const e of policy.locked_inputs)read(join(root,e.path),16*1024*1024,e.sha256);
const apkPath=join(work,'projects/_app/outputs/apk/release/app-release.apk');const apk=read(apkPath,250*1024*1024);
const tools=resolveCustodialAndroidTools(join(process.env.ANDROID_SDK_ROOT??'','build-tools/35.0.1'));
const signature=run(tools.apksigner,['verify','--verbose','--print-certs',apkPath],{timeout:180000,maxBuffer:1048576});
const signed=parseApksignerVerification(signature);
const badging=parseAaptBadgingPackage(run(tools.aapt2,['dump','badging',apkPath],{timeout:180000,maxBuffer:1048576}));
if(badging.package_name!==policy.package_name||badging.version_code!==number||badging.version_name!=='1.0.0')die('actual reference application identity');
const commit=run('git',['rev-parse','HEAD']).trim(),tree=run('git',['write-tree']).trim();
if(commit!==descriptor.source.commit||tree!==descriptor.source.tree||run('git',['status','--porcelain=v1','--untracked-files=all']).trim())die('Source changed during reference compile');
const toolchain=json(join(root,'build/provenance/custodial-android-toolchain.json'));
const manifest={schema_version:1,kind:'custodial.callback-reference-raw-compiled-evidence.v1',evidence_only:true,installable:false,release_admission:false,source:{commit,tree,ref:descriptor.source.ref},role:forward.role,trusted_pins_sha256:forward.trusted_pins_sha256,build:{provider:'codemagic',app_id:policy.app_id,build_id:process.env.CM_BUILD_ID,workflow:policy.workflow.id,instance_type:policy.instance_type,version_code:number,profile:scope.profile,policy_sha256:scope.policy_sha256},reference_policy_sha256:POLICY_SHA,source_boundary_sha256:BOUNDARY_SHA,locked_inputs:policy.locked_inputs,toolchain,apk:{name:'app-release.apk',bytes:apk.length,sha256:hash(apk)},application:{package_name:badging.package_name,version_code:badging.version_code,version_name:badging.version_name},signature:{verified:true,certificate_sha256:signed.signer_sha256,public_key_sha256:signed.signer_public_key_sha256,stdout_sha256:hash(Buffer.from(signature))},gradle:{arguments:args,init_sha256:hash(Buffer.from(init))},source_census:{files:authority.source_files.length,source_boundary_sha256:BOUNDARY_SHA}};
output(join(root,'build/callback-reference/app-release.apk'),apk);
output(join(root,'build/provenance/custodial-callback-reference.json'),JSON.stringify(manifest,null,2)+'\n');
process.stdout.write('Reference bytes produced as evidence only; NOT installable or release admitted.\n');
