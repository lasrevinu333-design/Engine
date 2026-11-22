import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {createMessageHistory} from '../mobile/src/chatscope/message-history.mjs';
const source=readFileSync(new URL('../mobile/src/chatscope/app.jsx',import.meta.url),'utf8');
const require=createRequire(new URL('../mobile/package.json',import.meta.url));
const {transformSync}=require('esbuild');
const callback=(name,next)=>source.slice(source.indexOf(`  const ${name} = `),source.indexOf(`  const ${next} = `,source.indexOf(`  const ${name} = `)));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const A='thread-karen',B='thread-eric';
function fixture(){
 const mapped={msg_user_id:'synthetic-manager',read_only:false};const requests=[],state={loading:false,messages:[],selected:A,threads:[]};
 const c={useCallback:fn=>fn,EMPLOYEE_CONTEXT:false,currentDeviceId:'synthetic-device',mounted:{current:true},identityRef:{current:mapped},accessEpoch:{current:1},selectedRef:{current:A},
  threadSelectionEpoch:{current:0},threadListLoadSequence:{current:0},directOpenListRead:{current:null},messageLoadSequence:{current:0},historyRef:{current:null},threadsRef:{current:[]},mobileThreadRef:{current:true},
  originalManagerOutboxOwner:()=>()=>{},custodialWorkUnavailable:()=>Error('stale profile'),loadIdentity:async()=>mapped,createMessageHistory,mergePendingMessages:rows=>rows,
  setMessages:rows=>{state.messages=rows;},setLoadingMessages:value=>{state.loading=value;},setLoadingOlderMessages(){},setHasOlderMessages(){},setThreads:rows=>{state.threads=rows;},setSelectedId:id=>{state.selected=id;},setMobileThread(){},setNotice(){},
  isRetiredThread:()=>false,normalizedThread:row=>row,pendingDeletedThreadIds:()=>new Set(),compareThreads:()=>0,location:{href:'https://fixture.invalid/messages.html'},URL,encodeURIComponent,
  api:path=>{const d=deferred();requests.push({path,...d});return d.promise;},markRead:async()=>{},window:{matchMedia:()=>({matches:false})},document:{visibilityState:'hidden'},
  homeAssistantEntry:{current:{cancel(){}}},setEmojiOpen(){},emojiRange:{current:null},draftsRef:{current:{}},setComposerTooLong(){},messageLength:s=>s.length,htmlMessageBody:s=>s,MAX_MESSAGE_LENGTH:2000,messageCursor:{current:{}},ZERO_TIME:'',ZERO_ID:'',history:{replaceState(){}},safe:String,
 };
 vm.createContext(c);
 vm.runInContext(callback('readThreadList','flushReadOutbox')+callback('loadMessages','loadEarlierMessages')+callback('selectThread','resolveHomeAssistant')+'\nglobalThis.callbacks={loadThreads,loadMessages,selectThread};',c);
 return {c,state,requests,...c.callbacks};
}
const rows=[{id:A},{id:B}];let passed=0;const failures=[];
async function check(name,run){try{await run();passed++;}catch(error){failures.push({name,error:error.message});}}
await check('late preferred Karen refresh cannot replace newer Eric selection',async()=>{
 const f=fixture(),p=f.loadThreads({preferId:A});f.selectThread(B);f.requests[0].resolve({data:rows});await p;assert.equal(f.c.selectedRef.current,B);assert.equal(f.state.selected,B);
});
await check('A/B/A intent defeats a captured B preference, including repeated same-thread clicks',async()=>{
 const f=fixture();f.selectThread(B);const p=f.loadThreads({preferId:B});f.selectThread(A);f.selectThread(A);
 f.requests.find(r=>r.path.startsWith('/threads?')).resolve({data:rows});await p;assert.equal(f.c.selectedRef.current,A);
 // No network is used; resolve the deliberate same-thread reload as well.
 for(const request of f.requests.filter(r=>!r.path.startsWith('/threads?')))request.resolve({data:[]});
});
await check('older thread-list result cannot replace a later reconciled list',async()=>{
 const f=fixture(),old=f.loadThreads(),fresh=f.loadThreads();f.requests[1].resolve({data:[{id:A,title:'current'}]});await fresh;
 f.requests[0].resolve({data:[{id:B,title:'stale'}]});await old;assert.equal(f.state.threads[0].title,'current');assert.equal(f.c.selectedRef.current,A);
});
await check('a sidebar poll cannot supersede the list confirming a new direct open',async()=>{
 const f=fixture(),confirm=f.loadThreads({preferId:B,confirmingDirectOpen:true}),poll=f.loadThreads();
 assert.equal(f.requests.length,1,'poll waits for the explicit list reconciliation');
 f.requests[0].resolve({data:rows});assert.ok((await confirm).some(row=>row.id===B));assert.equal(f.state.selected,B);
 assert.equal(f.requests.length,2,'poll still reads after the direct open');
 f.requests[1].resolve({data:rows});await poll;assert.equal(f.state.selected,B);
});
await check('failed direct confirmation releases polling without republishing a foreign identity',async()=>{
 const f=fixture(),confirm=f.loadThreads({preferId:B,confirmingDirectOpen:true}),poll=f.loadThreads();
 const rejected=assert.rejects(confirm,/list read failed/);
 f.c.accessEpoch.current+=1;f.c.identityRef.current={msg_user_id:'new-owner'};
 f.requests[0].reject(Error('list read failed'));await rejected;
 assert.equal((await poll).length,0);assert.equal(f.requests.length,1);assert.equal(f.c.directOpenListRead.current,null);
});
await check('list begun before a choice cannot erase the newly chosen conversation',async()=>{
 const f=fixture();f.c.threadsRef.current=rows;f.state.threads=rows;
 const p=f.loadThreads({preferId:A});f.selectThread(B);f.requests[0].resolve({data:[{id:A}]});await p;
 assert.equal(f.c.selectedRef.current,B);assert.ok(f.state.threads.some(row=>row.id===B));
});
await check('current list can still remove a retired selected thread',async()=>{
 const f=fixture(),p=f.loadThreads();f.requests[0].resolve({data:[]});await p;assert.equal(f.c.selectedRef.current,'');
});
await check('stale selected-id effect cannot overwrite the latest synchronous choice',async()=>{
 const start=source.indexOf('  useEffect(() => {\n    if (!selectedId'),end=source.indexOf('\n\n  useEffect(',start);assert.ok(start>0&&end>start);
 let reads=0;const c={selectedId:A,selectedRef:{current:B},loadMessages:async()=>{reads++;},setNotice(){},safe:String,useEffect:fn=>fn()};vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 assert.equal(c.selectedRef.current,B);assert.equal(reads,0);
});
await check('current background message read retires superseded foreground spinner',async()=>{
 const f=fixture(),old=f.loadMessages(A,{showLoading:true}),fresh=f.loadMessages(A);assert.equal(f.state.loading,true);
 f.requests[0].resolve({data:[]});await old;assert.equal(f.state.loading,true);
 f.requests[1].resolve({data:[{id:'current'}]});await fresh;assert.equal(f.state.loading,false);assert.equal(f.state.messages[0].id,'current');
});
await check('failed current background message read also retires spinner',async()=>{
 const f=fixture(),old=f.loadMessages(A,{showLoading:true}),fresh=f.loadMessages(A);const rejection=assert.rejects(fresh,/synthetic failure/);
 f.requests[1].reject(Error('synthetic failure'));await rejection;assert.equal(f.state.loading,false);f.requests[0].resolve({data:[]});await old;
});
await check('old thread reply cannot overwrite new thread or its spinner',async()=>{
 const f=fixture(),old=f.loadMessages(A,{showLoading:true});f.selectThread(B);const fresh=f.loadMessages(B,{showLoading:true});
 f.requests[0].resolve({data:[{id:'old'}]});await old;assert.equal(f.state.loading,true);assert.equal(f.state.messages.length,0);
 f.requests[1].resolve({data:[{id:'new'}]});await fresh;assert.equal(f.state.loading,false);assert.equal(f.state.messages[0].id,'new');
});
await check('newer profile epoch discards original reply without publishing',async()=>{
 const f=fixture(),p=f.loadMessages(A,{showLoading:true});f.c.accessEpoch.current++;f.c.identityRef.current={msg_user_id:'other'};
 f.requests[0].resolve({data:[{id:'foreign'}]});await p;assert.equal(f.state.messages.length,0);
});
await check('actual toolbar fragment always offers guarded New in either layout',async()=>{
 const start=source.indexOf('    <header className={`mz-chat-toolbar'),end=source.indexOf('</header>',start)+9;assert.ok(start>0&&end>start);
 const fragment=source.slice(start,end),code=transformSync(`globalThis.render=()=>(${fragment});`,{loader:'jsx',jsxFactory:'h',jsxFragment:'Fragment'}).code;
 for(const mobileThread of [false,true])for(const blocked of [false,true]){
  let opened=0;const c={mobileThread,EMPLOYEE_CONTEXT:false,identity:{msg_user_id:'synthetic',display_name:'Eric'},accessBlocked:blocked,assistantOpening:false,ZOO_LOGO:'',MEMPHIS_AVATAR:'',displayName:x=>x,roleTitle:()=>'',openNewConversation:()=>{opened++;},openAssistant(){},navigateBack(){},mobileThreadRef:{current:mobileThread},setMobileThread(){},h:(tag,props,...children)=>({tag,props:props||{},children})};
  vm.createContext(c);vm.runInContext(code,c);const tree=c.render();const flatten=n=>!n||typeof n!=='object'?[]:[n,...n.children.flatMap(flatten)];const button=flatten(tree).find(n=>n.tag==='button'&&n.children.includes('New'));
  assert.ok(button,'New must remain visible with a selected conversation');assert.equal(Boolean(button.props.disabled),blocked);if(!blocked){button.props.onClick();assert.equal(opened,1);}
 }
});
await check('identity annotations are removed from names, participant lists and explicit roles only',async()=>{
 const a=source.indexOf('function displayName('),b=source.indexOf('function isMemphis(thread)',a),c={RETIRED_KEY:'retired',RETIRED_TITLE:/^retired$/};vm.createContext(c);vm.runInContext(source.slice(a,b)+'\nglobalThis.helpers={displayName,roleTitle,normalizedThread};',c);
 assert.equal(c.helpers.roleTitle({role_title:'Custodial leadership (shared PIN)'}),'Custodial leadership');
 const body='Please write (shared PIN) on the test note';const t=c.helpers.normalizedThread({id:A,participant_names:'Eric (shared PIN), Karen',last_sender_name:'Eric (shared PIN)',last_message_body:body});
 assert.equal(t.participantNames,'Eric, Karen');assert.equal(t.last_sender_name,'Eric');assert.equal(t.last_message_body,body);
});
console.log(JSON.stringify({scope:'Actual source callbacks and toolbar JSX fragment; synthetic deferred reads, no staff messages, product bundle or browser',passed,failed:failures.length,failures},null,2));if(failures.length)process.exitCode=1;
