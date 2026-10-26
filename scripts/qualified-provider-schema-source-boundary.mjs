import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeCurrentNativeAudioSequence} from './native-audio-sequence-source-boundary.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function validateQualifiedProviderSchemaPins(value){assert.equal(sha(JSON.stringify(value)),'42a8a2045909c93473f0666cd565cf6622850c6b08c21a6cbb1266fe3a0e0731','exact qualified-provider schema delta');return value;}
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
export const qualifiedProviderSchemaPins=freeze(validateQualifiedProviderSchemaPins(JSON.parse(readFileSync(new URL('./fixtures/qualified-provider-schema-byte-delta.json',import.meta.url),'utf8'))));
export function withoutQualifiedProviderSchema(path,source){
 source=normalizeCurrentNativeAudioSequence(path,source);
 const p=qualifiedProviderSchemaPins;if(path!==p.path)return source;if(sha(source)===p.prior_sha256)return source;
 assert.equal(sha(source),p.current_sha256,'whole exact qualified-provider acceptance schema');
 const lines=source.split('\n');for(const h of [...p.hunks].reverse()){
  const index=h.new_count===0?h.new_start:h.new_start-1;assert.deepEqual(lines.slice(index,index+h.new_count),h.after);lines.splice(index,h.new_count,...h.before);
 }
 const prior=lines.join('\n');assert.equal(sha(prior),p.prior_sha256,'all previous schema checks preserved');return prior;
}
