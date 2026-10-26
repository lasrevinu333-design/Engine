(function(root){'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function principal(auth){const s=auth?.readSession?.(),p=s?.permissions;if(s?.role!=='ops_manager'||!s.token||!UUID.test(s.manager_id||'')||!UUID.test(s.credential_id||'')||!(Date.parse(s.expires_at)>Date.now())||p?.schema!=='custodial.manager-permissions.v1'||p.read!==true||p.close_scan_tickets!==true)return null;return[s.manager_id,s.credential_id,s.device_id||''].join('|');}
function create({auth=root.MemphisAuth,fetchImpl=(...args)=>root.fetch(...args),origin='https://memphis-zoo-mcp.onrender.com'}={}){
 let current=null,records=new Map(),generation=0;const pending=new Set();
 function clear(){current=null;records=new Map();generation++;}
 function status(id){return current&&current===principal(auth)?records.get(String(id).toLowerCase())||null:null;}
 async function refresh(rows){const owner=principal(auth),attempt=++generation;records=new Map();current=null;
  if(!owner)return false;
  const ids=[...new Set(rows.map(r=>r.ticket_id).filter(id=>UUID.test(id||'')).map(id=>id.toLowerCase()))];
  if(ids.length>500)throw Error('Ticket eligibility list exceeds its safe bound.');
  const headers=await auth.opsManagerAuthHeaders();if(principal(auth)!==owner)return false;const next=new Map();
  for(let i=0;i<ids.length;i+=100){const group=ids.slice(i,i+100),expected=new Set(group);
   const response=await fetchImpl(origin+'/dashboard-api/ticket-capabilities?ids='+encodeURIComponent(group.join(',')),{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
   const body=await response.json().catch(()=>null),data=body?.data;
   if(attempt!==generation||principal(auth)!==owner)return false;
   if(!response.ok||body?.ok!==true||data?.schema!=='custodial.ticket-capabilities.v1'||[data.manager_id,data.credential_id,auth.readSession()?.device_id||''].join('|')!==owner||!Array.isArray(data.tickets)||data.tickets.length!==group.length)throw Error('Ticket closure eligibility could not be verified.');
   for(const item of data.tickets){const id=String(item?.ticket_id||'').toLowerCase();if(!expected.delete(id)||typeof item.found!=='boolean'||typeof item.scan_session_verified!=='boolean'||typeof item.can_close!=='boolean'||(item.can_close&&(!item.found||item.status!=='open')))throw Error('Ticket closure response has invalid identities.');next.set(id,Object.freeze({...item,ticket_id:id}));}
   if(expected.size)throw Error('Ticket closure response is incomplete.');
  }
  if(attempt!==generation||principal(auth)!==owner)return false;records=next;current=owner;return true;
 }
 async function close(id,{outcome,reference=null,notes=null}={}){
  const orderReference=String(reference||'').trim();if(!['mark_fixed','work_order_sent'].includes(outcome)||(outcome==='work_order_sent'&&(!orderReference||orderReference.length>120))||(outcome==='mark_fixed'&&orderReference)||String(notes||'').length>1000)throw Error('Choose the actual closure outcome and work-order reference when applicable.');id=String(id||'').toLowerCase();const owner=principal(auth);if(!owner||current!==owner||status(id)?.can_close!==true)throw Error('Your current access does not permit closing this ticket.');if(pending.has(id))throw Error('This ticket closure is already in progress.');pending.add(id);
  try{const headers=await auth.opsManagerAuthHeaders();if(owner!==principal(auth))throw Error('Manager access changed before closure.');
   const response=await fetchImpl(origin+'/dashboard-api/close-ticket',{method:'POST',headers:{'Content-Type':'application/json',...headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify({ticket_id:id,outcome,external_work_order_reference:orderReference||null,close_notes:notes||null})});
   const body=await response.json().catch(()=>null),receipt=body?.data;
   if(owner!==principal(auth)){clear();throw Error('Manager access changed. Refresh to verify the ticket outcome.');}
   if(!response.ok||body?.ok!==true)throw Error(body?.error||'Ticket closure failed. Refresh to verify its status.');
   if(receipt?.ticket_id?.toLowerCase()!==id||receipt.status!=='closed'||receipt.outcome!==outcome||(receipt.external_work_order_reference||null)!==(orderReference||null)||!Number.isFinite(Date.parse(receipt.closed_at))||!String(receipt.closed_by||'').trim())throw Error('Closure receipt could not be verified. Refresh before retrying.');
   records.set(id,Object.freeze({...records.get(id),status:'closed',can_close:false}));return receipt;
  }finally{pending.delete(id);}
 }
 return Object.freeze({refresh,status,close,clear});
}
const api=Object.freeze({create,principal});root.MemphisTicketActions=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
