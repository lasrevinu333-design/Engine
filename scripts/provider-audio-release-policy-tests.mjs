import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync,copyFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import * as clock from '../mobile/scripts/custodial-provider-release-policy.mjs';
const record={version_code:999,version_name:'SYNTHETIC_ONLY',backend_protocol_evidence_sha256:'a'.repeat(64),composition_evidence_sha256:'b'.repeat(64),
 profile:{id:'SYNTHETIC_ONLY',api:'synthetic-api',build:'synthetic-build',device:'synthetic-device',quantization_nanos:1,rate_ppm:1,max_age_nanos:1000000,evidence_sha256:'c'.repeat(64)}};
const bytes=JSON.stringify({schema:'custodial.native-provider-reviewed-releases.v1',package_name:clock.PROVIDER_PACKAGE,releases:[record]});
const input={policyBytes:bytes,compiledSource:clock.compiledReviewedProviderReleases(bytes),versionCode:999,versionName:'SYNTHETIC_ONLY',required:true};
let checks=0;const rejects=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};const equal=(a,b)=>{assert.deepEqual(a,b);checks++;};
// First assertion reproduces the actual pre-change build selector accepting a
// clock-only ticket despite the production audio registry having no entries.
rejects(()=>clock.selectReviewedProviderRelease(input),/qualified audio release inputs absent/);
const audio=await import('../mobile/scripts/custodial-provider-audio-release-policy.mjs');
const json=rows=>JSON.stringify({schema:'custodial.native-provider-reviewed-audio-releases.v1',package_name:clock.PROVIDER_PACKAGE,releases:rows});
const entry={version_code:record.version_code,version_name:record.version_name,clock_fingerprint:audio.providerClockProfileFingerprint(record.profile),
 backend_protocol_evidence_sha256:record.backend_protocol_evidence_sha256,composition_evidence_sha256:record.composition_evidence_sha256,
 policy:{engine:'synthetic.local.engine',voice:'SYNTHETIC_ONLY',rate_milli:900,tone_sha256:'d'.repeat(64),evidence_sha256:'e'.repeat(64)}};
const choose=(rows=[entry],other={})=>{const b=json(rows);return clock.selectReviewedProviderRelease({...input,audioPolicyBytes:b,audioCompiledSource:audio.compiledReviewedProviderAudioReleases(b),...other});};
const ticket=choose();equal(clock.isQualifiedProviderRelease(ticket),true);equal(ticket.audioProfileCount,1);equal(clock.isQualifiedProviderRelease({...ticket}),false);
const {withoutPairedAudioRegistry,pairedAudioRegistryDelta}=await import('./paired-audio-registry-source-boundary.mjs');
const nativeSource=readFileSync(new URL('../'+pairedAudioRegistryDelta.path,import.meta.url),'utf8');
const prior=withoutPairedAudioRegistry(pairedAudioRegistryDelta.path,nativeSource);
equal(createHash('sha256').update(prior).digest('hex'),pairedAudioRegistryDelta.prior_sha256);equal(withoutPairedAudioRegistry(pairedAudioRegistryDelta.path,prior),prior);
for(const bad of [nativeSource+' ',nativeSource.slice(1),nativeSource.replace('entries();','entries( );')])rejects(()=>withoutPairedAudioRegistry(pairedAudioRegistryDelta.path,bad));
const expectedFingerprint=createHash('sha256').update([record.profile.id,record.profile.api,record.profile.build,record.profile.device,record.profile.quantization_nanos,record.profile.rate_ppm,record.profile.max_age_nanos,record.profile.evidence_sha256].join('\n')).digest('hex');equal(entry.clock_fingerprint,expectedFingerprint);
rejects(()=>choose([]),/paired audio release inputs absent/);
for(const mutate of [r=>r.extra=true,r=>r.version_code=0,r=>r.version_name=' x',r=>r.clock_fingerprint='f'.repeat(64),r=>r.backend_protocol_evidence_sha256='f'.repeat(64),r=>r.composition_evidence_sha256='f'.repeat(64),
 r=>r.policy.extra=true,r=>r.policy.rate_milli=899,r=>r.policy.voice='unsafe voice',r=>r.policy.engine='not-an-engine',r=>r.policy.tone_sha256='invalid',r=>r.policy.evidence_sha256='invalid']){
 const value=structuredClone(entry);mutate(value);rejects(()=>choose([value]));
}
rejects(()=>choose([entry,entry]),/duplicate/);
rejects(()=>choose([entry],{audioCompiledSource:audio.compiledReviewedProviderAudioReleases(json([entry]))+' '}),/differ/);
rejects(()=>audio.parseReviewedProviderAudioReleases(json([entry]).replace('"releases":','"releases":[],"releases":')),/repeats the JSON key/);
rejects(()=>audio.parseReviewedProviderAudioReleases(json([entry]).replace(clock.PROVIDER_PACKAGE,'foreign.package')));
const root=new URL('../mobile/plugins/custodial-native-vault/',import.meta.url),real=readFileSync(new URL('android/src/provider-reviewed-audio-releases.json',root));
equal(audio.parseReviewedProviderAudioReleases(real).releases,[]);
equal(readFileSync(new URL('android/src/main/java/org/memphiszoo/custodial/vault/NativeProviderReviewedAudioReleases.java',root),'utf8'),audio.compiledReviewedProviderAudioReleases(real));
equal(clock.readReviewedProviderRelease(root.pathname,{versionCode:999,versionName:'SYNTHETIC_ONLY'}),null);
rejects(()=>clock.readReviewedProviderRelease(root.pathname,{versionCode:999,versionName:'SYNTHETIC_ONLY',required:true}),/qualified provider release inputs absent/);
const dir=mkdtempSync(join(tmpdir(),'mz-audio-policy-')),fixture=join(dir,'frontend/mobile/plugins/custodial-native-vault');
try{
 const j=join(fixture,'android/src/main/java/org/memphiszoo/custodial/vault');mkdirSync(j,{recursive:true,mode:0o700});
 const tone=readFileSync(new URL('../../../memphis-alert-tone.wav',root));writeFileSync(join(dir,'frontend/memphis-alert-tone.wav'),tone);
 writeFileSync(join(fixture,'android/src/provider-reviewed-releases.json'),bytes);writeFileSync(join(j,'NativeProviderReviewedReleases.java'),input.compiledSource);
 const actualTone=structuredClone(entry);actualTone.policy.tone_sha256=createHash('sha256').update(tone).digest('hex');
 const ab=json([actualTone]);writeFileSync(join(fixture,'android/src/provider-reviewed-audio-releases.json'),ab);writeFileSync(join(j,'NativeProviderReviewedAudioReleases.java'),audio.compiledReviewedProviderAudioReleases(ab));
 equal(clock.isQualifiedProviderRelease(clock.readReviewedProviderRelease(fixture,{versionCode:999,versionName:'SYNTHETIC_ONLY',required:true})),true);
 writeFileSync(join(dir,'frontend/memphis-alert-tone.wav'),Buffer.from('synthetic changed tone'));rejects(()=>clock.readReviewedProviderRelease(fixture,{versionCode:999,versionName:'SYNTHETIC_ONLY',required:true}),/shared source asset/);writeFileSync(join(dir,'frontend/memphis-alert-tone.wav'),tone);
 writeFileSync(join(j,'NativeProviderReviewedAudioReleases.java'),audio.compiledReviewedProviderAudioReleases(ab)+' ');rejects(()=>clock.readReviewedProviderRelease(fixture,{versionCode:999,versionName:'SYNTHETIC_ONLY',required:true}),/differ/);
 rmSync(join(fixture,'android/src/provider-reviewed-audio-releases.json'));symlinkSync(new URL('android/src/provider-reviewed-audio-releases.json',root).pathname,join(fixture,'android/src/provider-reviewed-audio-releases.json'));
 rejects(()=>clock.readReviewedProviderRelease(fixture,{versionCode:999,versionName:'SYNTHETIC_ONLY',required:true}));
}finally{rmSync(dir,{recursive:true});console.log('OWNED_POLICY_FIXTURE_REMOVED',dir);}
// Actual semantic DEX guard on closed binary fixtures, not an APK proof.
const {assertQualifiedProviderClassClosure}=await import('../mobile/scripts/verify-custodial-android-release.mjs');
const names=['CustodialProviderMessagingService','CustodialNativeRuntime','NativeProviderFirebaseDispatch','NativeProviderReleaseAdmission','NativeProviderReviewedReleases','NativeProviderRuntimeOwner','NativeProviderPayload','NativeProviderAudioAdmission','NativeProviderReviewedAudioReleases','NativeProviderAudioPolicy'];
function dexFixture(list){
 const ds=list.map(n=>'Lorg/memphiszoo/custodial/vault/'+n+';');assert.ok(ds.every(s=>s.length<128));
 const ids=112,types=ids+ds.length*4,defs=types+ds.length*4,data=defs+ds.length*32;
 const strings=ds.map(s=>Buffer.concat([Buffer.from([s.length]),Buffer.from(s),Buffer.from([0])]));
 const b=Buffer.alloc(data+strings.reduce((n,s)=>n+s.length,0));b.write('dex\n035\0',0,'latin1');
 for(const [offset,value]of [[32,b.length],[36,112],[40,0x12345678],[56,ds.length],[60,ids],[64,ds.length],[68,types],[96,ds.length],[100,defs],[104,b.length-data],[108,data]])b.writeUInt32LE(value,offset);
 let cursor=data;for(const [i,s]of strings.entries()){b.writeUInt32LE(cursor,ids+i*4);b.writeUInt32LE(i,types+i*4);b.writeUInt32LE(i,defs+i*32);s.copy(b,cursor);cursor+=s.length;}return b;
}
equal(Object.keys(assertQualifiedProviderClassClosure([{name:'classes.dex',bytes:dexFixture(names)}])).length,10);
for(const missing of names.slice(-3))rejects(()=>assertQualifiedProviderClassClosure([{name:'classes.dex',bytes:dexFixture(names.filter(n=>n!==missing))}]));
rejects(()=>assertQualifiedProviderClassClosure([{name:'classes.dex',bytes:dexFixture(names)},{name:'classes2.dex',bytes:dexFixture(names)}]));
console.log(JSON.stringify({status:'PAIRED_AUDIO_SOURCE_PASS',checks,realClockProfiles:0,realAudioProfiles:0,synthetic:true,apk:false,device:false,independentReview:false}));
