// Changed native-history consumer contract only. Stub registration is synthetic;
// no geographic control admission, browser or actual GPS/device proof is claimed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url), MAP=require('../dashboard-map-staging.js');
const FIT=require('../custodial-gps-approved-overall-fit.js');
const anchors=readFileSync(new URL('../dashboard-map-assets/approved-map-47-placement-anchors.json',import.meta.url));
class Element{
 constructor(){this.children=[];this.dataset={};this.style={setProperty(name,value){this[name]=value;}};this.clientWidth=600;this.clientHeight=400;this.attributes={};}
 append(...children){this.children.push(...children);}
 replaceChildren(...children){this.children=children;}
 addEventListener(){} removeEventListener(){} remove(){}
 setAttribute(key,value){this.attributes[key]=value;}
 querySelector(){return this.children.find(child=>child.dataset?.mapCallout!==undefined);}
}
const elements=Object.fromEntries(['viewport','surface','artwork','layer','status','alerts','selection','locations','alert-count','gps-layer','gps-status'].map(key=>[key,new Element()]));
const document={createElement:()=>new Element(),createElementNS:()=>new Element(),createTextNode:text=>({textContent:text})};
const section={querySelector:selector=>elements[selector.match(/^\[data-map-(.*)\]$/)?.[1]]};
const registration={project:()=>({ok:true,canvas:{x:10,y:20},uncertaintyCanvasPx:2})};
const context={MemphisDashboardMapStaging:MAP,MemphisCustodialGpsApprovedOverallFit:{...FIT,admit:()=>registration},crypto:webcrypto,document,fetch:async()=>({ok:true,arrayBuffer:async()=>Uint8Array.from(anchors).buffer}),matchMedia:()=>({matches:false}),addEventListener(){},removeEventListener(){},Date,Uint8Array};
vm.createContext(context);
vm.runInContext(readFileSync(new URL('../custodial-gps-path-model.js',import.meta.url),'utf8'),context);
const path=context.MemphisCustodialGpsPathModel.path;let pathCalls=0;
context.MemphisCustodialGpsPathModel={path:options=>{pathCalls++;return path(options);}};
vm.runInContext(readFileSync(new URL('../dashboard-map-renderer.js',import.meta.url),'utf8'),context);
const controller=context.MemphisDashboardMapRenderer.create({section,auth:{readSession:()=>({manager_id:'synthetic-manager',credential_id:'synthetic-credential',token:'synthetic-token'})},document,window:context});
await controller.init();
const now=Date.now(), time=n=>new Date(now+n).toISOString();
const session={sourceKind:'native_offline_context',uuid:'native-a',clientSessionId:'native-a',sessionId:null,contextId:'synthetic-context',employeeId:'original-worker',deviceIdentifier:'synthetic-device',locationCode:'synthetic-location',status:'active',startedAt:time(-60000)};
const observation=(id,delta,coords=true)=>({id,event_type:'work_position_check',session_id:null,session_uuid:'native-a',employee_id:'original-worker',device_identifier:'synthetic-device',location_code:'synthetic-location',payload_json:{session_uuid:'native-a',client_session_id:'native-a',observed_at:delta===null?null:time(delta),...(coords?{client_latitude:35,client_longitude:-90,accuracy_m:5}:{})}});
let checks=0;
const check=(name,work,fn)=>{const ticket=controller.beginRefresh();assert.equal(controller.acceptGps(ticket,{controls:{synthetic:true},work:[work]}),true);fn();checks++;console.log('PASS',name);};
check('native context null database session consumes strict external identity',{session,observations:[observation('one',-20000),observation('two',-10000)]},()=>{assert.equal(pathCalls,1);assert.equal(elements['gps-layer'].children.filter(x=>x.attributes.points).length,1);});
check('incomplete authority clears prior trajectory without path dispatch',{session,incomplete:true,observations:[observation('one',-20000),observation('two',-10000)]},()=>{assert.equal(pathCalls,1);assert.equal(elements['gps-layer'].children.length,0);assert.match(elements['gps-status'].textContent,/incomplete paths withheld/);});
check('truncated history is not rendered as a complete path',{session,truncated:true,observations:[observation('one',-20000),observation('two',-10000)]},()=>{assert.equal(pathCalls,1);assert.equal(elements['gps-layer'].children.length,0);});
check('unknown capture redacted marker withholds chronology and position',{session,observations:[observation('one',-20000),observation('unknown',null,false),observation('two',-10000)]},()=>{assert.equal(pathCalls,2);assert.equal(elements['gps-layer'].children.length,0);assert.match(elements['gps-status'].textContent,/capture chronology is unknown/);});
check('known redacted gap does not connect adjacent valid positions',{session,observations:[observation('one',-20000),observation('gap',-15000,false),observation('two',-10000)]},()=>{assert.equal(pathCalls,3);assert.equal(elements['gps-layer'].children.filter(x=>x.attributes.points).length,0);assert.equal(elements['gps-layer'].children.length,2,'recent point and uncertainty ring only');});
controller.stop();
console.log(JSON.stringify({status:'PASS_CHANGED_RENDERER_PATH_CONTRACT_SOURCE_ONLY',cases:checks,geographic_calibration:false,actual_browser:false,phone:false}));
