import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from './operations-dashboard-tests.mjs';
let passed=0;const failures=[];
async function check(name,fn){try{await fn();passed++;}catch(error){failures.push({name,error:error.message});}}
await check('six shared boards start moving, hover pauses and leaving resumes',()=>{
 for(const kind of ['events','schools','locations','tickets','spiceworks','city']){
  const f=fixture({audience:'public_readonly'});
  try{f.controller.openBoard(kind);f.step(0);f.step(100);assert.equal(f.content.scrollTop,3.2);
   f.content.emit('mouseenter');f.step(200);assert.equal(f.content.scrollTop,3.2);
   f.content.emit('mouseleave');f.step(300);assert.equal(f.content.scrollTop,6.4);
  }finally{f.clean();}
 }
});
await check('keyboard focus pauses reading and leaving content resumes',()=>{
 const f=fixture();try{f.controller.openBoard('locations');f.step(0);f.step(100);
  f.doc.emit('keydown',{key:'Tab'});f.content.focus();f.content.emit('focusin');f.step(200);assert.equal(f.content.scrollTop,3.2);
  f.elements['operations-board-speed'].focus();f.content.emit('focusout',{relatedTarget:f.elements['operations-board-speed']});f.step(300);assert.equal(f.content.scrollTop,6.4);
 }finally{f.clean();}
});
await check('pointer focus and wheel cannot strand scrolling after hover leaves',()=>{
 const f=fixture();try{f.controller.openBoard('locations');f.step(0);f.step(100);
  f.doc.emit('pointerdown');f.content.focus();f.content.emit('mouseenter');f.content.emit('focusin');f.content.emit('wheel');f.step(200);assert.equal(f.content.scrollTop,3.2);
  f.content.emit('mouseleave');f.step(300);assert.equal(f.content.scrollTop,6.4);
 }finally{f.clean();}
});
await check('touch and cancellation pause only while touching, without a pause latch',()=>{
 for(const ending of ['touchend','touchcancel']){const f=fixture();try{
  f.controller.openBoard('locations');f.step(0);f.step(100);f.content.emit('touchstart');f.step(200);assert.equal(f.content.scrollTop,3.2);
  f.content.emit(ending);f.step(300);f.step(400);assert.ok(f.content.scrollTop>3.2);
 }finally{f.clean();}}
});
await check('reduced motion is honored and turning it off resumes default scrolling',()=>{
 const f=fixture({reduced:true});try{f.controller.openBoard('locations');f.step(0);f.step(100);assert.equal(f.content.scrollTop,0);
  f.motion.matches=false;f.motion.emit('change');f.step(200);f.step(300);assert.equal(f.content.scrollTop,3.2);
  f.motion.matches=true;f.motion.emit('change');f.step(400);assert.equal(f.content.scrollTop,3.2);
  f.motion.matches=false;f.motion.emit('change');f.step(500);f.step(600);assert.equal(f.content.scrollTop,6.4);
 }finally{f.clean();}
});
await check('touch-emulated mouse hover cannot leave an invisible reading pause',()=>{
 const f=fixture();try{f.controller.openBoard('locations');f.step(0);f.step(100);
  f.content.emit('mouseenter');f.content.emit('touchstart');f.step(200);assert.equal(f.content.scrollTop,3.2);
  f.content.emit('touchend');f.content.emit('mouseenter',{sourceCapabilities:{firesTouchEvents:true}});f.step(300);f.step(400);assert.equal(f.content.scrollTop,6.4);
 }finally{f.clean();}
});
await check('visible board pause and fullscreen controls removed; speed and map fullscreen retained',()=>{
 for(const file of ['operations-dashboard.html','ops-viewer.html']){const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="(?:operations-board-pause|operations-board-fullscreen|operations-motion)"/);
  assert.match(html,/id="operations-board-speed"/);assert.match(html,/id="operations-map-fullscreen"/);
 }
 assert.doesNotMatch(readFileSync(new URL('../operations-dashboard.js',import.meta.url),'utf8'),/Native fullscreen unavailable/);
});
await check('Spiceworks ticker advances uniformly through unchanged refresh and minute redraw',async()=>{
 const f=fixture({audience:'public_readonly'}),track=f.elements['ops-spiceworks-ticker'];
 track.parentElement={clientWidth:300,scrollLeft:0,parentElement:f.elements['operations-panels']};track.getBoundingClientRect=()=>({width:2400});track.style={setProperty(){}};
 const now=Date.parse('2026-10-05T17:00:00Z'),feed={ok:true,data:{schema:'custodial.operations-board.v1',timezone:'America/Chicago',generated_at:new Date(now).toISOString(),events:[],schools:{state:'unavailable'},spiceworks:{state:'unavailable'},spiceworks_activity:{state:'snapshot',coverage:'imported_only',mailbox_completeness_verified:false,generated_at:new Date(now).toISOString(),rows:[{ticket_id:'12',kind:'opened',at:new Date(now-1000).toISOString(),title:'Synthetic notice'}]}}};
 const refresh=()=>f.controller.refresh({headers:{},isCurrent:()=>true,summary:{open_tickets:[]},fetchImpl:async url=>({ok:true,json:async()=>url.endsWith('/operations')?feed:null})});
 try{await refresh();const first=track.children[0];f.step(0);for(let i=1;i<=100;i++){if(i===40)await refresh();if(i===70){f.setNow(now+60000);f.controller.tick();}f.step(i*16);assert.ok(Math.abs(track.parentElement.scrollLeft-i*42*.016)<1e-9);assert.equal(track.children[0],first);}
 }finally{f.clean();}
});
console.log(JSON.stringify({scope:'Actual operations controller, synthetic DOM geometry and animation clock; no browser rendering or real feed mutation',passed,failed:failures.length,failures},null,2));if(failures.length)process.exitCode=1;
