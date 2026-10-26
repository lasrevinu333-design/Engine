import assert from 'node:assert/strict';
import {readFileSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseDeterministicJson} from './custodial-capacitor-runtime-policy.mjs';
import {parseAaptXmlTree} from './verify-android-apk-backup.mjs';
import {requirePairedProviderAudio} from './custodial-provider-audio-release-policy.mjs';

export const PROVIDER_PACKAGE='org.memphiszoo.custodial';
export const PROVIDER_SERVICE=PROVIDER_PACKAGE+'.vault.CustodialProviderMessagingService';
export const LEGACY_PROVIDER_SERVICES=Object.freeze([
  'com.google.firebase.messaging.FirebaseMessagingService',
  'io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService',
]);
const ACTION='com.google.firebase.MESSAGING_EVENT';
const tickets=new WeakSet();
const sha=v=>createHash('sha256').update(v).digest('hex');
const keys=(v,want)=>{assert.ok(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...want].sort());};
const text=v=>{assert.equal(typeof v,'string');assert.match(v,/^[\x20-\x21\x23-\x5b\x5d-\x7e]{1,512}$/);assert.equal(v.trim(),v);};
const digest=v=>assert.match(v,/^[0-9a-f]{64}$/);
const integer=(v,min,max)=>{assert.ok(Number.isSafeInteger(v)&&v>=min&&v<=max);};
const java=v=>JSON.stringify(v);
const HEADER=`package org.memphiszoo.custodial.vault;

/** Deterministic compiled counterpart of provider-reviewed-releases.json.
 * Validated byte-for-byte by native configuration; never loaded at runtime.
 * No real release is admitted until reviewed source inputs are supplied. */
final class NativeProviderReviewedReleases {
    static NativeProviderReleaseAdmission.Release[] entries() {
`;
const FOOTER=`    }
    private NativeProviderReviewedReleases() {}
}
`;

/** Closed source artifact, NOT caller/HTTP qualification. Hash syntax cannot
 * prove scientific sufficiency; source review and the real evidence remain gates. */
export function parseReviewedProviderReleases(bytes){
  const value=parseDeterministicJson(bytes,'reviewed provider releases');
  keys(value,['schema','package_name','releases']);
  assert.equal(value.schema,'custodial.native-provider-reviewed-releases.v1');
  assert.equal(value.package_name,PROVIDER_PACKAGE);
  assert.ok(Array.isArray(value.releases)&&value.releases.length<=32);
  const seen=new Set();
  for(const row of value.releases){
    keys(row,['version_code','version_name','profile','backend_protocol_evidence_sha256','composition_evidence_sha256']);
    integer(row.version_code,1,2100000000);text(row.version_name);assert.ok(row.version_name.length<=64);
    digest(row.backend_protocol_evidence_sha256);digest(row.composition_evidence_sha256);
    const p=row.profile;
    keys(p,['id','api','build','device','quantization_nanos','rate_ppm','max_age_nanos','evidence_sha256']);
    for(const field of ['id','api','build','device'])text(p[field]);
    assert.match(p.id,/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
    integer(p.quantization_nanos,0,Number.MAX_SAFE_INTEGER);integer(p.rate_ppm,0,999999);
    integer(p.max_age_nanos,1,Number.MAX_SAFE_INTEGER);digest(p.evidence_sha256);
    const key=JSON.stringify([row.version_code,row.version_name,p.api,p.build,p.device]);
    assert.ok(!seen.has(key),'duplicate qualified platform/release');seen.add(key);
  }
  return value;
}
export function compiledReviewedProviderReleases(bytes){
  const {releases}=parseReviewedProviderReleases(bytes);
  if(!releases.length)return HEADER+'        return new NativeProviderReleaseAdmission.Release[0];\n'+FOOTER;
  const entries=releases.map(r=>{
    const p=r.profile;
    return `                new NativeProviderReleaseAdmission.Release(${r.version_code}L, ${java(r.version_name)},\n`
      +`                    new NativeProviderTime.Profile(${java(p.id)}, new NativeProviderTime.Platform(${java(p.api)}, ${java(p.build)}, ${java(p.device)}),\n`
      +`                        ${p.quantization_nanos}L, ${p.rate_ppm}L, ${p.max_age_nanos}L, ${java(p.evidence_sha256)}),\n`
      +`                    ${java(r.backend_protocol_evidence_sha256)}, ${java(r.composition_evidence_sha256)})`;
  });
  return HEADER+'        try {\n            return new NativeProviderReleaseAdmission.Release[] {\n'+entries.join(',\n')
    +'\n            };\n        } catch (VaultFailure invalid) { throw new ExceptionInInitializerError(invalid); }\n'+FOOTER;
}
export function selectReviewedProviderRelease({policyBytes,compiledSource,audioPolicyBytes,audioCompiledSource,versionCode,versionName,required=false}){
  assert.equal(typeof required,'boolean');integer(versionCode,1,2100000000);text(versionName);
  const policy=parseReviewedProviderReleases(policyBytes);
  assert.equal(compiledSource,compiledReviewedProviderReleases(policyBytes),'reviewed JSON and compiled Java differ');
  const selected=policy.releases.filter(r=>r.version_code===versionCode&&r.version_name===versionName);
  if(!selected.length){assert.ok(!required,'qualified provider release inputs absent');return null;}
  // A clock-only FCM owner is still suspended by native audio admission.
  // Require the exact compiled companion before replacing any legacy owner.
  const audio=requirePairedProviderAudio({clockReleases:selected,audioPolicyBytes,audioCompiledSource});
  const ticket=Object.freeze({packageName:PROVIDER_PACKAGE,versionCode,versionName,profileCount:selected.length,
    policySha256:sha(policyBytes),compiledSha256:sha(compiledSource),audioProfileCount:audio.profileCount,
    audioPolicySha256:audio.policySha256,audioCompiledSha256:audio.compiledSha256,audioToneSha256:audio.toneSha256});
  tickets.add(ticket);return ticket;
}
export function readReviewedProviderRelease(pluginRoot,{versionCode,versionName,required=false}){
  const policy=join(pluginRoot,'android/src/provider-reviewed-releases.json');
  const compiled=join(pluginRoot,'android/src/main/java/org/memphiszoo/custodial/vault/NativeProviderReviewedReleases.java');
  const audioPolicy=join(pluginRoot,'android/src/provider-reviewed-audio-releases.json');
  const audioCompiled=join(pluginRoot,'android/src/main/java/org/memphiszoo/custodial/vault/NativeProviderReviewedAudioReleases.java');
  for(const path of [policy,compiled,audioPolicy,audioCompiled])assert.ok(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());
  const selected=selectReviewedProviderRelease({policyBytes:readFileSync(policy),compiledSource:readFileSync(compiled,'utf8'),audioPolicyBytes:readFileSync(audioPolicy),audioCompiledSource:readFileSync(audioCompiled,'utf8'),versionCode,versionName,required});
  if(selected){
    const tone=resolve(pluginRoot,'../../../memphis-alert-tone.wav');
    assert.ok(lstatSync(tone).isFile()&&!lstatSync(tone).isSymbolicLink());
    assert.equal(sha(readFileSync(tone)),selected.audioToneSha256,'reviewed audio tone differs from the shared source asset');
  }
  return selected;
}
export function isQualifiedProviderRelease(ticket){return !!ticket&&tickets.has(ticket);}
export const PROVIDER_MANIFEST_BLOCK=`        <!-- BEGIN qualified native provider owner -->
        <service android:name="${LEGACY_PROVIDER_SERVICES[0]}" tools:node="remove" />
        <service android:name="${LEGACY_PROVIDER_SERVICES[1]}" tools:node="remove" />
        <service android:name="${PROVIDER_SERVICE}" android:exported="false">
            <intent-filter><action android:name="${ACTION}" /></intent-filter>
        </service>
        <!-- END qualified native provider owner -->
`;
/** Operates only on the generated app manifest, never dependency manifests.
 * Default is byte-identical. Unknown/partial overrides are not repaired silently. */
export function configureProviderManifest(source,ticket){
  assert.equal(typeof source,'string');
  if(ticket!==null)assert.ok(isQualifiedProviderRelease(ticket),'unbound release ticket');
  assert.doesNotMatch(source,/<!DOCTYPE|<!ENTITY/);
  const hasBlock=source.includes(PROVIDER_MANIFEST_BLOCK);
  let plain=hasBlock?source.replace(PROVIDER_MANIFEST_BLOCK,''):source;
  assert.doesNotMatch(plain,/MESSAGING_EVENT|CustodialProviderMessagingService|firebase\.messaging\.FirebaseMessagingService|plugins\.firebase\.messaging\.MessagingService|qualified native provider owner/);
  assert.equal((plain.match(/<manifest\b/g)||[]).length,1);assert.equal((plain.match(/<application\b/g)||[]).length,1);
  assert.equal((plain.match(/<\/application>/g)||[]).length,1);
  if(ticket===null){assert.ok(!hasBlock,'cannot downgrade a qualified generated manifest silently');return source;}
  if(hasBlock)return source;
  const tag=plain.match(/<manifest\b[^>]*>/)?.[0];assert.ok(tag);
  if(/xmlns:tools=/.test(tag))assert.match(tag,/xmlns:tools="http:\/\/schemas.android.com\/tools"/);
  else plain=plain.replace(tag,tag.slice(0,-1)+' xmlns:tools="http://schemas.android.com/tools">');
  return plain.replace(/(?=\s*<\/application>)/,PROVIDER_MANIFEST_BLOCK);
}
export function inspectCompiledProviderOwner(manifestDump,ticket){
  assert.ok(isQualifiedProviderRelease(ticket),'qualified release required for compiled owner');
  const root=parseAaptXmlTree(manifestDump);assert.equal(root.name,'manifest');
  assert.equal(root.attributes.package,ticket.packageName);
  assert.equal(root.attributes['android:versionCode'],String(ticket.versionCode));
  assert.equal(root.attributes['android:versionName'],ticket.versionName);
  const apps=root.children.filter(n=>n.name==='application');assert.equal(apps.length,1);
  const services=apps[0].children.filter(n=>n.name==='service');
  for(const old of LEGACY_PROVIDER_SERVICES)assert.ok(!services.some(n=>n.attributes['android:name']===old),'legacy owner remains');
  const owners=services.filter(n=>n.children.some(f=>f.name==='intent-filter'&&f.children.some(a=>a.name==='action'&&a.attributes['android:name']===ACTION)));
  assert.equal(owners.length,1,'exactly one FCM SDK owner');const owner=owners[0];
  assert.deepEqual(owner,{name:'service',attributes:{'android:name':PROVIDER_SERVICE,'android:exported':'false'},text:[],children:[
    {name:'intent-filter',attributes:{},text:[],children:[{name:'action',attributes:{'android:name':ACTION},children:[],text:[]}]}]});
  assert.equal(services.filter(n=>n.attributes['android:name']===PROVIDER_SERVICE).length,1);
  return Object.freeze({owner:PROVIDER_SERVICE,profileCount:ticket.profileCount,policySha256:ticket.policySha256});
}
