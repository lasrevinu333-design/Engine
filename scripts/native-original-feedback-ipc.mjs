import assert from 'node:assert/strict';
import {constants} from 'node:fs';
import {mkdir,open,link,lstat,readFile,readdir,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const exact=(v,keys)=>{assert.ok(v&&Object.getPrototypeOf(v)===Object.prototype);assert.deepEqual(Object.keys(v).sort(),keys.slice().sort());};
const HEADER_KEYS=['X-Memphis-Native-Attestation-Version','X-Memphis-Native-Request-Id','X-Memphis-Native-Request-Timestamp','X-Memphis-Native-Request-Attestation'];
// This is a qualification-only boundary for the fixed synthetic successful
// profile/MESSAGE response set. Shipping native authorization deliberately
// scrubs and reserializes ordinary JSON; its returned bytes are the consumer's
// bytes, while the exact raw HTTP image has separate provenance. No unknown
// route, error response or value-changing scrub is accepted by this comparison.
export function assertKnownSyntheticResponseProjection({method,path,response,native}) {
 const feedback=method==='POST'&&path==='/feedback-api/submit';
 assert.ok(feedback,'unknown response projection route refused');
 assert.ok(response.status>=200&&response.status<300,'non-success response projection refused');
 exact(native,['status','body_base64','body_sha256','headers','raw_http_body_base64','raw_http_body_sha256']);
 assert.equal(native.status,response.status);let raw,projected;
 try {
  raw=Buffer.from(native.raw_http_body_base64,'base64');projected=Buffer.from(native.body_base64,'base64');
  assert.equal(raw.toString('base64'),native.raw_http_body_base64);assert.equal(projected.toString('base64'),native.body_base64);
  assert.equal(native.raw_http_body_sha256,sha(raw),'raw HTTP self digest changed');
  assert.equal(native.raw_http_body_sha256,sha(response.body),'actual Connection raw HTTP digest changed');
  assert.ok(raw.equals(response.body),'actual Connection raw HTTP bytes changed');
  assert.equal(native.body_sha256,sha(projected),'actual native authorized body digest changed');
  const parse=bytes=>{
   const source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   // Finite synthetic response scope contains canonical safe integers only.
   // Scan before JSON.parse: parsing first could round an exponent/fraction
   // to an integer and hide a native projection change. Quoted/escaped text
   // is consumed as one token and never interpreted as numeric metadata.
   for(const [token] of source.matchAll(/"(?:\\.|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
    if(token.startsWith('"'))continue;
    assert.ok(/^(?:0|-?[1-9]\d*)$/.test(token)&&Number.isSafeInteger(Number(token)),
     'noncanonical or unsafe synthetic response number token refused');
   }
   const value=JSON.parse(source);
   exact(value,['ok','data','meta']);assert.equal(value.ok,true);assert.ok(value.meta&&typeof value.meta==='object');
   assert.ok(value.data&&typeof value.data==='object');assert.ok(value.data.item&&typeof value.data.item==='object');
   assert.equal(value.meta.contract_version,'feedback.v3.enrolled-authority');
   const numeric=x=>{if(typeof x==='number')assert.ok(Number.isSafeInteger(x),'synthetic response numeric scope exceeded');
    else if(x&&typeof x==='object')for(const child of Object.values(x))numeric(child);};numeric(value);return value;
  };
  assert.deepEqual(parse(projected),parse(raw),'native projection changed synthetic no-secret response values');
  return {raw_http_response_sha256:native.raw_http_body_sha256,native_response_sha256:native.body_sha256};
 } finally {raw?.fill(0);projected?.fill(0);}
}
// NEW normal IPC recipe, never old launcher05/07 files. This helper does NOT
// launch a process. Its owner must start only the freshly compiled named Java
// leaf against this exact NEW directory and settle that child in its finally.
export async function createNativeFeedbackIpc({directory,fixture}) {
 const root=resolve(directory);await mkdir(root,{mode:0o700});
 const stat=await lstat(root);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal(stat.uid,process.getuid());
 assert.equal(stat.mode&0o777,0o700);assert.equal(await realpath(root),root);assert.deepEqual(await readdir(root),[]);
 let next=1,busy=false,terminal=false;const transcript=[];
 async function publish(name,value){const bytes=Buffer.from(JSON.stringify(value));let handle;
  try{handle=await open(join(root,name+'.part'),constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
   await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;await link(join(root,name+'.part'),join(root,name));
   const reopened=await bounded(name);try{assert.ok(reopened.equals(bytes));}finally{reopened.fill(0);}
  }finally{if(handle)await handle.close();bytes.fill(0);}}
 async function bounded(name){const path=join(root,name),a=await lstat(path);assert.ok(a.isFile()&&!a.isSymbolicLink());
  assert.equal(a.uid,process.getuid());assert.equal(a.mode&0o777,0o600);assert.ok(a.size>0&&a.size<=1500000);
  const bytes=await readFile(path),b=await lstat(path);assert.equal(a.ino,b.ino);assert.equal(a.dev,b.dev);assert.equal(a.size,bytes.length);assert.equal(b.size,bytes.length);assert.equal(a.mtimeMs,b.mtimeMs);return bytes;}
 async function wait(name){const start=process.hrtime.bigint();while(true){try{return await bounded(name);}catch(error){if(error.code!=='ENOENT')throw error;}
   assert.ok(process.hrtime.bigint()-start<40_000_000_000n,'IPC UNKNOWN: do not repeat original');await new Promise(r=>setTimeout(r,5));}}
 async function json(name){const bytes=await wait(name);try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}finally{bytes.fill(0);}}
 return Object.freeze({directory:root,
  async ready(){const value=await json('READY.json');exact(value,['schema']);assert.equal(value.schema,'custodial.native-feedback-source-ready.v1');},
  async getState(){assert.equal(terminal,false);assert.equal(busy,false);busy=true;
   const index=next++;assert.ok(index<=127);const stem=String(index).padStart(3,'0');
   try{await publish(stem+'_REQUEST.json',{state:true});return await json(stem+'_STATE.json');}
   catch(error){terminal=true;throw error;}finally{busy=false;}
  },
  async authorizedRequest(input){assert.equal(terminal,false);assert.equal(busy,false,'one normal native caller at a time');busy=true;
   const index=next++;assert.ok(index<=127);const stem=String(index).padStart(3,'0');
   exact(input,['method','path','body_base64','headers']);const original={...input,headers:{...input.headers}};exact(input.headers,['content-type','idempotency-key']);
   if(input.method!=='GET')assert.equal(input.headers['content-type'],'application/json');let body,response;
   try{body=Buffer.from(original.body_base64,'base64');assert.equal(body.toString('base64'),original.body_base64);assert.ok((input.method==='GET'?body.length===0:body.length>0)&&body.length<=30000);
    await publish(stem+'_REQUEST.json',original);
    const loan=await json(stem+'_LOAN.json');exact(loan,['schema','method','path','exactRequestBytesBase64','nativeHeaders','idempotencyKey']);
    assert.equal(loan.schema,'custodial.native-feedback-request-loan.v1');assert.equal(loan.path,original.path);assert.equal(loan.method,original.method);assert.equal(loan.exactRequestBytesBase64,original.body_base64);exact(loan.nativeHeaders,HEADER_KEYS);assert.equal(loan.idempotencyKey,original.headers['idempotency-key']);assert.equal(loan.idempotencyKey,JSON.parse(body.toString('utf8')).operation_id);
    response=await fixture.exchange({method:loan.method,path:loan.path,exactRequestBytes:body,nativeHeaders:loan.nativeHeaders,idempotencyKey:loan.idempotencyKey});
    await publish(stem+'_HTTP.json',{status:response.status,body_base64:response.body.toString('base64'),headers:response.headers});
    const native=await json(stem+'_NATIVE.json');
    const projection=assertKnownSyntheticResponseProjection({method:original.method,path:original.path,response,native});
    assert.equal(new Headers(native.headers).get('content-type'),response.headers['Content-Type']);
    assert.equal(input.path,original.path);assert.equal(input.method,original.method);assert.deepEqual(input.headers,original.headers);assert.equal(input.body_base64,original.body_base64);
    transcript.push({index,path:original.path,status:native.status,request_sha256:sha(body),response_sha256:native.body_sha256,...projection});
    return {status:native.status,body_base64:native.body_base64,headers:native.headers};
   }catch(error){terminal=true;throw error;}finally{body?.fill(0);response?.body?.fill(0);busy=false;}
  },
  async finish(){assert.equal(terminal,false);assert.equal(busy,false);terminal=true;
   await publish(String(next).padStart(3,'0')+'_REQUEST.json',{finish:true});const result=await json('COMPLETE.json');
   exact(result,['exchanges','scope']);assert.equal(result.exchanges,next-1);assert.equal(result.scope,'SOURCE_ENGINE_SIGNER_NOT_ANDROID_OR_TLS');
   return {native:result,transcript:[...transcript]};},
 });
}
