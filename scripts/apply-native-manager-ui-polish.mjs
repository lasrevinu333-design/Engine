import { readFile, writeFile } from 'node:fs/promises';

async function replaceExact(path, oldText, newText) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: expected source block not found`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`${path}: replacement did not change file`);
  await writeFile(path, next);
}

await replaceExact(
  'events-admin.html',
  `.hero{display:flex;gap:16px;align-items:center}.heroIcon{width:76px;height:76px;display:grid;place-items:center}.heroIcon img{max-width:100%;max-height:100%;filter:drop-shadow(0 10px 22px rgba(0,0,0,.2))}`,
  `.hero{display:flex;gap:16px;align-items:center;min-width:0}.heroIcon{width:76px;height:76px;flex:0 0 76px;display:grid;place-items:center;overflow:hidden}.heroIcon img{display:block;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 22px rgba(0,0,0,.2))}`,
);
await replaceExact(
  'events-admin.html',
  `.topActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}.pill,.btnLink`,
  `.topActions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;min-width:0;max-width:100%}.pill,.btnLink`,
);
await replaceExact(
  'events-admin.html',
  `.pill{display:none;max-width:620px;overflow:hidden;text-overflow:ellipsis}`,
  `.pill{display:none;max-width:min(620px,100%);min-width:0;overflow-wrap:anywhere;white-space:normal;line-height:1.2}`,
);
await replaceExact(
  'events-admin.html',
  `.heroIcon{width:62px;height:62px}.section`,
  `.heroIcon{width:62px;height:62px;flex-basis:62px}.section`,
);

await replaceExact(
  'messages.html',
  `max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
  `max-width:100%;overflow-wrap:anywhere;white-space:normal;line-height:1.2}`,
);

const chatThemePath = 'mobile/src/chatscope/theme.css';
const chatTheme = await readFile(chatThemePath, 'utf8');
if (!chatTheme.includes('@media(max-width:720px)')) throw new Error('ChatScope mobile media query not found');
if (!chatTheme.includes('@media(max-width:480px)')) {
  await writeFile(chatThemePath, `${chatTheme}@media(max-width:480px){.mz-chat-toolbar{height:124px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:'back brand new' 'memphis memphis memphis';gap:8px;padding:calc(env(safe-area-inset-top) + 8px) 10px 8px}.mz-chat-toolbar>.mz-button:first-child{grid-area:back}.mz-chat-brand{grid-area:brand}.mz-chat-toolbar>.mz-button:nth-of-type(2){grid-area:memphis;width:100%}.mz-chat-toolbar>.mz-button.primary{grid-area:new}.mz-chat-brand span{display:none}.mz-chat-stage{height:calc(100% - 124px)}.mz-chat-toolbar>.mz-button{min-width:0}.mz-chat-status{bottom:10px;max-width:calc(100vw - 28px);white-space:normal;text-align:center}}`);
}

await replaceExact(
  'mobile/src/manager/notifications.js',
  `  setStatus(permissionStatus, label, state.receive === 'granted' ? 'ok' : (state.receive === 'denied' ? 'error' : ''));
  return state;`,
  `  setStatus(permissionStatus, label, state.receive === 'granted' ? 'ok' : (state.receive === 'denied' ? 'error' : ''));
  enableDevice.textContent = state.receive === 'granted' ? 'Refresh Phone Registration' : 'Enable on This Phone';
  return state;`,
);

console.log('Applied native manager UI polish.');
