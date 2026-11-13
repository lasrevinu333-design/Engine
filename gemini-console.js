(function(){
  'use strict';
  const API='https://memphis-zoo-mcp.onrender.com/gemini-api';
  const MAX_FILE_BYTES=6*1024*1024;
  const MAX_ATTACHMENTS=8;
  const DB_NAME='memphis-gemini-console';
  const DB_STORE='outbox';
  // Local operation capabilities, never reconstructed from persisted queued
  // labels. Reload/another tab cannot prove an original was never attempted.
  const freshOutboxOriginals=new WeakSet(),admittedOutboxDispatches=new WeakSet();
  const state={session:null,conversations:[],conversation:null,selectedConversationGeneration:0,messages:[],proposals:[],jobs:[],attachments:[],busy:false,submitting:false,abort:null,userMessageId:'',draftTimer:null};
  const el={authGate:q('#auth-gate'),authStatus:q('#auth-status'),app:q('#app'),sidebar:q('#sidebar'),sidebarOpen:q('#sidebar-open'),sidebarClose:q('#sidebar-close'),newChat:q('#new-chat'),searchInput:q('#search-input'),searchButton:q('#search-button'),conversationList:q('#conversation-list'),title:q('#conversation-title'),status:q('#status'),rename:q('#rename-chat'),delete:q('#delete-chat'),transcript:q('#transcript'),welcome:q('#welcome'),drop:q('#drop-zone'),attachmentList:q('#attachment-list'),input:q('#message-input'),attach:q('#attach-button'),fileInput:q('#file-input'),send:q('#send-button'),stop:q('#stop-button')};
  syncViewportHeight();
  init().catch(lock);

  function q(selector){return document.querySelector(selector);}
  function uuid(){return crypto.randomUUID();}
  function setStatus(text,type=''){el.status.textContent=text;el.status.className=`status ${type}`.trim();}
  function lock(error){el.app.hidden=true;el.authGate.hidden=false;el.authStatus.textContent=error?.message||'A trusted Ops Manager device is required.';}
  function openApp(){syncViewportHeight();el.authGate.hidden=true;el.app.hidden=false;requestAnimationFrame(syncViewportHeight);}
  function syncViewportHeight(){
    const viewportHeight=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight));
    document.documentElement.style.setProperty('--gemini-viewport-height',`${viewportHeight}px`);
  }

  async function init(){
    bind();
    state.session=await window.MemphisAuth.requireOpsManagerSession({accessLevel:'full_access',interactive:false,redirect:true,throwOnFailure:true});
    if(!state.session||window.MemphisAuth.isReadOnlySession(state.session))throw new Error('Full-access trusted Ops Manager access is required.');
    openApp();
    await loadConversations();
    if(!state.conversations.length)await createConversation();
    else await selectConversation(state.conversations[0].conversation_id);
  }

  function bind(){
    window.addEventListener('resize',syncViewportHeight,{passive:true});
    window.visualViewport?.addEventListener('resize',syncViewportHeight,{passive:true});
    window.visualViewport?.addEventListener('scroll',syncViewportHeight,{passive:true});
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

  async function loadConversations(guard){const payload=await api('/conversations?limit=100');guard?.();state.conversations=payload.data||[];renderConversations();}
  function renderConversations(){
    el.conversationList.replaceChildren();
    if(!state.conversations.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='No conversations yet.';el.conversationList.append(empty);return;}
    state.conversations.forEach(item=>{const button=document.createElement('button');button.type='button';button.className=`conversation-item${state.conversation?.conversation_id===item.conversation_id?' active':''}`;button.dataset.id=item.conversation_id;const name=document.createElement('span');name.className='conversation-name';name.textContent=item.title||'New chat';const time=document.createElement('span');time.className='conversation-time';time.textContent=formatTime(item.last_activity_at);button.append(name,time);button.addEventListener('click',()=>selectConversation(item.conversation_id).catch(showError));el.conversationList.append(button);});
  }
  async function createConversation(){if(state.busy)return;const payload=await api('/conversations',{method:'POST',body:JSON.stringify({client_operation_id:uuid(),title:'New chat'})});await loadConversations();await selectConversation(payload.data.conversation_id);el.input.focus();}
  async function selectConversation(id){
    if(state.busy&&state.conversation?.conversation_id!==id)return;
    const item=state.conversations.find(row=>row.conversation_id===id);if(!item)return;
    const manager=captureManagerIdentity(),generation=state.selectedConversationGeneration+1;state.selectedConversationGeneration=generation;state.conversation=item;state.attachments=[];el.input.value=item.draft_text||'';autoSize();renderAttachments();renderConversations();el.title.textContent=item.title||'New chat';el.sidebar.classList.remove('open');setStatus('Loading…','working');
    const binding=captureConversationPage(item,generation,manager);
    try{
      const [messages,repair]=await Promise.all([
        managerPageApi(`/conversations/${encodeURIComponent(id)}/messages?limit=100`,binding),
        managerPageApi(`/conversations/${encodeURIComponent(id)}/repair-state`,binding),
      ]);
      if(!sameConversationPage(binding))return;
      state.messages=messages.data||[];state.proposals=repair.data?.proposals||[];state.jobs=repair.data?.jobs||[];renderTranscript();setStatus('Ready');
      await resumeOutbox();
    }catch(error){if(sameManagerSession(binding)&&!sameConversationPage(binding))return;throw error;}
  }
  async function renameConversation(){if(!state.conversation)return;const binding=captureConversationPage();const value=window.prompt('Conversation name',binding.conversation.title||'New chat');if(value==null)return;assertConversationPage(binding);const payload=await managerPageApi(`/conversations/${binding.conversation_id}`,binding,{method:'PATCH',body:JSON.stringify({title:value})});if(!sameConversationPage(binding))return;if(payload.data?.conversation_id!==binding.conversation_id)throw new Error('Conversation rename response did not match the original target.');Object.assign(binding.conversation,payload.data);const listing=await managerPageApi('/conversations?limit=100',binding);if(!sameConversationPage(binding))return;state.conversations=listing.data||[];renderConversations();el.title.textContent=payload.data.title;}
  async function deleteConversation(){if(!state.conversation)return;const binding=captureConversationPage();const confirmed=window.confirm('Delete this conversation from the Console?');if(!confirmed)return;assertConversationPage(binding);await managerPageApi(`/conversations/${binding.conversation_id}`,binding,{method:'DELETE'});if(!sameConversationPage(binding))return;let listing=await managerPageApi('/conversations?limit=100',binding);if(!sameConversationPage(binding))return;let conversations=listing.data||[];if(!conversations.length){const created=await managerPageApi('/conversations',binding,{method:'POST',body:JSON.stringify({client_operation_id:uuid(),title:'New chat'})});if(!sameConversationPage(binding))return;listing=await managerPageApi('/conversations?limit=100',binding);if(!sameConversationPage(binding))return;conversations=listing.data||[];if(!conversations.some(item=>item.conversation_id===created.data?.conversation_id))return;}state.conversations=conversations;state.conversation=null;state.selectedConversationGeneration++;state.messages=[];state.proposals=[];state.jobs=[];state.attachments=[];renderAttachments();renderConversations();if(state.conversations.length)await selectConversation(state.conversations[0].conversation_id);}
  async function search(){const text=el.searchInput.value.trim();if(!text){await loadConversations();return;}const payload=await api(`/search?q=${encodeURIComponent(text)}`);const ids=[...new Set((payload.data||[]).map(row=>row.conversation_id))];state.conversations=state.conversations.sort((a,b)=>ids.indexOf(a.conversation_id)-ids.indexOf(b.conversation_id)).filter(item=>ids.includes(item.conversation_id));renderConversations();setStatus(`${ids.length} matching conversation${ids.length===1?'':'s'}`);}

  function renderTranscript(){
    el.transcript.replaceChildren();
    if(!state.messages.length){el.transcript.append(el.welcome);el.welcome.hidden=false;}
    else state.messages.forEach(message=>el.transcript.append(messageNode(message)));
    renderRepairCards();
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
  function cardNode(kind,data){const card=document.createElement('section');card.className=kind==='proposal'?'proposal-card':'job-card';card.dataset.recordId=data.proposal_id||data.repair_job_id||'';const title=document.createElement('h3');title.textContent=kind==='proposal'?'Repair proposal ready':'Controlled repair job';const body=document.createElement('p');if(kind==='proposal'){body.textContent=data.repair_kind==='acceptance_probe'?'Disposable acceptance proposal ready. Eric may authorize it with a direct follow-up.':'Review the displayed recommendation. Only Eric may authorize this exact active proposal with a clear direct follow-up.';}else{body.textContent=`Status: ${data.status}. ${data.execution_mode==='controlled_worker'?'No completion is claimed until backup, tests, deployment, and verification are recorded.':'The disposable control-flow probe changed no production feature.'}`;}card.append(title,body);return card;}
  function renderRepairCards(){el.transcript.querySelectorAll('.proposal-card,.job-card').forEach(node=>node.remove());state.proposals.filter(item=>['proposed','authorized'].includes(item.status)).slice(0,1).forEach(item=>el.transcript.append(cardNode('proposal',item)));state.jobs.slice(0,5).forEach(item=>el.transcript.append(cardNode('job',item)));}
  function appendCard(kind,data){const list=kind==='proposal'?state.proposals:state.jobs;const key=kind==='proposal'?'proposal_id':'repair_job_id';const index=list.findIndex(item=>item[key]===data[key]);if(index>=0)list[index]=data;else list.unshift(data);renderRepairCards();scrollBottom();}

  async function addFiles(files){
    if(!state.conversation||!files.length)return;
    const binding=captureConversationPage(),target=binding.conversation,attachments=state.attachments;
    for(const file of files){
      if(!sameConversationPage(binding))return;
      if(attachments.length>=MAX_ATTACHMENTS){showError(new Error(`Maximum ${MAX_ATTACHMENTS} attachments.`));break;}
      if(file.size<1||file.size>MAX_FILE_BYTES){showError(new Error(`${file.name} must be between 1 byte and 6 MB.`));continue;}
      const local={localId:uuid(),name:file.name,size:file.size,status:'uploading',attachment_id:null,conversation_id:binding.conversation_id};attachments.push(local);renderAttachments();
      try{const base64=await fileBase64(file);assertConversationPage(binding);const payload=await managerPageApi(`/conversations/${encodeURIComponent(binding.conversation_id)}/attachments`,binding,{method:'POST',body:JSON.stringify({filename:file.name,mime_type:file.type||mimeFallback(file.name),data_base64:base64})});if(!sameConversationPage(binding))return;Object.assign(local,payload.data,{status:'ready'});}
      catch(error){if(!sameConversationPage(binding))return;local.status='failed';local.error=error.message;}
      if(!sameConversationPage(binding))return;renderAttachments();
    }
  }
  function renderAttachments(){el.attachmentList.replaceChildren();state.attachments.forEach(item=>{const chip=document.createElement('div');chip.className=`attachment-chip ${item.status}`;const name=document.createElement('span');name.textContent=`${item.name||item.original_filename} · ${formatBytes(item.size||item.size_bytes)}`;const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${item.name||item.original_filename}`);remove.addEventListener('click',()=>removeAttachment(item).catch(showError));chip.append(name,remove);el.attachmentList.append(chip);});}
  async function removeAttachment(item){const binding=captureConversationPage(),attachments=state.attachments;if(!attachments.includes(item))return;if(item.attachment_id&&item.status==='ready')await managerPageApi(`/attachments/${encodeURIComponent(item.attachment_id)}`,binding,{method:'DELETE'});if(!sameConversationPage(binding)||state.attachments!==attachments||!attachments.includes(item))return;state.attachments=attachments.filter(row=>row!==item);renderAttachments();}

  function captureManagerIdentity(){
    const session=window.MemphisAuth.readSession(),permissions=session?.permissions;
    if(!session||state.session!==session||session.role!=='ops_manager'
      ||['manager_id','credential_id','device_id','token','expires_at'].some(key=>typeof session[key]!=='string'||!session[key])
      ||!Number.isFinite(Date.parse(session.expires_at))||Date.parse(session.expires_at)<=Date.now()
      ||session.access_level!=='full_access'||session.read_only!==false
      ||permissions?.schema!=='custodial.manager-permissions.v1'||permissions.read!==true||!(permissions.owner===true||window.MemphisAuth.isCustodialManagementAdmin?.(session)===true))throw originalManagerChanged();
    return Object.freeze({session,role:session.role,manager_id:session.manager_id,
      credential_id:session.credential_id,device_id:session.device_id,token:session.token,expires_at:session.expires_at,
      access_level:session.access_level,read_only:session.read_only,permission_schema:permissions.schema,permission_read:permissions.read,permission_write:permissions.owner,permission_admin:window.MemphisAuth.isCustodialManagementAdmin?.(session)===true});
  }
  function captureConversationPage(conversation=state.conversation,generation=state.selectedConversationGeneration,manager=captureManagerIdentity()){
    if(!conversation?.conversation_id||conversation!==state.conversation||generation!==state.selectedConversationGeneration||!sameManagerSession(manager))throw originalManagerChanged();
    return Object.freeze({...manager,conversation,conversation_id:conversation.conversation_id,generation});
  }
  function sameManagerSession(binding){
    const session=window.MemphisAuth.readSession(),p=session?.permissions;
    return Boolean(binding&&session&&session===binding.session&&state.session===binding.session&&session.role===binding.role
      &&session.manager_id===binding.manager_id&&session.credential_id===binding.credential_id&&session.device_id===binding.device_id
      &&session.token===binding.token&&session.expires_at===binding.expires_at&&Number.isFinite(Date.parse(session.expires_at))
      &&Date.parse(session.expires_at)>Date.now()&&session.access_level===binding.access_level&&session.access_level==='full_access'
      &&session.read_only===binding.read_only&&session.read_only===false&&p?.schema===binding.permission_schema
      &&p.schema==='custodial.manager-permissions.v1'&&p.read===binding.permission_read&&p.read===true&&p.owner===binding.permission_write&&window.MemphisAuth.isCustodialManagementAdmin?.(session)===binding.permission_admin&&(p.owner===true||binding.permission_admin===true));
  }
  function sameConversationPage(binding){return Boolean(sameManagerSession(binding)&&state.conversation===binding.conversation
    &&state.conversation?.conversation_id===binding.conversation_id&&state.selectedConversationGeneration===binding.generation);}
  function assertConversationPage(binding){if(!sameConversationPage(binding))throw originalManagerChanged();}
  async function managerPageApi(path,binding,options={}){
    assertConversationPage(binding);const requestHeaders=await headers(Boolean(options.body));assertConversationPage(binding);
    const finalHeaders={...requestHeaders,...(options.headers||{})};
    if(finalHeaders.Authorization!==`Bearer ${binding.token}`||finalHeaders['X-Device-Id']!==binding.device_id)throw originalManagerChanged();
    const response=await fetch(`${API}${path}`,{cache:'no-store',credentials:'include',...options,headers:finalHeaders});
    assertConversationPage(binding);const payload=await response.json().catch(()=>null);assertConversationPage(binding);
    if(!response.ok||!payload?.ok){const error=new Error(payload?.error||`HTTP ${response.status}`);error.status=response.status;throw error;}return payload;
  }

  function captureOriginalManager(){
    const session=window.MemphisAuth.readSession(),permissions=session?.permissions;
    if(!session||state.session!==session||session.role!=='ops_manager'
      ||['manager_id','credential_id','device_id','token','expires_at'].some(key=>typeof session[key]!=='string'||!session[key])
      ||!Number.isFinite(Date.parse(session.expires_at))||Date.parse(session.expires_at)<=Date.now()
      ||session.access_level!=='full_access'||session.read_only!==false
      ||permissions?.schema!=='custodial.manager-permissions.v1'||permissions.read!==true||!(permissions.owner===true||window.MemphisAuth.isCustodialManagementAdmin?.(session)===true)
      ||!state.conversation?.conversation_id)throw originalManagerChanged();
    return Object.freeze({session,conversation:state.conversation,conversation_id:state.conversation.conversation_id,
      conversation_generation:state.selectedConversationGeneration,
      role:session.role,manager_id:session.manager_id,credential_id:session.credential_id,device_id:session.device_id,
      token:session.token,expires_at:session.expires_at,access_level:session.access_level,read_only:session.read_only,
      permission_schema:permissions.schema,permission_read:permissions.read,permission_write:permissions.owner,permission_admin:window.MemphisAuth.isCustodialManagementAdmin?.(session)===true});
  }
  function originalManagerChanged(){return Object.assign(new Error('Original manager session changed. Saved request remains held.'),{code:'gemini_original_manager_changed'});}
  function sameOriginalManager(binding){
    const session=window.MemphisAuth.readSession(),p=session?.permissions;
    return Boolean(binding&&session&&session===binding.session&&state.session===binding.session
      &&state.conversation===binding.conversation&&state.conversation?.conversation_id===binding.conversation_id
      &&state.selectedConversationGeneration===binding.conversation_generation
      &&session.role===binding.role&&session.manager_id===binding.manager_id
      &&session.credential_id===binding.credential_id&&session.device_id===binding.device_id
      &&session.token===binding.token&&session.expires_at===binding.expires_at
      &&Number.isFinite(Date.parse(session.expires_at))&&Date.parse(session.expires_at)>Date.now()
      &&session.access_level===binding.access_level&&session.access_level==='full_access'
      &&session.read_only===binding.read_only&&session.read_only===false
      &&p?.schema===binding.permission_schema&&p.schema==='custodial.manager-permissions.v1'
      &&p.read===binding.permission_read&&p.read===true&&p.owner===binding.permission_write&&window.MemphisAuth.isCustodialManagementAdmin?.(session)===binding.permission_admin&&(p.owner===true||binding.permission_admin===true));
  }
  function assertOriginalManager(binding,controller){if(!sameOriginalManager(binding)){controller?.abort();throw originalManagerChanged();}}
  async function originalStreamHeaders(binding,controller){
    assertOriginalManager(binding,controller);
    const value=await headers(true);
    assertOriginalManager(binding,controller);
    if(value.Authorization!==`Bearer ${binding.token}`||value['X-Device-Id']!==binding.device_id){controller?.abort();throw originalManagerChanged();}
    return value;
  }

  async function sendCurrent(existing=null){
    if(state.busy||state.submitting||!state.conversation)return;
    if(existing){setStatus('Saved original retained; exact outcome is unconfirmed. Retry is held until original status proof is available.','error');return;}
    const binding=captureOriginalManager();
    const body=existing?.body||el.input.value.trim();if(!body)return;
    if(state.attachments.some(item=>item.status==='uploading')){setStatus('Wait for attachments to finish uploading.','error');return;}
    if(state.attachments.some(item=>item.status==='failed')){setStatus('Remove failed attachments before sending.','error');return;}
    state.submitting=true;toggleBusy(true);
    try{
      const record=await outboxPut(existing||{client_message_id:uuid(),correlation_id:uuid(),conversation_id:state.conversation.conversation_id,body,attachment_ids:state.attachments.map(item=>item.attachment_id),created_at:new Date().toISOString(),state:'queued'},()=>sameOriginalManager(binding));
      assertOriginalManager(binding);
      if(!existing){state.messages.push({message_id:`local-${record.client_message_id}`,role:'user',body,state:'queued',client_message_id:record.client_message_id,created_at:record.created_at});el.input.value='';state.attachments=[];renderAttachments();renderTranscript();scheduleDraftSave(true);}
      await outboxAdmitDispatch(record,()=>sameOriginalManager(binding));
      assertOriginalManager(binding);
      await streamRecord(record,binding);
    }catch(error){if(error?.code==='gemini_original_manager_changed'){if(state.session===binding.session)lock(error);return;}throw error;
    }finally{if(state.session===binding.session){state.submitting=false;if(sameOriginalManager(binding)&&!state.busy)toggleBusy(false);}}
  }
  async function streamRecord(record,binding){
    if(!admittedOutboxDispatches.delete(record)){setStatus('Saved original retained; dispatch is held without its fresh durable admission.','error');return;}
    assertOriginalManager(binding);
    const controller=new AbortController();state.busy=true;state.abort=controller;state.streamBinding=binding;state.userMessageId='';toggleBusy(true);setStatus('Queued','working');const assistant=appendAssistantStream();
    try{
      const authenticatedHeaders=await originalStreamHeaders(binding,controller);
      assertOriginalManager(binding,controller);
      const dispatched=await mutateOutbox(()=>({response:fetch(`${API}/conversations/${record.conversation_id}/messages/stream`,{method:'POST',cache:'no-store',credentials:'include',headers:authenticatedHeaders,signal:controller.signal,body:JSON.stringify(record)})}),()=>sameOriginalManager(binding));
      const response=await dispatched.response;
      assertOriginalManager(binding,controller);
      if(!response.ok||!response.body)throw new Error(`Request failed: HTTP ${response.status}`);
      await readEventStream(response.body,event=>{
        assertOriginalManager(binding,controller);
        if(event.type==='status')setStatus(event.data.label||event.data.state,'working');
        else if(event.type==='user_message'){state.userMessageId=event.data.message_id||'';}
        else if(event.type==='delta'){assistant.message.body+=event.data.text||'';assistant.text.textContent=assistant.message.body;scrollBottom();}
        else if(event.type==='message'){assistant.message={...event.data};assistant.text.textContent=event.data.body||assistant.message.body;assistant.meta.textContent=`${event.data.state||'completed'} · ${formatTime(event.data.created_at)}`;}
        else if(event.type==='proposal')appendCard('proposal',event.data);
        else if(event.type==='repair_job')appendCard('job',event.data);
        else if(event.type==='error')throw new Error(event.data.message||'Response failed.');
      });
      // EOF and the correlation-only done event do not prove completion. The
      // fixed original read is the only path that can reconcile this row.
      const guard=()=>assertOriginalManager(binding,controller);
      guard();await loadConversations(guard);guard();await refreshMessages(guard);guard();await refreshRepairState(guard);guard();
      let completed=false;
      try{completed=await recoverOriginalOutcome(record,binding);}
      catch(error){if(error?.code==='gemini_original_manager_changed')throw error;}
      guard();setStatus(completed?'Persisted completed turn confirmed. Original local request reconciled.':
        'Response received. Saved original retained; its exact outcome remains unconfirmed.',completed?'':'error');
    }catch(error){
      if(error?.code==='gemini_original_manager_changed'||!sameOriginalManager(binding)){controller.abort();if(state.session===binding.session)lock(error);}
      else{if(error.name==='AbortError')setStatus('Response stopped.','error');else setStatus(error.message||'Response failed.','error');
        assistant.message.state=error.name==='AbortError'?'cancelled':'failed';assistant.node.classList.add('failed');assistant.meta.textContent=assistant.message.state;}
    }finally{if(state.abort===controller){state.busy=false;state.abort=null;state.streamBinding=null;if(sameOriginalManager(binding))toggleBusy(false);}}
  }
  async function retryMessage(message){const record=(await outboxAll()).find(item=>item.client_message_id===message.client_message_id);if(record)await sendCurrent(record);else showError(new Error('The durable original is unavailable. A replacement is not a safe retry of its unconfirmed outcome.'));}
  async function refreshMessages(guard){if(!state.conversation)return;const payload=await api(`/conversations/${state.conversation.conversation_id}/messages?limit=100`);guard?.();state.messages=payload.data||[];renderTranscript();}
  async function refreshRepairState(guard){if(!state.conversation)return;const payload=await api(`/conversations/${state.conversation.conversation_id}/repair-state`);guard?.();state.proposals=payload.data?.proposals||[];state.jobs=payload.data?.jobs||[];renderRepairCards();scrollBottom();}
  function stopResponse(){
    const controller=state.abort,binding=state.streamBinding,messageId=state.userMessageId;controller?.abort();
    if(!controller||!messageId||!sameOriginalManager(binding))return;
    originalStreamHeaders(binding,controller).then(value=>{assertOriginalManager(binding,controller);return fetch(`${API}/messages/${messageId}/cancel`,{method:'POST',cache:'no-store',credentials:'include',headers:value,body:'{}'});}).catch(()=>{});
  }
  function toggleBusy(value){el.send.disabled=value;el.attach.disabled=value;el.newChat.disabled=value;el.stop.hidden=!value;el.send.hidden=value;}

  function scheduleDraftSave(immediate=false){clearTimeout(state.draftTimer);if(!state.conversation)return;state.draftTimer=setTimeout(()=>api(`/conversations/${state.conversation.conversation_id}`,{method:'PATCH',body:JSON.stringify({draft_text:el.input.value})}).then(payload=>Object.assign(state.conversation,payload.data)).catch(()=>{}),immediate?0:500);}
  async function resumeOutbox(){
    const binding=captureOriginalManager(),rows=await outboxAll();assertOriginalManager(binding);
    let completed=0,held=0;
    for(const row of rows){
      if(row?.conversation_id!==binding.conversation_id){held++;continue;}
      try{if(await recoverOriginalOutcome(row,binding))completed++;else held++;}
      catch(error){if(error?.code==='gemini_original_manager_changed')throw error;held++;}
      assertOriginalManager(binding);
    }
    if(held)setStatus('Saved original requests retained; their exact outcomes remain unconfirmed. No replacement request was sent.','error');
    else if(completed)setStatus('Persisted completed turn confirmed. Original local request reconciled.');
  }

  function originalOutcomeMatches(data,original){
    if(!data||typeof data!=='object'||Array.isArray(data)||data.schema!=='custodial.console-original-outcome.v1')return false;
    if(data.state==='UNCONFIRMED_ORIGINAL_RETAINED')return false;
    const keys=['schema','state','client_message_id','correlation_id','conversation_id','body','orderedattachment_ids',
      'created_at','created_at_policy','user_message_id','assistant_message_id','user_completed_at','assistant_completed_at'];
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const timestamp=value=>{
      const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/);
      if(!match)return false;
      const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
      const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
      if(year<1||month<1||month>12||day<1||day>days[month-1]
        ||Number(match[4])>23||Number(match[5])>59||Number(match[6])>59)return false;
      const zone=match[7];return zone==='Z'||(Number(zone.slice(1,3))<=14&&Number(zone.slice(4))<=59
        &&(Number(zone.slice(1,3))<14||Number(zone.slice(4))===0));
    };
    return data.state==='PERSISTED_COMPLETED_TURN_ONLY'
      &&Object.keys(data).length===keys.length&&keys.every(key=>Object.hasOwn(data,key))
      &&['client_message_id','correlation_id','conversation_id','body','created_at'].every(key=>data[key]===original[key])
      &&Array.isArray(data.orderedattachment_ids)&&data.orderedattachment_ids.length===original.attachment_ids.length
      &&data.orderedattachment_ids.every((id,index)=>id===original.attachment_ids[index])
      &&data.created_at_policy==='LOCAL_DISPLAY_METADATA_NOT_SERVER_AUTHORITY'
      &&uuid.test(data.user_message_id)&&uuid.test(data.assistant_message_id)
      &&data.user_message_id!==data.assistant_message_id
      &&timestamp(data.user_completed_at)&&timestamp(data.assistant_completed_at);
  }
  async function outboxReadOriginal(record){
    const keys=['client_message_id','correlation_id','conversation_id','body','attachment_ids','created_at','state'];
    if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length!==keys.length
      ||keys.some(key=>!Object.hasOwn(record,key))||!['queued','dispatch_attempted'].includes(record.state))
      throw outboxError('gemini_outbox_original_invalid');
    const original=outboxOriginal(record),database=await db();let savedOriginal;
    if(!database)throw outboxError('gemini_outbox_original_absent');
    try{await txPromise(database,'readonly',store=>{
      const request=store.get(original.client_message_id);request.onsuccess=()=>{
        const saved=request.result;
        if(!saved||!sameOutboxOriginal(saved,original)||!['queued','dispatch_attempted'].includes(saved.state)
          ||Object.keys(saved).length!==keys.length||Object.keys(saved).some(key=>!keys.includes(key)))
          throw outboxError('gemini_outbox_original_changed');
        savedOriginal=outboxOriginal(saved);
      };return request;
    });return savedOriginal;}finally{database.close();}
  }
  async function recoverOriginalOutcome(record,binding){
    assertOriginalManager(binding);
    if(record?.conversation_id!==binding.conversation_id)return false;
    const original=await outboxReadOriginal(record);assertOriginalManager(binding);
    const expected={client_message_id:original.client_message_id,correlation_id:original.correlation_id,
      conversation_id:original.conversation_id,body:original.body,orderedattachment_ids:[...original.attachment_ids],
      created_at:original.created_at};
    const headers=await originalStreamHeaders(binding);assertOriginalManager(binding);
    const response=await fetch(`${API}/conversations/${encodeURIComponent(original.conversation_id)}/messages/original-outcome`,
      {method:'POST',cache:'no-store',credentials:'include',headers,body:JSON.stringify(expected)});
    assertOriginalManager(binding);
    const payload=await response.json().catch(()=>null);assertOriginalManager(binding);
    if(!response.ok||payload?.ok!==true||!originalOutcomeMatches(payload.data,original))return false;
    const current=await outboxReadOriginal(original);assertOriginalManager(binding);
    if(current.state!==original.state)return false;
    await outboxDelete(current,()=>sameOriginalManager(binding));assertOriginalManager(binding);
    return true;
  }

  async function readEventStream(stream,onEvent){const reader=stream.getReader();const decoder=new TextDecoder();let buffer='';while(true){const{value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});const frames=buffer.split(/\r?\n\r?\n/);buffer=frames.pop()||'';for(const frame of frames)parseFrame(frame,onEvent);if(done)break;}if(buffer.trim())parseFrame(buffer,onEvent);}
  function parseFrame(frame,onEvent){let type='message';let data='';frame.split(/\r?\n/).forEach(line=>{if(line.startsWith('event:'))type=line.slice(6).trim();if(line.startsWith('data:'))data+=line.slice(5).trim();});if(!data)return;let parsed;try{parsed=JSON.parse(data);}catch{return;}onEvent({type,data:parsed});}

  // Private cooperative DATA writer owner; never published as a capability.
  let outboxWebAdmission=null,outboxNativeRequired=false;
  const outboxMutationOwners=new WeakSet();
  function outboxSecurity(){
    let security;
    try{
      security=window.MemphisCustodialSecurity;
      if(security!=null||window.MemphisMobile?.edition==='custodial'||window.MemphisMobileBuildIdentity?.edition==='custodial'
        ||window.Capacitor?.isNativePlatform?.()===true)outboxNativeRequired=true;
    }catch{outboxNativeRequired=true;throw outboxError('custodial_security_state_unavailable');}
    if(outboxNativeRequired&&(security?.native!==true||typeof security.mutateProtectedWork!=='function'))
      throw outboxError('custodial_security_state_unavailable');
    return security||null;
  }
  function rawOutboxArea(name){
    const area=window[name],prototype=area&&Object.getPrototypeOf(area);
    const methods={};
    for(const key of ['getItem','setItem','key']){
      const descriptor=prototype&&Object.getOwnPropertyDescriptor(prototype,key);
      // The installed runtime firewall seals/wraps these methods. Never bind
      // its public wrapper as raw admission, or recover originals behind it.
      if(!descriptor||descriptor.writable!==true||descriptor.configurable!==true
        ||typeof descriptor.value!=='function'||area[key]!==descriptor.value)
        throw outboxError('custodial_security_state_unavailable');
      methods[key]=descriptor.value;
    }
    const current=()=>{
      if(window[name]!==area||Object.getPrototypeOf(area)!==prototype)throw outboxError('custodial_security_state_unavailable');
      for(const key of Object.keys(methods))if(area[key]!==methods[key])throw outboxError('custodial_security_state_unavailable');
    };
    return {current,storage:Object.freeze({
      getItem(key){current();return methods.getItem.call(area,key);},
      setItem(key,value){current();return methods.setItem.call(area,key,value);},
      key(index){current();return methods.key.call(area,index);},
      get length(){current();return area.length;},
    })};
  }
  function webOutboxAdmission(){
    if(!outboxWebAdmission)outboxWebAdmission=(async()=>{
      const module=await import('./mobile/src/custodial/protected-browser-admission.js');
      if(outboxSecurity())throw outboxError('custodial_security_state_unavailable');
      const local=rawOutboxArea('localStorage'),session=rawOutboxArea('sessionStorage');
      if(window.localStorage===window.sessionStorage)throw outboxError('custodial_security_state_unavailable');
      const factory=indexedDB,locks=window.navigator?.locks,cryptoApi=window.crypto;
      const gate=module.createProtectedBrowserAdmission({storage:local.storage,sessionStorage:session.storage,indexedDb:factory,locks,cryptoApi});
      const current=()=>{
        if(outboxSecurity()||indexedDB!==factory||window.navigator?.locks!==locks||window.crypto!==cryptoApi)
          throw outboxError('custodial_security_state_unavailable');
        local.current();session.current();
      };
      current();return {gate,current};
    })();
    return outboxWebAdmission;
  }
  async function mutateOutbox(operation,owns=()=>true){
    const security=outboxSecurity(),writer=security?.mutateProtectedWork;
    const run=async checkpoint=>{
      const owner=Object.freeze({current(){if(!owns())throw originalManagerChanged();checkpoint();}});
      outboxMutationOwners.add(owner);
      try{owner.current();const result=await operation(owner);owner.current();return result;}
      finally{outboxMutationOwners.delete(owner);}
    };
    if(security)return writer.call(security,context=>run(()=>{
      if(outboxSecurity()!==security||security.mutateProtectedWork!==writer||typeof context?.assertCurrent!=='function')
        throw outboxError('custodial_security_state_unavailable');
      context.assertCurrent();
    }),{requireEnrollment:true});
    const web=await webOutboxAdmission();web.current();
    return web.gate.mutate(()=>run(()=>{web.current();web.gate.requireMutation();}));
  }
  function requireOutboxOwner(owner){
    if(!owner||!outboxMutationOwners.has(owner))throw outboxError('custodial_security_state_unavailable');
    owner.current();
  }
  async function db(owner){
    const factory=indexedDB,open=factory?.open;
    if(typeof open!=='function')throw outboxError('gemini_outbox_unavailable');
    if(owner)requireOutboxOwner(owner);
    else{
      // Readonly recovery never intentionally opens an absent database. If a
      // listed DB disappears, abort its upgrade rather than create a new one.
      if(typeof factory.databases!=='function')throw outboxError('gemini_outbox_inventory_unavailable');
      const listed=await factory.databases();
      if(indexedDB!==factory||factory.open!==open||!Array.isArray(listed))throw outboxError('gemini_outbox_original_changed');
      const matches=listed.filter(row=>row?.name===DB_NAME);
      if(!matches.length)return null; // Absence is DATA, not custody/empty-work proof.
      if(matches.length!==1||matches[0].version!==1)throw outboxError('gemini_outbox_schema_unavailable');
    }
    return new Promise((resolve,reject)=>{
      let request,firstFailure;
      const current=()=>{if(indexedDB!==factory||factory.open!==open)throw outboxError('gemini_outbox_original_changed');if(owner)requireOutboxOwner(owner);};
      try{
        current();request=open.call(factory,DB_NAME,1);
        request.onupgradeneeded=()=>{
          try{if(!owner)throw outboxError('gemini_outbox_original_absent');current();request.result.createObjectStore(DB_STORE,{keyPath:'client_message_id'});current();}
          catch(error){firstFailure=error;try{request.transaction.abort();}catch{}}
        };
        // Blocked is not terminal and never releases the mutation owner.
        request.onblocked=()=>{};
        request.onerror=()=>{try{request.result?.close();}catch{}reject(firstFailure||request.error||outboxError('gemini_outbox_unavailable'));};
        request.onsuccess=()=>{
          const database=request.result;
          try{
            if(firstFailure)throw firstFailure;current();
            if(database.version!==1||!database.objectStoreNames.contains(DB_STORE))throw outboxError('gemini_outbox_schema_unavailable');
            database.onversionchange=()=>database.close();resolve(database);
          }catch(error){database.close();reject(error);}
        };
      }catch(error){reject(error);}
    });
  }
  function outboxError(code){return Object.assign(new Error('Saved original request is retained; its durable outcome is unconfirmed.'),{code});}
  function outboxOriginal(record){
    const ids=['client_message_id','correlation_id','conversation_id'],uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(!record||ids.some(key=>typeof record[key]!=='string'||!uuidPattern.test(record[key]))
      ||typeof record.body!=='string'||!record.body||typeof record.created_at!=='string'||!record.created_at
      ||!Array.isArray(record.attachment_ids)||record.attachment_ids.length>MAX_ATTACHMENTS
      ||record.attachment_ids.some(value=>typeof value!=='string'||!uuidPattern.test(value)))throw outboxError('gemini_outbox_original_invalid');
    return Object.freeze({...record,attachment_ids:Object.freeze(record.attachment_ids.slice())});
  }
  function sameOutboxOriginal(actual,expected){return actual&&['client_message_id','correlation_id','conversation_id','body','created_at'].every(key=>actual[key]===expected[key])
    &&Array.isArray(actual.attachment_ids)&&actual.attachment_ids.length===expected.attachment_ids.length
    &&actual.attachment_ids.every((value,index)=>value===expected.attachment_ids[index]);}
  async function outboxPut(record,owns=()=>true){
    const original=outboxOriginal(record);let saved=original,created=false;
    await mutateOutbox(async owner=>{
      const database=await db(owner);
      try{await txPromise(database,'readwrite',(store,abort)=>{const request=store.get(original.client_message_id);request.onsuccess=()=>{
        if(request.result===undefined){watchOutboxWrite(store.add(original),owner,abort);created=true;}
        else{if(!sameOutboxOriginal(request.result,original))throw outboxError('gemini_outbox_original_conflict');saved=outboxOriginal(request.result);}
      };return request;},owner);}finally{database.close();}
    },owns);
    if(created)freshOutboxOriginals.add(saved);return saved;
  }
  async function outboxAdmitDispatch(record,owns=()=>true){
    // Consume even on hold/refusal/uncertainty; no later retry can recreate it.
    if(!freshOutboxOriginals.delete(record))throw outboxError('gemini_outbox_dispatch_held');
    const original=outboxOriginal(record),keys=['client_message_id','correlation_id','conversation_id','body','attachment_ids','created_at','state'];
    await mutateOutbox(async owner=>{
      const database=await db(owner);
      try{await txPromise(database,'readwrite',(store,abort)=>{const request=store.get(original.client_message_id);request.onsuccess=()=>{
        const saved=request.result;
        if(original.state!=='queued'||!sameOutboxOriginal(saved,original)||saved.state!=='queued'
          ||Object.keys(saved).length!==keys.length||Object.keys(original).length!==keys.length
          ||Object.keys(saved).some(key=>!keys.includes(key))||Object.keys(original).some(key=>!keys.includes(key)))throw outboxError('gemini_outbox_dispatch_original_changed');
        watchOutboxWrite(store.put({...saved,state:'dispatch_attempted'}),owner,abort);
      };return request;},owner);}finally{database.close();}
    },owns);
    admittedOutboxDispatches.add(record);return record;
  }
  function watchOutboxWrite(request,owner,abort){
    request.onsuccess=()=>{try{requireOutboxOwner(owner);}catch(error){abort(error);}};return request;
  }
  // Storage-domain CAS. The fixed persisted-turn read must be checked before
  // entry; the original manager and raw row remain checked inside this write.
  async function outboxDelete(record,owns=()=>true){
    const original=outboxOriginal(record),keys=['client_message_id','correlation_id','conversation_id','body','attachment_ids','created_at','state'];
    return mutateOutbox(async owner=>{
    const database=await db(owner);
    try{if(!owns())throw originalManagerChanged();
      await txPromise(database,'readwrite',(store,abort)=>{const request=store.get(original.client_message_id);request.onsuccess=()=>{
      const saved=request.result;
      if(!owns()||!sameOutboxOriginal(saved,original)||saved.state!==original.state
        ||Object.keys(saved).length!==keys.length||Object.keys(original).length!==keys.length
        ||Object.keys(saved).some(key=>!keys.includes(key))||Object.keys(original).some(key=>!keys.includes(key)))throw outboxError('gemini_outbox_original_changed');
      const deletion=store.delete(original.client_message_id);
      // This request is a later IDB event than the lookup. Abort while the
      // transaction is still active if its original page owner has changed.
      deletion.onsuccess=()=>{try{requireOutboxOwner(owner);if(!owns())abort(originalManagerChanged());}catch(error){abort(error);}};
    };return request;},owner);return true;}finally{database.close();}
    },owns);
  }
  async function outboxAll(){const database=await db();if(!database)return [];try{const rows=await txPromise(database,'readonly',store=>store.getAll());return rows||[];}finally{database.close();}}
  function txPromise(database,mode,action,owner){return new Promise((resolve,reject)=>{
    let tx,result,originalError,settled=false;
    const note=error=>{if(!originalError)originalError=error||outboxError('gemini_outbox_transaction_failed');};
    const finish=error=>{if(settled)return;settled=true;try{if(owner)requireOutboxOwner(owner);}catch(failure){error=error||failure;}if(error)reject(error);else resolve(result);};
    // An abort refusal can mean the terminal event is already queued. Keep
    // the error, but do not settle/close ahead of that owned terminal event.
    const abort=error=>{note(error);try{tx.abort();}catch{}};
    try{
      if(mode==='readwrite')requireOutboxOwner(owner);
      tx=database.transaction(DB_STORE,mode);
      tx.oncomplete=()=>finish(originalError);
      tx.onabort=()=>finish(originalError||tx.error||outboxError('gemini_outbox_transaction_aborted'));
      tx.onerror=event=>note(event?.target?.error||tx.error);
      const request=action(tx.objectStore(DB_STORE),abort),onSuccess=request.onsuccess;
      request.onsuccess=event=>{result=request.result;try{if(owner)requireOutboxOwner(owner);onSuccess?.call(request,event);if(owner)requireOutboxOwner(owner);}catch(error){abort(error);}};
      request.onerror=()=>note(request.error);
    }catch(error){if(tx)abort(error);else finish(error);}
  });}

  function fileBase64(file){return file.arrayBuffer().then(buffer=>{const bytes=new Uint8Array(buffer);let binary='';const size=0x8000;for(let i=0;i<bytes.length;i+=size)binary+=String.fromCharCode(...bytes.subarray(i,i+size));return btoa(binary);});}
  function mimeFallback(name){const ext=String(name).toLowerCase().split('.').pop();return{png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',log:'text/plain',md:'text/markdown',csv:'text/csv',json:'application/json',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}[ext]||'application/octet-stream';}
  function formatBytes(value){const size=Number(value||0);if(size<1024)return`${size} B`;if(size<1024*1024)return`${(size/1024).toFixed(1)} KB`;return`${(size/1024/1024).toFixed(1)} MB`;}
  function formatTime(value){const date=new Date(value);if(Number.isNaN(date.getTime()))return'';return date.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago'});}
  function autoSize(){el.input.style.height='auto';el.input.style.height=`${Math.min(el.input.scrollHeight,210)}px`;}
  function scrollBottom(){requestAnimationFrame(()=>{el.transcript.scrollTop=el.transcript.scrollHeight;});}
  function showError(error){setStatus(error?.message||String(error),'error');}
})();
