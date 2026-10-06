(function(root){'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,HASH=/^[a-f0-9]{64}$/;
function monday(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid service date.');const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Choose a valid service date.');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function validate(value,{date,revision,projectionId,managerId}){
 const doc=value?.document;if(value?.schema!=='custodial.coverall-pdf-pair.v1'||doc?.serviceDate!==date||doc.authorityRevision!==revision||doc.projectionId!==projectionId||doc.managerContact?.managerId!==managerId||!HASH.test(doc.documentDigest||'')||!Array.isArray(doc.contractors)||!doc.contractors.length)throw Error('The handout does not match the accepted date, revision or manager.');
 if(!Array.isArray(value.files)||value.files.length!==2||value.files.map(f=>f.language).join(',')!=='en,es'||value.bilingualFile?.language!=='en-es')throw Error('Both verified handout languages are required.');
 for(const file of [...value.files,value.bilingualFile])if(!HASH.test(file.sha256||'')||typeof file.base64!=='string'||file.base64.length>2800000||file.filename!==`CoverAll_${date}_r${revision}_${file.language}.pdf`)throw Error('Invalid handout file identity.');
 const combined=value.texts?.find(t=>t.language==='en-es');if(!combined||combined.documentDigest!==doc.documentDigest||typeof combined.text!=='string'||combined.text.length>1000000||!HASH.test(combined.sha256||''))throw Error('Route text is not bound to this accepted handout.');return value;
}
const api=Object.freeze({monday,validate});root.MemphisCoverAllPrint=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document?.getElementById('prepare'))return;
const d=root.document,el=id=>d.getElementById(id),auth=root.MemphisAuth,actions=root.MemphisSchedulerActions;
let owner=null,base='',busy=false,sequence=0,urls=[],guard=null,closed=false;
const sha=async bytes=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
function clear(){for(const url of urls)root.URL.revokeObjectURL(url);urls=[];el('downloads').replaceChildren();el('downloads').hidden=true;el('copy-section').hidden=true;el('copy-text').textContent='';}
function current(){if(!actions.same(owner,actions.principal(auth))||!actions.permissions(auth).coverall){clear();throw Error('Manager access changed. Return to Schedule and sign in again.');}}
async function request(path){current();const headers=await auth.opsManagerAuthHeaders();current();const response=await root.fetch(base+path,{method:'GET',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(65000),headers});const data=await response.json().catch(()=>null);current();if(!response.ok||data?.ok!==true)throw Error(data?.error||'Current handout information is unavailable.');return data.data;}
async function prepare(){if(busy||closed)return;busy=true;const attempt=++sequence;clear();el('prepare').disabled=true;el('date').disabled=true;
 try{current();const date=el('date').value,week=monday(date);el('back').href='./schedule-weekly.html?date='+encodeURIComponent(date);
 el('status').textContent='Checking the accepted schedule and both handout languages…';
 const snapshot=await request('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(week));
 if(snapshot?.week_start!==week||snapshot.projection_status!=='current'||!Number.isSafeInteger(snapshot.authority_revision)||!UUID.test(snapshot.latest_projection?.projection_id||''))throw Error('The schedule is not current. Regenerate or publish the accepted routes first.');
 const expected={date,revision:snapshot.authority_revision,projectionId:snapshot.latest_projection.projection_id,managerId:owner.managerId};
 const query=new URLSearchParams({week_start:week,service_date:date,expected_revision:String(expected.revision),projection_id:expected.projectionId});
 const value=validate(await request('/static-weekly/coverall-print?'+query),expected);
 const prepared=[];for(const file of [...value.files,value.bilingualFile]){const bytes=Uint8Array.from(root.atob(file.base64),c=>c.charCodeAt(0));if(bytes.length>2*1024*1024||await sha(bytes)!==file.sha256)throw Error('Handout file verification failed. No link was issued.');prepared.push({file,bytes});}
 const text=value.texts.find(t=>t.language==='en-es');if(await sha(new TextEncoder().encode(text.text))!==text.sha256)throw Error('Handout text verification failed.');
 current();if(closed||attempt!==sequence)return;
 const names={en:'English PDF',es:'Español PDF','en-es':'English + Español PDF'};
 for(const {file,bytes}of prepared){const url=root.URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));urls.push(url);const link=d.createElement('a');link.className='mz-button';link.href=url;link.download=file.filename;link.textContent=names[file.language];el('downloads').append(link);}
 el('downloads').hidden=false;el('copy-text').textContent=text.text;el('copy-section').hidden=false;el('status').textContent=`Verified ${date} · revision ${expected.revision} · ${value.document.contractors.length} CoverAll route(s). No assignments changed.`;
 }catch(error){if(!closed&&attempt===sequence){clear();el('status').textContent=String(error?.message||error);}}
 finally{busy=false;if(!closed){el('date').disabled=false;el('prepare').disabled=!actions.permissions(auth).coverall;}}
}
async function init(){await auth.requireOpsManagerSession({interactive:false,redirect:true,throwOnFailure:true});owner=actions.principal(auth);current();
 const response=await root.fetch('https://memphis-zoo-mcp.onrender.com/scheduler-runtime-config',{cache:'no-store',signal:AbortSignal.timeout(15000)});const payload=await response.json();
 const url=new URL(payload?.data?.public_url||'');if(!response.ok||payload?.ok!==true||url.protocol!=='https:'||!url.hostname.endsWith('.onrender.com')||url.username||url.password||url.search||url.hash)throw Error('The approved scheduler service is unavailable.');base=url.origin;current();
 el('date').value=new URLSearchParams(root.location.search).get('date')||auth.getCSTDateString();monday(el('date').value);el('back').href='./schedule-weekly.html?date='+encodeURIComponent(el('date').value);el('prepare').disabled=false;
 el('status').textContent='Choose a service date, then prepare handouts from its current accepted routes.';
 el('prepare').addEventListener('click',()=>void prepare());el('date').addEventListener('change',()=>{sequence++;clear();});
 guard=root.setInterval(()=>{try{current();}catch(error){root.clearInterval(guard);el('prepare').disabled=true;el('status').textContent=error.message;}},1000);
}
root.addEventListener('pagehide',()=>{closed=true;sequence++;clear();if(guard!==null)root.clearInterval(guard);},{once:true});
void init().catch(error=>{clear();el('status').textContent=String(error?.message||error);});
})(typeof globalThis!=='undefined'?globalThis:this);
