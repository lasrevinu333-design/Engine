import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseDeterministicJson} from './custodial-capacitor-runtime-policy.mjs';
const PACKAGE='org.memphiszoo.custodial',sha=value=>createHash('sha256').update(value).digest('hex');
const keys=(v,want)=>{assert.ok(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...want].sort());};
const digest=v=>{assert.equal(typeof v,'string');assert.match(v,/^[a-f0-9]{64}$/);};
const integer=(v,min,max)=>assert.ok(Number.isSafeInteger(v)&&v>=min&&v<=max);
const text=v=>{assert.equal(typeof v,'string');assert.match(v,/^[\x20-\x21\x23-\x5b\x5d-\x7e]{1,512}$/);assert.equal(v.trim(),v);};
export function providerClockProfileFingerprint(p){
 keys(p,['id','api','build','device','quantization_nanos','rate_ppm','max_age_nanos','evidence_sha256']);
 for(const k of ['id','api','build','device'])text(p[k]);assert.match(p.id,/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
 integer(p.quantization_nanos,0,Number.MAX_SAFE_INTEGER);integer(p.rate_ppm,0,999999);integer(p.max_age_nanos,1,Number.MAX_SAFE_INTEGER);digest(p.evidence_sha256);
 // Exact NativeProviderTime.Profile.fingerprint(), not a new time owner.
 return sha([p.id,p.api,p.build,p.device,p.quantization_nanos,p.rate_ppm,p.max_age_nanos,p.evidence_sha256].join('\n'));
}
export function parseReviewedProviderAudioReleases(bytes){
 const value=parseDeterministicJson(bytes,'reviewed provider audio releases');
 keys(value,['schema','package_name','releases']);assert.equal(value.schema,'custodial.native-provider-reviewed-audio-releases.v1');assert.equal(value.package_name,PACKAGE);
 assert.ok(Array.isArray(value.releases)&&value.releases.length<=32);const seen=new Set();
 for(const row of value.releases){
  keys(row,['version_code','version_name','clock_fingerprint','backend_protocol_evidence_sha256','composition_evidence_sha256','policy']);
  integer(row.version_code,1,2100000000);text(row.version_name);assert.ok(row.version_name.length<=64);
  for(const k of ['clock_fingerprint','backend_protocol_evidence_sha256','composition_evidence_sha256'])digest(row[k]);
  const p=row.policy;keys(p,['engine','voice','rate_milli','tone_sha256','evidence_sha256']);
  assert.equal(typeof p.engine,'string');assert.match(p.engine,/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/);
  assert.equal(typeof p.voice,'string');assert.match(p.voice,/^[A-Za-z0-9][A-Za-z0-9_-]{0,179}$/);assert.equal(p.rate_milli,900);digest(p.tone_sha256);digest(p.evidence_sha256);
  const key=JSON.stringify([row.version_code,row.version_name,row.clock_fingerprint,row.backend_protocol_evidence_sha256,row.composition_evidence_sha256]);
  assert.ok(!seen.has(key),'duplicate paired audio release');seen.add(key);
 }
 return value;
}
const HEADER=`package org.memphiszoo.custodial.vault;

/** Deterministic compiled counterpart of provider-reviewed-audio-releases.json.
 * Source-only reviewed inputs; never preferences, HTTP, Intent or WebView data.
 * Hash bindings do not independently establish qualification or approval. */
final class NativeProviderReviewedAudioReleases {
    static NativeProviderAudioAdmission.Entry[] entries() {
`;
const FOOTER=`    }
    private NativeProviderReviewedAudioReleases() {}
}
`;
export function compiledReviewedProviderAudioReleases(bytes){
 const {releases}=parseReviewedProviderAudioReleases(bytes);
 if(!releases.length)return HEADER+'        return new NativeProviderAudioAdmission.Entry[0];\n'+FOOTER;
 const entries=releases.map(r=>{
  const p=r.policy,j=JSON.stringify;
  return `                new NativeProviderAudioAdmission.Entry(${r.version_code}L, ${j(r.version_name)}, ${j(r.clock_fingerprint)},\n`
   +`                    ${j(r.backend_protocol_evidence_sha256)}, ${j(r.composition_evidence_sha256)},\n`
   +`                    new NativeProviderAudioPolicy(${j(p.engine)}, ${j(p.voice)}, ${p.rate_milli}, ${j(p.tone_sha256)}, ${j(p.evidence_sha256)}))`;
 });
 return HEADER+'        try {\n            return new NativeProviderAudioAdmission.Entry[] {\n'+entries.join(',\n')
  +'\n            };\n        } catch (VaultFailure invalid) { throw new ExceptionInInitializerError(invalid); }\n'+FOOTER;
}
export function requirePairedProviderAudio({clockReleases,audioPolicyBytes,audioCompiledSource}){
 assert.ok(audioPolicyBytes!=null&&typeof audioCompiledSource==='string','qualified audio release inputs absent');
 const audio=parseReviewedProviderAudioReleases(audioPolicyBytes);
 assert.equal(audioCompiledSource,compiledReviewedProviderAudioReleases(audioPolicyBytes),'reviewed audio JSON and compiled Java differ');
 const selected=clockReleases.map(clock=>{
  const matches=audio.releases.filter(r=>r.version_code===clock.version_code&&r.version_name===clock.version_name
   &&r.clock_fingerprint===providerClockProfileFingerprint(clock.profile)&&r.backend_protocol_evidence_sha256===clock.backend_protocol_evidence_sha256
   &&r.composition_evidence_sha256===clock.composition_evidence_sha256);
  assert.equal(matches.length,1,'paired audio release inputs absent or ambiguous');return matches[0];
 });
 assert.ok(selected.length>0);assert.ok(selected.every(r=>r.policy.tone_sha256===selected[0].policy.tone_sha256),'paired audio release tone differs');
 return Object.freeze({profileCount:selected.length,policySha256:sha(audioPolicyBytes),compiledSha256:sha(audioCompiledSource),toneSha256:selected[0].policy.tone_sha256});
}
