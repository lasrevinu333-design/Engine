import {createHash} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,lstatSync,openSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {dirname,isAbsolute,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCustodialCustodyEvidencePackage,loadTrustedInputsFile,summarizeCustodialCustodyReadiness} from './custodial-custody-evidence-package.mjs';

const SHA=/^[a-f0-9]{64}$/,COMMIT=/^[a-f0-9]{40}$/,REF=/^refs\/heads\/[A-Za-z0-9._/-]+$/,
 hash=b=>createHash('sha256').update(b).digest('hex'),
 fail=m=>{throw new Error('Custodial PREBUILD_SOURCE evidence: '+m);},
 sourceFiles=['custodial-prebuild-custody-consumer.mjs','custodial-custody-evidence-package.mjs','custodial-owner-receipt-adapter.mjs'],
 inspectedEvidence=new WeakSet();

export function parsePrebuildCustodySourceArguments(args) {
  const names=['--prebuild-custody-package','--receipt-root','--trusted-inputs','--trusted-inputs-sha256','--output'],values=Object.create(null);
  if(!Array.isArray(args)||args.length!==names.length*2)fail('exact five source-only argument/value pairs are required; artifact arguments are not allowed');
  for(let i=0;i<args.length;i+=2){const name=args[i],value=args[i+1];
    if(!names.includes(name)||Object.hasOwn(values,name)||typeof value!=='string'||!value.trim()||value.startsWith('--'))fail('unknown, repeated or incomplete source-only argument');
    values[name]=value;
  }
  if(!names.every(n=>Object.hasOwn(values,n))||!SHA.test(values['--trusted-inputs-sha256']))fail('complete source-only paths and independent trust SHA256 are required');
  return Object.freeze({packagePath:values['--prebuild-custody-package'],allowedReceiptRoot:values['--receipt-root'],
    trustedInputsPath:values['--trusted-inputs'],trustedInputsSha256:values['--trusted-inputs-sha256'],outputPath:values['--output']});
}

function regularFile(p,label){
  if(typeof p!=='string'||!p.trim())fail(label+' path is required');
  const absolute=resolve(p),st=lstatSync(absolute);
  if(!st.isFile()||st.isSymbolicLink()||realpathSync(absolute)!==absolute)fail(label+' must be one regular non-symlink file');
  return absolute;
}

// Source-only evidence. Neither this API nor its result may admit a candidate,
// select versions, verify an APK, call a writer, or grant custody/key authority.
export function inspectCustodialPrebuildCustodyEvidence({
  packagePath,allowedReceiptRoot,trustedInputsPath,trustedInputsSha256,expectedFrontendSource,expectedSignerPins,normalVerifierSourceSha256,
}){
  if(!expectedFrontendSource||Object.keys(expectedFrontendSource).sort().join(',')!=='commit,ref,tree'
      ||!COMMIT.test(expectedFrontendSource.commit)||!COMMIT.test(expectedFrontendSource.tree)||!REF.test(expectedFrontendSource.ref))fail('the owning normal verifier must supply its observed exact clean frontend tuple');
  if(!SHA.test(normalVerifierSourceSha256)||!SHA.test(trustedInputsSha256))fail('normal verifier and independent trust source hashes are required');
  if(!expectedSignerPins||Object.keys(expectedSignerPins).sort().join(',')!=='package_name,signer_certificate_sha256,signer_public_key_sha256'
      ||expectedSignerPins.package_name!=='org.memphiszoo.custodial'
      ||!SHA.test(expectedSignerPins.signer_certificate_sha256)||!SHA.test(expectedSignerPins.signer_public_key_sha256))fail('the owning normal verifier must supply its pinned public package/signer controls');
  const source=Object.freeze({...expectedFrontendSource}),absolute=regularFile(packagePath,'package'),bytes=readFileSync(absolute),packageSha256=hash(bytes);
  let candidate;try{candidate=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('package JSON/UTF8 is malformed');}
  if(candidate?.phase!=='PREBUILD_SOURCE'||candidate.candidate!==null||candidate.recovery!==null)fail('this mode accepts PREBUILD_SOURCE with no candidate or recovery artifact; use normal artifact admission separately');
  // The expected hash pins exactly the inspected source-phase bytes before
  // any descriptor/file processing. A changed package is refused, not reread
  // under a different phase or given artifact authority.
  const trusted=loadTrustedInputsFile(trustedInputsPath,trustedInputsSha256);
  if(['commit','tree','ref'].some(k=>source[k]!==trusted.source_pair.frontend[k]))fail('trusted frontend tuple does not match the owning current clean source');
  if(['package_name','signer_certificate_sha256','signer_public_key_sha256'].some(k=>expectedSignerPins[k]!==trusted.signer_pins[k]))fail('trusted signer controls do not match the owning normal verifier');
  const loaded=loadCustodialCustodyEvidencePackage({packagePath:absolute,allowedReceiptRoot,
    trustedSourcePair:trusted.source_pair,trustedBaseline:trusted.installed_baseline,trustedSignerPins:trusted.signer_pins,
    trustedReceipts:trusted.trusted_receipts,expectedPackageSha256:packageSha256});
  if(loaded.package.phase!=='PREBUILD_SOURCE'||loaded.package.candidate!==null||loaded.package.recovery!==null)fail('source package phase changed');
  const summary=summarizeCustodialCustodyReadiness(loaded,trusted),moduleDirectory=dirname(fileURLToPath(import.meta.url));
  const evidence=Object.freeze({schema:'custodial.android-prebuild-custody-evidence.v1',phase:'PREBUILD_SOURCE',
    state:'SOURCE_COMPONENT_EVIDENCE_ONLY_NOT_ARTIFACT_INSTALL_OR_OPERATIONAL_ADMISSION',
    observed_frontend_source:source,trusted_source_pair:loaded.trusted.source_pair,
    package_sha256:packageSha256,trusted_inputs_sha256:trustedInputsSha256,normal_verifier_source_sha256:normalVerifierSourceSha256,
    consumer_sources:Object.freeze(sourceFiles.map(name=>Object.freeze({name,sha256:hash(readFileSync(resolve(moduleDirectory,name)))}))),
    summary,baseline_artifact_verified:false,backend_runtime_verified:false,artifact_admitted:false,installation_admitted:false,physical_verified:false,
    operationally_qualified:false,inventory_acknowledged:false,resend_allowed:false,finalizer_allowed:false,key_removal:false});
  inspectedEvidence.add(evidence);
  return evidence;
}

export function writeCustodialPrebuildCustodyEvidence(outputPath,evidence,frontendRoot){
  if(!inspectedEvidence.has(evidence)||evidence?.schema!=='custodial.android-prebuild-custody-evidence.v1'||evidence.phase!=='PREBUILD_SOURCE'
      ||['baseline_artifact_verified','backend_runtime_verified','artifact_admitted','installation_admitted','physical_verified','operationally_qualified',
        'inventory_acknowledged','resend_allowed','finalizer_allowed','key_removal'].some(k=>evidence[k]!==false))fail('only source evidence with exact-false operational authority may be written');
  const output=resolve(outputPath),source=realpathSync(resolve(frontendRoot)),rel=relative(source,output);
  if(rel===''||!(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)))fail('source evidence output must be outside the clean frontend checkout');
  if(existsSync(output))fail('output must be a new file; existing files are never overwritten');
  const parent=dirname(output),st=lstatSync(parent);
  if(!st.isDirectory()||st.isSymbolicLink()||realpathSync(parent)!==parent)fail('output parent must be an existing non-symlink directory');
  const bytes=JSON.stringify(evidence,null,2)+'\n',fd=openSync(output,'wx',0o600);
  try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
  if(readFileSync(output,'utf8')!==bytes)fail('output readback differs');
  const dirfd=openSync(parent,'r');try{fsyncSync(dirfd);}finally{closeSync(dirfd);}
  return Object.freeze({path:output,bytes:Buffer.byteLength(bytes),sha256:hash(Buffer.from(bytes))});
}
