#!/usr/bin/env node
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lstat,mkdir,writeFile,readFile} from 'node:fs/promises';
import {prepareCustodialNotificationWriterSources} from './custodial-local-notification-writers.mjs';
// Explicit normal Source preparation only. No app build/sign/install/device or
// key/principal/admission operation occurs here. Unknown output is preserved.
if(process.argv.length!==2)throw Error('No caller selection or authority input accepted');
const mobileRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repositoryRoot=resolve(mobileRoot,'..');
const directory=join(mobileRoot,'android');
try {const stat=await lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Normal staging parent unavailable');}
catch(error){if(error.code!=='ENOENT')throw error;await mkdir(directory,{recursive:false,mode:0o700});}
const result=await prepareCustodialNotificationWriterSources({repositoryRoot,mobileRoot});
const path=join(directory,'.custodial-notification-runtime-source.json'),bytes=JSON.stringify(result,null,2)+'\n';
try {await writeFile(path,bytes,{flag:'wx',mode:0o600});}
catch(error){if(error.code!=='EEXIST')throw error;const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||await readFile(path,'utf8')!==bytes)throw Error('Prior normal notification selection differs; preserve it');}
console.log(JSON.stringify({schema:result.schema,version:result.version,source_binding_sha256:result.source_binding_sha256,class_count:Object.keys(result.class_files_sha256).length,native_receipt_authority:false}));
