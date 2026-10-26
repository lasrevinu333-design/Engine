(function(root){'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,HASH=/^[a-f0-9]{64}$/;
function monday(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid service date.');const d=new Date(date+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date)throw Error('Choose a valid service date.');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}
function validate(value,{date,revision,projectionId,publicationId,replayDigest,managerId}){
 const doc=value?.document;if(value?.schema!=='custodial.coverall-pdf-pair.v1'||doc?.serviceDate!==date||doc.authorityRevision!==revision||doc.projectionId!==projectionId||doc.managerContact?.managerId!==managerId||!HASH.test(doc.documentDigest||'')||!Array.isArray(doc.contractors)||!doc.contractors.length)throw Error('The handout does not match the accepted date, revision or manager.');
 if(!UUID.test(publicationId||'')||typeof replayDigest!=='string'||!HASH.test(replayDigest)||doc.publicationId!==publicationId||doc.replayDigest!==replayDigest)throw Error('The handout does not match the accepted schedule source.');
 if(!Array.isArray(value.files)||value.files.length!==2||value.files.map(f=>f.language).join(',')!=='en,es'||value.bilingualFile?.language!=='en-es')throw Error('Both verified handout languages are required.');
 for(const file of [...value.files,value.bilingualFile])if(!HASH.test(file.sha256||'')||typeof file.base64!=='string'||file.base64.length>2800000||file.filename!==`CoverAll_${date}_r${revision}_${file.language}.pdf`)throw Error('Invalid handout file identity.');
 const combined=value.texts?.find(t=>t.language==='en-es');if(!combined||combined.documentDigest!==doc.documentDigest||typeof combined.text!=='string'||combined.text.length>1000000||!HASH.test(combined.sha256||''))throw Error('Route text is not bound to this accepted handout.');return value;
}
const api=Object.freeze({monday,validate});root.MemphisCoverAllPrint=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(!root.document?.getElementById('prepare'))return;
const d=root.document,el=id=>d.getElementById(id),auth=root.MemphisAuth,actions=root.MemphisSchedulerActions;
let owner=null,base='',busy=false,sequence=0,urls=[],guard=null,closed=false,entry=null,accessDenied=false,listening=false;
const reads=new Set();
const sha=async bytes=>Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
function clear(){for(const url of urls)root.URL.revokeObjectURL(url);urls=[];el('downloads').replaceChildren();el('downloads').hidden=true;el('copy-section').hidden=true;el('copy-text').textContent='';}
function requireOpen(){if(closed)throw Error('This handout view is closed.');}
function current(){requireOpen();if(accessDenied||!actions.same(owner,actions.principal(auth))||!actions.permissions(auth).coverall){accessDenied=true;clear();el('prepare').disabled=true;el('date').disabled=true;throw Error('Manager access changed. Return to Schedule and sign in again.');}}
async function readJson(url,options,timeout){current();const read=new AbortController();reads.add(read);
 const timer=root.setTimeout(()=>read.abort(),timeout);
 try{const response=await root.fetch(url,{...options,signal:read.signal});current();const data=await response.json().catch(()=>null);current();return{response,data};}
 finally{reads.delete(read);root.clearTimeout(timer);}
}
async function request(path){current();const headers=await auth.opsManagerAuthHeaders();current();const {response,data}=await readJson(base+path,{method:'GET',cache:'no-store',redirect:'error',headers},65000);current();if(response.status===401||response.status===403){accessDenied=true;current();}if(!response.ok||data?.ok!==true)throw Error(data?.error||'Current handout information is unavailable.');return data.data;}
async function prepare(){if(busy||closed||accessDenied)return;busy=true;const attempt=++sequence;clear();el('prepare').disabled=true;el('date').disabled=true;
 try{current();const date=el('date').value,week=monday(date);el('back').href='./schedule-weekly.html?date='+encodeURIComponent(date);
 el('status').textContent='Checking the accepted schedule and both handout languages…';
 const snapshot=await request('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(week));
 if(snapshot?.week_start!==week||snapshot.projection_status!=='current'||!Number.isSafeInteger(snapshot.authority_revision)||snapshot.authority_revision<0||!UUID.test(snapshot.current_publication?.publication_id||'')||!UUID.test(snapshot.latest_projection?.projection_id||'')||typeof snapshot.latest_projection?.replay_digest!=='string'||!HASH.test(snapshot.latest_projection.replay_digest))throw Error('The schedule is not current. Regenerate or publish the accepted routes first.');
 if(entry&&date===entry.date&&(snapshot.authority_revision!==entry.revision||snapshot.latest_projection.projection_id!==entry.projectionId))throw Error('The schedule changed since the reviewed Schedule page. Return to Schedule and refresh before preparing matching handouts.');
 const expected={date,revision:snapshot.authority_revision,projectionId:snapshot.latest_projection.projection_id,publicationId:snapshot.current_publication.publication_id,replayDigest:snapshot.latest_projection.replay_digest,managerId:owner.managerId};
 const query=new URLSearchParams({week_start:week,service_date:date,expected_revision:String(expected.revision),projection_id:expected.projectionId});
 const value=validate(await request('/static-weekly/coverall-print?'+query),expected);
 const prepared=[];for(const file of [...value.files,value.bilingualFile]){const bytes=Uint8Array.from(root.atob(file.base64),c=>c.charCodeAt(0));if(bytes.length>2*1024*1024)throw Error('Handout file verification failed. No link was issued.');const digest=await sha(bytes);current();if(digest!==file.sha256)throw Error('Handout file verification failed. No link was issued.');prepared.push({file,bytes});}
 const text=value.texts.find(t=>t.language==='en-es'),textDigest=await sha(new TextEncoder().encode(text.text));current();if(textDigest!==text.sha256)throw Error('Handout text verification failed.');
 current();if(closed||attempt!==sequence)return;
 // Digest verification can outlive a concurrent staffing change. Do not issue
 // links for the earlier revision after that change has been read back.
 const readback=await request('/static-weekly/manager-snapshot?week_start='+encodeURIComponent(week));
 if(readback?.week_start!==week||readback.projection_status!=='current'||readback.authority_revision!==expected.revision||readback.latest_projection?.projection_id!==expected.projectionId||readback.current_publication?.publication_id!==expected.publicationId||readback.latest_projection?.replay_digest!==expected.replayDigest)throw Error('The schedule changed while verifying the handouts. Return to Schedule and refresh; no links were issued.');
 current();if(closed||attempt!==sequence)return;
 const names={en:'English PDF',es:'Español PDF','en-es':'English + Español PDF'};
 for(const {file,bytes}of prepared){const url=root.URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));urls.push(url);const link=d.createElement('a');link.className='mz-button';link.href=url;link.download=file.filename;link.textContent=names[file.language];el('downloads').append(link);}
 el('downloads').hidden=false;el('copy-text').textContent=text.text;el('copy-section').hidden=false;el('status').textContent=`Verified ${date} · revision ${expected.revision} · ${value.document.contractors.length} CoverAll route(s). No assignments changed.`;
 }catch(error){if(!closed&&attempt===sequence){clear();el('status').textContent=String(error?.message||error);}}
 finally{busy=false;if(!closed){el('date').disabled=accessDenied;el('prepare').disabled=accessDenied||!actions.permissions(auth).coverall;}}
}
const onPrepare=()=>void prepare(),onDateChange=()=>{if(closed)return;sequence++;clear();if(entry&&el('date').value!==entry.date){entry=null;el('status').textContent='Different service date selected. Prepare its current accepted routes; no prior revision is reused.';}};
async function init(){requireOpen();await auth.requireOpsManagerSession({interactive:false,redirect:true,throwOnFailure:true});requireOpen();owner=actions.principal(auth);current();
 const {response,data:payload}=await readJson('https://memphis-zoo-mcp.onrender.com/scheduler-runtime-config',{cache:'no-store'},15000);current();
 const url=new URL(payload?.data?.public_url||'');if(!response.ok||payload?.ok!==true||url.protocol!=='https:'||!url.hostname.endsWith('.onrender.com')||url.username||url.password||url.search||url.hash)throw Error('The approved scheduler service is unavailable.');base=url.origin;current();
 const params=new URLSearchParams(root.location.search),pinned=params.has('expected_revision')||params.has('projection_id');
 if(pinned&&!params.get('date'))throw Error('The reviewed schedule service date is missing. Return to Schedule and refresh.');
 el('date').value=params.has('date')?params.get('date'):auth.getCSTDateString();monday(el('date').value);
 if(params.has('expected_revision')||params.has('projection_id')){const revision=params.get('expected_revision'),projectionId=params.get('projection_id');
  if(!/^(0|[1-9]\d{0,15})$/.test(revision||'')||!Number.isSafeInteger(Number(revision))||!UUID.test(projectionId||''))throw Error('The reviewed schedule identity is incomplete. Return to Schedule and refresh.');
  entry={date:el('date').value,revision:Number(revision),projectionId};
 }
 el('back').href='./schedule-weekly.html?date='+encodeURIComponent(el('date').value);el('prepare').disabled=false;
 el('status').textContent=entry?`Prepare handouts matching the reviewed Schedule revision ${entry.revision}. A changed revision requires a fresh Schedule readback.`:'Choose a service date, then prepare handouts from its current accepted routes.';
 el('prepare').addEventListener('click',onPrepare);el('date').addEventListener('change',onDateChange);listening=true;
 guard=root.setInterval(()=>{if(closed)return;try{current();}catch(error){root.clearInterval(guard);el('prepare').disabled=true;el('status').textContent=error.message;}},1000);
}
root.addEventListener('pagehide',()=>{closed=true;sequence++;if(guard!==null)root.clearInterval(guard);
 if(listening){el('prepare').removeEventListener('click',onPrepare);el('date').removeEventListener('change',onDateChange);listening=false;}
 for(const read of reads)read.abort();clear();el('prepare').disabled=true;el('date').disabled=true;
},{once:true});
void init().catch(error=>{if(!closed){clear();el('status').textContent=String(error?.message||error);}});
})(typeof globalThis!=='undefined'?globalThis:this);
