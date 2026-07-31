const API='https://memphis-zoo-mcp.onrender.com';
const managersEl=document.getElementById('managers');
const statusEl=document.getElementById('status');
const codeCard=document.getElementById('code-card');
const codeManager=document.getElementById('code-manager');
const codeEl=document.getElementById('code');
const codeExpiry=document.getElementById('code-expiry');
let plaintext='';
function esc(value){return String(value??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function request(path,options={}){const headers=await window.MemphisMobile.authHeaders();const response=await fetch(`${API}${path}`,{method:options.method||'GET',cache:'no-store',headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined});const payload=await response.json().catch(()=>null);if(!response.ok||!payload?.ok)throw new Error(payload?.error||`HTTP ${response.status}`);return payload.data;}
async function load(){statusEl.textContent='Loading leadership roster…';try{const data=await request('/leadership-api/roster');const managers=Array.isArray(data.managers)?data.managers:[];managersEl.innerHTML=managers.map((manager)=>`<article class="event"><strong>${esc(manager.display_name)}</strong><div class="muted">${esc(manager.job_title||'Operations Leadership')}</div><div class="actions" style="margin-top:10px"><button class="btn primary" data-manager="${esc(manager.manager_id)}" data-name="${esc(manager.display_name)}" type="button">Generate Personal Code</button></div></article>`).join('')||'<p class="muted">No active leadership identities found.</p>';statusEl.textContent='';}catch(error){statusEl.textContent=error.message;statusEl.className='status error';}}
managersEl.addEventListener('click',async(event)=>{const button=event.target.closest('[data-manager]');if(!button)return;button.disabled=true;statusEl.textContent='Generating code…';try{const data=await request(`/leadership-api/managers/${encodeURIComponent(button.dataset.manager)}/enrollment-code`,{method:'POST',body:{ttl_seconds:900}});plaintext=String(data.display_code||data.one_time_code||'');codeManager.textContent=button.dataset.name;codeEl.textContent=plaintext;codeExpiry.textContent=`Expires ${new Date(data.expires_at).toLocaleString()}. It works once and is displayed only now.`;codeCard.hidden=false;statusEl.textContent='Personal code ready.';statusEl.className='status ok';}catch(error){statusEl.textContent=error.message;statusEl.className='status error';}finally{button.disabled=false;}});
document.getElementById('copy-code').addEventListener('click',async()=>{if(!plaintext)return;await navigator.clipboard.writeText(plaintext.replace(/\s+/g,''));statusEl.textContent='Code copied.';statusEl.className='status ok';});
window.addEventListener('pagehide',()=>{plaintext='';codeEl.textContent='';});
load();
