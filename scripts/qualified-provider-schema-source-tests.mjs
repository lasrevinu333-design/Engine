import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {qualifiedProviderSchemaPins as p,validateQualifiedProviderSchemaPins,withoutQualifiedProviderSchema} from './qualified-provider-schema-source-boundary.mjs';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');let checks=0;
const current=normalizeCurrentNativeAudioSequence(p.path,readFileSync(new URL('../'+p.path,import.meta.url),'utf8'));assert.equal(sha(current),p.current_sha256);checks++;
const prior=withoutQualifiedProviderSchema(p.path,current);assert.equal(sha(prior),p.prior_sha256);checks++;
assert.equal(withoutQualifiedProviderSchema(p.path,prior),prior);checks++;
assert.match(current,/exact-custodial-android-manifest-v10-qualified-provider/);checks++;
assert.match(current,/\"verifier_version\": \{ \"const\": \"1.8.0\" \}/);checks++;
assert.match(current,/org.memphiszoo.custodial.vault.CustodialProviderMessagingService/);checks++;
assert.doesNotMatch(current,/\{ \"const\": \"io.capawesome.capacitorjs.plugins.firebase.messaging.MessagingService\" \}/);checks++;
for(const hostile of [current+' ',current.slice(1),current.replace('1.8.0','1.7.0')]){assert.throws(()=>withoutQualifiedProviderSchema(p.path,hostile));checks++;}
for(const mutate of [x=>x.extra=true,x=>x.hunks.pop(),x=>x.current_sha256='a'.repeat(64),x=>x.prior_sha256='b'.repeat(64)]){const hostile=structuredClone(p);mutate(hostile);assert.throws(()=>validateQualifiedProviderSchemaPins(hostile));checks++;}
console.log(JSON.stringify({status:'QUALIFIED_PROVIDER_SCHEMA_SOURCE_PASS',checks,apk:false,manifest_activated:false}));
