(function (root) {
  'use strict';
  const API = 'https://memphis-zoo-mcp.onrender.com/dashboard-api/gps-map-context';
  const PHONE_API = 'https://memphis-zoo-mcp.onrender.com/dashboard-api/phone-locations';
  const READ_TIMEOUT_MS = 10000;
  async function read({ headers, fetchImpl = root.fetch?.bind(root), signal,
    onUpdate, onAuthorityError, timeoutMs = READ_TIMEOUT_MS }) {
    if (!headers || typeof fetchImpl !== 'function') throw new Error('Named-manager read adapter required');
    async function get(url){
      const controller=new AbortController();
      let timer,abort;
      const cancelled=new Promise((_,reject)=>{
        abort=()=>{controller.abort();reject(new Error('Location read cancelled'));};
        if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
        timer=setTimeout(()=>{controller.abort();reject(new Error('Location read timed out'));},timeoutMs);
      });
      try{return await Promise.race([cancelled,(async()=>{
        if(controller.signal.aborted)throw new Error('Location read cancelled');
        const response=await fetchImpl(url,{method:'GET',cache:'no-store',headers,signal:controller.signal});
        if(controller.signal.aborted)throw new Error('Location read cancelled');
        if(response.status===401||response.status===403)throw Object.assign(new Error('Manager location authority unavailable'),{authority:true});
        const payload=await response.json().catch(()=>null);
        return response.ok&&payload?.ok===true?payload:null;
      })()]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    }
    let history=null,historyReady=false,phone=null,delivered=false,authorityError=null;
    const context=()=>{
      const valid=history?.meta?.contract==='gps-map-context.v1'&&Array.isArray(history?.data?.work);
      return {work:valid?history.data.work:[],historyUnavailable:!valid,
        historyPending:!historyReady,historyVersion:historyReady?1:0,phones:phone.data.phones,phoneGeneratedAt:phone.meta.generated_at};
    };
    // Optional work history must never delay a verified assigned-phone position.
    void get(API).then(value=>{history=value;},error=>{
      if(error.authority){authorityError=error;if(!signal?.aborted)onAuthorityError?.(error);}
    }).then(()=>{
      historyReady=true;
      if(delivered&&!authorityError&&!signal?.aborted)onUpdate?.(context());
    }).catch(()=>{});
    phone=await get(PHONE_API);
    if(authorityError)throw authorityError;
    if(signal?.aborted)throw new Error('Location read cancelled');
    if(phone?.meta?.contract!=='custodial.assigned-phone-location.v1'||!Array.isArray(phone?.data?.phones))
      throw new Error('Verified assigned phone positions unavailable');
    delivered=true;
    return context();
  }
  const api = Object.freeze({ read, API, PHONE_API });
  root.MemphisCustodialGpsPathSource = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
