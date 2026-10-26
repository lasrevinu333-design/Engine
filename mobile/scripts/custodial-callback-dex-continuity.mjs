import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DexSemanticReader,inspectCustodialNewProducerScopeDexSemantics} from './verify-custodial-dex-semantics.mjs';

// This is a comparison of TWO actual compiled byte sets, never a compiler receipt.
// Reference acquisition/source authority is a separate mandatory private admission.
// Unsupported encodings/optimizer shapes refuse; they are not equal-by-omission.
const NONE=0xffffffff;
const comparisonProofs=new WeakSet();
const hash=b=>createHash('sha256').update(b).digest('hex');
const native='Lorg/memphiszoo/custodial/vault/CustodialNativeVaultPlugin;';
const local='Lcom/capacitorjs/plugins/localnotifications/LocalNotificationsPlugin;';
const firebase='Lio/capawesome/capacitorjs/plugins/firebase/messaging/FirebaseMessagingPlugin;';
const families=['org/memphiszoo/custodial/vault','com/capacitorjs/plugins/localnotifications','io/capawesome/capacitorjs/plugins/firebase/messaging'];
const scopes=families.map(x=>'L'+x+'/CustodialNewProducerScope;');
const publicGuards=new Map([[local,new Set(['schedule','requestPermissions','changeExactNotificationSetting','createChannel','registerActionTypes'])],[firebase,new Set(['getToken','subscribeToTopic','requestPermissions','createChannel'])]]);
const helperNames=new Map([[local,'admitNewProducerCall'],[firebase,'admitNewProducerCall'],[native,'newProducerAdmissionsEnabled']]);
const key=m=>m.owner+'->'+m.name+m.descriptor;
function equal(a,b,label){assert.deepEqual(a,b,'Compiled original continuity differs: '+label);}
class ContinuityReader extends DexSemanticReader {
 constructor(bytes,label){super(bytes,label);this.fieldCount=this.u4(80);this.fieldOffset=this.u4(84);this.table(this.fieldOffset,this.fieldCount,8,'field IDs');
  assert.equal(this.u4(44),0,'Unsupported linked DEX');assert.equal(this.u4(48),0,'Unsupported linked DEX');const dataSize=this.u4(104),dataOff=this.u4(108),mapOff=this.u4(52);assert.ok(dataOff%4===0&&dataOff>=112&&dataOff+dataSize===this.bytes.length&&mapOff>=dataOff&&mapOff%4===0);const count=this.u4(mapOff);assert.ok(count>0&&count<=32);this.table(mapOff+4,count,12,'DEX map');const items=new Map(),known=new Set([0,1,2,3,4,5,6,0x1000,0x1001,0x1002,0x1003,0x2000,0x2001,0x2002,0x2003,0x2004,0x2005,0x2006]);let previous=-1;
  for(let j=0;j<count;j++){const o=mapOff+4+12*j,t=this.u2(o),reserved=this.u2(o+2),size=this.u4(o+4),at=this.u4(o+8);assert.ok(known.has(t),'Unsupported DEX map kind: HOLD');assert.ok(reserved===0&&size>0&&at>previous&&at<this.bytes.length&&!items.has(t),'Malformed DEX map');previous=at;items.set(t,{size,at});}
  const expected=[[0,1,0],[1,this.stringCount,this.stringOffset],[2,this.typeCount,this.typeOffset],[3,this.protoCount,this.protoOffset],[4,this.fieldCount,this.fieldOffset],[5,this.methodCount,this.methodOffset],[6,this.classCount,this.classOffset],[0x1000,1,mapOff],[0x2002,this.stringCount,null]];
  for(const [kind,size,at]of expected){if(!size)assert.ok(!items.has(kind));else{assert.ok(items.has(kind),'Missing DEX map section');assert.equal(items.get(kind).size,size);if(at!==null)assert.equal(items.get(kind).at,at);}}
 }
 string(i){assert.ok(Number.isSafeInteger(i)&&i>=0&&i<this.stringCount);if(this.stringCache.has(i))return this.stringCache.get(i);const off=this.u4(this.stringOffset+4*i),len=this.uleb(off),chars=[];let p=len.next;const end=Math.min(this.bytes.length,p+4*1024*1024+1);while(true){assert.ok(p<end,'MUTF8 bound');const a=this.u1(p++);if(a===0)break;let v;if(a<0x80)v=a;else if((a&0xe0)===0xc0){assert.ok(p<end);const b=this.u1(p++);assert.equal(b&0xc0,0x80);v=((a&31)<<6)|(b&63);assert.ok(v>=0x80||(a===0xc0&&b===0x80));}else if((a&0xf0)===0xe0){assert.ok(p+1<end);const b=this.u1(p++),c=this.u1(p++);assert.equal(b&0xc0,0x80);assert.equal(c&0xc0,0x80);v=((a&15)<<12)|((b&63)<<6)|(c&63);assert.ok(v>=0x800);}else throw Error('Invalid MUTF8');chars.push(v);assert.ok(chars.length<=len.value);}assert.equal(chars.length,len.value);let v='';for(let j=0;j<chars.length;j+=8192)v+=String.fromCharCode(...chars.slice(j,j+8192));this.stringCache.set(i,v);return v;}
 method(i){const m=super.method(i);return {...m,owner:this.type(m.classIndex)};}
 field(i){assert.ok(Number.isSafeInteger(i)&&i>=0&&i<this.fieldCount,'field index');const o=this.fieldOffset+8*i;return {owner:this.type(this.u2(o)),type:this.type(this.u2(o+2)),name:this.string(this.u4(o+4))};}
 signedLeb(o){let n=0n,s=0n,b;for(let i=0;i<5;i++){b=this.u1(o++);n|=BigInt(b&127)<<s;s+=7n;if(!(b&128)){if(b&64)n|=(-1n)<<s;assert.ok(n>=-2147483648n&&n<=2147483647n);return {value:Number(n),next:o};}}throw Error('Malformed signed LEB');}
 // Preserve the complete typed value. Every reference is resolved, not retained
 // as a DEX-local number. Width/sign rules follow the encoded_value format.
 value(o,depth=0){assert.ok(depth<=32);const h=this.u1(o++),t=h&31,a=h>>>5;let n=0n;
  if([0,2,3,4,6,16,17,21,22,23,24,25,26,27].includes(t)){
   const max=({0:1,2:2,3:2,4:4,6:8,16:4,17:8,21:4,22:4,23:4,24:4,25:4,26:4,27:4})[t];assert.ok(a+1<=max);
   for(let i=0;i<=a;i++)n|=BigInt(this.u1(o++))<<BigInt(i*8);
   const ix=()=>{assert.ok(n<=BigInt(Number.MAX_SAFE_INTEGER));return Number(n);};let v;
   if(t===23)v=this.string(ix());else if(t===24)v=this.type(ix());else if(t===25||t===27)v=this.field(ix());else if(t===26){const m=this.method(ix());v={owner:m.owner,name:m.name,descriptor:m.descriptor};}
   else if(t===21)v=this.proto(ix());else if(t===22)throw Error('Unsupported method-handle encoded value: HOLD');
   else if(t===16||t===17)v=(n<<BigInt((max-a-1)*8)).toString(16);
   else{if(t!==3&&(n&(1n<<BigInt((a+1)*8-1))))n|=(-1n)<<BigInt((a+1)*8);v=n.toString();}
   return {value:{type:t,value:v},next:o};
  }
  if(t===28){assert.equal(a,0);let q=this.uleb(o);o=q.next;this.boundedVariableCount(q.value,o,1,'array values');const v=[];for(let i=0;i<q.value;i++){const x=this.value(o,depth+1);o=x.next;v.push(x.value);}return {value:{type:t,value:v},next:o};}
  if(t===29){assert.equal(a,0);const x=this.annotation(o,depth+1);return {value:{type:t,value:x.value},next:x.next};}
  if(t===30){assert.equal(a,0);return {value:{type:t,value:null},next:o};}
  if(t===31){assert.ok(a<=1);return {value:{type:t,value:!!a},next:o};}throw Error('Unknown encoded value: HOLD');
 }
 annotation(o,depth=0){let q=this.uleb(o);const type=this.type(q.value);q=this.uleb(q.next);o=q.next;const elements=[];let previous=-1;for(let i=0;i<q.value;i++){const n=this.uleb(o);assert.ok(n.value>previous);previous=n.value;const v=this.value(n.next,depth+1);o=v.next;elements.push([this.string(n.value),v.value]);}return {value:{type,elements},next:o};}
 annotations(o){if(!o)return [];const n=this.u4(o);this.table(o+4,n,4,'annotation set');const out=[],seen=new Set();for(let i=0;i<n;i++){const p=this.u4(o+4+4*i),visibility=this.u1(p);assert.ok(visibility<=2);const v=this.annotation(p+1).value;assert.ok(!seen.has(v.type));seen.add(v.type);out.push({visibility,...v});}return out.sort((a,b)=>a.type<b.type?-1:a.type>b.type?1:0);}
 annotationDirectory(o){const out={class:[],fields:new Map(),methods:new Map(),parameters:new Map()};if(!o)return out;out.class=this.annotations(this.u4(o));const counts=[this.u4(o+4),this.u4(o+8),this.u4(o+12)];this.table(o+16,counts.reduce((a,b)=>a+b,0),8,'annotation directory');let p=o+16;
  for(let group=0;group<3;group++){let prev=-1;for(let j=0;j<counts[group];j++,p+=8){const i=this.u4(p),off=this.u4(p+4);assert.ok(i>prev);prev=i;const target=group===0?JSON.stringify(this.field(i)):key(this.method(i));const map=group===0?out.fields:group===1?out.methods:out.parameters;assert.ok(!map.has(target));if(group<2)map.set(target,this.annotations(off));else{const n=this.u4(off);this.table(off+4,n,4,'parameter annotation list');const v=[];for(let k=0;k<n;k++)v.push(this.annotations(this.u4(off+4+4*k)));map.set(target,v);}}}return out;
 }
 data(o){const out={staticFields:[],instanceFields:[],direct:[],virtual:[]};if(!o)return out;const counts=[];for(let i=0;i<4;i++){const q=this.uleb(o);o=q.next;counts.push(q.value);}
  for(let g=0;g<4;g++){let previous=0;for(let j=0;j<counts[g];j++){const d=this.uleb(o);o=d.next;assert.ok(j===0||d.value>0);previous+=d.value;const a=this.uleb(o);o=a.next;const v={index:previous,access:a.value};if(g>=2){const c=this.uleb(o);o=c.next;v.code=c.value;}out[['staticFields','instanceFields','direct','virtual'][g]].push(v);}}return out;
 }
 classesFull(){const out=new Map();for(let i=0;i<this.classCount;i++){const o=this.classOffset+i*32,descriptor=this.type(this.u4(o));assert.ok(!out.has(descriptor));const si=this.u4(o+8),io=this.u4(o+12),sf=this.u4(o+16),ao=this.u4(o+20),d=this.data(this.u4(o+24)),sv=this.u4(o+28);const interfaces=[];if(io){const n=this.u4(io);this.table(io+4,n,2,'interfaces');for(let j=0;j<n;j++)interfaces.push(this.type(this.u2(io+4+j*2)));}assert.equal(new Set(interfaces).size,interfaces.length);
   const values=[];if(sv){const q=this.uleb(sv);let p=q.next;assert.ok(q.value<=d.staticFields.length);for(let j=0;j<q.value;j++){const v=this.value(p);p=v.next;values.push(v.value);}}
   const fields=[...d.staticFields.map((x,j)=>({...this.field(x.index),access:x.access,static:true,initial:j<values.length?values[j]:{implicitDefault:true}})),...d.instanceFields.map(x=>({...this.field(x.index),access:x.access,static:false}))];for(const x of fields)assert.equal(x.owner,descriptor);
   const methods=[...d.direct.map(x=>({...x,direct:true})),...d.virtual.map(x=>({...x,direct:false}))];for(const x of methods)assert.equal(this.method(x.index).owner,descriptor);assert.equal(new Set(methods.map(x=>key(this.method(x.index)))).size,methods.length);
   out.set(descriptor,{descriptor,access:this.u4(o+4),superclass:si===NONE?null:this.type(si),interfaces,sourceFile:sf===NONE?null:this.string(sf),fields,methods,annotations:this.annotationDirectory(ao),reader:this});}return out;
 }
 instructions(code){const head=this.methodCode(code),base=code+16,u=at=>{assert.ok(at>=0&&at<head.instructionCount);return this.u2(base+2*at);},rows=[];let at=0;
  while(at<head.instructionCount){const word=u(at),op=word&255;let n;
   if(op===0){if(word===0)n=1;else if(word===0x100)n=4+2*u(at+1);else if(word===0x200)n=2+4*u(at+1);else if(word===0x300)n=4+Math.ceil(u(at+1)*this.u4(base+2*(at+2))/2);else throw Error('Unknown payload');}
   else if([1,4,7,10,11,12,13,14,15,16,17,18,29,30,33,39,40].includes(op)||(op>=0x7b&&op<=0x8f)||(op>=0xb0&&op<=0xcf))n=1;
   else if([2,5,8,0x13,0x15,0x16,0x19,0x1a,0x1c,0x1f,0x20,0x22,0x23,0x29].includes(op)||(op>=0x2d&&op<=0x3d)||(op>=0x44&&op<=0x6d)||(op>=0x90&&op<=0xaf)||(op>=0xd0&&op<=0xe2))n=2;
   else if([3,6,9,0x14,0x17,0x1b,0x24,0x25,0x26,0x2a,0x2b,0x2c].includes(op)||(op>=0x6e&&op<=0x72)||(op>=0x74&&op<=0x78))n=3;
   else if(op===0x18)n=5;else throw Error('Unsupported DEX instruction '+op.toString(16)+': HOLD');
   assert.ok(Number.isSafeInteger(n)&&n>0&&at+n<=head.instructionCount);rows.push({at,op,n,words:Array.from({length:n},(_,j)=>u(at+j))});at+=n;
  }return {head,rows,u,base};
 }
}
function sortedMap(m){return [...m].sort(([a],[b])=>a<b?-1:a>b?1:0);}
function collect(entries){assert.ok(Array.isArray(entries)&&entries.length);const classes=new Map(),digests={};let previous='';for(const e of entries){const name=e.name,input=e.bytes;assert.ok(/^classes(?:[2-9]|[1-9][0-9]+)?\.dex$/.test(name)&&name>previous);previous=name;assert.ok(Buffer.isBuffer(input)||input instanceof Uint8Array);const bytes=Buffer.from(input);assert.ok(bytes.length);digests[name]=hash(bytes);const r=new ContinuityReader(bytes,name);for(const [d,c]of r.classesFull()){assert.ok(!classes.has(d),'Duplicate actual class '+d);classes.set(d,c);}}assert.ok(classes.size);const size=Object.keys(digests).length;assert.ok(size<=16);for(let i=1;i<=size;i++)assert.ok(Object.hasOwn(digests,i===1?'classes.dex':`classes${i}.dex`),'Noncontiguous actual DEX census');return {classes,digests};}
function callable(r,row){const m=r.method(row.words[1]);return key(m);}
function s16(v){return v&0x8000?v-0x10000:v;}
function s32(lo,hi){return (lo|hi<<16)|0;}
function methodGraph(c,m,stripCandidateGuards){const r=c.reader,mi=r.method(m.index),id=key(mi),publicPrefix=stripCandidateGuards&&publicGuards.get(c.descriptor)?.has(mi.name)&&mi.descriptor==='(Lcom/getcapacitor/PluginCall;)V';if(!m.code){assert.ok(m.access&(0x100|0x400),'Nonabstract/nonnative method lacks code');return {access:m.access,direct:m.direct,code:null};}assert.equal(m.access&(0x100|0x400),0,'Abstract/native method contains code');const {head,rows,u,base}=r.instructions(m.code),remove=new Set();
 if(publicPrefix){
  assert.ok(rows[0].at===0&&[0x70,0x76].includes(rows[0].op));assert.equal(callable(r,rows[0]),c.descriptor+'->admitNewProducerCall(Lcom/getcapacitor/PluginCall;)Z');assert.equal(rows[1].at,3);assert.equal(rows[1].op,0x0a);assert.equal(rows[2].at,4);assert.equal(rows[2].op,0x39);assert.equal(rows[2].words[1],3);assert.equal(rows[3].at,6);assert.deepEqual(rows[3].words,[0x0e]);for(const x of rows.slice(0,4))remove.add(x.at);
 }
 if(stripCandidateGuards&&c.descriptor===native){const matches=rows.filter(x=>[0x6e,0x6f,0x70,0x71,0x72,0x74,0x75,0x76,0x77,0x78].includes(x.op)&&callable(r,x)===native+'->newProducerAdmissionsEnabled()Z');for(const g of matches){const i=rows.indexOf(g);assert.ok(rows[i+1].op===0x0a&&rows[i+1].at===g.at+3&&rows[i+2].op===0x38&&rows[i+2].at===g.at+4);for(const x of rows.slice(i,i+3))remove.add(x.at);}}
 const kept=rows.filter(x=>!remove.has(x.at));const address=new Map(kept.map((x,i)=>[x.at,i]));address.set(head.instructionCount,kept.length);function target(at){assert.ok(address.has(at),'Control flow targets removed guard or noninstruction '+id);return address.get(at);}
 function boundary(at){if(address.has(at))return address.get(at);assert.ok(remove.has(at),'Try boundary is not an instruction');assert.ok(!publicPrefix,'Public try boundary intersects Source-external NEW guard');const next=kept.find(x=>x.at>at);return next?address.get(next.at):kept.length;}
 const payloadOwners=new Map();for(const x of kept)if([0x26,0x2b,0x2c].includes(x.op)){const a=x.at+s32(x.words[1],x.words[2]);assert.ok(!payloadOwners.has(a),'Shared payload unsupported');payloadOwners.set(a,x);}
 const instructions=kept.map(x=>{const w=[...x.words],op=x.op;let reference=null,branches=null;
  if(op===0x1a){reference=['string',r.string(w[1])];w[1]=0;}else if(op===0x1b){reference=['string',r.string((w[1]|w[2]<<16)>>>0)];w[1]=w[2]=0;}
  else if([0x1c,0x1f,0x20,0x22,0x23,0x24,0x25].includes(op)){reference=['type',r.type(w[1])];w[1]=0;}
  else if(op>=0x52&&op<=0x6d){reference=['field',r.field(w[1])];w[1]=0;}
  else if((op>=0x6e&&op<=0x72)||(op>=0x74&&op<=0x78)){const v=r.method(w[1]);reference=['method',{owner:v.owner,name:v.name,descriptor:v.descriptor}];w[1]=0;}
  if(op===0x28){branches=[target(x.at+(w[0]>>8<<24>>24))];w[0]&=255;}
  else if(op===0x29||op>=0x32&&op<=0x3d){branches=[target(x.at+s16(w[1]))];w[1]=0;}
  else if(op===0x2a||op===0x26||op===0x2b||op===0x2c){branches=[target(x.at+s32(w[1],w[2]))];w[1]=w[2]=0;}
  if(w[0]===0x100||w[0]===0x200){const owner=payloadOwners.get(x.at);assert.ok(owner&&[0x2b,0x2c].includes(owner.op));const count=w[1],start=w[0]===0x100?4:2+2*count;branches=[];for(let j=0;j<count;j++){branches.push(target(owner.at+s32(w[start+2*j],w[start+2*j+1])));w[start+2*j]=w[start+2*j+1]=0;}}
  return {words:w,reference,branches};
 });
 const tryCount=r.u2(m.code+6),tries=[];if(tryCount){const start=base+2*head.instructionCount+(head.instructionCount%2?2:0),handlersBase=start+8*tryCount;const count=r.uleb(handlersBase),handlers=new Map();let p=count.next;for(let j=0;j<count.value;j++){const offset=p-handlersBase,q=r.signedLeb(p);p=q.next;const catches=[];for(let k=0;k<Math.abs(q.value);k++){const t=r.uleb(p),a=r.uleb(t.next);p=a.next;catches.push([r.type(t.value),target(a.value)]);}let catchAll=null;if(q.value<=0){const a=r.uleb(p);p=a.next;catchAll=target(a.value);}handlers.set(offset,{catches,catchAll});}
  for(let j=0;j<tryCount;j++){const o=start+8*j,a=r.u4(o),n=r.u2(o+4),h=r.u2(o+6);assert.ok(n>0&&handlers.has(h));tries.push({start:boundary(a),end:boundary(a+n),...handlers.get(h)});}}
 return {access:m.access,direct:m.direct,registers:head.registers,incoming:head.incoming,outgoing:r.u2(m.code+4),instructions,tries};
}
function classGraph(c,candidate){const methods=new Map(),ann={...c.annotations,methods:new Map(c.annotations.methods),parameters:new Map(c.annotations.parameters)};for(const m of c.methods){const v=c.reader.method(m.index);if(candidate&&helperNames.get(c.descriptor)===v.name){const expected=v.name==='newProducerAdmissionsEnabled'?'()Z':'(Lcom/getcapacitor/PluginCall;)Z';assert.equal(v.descriptor,expected);assert.equal(m.access,2);assert.equal(m.direct,true);const a=ann.methods.get(key(v))||[];if(c.descriptor===native)equal(a,[{visibility:2,type:'Ldalvik/annotation/Throws;',elements:[['value',{type:28,value:[{type:24,value:'Lorg/memphiszoo/custodial/vault/VaultFailure;'}]}]]}],'Source-declared new helper throws');else equal(a,[],'new helper annotations');equal(ann.parameters.get(key(v))||[],[],'new helper parameter annotations');ann.methods.delete(key(v));ann.parameters.delete(key(v));continue;}methods.set(key(v),methodGraph(c,m,candidate));}
 return {descriptor:c.descriptor,access:c.access,superclass:c.superclass,interfaces:c.interfaces,sourceFile:c.sourceFile,fields:c.fields.sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0),methods:sortedMap(methods),annotations:{class:ann.class,fields:sortedMap(ann.fields),methods:sortedMap(ann.methods),parameters:sortedMap(ann.parameters)}};}
function exactGeneratedScope(c){
 equal({access:c.access,superclass:c.superclass,interfaces:c.interfaces,sourceFile:c.sourceFile,fields:c.fields},{access:0x10,superclass:'Ljava/lang/Object;',interfaces:[],sourceFile:'CustodialNewProducerScope.java',fields:[]},'generated scope class');
 equal({class:c.annotations.class,fields:[...c.annotations.fields],methods:[...c.annotations.methods],parameters:[...c.annotations.parameters]},{class:[],fields:[],methods:[],parameters:[]},'generated scope annotations');
 for(const m of c.methods){const v=c.reader.method(m.index);assert.equal(m.access,v.name==='<init>'?0x10002:0x8,'generated scope method access');if(v.name==='<init>'){assert.equal(v.descriptor,'()V');const {head,rows}=c.reader.instructions(m.code);equal(head,{registers:1,incoming:1,instructionCount:4},'generated scope constructor registers');assert.equal(c.reader.u2(m.code+4),1);assert.equal(c.reader.u2(m.code+6),0);assert.equal(rows.length,2);assert.equal(rows[0].op,0x70);assert.equal(rows[0].words[0],0x1070);assert.equal(rows[0].words[2],0);assert.equal(callable(c.reader,rows[0]),'Ljava/lang/Object;-><init>()V');equal(rows[1].words,[0x0e],'generated scope constructor return');}}
}
export function compareCustodialCallbackDexContinuity(candidateEntries,referenceEntries,{profile,policySha256}){
 // Candidate new guards are first independently checked as actual instructions.
 const scope=inspectCustodialNewProducerScopeDexSemantics(candidateEntries,{profile,policySha256});
 const candidate=collect(candidateEntries),reference=collect(referenceEntries);for(const d of scopes){assert.ok(candidate.classes.has(d)&&!reference.classes.has(d),'Reference must be frozen PRE-scope Source');exactGeneratedScope(candidate.classes.get(d));candidate.classes.delete(d);}
 equal([...candidate.classes.keys()].sort(),[...reference.classes.keys()].sort(),'entire class membership');
 let methods=0,fields=0;for(const d of [...reference.classes.keys()].sort()){const a=classGraph(candidate.classes.get(d),true),b=classGraph(reference.classes.get(d),false);equal(a,b,d);methods+=a.methods.length;fields+=a.fields.length;}
 const proof=Object.freeze({schema:'custodial.actual-dex-original-callback-comparison.v1',scope,all_original_classes_compared:reference.classes.size,all_original_methods_compared:methods,all_original_fields_compared:fields,exact_new_guard_public_methods:9,exact_native_attachment_predicate:1,reference_dex_sha256:reference.digests,candidate_dex_sha256:candidate.digests,conditional_callbacks_preserved:true,source_reference_admission:null});comparisonProofs.add(proof);return proof;
}
export function isActualCallbackDexContinuityComparison(p){return !!p&&comparisonProofs.has(p);}

// Parser diagnostics carry NO comparison/reference/acceptance authority.
export function inspectCustodialCallbackDexStructure(entries){const c=collect(entries);let methods=0,fields=0;const digest=createHash('sha256');for(const d of [...c.classes.keys()].sort()){const g=classGraph(c.classes.get(d),false);methods+=g.methods.length;fields+=g.fields.length;digest.update(JSON.stringify(g)+'\n');}return {schema:'custodial.dex-structural-diagnostic-only.v1',classes:c.classes.size,methods,fields,structure_sha256:digest.digest('hex'),dex_sha256:c.digests,conditional_callbacks_preserved:null,source_reference_admission:null};}
