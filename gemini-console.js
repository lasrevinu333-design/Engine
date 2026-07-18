(function(){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com/gemini-api';
  const MAX_FILE_BYTES=6*1024*1024;
  const MAX_ATTACHMENTS=8;
  const DB_NAME='memphis-gemini-console';
  const DB_STORE='outbox';
  const state={session:null,conversations:[],conversation:null,messages:[],attachments:[],busy:false,submitting:false,abort:null,userMessageId:'',draftTimer:null};
  const el={authGate:q('#auth-gate'),authStatus:q('#auth-status'),app:q('#app'),sidebar:q('#sidebar'),sidebarOpen:q('#sidebar-open'),sidebarClose:q('#sidebar-close'),newChat:q('#new-chat'),searchInput:q('#search-input'),searchButton:q('#search-button'),conversationList:q('#conversation-list'),title:q('#conversation-title'),status:q('#status'),rename:q('#rename-chat'),delete:q('#delete-chat'),transcript:q('#transcript'),welcome:q('#welcome'),drop:q('#drop-zone'),attachmentList:q('#attachment-list'),input:q('#message-input'),attach:q('#attach-button'),fileInput:q('#file-input'),send:q('#send-button'),stop:q('#stop-button')};
  init().catch(lock);

  function q(selector){return document.querySelector(selector);}
  function uuid(){return crypto.randomUUID();}
  function setStatus(text,type=''){el.status.textContent=text;el.status.className=`status ${type}`.trim();}
  function lock(error){el.app.hidden=true;el.authGate.hidden=false;el.authStatus.textContent=error?.message||'A trusted Ops Manager device is required.';}
  function openApp(){el.authGate.hidden=true;el.app.hidden=false;}

  async function init(){
    bind();
    state.session=await window.MemphisAuth.requireOpsManagerSession({accessLevel:'full_access',interactive:false,redirect:true,throwOnFailure:true});
    if(!state.session||window.MemphisAuth.isReadOnlySession(state.session))throw new Error('Full-access trusted Ops Manager access is required.');
    openApp();
    await loadConversations();
    if(!state.conversations.length)await createConversation();
    else await selectConversation(state.conversations[0].conversation_id);
    await resumeOutbox();
  }

  function bind(){
    el.sidebarOpen.addEventListener('click',()=>el.sidebar.classList.add('open'));
    el.sidebarClose.addEventListener('click',()=>el.sidebar.classList.remove('open'));
    el.newChat.addEventListener('click',()=>createConversation().catch(showError));
    el.searchButton.addEventListener('click',()=>search().catch(showError));
    el.searchInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();search().catch(showError);}});
    el.rename.addEventListener('click',()=>renameConversation().catch(showError));
    el.delete.addEventListener('click',()=>deleteConversation().catch(showError));
    el.attach.addEventListener('click',()=>el.fileInput.click());
    el.fileInput.addEventListener('change',()=>addFiles([...el.fileInput.files]).finally(()=>{el.fileInput.value='';}));
    el.send.addEventListener('click',()=>sendCurrent().catch(showError));
    el.stop.addEventListener('click',stopResponse);
    el.input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendCurrent().catch(showError);}});
    el.input.addEventListener('input',()=>{autoSize();scheduleDraftSave();});
    ['dragenter','dragover'].forEach(name=>el.drop.addEventListener(name,event=>{event.preventDefault();el.drop.classList.add('dragging');}));
    ['dragleave','drop'].forEach(name=>el.drop.addEventListener(name,event=>{event.preventDefault();el.drop.classList.remove('dragging');}));
    el.drop.addEventListener('drop',event=>addFiles([...event.dataTransfer.files]));
    document.addEventListener('paste',event=>{const images=[...(event.clipboardData?.files||[])].filter(file=>file.type.startsWith('image/'));if(images.length){event.preventDefault();addFiles(images);}});
  }

  async function headers(json=false){const value=await window.MemphisAuth.opsManagerAuthHeaders();if(json)value['Content-Type']='application/json';return value;}
  async function api(path,options={}){
    const response=await fetch(`${API}${path}`,{cache:'no-store',credentials:'include',...options,headers:{...(await headers(Boolean(options.body))),...(options.headers||{})}});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!payload?.ok){const error=new Error(payload?.error||`HTTP ${response.status}`);error.status=response.status;throw error;}
    return payload;
  }

  async function loadConversations(){const payload=await api('/conversations?limit=100');state.conversations=payload.data||[];renderConversations();}
  function renderConversations(){
    el.conversationList.replaceChildren();
    if(!state.conversations.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No conversations yet.';el.conversationList.append(empty);return;}
    state.conversations.forEach(item=>{const button=document.createElement('button');button.type='button';button.className=`conversation-item${state.conversation?.conversation_id===item.conversation_id?' active':''}`;button.dataset.id=item.conversation_id;const name=document.createElement('span');name.className='conversation-name';name.textContent=item.title||'New chat';const time=document.createElement('span');time.className='conversation-time';time.textContent=formatTime(item.last_activity_at);button.append(name,time);button.addEventListener('click',()=>selectConversation(item.conversation_id).catch(showError));el.conversationList.append(button);});
  }
  async function createConversation(){if(state.busy)return;const payload=await api('/conversations',{method:'POST',body:JSON.stringify({client_operation_id:uuid(),title:'New chat'})});await loadConversations();await selectConversation(payload.data.conversation_id);el.input.focus();}
  async function selectConversation(id){
    if(state.busy&&state.conversation?.conversation_id!==id)return;
    const item=state.conversations.find(row=>row.conversation_id===id);if(!item)return;
    state.conversation=item;state.attachments=[];el.input.value=item.draft_text||'';autoSize();renderAttachments();renderConversations();el.title.textContent=item.title||'New chat';el.sidebar.classList.remove('open');setStatus('Loading…','working');
    const payload=await api(`/conversations/${encodeURIComponent(id)}/messages?limit=100`);state.messages=payload.data||[];renderTranscript();setStatus('Ready');
  }
  async function renameConversation(){if(!state.conversation)return;const value=window.prompt('Conversation name',state.conversation.title||'New chat');if(value==null)return;const payload=await api(`/conversations/${state.conversation.conversation_id}`,{method:'PATCH',body:JSON.stringify({title:value})});Object.assign(state.conversation,payload.data);await loadConversations();el.title.textContent=payload.data.title;}
  async function deleteConversation(){if(!state.conversation||!window.confirm('Delete this conversation from the Console?'))return;await api(`/conversations/${state.conversation.conversation_id}`,{method:'DELETE'});state.conversation=null;state.messages=[];await loadConversations();if(state.conversations.length)await selectConversation(state.conversations[0].conversation_id);else await createConversation();}
  async function search(){const text=el.searchInput.value.trim();if(!text){await loadConversations();return;}const payload=await api(`/search?q=${encodeURIComponent(text)}`);const ids=[...new Set((payload.data||[]).map(row=>row.conversation_id))];state.conversations=state.conversations.sort((a,b)=>ids.indexOf(a.conversation_id)-ids.indexOf(b.conversation_id)).filter(item=>ids.includes(item.conversation_id));renderConversations();setStatus(`${ids.length} matching conversation${ids.length===1?'':'s'}`);}

  function renderTranscript(){
    el.transcript.replaceChildren();
    if(!state.messages.length){el.transcript.append(el.welcome);el.welcome.hidden=false;return;}
    state.messages.forEach(message=>el.transcript.append(messageNode(message)));
    scrollBottom();
  }
  function messageNode(message){
    const wrap=document.createElement('article');wrap.className=`message ${message.role==='assistant'?'assistant':'user'}${['failed','cancelled'].includes(message.state)?' failed':''}`;wrap.dataset.messageId=message.message_id||'';
    const bubble=document.createElement('div');bubble.className='bubble';const text=document.createElement('div');text.className='message-text';text.textContent=message.body||'';bubble.append(text);
    const meta=document.createElement('div');meta.className='message-meta';const stamp=document.createElement('span');stamp.textContent=`${message.state||'completed'} · ${formatTime(message.created_at)}`;meta.append(stamp);
    if(message.role==='user'&&['failed','cancelled'].includes(message.state)){const retry=document.createElement('button');retry.type='button';retry.className='retry-button';retry.textContent='Retry';retry.addEventListener('click',()=>retryMessage(message).catch(showError));meta.append(retry);}
    bubble.append(meta);wrap.append(bubble);return wrap;
  }
  function appendAssistantStream(){const message={message_id:`stream-${Date.now()}`,role:'assistant',body:'',state:'generating',created_at:new Date().toISOString()};state.messages.push(message);const node=messageNode(message);el.transcript.append(node);return{message,node,text:node.querySelector('.message-text'),meta:node.querySelector('.message-meta')};}
  function appendCard(kind,data){const card=document.createElement('section');card.className=kind==='proposal'?'proposal-card':'job-card';const title=document.createElement('h3');title.textContent=kind==='proposal'?'Repair proposal ready':'Controlled repair job';const body=document.createElement('p');if(kind==='proposal'){body.textContent=data.repair_kind==='acceptance_probe'?'Disposable acceptance proposal ready. Eric may authorize it with a direct follow-up.':'Review the displayed recommendation. Only Eric may authorize this exact active proposal with a clear direct follow-up.';}else{body.textContent=`Status: ${data.status}. ${data.execution_mode==='controlled_worker'?'No completion is claimed until backup, tests, deployment, and verification are recorded.':'The disposable control-flow probe changed no production feature.'}`;}card.append(title,body);el.transcript.append(card);scrollBottom();}

  async function addFiles(files){
    if(!state.conversation||!files.length)return;
    for(const file of files){
      if(state.attachments.length>=MAX_ATTACHMENTS){showError(new Error(`Maximum ${MAX_ATTACHMENTS} attachments.`));break;}
      if(file.size<1||file.size>MAX_FILE_BYTES){showError(new Error(`${file.name} must be between 1 byte and 6 MB.`));continue;}
      const local={localId:uuid(),name:file.name,size:file.size,status:'uploading',attachment_id:null};state.attachments.push(local);renderAttachments();
      try{const base64=await fileBase64(file);const payload=await api(`/conversations/${state.conversation.conversation_id}/attachments`,{method:'POST',body:JSON.stringify({filename:file.name,mime_type:file.type||mimeFallback(file.name),data_base64:base64})});Object.assign(local,payload.data,{status:'ready'});}catch(error){local.status='failed';local.error=error.message;}renderAttachments();
    }
  }
  function renderAttachments(){el.attachmentList.replaceChildren();state.attachments.forEach(item=>{const chip=document.createElement('div');chip.className=`attachment-chip ${item.status}`;const name=document.createElement('span');name.textContent=`${item.name||item.original_filename} · ${formatBytes(item.size||item.size_bytes)}`;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${item.name||item.original_filename}`);remove.addEventListener('click',()=>removeAttachment(item).catch(showError));chip.append(name,remove);el.attachmentList.append(chip);});}
  async function removeAttachment(item){if(item.attachment_id&&item.status==='ready')await api(`/attachments/${item.attachment_id}`,{method:'DELETE'});state.attachments=state.attachments.filter(row=>row.localId!==item.localId);renderAttachments();}

  async function sendCurrent(existing=null){
    if(state.busy||state.submitting||!state.conversation)return;
    const body=existing?.body||el.input.value.trim();if(!body)return;
    if(state.attachments.some(item=>item.status==='uploading')){setStatus('Wait for attachments to finish uploading.','error');return;}
    if(state.attachments.some(item=>item.status==='failed')){setStatus('Remove failed attachments before sending.','error');return;}
    state.submitting=true;toggleBusy(true);
    try{
      const record=existing||{client_message_id:uuid(),correlation_id:uuid(),conversation_id:state.conversation.conversation_id,body,attachment_ids:state.attachments.map(item=>item.attachment_id),created_at:new Date().toISOString(),state:'queued'};
      await outboxPut(record);
      if(!existing){state.messages.push({message_id:`local-${record.client_message_id}`,role:'user',body,state:'queued',client_message_id:record.client_message_id,created_at:record.created_at});el.input.value='';state.attachments=[];renderAttachments();renderTranscript();scheduleDraftSave(true);}
      await streamRecord(record);
    }finally{state.submitting=false;if(!state.busy)toggleBusy(false);}
  }
  async function streamRecord(record){
    state.busy=true;state.abort=new AbortController();state.userMessageId='';toggleBusy(true);setStatus('Queued','working');const assistant=appendAssistantStream();
    try{
      const response=await fetch(`${API}/conversations/${record.conversation_id}/messages/stream`,{method:'POST',cache:'no-store',credentials:'include',headers:{...(await headers(true))},signal:state.abort.signal,body:JSON.stringify(record)});
      if(!response.ok||!response.body)throw new Error(`Request failed: HTTP ${response.status}`);
      await readEventStream(response.body,event=>{
        if(event.type==='status')setStatus(event.data.label||event.data.state,'working');
        else if(event.type==='user_message'){state.userMessageId=event.data.message_id||'';}
        else if(event.type==='delta'){assistant.message.body+=event.data.text||'';assistant.text.textContent=assistant.message.body;scrollBottom();}
        else if(event.type==='message'){assistant.message={...event.data};assistant.text.textContent=event.data.body||assistant.message.body;assistant.meta.textContent=`${event.data.state||'completed'} · ${formatTime(event.data.created_at)}`;}
        else if(event.type==='proposal')appendCard('proposal',event.data);
        else if(event.type==='repair_job')appendCard('job',event.data);
        else if(event.type==='error')throw new Error(event.data.message||'Response failed.');
      });
      await outboxDelete(record.client_message_id);await loadConversations();await refreshMessages();setStatus('Ready');
    }catch(error){
      if(error.name==='AbortError')setStatus('Response stopped.','error');else setStatus(error.message||'Response failed.','error');
      assistant.message.state=error.name==='AbortError'?'cancelled':'failed';assistant.node.classList.add('failed');assistant.meta.textContent=assistant.message.state;
    }finally{state.busy=false;state.abort=null;toggleBusy(false);}
  }
  async function retryMessage(message){const record=(await outboxAll()).find(item=>item.client_message_id===message.client_message_id);if(record)await sendCurrent(record);else showError(new Error('The durable retry record is unavailable. Send the message again.'));}
  async function refreshMessages(){if(!state.conversation)return;const payload=await api(`/conversations/${state.conversation.conversation_id}/messages?limit=100`);state.messages=payload.data||[];renderTranscript();}
  function stopResponse(){state.abort?.abort();if(state.userMessageId)api(`/messages/${state.userMessageId}/cancel`,{method:'POST',body:'{}'}).catch(()=>{});}
  function toggleBusy(value){el.send.disabled=value;el.attach.disabled=value;el.newChat.disabled=value;el.stop.hidden=!value;el.send.hidden=value;}

  function scheduleDraftSave(immediate=false){clearTimeout(state.draftTimer);if(!state.conversation)return;state.draftTimer=setTimeout(()=>api(`/conversations/${state.conversation.conversation_id}`,{method:'PATCH',body:JSON.stringify({draft_text:el.input.value})}).then(payload=>Object.assign(state.conversation,payload.data)).catch(()=>{}),immediate?0:500);}
  async function resumeOutbox(){const rows=(await outboxAll()).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)));for(const record of rows){if(state.busy)break;if(!state.conversations.some(item=>item.conversation_id===record.conversation_id)){await outboxDelete(record.client_message_id);continue;}if(state.conversation?.conversation_id!==record.conversation_id)await selectConversation(record.conversation_id);setStatus('Recovering an interrupted message…','working');await streamRecord(record);}}

  async function readEventStream(stream,onEvent){const reader=stream.getReader();const decoder=new TextDecoder();let buffer='';while(true){const{value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const frames=buffer.split(/\r?\n\r?\n/);buffer=frames.pop()||'';for(const frame of frames)parseFrame(frame,onEvent);if(done)break;}if(buffer.trim())parseFrame(buffer,onEvent);}
  function parseFrame(frame,onEvent){let type='message';let data='';frame.split(/\r?\n/).forEach(line=>{if(line.startsWith('event:'))type=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trim();});if(!data)return;let parsed;try{parsed=JSON.parse(data);}catch{return;}onEvent({type,data:parsed});}

  function db(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(DB_STORE,{keyPath:'client_message_id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function outboxPut(record){const database=await db();await txPromise(database,'readwrite',store=>store.put(record));database.close();}
  async function outboxDelete(id){const database=await db();await txPromise(database,'readwrite',store=>store.delete(id));database.close();}
  async function outboxAll(){const database=await db();const rows=await txPromise(database,'readonly',store=>store.getAll());database.close();return rows||[];}
  function txPromise(database,mode,action){return new Promise((resolve,reject)=>{const tx=database.transaction(DB_STORE,mode);const request=action(tx.objectStore(DB_STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tx.onerror=()=>reject(tx.error);});}

  function fileBase64(file){return file.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer);let binary='';const size=0x8000;for(let i=0;i<bytes.length;i+=size)binary+=String.fromCharCode(...bytes.subarray(i,i+size));return btoa(binary);});}
  function mimeFallback(name){const ext=String(name).toLowerCase().split('.').pop();return{png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',log:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext]||'application/octet-stream';}
  function formatBytes(value){const size=Number(value||0);if(size<1024)return`${size} B`;if(size<1024*1024)return`${(size/1024).toFixed(1)} KB`;return`${(size/1024/1024).toFixed(1)} MB`;}
  function formatTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return'';return date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'});}
  function autoSize(){el.input.style.height='auto';el.input.style.height=`${Math.min(el.input.scrollHeight,210)}px`;}
  function scrollBottom(){requestAnimationFrame(()=>{el.transcript.scrollTop=el.transcript.scrollHeight;});}
  function showError(error){setStatus(error?.message||String(error),'error');}
})();
