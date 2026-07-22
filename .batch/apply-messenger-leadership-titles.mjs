import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, oldText, newText) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: expected source block not found`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`${path}: replacement did not change file`);
  await writeFile(path, next);
}

await replaceExact(
  'thread.html',
  '<div class="personRole">All active employees and the shared Ops Manager contact</div>',
  '<div class="personRole">All active employees and Operations Leadership accounts</div>'
);
await replaceExact(
  'thread.html',
  `async function loadUsers(){ await resolveIdentity();`,
  `function messengerRoleTitle(user){ const explicit=String(user?.role_title||user?.job_title||'').trim(); if(explicit)return explicit; return String(user?.role||'').trim().toLowerCase()==='manager'?'Operations Leadership':'Employee'; }
async function loadUsers(){ await resolveIdentity();`
);
await replaceExact(
  'thread.html',
  `escapeHtml(user.role==='manager'?'Ops Manager':'Employee')`,
  `escapeHtml(messengerRoleTitle(user))`
);

await replaceExact(
  'messages.html',
  `els.identityLine.textContent=\`${'${mapped.display_name}'}${'${state.isManagerOverview?\' · shared Ops Manager chat\':\'\'}'}\`;`,
  `const title=String(mapped.role_title||mapped.job_title||'').trim(); els.identityLine.textContent=\`${'${mapped.display_name}'}${'${title?` · ${title}`:(state.isManagerOverview?\' · Operations Leadership\':\'\')}'}\`;`
);
await replaceExact(
  'messages.html',
  `const typeLabel=thread.is_ops_manager_shared?'All Ops Managers':labelThreadType(thread.thread_type);`,
  `const typeLabel=thread.is_ops_manager_shared?'Operations Leadership':labelThreadType(thread.thread_type);`
);

await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `function safe(value) { return value instanceof Error ? value.message : String(value || 'Unknown error'); }`,
  `function safe(value) { return value instanceof Error ? value.message : String(value || 'Unknown error'); }
function roleTitle(user = {}) {
  const explicit = String(user.role_title || user.job_title || '').trim();
  if (explicit) return explicit;
  const role = String(user.role || '').trim().toLowerCase();
  return role === 'manager' ? 'Operations Leadership' : (role === 'bot' ? 'Memphis' : 'Employee');
}`
);
await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `<div className="mz-chat-user-copy"><strong>{user.display_name}</strong><span>{user.role === 'manager' ? 'Operations Leadership' : 'Employee'}</span></div>`,
  `<div className="mz-chat-user-copy"><strong>{user.display_name}</strong><span>{roleTitle(user)}</span></div>`
);
await replaceExact(
  'mobile/src/chatscope/app.jsx',
  `<div className="mz-chat-brand"><img src={ZOO_LOGO} alt="Memphis Zoo" /><div className="mz-chat-brand-text"><strong>Memphis Messenger</strong><span>{identity?.display_name ? \`Signed in as \${identity.display_name}\` : 'ChatScope parallel client'}</span></div></div>`,
  `<div className="mz-chat-brand"><img src={ZOO_LOGO} alt="Memphis Zoo" /><div className="mz-chat-brand-text"><strong>Memphis Messenger</strong><span>{identity?.display_name ? \`\${identity.display_name} · \${roleTitle(identity)}\` : 'ChatScope parallel client'}</span></div></div>`
);

console.log('Prepared Messenger leadership-title frontend changes.');
