import {createProtectedBrowserAdmission,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY} from './protected-browser-admission.js';
import {createRawStorageAdapter} from './storage-firewall.js';
import {inspectCapturedOriginalCompletionCensus,readCapturedOriginalCompletionCensusArguments,
  inspectCapturedOriginalBrowserValueFrame,readCapturedOriginalBrowserValueChunk,
  closeCapturedProtectedBrowserWork} from './protected-browser-inventory.js';

// Main bundles this module in a private document-start closure. This is a
// retained source observation, never native identity, approval or effect authority.
const installedDocuments=new WeakSet();
const REQUEST='custodial.native-original-browser-capture-request.v1';
const RESPONSE='custodial.native-original-browser-capture-response.v1';
const DATA_RESPONSE='custodial.native-original-browser-data-response.v1';
const HOLD_RESPONSE='custodial.native-original-browser-hold-fence-response.v1';
const BOOTSTRAP='custodial.native-original-browser-bootstrap.v1';
const MAX_JSON=16*1024*1024,MAX_ARGUMENT=4*1024*1024,MAX_ARGUMENTS=8*1024*1024;
const hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const stringify=JSON.stringify,parse=JSON.parse,create=Object.create,keys=Object.keys,descriptor=Object.getOwnPropertyDescriptor;
const define=Object.defineProperty,Encoder=TextEncoder,Bytes=Uint8Array;
const prototypeOf=Object.getPrototypeOf;
const hasOwn=Object.hasOwn,isArray=Array.isArray,assign=Object.assign,characters=String.fromCharCode;
const wipe=Function.call.bind(Uint8Array.prototype.fill);
const encode=Function.call.bind(TextEncoder.prototype.encode),encoder=new Encoder();
const byteLength=Function.call.bind(descriptor(Object.getPrototypeOf(Bytes.prototype),'length').get);
const byteTag=Function.call.bind(descriptor(Object.getPrototypeOf(Bytes.prototype),Symbol.toStringTag).get);
const characterBlock=Function.prototype.apply.bind(characters,null),ArrayType=Array;
const ownNames=Object.getOwnPropertyNames,ownSymbols=Object.getOwnPropertySymbols,isInteger=Number.isSafeInteger;
const VALUE_CHUNK_BYTES=1048576,MAX_VALUE_BYTES=64*VALUE_CHUNK_BYTES;
const frameFields=['schema','encoding','observation_sha256','frame_sha256','byte_count','chunk_bytes','chunk_count',
  'record_count','session_storage_state','chunk_sha256','native_authority','durable_retention',
  'inventory_acknowledged','finalizer_allowed','key_removal'];
const fields=['schema','command','grant_token','request_nonce','phase_nonce','operation_id','frame_sha256',
  'original_generation_id','native_mutation_stamp'];
const tupleFields=['request_nonce','operation_id','frame_sha256','original_generation_id','native_mutation_stamp'];

// Flat closed string DTO, including duplicate escaped-key refusal. No object
// from a public callback becomes a capture capability or a caller owner map.
function requestData(text){
  if(typeof text!=='string'||text.length>65536)return null;
  let position=0;
  const whitespace=()=>{while(/[ \t\r\n]/.test(text[position]||'!'))position++;};
  const string=()=>{
    const start=position;if(text[position++]!=='"')throw Error('string');
    for(;position<text.length;position++){
      const code=text.charCodeAt(position);
      if(code<32)throw Error('control');
      if(text[position]==='\\'){position++;if(position>=text.length)throw Error('escape');continue;}
      if(text[position]==='"'){position++;return parse(text.slice(start,position));}
    }
    throw Error('unterminated');
  };
  try{
    whitespace();if(text[position++]!=='{')return null;
    const result=create(null);
    for(;;){
      whitespace();const key=string();whitespace();
      if(!fields.includes(key)||descriptor(result,key)||text[position++]!==':')return null;
      whitespace();result[key]=string();whitespace();
      const separator=text[position++];if(separator==='}')break;if(separator!==',')return null;
    }
    whitespace();if(position!==text.length||keys(result).length!==fields.length)return null;
    if(result.schema!==REQUEST||!['CAPTURE','CAPTURE_EXISTING_HELD','RECHECK','CLOSE','DATA_FRAME','DATA_CHUNK','HOLD_FENCE'].includes(result.command)
      ||!hex(result.grant_token)||!hex(result.request_nonce)||!hex(result.phase_nonce)||!hex(result.frame_sha256)
      ||!uuid(result.operation_id)||!uuid(result.original_generation_id)
      ||result.native_mutation_stamp.length<1||result.native_mutation_stamp.length>4096)return null;
    for(let i=0;i<result.native_mutation_stamp.length;i++){
      const code=result.native_mutation_stamp.charCodeAt(i);
      if(code>=0xd800&&code<=0xdbff){const next=result.native_mutation_stamp.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return null;}
      else if(code>=0xdc00&&code<=0xdfff)return null;
    }
    return Object.freeze(result);
  }catch{return null;}
}

// Null-prototype data prevents later inherited toJSON hooks from receiving the
// private reply stamp. Arrays shadow toJSON as well. No original values getter.
function data(value){
  if(value===null||typeof value!=='object')return value;
  const result=isArray(value)?[]:create(null);
  if(isArray(value))define(result,'toJSON',{value:undefined});
  for(const key of keys(value)){
    const field=descriptor(value,key);if(!field||!hasOwn(field,'value'))throw Error('opaque data required');
    result[key]=data(field.value);
  }
  return result;
}

export function installNativeOriginalBrowserPreparation({grantToken,replyToken}={}){
  if(!hex(grantToken)||!hex(replyToken)||grantToken===replyToken)return;
  let document,port,post,listen,unlisten,pageListen,pageUnlisten,clock,schedule,cancel,toBase64,digest,gate,writerAdmission;
  let writerRetired=false;
  let originalStorageAreas=null,publicContainment=null,publicContainmentRetired=false;
  const storageMethods=['getItem','key','setItem','removeItem','clear'];
  // Necessary descriptor/resource checks only. They cannot authenticate a
  // firewall installation, foreign realms, every writer or native authority.
  // No raw adapter is published and the runtime remains its original owner.
  const requirePublicStorageContainment=()=>{
    if(publicContainmentRetired)throw Error('Public Storage containment unavailable');
    try{
      if(!originalStorageAreas||originalStorageAreas.length!==2
        ||originalStorageAreas[0].raw===originalStorageAreas[1].raw
        ||originalStorageAreas[0].prototype!==originalStorageAreas[1].prototype)
        throw Error('Original distinct Storage areas required');
      const observed=[];
      for(let i=0;i<2;i++){
        const original=originalStorageAreas[i],field=descriptor(globalThis,original.name);
        if(!field||!hasOwn(field,'value')||field.get||field.set
          ||field.configurable!==false||field.writable!==false
          ||!field.value||field.value===original.raw
          ||prototypeOf(original.raw)!==original.prototype
          ||prototypeOf(field.value)!==original.prototype)throw Error('Immutable public Storage facade required');
        if(i===1&&field.value===observed[0].facade)throw Error('Aliased public Storage facade');
        const methods=[];
        for(let j=0;j<storageMethods.length;j++){
          const key=storageMethods[j],before=original.methods[j],after=descriptor(original.prototype,key);
          if(!before||!hasOwn(before,'value')||typeof before.value!=='function'
            ||!after||!hasOwn(after,'value')||typeof after.value!=='function'
            ||after.get||after.set||descriptor(original.raw,key)||descriptor(field.value,key))
            throw Error('Original Storage methods required');
          if(j<2){
            if(after.value!==before.value||after.configurable!==before.configurable
              ||after.writable!==before.writable||after.enumerable!==before.enumerable)
              throw Error('Original Storage reader changed');
          }else if(after.configurable!==false||after.writable!==false||after.value===before.value
            ||after.enumerable!==before.enumerable)throw Error('Immutable Storage method guard required');
          const bound=field.value[key];
          if(typeof bound!=='function'||bound===after.value)throw Error('Original bound Storage facade method required');
          methods[j]={guard:after.value,bound};
        }
        observed[i]={facade:field.value,enumerable:field.enumerable,methods};
        if(publicContainment){
          const pinned=publicContainment[i];
          if(pinned.facade!==field.value||pinned.enumerable!==field.enumerable)
            throw Error('Original public Storage facade withdrawn');
          for(let j=0;j<methods.length;j++)if(pinned.methods[j].guard!==methods[j].guard
            ||pinned.methods[j].bound!==methods[j].bound)throw Error('Original public Storage method withdrawn');
        }
      }
      if(!publicContainment)publicContainment=observed;
    }catch(error){publicContainmentRetired=true;throw error;}
  };
  const requireWriterDocument=()=>{
    const field=descriptor(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY);
    if(writerRetired||globalThis.document!==document||!validLocation()||!field
      ||field.value!==writerAdmission||field.get||field.set||field.writable!==false||field.enumerable!==false||field.configurable!==false){
      writerRetired=true;throw Error('Original document writer unavailable');
    }
  };
  const validLocation=()=>{
    const location=globalThis.location;
    return globalThis.top===globalThis&&location?.origin==='https://localhost'
      &&location.protocol==='https:'&&location.hostname==='localhost'&&location.port===''&&location.host==='localhost';
  };
  try{
    document=globalThis.document;
    if(!document||installedDocuments.has(document)||!validLocation())return;
    port=globalThis.custodialOriginalBrowserPreparation;
    if(!port||!['postMessage','addEventListener','removeEventListener'].every(key=>typeof port[key]==='function')
      ||typeof globalThis.addEventListener!=='function'||typeof globalThis.removeEventListener!=='function'
      ||typeof globalThis.btoa!=='function'||typeof globalThis.performance?.now!=='function')return;
    post=port.postMessage.bind(port);listen=port.addEventListener.bind(port);unlisten=port.removeEventListener.bind(port);
    pageListen=globalThis.addEventListener.bind(globalThis);pageUnlisten=globalThis.removeEventListener.bind(globalThis);
    clock=globalThis.performance.now.bind(globalThis.performance);schedule=globalThis.setTimeout.bind(globalThis);
    cancel=globalThis.clearTimeout.bind(globalThis);toBase64=globalThis.btoa.bind(globalThis);
    // Capture both actual raw areas before the normal firewall installs.
    const rawLocal=globalThis.localStorage,rawSession=globalThis.sessionStorage;
    originalStorageAreas=[];
    for(const name of ['localStorage','sessionStorage']){
      const raw=name==='localStorage'?rawLocal:rawSession,prototype=prototypeOf(raw),methods=[];
      for(let i=0;i<storageMethods.length;i++)methods[i]=descriptor(prototype,storageMethods[i]);
      originalStorageAreas[originalStorageAreas.length]={name,raw,prototype,methods};
    }
    const storage=createRawStorageAdapter(rawLocal),sessionStorage=createRawStorageAdapter(rawSession);
    const idb=globalThis.indexedDB,locks=globalThis.navigator?.locks,crypto=globalThis.crypto;
    if(typeof idb?.databases!=='function'||typeof idb?.open!=='function'||typeof locks?.request!=='function'
      ||typeof crypto?.subtle?.digest!=='function')return;
    digest=crypto.subtle.digest.bind(crypto.subtle);
    gate=createProtectedBrowserAdmission({storage,sessionStorage,
      indexedDb:Object.freeze({databases:idb.databases.bind(idb),open:idb.open.bind(idb)}),
      locks:Object.freeze({request:locks.request.bind(locks)}),
      cryptoApi:Object.freeze({subtle:Object.freeze({digest})})});
    // This private asset runs at DOCUMENT START, before application writers
    // can retain an untracked factory/transaction entry. Generic read-only
    // capture is not an owning writer-quiescence substitute. No fallback may
    // announce readiness if this document cannot install the fixed guard.
    if(typeof gate.installIndexedDbWriteFence!=='function')return;
    gate.installIndexedDbWriteFence();
    if(descriptor(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY))return;
    // No capture/bytes/native port/credential/finalizer method escapes. The
    // ordinary runtime already exposes cooperative mutations, never authority.
    writerAdmission=Object.freeze({
      mutate:(operation,options)=>{if(typeof operation!=='function')throw new TypeError('Protected mutation required.');
        requireWriterDocument();return gate.mutate(async()=>{
        requireWriterDocument();const result=await operation();requireWriterDocument();return result;
      },options);},
      requireAdmission:()=>{requireWriterDocument();return gate.requireAdmission();},
      requireMutation:()=>{requireWriterDocument();return gate.requireMutation();},
    });
    define(globalThis,PROTECTED_BROWSER_DOCUMENT_WRITER_KEY,{value:writerAdmission,writable:false,enumerable:false,configurable:false});
    requireWriterDocument();
  }catch{return;}
  installedDocuments.add(document);
  let closed=false,consumed=false,busy=false,original=null,capture=null,census=null,censusJson=null,argumentJson=null,deadline=null,timer;
  let capturedPosted=false,valueFrame=null,valueMetadata=null,valueMetadataJson=null,nextValueChunk=0,activeValueBytes=null;
  const phases=new Set();
  const current=()=>{
    if(closed||globalThis.document!==document||!validLocation()||deadline!==null&&clock()>=deadline)throw Error('closed');
    requireWriterDocument();
  };
  const close=()=>{
    if(closed)return;closed=true;writerRetired=true;cancel(timer);
    if(capture)closeCapturedProtectedBrowserWork(capture);capture=null;census=null;censusJson=null;argumentJson=null;
    if(activeValueBytes)wipe(activeValueBytes,0);activeValueBytes=null;
    valueFrame=null;valueMetadata=null;valueMetadataJson=null;nextValueChunk=0;
    try{unlisten('message',message);}catch{}
    try{pageUnlisten('pagehide',close);pageUnlisten('pageshow',hello);}catch{}
  };
  const postData=value=>{
    current();const serialized=stringify(data(value)),encoded=encode(encoder,serialized);
    try{if(byteLength(encoded)>MAX_JSON)throw Error('response too large');current();post(serialized);current();}
    finally{wipe(encoded,0);}
  };
  const hello=()=>{
    try{postData(assign(create(null),{schema:BOOTSTRAP,reply_token:replyToken}));}catch{close();}
  };
  const response=(request,state,observation=null,projection=null,args=[])=>{
    const result=create(null);result.schema=RESPONSE;result.command=request.command;result.reply_token=replyToken;
    result.request_nonce=request.request_nonce;result.phase_nonce=request.phase_nonce;
    for(const key of tupleFields.slice(1))result[key]=request[key];
    result.state=state;result.observation=observation;result.census=projection;result.arguments_base64=args;
    result.reason=state==='UNRESOLVED_RETAINED'?'browser_original_observation_unavailable':'';
    return result;
  };
  const dataResponse=(request,state,frame=null,index=null,chunk='')=>{
    const result=create(null);result.schema=DATA_RESPONSE;result.command=request.command;result.reply_token=replyToken;
    result.request_nonce=request.request_nonce;result.phase_nonce=request.phase_nonce;
    for(const key of tupleFields.slice(1))result[key]=request[key];
    result.state=state;result.data_frame=frame;result.chunk_index=index;result.chunk_base64=chunk;
    result.reason=state==='UNRESOLVED_RETAINED'?'browser_original_values_unavailable':'';
    return result;
  };
  const holdResponse=(request,state,markerSha='',epoch='')=>{
    const result=create(null);result.schema=HOLD_RESPONSE;result.command=request.command;result.reply_token=replyToken;
    result.request_nonce=request.request_nonce;result.phase_nonce=request.phase_nonce;
    for(const key of tupleFields.slice(1))result[key]=request[key];
    result.state=state;result.hold_marker_sha256=markerSha;result.mutation_epoch=epoch;
    result.observation_sha256=census?.observation_sha256||'';
    result.native_authority=false;
    for(const key of ['inventory_acknowledged','work_accepted','replay_allowed','finalizer_allowed','key_removal','phone_released'])result[key]=false;
    return result;
  };
  const budget=()=>{current();const remaining=Math.ceil(deadline-clock());if(remaining<1)throw Error('expired');return Math.min(5000,remaining);};
  const validateArguments=argumentsList=>{
    let total=0;
    // These arrays hold private original bytes. Neither a successor page's
    // Array iterator nor its map callback may receive the array or its rows.
    for(let i=0;i<argumentsList.length;i++){
      const bytes=argumentsList[i];
      if(byteTag(bytes)!=='Uint8Array'||byteLength(bytes)>MAX_ARGUMENT
        ||(total+=byteLength(bytes))>MAX_ARGUMENTS)throw Error('argument bound');
    }
  };
  const wipeArguments=argumentsList=>{
    for(let i=0;i<argumentsList.length;i++)wipe(argumentsList[i],0);
  };
  const base64=bytes=>{
    // No page-replaceable subarray/species/iterator sees original value bytes.
    let binary='';const length=byteLength(bytes);
    for(let offset=0;offset<length;offset+=8192){
      const count=Math.min(8192,length-offset),block=new ArrayType(count);
      for(let i=0;i<count;i++)block[i]=bytes[offset+i];
      binary+=characterBlock(block);
    }
    return toBase64(binary);
  };
  const encodeArguments=argumentsList=>{
    const encoded=[];
    for(let i=0;i<argumentsList.length;i++)encoded[i]=base64(argumentsList[i]);
    return encoded;
  };
  const validateValueFrame=frame=>{
    if(!frame||typeof frame!=='object'||ownSymbols(frame).length||ownNames(frame).length!==frameFields.length
      ||!frameFields.every(key=>hasOwn(frame,key)))throw Error('closed original value frame required');
    // Validate bounded scalar descriptors before copying the sole array. A bad
    // dependency cannot make us traverse arbitrary nested objects or getters.
    const metadata=create(null);
    for(const key of frameFields){
      const field=descriptor(frame,key);
      if(!field||!field.enumerable||!hasOwn(field,'value'))throw Error('original value metadata data required');
      metadata[key]=field.value;
    }
    const hashes=metadata.chunk_sha256;
    if(metadata.schema!=='custodial.browser-original-value-frame.v1'||metadata.encoding!=='MZBRV001'
      ||!hex(metadata.observation_sha256)||metadata.observation_sha256!==capture.observation_sha256
      ||metadata.observation_sha256!==census.observation_sha256||!hex(metadata.frame_sha256)
      ||!isInteger(metadata.byte_count)||metadata.byte_count<1||metadata.byte_count>MAX_VALUE_BYTES
      ||metadata.chunk_bytes!==VALUE_CHUNK_BYTES||!isInteger(metadata.chunk_count)
      ||metadata.chunk_count!==Math.ceil(metadata.byte_count/VALUE_CHUNK_BYTES)||metadata.chunk_count>64
      ||!isInteger(metadata.record_count)||metadata.record_count<0||metadata.record_count!==census.record_count
      ||metadata.record_count!==capture.record_count||metadata.session_storage_state!==capture.session_storage_state
      ||!['NOT_DECLARED_UNKNOWN','CAPTURED_READ_ONLY_NOT_AUTHENTICATED'].includes(metadata.session_storage_state)
      ||!isArray(hashes)||hashes.length!==metadata.chunk_count
      ||ownSymbols(hashes).length||ownNames(hashes).length!==hashes.length+1
      ||['native_authority','durable_retention','inventory_acknowledged','finalizer_allowed','key_removal']
        .some(key=>metadata[key]!==false))throw Error('original value metadata changed');
    const copiedHashes=[];
    for(let i=0;i<hashes.length;i++){
      const field=descriptor(hashes,String(i));
      if(!field||!hasOwn(field,'value')||!hex(field.value))throw Error('original chunk hash required');
      copiedHashes[i]=field.value;
    }
    metadata.chunk_sha256=copiedHashes;
    return metadata;
  };
  const revalidateOriginal=async()=>{
    let bytes=[];
    try{
      current();bytes=await readCapturedOriginalCompletionCensusArguments(capture,census,{timeoutMs:budget()});current();
      validateArguments(bytes);
      if(stringify(data(census))!==censusJson||stringify(data(encodeArguments(bytes)))!==argumentJson)
        throw Error('original census or arguments changed');
    }finally{wipeArguments(bytes);}
  };
  async function perform(request){
    let argumentsList=[],revalidated=[],valueBytes=null;
    try{
      current();
      const initialCapture=request.command==='CAPTURE'||request.command==='CAPTURE_EXISTING_HELD';
      if(request.command==='HOLD_FENCE'){
        if(!capturedPosted||!capture||!census||!valueFrame||!valueMetadata
          ||nextValueChunk!==valueMetadata.chunk_count)throw Error('complete original values required');
        requirePublicStorageContainment();
        await revalidateOriginal();current();requirePublicStorageContainment();
        const before=await gate.inspectCapturedHold(capture,{timeoutMs:budget()});current();requirePublicStorageContainment();
        if(before.schema!=='custodial.browser-captured-hold-observation.v1'
          ||before.operation_id!==original.operation_id||before.native_authority!==false
          ||typeof before.mutation_epoch!=='string'||typeof before.hold_marker_utf8!=='string')
          throw Error('same original hold required');
        let markerBytes=null,hashBytes=null,markerSha='';
        try{
          markerBytes=encode(encoder,before.hold_marker_utf8);
          hashBytes=new Bytes(await digest('SHA-256',markerBytes));current();requirePublicStorageContainment();
          if(byteLength(hashBytes)!==32)throw Error('hold marker digest required');
          for(let i=0;i<byteLength(hashBytes);i++)markerSha+=hashBytes[i].toString(16).padStart(2,'0');
        }finally{if(markerBytes)wipe(markerBytes,0);if(hashBytes)wipe(hashBytes,0);}
        await revalidateOriginal();current();requirePublicStorageContainment();
        const after=await gate.inspectCapturedHold(capture,{timeoutMs:budget()});current();requirePublicStorageContainment();
        for(const key of ['schema','operation_id','mutation_epoch','hold_marker_utf8','native_authority'])
          if(before[key]!==after[key])throw Error('original held generation changed');
        requirePublicStorageContainment();
        postData(holdResponse(request,'SAME_ORIGINAL_DURABLE_BROWSER_HOLD_OBSERVED_NOT_ACK',markerSha,after.mutation_epoch));
        return;
      }
      if(request.command==='DATA_FRAME'){
        if(!capturedPosted||!capture||!census||valueFrame)throw Error('same original value frame required');
        valueFrame=await inspectCapturedOriginalBrowserValueFrame(capture,{timeoutMs:budget()});current();
        valueMetadata=validateValueFrame(valueFrame);valueMetadataJson=stringify(valueMetadata);nextValueChunk=0;
        await revalidateOriginal();current();
        if(stringify(validateValueFrame(valueFrame))!==valueMetadataJson)throw Error('original frame changed');
        postData(dataResponse(request,'VALUE_FRAME_RETAINED_NOT_AUTHORITY',valueMetadata));return;
      }
      if(request.command==='DATA_CHUNK'){
        if(!capturedPosted||!capture||!valueFrame||nextValueChunk>=valueMetadata.chunk_count
          ||stringify(validateValueFrame(valueFrame))!==valueMetadataJson)throw Error('same original value chunk required');
        const index=nextValueChunk;
        const returned=await readCapturedOriginalBrowserValueChunk(capture,valueFrame,index,{timeoutMs:budget()});
        if(byteTag(returned)!=='Uint8Array')throw Error('owned original value bytes required');
        valueBytes=returned;
        activeValueBytes=valueBytes;current();
        const expected=Math.min(valueMetadata.chunk_bytes,valueMetadata.byte_count-index*valueMetadata.chunk_bytes);
        if(byteLength(valueBytes)!==expected||expected<1||expected>VALUE_CHUNK_BYTES)throw Error('original value chunk changed');
        let hashBytes=null;
        try{
          hashBytes=new Bytes(await digest('SHA-256',valueBytes));current();
          let hash='';for(let i=0;i<byteLength(hashBytes);i++)hash+=hashBytes[i].toString(16).padStart(2,'0');
          if(byteLength(hashBytes)!==32||hash!==valueMetadata.chunk_sha256[index])throw Error('original chunk digest changed');
        }finally{if(hashBytes)wipe(hashBytes,0);}
        const encoded=base64(valueBytes);
        await revalidateOriginal();current();
        if(stringify(validateValueFrame(valueFrame))!==valueMetadataJson)throw Error('original frame changed');
        postData(dataResponse(request,'VALUE_CHUNK_RETAINED_NOT_AUTHORITY',valueMetadata,index,encoded));
        nextValueChunk++;return;
      }
      if(initialCapture){
        const options={operationId:original.operation_id,lifetimeMs:30000,timeoutMs:budget()};
        capture=request.command==='CAPTURE_EXISTING_HELD'
          ?await gate.captureExistingHold(options):await gate.holdAndCapture(options);current();
        census=await inspectCapturedOriginalCompletionCensus(capture,{timeoutMs:budget()});current();
        censusJson=stringify(data(census));
        argumentsList=await readCapturedOriginalCompletionCensusArguments(capture,census,{timeoutMs:budget()});current();
        validateArguments(argumentsList);
      }else{
        if(!capture||!census)throw Error('original capture required');
        if(valueFrame&&nextValueChunk!==valueFrame.chunk_count)throw Error('original value transfer incomplete');
        // The retained census is a private WeakMap key. Its existing reader
        // revalidates the WHOLE capture/current owner without a second census,
        // fresh capture, selected list or invented authenticated projection.
        argumentsList=await readCapturedOriginalCompletionCensusArguments(capture,census,{timeoutMs:budget()});current();
        validateArguments(argumentsList);
      }
      const encodedArguments=encodeArguments(argumentsList);
      const encodedList=stringify(data(encodedArguments));
      if(initialCapture)argumentJson=encodedList;
      else if(encodedList!==argumentJson)throw Error('original arguments changed');
      // Actual private census reader revalidates the entire original capture
      // again after encoding and before any native post. No cached-current flag.
      revalidated=await readCapturedOriginalCompletionCensusArguments(capture,census,{timeoutMs:budget()});current();
      validateArguments(revalidated);
      if(stringify(data(census))!==censusJson||stringify(data(encodeArguments(revalidated)))!==argumentJson)
        throw Error('original census or arguments changed');
      const wire=response(request,initialCapture?'CAPTURED_RETAINED_NOT_AUTHORITY':'RECHECKED_RETAINED_NOT_AUTHORITY',
        capture,census,initialCapture?encodedArguments:[]);
      postData(wire);
      if(initialCapture)capturedPosted=true;
    }catch{
      try{postData(request.command==='HOLD_FENCE'?holdResponse(request,'UNRESOLVED_RETAINED'):['DATA_FRAME','DATA_CHUNK'].includes(request.command)
        ?dataResponse(request,'UNRESOLVED_RETAINED'):response(request,'UNRESOLVED_RETAINED'));}catch{}
      close();
    }finally{
      if(valueBytes)wipe(valueBytes,0);
      activeValueBytes=null;
      wipeArguments(argumentsList);
      wipeArguments(revalidated);
      // An awaited collector may resolve after close() already cleared these
      // fields. Dispose that late result as well, never retain a reopened frame.
      if(closed){
        if(capture)closeCapturedProtectedBrowserWork(capture);
        capture=null;census=null;censusJson=null;argumentJson=null;
        valueFrame=null;valueMetadata=null;valueMetadataJson=null;nextValueChunk=0;
      }
      busy=false;
    }
  }
  function message(event){
    if(closed)return;
    const request=requestData(event?.data);
    if(!request||request.grant_token!==grantToken)return;
    try{current();}catch{close();return;}
    if(request.command==='CAPTURE'||request.command==='CAPTURE_EXISTING_HELD'){
      if(consumed)return;
      consumed=true;original=request;deadline=clock()+30000;phases.add(request.phase_nonce);
      timer=schedule(close,30000);busy=true;void perform(request);return;
    }
    if(!original||!tupleFields.every(key=>request[key]===original[key])||phases.has(request.phase_nonce))return;
    // Bound rejected/concurrent phase bookkeeping; it cannot become authority.
    if(phases.size>=4096){close();return;}phases.add(request.phase_nonce);
    if(request.command==='CLOSE'){close();return;}
    if(busy)return;
    busy=true;void perform(request);
  }
  try{listen('message',message);pageListen('pagehide',close);pageListen('pageshow',hello);hello();}
  catch{close();}
  // Deliberately return nothing: no gate, capture, raw adapter or token getter.
}
