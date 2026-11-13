// One foreground mirror, never an ingress/receipt store or a second audio engine.
// Only the native capability facade can supply content and accept finite actions.
export function createProviderMirror({bridge,visible,current,locationMatches=()=>false,
  defer=fn=>setTimeout(fn,0),cancel=clearTimeout,repeat=(fn,delay)=>setInterval(fn,delay),clearRepeat=clearInterval}){
  let renderer=null,listener=null,subscribing=null,session=null,epoch=0,started=false,drain=null,nextTurn=null,repair=null,again=false,stopping=Promise.resolve();
  const entries=new Map();
  const eligible=()=>started&&visible()===true&&current()===true&&renderer!==null;
  const valid=(generation,id)=>eligible()&&epoch===generation&&session?.attachment_id===id;
  const schedule=()=>{if(nextTurn===null&&eligible())nextTurn=defer(()=>{nextTurn=null;void activate();});};
  const clearTimers=()=>{if(nextTurn!==null)cancel(nextTurn);if(repair!==null)clearRepeat(repair);nextTurn=null;repair=null;};
  function stop(){
    const old=session,oldListener=listener;epoch++;session=null;listener=null;clearTimers();
    for(const entry of entries.values()){entry.alive=false;entry.resolveDisplay(false);}
    entries.clear();
    const ownedRenderer=renderer;
    const release=async()=>{
      try{if(old?.state==='ATTACHED')await ownedRenderer?.stopAndReadback?.();}catch{/* UNKNOWN never releases a new attachment. */}
      if(old)try{await bridge.detach(old.attachment_id);}catch{/* Native pause/revocation may already have retired it. */}
      if(oldListener)try{await oldListener.remove();}catch{/* Its callback is already locally invalid. */}
    };
    const pending=stopping.then(release,release);stopping=pending.catch(()=>{});return pending;
  }
  function bind(value,generation,id){
    const entry={value,alive:true,rendered:false,visualRetired:false,audioStarting:false,audioStarted:false,audioDone:!value.play_audio,remove:null,open:null,
      status:{freshness:'FRESHNESS_UNAVAILABLE',navigation_pending:false,stop_audio:false},updateState:null};
    let displayResolve;entry.displayed=new Promise(resolve=>{displayResolve=resolve;});entry.resolveDisplay=displayResolve;
    const live=()=>entry.alive&&valid(generation,id);
    const action=async kind=>{
      if(!live()||!['opened','dismissed','acknowledged'].includes(kind))return false;
      // UI eligibility never grants an action: native Journal rechecks fresh
      // authority, or returns the exact already-durable original event.
      if(kind==='opened'&&entry.status.freshness!=='CURRENT'&&!entry.status.navigation_pending)return false;
      if(kind==='acknowledged'&&entry.status.freshness!=='CURRENT'&&!entry.status.stop_audio)return false;
      try{await bridge.apply(id,value.claim_id,kind);if(!live())return false;
        if(kind==='opened')entry.status={...entry.status,navigation_pending:true};
        if(kind==='acknowledged')entry.status={...entry.status,stop_audio:true};
        entry.updateState?.(action.presentationState());return true;
      }catch{return false;}
    };
    action.providerMirror=true;action.playAudio=value.play_audio;action.historical=value.historical;
    action.isCurrent=live;
    action.presentationState=()=>Object.freeze({freshness:entry.status.freshness,navigation_pending:entry.status.navigation_pending});
    action.onState=update=>{if(typeof update!=='function')throw new Error('Exact mirror state observer required.');entry.updateState=update;update(action.presentationState());};
    action.recheck=async()=>{if(!live())return false;try{return (await bridge.state(id,value.claim_id)).stop_audio!==true&&live();}catch{return false;}};
    action.onRetire=remove=>{if(typeof remove!=='function')throw new Error('Exact mirror retirement required.');entry.remove=remove;};
    action.onOpen=open=>{if(typeof open==='function')entry.open=open;};
    action.retire=()=>{
      if(!live())return;entry.visualRetired=true;
      void bridge.retire(id,value.claim_id).then(()=>{if(entry.audioDone){entry.alive=false;entries.delete(value.claim_id);}schedule();}).catch(()=>{});
    };
    action.detach=()=>{entry.alive=false;void stop();};
    action.beginAudio=async()=>{
      if(!value.play_audio||entry.audioStarting||entry.audioStarted||!live())return false;
      entry.audioStarting=true;
      if(!await entry.displayed||!live())return false;
      try{await bridge.apply(id,value.claim_id,'audio_started');entry.audioStarted=true;return live();}catch{return false;}
    };
    action.finishAudio=async completed=>{
      if(!entry.audioStarted||entry.audioDone||!live())return false;
      try{
        if(completed!==true&&await renderer.stopAndReadback(action)!==true)return false;
        await bridge.apply(id,value.claim_id,completed===true?'audio_completed':'audio_stopped');
        entry.audioDone=true;if(entry.visualRetired){entry.alive=false;entries.delete(value.claim_id);}schedule();return true;
      }catch{return false;}
    };
    entry.action=action;return entry;
  }
  async function reconcileEntry(entry,generation,id){
    if(!entry.alive)return false;
    const value=entry.value;
    let status;try{status=await bridge.state(id,value.claim_id);}catch{
      entry.alive=false;try{entry.remove?.({stopAudio:true});await renderer.stopAndReadback(entry.action);}catch{}
      entries.delete(value.claim_id);
      // A failed native read is not proof of revocation or a completed stop.
      // Retire this entire attachment; its replacement must prove idle again.
      throw new Error('Native claim observation unavailable.');
    }
    if(!valid(generation,id))return false;
    entry.status=status;entry.updateState?.(entry.action.presentationState());
    if(status.freshness==='RETIRED'){
      entry.alive=false;entry.remove?.({stopAudio:true});await renderer.stopAndReadback(entry.action);
      entries.delete(value.claim_id);throw new Error('Native claim definitively retired.');
    }
    if(status.retire_visual){
      if(entry.remove&&entry.remove({stopAudio:status.stop_audio})!==true)return false;
      entry.visualRetired=true;
      if(status.stop_audio&&entry.audioStarted&&!entry.audioDone){
        if(await renderer.stopAndReadback(entry.action)!==true)return false;
        await bridge.apply(id,value.claim_id,'audio_stopped');entry.audioDone=true;
      }
      await bridge.retire(id,value.claim_id);
      if(entry.audioDone){entry.alive=false;entries.delete(value.claim_id);}return true;
    }
    if(status.navigation_pending&&locationMatches(value.payload.route)){
      await bridge.apply(id,value.claim_id,'navigation_completed');await bridge.retire(id,value.claim_id);
      entry.alive=false;entries.delete(value.claim_id);return true;
    }
    if(!entry.rendered){
      // Reclassification is not a new historical restoration exception. Only
      // accepted original pending navigation survives absent fresh authority.
      if(status.freshness!=='CURRENT'&&!status.navigation_pending)return false;
      const event={notification:{title:value.payload.title,body:value.payload.body,data:value.payload}};
      if(renderer.show(event,entry.action)!==true)return false;
      entry.rendered=true;
      try{if(!value.historical&&status.freshness==='CURRENT')await bridge.apply(id,value.claim_id,'displayed');entry.resolveDisplay(true);}
      catch(error){entry.resolveDisplay(false);entry.alive=false;entry.remove?.({stopAudio:true});throw error;}
    }
    if(status.navigation_pending&&valid(generation,id))entry.open?.();
    return true;
  }
  async function run(){
    if(!eligible()||!listener)return;
    await stopping;if(!eligible()||!listener)return;
    const generation=epoch;
    if(!session){
      const attached=await bridge.attach();
      if(!eligible()||epoch!==generation){try{await bridge.detach(attached.attachment_id);}catch{}return;}
      session=attached;
      if(attached.state!=='ATTACHED')return; // NONE/SUSPENDED causes no renderer/audio effects.
      if(await renderer.stopAndReadback()!==true||!valid(generation,attached.attachment_id))return;
      await bridge.stopped(attached.attachment_id);
      if(!valid(generation,attached.attachment_id))return;
      session={...attached,audio_ready:true};
    }
    const id=session.attachment_id;
    if(session.state!=='ATTACHED')return;
    if(!session.audio_ready){
      if(await renderer.stopAndReadback()!==true||!valid(generation,id))return;
      await bridge.stopped(id);if(!valid(generation,id))return;session={...session,audio_ready:true};
    }
    for(const entry of [...entries.values()]){
      if(!valid(generation,id))return;
      if(!await reconcileEntry(entry,generation,id))return;
    }
    // At most8 native pulls per execution; not8 per recursively queued hint.
    for(let count=0;count<8;count++){
      if(!valid(generation,id))return;
      const value=await bridge.next(id);if(!valid(generation,id)||value===null)return;
      if(entries.has(value.claim_id)||entries.size>=256)throw new Error('Native claim repeated or mirror capacity reached.');
      const entry=bind(value,generation,id);entries.set(value.claim_id,entry);
      if(!await reconcileEntry(entry,generation,id))return;
      if(count===7)schedule();
    }
  }
  function reconcile(){
    if(!eligible())return Promise.resolve();
    if(drain){again=true;return drain;}
    drain=run().catch(async()=>{await stop();}).finally(()=>{
      drain=null;
      if(eligible()&&repair===null)repair=repeat(()=>{void activate();},60000);
      if(again){again=false;schedule();}
    });return drain;
  }
  async function activate(){
    if(!eligible()){await stop();return;}
    await stopping;if(!eligible())return;
    if(subscribing)await subscribing.catch(()=>{});
    if(!eligible())return;
    if(!listener){
      const generation=epoch;
      const pending=(async()=>{
        let owned=null;
        const handle=await bridge.subscribe(()=>{if(owned&&listener===owned&&eligible())void reconcile();});
        if(!eligible()||epoch!==generation){await handle.remove();return;}
        owned=handle;listener=handle;
      })();
      subscribing=pending;
      try{await pending;}catch{await stop();if(eligible()&&repair===null)repair=repeat(()=>{void activate();},60000);return;}finally{if(subscribing===pending)subscribing=null;}
    }
    if(!listener||!eligible())return;
    if(repair===null)repair=repeat(()=>{void activate();},60000);
    void reconcile();
  }
  return Object.freeze({
    async start(){
      if(started)return;started=true;
      // Every attachment, including resume, subscribes before native snapshot
      // and pulls regardless of whether any retained hint was observed.
      await activate();
    },
    setRenderer(value){
      if(typeof value?.show!=='function'||typeof value?.stopAndReadback!=='function')throw new Error('Single owned notification renderer required.');
      if(renderer&&renderer!==value)throw new Error('Notification renderer already owned.');
      renderer=value;if(started)void activate();
    },
    changed(){if(started)void activate();},
    async suspend(){await stop();},
    async destroy(){started=false;await stop();if(subscribing)await subscribing.catch(()=>{});},
    reconcile,
  });
}
