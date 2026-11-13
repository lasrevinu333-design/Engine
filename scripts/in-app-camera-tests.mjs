import assert from 'node:assert/strict';
import { createInAppCamera } from '../mobile/src/custodial/in-app-camera.js';

// Real acquisition controller, synthetic WebView/media/permission adapters only.
// Not a camera, native permission, persisted-image, UI, or kiosk acceptance test.
let checks = 0;
const eq = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = async () => { for (let i=0;i<8;i++) await Promise.resolve(); };
function fixture(overrides={}) {
  const f={ identity:'principal-A|session-A', visible:true, states:[], errors:[], released:[], requests:[], tracks:[], timers:new Map(), frames:[], unsubscribed:0 };
  let nextTimer=0;
  f.stream=({audio=false,ended=false}={})=>{
    const track={readyState:ended?'ended':'live',stops:0,listeners:new Set(),
      stop(){this.stops++;this.readyState='ended';},
      addEventListener(_,fn){this.listeners.add(fn);},removeEventListener(_,fn){this.listeners.delete(fn);},
      end(){this.readyState='ended';for(const fn of [...this.listeners])fn();}};
    f.tracks.push(track);
    return {getTracks:()=>[track],getVideoTracks:()=>[track],getAudioTracks:()=>audio?[track]:[]};
  };
  f.video={srcObject:null,async play(){}};
  const options={ binding:()=>f.identity, visible:()=>f.visible,
    subscribeInvalidation(fn){f.invalidate=fn;return()=>{f.unsubscribed++;};},
    authorize:async()=>({lease:'synthetic-camera-lease'}),releaseAuthorization:async lease=>{f.released.push(lease);},
    mediaDevices:{async getUserMedia(request){f.requests.push(request);return f.stream();}},video:f.video,
    snapshot(){const frame={closed:0,close(){this.closed++;}};f.frames.push(frame);return frame;},
    encode:async()=>({type:'image/jpeg',data_url:'synthetic-encoded-JPEG-not-real-media'}),
    onState:value=>f.states.push(value),onError:reason=>f.errors.push(reason),
    schedule(fn){const id=++nextTimer;f.timers.set(id,fn);return id;},unschedule(id){f.timers.delete(id);},
    ...overrides,
  };
  f.camera=createInAppCamera(options);return f;
}

{
  const f=fixture();eq(await f.camera.begin(),true,'authorized visible acquisition opens');
  eq(f.requests.length,1,'single media request');eq(f.requests[0].audio,false,'never requests microphone');
  eq(f.video.muted,true,'video muted');eq(f.video.playsInline,true,'no fullscreen player');
  eq(f.camera.state(),'live','actual live state');eq(f.timers.size,0,'opening deadline retired');
  eq(await f.camera.capture(),true,'capture becomes a preview');eq(f.tracks[0].stops,1,'track stopped before keep');
  eq(f.video.srcObject,null,'video detached');eq(f.frames[0].closed,1,'frame disposed after encoding');
  eq(await f.camera.capture(),false,'preview cannot be recaptured concurrently');
  const kept=f.camera.keep();eq(kept.binding,f.identity,'result has original complete binding');
  eq(kept.image.type,'image/jpeg','encoded candidate returned');eq(Object.isFrozen(kept.image),true,'candidate immutable');
  eq(f.camera.keep(),null,'no duplicate keep');eq(f.released.length,1,'exact native lease released once');
  f.camera.dispose();f.camera.dispose();eq(f.unsubscribed,1,'idempotent subscription cleanup');
  eq(await f.camera.begin(),false,'disposed controller cannot restart');
}
for(const stage of ['authorization','media','play','encode']){
  const gate=deferred(),f=fixture(stage==='authorization'?{authorize:()=>gate.promise}:stage==='encode'?{encode:()=>gate.promise}:{});
  let stream;
  if(stage==='media')f.camera.dispose(); // Build one precise delayed-media fixture instead.
  const g=stage==='media'?fixture({mediaDevices:{getUserMedia:()=>gate.promise}}):f;
  if(stage==='play')g.video.play=()=>gate.promise;
  const started=g.camera.begin();await tick();
  let captured;
  if(stage==='encode'){await started;captured=g.camera.capture();await tick();}
  g.camera.cancel();
  if(stage==='authorization')gate.resolve({lease:'late-authorization'});
  if(stage==='media'){stream=g.stream();gate.resolve(stream);}
  if(stage==='play')gate.resolve();
  if(stage==='encode')gate.resolve({type:'image/jpeg',data_url:'late-image'});
  eq(await (captured||started),false,stage+' late result rejected');
  eq(g.camera.state(),'idle',stage+' remains idle');eq(g.camera.keep(),null,stage+' no late evidence');
  eq(g.video.srcObject,null,stage+' no attached live video');
  eq(g.tracks.every(track=>track.stops>=1),true,stage+' every resolved track stopped');
  eq(g.released.length,1,stage+' late/current native lease released exactly once');
  eq(g.timers.size,0,stage+' no deadline left');g.camera.dispose();
}
for(const change of ['different-principal','different-session','hidden','A-B-A']){
  const f=fixture();await f.camera.begin();
  if(change==='different-principal')f.identity='principal-B|session-A';
  if(change==='different-session')f.identity='principal-A|session-B';
  if(change==='hidden')f.visible=false;
  if(change==='A-B-A'){f.identity='principal-B|session-B';f.invalidate();f.identity='principal-A|session-A';}
  else f.invalidate();
  eq(f.camera.state(),'idle',change+' invalidates flow');eq(f.camera.keep(),null,change+' no cross-binding image');
  eq(f.tracks[0].stops,1,change+' stops camera');eq(f.released.length,1,change+' releases native permission lease');f.camera.dispose();
}
for(const reason of ['unauthorized','media-denied','audio-stream','ended-track','play-denied','snapshot-failed','encode-failed']){
  const options={};
  if(reason==='unauthorized')options.authorize=async()=>null;
  if(reason==='media-denied')options.mediaDevices={getUserMedia:async()=>{throw Error('synthetic');}};
  if(reason==='snapshot-failed')options.snapshot=()=>{throw Error('synthetic');};
  if(reason==='encode-failed')options.encode=async()=>{throw Error('synthetic');};
  let f;
  if(reason==='audio-stream'||reason==='ended-track')options.mediaDevices={getUserMedia:async()=>f.stream({audio:reason==='audio-stream',ended:reason==='ended-track'})};
  f=fixture(options);if(reason==='play-denied')f.video.play=async()=>{throw Error('synthetic');};
  const opened=await f.camera.begin();if(opened)await f.camera.capture();
  eq(f.camera.state(),'idle',reason+' returns to idle');eq(f.camera.keep(),null,reason+' no replacement candidate');
  eq(f.errors.length,1,reason+' reports truthful failure');eq(f.timers.size,0,reason+' cleans deadline');
  eq(f.tracks.every(track=>track.stops>=1),true,reason+' no live stream leak');f.camera.dispose();
}
{
  const gate=deferred(),f=fixture({mediaDevices:{getUserMedia:()=>gate.promise}});
  const opening=f.camera.begin();await tick();eq(await f.camera.begin(),false,'cannot open competing permission/media requests');
  [...f.timers.values()][0]();eq(f.camera.state(),'idle','deadline releases presentation');
  eq(f.errors.includes('camera_timed_out'),true,'timeout is explicit');eq(await f.camera.begin(),false,'never multiply unresolved media requests after timeout');
  const stream=f.stream();gate.resolve(stream);eq(await opening,false,'timed-out stream refused');
  eq(f.tracks[0].stops,1,'timed-out stream stopped on arrival');eq(f.released.length,1,'timeout releases exact lease once');f.camera.dispose();
}
{
  const gate=deferred(),f=fixture({encode:()=>gate.promise});await f.camera.begin();const oldCapture=f.camera.capture();await tick();
  f.camera.cancel();eq(f.frames[0].closed,1,'cancel releases frozen frame before late encoding settles');
  eq(await f.camera.begin(),false,'unresolved conversions cannot multiply retained image allocations');
  eq(f.errors.at(-1),'camera_finishing_previous','blocked acquisition explains outstanding conversion');
  gate.resolve({type:'image/jpeg',data_url:'old-image'});eq(await oldCapture,false,'old conversion does not acquire new flow');
  eq(f.camera.state(),'idle','old callback does not resurrect preview');eq(f.frames[0].closed,1,'frame is released once');
  eq(await f.camera.begin(),true,'next capture allowed once prior conversion settles');
  eq(f.tracks[1].stops,0,'old callback never stops newer stream');f.camera.dispose();eq(f.tracks[1].stops,1,'current disposal stops own stream');
}
{
  const f=fixture();f.identity='';eq(await f.camera.begin(),false,'no identity means no capture');
  f.identity='principal-A|session-A';f.visible=false;eq(await f.camera.begin(),false,'hidden cannot open camera');
  eq(f.requests.length,0,'rejected acquisition never requests media');f.camera.dispose();
}
{
  const f=fixture();await f.camera.begin();f.tracks[0].end();eq(f.camera.state(),'idle','hardware track ending cancels flow');
  eq(f.errors[0],'camera_ended','hardware ending explicitly reported');f.camera.dispose();
}
console.log(JSON.stringify({status:'PASS_IN_APP_CAMERA_CONTROLLER_ONLY',checks,
  notProven:['native permission gate','actual image encoder','page integration','draft persistence','actual camera','Fully containment','independent review']}));
