import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { freezeVideoFrame, encodeCameraJpeg } from '../mobile/src/custodial/in-app-camera-image.js';

// Actual encoder control/bounds with explicitly synthetic canvas and decode.
// JPEG decodability, image quality and real WebView memory limits are NOT proved.
let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const rejects=async(fn,label)=>{await assert.rejects(fn,label);checks++;};
const url=bytes=>'data:image/jpeg;base64,'+Buffer.from(bytes).toString('base64');
const fixture=(overrides={})=>{
  const f={canvases:[],decoded:[],encodings:[],drawn:[],closed:0};
  const frame={width:1920,height:1080,draw:(context,width,height)=>{f.drawn.push([width,height]);}};
  const deps={
    createCanvas(){const canvas={width:0,height:0,getContext:()=>({drawImage(){}}),toDataURL(type,quality){f.encodings.push({type,quality,width:canvas.width,height:canvas.height});return url([255,216,255,217]);}};f.canvases.push(canvas);return canvas;},
    async decode(blob){f.decoded.push(blob);const canvas=f.canvases.at(-1);return{width:canvas.width,height:canvas.height,close(){f.closed++;}};},
    digest:bytes=>webcrypto.subtle.digest('SHA-256',bytes),fromBase64:value=>Buffer.from(value,'base64').toString('binary'),makeBlob:bytes=>bytes,
    ...overrides,
  };
  return {...f,frame,deps,observed:f};
};
for(const profile of ['cleaning','feedback']){
  const f=fixture();const result=await encodeCameraJpeg(f.frame,profile,f.deps);
  eq(result.width,profile==='cleaning'?768:1600,profile+' maximum dimension');
  eq(result.height,profile==='cleaning'?432:900,profile+' aspect ratio');
  eq(result.content_type,'image/jpeg',profile+' exact output MIME');
  eq(result.decoded_bytes,4,profile+' decoded bytes measured');
  eq(result.sha256,Buffer.from(await webcrypto.subtle.digest('SHA-256',new Uint8Array([255,216,255,217]))).toString('hex'),profile+' real SHA256');
  eq(Object.keys(result).sort(),['content_type','data_url','decoded_bytes','height','sha256','width'],profile+' no EXIF filename location or remote URL');
  eq(f.observed.closed,1,profile+' decode bitmap closed');eq(f.canvases[0].width,0,profile+' canvas released');
  eq(f.encodings.length,1,profile+' first bounded frame needs one encode');
}
for(const name of ['', '__proto__','constructor','toString',null,{},'unexpected']){
  const f=fixture();await rejects(()=>encodeCameraJpeg(f.frame,name,f.deps),'unknown profiles rejected');eq(f.canvases.length,0,'no allocation for unknown profile');
}
for(const dimensions of [[0,10],[10,0],[-1,2],[1.5,2],[8193,1],[8192,8192],[NaN,1],[Infinity,1]]){
  const f=fixture();await rejects(()=>encodeCameraJpeg({...f.frame,width:dimensions[0],height:dimensions[1]},'cleaning',f.deps),'invalid oversized frame rejected');
  eq(f.canvases.length,0,'reject dimensions before allocation');
}
{
  const f=fixture();f.frame.width=10;f.frame.height=8;
  const result=await encodeCameraJpeg(f.frame,'cleaning',f.deps);eq([result.width,result.height],[10,8],'never upscale small images');
}
for(const bad of ['data:image/png;base64,/9j/2Q==','data:image/jpeg;base64,','data:image/jpeg;base64,@@@','data:image/jpeg;base64,SGVsbG8=', 'https://example.invalid/private.jpg']){
  const f=fixture();const create=f.deps.createCanvas;f.deps.createCanvas=()=>{const canvas=create();canvas.toDataURL=()=>bad;return canvas;};
  await rejects(()=>encodeCameraJpeg(f.frame,'cleaning',f.deps),'invalid format/base64/JPEG rejected');
  eq(f.canvases[0].width,0,'bad output releases canvas');eq(f.decoded.length,0,'bad envelope never decoded');
}
{
  const f=fixture();const create=f.deps.createCanvas;
  f.deps.createCanvas=()=>{const canvas=create();canvas.toDataURL=(type,quality)=>{f.encodings.push({type,quality});return 'x'.repeat(22001);};return canvas;};
  await rejects(()=>encodeCameraJpeg(f.frame,'cleaning',f.deps),'unachievable compression rejected');
  eq(f.encodings.length,20,'finite five dimensions times four qualities');eq(f.decoded.length,0,'oversized output not decoded');eq(f.canvases[0].width,0,'oversize releases canvas');
}
{
  const f=fixture();const create=f.deps.createCanvas;let attempts=0;
  f.deps.createCanvas=()=>{const canvas=create();canvas.toDataURL=()=>++attempts<=4?'x'.repeat(22001):url([255,216,255,217]);return canvas;};
  const image=await encodeCameraJpeg(f.frame,'cleaning',f.deps);
  eq(attempts,5,'shrinks only after bounded quality sequence');eq(image.width,614,'next bounded dimension');
}
for(const failure of ['decode-error','dimension-mismatch','digest-error','bad-digest','missing-context']){
  const f=fixture();
  if(failure==='decode-error')f.deps.decode=async()=>{throw Error('synthetic decode');};
  if(failure==='dimension-mismatch')f.deps.decode=async()=>({width:2,height:2,close(){f.observed.closed++;}});
  if(failure==='digest-error')f.deps.digest=async()=>{throw Error('synthetic digest');};
  if(failure==='bad-digest')f.deps.digest=async()=>new Uint8Array(31);
  if(failure==='missing-context'){const create=f.deps.createCanvas;f.deps.createCanvas=()=>{const canvas=create();canvas.getContext=()=>null;return canvas;};}
  await rejects(()=>encodeCameraJpeg(f.frame,'cleaning',f.deps),failure+' rejects');
  eq(f.canvases[0].width,0,failure+' canvas cleaned');
  if(failure==='dimension-mismatch'||failure.includes('digest'))eq(f.observed.closed,1,failure+' bitmap cleaned');
}
{
  let drawn=0;const canvas={width:0,height:0,getContext:()=>({drawImage(){drawn++;}})};
  const frame=freezeVideoFrame({videoWidth:1280,videoHeight:720},()=>canvas);
  eq(drawn,1,'snapshot draws synchronously exactly once');eq([frame.width,frame.height],[1280,720],'snapshot preserves measured dimensions');
  let copied=0;frame.draw({drawImage(){copied++;}},768,432);eq(copied,1,'frozen snapshot used for encoding');
  frame.close();frame.close();eq([canvas.width,canvas.height],[0,0],'frame cleanup releases backing pixels');
  assert.throws(()=>frame.draw({drawImage(){}},1,1));checks++;
}
console.log(JSON.stringify({status:'PASS_IN_APP_CAMERA_IMAGE_BOUNDS_ONLY',checks,
  notProven:['real JPEG decoding','readable photographs','actual WebView/camera','native permission','draft persistence','independent review']}));
